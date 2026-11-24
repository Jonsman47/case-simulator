import type { GameState } from './gameState'
import {
  Rarity,
  WearCondition,
  type Achievement,
  type AchievementCategory,
  type AchievementDisplayCategory,
  type AchievementProgress,
  type PlayerState,
} from './models'
import { SKIN_DEFINITIONS } from './skins'
import { createTrophySlotDefinitions, getTrophyAssignmentsList, getTrophyRoomSlotCount } from '../utils/trophyRoom'
import { isExceptionalPattern } from '../utils/skinPatterns'
import { getPossibleWearFloatRangesForSkin } from '../utils/wear'
import { getCareerLevelFromXp } from '../career/careerProgress'
import { EMPLOYEE_ROLE_IDS } from '../business/business'

const skinDefinitionsById = new Map(SKIN_DEFINITIONS.map((skin) => [skin.id, skin]))

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  'Opening',
  'Drops',
  'Inventory',
  'Trade Ups',
  'Progression',
  'Collection',
  'Automation',
  'Trophy Room',
]

export const ACHIEVEMENT_DISPLAY_CATEGORIES: AchievementDisplayCategory[] = [
  'Case Opening',
  'Trading',
  'Collecting',
  'Trade-Ups',
  'Business',
  'Career & Prestige',
]

const displayCategoryByLegacyCategory: Record<AchievementCategory, AchievementDisplayCategory> = {
  Opening: 'Case Opening',
  Drops: 'Collecting',
  Inventory: 'Collecting',
  'Trade Ups': 'Trade-Ups',
  Progression: 'Career & Prestige',
  Collection: 'Collecting',
  Automation: 'Business',
  'Trophy Room': 'Collecting',
}

export function getAchievementDisplayCategory(achievement: Achievement) {
  return achievement.displayCategory ?? displayCategoryByLegacyCategory[achievement.category]
}

export function getAchievementScope(achievement: Achievement) {
  return achievement.scope ?? 'lifetime'
}

function hasDiscoveredRarity(state: PlayerState, rarity: Rarity) {
  return state.collectionBook.some((entry) => skinDefinitionsById.get(entry.skinId)?.rarity === rarity)
}

function hasFactoryNewCovert(state: PlayerState) {
  return state.collectionBook.some((entry) => {
    return (
      skinDefinitionsById.get(entry.skinId)?.rarity === Rarity.Covert &&
      entry.foundWearConditions.includes(WearCondition.FactoryNew)
    )
  })
}

function hasItemValueAtLeast(state: PlayerState, value: number) {
  return (
    state.inventory.some((item) => item.marketValue >= value) ||
    state.collectionBook.some((entry) => (entry.highestValue ?? 0) >= value)
  )
}


function isCatalogComplete(state: PlayerState) {
  const discoveredSkinIds = new Set(state.collectionBook.map((entry) => entry.skinId))

  return SKIN_DEFINITIONS.every((skin) => discoveredSkinIds.has(skin.id))
}

function isWearCatalogComplete(state: PlayerState) {
  const entriesBySkinId = new Map(state.collectionBook.map((entry) => [entry.skinId, entry]))

  return SKIN_DEFINITIONS.every((skin) => {
    const entry = entriesBySkinId.get(skin.id)

    const obtainableWear = Object.keys(getPossibleWearFloatRangesForSkin(skin)) as WearCondition[]
    return obtainableWear.every((wear) => entry?.foundWearConditions.includes(wear))
  })
}

export function getObtainableWearVariantCount() {
  return SKIN_DEFINITIONS.reduce(
    (total, skin) => total + Object.keys(getPossibleWearFloatRangesForSkin(skin)).length,
    0,
  )
}

export function getDiscoveredObtainableWearVariantCount(state: PlayerState) {
  const entriesBySkinId = new Map(state.collectionBook.map((entry) => [entry.skinId, entry]))
  return SKIN_DEFINITIONS.reduce((total, skin) => {
    const entry = entriesBySkinId.get(skin.id)
    const obtainableWear = Object.keys(getPossibleWearFloatRangesForSkin(skin)) as WearCondition[]
    return total + obtainableWear.filter((wear) => entry?.foundWearConditions.includes(wear)).length
  }, 0)
}

function hasFilledAllTrophySlots(state: PlayerState) {
  return createTrophySlotDefinitions(getTrophyRoomSlotCount(state.learnedSkillNodeIds, state.careerUpgrades))
    .every((slot) => Boolean(state.trophyAssignments[slot.id]))
}

function hasEliteTrophyRoom(state: PlayerState) {
  const assignments = getTrophyAssignmentsList(state.trophyAssignments)
  const slotCount = getTrophyRoomSlotCount(state.learnedSkillNodeIds, state.careerUpgrades)
  const inventoryById = new Map(state.inventory.map((item) => [item.instanceId, item]))

  return (
    assignments.length >= slotCount &&
    assignments.every((assignment) => {
      const item = inventoryById.get(assignment.itemId)

      return (
        item &&
        (
          item.wear === WearCondition.FactoryNew ||
          item.rarity === Rarity.SpecialItem ||
          item.rarity === Rarity.Contraband
        )
      )
    })
  )
}

function getLedgerValue(
  state: PlayerState,
  scope: 'lifetime' | 'currentRun',
  key: 'realizedTradingProfit' | 'tradeUpInputValue' | 'tradeUpOutputValue' | 'businessRevenue' | 'businessExpenses',
) {
  return state.economyLedger?.[scope]?.[key] ?? 0
}

function getLifetimeCount(state: PlayerState, key: 'casesOpened' | 'moneySpent' | 'tradeUpsCompleted' | 'auctionPurchases') {
  return (state.achievementLifetime?.[key] ?? 0) + state.statistics[key]
}

