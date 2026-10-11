import { CASE_DEFINITIONS } from '../data/cases'
import { normalizeDropTable, type DropTableEntry, type Prng } from '../data/dropLogic'
import { CaseStatus, Rarity, type CaseDefinition, type SkinBase } from '../data/models'
import { SKIN_DEFINITIONS } from '../data/skins'
import type { ActiveMarketEvent, MarketEventType } from '../market/marketSimulation'

export type GameEventType =
  | 'KnifeWeekend'
  | 'MarketBoom'
  | 'MarketCrash'
  | 'OperationEvent'
  | 'RetiredCaseWeek'
  | 'CollectorWeek'
  | 'TradeUpMadness'
  | 'HalloweenSkins'
  | 'WinterCases'

export interface GameEventEffects {
  caseCostMultiplier?: number
  caseCostMultipliers?: Record<string, number>
  collectionRewardMultiplier?: number
  dropRarityMultipliers?: Partial<Record<Rarity, number>>
  limitedSkinIds?: string[]
  marketEventType?: MarketEventType
  prestigePointMultiplier?: number
  specialEventCaseIds?: string[]
  tradeUpInputCostMultiplier?: number
}

export interface GameEventReward {
  label: string
  money?: number
  prestigePoints?: number
  skillPoints?: number
}

export interface ActiveGameEvent {
  id: string
  type: GameEventType
  name: string
  description: string
  startTime: number
  endTime: number
  effectSummary: string
  effects: GameEventEffects
  rewards?: GameEventReward[]
  allowOverlap?: boolean
  exclusiveGroup?: string
  priority: number
  triggeredAtCasesOpened?: number
}

export interface GameEventLog {
  id: string
  type: GameEventType
  name: string
  description: string
  startTime: number
  endTime: number
  endedAt: number
  effectSummary: string
  rewards?: GameEventReward[]
  triggeredAtCasesOpened?: number
}

export interface EventManagerTickInput {
  activeEvents?: ActiveGameEvent[]
  autoSchedule?: boolean
  casesOpened?: number
  eventChanceBonus?: number
  eventHistory?: GameEventLog[]
  now?: number
  prng?: Prng
  scheduleTicks?: number
  upcomingEvents?: ActiveGameEvent[]
}

export interface EventManagerTickResult {
  activeEvents: ActiveGameEvent[]
  endedEvents: ActiveGameEvent[]
  eventHistory: GameEventLog[]
  specialEventCaseIds: string[]
  startedEvents: ActiveGameEvent[]
  upcomingEvents: ActiveGameEvent[]
}

interface GameEventTemplate {
  type: GameEventType
  name: string
  description: string
  durationMs: number
  effectSummary: string
  effects: GameEventEffects | ((now: number) => GameEventEffects)
  rewards?: GameEventReward[]
  allowOverlap?: boolean
  exclusiveGroup?: string
  priority: number
  progressRequirement?: number
}

export const GAME_EVENT_TICK_MS = 60_000

const hourMs = 60 * 60 * 1_000
const dayMs = 24 * hourMs
const randomEventChance = 0.04
const marketDirectionGroup = 'market_direction'

function roundCurrency(value: number) {
  return Number(value.toFixed(2))
}

function getRetiredCaseIds(caseDefinitions: CaseDefinition[] = CASE_DEFINITIONS, now = Date.now()) {
  return caseDefinitions
    .filter((caseDef) => {
      return caseDef.status === CaseStatus.Retired || Boolean(caseDef.retirement && caseDef.retirement.date <= now)
    })
    .map((caseDef) => caseDef.id)
}

function getSeasonalSkinIds(keyword: string, skins: SkinBase[] = SKIN_DEFINITIONS) {
  const lowerKeyword = keyword.toLowerCase()

  return skins
    .filter((skin) => `${skin.weapon} ${skin.finish}`.toLowerCase().includes(lowerKeyword))
    .map((skin) => skin.id)
}

function createEventId(type: GameEventType, startTime: number, prng: Prng) {
  return `${type}-${startTime}-${Math.floor(prng() * 1_000_000)}`
}

function resolveEffects(effects: GameEventTemplate['effects'], now: number): GameEventEffects {
  return typeof effects === 'function' ? effects(now) : effects
}

