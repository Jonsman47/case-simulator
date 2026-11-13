import { describe, expect, it } from 'vitest'
import { CaseStatus, Rarity, UpgradeId, WearCondition, type SkinBase } from './models'
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

describe('archived run-upgrade helpers', () => {
  it('preserves legacy levels without applying hidden gameplay effects', () => {
    const upgrades = {
      ...createDefaultUpgradeLevels(),
      [UpgradeId.BulkLoader]: 2,
      [UpgradeId.CaseContract]: 3,
      [UpgradeId.MarketSignal]: 2,
      [UpgradeId.AutomationServos]: 2,
    }

    expect(getMaxMultiOpenBatch(upgrades)).toBe(10)
    expect(getCaseCostReduction(upgrades)).toBe(0)
    expect(getUpgradeSellValueMultiplier(upgrades)).toBe(1)
    expect(getUpgradeAutomationIntervalMultiplier(upgrades)).toBe(1)
  })

  it('does not allow archived upgrades or skills to change batch size', () => {
    const upgrades = {
      ...createDefaultUpgradeLevels(),
      [UpgradeId.BulkLoader]: 9,
    }

    expect(getMaxMultiOpenBatch(upgrades)).toBe(10)
    expect(getMaxMultiOpenBatch(createDefaultUpgradeLevels())).toBe(10)
  })

  it('keeps official case costs unchanged', () => {
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

    expect(discountedCase.cost).toBe(0.2)
  })

  it('keeps official rarity weights unchanged', () => {
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
    expect(boostedTable).toEqual(dropTable)
  })

  it('does not magically improve official case wear rolls', () => {
    const upgrades = {
      ...createDefaultUpgradeLevels(),
      [UpgradeId.WearTuning]: 5,
    }

    expect(randomWearConditionForSkinWithUpgrades(rareSkin, upgrades, () => 0.14)).toBe(WearCondition.MinimalWear)
  })
})
