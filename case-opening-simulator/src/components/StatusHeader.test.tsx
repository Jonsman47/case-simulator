/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { defaultGameState } from '../data/gameState'
import { useGame } from '../hooks/useGame'
import { StatusHeader } from './StatusHeader'

vi.mock('../hooks/useGame', () => ({ useGame: vi.fn() }))

const mockedUseGame = vi.mocked(useGame)
function setHeaderState(money: number, xp: number) {
  mockedUseGame.mockReturnValue({
    state: { ...defaultGameState, money, career: { ...defaultGameState.career, currentRunXp: xp } },
    cloud: { status: 'idle', profile: undefined, session: undefined },
  } as unknown as ReturnType<typeof useGame>)
}

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('committed header feedback', () => {
  it('shows the actual wallet and Career XP deltas without showing a delta on initial render', () => {
    setHeaderState(100, 0)
    const view = render(<MemoryRouter><StatusHeader /></MemoryRouter>)
    expect(screen.queryByLabelText(/Cash change/)).not.toBeInTheDocument()
    setHeaderState(110, 15)
    view.rerender(<MemoryRouter><StatusHeader /></MemoryRouter>)
    expect(screen.getByLabelText('Cash change plus $10.00')).toBeInTheDocument()
    expect(screen.getByText(/\+15 XP/)).toBeInTheDocument()
  })
})
