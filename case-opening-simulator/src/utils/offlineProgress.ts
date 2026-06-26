import { gameReducer } from '../data/gameReducer'
import type { GameState } from '../data/gameState'
import { AutomationModuleId } from '../data/models'
import { getSkillOfflineEarningsMultiplier } from '../data/skills'
import {
  CASE_FARM_INTERVAL_MS,
  TRADING_BOT_INTERVAL_MS,
  getCaseFarmIncomePerTick,
  getOpeningDeskIntervalMs,
} from './automation'

export const OFFLINE_PROGRESS_CAP_MS = 24 * 60 * 60 * 1_000
export const OFFLINE_PROGRESS_MIN_DURATION_MS = 5_000
export const OFFLINE_TRADING_BOT_MAX_RUNS = 20
export const OFFLINE_MAX_SIMULATION_STEPS = 25_000

export interface OfflineProgressSummary {
  appliedDurationMs: number
  autoSoldItems: number
  caseFarmEarned: number
  casesOpened: number
  drops: number
  itemsObtained: number
  moneyEarned: number
  moneySpent: number
  netMoneyChange: number
  rareDrops: number
  skippedTasks: string[]
  startedAt: number
  tradeUpsCompleted: number
  wasCapped: boolean
}

export interface OfflineProgressResult {
  state: GameState
  summary: OfflineProgressSummary
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2))
}

function isModuleActive(state: GameState, moduleId: AutomationModuleId) {
  const moduleState = state.automation.modules[moduleId]

  return moduleState.isEnabled && moduleState.level > 0
}

function getNextAutomationRunAt(state: GameState, tradingBotRuns: number) {
  const runTimes: number[] = []
  const autoOpener = state.automation.autoOpener

  if (autoOpener.isEnabled && autoOpener.level > 0 && autoOpener.caseId) {
    runTimes.push(autoOpener.lastOpenTime + autoOpener.intervalMs)
  }

  if (isModuleActive(state, AutomationModuleId.OpeningDesk)) {
    const openingDesk = state.automation.modules[AutomationModuleId.OpeningDesk]

    runTimes.push(openingDesk.lastRunTime + getOpeningDeskIntervalMs(openingDesk.level))
  }

  if (
    isModuleActive(state, AutomationModuleId.TradingBot) &&
    tradingBotRuns < OFFLINE_TRADING_BOT_MAX_RUNS
  ) {
    const tradingBot = state.automation.modules[AutomationModuleId.TradingBot]

    runTimes.push(tradingBot.lastRunTime + TRADING_BOT_INTERVAL_MS)
  }

  return runTimes.length > 0 ? Math.min(...runTimes) : undefined
}

function collectPauseMessages(state: GameState) {
  return state.lastError && state.lastError.includes('paused') ? [state.lastError] : []
}

function applyOfflineCaseFarm(state: GameState, durationMs: number, now: number) {
  const caseFarm = state.automation.modules[AutomationModuleId.CaseFarm]

  if (!caseFarm.isEnabled || caseFarm.level <= 0 || durationMs <= 0) {
    return state
  }

  const incomePerTick = getCaseFarmIncomePerTick(caseFarm.level, state.casesUnlocked.length)
  const earned = roundCurrency(
    (incomePerTick / CASE_FARM_INTERVAL_MS) *
      durationMs *
      getSkillOfflineEarningsMultiplier(state.learnedSkillNodeIds),
  )
  const runs = Math.floor(durationMs / CASE_FARM_INTERVAL_MS)

  if (earned <= 0 && runs <= 0) {
    return state
  }

  return {
    ...state,
    money: roundCurrency(state.money + earned),
    automation: {
      ...state.automation,
      modules: {
        ...state.automation.modules,
        [AutomationModuleId.CaseFarm]: {
          ...caseFarm,
          lastRunTime: now,
          totalGenerated: roundCurrency(caseFarm.totalGenerated + earned),
          totalRuns: caseFarm.totalRuns + runs,
        },
      },
    },
  }
}

function getAutomationRunDelta(
  before: GameState,
  after: GameState,
  moduleId: AutomationModuleId,
) {
  return after.automation.modules[moduleId].totalRuns - before.automation.modules[moduleId].totalRuns
}

