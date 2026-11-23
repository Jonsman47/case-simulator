import { expect, test } from '@playwright/test'

for (const viewport of [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'laptop-1280', width: 1280, height: 720 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-320', width: 320, height: 568 },
  { name: 'mobile-390', width: 390, height: 844 },
]) {
  test(`${viewport.name} keeps Work and opening controls inside the viewport`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/work')
    const skip = page.getByRole('button', { name: 'Skip beginner tutorial' })
    if (await skip.isVisible().catch(() => false)) {
      await skip.click()
      await expect(page.getByTestId('onboarding-tutorial')).toBeHidden()
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('case-opening-simulator:game-state') ?? '{}').state?.ui?.onboarding?.isDismissed === true)
    }
    const fixture = await page.evaluate(() => {
      const key = 'case-opening-simulator:game-state'
      const envelope = JSON.parse(localStorage.getItem(key) ?? '{}')
      const ids = ['collection-book', 'quests', 'market', 'cswear', 'trade-ups', 'business', 'prestige']
      envelope.state.ui.featureUnlocks = { ...envelope.state.ui.featureUnlocks, unlockedIds: ids, acknowledgedIds: ids, presentedIds: ids, introducedIds: ids }
      return JSON.stringify(envelope)
    })
    await page.addInitScript((value) => {
      if (sessionStorage.getItem('responsive-unlocks-seeded')) return
      localStorage.setItem('case-opening-simulator:game-state', value)
      sessionStorage.setItem('responsive-unlocks-seeded', '1')
    }, fixture)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Precision Strike' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    if (viewport.width <= 390) {
      await page.getByRole('button', { name: 'Play Memory Circuit' }).click()
      await page.getByRole('button', { name: 'Start Memory Circuit' }).click()
      const gameBox = await page.getByTestId('memoryCircuit-game').boundingBox()
      expect(gameBox).not.toBeNull()
      expect(gameBox!.y).toBeGreaterThanOrEqual(0)
      expect(gameBox!.y + gameBox!.height).toBeLessThanOrEqual(viewport.height)
      await expect(page.getByRole('button', { name: /Memory pad 1/i })).toBeInViewport()
      await page.getByRole('button', { name: 'Close Memory Circuit' }).click()
    }

    await page.goto('/')
    await page.goto('/cases')
    await expect(page.getByRole('button', { name: 'Open 10' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    await page.goto('/business')
    await expect(page.getByRole('heading', { name: 'Business', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    await page.goto('/trade-ups')
    await expect(page.getByTestId('trade-up-workbench')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    if (viewport.width >= 1280) {
      const pickerBox = await page.getByTestId('trade-up-picker-panel').boundingBox()
      const contractBox = await page.getByTestId('trade-up-contract-panel').boundingBox()
      expect(pickerBox).not.toBeNull()
      expect(contractBox).not.toBeNull()
      expect(pickerBox!.x).toBeLessThan(contractBox!.x)
      expect(pickerBox!.width).toBeLessThan(contractBox!.width)
      await page.getByRole('button', { name: /Review Contract/ }).scrollIntoViewIfNeeded()
      await expect(page.getByRole('button', { name: /Review Contract/ })).toBeInViewport()
    }
    if (viewport.name === 'mobile-390' && !process.env.CI) {
      await page.goto('/work')
      await expect(page.getByRole('heading', { name: 'Precision Strike' })).toBeVisible()
      await expect(page.locator('main')).toHaveScreenshot('main-mobile-390.png', { animations: 'disabled' })
    }
  })
}
