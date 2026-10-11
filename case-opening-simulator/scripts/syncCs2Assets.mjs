import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectDir = join(scriptDir, '..')
const publicDir = join(projectDir, 'public')
const manifestPath = join(projectDir, 'src', 'data', 'generated', 'cs2-assets.manifest.json')
const verifyOnly = process.argv.includes('--verify')
const concurrency = 8

function fail(message) {
  throw new Error(message)
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function isValidAsset(entry) {
  const filePath = join(publicDir, ...entry.path.split('/'))

  return existsSync(filePath) &&
    statSync(filePath).size === entry.bytes &&
    sha256(filePath) === entry.sha256
}

async function downloadAsset(entry) {
  if (!entry.sourceUrl) {
    fail(`No source URL is recorded for ${entry.path}. Re-run npm run import:cs2-assets from the source dataset.`)
  }

  const destination = join(publicDir, ...entry.path.split('/'))
  const temporaryDestination = `${destination}.part`

  mkdirSync(dirname(destination), { recursive: true })
  rmSync(temporaryDestination, { force: true })

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(entry.sourceUrl, { signal: AbortSignal.timeout(30_000) })

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`)
      }

      await pipeline(Readable.fromWeb(response.body), createWriteStream(temporaryDestination))

      if (statSync(temporaryDestination).size !== entry.bytes || sha256(temporaryDestination) !== entry.sha256) {
        throw new Error('downloaded file did not match the recorded checksum')
      }

      rmSync(destination, { force: true })
      renameSync(temporaryDestination, destination)
      return
    } catch (error) {
      rmSync(temporaryDestination, { force: true })

      if (attempt === 3) {
        throw new Error(
          `Failed to download ${entry.path}: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        )
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 500))
    }
  }
}

async function runLimited(entries, worker) {
  let index = 0
  const runners = Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
    while (index < entries.length) {
      const entry = entries[index]
      index += 1
      await worker(entry)
    }
  })

  await Promise.all(runners)
}

if (!existsSync(manifestPath)) {
  fail('CS2 asset manifest is missing. Run npm run import:cs2-assets from a source dataset.')
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

if (manifest.version !== 1 || !Array.isArray(manifest.assets) || manifest.assets.length === 0) {
  fail('CS2 asset manifest is invalid or empty.')
}

const invalidAssets = manifest.assets.filter((entry) => !isValidAsset(entry))

if (verifyOnly && invalidAssets.length > 0) {
  fail(
    `${invalidAssets.length} of ${manifest.assets.length} CS2 assets are missing or corrupt. ` +
    'Run npm run assets:sync before building.\n' +
    invalidAssets.slice(0, 10).map((entry) => `- ${entry.path}`).join('\n'),
  )
}

if (!verifyOnly && invalidAssets.length > 0) {
  console.log(`Downloading ${invalidAssets.length} missing or corrupt CS2 assets...`)
  await runLimited(invalidAssets, downloadAsset)
}

const remainingInvalid = manifest.assets.filter((entry) => !isValidAsset(entry))

if (remainingInvalid.length > 0) {
  fail(`${remainingInvalid.length} CS2 assets are still missing or corrupt.`)
}

const totalBytes = manifest.assets.reduce((total, entry) => total + entry.bytes, 0)
console.log(
  `CS2 asset verification passed: ${manifest.assets.length} files, ` +
  `${(totalBytes / 1024 / 1024).toFixed(1)} MiB.`,
)
