import { describe, expect, it } from 'vitest'
import { defaultDropsByRarity, defaultGameState, type GameState } from '../data/gameState'
import { AutomationModuleId, Rarity, WearCondition, type SkinInstance } from '../data/models'
import {
  buildInventoryValueLineChartData,
  buildMoneyFlowChartData,
  buildRarityDistributionChartData,
  buildStatsCsv,
  calculateStatsDashboardSummary,
  createStatsSessionBaseline,
  filterStatsHistoryByRange,
} from './statsDashboard'

const now = Date.UTC(2026, 5, 23, 12)
const hourMs = 60 * 60 * 1_000
const dayMs = 24 * hourMs

function makeItem(overrides: Partial<SkinInstance> = {}): SkinInstance {
  return {
    id: 'ak47_redline',
    weapon: 'AK-47',
    finish: 'Redline',
    rarity: Rarity.Classified,
    baseValue: 42.5,
    caseIds: ['legacy_rare_case'],
    image: '/assets/placeholder.png',
    instanceId: 'item-1',
    wear: WearCondition.FieldTested,
    floatValue: 0.2,
    marketValue: 32,
    isLocked: false,
    isFavorited: false,
    discoveredAt: now - 2 * dayMs,
    ...overrides,
  }
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...defaultGameState,
    activeMarketEvents: [],
    achievements: [],
    collectionBook: [],
    inventory: [],
    inventoryValueHistory: [],
    marketEventHistory: [],
    marketHistory: {},
    recentDrops: [],
    uiEvents: [],
    upcomingMarketEvents: [],
    statistics: {
      ...defaultGameState.statistics,
      dropsByRarity: { ...defaultDropsByRarity },
    },
    ...overrides,
  }
}

describe('stats dashboard utilities', () => {
  it('calculates aggregate metrics, classified-plus rare drops, milestones, and comparatives', () => {
    const state = makeState({
      money: 450,
      inventory: [makeItem()],
      inventoryValue: 260,
      inventoryValueHistory: [
        { timestamp: now - 3 * dayMs, value: 100 },
        { timestamp: now - 2 * hourMs, value: 260 },
      ],
      collectionBook: [
        {
          skinId: 'p250_sand_dune',
          foundWearConditions: [WearCondition.FactoryNew],
          highestValue: 0.03,
          timesFound: 1,
          firstFoundAt: now - 5 * dayMs,
        },
        {
          skinId: 'ak47_redline',
          foundWearConditions: [WearCondition.FieldTested],
          highestValue: 250,
          timesFound: 1,
          firstFoundAt: now - 4 * dayMs,
        },
      ],
      achievements: [
        { id: 'first_profit_case', isClaimed: false, unlockedAt: now - 3 * dayMs },
        { id: 'first_prestige', isClaimed: true, unlockedAt: now - dayMs },
      ],
      prestigeLevel: 1,
      casesUnlocked: ['starter_case', 'fracture_style_case', 'legacy_rare_case'],
      automation: {
        ...defaultGameState.automation,
        autoOpener: {
          ...defaultGameState.automation.autoOpener,
          level: 2,
        },
        modules: {
          ...defaultGameState.automation.modules,
          [AutomationModuleId.CaseFarm]: {
            ...defaultGameState.automation.modules[AutomationModuleId.CaseFarm],
            level: 3,
          },
          [AutomationModuleId.TradingBot]: {
            ...defaultGameState.automation.modules[AutomationModuleId.TradingBot],
            level: 1,
          },
        },
      },
      statistics: {
        ...defaultGameState.statistics,
        casesOpened: 120,
        drops: 120,
        moneyEarned: 95,
        moneySpent: 80,
        itemsSold: 12,
        tradeUpsCompleted: 2,
        dropsByRarity: {
          ...defaultDropsByRarity,
          [Rarity.Consumer]: 90,
          [Rarity.Industrial]: 20,
          [Rarity.Classified]: 3,
          [Rarity.Covert]: 2,
          [Rarity.SpecialItem]: 1,
        },
      },
    })
    const baseline = createStatsSessionBaseline(
      {
        ...state,
        inventoryValue: 200,
        statistics: {
          ...state.statistics,
          casesOpened: 115,
          moneyEarned: 90,
          moneySpent: 78,
        },
      },
      now - hourMs,
    )
    const summary = calculateStatsDashboardSummary({
      baseline,
      now,
      range: 'all',
      state,
    })

    expect(summary.totalCasesOpened).toBe(120)
    expect(summary.netProfit).toBe(15)
    expect(summary.rareDropsClassifiedPlus).toBe(6)
    expect(summary.highestItemValue).toBe(250)
    expect(summary.automationModulesPurchased).toBe(2)
    expect(summary.automationModuleLevels).toBe(4)
    expect(summary.comparatives.sessionCasesOpened).toBe(5)
    expect(summary.comparatives.sessionNet).toBe(3)
    expect(summary.comparatives.sessionValueChange).toBe(60)
    expect(summary.milestones.map((milestone) => milestone.id)).toContain('first_rare_drop')
    expect(summary.milestones.map((milestone) => milestone.id)).toContain('first_profit_case')
  })

  it('filters inventory value history by time range', () => {
    const history = [
      { timestamp: now - 8 * dayMs, value: 50 },
      { timestamp: now - 2 * dayMs, value: 70 },
      { timestamp: now - 3 * hourMs, value: 90 },
      { timestamp: now, value: 100 },
    ]

    expect(filterStatsHistoryByRange(history, '24h', now, now - hourMs)).toEqual([
      { timestamp: now - 3 * hourMs, value: 90 },
      { timestamp: now, value: 100 },
    ])
    expect(filterStatsHistoryByRange(history, '7d', now, now - hourMs)).toEqual([
      { timestamp: now - 2 * dayMs, value: 70 },
      { timestamp: now - 3 * hourMs, value: 90 },
      { timestamp: now, value: 100 },
    ])
  })

  it('builds chart datasets and CSV output from a summary', () => {
    const state = makeState({
      inventoryValueHistory: [
        { timestamp: now - hourMs, value: 100 },
        { timestamp: now, value: 125 },
      ],
      statistics: {
        ...defaultGameState.statistics,
        drops: 3,
        moneyEarned: 30,
        moneySpent: 20,
        dropsByRarity: {
          ...defaultDropsByRarity,
          [Rarity.Consumer]: 2,
          [Rarity.Covert]: 1,
        },
      },
    })
    const summary = calculateStatsDashboardSummary({
      baseline: createStatsSessionBaseline(state, now - hourMs),
      now,
      range: 'all',
      state,
    })

    expect(buildRarityDistributionChartData(summary).datasets[0].data).toEqual([
      2,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
    ])
    expect(buildMoneyFlowChartData(summary).datasets[0].data).toEqual([20, 30, 10])
    expect(buildInventoryValueLineChartData(summary.filteredInventoryValueHistory).datasets[0].data).toEqual([
      100,
      125,
    ])
    expect(buildStatsCsv(summary)).toContain('"total_cases_opened","0"')
    expect(buildStatsCsv(summary)).toContain('"drops_Covert","1"')
  })
})
