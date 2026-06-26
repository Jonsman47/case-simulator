import {
  defaultDropsByRarity,
  defaultGameState,
  defaultOnboardingUiState,
  defaultRarityColors,
  type AnimationSpeed,
  type GameSettings,
  type LanguageCode,
  type GameState,
  type GameUiState,
  type GameStatistics,
  type OnboardingStepId,
  type OnboardingTipId,
} from '../data/gameState'
import {
  createInitialMarketHistory,
  createInitialMarketTrends,
  MARKET_HISTORY_MAX_TRACKED_SKINS,
  trimMarketPriceHistory,
  type ActiveMarketEvent,
  type MarketEventLog,
  type MarketEventType,
  type MarketPriceHistory,
  type MarketPricePoint,
  type MarketTrendArrow,
} from '../market/marketSimulation'
import {
  GAME_EVENT_TYPES,
  type ActiveGameEvent,
  type GameEventEffects,
  type GameEventLog,
  type GameEventType,
} from '../events/eventManager'
import {
  AutomationModuleId,
  AutoSellRuleType,
  Rarity,
  TrophySlotId,
  WearCondition,
  type AchievementProgress,
  type AutomationState,
  type AutomationModuleState,
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

export const SAVE_STORAGE_KEY = 'case-opening-simulator:game-state'
export const CURRENT_SAVE_VERSION = 23
export const BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1_000

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
    isNumber(value.baseValue) &&
    isStringArray(value.caseIds) &&
    typeof value.image === 'string' &&
    typeof value.instanceId === 'string' &&
    isEnumValue(Object.values(WearCondition), value.wear) &&
    isNumber(value.floatValue) &&
    isNumber(value.marketValue) &&
    typeof value.isLocked === 'boolean' &&
    typeof value.isFavorited === 'boolean' &&
    isNumber(value.discoveredAt)
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

function isGameEventType(value: unknown): value is GameEventType {
  return isEnumValue(GAME_EVENT_TYPES, value)
}

function isMarketEventType(value: unknown): value is MarketEventType {
  return (
    value === 'KnifeWeekend' ||
    value === 'MarketBoom' ||
    value === 'MarketCrash' ||
    value === 'OperationEvent' ||
    value === 'RetiredCaseWeek' ||
    value === 'CollectorWeek' ||
    value === 'TradeUpMadness' ||
    value === 'RetiredBoost' ||
    value === 'OverSupplyDrop'
  )
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(isNumber)
}

function isRarityNumberRecord(value: unknown): value is Partial<Record<Rarity, number>> {
  if (!isRecord(value)) {
    return false
  }

  return Object.entries(value).every(([rarity, multiplier]) => {
    return isEnumValue(Object.values(Rarity), rarity) && isNumber(multiplier)
  })
}

function isGameEventEffects(value: unknown): value is GameEventEffects {
  if (!isRecord(value)) {
    return false
  }

  return (
    (value.caseCostMultiplier === undefined || isNumber(value.caseCostMultiplier)) &&
    (value.caseCostMultipliers === undefined || isNumberRecord(value.caseCostMultipliers)) &&
    (value.collectionRewardMultiplier === undefined || isNumber(value.collectionRewardMultiplier)) &&
    (value.dropRarityMultipliers === undefined || isRarityNumberRecord(value.dropRarityMultipliers)) &&
    (value.limitedSkinIds === undefined || isStringArray(value.limitedSkinIds)) &&
    (value.marketEventType === undefined || isMarketEventType(value.marketEventType)) &&
    (value.prestigePointMultiplier === undefined || isNumber(value.prestigePointMultiplier)) &&
    (value.specialEventCaseIds === undefined || isStringArray(value.specialEventCaseIds)) &&
    (value.tradeUpInputCostMultiplier === undefined || isNumber(value.tradeUpInputCostMultiplier))
  )
}

function isGameEventReward(value: unknown) {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.label === 'string' &&
    (value.money === undefined || isNumber(value.money)) &&
    (value.prestigePoints === undefined || isNumber(value.prestigePoints)) &&
    (value.skillPoints === undefined || isNumber(value.skillPoints))
  )
}

