import { describe, expect, it } from 'vitest'
import { getPrecisionHitResult, getWorkBaseReward } from './workMinigames'

describe('Precision Strike scoring', () => {
  it('rewards measured bullseye accuracy above ordinary perfect hits while respecting the cap', () => {
    expect(getPrecisionHitResult(0.4)).toMatchObject({ tier: 'bullseye', score: 1 })
    expect(getPrecisionHitResult(2)).toMatchObject({ tier: 'perfect', score: 0.88 })
    expect(getPrecisionHitResult(8)).toMatchObject({ tier: 'good', score: 0.62 })
    expect(getPrecisionHitResult(30).tier).toBe('miss')
    expect(getWorkBaseReward('precisionStrike', 1)).toBeCloseTo(18.9)
    expect(getWorkBaseReward('precisionStrike', 0.88)).toBeLessThan(18.9)
  })
})