function getLifetimeRarityDrops(state: PlayerState, rarity: Rarity) {
  return (state.achievementLifetime?.dropsByRarity[rarity] ?? 0) + (state.statistics.dropsByRarity[rarity] ?? 0)
}

function getMarketplaceNegotiationCount(state: PlayerState) {
  return state.marketplace?.transactions.filter((transaction) => (
    transaction.type === 'negotiated-purchase' || transaction.type === 'negotiated-sale'
  )).length ?? 0
}

function getHiredEmployeeCount(state: PlayerState) {
  return state.business
    ? EMPLOYEE_ROLE_IDS.filter((roleId) => state.business?.employees[roleId].isHired).length
    : 0
}

function getBusinessOperationCount(state: PlayerState) {
  return state.business
    ? EMPLOYEE_ROLE_IDS.reduce(
        (total, roleId) => total + state.business!.employees[roleId].completedOperationCount,
        0,
      )
    : 0
}

function getBusinessTrainingLevels(state: PlayerState) {
  return state.business
    ? EMPLOYEE_ROLE_IDS.reduce(
        (total, roleId) => total + state.business!.employees[roleId].trainingLevel,
        0,
      )
    : 0
}

function getCareerHighestLevel(state: PlayerState) {
  const historyLevel = state.career?.rankHistory.reduce((highest, entry) => Math.max(highest, entry.level), 1) ?? 1
  return Math.max(historyLevel, getCareerLevelFromXp(state.career?.currentRunXp ?? 0))
}

function getCareerCurrentLevel(state: PlayerState) {
  return getCareerLevelFromXp(state.career?.currentRunXp ?? 0)
}

function getUniqueCurrentRunDiscoveries(state: PlayerState) {
  return new Set((state.currentRunCollectionBook ?? []).map((entry) => entry.skinId)).size
}

function getUniqueLifetimeDiscoveries(state: PlayerState) {
  return new Set(state.collectionBook.map((entry) => entry.skinId)).size
}

function getPrestigePerkLevels(state: PlayerState) {
  return state.prestigeSystem
    ? Object.values(state.prestigeSystem.perkLevels).reduce((total, level) => total + level, 0)
    : 0
}

function getLegacyVaultRecord(state: PlayerState) {
  return state.prestigeSystem?.runHistory.reduce(
    (highest, run) => Math.max(highest, run.vaultedItemIds.length),
    0,
  ) ?? 0
}