function isActiveGameEvent(value: unknown): value is ActiveGameEvent {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    isGameEventType(value.type) &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    isNumber(value.startTime) &&
    isNumber(value.endTime) &&
    typeof value.effectSummary === 'string' &&
    isGameEventEffects(value.effects) &&
    (value.rewards === undefined || (Array.isArray(value.rewards) && value.rewards.every(isGameEventReward))) &&
    (value.allowOverlap === undefined || typeof value.allowOverlap === 'boolean') &&
    (value.exclusiveGroup === undefined || typeof value.exclusiveGroup === 'string') &&
    isNumber(value.priority) &&
    (value.triggeredAtCasesOpened === undefined || isNumber(value.triggeredAtCasesOpened))
  )
}

function isGameEventLog(value: unknown): value is GameEventLog {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    isGameEventType(value.type) &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    isNumber(value.startTime) &&
    isNumber(value.endTime) &&
    isNumber(value.endedAt) &&
    typeof value.effectSummary === 'string' &&
    (value.rewards === undefined || (Array.isArray(value.rewards) && value.rewards.every(isGameEventReward))) &&
    (value.triggeredAtCasesOpened === undefined || isNumber(value.triggeredAtCasesOpened))
  )
}

function isActiveMarketEvent(value: unknown): value is ActiveMarketEvent {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    isMarketEventType(value.type) &&
    typeof value.label === 'string' &&
    (value.name === undefined || typeof value.name === 'string') &&
    (value.description === undefined || typeof value.description === 'string') &&
    (value.startTime === undefined || isNumber(value.startTime)) &&
    (value.endTime === undefined || isNumber(value.endTime)) &&
    (value.effectSummary === undefined || typeof value.effectSummary === 'string') &&
    (value.affectedSkinIds === undefined || isStringArray(value.affectedSkinIds)) &&
    (value.caseIds === undefined || isStringArray(value.caseIds)) &&
    (value.totalImpact === undefined || isNumber(value.totalImpact)) &&
    (value.allowOverlap === undefined || typeof value.allowOverlap === 'boolean') &&
    (value.impactPerTick === undefined || isNumber(value.impactPerTick)) &&
    (value.startedAt === undefined || isNumber(value.startedAt)) &&
    (value.ticksRemaining === undefined || isNumber(value.ticksRemaining)) &&
    (value.totalTicks === undefined || isNumber(value.totalTicks)) &&
    (value.triggeredAtCasesOpened === undefined || isNumber(value.triggeredAtCasesOpened))
  )
}

function isMarketEventLog(value: unknown): value is MarketEventLog {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    isMarketEventType(value.type) &&
    typeof value.label === 'string' &&
    (value.name === undefined || typeof value.name === 'string') &&
    (value.description === undefined || typeof value.description === 'string') &&
    (value.startTime === undefined || isNumber(value.startTime)) &&
    (value.endTime === undefined || isNumber(value.endTime)) &&
    (value.endedAt === undefined || isNumber(value.endedAt)) &&
    (value.effectSummary === undefined || typeof value.effectSummary === 'string') &&
    (value.triggeredAtCasesOpened === undefined || isNumber(value.triggeredAtCasesOpened))
  )
}

function normalizeActiveMarketEvents(value: unknown) {
  return Array.isArray(value) && value.every(isActiveMarketEvent) ? value : []
}

function normalizeUpcomingMarketEvents(value: unknown) {
  return Array.isArray(value) && value.every(isActiveMarketEvent) ? value : []
}

function normalizeMarketEventHistory(value: unknown) {
  return Array.isArray(value) && value.every(isMarketEventLog) ? value : []
}

function normalizeActiveGameEvents(value: unknown) {
  return Array.isArray(value) && value.every(isActiveGameEvent) ? value : []
}