const eventTemplates: Record<GameEventType, GameEventTemplate> = {
  KnifeWeekend: {
    type: 'KnifeWeekend',
    name: 'Knife Weekend',
    description: 'Rare knives and gloves are in the spotlight for a short weekend rush.',
    durationMs: 2 * dayMs,
    effectSummary: 'Special item drop weights are tripled and knife/glove prices follow the market event.',
    priority: 70,
    allowOverlap: true,
    effects: {
      dropRarityMultipliers: {
        [Rarity.SpecialItem]: 3,
        [Rarity.Contraband]: 1.25,
      },
      marketEventType: 'KnifeWeekend',
    },
  },
  MarketBoom: {
    type: 'MarketBoom',
    name: 'Market Boom',
    description: 'Demand surges across the entire skin market.',
    durationMs: 2 * dayMs,
    effectSummary: 'Market prices trend upward while the event is live.',
    priority: 50,
    exclusiveGroup: marketDirectionGroup,
    effects: {
      marketEventType: 'MarketBoom',
    },
  },
  MarketCrash: {
    type: 'MarketCrash',
    name: 'Market Crash',
    description: 'A panic sell-off pushes prices down across the board.',
    durationMs: 2 * dayMs,
    effectSummary: 'Market prices trend downward while the event is live.',
    priority: 60,
    exclusiveGroup: marketDirectionGroup,
    effects: {
      marketEventType: 'MarketCrash',
    },
  },
  OperationEvent: {
    type: 'OperationEvent',
    name: 'Operation Event',
    description: 'Operation stock appears and modern cases temporarily enter the active rotation.',
    durationMs: 3 * dayMs,
    effectSummary: 'Revolution and Kilowatt cases are temporarily available with a small case discount.',
    priority: 45,
    progressRequirement: 25,
    allowOverlap: true,
    effects: {
      caseCostMultipliers: {
        // Imported CS2 case IDs are the active catalog; legacy placeholder IDs remain for older saves/tests.
        'crate-4880': 0.95,
        'crate-4904': 0.95,
        revolution_style_case: 0.95,
        kilowatt_style_case: 0.95,
      },
      marketEventType: 'OperationEvent',
      specialEventCaseIds: ['crate-4880', 'crate-4904', 'revolution_style_case', 'kilowatt_style_case'],
    },
  },
  RetiredCaseWeek: {
    type: 'RetiredCaseWeek',
    name: 'Retired Case Week',
    description: 'Vaulted cases return for a limited week.',
    durationMs: 7 * dayMs,
    effectSummary: 'Retired cases become openable and receive a 10% event discount.',
    priority: 65,
    progressRequirement: 50,
    allowOverlap: true,
    effects: (now) => {
      const retiredCaseIds = getRetiredCaseIds(CASE_DEFINITIONS, now)

      return {
        caseCostMultipliers: Object.fromEntries(retiredCaseIds.map((caseId) => [caseId, 0.9])),
        marketEventType: 'RetiredCaseWeek',
        specialEventCaseIds: retiredCaseIds,
      }
    },
  },
  CollectorWeek: {
    type: 'CollectorWeek',
    name: 'Collector Week',
    description: 'Collectors reward completion pushes across the whole collection book.',
    durationMs: 7 * dayMs,
    effectSummary: 'Collection rewards count 50% stronger and prestige awards get a small boost.',
    priority: 35,
    progressRequirement: 40,
    allowOverlap: true,
    effects: {
      collectionRewardMultiplier: 1.5,
      marketEventType: 'CollectorWeek',
      prestigePointMultiplier: 1.05,
    },
  },
  TradeUpMadness: {
    type: 'TradeUpMadness',
    name: 'Trade-Up Madness',
    description: 'Contract grinders flood the workshop and better outcomes become more attractive.',
    durationMs: 2 * dayMs,
    effectSummary: 'Trade-up input value is treated 10% cheaper and result markets trend upward.',
    priority: 55,
    progressRequirement: 10,
    allowOverlap: true,
    effects: {
      marketEventType: 'TradeUpMadness',
      tradeUpInputCostMultiplier: 0.9,
    },
  },
  HalloweenSkins: {
    type: 'HalloweenSkins',
    name: 'Halloween Skins',
    description: 'Seasonal finishes and spooky-themed pulls get a temporary spotlight.',
    durationMs: 4 * dayMs,
    effectSummary: 'Dark and moon-themed limited skins are boosted with a small rare-tier nudge.',
    priority: 40,
    allowOverlap: true,
    effects: {
      dropRarityMultipliers: {
        [Rarity.Restricted]: 1.08,
        [Rarity.Classified]: 1.08,
        [Rarity.Covert]: 1.05,
      },
      limitedSkinIds: getSeasonalSkinIds('moon'),
    },
  },
  WinterCases: {
    type: 'WinterCases',
    name: 'Winter Cases',
    description: 'A seasonal case drive discounts openings and nudges premium tiers.',
    durationMs: 5 * dayMs,
    effectSummary: 'All case openings are 10% cheaper and higher tiers receive a small weight boost.',
    priority: 42,
    allowOverlap: true,
    effects: {
      caseCostMultiplier: 0.9,
      dropRarityMultipliers: {
        [Rarity.Classified]: 1.06,
        [Rarity.Covert]: 1.04,
        [Rarity.SpecialItem]: 1.02,
      },
    },
  },
}

