import { CASE_DEFINITIONS } from '../data/cases'
import type { Prng } from '../data/dropLogic'
import { CaseStatus, Rarity, type CaseDefinition, type SkinBase } from '../data/models'
import { SKIN_DEFINITIONS } from '../data/skins'

export type MarketTrendArrow = '↑' | '↓' | '→'
export type MarketEventType =
  | 'KnifeWeekend'
  | 'MarketBoom'
  | 'MarketCrash'
  | 'OperationEvent'
  | 'RetiredCaseWeek'
  | 'CollectorWeek'
  | 'TradeUpMadness'
  | 'RetiredBoost'
  | 'OverSupplyDrop'

export interface MarketPricePoint {
  timestamp: number
  value: number
}

export type MarketPriceHistory = Record<string, MarketPricePoint[]>

export interface MarketEvent {
  id: string
  name: string
  description: string
  startTime: number
  endTime: number
  effect: (prices: Record<string, number>) => void
}

export interface ActiveMarketEvent {
  id: string
  type: MarketEventType
  label: string
  name?: string
  description?: string
  startTime?: number
  endTime?: number
  effectSummary?: string
  affectedSkinIds?: string[]
  caseIds?: string[]
  totalImpact?: number
  allowOverlap?: boolean
  impactPerTick?: number
  startedAt?: number
  ticksRemaining?: number
  totalTicks?: number
  triggeredAtCasesOpened?: number
}

export interface MarketEventLog {
  id: string
  type: MarketEventType
  label: string
  name?: string
  description?: string
  startTime?: number
  endTime?: number
  endedAt?: number
  effectSummary?: string
  triggeredAtCasesOpened?: number
}

export interface MarketTickInput {
  activeEvents?: ActiveMarketEvent[]
  casesOpened?: number
  eventChanceBonus?: number
  eventHistory?: MarketEventLog[]
  elapsedMs?: number
  marketHistory?: MarketPriceHistory
  marketTrends?: Record<string, MarketTrendArrow>
  marketValues: Record<string, number>
  now?: number
  prng?: Prng
  recordHistory?: boolean
  skins?: SkinBase[]
  trackedSkinIds?: string[]
  upcomingEvents?: ActiveMarketEvent[]
}

export interface MarketTickResult {
  activeEvents: ActiveMarketEvent[]
  eventHistory: MarketEventLog[]
  lastMarketTick: number
  marketHistory: MarketPriceHistory
  marketTrends: Record<string, MarketTrendArrow>
  marketValues: Record<string, number>
  specialEventCaseIds: string[]
  upcomingEvents: ActiveMarketEvent[]
}

interface MarketEventTemplate {
  type: MarketEventType
  name: string
  description: string
  durationMs: number
  totalImpact: number
  effectSummary: string
  allowOverlap?: boolean
  progressRequirement?: number
  getAffectedSkinIds: (skins: SkinBase[], now: number) => string[]
  getCaseIds?: (now: number) => string[]
}

export const MARKET_TICK_MS = 60_000
export const MIN_MARKET_VALUE = 0.01
export const MAX_MARKET_VALUE = 1_000_000_000
export const MARKET_HISTORY_MAX_POINTS = 240
export const MARKET_HISTORY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000
export const MARKET_HISTORY_MAX_TRACKED_SKINS = 320

const hourMs = 60 * 60 * 1_000
const dayMs = 24 * hourMs
const randomEventChance = 0.025
const stableRarities = new Set([Rarity.Covert, Rarity.SpecialItem, Rarity.Contraband])
const highRarities = new Set([Rarity.Classified, Rarity.Covert, Rarity.SpecialItem, Rarity.Contraband])
const tradeUpResultRarities = new Set([Rarity.Restricted, Rarity.Classified, Rarity.Covert])
const operationCaseIds = ['crate-4880', 'crate-4904', 'revolution_style_case', 'kilowatt_style_case']

function roundMarketValue(value: number) {
  const safeValue = Number.isFinite(value) ? value : MIN_MARKET_VALUE

  return Number(Math.min(MAX_MARKET_VALUE, Math.max(MIN_MARKET_VALUE, safeValue)).toFixed(2))
}

function getAllSkinIds(skins: SkinBase[]) {
  return skins.map((skin) => skin.id)
}

