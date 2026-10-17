/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { GameContext, type GameContextValue } from '../components/GameContext'
import { defaultGameState, type GameState } from '../data/gameState'
import { POOP_CLEANUP_LAST_COMPLETED_KEY } from '../utils/poopCleanupMinigame'
import { WorkView } from './WorkView'

const sortColors = ['Red', 'Blue', 'Green', 'Yellow'] as const

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

function renderWork(stateOverrides: Partial<GameState> = {}, dispatch = vi.fn()) {
  const contextValue = {
    dispatch,
    state: {
      ...defaultGameState,
      ...stateOverrides,
    },
  } as unknown as GameContextValue

  render(
    <GameContext.Provider value={contextValue}>
      <WorkView />
    </GameContext.Provider>,
  )

  return { dispatch }
}

function createDataTransfer(value: string) {
  const data = new Map<string, string>()

  return {
    dropEffect: 'move',
    effectAllowed: 'move',
    getData: (type: string) => data.get(type) ?? value,
    setData: (type: string, nextValue: string) => data.set(type, nextValue),
  }
}

function startSortBoxes() {
  fireEvent.click(screen.getByRole('button', { name: 'Start Sort Boxes' }))
}

function dragBoxToContainer(boxName: string, containerName: string) {
  const box = screen.getByRole('button', { name: `${boxName} box` })
  const container = screen.getByRole('button', { name: `${containerName} container` })
  const dataTransfer = createDataTransfer(boxName.toLowerCase())

  fireEvent.dragStart(box, { dataTransfer })
  fireEvent.dragOver(container, { dataTransfer })
  fireEvent.drop(container, { dataTransfer })
}

