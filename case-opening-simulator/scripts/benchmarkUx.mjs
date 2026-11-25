import { chromium } from 'playwright'
import { writeFile } from 'node:fs/promises'

const baseUrl = process.argv.find((arg) => arg.startsWith('--base-url='))?.split('=')[1] ?? 'http://127.0.0.1:5175'
const output = process.argv.find((arg) => arg.startsWith('--output='))?.split('=')[1]
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'no-preference' })
await page.addInitScript(() => {
  window.__uxLongTasks = []
  window.__uxSaves = []
  const originalSetItem = Storage.prototype.setItem
  Storage.prototype.setItem = function (key, value) {
    const start = performance.now()
    try { return originalSetItem.call(this, key, value) }
    finally { if (key === 'case-opening-simulator:game-state') window.__uxSaves.push(performance.now() - start) }
  }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__uxLongTasks.push({ start: entry.startTime, duration: entry.duration })
    }).observe({ type: 'longtask', buffered: true })
  } catch { /* The browser may not expose long tasks. */ }
})

const results = { date: new Date().toISOString(), baseUrl, browser: browser.version(), viewport: '1366x768', routes: {}, inAppNavigation: {}, cswearListing: {}, opening: {}, largeInventory: {} }

async function route(path, name) {
  const start = Date.now()
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' })
  await page.locator('main').waitFor()
  const ready = {
    home: () => page.getByText('Continue Opening', { exact: true }).first(),
    cases: () => page.getByRole('button', { name: 'Open 1', exact: true }),
    inventory: () => page.getByRole('heading', { name: 'Inventory', exact: true }),
    cswear: () => page.getByRole('button', { name: /View all listings/ }).first(),
    career: () => page.getByRole('heading', { name: 'Career & Upgrades', exact: true }),
    quests: () => page.getByRole('heading', { name: 'Quests & Collection Hunts' }),
    help: () => page.getByTestId('help-center'),
  }[name]
  if (ready) await ready().waitFor()
  await page.waitForTimeout(100)
  results.routes[name] = await page.evaluate(({ start, path }) => {
    const navigation = performance.getEntriesByType('navigation')[0]
    return {
      path,
      wallMs: Date.now() - start,
      domContentLoadedMs: Math.round(navigation?.domContentLoadedEventEnd ?? 0),
      longTaskCount: window.__uxLongTasks?.length ?? 0,
      longTaskTotalMs: Math.round((window.__uxLongTasks ?? []).reduce((sum, entry) => sum + entry.duration, 0)),
      visibleImages: [...document.images].filter((image) => image.getBoundingClientRect().width > 0 && image.getBoundingClientRect().height > 0).length,
      domNodes: document.querySelectorAll('*').length,
      resourceCount: performance.getEntriesByType('resource').length,
    }
  }, { start, path })
}

await route('/', 'home')
const tutorialSkip = page.getByRole('button', { name: 'Skip beginner tutorial' })
if (await tutorialSkip.isVisible().catch(() => false)) {
  await tutorialSkip.click()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('case-opening-simulator:game-state') ?? '{}').state?.ui?.onboarding?.isDismissed === true)
}
const unlockedSave = await page.evaluate(() => {
  const save = JSON.parse(localStorage.getItem('case-opening-simulator:game-state') ?? 'null')
  if (!save?.state?.ui?.featureUnlocks) return null
  save.state.ui.onboarding.isDismissed = true
  save.state.ui.onboarding.isReviewing = false
  save.state.ui.featureUnlocks.unlockedIds = [...new Set([...save.state.ui.featureUnlocks.unlockedIds, 'market', 'cswear', 'quests'])]
  return JSON.stringify(save)
})
if (unlockedSave) {
  await page.addInitScript((value) => {
    if (sessionStorage.getItem('benchmark-unlocks-ready')) return
    localStorage.setItem('case-opening-simulator:game-state', value)
    sessionStorage.setItem('benchmark-unlocks-ready', '1')
  }, unlockedSave)
  await page.reload()
} else throw new Error('The benchmark could not initialize a temporary save for unlocked route measurements.')
for (const [path, name] of [['/cases', 'cases'], ['/inventory', 'inventory'], ['/cswear', 'cswear'], ['/career', 'career'], ['/quests', 'quests'], ['/help', 'help']]) await route(path, name)

