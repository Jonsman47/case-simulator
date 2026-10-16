import { describe, expect, it } from 'vitest'
import { Rarity, type SkinBase } from '../data/models'
import {
  MAX_PATTERN_ADJUSTED_VALUE,
  applyPatternPremium,
  classifySkinPattern,
  generatePaintSeed,
  isExceptionalPattern,
  isSpecialPattern,
} from './skinPatterns'

function makeSkin(overrides: Partial<SkinBase> = {}): SkinBase {
  return {
    id: 'test-skin',
    weapon: 'AK-47',
    finish: 'Redline',
    rarity: Rarity.Classified,
    baseValue: 100,
    caseIds: ['test-case'],
    image: '/assets/placeholder.png',
    ...overrides,
  }
}

describe('skin paint patterns', () => {
  it('generates the complete inclusive paint-seed range without exceeding it', () => {
    expect(generatePaintSeed(() => 0)).toBe(0)
    expect(generatePaintSeed(() => 0.999999999999)).toBe(1000)

    const seeds = Array.from({ length: 1001 }, (_, index) => generatePaintSeed(() => (index + 0.25) / 1001))

    expect(Math.min(...seeds)).toBe(0)
    expect(Math.max(...seeds)).toBe(1000)
    expect(new Set(seeds).size).toBe(1001)
  })

  it('keeps pattern-independent finishes neutral', () => {
    const pattern = classifySkinPattern(makeSkin(), 661)

    expect(pattern).toMatchObject({ family: 'standard', premiumMultiplier: 1, tier: 'standard' })
  })

  it('classifies documented AK-47 and Five-SeveN Blue Gem seeds per weapon', () => {
    const ak661 = classifySkinPattern(makeSkin({ finish: 'Case Hardened' }), 661)
    const akNormal = classifySkinPattern(makeSkin({ finish: 'Case Hardened' }), 123)
    const fiveSeven278 = classifySkinPattern(makeSkin({ weapon: 'Five-SeveN', finish: 'Case Hardened' }), 278)

    expect(ak661).toMatchObject({ name: 'AK-47 Blue Gem · Pattern 661', tier: 'iconic' })
    expect(akNormal.premiumMultiplier).toBe(1)
    expect(fiveSeven278).toMatchObject({ name: 'Five-SeveN Blue Gem · Tier 1', tier: 'exceptional' })
    expect(isExceptionalPattern({ pattern: ak661 })).toBe(true)
  })

  it('does not treat seed 661 as a universal Blue Gem rule', () => {
    const bayonet = classifySkinPattern(makeSkin({ weapon: 'Bayonet', finish: 'Case Hardened' }), 661)

    expect(bayonet.name).not.toContain('AK-47')
    expect(bayonet.premiumMultiplier).toBeLessThan(100)
  })

  it('uses model-specific Fade transforms and paint-kit Doppler phases', () => {
    const glockFullFade = classifySkinPattern(makeSkin({ weapon: 'Glock-18', finish: 'Fade' }), 763)
    const karambitSameSeed = classifySkinPattern(makeSkin({ weapon: 'Karambit', finish: 'Fade' }), 763)
    const sapphire = classifySkinPattern(makeSkin({ weapon: 'Bayonet', finish: 'Doppler', paintIndex: 416 }), 0)
    const sapphireOtherSeed = classifySkinPattern(makeSkin({ weapon: 'Bayonet', finish: 'Doppler', paintIndex: 416 }), 1000)

    expect(glockFullFade.fadePercentage).toBe(100)
    expect(glockFullFade.name).toBe('Full Fade')
    expect(karambitSameSeed.fadePercentage).toBe(80)
    expect(sapphire).toMatchObject({ name: 'Doppler · Sapphire', phase: 'Sapphire', premiumMultiplier: 4 })
    expect(sapphireOtherSeed).toEqual(sapphire)
  })

  it('only premiums documented Karambit Marble Fade max patterns', () => {
    const max = classifySkinPattern(makeSkin({ weapon: 'Karambit', finish: 'Marble Fade' }), 412)
    const otherKnife = classifySkinPattern(makeSkin({ weapon: 'Bayonet', finish: 'Marble Fade' }), 412)

    expect(max).toMatchObject({ tier: 'iconic', premiumMultiplier: 6 })
    expect(otherKnife.premiumMultiplier).toBe(1)
  })

  it('prices normal seeds at base value and safely bounds exceptional premiums', () => {
    const normal = classifySkinPattern(makeSkin(), 500)
    const iconic = classifySkinPattern(makeSkin({ finish: 'Case Hardened' }), 661)

    expect(applyPatternPremium(100, normal)).toBe(100)
    expect(applyPatternPremium(100, iconic)).toBe(10_000)
    expect(applyPatternPremium(Number.POSITIVE_INFINITY, iconic)).toBe(0)
    expect(applyPatternPremium(1_000_000_000, iconic)).toBe(MAX_PATTERN_ADJUSTED_VALUE)
    expect(isSpecialPattern({ pattern: normal })).toBe(false)
    expect(isSpecialPattern({ pattern: iconic })).toBe(true)
  })
})
