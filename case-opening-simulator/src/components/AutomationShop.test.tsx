/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTOMATION_MODULE_DEFINITIONS, AUTOMATION_MODULE_IDS } from '../utils/automation'
import { defaultGameState } from '../data/gameState'
import { GameContext, type GameContextValue } from './GameContext'
import { AutomationShop } from './AutomationShop'

describe('AutomationShop', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders full module descriptions without clamping them', () => {
    const contextValue = {
      purchaseAutomationModule: vi.fn(),
      state: defaultGameState,
      toggleAutomationModule: vi.fn(),
    } as unknown as GameContextValue

    render(
      <GameContext.Provider value={contextValue}>
        <AutomationShop />
      </GameContext.Provider>,
    )

    for (const moduleId of AUTOMATION_MODULE_IDS) {
      const description = AUTOMATION_MODULE_DEFINITIONS[moduleId].description
      const descriptionElement = screen.getByText(description)

      expect(descriptionElement).toBeVisible()
      expect(descriptionElement).not.toHaveClass('line-clamp-2')
    }
  })
})
