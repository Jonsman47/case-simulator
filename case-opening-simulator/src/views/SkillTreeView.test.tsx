/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameContext, type GameContextValue } from '../components/GameContext'
import { defaultGameState, type GameState } from '../data/gameState'
import { SkillNodeId } from '../data/models'
import { SkillTreeView } from './SkillTreeView'

afterEach(() => {
  cleanup()
})

function renderSkillTree(stateOverrides: Partial<GameState> = {}) {
  const learnSkillNode = vi.fn()
  const value = {
    state: {
      ...defaultGameState,
      ...stateOverrides,
    },
    learnSkillNode,
  } as unknown as GameContextValue

  render(
    <GameContext.Provider value={value}>
      <SkillTreeView />
    </GameContext.Provider>,
  )

  return { learnSkillNode }
}

describe('SkillTreeView', () => {
  it('shows only the next available level for a generated upgrade branch', () => {
    renderSkillTree({
      learnedSkillNodeIds: [SkillNodeId.SellSpecialist, SkillNodeId.BulkAutomation],
      skillPoints: 10,
    })

    expect(screen.getByText(/Showcase Logistics 1:/i)).toBeInTheDocument()
    expect(screen.queryByText(/Showcase Logistics 2:/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('Next Level').length).toBeGreaterThan(0)
  })

  it('advances a generated branch to the next tier after the current tier is learned', () => {
    renderSkillTree({
      learnedSkillNodeIds: [
        SkillNodeId.SellSpecialist,
        SkillNodeId.BulkAutomation,
        'inventory_1' as SkillNodeId,
      ],
      skillPoints: 10,
    })

    expect(screen.queryByText(/Showcase Logistics 1:/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Showcase Logistics 2:/i)).toBeInTheDocument()
    expect(screen.queryByText(/Showcase Logistics 3:/i)).not.toBeInTheDocument()
  })

  it('shows a max level message when every tier in a generated branch is learned', () => {
    renderSkillTree({
      learnedSkillNodeIds: [
        SkillNodeId.SellSpecialist,
        SkillNodeId.BulkAutomation,
        ...Array.from({ length: 10 }, (_, index) => `inventory_${index + 1}` as SkillNodeId),
      ],
      skillPoints: 10,
    })

    expect(screen.queryByText(/Showcase Logistics 10:/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('Max Level Reached').length).toBeGreaterThan(0)
  })
})
