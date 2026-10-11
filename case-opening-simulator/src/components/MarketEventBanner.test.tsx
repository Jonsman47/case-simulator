/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { GameContext, type GameContextValue } from './GameContext'
import { MarketEventBanner } from './MarketEventBanner'
import { defaultGameState } from '../data/gameState'
import { eventManager } from '../events/eventManager'

function renderBanner() {
  const activeEvent = eventManager.createEvent({
    now: 1_782_147_600_000,
    prng: () => 0.2,
    type: 'MarketBoom',
  })
  const state = {
    ...defaultGameState,
    activeEvents: [activeEvent],
    settings: {
      ...defaultGameState.settings,
      marketEventBannersEnabled: true,
    },
  }
  const contextValue = {
    state,
    tickEventsNow: vi.fn(),
    triggerGameEvent: vi.fn(),
    cloud: {
      session: null,
    },
  } as unknown as GameContextValue

  render(
    <MemoryRouter>
      <GameContext.Provider value={contextValue}>
        <MarketEventBanner />
      </GameContext.Provider>
    </MemoryRouter>,
  )
}

describe('MarketEventBanner', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('can be dismissed for the current play session', () => {
    renderBanner()

    expect(screen.getByText('Market Boom')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss event popup' }))

    expect(screen.queryByText('Market Boom')).not.toBeInTheDocument()
  })
})
