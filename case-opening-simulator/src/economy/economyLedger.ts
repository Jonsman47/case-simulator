import { nanoid } from 'nanoid'
import type { GameAction, GameState, GameStatistics } from '../data/gameState'
import type { SkinInstance } from '../data/models'
import { roundCurrency } from '../utils/safeNumbers'

export const ECONOMY_LEDGER_HISTORY_LIMIT = 160
export const ECONOMY_LEDGER_REQUEST_LIMIT = 480
export const ECONOMY_LEDGER_RUN_SUMMARY_LIMIT = 24
export const ECONOMY_LEDGER_ITEM_DELTA_LIMIT = 64

export type EconomyTransactionType =
  | 'admin-adjustment'
  | 'quest-reward'
  | 'npc-delivery'
  | 'auction-purchase'
  | 'automation-cycle'
  | 'automation-purchase'
  | 'business-investment'
  | 'business-operation'
  | 'business-transfer'
  | 'case-license'
  | 'case-opening'
  | 'daily-reward'
  | 'achievement-reward'
  | 'inventory-adjustment'
  | 'marketplace-purchase'
  | 'marketplace-sale'
  | 'prestige-reset'
  | 'skin-sale'
  | 'trade-up'
  | 'upgrade-purchase'
  | 'work-reward'

export type EconomyItemDeltaKind =
  | 'acquired'
  | 'consumed'
  | 'disposed'
  | 'produced'

export interface EconomyItemDelta {
  instanceId: string
  skinId: string
  kind: EconomyItemDeltaKind
  estimatedValue: number
}

export interface EconomyTransactionAllocation {
  cashIncome: number
  cashExpense: number
  caseOpeningSpend: number
  caseOpeningReturns: number
  marketplacePurchases: number
  marketplaceSales: number
  auctionPurchases: number
  workIncome: number
  dailyIncome: number
  achievementIncome: number
  automationIncome: number
  automationExpenses: number
  businessRevenue: number
  businessExpenses: number
  businessPayroll: number
  upgradeSpend: number
  licenseSpend: number
  realizedTradingProfit: number
  tradeUpInputValue: number
  tradeUpOutputValue: number
}

export interface EconomyTransaction {
  id: string
  timestamp: number
  type: EconomyTransactionType
  moneyDelta: number
  runId: string
  source: string
  destination?: string
  requestId?: string
  relatedMarketplaceId?: string
  itemDeltas: EconomyItemDelta[]
  itemDeltaCount: number
  itemDeltasTruncated: boolean
  allocation: EconomyTransactionAllocation
}

export interface EconomyTotals extends EconomyTransactionAllocation {
  netCashFlow: number
  transactionCount: number
}

export interface EconomyRunSummary {
  runId: string
  startedAt: number
  endedAt: number
  endingCash: number
  endingInventoryValue: number
  totals: EconomyTotals
}

export interface EconomyLegacyBaseline {
  moneyEarned: number
  moneySpent: number
  itemsSold: number
  casesOpened: number
}

export interface EconomyLedgerState {
  schemaVersion: 1
  currentRunId: string
  currentRunStartedAt: number
  historyCompleteness: 'complete' | 'partial-pre-v34'
  legacyBaseline: EconomyLegacyBaseline
  lifetime: EconomyTotals
  currentRun: EconomyTotals
  recentTransactions: EconomyTransaction[]
  processedTransactionIds: string[]
  archivedRuns: EconomyRunSummary[]
  itemCostBasis: Record<string, number>
}

const zeroAllocation = (): EconomyTransactionAllocation => ({
  cashIncome: 0,
  cashExpense: 0,
  caseOpeningSpend: 0,
  caseOpeningReturns: 0,
  marketplacePurchases: 0,
  marketplaceSales: 0,
  auctionPurchases: 0,
  workIncome: 0,
  dailyIncome: 0,
  achievementIncome: 0,
  automationIncome: 0,
  automationExpenses: 0,
  businessRevenue: 0,
  businessExpenses: 0,
  businessPayroll: 0,
  upgradeSpend: 0,
  licenseSpend: 0,
  realizedTradingProfit: 0,
  tradeUpInputValue: 0,
  tradeUpOutputValue: 0,
})

