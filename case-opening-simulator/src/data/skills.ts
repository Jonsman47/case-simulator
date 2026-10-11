import type { Prng } from './dropLogic'
import {
  Rarity,
  SkillNodeId,
  WearCondition,
  type CaseDefinition,
  type SkinBase,
} from './models'
import { WEAR_DISTRIBUTIONS_BY_RARITY, type WearDistributionEntry } from '../utils/wear'

export interface SkillTreeNodeDefinition {
  id: SkillNodeId
  name: string
  description: string
  cost: number
  prerequisites: SkillNodeId[]
  position: {
    x: number
    y: number
  }
  effectLabel: string
}

export type SkillBranchId =
  | 'opening'
  | 'minigame'
  | 'license'
  | 'trade_up'
  | 'passive_income'
  | 'inventory'
  | 'cosmetic'
  | 'auto_sell'
  | 'market'
  | 'luck'
  | 'prestige'
  | 'automation'
  | 'wear'

interface SkillBranchDefinition {
  id: SkillBranchId
  name: string
  description: string
  rootPrerequisite: SkillNodeId
  y: number
  effectLabel: (tier: number) => string
  tierNames: string[]
}

export interface SkillTreeSnapshot {
  learnedSkillNodeIds: SkillNodeId[]
  skillPoints: number
}

export interface SkillNodeStatus {
  canAfford: boolean
  canLearn: boolean
  hasPrerequisites: boolean
  isLearned: boolean
  missingPrerequisites: SkillNodeId[]
}

export const SKILL_TREE_NODE_WIDTH = 210
export const SKILL_TREE_NODE_HEIGHT = 132
export const GENERATED_SKILL_BRANCH_TIER_COUNT = 10
const generatedSkillStartX = 1_160
const generatedSkillColumnGap = 238

const CORE_SKILL_TREE_NODES: SkillTreeNodeDefinition[] = [
  {
    id: SkillNodeId.SellSpecialist,
    name: 'Sell Specialist',
    description: 'Tightens your market execution for a permanent sell value bonus.',
    cost: 1,
    prerequisites: [],
    position: { x: 80, y: 260 },
    effectLabel: '+2% sell value',
  },
  {
    id: SkillNodeId.WearWhisperer,
    name: 'Wear Whisperer',
    description: 'Improves opening rolls toward Factory New and Minimal Wear.',
    cost: 1,
    prerequisites: [],
    position: { x: 80, y: 430 },
    effectLabel: '+3 FN/MW wear roll weight',
  },
  {
    id: SkillNodeId.BulkAutomation,
    name: 'Bulk Automation',
    description: 'Adds an Auction House offer slot and trims automation intervals.',
    cost: 2,
    prerequisites: [SkillNodeId.SellSpecialist],
    position: { x: 360, y: 160 },
    effectLabel: '+1 Auction deal, 5% faster automation',
  },
  {
    id: SkillNodeId.TradeUpEdge,
    name: 'Trade-Up Edge',
    description: 'Treats trade-up input value as slightly cheaper in contract planning and automation.',
    cost: 2,
    prerequisites: [SkillNodeId.SellSpecialist],
    position: { x: 360, y: 320 },
    effectLabel: '5% lower trade-up input cost',
  },
  {
    id: SkillNodeId.MarketOracle,
    name: 'Market Oracle',
    description: 'Improves the chance of discovering timed gameplay and market events.',
    cost: 2,
    prerequisites: [SkillNodeId.SellSpecialist],
    position: { x: 360, y: 480 },
    effectLabel: '+1% event discovery chance',
  },
  {
    id: SkillNodeId.GoldenTouch,
    name: 'Golden Touch',
    description: 'Adds pressure toward knives, gloves, and mythic drops before odds normalize.',
    cost: 3,
    prerequisites: [SkillNodeId.WearWhisperer],
    position: { x: 640, y: 250 },
    effectLabel: '+8% special-item drop pressure',
  },
  {
    id: SkillNodeId.OfflineOperator,
    name: 'Offline Operator',
    description: 'Improves idle income while the browser is closed.',
    cost: 2,
    prerequisites: [SkillNodeId.BulkAutomation],
    position: { x: 640, y: 80 },
    effectLabel: '+15% offline case farm earnings',
  },
  {
    id: SkillNodeId.EventHunter,
    name: 'Event Hunter',
    description: 'Increases the chance that timed market events are scheduled.',
    cost: 2,
    prerequisites: [SkillNodeId.MarketOracle],
    position: { x: 640, y: 500 },
    effectLabel: '+2% market event schedule chance',
  },
  {
    id: SkillNodeId.PrestigeScholar,
    name: 'Prestige Scholar',
    description: 'Turns strong resets into more long-term points.',
    cost: 3,
    prerequisites: [SkillNodeId.GoldenTouch, SkillNodeId.OfflineOperator],
    position: { x: 880, y: 250 },
    effectLabel: '+15% prestige point yield',
  },
]