function isKnifeOrGlove(skin: SkinBase) {
  const weapon = skin.weapon.toLowerCase()

  return weapon.includes('knife') || weapon.includes('karambit') || weapon.includes('glove')
}

function getRetiredCaseIds(caseDefinitions: CaseDefinition[] = CASE_DEFINITIONS, now = Date.now()) {
  return caseDefinitions
    .filter((caseDef) => {
      return caseDef.status === CaseStatus.Retired || Boolean(caseDef.retirement && caseDef.retirement.date <= now)
    })
    .map((caseDef) => caseDef.id)
}

function getRetiredSkinIds(
  skins: SkinBase[],
  caseDefinitions: CaseDefinition[] = CASE_DEFINITIONS,
  now = Date.now(),
) {
  const retiredCaseIds = new Set(getRetiredCaseIds(caseDefinitions, now))

  return skins
    .filter((skin) => skin.caseIds.some((caseId) => retiredCaseIds.has(caseId)))
    .map((skin) => skin.id)
}

function getOverSupplySkinIds(skins: SkinBase[]) {
  return skins
    .filter((skin) => {
      return (
        skin.baseValue <= 1 &&
        (
          skin.rarity === Rarity.Consumer ||
          skin.rarity === Rarity.Industrial ||
          skin.rarity === Rarity.MilSpec
        )
      )
    })
    .map((skin) => skin.id)
}

function getOperationSkinIds(skins: SkinBase[]) {
  const caseIds = new Set(operationCaseIds)

  return skins
    .filter((skin) => skin.caseIds.some((caseId) => caseIds.has(caseId)))
    .map((skin) => skin.id)
}

function applyPercentChange(
  prices: Record<string, number>,
  affectedSkinIds: string[],
  percentChange: number,
) {
  for (const skinId of affectedSkinIds) {
    prices[skinId] = roundMarketValue((prices[skinId] ?? MIN_MARKET_VALUE) * (1 + percentChange))
  }
}

function createTemplateEffect(
  getAffectedSkinIds: MarketEventTemplate['getAffectedSkinIds'],
  totalImpact: number,
) {
  return (prices: Record<string, number>) => {
    applyPercentChange(prices, getAffectedSkinIds(SKIN_DEFINITIONS, Date.now()), totalImpact)
  }
}

