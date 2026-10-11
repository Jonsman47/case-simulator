/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameContext, type GameContextValue } from '../components/GameContext'
import { defaultGameState, type GameState } from '../data/gameState'
import {
  POOP_CLEANUP_LAST_COMPLETED_KEY,
  readPoopCleanupLastCompleted,
} from '../utils/poopCleanupMinigame'
import { PoopCleaningView } from './PoopCleaningView'

function installStorageMocks() {
  const localStore = new Map<string, string>()

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => localStore.clear(),
      getItem: (key: string) => localStore.get(key) ?? null,
      removeItem: (key: string) => {
        localStore.delete(key)
      },
      setItem: (key: string, value: string) => {
        localStore.set(key, value)
      },
    },
  })
}

function renderPoopCleaning(stateOverrides: Partial<GameState> = {}, dispatch = vi.fn()) {
  const contextValue = {
    dispatch,
    state: {
      ...defaultGameState,
      ...stateOverrides,
    },
  } as unknown as GameContextValue

  render(
    <GameContext.Provider value={contextValue}>
      <PoopCleaningView />
    </GameContext.Provider>,
  )

  return { dispatch }
}

describe('PoopCleaningView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-28T12:00:00.000Z'))
    installStorageMocks()
    window.localStorage.removeItem(POOP_CLEANUP_LAST_COMPLETED_KEY)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('clicking all three poops dispatches exactly one ten-dollar reward and stores the cooldown', () => {
    const { dispatch } = renderPoopCleaning({ money: 0, lastPoopCleaningAt: 0 })

    fireEvent.click(screen.getByRole('button', { name: 'Clean poop 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clean poop 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clean poop 3' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clean poop 3' }))

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMPLETE_POOP_CLEANING',
      now: Date.now(),
    })
    expect(readPoopCleanupLastCompleted()).toBe(Date.now())
    expect(screen.getByText('Poop cleaned. +$10')).toBeInTheDocument()
  })

  it('shows cooldown copy and blocks cleaning while the three-minute cooldown is active', () => {
    renderPoopCleaning({ lastPoopCleaningAt: Date.now() - 61_000 })

    expect(screen.getByText('Come back in 1:59 to clean more poop.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /clean poop/i })).not.toBeInTheDocument()
  })
})
