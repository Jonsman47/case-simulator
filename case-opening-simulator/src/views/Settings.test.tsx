/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { GameContext, type GameContextValue } from '../components/GameContext'
import { MarketEventBanner } from '../components/MarketEventBanner'
import { RecentDropsFeed } from '../components/RecentDropsFeed'
import { CASE_DEFINITIONS, getAvailableCases, getDropOdds } from '../data/cases'
import { defaultDropsByRarity, defaultGameState, type GameSettings, type GameState } from '../data/gameState'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
import { eventManager } from '../events/eventManager'
import { SAVE_STORAGE_KEY, serializeGameState } from '../utils/save'
import { POOP_CLEANUP_LAST_COMPLETED_KEY } from '../utils/poopCleanupMinigame'
import { Settings } from './Settings'

type SettingsOverrides = Omit<Partial<GameSettings>, 'rarityColors'> & {
  rarityColors?: Partial<GameSettings['rarityColors']>
}
type StateOverrides = Omit<Partial<GameState>, 'settings' | 'statistics'> & {
  settings?: SettingsOverrides
  statistics?: Partial<GameState['statistics']>
}

afterEach(() => {
  cleanup()
  window.localStorage.removeItem(SAVE_STORAGE_KEY)
  window.localStorage.removeItem(POOP_CLEANUP_LAST_COMPLETED_KEY)
  vi.restoreAllMocks()
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
    isFavorited: false,
    discoveredAt: 1_782_147_600_000,
    ...overrides,
  }
}

