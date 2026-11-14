import type { GameState } from '../data/gameState'
import { EMPLOYEE_ROLE_IDS } from '../business/business'
import { getCareerSnapshot } from './careerProgress'

export type ProgressionReportScope = 'lifetime' | 'currentRun'

export function getCollectionReporting(state: GameState) {
  const allTimeUnique = new Set(state.collectionBook.map((entry) => entry.skinId)).size
  const currentRunUnique = new Set(state.currentRunCollectionBook.map((entry) => entry.skinId)).size
  return {
    allTimeUnique,
    currentRunUnique,
    lifetimeEntries: state.collectionBook.length,
    currentRunEntries: state.currentRunCollectionBook.length,
  }
}

export function getCareerReporting(state: GameState) {
  const snapshot = getCareerSnapshot(state.career)
  const highestLevel = state.career.rankHistory.reduce(
    (highest, entry) => Math.max(highest, entry.level),
    snapshot.level,
  )
  const ownedUpgradeLevels = Object.values(state.careerUpgrades.levels)
    .reduce((total, level) => total + Math.max(0, level ?? 0), 0)
  return {
    snapshot,
    highestLevel,
    lifetimeXp: state.career.lifetimeXp,
    currentRunXp: state.career.currentRunXp,
    specializations: state.career.specializations,
    ownedUpgradeLevels,
    recentMilestones: state.career.recentMilestones,
  }
}

export function getBusinessReporting(state: GameState) {
  const employees = EMPLOYEE_ROLE_IDS.map((roleId) => state.business.employees[roleId])
  const reservedCapital = employees.reduce(
    (total, employee) => total + employee.availableCapital + employee.reservedCapital,
    0,
  )
  const hired = employees.filter((employee) => employee.isHired).length
  const active = employees.filter((employee) => employee.isHired && employee.isEnabled).length
  const operations = employees.reduce((total, employee) => total + employee.completedOperationCount, 0)
  const offlineOperations = state.business.recentOperations.filter((operation) => (
    operation.description.toLowerCase().includes('offline')
  )).length
  return {
    hired,
    active,
    operations,
    offlineOperations,
    reservedCapital,
    revenue: state.economyLedger.lifetime.businessRevenue,
    expenses: state.economyLedger.lifetime.businessExpenses,
    payroll: state.economyLedger.lifetime.businessPayroll,
    realizedResult: state.economyLedger.lifetime.businessRevenue - state.economyLedger.lifetime.businessExpenses,
    currentRunRevenue: state.economyLedger.currentRun.businessRevenue,
    currentRunExpenses: state.economyLedger.currentRun.businessExpenses,
    currentRunResult: state.economyLedger.currentRun.businessRevenue - state.economyLedger.currentRun.businessExpenses,
    employees,
  }
}

export function getPrestigeReporting(state: GameState) {
  const history = state.prestigeSystem.runHistory
  const highestScore = history.reduce((highest, run) => Math.max(highest, run.score), 0)
  const bestCareerRun = history.reduce<typeof history[number] | undefined>((best, run) => (
    !best || run.careerXp > best.careerXp ? run : best
  ), undefined)
  const mostProfitableRun = history.reduce<typeof history[number] | undefined>((best, run) => (
    !best || (run.realizedProfit ?? Number.NEGATIVE_INFINITY) > (best.realizedProfit ?? Number.NEGATIVE_INFINITY)
      ? run
      : best
  ), undefined)
  const vaultRecord = history.reduce((highest, run) => Math.max(highest, run.vaultedItemIds.length), 0)
  return {
    tier: state.prestigeSystem.highestTier,
    completedRuns: state.prestigeSystem.completedRuns,
    pointsAvailable: state.prestigePoints,
    pointsEarned: state.prestigeSystem.totalPointsEarned,
    pointsSpent: state.prestigeSystem.totalPointsSpent,
    perkLevels: state.prestigeSystem.perkLevels,
    highestScore,
    bestCareerRun,
    mostProfitableRun,
    vaultRecord,
    history,
  }
}

export function getFinancialReporting(state: GameState) {
  const business = getBusinessReporting(state)
  const escrowValue = state.marketplace.playerListings.reduce(
    (total, listing) => total + Math.max(0, listing.fairMarketValue),
    0,
  )
  return {
    cash: state.money,
    reservedCapital: business.reservedCapital,
    inventoryValue: state.inventoryValue,
    escrowValue,
    netWorth: state.money + business.reservedCapital + state.inventoryValue + escrowValue,
  }
}

export function getProgressionReport(state: GameState) {
  return {
    business: getBusinessReporting(state),
    career: getCareerReporting(state),
    collection: getCollectionReporting(state),
    finances: getFinancialReporting(state),
    prestige: getPrestigeReporting(state),
  }
}
