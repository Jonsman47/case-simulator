import type { Prng } from './dropLogic'
import {
  Rarity,
  UpgradeCategory,
  UpgradeId,
  type SkillNodeId,
  WearCondition,
  type AchievementProgress,
  type CaseDefinition,
  type SkinBase,
  type UpgradeLevels,
} from './models'
import { getSkillMultiOpenBatchBonus } from './skills'
import { WEAR_DISTRIBUTIONS_BY_RARITY, type WearDistributionEntry } from '../utils/wear'

export interface UpgradeCost {
  money: number
  upgradePoints: number
}

export type UpgradeRequirement =
  | { type: 'upgrade'; upgradeId: UpgradeId; level: number }
  | { type: 'achievement'; achievementId: string; label: string }
  | { type: 'prestige'; level: number }

export interface UpgradeDefinition {
  id: UpgradeId
  category: UpgradeCategory
  name: string
  description: string
  baseMoneyCost: number
  costMultiplier: number
  maxLevel: number
  prestigePointCost?: (currentLevel: number) => number
  requirements?: UpgradeRequirement[]
  getCurrentEffect: (level: number) => string
  getNextEffect: (level: number) => string
}

export interface UpgradeRequirementStatus {
  label: string
  met: boolean
}

export interface UpgradePurchaseSnapshot {
  achievements: AchievementProgress[]
  money: number
  prestigeLevel: number
  upgradePoints: number
  upgrades: UpgradeLevels
}

export const UPGRADE_CATEGORY_ORDER = [
  UpgradeCategory.Opening,
  UpgradeCategory.Clicker,
  UpgradeCategory.Market,
  UpgradeCategory.Automation,
  UpgradeCategory.Capacity,
  UpgradeCategory.Luck,
]
export const MAX_MULTI_OPEN_BATCH = 100

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

export function createDefaultUpgradeLevels(): UpgradeLevels {
  return Object.fromEntries(Object.values(UpgradeId).map((upgradeId) => [upgradeId, 0])) as UpgradeLevels
}

export function normalizeUpgradeLevel(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0
}

export function normalizeUpgradeLevels(value: unknown): UpgradeLevels {
  const defaults = createDefaultUpgradeLevels()

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults
  }

  const source = value as Record<string, unknown>

  return Object.values(UpgradeId).reduce((levels, upgradeId) => {
    levels[upgradeId] = normalizeUpgradeLevel(source[upgradeId])
    return levels
  }, { ...defaults })
}

export function getUpgradeLevel(upgrades: UpgradeLevels, upgradeId: UpgradeId) {
  return Math.max(0, Math.floor(upgrades[upgradeId] ?? 0))
}

export function getCaseCostReduction(upgrades: UpgradeLevels) {
  return Math.min(0.3, getUpgradeLevel(upgrades, UpgradeId.CaseContract) * 0.02)
}

export function getMaxMultiOpenBatch(
  upgrades: UpgradeLevels,
  learnedSkillNodeIds: SkillNodeId[] = [],
) {
  // Bulk Loader is the visible shop path; Opening Line skill tiers layer extra
  // late-game buttons on top so progression can continue 10 -> 20 -> 30 -> ...
  // without showing high-volume actions to brand-new players.
  const upgradeBatch = 10 + getUpgradeLevel(upgrades, UpgradeId.BulkLoader) * 10
  const skillBatchBonus = getSkillMultiOpenBatchBonus(learnedSkillNodeIds)

  return Math.min(MAX_MULTI_OPEN_BATCH, upgradeBatch + skillBatchBonus)
}

export function getOpeningAnimationSpeedBonus(upgrades: UpgradeLevels) {
  return getUpgradeLevel(upgrades, UpgradeId.OpeningMotor) * 0.15
}

export function getClickIncomeMultiplier(upgrades: UpgradeLevels) {
  return 1 + getUpgradeLevel(upgrades, UpgradeId.ClickIncome) * 0.25
}

export function getUpgradeSellValueMultiplier(upgrades: UpgradeLevels) {
  return 1 + getUpgradeLevel(upgrades, UpgradeId.MarketSignal) * 0.015
}

export function getTrendPredictionBonus(upgrades: UpgradeLevels) {
  return getUpgradeLevel(upgrades, UpgradeId.TrendScanner) * 0.005
}

