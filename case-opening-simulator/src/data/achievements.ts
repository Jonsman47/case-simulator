import type { GameState } from './gameState'
import {
  Rarity,
  WearCondition,
  type Achievement,
  type AchievementCategory,
  type AchievementProgress,
  type PlayerState,
} from './models'
import { SKIN_DEFINITIONS } from './skins'
import { TROPHY_SLOT_DEFINITIONS, getTrophyAssignmentsList } from '../utils/trophyRoom'

const allWearConditions = Object.values(WearCondition)
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

function hasAnyAutomationUpgrade(state: PlayerState) {
  return (
    state.automation.autoOpener.level > 0 ||
    Object.values(state.automation.modules).some((moduleState) => moduleState.level > 0)
  )
}

function getAutomationRunCount(state: PlayerState) {
  return (
    state.automation.autoOpener.totalOpened +
    Object.values(state.automation.modules).reduce((total, moduleState) => total + moduleState.totalRuns, 0)
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

    return allWearConditions.every((wear) => entry?.foundWearConditions.includes(wear))
  })
}

function hasFilledAllTrophySlots(state: PlayerState) {
  return TROPHY_SLOT_DEFINITIONS.every((slot) => Boolean(state.trophyAssignments[slot.id]))
}

function hasEliteTrophyRoom(state: PlayerState) {
  const assignments = getTrophyAssignmentsList(state.trophyAssignments)

  return (
    assignments.length === TROPHY_SLOT_DEFINITIONS.length &&
    assignments.every((assignment) => {
      return (
        assignment.item.wear === WearCondition.FactoryNew ||
        assignment.item.rarity === Rarity.SpecialItem ||
        assignment.item.rarity === Rarity.Contraband
      )
    })
  )
}

const BASE_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_case_opened',
    name: 'First Crack',
    description: 'Open your first case.',
    category: 'Opening',
    condition: (state) => state.statistics.casesOpened >= 1,
    reward: { money: 10 },
  },
  {
    id: 'cases_opened_100',
    name: 'Case Regular',
    description: 'Open 100 cases.',
    category: 'Opening',
    condition: (state) => state.statistics.casesOpened >= 100,
    reward: { upgradePoints: 1, skillPoints: 1 },
  },
  {
    id: 'cases_opened_10000',
    name: 'Unbox Machine',
    description: 'Open 10,000 cases.',
    category: 'Opening',
    condition: (state) => state.statistics.casesOpened >= 10_000,
    reward: { upgradePoints: 5, badge: 'Unbox Machine' },
  },
  {
    id: 'first_profit_case',
    name: 'Green Tick',
    description: 'Earn money from a sale or auto-sale.',
    category: 'Progression',
    condition: (state) => state.statistics.moneyEarned > 0,
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
    id: 'first_100_value_item',
    name: 'Triple Digits',
    description: 'Find an item worth at least $100.',
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
    condition: (state) => state.statistics.tradeUpsCompleted >= 1,
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
    description: 'Discover every seeded skin at least once.',
    category: 'Collection',
    condition: isCatalogComplete,
    reward: { upgradePoints: 3, skillPoints: 2, badge: 'Catalog Complete' },
  },
  {
    id: 'collection_wear_master',
    name: 'Wear Master',
    description: 'Discover every seeded skin in every wear condition.',
    category: 'Collection',
    condition: isWearCatalogComplete,
    reward: { upgradePoints: 8, badge: 'Wear Master' },
  },
  {
    id: 'automation_started',
    name: 'Hands Off',
    description: 'Purchase any automation upgrade.',
    category: 'Automation',
    condition: hasAnyAutomationUpgrade,
    reward: { money: 100 },
  },
  {
    id: 'automation_100_runs',
    name: 'Factory Floor',
    description: 'Reach 100 automation runs or auto opens.',
    category: 'Automation',
    condition: (state) => getAutomationRunCount(state) >= 100,
    reward: { upgradePoints: 2 },
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

function getTotalUpgradeLevels(state: PlayerState) {
  return Object.values(state.upgrades).reduce((total, level) => total + (level ?? 0), 0)
}

function getAutomationModuleLevels(state: PlayerState) {
  return Object.values(state.automation.modules).reduce((total, moduleState) => total + moduleState.level, 0) +
    state.automation.autoOpener.level
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
  condition: (state) => state.statistics.casesOpened >= target,
  reward: target >= 25_000
    ? { upgradePoints: 4, skillPoints: 3, badge: `${formatMilestone(target)} Cases` }
    : target >= 1_000
      ? { upgradePoints: 2, skillPoints: 1 }
      : { money: Math.max(10, Math.round(target * 0.2)) },
}))

