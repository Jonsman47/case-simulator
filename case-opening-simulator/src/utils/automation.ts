import {
  AutomationModuleId,
  type AutomationModuleState,
  type AutomationModulesState,
  type AutomationState,
  type AutoOpenerState,
} from '../data/models'

export const AUTO_OPENER_BASE_COST = 350
export const AUTO_OPENER_UPGRADE_COST = 2_500
export const AUTO_OPENER_BASE_INTERVAL_MS = 30_000
export const AUTO_OPENER_INTERVAL_STEP_MS = 5_000
export const AUTO_OPENER_MIN_INTERVAL_MS = 5_000
export const OPENING_DESK_BASE_INTERVAL_MS = 90_000
export const OPENING_DESK_INTERVAL_STEP_MS = 7_500
export const OPENING_DESK_MIN_INTERVAL_MS = 45_000
export const CASE_FARM_INTERVAL_MS = 10_000
export const TRADING_BOT_INTERVAL_MS = 45_000

export interface AutomationModuleDefinition {
  id: AutomationModuleId
  name: string
  description: string
  baseCost: number
  costMultiplier: number
  maxLevel: number
  resourceLabel: string
  getCurrentBenefit: (level: number) => string
  getNextBenefit: (level: number) => string
}

export const AUTOMATION_MODULE_IDS = Object.values(AutomationModuleId)

export const AUTOMATION_MODULE_DEFINITIONS: Record<
  AutomationModuleId,
  AutomationModuleDefinition
> = {
  [AutomationModuleId.OpeningDesk]: {
    id: AutomationModuleId.OpeningDesk,
    name: 'Opening Desk',
    description: 'Opens small batches of the selected Auto Opener case on a slower timer.',
    baseCost: 6_500,
    costMultiplier: 2.35,
    maxLevel: 6,
    resourceLabel: 'case keys',
    getCurrentBenefit: (level) =>
      level > 0
        ? `${getOpeningDeskBatchSize(level)} cases every ${formatDuration(getOpeningDeskIntervalMs(level))}`
        : 'Locked',
    getNextBenefit: (level) =>
      `${getOpeningDeskBatchSize(level + 1)} cases every ${formatDuration(getOpeningDeskIntervalMs(level + 1))}`,
  },
  [AutomationModuleId.CaseFarm]: {
    id: AutomationModuleId.CaseFarm,
    name: 'Case Farm',
    description: 'Generates passive cash based on your unlocked case catalog.',
    baseCost: 1_500,
    costMultiplier: 2.05,
    maxLevel: 10,
    resourceLabel: 'power',
    getCurrentBenefit: (level) =>
      level > 0 ? `${formatCurrency(getCaseFarmIncomePerTick(level, 2))} base per tick` : 'Locked',
    getNextBenefit: (level) =>
      `${formatCurrency(getCaseFarmIncomePerTick(level + 1, 2))} base per tick`,
  },
  [AutomationModuleId.TradingBot]: {
    id: AutomationModuleId.TradingBot,
    name: 'Trading Bot',
    description: 'Scans inventory and executes profitable trade-up contracts automatically.',
    baseCost: 12_000,
    costMultiplier: 2.65,
    maxLevel: 5,
    resourceLabel: 'compute',
    getCurrentBenefit: (level) =>
      level > 0
        ? `Runs above +${formatCurrency(getTradingBotMinimumProfit(level))} edge`
        : 'Locked',
    getNextBenefit: (level) =>
      `Runs above +${formatCurrency(getTradingBotMinimumProfit(level + 1))} edge`,
  },
  [AutomationModuleId.MarketAnalyst]: {
    id: AutomationModuleId.MarketAnalyst,
    name: 'Market Analyst',
    description: 'Improves sell quotes and prepares the market prediction layer.',
    baseCost: 4_000,
    costMultiplier: 2.25,
    maxLevel: 8,
    resourceLabel: 'signals',
    getCurrentBenefit: (level) =>
      level > 0 ? `+${Math.round(getMarketAnalystSellBonus(level) * 100)}% sell value` : 'Locked',
    getNextBenefit: (level) =>
      `+${Math.round(getMarketAnalystSellBonus(level + 1) * 100)}% sell value`,
  },
  [AutomationModuleId.WarehouseSystem]: {
    id: AutomationModuleId.WarehouseSystem,
    name: 'Warehouse System',
    description: 'Prepares inventory capacity expansion for future storage limits.',
    baseCost: 2_500,
    costMultiplier: 2.15,
    maxLevel: 8,
    resourceLabel: 'slots',
    getCurrentBenefit: (level) =>
      level > 0 ? `+${getWarehouseCapacityBonus(level)} future slots` : 'Locked',
    getNextBenefit: (level) => `+${getWarehouseCapacityBonus(level + 1)} future slots`,
  },
  [AutomationModuleId.AuctionHouse]: {
    id: AutomationModuleId.AuctionHouse,
    name: 'Auction House',
    description: 'Unlocks discounted case deal hooks and future exclusive skin offers.',
    baseCost: 9_000,
    costMultiplier: 2.45,
    maxLevel: 6,
    resourceLabel: 'deals',
    getCurrentBenefit: (level) =>
      level > 0 ? `${Math.round(getAuctionHouseDiscount(level) * 100)}% future deal discount` : 'Locked',
    getNextBenefit: (level) =>
      `${Math.round(getAuctionHouseDiscount(level + 1) * 100)}% future deal discount`,
  },
}

