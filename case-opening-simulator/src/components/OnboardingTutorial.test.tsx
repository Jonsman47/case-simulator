/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { defaultGameState, type GameState } from '../data/gameState'
import { GameContext, type GameContextValue } from './GameContext'
import { OnboardingTutorial } from './OnboardingTutorial'

afterEach(() => {
  cleanup()
})

function makeState(overrides: Partial<GameState> = {}): GameState {
  const { statistics, ui, ...rest } = overrides

  return {
    ...defaultGameState,
    ...rest,
    statistics: {
      ...defaultGameState.statistics,
      ...statistics,
    },
    ui: {
      ...defaultGameState.ui,
      ...ui,
      onboarding: {
        ...defaultGameState.ui.onboarding,
        ...ui?.onboarding,
      },
    },
  }
}

function renderTutorial(stateOverrides: Partial<GameState> = {}) {
  const updateOnboardingState = vi.fn()
  const value = {
    state: makeState(stateOverrides),
    updateOnboardingState,
  } as unknown as GameContextValue

  render(
    <GameContext.Provider value={value}>
      <MemoryRouter>
        <div data-onboarding-target="open-case-controls">Open controls</div>
        <OnboardingTutorial />
      </MemoryRouter>
    </GameContext.Provider>,
  )

  return { updateOnboardingState }
}

describe('OnboardingTutorial', () => {
  it('shows on first run until dismissed', () => {
    const { updateOnboardingState } = renderTutorial()

    expect(screen.getByTestId('onboarding-tutorial')).toBeInTheDocument()
    expect(screen.getByText('Open Your First Case')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }))

    expect(updateOnboardingState).toHaveBeenCalledWith({
      isDismissed: true,
      isReviewing: false,
    })
  })

  it('stays hidden after dismissal', () => {
    renderTutorial({
      ui: {
        ...defaultGameState.ui,
        onboarding: {
          ...defaultGameState.ui.onboarding,
          isDismissed: true,
        },
      },
    })

    expect(screen.queryByTestId('onboarding-tutorial')).not.toBeInTheDocument()
  })

  it('shows contextual tips after the tutorial is dismissed', () => {
    const { updateOnboardingState } = renderTutorial({
      statistics: {
        ...defaultGameState.statistics,
        drops: 1,
      },
      ui: {
        ...defaultGameState.ui,
        onboarding: {
          ...defaultGameState.ui.onboarding,
          isDismissed: true,
        },
      },
    })

    expect(screen.getByText('Collection Book Unlocked')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Collection Book Unlocked' }))

    expect(updateOnboardingState).toHaveBeenCalledWith({
      dismissedTipIds: ['collection_book_after_drop'],
    })
  })
})
