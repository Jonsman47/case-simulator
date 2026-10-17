import fs from 'node:fs'
import path from 'node:path'

interface SkinForPricing {
  baseValue: number
  finish: string
  hasStatTrak: boolean
  hasSouvenir: boolean
  id: string
  marketName: string
  url: string
  weapon: string
  wearKeys: string[]
}

type PriceMap = Partial<Record<string, number>>

interface SkinPriceResult {
  fallbackCount: number
  id: string
  marketName: string
  missingNormal: string[]
  missingStatTrak: string[]
  missingSouvenir: string[]
  normal: PriceMap
  representativePrice: number
  sourceUrl: string
  statTrak: PriceMap
  statTrakFound: number
  souvenir: PriceMap
  souvenirFound: number
  updatedCount: number
}

const rootDir = process.cwd()
const generatedSkinsPath = path.resolve(rootDir, 'src/data/generated/skins.generated.ts')
const outputPath = path.resolve(rootDir, 'src/data/generated/skinPrices.generated.ts')
const reportPath = path.resolve(rootDir, 'skin-price-report.txt')
const cachePath = path.resolve(rootDir, 'src/data/generated/skin-price-cache.json')
const csgoskinsBaseUrl = 'https://csgoskins.gg/items'

const wearLabels: Record<string, string> = {
  FactoryNew: 'Factory New',
  MinimalWear: 'Minimal Wear',
  FieldTested: 'Field-Tested',
  WellWorn: 'Well-Worn',
  BattleScarred: 'Battle-Scarred',
}

const wearSlugToKey: Record<string, string> = {
  'factory-new': 'FactoryNew',
  'minimal-wear': 'MinimalWear',
  'field-tested': 'FieldTested',
  'well-worn': 'WellWorn',
  'battle-scarred': 'BattleScarred',
}

const representativeWearPreference = [
  'FieldTested',
  'MinimalWear',
  'FactoryNew',
  'WellWorn',
  'BattleScarred',
]
const compactWearOrder = ['FactoryNew', 'MinimalWear', 'FieldTested', 'WellWorn', 'BattleScarred']

// Condition-independent listing snapshots verified directly on CSGOSKINS.GG on
// 2026-10-17. Vanilla items expose one price per edition rather than wear URLs.
const verifiedPriceOverrides: Record<string, { normal?: number; statTrak?: number; souvenir?: PriceMap }> = {
  'Bayonet | ★ Bayonet': { normal: 182, statTrak: 218 },
  'Classic Knife | ★ Classic Knife': { normal: 149, statTrak: 167 },
  'Flip Knife | ★ Flip Knife': { normal: 150, statTrak: 156 },
  'Gut Knife | ★ Gut Knife': { normal: 51.27, statTrak: 66.27 },
  'Karambit | ★ Karambit': { normal: 870, statTrak: 861 },
  'M9 Bayonet | ★ M9 Bayonet': { normal: 604, statTrak: 609 },
  'Huntsman Knife | ★ Huntsman Knife': { normal: 95.83, statTrak: 130 },
  'Falchion Knife | ★ Falchion Knife': { normal: 89.67, statTrak: 125 },
  'Bowie Knife | ★ Bowie Knife': { normal: 71.95, statTrak: 110 },
  'Butterfly Knife | ★ Butterfly Knife': { normal: 1030, statTrak: 986 },
  'Shadow Daggers | ★ Shadow Daggers': { normal: 56.99, statTrak: 84.29 },
  'Paracord Knife | ★ Paracord Knife': { normal: 44.62, statTrak: 56.3 },
  'Survival Knife | ★ Survival Knife': { normal: 43.01, statTrak: 51.67 },
  'Ursus Knife | ★ Ursus Knife': { normal: 62.77, statTrak: 71.31 },
  'Navaja Knife | ★ Navaja Knife': { normal: 35, statTrak: 46.63 },
  'MP5-SD | Lab Rats': { souvenir: { FactoryNew: 0.3, MinimalWear: 0.23, FieldTested: 0.24 } },
}