export function getUpgradeAutomationIntervalMultiplier(upgrades: UpgradeLevels) {
  return 1 - Math.min(0.35, getUpgradeLevel(upgrades, UpgradeId.AutomationServos) * 0.05)
}

export function getWarehouseUpgradeCapacityBonus(upgrades: UpgradeLevels) {
  return getUpgradeLevel(upgrades, UpgradeId.WarehouseRows) * 100
}

export function getModuleBaySlots(upgrades: UpgradeLevels) {
  return getUpgradeLevel(upgrades, UpgradeId.ModuleBay)
}

export function getAutomationModuleCapacity(upgrades: UpgradeLevels) {
  return 2 + getModuleBaySlots(upgrades)
}

export function getRarityLuckBonus(upgrades: UpgradeLevels) {
  return getUpgradeLevel(upgrades, UpgradeId.RarityLuck) * 0.02
}

export const UPGRADE_DEFINITIONS: UpgradeDefinition[] = [
  {
    id: UpgradeId.OpeningMotor,
    category: UpgradeCategory.Opening,
    name: 'Opening Motor',
    description: 'Speeds up the case opening presentation and batch reveal pacing.',
    baseMoneyCost: 450,
    costMultiplier: 2.15,
    maxLevel: 3,
    getCurrentEffect: (level) =>
      level > 0 ? `+${formatPercent(level * 0.15)} animation speed` : 'Standard animation speed',
    getNextEffect: (level) => `+${formatPercent((level + 1) * 0.15)} animation speed`,
  },
  {
    id: UpgradeId.BulkLoader,
    category: UpgradeCategory.Opening,
    name: 'Bulk Loader',
    description: 'Raises the largest case batch button for players who want bigger opens.',
    baseMoneyCost: 2_500,
    costMultiplier: 2.35,
    maxLevel: 9,
    requirements: [{ type: 'upgrade', upgradeId: UpgradeId.OpeningMotor, level: 1 }],
    getCurrentEffect: (level) => `Max open ${Math.min(MAX_MULTI_OPEN_BATCH, 10 + level * 10)} cases`,
    getNextEffect: (level) => `Max open ${Math.min(MAX_MULTI_OPEN_BATCH, 10 + (level + 1) * 10)} cases`,
  },
  {
    id: UpgradeId.CaseContract,
    category: UpgradeCategory.Opening,
    name: 'Case Contract',
    description: 'Negotiates cheaper case openings on top of collection reward discounts.',
    baseMoneyCost: 1_250,
    costMultiplier: 2.25,
    maxLevel: 5,
    getCurrentEffect: (level) =>
      level > 0 ? `${formatPercent(level * 0.02)} case discount` : 'No case discount',
    getNextEffect: (level) => `${formatPercent((level + 1) * 0.02)} case discount`,
  },
  {
    id: UpgradeId.WearTuning,
    category: UpgradeCategory.Opening,
    name: 'Wear Tuning',
    description: 'Improves the wear roll distribution toward Factory New and Minimal Wear.',
    baseMoneyCost: 2_000,
    costMultiplier: 2.3,
    maxLevel: 5,
    getCurrentEffect: (level) =>
      level > 0 ? `+${level * 2} FN/MW roll weight` : 'Default wear distribution',
    getNextEffect: (level) => `+${(level + 1) * 2} FN/MW roll weight`,
  },
  {
    id: UpgradeId.ClickIncome,
    category: UpgradeCategory.Clicker,
    name: 'Click Income',
    description: 'Raises income from active Work mini-games.',
    baseMoneyCost: 300,
    costMultiplier: 1.9,
    maxLevel: 10,
    getCurrentEffect: (level) =>
      level > 0 ? `+${formatPercent(level * 0.25)} Work income` : 'Base Work income',
    getNextEffect: (level) => `+${formatPercent((level + 1) * 0.25)} Work income`,
  },
  {
    id: UpgradeId.MarketSignal,
    category: UpgradeCategory.Market,
    name: 'Market Signal',
    description: 'Improves sell quotes from manual sells, bulk sells, and auto-sells.',
    baseMoneyCost: 3_000,
    costMultiplier: 2.3,
    maxLevel: 5,
    getCurrentEffect: (level) =>
      level > 0 ? `+${formatPercent(level * 0.015)} sell value` : 'No sell bonus',
    getNextEffect: (level) => `+${formatPercent((level + 1) * 0.015)} sell value`,
  },
  {
    id: UpgradeId.TrendScanner,
    category: UpgradeCategory.Market,
    name: 'Trend Scanner',
    description: 'Improves the chance of discovering new gameplay and market events.',
    baseMoneyCost: 7_500,
    costMultiplier: 2.6,
    maxLevel: 3,
    prestigePointCost: (level) => (level >= 1 ? 1 : 0),
    requirements: [{ type: 'achievement', achievementId: 'inventory_value_1k', label: '$1K inventory achievement' }],
    getCurrentEffect: (level) =>
      level > 0 ? `+${formatPercent(level * 0.005)} event discovery chance` : 'Base event discovery',
    getNextEffect: (level) => `+${formatPercent((level + 1) * 0.005)} event discovery chance`,
  },
  {
    id: UpgradeId.AutomationServos,
    category: UpgradeCategory.Automation,
    name: 'Automation Servos',
    description: 'Reduces automation intervals across the Auto Opener and modules.',
    baseMoneyCost: 5_000,
    costMultiplier: 2.35,
    maxLevel: 5,
    requirements: [{ type: 'achievement', achievementId: 'automation_started', label: 'Hands Off achievement' }],
    getCurrentEffect: (level) =>
      level > 0 ? `${formatPercent(level * 0.05)} faster automation` : 'Standard automation timing',
    getNextEffect: (level) => `${formatPercent((level + 1) * 0.05)} faster automation`,
  },
  {
    id: UpgradeId.ModuleBay,
    category: UpgradeCategory.Automation,
    name: 'Module Bay',
    description: 'Adds automation slot capacity for running more modules at once.',
    baseMoneyCost: 12_000,
    costMultiplier: 2.75,
    maxLevel: 3,
    prestigePointCost: (level) => (level >= 1 ? 1 : 0),
    requirements: [{ type: 'upgrade', upgradeId: UpgradeId.AutomationServos, level: 2 }],
    getCurrentEffect: (level) => `${2 + level} active module slots`,
    getNextEffect: (level) => `${3 + level} active module slots`,
  },
  {
    id: UpgradeId.WarehouseRows,
    category: UpgradeCategory.Capacity,
    name: 'Warehouse Rows',
    description: 'Extends the live inventory capacity limit.',
    baseMoneyCost: 2_400,
    costMultiplier: 2.15,
    maxLevel: 5,
    getCurrentEffect: (level) => `+${level * 100} inventory slots`,
    getNextEffect: (level) => `+${(level + 1) * 100} inventory slots`,
  },
  {
    id: UpgradeId.RarityLuck,
    category: UpgradeCategory.Luck,
    name: 'Rarity Luck',
    description: 'Slightly boosts higher-rarity drop weights before odds are normalized.',
    baseMoneyCost: 25_000,
    costMultiplier: 3.2,
    maxLevel: 5,
    prestigePointCost: () => 1,
    requirements: [{ type: 'prestige', level: 1 }],
    getCurrentEffect: (level) =>
      level > 0 ? `+${formatPercent(level * 0.02)} rare-tier pressure` : 'Default rarity odds',
    getNextEffect: (level) => `+${formatPercent((level + 1) * 0.02)} rare-tier pressure`,
  },
]

