import type { GameAction, GameState } from '../data/gameState'
import { achievementsById } from '../data/achievements'
import {
  Rarity,
  type AchievementCategory,
  type AchievementProgress,
  type CollectionEntry,
  type MarketplaceTransaction,
  type SkinInstance,
} from '../data/models'
import { isExceptionalPattern, isSpecialPattern } from '../utils/skinPatterns'
import { normalizeWorkPerformance } from '../utils/workMinigames'

export const CAREER_LEVEL_CAP = 100
export const CAREER_EVENT_HISTORY_LIMIT = 100
export const CAREER_PROCESSED_EVENT_LIMIT = 1_200
export const CAREER_ACTIVITY_WINDOW_LIMIT = 96
export const CAREER_MILESTONE_LIMIT = 40
export const CAREER_DISCOVERY_KEY_LIMIT = 12_000
export const LEGACY_BASELINE_XP_CAP = 2_500

export type CareerSpecializationId =
  | 'caseOpening'
  | 'trading'
  | 'collecting'
  | 'tradeUps'
  | 'work'
  | 'business'

export type CareerXpEventType =
  | 'case-opening'
  | 'trade-realized'
  | 'collection-discovery'
  | 'trade-up'
  | 'work-performance'
  | 'business-operation'
  | 'achievement'
  | 'quest'

export type CareerRankId =
  | 'case-addict'
  | 'independent-trader'
  | 'professional-trader'
  | 'business-owner'
  | 'market-mogul'
  | 'cs2-trading-legend'

export interface CareerRankDefinition {
  id: CareerRankId
  name: string
  minimumLevel: number
  description: string
  milestone: string
  futureCapability?: string
}

export const CAREER_RANKS: CareerRankDefinition[] = [
  {
    id: 'case-addict',
    name: 'Case Addict',
    minimumLevel: 1,
    description: 'Learning the economy through cases, Work, inventory, and basic sales.',
    milestone: 'Begin the trading career.',
  },
  {
    id: 'independent-trader',
    name: 'Independent Trader',
    minimumLevel: 15,
    description: 'A self-directed trader with enough experience to research and list confidently.',
    milestone: 'Reach Career Level 15.',
    futureCapability: 'Unlocks the Case Operator and Sales Assistant.',
  },
  {
    id: 'professional-trader',
    name: 'Professional Trader',
    minimumLevel: 35,
    description: 'Advanced market and contract knowledge supports deliberate specialization.',
    milestone: 'Reach Career Level 35.',
    futureCapability: 'Unlocks the Market Scout and Trade-Up Specialist.',
  },
  {
    id: 'business-owner',
    name: 'Business Owner',
    minimumLevel: 55,
    description: 'Ready to coordinate employees, budgets, and trading infrastructure.',
    milestone: 'Reach Career Level 55.',
    futureCapability: 'Unlocks the Junior Trader and advanced operating budgets.',
  },
  {
    id: 'market-mogul',
    name: 'Market Mogul',
    minimumLevel: 75,
    description: 'A large-scale operator prepared for advanced strategies and capital allocation.',
    milestone: 'Reach Career Level 75.',
    futureCapability: 'Unlocks elite Career research and larger-scale operating tools.',
  },
  {
    id: 'cs2-trading-legend',
    name: 'CS2 Trading Legend',
    minimumLevel: 100,
    description: 'The highest career milestone, earned through sustained economic mastery.',
    milestone: 'Reach Career Level 100.',
    futureCapability: 'Marks the highest Career milestone and supports Legendary Legacy goals.',
  },
]

export interface CareerSpecializationProgress {
  lifetimeXp: number
  currentRunXp: number
  activityCount: number
  lastActivityAt: number
}

export interface CareerXpEvent {
  id: string
  type: CareerXpEventType
  category: CareerSpecializationId
  xp: number
  baseXp: number
  multiplier: number
  reason: string
  timestamp: number
  runId: string
  signature?: string
}

export interface CareerActivityWindow {
  count: number
  windowStartedAt: number
  windowMs: number
}

export interface CareerRankHistoryEntry {
  rankId: CareerRankId
  level: number
  earnedAt: number
}

export interface CareerMilestone {
  id: string
  type: 'level' | 'rank' | 'discovery'
  title: string
  description: string
  timestamp: number
}

export interface CareerMigrationInfo {
  legacyBaselineApplied: boolean
  legacyBaselineXp: number
  note?: string
}

export interface CareerState {
  schemaVersion: 1
  runId: string
  runStartedAt: number
  lifetimeXp: number
  currentRunXp: number
  specializations: Record<CareerSpecializationId, CareerSpecializationProgress>
  recentEvents: CareerXpEvent[]
  processedEventIds: string[]
  activityWindows: Record<string, CareerActivityWindow>
  lifetimeDiscoveryKeys: string[]
  currentRunDiscoveryKeys: string[]
  legacyAchievementIds: string[]
  rankHistory: CareerRankHistoryEntry[]
  recentMilestones: CareerMilestone[]
  migration: CareerMigrationInfo
}

