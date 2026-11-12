import { describe, expect, it } from 'vitest'
import { getCumulativeXpForLevel } from '../career/careerProgress'
import { gameReducer } from '../data/gameReducer'
import { defaultGameState, type GameState } from '../data/gameState'
import { AutomationModuleId, Rarity, UpgradeId, WearCondition, type SkinInstance } from '../data/models'
import { SKIN_DEFINITIONS } from '../data/skins'
import { createMarketplaceNpc, MARKETPLACE_LISTING_DURATION_MS } from '../marketplace/marketplace'
import { createSaveEnvelope, parseGameSaveText } from '../utils/save'
import {
  BUSINESS_MAX_TRAINING_LEVEL,
  BUSINESS_TRANSITION_CREDIT_CAP,
  createDefaultBusinessState,
  getEmployeeHireCost,
  getEmployeeHourlyWage,
  getEmployeeTrainingCost,
  migrateLegacyAutomationToBusiness,
} from './business'

const NOW = 1_800_000_000_000

function levelState(level: number, overrides: Partial<GameState> = {}): GameState {
  return {
    ...defaultGameState,
    business: createDefaultBusinessState(NOW),
    money: 1_000_000,
    career: { ...defaultGameState.career, currentRunXp: getCumulativeXpForLevel(level), lifetimeXp: getCumulativeXpForLevel(level) },
    ...overrides,
  }
}

function item(instanceId: string, overrides: Partial<SkinInstance> = {}): SkinInstance {
  const skin = SKIN_DEFINITIONS[0]
  return {
    ...skin,
    instanceId,
    wear: WearCondition.FieldTested,
    floatValue: .2,
    marketValue: 10,
    isLocked: false,
    isFavorited: false,
    discoveredAt: NOW,
    ...overrides,
  }
}

