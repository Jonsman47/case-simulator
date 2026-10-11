import { PRESTIGE_INVENTORY_VALUE_THRESHOLD } from '../utils/inventory'
import { getCollectionPrestigeBonus } from '../utils/collectionRewards'
import {
  PrestigeBonusId,
  Rarity,
  type AchievementProgress,
  type CaseDefinition,
  type CollectionRewardProgress,
  type PrestigeBonusLevels,
  type SkinBase,
} from './models'

export const PRESTIGE_MONEY_EARNED_THRESHOLD = 500_000
export const PRESTIGE_CASES_OPENED_THRESHOLD = 25_000
export const PRESTIGE_MONEY_SPENT_THRESHOLD = 250_000

export interface PrestigeBonusDefinition {
  id: PrestigeBonusId
  name: string
  description: string
  maxLevel: number
  baseCost: number
  costMultiplier: number
  getCurrentEffect: (level: number) => string
  getNextEffect: (level: number) => string
}

export interface PrestigeSnapshot {
  achievements: AchievementProgress[]
  casesOpened: number
  collectionRewards: CollectionRewardProgress[]
  inventoryValue: number
  moneyEarned: number
  moneySpent: number
  prestigeBonuses: PrestigeBonusLevels
  prestigeLevel: number
  prestigePoints: number
}

export interface PrestigeEligibility {
  canPrestige: boolean
  casesOpenedProgress: number
  inventoryProgress: number
  moneyEarnedProgress: number
  moneySpentProgress: number
  reason: string
}

const rarityBoostOrder: Record<Rarity, number> = {
  [Rarity.Consumer]: 0,
  [Rarity.Industrial]: 1,
  [Rarity.MilSpec]: 2,
  [Rarity.Restricted]: 3,
  [Rarity.Classified]: 4,
  [Rarity.Covert]: 5,
  [Rarity.SpecialItem]: 6,
  [Rarity.Contraband]: 7,
}

function formatPercent(value: number) {
  return `${Number((value * 100).toFixed(1))}%`
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2))
}

export function createDefaultPrestigeBonusLevels(): PrestigeBonusLevels {
  return Object.fromEntries(Object.values(PrestigeBonusId).map((bonusId) => [bonusId, 0])) as PrestigeBonusLevels
}

export function normalizePrestigeBonusLevels(value: unknown): PrestigeBonusLevels {
  const defaults = createDefaultPrestigeBonusLevels()

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults
  }

  const source = value as Record<string, unknown>

  return Object.values(PrestigeBonusId).reduce((levels, bonusId) => {
    const rawLevel = source[bonusId]

    levels[bonusId] = typeof rawLevel === 'number' && Number.isFinite(rawLevel)
      ? Math.max(0, Math.floor(rawLevel))
      : 0

    return levels
  }, { ...defaults })
}

export function getPrestigeBonusLevel(prestigeBonuses: PrestigeBonusLevels, bonusId: PrestigeBonusId) {
  return Math.max(0, Math.floor(prestigeBonuses[bonusId] ?? 0))
}

export function getPrestigeSellMultiplier(prestigeBonuses: PrestigeBonusLevels) {
  return 1 + getPrestigeBonusLevel(prestigeBonuses, PrestigeBonusId.SellValue) * 0.04
}

export function getPrestigeCaseDiscount(prestigeBonuses: PrestigeBonusLevels) {
  return Math.min(0.4, getPrestigeBonusLevel(prestigeBonuses, PrestigeBonusId.CaseDiscount) * 0.025)
}

export function getPrestigeLuckBonus(prestigeBonuses: PrestigeBonusLevels) {
  return getPrestigeBonusLevel(prestigeBonuses, PrestigeBonusId.DropLuck) * 0.025
}

export function getPrestigeAutomationIntervalMultiplier(prestigeBonuses: PrestigeBonusLevels) {
  return 1 - Math.min(0.4, getPrestigeBonusLevel(prestigeBonuses, PrestigeBonusId.AutomationSpeed) * 0.05)
}

export function getPrestigeStartingMoneyBonus(prestigeBonuses: PrestigeBonusLevels) {
  return getPrestigeBonusLevel(prestigeBonuses, PrestigeBonusId.StartingMoney) * 2_000
}

export function getPrestigeInventoryCapacityBonus(prestigeBonuses: PrestigeBonusLevels) {
  return getPrestigeBonusLevel(prestigeBonuses, PrestigeBonusId.InventoryCapacity) * 1_000
}

