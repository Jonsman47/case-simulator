import { describe, expect, it } from 'vitest'
import { CaseStatus, PrestigeBonusId, Rarity, type SkinBase } from './models'
import {
  applyPrestigeCaseCost,
  applyPrestigeLuckToDropTable,
  calculatePrestigePointAward,
  canPurchasePrestigeBonus,
  createDefaultPrestigeBonusLevels,
  getPrestigeAutomationIntervalMultiplier,
  getPrestigeBonusLevel,
  getPrestigeCaseDiscount,
  getPrestigeEligibility,
  getPrestigeSellMultiplier,
  getPrestigeStartingMoneyBonus,
  prestigeBonusesById,
} from './prestige'

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

describe('prestige helpers', () => {
  it('detects prestige eligibility from run depth plus value or earnings', () => {
    expect(getPrestigeEligibility({
      casesOpened: 24_999,
      inventoryValue: 999_999,
      moneyEarned: 499_999,
      moneySpent: 249_999,
    }).canPrestige).toBe(false)
    expect(getPrestigeEligibility({
      casesOpened: 25_000,
      inventoryValue: 1_000_000,
      moneyEarned: 0,
      moneySpent: 250_000,
    }).canPrestige).toBe(true)
    expect(getPrestigeEligibility({
      casesOpened: 25_000,
      inventoryValue: 0,
      moneyEarned: 500_000,
      moneySpent: 250_000,
    }).canPrestige).toBe(true)
  })

  it('calculates point awards from run value, achievements, and collection prestige bonuses', () => {
    const award = calculatePrestigePointAward({
      achievements: Array.from({ length: 20 }, (_, index) => ({
        id: `achievement-${index}`,
        isClaimed: true,
        unlockedAt: 1,
      })),
      casesOpened: 25_000,
      collectionRewards: [
        {
          id: 'full-game:wear-master',
          type: 'FullGamePrestigeBonus',
          targetId: 'all-wears',
          bonus: 1,
          unlockedAt: 1,
          carriesOver: true,
        },
      ],
      inventoryValue: 1_000_000,
      moneyEarned: 500_000,
      moneySpent: 250_000,
      prestigeBonuses: createDefaultPrestigeBonusLevels(),
      prestigeLevel: 0,
      prestigePoints: 0,
    })

    expect(award).toBe(11)
  })

  it('derives permanent bonus effects from levels', () => {
    const bonuses = {
      ...createDefaultPrestigeBonusLevels(),
      [PrestigeBonusId.SellValue]: 2,
      [PrestigeBonusId.CaseDiscount]: 3,
      [PrestigeBonusId.AutomationSpeed]: 2,
      [PrestigeBonusId.StartingMoney]: 4,
    }

    expect(getPrestigeBonusLevel(bonuses, PrestigeBonusId.SellValue)).toBe(2)
    expect(getPrestigeSellMultiplier(bonuses)).toBe(1.08)
    expect(getPrestigeCaseDiscount(bonuses)).toBeCloseTo(0.075)
    expect(getPrestigeAutomationIntervalMultiplier(bonuses)).toBe(0.9)
    expect(getPrestigeStartingMoneyBonus(bonuses)).toBe(8_000)
  })

  it('applies case discounts and rarity luck while preserving weight totals', () => {
    const bonuses = {
      ...createDefaultPrestigeBonusLevels(),
      [PrestigeBonusId.CaseDiscount]: 2,
      [PrestigeBonusId.DropLuck]: 4,
    }
    const discountedCase = applyPrestigeCaseCost({
      id: 'starter_case',
      name: 'Starter Case',
      cost: 10,
      status: CaseStatus.Unlocked,
      dropTable: [],
      image: '/assets/placeholder.png',
    }, bonuses)
    const dropTable = [
      { skinId: commonSkin.id, weight: 100 },
      { skinId: rareSkin.id, weight: 1 },
    ]
    const boostedTable = applyPrestigeLuckToDropTable(dropTable, bonuses, new Map([
      [commonSkin.id, commonSkin],
      [rareSkin.id, rareSkin],
    ]))

    expect(discountedCase.cost).toBe(9.5)
    expect(Number(boostedTable.reduce((total, drop) => total + drop.weight, 0).toFixed(6))).toBe(101)
    expect(boostedTable[1]?.weight).toBeGreaterThan(dropTable[1].weight)
  })

  it('guards prestige bonus purchases by points and max level', () => {
    const definition = prestigeBonusesById.get(PrestigeBonusId.SellValue)

    expect(definition).toBeDefined()

    if (!definition) {
      return
    }

    expect(canPurchasePrestigeBonus(definition, {
      prestigeBonuses: createDefaultPrestigeBonusLevels(),
      prestigePoints: 0,
    }).canAfford).toBe(false)
    expect(canPurchasePrestigeBonus(definition, {
      prestigeBonuses: {
        ...createDefaultPrestigeBonusLevels(),
        [PrestigeBonusId.SellValue]: definition.maxLevel,
      },
      prestigePoints: 999,
    }).isMaxLevel).toBe(true)
  })
})