const branchTierNames = [
  'Apprentice',
  'Assistant',
  'Coordinator',
  'Technician',
  'Supervisor',
  'Specialist',
  'Architect',
  'Director',
  'Master',
  'Legend',
]

const SKILL_BRANCH_DEFINITIONS: SkillBranchDefinition[] = [
  {
    id: 'opening',
    name: 'Opening Line',
    description: 'Polishes high-volume opening flow, reveal pacing, and advanced batch-size control.',
    rootPrerequisite: SkillNodeId.BulkAutomation,
    y: 20,
    effectLabel: (tier) => `+${tier * 4}% opening polish, +${Math.floor(tier / 2) * 10} max batch`,
    tierNames: branchTierNames,
  },
  {
    id: 'automation',
    name: 'Automation Grid',
    description: 'Reduces automation friction and gradually expands Auction House offers.',
    rootPrerequisite: SkillNodeId.BulkAutomation,
    y: 165,
    effectLabel: (tier) => `${tier * 1.2}% faster automation, +${Math.floor(tier / 4)} Auction deals`,
    tierNames: branchTierNames,
  },
  {
    id: 'minigame',
    name: 'Side Job Route',
    description: 'Improves the hourly recovery job so zero-cash runs can climb back faster.',
    rootPrerequisite: SkillNodeId.SellSpecialist,
    y: 310,
    effectLabel: (tier) => `+${tier * 12}% side-job reward`,
    tierNames: branchTierNames,
  },
  {
    id: 'license',
    name: 'License Broker',
    description: 'Negotiates permanent case-license discounts without removing the progression gate.',
    rootPrerequisite: SkillNodeId.SellSpecialist,
    y: 455,
    effectLabel: (tier) => `${(tier * 1.5).toFixed(1)}% license discount`,
    tierNames: branchTierNames,
  },
  {
    id: 'auto_sell',
    name: 'Auto-Sell Desk',
    description: 'Improves automated sale execution as late-game costs climb.',
    rootPrerequisite: SkillNodeId.MarketOracle,
    y: 600,
    effectLabel: (tier) => `+${(tier * 0.6).toFixed(1)}% sell value`,
    tierNames: branchTierNames,
  },
  {
    id: 'market',
    name: 'Market Lab',
    description: 'Improves timed gameplay and market event discovery.',
    rootPrerequisite: SkillNodeId.MarketOracle,
    y: 745,
    effectLabel: (tier) => `+${(tier * 0.3).toFixed(1)}% event discovery chance`,
    tierNames: branchTierNames,
  },
  {
    id: 'trade_up',
    name: 'Contract Math',
    description: 'Makes trade-up planning and automation more forgiving without guaranteeing profit.',
    rootPrerequisite: SkillNodeId.TradeUpEdge,
    y: 890,
    effectLabel: (tier) => `${(tier * 1.5).toFixed(1)}% lower trade-up input risk`,
    tierNames: branchTierNames,
  },
  {
    id: 'passive_income',
    name: 'Case Farm Grid',
    description: 'Scales passive income modestly so idle play helps but does not beat opening forever.',
    rootPrerequisite: SkillNodeId.OfflineOperator,
    y: 1_035,
    effectLabel: (tier) => `+${tier * 5}% passive and offline income`,
    tierNames: branchTierNames,
  },
  {
    id: 'inventory',
    name: 'Showcase Logistics',
    description: 'Adds Trophy Room showcase slots and live inventory capacity.',
    rootPrerequisite: SkillNodeId.BulkAutomation,
    y: 1_180,
    effectLabel: (tier) => `+${tier * 4} Trophy Room slots, +${tier * 150} inventory slots`,
    tierNames: branchTierNames,
  },
  {
    id: 'wear',
    name: 'Float Tuning',
    description: 'Gradually shifts wear rolls toward cleaner floats.',
    rootPrerequisite: SkillNodeId.WearWhisperer,
    y: 1_325,
    effectLabel: (tier) => `+${tier} FN/MW wear weight`,
    tierNames: branchTierNames,
  },
  {
    id: 'luck',
    name: 'Gold Pressure',
    description: 'Adds a tiny amount of special-tier pressure before odds normalize.',
    rootPrerequisite: SkillNodeId.GoldenTouch,
    y: 1_470,
    effectLabel: (tier) => `+${(tier * 0.6).toFixed(1)}% special pressure`,
    tierNames: branchTierNames,
  },
  {
    id: 'prestige',
    name: 'Prestige Engine',
    description: 'Makes harder prestige loops pay out more permanent momentum.',
    rootPrerequisite: SkillNodeId.PrestigeScholar,
    y: 1_615,
    effectLabel: (tier) => `+${tier * 2}% prestige point yield`,
    tierNames: branchTierNames,
  },
  {
    id: 'cosmetic',
    name: 'Showcase Studio',
    description: 'Cosmetic flair for reveals, trophy displays, and long-run identity.',
    rootPrerequisite: SkillNodeId.GoldenTouch,
    y: 1_760,
    effectLabel: (tier) => `Cosmetic intensity tier ${tier}`,
    tierNames: branchTierNames,
  },
]