const eventTemplates: Record<MarketEventType, MarketEventTemplate> = {
  KnifeWeekend: {
    type: 'KnifeWeekend',
    name: 'Knife Weekend',
    description: 'Collectors are chasing rare knives and gloves through the weekend.',
    durationMs: 2 * dayMs,
    totalImpact: 0.15,
    effectSummary: '+15% knife and glove prices over the event window.',
    getAffectedSkinIds: (skins) => skins.filter(isKnifeOrGlove).map((skin) => skin.id),
  },
  MarketBoom: {
    type: 'MarketBoom',
    name: 'Market Boom',
    description: 'Demand surges across the entire skin market.',
    durationMs: 2 * dayMs,
    totalImpact: 0.08,
    effectSummary: '+8% all skin prices over two days.',
    getAffectedSkinIds: getAllSkinIds,
  },
  MarketCrash: {
    type: 'MarketCrash',
    name: 'Market Crash',
    description: 'A panic sell-off pushes prices down across the board.',
    durationMs: 2 * dayMs,
    totalImpact: -0.08,
    effectSummary: '-8% all skin prices over two days.',
    getAffectedSkinIds: getAllSkinIds,
  },
  OperationEvent: {
    type: 'OperationEvent',
    name: 'Operation Event',
    description: 'Limited operation stock appears and modern cases enter the spotlight.',
    durationMs: 3 * dayMs,
    totalImpact: 0.06,
    effectSummary: '+6% operation case skin prices; selected locked cases become temporary event cases.',
    progressRequirement: 25,
    getAffectedSkinIds: getOperationSkinIds,
    getCaseIds: () => operationCaseIds,
  },
  RetiredCaseWeek: {
    type: 'RetiredCaseWeek',
    name: 'Retired Case Week',
    description: 'Vaulted cases temporarily return and their drops climb in value.',
    durationMs: 7 * dayMs,
    totalImpact: 0.09,
    effectSummary: '+9% retired case skin prices; retired cases become temporarily openable.',
    progressRequirement: 50,
    getAffectedSkinIds: (skins, now) => getRetiredSkinIds(skins, CASE_DEFINITIONS, now),
    getCaseIds: (now) => getRetiredCaseIds(CASE_DEFINITIONS, now),
  },
  CollectorWeek: {
    type: 'CollectorWeek',
    name: 'Collector Week',
    description: 'High-rarity collectors bid up standout inventory pieces.',
    durationMs: 7 * dayMs,
    totalImpact: 0.05,
    effectSummary: '+5% Classified and higher prices over the event window.',
    progressRequirement: 40,
    getAffectedSkinIds: (skins) => skins.filter((skin) => highRarities.has(skin.rarity)).map((skin) => skin.id),
  },
  TradeUpMadness: {
    type: 'TradeUpMadness',
    name: 'Trade-Up Madness',
    description: 'Players hunt profitable contract outcomes, lifting mid and high tier outputs.',
    durationMs: 2 * dayMs,
    totalImpact: 0.1,
    effectSummary: '+10% likely trade-up result prices over two days.',
    progressRequirement: 10,
    getAffectedSkinIds: (skins) => skins.filter((skin) => tradeUpResultRarities.has(skin.rarity)).map((skin) => skin.id),
  },
  RetiredBoost: {
    type: 'RetiredBoost',
    name: 'Retired Case Boost',
    description: 'Legacy retired-case drops receive a short market lift.',
    durationMs: 5 * MARKET_TICK_MS,
    totalImpact: 0.05,
    effectSummary: '+5% retired case skin prices over five ticks.',
    getAffectedSkinIds: (skins, now) => getRetiredSkinIds(skins, CASE_DEFINITIONS, now),
  },
  OverSupplyDrop: {
    type: 'OverSupplyDrop',
    name: 'Oversupply Drop',
    description: 'Cheap common stock floods the market.',
    durationMs: 5 * MARKET_TICK_MS,
    totalImpact: -0.05,
    effectSummary: '-5% cheap low-rarity prices over five ticks.',
    getAffectedSkinIds: getOverSupplySkinIds,
  },
}

const predefinedMarketEventTypes: MarketEventType[] = [
  'KnifeWeekend',
  'MarketBoom',
  'MarketCrash',
  'OperationEvent',
  'RetiredCaseWeek',
  'CollectorWeek',
  'TradeUpMadness',
]

export const PREDEFINED_MARKET_EVENTS: MarketEvent[] = predefinedMarketEventTypes.map((type) => {
  const template = eventTemplates[type]

  return {
    id: template.type,
    name: template.name,
    description: template.description,
    startTime: 0,
    endTime: template.durationMs,
    effect: createTemplateEffect(template.getAffectedSkinIds, template.totalImpact),
  }
})

export function createInitialMarketValues(skins: SkinBase[] = SKIN_DEFINITIONS) {
  return Object.fromEntries(skins.map((skin) => [skin.id, roundMarketValue(skin.baseValue)]))
}

export function createInitialMarketTrends(skins: SkinBase[] = SKIN_DEFINITIONS) {
  return Object.fromEntries(skins.map((skin) => [skin.id, '→' as MarketTrendArrow]))
}

export function createInitialMarketHistory({
  marketValues,
  now = Date.now(),
  skins = SKIN_DEFINITIONS,
}: {
  marketValues?: Record<string, number>
  now?: number
  skins?: SkinBase[]
} = {}): MarketPriceHistory {
  return appendMarketPriceHistory({
    marketHistory: {},
    marketValues: marketValues ?? Object.fromEntries(skins.map((skin) => [skin.id, skin.baseValue])),
    now,
    skins,
  })
}

function createEventId(type: MarketEventType, startTime: number, prng: Prng) {
  return `${type}-${startTime}-${Math.floor(prng() * 1_000_000)}`
}

