import { describe, expect, it } from 'vitest'
import {
  CASE_DEFINITIONS,
  getAvailableCases,
  getDropOdds,
  getDropTableWeightTotal,
  retireCasesByDate,
  unlockCasesForProgress,
} from './cases'
import { getOfficialWeaponCaseRarityOdds } from './officialDropOdds'
import { CaseStatus, Rarity } from './models'
import { SKIN_DEFINITIONS } from './skins'

const knownSkinIds = new Set(SKIN_DEFINITIONS.map((skin) => skin.id))

describe('case seed definitions', () => {
  it('uses drop tables that normalize to 100%', () => {
    for (const caseDef of CASE_DEFINITIONS) {
      expect(getDropTableWeightTotal(caseDef), caseDef.id).toBeCloseTo(100, 5)
    }
  })

  it('references known skin ids only', () => {
    for (const caseDef of CASE_DEFINITIONS) {
      for (const drop of caseDef.dropTable) {
        expect(knownSkinIds.has(drop.skinId), `${caseDef.id}:${drop.skinId}`).toBe(true)
      }
    }
  })

  it('includes extremely rare special item slots', () => {
    for (const caseDef of CASE_DEFINITIONS) {
      const specialDrops = caseDef.dropTable.filter((drop) => {
        const skin = SKIN_DEFINITIONS.find((definition) => definition.id === drop.skinId)
        return skin?.rarity === Rarity.SpecialItem
      })

      expect(specialDrops.length, caseDef.id).toBeGreaterThan(0)
      expect(
        specialDrops.reduce((total, drop) => total + drop.weight, 0),
        caseDef.id,
      ).toBeLessThanOrEqual(0.5)
    }
  })

  it('returns drop odds whose skin and rarity probabilities sum to 100%', () => {
    for (const caseDef of CASE_DEFINITIONS) {
      const odds = getDropOdds(caseDef.id)
      const skinProbabilityTotal =
        odds?.skinOdds.reduce((total, drop) => total + drop.probability, 0) ?? 0
      const rarityProbabilityTotal = Object.values(odds?.rarityOdds ?? {}).reduce(
        (total, probability) => total + probability,
        0,
      )

      expect(skinProbabilityTotal, `${caseDef.id} skin odds`).toBeCloseTo(100, 5)
      expect(rarityProbabilityTotal, `${caseDef.id} rarity odds`).toBeCloseTo(100, 5)
    }
  })

  it('keeps rarer starter-case categories less likely than common tiers', () => {
    const odds = getDropOdds('starter_case')

    expect(odds?.rarityOdds[Rarity.Consumer]).toBeGreaterThan(
      odds?.rarityOdds[Rarity.Industrial] ?? 0,
    )
    expect(odds?.rarityOdds[Rarity.Industrial]).toBeGreaterThan(
      odds?.rarityOdds[Rarity.MilSpec] ?? 0,
    )
    expect(odds?.rarityOdds[Rarity.MilSpec]).toBeGreaterThan(
      odds?.rarityOdds[Rarity.Restricted] ?? 0,
    )
    expect(odds?.rarityOdds[Rarity.Restricted]).toBeGreaterThan(
      odds?.rarityOdds[Rarity.Classified] ?? 0,
    )
    expect(odds?.rarityOdds[Rarity.Classified]).toBeGreaterThan(
      odds?.rarityOdds[Rarity.Covert] ?? 0,
    )
    expect(odds?.rarityOdds[Rarity.Covert]).toBeGreaterThan(
      odds?.rarityOdds[Rarity.SpecialItem] ?? 0,
    )
  })

  it('gives Ultra Legacy a boosted but still bounded Contraband chance', () => {
    const odds = getDropOdds('ultra_legacy_case')
    const contrabandOdds = odds?.rarityOdds[Rarity.Contraband] ?? 0
    const specialOdds = odds?.rarityOdds[Rarity.SpecialItem] ?? 0

    expect(contrabandOdds).toBeGreaterThan(specialOdds)
    expect(contrabandOdds).toBeGreaterThan(1)
    expect(contrabandOdds).toBeLessThan(10)
  })
})

describe('case helpers', () => {
  it('returns unlocked and retired cases as available', () => {
    const availableCaseIds = getAvailableCases(CASE_DEFINITIONS).map((caseDef) => caseDef.id)

    expect(availableCaseIds).toContain('starter_case')
    expect(availableCaseIds).toContain('fracture_style_case')
    expect(availableCaseIds).toContain('ultra_legacy_case')
    expect(availableCaseIds).not.toContain('revolution_style_case')
  })

  it('unlocks cases when progress requirements are met', () => {
    const updatedCases = unlockCasesForProgress(
      CASE_DEFINITIONS,
      {
        casesOpened: 80,
        prestigeLevel: 1,
      },
      ['starter_case'],
    )

    const kilowattCase = updatedCases.find((caseDef) => caseDef.id === 'kilowatt_style_case')

    expect(kilowattCase?.status).toBe(CaseStatus.Unlocked)
  })

  it('retires cases when their retirement date has passed', () => {
    const updatedCases = retireCasesByDate(CASE_DEFINITIONS, Date.UTC(2027, 0, 2))
    const legacyCase = updatedCases.find((caseDef) => caseDef.id === 'legacy_rare_case')

    expect(legacyCase?.status).toBe(CaseStatus.Retired)
  })

  it('exposes official weapon-case odds that sum to 100%', () => {
    const total = getOfficialWeaponCaseRarityOdds().reduce((sum, odd) => sum + odd.probability, 0)

    expect(total).toBeCloseTo(100, 4)
  })
})
