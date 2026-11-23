import {
  defaultDropsByRarity,
  defaultGameState,
  defaultNotificationUiState,
  defaultOnboardingUiState,
  defaultRarityColors,
  type AnimationSpeed,
  type GameSettings,
  type LanguageCode,
  type GameState,
  type GameUiState,
  type FeatureId,
  type GameStatistics,
  type OnboardingStepId,
  type OnboardingTipId,
  type TradeUpHistoryEntry,
} from '../data/gameState'
import {
  createInitialMarketHistory,
  createInitialMarketTrends,
  MARKET_HISTORY_MAX_TRACKED_SKINS,
  trimMarketPriceHistory,
  type MarketPriceHistory,
  type MarketPricePoint,
  type MarketTrendArrow,
  type ActiveMarketEvent,
  type MarketEventLog,
  hydrateMarketEvent,
} from '../market/marketSimulation'
import {
  GAME_EVENT_TYPES,
  eventManager,
  type ActiveGameEvent,
  type GameEventLog,
} from '../events/eventManager'
import {
  AutomationModuleId,
  AutoSellRuleType,
  Rarity,
  WearCondition,
  type AchievementProgress,
  type AutomationState,
  type AutomationModuleState,
  type AuctionHouseDeal,
  type AutoSellRule,
  type CollectionEntry,
  type CollectionRewardProgress,
  DailyChallengeType,
  type DailyCaseDiscountBuff,
  type DailyChallenge,
  type DailyChallengeReward,
  type DailyRewardClaim,
  type DailyRewardsState,
  type PlayerState,
  type MarketplaceState,
  type MarketplaceNpc,
  type NpcMarketListing,
  type PlayerMarketListing,
  type MarketplaceTransaction,
  type AcquisitionReveal,
  type SkinInstance,
  type TrophyAssignment,
  type TrophyAssignments,
} from '../data/models'
import {
  defaultInventoryFilters,
  defaultInventoryViewUiState,
  type InventoryFilters,
  type SortCriterion,
} from './inventoryFilters'
import {
  appendInventoryValueHistory,
  getInventoryValue,
  trimInventoryValueHistory,
  type InventoryValuePoint,
} from './inventory'
import {
  createDefaultAutomationModules,
  defaultAutomationState,
  getAutoOpenerIntervalMs,
} from './automation'
import { normalizeUpgradeLevels } from '../data/upgrades'
import { normalizePrestigeBonusLevels } from '../data/prestige'
import { normalizeLearnedSkillNodeIds } from '../data/skills'
import { createDefaultTrophyAssignments } from './trophyRoom'
import { createDefaultDailyRewardsState, refreshDailyRewardsState } from '../rewards/dailyRewards'
import {
  POOP_CLEANUP_LAST_COMPLETED_KEY,
  readPoopCleanupLastCompleted,
  writePoopCleanupLastCompleted,
} from './poopCleanupMinigame'
import { MAX_CURRENCY_VALUE, normalizeMoney } from './safeNumbers'
import { WORK_MINIGAMES, type WorkMiniGameCooldowns } from './workMinigames'
import { createDefaultMarketplaceState, MARKETPLACE_EPOCH_MS } from '../marketplace/marketplace'
import { createEconomyLedger, normalizeEconomyLedger } from '../economy/economyLedger'
import { createLegacyCareerState, normalizeCareerState } from '../career/careerProgress'
import {
  createLegacyCareerUpgradeState,
  normalizeCareerUpgradeState,
} from '../career/careerUpgrades'
import {
  migrateLegacyAutomationToBusiness,
  normalizeBusinessState,
  retireLegacyAutomation,
} from '../business/business'
import {
  createDefaultPrestigeSystem,
  getTotalPrestigePerkSpend,
  normalizePrestigeSystem,
} from '../prestige/prestigeSystem'
import { createDefaultQuestSystem, normalizeQuestSystem } from '../quests/questSystem'
import { createDefaultDropJournal, normalizeDropJournal } from '../quests/dropJournal'

export const SAVE_STORAGE_KEY = 'case-opening-simulator:game-state'
export const CURRENT_SAVE_VERSION = 42
export const BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1_000
export const PERSISTED_MARKET_HISTORY_MAX_TRACKED_SKINS = 160
export const PERSISTED_MARKET_HISTORY_MAX_POINTS = 120
export const MAX_IMPORTED_SAVE_BYTES = 50 * 1024 * 1024
export const MAX_PERSISTED_INVENTORY_ITEMS = 50_000
export const MAX_PLAYER_MARKET_LISTINGS = 5_000

export interface SaveEnvelope {
  version: number
  savedAt: number
  state: GameState
}

export class SaveGameError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SaveGameError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isStringArray(value: unknown) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function readStringArray(value: unknown, fallback: string[] = []) {
  return isStringArray(value) ? value : fallback
}

function normalizeNumber(value: unknown, fallback: number) {
  return isNumber(value) ? value : fallback
}

function isEnumValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.includes(value as T)
}

function isSkinInstance(value: unknown): value is SkinInstance {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.weapon === 'string' &&
    typeof value.finish === 'string' &&
    isEnumValue(Object.values(Rarity), value.rarity) &&
    isNumber(value.baseValue) && value.baseValue >= 0 && value.baseValue <= MAX_CURRENCY_VALUE &&
    isStringArray(value.caseIds) &&
    typeof value.image === 'string' &&
    typeof value.instanceId === 'string' &&
    isEnumValue(Object.values(WearCondition), value.wear) &&
    isNumber(value.floatValue) && value.floatValue >= 0 && value.floatValue <= 1 &&
    isNumber(value.marketValue) && value.marketValue >= 0 && value.marketValue <= MAX_CURRENCY_VALUE &&
    (value.baseMarketValue === undefined || (isNumber(value.baseMarketValue) && value.baseMarketValue >= 0 && value.baseMarketValue <= MAX_CURRENCY_VALUE)) &&
    (value.patternPremium === undefined || (isNumber(value.patternPremium) && value.patternPremium >= 0 && value.patternPremium <= MAX_CURRENCY_VALUE)) &&
    (value.paintSeed === undefined || (Number.isInteger(value.paintSeed) && Number(value.paintSeed) >= 0 && Number(value.paintSeed) <= 1000)) &&
    typeof value.isLocked === 'boolean' &&
    typeof value.isFavorited === 'boolean' &&
    isNumber(value.discoveredAt) && value.discoveredAt >= 0
  )
}

function isCollectionEntry(value: unknown): value is CollectionEntry {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.skinId === 'string' &&
    Array.isArray(value.foundWearConditions) &&
    value.foundWearConditions.every((wear) => isEnumValue(Object.values(WearCondition), wear)) &&
    (value.bestFloat === undefined || isNumber(value.bestFloat)) &&
    (value.highestValue === undefined || isNumber(value.highestValue)) &&
    isNumber(value.timesFound) &&
    isNumber(value.firstFoundAt)
  )
}

function isAutoSellRule(value: unknown): value is AutoSellRule {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    isEnumValue(Object.values(AutoSellRuleType), value.type) &&
    typeof value.enabled === 'boolean' &&
    (value.valueThreshold === undefined || isNumber(value.valueThreshold)) &&
    (value.valueThresholdsByRarity === undefined || isRarityValueMap(value.valueThresholdsByRarity)) &&
    (value.rarityThreshold === undefined || isEnumValue(Object.values(Rarity), value.rarityThreshold)) &&
    (value.wearThreshold === undefined || isEnumValue(Object.values(WearCondition), value.wearThreshold)) &&
    (value.sellDuplicates === undefined || typeof value.sellDuplicates === 'boolean') &&
    (value.keepCount === undefined || isNumber(value.keepCount)) &&
    (value.includeStatTrak === undefined || typeof value.includeStatTrak === 'boolean') &&
    (value.includeSouvenir === undefined || typeof value.includeSouvenir === 'boolean') &&
    (value.protectRarePatterns === undefined || typeof value.protectRarePatterns === 'boolean') &&
    (value.protectSpecialItems === undefined || typeof value.protectSpecialItems === 'boolean') &&
    (value.excludedIds === undefined || isStringArray(value.excludedIds))
  )
}

function isRarityValueMap(value: unknown) {
  if (!isRecord(value)) {
    return false
  }

  return Object.entries(value).every(([rarity, threshold]) => {
    return isEnumValue(Object.values(Rarity), rarity) && isNumber(threshold)
  })
}

function normalizeMarketValues(value: unknown) {
  if (!isRecord(value)) {
    return null
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => {
      return typeof entry[0] === 'string' && isNumber(entry[1])
    }),
  )
}

function isMarketPricePoint(value: unknown): value is MarketPricePoint {
  if (!isRecord(value)) {
    return false
  }

  return isNumber(value.timestamp) && isNumber(value.value)
}

function normalizeMarketHistory(
  value: unknown,
  marketValues: Record<string, number>,
  savedAt: number,
): MarketPriceHistory {
  const defaultHistory = createInitialMarketHistory({
    marketValues,
    now: savedAt,
  })

  if (!isRecord(value)) {
    return defaultHistory
  }

  const restoredHistory = Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, MarketPricePoint[]] => {
        return typeof entry[0] === 'string' && Array.isArray(entry[1]) && entry[1].every(isMarketPricePoint)
      })
      .map(([skinId, points]) => [
        skinId,
        trimMarketPriceHistory(
          [...points]
            .map((point) => ({
              timestamp: point.timestamp,
              value: Math.max(0.01, point.value),
            }))
            .sort((left, right) => left.timestamp - right.timestamp),
          savedAt,
        ),
      ])
      .filter((entry): entry is [string, MarketPricePoint[]] => entry[1].length > 0)
      .sort((left, right) => {
        const leftPoint = left[1][left[1].length - 1]
        const rightPoint = right[1][right[1].length - 1]

        return (rightPoint?.timestamp ?? 0) - (leftPoint?.timestamp ?? 0)
      })
      .slice(0, MARKET_HISTORY_MAX_TRACKED_SKINS),
  )

  return {
    ...defaultHistory,
    ...restoredHistory,
  }
}