export function createMarketEvent({
  casesOpened = 0,
  durationMs,
  now = Date.now(),
  prng = Math.random,
  startTime = now,
  type,
}: {
  casesOpened?: number
  durationMs?: number
  now?: number
  prng?: Prng
  startTime?: number
  type: MarketEventType
}): ActiveMarketEvent {
  const template = eventTemplates[type]
  const eventDuration = durationMs ?? template.durationMs
  const endTime = startTime + eventDuration
  const totalTicks = Math.max(1, Math.ceil(eventDuration / MARKET_TICK_MS))
  const affectedSkinIds = template.getAffectedSkinIds(SKIN_DEFINITIONS, startTime)
  const caseIds = template.getCaseIds?.(startTime) ?? []

  return {
    id: createEventId(type, startTime, prng),
    type,
    label: template.name,
    name: template.name,
    description: template.description,
    startTime,
    endTime,
    effectSummary: template.effectSummary,
    affectedSkinIds,
    caseIds,
    totalImpact: template.totalImpact,
    allowOverlap: template.allowOverlap,
    impactPerTick: template.totalImpact / totalTicks,
    startedAt: startTime,
    ticksRemaining: Math.max(0, Math.ceil((endTime - now) / MARKET_TICK_MS)),
    totalTicks,
    triggeredAtCasesOpened: casesOpened,
  }
}

export function hydrateMarketEvent(event: ActiveMarketEvent, now = Date.now()): ActiveMarketEvent {
  const template = eventTemplates[event.type]
  const hasTimedFields = typeof event.startTime === 'number' && typeof event.endTime === 'number'
  const fallbackDuration = event.totalTicks
    ? Math.max(1, event.totalTicks) * MARKET_TICK_MS
    : template.durationMs
  const startTime = hasTimedFields ? event.startTime ?? now : now
  const endTime = hasTimedFields ? event.endTime ?? startTime + fallbackDuration : now + fallbackDuration
  const eventDuration = Math.max(MARKET_TICK_MS, endTime - startTime)
  const totalTicks = Math.max(1, Math.ceil(eventDuration / MARKET_TICK_MS))
  const totalImpact = typeof event.totalImpact === 'number'
    ? event.totalImpact
    : typeof event.impactPerTick === 'number'
      ? event.impactPerTick * totalTicks
      : template.totalImpact

  return {
    ...event,
    label: event.label ?? template.name,
    name: event.name ?? event.label ?? template.name,
    description: event.description ?? template.description,
    startTime,
    endTime,
    effectSummary: event.effectSummary ?? template.effectSummary,
    affectedSkinIds: event.affectedSkinIds ?? template.getAffectedSkinIds(SKIN_DEFINITIONS, startTime),
    caseIds: event.caseIds ?? template.getCaseIds?.(startTime) ?? [],
    totalImpact,
    allowOverlap: event.allowOverlap ?? template.allowOverlap,
    impactPerTick: typeof event.impactPerTick === 'number'
      ? event.impactPerTick
      : totalImpact / totalTicks,
    startedAt: event.startedAt ?? startTime,
    ticksRemaining: Math.max(0, Math.ceil((endTime - now) / MARKET_TICK_MS)),
    totalTicks,
  }
}

export function getMarketEventName(event: ActiveMarketEvent | MarketEventLog) {
  return event.name ?? event.label
}

export function getMarketEventDescription(event: ActiveMarketEvent | MarketEventLog) {
  return event.description ?? eventTemplates[event.type].description
}

export function getMarketEventEffectSummary(event: ActiveMarketEvent | MarketEventLog) {
  return event.effectSummary ?? eventTemplates[event.type].effectSummary
}

function eventHasAlreadyTriggered(
  activeEvents: ActiveMarketEvent[],
  upcomingEvents: ActiveMarketEvent[],
  eventHistory: MarketEventLog[],
  type: MarketEventType,
  casesOpened: number,
) {
  const allEvents = [...activeEvents, ...upcomingEvents, ...eventHistory]

  return allEvents.some((event) => {
    return event.type === type && event.triggeredAtCasesOpened === casesOpened
  })
}

function eventsOverlap(left: ActiveMarketEvent, right: ActiveMarketEvent) {
  const leftStart = left.startTime ?? left.startedAt ?? 0
  const leftEnd = left.endTime ?? leftStart
  const rightStart = right.startTime ?? right.startedAt ?? 0
  const rightEnd = right.endTime ?? rightStart

  return leftStart < rightEnd && rightStart < leftEnd
}

