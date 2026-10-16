/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameContext, type GameContextValue } from '../components/GameContext'
import { CASE_DEFINITIONS, getAvailableCases, getDropOdds } from '../data/cases'
import { defaultDropsByRarity, defaultGameState, type GameState } from '../data/gameState'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
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
  const assignTrophyItem = vi.fn<(slotId: string, itemId: string) => void>()
  const removeTrophyItem = vi.fn<(slotId: string) => void>()
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
    <MemoryRouter>
      <GameContext.Provider value={value}>
        <TrophyRoomView />
      </GameContext.Provider>
    </MemoryRouter>,
  )

  return { assignTrophyItem, removeTrophyItem }
}

describe('TrophyRoomView', () => {
  it('starts with 12 free-choice showcase slots and assigns inventory items to the active slot', () => {
    const item = makeItem()
    const { assignTrophyItem } = renderTrophyRoom({ inventory: [item] })

    expect(screen.getByText('Filled Slots')).toBeInTheDocument()
    expect(screen.getByText('0/12')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Choose Skin' })).toHaveLength(12)

    fireEvent.click(screen.getByRole('button', { name: /AK-47 \| Redline/i }))

    expect(assignTrophyItem).toHaveBeenCalledWith('showcase_1', item.instanceId)
  })

  it('shows compact item details and warns when a trophy item is missing', () => {
    const item = makeItem({
      floatValue: 0.001,
      instanceId: 'missing-item',
      marketValue: 500,
      wear: WearCondition.FactoryNew,
    })
    const { removeTrophyItem } = renderTrophyRoom({
      inventory: [],
      trophyAssignments: {
        showcase_1: {
          slotId: 'showcase_1',
          itemId: item.instanceId,
          assignedAt: 1_782_147_600_000,
        },
      },
    })

    expect(screen.getAllByText('Showcase Slot 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Missing from inventory/i).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))

    expect(removeTrophyItem).toHaveBeenCalledWith('showcase_1')
  })

  it('replaces a filled slot with another owned skin', () => {
    const firstItem = makeItem({ instanceId: 'item-1', finish: 'Redline' })
    const secondItem = makeItem({ instanceId: 'item-2', finish: 'Asiimov', marketValue: 70 })
    const { assignTrophyItem } = renderTrophyRoom({
      inventory: [firstItem, secondItem],
      trophyAssignments: {
        showcase_1: {
          slotId: 'showcase_1',
          itemId: firstItem.instanceId,
          assignedAt: 1_782_147_600_000,
        },
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Replace' }))
    fireEvent.click(screen.getByRole('button', { name: /AK-47 \| Asiimov/i }))

    expect(assignTrophyItem).toHaveBeenCalledWith('showcase_1', secondItem.instanceId)
  })

  it('shows upgraded trophy room slots from the skill tree inventory branch', () => {
    renderTrophyRoom({ learnedSkillNodeIds: ['inventory_1'] as never })

    expect(screen.getByText('0/16')).toBeInTheDocument()
    expect(screen.getAllByText('Showcase Slot 16').length).toBeGreaterThan(0)
  })
})