const spendingAchievements: Achievement[] = moneySpentMilestones.map((target) => ({
  id: `money_spent_${target}`,
  name: `${formatMilestone(target)} Spent`,
  description: `Spend ${target.toLocaleString()} dollars on cases, licenses, upgrades, and automation.`,
  category: 'Progression',
  condition: (state) => state.statistics.moneySpent >= target,
  reward: target >= 1_000_000 ? { skillPoints: 2, badge: `${formatMilestone(target)} Spent` } : { money: Math.min(5_000, target * 0.01) },
}))

const earningAchievements: Achievement[] = moneyEarnedMilestones.map((target) => ({
  id: `money_earned_${target}`,
  name: `${formatMilestone(target)} Earned`,
  description: `Earn ${target.toLocaleString()} dollars from selling items.`,
  category: 'Progression',
  condition: (state) => state.statistics.moneyEarned >= target,
  reward: target >= 1_000_000 ? { upgradePoints: 4, badge: `${formatMilestone(target)} Earned` } : { upgradePoints: target >= 10_000 ? 1 : undefined, money: Math.min(2_500, target * 0.02) },
}))

const inventoryAchievements: Achievement[] = inventoryValueMilestones.map((target) => ({
  id: `inventory_value_${target}`,
  name: `${formatMilestone(target)} Vault`,
  description: `Reach ${target.toLocaleString()} dollars in inventory value.`,
  category: 'Inventory',
  condition: (state) => state.inventoryValue >= target,
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
      reward: rarity === Rarity.SpecialItem || rarity === Rarity.Contraband
        ? { skillPoints: 1, badge: `First ${label}` }
        : { money: 25 },
    },
    {
      id: `discover_${rarity.toLowerCase()}_all`,
      name: `${label} Catalog`,
      description: `Discover every seeded ${label} item.`,
      category: 'Collection',
      condition: (state) => hasDiscoveredEverySkinOfRarity(state, rarity),
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
    condition: (state) => (state.statistics.dropsByRarity[rarity] ?? 0) >= target,
    reward: target >= 1_000 ? { skillPoints: 2, badge: `${label} Grinder` } : { upgradePoints: 1 },
  }))
})

const tradeUpAchievements: Achievement[] = tradeUpMilestones.map((target) => ({
  id: `trade_ups_${target}`,
  name: `${formatMilestone(target)} Contracts`,
  description: `Complete ${target.toLocaleString()} trade-up contracts.`,
  category: 'Trade Ups',
  condition: (state) => state.statistics.tradeUpsCompleted >= target,
  reward: target >= 500 ? { skillPoints: 2, badge: `${formatMilestone(target)} Contracts` } : { money: Math.min(2_500, target * 8) },
}))

const automationAchievements: Achievement[] = automationMilestones.map((target) => ({
  id: `automation_runs_${target}`,
  name: `${formatMilestone(target)} Automated Runs`,
  description: `Reach ${target.toLocaleString()} automation runs or auto opens.`,
  category: 'Automation',
  condition: (state) => getAutomationRunCount(state) >= target,
  reward: target >= 100_000 ? { skillPoints: 3, badge: `${formatMilestone(target)} Runs` } : { upgradePoints: 1 },
}))