function slugify(value: string) {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^\u2605\s*/, '')
    .replace(/['’]/g, '')
    .replace(/\./g, '')
    .replace(/&/g, ' ')
    .replace(/♥/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'unknown'
}

function createCsgoskinsItemSlug(weapon: string, finish: string) {
  const normalizedFinish = finish.replace(/^\u2605\s*/, '').trim()
  const baseSlug = slugify(`${weapon} ${finish}`)

  if (baseSlug === 'desert-eagle-sunset-storm') {
    if (finish.includes('å£±') || finish.includes('壱')) {
      return 'desert-eagle-sunset-storm-1'
    }

    if (finish.includes('å¼') || finish.includes('弐')) {
      return 'desert-eagle-sunset-storm-2'
    }
  }

  if (slugify(normalizedFinish) === slugify(weapon)) {
    return `${slugify(normalizedFinish)}-vanilla`
  }

  return baseSlug
}

function unescapeTsString(value: string) {
  return JSON.parse(value) as string
}

function readStringField(block: string, field: string) {
  const match = block.match(new RegExp(`${field}:\\s*("(?:\\\\.|[^"])*")`))
  return match ? unescapeTsString(match[1]) : undefined
}

function readNumberField(block: string, field: string) {
  const match = block.match(new RegExp(`${field}:\\s*([0-9.]+)`))
  return match ? Number(match[1]) : undefined
}

function readBooleanField(block: string, field: string) {
  const match = block.match(new RegExp(`${field}:\\s*(true|false)`))
  return match?.[1] === 'true'
}

function readWearKeys(block: string) {
  const matches = block.matchAll(/\[WearCondition\.([A-Za-z]+)\]/g)
  return Array.from(new Set(Array.from(matches, (match) => match[1])))
}

function parseGeneratedSkins() {
  const source = fs.readFileSync(generatedSkinsPath, 'utf8')
  const blocks = source.match(/ {2}\{[\s\S]*?\n {2}\}/g) ?? []

  return blocks.map((block) => {
    const id = readStringField(block, 'id')
    const displayName = readStringField(block, 'displayName')
    const weapon = readStringField(block, 'weapon')
    const finish = readStringField(block, 'finish')
    const baseValue = readNumberField(block, 'baseValue')

    if (!id || !displayName || !weapon || !finish || typeof baseValue !== 'number') {
      return undefined
    }

    const marketName = `${weapon} | ${finish}`

    return {
      baseValue,
      finish,
      hasStatTrak: readBooleanField(block, 'hasStatTrak'),
      hasSouvenir: readBooleanField(block, 'hasSouvenir'),
      id,
      marketName,
      url: `${csgoskinsBaseUrl}/${createCsgoskinsItemSlug(weapon, finish)}`,
      weapon,
      wearKeys: readWearKeys(block),
    } satisfies SkinForPricing
  }).filter((skin): skin is SkinForPricing => Boolean(skin))
}

function parseMoney(value: string) {
  const normalized = value.replace(/\$/g, '').replace(/,/g, '').trim()
  const parsed = Number(normalized)

  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : undefined
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function parsePricesFromHtml(html: string, pageSlug: string) {
  const normal: PriceMap = {}
  const statTrak: PriceMap = {}
  const souvenir: PriceMap = {}
  const linkPattern = new RegExp(
    `<a[^>]+href="https://csgoskins\\.gg/items/${pageSlug}/([^"]+)"[\\s\\S]*?<div class="flex-none text-right[^"]*">\\s*([^<]+?)\\s*</div>`,
    'g',
  )

  for (const match of html.matchAll(linkPattern)) {
    const variantSlug = decodeHtml(match[1])
    const price = parseMoney(decodeHtml(match[2]))

    if (typeof price !== 'number') {
      continue
    }

    const isStatTrak = variantSlug.startsWith('stattrak-')
    const isSouvenir = variantSlug.startsWith('souvenir-')
    const wearSlug = variantSlug.replace(/^(stattrak|souvenir)-/, '')
    const wearKey = wearSlugToKey[wearSlug]

    if (!wearKey) {
      continue
    }

    if (isSouvenir) {
      souvenir[wearKey] = price
    } else if (isStatTrak) {
      statTrak[wearKey] = price
    } else {
      normal[wearKey] = price
    }
  }

  // Vanilla knives have one condition-independent listing per edition instead of
  // wear-specific URLs. Expand that single sourced price across the simulator's
  // legacy wear slots so all existing item instances keep a stable valuation.
  if (pageSlug.endsWith('-vanilla')) {
    const versionPattern = new RegExp(
      `href="https://csgoskins\\.gg/items/${pageSlug}/(normal|stattrak|souvenir)"[\\s\\S]{0,1800}?\\$([0-9,.]+)`,
      'g',
    )

    for (const match of html.matchAll(versionPattern)) {
      const price = parseMoney(match[2])
      const target = match[1] === 'stattrak' ? statTrak : match[1] === 'souvenir' ? souvenir : normal

      if (typeof price === 'number') {
        for (const wearKey of Object.values(wearSlugToKey)) target[wearKey] = price
      }
    }
  }

  return { normal, souvenir, statTrak }
}

async function fetchWithRetry(url: string, attempts = 3) {
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          'cache-control': 'no-cache',
          pragma: 'no-cache',
          'user-agent': 'Mozilla/5.0',
        },
      })

      if (response.status === 404) {
        return undefined
      }

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'))
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : attempt * 10_000

        await new Promise((resolve) => setTimeout(resolve, waitMs))
        throw new Error('HTTP 429')
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return await response.text()
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, attempt * 750))
    }
  }

  throw lastError
}