export const GAME_EVENT_TYPES = Object.keys(eventTemplates) as GameEventType[]

export const PREDEFINED_GAME_EVENTS = GAME_EVENT_TYPES.map((type) => {
  const template = eventTemplates[type]

  return {
    type,
    name: template.name,
    description: template.description,
    effectSummary: template.effectSummary,
    durationMs: template.durationMs,
    priority: template.priority,
  }
})

function eventsOverlap(left: Pick<ActiveGameEvent, 'startTime' | 'endTime'>, right: Pick<ActiveGameEvent, 'startTime' | 'endTime'>) {
  return left.startTime < right.endTime && right.startTime < left.endTime
}

function appendEventLog(eventHistory: GameEventLog[], events: ActiveGameEvent[], now: number) {
  const existingIds = new Set(eventHistory.map((event) => event.id))
  const newLogs = events
    .filter((event) => !existingIds.has(event.id))
    .map((event) => ({
      id: event.id,
      type: event.type,
      name: event.name,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      endedAt: now,
      effectSummary: event.effectSummary,
      rewards: event.rewards,
      triggeredAtCasesOpened: event.triggeredAtCasesOpened,
    }))

  return [...newLogs, ...eventHistory].slice(0, 50)
}

function eventHasAlreadyTriggered(
  activeEvents: ActiveGameEvent[],
  upcomingEvents: ActiveGameEvent[],
  eventHistory: GameEventLog[],
  type: GameEventType,
  casesOpened: number,
) {
  return [...activeEvents, ...upcomingEvents, ...eventHistory].some((event) => {
    return event.type === type && event.triggeredAtCasesOpened === casesOpened
  })
}

function getEligibleEventTypes(casesOpened: number) {
  return GAME_EVENT_TYPES.filter((type) => casesOpened >= (eventTemplates[type].progressRequirement ?? 0))
}

function canScheduleEvent(
  candidate: ActiveGameEvent,
  activeEvents: ActiveGameEvent[],
  upcomingEvents: ActiveGameEvent[],
) {
  const overlappingEvents = [...activeEvents, ...upcomingEvents]
    .filter((event) => eventsOverlap(candidate, event))

  if (overlappingEvents.length >= 3 || overlappingEvents.some((event) => event.type === candidate.type)) {
    return false
  }

  return [...activeEvents, ...upcomingEvents].every((event) => {
    if (!eventsOverlap(candidate, event)) {
      return true
    }

    if (candidate.exclusiveGroup && candidate.exclusiveGroup === event.exclusiveGroup) {
      return candidate.priority > event.priority
    }

    return Boolean(candidate.allowOverlap && event.allowOverlap)
  })
}

function resolveConflicts(events: ActiveGameEvent[]) {
  const orderedEvents = [...events].sort((left, right) => right.priority - left.priority)
  const acceptedEvents: ActiveGameEvent[] = []
  const replacedEvents: ActiveGameEvent[] = []

  for (const event of orderedEvents) {
    const conflicts = acceptedEvents.filter((acceptedEvent) => {
      return (
        eventsOverlap(event, acceptedEvent) &&
        (
          event.type === acceptedEvent.type ||
          (event.exclusiveGroup && acceptedEvent.exclusiveGroup === event.exclusiveGroup)
        )
      )
    })

    if (conflicts.length > 0) {
      replacedEvents.push(event)
      continue
    }

    acceptedEvents.push(event)
  }

  return {
    activeEvents: acceptedEvents.sort((left, right) => left.endTime - right.endTime),
    replacedEvents,
  }
}

