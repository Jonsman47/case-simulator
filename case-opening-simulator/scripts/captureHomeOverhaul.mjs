import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173'
const output = path.resolve('docs', 'visual-evidence', 'home-overhaul', 'after')
const viewports = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'laptop-1280', width: 1280, height: 720 },
  { name: 'small-desktop-1024', width: 1024, height: 768 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-320', width: 320, height: 568 },
]
const routes = [
  ['cases', '/cases'], ['inventory', '/inventory'], ['work', '/work'], ['quests', '/quests'],
  ['career', '/career'], ['business', '/business'], ['trade-ups', '/trade-ups'], ['prestige', '/prestige'], ['progress', '/progress'],
]

await mkdir(output, { recursive: true })
const browser = await chromium.launch(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1' ? { channel: 'chrome' } : {})
const rows = []

async function measure(page, viewport, route, variant = 'standard') {
  await page.locator('main.app-content').waitFor()
  await page.waitForLoadState('networkidle')
  await page.getByText('Preparing view...').waitFor({ state: 'hidden' })
  if (route === 'home') await page.getByRole('heading', { name: 'Continue Opening' }).waitFor()
  if (route === 'cases') await page.getByTestId('case-card').first().waitFor()
  if (route === 'work') await page.getByRole('heading', { name: 'Precision Strike' }).waitFor()
  const metrics = await page.evaluate(() => {
    const content = document.querySelector('main.app-content')
    const header = document.querySelector('body header')
    const nav = document.querySelector('body nav')
    const buttons = [...document.querySelectorAll('main button, main a')]
    const visibleButtons = buttons.filter((node) => {
      const box = node.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && box.top >= 0 && box.bottom <= innerHeight
    }).length
    const cards = [...(content?.querySelectorAll('article, section, [data-layout-card="true"]') ?? [])]
      .filter((node) => node.getBoundingClientRect().width > 0)
    const clippedCards = cards.filter((node) => node.scrollWidth > node.clientWidth + 2 || node.scrollHeight > node.clientHeight + 2).length
    return {
      documentHeight: document.documentElement.scrollHeight,
      pageLengths: Number((document.documentElement.scrollHeight / innerHeight).toFixed(2)),
      headerHeight: header?.getBoundingClientRect().height ?? 0,
      navigationHeight: nav?.getBoundingClientRect().height ?? 0,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      visibleActions: visibleButtons,
      clippedCards,
    }
  })
  rows.push({ route, viewport: viewport.name, variant, ...metrics })
}

for (const viewport of viewports.filter((entry) => !process.env.CAPTURE_VIEWPORT || entry.name === process.env.CAPTURE_VIEWPORT)) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(baseUrl)
  const skip = page.getByRole('button', { name: 'Skip beginner tutorial' })
  if (await skip.isVisible().catch(() => false)) await skip.click()
  await page.waitForFunction(() => Boolean(JSON.parse(localStorage.getItem('case-opening-simulator:game-state') ?? '{}').state?.ui?.onboarding?.isDismissed))
  await measure(page, viewport, 'home')
  if (viewport.name === 'laptop-1366' || viewport.name === 'mobile-320') {
    await page.screenshot({ path: path.join(output, `home-${viewport.name}.png`), fullPage: true, animations: 'disabled' })
  }

  const fixture = await page.evaluate(() => {
    const envelope = JSON.parse(localStorage.getItem('case-opening-simulator:game-state') ?? '{}')
    const ids = ['collection-book', 'quests', 'market', 'cswear', 'trade-ups', 'business', 'prestige']
    envelope.state.ui.featureUnlocks = { ...envelope.state.ui.featureUnlocks, unlockedIds: ids, acknowledgedIds: ids, presentedIds: ids, introducedIds: ids }
    return JSON.stringify(envelope)
  })
  await page.addInitScript((value) => localStorage.setItem('case-opening-simulator:game-state', value), fixture)
  for (const [name, route] of routes) {
    await page.goto(`${baseUrl}${route}`)
    await measure(page, viewport, name)
  }
  if (viewport.name === 'laptop-1366' || viewport.name === 'mobile-375') {
    for (const variant of ['large-text', 'light', 'reduced-motion']) {
      const alternate = JSON.parse(fixture)
      if (variant === 'large-text') alternate.state.settings.largeText = true
      if (variant === 'light') alternate.state.settings.theme = 'light'
      if (variant === 'reduced-motion') alternate.state.settings.simplifiedAnimations = true
      const variantContext = await browser.newContext({ viewport, reducedMotion: variant === 'reduced-motion' ? 'reduce' : 'no-preference' })
      const variantPage = await variantContext.newPage()
      await variantPage.addInitScript((value) => localStorage.setItem('case-opening-simulator:game-state', value), JSON.stringify(alternate))
      await variantPage.goto(baseUrl)
      await measure(variantPage, viewport, 'home', variant)
      if (viewport.name === 'laptop-1366' && variant !== 'reduced-motion') {
        await variantPage.screenshot({ path: path.join(output, `home-${viewport.name}-${variant}.png`), fullPage: true, animations: 'disabled' })
      }
      await variantContext.close()
    }
  }
  await context.close()
  await writeFile(path.join(output, `measurements-${viewport.name}.json`), `${JSON.stringify(rows.filter((row) => row.viewport === viewport.name), null, 2)}\n`)
  console.log(`Captured ${viewport.name}`)
}

await browser.close()
await writeFile(path.join(output, 'measurements.json'), `${JSON.stringify(rows, null, 2)}\n`)
console.log(`Captured ${rows.length} layouts in ${output}`)