function isInventoryValuePoint(value: unknown): value is InventoryValuePoint {
  if (!isRecord(value)) {
    return false
  }

  return isNumber(value.timestamp) && isNumber(value.value)
}

function normalizeInventoryValueHistory(
  value: unknown,
  inventoryValue: number,
  savedAt: number,
) {
  const history = Array.isArray(value) && value.every(isInventoryValuePoint)
    ? trimInventoryValueHistory(
        value.map((point) => ({
          timestamp: point.timestamp,
          value: Math.max(0, point.value),
        })),
      )
    : []

  return appendInventoryValueHistory(history, inventoryValue, savedAt)
}

function isMarketTrendArrow(value: unknown): value is MarketTrendArrow {
  return value === '↑' || value === '↓' || value === '→'
}

function normalizeMarketTrends(value: unknown): Record<string, MarketTrendArrow> {
  const defaultTrends = createInitialMarketTrends()

  if (!isRecord(value)) {
    return defaultTrends
  }

  return {
    ...defaultTrends,
    ...Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, MarketTrendArrow] => {
        return typeof entry[0] === 'string' && isMarketTrendArrow(entry[1])
      }),
    ),
  }
}

function normalizeDropsByRarity(value: unknown) {
  const rawDropsByRarity = isRecord(value) ? value : {}

  return Object.values(Rarity).reduce(
    (counts, rarity) => ({
      ...counts,
      [rarity]: isNumber(rawDropsByRarity[rarity])
        ? rawDropsByRarity[rarity]
        : defaultDropsByRarity[rarity],
    }),
    { ...defaultDropsByRarity },
  )
}

function normalizeAnimationSpeed(value: unknown): AnimationSpeed {
  if (value === 'normal' || value === 'fast' || value === 'skip') {
    return value
  }

  if (value === 'slow') {
    return 'normal'
  }

  return defaultGameState.settings.animationSpeed
}

function normalizeLanguage(value: unknown): LanguageCode {
  return value === 'en' || value === 'cs' || value === 'de' || value === 'es' || value === 'fr'
    ? value
    : defaultGameState.settings.language
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

function normalizeRarityColors(value: unknown) {
  const source = isRecord(value) ? value : {}

  return Object.values(Rarity).reduce(
    (colors, rarity) => ({
      ...colors,
      [rarity]: isHexColor(source[rarity]) ? source[rarity] : defaultRarityColors[rarity],
    }),
    { ...defaultRarityColors },
  )
}

function normalizeStatistics(value: unknown): GameStatistics | null {
  if (!isRecord(value)) {
    return null
  }

  if (
    !isNumber(value.casesOpened) ||
    !isNumber(value.moneySpent) ||
    !isNumber(value.moneyEarned) ||
    !isNumber(value.drops) ||
    !isNumber(value.rareDrops)
  ) {
    return null
  }

  return {
    auctionPurchases: Math.max(0, Math.floor(normalizeNumber(value.auctionPurchases, 0))),
    auctionSavings: Math.max(0, normalizeNumber(value.auctionSavings, 0)),
    casesOpened: value.casesOpened,
    moneySpent: value.moneySpent,
    moneyEarned: value.moneyEarned,
    itemsSold: normalizeNumber(value.itemsSold, 0),
    marketPurchases: Math.max(0, Math.floor(normalizeNumber(value.marketPurchases, 0))),
    marketSales: Math.max(0, Math.floor(normalizeNumber(value.marketSales, 0))),
    tradeUpsCompleted: normalizeNumber(value.tradeUpsCompleted, 0),
    drops: value.drops,
    rareDrops: value.rareDrops,
    patternDrops: Math.max(0, Math.floor(normalizeNumber(value.patternDrops, 0))),
    exceptionalPatternDrops: Math.max(0, Math.floor(normalizeNumber(value.exceptionalPatternDrops, 0))),
    workJobsCompleted: Math.max(0, Math.floor(normalizeNumber(value.workJobsCompleted, 0))),
    bestPrecisionScore: Math.min(1, Math.max(0, normalizeNumber(value.bestPrecisionScore, 0))),
    bestMemoryScore: Math.min(1, Math.max(0, normalizeNumber(value.bestMemoryScore, 0))),
    dropsByRarity: normalizeDropsByRarity(value.dropsByRarity),
  }
}

function normalizeSettings(value: unknown): GameSettings {
  if (!isRecord(value)) {
    return defaultGameState.settings
  }

  return {
    animationSpeed: normalizeAnimationSpeed(value.animationSpeed),
    animationsEnabled:
      typeof value.animationsEnabled === 'boolean'
        ? value.animationsEnabled
        : defaultGameState.settings.animationsEnabled,
    autosaveEnabled:
      typeof value.autosaveEnabled === 'boolean'
        ? value.autosaveEnabled
        : defaultGameState.settings.autosaveEnabled,
    autoSellNotificationsEnabled:
      typeof value.autoSellNotificationsEnabled === 'boolean'
        ? value.autoSellNotificationsEnabled
        : defaultGameState.settings.autoSellNotificationsEnabled,
    backupPromptEnabled:
      typeof value.backupPromptEnabled === 'boolean'
        ? value.backupPromptEnabled
        : defaultGameState.settings.backupPromptEnabled,
    debugMode:
      typeof value.debugMode === 'boolean'
        ? value.debugMode
        : defaultGameState.settings.debugMode,
    highContrastMode:
      typeof value.highContrastMode === 'boolean'
        ? value.highContrastMode
        : defaultGameState.settings.highContrastMode,
    language: normalizeLanguage(value.language),
    largeText:
      typeof value.largeText === 'boolean' ? value.largeText : defaultGameState.settings.largeText,
    soundEnabled:
      typeof value.soundEnabled === 'boolean' ? value.soundEnabled : defaultGameState.settings.soundEnabled,
    soundVolume:
      isNumber(value.soundVolume)
        ? Math.max(0, Math.min(1, value.soundVolume))
        : defaultGameState.settings.soundVolume,
    marketSimulationEnabled:
      typeof value.marketSimulationEnabled === 'boolean'
        ? value.marketSimulationEnabled
        : defaultGameState.settings.marketSimulationEnabled,
    marketEventBannersEnabled:
      typeof value.marketEventBannersEnabled === 'boolean'
        ? value.marketEventBannersEnabled
        : defaultGameState.settings.marketEventBannersEnabled,
    musicEnabled:
      typeof value.musicEnabled === 'boolean' ? value.musicEnabled : defaultGameState.settings.musicEnabled,
    rarityColors: normalizeRarityColors(value.rarityColors),
    recentDropFeedAnimationsEnabled:
      typeof value.recentDropFeedAnimationsEnabled === 'boolean'
        ? value.recentDropFeedAnimationsEnabled
        : defaultGameState.settings.recentDropFeedAnimationsEnabled,
    simplifiedAnimations:
      typeof value.simplifiedAnimations === 'boolean'
        ? value.simplifiedAnimations
        : defaultGameState.settings.simplifiedAnimations,
    theme: value.theme === 'dark' || value.theme === 'light' ? value.theme : defaultGameState.settings.theme,
  }
}

function normalizeWorkMiniGameCooldowns(value: unknown, lastPoopCleaningAt = 0): WorkMiniGameCooldowns {
  const source = isRecord(value) ? value : {}

  return WORK_MINIGAMES.reduce<WorkMiniGameCooldowns>((cooldowns, game) => {
    const fallback = game.id === 'poopCleaning' ? lastPoopCleaningAt : 0
    const timestamp = normalizeNumber(source[game.id], fallback)

    if (timestamp > 0) {
      cooldowns[game.id] = timestamp
    }

    return cooldowns
  }, {})
}

function isSortCriterion(value: unknown): value is SortCriterion {
  return (
    value === 'valueDesc' ||
    value === 'valueAsc' ||
    value === 'rarityDesc' ||
    value === 'rarityAsc' ||
    value === 'newest' ||
    value === 'oldest' ||
    value === 'wearBest' ||
    value === 'wearWorst' ||
    value === 'nameAsc' ||
    value === 'nameDesc' ||
    value === 'patternDesc'
  )
}

function normalizeInventoryFilters(value: unknown): InventoryFilters {
  if (!isRecord(value)) {
    return defaultInventoryFilters
  }

  return {
    search: typeof value.search === 'string' ? value.search : defaultInventoryFilters.search,
    rarities:
      Array.isArray(value.rarities) &&
      value.rarities.every((rarity) => isEnumValue(Object.values(Rarity), rarity))
        ? value.rarities
        : defaultInventoryFilters.rarities,
    wearConditions:
      Array.isArray(value.wearConditions) &&
      value.wearConditions.every((wear) => isEnumValue(Object.values(WearCondition), wear))
        ? value.wearConditions
        : defaultInventoryFilters.wearConditions,
    lockedOnly:
      typeof value.lockedOnly === 'boolean' ? value.lockedOnly : defaultInventoryFilters.lockedOnly,
    favoritedOnly:
      typeof value.favoritedOnly === 'boolean'
        ? value.favoritedOnly
        : defaultInventoryFilters.favoritedOnly,
    duplicatesOnly:
      typeof value.duplicatesOnly === 'boolean'
        ? value.duplicatesOnly
        : defaultInventoryFilters.duplicatesOnly,
    specialPatternsOnly:
      typeof value.specialPatternsOnly === 'boolean'
        ? value.specialPatternsOnly
        : defaultInventoryFilters.specialPatternsOnly,
  }
}

const onboardingStepIds: OnboardingStepId[] = [
  'welcome',
  'cash',
  'cases_nav',
  'select_starter_case',
  'open_case',
  'await_opening_result',
  'understand_drop',
  'inventory_nav',
  'inspect_item',
  'collection',
  'quests',
  'work',
  'selling_vs_cswear',
  'career',
  'finish_home',
]
const featureIds: FeatureId[] = ['collection-book', 'quests', 'market', 'cswear', 'trade-ups', 'business', 'prestige']
const isFeatureId = (value: unknown): value is FeatureId => featureIds.includes(value as FeatureId)
const onboardingTipIds: OnboardingTipId[] = ['cswear', 'trade_up', 'career', 'business', 'business_setup', 'market_scout', 'quests', 'prestige', 'drop_journal']

function isOnboardingStepId(value: unknown): value is OnboardingStepId {
  return onboardingStepIds.includes(value as OnboardingStepId)
}

function isOnboardingTipId(value: unknown): value is OnboardingTipId {
  return onboardingTipIds.includes(value as OnboardingTipId)
}

function normalizeOnboardingUiState(value: unknown) {
  if (!isRecord(value)) {
    return defaultOnboardingUiState
  }

  return {
    version: isNumber(value.version) ? Math.max(1, Math.floor(value.version)) : 1,
    activeStepId: isOnboardingStepId(value.activeStepId)
      ? value.activeStepId
      : defaultOnboardingUiState.activeStepId,
    caseOpenBaseline: isNumber(value.caseOpenBaseline) ? Math.max(0, Math.floor(value.caseOpenBaseline)) : defaultOnboardingUiState.caseOpenBaseline,
    openedItemId: typeof value.openedItemId === 'string' ? value.openedItemId : undefined,
    lastValidStepId: isOnboardingStepId(value.lastValidStepId) ? value.lastValidStepId : undefined,
    completedStepIds: Array.isArray(value.completedStepIds)
      ? Array.from(new Set(value.completedStepIds.filter(isOnboardingStepId)))
      : defaultOnboardingUiState.completedStepIds,
    dismissedTipIds: Array.isArray(value.dismissedTipIds)
      ? Array.from(new Set(value.dismissedTipIds.filter(isOnboardingTipId)))
      : defaultOnboardingUiState.dismissedTipIds,
    isDismissed:
      typeof value.isDismissed === 'boolean'
        ? value.isDismissed
        : defaultOnboardingUiState.isDismissed,
    isPaused:
      typeof value.isPaused === 'boolean'
        ? value.isPaused
        : defaultOnboardingUiState.isPaused,
    isReviewing:
      typeof value.isReviewing === 'boolean'
        ? value.isReviewing
        : defaultOnboardingUiState.isReviewing,
  }
}

function normalizeNotificationUiState(value: unknown) {
  if (!isRecord(value)) return defaultNotificationUiState
  return {
    acknowledgedPrestigeKey: typeof value.acknowledgedPrestigeKey === 'string' ? value.acknowledgedPrestigeKey : undefined,
    acknowledgedUpgradeIds: readStringArray(value.acknowledgedUpgradeIds).slice(-256),
    readDropJournalEntryIds: readStringArray(value.readDropJournalEntryIds).slice(-160),
  }
}

function normalizeTradeUpHistory(value: unknown): TradeUpHistoryEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is TradeUpHistoryEntry => isRecord(entry)
    && typeof entry.id === 'string'
    && isNumber(entry.createdAt)
    && isStringArray(entry.inputItemIds)
    && isNumber(entry.inputValue)
    && isSkinInstance(entry.outputItem)
    && isNumber(entry.outputValue)
    && isNumber(entry.profit)).slice(0, 24)
}

