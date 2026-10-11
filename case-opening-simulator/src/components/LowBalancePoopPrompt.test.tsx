/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { defaultGameState, type GameState } from '../data/gameState'
import { GameContext, type GameContextValue } from './GameContext'
import { LowBalancePoopPrompt } from './LowBalancePoopPrompt'

function installSessionStorageMock() {
  const store = new Map<string, string>()

  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: {
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      removeItem: (key: string) => {
        store.delete(key)
      },
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    },
  })
}

function renderPrompt(stateOverrides: Partial<GameState> = {}) {
  const contextValue = {
    state: {
      ...defaultGameState,
      ...stateOverrides,
    },
  } as unknown as GameContextValue

  render(
    <GameContext.Provider value={contextValue}>
      <MemoryRouter initialEntries={['/inventory']}>
        <LowBalancePoopPrompt />
        <Routes>
          <Route path="/inventory" element={<div>Inventory page</div>} />
          <Route path="/work" element={<div>Work page</div>} />
        </Routes>
      </MemoryRouter>
    </GameContext.Provider>,
  )
}

describe('LowBalancePoopPrompt', () => {
  beforeEach(() => {
    installSessionStorageMock()
  })

  afterEach(() => {
    cleanup()
  })

  it('appears under three dollars and navigates to Work', () => {
    renderPrompt({ money: 2.99 })

    expect(screen.getByText('Need money? Do some work.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Take me to Work' }))

    expect(screen.getByText('Work page')).toBeInTheDocument()
    expect(screen.queryByText('Need money? Do some work.')).not.toBeInTheDocument()
  })

  it('can be dismissed for the current low-balance session', () => {
    renderPrompt({ money: 1 })

    fireEvent.click(screen.getByRole('button', { name: 'Close low balance prompt' }))

    expect(screen.queryByText('Need money? Do some work.')).not.toBeInTheDocument()
  })
})
