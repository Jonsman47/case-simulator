import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
const label = process.argv[2] ?? 'current'
const outputDirectory = path.resolve('docs', 'visual-evidence', 'whole-game', label)
const viewports = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'laptop-1280', width: 1280, height: 720 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-375', width: 375, height: 812 },
]
const routes = [
  { name: 'cases', path: '/cases' },
  { name: 'trade-ups', path: '/trade-ups' },
  { name: 'work', path: '/work' },
]

await mkdir(outputDirectory, { recursive: true })
const browser = await chromium.launch()
const measurements = []

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  for (const route of routes) {
    await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle' })
    const skip = page.getByRole('button', { name: 'Skip beginner tutorial' })
    if (await skip.isVisible().catch(() => false)) await skip.click()
    const dismissGuide = page.locator('button[aria-label^="Dismiss "]')
    if (await dismissGuide.isVisible().catch(() => false)) await dismissGuide.click()
    await page.locator('main.app-content').waitFor()
    const metrics = await page.evaluate(() => {
      const viewportBottom = window.innerHeight
      const visibleCards = [...document.querySelectorAll('article, [data-case-selected], [data-testid="trade-up-inventory-item"]')]
        .filter((element) => {
          const bounds = element.getBoundingClientRect()
          return bounds.top < viewportBottom && bounds.bottom > 0
        }).length
      const actionButtons = [...document.querySelectorAll('button')]
        .filter((button) => /open|execute|play|claim|hire|purchase|review/i.test(button.textContent ?? ''))
      const visibleActionButtons = actionButtons.filter((button) => {
        const bounds = button.getBoundingClientRect()
        return bounds.top >= 0 && bounds.bottom <= viewportBottom
      }).length
      const shellHeader = document.querySelector('body header')
      const navigation = document.querySelector('body nav')
      return {
        documentHeight: document.documentElement.scrollHeight,
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        headerHeight: shellHeader?.getBoundingClientRect().height ?? 0,
        navigationHeight: navigation?.getBoundingClientRect().height ?? 0,
        pageScrollLengths: Number((document.documentElement.scrollHeight / window.innerHeight).toFixed(2)),
        visibleActionButtons,
        visibleCards,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      }
    })
    measurements.push({ route: route.name, viewport: viewport.name, ...metrics })
    await page.screenshot({
      animations: 'disabled',
      fullPage: true,
      path: path.join(outputDirectory, `${route.name}-${viewport.name}.png`),
    })
  }
  await context.close()
}

await browser.close()
await writeFile(path.join(outputDirectory, 'measurements.json'), `${JSON.stringify(measurements, null, 2)}\n`)
console.log(`Captured ${measurements.length} page/viewport layouts in ${outputDirectory}`)
