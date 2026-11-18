/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { defaultGameState, type GameState } from '../data/gameState'
import { GameContext, type GameContextValue } from './GameContext'
import { OnboardingTutorial } from './OnboardingTutorial'

afterEach(cleanup)

function makeState(overrides: Partial<GameState> = {}): GameState {
  const { statistics, ui, ...rest } = overrides
  return {
    ...defaultGameState,
    ...rest,
    statistics: { ...defaultGameState.statistics, ...statistics },
    ui: {
      ...defaultGameState.ui,
      ...ui,
      notifications: { ...defaultGameState.ui.notifications, ...ui?.notifications },
      onboarding: { ...defaultGameState.ui.onboarding, ...ui?.onboarding },
      tradeUpHistory: ui?.tradeUpHistory ?? defaultGameState.ui.tradeUpHistory,
    },
  }
}

function renderTutorial(stateOverrides: Partial<GameState> = {}, path = '/') {
  const updateOnboardingState = vi.fn()
  const value = { state: makeState(stateOverrides), updateOnboardingState } as unknown as GameContextValue
  render(<GameContext.Provider value={value}><MemoryRouter initialEntries={[path]}><div data-onboarding-target="nav-cases">Cases</div><OnboardingTutorial /></MemoryRouter></GameContext.Provider>)
  return { updateOnboardingState }
}

describe('OnboardingTutorial', () => {
  it('starts with a non-blocking welcome and can be skipped', () => {
    const { updateOnboardingState } = renderTutorial()
    expect(screen.getByTestId('onboarding-tutorial')).toHaveTextContent('Welcome to your CS2 trading career')
    fireEvent.click(screen.getByRole('button', { name: 'Skip beginner tutorial' }))
    expect(updateOnboardingState).toHaveBeenCalledWith({ isDismissed: true, isPaused: false, isReviewing: false })
  })

  it('persists progress and the opening baseline', () => {
    const { updateOnboardingState } = renderTutorial({ statistics: { ...defaultGameState.statistics, casesOpened: 4 } })
    fireEvent.click(screen.getByRole('button', { name: /Next/i }))
    expect(updateOnboardingState).toHaveBeenCalledWith(expect.objectContaining({ activeStepId: 'cases_nav', caseOpenBaseline: 4, completedStepIds: ['welcome'] }))
  })

  it('pauses and resumes without dismissing progress', () => {
    const { updateOnboardingState } = renderTutorial()
    fireEvent.click(screen.getByRole('button', { name: /Pause/i }))
    expect(updateOnboardingState).toHaveBeenCalledWith({ isPaused: true, isReviewing: false })
  })

  it('stays hidden after completion or dismissal', () => {
    renderTutorial({ ui: { ...defaultGameState.ui, onboarding: { ...defaultGameState.ui.onboarding, isDismissed: true } } })
    expect(screen.queryByTestId('onboarding-tutorial')).not.toBeInTheDocument()
  })

  it('shows and permanently dismisses a contextual guide', () => {
    const { updateOnboardingState } = renderTutorial({ ui: { ...defaultGameState.ui, onboarding: { ...defaultGameState.ui.onboarding, isDismissed: true } } }, '/career')
    expect(screen.getByText('Career & Upgrades')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Career & Upgrades' }))
    expect(updateOnboardingState).toHaveBeenCalledWith({ dismissedTipIds: ['career'] })
  })
})