export const SKILL_BRANCH_IDS = SKILL_BRANCH_DEFINITIONS.map((branch) => branch.id)

function createBranchSkillNodeId(branchId: SkillBranchId, tier: number) {
  return `${branchId}_${tier}` as SkillNodeId
}

function getGeneratedSkillCost(tier: number) {
  // Costs are intentionally slow-rising for the 500-600 hour target: early branch
  // identity is cheap, while maxing every branch consumes many prestige loops.
  return 1 + Math.floor((tier - 1) / 3) + (tier >= 9 ? 1 : 0)
}

function createGeneratedSkillNodes() {
  return SKILL_BRANCH_DEFINITIONS.flatMap((branch) => {
    return Array.from({ length: GENERATED_SKILL_BRANCH_TIER_COUNT }, (_, index) => {
      const tier = index + 1
      const id = createBranchSkillNodeId(branch.id, tier)
      const previousTierId = tier > 1 ? createBranchSkillNodeId(branch.id, tier - 1) : undefined

      return {
        id,
        name: `${branch.name} ${tier}: ${branch.tierNames[index] ?? `Tier ${tier}`}`,
        description: branch.description,
        cost: getGeneratedSkillCost(tier),
        prerequisites: previousTierId ? [previousTierId] : [branch.rootPrerequisite],
        position: {
          x: generatedSkillStartX + (tier - 1) * generatedSkillColumnGap,
          y: branch.y,
        },
        effectLabel: branch.effectLabel(tier),
      } satisfies SkillTreeNodeDefinition
    })
  })
}

const GENERATED_SKILL_TREE_NODES = createGeneratedSkillNodes()

