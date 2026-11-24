import { expect, test } from '@playwright/test'

const saveKey = 'case-opening-simulator:game-state'

test('first session connects opening, inventory, quest, Work, sale and returning Home', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Continue Opening' })).toBeVisible()
  await expect(page.getByText('Your first opening, quest, or trade-up will appear here.')).toBeVisible()
  await page.getByRole('button', { name: 'Skip beginner tutorial' }).click()
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? '{}').state?.ui?.onboarding?.isDismissed === true, saveKey)

  await page.goto('/cases')
  await page.getByRole('button', { name: 'Open 1', exact: true }).click()
  const opening = page.getByRole('dialog', { name: 'Case opening animation' })
  await expect(opening).toBeVisible()
  const close = opening.getByRole('button', { name: 'Skip opening animation' })
  for (let attempt = 0; attempt < 2 && await close.isVisible().catch(() => false); attempt += 1) {
    await close.click({ timeout: 2_000 }).catch(() => undefined)
  }
  await expect(opening).toBeHidden()
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? '{}').state?.statistics?.casesOpened === 1, saveKey)

  await page.goto('/inventory')
  const item = page.getByTestId('inventory-item-card').first()
  await expect(item).toBeVisible()
  await item.click()
  await expect(page.getByRole('dialog')).toContainText('Estimated')
  await page.getByRole('button', { name: /Close/ }).last().click()

  await page.goto('/quests')
  const firstQuest = page.getByTestId('quest-story-first-crack')
  await expect(firstQuest).toContainText('Open one case')
  const claim = firstQuest.getByRole('button', { name: 'Claim stage' })
  await expect(claim).toBeEnabled()
  await claim.click()
  await expect(firstQuest).toContainText('Start a shelf')

  await page.goto('/work')
  await page.getByRole('button', { name: 'Play Sort Boxes' }).click()
  await page.getByRole('button', { name: 'Start Sort Boxes' }).click()
  for (const color of ['Red', 'Blue', 'Green', 'Yellow']) {
    await page.getByRole('button', { name: `${color} box` }).click()
    await page.getByRole('button', { name: `${color} container` }).click()
  }
  await expect(page.getByText(/All four boxes sorted/)).toBeVisible()
  await expect(page.getByTestId('toast-stack')).toBeHidden()
  await page.getByRole('button', { name: 'Close Sort Boxes' }).click()
  await expect(page.getByText(/Earned \$\d+\.\d{2}/).first()).toBeVisible()

  await page.goto('/inventory')
  const beforeSale = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').state, saveKey)
  await page.getByTestId('inventory-item-card').first().click()
  await page.getByRole('button', { name: 'Sell Instantly', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm Sale' }).click()
  await page.waitForFunction(({ key, count }) => JSON.parse(localStorage.getItem(key) ?? '{}').state?.statistics?.itemsSold > count, { key: saveKey, count: beforeSale.statistics.itemsSold })
  const afterSale = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').state, saveKey)
  expect(afterSale.statistics.itemSaleRevenue).toBeGreaterThan(beforeSale.statistics.itemSaleRevenue)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Current goals' })).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('onboarding-tutorial')).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Continue Opening' })).toBeVisible()
})
