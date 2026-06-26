import { describe, expect, it } from 'vitest'
import { applyCasePricingBalance, getCasePricing, requiresCaseLicense } from './casePricing'
import { CaseStatus, Rarity, type CaseDefinition, type SkinBase } from './models'

const skinsById = new Map<string, SkinBase>([
  [
    'common',
    {
      id: 'common',
      weapon: 'P250',
      finish: 'Test',
      rarity: Rarity.Consumer,
      baseValue: 0.2,
      caseIds: ['case'],
      image: '/assets/placeholder.png',
    },
  ],
  [
    'rare',
    {
      id: 'rare',
      weapon: 'AK-47',
      finish: 'Test',
      rarity: Rarity.Covert,
      baseValue: 100,
      caseIds: ['case'],
      image: '/assets/placeholder.png',
    },
  ],
])

function makeCase(id: string, name: string): CaseDefinition {
  return {
    id,
    name,
    cost: 1,
    status: CaseStatus.Unlocked,
    image: '/assets/placeholder.png',
    dropTable: [
      { skinId: 'common', weight: 99 },
      { skinId: 'rare', weight: 1 },
    ],
  }
}

describe('case pricing balance', () => {
  it('sorts generated cases by real game price and applies license costs', () => {
    const balancedCases = applyCasePricingBalance(
      [
        makeCase('weapon_1', 'CS:GO Weapon Case'),
        makeCase('recoil', 'Recoil Case'),
        makeCase('revolution', 'Revolution Case'),
        makeCase('kilowatt', 'Kilowatt Case'),
      ],
      skinsById,
    )

    expect(balancedCases.map((caseDef) => caseDef.id)).toEqual([
      'kilowatt',
      'revolution',
      'recoil',
      'weapon_1',
    ])
    expect(balancedCases[0]).toMatchObject({
      cost: 2.65,
      status: CaseStatus.Unlocked,
      caseLicenseCost: undefined,
    })
    expect(balancedCases[1]).toMatchObject({
      cost: 2.72,
      status: CaseStatus.Unlocked,
      caseLicenseCost: undefined,
    })
    expect(balancedCases[2]).toMatchObject({
      cost: 2.79,
      status: CaseStatus.Locked,
      caseLicenseCost: 97.65,
    })
    expect(balancedCases[3]).toMatchObject({
      cost: 121.49,
      status: CaseStatus.Locked,
      caseLicenseCost: 4252.15,
    })
  })

  it('normalizes balanced drop weights back to 100%', () => {
    const [balancedCase] = applyCasePricingBalance(
      [makeCase('kilowatt', 'Kilowatt Case')],
      skinsById,
    )
    const totalWeight = balancedCase.dropTable.reduce((total, drop) => total + drop.weight, 0)

    expect(totalWeight).toBeCloseTo(100, 5)
  })

  it('recognizes generated case aliases and license requirements', () => {
    const weaponCase = makeCase('weapon_1', 'CS:GO Weapon Case')
    const recoilCase = applyCasePricingBalance([makeCase('recoil', 'Recoil Case')], skinsById)[0]

    expect(getCasePricing(weaponCase)?.gamePrice).toBe(121.49)
    expect(requiresCaseLicense(recoilCase)).toBe(true)
  })
})
