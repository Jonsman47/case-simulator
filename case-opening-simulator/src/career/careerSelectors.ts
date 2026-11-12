import type { GameState } from '../data/gameState'
import type { CollectionEntry } from '../data/models'
import { getLedgerFinancialSnapshot, type EconomyTransaction } from '../economy/economyLedger'

export type CareerXpEventSource =
  | 'case-discovery'
  | 'trade-realized'
  | 'trade-up-research'
  | 'work-performance'
  | 'business-operation'

/** Stable economic input for the Career system scheduled for Prompt 2. */
export function getPlayerEconomicActivity(state: GameState) {
  return {
    lifetime: getLedgerFinancialSnapshot(state, 'lifetime'),
    currentRun: getLedgerFinancialSnapshot(state, 'currentRun'),
    recentTransactions: state.economyLedger.recentTransactions,
  }
}

/** Maps authoritative transactions to possible XP sources without awarding XP yet. */
export function getCareerXpEventSource(transaction: EconomyTransaction): CareerXpEventSource | undefined {
  if (transaction.type === 'case-opening') return 'case-discovery'
  if (transaction.type === 'skin-sale' || transaction.type === 'marketplace-sale') return 'trade-realized'
  if (transaction.type === 'trade-up') return 'trade-up-research'
  if (transaction.type === 'work-reward') return 'work-performance'
  if (transaction.type === 'automation-cycle') return 'business-operation'
  return undefined
}

export function getTradingProfitability(state: GameState, scope: 'lifetime' | 'currentRun' = 'currentRun') {
  const financials = getLedgerFinancialSnapshot(state, scope)
  return {
    realizedProfit: financials.realizedTradingProfit,
    purchases: financials.marketplacePurchases + financials.auctionPurchases,
    sales: financials.marketplaceSales,
  }
}

export function getBusinessFinancials(state: GameState, scope: 'lifetime' | 'currentRun' = 'currentRun') {
  const financials = getLedgerFinancialSnapshot(state, scope)
  return {
    revenue: financials.automationIncome,
    expenses: financials.automationExpenses,
    net: Number((financials.automationIncome - financials.automationExpenses).toFixed(2)),
  }
}

export function getPrestigeRunSummaries(state: GameState) {
  return state.economyLedger.archivedRuns
}

export function getCollectionDiscoveryScope(
  state: GameState,
  scope: 'allTime' | 'currentRun',
): {
  entries: CollectionEntry[]
  isComplete: boolean
  runId: string
} {
  // v34 has only the legacy all-time collection. Prompt 6 will add run-tagged
  // discoveries; callers can already distinguish that incomplete scope safely.
  return {
    entries: scope === 'allTime' ? state.collectionBook : [],
    isComplete: scope === 'allTime',
    runId: state.economyLedger.currentRunId,
  }
}
