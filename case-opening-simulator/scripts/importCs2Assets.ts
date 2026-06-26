import fs from 'node:fs'
import path from 'node:path'

interface AssetImportConfig {
  sourceFolder: string
  fallbackImageFolder?: string
  outputFolder: string
  generatedDataFolder: string
}

interface ApiRef {
  id: string
  name: string
  image?: string
}

interface ApiRarity {
  id: string
  name: string
  color: string
}

interface ApiSkin {
  id: string
  name: string
  weapon?: ApiRef
  category?: ApiRef
  pattern?: ApiRef
  min_float?: number
  max_float?: number
  rarity?: ApiRarity
  stattrak?: boolean
  souvenir?: boolean
  wears?: ApiRef[]
  collections?: ApiRef[]
  crates?: ApiRef[]
  image?: string
}

interface ApiUngroupedSkin extends ApiSkin {
  skin_id?: string
  wear?: ApiRef
}

interface ApiCrateDrop {
  id: string
  name: string
  rarity?: ApiRarity
  image?: string
}

interface ApiCrate {
  id: string
  name: string
  type: string | null
  first_sale_date?: string | null
  contains?: ApiCrateDrop[]
  contains_rare?: ApiCrateDrop[]
  image?: string
  loot_list?: {
    name?: string
  } | null
}

interface GeneratedSkin {
  id: string
  displayName: string
  weapon: string
  finish: string
  weaponId: string
  patternId: string
  minFloat: number
  maxFloat: number
  rarity: string
  rarityId: string
  rarityColor: string
  baseValue: number
  caseIds: string[]
  image: string
  imageUrl?: string
  imageFileName: string
  statTrak: boolean
  souvenir: boolean
  hasStatTrak: boolean
  hasSouvenir: boolean
  collections: string[]
  wearRanges: Partial<Record<string, { min: number; max: number }>>
}

interface GeneratedDrop {
  skinId: string
  rarityId: string
  weight: number
  isRare?: boolean
}

interface GeneratedCase {
  id: string
  name: string
  displayName: string
  cost: number
  status: string
  image: string
  imageUrl?: string
  imageFileName: string
  releaseDate?: number
  lootList?: string | null
  dropTable: GeneratedDrop[]
}

interface ImportReport {
  downloadedImages: string[]
  reusedImages: string[]
  fallbackImages: string[]
  placeholderImages: string[]
  missingSkinRefs: string[]
  imageErrors: string[]
}

const rootDir = process.cwd()
const configPath = path.resolve(rootDir, 'asset-import.config.json')
const placeholderPath = path.resolve(rootDir, 'public/assets/placeholder.png')
const args = new Set(process.argv.slice(2))
const skipImages = args.has('--skip-images')
const dryRun = args.has('--dry-run')

const wearThresholds = {
  FactoryNew: { label: 'Factory New', min: 0, max: 0.07 },
  MinimalWear: { label: 'Minimal Wear', min: 0.07, max: 0.15 },
  FieldTested: { label: 'Field-Tested', min: 0.15, max: 0.38 },
  WellWorn: { label: 'Well-Worn', min: 0.38, max: 0.45 },
  BattleScarred: { label: 'Battle-Scarred', min: 0.45, max: 1 },
} as const

const rarityBaseValues: Record<string, number> = {
  Consumer: 0.05,
  Industrial: 0.25,
  MilSpec: 0.85,
  Restricted: 2.75,
  Classified: 10,
  Covert: 45,
  SpecialItem: 750,
  Contraband: 5000,
}

const caseOdds: Record<string, number> = {
  Consumer: 79.92,
  Industrial: 79.92,
  MilSpec: 79.92,
  Restricted: 15.98,
  Classified: 3.2,
  Covert: 0.64,
  SpecialItem: 0.26,
  Contraband: 0.01,
}