function canScheduleEvent(
  candidate: ActiveMarketEvent,
  activeEvents: ActiveMarketEvent[],
  upcomingEvents: ActiveMarketEvent[],
) {
  if ([...activeEvents, ...upcomingEvents].some((event) => (
    event.type === candidate.type && eventsOverlap(candidate, event)
  ))) {
    return false
  }

  if (candidate.allowOverlap) {
    return true
  }

  return [...activeEvents, ...upcomingEvents].every((event) => {
    return event.allowOverlap || !eventsOverlap(candidate, event)
  })
}

function dedupeMarketEvents(events: ActiveMarketEvent[]) {
  const byType = new Map<MarketEventType, ActiveMarketEvent>()

  for (const event of events) {
    const existing = byType.get(event.type)

    if (!existing) {
      byType.set(event.type, event)
      continue
    }

    const preferEvent = event.id.startsWith('game:') && !existing.id.startsWith('game:')
      ? event
      : (event.endTime ?? 0) > (existing.endTime ?? 0)
        ? event
        : existing

    byType.set(event.type, preferEvent)
  }

  return Array.from(byType.values())
}

function getEligibleEventTypes(casesOpened: number): MarketEventType[] {
  return ([
    'KnifeWeekend',
    'MarketBoom',
    'MarketCrash',
    'OperationEvent',
    'RetiredCaseWeek',
    'CollectorWeek',
    'TradeUpMadness',
  ] as MarketEventType[]).filter((type) => {
    return casesOpened >= (eventTemplates[type].progressRequirement ?? 0)
  })
}

function maybeScheduleMarketEvent({
  activeEvents,
  casesOpened,
  eventChanceBonus = 0,
  eventHistory,
  now,
  prng,
  upcomingEvents,
  scheduleTicks = 1,
}: {
  activeEvents: ActiveMarketEvent[]
  casesOpened: number
  eventChanceBonus?: number
  eventHistory: MarketEventLog[]
  now: number
  prng: Prng
  upcomingEvents: ActiveMarketEvent[]
  scheduleTicks?: number
}) {
  if (
    casesOpened > 0 &&
    casesOpened % 120 === 0 &&
    !eventHasAlreadyTriggered(activeEvents, upcomingEvents, eventHistory, 'RetiredCaseWeek', casesOpened)
  ) {
    const candidate = createMarketEvent({
      casesOpened,
      now,
      prng,
      startTime: now + 5 * MARKET_TICK_MS,
      type: 'RetiredCaseWeek',
    })

    return canScheduleEvent(candidate, activeEvents, upcomingEvents) ? candidate : undefined
  }

  if (
    casesOpened > 0 &&
    casesOpened % 75 === 0 &&
    !eventHasAlreadyTriggered(activeEvents, upcomingEvents, eventHistory, 'OperationEvent', casesOpened)
  ) {
    const candidate = createMarketEvent({
      casesOpened,
      now,
      prng,
      startTime: now + 5 * MARKET_TICK_MS,
      type: 'OperationEvent',
    })

    return canScheduleEvent(candidate, activeEvents, upcomingEvents) ? candidate : undefined
  }

  if (activeEvents.some((event) => !event.allowOverlap) || upcomingEvents.some((event) => !event.allowOverlap)) {
    return undefined
  }

  const perTickChance = Math.min(0.25, Math.max(0, randomEventChance + eventChanceBonus))
  const scheduleChance = 1 - (1 - perTickChance) ** Math.max(1, scheduleTicks)

  if (prng() >= scheduleChance) {
    return undefined
  }

  const eligibleTypes = getEligibleEventTypes(casesOpened)
    .filter((type) => ![...activeEvents, ...upcomingEvents].some((event) => event.type === type))

  if (eligibleTypes.length === 0) {
    return undefined
  }

  const selectedType = eligibleTypes[Math.floor(prng() * eligibleTypes.length)] ?? eligibleTypes[0]
  const startDelay = (10 + Math.floor(prng() * 20)) * MARKET_TICK_MS
  const candidate = createMarketEvent({
    casesOpened,
    now,
    prng,
    startTime: now + startDelay,
    type: selectedType,
  })

  return canScheduleEvent(candidate, activeEvents, upcomingEvents) ? candidate : undefined
}