const BASE_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_case_opened',
    name: 'First Crack',
    description: 'Open your first case.',
    category: 'Opening',
    condition: (state) => getLifetimeCount(state, 'casesOpened') >= 1,
    reward: { money: 10 },
  },
  {
    id: 'cases_opened_100',
    name: 'Case Regular',
    description: 'Open 100 cases.',
    category: 'Opening',
    condition: (state) => getLifetimeCount(state, 'casesOpened') >= 100,
    reward: { upgradePoints: 1, skillPoints: 1 },
  },
  {
    id: 'cases_opened_10000',
    name: 'Unbox Machine',
    description: 'Open 10,000 cases.',
    category: 'Opening',
    condition: (state) => getLifetimeCount(state, 'casesOpened') >= 10_000,
    reward: { upgradePoints: 5, badge: 'Unbox Machine' },
  },
  {
    id: 'first_profit_case',
    name: 'First Realized Profit',
    description: 'Complete a sale with positive realized profit after known acquisition cost.',
    category: 'Progression',
    displayCategory: 'Trading',
    condition: (state) => getLedgerValue(state, 'lifetime', 'realizedTradingProfit') > 0,
    getProgress: (state) => Math.max(0, getLedgerValue(state, 'lifetime', 'realizedTradingProfit')),
    target: 0.01,
    reward: { money: 25 },
  },
  {
    id: 'first_covert',
    name: 'Red Reveal',
    description: 'Find your first Covert skin.',
    category: 'Drops',
    condition: (state) =>
      state.statistics.dropsByRarity[Rarity.Covert] > 0 || hasDiscoveredRarity(state, Rarity.Covert),
    reward: { money: 75, badge: 'Red Reveal' },
  },
  {
    id: 'first_special_item',
    name: 'Gold Flash',
    description: 'Find your first Special Item.',
    category: 'Drops',
    condition: (state) =>
      state.statistics.dropsByRarity[Rarity.SpecialItem] > 0 ||
      hasDiscoveredRarity(state, Rarity.SpecialItem),
    reward: { upgradePoints: 2, skillPoints: 1, badge: 'Gold Flash' },
  },
  {
    id: 'factory_new_covert',
    name: 'Pristine Red',
    description: 'Find a Factory New Covert skin.',
    category: 'Drops',
    condition: hasFactoryNewCovert,
    reward: { money: 250 },
  },
  {
    id: 'first_exceptional_pattern',
    name: 'Pattern Hunter',
    description: 'Find an exceptional or iconic paint pattern.',
    category: 'Drops',
    condition: (state) =>
      state.statistics.exceptionalPatternDrops >= 1 || state.inventory.some(isExceptionalPattern),
    reward: { upgradePoints: 2, skillPoints: 1, badge: 'Pattern Hunter' },
  },
  {
    id: 'first_100_value_item',
    name: 'Triple Digits',
    description: 'Acquire an item estimated at $100 or more, including a market purchase.',
    category: 'Inventory',
    condition: (state) => hasItemValueAtLeast(state, 100),
    reward: { money: 100 },
  },
  {
    id: 'inventory_value_1k',
    name: 'Four-Figure Stash',
    description: 'Reach $1,000 inventory value.',
    category: 'Inventory',
    condition: (state) => state.inventoryValue >= 1_000,
    reward: { upgradePoints: 1 },
  },
  {
    id: 'inventory_value_100k',
    name: 'Vault Builder',
    description: 'Reach $100,000 inventory value.',
    category: 'Inventory',
    condition: (state) => state.inventoryValue >= 100_000,
    reward: { upgradePoints: 3 },
  },
  {
    id: 'inventory_value_1m',
    name: 'Million Dollar Loadout',
    description: 'Reach $1,000,000 inventory value.',
    category: 'Inventory',
    condition: (state) => state.inventoryValue >= 1_000_000,
    reward: { upgradePoints: 10, badge: 'Million Dollar Loadout' },
  },
  {
    id: 'first_trade_up',
    name: 'Contract Signed',
    description: 'Complete your first trade-up contract.',
    category: 'Trade Ups',
    condition: (state) => getLifetimeCount(state, 'tradeUpsCompleted') >= 1,
    reward: { money: 50 },
  },
  {
    id: 'first_prestige',
    name: 'Fresh Start',
    description: 'Prestige for the first time.',
    category: 'Progression',
    condition: (state) => state.prestigeLevel >= 1,
    reward: { upgradePoints: 2, skillPoints: 1, badge: 'Fresh Start' },
  },
  {
    id: 'prestige_five',
    name: 'Five Lives',
    description: 'Reach prestige level 5.',
    category: 'Progression',
    condition: (state) => state.prestigeLevel >= 5,
    reward: { upgradePoints: 5, badge: 'Five Lives' },
  },
  {
    id: 'collection_catalog_complete',
    name: 'Catalog Complete',
    description: 'Discover every catalog skin at least once.',
    category: 'Collection',
    condition: isCatalogComplete,
    reward: { upgradePoints: 3, skillPoints: 2, badge: 'Catalog Complete' },
  },
  {
    id: 'collection_wear_master',
    name: 'Wear Master',
    description: 'Discover every genuinely obtainable catalog wear variant.',
    category: 'Collection',
    condition: isWearCatalogComplete,
    getProgress: getDiscoveredObtainableWearVariantCount,
    target: getObtainableWearVariantCount(),
    reward: { upgradePoints: 8, badge: 'Wear Master' },
  },
  {
    id: 'automation_started',
    name: 'Hands Off (Legacy)',
    description: 'Purchased an automation upgrade before employees replaced legacy automation.',
    category: 'Automation',
    condition: () => false,
    isRetired: true,
    getBlockedReason: () => 'Retired legacy milestone. Previously completed records remain permanent.',
    reward: { money: 100 },
  },
  {
    id: 'automation_100_runs',
    name: 'Factory Floor (Legacy)',
    description: 'Reached 100 legacy automation runs before the Business migration.',
    category: 'Automation',
    condition: () => false,
    isRetired: true,
    getBlockedReason: () => 'Retired legacy milestone. Business operations use new achievements.',
    reward: { upgradePoints: 2 },
  },
  {
    id: 'auction_first_purchase',
    name: 'Deal Closed',
    description: 'Purchase your first simulated Auction House offer.',
    category: 'Automation',
    condition: (state) => getLifetimeCount(state, 'auctionPurchases') >= 1,
    reward: { money: 50 },
  },
  {
    id: 'trophy_room_complete',
    name: 'Hall of Fame',
    description: 'Fill every Trophy Room slot.',
    category: 'Trophy Room',
    condition: hasFilledAllTrophySlots,
    reward: { skillPoints: 1, badge: 'Hall of Fame' },
  },
  {
    id: 'trophy_room_elite',
    name: 'Museum Grade',
    description: 'Fill every Trophy Room slot with Factory New or Special-tier displays.',
    category: 'Trophy Room',
    condition: hasEliteTrophyRoom,
    reward: { upgradePoints: 2, skillPoints: 2, badge: 'Museum Grade' },
  },
]

function formatMilestone(value: number) {
  if (value >= 1_000_000) {
    return `${value / 1_000_000}M`
  }

  if (value >= 1_000) {
    return `${value / 1_000}K`
  }

  return value.toLocaleString()
}

function getRarityLabel(rarity: Rarity) {
  return rarity.replace(/([a-z])([A-Z])/g, '$1 $2')
}

function hasDiscoveredEverySkinOfRarity(state: PlayerState, rarity: Rarity) {
  const discoveredSkinIds = new Set(state.collectionBook.map((entry) => entry.skinId))
  const targetSkins = SKIN_DEFINITIONS.filter((skin) => skin.rarity === rarity)

  return targetSkins.length > 0 && targetSkins.every((skin) => discoveredSkinIds.has(skin.id))
}

function hasDiscoveredWearForRarity(state: PlayerState, rarity: Rarity, wear: WearCondition) {
  return state.collectionBook.some((entry) => {
    return skinDefinitionsById.get(entry.skinId)?.rarity === rarity &&
      entry.foundWearConditions.includes(wear)
  })
}

function getCollectionCompletionRatio(state: PlayerState) {
  if (SKIN_DEFINITIONS.length === 0) {
    return 0
  }

  return new Set(state.collectionBook.map((entry) => entry.skinId)).size / SKIN_DEFINITIONS.length
}

function hasDiscoveredAllCovertAndSpecial(state: PlayerState) {
  return hasDiscoveredEverySkinOfRarity(state, Rarity.Covert) &&
    hasDiscoveredEverySkinOfRarity(state, Rarity.SpecialItem)
}

const openingMilestones = [10, 25, 50, 250, 500, 1_000, 2_500, 5_000, 25_000, 50_000, 100_000]
const moneySpentMilestones = [100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000]
const moneyEarnedMilestones = [100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000]
const inventoryValueMilestones = [10_000, 50_000, 250_000, 10_000_000, 100_000_000]
const tradeUpMilestones = [5, 25, 100, 500, 2_500, 10_000]
const automationMilestones = [10, 1_000, 10_000, 100_000, 1_000_000]
const totalUpgradeMilestones = [5, 15, 30, 50]
const skillMilestones = [5, 15, 30, 60, 100, 139]
const prestigeMilestones = [2, 10, 25, 50]
const collectionMilestones = [0.1, 0.25, 0.5, 0.75, 0.9]

