import type { GameAction, GameState } from '../data/gameState'
import { Rarity, type SkinInstance, type SkinPattern, type WearCondition } from '../data/models'
import { isExceptionalPattern, isSpecialPattern } from '../utils/skinPatterns'

export const DROP_JOURNAL_SCHEMA_VERSION = 1 as const
export const DROP_JOURNAL_ENTRY_LIMIT = 100
export const DROP_JOURNAL_EVENT_LIMIT = 480

export interface DropJournalEntry {
  id: string
  eventId: string
  instanceId: string
  skinId: string
  weapon: string
  finish: string
  image: string
  rarity: Rarity
  wear: WearCondition
  floatValue: number
  paintSeed?: number
  pattern?: SkinPattern
  valueAtDiscovery: number
  discoveredAt: number
  sourceCaseId?: string
  runId: string
  isFirstRare: boolean
  isPersonalBest: boolean
}

export interface DropJournalState {
  schemaVersion: typeof DROP_JOURNAL_SCHEMA_VERSION
  entries: DropJournalEntry[]
  processedEventIds: string[]
  firstRareEntryId?: string
  highestValueEntryId?: string
  highestValue: number
  classifiedCount: number
  covertCount: number
  specialCount: number
  exceptionalPatternCount: number
}

export function createDefaultDropJournal(): DropJournalState {
  return {
    schemaVersion: DROP_JOURNAL_SCHEMA_VERSION,
    entries: [],
    processedEventIds: [],
    highestValue: 0,
    classifiedCount: 0,
    covertCount: 0,
    specialCount: 0,
    exceptionalPatternCount: 0,
  }
}

function finite(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function normalizeDropJournal(value: unknown): DropJournalState {
  const fallback = createDefaultDropJournal()
  if (!value || typeof value !== 'object') return fallback
  const source = value as Partial<DropJournalState>
  const entries = Array.isArray(source.entries)
    ? source.entries.filter((entry): entry is DropJournalEntry => Boolean(
      entry && typeof entry.id === 'string' && typeof entry.eventId === 'string'
      && typeof entry.instanceId === 'string' && typeof entry.skinId === 'string'
      && typeof entry.discoveredAt === 'number' && typeof entry.valueAtDiscovery === 'number',
    )).slice(-DROP_JOURNAL_ENTRY_LIMIT)
    : []
  const highest = entries.reduce<DropJournalEntry | undefined>(
    (best, entry) => !best || entry.valueAtDiscovery > best.valueAtDiscovery ? entry : best,
    undefined,
  )
  return {
    schemaVersion: DROP_JOURNAL_SCHEMA_VERSION,
    entries,
    processedEventIds: Array.isArray(source.processedEventIds)
      ? Array.from(new Set(source.processedEventIds.filter((id): id is string => typeof id === 'string'))).slice(-DROP_JOURNAL_EVENT_LIMIT)
      : entries.map((entry) => entry.eventId).slice(-DROP_JOURNAL_EVENT_LIMIT),
    firstRareEntryId: typeof source.firstRareEntryId === 'string' ? source.firstRareEntryId : entries[0]?.id,
    highestValueEntryId: typeof source.highestValueEntryId === 'string' ? source.highestValueEntryId : highest?.id,
    highestValue: Math.max(finite(source.highestValue), highest?.valueAtDiscovery ?? 0),
    classifiedCount: Math.max(0, Math.floor(finite(source.classifiedCount))),
    covertCount: Math.max(0, Math.floor(finite(source.covertCount))),
    specialCount: Math.max(0, Math.floor(finite(source.specialCount))),
    exceptionalPatternCount: Math.max(0, Math.floor(finite(source.exceptionalPatternCount))),
  }
}

export function isNotableOpening(item: SkinInstance) {
  return item.rarity === Rarity.Classified
    || item.rarity === Rarity.Covert
    || item.rarity === Rarity.SpecialItem
    || item.rarity === Rarity.Contraband
    || isSpecialPattern(item)
}

function sourceCaseId(action: GameAction, item: SkinInstance) {
  if (action.type === 'OPEN_CASE') return action.payload.caseId
  return item.caseIds[0]
}

function eventId(action: GameAction, item: SkinInstance) {
  if (action.type === 'OPEN_CASE') return `${action.payload.openingEventId ?? `open:${item.discoveredAt}`}:${item.instanceId}`
  return `${action.type}:${item.instanceId}`
}

/** Records genuine generated opening results only; marketplace/reward acquisitions never enter the journal. */
export function recordDropJournalAction(before: GameState, after: GameState, action: GameAction): DropJournalState {
  if (!['OPEN_CASE', 'TICK_AUTOMATION', 'TICK_BUSINESS'].includes(action.type)) return after.dropJournal
  const existingIds = new Set(before.recentDrops.map((item) => item.instanceId))
  const newDrops = after.recentDrops.filter((item) => !existingIds.has(item.instanceId)).reverse()
  if (newDrops.length === 0) return after.dropJournal

  const journal = normalizeDropJournal(after.dropJournal)
  const entries = [...journal.entries]
  const processed = new Set(journal.processedEventIds)
  let firstRareEntryId = journal.firstRareEntryId
  let highestValueEntryId = journal.highestValueEntryId
  let highestValue = journal.highestValue
  let classifiedCount = journal.classifiedCount
  let covertCount = journal.covertCount
  let specialCount = journal.specialCount
  let exceptionalPatternCount = journal.exceptionalPatternCount

  for (const item of newDrops) {
    if (!isNotableOpening(item)) continue
    const stableEventId = eventId(action, item)
    if (processed.has(stableEventId)) continue
    processed.add(stableEventId)
    const isFirstRare = !firstRareEntryId
    const isPersonalBest = item.marketValue > highestValue
    const id = `journal:${item.instanceId}`
    const entry: DropJournalEntry = {
      id,
      eventId: stableEventId,
      instanceId: item.instanceId,
      skinId: item.id,
      weapon: item.weapon,
      finish: item.finish,
      image: item.image,
      rarity: item.rarity,
      wear: item.wear,
      floatValue: item.floatValue,
      paintSeed: item.paintSeed,
      pattern: item.pattern,
      valueAtDiscovery: item.marketValue,
      discoveredAt: item.discoveredAt,
      sourceCaseId: sourceCaseId(action, item),
      runId: after.economyLedger.currentRunId,
      isFirstRare,
      isPersonalBest,
    }
    entries.push(entry)
    if (isFirstRare) firstRareEntryId = id
    if (isPersonalBest) {
      highestValue = item.marketValue
      highestValueEntryId = id
    }
    if (item.rarity === Rarity.Classified) classifiedCount += 1
    if (item.rarity === Rarity.Covert) covertCount += 1
    if (item.rarity === Rarity.SpecialItem || item.rarity === Rarity.Contraband) specialCount += 1
    if (isExceptionalPattern(item)) exceptionalPatternCount += 1
  }

  return {
    schemaVersion: DROP_JOURNAL_SCHEMA_VERSION,
    entries: entries.slice(-DROP_JOURNAL_ENTRY_LIMIT),
    processedEventIds: Array.from(processed).slice(-DROP_JOURNAL_EVENT_LIMIT),
    firstRareEntryId,
    highestValueEntryId,
    highestValue,
    classifiedCount,
    covertCount,
    specialCount,
    exceptionalPatternCount,
  }
}