describe('Business employee foundation', () => {
  it('uses fixed acquisition tiers and the documented training and wage formulas', () => {
    expect(getEmployeeHireCost('caseOperator')).toBe(2_500)
    expect(getEmployeeHireCost('salesAssistant')).toBe(5_375)
    expect(getEmployeeTrainingCost('marketScout', 0)).toBe(1_620)
    expect(getEmployeeHourlyWage('caseOperator', 0)).toBe(25)
    expect(getEmployeeHourlyWage('juniorTrader', 4)).toBeGreaterThan(getEmployeeHourlyWage('caseOperator', 4))
  })

  it('enforces rank gates, exact-once hiring and effective training maximums', () => {
    const locked = gameReducer(levelState(1), { type: 'HIRE_EMPLOYEE', roleId: 'caseOperator', requestId: 'hire-1', now: NOW })
    expect(locked.business.employees.caseOperator.isHired).toBe(false)
    const eligible = levelState(15)
    const hired = gameReducer(eligible, { type: 'HIRE_EMPLOYEE', roleId: 'caseOperator', requestId: 'hire-1', now: NOW })
    const replay = gameReducer(hired, { type: 'HIRE_EMPLOYEE', roleId: 'caseOperator', requestId: 'hire-1', now: NOW })
    expect(hired.business.employees.caseOperator.isHired).toBe(true)
    expect(hired.money).toBe(eligible.money - 2_500)
    expect(replay.money).toBe(hired.money)
    const maxed = { ...hired, business: { ...hired.business, employees: { ...hired.business.employees, caseOperator: { ...hired.business.employees.caseOperator, trainingLevel: BUSINESS_MAX_TRAINING_LEVEL } } } }
    expect(gameReducer(maxed, { type: 'TRAIN_EMPLOYEE', roleId: 'caseOperator', requestId: 'train-max', now: NOW }).money).toBe(maxed.money)
  })

  it('moves budget out of the wallet and releases it exactly once', () => {
    const hired = gameReducer(levelState(15), { type: 'HIRE_EMPLOYEE', roleId: 'caseOperator', requestId: 'hire-budget', now: NOW })
    const allocated = gameReducer(hired, { type: 'ALLOCATE_EMPLOYEE_BUDGET', roleId: 'caseOperator', amount: 500, requestId: 'allocate-1', now: NOW })
    const replay = gameReducer(allocated, { type: 'ALLOCATE_EMPLOYEE_BUDGET', roleId: 'caseOperator', amount: 500, requestId: 'allocate-1', now: NOW })
    const released = gameReducer(replay, { type: 'RELEASE_EMPLOYEE_BUDGET', roleId: 'caseOperator', requestId: 'release-1', now: NOW })
    const replayRelease = gameReducer(released, { type: 'RELEASE_EMPLOYEE_BUDGET', roleId: 'caseOperator', requestId: 'release-1', now: NOW })
    expect(allocated.money).toBe(hired.money - 500)
    expect(allocated.business.employees.caseOperator.availableCapital).toBe(500)
    expect(replay.money).toBe(allocated.money)
    expect(released.money).toBe(hired.money)
    expect(replayRelease.money).toBe(released.money)
  })

  it('settles payroll through a persistent watermark without charging the same period twice', () => {
    const employee = {
      ...createDefaultBusinessState(NOW).employees.caseOperator,
      isHired: true,
      isEnabled: true,
      status: 'running' as const,
      availableCapital: 100,
      allocatedCapital: 100,
      payrollSettledThrough: NOW,
      nextActionAt: NOW + 2 * 60 * 60_000,
    }
    const state = levelState(15, { business: { ...createDefaultBusinessState(NOW), employees: { ...createDefaultBusinessState(NOW).employees, caseOperator: employee } } })
    const paid = gameReducer(state, { type: 'TICK_BUSINESS', now: NOW + 60 * 60_000 })
    const replay = gameReducer(paid, { type: 'TICK_BUSINESS', now: NOW + 60 * 60_000 })
    expect(paid.business.employees.caseOperator.availableCapital).toBe(75)
    expect(paid.business.financials.payroll).toBe(25)
    expect(replay.business.employees.caseOperator.availableCapital).toBe(75)
    expect(replay.business.recentOperations.filter((operation) => operation.type === 'payroll')).toHaveLength(1)
    expect(replay.career.specializations.business.currentRunXp).toBe(0)
  })

  it('pauses cleanly when payroll funds are insufficient and never creates a negative balance', () => {
    const business = createDefaultBusinessState(NOW)
    const state = levelState(15, { business: { ...business, employees: { ...business.employees, caseOperator: { ...business.employees.caseOperator, isHired: true, isEnabled: true, status: 'running', availableCapital: 1, allocatedCapital: 1, payrollSettledThrough: NOW, nextActionAt: NOW + 2 * 60 * 60_000 } } } })
    const result = gameReducer(state, { type: 'TICK_BUSINESS', now: NOW + 60 * 60_000 })
    expect(result.business.employees.caseOperator.isEnabled).toBe(false)
    expect(result.business.employees.caseOperator.availableCapital).toBe(1)
    expect(result.business.employees.caseOperator.lastPauseReason).toContain('payroll')
  })

  it('runs the Case Operator through the paid opening pipeline without player-wallet duplication', () => {
    let state = gameReducer(levelState(15), { type: 'HIRE_EMPLOYEE', roleId: 'caseOperator', requestId: 'hire-case', now: NOW })
    state = gameReducer(state, { type: 'ALLOCATE_EMPLOYEE_BUDGET', roleId: 'caseOperator', amount: 500, requestId: 'fund-case', now: NOW })
    state = gameReducer(state, { type: 'UPDATE_EMPLOYEE_SETTINGS', roleId: 'caseOperator', settings: { caseId: 'missing-legacy-case', maximumCasesPerShift: 2, stopLoss: 500 }, now: NOW })
    state = { ...state, business: { ...state.business, employees: { ...state.business.employees, caseOperator: { ...state.business.employees.caseOperator, settings: { ...state.business.employees.caseOperator.settings, caseId: 'missing-legacy-case' } } } } }
    state = gameReducer(state, { type: 'TOGGLE_EMPLOYEE', roleId: 'caseOperator', isEnabled: true, now: NOW })
    const walletBefore = state.money
    const tickAt = state.business.employees.caseOperator.nextActionAt + 1
    const opened = gameReducer(state, { type: 'TICK_BUSINESS', now: tickAt, prng: () => .5 })
    expect(opened.statistics.casesOpened).toBe(1)
    expect(opened.inventory.length + opened.statistics.itemsSold).toBeGreaterThanOrEqual(1)
    expect(opened.money).toBe(walletBefore)
    expect(opened.business.employees.caseOperator.availableCapital).toBeLessThan(500)
    expect(opened.business.recentOperations[0]?.type).toBe('case-opened')
    expect(opened.career.specializations.business.currentRunXp).toBeGreaterThan(0)
  })

  it('protects locked duplicates from the Sales Assistant', () => {
    const first = item('locked', { isLocked: true, marketValue: 1 })
    const second = item('ordinary', { marketValue: 2 })
    let state = levelState(15, { inventory: [first, second], inventoryValue: 3 })
    state = { ...state, business: { ...state.business, employees: { ...state.business.employees, salesAssistant: { ...state.business.employees.salesAssistant, isHired: true, isEnabled: true, status: 'running', nextActionAt: NOW, payrollSettledThrough: NOW } } } }
    const result = gameReducer(state, { type: 'TICK_BUSINESS', now: NOW + 1 })
    expect(result.inventory.some((entry) => entry.instanceId === 'locked')).toBe(true)
    expect(result.inventory.filter((entry) => entry.id === first.id)).toHaveLength(1)
  })

  it('creates a real seven-day escrow listing without treating the ask as realized profit', () => {
    const first = item('keep', { marketValue: 20 })
    const second = item('list', { marketValue: 10 })
    const business = createDefaultBusinessState(NOW)
    let state = levelState(15, { inventory: [first, second], inventoryValue: 30, business: { ...business, employees: { ...business.employees, salesAssistant: { ...business.employees.salesAssistant, isHired: true, isEnabled: true, status: 'running', availableCapital: 100, allocatedCapital: 100, payrollSettledThrough: NOW, nextActionAt: NOW, settings: { ...business.employees.salesAssistant.settings, mode: 'list' } } } } })
    state = gameReducer(state, { type: 'TICK_BUSINESS', now: NOW + 1 })
    expect(state.marketplace.playerListings).toHaveLength(1)
    expect(state.marketplace.playerListings[0].item.instanceId).toBe('list')
    expect(state.marketplace.playerListings[0].expiresAt - state.marketplace.playerListings[0].createdAt).toBe(MARKETPLACE_LISTING_DURATION_MS)
    expect(state.inventory.map((entry) => entry.instanceId)).toEqual(['keep'])
    expect(state.business.recentOperations[0]).toMatchObject({ type: 'market-listing', revenue: 0, realizedProfit: 0 })
  })

  it('creates a genuine bounded Scout alert and suppresses duplicate stable listing IDs', () => {
    const skin = SKIN_DEFINITIONS.find((candidate) => candidate.rarity === Rarity.Consumer) ?? SKIN_DEFINITIONS[0]
    let state = levelState(35)
    state = { ...state, marketplace: { ...state.marketplace, virtualMarketEpoch: Math.floor(NOW / (7 * 24 * 60 * 60_000)), virtualMarketNextEpochAt: NOW + 7 * 24 * 60 * 60_000 }, business: { ...state.business, watchlists: [{ id: 'watch-1', name: 'Test watch', enabled: true, skinId: skin.id, maximumPrice: 1_000_000, minimumDiscount: -1, minimumConfidence: 0, lastScannedAt: 0, scanCursor: 0, scannedCandidates: 0 }], employees: { ...state.business.employees, marketScout: { ...state.business.employees.marketScout, isHired: true, isEnabled: true, status: 'running', nextActionAt: NOW, payrollSettledThrough: NOW, availableCapital: 1_000, allocatedCapital: 1_000 } } } }
    const first = gameReducer(state, { type: 'TICK_BUSINESS', now: NOW + 1 })
    const second = gameReducer({ ...first, business: { ...first.business, employees: { ...first.business.employees, marketScout: { ...first.business.employees.marketScout, isEnabled: true, nextActionAt: NOW + 2 } } } }, { type: 'TICK_BUSINESS', now: NOW + 3 })
    expect(first.business.alerts.length).toBeGreaterThan(0)
    expect(new Set(second.business.alerts.map((alert) => alert.listingId)).size).toBe(second.business.alerts.length)
    expect(first.business.watchlists[0].scannedCandidates).toBeGreaterThan(0)
  })

  it('requires manual approval for a qualifying high-value Trade-Up Specialist contract', () => {
    const inputSkin = SKIN_DEFINITIONS.find((skin) => skin.id === 'p250_sand_dune') ?? SKIN_DEFINITIONS[0]
    const inputs = Array.from({ length: 10 }, (_, index) => item(`trade-${index}`, { ...inputSkin, marketValue: .01 }))
    const business = createDefaultBusinessState(NOW)
    const specialist = business.employees.tradeUpSpecialist
    const state = levelState(35, {
      inventory: inputs,
      inventoryValue: .1,
      marketValues: { ...defaultGameState.marketValues, [inputSkin.id]: .01, galil_ar_blue_titanium: 10 },
      business: { ...business, employees: { ...business.employees, tradeUpSpecialist: { ...specialist, isHired: true, isEnabled: true, status: 'running', availableCapital: 100, allocatedCapital: 100, payrollSettledThrough: NOW, nextActionAt: NOW, settings: { ...specialist.settings, maximumInputValue: 100, maximumDailyConsumedValue: 100, minimumExpectedProfit: 0, minimumExpectedRoi: 0, confirmationThreshold: .05 } } } },
    })
    const result = gameReducer(state, { type: 'TICK_BUSINESS', now: NOW + 1, prng: () => .5 })
    expect(result.business.pendingTradeUpApproval).toBeDefined()
    expect(result.business.employees.tradeUpSpecialist.status).toBe('awaiting-approval')
    expect(result.inventory).toHaveLength(10)
  })

  it('lets the Junior Trader buy one stable ordinary listing within strict limits exactly once', () => {
    const skin = SKIN_DEFINITIONS[0]
    const listingItem = item('junior-purchase', { ...skin, marketValue: 20 })
    const listing = {
      id: 'junior-listing',
      item: listingItem,
      seller: createMarketplaceNpc(123, listingItem),
      askingPrice: 5,
      reservationPrice: 4,
      fairMarketValue: 20,
      liquidityScore: .8,
      scarcityScore: .1,
      createdAt: NOW - 1_000,
      expiresAt: NOW + 60_000,
    }
    const business = createDefaultBusinessState(NOW)
    const trader = business.employees.juniorTrader
    const state = levelState(55, {
      marketplace: { ...defaultGameState.marketplace, virtualMarketEpoch: Math.floor(NOW / (7 * 24 * 60 * 60_000)), virtualMarketNextEpochAt: NOW + 7 * 24 * 60 * 60_000, npcListings: [listing] },
      business: { ...business, employees: { ...business.employees, juniorTrader: { ...trader, isHired: true, isEnabled: true, status: 'running', availableCapital: 50, allocatedCapital: 50, payrollSettledThrough: NOW, nextActionAt: NOW, settings: { ...trader.settings, maximumPurchasePrice: 10, maximumItemValue: 100, minimumDiscount: .1, minimumValuationConfidence: .5, walletReserve: 0, stopLoss: 50, manualApprovalThreshold: 10 } } } },
    })
    const purchased = gameReducer(state, { type: 'TICK_BUSINESS', now: NOW + 1 })
    const replay = gameReducer({ ...purchased, business: { ...purchased.business, employees: { ...purchased.business.employees, juniorTrader: { ...purchased.business.employees.juniorTrader, isEnabled: true, nextActionAt: NOW + 2 } } } }, { type: 'TICK_BUSINESS', now: NOW + 3 })
    expect(purchased.inventory.some((entry) => entry.instanceId === listingItem.instanceId)).toBe(true)
    expect(purchased.business.dailyUsage.juniorTraderPurchases).toBe(1)
    expect(purchased.economyLedger.itemCostBasis[listingItem.instanceId]).toBe(5)
    expect(replay.inventory.filter((entry) => entry.instanceId === listingItem.instanceId)).toHaveLength(1)
  })

  it('round-trips v36 employee budgets, settings and payroll watermarks', () => {
    const business = createDefaultBusinessState(NOW)
    const state = levelState(55, { business: { ...business, employees: { ...business.employees, juniorTrader: { ...business.employees.juniorTrader, isHired: true, allocatedCapital: 500, availableCapital: 425, spentCapital: 75, payrollSettledThrough: NOW, settings: { ...business.employees.juniorTrader.settings, maximumPurchasePrice: 42 } } } } })
    const loaded = parseGameSaveText(JSON.stringify(createSaveEnvelope(state)))
    expect(loaded.business.employees.juniorTrader).toMatchObject({ isHired: true, allocatedCapital: 500, availableCapital: 425, spentCapital: 75, payrollSettledThrough: NOW })
    expect(loaded.business.employees.juniorTrader.settings.maximumPurchasePrice).toBe(42)
  })

  it('converts legacy investments once, caps noncash credit and retires Case Farm', () => {
    const automation = {
      ...defaultGameState.automation,
      autoOpener: { ...defaultGameState.automation.autoOpener, level: 6, isEnabled: true },
      modules: {
        ...defaultGameState.automation.modules,
        [AutomationModuleId.CaseFarm]: { ...defaultGameState.automation.modules[AutomationModuleId.CaseFarm], level: 10, isEnabled: true },
        [AutomationModuleId.MarketAnalyst]: { ...defaultGameState.automation.modules[AutomationModuleId.MarketAnalyst], level: 8, isEnabled: true },
      },
    }
    const business = migrateLegacyAutomationToBusiness(automation, { [UpgradeId.ModuleBay]: 5 }, NOW)
    expect(business.transitionCredit).toBeLessThanOrEqual(BUSINESS_TRANSITION_CREDIT_CAP)
    expect(business.employees.caseOperator.isHired).toBe(true)
    expect(business.employees.marketScout.isHired).toBe(true)
    const migrated = parseGameSaveText(JSON.stringify({ version: 35, savedAt: NOW, state: { ...levelState(35), automation, business: undefined, lastSaved: NOW } }))
    expect(migrated.business.migrationApplied).toBe(true)
    expect(migrated.automation.autoOpener.isEnabled).toBe(false)
    expect(migrated.automation.modules[AutomationModuleId.CaseFarm].isEnabled).toBe(false)
    expect(migrated.inventory).toEqual([])
    expect(migrated.money).toBe(1_000_000)
    const reloaded = parseGameSaveText(JSON.stringify(createSaveEnvelope(migrated)))
    expect(reloaded.business.transitionCreditGranted).toBe(migrated.business.transitionCreditGranted)
    expect(reloaded.business.transitionCredit).toBe(migrated.business.transitionCredit)
  })

  it.each([33, 34])('migrates a v%s save through v36 without changing item identity, Pattern, or money', (version) => {
    const preserved = item(`legacy-v${version}`, { paintSeed: 661, floatValue: .123456, marketValue: 321 })
    const source = levelState(35, { inventory: [preserved], inventoryValue: 321, money: 12_345 })
    const migrated = parseGameSaveText(JSON.stringify({ version, savedAt: NOW, state: { ...source, business: undefined, lastSaved: NOW } }))
    expect(createSaveEnvelope(migrated).version).toBe(36)
    expect(migrated.money).toBe(12_345)
    expect(migrated.inventory[0]).toMatchObject({ instanceId: preserved.instanceId, paintSeed: 661, floatValue: .123456 })
    expect(migrated.business.authoritative).toBe(true)
  })
})
