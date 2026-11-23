import { expect, test, type Locator, type Page } from '@playwright/test'

const saveKey = 'case-opening-simulator:game-state'
const viewports = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'laptop-1280', width: 1280, height: 720 },
  { name: 'small-desktop-1024', width: 1024, height: 768 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-320', width: 320, height: 568 },
]

async function dismissTutorial(page: Page) {
  const skip = page.getByRole('button', { name: 'Skip beginner tutorial' })
  if (await skip.isVisible().catch(() => false)) await skip.click()
}

async function installLayoutFixture(page: Page, largeText: boolean) {
  await page.goto('/')
  await dismissTutorial(page)
  await page.waitForFunction((key) => Boolean(localStorage.getItem(key)), saveKey)
  const envelope = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), saveKey)
  const createdAt = Date.now()
  envelope.state.inventory = Array.from({ length: 18 }, (_, index: number) => ({
    id: 'skin-06a633fd8293',
    weapon: index % 3 === 0 ? 'AUG With An Intentionally Long Weapon Label' : 'AUG',
    finish: index % 4 === 0 ? 'Surveillance With A Long Finish Name' : 'Surveillance',
    rarity: index % 5 === 0 ? 'Covert' : 'Consumer',
    baseValue: 123_456.78,
    baseMarketValue: 123_456.78,
    caseIds: [],
    collections: ['The Control Collection'],
    image: '/assets/cs2/skins/skin-06a633fd8293_aug_surveillance.png',
    instanceId: `layout-regression-${index}`,
    wear: index % 2 === 0 ? 'FactoryNew' : 'BattleScarred',
    floatValue: Math.min(.99, .001 + index / 100),
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
  envelope.state.inventoryValue = envelope.state.inventory.reduce(
    (total: number, item: { marketValue: number }) => total + item.marketValue,
    0,
  )
  envelope.state.marketValues['skin-06a633fd8293'] = 123_456.78
  envelope.state.settings.largeText = largeText
  envelope.state.ui.onboarding = {
    ...envelope.state.ui.onboarding,
    isActive: false,
    isComplete: true,
    isDismissed: true,
  }
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: saveKey,
    value: envelope,
  })
}

async function expectCardsToFit(cards: Locator) {
  await expect(cards.first()).toBeVisible()
  const geometry = await cards.evaluateAll((elements) => {
    const tolerance = 1.5
    const boxes = elements.map((element) => element.getBoundingClientRect())
    const clipped = elements.map((element, index) => ({
      index,
      height: element.clientHeight,
      scrollHeight: element.scrollHeight,
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
    })).filter((entry) => entry.scrollHeight > entry.height + tolerance || entry.scrollWidth > entry.width + tolerance)
    const overlaps: Array<[number, number]> = []
    for (let left = 0; left < boxes.length; left += 1) {
      for (let right = left + 1; right < boxes.length; right += 1) {
        const overlapX = Math.min(boxes[left].right, boxes[right].right) - Math.max(boxes[left].left, boxes[right].left)
        const overlapY = Math.min(boxes[left].bottom, boxes[right].bottom) - Math.max(boxes[left].top, boxes[right].top)
        if (overlapX > tolerance && overlapY > tolerance) overlaps.push([left, right])
      }
    }
    return { clipped, overlaps }
  })
  expect(geometry.clipped, 'card content must fit its rendered card').toEqual([])
  expect(geometry.overlaps, 'cards must not overlap each other').toEqual([])
}

for (const viewport of viewports) {
  for (const largeText of [false, true]) {
    test(`${viewport.name} ${largeText ? 'Large Text' : 'standard text'} keeps Cases and Inventory cards inside their rows`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await installLayoutFixture(page, largeText)

      await page.goto('/cases')
      await expectCardsToFit(page.getByTestId('case-card'))
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)

      await page.goto('/inventory')
      await expectCardsToFit(page.getByTestId('inventory-item-card'))
      const grid = page.getByRole('grid')
      expect(await grid.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    })
  }
}