export const createEmptyEconomyTotals = (): EconomyTotals => ({
  ...zeroAllocation(),
  netCashFlow: 0,
  transactionCount: 0,
})

function safeNonNegative(value: number) {
  return Number.isFinite(value) ? roundCurrency(Math.max(0, value)) : 0
}

function safeMoney(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : 0
}

function getLegacyBaseline(statistics?: Partial<GameStatistics>): EconomyLegacyBaseline {
  return {
    moneyEarned: safeNonNegative(statistics?.moneyEarned ?? 0),
    moneySpent: safeNonNegative(statistics?.moneySpent ?? 0),
    itemsSold: Math.max(0, Math.floor(statistics?.itemsSold ?? 0)),
    casesOpened: Math.max(0, Math.floor(statistics?.casesOpened ?? 0)),
  }
}

export function createEconomyLedger({
  now = Date.now(),
  runId = `run-${now.toString(36)}-${nanoid(6)}`,
  legacyStatistics,
}: {
  now?: number
  runId?: string
  legacyStatistics?: Partial<GameStatistics>
} = {}): EconomyLedgerState {
  return {
    schemaVersion: 1,
    currentRunId: runId,
    currentRunStartedAt: now,
    historyCompleteness: legacyStatistics ? 'partial-pre-v34' : 'complete',
    legacyBaseline: getLegacyBaseline(legacyStatistics),
    lifetime: createEmptyEconomyTotals(),
    currentRun: createEmptyEconomyTotals(),
    recentTransactions: [],
    processedTransactionIds: [],
    archivedRuns: [],
    itemCostBasis: {},
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeTotals(value: unknown): EconomyTotals {
  const source = isRecord(value) ? value : {}
  const allocation = zeroAllocation()
  for (const key of Object.keys(allocation) as (keyof EconomyTransactionAllocation)[]) {
    allocation[key] = key === 'realizedTradingProfit'
      ? safeMoney(Number(source[key] ?? 0))
      : safeNonNegative(Number(source[key] ?? 0))
  }
  return {
    ...allocation,
    netCashFlow: safeMoney(Number(source.netCashFlow ?? allocation.cashIncome - allocation.cashExpense)),
    transactionCount: Math.max(0, Math.floor(Number(source.transactionCount ?? 0))),
  }
}

function normalizeTransaction(value: unknown): EconomyTransaction | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string') return undefined
  const allocations = buildAllocationFromUnknown(value.allocation)
  const items = Array.isArray(value.itemDeltas)
    ? value.itemDeltas.flatMap((entry): EconomyItemDelta[] => {
        if (!isRecord(entry) || typeof entry.instanceId !== 'string' || typeof entry.skinId !== 'string' || typeof entry.kind !== 'string') return []
        if (!['acquired', 'consumed', 'disposed', 'produced'].includes(entry.kind)) return []
        return [{
          instanceId: entry.instanceId,
          skinId: entry.skinId,
          kind: entry.kind as EconomyItemDeltaKind,
          estimatedValue: safeNonNegative(Number(entry.estimatedValue ?? 0)),
        }]
      })
    : []
  return {
    id: value.id,
    timestamp: Math.max(0, Number(value.timestamp) || 0),
    type: value.type as EconomyTransactionType,
    moneyDelta: safeMoney(Number(value.moneyDelta ?? 0)),
    runId: typeof value.runId === 'string' ? value.runId : 'unknown-run',
    source: typeof value.source === 'string' ? value.source : 'unknown',
    destination: typeof value.destination === 'string' ? value.destination : undefined,
    requestId: typeof value.requestId === 'string' ? value.requestId : undefined,
    relatedMarketplaceId: typeof value.relatedMarketplaceId === 'string' ? value.relatedMarketplaceId : undefined,
    itemDeltas: items,
    itemDeltaCount: Math.max(items.length, Math.floor(Number(value.itemDeltaCount ?? items.length))),
    itemDeltasTruncated: value.itemDeltasTruncated === true,
    allocation: allocations,
  }
}

function buildAllocationFromUnknown(value: unknown): EconomyTransactionAllocation {
  const source = isRecord(value) ? value : {}
  const allocation = zeroAllocation()
  for (const key of Object.keys(allocation) as (keyof EconomyTransactionAllocation)[]) {
    allocation[key] = key === 'realizedTradingProfit'
      ? safeMoney(Number(source[key] ?? 0))
      : safeNonNegative(Number(source[key] ?? 0))
  }
  return allocation
}

export function normalizeEconomyLedger(
  value: unknown,
  statistics: GameStatistics,
  savedAt: number,
  ownedItems: SkinInstance[],
): EconomyLedgerState {
  if (!isRecord(value)) {
    return createEconomyLedger({
      now: savedAt,
      runId: `legacy-v34-${savedAt.toString(36)}`,
      legacyStatistics: statistics,
    })
  }
  const recentTransactions = Array.isArray(value.recentTransactions)
    ? value.recentTransactions.flatMap((entry) => {
        const transaction = normalizeTransaction(entry)
        return transaction ? [transaction] : []
      }).slice(-ECONOMY_LEDGER_HISTORY_LIMIT)
    : []
  const transactionIds = recentTransactions.map((transaction) => transaction.id)
  const rawProcessedIds = Array.isArray(value.processedTransactionIds)
    ? value.processedTransactionIds.filter((entry): entry is string => typeof entry === 'string')
    : []
  const processedTransactionIds = Array.from(new Set([...rawProcessedIds, ...transactionIds]))
    .slice(-ECONOMY_LEDGER_REQUEST_LIMIT)
  const ownedIds = new Set(ownedItems.map((item) => item.instanceId))
  const rawCostBasis = isRecord(value.itemCostBasis) ? value.itemCostBasis : {}
  const itemCostBasis = Object.fromEntries(Object.entries(rawCostBasis).flatMap(([itemId, amount]) => (
    ownedIds.has(itemId) && Number.isFinite(Number(amount))
      ? [[itemId, safeNonNegative(Number(amount))]]
      : []
  )))
  const legacy = isRecord(value.legacyBaseline) ? value.legacyBaseline : {}
  const archivedRuns = Array.isArray(value.archivedRuns)
    ? value.archivedRuns.flatMap((entry): EconomyRunSummary[] => {
        if (!isRecord(entry) || typeof entry.runId !== 'string') return []
        return [{
          runId: entry.runId,
          startedAt: Math.max(0, Number(entry.startedAt) || 0),
          endedAt: Math.max(0, Number(entry.endedAt) || 0),
          endingCash: safeNonNegative(Number(entry.endingCash ?? 0)),
          endingInventoryValue: safeNonNegative(Number(entry.endingInventoryValue ?? 0)),
          totals: normalizeTotals(entry.totals),
        }]
      }).slice(-ECONOMY_LEDGER_RUN_SUMMARY_LIMIT)
    : []
  return {
    schemaVersion: 1,
    currentRunId: typeof value.currentRunId === 'string' ? value.currentRunId : `run-${savedAt.toString(36)}`,
    currentRunStartedAt: Number.isFinite(Number(value.currentRunStartedAt))
      ? Math.max(0, Number(value.currentRunStartedAt))
      : savedAt,
    historyCompleteness: value.historyCompleteness === 'complete' ? 'complete' : 'partial-pre-v34',
    legacyBaseline: {
      moneyEarned: safeNonNegative(Number(legacy.moneyEarned ?? statistics.moneyEarned)),
      moneySpent: safeNonNegative(Number(legacy.moneySpent ?? statistics.moneySpent)),
      itemsSold: Math.max(0, Math.floor(Number(legacy.itemsSold ?? statistics.itemsSold))),
      casesOpened: Math.max(0, Math.floor(Number(legacy.casesOpened ?? statistics.casesOpened))),
    },
    lifetime: normalizeTotals(value.lifetime),
    currentRun: normalizeTotals(value.currentRun),
    recentTransactions,
    processedTransactionIds,
    archivedRuns,
    itemCostBasis,
  }
}

function addAllocation(totals: EconomyTotals, allocation: EconomyTransactionAllocation, moneyDelta: number) {
  const next = { ...totals }
  for (const key of Object.keys(allocation) as (keyof EconomyTransactionAllocation)[]) {
    next[key] = safeMoney(next[key] + allocation[key])
  }
  next.netCashFlow = safeMoney(next.netCashFlow + moneyDelta)
  next.transactionCount += 1
  return next
}

function getActionTimestamp(action: GameAction) {
  if ('now' in action && typeof action.now === 'number') return action.now
  if (action.type === 'OPEN_CASE' && typeof action.payload.now === 'number') return action.payload.now
  return Date.now()
}

function getDeterministicTransactionId(action: GameAction, timestamp: number, runId: string) {
  if ('requestId' in action && typeof action.requestId === 'string') {
    return `${action.type.toLowerCase()}:${action.requestId}`
  }
  if (action.type === 'OPEN_CASE' && action.payload.openingEventId) {
    return `case-opening:${action.payload.openingEventId}`
  }
  if (action.type === 'CLAIM_ACHIEVEMENT_REWARD') {
    return `achievement:${action.achievementId}:${runId}`
  }
  if (action.type === 'CLAIM_DAILY_CHALLENGE') {
    return `daily-challenge:${action.challengeId}:${timestamp}`
  }
  if (action.type === 'CLAIM_DAILY_REWARD') {
    return `daily-reward:${timestamp}`
  }
  return `${action.type.toLowerCase()}:${timestamp}:${nanoid(7)}`
}

function classifyAction(action: GameAction): {
  type: EconomyTransactionType
  source: string
  destination?: string
  relatedMarketplaceId?: string
} {
  switch (action.type) {
    case 'OPEN_CASE':
      return { type: 'case-opening', source: action.payload.caseId, destination: 'case inventory' }
    case 'PURCHASE_CASE_LICENSE':
      return { type: 'case-license', source: 'player cash', destination: action.caseId }
    case 'SELL_ITEM':
    case 'SELL_ITEMS':
      return { type: 'skin-sale', source: 'instant-sale desk', destination: 'player cash' }
    case 'BUY_MARKET_LISTING':
      return { type: 'marketplace-purchase', source: 'player cash', destination: 'CSWEAR', relatedMarketplaceId: action.listingId }
    case 'ACCEPT_PLAYER_MARKET_OFFER':
    case 'TICK_MARKETPLACE':
      return { type: 'marketplace-sale', source: 'CSWEAR', destination: 'player cash', relatedMarketplaceId: 'listingId' in action ? action.listingId : undefined }
    case 'PURCHASE_AUCTION_DEAL':
      return { type: 'auction-purchase', source: 'player cash', destination: 'Auction House', relatedMarketplaceId: action.dealId }
    case 'COMPLETE_POOP_CLEANING':
    case 'COMPLETE_POOP_CLEANUP_MINIGAME':
    case 'COMPLETE_WORK_MINIGAME':
      return { type: 'work-reward', source: 'Work', destination: 'player cash' }
    case 'CLAIM_DAILY_REWARD':
    case 'CLAIM_DAILY_CHALLENGE':
      return { type: 'daily-reward', source: 'daily rewards', destination: 'player' }
    case 'CLAIM_ACHIEVEMENT_REWARD':
    case 'CLAIM_ALL_ACHIEVEMENT_REWARDS':
      return { type: 'achievement-reward', source: 'achievements', destination: 'player' }
    case 'CLAIM_QUEST_STAGE':
      return { type: 'quest-reward', source: action.questId, destination: 'player' }
    case 'DELIVER_QUEST_ITEM':
      return { type: 'npc-delivery', source: 'player inventory', destination: action.questId }
    case 'PURCHASE_AUTO_OPENER':
    case 'PURCHASE_AUTOMATION_MODULE':
      return { type: 'automation-purchase', source: 'player cash', destination: 'automation' }
    case 'TICK_AUTOMATION':
      return { type: 'automation-cycle', source: 'automation', destination: 'player' }
    case 'HIRE_EMPLOYEE':
    case 'TRAIN_EMPLOYEE':
      return { type: 'business-investment', source: 'player cash', destination: 'Business' }
    case 'ALLOCATE_EMPLOYEE_BUDGET':
      return { type: 'business-transfer', source: 'player cash', destination: `${action.roleId} reserve` }
    case 'RELEASE_EMPLOYEE_BUDGET':
      return { type: 'business-transfer', source: `${action.roleId} reserve`, destination: 'player cash' }
    case 'TICK_BUSINESS':
    case 'CONFIRM_BUSINESS_TRADE_UP':
      return { type: 'business-operation', source: 'Business', destination: 'player' }
    case 'PURCHASE_UPGRADE':
    case 'PURCHASE_CAREER_UPGRADE':
    case 'PURCHASE_PRESTIGE_BONUS':
    case 'LEARN_SKILL_NODE':
      return { type: 'upgrade-purchase', source: 'player', destination: 'progression' }
    case 'TRADE_UP':
      return { type: 'trade-up', source: 'trade-up contract', destination: 'inventory' }
    case 'PRESTIGE':
      return { type: 'prestige-reset', source: 'current run', destination: 'next run' }
    case 'ADD_ITEM':
    case 'REMOVE_ITEM':
      return { type: 'inventory-adjustment', source: action.type === 'ADD_ITEM' ? 'external grant' : 'inventory', destination: action.type === 'ADD_ITEM' ? 'inventory' : 'external removal' }
    default:
      return { type: 'admin-adjustment', source: 'system adjustment', destination: 'player' }
  }
}

function getOwnedItems(state: GameState) {
  return [
    ...state.inventory,
    ...state.marketplace.playerListings.map((listing) => listing.item),
  ]
}

function buildItemDeltas(before: GameState, after: GameState, action: GameAction) {
  const beforeById = new Map(getOwnedItems(before).map((item) => [item.instanceId, item]))
  const afterById = new Map(getOwnedItems(after).map((item) => [item.instanceId, item]))
  const acquired = [...afterById.values()].filter((item) => !beforeById.has(item.instanceId))
  const removed = [...beforeById.values()].filter((item) => !afterById.has(item.instanceId))
  const producedIds = new Set(action.type === 'TRADE_UP' ? acquired.map((item) => item.instanceId) : [])
  const consumedIds = new Set(action.type === 'TRADE_UP' ? removed.map((item) => item.instanceId) : [])
  const deltas: EconomyItemDelta[] = [
    ...acquired.map((item): EconomyItemDelta => ({
      instanceId: item.instanceId,
      skinId: item.id,
      kind: producedIds.has(item.instanceId) ? 'produced' : 'acquired',
      estimatedValue: safeNonNegative(item.marketValue),
    })),
    ...removed.map((item): EconomyItemDelta => ({
      instanceId: item.instanceId,
      skinId: item.id,
      kind: consumedIds.has(item.instanceId) ? 'consumed' : 'disposed',
      estimatedValue: safeNonNegative(item.marketValue),
    })),
  ]
  const beforeOpenedIds = new Set(before.lastOpenedItems.map((item) => item.instanceId))
  const transientOpenedItems = after.lastOpenedItems.filter((item) => (
    !beforeOpenedIds.has(item.instanceId) &&
    !afterById.has(item.instanceId)
  ))
  for (const item of transientOpenedItems) {
    const estimatedValue = safeNonNegative(item.marketValue)
    deltas.push(
      { instanceId: item.instanceId, skinId: item.id, kind: 'acquired', estimatedValue },
      { instanceId: item.instanceId, skinId: item.id, kind: 'disposed', estimatedValue },
    )
  }
  void action
  return deltas
}

function sumItemValues(deltas: EconomyItemDelta[], kinds: EconomyItemDeltaKind[]) {
  const accepted = new Set(kinds)
  return safeNonNegative(deltas.reduce((sum, item) => sum + (accepted.has(item.kind) ? item.estimatedValue : 0), 0))
}

function buildAllocation(
  before: GameState,
  after: GameState,
  type: EconomyTransactionType,
  moneyDelta: number,
  itemDeltas: EconomyItemDelta[],
) {
  const allocation = zeroAllocation()
  const trackedIncome = safeNonNegative(after.statistics.moneyEarned - before.statistics.moneyEarned)
  const trackedExpense = safeNonNegative(after.statistics.moneySpent - before.statistics.moneySpent)
  const residual = safeMoney(moneyDelta - trackedIncome + trackedExpense)
  allocation.cashIncome = safeNonNegative(trackedIncome + Math.max(0, residual))
  allocation.cashExpense = safeNonNegative(trackedExpense + Math.max(0, -residual))

  if (type === 'case-opening') {
    allocation.caseOpeningSpend = allocation.cashExpense
    allocation.caseOpeningReturns = allocation.cashIncome
  } else if (type === 'marketplace-purchase') {
    allocation.marketplacePurchases = allocation.cashExpense
  } else if (type === 'marketplace-sale') {
    allocation.marketplaceSales = allocation.cashIncome
  } else if (type === 'auction-purchase') {
    allocation.auctionPurchases = allocation.cashExpense
  } else if (type === 'work-reward') {
    allocation.workIncome = allocation.cashIncome
  } else if (type === 'daily-reward') {
    allocation.dailyIncome = allocation.cashIncome
  } else if (type === 'achievement-reward') {
    allocation.achievementIncome = allocation.cashIncome
  } else if (type === 'automation-cycle') {
    allocation.automationIncome = allocation.cashIncome
    allocation.automationExpenses = allocation.cashExpense
    const casesOpened = Math.max(0, after.statistics.casesOpened - before.statistics.casesOpened)
    if (casesOpened > 0) {
      allocation.caseOpeningSpend = trackedExpense
      allocation.caseOpeningReturns = trackedIncome
      allocation.automationExpenses = safeNonNegative(allocation.automationExpenses - trackedExpense)
      allocation.automationIncome = safeNonNegative(allocation.automationIncome - trackedIncome)
    }
  } else if (type === 'automation-purchase') {
    allocation.automationExpenses = allocation.cashExpense
  } else if (type === 'business-investment') {
    allocation.businessExpenses = allocation.cashExpense
  } else if (type === 'business-operation') {
    allocation.businessRevenue = allocation.cashIncome
    allocation.businessExpenses = allocation.cashExpense
    allocation.businessPayroll = safeNonNegative(after.business.financials.payroll - before.business.financials.payroll)
    const newOperations = after.business.recentOperations.filter((operation) => !before.business.processedOperationIds.includes(operation.id))
    const openingSpend = newOperations.filter((operation) => operation.type === 'case-opened').reduce((sum, operation) => sum + operation.expense, 0)
    const openingReturns = newOperations.filter((operation) => operation.type === 'case-opened').reduce((sum, operation) => sum + operation.revenue, 0)
    allocation.caseOpeningSpend = safeNonNegative(openingSpend)
    allocation.caseOpeningReturns = safeNonNegative(openingReturns)
    allocation.marketplacePurchases = safeNonNegative(newOperations.filter((operation) => operation.type === 'market-purchase').reduce((sum, operation) => sum + operation.expense, 0))
    allocation.marketplaceSales = safeNonNegative(newOperations.filter((operation) => operation.type === 'instant-sale').reduce((sum, operation) => sum + operation.revenue, 0))
  } else if (type === 'upgrade-purchase') {
    allocation.upgradeSpend = allocation.cashExpense
  } else if (type === 'case-license') {
    allocation.licenseSpend = allocation.cashExpense
  } else if (type === 'trade-up') {
    allocation.tradeUpInputValue = sumItemValues(itemDeltas, ['consumed'])
    allocation.tradeUpOutputValue = sumItemValues(itemDeltas, ['produced'])
  }

  return allocation
}

function updateCostBasis(
  ledger: EconomyLedgerState,
  before: GameState,
  after: GameState,
  type: EconomyTransactionType,
  allocation: EconomyTransactionAllocation,
  itemDeltas: EconomyItemDelta[],
) {
  const next = { ...ledger.itemCostBasis }
  const removed = itemDeltas.filter((item) => item.kind === 'disposed' || item.kind === 'consumed')
  const acquired = itemDeltas.filter((item) => item.kind === 'acquired' || item.kind === 'produced')
  const consumedBasis = removed.reduce((sum, item) => sum + (next[item.instanceId] ?? item.estimatedValue), 0)
  let totalAcquisitionCost = 0
  if (type === 'case-opening') totalAcquisitionCost = allocation.caseOpeningSpend
  else if (type === 'marketplace-purchase') totalAcquisitionCost = allocation.marketplacePurchases
  else if (type === 'auction-purchase') totalAcquisitionCost = allocation.auctionPurchases
  else if (type === 'trade-up') totalAcquisitionCost = consumedBasis
  else if (type === 'business-operation') {
    const existing = new Set(before.business.processedOperationIds)
    totalAcquisitionCost = after.business.recentOperations
      .filter((operation) => !existing.has(operation.id) && (operation.type === 'case-opened' || operation.type === 'market-purchase'))
      .reduce((sum, operation) => sum + operation.expense, 0)
  }
  const perItemCost = acquired.length > 0 ? safeNonNegative(totalAcquisitionCost / acquired.length) : 0
  for (const item of removed) delete next[item.instanceId]
  for (const item of acquired) next[item.instanceId] = perItemCost
  const ownedIds = new Set(getOwnedItems(after).map((item) => item.instanceId))
  for (const itemId of Object.keys(next)) {
    if (!ownedIds.has(itemId)) delete next[itemId]
  }
  return next
}

function getRealizedProfit(ledger: EconomyLedgerState, type: EconomyTransactionType, allocation: EconomyTransactionAllocation, itemDeltas: EconomyItemDelta[]) {
  if (type !== 'skin-sale' && type !== 'marketplace-sale') return 0
  const sold = itemDeltas.filter((item) => item.kind === 'disposed')
  if (sold.length === 0) return 0
  const soldWithKnownBasis = sold.filter((item) => ledger.itemCostBasis[item.instanceId] !== undefined)
  if (soldWithKnownBasis.length === 0) return 0
  const knownBasis = soldWithKnownBasis.reduce((sum, item) => sum + ledger.itemCostBasis[item.instanceId], 0)
  const allocatedProceeds = allocation.cashIncome * (soldWithKnownBasis.length / sold.length)
  return safeMoney(allocatedProceeds - knownBasis)
}

function shouldSkipLedgerAction(action: GameAction) {
  return action.type === 'APPLY_OFFLINE_PROGRESS' ||
    action.type === 'REPLACE_GAME_STATE' ||
    action.type === 'RESET_GAME' ||
    action.type === 'CLEAR_GAME_ERROR' ||
    action.type === 'CLEAR_UI_EVENTS' ||
    action.type === 'UPDATE_SETTINGS' ||
    action.type === 'UPDATE_INVENTORY_VIEW_STATE' ||
    action.type === 'UPDATE_ONBOARDING_STATE' ||
    action.type === 'MARK_BACKUP_CREATED' ||
    action.type === 'TICK_EVENTS' ||
    action.type === 'TICK_MARKET' ||
    action.type === 'APPLY_MARKET_TICK' ||
    action.type === 'UPDATE_MARKET_VALUE' ||
    action.type === 'APPLY_EXTERNAL_SKIN_PRICES' ||
    action.type === 'REFRESH_DAILY_REWARDS'
}

export function recordEconomyAction(before: GameState, after: GameState, action: GameAction): GameState {
  if (shouldSkipLedgerAction(action)) return after
  const isBusinessTransfer = action.type === 'ALLOCATE_EMPLOYEE_BUDGET' || action.type === 'RELEASE_EMPLOYEE_BUDGET'
  const beforeReserved = Object.values(before.business.employees).reduce((sum, employee) => sum + employee.availableCapital + employee.reservedCapital, 0)
  const afterReserved = Object.values(after.business.employees).reduce((sum, employee) => sum + employee.availableCapital + employee.reservedCapital, 0)
  const walletDelta = safeMoney(after.money - before.money)
  const moneyDelta = isBusinessTransfer
    ? 0
    : action.type === 'TICK_BUSINESS'
      ? safeMoney(walletDelta + afterReserved - beforeReserved)
      : walletDelta
  const itemDeltas = buildItemDeltas(before, after, action)
  if (moneyDelta === 0 && itemDeltas.length === 0 && !isBusinessTransfer) return after
  const timestamp = getActionTimestamp(action)
  const id = getDeterministicTransactionId(action, timestamp, after.economyLedger.currentRunId)
  const ledger = after.economyLedger
  if (ledger.processedTransactionIds.includes(id)) return after
  const classification = classifyAction(action)
  const allocation = buildAllocation(before, after, classification.type, moneyDelta, itemDeltas)
  allocation.realizedTradingProfit = getRealizedProfit(ledger, classification.type, allocation, itemDeltas)
  const transaction: EconomyTransaction = {
    id,
    timestamp,
    type: classification.type,
    moneyDelta,
    runId: ledger.currentRunId,
    source: classification.source,
    destination: classification.destination,
    requestId: 'requestId' in action ? action.requestId : undefined,
    relatedMarketplaceId: classification.relatedMarketplaceId,
    itemDeltas: itemDeltas.slice(0, ECONOMY_LEDGER_ITEM_DELTA_LIMIT),
    itemDeltaCount: itemDeltas.length,
    itemDeltasTruncated: itemDeltas.length > ECONOMY_LEDGER_ITEM_DELTA_LIMIT,
    allocation,
  }
  const nextLedger: EconomyLedgerState = {
    ...ledger,
    lifetime: addAllocation(ledger.lifetime, allocation, moneyDelta),
    currentRun: classification.type === 'prestige-reset'
      ? ledger.currentRun
      : addAllocation(ledger.currentRun, allocation, moneyDelta),
    recentTransactions: [transaction, ...ledger.recentTransactions].slice(0, ECONOMY_LEDGER_HISTORY_LIMIT),
    processedTransactionIds: [...ledger.processedTransactionIds, id].slice(-ECONOMY_LEDGER_REQUEST_LIMIT),
    itemCostBasis: updateCostBasis(ledger, before, after, classification.type, allocation, itemDeltas),
  }
  return { ...after, economyLedger: nextLedger }
}

export function startNextEconomyRun(state: GameState, nextState: GameState, now: number): EconomyLedgerState {
  const ledger = state.economyLedger
  const archivedRun: EconomyRunSummary = {
    runId: ledger.currentRunId,
    startedAt: ledger.currentRunStartedAt,
    endedAt: now,
    endingCash: state.money,
    endingInventoryValue: state.inventoryValue,
    totals: ledger.currentRun,
  }
  return {
    ...ledger,
    currentRunId: `prestige-${nextState.prestigeLevel}-${now.toString(36)}-${nanoid(5)}`,
    currentRunStartedAt: now,
    currentRun: createEmptyEconomyTotals(),
    archivedRuns: [archivedRun, ...ledger.archivedRuns].slice(0, ECONOMY_LEDGER_RUN_SUMMARY_LIMIT),
    itemCostBasis: {},
  }
}

export function getLedgerFinancialSnapshot(state: GameState, scope: 'lifetime' | 'currentRun' = 'lifetime') {
  const ledger = state.economyLedger
  const totals = scope === 'lifetime' ? ledger.lifetime : ledger.currentRun
  const isUnmigratedInMemoryFixture = scope === 'lifetime' &&
    totals.transactionCount === 0 &&
    ledger.legacyBaseline.moneyEarned === 0 &&
    ledger.legacyBaseline.moneySpent === 0 &&
    (state.statistics.moneyEarned > 0 || state.statistics.moneySpent > 0)
  const legacyIncome = scope === 'lifetime'
    ? isUnmigratedInMemoryFixture ? state.statistics.moneyEarned : ledger.legacyBaseline.moneyEarned
    : 0
  const legacyExpenses = scope === 'lifetime'
    ? isUnmigratedInMemoryFixture ? state.statistics.moneySpent : ledger.legacyBaseline.moneySpent
    : 0
  const totalIncome = safeNonNegative(legacyIncome + totals.cashIncome)
  const totalExpenses = safeNonNegative(legacyExpenses + totals.cashExpense)
  const netCashFlow = safeMoney(totalIncome - totalExpenses)
  return {
    ...totals,
    totalIncome,
    totalExpenses,
    netCashFlow,
    inventoryValue: safeNonNegative(state.inventoryValue),
    economicNetWorth: safeNonNegative(state.money + state.inventoryValue),
    isHistoricalDataComplete: ledger.historyCompleteness === 'complete' && !isUnmigratedInMemoryFixture,
  }
}