export interface CareerSnapshot {
  level: number
  rank: CareerRankDefinition
  nextRank?: CareerRankDefinition
  lifetimeXp: number
  currentRunXp: number
  currentLevelStartXp: number
  nextLevelXp: number
  xpIntoLevel: number
  xpForNextLevel: number
  levelProgress: number
  levelsToNextRank: number
  rankProgress: number
}

export interface CareerPrerequisite {
  minimumLevel?: number
  minimumRank?: CareerRankId
  specialization?: CareerSpecializationId
  minimumSpecializationXp?: number
}

const specializationIds: CareerSpecializationId[] = [
  'caseOpening',
  'trading',
  'collecting',
  'tradeUps',
  'work',
  'business',
]

const rarityIndex: Record<Rarity, number> = {
  [Rarity.Consumer]: 0,
  [Rarity.Industrial]: 1,
  [Rarity.MilSpec]: 2,
  [Rarity.Restricted]: 3,
  [Rarity.Classified]: 4,
  [Rarity.Covert]: 5,
  [Rarity.SpecialItem]: 6,
  [Rarity.Contraband]: 7,
}

const rarityDiscoveryWeight: Record<Rarity, number> = {
  [Rarity.Consumer]: 1,
  [Rarity.Industrial]: 1.15,
  [Rarity.MilSpec]: 1.35,
  [Rarity.Restricted]: 1.65,
  [Rarity.Classified]: 2.1,
  [Rarity.Covert]: 3,
  [Rarity.SpecialItem]: 5,
  [Rarity.Contraband]: 6,
}

function createSpecializations(): Record<CareerSpecializationId, CareerSpecializationProgress> {
  return Object.fromEntries(specializationIds.map((id) => [id, {
    lifetimeXp: 0,
    currentRunXp: 0,
    activityCount: 0,
    lastActivityAt: 0,
  }])) as Record<CareerSpecializationId, CareerSpecializationProgress>
}

export function getCumulativeXpForLevel(rawLevel: number) {
  const level = Math.min(CAREER_LEVEL_CAP, Math.max(1, Math.floor(rawLevel)))
  return Math.round(
    850 * Math.pow(level - 1, 1.66) +
    5_000 * Math.pow(Math.max(0, level - 25), 1.3),
  )
}

export function getCareerLevelFromXp(rawXp: number) {
  const xp = Math.max(0, Number.isFinite(rawXp) ? rawXp : 0)
  let low = 1
  let high = CAREER_LEVEL_CAP
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (getCumulativeXpForLevel(middle) <= xp) low = middle
    else high = middle - 1
  }
  return low
}

export function getCareerRankForLevel(level: number) {
  return [...CAREER_RANKS].reverse().find((rank) => level >= rank.minimumLevel) ?? CAREER_RANKS[0]
}

export function getCareerSnapshot(career: CareerState): CareerSnapshot {
  const level = getCareerLevelFromXp(career.currentRunXp)
  const rank = getCareerRankForLevel(level)
  const rankIndex = CAREER_RANKS.findIndex((candidate) => candidate.id === rank.id)
  const nextRank = CAREER_RANKS[rankIndex + 1]
  const currentLevelStartXp = getCumulativeXpForLevel(level)
  const nextLevelXp = level >= CAREER_LEVEL_CAP
    ? currentLevelStartXp
    : getCumulativeXpForLevel(level + 1)
  const xpForNextLevel = Math.max(0, nextLevelXp - career.currentRunXp)
  const levelSpan = Math.max(1, nextLevelXp - currentLevelStartXp)
  const levelProgress = level >= CAREER_LEVEL_CAP
    ? 1
    : Math.min(1, Math.max(0, (career.currentRunXp - currentLevelStartXp) / levelSpan))
  const rankStartXp = getCumulativeXpForLevel(rank.minimumLevel)
  const nextRankXp = getCumulativeXpForLevel(nextRank?.minimumLevel ?? CAREER_LEVEL_CAP)
  const rankProgress = nextRank
    ? Math.min(1, Math.max(0, (career.currentRunXp - rankStartXp) / Math.max(1, nextRankXp - rankStartXp)))
    : 1
  return {
    level,
    rank,
    nextRank,
    lifetimeXp: career.lifetimeXp,
    currentRunXp: career.currentRunXp,
    currentLevelStartXp,
    nextLevelXp,
    xpIntoLevel: Math.max(0, career.currentRunXp - currentLevelStartXp),
    xpForNextLevel,
    levelProgress,
    levelsToNextRank: nextRank ? Math.max(0, nextRank.minimumLevel - level) : 0,
    rankProgress,
  }
}