describe('WorkView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-29T12:00:00.000Z'))
    installStorageMocks()
    window.localStorage.removeItem(POOP_CLEANUP_LAST_COMPLETED_KEY)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('shows the two rescue jobs and two skill-based jobs', () => {
    renderWork()

    expect(screen.getByText('Poop Cleaning')).toBeInTheDocument()
    expect(screen.getByText('Sort Boxes')).toBeInTheDocument()
    expect(screen.getByText('Precision Strike')).toBeInTheDocument()
    expect(screen.getByText('Memory Circuit')).toBeInTheDocument()
    expect(screen.queryByText('Clean The Floor')).not.toBeInTheDocument()
    expect(screen.queryByText('Wash Skins')).not.toBeInTheDocument()
    expect(screen.getByText('+$10')).toBeInTheDocument()
    expect(screen.getByText('+$20')).toBeInTheDocument()
    expect(screen.getByText('+$9.10–$18.90')).toBeInTheDocument()
    expect(screen.getByText('+$12.60–$23.40')).toBeInTheDocument()
  })

  it('keeps Poop Cleaning completing through the reducer once', async () => {
    const { dispatch } = renderWork()

    fireEvent.click(screen.getByRole('button', { name: 'Clean poop 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clean poop 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clean poop 3' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clean poop 3' }))

    await act(async () => undefined)

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMPLETE_WORK_MINIGAME',
      gameId: 'poopCleaning',
      now: Date.now(),
    })
    expect(screen.getByText('Yard cleared. +$10')).toBeInTheDocument()
  })

  it('randomizes Sort Boxes positions each time the job starts', () => {
    const randomSpy = vi.spyOn(Math, 'random')

    renderWork()

    randomSpy.mockImplementation(() => 0)
    startSortBoxes()

    const firstBoxPosition = screen.getByRole('button', { name: 'Red box' }).getAttribute('data-position-key')
    const firstContainerPosition = screen
      .getByRole('button', { name: 'Red container' })
      .getAttribute('data-position-key')

    fireEvent.click(screen.getByRole('button', { name: 'Close job' }))

    randomSpy.mockImplementation(() => 0.99)
    startSortBoxes()

    expect(screen.getByRole('button', { name: 'Red box' }).getAttribute('data-position-key')).not.toBe(
      firstBoxPosition,
    )
    expect(screen.getByRole('button', { name: 'Red container' }).getAttribute('data-position-key')).not.toBe(
      firstContainerPosition,
    )

    randomSpy.mockRestore()
  })

  it('resets wrong Sort Boxes drops, locks correct drops, and rewards exactly twenty dollars', async () => {
    const { dispatch } = renderWork()

    startSortBoxes()

    dragBoxToContainer('Red', 'Blue')

    expect(screen.getByText('Wrong bin — match the color label and try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Red box' })).toBeInTheDocument()

    for (const color of sortColors) {
      dragBoxToContainer(color, color)
    }

    await act(async () => undefined)

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMPLETE_WORK_MINIGAME',
      gameId: 'sortBoxes',
      now: Date.now(),
    })
    expect(screen.getByText('Sorted 4/4')).toBeInTheDocument()
    expect(screen.getByText('All four boxes sorted. +$20')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Red box' })).toHaveClass('pointer-events-none')
  })

  it('supports click selection as a safe Sort Boxes fallback', async () => {
    const { dispatch } = renderWork()

    startSortBoxes()

    for (const color of sortColors) {
      fireEvent.click(screen.getByRole('button', { name: `${color} box` }))
      fireEvent.click(screen.getByRole('button', { name: `${color} container` }))
    }

    await act(async () => undefined)

    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMPLETE_WORK_MINIGAME',
      gameId: 'sortBoxes',
      now: Date.now(),
    })
  })

  it('shows cooldown timers and disables unavailable jobs', () => {
    renderWork({
      workMiniGameCooldowns: {
        poopCleaning: Date.now(),
        sortBoxes: Date.now(),
        precisionStrike: Date.now(),
        memoryCircuit: Date.now(),
      },
    })

    expect(screen.getByText('3:00')).toBeInTheDocument()
    expect(screen.getByText('20:00')).toBeInTheDocument()
    expect(screen.getByText('8:00')).toBeInTheDocument()
    expect(screen.getByText('15:00')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Clean poop/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start Sort Boxes' })).not.toBeInTheDocument()
    expect(screen.queryByText('Clean The Floor')).not.toBeInTheDocument()
    expect(screen.queryByText('Wash Skins')).not.toBeInTheDocument()
  })

  it('closes Sort Boxes without leaving the page blocked', () => {
    renderWork()

    startSortBoxes()
    fireEvent.click(screen.getByRole('button', { name: 'Red box' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close job' }))

    expect(screen.getByRole('button', { name: 'Start Sort Boxes' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Red box' })).not.toBeInTheDocument()
  })

  it('cleans up timers when switching away from Work during Sort Boxes', () => {
    const contextValue = {
      dispatch: vi.fn(),
      state: defaultGameState,
    } as unknown as GameContextValue

    render(
      <GameContext.Provider value={contextValue}>
        <MemoryRouter initialEntries={['/work']}>
          <Link to="/inventory">Inventory</Link>
          <Routes>
            <Route path="/work" element={<WorkView />} />
            <Route path="/inventory" element={<button type="button">Inventory action</button>} />
          </Routes>
        </MemoryRouter>
      </GameContext.Provider>,
    )

    startSortBoxes()
    fireEvent.click(screen.getByRole('button', { name: 'Red box' }))
    fireEvent.click(screen.getByRole('link', { name: 'Inventory' }))
    fireEvent.click(screen.getByRole('button', { name: 'Inventory action' }))

    expect(screen.getByRole('button', { name: 'Inventory action' })).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('shows a friendly Sort Boxes error if reward dispatch fails', async () => {
    const dispatch = vi.fn(() => {
      throw new Error('dispatch failed')
    })

    renderWork({}, dispatch)
    startSortBoxes()

    for (const color of sortColors) {
      fireEvent.click(screen.getByRole('button', { name: `${color} box` }))
      fireEvent.click(screen.getByRole('button', { name: `${color} container` }))
    }

    await act(async () => undefined)

    expect(screen.getByText('Sort Boxes hit a problem. No reward or cooldown was applied.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clean poop 1' })).toBeInTheDocument()
  })

  it('starts both skill-based jobs with accessible controls', () => {
    renderWork()

    fireEvent.click(screen.getByRole('button', { name: 'Start Precision Strike' }))
    expect(screen.getByRole('button', { name: 'Stop precision marker' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Start Memory Circuit' }))
    expect(screen.getByRole('button', { name: /Memory pad 1/i })).toBeDisabled()
    expect(screen.getByText('Watch the sequence')).toBeInTheDocument()
  })
})
