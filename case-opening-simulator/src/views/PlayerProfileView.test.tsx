/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { GameProvider } from '../components/GameProvider'
import { defaultGameState } from '../data/gameState'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
import { saveGame } from '../utils/save'
import { PlayerProfileView } from './PlayerProfileView'

const trophy: SkinInstance = {
  baseValue: 100,
  caseIds: ['test-case'],
  discoveredAt: 100,
  finish: 'Case Hardened',
  floatValue: 0.1,
  id: 'ak_case_hardened',
  image: '/assets/placeholder.png',
  instanceId: 'profile-trophy',
  isFavorited: false,
  isLocked: true,
  marketValue: 10_000,
  paintSeed: 661,
  pattern: {
    family: 'case_hardened',
    name: 'AK-47 Blue Gem · Pattern 661',
    premiumMultiplier: 100,
    referenceConfidence: 'estimated',
    tier: 'iconic',
  },
  rarity: Rarity.Classified,
  wear: WearCondition.MinimalWear,
  weapon: 'AK-47',
}

describe('PlayerProfileView', () => {
  beforeEach(() => {
    window.localStorage.clear()
    saveGame({
      ...defaultGameState,
      inventory: [trophy],
      inventoryValue: trophy.marketValue,
      lastSaved: Date.now(),
      trophyAssignments: {
        showcase_1: { assignedAt: 100, itemId: trophy.instanceId, slotId: 'showcase_1' },
      },
    })
  })

  it('renders a guest profile and selected seeded trophy without exposing account data', async () => {
    render(
      <MemoryRouter>
        <GameProvider>
          <PlayerProfileView />
        </GameProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Local Guest' })).toBeInTheDocument()
    expect(screen.getByText('AK-47 | Case Hardened')).toBeInTheDocument()
    expect(screen.getByText(/Pattern 661/i)).toBeInTheDocument()
    expect(screen.getByText(/catalog artwork represents the finish/i)).toBeInTheDocument()
  })
})