export function createCareerState({
  now = Date.now(),
  runId = `career-run-${now.toString(36)}`,
}: { now?: number; runId?: string } = {}): CareerState {
  return {
    schemaVersion: 1,
    runId,
    runStartedAt: now,
    lifetimeXp: 0,
    currentRunXp: 0,
    specializations: createSpecializations(),
    recentEvents: [],
    processedEventIds: [],
    activityWindows: {},
    lifetimeDiscoveryKeys: [],
    currentRunDiscoveryKeys: [],
    legacyAchievementIds: [],
    rankHistory: [{ rankId: 'case-addict', level: 1, earnedAt: now }],
    recentMilestones: [],
    migration: { legacyBaselineApplied: false, legacyBaselineXp: 0 },
  }
}

function hashDiscoveryKey(value: string) {
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ code, 0x85ebca6b)
  }
  return `${(first >>> 0).toString(36)}.${(second >>> 0).toString(36)}`
}

function collectionDiscoveryKeys(entries: CollectionEntry[]) {
  return entries.flatMap((entry) => [
    hashDiscoveryKey(`skin:${entry.skinId}`),
    ...entry.foundWearConditions.map((wear) => hashDiscoveryKey(`wear:${entry.skinId}:${wear}`)),
  ])
}

export function getAchievementCareerXp(achievementId: string) {
  const achievement = achievementsById.get(achievementId)
  if (!achievement) return 0
  if (achievement.reward?.careerXp !== undefined) {
    return Math.max(0, Math.round(achievement.reward.careerXp))
  }
  const byCategory: Record<AchievementCategory, number> = {
    Opening: 70,
    Drops: 90,
    Inventory: 75,
    'Trade Ups': 95,
    Progression: 80,
    Collection: 100,
    Automation: 70,
    'Trophy Room': 90,
  }
  return byCategory[achievement.category] + (achievement.reward?.badge ? 25 : 0)
}

