/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReducer } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { GameContext, type GameContextValue } from './GameContext'
import { ToastNotifications } from './ToastNotifications'
import { defaultGameState, type GameUiEvent } from '../data/gameState'
import { gameReducer } from '../data/gameReducer'
import { getToastLifetime, selectVisibleToasts } from '../notifications/toastPolicy'

const events: GameUiEvent[] = Array.from({ length: 4 }, (_, index) => ({
  id: `event-${index + 1}`, type: 'game_event_ended' as const, eventId: `game-${index + 1}`, name: `Event ${index + 1}`, createdAt: index + 1,
}))

function Harness({ initialEvents = events }: { initialEvents?: GameUiEvent[] }) {
  const [state, dispatch] = useReducer(gameReducer, {
    ...defaultGameState,
    uiEvents: initialEvents,
    ui: { ...defaultGameState.ui, onboarding: { ...defaultGameState.ui.onboarding, isDismissed: true } },
  })
  return <GameContext.Provider value={{ state, dispatch } as GameContextValue}><MemoryRouter><ToastNotifications /></MemoryRouter></GameContext.Provider>
}

describe('toast notification presentation', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it('dismisses only one event and brings in the queued fourth', () => {
    render(<Harness />)
    expect(screen.getAllByRole('status')).toHaveLength(3)
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss game event ended notification' })[1])
    expect(screen.getByText('Event 1')).toBeInTheDocument()
    expect(screen.queryByText('Event 2')).not.toBeInTheDocument()
    expect(screen.getByText('Event 3')).toBeInTheDocument()
    expect(screen.getByText('Event 4')).toBeInTheDocument()
  })

  it('expires routine toasts independently and keeps critical failures', () => {
    const failure: GameUiEvent = { id: 'failure', type: 'trade_up_failed', message: 'Inputs changed.', createdAt: 5 }
    render(<Harness initialEvents={[...events.slice(0, 2), failure]} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Inputs changed.')
    act(() => vi.advanceTimersByTime(4_100))
    expect(screen.queryByText('Event 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Event 2')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Inputs changed.')
  })

  it('does not let earlier timers expire a newly admitted queued toast', () => {
    render(<Harness />)
    act(() => vi.advanceTimersByTime(1_000))
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss game event ended notification' })[1])
    expect(screen.getByText('Event 4')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(3_100))
    expect(screen.queryByText('Event 1')).not.toBeInTheDocument()
    expect(screen.getByText('Event 4')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.queryByText('Event 4')).not.toBeInTheDocument()
  })

  it('bounds the noncritical queue and keeps critical alerts while blocked', () => {
    const failure: GameUiEvent = { id: 'failure', type: 'case_opening_failed', caseId: 'starter', message: 'No space.', createdAt: 5 }
    expect(selectVisibleToasts([...events, failure], false)).toHaveLength(4)
    expect(selectVisibleToasts([...events, failure], true)).toEqual([failure])
    expect(getToastLifetime(failure)).toBeUndefined()
  })
})
