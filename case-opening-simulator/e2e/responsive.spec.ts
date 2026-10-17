import { expect, test } from '@playwright/test'

for (const viewport of [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'mobile-390', width: 390, height: 844 },
]) {
  test(`${viewport.name} keeps Work and opening controls inside the viewport`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/work')
    const skip = page.getByRole('button', { name: 'Skip tutorial' })
    if (await skip.isVisible().catch(() => false)) await skip.click()
    await expect(page.getByRole('heading', { name: 'Precision Strike' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)

    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Open 10' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    if (viewport.name === 'mobile-390') {
      await expect(page.locator('main')).toHaveScreenshot('main-mobile-390.png', { animations: 'disabled' })
    }
  })
}