export function getPrestigeMarketKnowledgeBonus(prestigeBonuses: PrestigeBonusLevels) {
  return getPrestigeBonusLevel(prestigeBonuses, PrestigeBonusId.MarketKnowledge) * 0.01
}

export const PRESTIGE_BONUS_DEFINITIONS: PrestigeBonusDefinition[] = [
  {
    id: PrestigeBonusId.SellValue,
    name: 'Diamond Hands',
    description: 'Permanently increases sale proceeds from manual, bulk, and auto-selling.',
    maxLevel: 15,
    baseCost: 2,
    costMultiplier: 1.55,
    getCurrentEffect: (level) => `+${formatPercent(level * 0.04)} sell value`,
    getNextEffect: (level) => `+${formatPercent((level + 1) * 0.04)} sell value`,
  },
  {
    id: PrestigeBonusId.CaseDiscount,
    name: 'Key Network',
    description: 'Permanently discounts case opening costs after collection and upgrade discounts.',
    maxLevel: 16,
    baseCost: 2,
    costMultiplier: 1.6,
    getCurrentEffect: (level) => `${formatPercent(Math.min(0.4, level * 0.025))} case discount`,
    getNextEffect: (level) => `${formatPercent(Math.min(0.4, (level + 1) * 0.025))} case discount`,
  },
  {
    id: PrestigeBonusId.DropLuck,
    name: 'Redline Fate',
    description: 'Permanently nudges drop tables toward higher rarity skins before normalization.',
    maxLevel: 12,
    baseCost: 3,
    costMultiplier: 1.65,
    getCurrentEffect: (level) => `+${formatPercent(level * 0.025)} rare-tier pressure`,
    getNextEffect: (level) => `+${formatPercent((level + 1) * 0.025)} rare-tier pressure`,
  },
  {
    id: PrestigeBonusId.AutomationSpeed,
    name: 'Overclocked Floor',
    description: 'Permanently speeds up automation intervals across runs.',
    maxLevel: 10,
    baseCost: 3,
    costMultiplier: 1.6,
    getCurrentEffect: (level) => `${formatPercent(Math.min(0.4, level * 0.05))} faster automation`,
    getNextEffect: (level) => `${formatPercent(Math.min(0.4, (level + 1) * 0.05))} faster automation`,
  },
  {
    id: PrestigeBonusId.StartingMoney,
    name: 'Seed Bank',
    description: 'Starts every new prestige run with extra cash.',
    maxLevel: 15,
    baseCost: 2,
    costMultiplier: 1.45,
    getCurrentEffect: (level) => `+$${(level * 2_000).toLocaleString()} starting money`,
    getNextEffect: (level) => `+$${((level + 1) * 2_000).toLocaleString()} starting money`,
  },
  {
    id: PrestigeBonusId.InventoryCapacity,
    name: 'Vault Expansion',
    description: 'Adds permanent inventory capacity.',
    maxLevel: 10,
    baseCost: 2,
    costMultiplier: 1.5,
    getCurrentEffect: (level) => `+${level * 1_000} inventory slots`,
    getNextEffect: (level) => `+${(level + 1) * 1_000} inventory slots`,
  },
  {
    id: PrestigeBonusId.MarketKnowledge,
    name: 'Market Memory',
    description: 'Permanently improves timed gameplay and market event discovery.',
    maxLevel: 8,
    baseCost: 3,
    costMultiplier: 1.7,
    getCurrentEffect: (level) => `+${formatPercent(level * 0.01)} event discovery chance`,
    getNextEffect: (level) => `+${formatPercent((level + 1) * 0.01)} event discovery chance`,
  },
]

export const prestigeBonusesById = new Map(PRESTIGE_BONUS_DEFINITIONS.map((bonus) => [bonus.id, bonus]))

export function getPrestigeEligibility(
  snapshot: Pick<PrestigeSnapshot, 'casesOpened' | 'inventoryValue' | 'moneyEarned' | 'moneySpent'>,
): PrestigeEligibility {
  const casesOpenedProgress = Math.min(1, snapshot.casesOpened / PRESTIGE_CASES_OPENED_THRESHOLD)
  const inventoryProgress = Math.min(1, snapshot.inventoryValue / PRESTIGE_INVENTORY_VALUE_THRESHOLD)
  const moneyEarnedProgress = Math.min(1, snapshot.moneyEarned / PRESTIGE_MONEY_EARNED_THRESHOLD)
  const moneySpentProgress = Math.min(1, snapshot.moneySpent / PRESTIGE_MONEY_SPENT_THRESHOLD)
  const hasRunDepth = casesOpenedProgress >= 1 && moneySpentProgress >= 1
  const hasRunValue = inventoryProgress >= 1 || moneyEarnedProgress >= 1
  const canPrestige = hasRunDepth && hasRunValue

  return {
    canPrestige,
    casesOpenedProgress,
    inventoryProgress,
    moneyEarnedProgress,
    moneySpentProgress,
    reason: canPrestige
      ? 'Prestige is available.'
      : 'Open enough cases, spend enough money, and reach either the inventory value or sell earnings threshold.',
  }
}