const openingAchievementMilestones: Achievement[] = openingMilestones.map((target) => ({
  id: `cases_opened_${target}`,
  name: `${formatMilestone(target)} Cases`,
  description: `Open ${target.toLocaleString()} cases.`,
  category: 'Opening',
  condition: (state) => getLifetimeCount(state, 'casesOpened') >= target,
  getProgress: (state) => getLifetimeCount(state, 'casesOpened'),
  target,
  reward: target >= 25_000
    ? { upgradePoints: 4, skillPoints: 3, badge: `${formatMilestone(target)} Cases` }
    : target >= 1_000
      ? { upgradePoints: 2, skillPoints: 1 }
      : { money: Math.max(10, Math.round(target * 0.2)) },
}))

const spendingAchievements: Achievement[] = moneySpentMilestones.map((target) => ({
  id: `money_spent_${target}`,
  name: `${formatMilestone(target)} Spent`,
  description: `Spend $${target.toLocaleString()} cash on tracked openings, purchases, upgrades, and Business costs. Case Opening Funds do not count.`,
  category: 'Progression',
  condition: (state) => getLifetimeCount(state, 'moneySpent') >= target,
  getProgress: (state) => getLifetimeCount(state, 'moneySpent'),
  target,
  reward: target >= 1_000_000 ? { skillPoints: 2, badge: `${formatMilestone(target)} Spent` } : { money: Math.min(5_000, target * 0.01) },
}))

const earningAchievements: Achievement[] = moneyEarnedMilestones.map((target) => ({
  id: `money_earned_${target}`,
  name: `${formatMilestone(target)} in Sales`,
  description: `Receive $${target.toLocaleString()} from item sales, after any marketplace fees. Work and quest cash do not count.`,
  category: 'Progression',
  condition: (state) => state.statistics.itemSaleRevenue >= target,
  getProgress: (state) => state.statistics.itemSaleRevenue,
  target,
  reward: target >= 1_000_000 ? { upgradePoints: 4, badge: `${formatMilestone(target)} Earned` } : { upgradePoints: target >= 10_000 ? 1 : undefined, money: Math.min(2_500, target * 0.02) },
}))

const inventoryAchievements: Achievement[] = inventoryValueMilestones.map((target) => ({
  id: `inventory_value_${target}`,
  name: `${formatMilestone(target)} Vault`,
  description: `Reach ${target.toLocaleString()} dollars in inventory value.`,
  category: 'Inventory',
  condition: (state) => state.inventoryValue >= target,
  getProgress: (state) => state.inventoryValue,
  target,
  reward: target >= 1_000_000 ? { upgradePoints: 5, skillPoints: 2, badge: `${formatMilestone(target)} Vault` } : { upgradePoints: 2 },
}))

const rarityDiscoveryAchievements: Achievement[] = Object.values(Rarity).flatMap((rarity) => {
  const label = getRarityLabel(rarity)

  return [
    {
      id: `discover_${rarity.toLowerCase()}_first`,
      name: `First ${label}`,
      description: `Discover a ${label} item.`,
      category: 'Drops',
      condition: (state) => hasDiscoveredRarity(state, rarity),
      getProgress: (state) => hasDiscoveredRarity(state, rarity) ? 1 : 0,
      target: 1,
      reward: rarity === Rarity.SpecialItem || rarity === Rarity.Contraband
        ? { skillPoints: 1, badge: `First ${label}` }
        : { money: 25 },
    },
    {
      id: `discover_${rarity.toLowerCase()}_all`,
      name: `${label} Catalog`,
      description: `Discover every catalog ${label} item.`,
      category: 'Collection',
      condition: (state) => hasDiscoveredEverySkinOfRarity(state, rarity),
      getProgress: (state) => {
        const discovered = new Set(state.collectionBook.map((entry) => entry.skinId))
        return SKIN_DEFINITIONS.filter((skin) => skin.rarity === rarity && discovered.has(skin.id)).length
      },
      target: SKIN_DEFINITIONS.filter((skin) => skin.rarity === rarity).length,
      reward: { upgradePoints: 2, skillPoints: rarity === Rarity.Covert || rarity === Rarity.SpecialItem ? 2 : 1 },
    },
  ] satisfies Achievement[]
})

const rarityDropCountAchievements: Achievement[] = [
  Rarity.Restricted,
  Rarity.Classified,
  Rarity.Covert,
  Rarity.SpecialItem,
  Rarity.Contraband,
].flatMap((rarity) => {
  const label = getRarityLabel(rarity)

  return [10, 100, 1_000].map((target) => ({
    id: `drops_${rarity.toLowerCase()}_${target}`,
    name: `${formatMilestone(target)} ${label} Drops`,
    description: `Pull ${target.toLocaleString()} ${label} items.`,
    category: 'Drops',
    condition: (state) => getLifetimeRarityDrops(state, rarity) >= target,
    getProgress: (state) => getLifetimeRarityDrops(state, rarity),
    target,
    reward: target >= 1_000 ? { skillPoints: 2, badge: `${label} Grinder` } : { upgradePoints: 1 },
  }))
})

const tradeUpAchievements: Achievement[] = tradeUpMilestones.map((target) => ({
  id: `trade_ups_${target}`,
  name: `${formatMilestone(target)} Contracts`,
  description: `Complete ${target.toLocaleString()} trade-up contracts.`,
  category: 'Trade Ups',
  condition: (state) => getLifetimeCount(state, 'tradeUpsCompleted') >= target,
  getProgress: (state) => getLifetimeCount(state, 'tradeUpsCompleted'),
  target,
  reward: target >= 500 ? { skillPoints: 2, badge: `${formatMilestone(target)} Contracts` } : { money: Math.min(2_500, target * 8) },
}))

