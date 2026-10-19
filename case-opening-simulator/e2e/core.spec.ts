import { expect, test, type Page } from '@playwright/test'

const saveKey = 'case-opening-simulator:game-state'

async function dismissTutorial(page: Page) {
  const skip = page.getByRole('button', { name: 'Skip tutorial' })
  if (await skip.isVisible().catch(() => false)) await skip.click()
}

async function readSave(page: Page) {
  await page.waitForFunction((key) => Boolean(localStorage.getItem(key)), saveKey)
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), saveKey)
}

async function closeSummary(page: Page) {
  const summary = page.getByRole('dialog', { name: 'Case opening batch summary' })
  if (await summary.isVisible().catch(() => false)) await page.getByRole('button', { name: 'Close opening summary' }).click()
}

async function openBatch(page: Page, quantity: number) {
  await page.getByRole('button', { name: new RegExp(`^open ${quantity}$`, 'i') }).click()
  const opening = page.getByRole('dialog', { name: 'Case opening animation' })
  await expect(opening).toBeVisible()
  if (quantity > 1) {
    await expect(opening.getByText('Case 01')).toBeVisible()
    await expect(opening.getByText(`Case ${String(quantity).padStart(2, '0')}`)).toBeVisible()
  }
  const skip = page.getByRole('button', { name: 'Skip opening animation' })
  await skip.click()
  if (quantity > 1) {
    await expect(opening.getByText('Stopped').first()).toBeVisible({ timeout: 5_000 })
  }
  await expect.poll(async () => {
    if ((await opening.count()) === 0) return 'closed'
    return (await skip.textContent()) ?? ''
  }, { timeout: 5_000 }).toMatch(/closed|Close/)
  if ((await opening.count()) > 0) {
    await skip.click({ timeout: 1_000 }).catch(() => undefined)
  }
  await expect(opening).toBeHidden({ timeout: 5_000 })
  await closeSummary(page)
}

test('new player can complete every supported opening size with exact-once transactions', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/')
  await dismissTutorial(page)
  await expect(page.getByRole('button', { name: 'Open 10' })).toBeVisible()
  if (!process.env.CI) {
    await expect(page).toHaveScreenshot('case-buttons-1366.png', { animations: 'disabled', fullPage: true })
  }

  const before = await readSave(page)
  const costPanel = await page.getByText('Cost', { exact: true }).locator('..').textContent()
  const caseCost = Number(costPanel?.match(/\$([\d.]+)/)?.[1])
  for (const quantity of [1, 2, 3, 5, 10]) await openBatch(page, quantity)
  await page.waitForFunction(({ key, expected }) => {
    const value = JSON.parse(localStorage.getItem(key) ?? '{}')
    return value.state?.statistics?.casesOpened >= expected
  }, { key: saveKey, expected: before.state.statistics.casesOpened + 21 })
  const after = await readSave(page)

  expect(after.state.inventory.length - before.state.inventory.length).toBe(21)
  expect(after.state.statistics.casesOpened - before.state.statistics.casesOpened).toBe(21)
  expect(before.state.money - after.state.money).toBeCloseTo(caseCost * 21, 2)
  expect(consoleErrors).toEqual([])
})

test('work jobs are usable and skill jobs claim only once', async ({ page }) => {
  await page.goto('/work')
  await dismissTutorial(page)
  await expect(page.getByText('Four available jobs')).toBeVisible()
  if (!process.env.CI) {
    await expect(page).toHaveScreenshot('work-page-1366.png', { animations: 'disabled', fullPage: true })
  }

  await page.getByRole('button', { name: 'Start Sort Boxes' }).click()
  for (const color of ['Red', 'Blue', 'Green', 'Yellow']) {
    await page.getByRole('button', { name: `${color} box` }).click()
    await page.getByRole('button', { name: `${color} container` }).click()
  }
  await expect(page.getByText('Earned $20.00')).toBeVisible()

  await page.getByRole('button', { name: 'Start Precision Strike' }).click()
  for (let attempt = 0; attempt < 5; attempt += 1) await page.getByRole('button', { name: 'Stop precision marker' }).click()
  const precisionToast = page.getByRole('status').filter({ hasText: 'Precision Strike' })
  await expect(precisionToast.getByText(/Earned \$\d+\.\d{2}/)).toBeVisible()
  await page.waitForFunction((key) => {
    const value = JSON.parse(localStorage.getItem(key) ?? '{}')
    return value.state?.statistics?.workJobsCompleted === 2
  }, saveKey)
  const save = await readSave(page)
  expect(save.state.statistics.workJobsCompleted).toBe(2)
  expect(save.state.money).toBeGreaterThanOrEqual(129.1)
  expect(save.state.money).toBeLessThanOrEqual(138.9)
})

test('inventory images load, selling is exact once, and the result survives reload', async ({ page }) => {
  await page.goto('/')
  await dismissTutorial(page)
  await openBatch(page, 1)
  await page.goto('/inventory')

  const itemCard = page.locator('article[tabindex="0"]').first()
  await expect(itemCard).toBeVisible()
  const itemImage = itemCard.locator('img').first()
  await expect(itemImage).toBeVisible()
  expect(await itemImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)

  const beforeSale = await readSave(page)
  await itemCard.click()
  await expect(page.getByRole('dialog').first()).toBeVisible()
  await page.getByRole('button', { name: 'Sell', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm Sale' }).click()
  await page.waitForFunction((key) => {
    const value = JSON.parse(localStorage.getItem(key) ?? '{}')
    return value.state?.inventory?.length === 0 && value.state?.statistics?.itemsSold === 1
  }, saveKey)

  const afterSale = await readSave(page)
  expect(afterSale.state.money).toBeGreaterThan(beforeSale.state.money)
  expect(afterSale.state.statistics.itemsSold).toBe(1)

  await page.reload()
  await expect(page.getByText('No inventory items found')).toBeVisible()
  const afterReload = await readSave(page)
  expect(afterReload.state.money).toBe(afterSale.state.money)
  expect(afterReload.state.statistics.itemsSold).toBe(1)
})

test('market, events, automation, inventory, and leaderboards navigate without console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const route of ['/market', '/events', '/automation', '/inventory', '/leaderboards', '/settings']) {
    await page.goto(route)
    await dismissTutorial(page)
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('Something went wrong')
  }
  expect(errors).toEqual([])
})
