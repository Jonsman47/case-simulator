import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gameReducer } from '../data/gameReducer'
import { defaultDropsByRarity, defaultGameState, type GameState } from '../data/gameState'
import { AutomationModuleId, AutoSellRuleType, Rarity, WearCondition, type SkinInstance } from '../data/models'
import {
  OFFLINE_PROGRESS_CAP_MS,
  OFFLINE_TRADING_BOT_MAX_RUNS,
  calculateOfflineProgress,
} from './offlineProgress'

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...defaultGameState,
    inventory: [],
    collectionBook: [],
    recentDrops: [],
    lastOpenedItems: [],
    uiEvents: [],
    casesUnlocked: ['starter_case', 'fracture_style_case'],
    specialEventCaseIds: [],
    statistics: {
      ...defaultGameState.statistics,
      dropsByRarity: { ...defaultDropsByRarity },
    },
    ...overrides,
  }
}

function makeTradeUpItem(index: number): SkinInstance {
  return {
    id: 'p250_sand_dune',
    weapon: 'P250',
    finish: 'Sand Dune',
    rarity: Rarity.Consumer,
    baseValue: 0.03,
    caseIds: ['starter_case'],
    image: '/assets/placeholder.png',
    instanceId: `trade-up-input-${index}`,
    wear: WearCondition.FactoryNew,
    floatValue: 0,
    marketValue: 0.03,
    isLocked: false,
    isFavorited: false,
    discoveredAt: 1_000,
  }
}

describe('offline progression', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('simulates Auto Opener and Case Farm while offline', () => {
    const lastSaved = 1_000
    const now = lastSaved + 60_000
    const state = makeState({
      lastSaved,
      money: 10,
      automation: {
        ...defaultGameState.automation,
        autoOpener: {
          caseId: 'starter_case',
          intervalMs: 30_000,
          isEnabled: true,
          lastOpenTime: lastSaved,
          level: 1,
          totalOpened: 0,
        },
        modules: {
          ...defaultGameState.automation.modules,
          [AutomationModuleId.CaseFarm]: {
            ...defaultGameState.automation.modules[AutomationModuleId.CaseFarm],
            isEnabled: true,
            lastRunTime: lastSaved,
            level: 1,
          },
        },
      },
    })
    const result = calculateOfflineProgress(state, now)

    expect(result?.summary).toMatchObject({
      caseFarmEarned: 6,
      casesOpened: 2,
      drops: 2,
      itemsObtained: 2,
      moneyEarned: 6,
      moneySpent: 0.4,
      netMoneyChange: 5.6,
    })
    expect(result?.state.money).toBe(15.6)
    expect(result?.state.inventory).toHaveLength(2)
    expect(result?.state.automation.autoOpener.totalOpened).toBe(2)
    expect(result?.state.lastSaved).toBe(now)
  })

  it('applies auto-sell rules to offline case drops', () => {
    const lastSaved = 1_000
    const now = lastSaved + 30_000
    const state = makeState({
      lastSaved,
      money: 10,
      autoSellRules: [
        {
          enabled: true,
          id: 'sell-low',
          type: AutoSellRuleType.MinValue,
          valueThreshold: 1,
        },
      ],
      automation: {
        ...defaultGameState.automation,
        autoOpener: {
          caseId: 'starter_case',
          intervalMs: 30_000,
          isEnabled: true,
          lastOpenTime: lastSaved,
          level: 1,
          totalOpened: 0,
        },
      },
    })
    const result = calculateOfflineProgress(state, now)

    expect(result?.summary).toMatchObject({
      autoSoldItems: 1,
      casesOpened: 1,
      drops: 1,
      moneyEarned: 0.03,
      netMoneyChange: -0.17,
    })
    expect(result?.state.inventory).toHaveLength(0)
    expect(result?.state.statistics.itemsSold).toBe(1)
  })

  it('caps offline duration and applies the precomputed result through the reducer', () => {
    const lastSaved = 1_000
    const now = lastSaved + OFFLINE_PROGRESS_CAP_MS * 2
    const state = makeState({
      lastSaved,
      money: 100,
      automation: {
        ...defaultGameState.automation,
        modules: {
          ...defaultGameState.automation.modules,
          [AutomationModuleId.CaseFarm]: {
            ...defaultGameState.automation.modules[AutomationModuleId.CaseFarm],
            isEnabled: true,
            lastRunTime: lastSaved,
            level: 1,
          },
        },
      },
    })
    const result = calculateOfflineProgress(state, now)
    const appliedState = result
      ? gameReducer(state, { type: 'APPLY_OFFLINE_PROGRESS', state: result.state })
      : undefined

    expect(result?.summary.wasCapped).toBe(true)
    expect(result?.summary.appliedDurationMs).toBe(OFFLINE_PROGRESS_CAP_MS)
    expect(result?.summary.skippedTasks).toContain('Offline progress is capped at 24 hours.')
    expect(appliedState?.money).toBe(result?.state.money)
    expect(appliedState?.lastSaved).toBe(now)
  })

  it('limits Trading Bot offline checks to prevent runaway contracts', () => {
    const lastSaved = 1_000
    const now = lastSaved + 4 * 60 * 60 * 1_000
    const state = makeState({
      lastSaved,
      inventory: Array.from({ length: 220 }, (_, index) => makeTradeUpItem(index)),
      marketValues: {
        ...defaultGameState.marketValues,
        galil_ar_blue_titanium: 100,
      },
      automation: {
        ...defaultGameState.automation,
        modules: {
          ...defaultGameState.automation.modules,
          [AutomationModuleId.TradingBot]: {
            ...defaultGameState.automation.modules[AutomationModuleId.TradingBot],
            isEnabled: true,
            lastRunTime: lastSaved,
            level: 5,
          },
        },
      },
    })
    const result = calculateOfflineProgress(state, now)

    expect(result?.summary.tradeUpsCompleted).toBe(OFFLINE_TRADING_BOT_MAX_RUNS)
    expect(result?.summary.skippedTasks).toContain(
      `Trading Bot is capped at ${OFFLINE_TRADING_BOT_MAX_RUNS} offline checks.`,
    )
    expect(result?.state.automation.modules[AutomationModuleId.TradingBot].totalRuns).toBe(
      OFFLINE_TRADING_BOT_MAX_RUNS,
    )
  })
})