export const upgradesById = new Map(UPGRADE_DEFINITIONS.map((upgrade) => [upgrade.id, upgrade]))

export function getUpgradePurchaseCost(definition: UpgradeDefinition, currentLevel: number): UpgradeCost {
  return {
    money: roundCurrency(definition.baseMoneyCost * definition.costMultiplier ** Math.max(0, currentLevel)),
    upgradePoints: definition.prestigePointCost?.(currentLevel) ?? 0,
  }
}

export function getUpgradeRequirementStatuses(
  definition: UpgradeDefinition,
  state: Pick<UpgradePurchaseSnapshot, 'achievements' | 'prestigeLevel' | 'upgrades'>,
): UpgradeRequirementStatus[] {
  const achievedIds = new Set(state.achievements.map((achievement) => achievement.id))

  return (definition.requirements ?? []).map((requirement) => {
    if (requirement.type === 'upgrade') {
      const requiredUpgrade = upgradesById.get(requirement.upgradeId)

      return {
        label: `${requiredUpgrade?.name ?? requirement.upgradeId} Lv ${requirement.level}`,
        met: getUpgradeLevel(state.upgrades, requirement.upgradeId) >= requirement.level,
      }
    }

    if (requirement.type === 'achievement') {
      return {
        label: requirement.label,
        met: achievedIds.has(requirement.achievementId),
      }
    }

    return {
      label: `Prestige ${requirement.level}`,
      met: state.prestigeLevel >= requirement.level,
    }
  })
}