export function getAutoOpenerUpgradeCost(level: number) {
  if (level <= 0) {
    return AUTO_OPENER_BASE_COST
  }

  return AUTO_OPENER_UPGRADE_COST * 2 ** Math.max(0, level - 1)
}

export function getAutoOpenerIntervalMs(level: number) {
  return Math.max(
    AUTO_OPENER_MIN_INTERVAL_MS,
    AUTO_OPENER_BASE_INTERVAL_MS - Math.max(0, level - 1) * AUTO_OPENER_INTERVAL_STEP_MS,
  )
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`
}

function formatDuration(ms: number) {
  const seconds = Math.ceil(ms / 1_000)

  if (seconds < 60) {
    return `${seconds}s`
  }

  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2))
}

export function getAutomationModuleUpgradeCost(moduleId: AutomationModuleId, level: number) {
  const definition = AUTOMATION_MODULE_DEFINITIONS[moduleId]

  return roundCurrency(definition.baseCost * definition.costMultiplier ** Math.max(0, level))
}

export function getOpeningDeskIntervalMs(level: number) {
  return Math.max(
    OPENING_DESK_MIN_INTERVAL_MS,
    OPENING_DESK_BASE_INTERVAL_MS - Math.max(0, level - 1) * OPENING_DESK_INTERVAL_STEP_MS,
  )
}

export function getOpeningDeskBatchSize(level: number) {
  return Math.min(8, Math.max(0, level + 1))
}

export function getCaseFarmIncomePerTick(level: number, unlockedCaseCount: number) {
  if (level <= 0) {
    return 0
  }

  const catalogBonus = Math.max(1, unlockedCaseCount)

  return roundCurrency((0.5 + catalogBonus * 0.25) * level * (1 + (level - 1) * 0.12))
}

export function getTradingBotMinimumProfit(level: number) {
  if (level <= 0) {
    return Number.POSITIVE_INFINITY
  }

  return roundCurrency(Math.max(0.5, 5 - (level - 1) * 0.75))
}

export function getMarketAnalystSellBonus(level: number) {
  return Math.max(0, level) * 0.01
}

export function getAutomationSellMultiplier(automation: AutomationState) {
  const marketAnalyst = automation.modules[AutomationModuleId.MarketAnalyst]

  if (!marketAnalyst?.isEnabled || marketAnalyst.level <= 0) {
    return 1
  }

  return 1 + getMarketAnalystSellBonus(marketAnalyst.level)
}

export function getWarehouseCapacityBonus(level: number) {
  return Math.max(0, level) * 250
}

export function getAuctionHouseDiscount(level: number) {
  return Math.min(0.3, Math.max(0, level) * 0.03)
}

export function createDefaultAutomationModule(id: AutomationModuleId): AutomationModuleState {
  return {
    id,
    isEnabled: false,
    lastRunTime: 0,
    level: 0,
    totalGenerated: 0,
    totalRuns: 0,
  }
}

export function createDefaultAutomationModules(): AutomationModulesState {
  return AUTOMATION_MODULE_IDS.reduce((modules, moduleId) => {
    modules[moduleId] = createDefaultAutomationModule(moduleId)
    return modules
  }, {} as AutomationModulesState)
}

export const defaultAutomationState: AutomationState = {
  autoOpener: {
    caseId: 'starter_case',
    intervalMs: getAutoOpenerIntervalMs(1),
    isEnabled: false,
    lastOpenTime: 0,
    level: 0,
    totalOpened: 0,
  },
  modules: createDefaultAutomationModules(),
}

export function getAutoOpenerProgress(autoOpener: AutoOpenerState, now = Date.now()) {
  if (!autoOpener.isEnabled || autoOpener.level <= 0 || autoOpener.intervalMs <= 0) {
    return 0
  }

  return Math.min(1, Math.max(0, (now - autoOpener.lastOpenTime) / autoOpener.intervalMs))
}

export function getAutoOpenerTimeRemainingMs(autoOpener: AutoOpenerState, now = Date.now()) {
  if (!autoOpener.isEnabled || autoOpener.level <= 0) {
    return autoOpener.intervalMs
  }

  return Math.max(0, autoOpener.intervalMs - (now - autoOpener.lastOpenTime))
}