function readJsonFile(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown parse error'

    throw new Error(`Failed to read JSON file "${path.relative(rootDir, filePath)}": ${message}`, {
      cause: error,
    })
  }
}

function readJsonArray<T>(filePath: string, label: string): T[] {
  const value = readJsonFile(filePath)

  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected a JSON array in "${path.relative(rootDir, filePath)}".`)
  }

  return value as T[]
}

function readImportConfig(filePath: string): AssetImportConfig {
  const value = readJsonFile(filePath)

  if (!value || typeof value !== 'object') {
    throw new Error('Invalid asset import config: expected a JSON object.')
  }

  const config = value as Partial<AssetImportConfig>
  const requiredFields: (keyof AssetImportConfig)[] = [
    'sourceFolder',
    'outputFolder',
    'generatedDataFolder',
  ]

  for (const field of requiredFields) {
    if (typeof config[field] !== 'string' || !config[field]?.trim()) {
      throw new Error(`Invalid asset import config: "${field}" must be a non-empty string.`)
    }
  }

  if (
    config.fallbackImageFolder !== undefined &&
    (typeof config.fallbackImageFolder !== 'string' || !config.fallbackImageFolder.trim())
  ) {
    throw new Error('Invalid asset import config: "fallbackImageFolder" must be a non-empty string when provided.')
  }

  return config as AssetImportConfig
}

function hasRequiredApiIdentity(value: unknown): value is { id: string; name: string } {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as { id?: unknown; name?: unknown }

  return typeof record.id === 'string' && Boolean(record.id) && typeof record.name === 'string' && Boolean(record.name)
}

function keepValidApiRecords<T extends { id: string; name: string }>(
  records: unknown[],
  label: string,
): T[] {
  const validRecords: T[] = []
  let skippedRecords = 0

  for (const record of records) {
    if (hasRequiredApiIdentity(record)) {
      validRecords.push(record as T)
    } else {
      skippedRecords += 1
    }
  }

  if (skippedRecords > 0) {
    console.warn(`Skipped ${skippedRecords} invalid ${label} record(s) missing id/name.`)
  }

  if (validRecords.length === 0) {
    throw new Error(`Invalid ${label}: no usable records with id/name were found.`)
  }

  return validRecords
}

function ensureDirectory(directory: string) {
  fs.mkdirSync(directory, { recursive: true })
}

function slugify(value: string) {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return slug || 'unknown'
}

function normalizeSkinNameForLookup(value: string) {
  return slugify(
    value
      .replace(/^\u2605\s*/, '')
      .replace(/^StatTrak\S*\s+/i, '')
      .replace(/^Souvenir\s+/i, '')
      .replace(/\s+\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/i, '')
      .trim(),
  )
}

function splitSkinName(name: string) {
  const [weapon, finish] = name.replace(/^\u2605\s*/, '').split('|').map((part) => part.trim())

  return {
    weapon: weapon || name,
    finish: finish || name,
  }
}

function isSpecialSkin(skin: Pick<ApiSkin, 'name' | 'category' | 'weapon'>) {
  const name = skin.name.toLowerCase()
  const category = skin.category?.name.toLowerCase() ?? ''
  const weapon = skin.weapon?.name.toLowerCase() ?? ''

  return (
    skin.name.startsWith('\u2605') ||
    category.includes('glove') ||
    category.includes('knife') ||
    weapon.includes('knife') ||
    weapon.includes('glove') ||
    name.includes('glove')
  )
}

function mapApiRarityToEnumName(rarity: ApiRarity | undefined, skin?: Pick<ApiSkin, 'name' | 'category' | 'weapon'>) {
  if (skin && isSpecialSkin(skin)) {
    return 'SpecialItem'
  }

  const rarityName = rarity?.name.toLowerCase() ?? ''
  const rarityId = rarity?.id.toLowerCase() ?? ''

  if (rarityName.includes('contraband') || rarityId.includes('contraband')) {
    return 'Contraband'
  }

  if (rarityName.includes('extraordinary')) {
    return 'SpecialItem'
  }

  if (rarityName.includes('covert') || rarityId.includes('ancient')) {
    return 'Covert'
  }

  if (rarityName.includes('classified') || rarityId.includes('legendary')) {
    return 'Classified'
  }

  if (rarityName.includes('restricted') || rarityId.includes('mythical')) {
    return 'Restricted'
  }

  if (rarityName.includes('mil-spec') || rarityId.includes('rare')) {
    return 'MilSpec'
  }

  if (rarityName.includes('industrial') || rarityId.includes('uncommon')) {
    return 'Industrial'
  }

  return 'Consumer'
}

function getLocalImageFileName(id: string, name: string) {
  return `${id}_${slugify(name).slice(0, 72)}.png`
}

function getPublicImagePath(kind: 'skins' | 'cases', fileName: string) {
  return `/assets/cs2/${kind}/${fileName}`
}

function roundFloat(value: number) {
  return Number(value.toFixed(5))
}

function parseReleaseDate(date: string | null | undefined) {
  if (!date) {
    return undefined
  }

  const parsed = Date.parse(date.replaceAll('/', '-'))

  return Number.isFinite(parsed) ? parsed : undefined
}

function buildWearRanges(skin: ApiSkin, ungroupedWearNames: Set<string> | undefined) {
  const minFloat = typeof skin.min_float === 'number' ? skin.min_float : 0
  const maxFloat = typeof skin.max_float === 'number' ? skin.max_float : 1
  const apiWearNames = new Set(
    (skin.wears?.map((wear) => wear.name) ?? Array.from(ungroupedWearNames ?? [])).filter(Boolean),
  )
  const ranges: Partial<Record<string, { min: number; max: number }>> = {}

  for (const [wearKey, threshold] of Object.entries(wearThresholds)) {
    if (apiWearNames.size > 0 && !apiWearNames.has(threshold.label)) {
      continue
    }

    const min = Math.max(minFloat, threshold.min)
    const max = Math.min(maxFloat, threshold.max)

    if (min <= max) {
      ranges[wearKey] = {
        min: roundFloat(min),
        max: roundFloat(max),
      }
    }
  }

  return ranges
}

function createGeneratedSkin(skin: ApiSkin, ungroupedWearNames: Set<string> | undefined): GeneratedSkin {
  const fallbackName = splitSkinName(skin.name)
  const weapon = skin.weapon?.name ?? fallbackName.weapon
  const finish = skin.pattern?.name ?? fallbackName.finish
  const rarity = mapApiRarityToEnumName(skin.rarity, skin)
  const imageFileName = getLocalImageFileName(skin.id, skin.name)

  return {
    id: skin.id,
    displayName: skin.name,
    weapon,
    finish,
    weaponId: slugify(skin.weapon?.name ?? weapon),
    patternId: slugify(skin.pattern?.name ?? finish),
    minFloat: typeof skin.min_float === 'number' ? skin.min_float : 0,
    maxFloat: typeof skin.max_float === 'number' ? skin.max_float : 1,
    rarity,
    rarityId: skin.rarity?.id ?? 'rarity_unknown',
    rarityColor: skin.rarity?.color ?? '#9ca3af',
    baseValue: rarityBaseValues[rarity] ?? 1,
    caseIds: skin.crates?.map((crate) => crate.id) ?? [],
    image: getPublicImagePath('skins', imageFileName),
    imageUrl: skin.image,
    imageFileName,
    statTrak: false,
    souvenir: false,
    hasStatTrak: Boolean(skin.stattrak),
    hasSouvenir: Boolean(skin.souvenir),
    collections: skin.collections?.map((collection) => collection.name) ?? [],
    wearRanges: buildWearRanges(skin, ungroupedWearNames),
  }
}

function getDropWeightByRarity(drops: ApiCrateDrop[], drop: ApiCrateDrop, skinById: Map<string, GeneratedSkin>) {
  const skin = skinById.get(drop.id)
  const rarity = skin?.rarity ?? mapApiRarityToEnumName(drop.rarity)
  const rarityCount = drops.filter((entry) => {
    const entrySkin = skinById.get(entry.id)
    return (entrySkin?.rarity ?? mapApiRarityToEnumName(entry.rarity)) === rarity
  }).length

  return (caseOdds[rarity] ?? 1) / Math.max(1, rarityCount)
}

function createGeneratedCase(
  crate: ApiCrate,
  skinById: Map<string, GeneratedSkin>,
  report: ImportReport,
): GeneratedCase | undefined {
  const regularDrops = crate.contains ?? []
  const rareDrops = crate.contains_rare ?? []
  const dropTable: GeneratedDrop[] = []

  for (const drop of regularDrops) {
    if (!skinById.has(drop.id)) {
      report.missingSkinRefs.push(`${crate.id} (${crate.name}) references missing skin ${drop.id} (${drop.name})`)
      continue
    }

    dropTable.push({
      skinId: drop.id,
      rarityId: drop.rarity?.id ?? skinById.get(drop.id)?.rarityId ?? 'rarity_unknown',
      weight: roundFloat(getDropWeightByRarity(regularDrops, drop, skinById)),
    })
  }

  const rareWeight = rareDrops.length > 0 ? caseOdds.SpecialItem / rareDrops.length : 0

  for (const drop of rareDrops) {
    if (!skinById.has(drop.id)) {
      report.missingSkinRefs.push(`${crate.id} (${crate.name}) references missing rare skin ${drop.id} (${drop.name})`)
      continue
    }

    dropTable.push({
      skinId: drop.id,
      rarityId: drop.rarity?.id ?? skinById.get(drop.id)?.rarityId ?? 'rarity_unknown',
      weight: roundFloat(rareWeight),
      isRare: true,
    })
  }

  if (dropTable.length === 0) {
    return undefined
  }

  const imageFileName = getLocalImageFileName(crate.id, crate.name)

  return {
    id: crate.id,
    name: crate.name,
    displayName: crate.name,
    cost: 2.5,
    status: 'Unlocked',
    image: getPublicImagePath('cases', imageFileName),
    imageUrl: crate.image,
    imageFileName,
    releaseDate: parseReleaseDate(crate.first_sale_date),
    lootList: crate.loot_list?.name ?? null,
    dropTable,
  }
}

function loadFallbackImageIndex(fallbackImageFolder: string | undefined) {
  if (!fallbackImageFolder) {
    return new Map<string, string>()
  }

  const metadataPath = path.resolve(path.dirname(fallbackImageFolder), 'output.jsonl')

  if (!fs.existsSync(metadataPath)) {
    return new Map<string, string>()
  }

  const index = new Map<string, string>()
  const lines = fs.readFileSync(metadataPath, 'utf8').split(/\r?\n/)

  for (const line of lines) {
    if (!line.trim()) {
      continue
    }

    try {
      const entry = JSON.parse(line) as { name?: string; imageid?: string }

      if (!entry.name || !entry.imageid) {
        continue
      }

      const imagePath = path.join(fallbackImageFolder, `${entry.imageid}.png`)

      if (fs.existsSync(imagePath)) {
        index.set(normalizeSkinNameForLookup(entry.name), imagePath)
      }
    } catch {
      continue
    }
  }

  return index
}

async function downloadImage(url: string, destination: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())

  fs.writeFileSync(destination, buffer)
}

async function copyOrDownloadImage({
  destination,
  displayName,
  fallbackIndex,
  report,
  url,
}: {
  destination: string
  displayName: string
  fallbackIndex: Map<string, string>
  report: ImportReport
  url?: string
}) {
  if (fs.existsSync(destination)) {
    report.reusedImages.push(destination)
    return
  }

  if (skipImages) {
    report.reusedImages.push(destination)
    return
  }

  if (url) {
    try {
      await downloadImage(url, destination)
      report.downloadedImages.push(destination)
      return
    } catch (error) {
      report.imageErrors.push(`${displayName}: ${error instanceof Error ? error.message : 'download failed'}`)
    }
  }

  const fallbackImage = fallbackIndex.get(normalizeSkinNameForLookup(displayName))

  if (fallbackImage) {
    fs.copyFileSync(fallbackImage, destination)
    report.fallbackImages.push(destination)
    return
  }

  fs.copyFileSync(placeholderPath, destination)
  report.placeholderImages.push(destination)
}

async function runLimited<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let index = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index]
      index += 1
      await worker(item)
    }
  })

  await Promise.all(runners)
}

function asTsString(value: string) {
  return JSON.stringify(value)
}

function asTsStringArray(values: string[]) {
  return `[${values.map(asTsString).join(', ')}]`
}

function writeGeneratedSkins(filePath: string, skins: GeneratedSkin[]) {
  const body = skins.map((skin) => {
    const wearRanges = Object.entries(skin.wearRanges)
      .map(([wear, range]) => {
        return `      [WearCondition.${wear}]: { min: ${range.min}, max: ${range.max} },`
      })
      .join('\n')

    return `  {
    id: ${asTsString(skin.id)},
    displayName: ${asTsString(skin.displayName)},
    weapon: ${asTsString(skin.weapon)},
    finish: ${asTsString(skin.finish)},
    weaponId: ${asTsString(skin.weaponId)},
    patternId: ${asTsString(skin.patternId)},
    minFloat: ${skin.minFloat},
    maxFloat: ${skin.maxFloat},
    rarity: Rarity.${skin.rarity},
    rarityId: ${asTsString(skin.rarityId)},
    rarityColor: ${asTsString(skin.rarityColor)},
    baseValue: ${skin.baseValue},
    caseIds: ${asTsStringArray(skin.caseIds)},
    image: ${asTsString(skin.image)},
    statTrak: ${skin.statTrak},
    souvenir: ${skin.souvenir},
    hasStatTrak: ${skin.hasStatTrak},
    hasSouvenir: ${skin.hasSouvenir},
    collections: ${asTsStringArray(skin.collections)},
    wearRanges: {
${wearRanges}
    },
  }`
  }).join(',\n')

  fs.writeFileSync(
    filePath,
    `import { Rarity, WearCondition } from '../models'
import type { ImportedSkinDefinition } from '../importedAssetTypes'

export const SKIN_DEFINITIONS = [
${body}
] satisfies ImportedSkinDefinition[]
`,
  )
}

function writeGeneratedCases(filePath: string, cases: GeneratedCase[]) {
  const body = cases.map((caseDef) => {
    const dropTable = caseDef.dropTable.map((drop) => {
      return `      { skinId: ${asTsString(drop.skinId)}, rarityId: ${asTsString(drop.rarityId)}, weight: ${drop.weight}${drop.isRare ? ', isRare: true' : ''} },`
    }).join('\n')
    const releaseDate = typeof caseDef.releaseDate === 'number'
      ? `\n    releaseDate: ${caseDef.releaseDate},`
      : ''

    return `  {
    id: ${asTsString(caseDef.id)},
    name: ${asTsString(caseDef.name)},
    displayName: ${asTsString(caseDef.displayName)},
    cost: ${caseDef.cost},
    status: CaseStatus.${caseDef.status},
    image: ${asTsString(caseDef.image)},${releaseDate}
    lootList: ${caseDef.lootList === null || caseDef.lootList === undefined ? 'null' : asTsString(caseDef.lootList)},
    dropTable: [
${dropTable}
    ],
  }`
  }).join(',\n')

  fs.writeFileSync(
    filePath,
    `import { CaseStatus } from '../models'
import type { ImportedCaseDefinition } from '../importedAssetTypes'

export const CASE_DEFINITIONS = [
${body}
] satisfies ImportedCaseDefinition[]

export function pickGeneratedCaseDrop(caseId: string, prng: () => number = Math.random) {
  const caseDef = CASE_DEFINITIONS.find((definition) => definition.id === caseId)

  if (!caseDef || caseDef.dropTable.length === 0) {
    return undefined
  }

  const totalWeight = caseDef.dropTable.reduce((total, drop) => total + Math.max(0, drop.weight), 0)
  let targetWeight = Math.min(Math.max(prng(), 0), 0.999999999999) * totalWeight

  for (const drop of caseDef.dropTable) {
    targetWeight -= Math.max(0, drop.weight)

    if (targetWeight < 0) {
      return drop.skinId
    }
  }

  return caseDef.dropTable[caseDef.dropTable.length - 1]?.skinId
}
`,
  )
}

function writeGeneratedRarities(filePath: string, rarities: Map<string, ApiRarity>) {
  const body = Array.from(rarities.values())
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((rarity) => {
      return `  ${asTsString(rarity.id)}: { id: ${asTsString(rarity.id)}, name: ${asTsString(rarity.name)}, color: ${asTsString(rarity.color)} },`
    })
    .join('\n')

  fs.writeFileSync(
    filePath,
    `import type { ImportedRarityDefinition } from '../importedAssetTypes'

export const RARITY_DEFINITIONS = {
${body}
} satisfies Record<string, ImportedRarityDefinition>

export const RARITIES = RARITY_DEFINITIONS
`,
  )
}

function writeReport(filePath: string, report: ImportReport, skins: GeneratedSkin[], cases: GeneratedCase[]) {
  const rarityBreakdown = skins.reduce<Record<string, number>>((counts, skin) => {
    counts[skin.rarity] = (counts[skin.rarity] ?? 0) + 1
    return counts
  }, {})
  const lines = [
    'CS2 asset import report',
    '',
    `Skins imported: ${skins.length}`,
    `Cases imported: ${cases.length}`,
    '',
    'Rarity breakdown:',
    ...Object.entries(rarityBreakdown).map(([rarity, count]) => `- ${rarity}: ${count}`),
    '',
    'Images:',
    `- Downloaded: ${report.downloadedImages.length}`,
    `- Reused: ${report.reusedImages.length}`,
    `- Fallback dataset: ${report.fallbackImages.length}`,
    `- Placeholder: ${report.placeholderImages.length}`,
    '',
    `Missing skin references: ${report.missingSkinRefs.length}`,
    ...report.missingSkinRefs.map((entry) => `- ${entry}`),
    '',
    `Image errors: ${report.imageErrors.length}`,
    ...report.imageErrors.map((entry) => `- ${entry}`),
  ]

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`)
}