function selectRepresentativePrice(normal: PriceMap, fallback: number) {
  for (const wear of representativeWearPreference) {
    const price = normal[wear]

    if (typeof price === 'number') {
      return price
    }
  }

  return fallback
}

async function updateSkinPrice(skin: SkinForPricing): Promise<SkinPriceResult> {
  const html = await fetchWithRetry(skin.url)
  const pageSlug = skin.url.split('/').pop() ?? ''
  const parsed = html ? parsePricesFromHtml(html, pageSlug) : { normal: {}, souvenir: {}, statTrak: {} }
  const requiredWears = skin.wearKeys.length > 0 ? skin.wearKeys : Object.keys(wearLabels)
  const missingNormal = requiredWears.filter((wear) => typeof parsed.normal[wear] !== 'number')
  const missingStatTrak = skin.hasStatTrak
    ? requiredWears.filter((wear) => typeof parsed.statTrak[wear] !== 'number')
    : []
  const missingSouvenir = skin.hasSouvenir
    ? requiredWears.filter((wear) => typeof parsed.souvenir[wear] !== 'number')
    : []
  const updatedCount = Object.keys(parsed.normal).length + Object.keys(parsed.statTrak).length + Object.keys(parsed.souvenir).length

  return {
    fallbackCount: missingNormal.length + missingStatTrak.length,
    id: skin.id,
    marketName: skin.marketName,
    missingNormal,
    missingStatTrak,
    missingSouvenir,
    normal: parsed.normal,
    representativePrice: selectRepresentativePrice(parsed.normal, skin.baseValue),
    sourceUrl: skin.url,
    statTrak: parsed.statTrak,
    statTrakFound: Object.keys(parsed.statTrak).length,
    souvenir: parsed.souvenir,
    souvenirFound: Object.keys(parsed.souvenir).length,
    updatedCount,
  }
}

async function runLimited<T, TResult>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<TResult>,
) {
  const results: TResult[] = []
  let nextIndex = 0

  await Promise.all(Array.from({ length: limit }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await worker(items[currentIndex], currentIndex)
    }
  }))

  return results
}

function writeGeneratedPrices(results: SkinPriceResult[]) {
  const body = results
    .filter((result) => result.updatedCount > 0)
    .map((result) => `  ${JSON.stringify(result.id)}: ${JSON.stringify([
      result.representativePrice,
      ...compactWearOrder.map((wear) => result.normal[wear] ?? null),
      ...compactWearOrder.map((wear) => result.statTrak[wear] ?? null),
      ...compactWearOrder.map((wear) => result.souvenir?.[wear] ?? null),
    ])}`)
    .join(',\n')

  fs.writeFileSync(
    outputPath,
    `// Generated by scripts/updateSkinPricesFromCsgoskins.ts. Do not hand-edit.
export type GeneratedSkinPriceTuple = readonly [number, ...Array<number | null>]
export const GENERATED_SKIN_PRICES = {
${body}
} satisfies Record<string, GeneratedSkinPriceTuple>
`,
  )
}

