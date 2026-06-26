/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GameContext, type GameContextValue } from './GameContext'
import { AppLayout } from './AppLayout'
import { defaultGameState } from '../data/gameState'

afterEach(() => {
  cleanup()
})

function renderLayout(initialPath = '/') {
  const contextValue = {
    state: defaultGameState,
    clearUiEvents: vi.fn(),
    cloud: {
      forceSync: vi.fn(async () => undefined),
      isConfigured: false,
      login: vi.fn(async () => undefined),
      logout: vi.fn(async () => undefined),
      metric: 'inventoryValue',
      requestPasswordReset: vi.fn(async () => undefined),
      session: null,
      setMetric: vi.fn(),
      signUp: vi.fn(async () => undefined),
      status: 'idle',
    },
  } as unknown as GameContextValue

  return render(
    <GameContext.Provider value={contextValue}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<div>Home screen</div>} />
            <Route path="cases" element={<div>Cases screen</div>} />
            <Route path="inventory" element={<div>Inventory screen</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </GameContext.Provider>,
  )
}

describe('AppLayout mobile gestures', () => {
  it('swipes between navigation sections without a drawer click', () => {
    renderLayout('/')

    expect(screen.getByText('Home screen')).toBeInTheDocument()

    fireEvent.touchStart(screen.getByRole('main'), {
      touches: [{ clientX: 320, clientY: 180 }],
    })
    fireEvent.touchEnd(screen.getByRole('main'), {
      changedTouches: [{ clientX: 160, clientY: 188 }],
    })

    expect(screen.getByText('Cases screen')).toBeInTheDocument()
  })
})
