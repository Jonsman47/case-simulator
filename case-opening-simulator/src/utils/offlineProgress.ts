import { gameReducer } from '../data/gameReducer'
import type { GameState } from '../data/gameState'
import { AutomationModuleId } from '../data/models'
import { getSkillOfflineEarningsMultiplier } from '../data/skills'
import { getSkillAutomationIntervalMultiplier, getSkillPassiveIncomeMultiplier } from '../data/skills'
import { getPrestigeAutomationIntervalMultiplier } from '../data/prestige'
import { getUpgradeAutomationIntervalMultiplier } from '../data/upgrades'
import { GAME_EVENT_TICK_MS } from '../events/eventManager'
import { MARKET_TICK_MS, tickMarket } from '../market/marketSimulation'
import {
  CASE_FARM_INTERVAL_MS,
  TRADING_BOT_INTERVAL_MS,
  getCaseFarmIncomePerTick,
  getOpeningDeskIntervalMs,
  getAuctionHouseRefreshMs,
} from './automation'

export const OFFLINE_PROGRESS_CAP_MS = 24 * 60 * 60 * 1_000
export const OFFLINE_PROGRESS_MIN_DURATION_MS = 5_000
export const OFFLINE_TRADING_BOT_MAX_RUNS = 20
export const OFFLINE_MAX_SIMULATION_STEPS = 25_000
export const OFFLINE_MARKET_STEP_MS = 15 * MARKET_TICK_MS
export const OFFLINE_EVENT_STEP_MS = 5 * GAME_EVENT_TICK_MS

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
  eventsProcessed: number
  marketTicks: number
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
  const intervalMultiplier =
    getUpgradeAutomationIntervalMultiplier(state.upgrades) *
    getPrestigeAutomationIntervalMultiplier(state.prestigeBonuses) *
    getSkillAutomationIntervalMultiplier(state.learnedSkillNodeIds)

  if (autoOpener.isEnabled && autoOpener.level > 0 && autoOpener.caseId) {
    runTimes.push(autoOpener.lastOpenTime + Math.round(autoOpener.intervalMs * intervalMultiplier))
  }

  if (isModuleActive(state, AutomationModuleId.OpeningDesk)) {
    const openingDesk = state.automation.modules[AutomationModuleId.OpeningDesk]

    runTimes.push(openingDesk.lastRunTime + Math.round(getOpeningDeskIntervalMs(openingDesk.level) * intervalMultiplier))
  }

  if (
    isModuleActive(state, AutomationModuleId.TradingBot) &&
    tradingBotRuns < OFFLINE_TRADING_BOT_MAX_RUNS
  ) {
    const tradingBot = state.automation.modules[AutomationModuleId.TradingBot]

    runTimes.push(tradingBot.lastRunTime + Math.round(TRADING_BOT_INTERVAL_MS * intervalMultiplier))
  }

  if (isModuleActive(state, AutomationModuleId.AuctionHouse)) {
    const auctionHouse = state.automation.auctionHouse
    const auctionModule = state.automation.modules[AutomationModuleId.AuctionHouse]

    runTimes.push(
      auctionHouse.nextRefreshTime ||
      auctionModule.lastRunTime + getAuctionHouseRefreshMs(auctionModule.level),
    )
  }

  runTimes.push((state.lastEventTick || state.lastSaved) + OFFLINE_EVENT_STEP_MS)

  if (state.settings.marketSimulationEnabled) {
    runTimes.push((state.lastMarketTick || state.lastSaved) + OFFLINE_MARKET_STEP_MS)
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
  const intervalMs = Math.round(
    CASE_FARM_INTERVAL_MS *
    getUpgradeAutomationIntervalMultiplier(state.upgrades) *
    getPrestigeAutomationIntervalMultiplier(state.prestigeBonuses) *
    getSkillAutomationIntervalMultiplier(state.learnedSkillNodeIds),
  )
  const earned = roundCurrency(
    (incomePerTick / intervalMs) *
      durationMs *
      getSkillOfflineEarningsMultiplier(state.learnedSkillNodeIds) *
      getSkillPassiveIncomeMultiplier(state.learnedSkillNodeIds),
  )
  const runs = Math.floor(durationMs / intervalMs)

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

function isTimedAutomationDue(state: GameState, now: number, tradingBotRuns: number) {
  const intervalMultiplier =
    getUpgradeAutomationIntervalMultiplier(state.upgrades) *
    getPrestigeAutomationIntervalMultiplier(state.prestigeBonuses) *
    getSkillAutomationIntervalMultiplier(state.learnedSkillNodeIds)
  const autoOpener = state.automation.autoOpener

  if (
    autoOpener.isEnabled &&
    autoOpener.level > 0 &&
    autoOpener.caseId &&
    autoOpener.lastOpenTime + Math.round(autoOpener.intervalMs * intervalMultiplier) <= now
  ) {
    return true
  }

  const openingDesk = state.automation.modules[AutomationModuleId.OpeningDesk]

  if (
    openingDesk.isEnabled &&
    openingDesk.level > 0 &&
    openingDesk.lastRunTime + Math.round(getOpeningDeskIntervalMs(openingDesk.level) * intervalMultiplier) <= now
  ) {
    return true
  }

  const tradingBot = state.automation.modules[AutomationModuleId.TradingBot]

  if (
    tradingBotRuns < OFFLINE_TRADING_BOT_MAX_RUNS &&
    tradingBot.isEnabled &&
    tradingBot.level > 0 &&
    tradingBot.lastRunTime + Math.round(TRADING_BOT_INTERVAL_MS * intervalMultiplier) <= now
  ) {
    return true
  }

  const auctionModule = state.automation.modules[AutomationModuleId.AuctionHouse]

  return (
    auctionModule.isEnabled &&
    auctionModule.level > 0 &&
    (state.automation.auctionHouse.nextRefreshTime ||
      auctionModule.lastRunTime + getAuctionHouseRefreshMs(auctionModule.level)) <= now
  )
}

function applyOfflineMarketTick(state: GameState, now: number, recordHistory: boolean) {
  const tick = tickMarket({
    activeEvents: state.activeMarketEvents,
    casesOpened: state.statistics.casesOpened,
    eventHistory: state.marketEventHistory,
    elapsedMs: OFFLINE_MARKET_STEP_MS,
    marketHistory: state.marketHistory,
    marketTrends: state.marketTrends,
    marketValues: state.marketValues,
    now,
    recordHistory,
    trackedSkinIds: Array.from(new Set([
      ...state.inventory.map((item) => item.id),
      ...state.recentDrops.map((item) => item.id),
      ...state.lastOpenedItems.map((item) => item.id),
    ])),
    upcomingEvents: state.upcomingMarketEvents,
  })

  return {
    ...state,
    activeMarketEvents: tick.activeEvents,
    upcomingMarketEvents: tick.upcomingEvents,
    marketEventHistory: tick.eventHistory,
    marketHistory: tick.marketHistory,
    marketTrends: tick.marketTrends,
    marketValues: tick.marketValues,
    specialEventCaseIds: Array.from(new Set([
      ...state.activeEvents.flatMap((event) => event.effects.specialEventCaseIds ?? []),
      ...tick.specialEventCaseIds,
    ])),
    lastMarketTick: tick.lastMarketTick,
  }
}

function buildOfflineSummary({
  appliedDurationMs,
  before,
  caseFarmEarned,
  after,
  skippedTasks,
  startedAt,
  wasCapped,
  eventsProcessed,
  marketTicks,
}: {
  appliedDurationMs: number
  before: GameState
  caseFarmEarned: number
  after: GameState
  skippedTasks: string[]
  startedAt: number
  wasCapped: boolean
  eventsProcessed: number
  marketTicks: number
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
    eventsProcessed,
    marketTicks,
    wasCapped,
  }
}

function hasOfflineProgress(summary: OfflineProgressSummary) {
  return (
    summary.casesOpened > 0 ||
    summary.caseFarmEarned > 0 ||
    summary.tradeUpsCompleted > 0 ||
    summary.moneyEarned > 0 ||
    summary.eventsProcessed > 0 ||
    summary.marketTicks > 0 ||
    summary.skippedTasks.length > 0
  )
}

export function calculateOfflineProgress(
  state: GameState,
  now = Date.now(),
): OfflineProgressResult | undefined {
  if (state.lastSaved <= 0) {
    return undefined
  }

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
  let eventsProcessed = 0
  let marketTicks = 0
  let steps = 0

  while (steps < OFFLINE_MAX_SIMULATION_STEPS) {
    const nextRunAt = getNextAutomationRunAt(simulatedState, tradingBotRuns)

    if (!nextRunAt || nextRunAt > simulationEnd) {
      break
    }

    const tickAt = Math.max(state.lastSaved, nextRunAt)
    const beforeTick = simulatedState

    if ((simulatedState.lastEventTick || state.lastSaved) + OFFLINE_EVENT_STEP_MS <= tickAt) {
      simulatedState = gameReducer(simulatedState, {
        type: 'TICK_EVENTS',
        now: tickAt,
        scheduleTicks: OFFLINE_EVENT_STEP_MS / GAME_EVENT_TICK_MS,
      })
      eventsProcessed += 1
    }

    if (
      simulatedState.settings.marketSimulationEnabled &&
      (simulatedState.lastMarketTick || state.lastSaved) + OFFLINE_MARKET_STEP_MS <= tickAt
    ) {
      simulatedState = applyOfflineMarketTick(
        simulatedState,
        tickAt,
        tickAt + OFFLINE_MARKET_STEP_MS > simulationEnd,
      )
      marketTicks += 1
    }

    if (isTimedAutomationDue(simulatedState, tickAt, tradingBotRuns)) {
      const beforeAutomation = simulatedState

      simulatedState = gameReducer(simulatedState, {
        type: 'TICK_AUTOMATION',
        now: tickAt,
      })
      tradingBotRuns += Math.max(
        0,
        getAutomationRunDelta(beforeAutomation, simulatedState, AutomationModuleId.TradingBot),
      )
    }
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
    eventsProcessed,
    marketTicks,
  })

  if (!hasOfflineProgress(summary)) {
    return undefined
  }

  return {
    state: simulatedState,
    summary,
  }
}
