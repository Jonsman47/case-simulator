/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameContext, type GameContextValue } from '../components/GameContext'
import { defaultGameState } from '../data/gameState'
import { UPGRADE_DEFINITIONS } from '../data/upgrades'
import { UpgradeShopView } from './UpgradeShopView'

describe('UpgradeShopView', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders full upgrade descriptions without clamping them', () => {
    const contextValue = {
      purchaseUpgrade: vi.fn(),
      state: defaultGameState,
    } as unknown as GameContextValue

    render(
      <GameContext.Provider value={contextValue}>
        <UpgradeShopView />
      </GameContext.Provider>,
    )

    for (const definition of UPGRADE_DEFINITIONS) {
      const descriptionElement = screen.getByText(definition.description)

      expect(descriptionElement).toBeVisible()
      expect(descriptionElement).not.toHaveClass('line-clamp-2')
    }
  })
})
