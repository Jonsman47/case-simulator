import { describe, expect, it } from 'vitest'
import { getWorkBaseReward, getWorkMiniGameCooldownRemaining, normalizeWorkPerformance } from './workMinigames'

describe('work minigame economy', () => {
  it('clamps externally supplied performance before calculating rewards', () => {
    expect(normalizeWorkPerformance(-5)).toBe(0)
    expect(normalizeWorkPerformance(50)).toBe(1)
    expect(getWorkBaseReward('precisionStrike', -5)).toBeCloseTo(9.1)
    expect(getWorkBaseReward('precisionStrike', 50)).toBeCloseTo(18.9)
    expect(getWorkBaseReward('memoryCircuit', 0.5)).toBeCloseTo(18)
  })

  it('retains fixed rewards for legacy jobs', () => {
    expect(getWorkBaseReward('poopCleaning', 0)).toBe(10)
    expect(getWorkBaseReward('sortBoxes', 1)).toBe(20)
  })

  it('enforces each persistent cooldown', () => {
    const now = 10_000_000
    expect(getWorkMiniGameCooldownRemaining('precisionStrike', now, { precisionStrike: now })).toBe(8 * 60 * 1_000)
    expect(getWorkMiniGameCooldownRemaining('memoryCircuit', now + 15 * 60 * 1_000, { memoryCircuit: now })).toBe(0)
  })
})
