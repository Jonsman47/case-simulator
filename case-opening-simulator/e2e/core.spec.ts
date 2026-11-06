import { expect, test, type Page } from '@playwright/test'

const saveKey = 'case-opening-simulator:game-state'

async function dismissTutorial(page: Page) {
  const skip = page.getByRole('button', { name: 'Skip tutorial' })
  if (await skip.isVisible().catch(() => false)) await skip.click()
}

async function dismissEventPopup(page: Page) {
  const dismiss = page.getByRole('button', { name: 'Dismiss event popup' })
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click()
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
  if (quantity > 1) await expect(opening.getByText('Stopped').first()).toBeVisible({ timeout: 15_000 })
  const completionState = await page.waitForFunction(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label="Case opening animation"]')
    if (!dialog) return 'closed'
    const action = dialog.querySelector<HTMLButtonElement>('button[aria-label="Skip opening animation"]')
    return action?.textContent?.includes('Close') ? 'close' : false
  }, undefined, { timeout: 15_000 }).then((handle) => handle.jsonValue())
  if (completionState === 'close') {
    // A normal single opening may auto-close between the completion check and
    // this optional click. Premium and batch results remain open and are closed
    // here; a detached button therefore means the intended state already won.
    await skip.click({ timeout: 2_000 }).catch(() => undefined)
  }
  await expect(opening).toBeHidden({ timeout: 15_000 })
  await closeSummary(page)
}

test('new player can complete every supported opening size with exact-once transactions', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/')
  await dismissTutorial(page)
  await dismissEventPopup(page)
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
  await dismissEventPopup(page)
  await expect(page.getByText('Four available jobs')).toBeVisible()
  if (!process.env.CI) {
    await expect(page).toHaveScreenshot('work-page-1366.png', { animations: 'disabled', fullPage: true })
  }

  await page.getByRole('button', { name: 'Play Sort Boxes' }).click()
  await page.getByRole('button', { name: 'Start Sort Boxes' }).click()
  for (const color of ['Red', 'Blue', 'Green', 'Yellow']) {
    await page.getByRole('button', { name: `${color} box` }).click()
    await page.getByRole('button', { name: `${color} container` }).click()
  }
  await expect(page.getByText('Earned $20.00')).toBeVisible()

  await page.getByRole('button', { name: 'Close Sort Boxes' }).click()
  await page.getByRole('button', { name: 'Play Precision Strike' }).click()
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

test('focused Memory Circuit stays visible, completes all rounds, and cannot claim twice', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0 })
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/work')
  await dismissTutorial(page)
  const before = await readSave(page)
  await page.getByRole('button', { name: 'Play Memory Circuit' }).click()
  const dialog = page.getByRole('dialog', { name: 'Memory Circuit minigame' })
  await expect(dialog).toBeVisible()
  await page.getByRole('button', { name: 'Start Memory Circuit' }).click()
  const activeGameScroll = await page.evaluate(() => window.scrollY)

  const assertGameVisible = async () => {
    const box = await page.getByTestId('memoryCircuit-game').boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(720)
    expect(await page.evaluate(() => window.scrollY)).toBe(activeGameScroll)
  }
  await assertGameVisible()
  await expect(page.getByRole('button', { name: /Memory pad 1/i })).toBeDisabled()

  for (const length of [3, 4, 5]) {
    await expect(page.getByText('YOUR TURN')).toBeVisible({ timeout: 8_000 })
    await assertGameVisible()
    for (let index = 0; index < length; index += 1) await page.getByRole('button', { name: /Memory pad 1/i }).click()
  }

  await expect(page.getByText(/Score 100%/)).toBeVisible()
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? '{}').state?.statistics?.workJobsCompleted === 1, saveKey)
  const after = await readSave(page)
  expect(after.state.money).toBeGreaterThan(before.state.money)
  expect(after.state.statistics.workJobsCompleted).toBe(1)

  await page.getByRole('button', { name: /Memory pad 1/i }).click({ force: true })
  await page.waitForTimeout(100)
  const afterDuplicateAttempt = await readSave(page)
  expect(afterDuplicateAttempt.state.money).toBe(after.state.money)
  expect(afterDuplicateAttempt.state.statistics.workJobsCompleted).toBe(1)
  await page.getByRole('button', { name: 'Close Memory Circuit' }).click()
  await expect(page.getByRole('button', { name: 'On cooldown' }).last()).toBeDisabled()
})