const upgradeAchievements: Achievement[] = totalUpgradeMilestones.map((target) => ({
  id: `upgrade_levels_${target}`,
  name: `${target} Upgrade Levels`,
  description: `Buy ${target} total run upgrade levels.`,
  category: 'Progression',
  condition: (state) => getTotalUpgradeLevels(state) >= target,
  reward: { skillPoints: target >= 30 ? 2 : 1 },
}))

const skillAchievements: Achievement[] = skillMilestones.map((target) => ({
  id: `skills_learned_${target}`,
  name: `${target} Skills Learned`,
  description: `Learn ${target} skill tree nodes.`,
  category: 'Progression',
  condition: (state) => state.learnedSkillNodeIds.length >= target,
  reward: target >= 100 ? { badge: 'Skill Tree Master', upgradePoints: 5 } : { money: target * 25 },
}))

const prestigeAchievements: Achievement[] = prestigeMilestones.map((target) => ({
  id: `prestige_${target}`,
  name: `Prestige ${target}`,
  description: `Reach prestige level ${target}.`,
  category: 'Progression',
  condition: (state) => state.prestigeLevel >= target,
  reward: target >= 25 ? { skillPoints: 5, badge: `Prestige ${target}` } : { upgradePoints: 3, skillPoints: 2 },
}))

const collectionPercentAchievements: Achievement[] = collectionMilestones.map((ratio) => ({
  id: `collection_${Math.round(ratio * 100)}_percent`,
  name: `${Math.round(ratio * 100)}% Collection`,
  description: `Discover ${Math.round(ratio * 100)}% of the seeded catalog.`,
  category: 'Collection',
  condition: (state) => getCollectionCompletionRatio(state) >= ratio,
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
    condition: (state) => state.money >= 5 && state.statistics.casesOpened > 0 && state.statistics.moneySpent > 0,
    reward: { money: 25, badge: 'Back From Zero' },
  },
  {
    id: 'hidden_all_red_gold',
    name: 'Red And Gold Archive',
    description: 'Discover every seeded Covert and Special Item.',
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
    condition: (state) => getAutomationModuleLevels(state) >= 25,
    reward: { skillPoints: 3, badge: 'No Hands Left' },
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
]

export const ACHIEVEMENTS: Achievement[] = Array.from(
  new Map([...BASE_ACHIEVEMENTS, ...generatedAchievements].map((achievement) => [achievement.id, achievement])).values(),
)

export const achievementsById = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]))

export function toAchievementPlayerState(state: GameState): PlayerState {
  return {
    money: state.money,
    inventory: state.inventory,
    inventoryValue: state.inventoryValue,
    inventoryValueHistory: state.inventoryValueHistory,
    unlockedCases: state.casesUnlocked,
    autoSellRules: state.autoSellRules,
    automation: state.automation,
    upgrades: state.upgrades,
    trophyAssignments: state.trophyAssignments,
    dailyRewards: state.dailyRewards,
    collectionBook: state.collectionBook,
    collectionRewards: state.collectionRewards,
    prestigeLevel: state.prestigeLevel,
    prestigePoints: state.prestigePoints,
    prestigeBonuses: state.prestigeBonuses,
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
    lastBackupAt: state.lastBackupAt,
    lastSaved: state.lastSaved,
  }
}

export function getAchievementProgress(
  achievements: AchievementProgress[],
  achievementId: string,
) {
  return achievements.find((achievement) => achievement.id === achievementId)
}

export function getNewAchievementUnlocks(state: GameState, unlockedAt = Date.now()) {
  const playerState = toAchievementPlayerState(state)
  const unlockedAchievementIds = new Set(state.achievements.map((achievement) => achievement.id))
  const unlockedDefinitions = ACHIEVEMENTS.filter((achievement) => {
    return !unlockedAchievementIds.has(achievement.id) && achievement.condition(playerState)
  })
  const progress = unlockedDefinitions.map((achievement) => ({
    id: achievement.id,
    isClaimed: false,
    unlockedAt,
  }))

  return {
    progress,
    unlockedDefinitions,
  }
}