function normalizeUiState(value: unknown): GameUiState {
  if (!isRecord(value)) {
    return defaultGameState.ui
  }

  const inventory = isRecord(value.inventory) ? value.inventory : {}
  const onboarding = isRecord(value.onboarding) ? value.onboarding : {}

  return {
    inventory: {
      filters: normalizeInventoryFilters(inventory.filters),
      sortCriterion: isSortCriterion(inventory.sortCriterion)
        ? inventory.sortCriterion
        : defaultInventoryViewUiState.sortCriterion,
    },
    notifications: normalizeNotificationUiState(value.notifications),
    onboarding: normalizeOnboardingUiState(onboarding),
    featureUnlocks: isRecord(value.featureUnlocks) ? {
      unlockedIds: readStringArray(value.featureUnlocks.unlockedIds).filter(isFeatureId),
      acknowledgedIds: readStringArray(value.featureUnlocks.acknowledgedIds).filter(isFeatureId),
      presentedIds: readStringArray(value.featureUnlocks.presentedIds).filter(isFeatureId),
      introducedIds: readStringArray(value.featureUnlocks.introducedIds).filter(isFeatureId),
      selectedCaseId: typeof value.featureUnlocks.selectedCaseId === 'string' ? value.featureUnlocks.selectedCaseId : undefined,
    } : defaultGameState.ui.featureUnlocks,
    tradeUpHistory: normalizeTradeUpHistory(value.tradeUpHistory),
  }
}

function readSkinInstances(value: unknown, fieldName: string) {
  if (!Array.isArray(value) || !value.every(isSkinInstance)) {
    throw new SaveGameError(`Save file has invalid ${fieldName}.`)
  }
  if (value.length > MAX_PERSISTED_INVENTORY_ITEMS) {
    throw new SaveGameError(`Save file ${fieldName} is too large to load safely.`)
  }
  assertUniqueSkinInstanceIds(value, fieldName)
  return value
}

function normalizeOptionalSkinInstances(value: unknown) {
  return Array.isArray(value) && value.every(isSkinInstance) ? dedupeSkinInstances(value) : []
}

function dedupeSkinInstances(items: SkinInstance[]) {
  const seenIds = new Set<string>()

  return items.filter((item) => {
    if (seenIds.has(item.instanceId)) {
      return false
    }

    seenIds.add(item.instanceId)
    return true
  })
}

function assertUniqueSkinInstanceIds(items: SkinInstance[], fieldName: string) {
  const seenIds = new Set<string>()
  for (const item of items) {
    if (seenIds.has(item.instanceId)) {
      throw new SaveGameError(`Save file has duplicate item identity in ${fieldName}: ${item.instanceId}. No items were removed.`)
    }
    seenIds.add(item.instanceId)
  }
}

function readTrophyAssignment(value: unknown, fallbackSlotId: string): TrophyAssignment | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const slotId = typeof value.slotId === 'string' && value.slotId ? value.slotId : fallbackSlotId
  const itemId = typeof value.itemId === 'string'
    ? value.itemId
    : isSkinInstance(value.item)
      ? value.item.instanceId
      : undefined

  if (!itemId || !isNumber(value.assignedAt)) {
    return undefined
  }

  return {
    slotId,
    itemId,
    assignedAt: value.assignedAt,
  }
}

function normalizeTrophyAssignments(value: unknown): TrophyAssignments {
  const defaults = createDefaultTrophyAssignments()

  if (!isRecord(value)) {
    return defaults
  }

  return Object.entries(value).reduce<TrophyAssignments>((assignments, [slotId, rawAssignment]) => {
    const assignment = readTrophyAssignment(rawAssignment, slotId)

    if (assignment) {
      assignments[assignment.slotId] = assignment
    }

    return assignments
  }, { ...defaults })
}

function normalizeCollectionBook(value: unknown) {
  if (!Array.isArray(value) || !value.every(isCollectionEntry)) {
    throw new SaveGameError('Save file has invalid collection book data.')
  }

  return value
}

function isCollectionRewardType(value: unknown): value is CollectionRewardProgress['type'] {
  return (
    value === 'WeaponSellBonus' ||
    value === 'CaseDiscount' ||
    value === 'RarityLuck' ||
    value === 'FullGamePrestigeBonus'
  )
}

function isCollectionRewardProgress(value: unknown): value is CollectionRewardProgress {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    isCollectionRewardType(value.type) &&
    typeof value.targetId === 'string' &&
    isNumber(value.bonus) &&
    isNumber(value.unlockedAt) &&
    (value.carriesOver === undefined || typeof value.carriesOver === 'boolean')
  )
}

function normalizeCollectionRewards(value: unknown): CollectionRewardProgress[] {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Map(
      value
        .filter(isCollectionRewardProgress)
        .map((reward) => [
          reward.id,
          {
            id: reward.id,
            type: reward.type,
            targetId: reward.targetId,
            bonus: reward.bonus,
            unlockedAt: reward.unlockedAt,
            carriesOver: reward.carriesOver,
          },
        ]),
    ).values(),
  )
}

function isDailyChallengeType(value: unknown): value is DailyChallengeType {
  return isEnumValue(Object.values(DailyChallengeType), value)
}

function isDailyChallengeReward(value: unknown): value is DailyChallengeReward {
  if (!isRecord(value)) {
    return false
  }

  return (
    (value.money === undefined || isNumber(value.money)) &&
    (value.openingCredits === undefined || isNumber(value.openingCredits)) &&
    (value.caseDiscountPercent === undefined || isNumber(value.caseDiscountPercent)) &&
    (value.durationMs === undefined || isNumber(value.durationMs))
  )
}

function normalizeDailyChallengeReward(value: unknown): DailyChallengeReward {
  if (!isDailyChallengeReward(value)) {
    return {}
  }

  return {
    money: value.money,
    openingCredits: value.openingCredits,
    caseDiscountPercent: value.caseDiscountPercent,
    durationMs: value.durationMs,
  }
}

function isDailyRewardClaim(value: unknown): value is DailyRewardClaim {
  if (!isRecord(value)) {
    return false
  }

  return (
    isNumber(value.claimedAt) &&
    isNumber(value.day) &&
    typeof value.dayKey === 'string' &&
    typeof value.label === 'string'
  )
}

function normalizeDailyRewardClaim(value: unknown): DailyRewardClaim | undefined {
  if (!isDailyRewardClaim(value)) {
    return undefined
  }

  return {
    claimedAt: value.claimedAt,
    day: Math.max(1, Math.floor(value.day)),
    dayKey: value.dayKey,
    label: value.label,
  }
}