function getSpecialEventCaseIds(activeEvents: ActiveGameEvent[]) {
  return Array.from(
    new Set(activeEvents.flatMap((event) => event.effects.specialEventCaseIds ?? [])),
  )
}

export function getActiveGameEventEffects(activeEvents: ActiveGameEvent[]) {
  const combined = activeEvents.reduce<GameEventEffects>((effects, event) => {
    const eventEffects = event.effects

    return {
      caseCostMultiplier:
        (effects.caseCostMultiplier ?? 1) * (eventEffects.caseCostMultiplier ?? 1),
      caseCostMultipliers: {
        ...effects.caseCostMultipliers,
        ...Object.fromEntries(
          Object.entries(eventEffects.caseCostMultipliers ?? {}).map(([caseId, multiplier]) => [
            caseId,
            (effects.caseCostMultipliers?.[caseId] ?? 1) * multiplier,
          ]),
        ),
      },
      collectionRewardMultiplier:
        (effects.collectionRewardMultiplier ?? 1) * (eventEffects.collectionRewardMultiplier ?? 1),
      dropRarityMultipliers: {
        ...effects.dropRarityMultipliers,
        ...Object.fromEntries(
          Object.entries(eventEffects.dropRarityMultipliers ?? {}).map(([rarity, multiplier]) => [
            rarity,
            (effects.dropRarityMultipliers?.[rarity as Rarity] ?? 1) * multiplier,
          ]),
        ),
      },
      limitedSkinIds: Array.from(new Set([
        ...(effects.limitedSkinIds ?? []),
        ...(eventEffects.limitedSkinIds ?? []),
      ])),
      prestigePointMultiplier:
        (effects.prestigePointMultiplier ?? 1) * (eventEffects.prestigePointMultiplier ?? 1),
      specialEventCaseIds: Array.from(new Set([
        ...(effects.specialEventCaseIds ?? []),
        ...(eventEffects.specialEventCaseIds ?? []),
      ])),
      tradeUpInputCostMultiplier:
        (effects.tradeUpInputCostMultiplier ?? 1) * (eventEffects.tradeUpInputCostMultiplier ?? 1),
    }
  }, {})

  return {
    ...combined,
    caseCostMultiplier: Math.min(1.5, Math.max(0.5, combined.caseCostMultiplier ?? 1)),
    caseCostMultipliers: Object.fromEntries(
      Object.entries(combined.caseCostMultipliers ?? {}).map(([caseId, multiplier]) => [
        caseId,
        Math.min(1.5, Math.max(0.5, multiplier)),
      ]),
    ),
    collectionRewardMultiplier: Math.min(2, Math.max(1, combined.collectionRewardMultiplier ?? 1)),
    dropRarityMultipliers: Object.fromEntries(
      Object.entries(combined.dropRarityMultipliers ?? {}).map(([rarity, multiplier]) => [
        rarity,
        Math.min(5, Math.max(0.5, multiplier)),
      ]),
    ),
    prestigePointMultiplier: Math.min(2, Math.max(0.5, combined.prestigePointMultiplier ?? 1)),
    tradeUpInputCostMultiplier: Math.min(1.5, Math.max(0.5, combined.tradeUpInputCostMultiplier ?? 1)),
  }
}

function applyDropRarityMultipliers(
  dropTable: DropTableEntry[],
  multipliers: Partial<Record<Rarity, number>>,
  skinsById: Map<string, SkinBase>,
) {
  const originalTotal = dropTable.reduce((total, drop) => total + Math.max(0, drop.weight), 0)

  if (originalTotal <= 0 || Object.keys(multipliers).length === 0) {
    return dropTable
  }

  const boostedTable = dropTable.map((drop) => {
    const skin = skinsById.get(drop.skinId)
    const multiplier = skin ? multipliers[skin.rarity] ?? 1 : 1

    return {
      ...drop,
      weight: Math.max(0, drop.weight) * multiplier,
    }
  })
  const normalizedTable = normalizeDropTable(boostedTable)
  const normalizedTotal = normalizedTable.reduce((total, drop) => total + drop.weight, 0)
  const normalizationFactor = normalizedTotal > 0 ? originalTotal / normalizedTotal : 1

  return normalizedTable.map((drop) => ({
    ...drop,
    weight: drop.weight * normalizationFactor,
  }))
}