export function createLegacyCareerState({
  achievementIds,
  collectionEntries,
  now,
  runId,
}: {
  achievementIds: string[]
  collectionEntries: CollectionEntry[]
  now: number
  runId: string
}) {
  const uniqueAchievementIds = Array.from(new Set(achievementIds))
  const baselineXp = Math.min(
    LEGACY_BASELINE_XP_CAP,
    Math.round(uniqueAchievementIds.reduce((sum, id) => sum + getAchievementCareerXp(id) * 0.5, 0)),
  )
  const career = createCareerState({ now, runId })
  const level = getCareerLevelFromXp(baselineXp)
  return {
    ...career,
    lifetimeXp: baselineXp,
    currentRunXp: baselineXp,
    lifetimeDiscoveryKeys: Array.from(new Set(collectionDiscoveryKeys(collectionEntries))).slice(-CAREER_DISCOVERY_KEY_LIMIT),
    currentRunDiscoveryKeys: [],
    legacyAchievementIds: uniqueAchievementIds,
    rankHistory: CAREER_RANKS
      .filter((candidate) => candidate.minimumLevel <= level)
      .map((candidate) => ({ rankId: candidate.id, level: candidate.minimumLevel, earnedAt: now })),
    migration: {
      legacyBaselineApplied: true,
      legacyBaselineXp: baselineXp,
      note: baselineXp > 0
        ? 'A capped baseline was derived from existing achievement milestones. No historical XP events were fabricated.'
        : 'Career XP tracking began with v35. No safe historical activity was converted.',
    },
    recentMilestones: baselineXp > 0 ? [{
      id: `legacy-baseline:${now}`,
      type: 'level' as const,
      title: 'Legacy career baseline',
      description: `${baselineXp.toLocaleString()} XP preserved from verified achievement milestones.`,
      timestamp: now,
    }] : [],
    runId,
    runStartedAt: now,
    schemaVersion: 1 as const,
    specializations: createSpecializations(),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeNonNegative(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0
}

function normalizeSpecializations(value: unknown) {
  const source = isRecord(value) ? value : {}
  const defaults = createSpecializations()
  for (const id of specializationIds) {
    const entry = isRecord(source[id]) ? source[id] : {}
    defaults[id] = {
      lifetimeXp: safeNonNegative(entry.lifetimeXp),
      currentRunXp: safeNonNegative(entry.currentRunXp),
      activityCount: safeNonNegative(entry.activityCount),
      lastActivityAt: safeNonNegative(entry.lastActivityAt),
    }
  }
  return defaults
}

export function normalizeCareerState(
  value: unknown,
  fallback: {
    achievements: AchievementProgress[]
    collectionEntries: CollectionEntry[]
    now: number
    runId: string
  },
): CareerState {
  if (!isRecord(value)) {
    return createLegacyCareerState({
      achievementIds: fallback.achievements.map((achievement) => achievement.id),
      collectionEntries: fallback.collectionEntries,
      now: fallback.now,
      runId: fallback.runId,
    })
  }
  const base = createCareerState({ now: fallback.now, runId: fallback.runId })
  const recentEvents = Array.isArray(value.recentEvents)
    ? value.recentEvents.filter((entry): entry is CareerXpEvent => (
        isRecord(entry) && typeof entry.id === 'string' && typeof entry.reason === 'string' &&
        specializationIds.includes(entry.category as CareerSpecializationId) &&
        typeof entry.type === 'string' && Number.isFinite(Number(entry.xp))
      )).slice(0, CAREER_EVENT_HISTORY_LIMIT)
    : []
  const processedEventIds = Array.from(new Set([
    ...(Array.isArray(value.processedEventIds) ? value.processedEventIds.filter((id): id is string => typeof id === 'string') : []),
    ...recentEvents.map((event) => event.id),
  ])).slice(-CAREER_PROCESSED_EVENT_LIMIT)
  const rawWindows = isRecord(value.activityWindows) ? value.activityWindows : {}
  const activityWindows = Object.fromEntries(Object.entries(rawWindows).flatMap(([key, entry]) => {
    if (!isRecord(entry)) return []
    const count = safeNonNegative(entry.count)
    const windowStartedAt = safeNonNegative(entry.windowStartedAt)
    const windowMs = safeNonNegative(entry.windowMs)
    return count > 0 && windowMs > 0 ? [[key, { count, windowStartedAt, windowMs }]] : []
  }).slice(-CAREER_ACTIVITY_WINDOW_LIMIT))
  const rankHistory = Array.isArray(value.rankHistory)
    ? value.rankHistory.flatMap((entry): CareerRankHistoryEntry[] => {
        if (!isRecord(entry) || !CAREER_RANKS.some((rank) => rank.id === entry.rankId)) return []
        return [{
          rankId: entry.rankId as CareerRankId,
          level: Math.max(1, Math.min(CAREER_LEVEL_CAP, safeNonNegative(entry.level))),
          earnedAt: safeNonNegative(entry.earnedAt),
        }]
      }).slice(-CAREER_RANKS.length)
    : base.rankHistory
  const recentMilestones = Array.isArray(value.recentMilestones)
    ? value.recentMilestones.filter((entry): entry is CareerMilestone => (
        isRecord(entry) && typeof entry.id === 'string' && typeof entry.title === 'string' &&
        typeof entry.description === 'string' && ['level', 'rank', 'discovery'].includes(String(entry.type))
      )).slice(0, CAREER_MILESTONE_LIMIT)
    : []
  const migration = isRecord(value.migration) ? value.migration : {}
  return {
    schemaVersion: 1,
    runId: typeof value.runId === 'string' ? value.runId : fallback.runId,
    runStartedAt: Number.isFinite(Number(value.runStartedAt))
      ? safeNonNegative(value.runStartedAt)
      : fallback.now,
    lifetimeXp: safeNonNegative(value.lifetimeXp),
    currentRunXp: safeNonNegative(value.currentRunXp),
    specializations: normalizeSpecializations(value.specializations),
    recentEvents,
    processedEventIds,
    activityWindows,
    lifetimeDiscoveryKeys: Array.from(new Set(Array.isArray(value.lifetimeDiscoveryKeys)
      ? value.lifetimeDiscoveryKeys.filter((key): key is string => typeof key === 'string')
      : collectionDiscoveryKeys(fallback.collectionEntries))).slice(-CAREER_DISCOVERY_KEY_LIMIT),
    currentRunDiscoveryKeys: Array.from(new Set(Array.isArray(value.currentRunDiscoveryKeys)
      ? value.currentRunDiscoveryKeys.filter((key): key is string => typeof key === 'string')
      : [])).slice(-CAREER_DISCOVERY_KEY_LIMIT),
    legacyAchievementIds: Array.from(new Set(Array.isArray(value.legacyAchievementIds)
      ? value.legacyAchievementIds.filter((id): id is string => typeof id === 'string')
      : fallback.achievements.map((achievement) => achievement.id))),
    rankHistory: rankHistory.length > 0 ? rankHistory : base.rankHistory,
    recentMilestones,
    migration: {
      legacyBaselineApplied: migration.legacyBaselineApplied === true,
      legacyBaselineXp: safeNonNegative(migration.legacyBaselineXp),
      note: typeof migration.note === 'string' ? migration.note : undefined,
    },
  }
}

export function getDiminishingXpMultiplier(activityCount: number, softCap: number) {
  return Math.max(0.2, 1 / (1 + 0.12 * Math.max(0, activityCount - softCap)))
}

interface PendingCareerEvent {
  id: string
  type: CareerXpEventType
  category: CareerSpecializationId
  baseXp: number
  reason: string
  timestamp: number
  signature?: string
  windowMs?: number
  softCap?: number
  achievementId?: string
  discoveryKey?: string
}

function getActionTimestamp(action: GameAction, after: GameState) {
  if ('now' in action && typeof action.now === 'number') return action.now
  if (action.type === 'OPEN_CASE' && typeof action.payload.now === 'number') return action.payload.now
  return after.lastSaved || Date.now()
}

function ownedItems(state: GameState) {
  return [
    ...state.inventory,
    ...state.marketplace.playerListings.map((listing) => listing.item),
    ...state.recentDrops,
    ...(state.marketplace.pendingAcquisition ? [state.marketplace.pendingAcquisition.item] : []),
  ]
}

function getNewItems(before: GameState, after: GameState) {
  const beforeIds = new Set(ownedItems(before).map((item) => item.instanceId))
  return Array.from(new Map(
    ownedItems(after)
      .filter((item) => !beforeIds.has(item.instanceId))
      .map((item) => [item.instanceId, item]),
  ).values())
}

function getCaseOpeningEvents(before: GameState, after: GameState, action: GameAction): PendingCareerEvent[] {
  if (action.type !== 'OPEN_CASE' && action.type !== 'TICK_AUTOMATION' && action.type !== 'TICK_BUSINESS') return []
  if (after.statistics.casesOpened <= before.statistics.casesOpened) return []
  const openedItems = getNewItems(before, after).filter((item) => (
    after.recentDrops.some((drop) => drop.instanceId === item.instanceId)
  ))
  const automated = action.type !== 'OPEN_CASE'
  const caseId = action.type === 'OPEN_CASE'
    ? action.payload.caseId
    : action.type === 'TICK_BUSINESS'
      ? after.business.employees.caseOperator.settings.caseId
      : after.automation.autoOpener.caseId ?? 'automation'
  return openedItems.map((item, index) => {
    const unusualBonus = isExceptionalPattern(item) ? 45 : isSpecialPattern(item) ? 20 : 0
    const raw = 12 + 8 * rarityIndex[item.rarity] + Math.min(40, Math.log2(Math.max(1, item.marketValue)) * 3) + unusualBonus
    return {
      id: action.type === 'OPEN_CASE' && action.payload.openingEventId
        ? `case-session:${action.payload.openingEventId}:${index}`
        : `case:${item.instanceId}`,
      type: 'case-opening',
      category: 'caseOpening',
      baseXp: Math.max(1, Math.round(raw * (automated ? 0.5 : 1))),
      reason: `${automated ? 'Automated' : 'Paid'} opening discovered ${item.weapon} | ${item.finish}`,
      timestamp: item.discoveredAt,
      signature: `case:${caseId}:${automated ? 'automated' : 'manual'}`,
      windowMs: 60 * 60_000,
      softCap: automated ? 12 : 20,
    }
  })
}

function getPatternDiscoveryKey(item: SkinInstance) {
  if (!item.pattern || !isSpecialPattern(item)) return undefined
  const edition = item.souvenir ? 'souvenir' : item.statTrak ? 'stattrak' : 'standard'
  return `pattern:${item.id}:${edition}:${item.wear}:${item.pattern.family}:${item.pattern.tier}:${item.pattern.name}`
}

function getCollectionEvents(before: GameState, after: GameState, action: GameAction): PendingCareerEvent[] {
  const legitimateSources = new Set<GameAction['type']>([
    'OPEN_CASE',
    'TICK_AUTOMATION',
    'TICK_BUSINESS',
    'CONFIRM_BUSINESS_TRADE_UP',
    'TRADE_UP',
    'BUY_MARKET_LISTING',
    'PURCHASE_AUCTION_DEAL',
    'CLAIM_DAILY_REWARD',
  ])
  if (!legitimateSources.has(action.type)) return []
  const beforeEntries = new Map(before.collectionBook.map((entry) => [entry.skinId, entry]))
  const lifetimeKeys = new Set(before.career.lifetimeDiscoveryKeys)
  const events: PendingCareerEvent[] = []
  for (const item of getNewItems(before, after)) {
    const weight = rarityDiscoveryWeight[item.rarity]
    const previous = beforeEntries.get(item.id)
    const candidates = [
      !previous ? {
        key: `skin:${item.id}`,
        baseXp: Math.round(25 * weight),
        reason: `First skin discovery: ${item.weapon} | ${item.finish}`,
      } : undefined,
      !previous?.foundWearConditions.includes(item.wear) ? {
        key: `wear:${item.id}:${item.wear}`,
        baseXp: Math.round(12 * weight),
        reason: `New wear discovery: ${item.weapon} | ${item.finish} (${item.wear})`,
      } : undefined,
      getPatternDiscoveryKey(item) ? {
        key: getPatternDiscoveryKey(item)!,
        baseXp: Math.round(25 * weight * (isExceptionalPattern(item) ? 2 : 1)),
        reason: `Pattern milestone: ${item.pattern?.name ?? 'special Pattern'}`,
      } : undefined,
    ].filter((candidate): candidate is { key: string; baseXp: number; reason: string } => Boolean(candidate))
    for (const candidate of candidates) {
      const hashedKey = hashDiscoveryKey(candidate.key)
      if (lifetimeKeys.has(hashedKey)) continue
      lifetimeKeys.add(hashedKey)
      events.push({
        id: `discovery:${hashedKey}`,
        type: 'collection-discovery',
        category: 'collecting',
        baseXp: candidate.baseXp,
        reason: candidate.reason,
        timestamp: item.discoveredAt,
        discoveryKey: hashedKey,
      })
    }
  }
  return events
}

function getTradeUpEvents(before: GameState, after: GameState, action: GameAction): PendingCareerEvent[] {
  if (!['TRADE_UP', 'TICK_BUSINESS', 'CONFIRM_BUSINESS_TRADE_UP'].includes(action.type) || after.statistics.tradeUpsCompleted <= before.statistics.tradeUpsCompleted) return []
  const output = getNewItems(before, after).find((item) => after.inventory.some((owned) => owned.instanceId === item.instanceId))
  if (!output) return []
  const inputIds = action.type === 'TRADE_UP'
    ? action.itemIds
    : before.business.pendingTradeUpApproval?.inputItemIds ?? before.inventory.filter((item) => !after.inventory.some((candidate) => candidate.instanceId === item.instanceId)).map((item) => item.instanceId)
  const inputs = inputIds.flatMap((id) => {
    const item = before.inventory.find((candidate) => candidate.instanceId === id)
    return item ? [item] : []
  })
  const inputRarity = inputs[0]?.rarity ?? Rarity.Consumer
  const signature = inputs.map((item) => item.id).sort().join('|') || inputRarity
  return [{
    id: `trade-up:${output.instanceId}`,
    type: 'trade-up',
    category: 'tradeUps',
    baseXp: 30 + 10 * rarityIndex[inputRarity],
    reason: `${inputs.length}-item ${inputRarity} contract produced ${output.weapon} | ${output.finish}`,
    timestamp: output.discoveredAt,
    signature: `trade-up:${hashDiscoveryKey(signature)}`,
    windowMs: 6 * 60 * 60_000,
    softCap: 1,
  }]
}

function getBusinessEvents(before: GameState, after: GameState, action: GameAction): PendingCareerEvent[] {
  if (action.type !== 'TICK_BUSINESS' && action.type !== 'CONFIRM_BUSINESS_TRADE_UP' && action.type !== 'APPLY_OFFLINE_PROGRESS') return []
  const beforeIds = new Set(before.business.processedOperationIds)
  return after.business.recentOperations.flatMap((operation): PendingCareerEvent[] => {
    if (beforeIds.has(operation.id) || !['case-opened', 'instant-sale', 'market-listing', 'trade-up', 'market-purchase'].includes(operation.type)) return []
    const grossVolume = Math.max(0, operation.grossVolume)
    if (grossVolume <= 0) return []
    return [{
      id: `business:${operation.id}`,
      type: 'business-operation',
      category: 'business',
      baseXp: Math.min(160, Math.max(1, Math.round(8 * Math.log(1 + grossVolume)))),
      reason: operation.description,
      timestamp: operation.timestamp,
      signature: `business:${operation.employeeRole}`,
      windowMs: 60 * 60_000,
      softCap: 8,
    }]
  })
}

function getWorkEvents(before: GameState, after: GameState, action: GameAction): PendingCareerEvent[] {
  if (action.type !== 'COMPLETE_WORK_MINIGAME') return []
  if (after.statistics.workJobsCompleted <= before.statistics.workJobsCompleted) return []
  const completedAt = after.workMiniGameCooldowns[action.gameId]
  if (!completedAt || completedAt === before.workMiniGameCooldowns[action.gameId]) return []
  const performance = normalizeWorkPerformance(action.performance)
  return [{
    id: `work:${action.gameId}:${completedAt}`,
    type: 'work-performance',
    category: 'work',
    baseXp: Math.round(15 + 30 * performance),
    reason: `${action.gameId} completed at ${Math.round(performance * 100)}% performance`,
    timestamp: completedAt,
    signature: `work:${action.gameId}`,
    windowMs: 6 * 60 * 60_000,
    softCap: 4,
  }]
}

function getNewMarketplaceSales(before: GameState, after: GameState) {
  const beforeIds = new Set(before.marketplace.transactions.map((transaction) => transaction.id))
  return after.marketplace.transactions.filter((transaction) => (
    !beforeIds.has(transaction.id) &&
    (transaction.type === 'player-sale' || transaction.type === 'negotiated-sale')
  ))
}

function getTradingEvents(before: GameState, after: GameState): PendingCareerEvent[] {
  return getNewMarketplaceSales(before, after).flatMap((transaction: MarketplaceTransaction) => {
    const basis = before.economyLedger.itemCostBasis[transaction.item.instanceId]
    if (basis === undefined || transaction.counterparty === 'Player') return []
    const profit = transaction.price - basis
    const profitable = profit > 0
    const baseXp = profitable
      ? Math.min(300, Math.round(20 + 12 * Math.log(1 + profit)))
      : 10
    return [{
      id: `trade:${transaction.id}`,
      type: 'trade-realized' as const,
      category: 'trading' as const,
      baseXp,
      reason: profitable
        ? `Realized $${profit.toFixed(2)} profit on ${transaction.item.weapon} | ${transaction.item.finish}`
        : `Completed a loss-making trade and recorded the outcome`,
      timestamp: transaction.createdAt,
      signature: profitable ? `trade:${transaction.item.id}` : 'trade:loss-learning',
      windowMs: 60 * 60_000,
      softCap: profitable ? 6 : 5,
    }]
  })
}

function getAchievementEvents(before: GameState, after: GameState, action: GameAction): PendingCareerEvent[] {
  if (action.type !== 'CLAIM_ACHIEVEMENT_REWARD' && action.type !== 'CLAIM_ALL_ACHIEVEMENT_REWARDS') return []
  const claimKey = (entry: AchievementProgress) => `${entry.id}:${entry.runId ?? 'lifetime'}`
  const claimedBefore = new Set(before.achievements.filter((entry) => entry.isClaimed).map(claimKey))
  return after.achievements.flatMap((entry): PendingCareerEvent[] => {
    if (!entry.isClaimed || claimedBefore.has(claimKey(entry)) || before.career.legacyAchievementIds.includes(entry.id)) return []
    const xp = getAchievementCareerXp(entry.id)
    const achievement = achievementsById.get(entry.id)
    if (!achievement || xp <= 0) return []
    return [{
      id: `achievement:${entry.id}:${entry.runId ?? 'lifetime'}`,
      type: 'achievement',
      category: achievement.category === 'Trade Ups'
        ? 'tradeUps'
        : achievement.category === 'Collection' || achievement.category === 'Drops'
          ? 'collecting'
          : achievement.category === 'Automation'
            ? 'caseOpening'
            : achievement.category === 'Opening'
              ? 'caseOpening'
              : 'trading',
      baseXp: xp,
      reason: `Achievement claimed: ${achievement.name}`,
      timestamp: entry.unlockedAt || getActionTimestamp(action, after),
      achievementId: entry.id,
    }]
  })
}

function applyPendingEvents(career: CareerState, pending: PendingCareerEvent[], permanentMultiplier = 1) {
  const next = career
  const processed = new Set(next.processedEventIds)
  const lifetimeDiscoveryKeys = new Set(next.lifetimeDiscoveryKeys)
  const currentRunDiscoveryKeys = new Set(next.currentRunDiscoveryKeys)
  const oldLevel = getCareerLevelFromXp(next.currentRunXp)
  const oldRank = getCareerRankForLevel(oldLevel)
  const addedEvents: CareerXpEvent[] = []
  let windows = { ...next.activityWindows }
  let lifetimeXp = next.lifetimeXp
  let currentRunXp = next.currentRunXp
  const specializations = { ...next.specializations }

  for (const candidate of pending) {
    if (processed.has(candidate.id)) continue
    if (candidate.discoveryKey && lifetimeDiscoveryKeys.has(candidate.discoveryKey)) continue
    let multiplier = 1
    if (candidate.signature && candidate.windowMs && candidate.softCap !== undefined) {
      const previous = windows[candidate.signature]
      const active = previous && candidate.timestamp >= previous.windowStartedAt &&
        candidate.timestamp - previous.windowStartedAt < previous.windowMs
      const count = active ? previous.count + 1 : 1
      windows[candidate.signature] = {
        count,
        windowStartedAt: active ? previous.windowStartedAt : candidate.timestamp,
        windowMs: candidate.windowMs,
      }
      multiplier = getDiminishingXpMultiplier(count, candidate.softCap)
    }
    const boundedPermanentMultiplier = Math.min(1.4, Math.max(1, permanentMultiplier))
    const xp = Math.max(1, Math.round(candidate.baseXp * multiplier * boundedPermanentMultiplier))
    const event: CareerXpEvent = {
      id: candidate.id,
      type: candidate.type,
      category: candidate.category,
      xp,
      baseXp: candidate.baseXp,
      multiplier: Number((multiplier * boundedPermanentMultiplier).toFixed(4)),
      reason: candidate.reason,
      timestamp: candidate.timestamp,
      runId: next.runId,
      signature: candidate.signature,
    }
    processed.add(candidate.id)
    if (candidate.discoveryKey) {
      lifetimeDiscoveryKeys.add(candidate.discoveryKey)
      currentRunDiscoveryKeys.add(candidate.discoveryKey)
    }
    lifetimeXp += xp
    currentRunXp += xp
    const progress = specializations[candidate.category]
    specializations[candidate.category] = {
      lifetimeXp: progress.lifetimeXp + xp,
      currentRunXp: progress.currentRunXp + xp,
      activityCount: progress.activityCount + 1,
      lastActivityAt: Math.max(progress.lastActivityAt, candidate.timestamp),
    }
    addedEvents.push(event)
  }

  if (addedEvents.length === 0) return career
  const newestTimestamp = Math.max(...addedEvents.map((event) => event.timestamp))
  windows = Object.fromEntries(Object.entries(windows)
    .filter(([, window]) => newestTimestamp - window.windowStartedAt < Math.max(window.windowMs, 24 * 60 * 60_000))
    .slice(-CAREER_ACTIVITY_WINDOW_LIMIT))
  const newLevel = getCareerLevelFromXp(currentRunXp)
  const newRank = getCareerRankForLevel(newLevel)
  const milestones: CareerMilestone[] = [...next.recentMilestones]
  for (let level = oldLevel + 1; level <= newLevel; level += 1) {
    milestones.unshift({
      id: `level:${next.runId}:${level}`,
      type: 'level' as const,
      title: `Career Level ${level}`,
      description: `Reached ${getCumulativeXpForLevel(level).toLocaleString()} current-run XP.`,
      timestamp: newestTimestamp,
    })
  }
  const rankHistory = [...next.rankHistory]
  if (newRank.id !== oldRank.id && !rankHistory.some((entry) => entry.rankId === newRank.id)) {
    rankHistory.push({ rankId: newRank.id, level: newLevel, earnedAt: newestTimestamp })
    milestones.unshift({
      id: `rank:${newRank.id}`,
      type: 'rank',
      title: newRank.name,
      description: newRank.milestone,
      timestamp: newestTimestamp,
    })
  }
  for (const event of addedEvents.filter((candidate) => candidate.type === 'collection-discovery').slice(0, 3)) {
    milestones.unshift({
      id: `milestone:${event.id}`,
      type: 'discovery',
      title: 'Collection discovery',
      description: event.reason,
      timestamp: event.timestamp,
    })
  }
  return {
    ...next,
    lifetimeXp,
    currentRunXp,
    specializations,
    recentEvents: [...addedEvents.reverse(), ...next.recentEvents].slice(0, CAREER_EVENT_HISTORY_LIMIT),
    processedEventIds: Array.from(processed).slice(-CAREER_PROCESSED_EVENT_LIMIT),
    activityWindows: windows,
    lifetimeDiscoveryKeys: Array.from(lifetimeDiscoveryKeys).slice(-CAREER_DISCOVERY_KEY_LIMIT),
    currentRunDiscoveryKeys: Array.from(currentRunDiscoveryKeys).slice(-CAREER_DISCOVERY_KEY_LIMIT),
    rankHistory: rankHistory.slice(-CAREER_RANKS.length),
    recentMilestones: milestones.slice(0, CAREER_MILESTONE_LIMIT),
  }
}

/** Exact-once Career XP award used only by a successfully claimed quest stage. */
export function awardQuestCareerXp(
  career: CareerState,
  input: { eventId: string; xp: number; reason: string; timestamp: number; category?: CareerSpecializationId },
) {
  if (!Number.isFinite(input.xp) || input.xp <= 0) return career
  return applyPendingEvents(career, [{
    id: `quest:${input.eventId}`,
    type: 'quest',
    category: input.category ?? 'collecting',
    baseXp: Math.min(1_000, Math.max(1, Math.round(input.xp))),
    reason: input.reason,
    timestamp: input.timestamp,
  }])
}

export function recordCareerAction(before: GameState, after: GameState, action: GameAction): GameState {
  if (
    action.type === 'REPLACE_GAME_STATE' ||
    action.type === 'RESET_GAME' ||
    action.type === 'PRESTIGE'
  ) return after
  const pending = [
    ...getCaseOpeningEvents(before, after, action),
    ...getTradingEvents(before, after),
    ...getCollectionEvents(before, after, action),
    ...getTradeUpEvents(before, after, action),
    ...getWorkEvents(before, after, action),
    ...getAchievementEvents(before, after, action),
    ...getBusinessEvents(before, after, action),
  ]
  const prestigeXpMultiplier = 1 + Math.min(.4, Math.max(0, after.prestigeSystem.perkLevels.xpAcceleration) * .05)
  const career = applyPendingEvents(after.career, pending, prestigeXpMultiplier)
  return career === after.career ? after : { ...after, career }
}

export function startNextCareerRun(career: CareerState, runId: string, now: number): CareerState {
  return {
    ...career,
    runId,
    runStartedAt: now,
    currentRunXp: 0,
    currentRunDiscoveryKeys: [],
    activityWindows: {},
    specializations: Object.fromEntries(specializationIds.map((id) => [id, {
      ...career.specializations[id],
      currentRunXp: 0,
    }])) as CareerState['specializations'],
    recentMilestones: [{
      id: `career-run:${runId}`,
      type: 'level' as const,
      title: 'New career run',
      description: 'Current-run Career XP reset; lifetime Career XP and discoveries were preserved.',
      timestamp: now,
    }, ...career.recentMilestones].slice(0, CAREER_MILESTONE_LIMIT),
  }
}

export function meetsCareerPrerequisite(career: CareerState, prerequisite: CareerPrerequisite) {
  const snapshot = getCareerSnapshot(career)
  if (prerequisite.minimumLevel && snapshot.level < prerequisite.minimumLevel) return false
  if (prerequisite.minimumRank) {
    const required = CAREER_RANKS.findIndex((rank) => rank.id === prerequisite.minimumRank)
    const current = CAREER_RANKS.findIndex((rank) => rank.id === snapshot.rank.id)
    if (current < required) return false
  }
  if (prerequisite.specialization && prerequisite.minimumSpecializationXp) {
    if (career.specializations[prerequisite.specialization].lifetimeXp < prerequisite.minimumSpecializationXp) return false
  }
  return true
}
