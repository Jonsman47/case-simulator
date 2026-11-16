import { describe, expect, it } from 'vitest'
import { runEarlyGameScenario } from './earlyGameSimulation'

describe('early-game simulation model', () => {
  it('is deterministic and keeps funding bounded', () => {
    const first = runEarlyGameScenario('opening-first', 20, 42)
    const second = runEarlyGameScenario('opening-first', 20, 42)
    expect(first).toEqual(second)
    expect(first.checkpoints.every((row) => row.fundingEarned <= 7)).toBe(true)
    expect(first.checkpoints.every((row) => row.fundingSpent <= row.fundingEarned)).toBe(true)
  })
})