function isDailyCaseDiscountBuff(value: unknown): value is DailyCaseDiscountBuff {
  if (!isRecord(value)) {
    return false
  }

  return isNumber(value.percent) && isNumber(value.expiresAt)
}

function normalizeDailyCaseDiscountBuff(value: unknown, now: number): DailyCaseDiscountBuff | undefined {
  if (!isDailyCaseDiscountBuff(value) || value.expiresAt <= now || value.percent <= 0) {
    return undefined
  }

  return {
    percent: Math.min(0.5, value.percent),
    expiresAt: value.expiresAt,
  }
}

function isDailyChallenge(value: unknown): value is DailyChallenge {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    isDailyChallengeType(value.type) &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    isNumber(value.target) &&
    isNumber(value.progress) &&
    isDailyChallengeReward(value.reward) &&
    typeof value.isClaimed === 'boolean' &&
    (value.rarity === undefined || isEnumValue(Object.values(Rarity), value.rarity)) &&
    isNumber(value.generatedAt)
  )
}

function normalizeDailyChallenges(value: unknown): DailyChallenge[] | undefined {
  if (!Array.isArray(value) || !value.every(isDailyChallenge)) {
    return undefined
  }

  return value.map((challenge) => ({
    id: challenge.id,
    type: challenge.type,
    title: challenge.title,
    description: challenge.description,
    target: Math.max(1, challenge.target),
    progress: Math.max(0, Math.min(Math.max(1, challenge.target), challenge.progress)),
    reward: normalizeDailyChallengeReward(challenge.reward),
    isClaimed: challenge.isClaimed,
    rarity: challenge.rarity,
    generatedAt: challenge.generatedAt,
    progressKeys: Array.isArray(challenge.progressKeys)
      ? challenge.progressKeys.filter((entry): entry is string => typeof entry === 'string').slice(-100)
      : undefined,
  }))
}

function normalizeDailyRewardsState(value: unknown, now = Date.now()): DailyRewardsState {
  const defaults = createDefaultDailyRewardsState(now)

  if (!isRecord(value)) {
    return defaults
  }

  const baseState: DailyRewardsState = {
    streak: Math.max(0, Math.floor(normalizeNumber(value.streak, defaults.streak))),
    lastClaimTime: Math.max(0, normalizeNumber(value.lastClaimTime, defaults.lastClaimTime)),
    lastClaimDayKey: typeof value.lastClaimDayKey === 'string' ? value.lastClaimDayKey : undefined,
    lastChallengeResetDayKey:
      typeof value.lastChallengeResetDayKey === 'string'
        ? value.lastChallengeResetDayKey
        : defaults.lastChallengeResetDayKey,
    freeRerollDayKey: typeof value.freeRerollDayKey === 'string' ? value.freeRerollDayKey : undefined,
    freeRerollsUsed: Math.max(0, Math.floor(normalizeNumber(value.freeRerollsUsed, 0))),
    caseDiscountBuff: normalizeDailyCaseDiscountBuff(value.caseDiscountBuff, now),
    lastReward: normalizeDailyRewardClaim(value.lastReward),
    challenges: normalizeDailyChallenges(value.challenges) ?? defaults.challenges,
    openingCredits: Math.max(
      0,
      Math.min(20, normalizeNumber(value.openingCredits, defaults.openingCredits)),
    ),
  }

  return refreshDailyRewardsState(baseState, now)
}

function normalizeAutoSellRules(value: unknown) {
  return Array.isArray(value) && value.every(isAutoSellRule) ? value : []
}

function normalizeMarketplace(value: unknown): MarketplaceState {
  if (!isRecord(value)) return createDefaultMarketplaceState()
  const isMarketplaceNpc = (entry: unknown): entry is MarketplaceNpc => (
    isRecord(entry) && typeof entry.id === 'string' && typeof entry.username === 'string' &&
    isNumber(entry.avatarHue) && isNumber(entry.personalitySeed) && typeof entry.archetypeId === 'string' &&
    isNumber(entry.patience) && isNumber(entry.priceSensitivity) && isNumber(entry.negotiationTolerance) &&
    isNumber(entry.responseDelayMs) && Array.isArray(entry.preferredWeapons) &&
    entry.preferredWeapons.every((weapon) => typeof weapon === 'string')
  )
  const transactionTypes = new Set(['npc-purchase', 'negotiated-purchase', 'player-sale', 'negotiated-sale', 'instant-sale', 'listing-cancelled', 'npc-offer'])
  const npcListings = Array.isArray(value.npcListings)
    ? value.npcListings.filter((entry): entry is NpcMarketListing => (
        isRecord(entry) && typeof entry.id === 'string' && isSkinInstance(entry.item) &&
        isMarketplaceNpc(entry.seller) &&
        isNumber(entry.askingPrice) && isNumber(entry.reservationPrice) &&
        isNumber(entry.fairMarketValue) && isNumber(entry.liquidityScore) && isNumber(entry.scarcityScore) &&
        isNumber(entry.createdAt) && isNumber(entry.expiresAt)
      ))
    : []
  if (Array.isArray(value.playerListings) && value.playerListings.length > MAX_PLAYER_MARKET_LISTINGS) {
    throw new SaveGameError('Save file has too many player marketplace listings to load safely.')
  }
  const playerListingIsValid = (entry: unknown): entry is PlayerMarketListing => (
        isRecord(entry) && typeof entry.id === 'string' && isSkinInstance(entry.item) &&
        isNumber(entry.askingPrice) && isNumber(entry.fairMarketValue) &&
        isNumber(entry.createdAt) && isNumber(entry.expiresAt) && typeof entry.status === 'string'
      )
  if (Array.isArray(value.playerListings) && !value.playerListings.every(playerListingIsValid)) {
    throw new SaveGameError('Save file has invalid player marketplace escrow. No listed items were removed.')
  }
  const playerListings = Array.isArray(value.playerListings) ? value.playerListings as PlayerMarketListing[] : []
  assertUniqueSkinInstanceIds(playerListings.map((listing) => listing.item), 'player marketplace escrow')
  const transactions = Array.isArray(value.transactions)
    ? value.transactions.filter((entry): entry is MarketplaceTransaction => (
        isRecord(entry) && typeof entry.id === 'string' && typeof entry.type === 'string' && transactionTypes.has(entry.type) &&
        isSkinInstance(entry.item) && isNumber(entry.price) && isNumber(entry.fairMarketValue) &&
        isNumber(entry.createdAt)
      )).slice(0, 160)
    : []
  const pendingAcquisition = isRecord(value.pendingAcquisition) &&
    typeof value.pendingAcquisition.id === 'string' &&
    typeof value.pendingAcquisition.source === 'string' &&
    isSkinInstance(value.pendingAcquisition.item) &&
    isNumber(value.pendingAcquisition.createdAt)
      ? value.pendingAcquisition as unknown as AcquisitionReveal
      : undefined
  return {
    npcListings,
    playerListings,
    transactions,
    processedRequestIds: readStringArray(value.processedRequestIds).slice(-120),
    lastSupplyTick: normalizeNumber(value.lastSupplyTick, 0),
    nextSupplyTick: normalizeNumber(value.nextSupplyTick, 0),
    virtualMarketEpoch: Math.max(0, Math.floor(normalizeNumber(value.virtualMarketEpoch, 0))),
    virtualMarketNextEpochAt: Math.max(0, normalizeNumber(value.virtualMarketNextEpochAt, Date.now() + MARKETPLACE_EPOCH_MS)),
    virtualMarketSeed: Math.max(0, Math.floor(normalizeNumber(value.virtualMarketSeed, 0x435332))),
    removedVirtualListingIds: readStringArray(value.removedVirtualListingIds),
    pendingAcquisition,
  }
}

function isAchievementProgress(value: unknown): value is AchievementProgress {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.isClaimed === 'boolean' &&
    isNumber(value.unlockedAt)
  )
}

function normalizeAchievements(value: unknown, fallbackUnlockedAt: number): AchievementProgress[] {
  if (!Array.isArray(value)) {
    return []
  }

  const achievementsById = new Map<string, AchievementProgress>()

  for (const entry of value) {
    if (typeof entry === 'string') {
      achievementsById.set(`${entry}:lifetime`, {
        id: entry,
        isClaimed: false,
        unlockedAt: fallbackUnlockedAt,
      })
      continue
    }

    if (isAchievementProgress(entry)) {
      const scope = entry.scope === 'currentRun' ? 'currentRun' : 'lifetime'
      const runId = scope === 'currentRun' && typeof entry.runId === 'string' ? entry.runId : undefined
      achievementsById.set(`${entry.id}:${runId ?? 'lifetime'}`, {
        id: entry.id,
        isClaimed: entry.isClaimed,
        unlockedAt: entry.unlockedAt,
        scope,
        runId,
      })
    }
  }

  return Array.from(achievementsById.values())
}

function isAutomationModuleId(value: unknown): value is AutomationModuleId {
  return isEnumValue(Object.values(AutomationModuleId), value)
}

function normalizeAutomationModule(
  moduleId: AutomationModuleId,
  value: unknown,
): AutomationModuleState {
  const defaultModule = createDefaultAutomationModules()[moduleId]

  if (!isRecord(value)) {
    return defaultModule
  }

  return {
    id: isAutomationModuleId(value.id) ? value.id : moduleId,
    isEnabled: typeof value.isEnabled === 'boolean' ? value.isEnabled : defaultModule.isEnabled,
    lastRunTime: normalizeNumber(value.lastRunTime, defaultModule.lastRunTime),
    level: Math.max(0, Math.floor(normalizeNumber(value.level, defaultModule.level))),
    totalGenerated: Math.max(0, normalizeNumber(value.totalGenerated, defaultModule.totalGenerated)),
    totalRuns: Math.max(0, Math.floor(normalizeNumber(value.totalRuns, defaultModule.totalRuns))),
  }
}

