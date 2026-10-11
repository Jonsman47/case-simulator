import { describe, expect, it } from 'vitest'
import { CaseStatus, Rarity, SkillNodeId, UpgradeId, WearCondition, type SkinBase } from './models'
import {
  applyUpgradeCaseCost,
  applyUpgradeLuckToDropTable,
  createDefaultUpgradeLevels,
  getCaseCostReduction,
  getMaxMultiOpenBatch,
  getUpgradeAutomationIntervalMultiplier,
  getUpgradeSellValueMultiplier,
  randomWearConditionForSkinWithUpgrades,
} from './upgrades'

const commonSkin: SkinBase = {
  id: 'p250_sand_dune',
  weapon: 'P250',
  finish: 'Sand Dune',
  rarity: Rarity.Consumer,
  baseValue: 0.03,
  caseIds: ['starter_case'],
  image: '/assets/placeholder.png',
}

const rareSkin: SkinBase = {
  id: 'karambit_doppler',
  weapon: 'Karambit',
  finish: 'Doppler',
  rarity: Rarity.SpecialItem,
  baseValue: 950,
  caseIds: ['starter_case'],
  image: '/assets/placeholder.png',
}

describe('upgrade helpers', () => {
  it('derives upgrade effects from persisted levels', () => {
    const upgrades = {
      ...createDefaultUpgradeLevels(),
      [UpgradeId.BulkLoader]: 2,
      [UpgradeId.CaseContract]: 3,
      [UpgradeId.MarketSignal]: 2,
      [UpgradeId.AutomationServos]: 2,
    }

    expect(getMaxMultiOpenBatch(upgrades)).toBe(30)
    expect(getCaseCostReduction(upgrades)).toBe(0.06)
    expect(getUpgradeSellValueMultiplier(upgrades)).toBe(1.03)
    expect(getUpgradeAutomationIntervalMultiplier(upgrades)).toBe(0.9)
  })

  it('combines Bulk Loader and Opening Line skill tiers for later batch sizes', () => {
    const upgrades = {
      ...createDefaultUpgradeLevels(),
      [UpgradeId.BulkLoader]: 9,
    }

    expect(getMaxMultiOpenBatch(upgrades)).toBe(100)
    expect(getMaxMultiOpenBatch(createDefaultUpgradeLevels(), ['opening_4' as SkillNodeId])).toBe(30)
  })

  it('applies case discounts without dropping below the minimum price', () => {
    const discountedCase = applyUpgradeCaseCost({
      id: 'starter_case',
      name: 'Starter Case',
      cost: 0.2,
      status: CaseStatus.Unlocked,
      dropTable: [],
      image: '/assets/placeholder.png',
    }, {
      ...createDefaultUpgradeLevels(),
      [UpgradeId.CaseContract]: 5,
    })

    expect(discountedCase.cost).toBe(0.18)
  })

  it('boosts rarer drop weights while preserving total table weight', () => {
    const dropTable = [
      { skinId: commonSkin.id, weight: 100 },
      { skinId: rareSkin.id, weight: 1 },
    ]
    const boostedTable = applyUpgradeLuckToDropTable(dropTable, {
      ...createDefaultUpgradeLevels(),
      [UpgradeId.RarityLuck]: 5,
    }, new Map([
      [commonSkin.id, commonSkin],
      [rareSkin.id, rareSkin],
    ]))
    const originalTotal = dropTable.reduce((total, drop) => total + drop.weight, 0)
    const boostedTotal = boostedTable.reduce((total, drop) => total + drop.weight, 0)

    expect(Number(boostedTotal.toFixed(6))).toBe(Number(originalTotal.toFixed(6)))
    expect(boostedTable[1]?.weight).toBeGreaterThan(dropTable[1].weight)
    expect(boostedTable[0]?.weight).toBeLessThan(dropTable[0].weight)
  })

  it('wear tuning moves early rolls into better wear conditions', () => {
    const upgrades = {
      ...createDefaultUpgradeLevels(),
      [UpgradeId.WearTuning]: 5,
    }

    expect(randomWearConditionForSkinWithUpgrades(rareSkin, upgrades, () => 0.14)).toBe(
      WearCondition.FactoryNew,
    )
  })
})