export const SKILL_TREE_NODES: SkillTreeNodeDefinition[] = [
  ...CORE_SKILL_TREE_NODES,
  ...GENERATED_SKILL_TREE_NODES,
]

export const SKILL_TREE_GRAPH_WIDTH =
  generatedSkillStartX +
  GENERATED_SKILL_BRANCH_TIER_COUNT * generatedSkillColumnGap +
  SKILL_TREE_NODE_WIDTH
export const SKILL_TREE_GRAPH_HEIGHT = 1_940

export const skillTreeNodesById = new Map(SKILL_TREE_NODES.map((node) => [node.id, node]))

const highRarityDropPressure: Partial<Record<Rarity, number>> = {
  [Rarity.Covert]: 0.04,
  [Rarity.SpecialItem]: 0.08,
  [Rarity.Contraband]: 0.08,
}

function hasSkill(learnedSkillNodeIds: SkillNodeId[], skillNodeId: SkillNodeId) {
  return learnedSkillNodeIds.includes(skillNodeId)
}

function getLearnedBranchTier(learnedSkillNodeIds: SkillNodeId[], branchId: SkillBranchId) {
  const prefix = `${branchId}_`

  return learnedSkillNodeIds.reduce((highestTier, nodeId) => {
    const rawNodeId = String(nodeId)

    if (!rawNodeId.startsWith(prefix)) {
      return highestTier
    }

    const tier = Number(rawNodeId.slice(prefix.length))

    return Number.isFinite(tier) ? Math.max(highestTier, Math.floor(tier)) : highestTier
  }, 0)
}

export function getSkillBranchTier(learnedSkillNodeIds: SkillNodeId[], branchId: SkillBranchId) {
  return getLearnedBranchTier(learnedSkillNodeIds, branchId)
}

function weightedWearPick(distribution: WearDistributionEntry[], prng: Prng) {
  const totalWeight = distribution.reduce((total, entry) => total + Math.max(0, entry.weight), 0)

  if (totalWeight <= 0) {
    return WearCondition.FieldTested
  }

  let targetWeight = Math.min(Math.max(prng(), 0), 1) * totalWeight

  for (const entry of distribution) {
    targetWeight -= Math.max(0, entry.weight)

    if (targetWeight < 0) {
      return entry.condition
    }
  }

  return distribution[distribution.length - 1]?.condition ?? WearCondition.FieldTested
}

export function createDefaultLearnedSkillNodeIds(): SkillNodeId[] {
  return []
}

export function normalizeLearnedSkillNodeIds(value: unknown): SkillNodeId[] {
  if (!Array.isArray(value)) {
    return createDefaultLearnedSkillNodeIds()
  }

  const validIds = new Set(SKILL_TREE_NODES.map((node) => node.id))

  return Array.from(
    new Set(value.filter((entry): entry is SkillNodeId => validIds.has(entry as SkillNodeId))),
  )
}

export function getSkillNodeStatus(
  definition: SkillTreeNodeDefinition,
  snapshot: SkillTreeSnapshot,
): SkillNodeStatus {
  const learnedIds = new Set(snapshot.learnedSkillNodeIds)
  const missingPrerequisites = definition.prerequisites.filter(
    (prerequisiteId) => !learnedIds.has(prerequisiteId),
  )
  const isLearned = learnedIds.has(definition.id)
  const canAfford = snapshot.skillPoints >= definition.cost
  const hasPrerequisites = missingPrerequisites.length === 0

  return {
    canAfford,
    canLearn: !isLearned && canAfford && hasPrerequisites,
    hasPrerequisites,
    isLearned,
    missingPrerequisites,
  }
}

export function getSkillSellMultiplier(learnedSkillNodeIds: SkillNodeId[]) {
  const baseBonus = hasSkill(learnedSkillNodeIds, SkillNodeId.SellSpecialist) ? 0.02 : 0
  const autoSellBonus = getLearnedBranchTier(learnedSkillNodeIds, 'auto_sell') * 0.006
  const marketBonus = getLearnedBranchTier(learnedSkillNodeIds, 'market') * 0.003

  return 1 + baseBonus + autoSellBonus + marketBonus
}