function normalizeAuctionDeal(value: unknown): AuctionHouseDeal | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !isSkinInstance(value.item) ||
    !isNumber(value.listPrice) ||
    !isNumber(value.price) ||
    !isNumber(value.discount) ||
    !isNumber(value.createdAt) ||
    !isNumber(value.expiresAt) ||
    value.expiresAt <= value.createdAt
  ) {
    return undefined
  }

  return {
    id: value.id,
    item: value.item,
    listPrice: Math.max(0.01, value.listPrice),
    price: Math.max(0.01, value.price),
    discount: Math.min(0.5, Math.max(0, value.discount)),
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
  }
}

function normalizeActiveGameEvents(value: unknown, now: number) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry): ActiveGameEvent[] => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      !GAME_EVENT_TYPES.includes(entry.type as ActiveGameEvent['type']) ||
      !isNumber(entry.startTime) ||
      !isNumber(entry.endTime) ||
      entry.endTime <= entry.startTime
    ) {
      return []
    }

    return [eventManager.hydrateEvent(entry as unknown as ActiveGameEvent, now)]
  })
}

function normalizeGameEventHistory(value: unknown): GameEventLog[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is GameEventLog => (
    isRecord(entry) &&
    typeof entry.id === 'string' &&
    GAME_EVENT_TYPES.includes(entry.type as GameEventLog['type']) &&
    isNumber(entry.startTime) &&
    isNumber(entry.endTime) &&
    isNumber(entry.endedAt)
  )).slice(0, 50)
}

function normalizeActiveMarketEvents(value: unknown, now: number) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry): ActiveMarketEvent[] => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      typeof entry.type !== 'string' ||
      !isNumber(entry.startTime) ||
      !isNumber(entry.endTime) ||
      entry.endTime <= entry.startTime
    ) {
      return []
    }

    try {
      return [hydrateMarketEvent(entry as unknown as ActiveMarketEvent, now)]
    } catch {
      return []
    }
  })
}

function normalizeMarketEventHistory(value: unknown): MarketEventLog[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is MarketEventLog => (
    isRecord(entry) &&
    typeof entry.id === 'string' &&
    typeof entry.type === 'string' &&
    typeof entry.label === 'string'
  )).slice(0, 30)
}

function normalizeAutomation(value: unknown): AutomationState {
  const automation = isRecord(value) ? value : {}
  const autoOpener = isRecord(automation.autoOpener) ? automation.autoOpener : {}
  const level = Math.max(0, Math.floor(normalizeNumber(autoOpener.level, 0)))
  const rawModules = isRecord(automation.modules) ? automation.modules : {}
  const modules = Object.values(AutomationModuleId).reduce((normalizedModules, moduleId) => {
    normalizedModules[moduleId] = normalizeAutomationModule(moduleId, rawModules[moduleId])
    return normalizedModules
  }, createDefaultAutomationModules())
  const auctionHouse = isRecord(automation.auctionHouse) ? automation.auctionHouse : {}

  return {
    autoOpener: {
      caseId: typeof autoOpener.caseId === 'string' ? autoOpener.caseId : defaultAutomationState.autoOpener.caseId,
      intervalMs: normalizeNumber(autoOpener.intervalMs, getAutoOpenerIntervalMs(level || 1)),
      isEnabled: typeof autoOpener.isEnabled === 'boolean' ? autoOpener.isEnabled : false,
      lastOpenTime: normalizeNumber(autoOpener.lastOpenTime, 0),
      level,
      totalOpened: Math.max(0, Math.floor(normalizeNumber(autoOpener.totalOpened, 0))),
    },
    auctionHouse: {
      deals: Array.isArray(auctionHouse.deals)
        ? auctionHouse.deals.flatMap((deal) => {
            const normalizedDeal = normalizeAuctionDeal(deal)

            return normalizedDeal ? [normalizedDeal] : []
          })
        : [],
      lastRefreshTime: normalizeNumber(auctionHouse.lastRefreshTime, 0),
      nextRefreshTime: normalizeNumber(auctionHouse.nextRefreshTime, 0),
    },
    modules,
  }
}

function migrateV0ToV1(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  const statistics = isRecord(value.statistics) ? value.statistics : {}

  return {
    ...value,
    casesUnlocked: value.casesUnlocked ?? value.unlockedCases ?? defaultGameState.casesUnlocked,
    autoSellRules: Array.isArray(value.autoSellRules) ? value.autoSellRules : [],
    collectionRewards: normalizeCollectionRewards(value.collectionRewards),
    upgradePoints: normalizeNumber(value.upgradePoints, 0),
    achievements: normalizeAchievements(value.achievements, normalizeNumber(value.lastSaved, Date.now())),
    lastSaved: normalizeNumber(value.lastSaved, Date.now()),
    statistics: {
      ...statistics,
      itemsSold: normalizeNumber(statistics.itemsSold, 0),
    },
  }
}

function migrateV1ToV2(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    specialEventCaseIds: [],
    recentDrops: Array.isArray(value.recentDrops) ? value.recentDrops : [],
    lastOpenedItems: Array.isArray(value.lastOpenedItems) ? value.lastOpenedItems : [],
    uiEvents: [],
    settings: isRecord(value.settings) ? value.settings : defaultGameState.settings,
  }
}

function migrateV2ToV3(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    ui: isRecord(value.ui) ? value.ui : defaultGameState.ui,
  }
}

function migrateV3ToV4(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    favoriteCaseIds: readStringArray(value.favoriteCaseIds),
    settings: {
      ...(isRecord(value.settings) ? value.settings : defaultGameState.settings),
      marketSimulationEnabled:
        isRecord(value.settings) && typeof value.settings.marketSimulationEnabled === 'boolean'
          ? value.settings.marketSimulationEnabled
          : defaultGameState.settings.marketSimulationEnabled,
    },
  }
}

function migrateV4ToV5(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    settings: {
      ...(isRecord(value.settings) ? value.settings : defaultGameState.settings),
      animationSpeed: isRecord(value.settings)
        ? normalizeAnimationSpeed(value.settings.animationSpeed)
        : defaultGameState.settings.animationSpeed,
    },
  }
}

function migrateV5ToV6(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    activeMarketEvents: Array.isArray(value.activeMarketEvents) ? value.activeMarketEvents : [],
    lastMarketTick: normalizeNumber(value.lastMarketTick, 0),
    marketEventHistory: Array.isArray(value.marketEventHistory) ? value.marketEventHistory : [],
    marketTrends: isRecord(value.marketTrends) ? value.marketTrends : createInitialMarketTrends(),
  }
}

function migrateV6ToV7(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  const marketValues = normalizeMarketValues(value.marketValues) ?? defaultGameState.marketValues

  return {
    ...value,
    marketHistory: isRecord(value.marketHistory)
      ? value.marketHistory
      : createInitialMarketHistory({
          marketValues,
          now: normalizeNumber(value.lastSaved, Date.now()),
        }),
  }
}

function migrateV7ToV8(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    upcomingMarketEvents: Array.isArray(value.upcomingMarketEvents) ? value.upcomingMarketEvents : [],
  }
}

function migrateV8ToV9(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  const inventory = Array.isArray(value.inventory) && value.inventory.every(isSkinInstance)
    ? value.inventory
    : []
  const marketValues = normalizeMarketValues(value.marketValues) ?? defaultGameState.marketValues
  const inventoryValue = getInventoryValue(inventory, {
    ...defaultGameState.marketValues,
    ...marketValues,
  })
  const savedAt = normalizeNumber(value.lastSaved, Date.now())

  return {
    ...value,
    inventoryValue,
    inventoryValueHistory: normalizeInventoryValueHistory(
      value.inventoryValueHistory,
      inventoryValue,
      savedAt,
    ),
  }
}

function migrateV9ToV10(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  const statistics = isRecord(value.statistics) ? value.statistics : {}

  return {
    ...value,
    statistics: {
      ...statistics,
      tradeUpsCompleted: normalizeNumber(statistics.tradeUpsCompleted, 0),
    },
  }
}

function migrateV10ToV11(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    automation: normalizeAutomation(value.automation),
  }
}

function migrateV11ToV12(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    automation: normalizeAutomation(value.automation),
  }
}

function migrateV12ToV13(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  const unlockedAt = normalizeNumber(value.lastSaved, Date.now())

  return {
    ...value,
    upgradePoints: normalizeNumber(value.upgradePoints, 0),
    achievements: normalizeAchievements(value.achievements, unlockedAt),
  }
}

function migrateV13ToV14(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    collectionRewards: normalizeCollectionRewards(value.collectionRewards),
  }
}

function migrateV14ToV15(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    upgrades: normalizeUpgradeLevels(value.upgrades),
  }
}

function migrateV15ToV16(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    prestigePoints: normalizeNumber(value.prestigePoints, 0),
    prestigeBonuses: normalizePrestigeBonusLevels(value.prestigeBonuses),
  }
}

function migrateV16ToV17(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    skillPoints: normalizeNumber(value.skillPoints, 0),
    learnedSkillNodeIds: normalizeLearnedSkillNodeIds(value.learnedSkillNodeIds),
  }
}

function migrateV17ToV18(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    trophyAssignments: normalizeTrophyAssignments(value.trophyAssignments),
  }
}

function migrateV18ToV19(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    activeEvents: [],
    upcomingEvents: [],
    eventHistory: [],
  }
}

function migrateV19ToV20(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    dailyRewards: normalizeDailyRewardsState(value.dailyRewards, Date.now()),
  }
}

function migrateV20ToV21(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    settings: normalizeSettings(value.settings),
  }
}

function migrateV21ToV22(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    lastBackupAt: normalizeNumber(value.lastBackupAt, 0),
    settings: normalizeSettings(value.settings),
  }
}

function migrateV22ToV23(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    ui: normalizeUiState(value.ui),
  }
}