test('tutorial progress persists, completion stays dismissed, and Settings can replay it', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('onboarding-tutorial')).toBeVisible()
  await expect(page.getByText('Open Your First Case')).toBeVisible()
  await page.getByRole('button', { name: /Next/i }).click()
  await expect(page.getByText('Know What Can Drop')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Know What Can Drop')).toBeVisible()
  await page.getByRole('button', { name: 'Skip tutorial' }).click()
  await page.reload()
  await expect(page.getByTestId('onboarding-tutorial')).toBeHidden()
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Review Tutorial' }).click()
  await expect(page.getByText('Open Your First Case')).toBeVisible()
})

test('Large Text and Light theme are readable, persistent, and do not create horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/settings')
  await dismissTutorial(page)
  await page.getByRole('checkbox', { name: 'Large Text' }).check()
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  const appShell = page.locator('[data-theme]').first()
  await expect(appShell).toHaveAttribute('data-theme', 'light')
  await expect(appShell).toHaveAttribute('data-large-text', 'true')
  const sampleSize = await page.locator('.text-sm').first().evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  expect(sampleSize).toBeGreaterThanOrEqual(16)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await page.reload()
  await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', 'light')
  for (const route of ['/', '/inventory', '/market', '/work', '/automation', '/settings']) {
    await page.goto(route)
    await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', 'light')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  }
})

test('Poop Cleaning requires disposal and grants its reward exactly once', async ({ page }) => {
  await page.goto('/work')
  await dismissTutorial(page)
  const before = await readSave(page)
  await page.getByRole('button', { name: 'Play Poop Cleaning' }).click()
  await page.getByRole('button', { name: 'Pick up poop 1' }).dragTo(page.getByRole('button', { name: /Trash can/ }))
  await expect(page.getByRole('button', { name: 'Poop 1 disposed' })).toBeDisabled()
  for (let index = 2; index <= 3; index += 1) {
    await page.getByRole('button', { name: `Pick up poop ${index}` }).click()
    await page.getByRole('button', { name: 'Dispose selected poop in trash can' }).click()
  }
  await expect(page.getByText('Yard cleared. +$10')).toBeVisible()
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? '{}').state?.statistics?.workJobsCompleted === 1, saveKey)
  const after = await readSave(page)
  expect(after.state.money - before.state.money).toBe(10)
  await page.getByRole('button', { name: 'Poop 3 disposed' }).click({ force: true })
  expect((await readSave(page)).state.money).toBe(after.state.money)
})

test('Market rows open a paginated wear and Pattern price checker', async ({ page }) => {
  await page.goto('/market')
  await dismissTutorial(page)
  const sort = page.getByRole('combobox', { name: 'Sort Market skins' })
  await expect(sort).toHaveValue('highest-maximum')
  await expect(page.getByText('Valid price range')).toBeVisible()
  const readVisibleRanges = async () => page.getByTestId('market-row').evaluateAll((rows) => rows.slice(0, 3).map((row) => {
    const match = row.textContent?.match(/\$([\d,.]+)\s*–\s*\$([\d,.]+)/)
    return match ? [Number(match[1].replaceAll(',', '')), Number(match[2].replaceAll(',', ''))] : undefined
  }).filter(Boolean) as [number, number][])
  let ranges = await readVisibleRanges()
  expect(ranges[0][1]).toBeGreaterThanOrEqual(ranges[1][1])
  await page.getByRole('button', { name: 'Tick Market' }).click()
  ranges = await readVisibleRanges()
  expect(ranges[0][1]).toBeGreaterThanOrEqual(ranges[1][1])
  await sort.selectOption('lowest-minimum')
  ranges = await readVisibleRanges()
  expect(ranges[0][0]).toBeLessThanOrEqual(ranges[1][0])
  await page.getByRole('searchbox', { name: /search market skins/i }).fill('Fade')
  const row = page.getByTestId('market-row').first()
  await expect(row).toBeVisible()
  await row.click()
  const dialog = page.getByRole('dialog', { name: /price details/i })
  await expect(dialog.getByText('Wear price table')).toBeVisible()
  await expect(dialog.getByText('Pattern price explorer')).toBeVisible()
  const topTen = dialog.getByText('Top 10 patterns')
  if (await topTen.isVisible().catch(() => false)) {
    await expect(dialog.getByRole('spinbutton', { name: 'Search pattern ID' })).toBeVisible()
    expect(await dialog.getByRole('row').count()).toBeLessThan(40)
  }
})