export function getSkillAutomationIntervalMultiplier(learnedSkillNodeIds: SkillNodeId[]) {
  const baseReduction = hasSkill(learnedSkillNodeIds, SkillNodeId.BulkAutomation) ? 0.05 : 0
  const branchReduction =
    getLearnedBranchTier(learnedSkillNodeIds, 'automation') * 0.012 +
    getLearnedBranchTier(learnedSkillNodeIds, 'opening') * 0.004

  return 1 - Math.min(0.24, baseReduction + branchReduction)
}

export function getSkillAuctionDealSlotBonus(learnedSkillNodeIds: SkillNodeId[]) {
  const baseSlots = hasSkill(learnedSkillNodeIds, SkillNodeId.BulkAutomation) ? 1 : 0

  return baseSlots + Math.floor(getLearnedBranchTier(learnedSkillNodeIds, 'automation') / 4)
}

export function getSkillWearBonusWeight(learnedSkillNodeIds: SkillNodeId[]) {
  return (hasSkill(learnedSkillNodeIds, SkillNodeId.WearWhisperer) ? 3 : 0) +
    getLearnedBranchTier(learnedSkillNodeIds, 'wear')
}

export function getSkillTradeUpInputCostMultiplier(learnedSkillNodeIds: SkillNodeId[]) {
  const baseReduction = hasSkill(learnedSkillNodeIds, SkillNodeId.TradeUpEdge) ? 0.05 : 0
  const branchReduction = Math.min(0.15, getLearnedBranchTier(learnedSkillNodeIds, 'trade_up') * 0.015)

  return 1 - Math.min(0.22, baseReduction + branchReduction)
}

export function getSkillMarketKnowledgeBonus(learnedSkillNodeIds: SkillNodeId[]) {
  return (hasSkill(learnedSkillNodeIds, SkillNodeId.MarketOracle) ? 0.01 : 0) +
    getLearnedBranchTier(learnedSkillNodeIds, 'market') * 0.003
}

export function getSkillOfflineEarningsMultiplier(learnedSkillNodeIds: SkillNodeId[]) {
  return (hasSkill(learnedSkillNodeIds, SkillNodeId.OfflineOperator) ? 1.15 : 1) *
    (1 + getLearnedBranchTier(learnedSkillNodeIds, 'passive_income') * 0.05)
}

export function getSkillEventChanceBonus(learnedSkillNodeIds: SkillNodeId[]) {
  return (hasSkill(learnedSkillNodeIds, SkillNodeId.EventHunter) ? 0.02 : 0) +
    getLearnedBranchTier(learnedSkillNodeIds, 'market') * 0.002
}

export function getSkillPrestigePointMultiplier(learnedSkillNodeIds: SkillNodeId[]) {
  return (hasSkill(learnedSkillNodeIds, SkillNodeId.PrestigeScholar) ? 1.15 : 1) *
    (1 + getLearnedBranchTier(learnedSkillNodeIds, 'prestige') * 0.02)
}

export function getSkillSpecialDropPressure(learnedSkillNodeIds: SkillNodeId[]) {
  return (hasSkill(learnedSkillNodeIds, SkillNodeId.GoldenTouch) ? 0.08 : 0) +
    getLearnedBranchTier(learnedSkillNodeIds, 'luck') * 0.006
}

export function getSkillLicenseDiscount(learnedSkillNodeIds: SkillNodeId[]) {
  return Math.min(0.25, getLearnedBranchTier(learnedSkillNodeIds, 'license') * 0.015)
}

export function getSkillMinigameRewardMultiplier(learnedSkillNodeIds: SkillNodeId[]) {
  return 1 + getLearnedBranchTier(learnedSkillNodeIds, 'minigame') * 0.12
}

