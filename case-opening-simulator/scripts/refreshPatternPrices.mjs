import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const args = Object.fromEntries(process.argv.slice(2).flatMap((value, index, values) => (
  value.startsWith('--') ? [[value.slice(2), values[index + 1]]] : []
)))
const required = ['item', 'skin-id', 'wear']
const missing = required.filter((key) => !args[key])

if (missing.length > 0) {
  console.error(`Missing ${missing.map((key) => `--${key}`).join(', ')}. Example: npm run update:pattern-prices -- --item "AK-47 | Case Hardened (Field-Tested)" --skin-id skin-id --wear FieldTested`)
  process.exitCode = 1
} else {
  const family = args.family === 'fade' ? 'fade' : 'patterns'
  const endpoint = `https://api.openskin.dev/v1/prices/csfloat/${family}?item=${encodeURIComponent(args.item)}`
  const response = await fetch(endpoint, { headers: { Accept: 'application/json', 'User-Agent': 'case-opening-simulator-pattern-cache/1.0' } })
  if (!response.ok) throw new Error(`OpenSkin returned ${response.status} ${response.statusText}`)
  const payload = await response.json()
  const cachePath = path.resolve('src/data/generated/pattern-price-cache.json')
  const cache = JSON.parse(await fs.readFile(cachePath, 'utf8'))
  const edition = args.edition ?? 'normal'
  const incoming = (payload.patterns ?? []).flatMap((entry) => (
    Number.isInteger(entry.paint_seed) && Number.isFinite(entry.ask) && entry.ask >= 0
      ? [{
          confidence: 'market-listing',
          edition,
          observedAt: entry.updated_at ?? new Date().toISOString(),
          price: Number(entry.ask.toFixed(2)),
          sampleSize: Number.isInteger(entry.sell_order_count) ? entry.sell_order_count : undefined,
          seed: entry.paint_seed,
          skinId: args['skin-id'],
          source: 'OpenSkin / CSFloat asking price',
          wear: args.wear,
        }]
      : []
  ))
  const keys = new Set(incoming.map((entry) => `${entry.skinId}|${entry.wear}|${entry.edition}|${entry.seed}`))
  cache.observations = [...cache.observations.filter((entry) => !keys.has(`${entry.skinId}|${entry.wear}|${entry.edition}|${entry.seed}`)), ...incoming]
  cache.generatedAt = new Date().toISOString()
  await fs.writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8')
  console.log(`Cached ${incoming.length} OpenSkin listing observation(s) for ${args.item}. Asking prices remain explicitly labeled as listings, not sales.`)
}