function migrateV23ToV24(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    lastPoopCleaningAt: normalizeNumber(value.lastPoopCleaningAt, 0),
  }
}

function migrateV24ToV25(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    // Preserve item bytes. Current validation rejects duplicate instance IDs
    // instead of silently deleting one potentially valuable copy.
    inventory: value.inventory,
    money: normalizeMoney(value.money, defaultGameState.money),
    trophyAssignments: normalizeTrophyAssignments(value.trophyAssignments),
  }
}

function migrateV25ToV26(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return value
}

function migrateV26ToV27(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  return {
    ...value,
    hasUsedFirstCaseHook: typeof value.hasUsedFirstCaseHook === 'boolean'
      ? value.hasUsedFirstCaseHook
      : false,
  }
}

function migrateV27ToV28(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  const statistics = isRecord(value.statistics) ? value.statistics : {}

  return {
    ...value,
    automation: normalizeAutomation(value.automation),
    lastEventTick: normalizeNumber(value.lastEventTick, 0),
    statistics: {
      ...statistics,
      auctionPurchases: normalizeNumber(statistics.auctionPurchases, 0),
      auctionSavings: normalizeNumber(statistics.auctionSavings, 0),
    },
  }
}

function migrateV28ToV29(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  const statistics = isRecord(value.statistics) ? value.statistics : {}

  // Legacy inventory entries intentionally keep paintSeed/pattern absent. Assigning
  // them during migration would silently reroll items the player already owns.
  return {
    ...value,
    statistics: {
      ...statistics,
      patternDrops: normalizeNumber(statistics.patternDrops, 0),
      exceptionalPatternDrops: normalizeNumber(statistics.exceptionalPatternDrops, 0),
    },
  }
}

function migrateV29ToV30(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  const statistics = isRecord(value.statistics) ? value.statistics : {}

  return {
    ...value,
    statistics: {
      ...statistics,
      workJobsCompleted: normalizeNumber(statistics.workJobsCompleted, 0),
      bestPrecisionScore: normalizeNumber(statistics.bestPrecisionScore, 0),
      bestMemoryScore: normalizeNumber(statistics.bestMemoryScore, 0),
    },
  }
}

function migrateV30ToV31(value: unknown): unknown {
  if (!isRecord(value)) return value
  const statistics = isRecord(value.statistics) ? value.statistics : {}
  return {
    ...value,
    marketplace: createDefaultMarketplaceState(),
    statistics: {
      ...statistics,
      marketPurchases: normalizeNumber(statistics.marketPurchases, 0),
      marketSales: normalizeNumber(statistics.marketSales, 0),
    },
  }
}

function migrateV31ToV32(value: unknown): unknown {
  if (!isRecord(value)) return value
  const marketplace = isRecord(value.marketplace) ? value.marketplace : createDefaultMarketplaceState()
  return {
    ...value,
    marketplace: {
      ...marketplace,
      virtualMarketEpoch: Math.max(0, Math.floor(normalizeNumber(marketplace.virtualMarketEpoch, 0))),
      virtualMarketNextEpochAt: Math.max(0, normalizeNumber(marketplace.virtualMarketNextEpochAt, Date.now() + 6 * 60 * 60_000)),
      virtualMarketSeed: Math.max(0, Math.floor(normalizeNumber(marketplace.virtualMarketSeed, 0x435332))),
      removedVirtualListingIds: readStringArray(marketplace.removedVirtualListingIds),
    },
  }
}

function migrateV32ToV33(value: unknown): unknown {
  if (!isRecord(value)) return value
  const marketplace = isRecord(value.marketplace) ? value.marketplace : createDefaultMarketplaceState()
  const now = Date.now()
  const virtualMarketEpoch = Math.floor(now / MARKETPLACE_EPOCH_MS)
  return {
    ...value,
    marketplace: {
      ...marketplace,
      virtualMarketEpoch,
      virtualMarketNextEpochAt: (virtualMarketEpoch + 1) * MARKETPLACE_EPOCH_MS,
      virtualMarketSeed: Math.max(0, Math.floor(normalizeNumber(marketplace.virtualMarketSeed, 0x435332))),
      removedVirtualListingIds: readStringArray(marketplace.removedVirtualListingIds),
    },
  }
}

function migrateV33ToV34(value: unknown): unknown {
  if (!isRecord(value)) return value
  const statistics = normalizeStatistics(value.statistics) ?? defaultGameState.statistics
  const savedAt = normalizeNumber(value.lastSaved, Date.now())
  return {
    ...value,
    economyLedger: createEconomyLedger({
      now: savedAt,
      runId: `legacy-v34-${savedAt.toString(36)}`,
      legacyStatistics: statistics,
    }),
  }
}

function migrateV34ToV35(value: unknown): unknown {
  if (!isRecord(value)) return value
  const savedAt = normalizeNumber(value.lastSaved, Date.now())
  const achievements = normalizeAchievements(value.achievements, savedAt)
  const collectionEntries = normalizeCollectionBook(value.collectionBook)
  const ledger = isRecord(value.economyLedger) ? value.economyLedger : {}
  const runId = typeof ledger.currentRunId === 'string'
    ? ledger.currentRunId
    : `legacy-v35-${savedAt.toString(36)}`
  return {
    ...value,
    career: createLegacyCareerState({
      achievementIds: achievements.map((achievement) => achievement.id),
      collectionEntries,
      now: savedAt,
      runId,
    }),
  }
}

function migrateV35ToV36(value: unknown): unknown {
  if (!isRecord(value)) return value
  const now = normalizeNumber(value.lastSaved, Date.now())
  const automation = normalizeAutomation(value.automation)
  const upgrades = normalizeUpgradeLevels(value.upgrades)
  return {
    ...value,
    automation: retireLegacyAutomation(automation),
    business: migrateLegacyAutomationToBusiness(automation, upgrades, now),
  }
}

function migrateV36ToV37(value: unknown): unknown {
  if (!isRecord(value)) return value
  const now = normalizeNumber(value.lastSaved, Date.now())
  const normalizedUpgrades = normalizeUpgradeLevels(value.upgrades)
  const legacyUpgradeLevels = Object.entries(normalizedUpgrades)
    .filter(([id]) => id !== 'module_bay')
    .reduce((total, [, level]) => total + Math.max(0, Math.floor(level)), 0)
  return {
    ...value,
    careerUpgrades: createLegacyCareerUpgradeState({
      now,
      skillPoints: normalizeNumber(value.skillPoints, 0),
      upgradePoints: normalizeNumber(value.upgradePoints, 0),
      learnedSkillCount: readStringArray(value.learnedSkillNodeIds).length,
      legacyUpgradeLevels,
    }),
  }
}

function migrateV37ToV38(value: unknown): unknown {
  if (!isRecord(value)) return value
  const legacyLevel = Math.max(0, Math.floor(normalizeNumber(value.prestigeLevel, 0)))
  return {
    ...value,
    prestigeSystem: createDefaultPrestigeSystem(
      legacyLevel,
      isRecord(value.prestigeBonuses) ? value.prestigeBonuses : {},
    ),
    currentRunCollectionBook: [],
  }
}

function migrateV38ToV39(value: unknown): unknown {
  if (!isRecord(value)) return value
  const legacyLevel = Math.max(0, Math.floor(normalizeNumber(value.prestigeLevel, 0)))
  const normalizedPrestige = normalizePrestigeSystem(value.prestigeSystem, legacyLevel)
  const spent = getTotalPrestigePerkSpend(normalizedPrestige.perkLevels)
  const unspent = Math.max(0, Math.floor(normalizeNumber(value.prestigePoints, 0)))
  return {
    ...value,
    prestigeSystem: {
      ...normalizedPrestige,
      totalPointsSpent: Math.max(normalizedPrestige.totalPointsSpent, spent),
      totalPointsEarned: Math.max(normalizedPrestige.totalPointsEarned, spent + unspent),
      migrationNote: normalizedPrestige.migrationNote ?? 'v39 preserved existing Prestige Points and perk investment without fabricating run details.',
    },
    achievements: Array.isArray(value.achievements)
      ? value.achievements.map((entry) => isRecord(entry) ? { ...entry, scope: entry.scope === 'currentRun' ? 'currentRun' : 'lifetime' } : entry)
      : value.achievements,
  }
}

function migrateV39ToV40(value: unknown): unknown {
  if (!isRecord(value)) return value
  const now = normalizeNumber(value.lastSaved, Date.now())
  return {
    ...value,
    // Historical quest/drop events cannot be reconstructed honestly. Existing
    // collections and inventory remain untouched and tracking starts at v40.
    quests: createDefaultQuestSystem(now),
    dropJournal: createDefaultDropJournal(),
  }
}

function migrateV40ToV41(value: unknown): unknown {
  if (!isRecord(value)) return value
  const previousUi = isRecord(value.ui) ? value.ui : {}
  const previousOnboarding = isRecord(previousUi.onboarding) ? previousUi.onboarding : {}
  const wasFinished = previousOnboarding.isDismissed === true
  return {
    ...value,
    ui: {
      ...previousUi,
      notifications: defaultNotificationUiState,
      onboarding: {
        ...defaultOnboardingUiState,
        completedStepIds: wasFinished ? onboardingStepIds : [],
        isDismissed: wasFinished,
      },
      tradeUpHistory: [],
    },
  }
}

function migrateV41ToV42(value: unknown): unknown {
  if (!isRecord(value)) return value
  const ui = isRecord(value.ui) ? value.ui : {}
  const onboarding = isRecord(ui.onboarding) ? ui.onboarding : {}
  return {
    ...value,
    ui: {
      ...ui,
      onboarding: { ...onboarding, version: 2, isDismissed: true, isPaused: false, isReviewing: false },
      featureUnlocks: { unlockedIds: featureIds, acknowledgedIds: featureIds, presentedIds: featureIds, introducedIds: featureIds },
    },
  }
}

