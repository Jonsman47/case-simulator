import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
const label = process.argv[2] ?? 'after'
const outputRoot = path.resolve('test-results', 'card-layout-audit', label)
const saveKey = 'case-opening-simulator:game-state'

const viewports = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'laptop-1280', width: 1280, height: 720 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-375', width: 375, height: 812 },
]

const routes = [
  ['cases', '/cases'],
  ['inventory', '/inventory'],
  ['trade-ups', '/trade-ups'],
  ['cswear', '/cswear'],
  ['work', '/work'],
  ['business', '/business'],
  ['career', '/career'],
  ['quests', '/quests'],
  ['prestige', '/prestige'],
  ['achievements', '/achievements'],
  ['stats', '/stats'],
]

function createInventoryFixture() {
  const createdAt = Date.now()
  return Array.from({ length: 24 }, (_, index) => ({
    id: 'skin-06a633fd8293',
    weapon: index % 3 === 0 ? 'AUG With An Intentionally Long Weapon Label' : 'AUG',
    finish: index % 4 === 0 ? 'Surveillance With A Long Finish Name' : 'Surveillance',
    rarity: index % 5 === 0 ? 'Covert' : 'Consumer',
    baseValue: 123_456.78,
    baseMarketValue: 123_456.78,
    caseIds: [],
    collections: ['The Control Collection'],
    image: '/assets/cs2/skins/skin-06a633fd8293_aug_surveillance.png',
    instanceId: `layout-audit-item-${index}`,
    wear: index % 2 === 0 ? 'FactoryNew' : 'BattleScarred',
    floatValue: Math.min(0.99, 0.001 + index / 100),
    marketValue: 123_456.78 + index,
    isLocked: false,
    isFavorited: false,
    discoveredAt: createdAt + index,
    paintSeed: index === 0 ? 661 : index,
    statTrak: index % 3 === 0,
    pattern: {
      family: 'standard',
      name: index === 0 ? 'Blue Gem — Tier 1' : 'Standard pattern',
      premiumMultiplier: index === 0 ? 10 : 1,
      referenceConfidence: 'neutral',
      tier: index === 0 ? 'iconic' : 'standard',
    },
    patternPremium: index === 0 ? 100_000 : 0,
  }))
}

async function bootstrapEnvelope(browser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction((key) => Boolean(localStorage.getItem(key)), saveKey)
  const envelope = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey)
  await context.close()

  envelope.state.inventory = createInventoryFixture()
  envelope.state.inventoryValue = envelope.state.inventory.reduce((total, item) => total + item.marketValue, 0)
  envelope.state.marketValues['skin-06a633fd8293'] = 123_456.78
  envelope.state.ui.onboarding = {
    ...envelope.state.ui.onboarding,
    dismissedTipIds: [
      'cswear',
      'trade_up',
      'career',
      'business',
      'business_setup',
      'market_scout',
      'quests',
      'prestige',
      'drop_journal',
    ],
    isActive: false,
    isComplete: true,
    isDismissed: true,
  }
  envelope.state.uiEvents = []
  return envelope
}