function buildOfflineSummary({
  appliedDurationMs,
  before,
  caseFarmEarned,
  after,
  skippedTasks,
  startedAt,
  wasCapped,
}: {
  appliedDurationMs: number
  before: GameState
  caseFarmEarned: number
  after: GameState
  skippedTasks: string[]
  startedAt: number
  wasCapped: boolean
}): OfflineProgressSummary {
  const casesOpened = after.statistics.casesOpened - before.statistics.casesOpened
  const drops = after.statistics.drops - before.statistics.drops
  const tradeUpsCompleted = after.statistics.tradeUpsCompleted - before.statistics.tradeUpsCompleted
  const moneyEarnedFromSales = after.statistics.moneyEarned - before.statistics.moneyEarned

  return {
    appliedDurationMs,
    autoSoldItems: after.statistics.itemsSold - before.statistics.itemsSold,
    caseFarmEarned,
    casesOpened,
    drops,
    itemsObtained: drops + tradeUpsCompleted,
    moneyEarned: roundCurrency(caseFarmEarned + moneyEarnedFromSales),
    moneySpent: roundCurrency(after.statistics.moneySpent - before.statistics.moneySpent),
    netMoneyChange: roundCurrency(after.money - before.money),
    rareDrops: after.statistics.rareDrops - before.statistics.rareDrops,
    skippedTasks: Array.from(new Set(skippedTasks)),
    startedAt,
    tradeUpsCompleted,
    wasCapped,
  }
}

function hasOfflineProgress(summary: OfflineProgressSummary) {
  return (
    summary.casesOpened > 0 ||
    summary.caseFarmEarned > 0 ||
    summary.tradeUpsCompleted > 0 ||
    summary.moneyEarned > 0 ||
    summary.skippedTasks.length > 0
  )
}

export function calculateOfflineProgress(
  state: GameState,
  now = Date.now(),
): OfflineProgressResult | undefined {
  const rawDurationMs = now - state.lastSaved

  if (!Number.isFinite(rawDurationMs) || rawDurationMs < OFFLINE_PROGRESS_MIN_DURATION_MS) {
    return undefined
  }

  const appliedDurationMs = Math.min(rawDurationMs, OFFLINE_PROGRESS_CAP_MS)
  const simulationEnd = state.lastSaved + appliedDurationMs
  const wasCapped = rawDurationMs > OFFLINE_PROGRESS_CAP_MS
  const skippedTasks: string[] = wasCapped
    ? ['Offline progress is capped at 24 hours.']
    : []
  const before = state
  let simulatedState = applyOfflineCaseFarm(state, appliedDurationMs, simulationEnd)
  const caseFarmEarned =
    simulatedState.automation.modules[AutomationModuleId.CaseFarm].totalGenerated -
    state.automation.modules[AutomationModuleId.CaseFarm].totalGenerated
  let tradingBotRuns = 0
  let steps = 0

  while (steps < OFFLINE_MAX_SIMULATION_STEPS) {
    const nextRunAt = getNextAutomationRunAt(simulatedState, tradingBotRuns)

    if (!nextRunAt || nextRunAt > simulationEnd) {
      break
    }

    const tickAt = Math.max(state.lastSaved, nextRunAt)
    const beforeTick = simulatedState

    simulatedState = gameReducer(simulatedState, {
      type: 'TICK_AUTOMATION',
      now: tickAt,
    })
    tradingBotRuns += Math.max(
      0,
      getAutomationRunDelta(beforeTick, simulatedState, AutomationModuleId.TradingBot),
    )
    skippedTasks.push(...collectPauseMessages(simulatedState))
    steps += 1

    if (simulatedState === beforeTick) {
      break
    }
  }

  if (steps >= OFFLINE_MAX_SIMULATION_STEPS) {
    skippedTasks.push('Offline automation stopped early to protect performance.')
  }

  if (tradingBotRuns >= OFFLINE_TRADING_BOT_MAX_RUNS) {
    const tradingBot = simulatedState.automation.modules[AutomationModuleId.TradingBot]

    simulatedState = {
      ...simulatedState,
      automation: {
        ...simulatedState.automation,
        modules: {
          ...simulatedState.automation.modules,
          [AutomationModuleId.TradingBot]: {
            ...tradingBot,
            lastRunTime: simulationEnd,
          },
        },
      },
    }
    skippedTasks.push(`Trading Bot is capped at ${OFFLINE_TRADING_BOT_MAX_RUNS} offline checks.`)
  }

  simulatedState = {
    ...simulatedState,
    lastSaved: now,
  }

  const summary = buildOfflineSummary({
    after: simulatedState,
    appliedDurationMs,
    before,
    caseFarmEarned: roundCurrency(caseFarmEarned),
    skippedTasks,
    startedAt: state.lastSaved,
    wasCapped,
  })

  if (!hasOfflineProgress(summary)) {
    return undefined
  }

  return {
    state: simulatedState,
    summary,
  }
}
