import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultDropsByRarity, defaultGameState, type GameState } from './gameState'
import { gameReducer } from './gameReducer'

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...defaultGameState,
    inventory: [],
    collectionBook: [],
    recentDrops: [],
    lastOpenedItems: [],
    uiEvents: [],
    money: 100_000,
    casesUnlocked: ['starter_case', 'fracture_style_case'],
    statistics: {
      ...defaultGameState.statistics,
      dropsByRarity: { ...defaultDropsByRarity },
    },
    ...overrides,
  }
}

describe('case opening performance', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens a 100-case batch without blocking the reducer budget', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const state = makeState()
    const start = performance.now()
    const nextState = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case', quantity: 100 },
    })
    const duration = performance.now() - start

    expect(nextState.inventory).toHaveLength(100)
    expect(nextState.statistics.casesOpened).toBe(100)
    expect(duration).toBeLessThan(750)
  })

  it('handles a 1000-case stress batch without dropping count or going negative', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const state = makeState({ money: 100_000 })
    const start = performance.now()
    const nextState = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case', quantity: 1_000 },
    })
    const duration = performance.now() - start

    expect(nextState.inventory).toHaveLength(1_000)
    expect(nextState.statistics.casesOpened).toBe(1_000)
    expect(nextState.money).toBeGreaterThanOrEqual(0)
    expect(duration).toBeLessThan(4_000)
  })
})