function applyVerifiedPriceOverride(result: SkinPriceResult, skin: SkinForPricing) {
  const override = verifiedPriceOverrides[result.marketName]

  if (!override) return result

  const requiredWears = skin.wearKeys.length > 0 ? skin.wearKeys : Object.keys(wearLabels)
  const normal = { ...result.normal }
  const statTrak = { ...result.statTrak }
  const souvenir = { ...(result.souvenir ?? {}), ...(override.souvenir ?? {}) }

  if (typeof override.normal === 'number') {
    for (const wear of requiredWears) normal[wear] = override.normal
  }
  if (typeof override.statTrak === 'number') {
    for (const wear of requiredWears) statTrak[wear] = override.statTrak
  }

  return {
    ...result,
    fallbackCount:
      requiredWears.filter((wear) => typeof normal[wear] !== 'number').length +
      (skin.hasStatTrak ? requiredWears.filter((wear) => typeof statTrak[wear] !== 'number').length : 0) +
      (skin.hasSouvenir ? requiredWears.filter((wear) => typeof souvenir[wear] !== 'number').length : 0),
    missingNormal: requiredWears.filter((wear) => typeof normal[wear] !== 'number'),
    missingStatTrak: skin.hasStatTrak ? requiredWears.filter((wear) => typeof statTrak[wear] !== 'number') : [],
    missingSouvenir: skin.hasSouvenir ? requiredWears.filter((wear) => typeof souvenir[wear] !== 'number') : [],
    normal,
    representativePrice: typeof override.normal === 'number' ? override.normal : result.representativePrice,
    souvenir,
    souvenirFound: Object.keys(souvenir).length,
    statTrak,
    statTrakFound: Object.keys(statTrak).length,
    updatedCount: Object.keys(normal).length + Object.keys(statTrak).length + Object.keys(souvenir).length,
  }
}

function formatMissingList(results: SkinPriceResult[], field: 'missingNormal' | 'missingStatTrak' | 'missingSouvenir') {
  return results
    .filter((result) => result[field].length > 0)
    .map((result) => `- ${result.marketName}: ${result[field].map((wear) => wearLabels[wear] ?? wear).join(', ')}`)
}