export function applyGameEventEffectsToCase(
  caseDef: CaseDefinition,
  activeEvents: ActiveGameEvent[],
  skinsById: Map<string, SkinBase>,
) {
  const effects = getActiveGameEventEffects(activeEvents)
  const globalCostMultiplier = effects.caseCostMultiplier ?? 1
  const caseCostMultiplier = effects.caseCostMultipliers?.[caseDef.id] ?? 1
  const costMultiplier = Math.max(0.01, globalCostMultiplier * caseCostMultiplier)
  const costAdjustedCase = costMultiplier === 1
    ? caseDef
    : {
        ...caseDef,
        cost: Math.max(0.01, roundCurrency(caseDef.cost * costMultiplier)),
      }

  return {
    ...costAdjustedCase,
    dropTable: applyDropRarityMultipliers(
      costAdjustedCase.dropTable,
      effects.dropRarityMultipliers ?? {},
      skinsById,
    ),
  }
}

export function applyGameEventEffectsToCases(
  caseDefinitions: CaseDefinition[],
  activeEvents: ActiveGameEvent[],
  skinsById: Map<string, SkinBase>,
) {
  return caseDefinitions.map((caseDef) => applyGameEventEffectsToCase(caseDef, activeEvents, skinsById))
}

export function getGameEventTradeUpInputCostMultiplier(activeEvents: ActiveGameEvent[]) {
  return getActiveGameEventEffects(activeEvents).tradeUpInputCostMultiplier ?? 1
}

export function getGameEventPrestigePointMultiplier(activeEvents: ActiveGameEvent[]) {
  return getActiveGameEventEffects(activeEvents).prestigePointMultiplier ?? 1
}

export function getGameEventCollectionRewardMultiplier(activeEvents: ActiveGameEvent[]) {
  return getActiveGameEventEffects(activeEvents).collectionRewardMultiplier ?? 1
}

export function getGameEventName(event: ActiveGameEvent | GameEventLog) {
  return event.name
}

export function getGameEventDescription(event: ActiveGameEvent | GameEventLog) {
  return event.description
}

export function getGameEventEffectSummary(event: ActiveGameEvent | GameEventLog) {
  return event.effectSummary
}

export function gameEventsToMarketEvents(events: ActiveGameEvent[]): ActiveMarketEvent[] {
  return events
    .filter((event) => event.effects.marketEventType)
    .map((event) => ({
      id: `game:${event.id}`,
      type: event.effects.marketEventType as MarketEventType,
      label: event.name,
      name: event.name,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      effectSummary: event.effectSummary,
      allowOverlap: event.allowOverlap,
      startedAt: event.startTime,
      triggeredAtCasesOpened: event.triggeredAtCasesOpened,
    }))
}

export class EventManager {
  createEvent({
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
    type: GameEventType
  }): ActiveGameEvent {
    const template = eventTemplates[type]
    const eventDuration = durationMs ?? template.durationMs
    const endTime = startTime + eventDuration

    return {
      id: createEventId(type, startTime, prng),
      type,
      name: template.name,
      description: template.description,
      startTime,
      endTime,
      effectSummary: template.effectSummary,
      effects: resolveEffects(template.effects, startTime),
      rewards: template.rewards,
      allowOverlap: template.allowOverlap,
      exclusiveGroup: template.exclusiveGroup,
      priority: template.priority,
      triggeredAtCasesOpened: casesOpened,
    }
  }

  hydrateEvent(event: ActiveGameEvent, now = Date.now()): ActiveGameEvent {
    const template = eventTemplates[event.type]

    return {
      ...event,
      name: event.name ?? template.name,
      description: event.description ?? template.description,
      effectSummary: event.effectSummary ?? template.effectSummary,
      effects: {
        ...resolveEffects(template.effects, event.startTime ?? now),
        ...event.effects,
      },
      rewards: event.rewards ?? template.rewards,
      allowOverlap: event.allowOverlap ?? template.allowOverlap,
      exclusiveGroup: event.exclusiveGroup ?? template.exclusiveGroup,
      priority: event.priority ?? template.priority,
      startTime: event.startTime ?? now,
      endTime: event.endTime ?? now + template.durationMs,
    }
  }