const migrations: Record<number, (value: unknown) => unknown> = {
  0: migrateV0ToV1,
  1: migrateV1ToV2,
  2: migrateV2ToV3,
  3: migrateV3ToV4,
  4: migrateV4ToV5,
  5: migrateV5ToV6,
  6: migrateV6ToV7,
  7: migrateV7ToV8,
  8: migrateV8ToV9,
  9: migrateV9ToV10,
  10: migrateV10ToV11,
  11: migrateV11ToV12,
  12: migrateV12ToV13,
  13: migrateV13ToV14,
  14: migrateV14ToV15,
  15: migrateV15ToV16,
  16: migrateV16ToV17,
  17: migrateV17ToV18,
  18: migrateV18ToV19,
  19: migrateV19ToV20,
  20: migrateV20ToV21,
  21: migrateV21ToV22,
  22: migrateV22ToV23,
  23: migrateV23ToV24,
  24: migrateV24ToV25,
  25: migrateV25ToV26,
  26: migrateV26ToV27,
  27: migrateV27ToV28,
  28: migrateV28ToV29,
  29: migrateV29ToV30,
  30: migrateV30ToV31,
  31: migrateV31ToV32,
  32: migrateV32ToV33,
  33: migrateV33ToV34,
  34: migrateV34ToV35,
  35: migrateV35ToV36,
  36: migrateV36ToV37,
  37: migrateV37ToV38,
  38: migrateV38ToV39,
  39: migrateV39ToV40,
  40: migrateV40ToV41,
  41: migrateV41ToV42,
}

function getEnvelope(value: unknown) {
  if (isRecord(value) && isNumber(value.version) && 'state' in value) {
    return {
      version: Math.floor(value.version),
      savedAt: normalizeNumber(value.savedAt, Date.now()),
      state: value.state,
    }
  }

  return {
    version: 0,
    savedAt: Date.now(),
    state: value,
  }
}

function migrateToCurrent(value: unknown) {
  const envelope = getEnvelope(value)

  if (envelope.version > CURRENT_SAVE_VERSION) {
    throw new SaveGameError('This save was created by a newer version of the game.')
  }

  let version = envelope.version
  let state = envelope.state

  while (version < CURRENT_SAVE_VERSION) {
    const migration = migrations[version]

    if (!migration) {
      throw new SaveGameError('This save version cannot be migrated.')
    }

    state = migration(state)
    version += 1
  }

  return {
    savedAt: envelope.savedAt,
    state,
  }
}

export function toPlayerState(state: GameState): PlayerState {
  return {
    money: state.money,
    inventory: state.inventory,
    inventoryValue: state.inventoryValue,
    inventoryValueHistory: state.inventoryValueHistory,
    unlockedCases: state.casesUnlocked,
    autoSellRules: state.autoSellRules,
    marketplace: state.marketplace,
    automation: state.automation,
    business: state.business,
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
    career: state.career,
    careerUpgrades: state.careerUpgrades,
    quests: state.quests,
    dropJournal: state.dropJournal,
    lastBackupAt: state.lastBackupAt,
    lastSaved: state.lastSaved,
  }
}

function playerStateToGameState(state: PlayerState): GameState {
  const inventory = dedupeSkinInstances(state.inventory)
  const marketValues = {
    ...defaultGameState.marketValues,
    ...state.marketValues,
  }
  const inventoryValue = getInventoryValue(inventory, marketValues)
  const achievements = normalizeAchievements(state.achievements, state.lastSaved)
  const collectionBook = normalizeCollectionBook(state.collectionBook)
  const career = normalizeCareerState(state.career, {
    achievements,
    collectionEntries: collectionBook,
    now: state.lastSaved,
    runId: defaultGameState.economyLedger.currentRunId,
  })

  return {
    ...defaultGameState,
    money: normalizeMoney(state.money, defaultGameState.money),
    inventory,
    inventoryValue,
    inventoryValueHistory: normalizeInventoryValueHistory(
      state.inventoryValueHistory,
      inventoryValue,
      state.lastSaved,
    ),
    casesUnlocked: state.unlockedCases,
    autoSellRules: state.autoSellRules,
    marketplace: normalizeMarketplace(state.marketplace),
    automation: normalizeAutomation(state.automation),
    business: normalizeBusinessState(state.business, state.lastSaved),
    upgrades: normalizeUpgradeLevels(state.upgrades),
    trophyAssignments: normalizeTrophyAssignments(state.trophyAssignments),
    dailyRewards: normalizeDailyRewardsState(state.dailyRewards),
    collectionBook,
    currentRunCollectionBook: normalizeCollectionBook(state.currentRunCollectionBook),
    collectionRewards: state.collectionRewards,
    hasUsedFirstCaseHook: typeof state.hasUsedFirstCaseHook === 'boolean'
      ? state.hasUsedFirstCaseHook
      : defaultGameState.hasUsedFirstCaseHook,
    lastPoopCleaningAt: normalizeNumber(state.lastPoopCleaningAt, defaultGameState.lastPoopCleaningAt),
    workMiniGameCooldowns: normalizeWorkMiniGameCooldowns(
      state.workMiniGameCooldowns,
      normalizeNumber(state.lastPoopCleaningAt, defaultGameState.lastPoopCleaningAt),
    ),
    prestigeLevel: state.prestigeLevel,
    prestigePoints: state.prestigePoints,
    prestigeBonuses: normalizePrestigeBonusLevels(state.prestigeBonuses),
    prestigeSystem: normalizePrestigeSystem(state.prestigeSystem, state.prestigeLevel),
    upgradePoints: state.upgradePoints,
    skillPoints: state.skillPoints,
    learnedSkillNodeIds: normalizeLearnedSkillNodeIds(state.learnedSkillNodeIds),
    achievements,
    marketValues,
    marketHistory: {
      ...defaultGameState.marketHistory,
      ...state.marketHistory,
    },
    activeEvents: state.activeEvents,
    upcomingEvents: state.upcomingEvents,
    eventHistory: state.eventHistory,
    statistics: state.statistics,
    career,
    careerUpgrades: normalizeCareerUpgradeState(state.careerUpgrades, state.lastSaved),
    quests: normalizeQuestSystem(state.quests, state.lastSaved),
    dropJournal: normalizeDropJournal(state.dropJournal),
    lastBackupAt: normalizeNumber(state.lastBackupAt, defaultGameState.lastBackupAt),
    lastSaved: state.lastSaved,
  }
}

function isGameState(value: GameState | PlayerState): value is GameState {
  return 'casesUnlocked' in value
}

function normalizeGameState(value: unknown, savedAt: number): GameState {
  if (!isRecord(value)) {
    throw new SaveGameError('Save file data is not a valid object.')
  }

  const marketValues = normalizeMarketValues(value.marketValues)
  const statistics = normalizeStatistics(value.statistics)

  if (!marketValues) {
    throw new SaveGameError('Save file is missing market values.')
  }

  if (!statistics) {
    throw new SaveGameError('Save file is missing player statistics.')
  }

  const inventory = readSkinInstances(value.inventory, 'inventory')
  const mergedMarketValues = {
    ...defaultGameState.marketValues,
    ...marketValues,
  }
  const inventoryValue = getInventoryValue(inventory, mergedMarketValues)
  const lastSaved = normalizeNumber(value.lastSaved, savedAt)
  const lastPoopCleaningAt = normalizeNumber(value.lastPoopCleaningAt, defaultGameState.lastPoopCleaningAt)
  const activeEvents = normalizeActiveGameEvents(value.activeEvents, lastSaved)
  const upcomingEvents = normalizeActiveGameEvents(value.upcomingEvents, lastSaved)
  const activeMarketEvents = normalizeActiveMarketEvents(value.activeMarketEvents, lastSaved)
  const upcomingMarketEvents = normalizeActiveMarketEvents(value.upcomingMarketEvents, lastSaved)
  const marketplace = normalizeMarketplace(value.marketplace)
  const inventoryIds = new Set(inventory.map((item) => item.instanceId))
  const duplicatedEscrowItem = marketplace.playerListings.find((listing) => inventoryIds.has(listing.item.instanceId))
  if (duplicatedEscrowItem) {
    throw new SaveGameError(`Save file contains item ${duplicatedEscrowItem.item.instanceId} in both inventory and marketplace escrow. No item was removed.`)
  }
  const economyLedger = normalizeEconomyLedger(
    value.economyLedger,
    statistics,
    lastSaved,
    [...inventory, ...marketplace.playerListings.map((listing) => listing.item)],
  )
  const achievements = normalizeAchievements(value.achievements, lastSaved)
  const collectionBook = normalizeCollectionBook(value.collectionBook)
  const career = normalizeCareerState(value.career, {
    achievements,
    collectionEntries: collectionBook,
    now: lastSaved,
    runId: economyLedger.currentRunId,
  })
  const careerUpgrades = normalizeCareerUpgradeState(value.careerUpgrades, lastSaved)

  return {
    ...defaultGameState,
    money: normalizeMoney(value.money, defaultGameState.money),
    inventory,
    inventoryValue,
    inventoryValueHistory: normalizeInventoryValueHistory(
      value.inventoryValueHistory,
      inventoryValue,
      lastSaved,
    ),
    casesUnlocked: readStringArray(value.casesUnlocked, defaultGameState.casesUnlocked),
    favoriteCaseIds: readStringArray(value.favoriteCaseIds),
    specialEventCaseIds: readStringArray(value.specialEventCaseIds),
    autoSellRules: normalizeAutoSellRules(value.autoSellRules),
    marketplace,
    automation: normalizeAutomation(value.automation),
    business: normalizeBusinessState(value.business, lastSaved),
    upgrades: normalizeUpgradeLevels(value.upgrades),
    trophyAssignments: normalizeTrophyAssignments(value.trophyAssignments),
    dailyRewards: normalizeDailyRewardsState(value.dailyRewards),
    collectionBook,
    currentRunCollectionBook: normalizeCollectionBook(value.currentRunCollectionBook),
    collectionRewards: normalizeCollectionRewards(value.collectionRewards),
    hasUsedFirstCaseHook: typeof value.hasUsedFirstCaseHook === 'boolean'
      ? value.hasUsedFirstCaseHook
      : defaultGameState.hasUsedFirstCaseHook,
    lastPoopCleaningAt,
    workMiniGameCooldowns: normalizeWorkMiniGameCooldowns(value.workMiniGameCooldowns, lastPoopCleaningAt),
    recentDrops: normalizeOptionalSkinInstances(value.recentDrops),
    lastOpenedItems: normalizeOptionalSkinInstances(value.lastOpenedItems),
    uiEvents: [],
    lastError: typeof value.lastError === 'string' ? value.lastError : undefined,
    prestigeLevel: normalizeNumber(value.prestigeLevel, defaultGameState.prestigeLevel),
    prestigePoints: normalizeNumber(value.prestigePoints, defaultGameState.prestigePoints),
    prestigeBonuses: normalizePrestigeBonusLevels(value.prestigeBonuses),
    prestigeSystem: normalizePrestigeSystem(value.prestigeSystem, normalizeNumber(value.prestigeLevel, 0)),
    upgradePoints: normalizeNumber(value.upgradePoints, defaultGameState.upgradePoints),
    skillPoints: normalizeNumber(value.skillPoints, defaultGameState.skillPoints),
    learnedSkillNodeIds: normalizeLearnedSkillNodeIds(value.learnedSkillNodeIds),
    achievements,
    marketValues: mergedMarketValues,
    marketHistory: normalizeMarketHistory(value.marketHistory, marketValues, savedAt),
    marketTrends: normalizeMarketTrends(value.marketTrends),
    activeEvents,
    upcomingEvents,
    eventHistory: normalizeGameEventHistory(value.eventHistory),
    activeMarketEvents,
    upcomingMarketEvents,
    marketEventHistory: normalizeMarketEventHistory(value.marketEventHistory),
    lastMarketTick: normalizeNumber(value.lastMarketTick, 0),
    lastEventTick: normalizeNumber(value.lastEventTick, 0),
    statistics,
    economyLedger,
    career,
    careerUpgrades,
    quests: normalizeQuestSystem(value.quests, lastSaved),
    dropJournal: normalizeDropJournal(value.dropJournal),
    settings: normalizeSettings(value.settings),
    ui: normalizeUiState(value.ui),
    lastBackupAt: normalizeNumber(value.lastBackupAt, defaultGameState.lastBackupAt),
    lastSaved,
  }
}

