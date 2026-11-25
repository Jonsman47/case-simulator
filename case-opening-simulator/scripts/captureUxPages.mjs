import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'

const baseUrl = process.argv.find((arg) => arg.startsWith('--base-url='))?.split('=')[1] ?? 'http://127.0.0.1:5175'
const tag = process.argv.find((arg) => arg.startsWith('--tag='))?.split('=')[1] ?? 'after'
const outputDir = 'docs/ux-screenshots'
await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 })
const measurements = {}

for (const [path, name] of [['/', 'home'], ['/help', 'help'], ['/career', 'career']]) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Skip beginner tutorial' }).click().catch(() => undefined)
  await page.screenshot({ path: `${outputDir}/${tag}-${name}.png`, fullPage: true })
  measurements[name] = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    mainTop: Math.round(document.querySelector('main')?.getBoundingClientRect().top ?? 0),
    visibleActions: [...document.querySelectorAll('main a, main button')].filter((node) => { const rect = node.getBoundingClientRect(); return rect.height > 0 && rect.top >= 0 && rect.bottom <= window.innerHeight }).length,
  }))
}

await writeFile(`${outputDir}/${tag}-measurements.json`, JSON.stringify(measurements, null, 2))
await browser.close()