export function calculatePrestigePointAward(snapshot: PrestigeSnapshot) {
  const eligibility = getPrestigeEligibility(snapshot)

  if (!eligibility.canPrestige) {
    return 0
  }

  const progressValue = snapshot.inventoryValue + snapshot.moneyEarned + snapshot.moneySpent * 0.35
  const progressPoints = Math.max(3, Math.floor(Math.log10(Math.max(10, progressValue)) * 2) - 7)
  const casePoints = Math.floor(snapshot.casesOpened / 12_500)
  const achievementPoints = Math.floor(snapshot.achievements.length / 10)
  const collectionBonus = getCollectionPrestigeBonus(snapshot.collectionRewards)

  return Math.max(4, progressPoints + casePoints + achievementPoints + collectionBonus * 2)
}

export function getPrestigeBonusCost(definition: PrestigeBonusDefinition, currentLevel: number) {
  return Math.max(1, Math.ceil(definition.baseCost * definition.costMultiplier ** Math.max(0, currentLevel)))
}

export function canPurchasePrestigeBonus(
  definition: PrestigeBonusDefinition,
  snapshot: Pick<PrestigeSnapshot, 'prestigeBonuses' | 'prestigePoints'>,
) {
  const level = getPrestigeBonusLevel(snapshot.prestigeBonuses, definition.id)
  const cost = getPrestigeBonusCost(definition, level)

  return {
    canAfford: snapshot.prestigePoints >= cost,
    cost,
    isMaxLevel: level >= definition.maxLevel,
    level,
  }
}

export function applyPrestigeCaseCost(caseDef: CaseDefinition, prestigeBonuses: PrestigeBonusLevels) {
  const discount = getPrestigeCaseDiscount(prestigeBonuses)

  if (discount <= 0) {
    return caseDef
  }

  return {
    ...caseDef,
    cost: Math.max(0.01, roundCurrency(caseDef.cost * (1 - discount))),
  }
}

export function applyPrestigeLuckToDropTable(
  dropTable: CaseDefinition['dropTable'],
  prestigeBonuses: PrestigeBonusLevels,
  skinsById: Map<string, SkinBase>,
) {
  const luckBonus = getPrestigeLuckBonus(prestigeBonuses)
  const originalTotal = dropTable.reduce((total, drop) => total + Math.max(0, drop.weight), 0)

  if (luckBonus <= 0 || originalTotal <= 0) {
    return dropTable
  }

  const boostedTable = dropTable.map((drop) => {
    const skin = skinsById.get(drop.skinId)
    const boost = skin ? 1 + rarityBoostOrder[skin.rarity] * luckBonus : 1

    return {
      ...drop,
      weight: Math.max(0, drop.weight) * boost,
    }
  })
  const boostedTotal = boostedTable.reduce((total, drop) => total + drop.weight, 0)

  if (boostedTotal <= 0) {
    return dropTable
  }

  const normalizationFactor = originalTotal / boostedTotal

  return boostedTable.map((drop) => ({
    ...drop,
    weight: drop.weight * normalizationFactor,
  }))
}

export function applyPrestigeEffectsToCase(
  caseDef: CaseDefinition,
  prestigeBonuses: PrestigeBonusLevels,
  skinsById: Map<string, SkinBase>,
) {
  // Prestige bonuses stack after collection rewards and normal upgrades.
  const costAdjustedCase = applyPrestigeCaseCost(caseDef, prestigeBonuses)

  return {
    ...costAdjustedCase,
    dropTable: applyPrestigeLuckToDropTable(costAdjustedCase.dropTable, prestigeBonuses, skinsById),
  }
}

export function applyPrestigeEffectsToCases(
  caseDefinitions: CaseDefinition[],
  prestigeBonuses: PrestigeBonusLevels,
  skinsById: Map<string, SkinBase>,
) {
  return caseDefinitions.map((caseDef) => applyPrestigeEffectsToCase(caseDef, prestigeBonuses, skinsById))
}
