import { describe, expect, it } from 'vitest'
import {
  DELIVERY_OBSTACLES,
  calculateCircuitPerformance,
  calculateDeliveryPerformance,
  calculateMiningPerformance,
  calculateWarehousePerformance,
  canMineBlock,
  createCircuitPuzzle,
  generateMiningGrid,
  isCircuitSolved,
  moveDeliveryPosition,
  type CircuitPiece,
} from './workExpansion'

describe('Work expansion mechanics', () => {
  it('generates a deterministic mining grid with deeper rare ores and supported movement', () => {
    const first = generateMiningGrid(42)
    const second = generateMiningGrid(42)

    expect(first).toEqual(second)
    expect(first).toHaveLength(42)
    expect(first.every((block) => block.row >= 0 && block.row < 7 && block.hardness >= 1 && block.hardness <= 3)).toBe(true)
    expect(first.filter((block) => block.resource === 'diamond').every((block) => block.row >= 4)).toBe(true)
    expect(canMineBlock(first[0], new Set())).toBe(true)
    expect(canMineBlock(first[6], new Set())).toBe(false)
    expect(canMineBlock(first[6], new Set(['mine-0-0']))).toBe(true)
  })

  it('scores mining resources and depth without exceeding the reward cap', () => {
    expect(calculateMiningPerformance({}, 0)).toBe(0)
    expect(calculateMiningPerformance({ coal: 2, gold: 1 }, 4)).toBeGreaterThan(0.3)
    expect(calculateMiningPerformance({ diamond: 99 }, 99)).toBe(1)
  })

  it('applies bounded delivery movement and rewards efficient completed routes', () => {
    expect(moveDeliveryPosition({ row: 0, column: 0 }, 'up')).toEqual({ row: 0, column: 0 })
    expect(moveDeliveryPosition({ row: 0, column: 1 }, 'right', DELIVERY_OBSTACLES)).toEqual({ row: 0, column: 1 })
    expect(moveDeliveryPosition({ row: 0, column: 0 }, 'right')).toEqual({ row: 0, column: 1 })
    expect(calculateDeliveryPerformance(2, 12)).toBe(1)
    expect(calculateDeliveryPerformance(2, 22)).toBe(0.8)
    expect(calculateDeliveryPerformance(0, 0)).toBe(0.2)
  })

  it('scores Warehouse Rush from both completion and accuracy', () => {
    expect(calculateWarehousePerformance(10, 0)).toBe(1)
    expect(calculateWarehousePerformance(5, 5)).toBeCloseTo(0.5)
    expect(calculateWarehousePerformance(0, 10)).toBe(0)
  })

  it('creates deterministic unsolved circuit puzzles and recognizes a valid power path', () => {
    expect(createCircuitPuzzle(81)).toEqual(createCircuitPuzzle(81))
    expect(isCircuitSolved(createCircuitPuzzle(81))).toBe(false)

    const solvedPath: CircuitPiece[] = [
      { column: 0, id: 'start', rotation: 2, row: 0, type: 'corner' },
      { column: 0, id: 'down', rotation: 0, row: 1, type: 'corner' },
      { column: 1, id: 'middle-a', rotation: 0, row: 1, type: 'straight' },
      { column: 2, id: 'middle-b', rotation: 2, row: 1, type: 'corner' },
      { column: 2, id: 'up-sink', rotation: 0, row: 2, type: 'corner' },
      { column: 3, id: 'sink', rotation: 0, row: 2, type: 'straight' },
    ]
    expect(isCircuitSolved(solvedPath)).toBe(true)
    expect(calculateCircuitPerformance(8)).toBe(1)
    expect(calculateCircuitPerformance(24)).toBe(0)
  })
})
