/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameContext, type GameContextValue } from '../components/GameContext'
import { defaultGameState } from '../data/gameState'
import {
  POOP_CLEANUP_COOLDOWN_MS,
  POOP_CLEANUP_LAST_COMPLETED_KEY,
  POOP_CLEANUP_REWARD,
  readPoopCleanupLastCompleted,
} from '../utils/poopCleanupMinigame'
import { Main } from './Main'

function installLocalStorageMock() {
  const store = new Map<string, string>()

  Object.defineProperty(window, 'localStorage', {
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

function renderMain(dispatch = vi.fn()) {
  const contextValue = {
    assignTrophyItem: vi.fn(),
    availableCases: [],
    dispatch,
    openCase: vi.fn(),
    sellItem: vi.fn(),
    state: defaultGameState,
    toggleItemFavorite: vi.fn(),
    toggleItemLock: vi.fn(),
  } as unknown as GameContextValue

  render(
    <GameContext.Provider value={contextValue}>
      <Main />
    </GameContext.Provider>,
  )

  return { dispatch }
}

describe('Main side job minigame', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-26T12:00:00.000Z'))
    installLocalStorageMock()
    window.localStorage.removeItem(POOP_CLEANUP_LAST_COMPLETED_KEY)
  })

  afterEach(() => {
    cleanup()
    window.localStorage.removeItem(POOP_CLEANUP_LAST_COMPLETED_KEY)
    vi.useRealTimers()
  })

  it('greys out the side job while the hourly cooldown is active', () => {
    window.localStorage.setItem(POOP_CLEANUP_LAST_COMPLETED_KEY, String(Date.now()))

    renderMain()

    const button = screen.getByRole('button', { name: /cooldown 60:00/i })

    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Available in 60:00')
  })

  it('completes after three piles, awards money, and stores the cooldown timestamp', () => {
    window.localStorage.setItem(
      POOP_CLEANUP_LAST_COMPLETED_KEY,
      String(Date.now() - POOP_CLEANUP_COOLDOWN_MS - 1),
    )
    const { dispatch } = renderMain()

    fireEvent.click(screen.getByRole('button', { name: 'Start Job' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clean pile 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clean pile 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clean pile 3' }))

    act(() => {
      vi.advanceTimersByTime(220)
    })

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      reward: POOP_CLEANUP_REWARD,
      type: 'COMPLETE_POOP_CLEANUP_MINIGAME',
    }))
    expect(readPoopCleanupLastCompleted()).toBeGreaterThan(0)
    expect(screen.queryByRole('dialog', { name: /a clean pooping job minigame/i })).not.toBeInTheDocument()
  })
})