function makeState(overrides: StateOverrides = {}): GameState {
  const { settings, statistics, ...rest } = overrides

  return {
    ...defaultGameState,
    ...rest,
    settings: {
      ...defaultGameState.settings,
      ...settings,
      rarityColors: {
        ...defaultGameState.settings.rarityColors,
        ...settings?.rarityColors,
      },
    },
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

function createGameValue(
  stateOverrides: StateOverrides = {},
  overrides: Partial<GameContextValue> = {},
): GameContextValue {
  const state = makeState(stateOverrides)
  const caseDefinitions = CASE_DEFINITIONS
  const voidFn = vi.fn(() => undefined)
  const asyncVoidFn = vi.fn(async () => undefined)

  return {
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
    ...overrides,
  }
}

function renderWithGame(value: GameContextValue, children: ReactNode) {
  return render(
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>,
  )
}

describe('Settings', () => {
  it('updates validated public profile and trophy privacy controls', async () => {
    const value = createGameValue()
    const updateProfile = vi.fn(async () => undefined)

    value.cloud = {
      ...value.cloud,
      profile: {
        avatarKey: 'crosshair',
        createdAt: 1,
        displayName: 'CaseAce',
        isProfilePublic: false,
        isTrophyShowcasePublic: false,
        updatedAt: 1,
        userId: 'user-1',
      },
      session: { accessToken: 'test', user: { email: 'hidden@example.com', id: 'user-1', username: 'CaseAce' } },
      updateProfile,
    }

    renderWithGame(value, <Settings />)

    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Pattern Ace' } })
    fireEvent.click(screen.getByLabelText('Show my summary on profiles and leaderboards'))
    fireEvent.click(screen.getByLabelText('Share selected Trophy Room items'))
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(updateProfile).toHaveBeenCalledWith({
      avatarKey: 'crosshair',
      displayName: 'Pattern Ace',
      isProfilePublic: true,
      isTrophyShowcasePublic: true,
    })
  })

  it('shows divergent cloud versions and resolves only the explicit player choice', () => {
    const value = createGameValue()
    const resolveConflict = vi.fn(async () => undefined)
    const localState = makeState({ inventory: [makeItem()], money: 150 })
    const remoteState = makeState({ inventory: [], money: 400 })

    value.cloud = {
      ...value.cloud,
      conflict: {
        localState,
        remoteRecord: { envelope: JSON.parse(serializeGameState(remoteState)), revision: 2, updatedAt: 2 },
        remoteState,
      },
      resolveConflict,
      session: { accessToken: 'test', user: { email: 'hidden@example.com', id: 'user-1', username: 'CaseAce' } },
      status: 'conflict',
    }

    renderWithGame(value, <Settings />)

    expect(screen.getByText('Cloud conflict needs your choice')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Use cloud version' }))
    expect(resolveConflict).toHaveBeenCalledWith('use-cloud')
  })

  it('dispatches preference changes immediately from controls', () => {
    const updateSettings = vi.fn()
    const value = createGameValue({}, { updateSettings })

    renderWithGame(value, <Settings />)

    fireEvent.click(screen.getByLabelText('Sound Effects'))
    expect(updateSettings).toHaveBeenCalledWith({ soundEnabled: false })

    fireEvent.click(screen.getByLabelText('Autosave'))
    expect(updateSettings).toHaveBeenCalledWith({ autosaveEnabled: false })

    fireEvent.click(screen.getByLabelText('Weekly Backup Prompt'))
    expect(updateSettings).toHaveBeenCalledWith({ backupPromptEnabled: false })

    fireEvent.change(screen.getByLabelText('Sound Volume'), {
      target: { value: '0.45' },
    })
    expect(updateSettings).toHaveBeenCalledWith({ soundVolume: 0.45 })

    fireEvent.click(screen.getByRole('button', { name: 'Light' }))
    expect(updateSettings).toHaveBeenCalledWith({ theme: 'light' })

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(updateSettings).toHaveBeenCalledWith({ animationSpeed: 'skip' })

    fireEvent.change(screen.getByLabelText('Covert colour'), {
      target: { value: '#123456' },
    })
    expect(updateSettings).toHaveBeenCalledWith({
      rarityColors: {
        ...defaultGameState.settings.rarityColors,
        [Rarity.Covert]: '#123456',
      },
    })

    fireEvent.change(screen.getByDisplayValue('English'), {
      target: { value: 'cs' },
    })
    expect(updateSettings).toHaveBeenCalledWith({ language: 'cs' })
  })

  it('applies theme, large text, simplified animation and rarity colours in the layout', () => {
    const value = createGameValue({
      settings: {
        theme: 'light',
        largeText: true,
        simplifiedAnimations: true,
        rarityColors: {
          [Rarity.Covert]: '#010203',
        },
      },
    })

    render(
      <GameContext.Provider value={value}>
        <MemoryRouter initialEntries={['/settings']}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </GameContext.Provider>,
    )

    const appShell = screen.getAllByText('Case Opening Simulator')[0]?.closest('[data-theme]')

    expect(appShell).toHaveAttribute('data-theme', 'light')
    expect(appShell).toHaveClass('text-lg')
    expect(appShell).toHaveClass('simplified-motion')
    expect(appShell).toHaveStyle({ '--rarity-covert': '1 2 3' })
  })

  it('hides market banners when disabled', () => {
    const activeEvent = eventManager.createEvent({
      now: 1_782_147_600_000,
      prng: () => 0.2,
      type: 'MarketBoom',
    })
    const value = createGameValue({
      activeEvents: [activeEvent],
      settings: {
        marketEventBannersEnabled: false,
      },
    })

    renderWithGame(value, <MarketEventBanner />)

    expect(screen.queryByText('Market Boom')).not.toBeInTheDocument()
  })

  it('can disable highlighted recent drop feed animation', () => {
    const item = makeItem()

    render(
      <RecentDropsFeed
        animateHighlights={false}
        drops={[item]}
        inventory={[item]}
        marketValues={{ [item.id]: 40 }}
        onOpenItem={vi.fn()}
      />,
    )

    expect(screen.getByText('AK-47 | Redline').closest('article')).not.toHaveClass('animate-pulse')
  })

  it('requires confirmation before import replaces a save while automation is running', async () => {
    const importedState = makeState({ money: 99 })
    const replaceGameState = vi.fn()
    const value = createGameValue({
      automation: {
        ...defaultGameState.automation,
        autoOpener: {
          ...defaultGameState.automation.autoOpener,
          caseId: 'starter_case',
          isEnabled: true,
          level: 1,
        },
      },
    }, { replaceGameState })

    const { container } = renderWithGame(value, <Settings />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File([serializeGameState(importedState)], 'save.json', {
      type: 'application/json',
    })

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByRole('dialog')).toHaveTextContent('Confirm Import')
    expect(replaceGameState).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Replace Save' }))

    expect(replaceGameState).toHaveBeenCalledWith(expect.objectContaining({ money: 99 }))
  })

  it('resets progress after confirmation and clears local save data', () => {
    const resetGame = vi.fn()
    const value = createGameValue({ money: 12 }, { resetGame })

    window.localStorage.setItem(SAVE_STORAGE_KEY, 'saved-game')
    window.localStorage.setItem(POOP_CLEANUP_LAST_COMPLETED_KEY, '123')

    renderWithGame(value, <Settings />)

    fireEvent.click(screen.getByRole('button', { name: /reset progress/i }))

    const dialog = screen.getByRole('dialog')

    expect(dialog).toHaveTextContent('Reset Progress?')
    expect(resetGame).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset Progress' }))

    expect(resetGame).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem(POOP_CLEANUP_LAST_COMPLETED_KEY)).toBeNull()
    expect(screen.getByText('Progress reset. New run started.')).toBeInTheDocument()
  })
})
