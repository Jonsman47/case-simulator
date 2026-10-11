/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameContext, type GameContextValue } from '../components/GameContext'
import { CASE_DEFINITIONS, getAvailableCases, getDropOdds } from '../data/cases'
import { defaultDropsByRarity, defaultGameState, type GameState } from '../data/gameState'
import { CaseStatus, Rarity, type CaseDefinition } from '../data/models'
import { CaseSelectionView } from './CaseSelectionView'

vi.mock('react-chartjs-2', () => ({
  Line: () => <div aria-label="Historical price chart" role="img" />,
  Pie: () => <div aria-label="Rarity distribution chart" role="img" />,
}))

afterEach(() => {
  cleanup()
})

function makeState(overrides: Partial<GameState> = {}): GameState {
  const { settings, statistics, ui, ...rest } = overrides

  return {
    ...defaultGameState,
    ...rest,
    settings: {
      ...defaultGameState.settings,
      ...settings,
    },
    statistics: {
      ...defaultGameState.statistics,
      ...statistics,
      dropsByRarity: {
        ...defaultDropsByRarity,
        ...statistics?.dropsByRarity,
      },
    },
    ui: {
      ...defaultGameState.ui,
      ...ui,
      inventory: {
        ...defaultGameState.ui.inventory,
        ...ui?.inventory,
      },
      onboarding: {
        ...defaultGameState.ui.onboarding,
        ...ui?.onboarding,
      },
    },
  }
}

function renderCaseSelection(
  stateOverrides: Partial<GameState> = {},
  caseDefinitions: CaseDefinition[] = CASE_DEFINITIONS,
) {
  const state = makeState(stateOverrides)
  const openCase = vi.fn<(caseId: string, quantity?: number) => void>()
  const purchaseCaseLicense = vi.fn<(caseId: string) => void>()
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
    purchaseCaseLicense,
    toggleCaseFavorite: voidFn,
    openCase,
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
      <CaseSelectionView />
    </GameContext.Provider>,
  )

  return { openCase, purchaseCaseLicense }
}

describe('CaseSelectionView', () => {
  it('keeps locked cases disabled and does not dispatch an open action', () => {
    const { openCase } = renderCaseSelection({
      casesUnlocked: ['starter_case', 'fracture_style_case'],
      statistics: {
        ...defaultGameState.statistics,
        casesOpened: 0,
      },
    })

    fireEvent.click(screen.getByRole('button', { name: /^Locked$/ }))

    const openOneButton = screen.getByRole('button', { name: /^Open 1$/i })

    expect(openOneButton).toBeDisabled()
    fireEvent.click(openOneButton)
    expect(openCase).not.toHaveBeenCalled()
  }, 15_000)

  it('passes the selected case id and quantity when opening', () => {
    const { openCase } = renderCaseSelection()

    fireEvent.click(screen.getByRole('button', { name: /Fracture-style Case/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Open 10$/i }))

    expect(openCase).toHaveBeenCalledWith('fracture_style_case', 10, { skipAnimations: false })
  }, 15_000)

  it('shows live per-case rarity odds with one-in chance labels', () => {
    renderCaseSelection()

    expect(screen.getByText('Live Case Odds')).toBeInTheDocument()
    expect(screen.queryByText('Official Rarity Odds')).not.toBeInTheDocument()
    expect(screen.getAllByText(/1 in \d/i).length).toBeGreaterThan(0)
  }, 15_000)

  it('prompts for a license instead of opening locked licensed cases', () => {
    const licensedCase: CaseDefinition = {
      id: 'licensed_case',
      name: 'Licensed Case',
      cost: 5,
      caseLicenseCost: 100,
      status: CaseStatus.Locked,
      image: '/assets/placeholder.png',
      dropTable: [
        { skinId: 'p250_sand_dune', weight: 100 },
        { skinId: 'karambit_doppler', weight: 0.1 },
      ],
    }
    const { openCase, purchaseCaseLicense } = renderCaseSelection(
      {
        money: 250,
        casesUnlocked: ['starter_case', 'fracture_style_case'],
        marketValues: {
          ...defaultGameState.marketValues,
          p250_sand_dune: 0.2,
          karambit_doppler: 700,
        },
        statistics: {
          ...defaultGameState.statistics,
          dropsByRarity: {
            ...defaultDropsByRarity,
            [Rarity.SpecialItem]: 0,
          },
        },
      },
      [CASE_DEFINITIONS[0], CASE_DEFINITIONS[1], licensedCase],
    )

    fireEvent.click(screen.getByRole('button', { name: /Licensed Case/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Open 1$/i }))

    expect(screen.getByText(/Buy Licensed Case license/i)).toBeInTheDocument()
    expect(openCase).not.toHaveBeenCalled()

    const buyButtons = screen.getAllByRole('button', { name: /^Buy License$/i })
    fireEvent.click(buyButtons[buyButtons.length - 1])

    expect(purchaseCaseLicense).toHaveBeenCalledWith('licensed_case')
    expect(openCase).not.toHaveBeenCalled()
  }, 15_000)
})
