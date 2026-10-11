/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { GameProvider } from './GameProvider'
import { Main } from '../views/Main'
import { useGame } from '../hooks/useGame'
import { SAVE_STORAGE_KEY } from '../utils/save'

class MockAudio {
  currentTime = 0
  pause = vi.fn()
  play = vi.fn(() => Promise.resolve())
  preload = ''
  src: string
  volume = 1

  constructor(src: string) {
    this.src = src
  }
}

function installLocalStorage() {
  const store = new Map<string, string>()

  vi.stubGlobal('localStorage', {
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => store.delete(key),
    setItem: (key: string, value: string) => store.set(key, value),
  })
  vi.stubGlobal('Audio', MockAudio)
  window.localStorage.removeItem(SAVE_STORAGE_KEY)
}

function OpeningTestHarness() {
  const { availableCases, clearUiEvents, openCase, state, updateSettings } = useGame()
  const firstCase = availableCases[0]

  return (
    <div>
      <button onClick={() => firstCase && openCase(firstCase.id)} type="button">
        Open test case
      </button>
      <button onClick={clearUiEvents} type="button">
        Clear notifications
      </button>
      <button onClick={() => updateSettings({ animationsEnabled: false })} type="button">
        Disable animations
      </button>
      <output data-testid="opening-economy">
        {JSON.stringify({
          casesOpened: state.statistics.casesOpened,
          inventoryCount: state.inventory.length,
          money: state.money,
        })}
      </output>
    </div>
  )
}

describe('GameProvider opening session', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    installLocalStorage()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('keeps the case opening animation mounted during route changes and state ticks', () => {
    render(
      <GameProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Main />} />
              <Route path="inventory" element={<div>Inventory screen</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </GameProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /^Open 1$/i }))

    expect(screen.getByRole('dialog', { name: 'Case opening animation' })).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('link', { name: 'Inventory' })[0])

    expect(screen.getByText('Inventory screen')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Case opening animation' })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1_250)
    })

    expect(screen.getByTestId('case-opening-reel')).toHaveAttribute('data-phase', 'spinning')
  })

  it('keeps an active opening independent from transient notification events', () => {
    render(
      <GameProvider>
        <OpeningTestHarness />
      </GameProvider>,
    )

    const openButton = screen.getByRole('button', { name: 'Open test case' })

    fireEvent.click(openButton)
    fireEvent.click(openButton)

    expect(screen.getByRole('dialog', { name: 'Case opening animation' })).toBeInTheDocument()
    expect(screen.getByTestId('opening-economy')).toHaveTextContent(
      JSON.stringify({ casesOpened: 1, inventoryCount: 1, money: 99.8 }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Clear notifications' }))
    fireEvent.click(screen.getByRole('button', { name: 'Disable animations' }))

    expect(screen.getByRole('dialog', { name: 'Case opening animation' })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(8_000)
    })

    expect(screen.getByTestId('case-opening-reel')).toHaveAttribute('data-phase', 'revealed')
    expect(screen.getByTestId('opening-result')).toHaveTextContent('|')

    act(() => {
      vi.advanceTimersByTime(650)
    })

    expect(screen.queryByRole('dialog', { name: 'Case opening animation' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Disable animations' }))
    fireEvent.click(openButton)

    expect(screen.getByTestId('opening-economy')).toHaveTextContent(
      JSON.stringify({ casesOpened: 2, inventoryCount: 2, money: 99.6 }),
    )
  })
})
