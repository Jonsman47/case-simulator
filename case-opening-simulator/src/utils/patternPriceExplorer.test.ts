import { describe, expect, it } from 'vitest'
import type { ImportedSkinDefinition } from '../data/importedAssetTypes'
import { Rarity, WearCondition, type SkinBase } from '../data/models'
import { SKIN_DEFINITIONS as GENERATED_SKIN_DEFINITIONS } from '../data/generated/skins.generated'
import { getRepresentativeSkinPrice, getSkinConditionPrice } from '../data/skinPrices'
import { createPatternPriceRows, getAvailablePatternEditions, getAvailableWearConditions, getSkinMarketPriceRange, isPaintKitVariant, isSeedPriceRelevant } from './patternPriceExplorer'

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

  it('uses only float-valid wear conditions', () => {
    const skin = makeSkin({
      wearRanges: {
        [WearCondition.FactoryNew]: { min: 0, max: 0.07 },
        [WearCondition.MinimalWear]: { min: 0.07, max: 0.08 },
      },
    } as Partial<SkinBase>)

    expect(getAvailableWearConditions(skin)).toEqual([
      WearCondition.FactoryNew,
      WearCondition.MinimalWear,
    ])
  })

  it('includes supported StatTrak and Souvenir editions without inventing unsupported editions', () => {
    const normal = makeSkin()
    const statTrak = { ...normal, hasStatTrak: true } as SkinBase & { hasStatTrak: boolean }
    const souvenir = { ...normal, hasSouvenir: true } as SkinBase & { hasSouvenir: boolean }

    expect(getAvailablePatternEditions(normal)).toEqual(['normal'])
    expect(getAvailablePatternEditions(statTrak)).toEqual(['normal', 'stattrak'])
    expect(getAvailablePatternEditions(souvenir)).toEqual(['normal', 'souvenir'])
  })

  it('finds the actual minimum and exceptional maximum while scaling both with the current market', () => {
    const skin = GENERATED_SKIN_DEFINITIONS.find((candidate) => candidate.weapon === 'AK-47' && candidate.finish === 'Case Hardened')!
    const representative = getRepresentativeSkinPrice(skin)
    const normalRange = getSkinMarketPriceRange(skin, representative)
    const doubledRange = getSkinMarketPriceRange(skin, representative * 2)

    expect(normalRange.maximum).toBeGreaterThan(normalRange.minimum * 10)
    expect(normalRange.maximumVariant.patternName).toMatch(/Blue Gem|Pattern 661/i)
    expect(normalRange.maximumVariant.confidence).toBe('simulator-estimate')
    expect(doubledRange.minimum).toBeCloseTo(normalRange.minimum * 2, 1)
    expect(doubledRange.maximum).toBeCloseTo(normalRange.maximum * 2, 1)
  })

  it('lets genuine edition prices participate in the range', () => {
    const skin = GENERATED_SKIN_DEFINITIONS.find((candidate) => {
      const imported = candidate as ImportedSkinDefinition
      return imported.hasStatTrak && !isSeedPriceRelevant(candidate) && !isPaintKitVariant(candidate)
        && getAvailableWearConditions(candidate).some((wear) => {
          const normal = getSkinConditionPrice(candidate, wear)
          const statTrak = getSkinConditionPrice(candidate, wear, true)
          return typeof normal === 'number' && typeof statTrak === 'number' && statTrak > normal
        })
    }) as ImportedSkinDefinition
    expect(skin).toBeDefined()

    const withEdition = getSkinMarketPriceRange(skin, getRepresentativeSkinPrice(skin))
    const normalOnlySkin: ImportedSkinDefinition = { ...skin, hasStatTrak: false }
    const normalOnly = getSkinMarketPriceRange(normalOnlySkin, getRepresentativeSkinPrice(skin))
    expect(withEdition.maximum).toBeGreaterThan(normalOnly.maximum)
    expect(withEdition.maximumVariant.edition).toBe('stattrak')

    const souvenirSkin = GENERATED_SKIN_DEFINITIONS.find((candidate) => candidate.id === 'skin-e73d6e7e9004')!
    const withSouvenir = getSkinMarketPriceRange(souvenirSkin, getRepresentativeSkinPrice(souvenirSkin))
    const noSouvenirSkin: ImportedSkinDefinition = { ...souvenirSkin, hasSouvenir: false }
    const withoutSouvenir = getSkinMarketPriceRange(noSouvenirSkin, getRepresentativeSkinPrice(souvenirSkin))
    expect(getAvailablePatternEditions(souvenirSkin)).toContain('souvenir')
    expect(withSouvenir.minimum).toBeLessThan(withoutSouvenir.minimum)
    expect(withSouvenir.minimumVariant.edition).toBe('souvenir')
  })

  it('keeps full-catalog range recalculation within the Market interaction budget', () => {
    const start = performance.now()
    const ranges = GENERATED_SKIN_DEFINITIONS.map((skin) => getSkinMarketPriceRange(skin, getRepresentativeSkinPrice(skin)))
    const coldDuration = performance.now() - start
    const warmStart = performance.now()
    GENERATED_SKIN_DEFINITIONS.forEach((skin) => getSkinMarketPriceRange(skin, getRepresentativeSkinPrice(skin) * 1.01))
    const warmDuration = performance.now() - warmStart

    expect(ranges).toHaveLength(GENERATED_SKIN_DEFINITIONS.length)
    expect(ranges.every((range) => Number.isFinite(range.minimum) && range.minimum >= 0 && range.maximum >= range.minimum)).toBe(true)
    expect(coldDuration).toBeLessThan(5_000)
    expect(warmDuration).toBeLessThan(1_000)
  })
})