function normalizeUpcomingGameEvents(value: unknown) {
  return Array.isArray(value) && value.every(isActiveGameEvent) ? value : []
}

function normalizeGameEventHistory(value: unknown) {
  return Array.isArray(value) && value.every(isGameEventLog) ? value : []
}

function marketEventToGameEvent(event: ActiveMarketEvent): ActiveGameEvent | undefined {
  if (!isGameEventType(event.type)) {
    return undefined
  }

  const startTime = event.startTime ?? event.startedAt ?? Date.now()
  const endTime = event.endTime ?? startTime

  return {
    id: `migrated:${event.id}`,
    type: event.type,
    name: event.name ?? event.label,
    description: event.description ?? event.label,
    startTime,
    endTime,
    effectSummary: event.effectSummary ?? 'Migrated market event.',
    effects: {
      marketEventType: event.type,
      specialEventCaseIds: event.caseIds,
    },
    allowOverlap: event.allowOverlap,
    priority: 30,
    triggeredAtCasesOpened: event.triggeredAtCasesOpened,
  }
}

function normalizeActiveGameEventsWithFallback(value: unknown, fallbackMarketEvents: unknown) {
  const normalizedEvents = normalizeActiveGameEvents(value)

  if (normalizedEvents.length > 0) {
    return normalizedEvents
  }

  return normalizeActiveMarketEvents(fallbackMarketEvents)
    .map(marketEventToGameEvent)
    .filter((event): event is ActiveGameEvent => Boolean(event))
}

function normalizeUpcomingGameEventsWithFallback(value: unknown, fallbackMarketEvents: unknown) {
  const normalizedEvents = normalizeUpcomingGameEvents(value)

  if (normalizedEvents.length > 0) {
    return normalizedEvents
  }

  return normalizeUpcomingMarketEvents(fallbackMarketEvents)
    .map(marketEventToGameEvent)
    .filter((event): event is ActiveGameEvent => Boolean(event))
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
    casesOpened: value.casesOpened,
    moneySpent: value.moneySpent,
    moneyEarned: value.moneyEarned,
    itemsSold: normalizeNumber(value.itemsSold, 0),
    tradeUpsCompleted: normalizeNumber(value.tradeUpsCompleted, 0),
    drops: value.drops,
    rareDrops: value.rareDrops,
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
    value === 'nameDesc'
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
  }
}

const onboardingStepIds: OnboardingStepId[] = ['open_case', 'view_inventory', 'sell_item', 'enable_auto_sell']
const onboardingTipIds: OnboardingTipId[] = ['collection_book_after_drop', 'trade_up_ready', 'auto_sell_ready']

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
    activeStepId: isOnboardingStepId(value.activeStepId)
      ? value.activeStepId
      : defaultOnboardingUiState.activeStepId,
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
    isReviewing:
      typeof value.isReviewing === 'boolean'
        ? value.isReviewing
        : defaultOnboardingUiState.isReviewing,
  }
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
    onboarding: normalizeOnboardingUiState(onboarding),
  }
}

function readSkinInstances(value: unknown, fieldName: string) {
  if (!Array.isArray(value) || !value.every(isSkinInstance)) {
    throw new SaveGameError(`Save file has invalid ${fieldName}.`)
  }

  return value
}

function normalizeOptionalSkinInstances(value: unknown) {
  return Array.isArray(value) && value.every(isSkinInstance) ? value : []
}

function isTrophySlotId(value: unknown): value is TrophySlotId {
  return isEnumValue(Object.values(TrophySlotId), value)
}

function isTrophyAssignment(value: unknown): value is TrophyAssignment {
  if (!isRecord(value)) {
    return false
  }

  return isTrophySlotId(value.slotId) && isSkinInstance(value.item) && isNumber(value.assignedAt)
}

