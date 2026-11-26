import { chromium, firefox } from 'playwright'
import { writeFile } from 'node:fs/promises'

const option = (name, fallback) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
const baseUrl = option('base-url', 'http://127.0.0.1:5175')
const browserName = option('browser', 'chromium')
const output = option('output', '')
const cpuProfileOutput = option('cpu-profile', '')
const cycles = Math.max(1, Math.min(12, Number(option('cycles', '1')) || 1))
const testCash = Math.max(5_000, Number(option('cash', '5000')) || 5_000)
const engine = browserName === 'firefox' ? firefox : chromium
const browser = await engine.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'no-preference' })
const consoleErrors = []
page.on('pageerror', (error) => consoleErrors.push(error.message))
await page.addInitScript(() => {
  window.__stress = { frames: [], stalls: [], phase: 'initializing', longTasks: [], longTaskEvents: [], saveWrites: [], serializations: [], loopDelays: [], heap: [] }
  const record = window.__stress
  const stringify = JSON.stringify
  JSON.stringify = function (...args) {
    const isSave = args[0]?.state?.inventory && args[0]?.version
    const started = performance.now()
    const value = stringify.apply(this, args)
    if (isSave) record.serializations.push(Math.round((performance.now() - started) * 10) / 10)
    return value
  }
  const setItem = Storage.prototype.setItem
  Storage.prototype.setItem = function (key, value) {
    const started = performance.now()
    try { return setItem.call(this, key, value) }
    finally { if (key === 'case-opening-simulator:game-state') record.saveWrites.push(Math.round((performance.now() - started) * 10) / 10) }
  }
  try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) { const duration = Math.round(entry.duration); record.longTasks.push(duration); if (duration > 100) record.longTaskEvents.push({ atMs: Math.round(entry.startTime), durationMs: duration, phase: record.phase }) } }).observe({ type: 'longtask', buffered: true }) } catch { /* Firefox has no Long Tasks API. */ }
  let previousFrame = 0
  const frame = (now) => { if (previousFrame) { const gap = Math.round(now - previousFrame); record.frames.push(gap); if (gap > 100) record.stalls.push({ atMs: Math.round(now), gapMs: gap, phase: record.phase }) } previousFrame = now; requestAnimationFrame(frame) }
  requestAnimationFrame(frame)
  let expected = performance.now() + 100
  setInterval(() => { const now = performance.now(); record.loopDelays.push(Math.max(0, Math.round(now - expected))); expected = now + 100 }, 100)
  setInterval(() => { if (performance.memory?.usedJSHeapSize) record.heap.push(performance.memory.usedJSHeapSize) }, 1_000)
})

await page.goto(baseUrl)
const skipTutorial = page.getByRole('button', { name: 'Skip beginner tutorial' })
if (await skipTutorial.isVisible().catch(() => false)) await skipTutorial.click()
await page.waitForFunction(() => Boolean(localStorage.getItem('case-opening-simulator:game-state')))
const seededSave = await page.evaluate((cash) => {
  const key = 'case-opening-simulator:game-state'
  const save = JSON.parse(localStorage.getItem(key))
  save.state.money = cash
  save.state.ui.onboarding.isDismissed = true
  const ids = ['collection-book', 'quests', 'market', 'cswear', 'trade-ups', 'business', 'prestige']
  save.state.ui.featureUnlocks = { ...save.state.ui.featureUnlocks, unlockedIds: ids, acknowledgedIds: ids, presentedIds: ids, introducedIds: ids }
  return JSON.stringify(save)
}, testCash)
await page.addInitScript(({ key, value }) => {
  if (sessionStorage.getItem('stress-save-seeded')) return
  localStorage.setItem(key, value)
  sessionStorage.setItem('stress-save-seeded', '1')
}, { key: 'case-opening-simulator:game-state', value: seededSave })
await page.goto(`${baseUrl}/cases`)
await page.getByRole('button', { name: 'Open 10', exact: true }).waitFor()
const cdp = browserName === 'chromium' ? await page.context().newCDPSession(page) : undefined
if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start') }
const milestones = []
async function phase(name) { await page.evaluate((value) => { window.__stress.phase = value }, name) }
async function mark(name) {
  milestones.push({ name, elapsedMs: await page.evaluate((phase) => { window.__stress.phase = phase; return Math.round(performance.now()) }, name) })
}
async function visit(path, ready) {
  await page.evaluate((phase) => { window.__stress.phase = `navigate ${phase}` }, path)
  await page.locator(`nav[aria-label="Primary navigation"] a[href="${path}"]`).first().click()
  await ready().waitFor()
  await mark(path)
}