const automationAchievements: Achievement[] = automationMilestones.map((target) => ({
  id: `automation_runs_${target}`,
  name: `${formatMilestone(target)} Automated Runs`,
  description: `Reach ${target.toLocaleString()} automation runs or auto opens.`,
  category: 'Automation',
  condition: () => false,
  isRetired: true,
  getBlockedReason: () => 'Legacy automation was replaced by Business employees in save v36.',
  reward: target >= 100_000 ? { skillPoints: 3, badge: `${formatMilestone(target)} Runs` } : { upgradePoints: 1 },
}))

const upgradeAchievements: Achievement[] = totalUpgradeMilestones.map((target) => ({
  id: `upgrade_levels_${target}`,
  name: `${target} Upgrade Levels`,
  description: `Buy ${target} total run upgrade levels.`,
  category: 'Progression',
  condition: () => false,
  isRetired: true,
  getBlockedReason: () => 'The legacy Upgrade Shop was converted to Career Upgrades in save v37.',
  reward: { skillPoints: target >= 30 ? 2 : 1 },
}))

const skillAchievements: Achievement[] = skillMilestones.map((target) => ({
  id: `skills_learned_${target}`,
  name: `${target} Skills Learned`,
  description: `Learn ${target} skill tree nodes.`,
  category: 'Progression',
  condition: () => false,
  isRetired: true,
  getBlockedReason: () => 'The legacy Skill Tree was converted to Career Upgrades in save v37.',
  reward: target >= 100 ? { badge: 'Skill Tree Master', upgradePoints: 5 } : { money: target * 25 },
}))

const prestigeAchievements: Achievement[] = prestigeMilestones.map((target) => ({
  id: `prestige_${target}`,
  name: `Prestige ${target}`,
  description: `Reach prestige level ${target}.`,
  category: 'Progression',
  condition: target <= 5 ? (state) => state.prestigeLevel >= target : () => false,
  getProgress: (state) => state.prestigeLevel,
  target,
  isRetired: target > 5,
  getBlockedReason: target > 5
    ? () => 'The legacy unbounded Prestige ladder was replaced by five typed tiers.'
    : undefined,
  reward: target >= 25 ? { skillPoints: 5, badge: `Prestige ${target}` } : { upgradePoints: 3, skillPoints: 2 },
}))

const collectionPercentAchievements: Achievement[] = collectionMilestones.map((ratio) => ({
  id: `collection_${Math.round(ratio * 100)}_percent`,
  name: `${Math.round(ratio * 100)}% Collection`,
  description: `Discover ${Math.round(ratio * 100)}% of the catalog.`,
  category: 'Collection',
  condition: (state) => getCollectionCompletionRatio(state) >= ratio,
  getProgress: (state) => new Set(state.collectionBook.map((entry) => entry.skinId)).size,
  target: Math.ceil(SKIN_DEFINITIONS.length * ratio),
  reward: ratio >= 0.75 ? { skillPoints: 2, badge: `${Math.round(ratio * 100)}% Collection` } : { upgradePoints: 1 },
}))

const hiddenAchievements: Achievement[] = [
  {
    id: 'hidden_battle_scarred_gold',
    name: 'Scarred Gold',
    description: 'Find a Battle-Scarred Special Item.',
    category: 'Drops',
    isHidden: true,
    condition: (state) => hasDiscoveredWearForRarity(state, Rarity.SpecialItem, WearCondition.BattleScarred),
    reward: { skillPoints: 2, badge: 'Scarred Gold' },
  },
  {
    id: 'hidden_factory_new_gold',
    name: 'Perfect Gold',
    description: 'Find a Factory New Special Item.',
    category: 'Drops',
    isHidden: true,
    condition: (state) => hasDiscoveredWearForRarity(state, Rarity.SpecialItem, WearCondition.FactoryNew),
    reward: { skillPoints: 3, badge: 'Perfect Gold' },
  },
  {
    id: 'hidden_contraband_sighting',
    name: 'Mythic Sighting',
    description: 'Discover a Contraband item.',
    category: 'Drops',
    isHidden: true,
    condition: (state) => hasDiscoveredRarity(state, Rarity.Contraband),
    reward: { skillPoints: 3, badge: 'Mythic Sighting' },
  },
  {
    id: 'hidden_zero_recovery',
    name: 'Back From Zero',
    description: 'Recover from a broke run after opening cases.',
    category: 'Progression',
    isHidden: true,
    condition: () => false,
    isRetired: true,
    getBlockedReason: () => 'Historical broke-run recovery could not be verified; completed records remain preserved.',
    reward: { money: 25, badge: 'Back From Zero' },
  },
  {
    id: 'hidden_all_red_gold',
    name: 'Red And Gold Archive',
    description: 'Discover every catalog Covert and Special Item.',
    category: 'Collection',
    isHidden: true,
    condition: hasDiscoveredAllCovertAndSpecial,
    reward: { skillPoints: 5, upgradePoints: 5, badge: 'Red And Gold Archive' },
  },
  {
    id: 'hidden_full_automation_grid',
    name: 'No Hands Left',
    description: 'Max out automation module progress.',
    category: 'Automation',
    isHidden: true,
    condition: () => false,
    isRetired: true,
    getBlockedReason: () => 'Legacy automation was retired and converted to employees.',
    reward: { skillPoints: 3, badge: 'No Hands Left' },
  },
]

