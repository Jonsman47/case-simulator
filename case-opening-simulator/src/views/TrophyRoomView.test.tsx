/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameContext, type GameContextValue } from '../components/GameContext'
import { CASE_DEFINITIONS, getAvailableCases, getDropOdds } from '../data/cases'
import { defaultDropsByRarity, defaultGameState, type GameState } from '../data/gameState'
import { Rarity, TrophySlotId, WearCondition, type SkinInstance } from '../data/models'
import { TrophyRoomView } from './TrophyRoomView'

afterEach(() => {
  cleanup()
})

function makeItem(overrides: Partial<SkinInstance> = {}): SkinInstance {
  return {
    id: 'ak47_redline',
    weapon: 'AK-47',
    finish: 'Redline',
    rarity: Rarity.Classified,
    baseValue: 38,
    caseIds: ['starter_case'],
    image: '/assets/placeholder.png',
    instanceId: 'item-1',
    wear: WearCondition.FieldTested,
    floatValue: 0.2,
    marketValue: 32.5,
    isLocked: false,
    isFavorited: true,
    discoveredAt: 1_782_147_600_000,
    ...overrides,
  }
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  const { statistics, ...rest } = overrides

  return {
    ...defaultGameState,
    activeMarketEvents: [],
    collectionBook: [],
    inventory: [],
    marketEventHistory: [],
    recentDrops: [],
    trophyAssignments: {},
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

function renderTrophyRoom(stateOverrides: Partial<GameState> = {}) {
  const state = makeState(stateOverrides)
  const caseDefinitions = CASE_DEFINITIONS
  const voidFn = vi.fn(() => undefined)
  const asyncVoidFn = vi.fn(async () => undefined)
  const assignTrophyItem = vi.fn<(slotId: TrophySlotId, itemId: string) => void>()
  const removeTrophyItem = vi.fn<(slotId: TrophySlotId) => void>()
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
    toggleAutomationModule: voidFn,
    purchaseUpgrade: voidFn,
    prestige: voidFn,
    purchasePrestigeBonus: voidFn,
    learnSkillNode: voidFn,
    triggerGameEvent: voidFn,
    tickEventsNow: voidFn,
    assignTrophyItem,
    removeTrophyItem,
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
      isConfigured: false,
      login: asyncVoidFn,
      logout: asyncVoidFn,
      metric: 'inventoryValue',
      requestPasswordReset: asyncVoidFn,
      session: null,
      setMetric: voidFn,
      signUp: asyncVoidFn,
      status: 'idle',
    },
  }

  render(
    <GameContext.Provider value={value}>
      <TrophyRoomView />
    </GameContext.Provider>,
  )

  return { assignTrophyItem, removeTrophyItem }
}

describe('TrophyRoomView', () => {
  it('assigns inventory items to the active trophy slot', () => {
    const item = makeItem()
    const { assignTrophyItem } = renderTrophyRoom({ inventory: [item] })

    fireEvent.click(screen.getByRole('button', { name: /AK-47 \| Redline/i }))

    expect(assignTrophyItem).toHaveBeenCalledWith(TrophySlotId.MostExpensiveSkin, item.instanceId)
  })

  it('displays relevant slot stats and warns when a trophy item is missing', () => {
    const item = makeItem({
      floatValue: 0.001,
      instanceId: 'missing-item',
      marketValue: 500,
      wear: WearCondition.FactoryNew,
    })
    const { removeTrophyItem } = renderTrophyRoom({
      inventory: [],
      trophyAssignments: {
        [TrophySlotId.BestFloat]: {
          slotId: TrophySlotId.BestFloat,
          item,
          assignedAt: 1_782_147_600_000,
        },
      },
    })

    expect(screen.getAllByText('Best Float').length).toBeGreaterThan(0)
    expect(screen.getByText('0.001')).toBeInTheDocument()
    expect(screen.getAllByText(/No longer in inventory/i).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByLabelText('Remove Best Float'))

    expect(removeTrophyItem).toHaveBeenCalledWith(TrophySlotId.BestFloat)
  })
})