for (let index = 0; index < 3; index += 1) {
  await phase(`case ${index + 1}: transaction click`)
  await page.getByRole('button', { name: 'Open 10', exact: true }).click()
  await phase(`case ${index + 1}: animation`)
  const opening = page.getByRole('dialog', { name: 'Case opening animation' })
  await opening.waitFor()
  await page.waitForTimeout(1_000)
  const skip = opening.getByRole('button', { name: 'Skip opening animation' })
  await phase(`case ${index + 1}: skip reveal`)
  if (await skip.isVisible().catch(() => false)) await skip.click()
  await phase(`case ${index + 1}: summary`)
  const summary = page.getByRole('dialog', { name: 'Case opening batch summary' })
  await summary.waitFor()
  await summary.getByRole('button', { name: 'Close opening summary' }).click()
  await mark(`open-10-${index + 1}`)
}
await visit('/inventory', () => page.getByRole('heading', { name: 'Inventory', exact: true }))
for (let index = 0; index < 3; index += 1) {
  await page.locator('article[title="Tap to inspect, long press to select"]').first().click()
  await page.getByRole('button', { name: 'Close item details' }).click()
}
await mark('inspect-3')
await visit('/work', () => page.getByRole('heading', { name: 'Precision Strike' }))
await page.getByRole('button', { name: 'Play Warehouse Rush' }).click()
const firstCrate = page.getByTestId('warehouseRush-game').locator('img[alt$="package"]').first()
const firstLane = (await firstCrate.getAttribute('alt')).replace(' package', '')
const crateBox = await firstCrate.boundingBox()
const dockBox = await page.getByRole('button', { name: `Sort into ${firstLane} dock` }).boundingBox()
await page.mouse.move(crateBox.x + crateBox.width / 2, crateBox.y + crateBox.height / 2)
await page.mouse.down()
await page.mouse.move(dockBox.x + dockBox.width / 2, dockBox.y + dockBox.height / 2, { steps: 80 })
await page.mouse.up()
await mark('warehouse-drag-80')
for (let index = 0; index < 9; index += 1) { await page.keyboard.press(String(index % 4 + 1)); await page.waitForTimeout(120) }
await mark('warehouse-10')
await page.getByRole('button', { name: 'Close Warehouse Rush' }).click()
await page.getByRole('button', { name: 'Play Memory Circuit' }).click()
await page.getByRole('button', { name: 'Start Memory Circuit' }).click()
await page.getByText('YOUR TURN').waitFor({ timeout: 15_000 })
await page.getByRole('button', { name: /Memory pad 1:/ }).click()
await mark('memory-first-input')
await page.getByRole('button', { name: 'Close Memory Circuit' }).click()
for (const path of ['/', '/cases', '/inventory', '/work', '/', '/cases', '/inventory']) {
  const target = path === '/' ? 'a[href="/"]' : `a[href="${path}"]`
  await page.locator(`nav[aria-label="Primary navigation"] ${target}`).first().click()
  await page.locator('main').waitFor()
  await mark(path)
}
for (let cycle = 1; cycle < cycles; cycle += 1) {
  await page.evaluate((phase) => { window.__stress.phase = phase }, `repeat cycle ${cycle} navigation`)
  await page.locator('nav[aria-label="Primary navigation"] a[href="/cases"]').first().click()
  const repeatButton = page.getByRole('button', { name: 'Open 10', exact: true })
  if (!await repeatButton.isEnabled()) {
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('case-opening-simulator:game-state') ?? '{}').state)
    console.error(`Extended opening stopped: cash=${state?.money}, inventory=${state?.inventory?.length}, button=${await repeatButton.getAttribute('title')}`)
    break
  }
  await phase(`repeat ${cycle}: transaction click`)
  await repeatButton.click()
  await phase(`repeat ${cycle}: animation`)
  const opening = page.getByRole('dialog', { name: 'Case opening animation' })
  await opening.waitFor()
  await page.waitForTimeout(300)
  await phase(`repeat ${cycle}: skip reveal`)
  await opening.getByRole('button', { name: 'Skip opening animation' }).click()
  await phase(`repeat ${cycle}: summary`)
  const summary = page.getByRole('dialog', { name: 'Case opening batch summary' })
  await summary.waitFor()
  await summary.getByRole('button', { name: 'Close opening summary' }).click()
  await visit('/inventory', () => page.getByRole('heading', { name: 'Inventory', exact: true }))
  await page.evaluate((phase) => { window.__stress.phase = phase }, `repeat cycle ${cycle} inventory`)
  await page.locator('article[title="Tap to inspect, long press to select"]').first().click()
  await page.getByRole('button', { name: 'Close item details' }).click()
  await visit('/work', () => page.getByRole('heading', { name: 'Precision Strike' }))
  await visit('/', () => page.locator('main'))
  await mark(`repeat-cycle-${cycle}`)
}
await page.waitForTimeout(800)
const data = await page.evaluate(() => window.__stress)
let hotspots = []
if (cdp) {
  const profile = (await cdp.send('Profiler.stop')).profile
  if (cpuProfileOutput) await writeFile(cpuProfileOutput, JSON.stringify(profile))
  hotspots = profile.nodes.map((node) => ({ functionName: node.callFrame.functionName, url: node.callFrame.url, hits: node.hitCount ?? 0 })).filter((node) => node.hits > 0).sort((a, b) => b.hits - a.hits).slice(0, 15)
}
const sorted = (values) => [...values].sort((a, b) => a - b)
const percentile = (values, fraction) => sorted(values)[Math.floor(values.length * fraction)] ?? 0
const result = {
  date: new Date().toISOString(), browser: browserName, browserVersion: browser.version(), baseUrl, viewport: '1366x768', cycles,
  durationMs: milestones.at(-1)?.elapsedMs ?? 0, milestones, consoleErrors,
  frameCount: data.frames.length, frameP95Ms: percentile(data.frames, .95), maxFrameMs: Math.max(0, ...data.frames), framesOver200: data.frames.filter((value) => value > 200).length, topStalls: data.stalls.sort((a, b) => b.gapMs - a.gapMs).slice(0, 20),
  longTaskCount: data.longTasks.length, longTasksOver200: data.longTasks.filter((value) => value > 200).length, maxLongTaskMs: Math.max(0, ...data.longTasks), topLongTasks: data.longTaskEvents.sort((a, b) => b.durationMs - a.durationMs).slice(0, 20),
  maxEventLoopDelayMs: Math.max(0, ...data.loopDelays), saveCount: data.serializations.length, maxSerializeMs: Math.max(0, ...data.serializations), maxWriteMs: Math.max(0, ...data.saveWrites),
  heapStartMb: data.heap.length ? Math.round(data.heap[0] / 1048576) : null, heapEndMb: data.heap.length ? Math.round(data.heap.at(-1) / 1048576) : null, hotspots,
}
await browser.close()
if (output) await writeFile(output, JSON.stringify(result, null, 2))
else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