function getRandomWalkChange(skin: SkinBase, prng: Prng, elapsedMs = MARKET_TICK_MS) {
  const variance = stableRarities.has(skin.rarity) ? 0.01 : 0.03
  const elapsedTickScale = Math.sqrt(Math.max(1, elapsedMs / MARKET_TICK_MS))

  return (prng() * 2 - 1) * Math.min(0.12, variance * elapsedTickScale)
}

function getTrend(previousValue: number, nextValue: number): MarketTrendArrow {
  const difference = nextValue - previousValue

  if (Math.abs(difference) < 0.005) {
    return '→'
  }

  return difference > 0 ? '↑' : '↓'
}

function getEventTickImpact(event: ActiveMarketEvent, elapsedMs = MARKET_TICK_MS) {
  if (typeof event.totalImpact !== 'number') {
    return event.impactPerTick ?? 0
  }

  const startTime = event.startTime ?? event.startedAt ?? 0
  const endTime = event.endTime ?? startTime + MARKET_TICK_MS
  const duration = Math.max(MARKET_TICK_MS, endTime - startTime)

  return event.totalImpact * (Math.max(MARKET_TICK_MS, elapsedMs) / duration)
}

export function trimMarketPriceHistory(
  points: MarketPricePoint[],
  now = Date.now(),
): MarketPricePoint[] {
  const minTimestamp = now - MARKET_HISTORY_MAX_AGE_MS

  return points
    .filter((point) => point.timestamp >= minTimestamp)
    .slice(-MARKET_HISTORY_MAX_POINTS)
}

export function appendMarketPriceHistory({
  marketHistory = {},
  marketValues,
  now = Date.now(),
  skins = SKIN_DEFINITIONS,
  trackedSkinIds,
}: {
  marketHistory?: MarketPriceHistory
  marketValues: Record<string, number>
  now?: number
  skins?: SkinBase[]
  trackedSkinIds?: string[]
}): MarketPriceHistory {
  const skinById = new Map(skins.map((skin) => [skin.id, skin]))
  const explicitIds = new Set((trackedSkinIds ?? []).filter((skinId) => skinById.has(skinId)))
  const explicitIdsToTrack = Array.from(explicitIds).slice(0, MARKET_HISTORY_MAX_TRACKED_SKINS)
  const explicitIdsToTrackSet = new Set(explicitIdsToTrack)
  const rankedSkinIds = skins
    .map((skin) => ({
      id: skin.id,
      priority:
        (explicitIds.has(skin.id) ? 10_000_000 : 0) +
        (stableRarities.has(skin.rarity) ? 1_000_000 : 0) +
        (marketValues[skin.id] ?? skin.baseValue),
    }))
    .sort((left, right) => right.priority - left.priority)
    .filter((skin) => !explicitIdsToTrackSet.has(skin.id))
    .slice(0, Math.max(0, MARKET_HISTORY_MAX_TRACKED_SKINS - explicitIdsToTrack.length))
    .map((skin) => skin.id)
  const idsToTrack = new Set([...explicitIdsToTrack, ...rankedSkinIds])
  const nextHistory: MarketPriceHistory = {}

  for (const skinId of idsToTrack) {
    const skin = skinById.get(skinId)

    if (!skin) {
      continue
    }

    const previousPoints = marketHistory[skin.id] ?? []
    const nextPoint = {
      timestamp: now,
      value: roundMarketValue(marketValues[skin.id] ?? skin.baseValue),
    }
    const points =
      previousPoints[previousPoints.length - 1]?.timestamp === now
        ? [...previousPoints.slice(0, -1), nextPoint]
        : [...previousPoints, nextPoint]

    nextHistory[skin.id] = trimMarketPriceHistory(points, now)
  }

  return nextHistory
}

function appendEventLog(eventHistory: MarketEventLog[], events: ActiveMarketEvent[], now: number) {
  const loggedIds = new Set(eventHistory.map((event) => event.id))
  const newLogs = events
    .filter((event) => !loggedIds.has(event.id))
    .map((event) => ({
      id: event.id,
      type: event.type,
      label: event.label,
      name: getMarketEventName(event),
      description: getMarketEventDescription(event),
      startTime: event.startTime,
      endTime: event.endTime,
      endedAt: now,
      effectSummary: getMarketEventEffectSummary(event),
      triggeredAtCasesOpened: event.triggeredAtCasesOpened,
    }))

  return [...newLogs, ...eventHistory].slice(0, 30)
}

