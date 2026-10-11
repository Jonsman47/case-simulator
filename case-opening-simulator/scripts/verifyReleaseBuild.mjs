import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const distDir = join(scriptDir, '..', 'dist')
const assetsDir = join(distDir, 'assets')
const cs2AssetManifestPath = join(scriptDir, '..', 'src', 'data', 'generated', 'cs2-assets.manifest.json')
const requiredFiles = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'favicon.svg',
  'icons.svg',
  'assets/placeholder.png',
  'sounds/case-opening.mp3',
]

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function readDistFile(relativePath) {
  return readFileSync(join(distDir, relativePath), 'utf8')
}

assert(existsSync(distDir), 'dist folder is missing. Run npm run build first.')
assert(existsSync(cs2AssetManifestPath), 'CS2 asset manifest is missing.')

for (const file of requiredFiles) {
  assert(existsSync(join(distDir, file)), `Release build is missing ${file}.`)
}

const manifest = JSON.parse(readDistFile('manifest.webmanifest'))
const cs2AssetManifest = JSON.parse(readFileSync(cs2AssetManifestPath, 'utf8'))

assert(manifest.name === 'Case Opening Simulator', 'PWA manifest has the wrong app name.')
assert(manifest.short_name === 'Case Sim', 'PWA manifest has the wrong short name.')
assert(manifest.display === 'standalone', 'PWA manifest must be installable as standalone.')
assert(
  manifest.icons?.some((icon) => icon.src === 'favicon.svg') &&
    manifest.icons?.some((icon) => icon.src === 'icons.svg' && icon.purpose?.includes('maskable')),
  'PWA manifest is missing expected icons.',
)

const assetFiles = readdirSync(assetsDir)
const hasHashedJs = assetFiles.some((file) => /^index-[a-zA-Z0-9_-]+\.js$/.test(file))
const hasHashedCss = assetFiles.some((file) => /^index-[a-zA-Z0-9_-]+\.css$/.test(file))

assert(hasHashedJs, 'Release build is missing a hashed index JavaScript asset.')
assert(hasHashedCss, 'Release build is missing a hashed index CSS asset.')
assert(!assetFiles.includes('index.js'), 'Release build contains an unhashed index.js asset.')
assert(!assetFiles.includes('index.css'), 'Release build contains an unhashed index.css asset.')

const serviceWorker = readDistFile('sw.js')

for (const cachedAsset of ['favicon.svg', 'icons.svg', 'assets/placeholder.png', 'sounds/case-opening.mp3']) {
  assert(serviceWorker.includes(cachedAsset), `Service worker does not pre-cache ${cachedAsset}.`)
}

assert(serviceWorker.includes('case-opening-cs2-images-v1'), 'Service worker is missing the CS2 image runtime cache.')
assert(serviceWorker.includes('case-opening-sounds-v1'), 'Service worker is missing the sound runtime cache.')
assert(statSync(join(distDir, 'sounds/case-opening.mp3')).size > 0, 'Case opening sound is empty.')

assert(
  cs2AssetManifest.version === 1 && Array.isArray(cs2AssetManifest.assets),
  'CS2 asset manifest is invalid.',
)

for (const asset of cs2AssetManifest.assets) {
  const releaseAssetPath = join(distDir, ...asset.path.split('/'))

  assert(existsSync(releaseAssetPath), `Release build is missing ${asset.path}.`)
  assert(statSync(releaseAssetPath).size === asset.bytes, `Release asset has the wrong size: ${asset.path}.`)
}

console.log(`Release build verification passed, including ${cs2AssetManifest.assets.length} CS2 images.`)
