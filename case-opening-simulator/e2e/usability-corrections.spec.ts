import { expect, test } from '@playwright/test'

const saveKey = 'case-opening-simulator:game-state'

test('Opening Funds pay before wallet cash across real openings', async ({ page }) => {
  await page.goto('/cases')
  await page.getByRole('button', { name: 'Skip beginner tutorial' }).click()
  await page.waitForFunction((key) => Boolean(JSON.parse(localStorage.getItem(key) ?? '{}').state), saveKey)
  const payment = page.getByLabel('Opening payment breakdown')
  const cost = Number((await payment.textContent())?.match(/Open 1 cost: \$(\d+\.\d{2})/)?.[1])
  expect(cost).toBeGreaterThan(0)
  const baseline = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), saveKey)
  baseline.state.money = 10
  baseline.state.dailyRewards.openingCredits = Number((cost + 0.05).toFixed(2))
  await page.addInitScript((save) => {
    if (sessionStorage.getItem('funds-test-loaded')) return
    localStorage.setItem('case-opening-simulator:game-state', save)
    sessionStorage.setItem('funds-test-loaded', '1')
  }, JSON.stringify(baseline))
  await page.reload()
  await expect(payment).toContainText(`Case Opening Funds used: −$${cost.toFixed(2)}`)
  await expect(payment).toContainText('Cash you pay: $0.00')

  for (const expected of [{ cash: 10, funds: 0.05 }, { cash: Number((10 - cost + 0.05).toFixed(2)), funds: 0 }]) {
    await page.getByRole('button', { name: 'Open 1', exact: true }).click()
    const opening = page.getByRole('dialog', { name: 'Case opening animation' })
    await opening.getByRole('button', { name: 'Skip opening animation' }).click()
    await expect(opening).toBeHidden({ timeout: 15_000 })
    await page.waitForFunction(({ key, cash, funds }) => {
      const state = JSON.parse(localStorage.getItem(key) ?? '{}').state
      return state?.money === cash && state?.dailyRewards?.openingCredits === funds
    }, { key: saveKey, ...expected })
  }
  const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').state, saveKey)
  expect(after.statistics.casesOpened - baseline.state.statistics.casesOpened).toBe(2)
  expect(after.inventory.length - baseline.state.inventory.length).toBe(2)
  await page.goto('/')
  const activity = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Recent activity' }) }).last()
  await expect(activity).toContainText(after.recentDrops[0].weapon)
  await expect(activity.locator('img').first()).toHaveAttribute('src', /assets\//)
})

test('the game guide searches terms and opens one article at a time', async ({ page }) => {
  await page.goto('/help?topic=start')
  await page.getByRole('button', { name: 'Skip beginner tutorial' }).click()
  await expect(page.getByTestId('help-article')).toContainText('Your first session')
  await page.getByRole('searchbox').fill('ROI')
  await page.getByRole('button', { name: 'Trade-Ups' }).click()
  await expect(page.getByTestId('help-article')).toContainText('Trade-Up contracts')
  await page.locator('summary').filter({ hasText: 'More details' }).click()
  await expect(page.getByTestId('help-article')).toContainText('ROI compares expected output value')
  await page.goto('/help?term=float')
  await expect(page.getByTestId('help-article')).toContainText('Float')
  await expect(page.getByTestId('help-article')).toContainText('How worn a skin is')
})

test('Career paths and About remain usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/career')
  await page.getByRole('button', { name: 'Skip beginner tutorial' }).click()
  await expect(page.getByTestId('career-level')).toHaveText('1')
  await page.getByRole('tab', { name: /Trading/ }).click()
  await expect(page.getByRole('heading', { name: 'Upgrade explorer' })).toBeVisible()
  await page.getByRole('button', { name: 'all', exact: true }).click()
  await expect(page.getByText('Trading', { exact: true }).first()).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.goto('/credits')
  await expect(page.getByText('Created by Jonsman')).toBeVisible()
  await expect(page.getByText(/no real-money payouts/i)).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('Trade-Ups ignores a stale rarity filter on every fresh visit', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction((key) => Boolean(JSON.parse(localStorage.getItem(key) ?? '{}').state), saveKey)
  const legacy = await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) ?? '{}')
    save.version = 41
    save.state.ui.onboarding = { ...save.state.ui.onboarding, isDismissed: true }
    delete save.state.ui.featureUnlocks
    return JSON.stringify(save)
  }, saveKey)
  await page.addInitScript((value) => {
    if (sessionStorage.getItem('rarity-test-loaded')) return
    localStorage.setItem('case-opening-simulator:game-state', value)
    sessionStorage.setItem('trade-ups:rarity-v2', 'Classified')
    sessionStorage.setItem('rarity-test-loaded', '1')
  }, legacy)
  await page.reload()
  await page.goto('/trade-ups')
  await expect(page.getByTestId('trade-up-workbench')).toBeVisible()
  const all = page.getByRole('button', { name: 'All rarities' })
  await expect(all).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(all).toHaveAttribute('aria-pressed', 'true')
})