  maybeScheduleEvent({
    activeEvents,
    casesOpened,
    eventChanceBonus = 0,
    eventHistory,
    now,
    prng,
    upcomingEvents,
    scheduleTicks = 1,
  }: {
    activeEvents: ActiveGameEvent[]
    casesOpened: number
    eventChanceBonus?: number
    eventHistory: GameEventLog[]
    now: number
    prng: Prng
    upcomingEvents: ActiveGameEvent[]
    scheduleTicks?: number
  }) {
    if (
      casesOpened > 0 &&
      casesOpened % 120 === 0 &&
      !eventHasAlreadyTriggered(activeEvents, upcomingEvents, eventHistory, 'RetiredCaseWeek', casesOpened)
    ) {
      const candidate = this.createEvent({
        casesOpened,
        now,
        prng,
        startTime: now + 5 * GAME_EVENT_TICK_MS,
        type: 'RetiredCaseWeek',
      })

      return canScheduleEvent(candidate, activeEvents, upcomingEvents) ? candidate : undefined
    }

    if (
      casesOpened > 0 &&
      casesOpened % 75 === 0 &&
      !eventHasAlreadyTriggered(activeEvents, upcomingEvents, eventHistory, 'OperationEvent', casesOpened)
    ) {
      const candidate = this.createEvent({
        casesOpened,
        now,
        prng,
        startTime: now + 5 * GAME_EVENT_TICK_MS,
        type: 'OperationEvent',
      })

      return canScheduleEvent(candidate, activeEvents, upcomingEvents) ? candidate : undefined
    }

    const perTickChance = Math.min(0.25, Math.max(0, randomEventChance + eventChanceBonus))
    const scheduleChance = 1 - (1 - perTickChance) ** Math.max(1, scheduleTicks)

    if (prng() >= scheduleChance) {
      return undefined
    }

    const eligibleTypes = getEligibleEventTypes(casesOpened)
    const selectedType = eligibleTypes[Math.floor(prng() * eligibleTypes.length)] ?? 'MarketBoom'
    const startDelay = (10 + Math.floor(prng() * 20)) * GAME_EVENT_TICK_MS
    const candidate = this.createEvent({
      casesOpened,
      now,
      prng,
      startTime: now + startDelay,
      type: selectedType,
    })

    return canScheduleEvent(candidate, activeEvents, upcomingEvents) ? candidate : undefined
  }

  tick({
    activeEvents = [],
    autoSchedule = true,
    casesOpened = 0,
    eventChanceBonus = 0,
    eventHistory = [],
    now = Date.now(),
    prng = Math.random,
    scheduleTicks = 1,
    upcomingEvents = [],
  }: EventManagerTickInput = {}): EventManagerTickResult {
    const hydratedActiveEvents = activeEvents.map((event) => this.hydrateEvent(event, now))
    const hydratedUpcomingEvents = upcomingEvents.map((event) => this.hydrateEvent(event, now))
    const startedEvents = hydratedUpcomingEvents.filter((event) => {
      return event.startTime <= now && event.endTime > now
    })
    const futureEvents = hydratedUpcomingEvents.filter((event) => event.startTime > now)
    const expiredEvents = [...hydratedActiveEvents, ...hydratedUpcomingEvents].filter((event) => {
      return event.endTime <= now
    })
    const activeCandidates = [...hydratedActiveEvents, ...startedEvents].filter((event) => {
      return event.startTime <= now && event.endTime > now
    })
    const conflictResult = resolveConflicts(activeCandidates)
    let nextUpcomingEvents = futureEvents
    const nextEventHistory = appendEventLog(
      eventHistory,
      [...expiredEvents, ...conflictResult.replacedEvents],
      now,
    )

    if (autoSchedule) {
      const newEvent = this.maybeScheduleEvent({
        activeEvents: conflictResult.activeEvents,
        casesOpened,
        eventChanceBonus,
        eventHistory: nextEventHistory,
        now,
        prng,
        scheduleTicks,
        upcomingEvents: nextUpcomingEvents,
      })

      if (newEvent) {
        nextUpcomingEvents = [...nextUpcomingEvents, newEvent]
      }
    }

    return {
      activeEvents: conflictResult.activeEvents,
      endedEvents: [...expiredEvents, ...conflictResult.replacedEvents],
      eventHistory: nextEventHistory,
      specialEventCaseIds: getSpecialEventCaseIds(conflictResult.activeEvents),
      startedEvents,
      upcomingEvents: nextUpcomingEvents,
    }
  }
}

export const eventManager = new EventManager()
