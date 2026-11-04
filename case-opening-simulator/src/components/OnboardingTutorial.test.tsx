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

  it('persists next and back progress through the onboarding state', () => {
    const { updateOnboardingState } = renderTutorial()
    fireEvent.click(screen.getByRole('button', { name: /Next/i }))
    expect(updateOnboardingState).toHaveBeenCalledWith(expect.objectContaining({
      activeStepId: 'understand_drops',
      completedStepIds: ['open_case'],
      isDismissed: false,
    }))
  })

  it('finishes the final step without restarting the tutorial', () => {
    const { updateOnboardingState } = renderTutorial({
      ui: {
        ...defaultGameState.ui,
        onboarding: {
          ...defaultGameState.ui.onboarding,
          activeStepId: 'enable_auto_sell',
          completedStepIds: [
            'open_case',
            'understand_drops',
            'view_inventory',
            'sell_item',
            'check_market',
            'build_collection',
            'earn_and_upgrade',
          ],
        },
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }))

    expect(updateOnboardingState).toHaveBeenCalledWith(expect.objectContaining({
      activeStepId: 'enable_auto_sell',
      completedStepIds: expect.arrayContaining(['enable_auto_sell']),
      isDismissed: true,
      isReviewing: false,
    }))
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