const careerIntegrationAchievements: Achievement[] = [
  {
    id: 'trading_realized_profit_1000',
    name: 'Proven Margin',
    description: 'Earn $1,000 in ledger-backed realized trading profit.',
    category: 'Progression',
    displayCategory: 'Trading',
    condition: (state) => getLedgerValue(state, 'lifetime', 'realizedTradingProfit') >= 1_000,
    getProgress: (state) => Math.max(0, getLedgerValue(state, 'lifetime', 'realizedTradingProfit')),
    target: 1_000,
    reward: { money: 150, careerXp: 180, badge: 'Proven Margin' },
  },
  {
    id: 'trading_negotiations_10',
    name: 'Across the Table',
    description: 'Complete 10 negotiated CSWEAR transactions.',
    category: 'Progression',
    displayCategory: 'Trading',
    scope: 'currentRun',
    condition: (state) => getMarketplaceNegotiationCount(state) >= 10,
    getProgress: getMarketplaceNegotiationCount,
    target: 10,
    reward: { money: 100, careerXp: 140 },
  },
  {
    id: 'trading_market_sales_25',
    name: 'Reliable Seller',
    description: 'Complete 25 CSWEAR sales.',
    category: 'Progression',
    displayCategory: 'Trading',
    scope: 'currentRun',
    condition: (state) => state.statistics.marketSales >= 25,
    getProgress: (state) => state.statistics.marketSales,
    target: 25,
    reward: { money: 125, careerXp: 150 },
  },
  ...([25, 100, 500, 1_000] as const).map((target): Achievement => ({
    id: `career_collection_unique_${target}`,
    name: `${target.toLocaleString()} Lifetime Discoveries`,
    description: `Discover ${target.toLocaleString()} unique skins across all Career runs.`,
    category: 'Collection',
    displayCategory: 'Collecting',
    condition: (state) => getUniqueLifetimeDiscoveries(state) >= target,
    getProgress: getUniqueLifetimeDiscoveries,
    target,
    reward: target >= 500
      ? { careerXp: 220, badge: `${target.toLocaleString()} Discoveries` }
      : { money: Math.min(150, target), careerXp: 100 + Math.round(target / 4) },
  })),
  {
    id: 'career_pattern_special_10',
    name: 'Run Pattern Researcher',
    description: 'Record 10 special Pattern discoveries during the current Career run.',
    category: 'Collection',
    displayCategory: 'Collecting',
    scope: 'currentRun',
    condition: (state) => state.statistics.patternDrops >= 10,
    getProgress: (state) => state.statistics.patternDrops,
    target: 10,
    reward: { careerXp: 180, badge: 'Pattern Researcher' },
  },
  {
    id: 'trade_up_profitable_lifetime',
    name: 'Contract Edge',
    description: 'Reach positive total estimated Trade-Up output value above consumed input value. Selling the output is not required.',
    category: 'Trade Ups',
    displayCategory: 'Trade-Ups',
    condition: (state) => getLedgerValue(state, 'lifetime', 'tradeUpOutputValue') > getLedgerValue(state, 'lifetime', 'tradeUpInputValue'),
    getProgress: (state) => Math.max(0, getLedgerValue(state, 'lifetime', 'tradeUpOutputValue') - getLedgerValue(state, 'lifetime', 'tradeUpInputValue')),
    target: 0.01,
    reward: { money: 100, careerXp: 180, badge: 'Contract Edge' },
  },
  {
    id: 'business_first_employee',
    name: 'First Hire',
    description: 'Hire your first Business employee.',
    category: 'Automation',
    displayCategory: 'Business',
    condition: (state) => getHiredEmployeeCount(state) >= 1,
    getProgress: getHiredEmployeeCount,
    target: 1,
    reward: { careerXp: 110, badge: 'First Hire' },
  },
  {
    id: 'business_first_operation',
    name: 'Open for Business',
    description: 'Complete the first legitimate employee operation.',
    category: 'Automation',
    displayCategory: 'Business',
    condition: (state) => getBusinessOperationCount(state) >= 1,
    getProgress: getBusinessOperationCount,
    target: 1,
    reward: { money: 50, careerXp: 110 },
  },
  {
    id: 'business_first_scout_match',
    name: 'Scout Report',
    description: 'Have the Market Scout find a genuine watchlist match.',
    category: 'Automation',
    displayCategory: 'Business',
    condition: (state) => state.business?.recentOperations.some((operation) => operation.type === 'scout-match') ?? false,
    getProgress: (state) => state.business?.recentOperations.some((operation) => operation.type === 'scout-match') ? 1 : 0,
    target: 1,
    reward: { careerXp: 160, badge: 'Scout Report' },
  },
  {
    id: 'business_first_junior_purchase',
    name: 'Junior Deal',
    description: 'Complete a bounded ordinary purchase through the Junior Trader.',
    category: 'Automation',
    displayCategory: 'Business',
    condition: (state) => state.business?.recentOperations.some((operation) => operation.type === 'market-purchase' && operation.employeeRole === 'juniorTrader') ?? false,
    getProgress: (state) => state.business?.recentOperations.some((operation) => operation.type === 'market-purchase' && operation.employeeRole === 'juniorTrader') ? 1 : 0,
    target: 1,
    reward: { careerXp: 180, badge: 'Junior Deal' },
  },
  {
    id: 'business_team_three',
    name: 'Trading Team',
    description: 'Hire three different employees.',
    category: 'Automation',
    displayCategory: 'Business',
    condition: (state) => getHiredEmployeeCount(state) >= 3,
    getProgress: getHiredEmployeeCount,
    target: 3,
    reward: { careerXp: 180, badge: 'Trading Team' },
  },
  {
    id: 'business_training_10',
    name: 'Staff Development',
    description: 'Reach 10 combined employee training levels.',
    category: 'Automation',
    displayCategory: 'Business',
    condition: (state) => getBusinessTrainingLevels(state) >= 10,
    getProgress: getBusinessTrainingLevels,
    target: 10,
    reward: { careerXp: 180 },
  },
  {
    id: 'business_positive_result',
    name: 'Sustainable Operation',
    description: 'Reach a positive ledger-backed Business result after operating expenses.',
    category: 'Automation',
    displayCategory: 'Business',
    condition: (state) => getLedgerValue(state, 'lifetime', 'businessRevenue') > getLedgerValue(state, 'lifetime', 'businessExpenses'),
    getProgress: (state) => Math.max(0, getLedgerValue(state, 'lifetime', 'businessRevenue') - getLedgerValue(state, 'lifetime', 'businessExpenses')),
    target: 0.01,
    reward: { careerXp: 220, badge: 'Sustainable Operation' },
  },
  ...([
    [15, 'Independent Trader'],
    [35, 'Professional Trader'],
    [55, 'Business Owner'],
    [75, 'Market Mogul'],
    [100, 'CS2 Trading Legend'],
  ] as const).map(([target, name]): Achievement => ({
    id: `career_rank_${target}`,
    name,
    description: `Reach Career Level ${target} for the first time.`,
    category: 'Progression',
    displayCategory: 'Career & Prestige',
    condition: (state) => getCareerHighestLevel(state) >= target,
    getProgress: getCareerHighestLevel,
    target,
    reward: { careerXp: target >= 75 ? 300 : 180, badge: name },
  })),
  ...([1, 2, 3, 4, 5] as const).map((target): Achievement => ({
    id: `career_prestige_tier_${target}`,
    name: `Prestige Tier ${target}`,
    description: `Complete Prestige Tier ${target}.`,
    category: 'Progression',
    displayCategory: 'Career & Prestige',
    condition: (state) => (state.prestigeSystem?.highestTier ?? 0) >= target,
    getProgress: (state) => state.prestigeSystem?.highestTier ?? 0,
    target,
    reward: { careerXp: 200 + target * 40, badge: target === 5 ? 'Legendary Legacy' : `Prestige Tier ${target}` },
  })),
  {
    id: 'career_prestige_perks_5',
    name: 'Permanent Foundation',
    description: 'Purchase five permanent Prestige perk levels.',
    category: 'Progression',
    displayCategory: 'Career & Prestige',
    condition: (state) => getPrestigePerkLevels(state) >= 5,
    getProgress: getPrestigePerkLevels,
    target: 5,
    reward: { careerXp: 200, badge: 'Permanent Foundation' },
  },
  {
    id: 'career_legacy_vault_5',
    name: 'Legacy Curator',
    description: 'Complete a Career chapter while preserving five exact items in the Legacy Vault.',
    category: 'Progression',
    displayCategory: 'Career & Prestige',
    condition: (state) => getLegacyVaultRecord(state) >= 5,
    getProgress: getLegacyVaultRecord,
    target: 5,
    reward: { careerXp: 220, badge: 'Legacy Curator' },
  },
  {
    id: 'run_cases_250',
    name: 'Run Opening Plan',
    description: 'Open 250 paid cases during the current Career run.',
    category: 'Opening',
    displayCategory: 'Case Opening',
    scope: 'currentRun',
    condition: (state) => state.statistics.casesOpened >= 250,
    getProgress: (state) => state.statistics.casesOpened,
    target: 250,
    reward: { money: 40, careerXp: 80 },
  },
  {
    id: 'run_tradeups_20',
    name: 'Run Contract Plan',
    description: 'Complete 20 Trade-Up contracts during the current Career run.',
    category: 'Trade Ups',
    displayCategory: 'Trade-Ups',
    scope: 'currentRun',
    condition: (state) => state.statistics.tradeUpsCompleted >= 20,
    getProgress: (state) => state.statistics.tradeUpsCompleted,
    target: 20,
    reward: { money: 50, careerXp: 90 },
  },
  {
    id: 'run_discoveries_50',
    name: 'Run Discovery Plan',
    description: 'Discover 50 unique skins during the current Career run.',
    category: 'Collection',
    displayCategory: 'Collecting',
    scope: 'currentRun',
    condition: (state) => getUniqueCurrentRunDiscoveries(state) >= 50,
    getProgress: getUniqueCurrentRunDiscoveries,
    target: 50,
    reward: { money: 50, careerXp: 100 },
  },
  {
    id: 'run_business_operations_25',
    name: 'Run Operations Plan',
    description: 'Complete 25 legitimate employee operations during the current Career run.',
    category: 'Automation',
    displayCategory: 'Business',
    scope: 'currentRun',
    condition: (state) => getBusinessOperationCount(state) >= 25,
    getProgress: getBusinessOperationCount,
    target: 25,
    reward: { money: 50, careerXp: 100 },
  },
  {
    id: 'run_career_level_25',
    name: 'Run Career Foundation',
    description: 'Reach Career Level 25 during the current run.',
    category: 'Progression',
    displayCategory: 'Career & Prestige',
    scope: 'currentRun',
    condition: (state) => getCareerCurrentLevel(state) >= 25,
    getProgress: getCareerCurrentLevel,
    target: 25,
    reward: { careerXp: 100 },
  },
  {
    id: 'run_realized_profit_5000',
    name: 'Run Trading Plan',
    description: 'Earn $5,000 realized trading profit during the current Career run.',
    category: 'Progression',
    displayCategory: 'Trading',
    scope: 'currentRun',
    condition: (state) => getLedgerValue(state, 'currentRun', 'realizedTradingProfit') >= 5_000,
    getProgress: (state) => Math.max(0, getLedgerValue(state, 'currentRun', 'realizedTradingProfit')),
    target: 5_000,
    reward: { money: 75, careerXp: 120 },
  },
]