function normalizeTrophyAssignments(value: unknown): TrophyAssignments {
  const defaults = createDefaultTrophyAssignments()

  if (!isRecord(value)) {
    return defaults
  }

  return Object.values(TrophySlotId).reduce<TrophyAssignments>((assignments, slotId) => {
    const rawAssignment = value[slotId]

    if (isTrophyAssignment(rawAssignment) && rawAssignment.slotId === slotId) {
      assignments[slotId] = {
        slotId,
        item: rawAssignment.item,
        assignedAt: rawAssignment.assignedAt,
      }
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
  }

  return refreshDailyRewardsState(baseState, now)
}

function normalizeAutoSellRules(value: unknown) {
  return Array.isArray(value) && value.every(isAutoSellRule) ? value : []
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
      achievementsById.set(entry, {
        id: entry,
        isClaimed: false,
        unlockedAt: fallbackUnlockedAt,
      })
      continue
    }

    if (isAchievementProgress(entry)) {
      achievementsById.set(entry.id, {
        id: entry.id,
        isClaimed: entry.isClaimed,
        unlockedAt: entry.unlockedAt,
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

function normalizeAutomation(value: unknown): AutomationState {
  const automation = isRecord(value) ? value : {}
  const autoOpener = isRecord(automation.autoOpener) ? automation.autoOpener : {}
  const level = Math.max(0, Math.floor(normalizeNumber(autoOpener.level, 0)))
  const rawModules = isRecord(automation.modules) ? automation.modules : {}
  const modules = Object.values(AutomationModuleId).reduce((normalizedModules, moduleId) => {
    normalizedModules[moduleId] = normalizeAutomationModule(moduleId, rawModules[moduleId])
    return normalizedModules
  }, createDefaultAutomationModules())

  return {
    autoOpener: {
      caseId: typeof autoOpener.caseId === 'string' ? autoOpener.caseId : defaultAutomationState.autoOpener.caseId,
      intervalMs: normalizeNumber(autoOpener.intervalMs, getAutoOpenerIntervalMs(level || 1)),
      isEnabled: typeof autoOpener.isEnabled === 'boolean' ? autoOpener.isEnabled : false,
      lastOpenTime: normalizeNumber(autoOpener.lastOpenTime, 0),
      level,
      totalOpened: Math.max(0, Math.floor(normalizeNumber(autoOpener.totalOpened, 0))),
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
    specialEventCaseIds: readStringArray(value.specialEventCaseIds),
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
    activeEvents: normalizeActiveGameEventsWithFallback(value.activeEvents, value.activeMarketEvents),
    upcomingEvents: normalizeUpcomingGameEventsWithFallback(value.upcomingEvents, value.upcomingMarketEvents),
    eventHistory: normalizeGameEventHistory(value.eventHistory),
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

function playerStateToGameState(state: PlayerState): GameState {
  const marketValues = {
    ...defaultGameState.marketValues,
    ...state.marketValues,
  }
  const inventoryValue = getInventoryValue(state.inventory, marketValues)

  return {
    ...defaultGameState,
    money: state.money,
    inventory: state.inventory,
    inventoryValue,
    inventoryValueHistory: normalizeInventoryValueHistory(
      state.inventoryValueHistory,
      inventoryValue,
      state.lastSaved,
    ),
    casesUnlocked: state.unlockedCases,
    autoSellRules: state.autoSellRules,
    automation: normalizeAutomation(state.automation),
    upgrades: normalizeUpgradeLevels(state.upgrades),
    trophyAssignments: normalizeTrophyAssignments(state.trophyAssignments),
    dailyRewards: normalizeDailyRewardsState(state.dailyRewards),
    collectionBook: state.collectionBook,
    collectionRewards: state.collectionRewards,
    prestigeLevel: state.prestigeLevel,
    prestigePoints: state.prestigePoints,
    prestigeBonuses: normalizePrestigeBonusLevels(state.prestigeBonuses),
    upgradePoints: state.upgradePoints,
    skillPoints: state.skillPoints,
    learnedSkillNodeIds: normalizeLearnedSkillNodeIds(state.learnedSkillNodeIds),
    achievements: state.achievements,
    marketValues,
    marketHistory: {
      ...defaultGameState.marketHistory,
      ...state.marketHistory,
    },
    activeEvents: normalizeActiveGameEvents(state.activeEvents),
    upcomingEvents: normalizeUpcomingGameEvents(state.upcomingEvents),
    eventHistory: normalizeGameEventHistory(state.eventHistory),
    statistics: state.statistics,
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

  if (!isNumber(value.money)) {
    throw new SaveGameError('Save file is missing player money.')
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

  return {
    ...defaultGameState,
    money: value.money,
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
    automation: normalizeAutomation(value.automation),
    upgrades: normalizeUpgradeLevels(value.upgrades),
    trophyAssignments: normalizeTrophyAssignments(value.trophyAssignments),
    dailyRewards: normalizeDailyRewardsState(value.dailyRewards),
    collectionBook: normalizeCollectionBook(value.collectionBook),
    collectionRewards: normalizeCollectionRewards(value.collectionRewards),
    recentDrops: normalizeOptionalSkinInstances(value.recentDrops),
    lastOpenedItems: normalizeOptionalSkinInstances(value.lastOpenedItems),
    uiEvents: [],
    lastError: typeof value.lastError === 'string' ? value.lastError : undefined,
    prestigeLevel: normalizeNumber(value.prestigeLevel, defaultGameState.prestigeLevel),
    prestigePoints: normalizeNumber(value.prestigePoints, defaultGameState.prestigePoints),
    prestigeBonuses: normalizePrestigeBonusLevels(value.prestigeBonuses),
    upgradePoints: normalizeNumber(value.upgradePoints, defaultGameState.upgradePoints),
    skillPoints: normalizeNumber(value.skillPoints, defaultGameState.skillPoints),
    learnedSkillNodeIds: normalizeLearnedSkillNodeIds(value.learnedSkillNodeIds),
    achievements: normalizeAchievements(value.achievements, lastSaved),
    marketValues: mergedMarketValues,
    marketHistory: normalizeMarketHistory(value.marketHistory, marketValues, savedAt),
    marketTrends: normalizeMarketTrends(value.marketTrends),
    activeEvents: normalizeActiveGameEventsWithFallback(value.activeEvents, value.activeMarketEvents),
    upcomingEvents: normalizeUpcomingGameEventsWithFallback(value.upcomingEvents, value.upcomingMarketEvents),
    eventHistory: normalizeGameEventHistory(value.eventHistory),
    activeMarketEvents: normalizeActiveMarketEvents(value.activeMarketEvents),
    upcomingMarketEvents: normalizeUpcomingMarketEvents(value.upcomingMarketEvents),
    marketEventHistory: normalizeMarketEventHistory(value.marketEventHistory),
    lastMarketTick: normalizeNumber(value.lastMarketTick, 0),
    statistics,
    settings: normalizeSettings(value.settings),
    ui: normalizeUiState(value.ui),
    lastBackupAt: normalizeNumber(value.lastBackupAt, defaultGameState.lastBackupAt),
    lastSaved,
  }
}

export function parseGameSaveText(text: string): GameState {
  try {
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

  return {
    version: CURRENT_SAVE_VERSION,
    savedAt: currentTime,
    state: {
      ...gameState,
      uiEvents: [],
      lastError: undefined,
      lastSaved: currentTime,
    },
  }
}

export function serializeGameState(state: GameState | PlayerState) {
  return JSON.stringify(createSaveEnvelope(state), null, 2)
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
  const json = serializeGameState(state)

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

  window.localStorage.setItem(SAVE_STORAGE_KEY, serializeGameState(state))
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
    return parseGameSaveText(savedState)
  } catch {
    return null
  }
}

export function loadGameStateOrDefault() {
  return loadGameState() ?? defaultGameState
}

export function clearSavedGame() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(SAVE_STORAGE_KEY)
}