export function canPurchaseUpgrade(definition: UpgradeDefinition, state: UpgradePurchaseSnapshot) {
  const level = getUpgradeLevel(state.upgrades, definition.id)
  const cost = getUpgradePurchaseCost(definition, level)
  const requirementStatuses = getUpgradeRequirementStatuses(definition, state)

  return {
    canAfford: state.money >= cost.money && state.upgradePoints >= cost.upgradePoints,
    cost,
    isMaxLevel: level >= definition.maxLevel,
    level,
    requirementsMet: requirementStatuses.every((requirement) => requirement.met),
    requirementStatuses,
  }
}

function weightedWearPick(distribution: WearDistributionEntry[], prng: Prng) {
  const totalWeight = distribution.reduce((total, entry) => total + entry.weight, 0)
  let targetWeight = Math.min(Math.max(prng(), 0), 1) * totalWeight

  for (const entry of distribution) {
    targetWeight -= entry.weight

    if (targetWeight < 0) {
      return entry.condition
    }
  }

  return distribution[distribution.length - 1]?.condition ?? WearCondition.FieldTested
}

export function randomWearConditionForSkinWithUpgrades(
  skin: SkinBase,
  upgrades: UpgradeLevels,
  prng: Prng = Math.random,
  extraBonusWeight = 0,
) {
  const level = getUpgradeLevel(upgrades, UpgradeId.WearTuning)
  const distribution = WEAR_DISTRIBUTIONS_BY_RARITY[skin.rarity]
  const bonusWeight = level * 2 + Math.max(0, extraBonusWeight)

  if (bonusWeight <= 0) {
    return weightedWearPick(distribution, prng)
  }

  const adjustedDistribution = distribution.map((entry) => {
    if (entry.condition === WearCondition.FactoryNew || entry.condition === WearCondition.MinimalWear) {
      return { ...entry, weight: entry.weight + bonusWeight }
    }

    if (entry.condition === WearCondition.WellWorn || entry.condition === WearCondition.BattleScarred) {
      return { ...entry, weight: Math.max(1, entry.weight - bonusWeight) }
    }

    return entry
  })

  return weightedWearPick(adjustedDistribution, prng)
}

export function applyUpgradeCaseCost(caseDef: CaseDefinition, upgrades: UpgradeLevels) {
  const discount = getCaseCostReduction(upgrades)

  if (discount <= 0) {
    return caseDef
  }

  return {
    ...caseDef,
    cost: Math.max(0.01, roundCurrency(caseDef.cost * (1 - discount))),
  }
}

export function applyUpgradeLuckToDropTable(
  dropTable: CaseDefinition['dropTable'],
  upgrades: UpgradeLevels,
  skinsById: Map<string, SkinBase>,
) {
  const luckBonus = getRarityLuckBonus(upgrades)
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

export function applyUpgradeEffectsToCase(
  caseDef: CaseDefinition,
  upgrades: UpgradeLevels,
  skinsById: Map<string, SkinBase>,
) {
  // Upgrade effects run after collection rewards: discounts multiply the current cost, luck renormalizes weights.
  const costAdjustedCase = applyUpgradeCaseCost(caseDef, upgrades)

  return {
    ...costAdjustedCase,
    dropTable: applyUpgradeLuckToDropTable(costAdjustedCase.dropTable, upgrades, skinsById),
  }
}

export function applyUpgradeEffectsToCases(
  caseDefinitions: CaseDefinition[],
  upgrades: UpgradeLevels,
  skinsById: Map<string, SkinBase>,
) {
  return caseDefinitions.map((caseDef) => applyUpgradeEffectsToCase(caseDef, upgrades, skinsById))
}