const generatedAchievements = [
  ...openingAchievementMilestones,
  ...spendingAchievements,
  ...earningAchievements,
  ...inventoryAchievements,
  ...rarityDiscoveryAchievements,
  ...rarityDropCountAchievements,
  ...tradeUpAchievements,
  ...automationAchievements,
  ...upgradeAchievements,
  ...skillAchievements,
  ...prestigeAchievements,
  ...collectionPercentAchievements,
  ...hiddenAchievements,
  ...careerIntegrationAchievements,
]

const baseProgressTargets: Record<string, { target: number; getProgress: (state: PlayerState) => number }> = {
  first_case_opened: { target: 1, getProgress: (state) => getLifetimeCount(state, 'casesOpened') },
  cases_opened_100: { target: 100, getProgress: (state) => getLifetimeCount(state, 'casesOpened') },
  cases_opened_10000: { target: 10_000, getProgress: (state) => getLifetimeCount(state, 'casesOpened') },
  inventory_value_1k: { target: 1_000, getProgress: (state) => state.inventoryValue },
  inventory_value_100k: { target: 100_000, getProgress: (state) => state.inventoryValue },
  inventory_value_1m: { target: 1_000_000, getProgress: (state) => state.inventoryValue },
  first_trade_up: { target: 1, getProgress: (state) => getLifetimeCount(state, 'tradeUpsCompleted') },
  first_prestige: { target: 1, getProgress: (state) => state.prestigeLevel },
  prestige_five: { target: 5, getProgress: (state) => state.prestigeLevel },
  collection_catalog_complete: { target: SKIN_DEFINITIONS.length, getProgress: (state) => getUniqueLifetimeDiscoveries(state) },
  auction_first_purchase: { target: 1, getProgress: (state) => getLifetimeCount(state, 'auctionPurchases') },
}

