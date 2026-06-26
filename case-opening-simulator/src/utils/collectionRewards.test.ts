import { describe, expect, it } from 'vitest'
import { CaseStatus, Rarity, WearCondition, type CaseDefinition, type CollectionEntry, type CollectionRewardProgress, type SkinBase } from '../data/models'
import {
  applyCollectionLuckToDropTable,
  applyCollectionRewardsToCase,
  applyCollectionSellValueBonus,
  getCollectionRewardStatuses,
  getCollectionPrestigeBonus,
  getCarryOverCollectionRewards,
  getNewCollectionRewardUnlocks,
} from './collectionRewards'

const skins: SkinBase[] = [
  {
    id: 'alpha_one',
    weapon: 'Alpha',
    finish: 'One',
    rarity: Rarity.Consumer,
    baseValue: 1,
    caseIds: ['test_case'],
    image: '/assets/placeholder.png',
  },
  {
    id: 'alpha_two',
    weapon: 'Alpha',
    finish: 'Two',
    rarity: Rarity.Consumer,
    baseValue: 1,
    caseIds: ['test_case'],
    image: '/assets/placeholder.png',
  },
  {
    id: 'beta_one',
    weapon: 'Beta',
    finish: 'One',
    rarity: Rarity.Industrial,
    baseValue: 5,
    caseIds: ['test_case'],
    image: '/assets/placeholder.png',
  },
]

const caseDef: CaseDefinition = {
  id: 'test_case',
  name: 'Test Case',
  cost: 10,
  status: CaseStatus.Unlocked,
  image: '/assets/placeholder.png',
  dropTable: [
    { skinId: 'alpha_one', weight: 50 },
    { skinId: 'alpha_two', weight: 30 },
    { skinId: 'beta_one', weight: 20 },
  ],
}

function makeEntry(skinId: string, foundWearConditions = [WearCondition.FactoryNew]): CollectionEntry {
  return {
    skinId,
    foundWearConditions,
    bestFloat: 0.01,
    highestValue: 1,
    timesFound: 1,
    firstFoundAt: 1_782_147_600_000,
  }
}

describe('collection rewards', () => {
  it('unlocks rewards only after the full target set is completed', () => {
    const partialStatuses = getCollectionRewardStatuses({
      caseDefinitions: [caseDef],
      collectionBook: [makeEntry('alpha_one')],
      collectionRewards: [],
      skins,
    })
    const partialWeaponReward = partialStatuses.find((status) => status.definition.id === 'weapon:alpha')

    expect(partialWeaponReward).toMatchObject({
      discovered: 1,
      isUnlocked: false,
      total: 2,
    })

    const unlocks = getNewCollectionRewardUnlocks({
      caseDefinitions: [caseDef],
      collectionBook: [makeEntry('alpha_one'), makeEntry('alpha_two'), makeEntry('beta_one')],
      collectionRewards: [],
      skins,
      unlockedAt: 123,
    })

    expect(unlocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'weapon:alpha',
          type: 'WeaponSellBonus',
          targetId: 'Alpha',
          unlockedAt: 123,
        }),
        expect.objectContaining({
          id: 'case:test_case',
          type: 'CaseDiscount',
          targetId: 'test_case',
        }),
        expect.objectContaining({
          id: `rarity:${Rarity.Consumer}`,
          type: 'RarityLuck',
          targetId: Rarity.Consumer,
        }),
      ]),
    )
  })

  it('applies sell bonuses, case discounts, and luck weight boosts consistently', () => {
    const rewards: CollectionRewardProgress[] = [
      {
        id: 'weapon:alpha',
        type: 'WeaponSellBonus',
        targetId: 'Alpha',
        bonus: 0.01,
        unlockedAt: 123,
      },
      {
        id: 'case:test_case',
        type: 'CaseDiscount',
        targetId: 'test_case',
        bonus: 0.05,
        unlockedAt: 123,
      },
      {
        id: `rarity:${Rarity.Consumer}`,
        type: 'RarityLuck',
        targetId: Rarity.Consumer,
        bonus: 0.02,
        unlockedAt: 123,
      },
    ]
    const rewardedCase = applyCollectionRewardsToCase(caseDef, rewards, skins)
    const boostedDropTable = applyCollectionLuckToDropTable(caseDef.dropTable, rewards, skins)
    const betaWeightBefore = caseDef.dropTable.find((drop) => drop.skinId === 'beta_one')?.weight ?? 0
    const betaWeightAfter = boostedDropTable.find((drop) => drop.skinId === 'beta_one')?.weight ?? 0

    expect(applyCollectionSellValueBonus(100, { weapon: 'Alpha' }, rewards)).toBe(101)
    expect(rewardedCase.cost).toBe(9.5)
    expect(boostedDropTable.reduce((total, drop) => total + drop.weight, 0)).toBeCloseTo(100)
    expect(betaWeightAfter).toBeGreaterThan(betaWeightBefore)
  })

  it('exposes full-game prestige bonuses as carry-over rewards', () => {
    const reward: CollectionRewardProgress = {
      id: 'full-game:wear-master',
      type: 'FullGamePrestigeBonus',
      targetId: 'all-skins-all-wears',
      bonus: 1,
      carriesOver: true,
      unlockedAt: 123,
    }

    expect(getCollectionPrestigeBonus([reward])).toBe(1)
    expect(getCarryOverCollectionRewards([reward])).toEqual([reward])
  })
})
