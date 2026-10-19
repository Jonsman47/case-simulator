/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChartData } from 'chart.js'
import { GameContext, type GameContextValue } from '../components/GameContext'
import { CASE_DEFINITIONS, getAvailableCases, getDropOdds } from '../data/cases'
import { defaultDropsByRarity, defaultGameState, type GameState } from '../data/gameState'
import { Rarity, WearCondition } from '../data/models'
import { StatsView } from './StatsView'

vi.mock('react-chartjs-2', () => ({
  Bar: ({ data, ...props }: { data: ChartData<'bar'>; 'aria-label': string }) => (
    <div
      aria-label={props['aria-label']}
      data-labels={JSON.stringify(data.labels)}
      data-values={JSON.stringify(data.datasets[0].data)}
      role="img"
    />
  ),
  Line: ({ data, ...props }: { data: ChartData<'line'>; 'aria-label': string }) => (
    <div
      aria-label={props['aria-label']}
      data-labels={JSON.stringify(data.labels)}
      data-values={JSON.stringify(data.datasets[0].data)}
      role="img"
    />
  ),
  Pie: ({ data, ...props }: { data: ChartData<'pie'>; 'aria-label': string }) => (
    <div
      aria-label={props['aria-label']}
      data-labels={JSON.stringify(data.labels)}
      data-values={JSON.stringify(data.datasets[0].data)}
      role="img"
    />
  ),
}))

const now = Date.UTC(2026, 5, 23, 12)

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function makeState(overrides: Partial<GameState> = {}): GameState {
  const { statistics, ...rest } = overrides

  return {
    ...defaultGameState,
    activeMarketEvents: [],
    collectionBook: [],
    inventory: [],
    inventoryValueHistory: [],
    marketEventHistory: [],
    marketHistory: {},
    recentDrops: [],
    uiEvents: [],
    upcomingMarketEvents: [],
    ...rest,
    statistics: {
      ...defaultGameState.statistics,
      ...statistics,
      dropsByRarity: {
        ...defaultDropsByRarity,
        ...statistics?.dropsByRarity,
      },
    },
  }
}

function renderStatsView(stateOverrides: Partial<GameState> = {}) {
  const state = makeState(stateOverrides)
  const caseDefinitions = CASE_DEFINITIONS
  const voidFn = vi.fn(() => undefined)
  const asyncVoidFn = vi.fn(async () => undefined)
  const value: GameContextValue = {
    state,
    caseDefinitions,
    availableCases: getAvailableCases(caseDefinitions),
    dispatch: vi.fn(),
    addMoney: voidFn,
    spendMoney: voidFn,
    addItem: voidFn,
    removeItem: voidFn,
    toggleItemLock: voidFn,
    toggleItemFavorite: voidFn,
    sellItem: voidFn,
    sellItems: voidFn,
    tradeUpItems: voidFn,
    claimAchievementReward: voidFn,
    claimDailyReward: voidFn,
    claimDailyChallenge: voidFn,
    rerollDailyChallenge: voidFn,
    refreshDailyRewards: voidFn,
    purchaseAutoOpener: voidFn,
    setAutoOpenerCase: voidFn,
    toggleAutoOpener: voidFn,
    purchaseAutomationModule: voidFn,
    purchaseAuctionDeal: voidFn,
    toggleAutomationModule: voidFn,
    purchaseUpgrade: voidFn,
    prestige: voidFn,
    purchasePrestigeBonus: voidFn,
    learnSkillNode: voidFn,
    triggerGameEvent: voidFn,
    tickEventsNow: voidFn,
    assignTrophyItem: voidFn,
    removeTrophyItem: voidFn,
    getSelectedItemsValue: vi.fn(() => 0),
    unlockCase: voidFn,
    purchaseCaseLicense: voidFn,
    toggleCaseFavorite: voidFn,
    openCase: voidFn,
    updateMarketValue: voidFn,
    tickMarketNow: voidFn,
    updateSettings: voidFn,
    addAutoSellRule: voidFn,
    updateAutoSellRule: voidFn,
    removeAutoSellRule: voidFn,
    reorderAutoSellRules: voidFn,
    updateInventoryViewState: voidFn,
    updateOnboardingState: voidFn,
    markBackupCreated: voidFn,
    replaceGameState: voidFn,
    getDropOddsForCase: (caseId) => getDropOdds(caseId),
    clearGameError: voidFn,
    clearUiEvents: voidFn,
    resetGame: voidFn,
    cloud: {
      forceSync: asyncVoidFn,
      getPublicProfile: vi.fn(async () => null),
      isConfigured: false,
      login: asyncVoidFn,
      logout: asyncVoidFn,
      metric: 'inventoryValue',
      profile: null,
      requestPasswordReset: asyncVoidFn,
      resolveConflict: asyncVoidFn,
      session: null,
      setMetric: voidFn,
      signUp: asyncVoidFn,
      status: 'idle',
      updateProfile: asyncVoidFn,
    },
  }

  render(
    <GameContext.Provider value={value}>
      <StatsView />
    </GameContext.Provider>,
  )
}

describe('StatsView', () => {
  it('renders aggregate stats and passes correct datasets to charts', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)

    renderStatsView({
      inventoryValue: 125,
      inventoryValueHistory: [
        { timestamp: now - 60_000, value: 100 },
        { timestamp: now, value: 125 },
      ],
      collectionBook: [
        {
          skinId: 'ak47_redline',
          foundWearConditions: [WearCondition.FieldTested],
          highestValue: 250,
          timesFound: 1,
          firstFoundAt: now - 30_000,
        },
      ],
      statistics: {
        ...defaultGameState.statistics,
        casesOpened: 3,
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

    expect(screen.getByText('Stats')).toBeInTheDocument()
    expect(screen.getByText('$10.00')).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'Drop rarity distribution chart' })).toHaveAttribute(
      'data-values',
      JSON.stringify([2, 0, 0, 0, 0, 1, 0, 0]),
    )
    expect(await screen.findByRole('img', { name: 'Money flow chart' })).toHaveAttribute(
      'data-values',
      JSON.stringify([20, 30, 10]),
    )
    expect(await screen.findByRole('img', { name: 'Stats inventory value chart' })).toHaveAttribute(
      'data-values',
      JSON.stringify([100, 125]),
    )
    expect(await screen.findByRole('img', { name: 'Drop rarity share chart' })).toHaveAttribute(
      'data-values',
      JSON.stringify([2, 1]),
    )
  }, 15_000)
})