async function main() {
  if (!fs.existsSync(configPath)) {
    throw new Error('Missing asset-import.config.json in the project root.')
  }

  const config = readImportConfig(configPath)
  const sourceFolder = path.resolve(rootDir, config.sourceFolder)
  const fallbackImageFolder = config.fallbackImageFolder
    ? path.resolve(rootDir, config.fallbackImageFolder)
    : undefined
  const outputFolder = path.resolve(rootDir, config.outputFolder)
  const generatedDataFolder = path.resolve(rootDir, config.generatedDataFolder)
  const skinImageFolder = path.join(outputFolder, 'skins')
  const caseImageFolder = path.join(outputFolder, 'cases')
  const report: ImportReport = {
    downloadedImages: [],
    reusedImages: [],
    fallbackImages: [],
    placeholderImages: [],
    missingSkinRefs: [],
    imageErrors: [],
  }

  ensureDirectory(skinImageFolder)
  ensureDirectory(caseImageFolder)
  ensureDirectory(generatedDataFolder)

  const skins = keepValidApiRecords<ApiSkin>(
    readJsonArray<unknown>(path.join(sourceFolder, 'skins.json'), 'skins dataset'),
    'skins dataset',
  )
  const ungroupedSkins = keepValidApiRecords<ApiUngroupedSkin>(
    readJsonArray<unknown>(
      path.join(sourceFolder, 'skins_not_grouped.json'),
      'ungrouped skins dataset',
    ),
    'ungrouped skins dataset',
  )
  const crates = keepValidApiRecords<ApiCrate>(
    readJsonArray<unknown>(path.join(sourceFolder, 'crates.json'), 'crates dataset'),
    'crates dataset',
  )
  const ungroupedWearBySkinId = ungroupedSkins.reduce<Map<string, Set<string>>>((wearsBySkinId, skin) => {
    if (!skin.skin_id || !skin.wear?.name) {
      return wearsBySkinId
    }

    const wearNames = wearsBySkinId.get(skin.skin_id) ?? new Set<string>()
    wearNames.add(skin.wear.name)
    wearsBySkinId.set(skin.skin_id, wearNames)
    return wearsBySkinId
  }, new Map())
  const generatedSkins = skins.map((skin) => createGeneratedSkin(skin, ungroupedWearBySkinId.get(skin.id)))
  const skinById = new Map(generatedSkins.map((skin) => [skin.id, skin]))
  const generatedCases = crates
    .filter((crate) => crate.type === 'Case')
    .map((crate) => createGeneratedCase(crate, skinById, report))
    .filter((caseDef): caseDef is GeneratedCase => Boolean(caseDef))
  const rarities = new Map<string, ApiRarity>()

  for (const skin of skins) {
    if (skin.rarity) {
      rarities.set(skin.rarity.id, skin.rarity)
    }
  }

  for (const crate of crates) {
    for (const drop of [...(crate.contains ?? []), ...(crate.contains_rare ?? [])]) {
      if (drop.rarity) {
        rarities.set(drop.rarity.id, drop.rarity)
      }
    }
  }

  if (dryRun) {
    console.log(`Validated ${generatedSkins.length} skins and ${generatedCases.length} cases.`)
    console.log(`Missing refs: ${report.missingSkinRefs.length}. No files were generated in dry-run mode.`)
    return
  }

  const fallbackIndex = loadFallbackImageIndex(fallbackImageFolder)

  await runLimited(generatedSkins, 8, async (skin) => {
    await copyOrDownloadImage({
      destination: path.join(skinImageFolder, skin.imageFileName),
      displayName: skin.displayName,
      fallbackIndex,
      report,
      url: skin.imageUrl,
    })
  })

  await runLimited(generatedCases, 8, async (caseDef) => {
    await copyOrDownloadImage({
      destination: path.join(caseImageFolder, caseDef.imageFileName),
      displayName: caseDef.displayName,
      fallbackIndex: new Map(),
      report,
      url: caseDef.imageUrl,
    })
  })

  writeGeneratedSkins(path.join(generatedDataFolder, 'skins.generated.ts'), generatedSkins)
  writeGeneratedCases(path.join(generatedDataFolder, 'cases.generated.ts'), generatedCases)
  writeGeneratedRarities(path.join(generatedDataFolder, 'rarities.generated.ts'), rarities)
  writeReport(path.join(generatedDataFolder, 'import-report.txt'), report, generatedSkins, generatedCases)

  console.log(`Imported ${generatedSkins.length} skins and ${generatedCases.length} cases.`)
  console.log(`Images: ${report.downloadedImages.length} downloaded, ${report.reusedImages.length} reused, ${report.fallbackImages.length} fallback, ${report.placeholderImages.length} placeholder.`)
  console.log(`Missing refs: ${report.missingSkinRefs.length}. Report written to ${path.relative(rootDir, path.join(generatedDataFolder, 'import-report.txt'))}.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
