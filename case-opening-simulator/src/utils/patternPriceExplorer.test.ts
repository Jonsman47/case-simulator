import { describe, expect, it } from 'vitest'
import { Rarity, WearCondition, type SkinBase } from '../data/models'
import { createPatternPriceRows, isPaintKitVariant, isSeedPriceRelevant } from './patternPriceExplorer'

function makeSkin(overrides: Partial<SkinBase> = {}): SkinBase {
  return { baseValue: 100, caseIds: [], finish: 'Case Hardened', id: 'ak-ch', image: '', rarity: Rarity.Classified, weapon: 'AK-47', ...overrides }
}

describe('pattern price explorer', () => {
  it('builds all 0–1000 Pattern IDs and keeps ordinary patterns near base price', () => {
    const rows = createPatternPriceRows({ edition: 'normal', skin: makeSkin(), wear: WearCondition.FieldTested })
    expect(rows).toHaveLength(1001)
    expect(rows[661]).toMatchObject({ seed: 661, confidence: 'simulator-estimate' })
    expect(rows[661].estimatedValue).toBeGreaterThan(rows[123].estimatedValue)
    expect(rows[123].premiumPercent).toBe(0)
  })

  it('distinguishes seed-priced finishes from paint-kit phases', () => {
    expect(isSeedPriceRelevant(makeSkin({ finish: 'Fade' }))).toBe(true)
    expect(isPaintKitVariant(makeSkin({ finish: 'Doppler', paintIndex: 416 }))).toBe(true)
    expect(isSeedPriceRelevant(makeSkin({ finish: 'Doppler', paintIndex: 416 }))).toBe(false)
  })
})