await page.goto(baseUrl)
for (const [path, name] of [['/career', 'career'], ['/help', 'help']]) {
  const start = Date.now()
  await page.locator(`a[href="${path}"]:visible`).first().click()
  await page.waitForURL(`**${path}`)
  await page.locator('main h1, main h2').first().waitFor()
  results.inAppNavigation[name] = Date.now() - start
}

await page.goto(`${baseUrl}/cswear`)
const listingStart = Date.now()
await page.getByRole('button', { name: /View all listings/ }).first().click()
await page.getByTestId('cswear-infinite-list').locator('article').first().waitFor()
results.cswearListing = {
  openMs: Date.now() - listingStart,
  mountedCards: await page.getByTestId('cswear-infinite-list').locator('article').count(),
  domNodes: await page.locator('*').count(),
}

await page.goto(`${baseUrl}/cases`)
for (const quantity of [1, 10]) {
  const start = Date.now()
  await page.getByRole('button', { name: `Open ${quantity}`, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Case opening animation' })
  await dialog.waitFor()
  const frames = await page.evaluate(() => new Promise((resolve) => {
    const deltas = []
    let previous = 0
    const end = performance.now() + 1_500
    const sample = (time) => {
      if (previous) deltas.push(time - previous)
      previous = time
      if (time < end) requestAnimationFrame(sample)
      else resolve(deltas)
    }
    requestAnimationFrame(sample)
  }))
  results.opening[quantity] = {
    readyMs: Date.now() - start,
    frameCount: frames.length,
    frameMedianMs: Math.round(frames.sort((a, b) => a - b)[Math.floor(frames.length / 2)] ?? 0),
    frameP95Ms: Math.round(frames[Math.floor(frames.length * .95)] ?? 0),
    over50Ms: frames.filter((value) => value > 50).length,
    domNodes: await page.locator('*').count(),
    reelCards: await page.evaluate(() => [...document.querySelectorAll('[data-testid="roulette-track"]')].reduce((total, track) => total + track.children.length, 0)),
    saveCount: await page.evaluate(() => window.__uxSaves?.length ?? 0),
    longestSaveMs: await page.evaluate(() => Math.round(Math.max(0, ...(window.__uxSaves ?? [])))),
  }
  const skip = dialog.getByRole('button', { name: 'Skip opening animation' })
  for (let attempt = 0; attempt < 2 && await skip.isVisible().catch(() => false); attempt += 1) await skip.click({ timeout: 2_000 }).catch(() => undefined)
  const summary = page.getByRole('dialog', { name: 'Case opening batch summary' })
  if (await summary.isVisible().catch(() => false)) await summary.getByRole('button', { name: 'Close opening summary' }).click()
}

await page.evaluate(() => {
  const key = 'case-opening-simulator:game-state'
  const save = JSON.parse(localStorage.getItem(key) ?? 'null')
  const sample = save?.state?.inventory?.[0]
  if (!sample) return
  save.state.inventory = Array.from({ length: 400 }, (_, index) => ({ ...sample, instanceId: `benchmark-item-${index}` }))
  localStorage.setItem(key, JSON.stringify(save))
})
const inventoryStart = Date.now()
await page.goto(`${baseUrl}/inventory`, { waitUntil: 'domcontentloaded' })
await page.locator('main').waitFor()
await page.waitForTimeout(300)
results.largeInventory = await page.evaluate((start) => ({
  wallMs: Date.now() - start,
  domNodes: document.querySelectorAll('*').length,
  longTaskCount: window.__uxLongTasks?.length ?? 0,
  longTaskTotalMs: Math.round((window.__uxLongTasks ?? []).reduce((sum, entry) => sum + entry.duration, 0)),
  longestSaveMs: Math.round(Math.max(0, ...(window.__uxSaves ?? []))),
}), inventoryStart)

await browser.close()
if (output) await writeFile(output, JSON.stringify(results, null, 2))
else process.stdout.write(`${JSON.stringify(results, null, 2)}\n`)
