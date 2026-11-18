import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
const label = process.argv[2] ?? 'current'
const outputDirectory = path.resolve('docs', 'visual-evidence', label)
const viewports = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'laptop-1280', width: 1280, height: 720 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-375', width: 375, height: 812 },
]

await mkdir(outputDirectory, { recursive: true })
const browser = await chromium.launch()
const measurements = []

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(`${baseUrl}/trade-ups`, { waitUntil: 'networkidle' })
  const skip = page.getByRole('button', { name: 'Skip beginner tutorial' })
  if (await skip.isVisible().catch(() => false)) await skip.click()
  await page.getByTestId('trade-up-workbench').waitFor()
  const metrics = await page.evaluate(() => {
    const workbench = document.querySelector('[data-testid="trade-up-workbench"]')
    const nav = document.querySelector('nav')
    return {
      documentHeight: document.documentElement.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      navHeight: nav?.getBoundingClientRect().height ?? 0,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      workbenchHeight: workbench?.getBoundingClientRect().height ?? 0,
    }
  })
  measurements.push({ name: viewport.name, ...metrics })
  await page.screenshot({
    animations: 'disabled',
    fullPage: true,
    path: path.join(outputDirectory, `trade-ups-${viewport.name}.png`),
  })
  await context.close()
}

await browser.close()
await writeFile(path.join(outputDirectory, 'measurements.json'), `${JSON.stringify(measurements, null, 2)}\n`)
console.log(`Captured ${measurements.length} layouts in ${outputDirectory}`)