async function inspectGeometry(page) {
  return page.evaluate(() => {
    const tolerance = 1.5
    const visible = (element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 1 && rect.height > 1
    }
    const cards = [...document.querySelectorAll('article, [data-layout-card="true"], .case-catalog > button')].filter(visible)
    const clipped = cards.filter((card) => {
      const style = getComputedStyle(card)
      const clipsY = card.scrollHeight > card.clientHeight + tolerance && !['auto', 'scroll'].includes(style.overflowY)
      const clipsX = card.scrollWidth > card.clientWidth + tolerance && !['auto', 'scroll'].includes(style.overflowX)
      return clipsX || clipsY
    }).map((card) => ({
      height: Math.round(card.getBoundingClientRect().height),
      scrollHeight: card.scrollHeight,
      testId: card.getAttribute('data-testid'),
      text: card.textContent?.trim().slice(0, 80),
    }))

    const overlaps = []
    const outsideGrid = []
    for (const grid of document.querySelectorAll('.grid')) {
      if (getComputedStyle(grid).display !== 'grid') continue
      const parentRect = grid.getBoundingClientRect()
      const children = [...grid.children].filter((child) => {
        if (!visible(child)) return false
        const style = getComputedStyle(child)
        if (style.position === 'absolute' || style.position === 'fixed') return false
        return child.matches('article, button, section, [data-layout-card="true"], .trade-up-slot')
      })
      for (const child of children) {
        const rect = child.getBoundingClientRect()
        if (rect.right > parentRect.right + tolerance || rect.left < parentRect.left - tolerance) {
          outsideGrid.push(child.textContent?.trim().slice(0, 80))
        }
      }
      for (let left = 0; left < children.length; left += 1) {
        const first = children[left].getBoundingClientRect()
        for (let right = left + 1; right < children.length; right += 1) {
          const second = children[right].getBoundingClientRect()
          const overlapX = Math.min(first.right, second.right) - Math.max(first.left, second.left)
          const overlapY = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top)
          if (overlapX > tolerance && overlapY > tolerance) {
            overlaps.push([children[left].textContent?.trim().slice(0, 40), children[right].textContent?.trim().slice(0, 40)])
          }
        }
      }
    }

    return {
      cardCount: cards.length,
      clipped,
      documentWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + tolerance,
      outsideGrid,
      overlaps,
      viewportWidth: window.innerWidth,
    }
  })
}

async function captureMode(browser, envelope, viewport, largeText) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
  const seededEnvelope = structuredClone(envelope)
  seededEnvelope.state.settings.largeText = largeText
  await context.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value))
    localStorage.setItem('cs2-feature-guide-dismissed', '1')
  }, { key: saveKey, value: seededEnvelope })
  const page = await context.newPage()
  const mode = largeText ? 'large-text' : 'standard'
  const results = []

  for (const [name, route] of routes) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' })
    const skip = page.getByRole('button', { name: 'Skip beginner tutorial' })
    if (await skip.isVisible().catch(() => false)) await skip.click()
    await page.locator('main').waitFor({ state: 'visible' })
    await page.waitForTimeout(250)
    const dismissPwa = page.getByRole('button', { name: 'Dismiss PWA notification' })
    if (await dismissPwa.isVisible().catch(() => false)) await dismissPwa.click()
    const dismissToasts = page.getByRole('button', { name: 'Dismiss sale notification' })
    if (await dismissToasts.first().isVisible().catch(() => false)) await dismissToasts.first().click()
    const fileName = `${name}-${viewport.name}-${mode}.png`
    await page.screenshot({ animations: 'disabled', path: path.join(outputRoot, fileName) })
    results.push({ name, route, screenshot: fileName, ...(await inspectGeometry(page)) })
  }

  await context.close()
  return { largeText, viewport, results }
}

await mkdir(outputRoot, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const envelope = await bootstrapEnvelope(browser)
  const report = []
  for (const viewport of viewports) {
    report.push(await captureMode(browser, envelope, viewport, false))
    report.push(await captureMode(browser, envelope, viewport, true))
  }
  await writeFile(path.join(outputRoot, 'geometry.json'), `${JSON.stringify(report, null, 2)}\n`)
  const totals = report.flatMap((entry) => entry.results).reduce((summary, result) => ({
    clipped: summary.clipped + result.clipped.length,
    horizontalOverflow: summary.horizontalOverflow + Number(result.horizontalOverflow),
    outsideGrid: summary.outsideGrid + result.outsideGrid.length,
    overlaps: summary.overlaps + result.overlaps.length,
    screenshots: summary.screenshots + 1,
  }), { clipped: 0, horizontalOverflow: 0, outsideGrid: 0, overlaps: 0, screenshots: 0 })
  console.log(JSON.stringify({ label, outputRoot, totals }, null, 2))
} finally {
  await browser.close()
}