export const ACHIEVEMENTS: Achievement[] = Array.from(
  new Map([...BASE_ACHIEVEMENTS, ...generatedAchievements].map((achievement) => [achievement.id, achievement])).values(),
).map((achievement) => {
  if (achievement.isRetired || achievement.getProgress) return achievement
  const progress = baseProgressTargets[achievement.id]
  return { ...achievement, target: progress?.target ?? 1, getProgress: progress?.getProgress ?? ((state) => achievement.condition(state) ? 1 : 0) }
})

export const achievementsById = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]))

export function getAchievementProgressValue(achievement: Achievement, state: GameState) {
  if (getAchievementProgress(state.achievements, achievement.id, state.career.runId)) {
    return achievement.target ?? 1
  }
  return Math.max(0, achievement.getProgress?.(toAchievementPlayerState(state)) ?? 0)
}

export function getAchievementBlockedReason(achievement: Achievement, state: GameState) {
  if (achievement.isRetired) {
    return achievement.getBlockedReason?.(toAchievementPlayerState(state)) ?? 'This legacy milestone is retired.'
  }
  return achievement.getBlockedReason?.(toAchievementPlayerState(state))
}

export function toAchievementPlayerState(state: GameState): PlayerState {
  return {
    money: state.money,
    inventory: state.inventory,
    inventoryValue: state.inventoryValue,
    inventoryValueHistory: state.inventoryValueHistory,
    unlockedCases: state.casesUnlocked,
    autoSellRules: state.autoSellRules,
    marketplace: state.marketplace,
    economyLedger: state.economyLedger,
    automation: state.automation,
    business: state.business,
    career: state.career,
    careerUpgrades: state.careerUpgrades,
    upgrades: state.upgrades,
    trophyAssignments: state.trophyAssignments,
    dailyRewards: state.dailyRewards,
    collectionBook: state.collectionBook,
    currentRunCollectionBook: state.currentRunCollectionBook,
    collectionRewards: state.collectionRewards,
    hasUsedFirstCaseHook: state.hasUsedFirstCaseHook,
    lastPoopCleaningAt: state.lastPoopCleaningAt,
    workMiniGameCooldowns: state.workMiniGameCooldowns,
    prestigeLevel: state.prestigeLevel,
    prestigePoints: state.prestigePoints,
    prestigeBonuses: state.prestigeBonuses,
    prestigeSystem: state.prestigeSystem,
    upgradePoints: state.upgradePoints,
    skillPoints: state.skillPoints,
    learnedSkillNodeIds: state.learnedSkillNodeIds,
    achievements: state.achievements,
    marketValues: state.marketValues,
    marketHistory: state.marketHistory,
    activeEvents: state.activeEvents,
    upcomingEvents: state.upcomingEvents,
    eventHistory: state.eventHistory,
    statistics: state.statistics,
    achievementLifetime: state.achievementLifetime,
    lastBackupAt: state.lastBackupAt,
    lastSaved: state.lastSaved,
  }
}

export function getAchievementProgress(
  achievements: AchievementProgress[],
  achievementId: string,
  currentRunId?: string,
) {
  const definition = achievementsById.get(achievementId)
  const scope = definition ? getAchievementScope(definition) : 'lifetime'
  return achievements.find((achievement) => (
    achievement.id === achievementId &&
    (scope === 'lifetime' || achievement.runId === currentRunId)
  ))
}

export function getNewAchievementUnlocks(state: GameState, unlockedAt = Date.now()) {
  const playerState = toAchievementPlayerState(state)
  const unlockedDefinitions = ACHIEVEMENTS.filter((achievement) => {
    if (achievement.isRetired) return false
    const existing = getAchievementProgress(state.achievements, achievement.id, state.career.runId)
    return !existing && achievement.condition(playerState)
  })
  const progress = unlockedDefinitions.map((achievement): AchievementProgress => ({
    id: achievement.id,
    isClaimed: false,
    unlockedAt,
    scope: getAchievementScope(achievement),
    runId: getAchievementScope(achievement) === 'currentRun' ? state.career.runId : undefined,
  }))

  return {
    progress,
    unlockedDefinitions,
  }
}