function writeReport(results: SkinPriceResult[]) {
  const updatedSkins = results.filter((result) => result.updatedCount > 0)
  const missingSkins = results.filter((result) => result.updatedCount === 0)
  const statTrakPricesFound = results.reduce((total, result) => total + result.statTrakFound, 0)
  const souvenirPricesFound = results.reduce((total, result) => total + (result.souvenirFound ?? 0), 0)
  const fallbackPricesKept = results.reduce((total, result) => total + result.fallbackCount, 0)
  const lines = [
    'CSGOSKINS.GG skin price update report',
    `Generated at: ${new Date().toISOString()}`,
    '',
    `Skins checked: ${results.length}`,
    `Skins updated: ${updatedSkins.length}`,
    `Missing skins: ${missingSkins.length}`,
    `StatTrak prices found: ${statTrakPricesFound}`,
    `Souvenir prices found: ${souvenirPricesFound}`,
    `Fallback prices kept: ${fallbackPricesKept}`,
    '',
    'Missing skins:',
    ...(missingSkins.length > 0
      ? missingSkins.map((result) => `- ${result.marketName} (${result.sourceUrl})`)
      : ['- None']),
    '',
    'Missing wear condition prices:',
    ...(
      formatMissingList(results, 'missingNormal').length > 0
        ? formatMissingList(results, 'missingNormal')
        : ['- None']
    ),
    '',
    'Missing StatTrak wear condition prices:',
    ...(
      formatMissingList(results, 'missingStatTrak').length > 0
        ? formatMissingList(results, 'missingStatTrak')
        : ['- None']
    ),
    '',
    'Missing Souvenir wear condition prices:',
    ...(formatMissingList(results, 'missingSouvenir').length > 0
      ? formatMissingList(results, 'missingSouvenir')
      : ['- None']),
    '',
    'Updated skins:',
    ...updatedSkins.map((result) => `- ${result.marketName}: ${result.updatedCount} price(s)`),
  ]

  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`)
}

async function main() {
  const skins = parseGeneratedSkins()
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1]
  const concurrencyArg = process.argv.find((arg) => arg.startsWith('--concurrency='))?.split('=')[1]
  const limit = limitArg ? Number(limitArg) : undefined
  const concurrency = concurrencyArg && Number.isFinite(Number(concurrencyArg))
    ? Math.max(1, Number(concurrencyArg))
    : 8
  const fresh = process.argv.includes('--fresh')
  const retryMissing = process.argv.includes('--retry-missing')
  const selectedSkins = Number.isFinite(limit) && limit > 0 ? skins.slice(0, limit) : skins
  const cachedResults = fresh || !fs.existsSync(cachePath)
    ? []
    : JSON.parse(fs.readFileSync(cachePath, 'utf8')) as SkinPriceResult[]
  const normalizedCachedResults = cachedResults.map((result) => ({
    ...result,
    missingSouvenir: result.missingSouvenir ?? [],
    souvenir: result.souvenir ?? {},
    souvenirFound: result.souvenirFound ?? 0,
  }))
  const usableCachedResults = retryMissing
    ? normalizedCachedResults.filter((result) => result.updatedCount > 0)
    : normalizedCachedResults
  const resultsById = new Map(usableCachedResults.map((result) => [result.id, result]))
  const skinsToFetch = selectedSkins.filter((skin) => !resultsById.has(skin.id))

  console.log(`Checking ${selectedSkins.length} CSGOSKINS.GG item page(s).`)
  console.log(`Cached: ${selectedSkins.length - skinsToFetch.length}. Remaining: ${skinsToFetch.length}.`)

  let completedSinceFlush = 0
  await runLimited(skinsToFetch, concurrency, async (skin, index) => {
    if ((index + 1) % 50 === 0 || index === 0) {
      console.log(`Checked ${index + 1}/${skinsToFetch.length}: ${skin.marketName}`)
    }

    try {
      const result = await updateSkinPrice(skin)
      resultsById.set(skin.id, result)
      completedSinceFlush += 1

      if (completedSinceFlush >= 25) {
        fs.writeFileSync(cachePath, JSON.stringify(Array.from(resultsById.values()), null, 2))
        completedSinceFlush = 0
      }

      return result
    } catch (error) {
      console.warn(`Failed ${skin.marketName}: ${error instanceof Error ? error.message : String(error)}`)

      const result = {
        fallbackCount: skin.wearKeys.length,
        id: skin.id,
        marketName: skin.marketName,
        missingNormal: skin.wearKeys,
        missingStatTrak: skin.hasStatTrak ? skin.wearKeys : [],
        missingSouvenir: skin.hasSouvenir ? skin.wearKeys : [],
        normal: {},
        representativePrice: skin.baseValue,
        sourceUrl: skin.url,
        statTrak: {},
        statTrakFound: 0,
        souvenir: {},
        souvenirFound: 0,
        updatedCount: 0,
      }

      resultsById.set(skin.id, result)
      return result
    }
  })
  const results = selectedSkins
    .map((skin) => {
      const result = resultsById.get(skin.id)
      return result ? applyVerifiedPriceOverride(result, skin) : undefined
    })
    .filter((result): result is SkinPriceResult => Boolean(result))

  fs.writeFileSync(cachePath, JSON.stringify(Array.from(resultsById.values()), null, 2))
  writeGeneratedPrices(results)
  writeReport(results)

  const updated = results.filter((result) => result.updatedCount > 0).length
  console.log(`Updated ${updated}/${results.length} skins.`)
  console.log(`Report written to ${path.relative(rootDir, reportPath)}.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