export function getSkillPassiveIncomeMultiplier(learnedSkillNodeIds: SkillNodeId[]) {
  return 1 + getLearnedBranchTier(learnedSkillNodeIds, 'passive_income') * 0.05
}

export function getSkillInventoryCapacityBonus(learnedSkillNodeIds: SkillNodeId[]) {
  return getLearnedBranchTier(learnedSkillNodeIds, 'inventory') * 150
}

export function getSkillTrophySlotBonus(learnedSkillNodeIds: string[]) {
  return getLearnedBranchTier(learnedSkillNodeIds as SkillNodeId[], 'inventory') * 4
}

export function getSkillOpeningFlowBonus(learnedSkillNodeIds: SkillNodeId[]) {
  return getLearnedBranchTier(learnedSkillNodeIds, 'opening') * 0.04
}

export function getSkillMultiOpenBatchBonus(learnedSkillNodeIds: SkillNodeId[]) {
  // Every other Opening Line tier grants another ten-case batch button. Keeping
  // the bonus here makes the expanded skill tree part of the case-opening cap
  // without forcing the base upgrade shop to show late-game buttons immediately.
  return Math.floor(getLearnedBranchTier(learnedSkillNodeIds, 'opening') / 2) * 10
}

export function getSkillCosmeticTier(learnedSkillNodeIds: SkillNodeId[]) {
  return getLearnedBranchTier(learnedSkillNodeIds, 'cosmetic')
}

export function getSkillEffectSummaries(learnedSkillNodeIds: SkillNodeId[]) {
  const learnedIds = new Set(learnedSkillNodeIds)

  return SKILL_TREE_NODES
    .filter((definition) => learnedIds.has(definition.id))
    .map((definition) => definition.effectLabel)
}

export function randomWearConditionForSkinWithSkills(
  skin: SkinBase,
  learnedSkillNodeIds: SkillNodeId[],
  prng: Prng = Math.random,
) {
  const bonusWeight = getSkillWearBonusWeight(learnedSkillNodeIds)
  const distribution = WEAR_DISTRIBUTIONS_BY_RARITY[skin.rarity]

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

export function applySkillLuckToDropTable(
  dropTable: CaseDefinition['dropTable'],
  learnedSkillNodeIds: SkillNodeId[],
  skinsById: Map<string, SkinBase>,
) {
  const specialDropPressure = getSkillSpecialDropPressure(learnedSkillNodeIds)
  const originalTotal = dropTable.reduce((total, drop) => total + Math.max(0, drop.weight), 0)

  if (specialDropPressure <= 0 || originalTotal <= 0) {
    return dropTable
  }

  const boostedTable = dropTable.map((drop) => {
    const skin = skinsById.get(drop.skinId)
    const rarityPressure = skin ? highRarityDropPressure[skin.rarity] ?? 0 : 0
    const pressureRatio = specialDropPressure > 0 ? rarityPressure / 0.08 : 0

    return {
      ...drop,
      weight: Math.max(0, drop.weight) * (1 + specialDropPressure * pressureRatio),
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

export function applySkillEffectsToCase(
  caseDef: CaseDefinition,
  learnedSkillNodeIds: SkillNodeId[],
  skinsById: Map<string, SkinBase>,
) {
  // Skill luck stacks after collection rewards, run upgrades, and prestige, then renormalizes odds.
  return {
    ...caseDef,
    dropTable: applySkillLuckToDropTable(caseDef.dropTable, learnedSkillNodeIds, skinsById),
  }
}

export function applySkillEffectsToCases(
  caseDefinitions: CaseDefinition[],
  learnedSkillNodeIds: SkillNodeId[],
  skinsById: Map<string, SkinBase>,
) {
  return caseDefinitions.map((caseDef) => applySkillEffectsToCase(caseDef, learnedSkillNodeIds, skinsById))
}
