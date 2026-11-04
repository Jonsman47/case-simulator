/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameContext, type GameContextValue } from '../components/GameContext'
import { CASE_DEFINITIONS, getAvailableCases, getDropOdds } from '../data/cases'
import { defaultGameState, type GameState } from '../data/gameState'
import { SKIN_DEFINITIONS } from '../data/skins'
import { Market } from './Market'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function makeContextValue(state: GameState): GameContextValue {
  const voidFn = vi.fn(() => undefined)
  const asyncVoidFn = vi.fn(async () => undefined)

  return {
    state,
    caseDefinitions: CASE_DEFINITIONS,
    availableCases: getAvailableCases(CASE_DEFINITIONS),
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
    claimAllAchievementRewards: voidFn,
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
}

function renderMarket(stateOverrides: Partial<GameState> = {}) {
  const state = {
    ...defaultGameState,
    ...stateOverrides,
  }

  render(
    <GameContext.Provider value={makeContextValue(state)}>
      <Market />
    </GameContext.Provider>,
  )
}

describe('Market', () => {
  it('virtualizes listings and filters by search text', async () => {
    const targetSkin = SKIN_DEFINITIONS.find((skin) => skin.weapon && skin.finish) ?? SKIN_DEFINITIONS[0]

    renderMarket()

    expect(screen.getAllByTestId('market-row').length).toBeLessThanOrEqual(
      Math.min(SKIN_DEFINITIONS.length, 32),
    )

    fireEvent.change(screen.getByRole('searchbox', { name: /search market skins/i }), {
      target: { value: `${targetSkin.weapon} ${targetSkin.finish}` },
    })

    await waitFor(() => {
      expect(screen.getByText(`${targetSkin.weapon} | ${targetSkin.finish}`)).toBeInTheDocument()
    })
  })

  it('opens a detailed wear and pattern explorer without rendering 1,001 rows', async () => {
    const targetSkin = SKIN_DEFINITIONS.find((skin) => skin.finish === 'Case Hardened')
      ?? SKIN_DEFINITIONS.find((skin) => skin.finish === 'Fade')!
    renderMarket()
    fireEvent.change(screen.getByRole('searchbox', { name: /search market skins/i }), { target: { value: `${targetSkin.weapon} ${targetSkin.finish}` } })
    const skinLabel = await screen.findByText(`${targetSkin.weapon} | ${targetSkin.finish}`)
    fireEvent.click(skinLabel.closest('button')!)

    expect(screen.getByRole('dialog', { name: new RegExp(`${targetSkin.weapon} ${targetSkin.finish} price details`, 'i') })).toBeInTheDocument()
    expect(screen.getByText('Wear price table')).toBeInTheDocument()
    expect(screen.getByText('Pattern price explorer')).toBeInTheDocument()
    expect(screen.getByText('Top 10 patterns')).toBeInTheDocument()
    expect(screen.getAllByRole('row').length).toBeLessThan(40)
  })
})