test('virtual marketplace navigates catalog to a dedicated skin market and purchases once', async ({ page }) => {
  await page.goto('/market')
  await dismissTutorial(page)
  const catalogSearch = page.getByRole('textbox', { name: 'Search skin markets' })
  await catalogSearch.fill('P250 Sand Dune')
  const skinMarket = page.getByRole('button', { name: /P250 \| Sand Dune.*View all listings/i }).first()
  await expect(skinMarket).toBeVisible()
  await skinMarket.click()
  await expect(page.getByRole('button', { name: /Back to all skin markets/i })).toBeVisible()
  await expect(page.getByText('Listing filters')).toBeVisible()
  await expect(page.getByText(/full market is never allocated in memory/i)).toBeVisible()

  const before = await readSave(page)
  const buy = page.getByRole('button', { name: 'Buy', exact: true }).first()
  await expect(buy).toBeEnabled()
  await buy.click()
  await expect.poll(async () => (await readSave(page)).state.inventory.length).toBe(before.state.inventory.length + 1)
  const after = await readSave(page)
  expect(after.state.money).toBeLessThan(before.state.money)
  expect(after.state.marketplace.removedVirtualListingIds.length).toBeGreaterThan(0)
})

test('Achievements Claim All grants unlocked rewards once', async ({ page }) => {
  await page.goto('/')
  await dismissTutorial(page)
  await openBatch(page, 1)
  const before = await readSave(page)
  await page.goto('/achievements')
  const claimAll = page.getByRole('button', { name: /Claim All \([1-9]/ })
  await expect(claimAll).toBeEnabled()
  await claimAll.click()
  await expect(page.getByRole('button', { name: 'Claim All (0)' })).toBeDisabled()
  await page.waitForFunction(
    ({ key, beforeMoney }) => JSON.parse(localStorage.getItem(key) ?? '{}').state?.money > beforeMoney,
    { key: saveKey, beforeMoney: before.state.money },
  )
  const after = await readSave(page)
  expect(after.state.money).toBeGreaterThan(before.state.money)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Claim All (0)' })).toBeDisabled()
})

test('focused Precision Strike remains fully visible at laptop height', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/work')
  await dismissTutorial(page)
  await page.getByRole('button', { name: 'Play Precision Strike' }).click()
  await page.getByRole('button', { name: 'Start Precision Strike' }).click()
  const box = await page.getByTestId('precisionStrike-game').boundingBox()
  expect(box).not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(720)
  await expect(page.getByRole('button', { name: 'Stop precision marker' })).toBeInViewport()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
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

test('every player-facing route renders without console errors or horizontal clipping', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.setViewportSize({ width: 1366, height: 768 })
  for (const route of ['/', '/cases', '/inventory', '/market', '/events', '/automation', '/work', '/upgrades', '/prestige', '/skill-tree', '/achievements', '/collection-book', '/trophy-room', '/stats', '/leaderboards', '/profile', '/settings', '/rewards', '/trade-ups']) {
    await page.goto(route)
    await dismissTutorial(page)
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('Something went wrong')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), route).toBe(true)
  }
  expect(errors).toEqual([])
})