function getSpecialEventCaseIds(activeEvents: ActiveMarketEvent[]) {
  return Array.from(
    new Set(activeEvents.flatMap((event) => event.caseIds ?? [])),
  )
}

export function tickMarket({
  activeEvents = [],
  casesOpened = 0,
  eventChanceBonus = 0,
  eventHistory = [],
  elapsedMs = MARKET_TICK_MS,
  marketHistory = {},
  marketValues,
  now = Date.now(),
  prng = Math.random,
  recordHistory = true,
  skins = SKIN_DEFINITIONS,
  trackedSkinIds,
  upcomingEvents = [],
}: MarketTickInput): MarketTickResult {
  const hydratedActiveEvents = activeEvents.map((event) => hydrateMarketEvent(event, now))
  const hydratedUpcomingEvents = upcomingEvents.map((event) => hydrateMarketEvent(event, now))
  const startedEvents = hydratedUpcomingEvents.filter((event) => {
    return (event.startTime ?? 0) <= now && (event.endTime ?? 0) > now
  })
  const futureEvents = hydratedUpcomingEvents.filter((event) => (event.startTime ?? 0) > now)
  const expiredEvents = [...hydratedActiveEvents, ...hydratedUpcomingEvents].filter((event) => {
    return (event.endTime ?? 0) <= now
  })
  let currentEvents = dedupeMarketEvents([...hydratedActiveEvents, ...startedEvents]
    .filter((event) => {
      return (event.startTime ?? 0) <= now && (event.endTime ?? 0) > now
    })
    .map((event) => hydrateMarketEvent(event, now)))
  let nextUpcomingEvents = futureEvents
  const nextEventHistory = appendEventLog(eventHistory, expiredEvents, now)
  const previousValues: Record<string, number> = {}
  const nextValues: Record<string, number> = {}
  const nextTrends: Record<string, MarketTrendArrow> = {}

  for (const skin of skins) {
    const previousValue = marketValues[skin.id] ?? skin.baseValue
    const randomWalkChange = getRandomWalkChange(skin, prng, elapsedMs)

    previousValues[skin.id] = previousValue
    nextValues[skin.id] = roundMarketValue(previousValue * (1 + randomWalkChange))
  }

  const combinedEventImpact = new Map<string, number>()

  for (const event of currentEvents) {
    const impact = getEventTickImpact(event, elapsedMs)

    for (const skinId of event.affectedSkinIds ?? []) {
      combinedEventImpact.set(skinId, (combinedEventImpact.get(skinId) ?? 0) + impact)
    }
  }

  for (const [skinId, impact] of combinedEventImpact) {
    applyPercentChange(nextValues, [skinId], Math.min(0.08, Math.max(-0.08, impact)))
  }

  for (const skin of skins) {
    nextValues[skin.id] = roundMarketValue(nextValues[skin.id] ?? skin.baseValue)
    nextTrends[skin.id] = getTrend(previousValues[skin.id] ?? skin.baseValue, nextValues[skin.id])
  }

  const newEvent = maybeScheduleMarketEvent({
    activeEvents: currentEvents,
    casesOpened,
    eventChanceBonus,
    eventHistory: nextEventHistory,
    now,
    prng,
    upcomingEvents: nextUpcomingEvents,
    scheduleTicks: elapsedMs / MARKET_TICK_MS,
  })

  if (newEvent) {
    nextUpcomingEvents = [...nextUpcomingEvents, newEvent]
  }

  currentEvents = currentEvents.map((event) => hydrateMarketEvent(event, now))
  nextUpcomingEvents = nextUpcomingEvents.map((event) => hydrateMarketEvent(event, now))

  return {
    activeEvents: currentEvents,
    eventHistory: nextEventHistory,
    lastMarketTick: now,
    marketHistory: recordHistory
      ? appendMarketPriceHistory({
          marketHistory,
          marketValues: nextValues,
          now,
          skins,
          trackedSkinIds,
        })
      : marketHistory,
    marketTrends: nextTrends,
    marketValues: nextValues,
    specialEventCaseIds: getSpecialEventCaseIds(currentEvents),
    upcomingEvents: nextUpcomingEvents,
  }
}
