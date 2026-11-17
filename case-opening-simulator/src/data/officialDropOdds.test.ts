import { describe, expect, it } from 'vitest'
import { CASE_DEFINITIONS as IMPORTED_CASES } from './generated/cases.generated'
import { SKIN_DEFINITIONS } from './generated/skins.generated'
import { pickDrop } from './dropLogic'
import { Rarity } from './models'
import { applyOfficialWeaponCaseOdds, getCaseRarityOdds, OFFICIAL_WEAPON_CASE_RARITY_ODDS } from './officialDropOdds'

const skinsById = new Map(SKIN_DEFINITIONS.map((skin) => [skin.id, skin]))

function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6D2B79F5
    let result = value
    result = Math.imul(result ^ result >>> 15, result | 1)
    result ^= result + Math.imul(result ^ result >>> 7, result | 61)
    return ((result ^ result >>> 14) >>> 0) / 4_294_967_296
  }
}

describe('official standard weapon-case odds', () => {
  it('normalizes every imported standard case to the disclosed tier distribution', () => {
    expect(IMPORTED_CASES).toHaveLength(42)
    for (const caseDef of IMPORTED_CASES) {
      const table = applyOfficialWeaponCaseOdds(caseDef.dropTable, skinsById)
      const odds = getCaseRarityOdds({ dropTable: table }, skinsById)
      for (const expected of OFFICIAL_WEAPON_CASE_RARITY_ODDS) {
        expect(odds.get(expected.rarity), `${caseDef.name}: ${expected.rarity}`).toBeCloseTo(expected.probability, 5)
      }
    }
  })

  it('keeps relative selection weights inside each rarity tier', () => {
    const original = IMPORTED_CASES[0]
    const normalized = applyOfficialWeaponCaseOdds(original.dropTable, skinsById)
    const milSpec = original.dropTable.filter((entry) => skinsById.get(entry.skinId)?.rarity === Rarity.MilSpec)
    expect(milSpec.length).toBeGreaterThan(1)
    const left = milSpec[0]
    const right = milSpec[1]
    const normalizedById = new Map(normalized.map((entry) => [entry.skinId, entry.weight]))
    expect((normalizedById.get(left.skinId) ?? 0) / (normalizedById.get(right.skinId) ?? 1)).toBeCloseTo(left.weight / right.weight, 10)
  })

  it('matches expected statistical ranges across 500,000 seeded openings', () => {
    const table = applyOfficialWeaponCaseOdds(IMPORTED_CASES[0].dropTable, skinsById)
    const random = seededRandom(0xC52C52)
    const trials = 500_000
    const counts = new Map<Rarity, number>()
    for (let index = 0; index < trials; index += 1) {
      const skinId = pickDrop(table, random)
      const rarity = skinsById.get(skinId)?.rarity
      if (rarity) counts.set(rarity, (counts.get(rarity) ?? 0) + 1)
    }
    for (const expected of OFFICIAL_WEAPON_CASE_RARITY_ODDS) {
      const p = expected.probability / 100
      const observed = (counts.get(expected.rarity) ?? 0) / trials
      const standardDeviation = Math.sqrt(p * (1 - p) / trials)
      expect(Math.abs(observed - p), expected.rarity).toBeLessThanOrEqual(4.5 * standardDeviation)
    }
  }, 15_000)

  it('leaves explicitly custom/incomplete container mechanics unchanged', () => {
    const custom = [{ skinId: IMPORTED_CASES[0].dropTable[0].skinId, weight: 7 }]
    expect(applyOfficialWeaponCaseOdds(custom, skinsById)).toEqual(custom)
  })
})