export function parseGameSaveText(text: string): GameState {
  try {
    if (new TextEncoder().encode(text).byteLength > MAX_IMPORTED_SAVE_BYTES) {
      throw new SaveGameError('Save file is too large to load safely. The original file was not changed.')
    }
    const migrated = migrateToCurrent(JSON.parse(text))

    return normalizeGameState(migrated.state, migrated.savedAt)
  } catch (error) {
    if (error instanceof SaveGameError) {
      throw error
    }

    throw new SaveGameError('Save file could not be read. Check that it is valid JSON.')
  }
}

export function createSaveEnvelope(state: GameState | PlayerState): SaveEnvelope {
  const currentTime = Date.now()
  const gameState = isGameState(state) ? state : playerStateToGameState(state)
  assertUniqueSkinInstanceIds(gameState.inventory, 'inventory')
  if (gameState.inventory.length > MAX_PERSISTED_INVENTORY_ITEMS) {
    throw new SaveGameError('Inventory is too large to save safely.')
  }
  const inventory = gameState.inventory
  const inventoryValue = getInventoryValue(inventory, gameState.marketValues)
  const persistedEconomyLedger = normalizeEconomyLedger(
    gameState.economyLedger,
    gameState.statistics,
    currentTime,
    [...inventory, ...gameState.marketplace.playerListings.map((listing) => listing.item)],
  )
  const persistedCareer = normalizeCareerState(gameState.career, {
    achievements: gameState.achievements,
    collectionEntries: gameState.collectionBook,
    now: currentTime,
    runId: persistedEconomyLedger.currentRunId,
  })
  const itemByInstanceId = new Map(inventory.map((item) => [item.instanceId, item]))
  const prioritizedMarketSkinIds = [
    ...Object.values(gameState.trophyAssignments)
      .flatMap((assignment) => {
        const item = assignment ? itemByInstanceId.get(assignment.itemId) : undefined
        return item ? [item.id] : []
      }),
    ...gameState.lastOpenedItems.map((item) => item.id),
    ...gameState.recentDrops.map((item) => item.id),
    ...[...inventory]
      .sort((left, right) => right.marketValue - left.marketValue)
      .map((item) => item.id),
  ]
  const priorityOrder = new Map<string, number>()

  prioritizedMarketSkinIds.forEach((skinId) => {
    if (!priorityOrder.has(skinId)) {
      priorityOrder.set(skinId, priorityOrder.size)
    }
  })

  const marketHistory = Object.fromEntries(
    Object.entries(gameState.marketHistory)
      .filter(([, points]) => points.length > 0)
      .sort(([leftId, leftPoints], [rightId, rightPoints]) => {
        const leftPriority = priorityOrder.get(leftId)
        const rightPriority = priorityOrder.get(rightId)

        if (leftPriority !== undefined || rightPriority !== undefined) {
          if (leftPriority === undefined) return 1
          if (rightPriority === undefined) return -1
          return leftPriority - rightPriority
        }

        return (rightPoints.at(-1)?.timestamp ?? 0) - (leftPoints.at(-1)?.timestamp ?? 0)
      })
      .slice(0, PERSISTED_MARKET_HISTORY_MAX_TRACKED_SKINS)
      .map(([skinId, points]) => [
        skinId,
        points.slice(-PERSISTED_MARKET_HISTORY_MAX_POINTS),
      ]),
  )

  return {
    version: CURRENT_SAVE_VERSION,
    savedAt: currentTime,
    state: {
      ...gameState,
      money: normalizeMoney(gameState.money, defaultGameState.money),
      inventory,
      inventoryValue,
      economyLedger: persistedEconomyLedger,
      career: persistedCareer,
      careerUpgrades: normalizeCareerUpgradeState(gameState.careerUpgrades, currentTime),
      prestigeSystem: normalizePrestigeSystem(gameState.prestigeSystem, gameState.prestigeLevel),
      business: normalizeBusinessState(gameState.business, currentTime),
      quests: normalizeQuestSystem(gameState.quests, currentTime),
      dropJournal: normalizeDropJournal(gameState.dropJournal),
      marketHistory,
      trophyAssignments: normalizeTrophyAssignments(gameState.trophyAssignments),
      uiEvents: [],
      lastError: undefined,
      lastSaved: currentTime,
    },
  }
}

export function serializeGameState(state: GameState | PlayerState) {
  return JSON.stringify(createSaveEnvelope(state))
}

export function getSaveFileTimestamp(now = Date.now()) {
  return new Date(now).toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z')
}

export function getSaveFileName(prefix = 'case-opening-save', now = Date.now()) {
  return `${prefix}-${getSaveFileTimestamp(now)}.json`
}

export function shouldPromptForBackup(state: GameState, now = Date.now()) {
  return (
    state.settings.backupPromptEnabled &&
    now - state.lastBackupAt >= BACKUP_INTERVAL_MS
  )
}

export function downloadSaveJson(json: string, fileName: string) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export function exportGameStateToFile(
  state: GameState | PlayerState,
  {
    fileName = getSaveFileName(),
    download = downloadSaveJson,
  }: {
    fileName?: string
    download?: (json: string, fileName: string) => void
  } = {},
) {
  const json = JSON.stringify(createSaveEnvelope(state), null, 2)

  download(json, fileName)

  return {
    fileName,
    json,
  }
}

export function saveGame(state: GameState | PlayerState): void {
  if (typeof window === 'undefined') {
    return
  }

  const lastPoopCleaningAt = isGameState(state)
    ? Math.max(state.lastPoopCleaningAt, state.workMiniGameCooldowns.poopCleaning ?? 0)
    : Math.max(state.lastPoopCleaningAt, state.workMiniGameCooldowns?.poopCleaning ?? 0)

  if (lastPoopCleaningAt > 0) {
    writePoopCleanupLastCompleted(lastPoopCleaningAt)
  }

  window.localStorage.setItem(SAVE_STORAGE_KEY, serializeGameState(state))
}

function withPersistedPoopCleaningTimestamp(state: GameState): GameState {
  const storedTimestamp = readPoopCleanupLastCompleted()

  if (
    storedTimestamp <= state.lastPoopCleaningAt &&
    storedTimestamp <= (state.workMiniGameCooldowns.poopCleaning ?? 0)
  ) {
    return state
  }

  return {
    ...state,
    lastPoopCleaningAt: storedTimestamp,
    workMiniGameCooldowns: {
      ...state.workMiniGameCooldowns,
      poopCleaning: storedTimestamp,
    },
  }
}

export function loadGame(): PlayerState | null {
  const state = loadGameState()

  return state ? toPlayerState(state) : null
}

export function loadGameState(): GameState | null {
  if (typeof window === 'undefined') {
    return null
  }

  const savedState = window.localStorage.getItem(SAVE_STORAGE_KEY)

  if (!savedState) {
    return null
  }

  try {
    return withPersistedPoopCleaningTimestamp(parseGameSaveText(savedState))
  } catch {
    return null
  }
}

export function loadGameStateOrDefault() {
  return loadGameState() ?? withPersistedPoopCleaningTimestamp(defaultGameState)
}

export function clearSavedGame() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(SAVE_STORAGE_KEY)
  window.localStorage.removeItem(POOP_CLEANUP_LAST_COMPLETED_KEY)
}
