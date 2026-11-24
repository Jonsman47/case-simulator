/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { defaultGameState } from '../data/gameState'
import { GameContext, type GameContextValue } from '../components/GameContext'
import { HelpCenter } from './HelpCenter'

describe('HelpCenter', () => {
  it('searches current articles and replays the beginner tutorial', () => {
    const updateOnboardingState = vi.fn()
    render(<GameContext.Provider value={{ state: defaultGameState, updateOnboardingState } as unknown as GameContextValue}><MemoryRouter><HelpCenter /></MemoryRouter></GameContext.Provider>)
    expect(screen.getAllByRole('article')).toHaveLength(39)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'escrow' } })
    expect(screen.getByText('Buying, selling, fees and escrow')).toBeInTheDocument()
    expect(screen.queryByText('Real odds and negative expected value')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Replay beginner tutorial/i }))
    expect(updateOnboardingState).toHaveBeenCalledWith(expect.objectContaining({ activeStepId: 'welcome', completedStepIds: [], isDismissed: false }))
  })
})
