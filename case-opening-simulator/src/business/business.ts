import { AutomationModuleId, Rarity, UpgradeId, WearCondition, type AutomationState, type SkinInstance, type UpgradeLevels } from '../data/models'
import { getCareerLevelFromXp, type CareerState } from '../career/careerProgress'
import { isExceptionalPattern, isSpecialPattern } from '../utils/skinPatterns'

export const BUSINESS_SCHEMA_VERSION = 1 as const
export const BUSINESS_OFFLINE_CAP_MS = 24 * 60 * 60_000
export const BUSINESS_RECENT_OPERATION_LIMIT = 80
export const BUSINESS_PROCESSED_ID_LIMIT = 800
export const BUSINESS_ALERT_LIMIT = 80
export const BUSINESS_WATCHLIST_LIMIT = 12
export const BUSINESS_MAX_TRAINING_LEVEL = 8
export const BUSINESS_TRANSITION_CREDIT_CAP = 75_000

export const EMPLOYEE_ROLE_IDS = [
  'caseOperator',
  'salesAssistant',
  'marketScout',
  'tradeUpSpecialist',
  'juniorTrader',
] as const

export type EmployeeRoleId = typeof EMPLOYEE_ROLE_IDS[number]
export type EmployeeStatus = 'locked' | 'available' | 'paused' | 'running' | 'awaiting-approval'
export type BusinessOperationType = 'case-opened' | 'instant-sale' | 'market-listing' | 'listing-repriced' | 'scout-match' | 'trade-up' | 'trade-up-review' | 'market-purchase' | 'payroll' | 'hire' | 'training'

export interface CaseOperatorSettings {
  caseId: string
  intervalMs: number
  batchSize: number
  maximumCasesPerShift: number
  minimumWalletReserve: number
  stopLoss: number
  inventoryCapacityReserve: number
  allowAutoSell: boolean
}

export interface SalesAssistantSettings {
  intervalMs: number
  keepBestDuplicates: number
  allowedWeapons: string[]
  allowedRarities: Rarity[]
  maximumItemValue: number
  minimumSaleQuote: number
  minimumListingPrice: number
  minimumProfitMargin: number
  maximumListingDiscount: number
  maximumActiveListings: number
  repricingIntervalMs: number
  relistExpired: boolean
  mode: 'instant' | 'list' | 'mixed'
  confirmationThreshold: number
}

export interface MarketScoutSettings {
  intervalMs: number
  minimumValuationConfidence: number
}

export interface TradeUpSpecialistSettings {
  intervalMs: number
  maximumInputValue: number
  maximumDailyConsumedValue: number
  minimumExpectedProfit: number
  minimumExpectedRoi: number
  allowedCollections: string[]
  allowedRarities: Rarity[]
  maximumContractsPerShift: number
  confirmationThreshold: number
}

export interface JuniorTraderSettings {
  intervalMs: number
  maximumPurchasePrice: number
  maximumDailyTransactions: number
  minimumDiscount: number
  minimumValuationConfidence: number
  allowedWeapons: string[]
  allowedWear: WearCondition[]
  minimumFloat: number
  maximumFloat: number
  maximumExposurePerSkin: number
  maximumItemValue: number
  walletReserve: number
  stopLoss: number
  manualApprovalThreshold: number
}

export interface BusinessEmployeeSettingsMap {
  caseOperator: CaseOperatorSettings
  salesAssistant: SalesAssistantSettings
  marketScout: MarketScoutSettings
  tradeUpSpecialist: TradeUpSpecialistSettings
  juniorTrader: JuniorTraderSettings
}

export interface BusinessEmployeeState<Role extends EmployeeRoleId = EmployeeRoleId> {
  roleId: Role
  isHired: boolean
  isEnabled: boolean
  trainingLevel: number
  status: EmployeeStatus
  assignment: string
  allocatedCapital: number
  availableCapital: number
  reservedCapital: number
  spentCapital: number
  totalOperatingExpenses: number
  realizedBusinessIncome: number
  completedOperationCount: number
  nextActionAt: number
  lastActionAt: number
  payrollSettledThrough: number
  lastPauseReason?: string
  recentResult?: string
  settings: BusinessEmployeeSettingsMap[Role]
}

export type BusinessEmployeesState = {
  [Role in EmployeeRoleId]: BusinessEmployeeState<Role>
}

export interface ScoutWatchlist {
  id: string
  name: string
  enabled: boolean
  skinId?: string
  weapon?: string
  wear?: WearCondition
  minimumFloat?: number
  maximumFloat?: number
  patternId?: number
  patternClassification?: string
  maximumPrice?: number
  minimumDiscount: number
  minimumConfidence: number
  seller?: string
  maximumListingAgeMs?: number
  expiringWithinMs?: number
  statTrak?: boolean
  souvenir?: boolean
  lastScannedAt: number
  scanCursor: number
  scannedCandidates: number
}

export interface ScoutAlert {
  id: string
  watchlistId: string
  listingId: string
  skinId: string
  skinName: string
  image: string
  seller: string
  price: number
  wear: WearCondition
  float: number
  patternId?: number
  patternClassification?: string
  estimatedValue: number
  discount: number
  confidence: 'market' | 'listing' | 'simulator-estimate'
  expiresAt: number
  discoveredAt: number
  status: 'new' | 'reviewed' | 'dismissed' | 'unavailable'
}

export interface BusinessOperation {
  id: string
  employeeRole: EmployeeRoleId
  type: BusinessOperationType
  timestamp: number
  description: string
  grossVolume: number
  revenue: number
  expense: number
  realizedProfit: number
  relatedItemIds: string[]
  relatedMarketplaceId?: string
}

export interface BusinessDailyUsage {
  dayKey: string
  caseOperatorCases: number
  salesActions: number
  tradeUpInputValue: number
  tradeUpContracts: number
  juniorTraderPurchases: number
  juniorTraderSpend: number
}

export interface BusinessFinancials {
  revenue: number
  expenses: number
  payroll: number
  realizedProfit: number
  grossVolume: number
}

export interface PendingTradeUpApproval {
  id: string
  inputItemIds: string[]
  inputValue: number
  expectedOutputValue: number
  expectedProfit: number
  expectedRoi: number
  createdAt: number
  reason: string
}

export interface BusinessState {
  schemaVersion: typeof BUSINESS_SCHEMA_VERSION
  authoritative: boolean
  employees: BusinessEmployeesState
  operatingCapacity: number
  legacyOperatingCapacity: number
  transitionCredit: number
  transitionCreditGranted: number
  migrationApplied: boolean
  migratedAt: number
  lastSchedulerAt: number
  dailyUsage: BusinessDailyUsage
  watchlists: ScoutWatchlist[]
  alerts: ScoutAlert[]
  recentOperations: BusinessOperation[]
  processedOperationIds: string[]
  financials: BusinessFinancials
  pendingTradeUpApproval?: PendingTradeUpApproval
}

export interface EmployeeRoleDefinition {
  id: EmployeeRoleId
  name: string
  acquisitionTier: number
  unlockLevel: number
  roleFactor: number
  description: string
}

export const EMPLOYEE_ROLE_DEFINITIONS: Record<EmployeeRoleId, EmployeeRoleDefinition> = {
  caseOperator: { id: 'caseOperator', name: 'Case Operator', acquisitionTier: 1, unlockLevel: 15, roleFactor: 1, description: 'Opens paid cases within strict shift, cash and storage limits.' },
  salesAssistant: { id: 'salesAssistant', name: 'Sales Assistant', acquisitionTier: 2, unlockLevel: 15, roleFactor: 1.15, description: 'Handles ordinary duplicates and routine CSWEAR listings.' },
  marketScout: { id: 'marketScout', name: 'Market Scout', acquisitionTier: 3, unlockLevel: 35, roleFactor: 1.35, description: 'Finds genuine CSWEAR listings that match your watchlists.' },
  tradeUpSpecialist: { id: 'tradeUpSpecialist', name: 'Trade-Up Specialist', acquisitionTier: 4, unlockLevel: 35, roleFactor: 1.6, description: 'Executes ordinary contracts using honest opportunity-cost analysis.' },
  juniorTrader: { id: 'juniorTrader', name: 'Junior Trader', acquisitionTier: 5, unlockLevel: 55, roleFactor: 1.8, description: 'Buys small ordinary bargains within hard risk limits.' },
}

export function getEmployeeHireCost(roleId: EmployeeRoleId) {
  const tier = EMPLOYEE_ROLE_DEFINITIONS[roleId].acquisitionTier
  return Math.round(2_500 * 2.15 ** (tier - 1))
}

export function getEmployeeTrainingCost(roleId: EmployeeRoleId, currentLevel: number) {
  const level = Math.max(0, Math.min(BUSINESS_MAX_TRAINING_LEVEL, Math.floor(currentLevel)))
  return Math.round(1_200 * EMPLOYEE_ROLE_DEFINITIONS[roleId].roleFactor * 1.85 ** level)
}

export function getEmployeeHourlyWage(roleId: EmployeeRoleId, trainingLevel: number) {
  const level = Math.max(0, Math.min(BUSINESS_MAX_TRAINING_LEVEL, Math.floor(trainingLevel)))
  return Math.round(25 * EMPLOYEE_ROLE_DEFINITIONS[roleId].roleFactor * (1 + 0.32 * level) ** 1.35)
}

export function getEmployeeOperationInterval(roleId: EmployeeRoleId, trainingLevel: number) {
  const level = Math.max(0, Math.min(BUSINESS_MAX_TRAINING_LEVEL, trainingLevel))
  const base: Record<EmployeeRoleId, number> = {
    caseOperator: 30_000,
    salesAssistant: 60_000,
    marketScout: 5 * 60_000,
    tradeUpSpecialist: 2 * 60_000,
    juniorTrader: 3 * 60_000,
  }
  return Math.max(10_000, Math.round(base[roleId] * (1 - Math.min(0.6, level * 0.075))))
}

export function getCaseOperatorMaximumBatch(trainingLevel: number) {
  return Math.min(5, 1 + Math.floor(Math.max(0, trainingLevel) / 2))
}

export function getScoutWatchlistLimit(trainingLevel: number) {
  return Math.min(BUSINESS_WATCHLIST_LIMIT, 1 + Math.max(0, trainingLevel))
}

export function getScoutCandidateLimit(trainingLevel: number) {
  return Math.min(160, 20 + Math.max(0, trainingLevel) * 15)
}

export function getOperatingCapacity(business: Pick<BusinessState, 'operatingCapacity' | 'legacyOperatingCapacity'>) {
  return Math.max(1, business.operatingCapacity + business.legacyOperatingCapacity)
}

export function getActiveEmployeeCount(business: BusinessState) {
  return EMPLOYEE_ROLE_IDS.filter((roleId) => business.employees[roleId].isHired && business.employees[roleId].isEnabled).length
}

export function isEmployeeUnlocked(roleId: EmployeeRoleId, career: CareerState) {
  return getCareerLevelFromXp(career.currentRunXp) >= EMPLOYEE_ROLE_DEFINITIONS[roleId].unlockLevel
}

function defaultSettings(): BusinessEmployeeSettingsMap {
  return {
    caseOperator: { caseId: 'starter_case', intervalMs: 30_000, batchSize: 1, maximumCasesPerShift: 20, minimumWalletReserve: 25, stopLoss: 250, inventoryCapacityReserve: 5, allowAutoSell: true },
    salesAssistant: { intervalMs: 60_000, keepBestDuplicates: 1, allowedWeapons: [], allowedRarities: [Rarity.Consumer, Rarity.Industrial, Rarity.MilSpec, Rarity.Restricted], maximumItemValue: 250, minimumSaleQuote: 0.01, minimumListingPrice: 0.01, minimumProfitMargin: -0.25, maximumListingDiscount: 0.15, maximumActiveListings: 12, repricingIntervalMs: 6 * 60 * 60_000, relistExpired: false, mode: 'instant', confirmationThreshold: 500 },
    marketScout: { intervalMs: 5 * 60_000, minimumValuationConfidence: 0.5 },
    tradeUpSpecialist: { intervalMs: 2 * 60_000, maximumInputValue: 250, maximumDailyConsumedValue: 1_000, minimumExpectedProfit: 0.5, minimumExpectedRoi: 0.02, allowedCollections: [], allowedRarities: [Rarity.Consumer, Rarity.Industrial, Rarity.MilSpec, Rarity.Restricted, Rarity.Classified], maximumContractsPerShift: 5, confirmationThreshold: 500 },
    juniorTrader: { intervalMs: 3 * 60_000, maximumPurchasePrice: 100, maximumDailyTransactions: 5, minimumDiscount: 0.12, minimumValuationConfidence: 0.65, allowedWeapons: [], allowedWear: Object.values(WearCondition), minimumFloat: 0, maximumFloat: 1, maximumExposurePerSkin: 2, maximumItemValue: 250, walletReserve: 50, stopLoss: 250, manualApprovalThreshold: 250 },
  }
}

function createEmployee<Role extends EmployeeRoleId>(roleId: Role): BusinessEmployeeState<Role> {
  const settings = defaultSettings()[roleId]
  return {
    roleId,
    isHired: false,
    isEnabled: false,
    trainingLevel: 0,
    status: 'locked',
    assignment: 'Unassigned',
    allocatedCapital: 0,
    availableCapital: 0,
    reservedCapital: 0,
    spentCapital: 0,
    totalOperatingExpenses: 0,
    realizedBusinessIncome: 0,
    completedOperationCount: 0,
    nextActionAt: 0,
    lastActionAt: 0,
    payrollSettledThrough: 0,
    settings,
  }
}

export function createDefaultBusinessState(now = 0): BusinessState {
  return {
    schemaVersion: BUSINESS_SCHEMA_VERSION,
    authoritative: true,
    employees: {
      caseOperator: createEmployee('caseOperator'),
      salesAssistant: createEmployee('salesAssistant'),
      marketScout: createEmployee('marketScout'),
      tradeUpSpecialist: createEmployee('tradeUpSpecialist'),
      juniorTrader: createEmployee('juniorTrader'),
    },
    operatingCapacity: 2,
    legacyOperatingCapacity: 0,
    transitionCredit: 0,
    transitionCreditGranted: 0,
    migrationApplied: false,
    migratedAt: now,
    lastSchedulerAt: now,
    dailyUsage: createDailyUsage(now),
    watchlists: [],
    alerts: [],
    recentOperations: [],
    processedOperationIds: [],
    financials: { revenue: 0, expenses: 0, payroll: 0, realizedProfit: 0, grossVolume: 0 },
  }
}

export function createDailyUsage(now: number): BusinessDailyUsage {
  return { dayKey: new Date(now).toISOString().slice(0, 10), caseOperatorCases: 0, salesActions: 0, tradeUpInputValue: 0, tradeUpContracts: 0, juniorTraderPurchases: 0, juniorTraderSpend: 0 }
}

export function refreshBusinessDay(business: BusinessState, now: number) {
  const dayKey = new Date(now).toISOString().slice(0, 10)
  return business.dailyUsage.dayKey === dayKey ? business : { ...business, dailyUsage: createDailyUsage(now) }
}

function legacyModuleLevel(automation: AutomationState, id: AutomationModuleId) {
  return Math.max(0, Math.floor(automation.modules[id]?.level ?? 0))
}

export function reconstructLegacyAutomationInvestment(automation: AutomationState, upgrades: UpgradeLevels) {
  let total = 0
  if (automation.autoOpener.level > 0) {
    total += 350
    for (let level = 1; level < automation.autoOpener.level; level += 1) total += 2_500 * 2 ** (level - 1)
  }
  const moduleBase: Record<AutomationModuleId, [number, number]> = {
    [AutomationModuleId.OpeningDesk]: [6_500, 2.35],
    [AutomationModuleId.CaseFarm]: [1_500, 2.05],
    [AutomationModuleId.TradingBot]: [12_000, 2.65],
    [AutomationModuleId.MarketAnalyst]: [4_000, 2.25],
    [AutomationModuleId.WarehouseSystem]: [2_500, 2.15],
    [AutomationModuleId.AuctionHouse]: [9_000, 2.45],
  }
  for (const roleId of Object.values(AutomationModuleId)) {
    const [base, multiplier] = moduleBase[roleId]
    for (let level = 0; level < legacyModuleLevel(automation, roleId); level += 1) total += base * multiplier ** level
  }
  total += Math.max(0, upgrades[UpgradeId.ModuleBay] ?? 0) * 5_000
  return Math.round(total)
}

export function migrateLegacyAutomationToBusiness(automation: AutomationState, upgrades: UpgradeLevels, now: number): BusinessState {
  const business = createDefaultBusinessState(now)
  const autoLevel = Math.max(automation.autoOpener.level, legacyModuleLevel(automation, AutomationModuleId.OpeningDesk))
  const tradingLevel = legacyModuleLevel(automation, AutomationModuleId.TradingBot)
  const analystLevel = legacyModuleLevel(automation, AutomationModuleId.MarketAnalyst)
  const reconstructed = reconstructLegacyAutomationInvestment(automation, upgrades)
  const credit = Math.min(BUSINESS_TRANSITION_CREDIT_CAP, Math.round(reconstructed * 0.35))

  if (autoLevel > 0) {
    business.employees.caseOperator = { ...business.employees.caseOperator, isHired: true, status: 'paused', trainingLevel: Math.min(BUSINESS_MAX_TRAINING_LEVEL, Math.max(1, autoLevel - 1)), assignment: `Open ${automation.autoOpener.caseId ?? 'starter_case'}`, settings: { ...business.employees.caseOperator.settings, caseId: automation.autoOpener.caseId ?? 'starter_case', batchSize: Math.min(getCaseOperatorMaximumBatch(autoLevel), Math.max(1, legacyModuleLevel(automation, AutomationModuleId.OpeningDesk) + 1)) } }
  }
  if (tradingLevel > 0) business.employees.tradeUpSpecialist = { ...business.employees.tradeUpSpecialist, isHired: true, status: 'paused', trainingLevel: Math.min(BUSINESS_MAX_TRAINING_LEVEL, tradingLevel), assignment: 'Review ordinary contracts' }
  if (analystLevel > 0) {
    business.employees.marketScout = { ...business.employees.marketScout, isHired: true, status: 'paused', trainingLevel: Math.min(BUSINESS_MAX_TRAINING_LEVEL, analystLevel), assignment: 'Scan watchlists' }
    business.employees.salesAssistant = { ...business.employees.salesAssistant, isHired: true, status: 'paused', trainingLevel: Math.min(BUSINESS_MAX_TRAINING_LEVEL, Math.ceil(analystLevel / 2)), assignment: 'Manage ordinary inventory' }
  }
  business.legacyOperatingCapacity = Math.min(3, Math.max(0, Math.floor(upgrades[UpgradeId.ModuleBay] ?? 0)))
  business.transitionCredit = credit
  business.transitionCreditGranted = credit
  business.migrationApplied = true
  return business
}

export function retireLegacyAutomation(automation: AutomationState): AutomationState {
  return {
    ...automation,
    autoOpener: { ...automation.autoOpener, isEnabled: false },
    modules: Object.fromEntries(Object.entries(automation.modules).map(([id, module]) => [id, {
      ...module,
      isEnabled: id === AutomationModuleId.WarehouseSystem || id === AutomationModuleId.AuctionHouse ? module.isEnabled : false,
    }])) as AutomationState['modules'],
  }
}

export function isBusinessProtectedItem(item: SkinInstance, trophyItemIds: Set<string> = new Set()) {
  return item.isLocked || item.isFavorited || trophyItemIds.has(item.instanceId) || isExceptionalPattern(item) || isSpecialPattern(item)
}

export function rememberBusinessOperation(business: BusinessState, operation: BusinessOperation): BusinessState {
  if (business.processedOperationIds.includes(operation.id)) return business
  return {
    ...business,
    processedOperationIds: [...business.processedOperationIds, operation.id].slice(-BUSINESS_PROCESSED_ID_LIMIT),
    recentOperations: [operation, ...business.recentOperations].slice(0, BUSINESS_RECENT_OPERATION_LIMIT),
    financials: {
      revenue: Number((business.financials.revenue + operation.revenue).toFixed(2)),
      expenses: Number((business.financials.expenses + operation.expense).toFixed(2)),
      payroll: Number((business.financials.payroll + (operation.type === 'payroll' ? operation.expense : 0)).toFixed(2)),
      realizedProfit: Number((business.financials.realizedProfit + operation.realizedProfit).toFixed(2)),
      grossVolume: Number((business.financials.grossVolume + operation.grossVolume).toFixed(2)),
    },
  }
}

export function getBusinessReservedFunds(business: BusinessState) {
  return Number(EMPLOYEE_ROLE_IDS.reduce((sum, roleId) => sum + business.employees[roleId].availableCapital + business.employees[roleId].reservedCapital, 0).toFixed(2))
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function finite(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

export function normalizeBusinessState(value: unknown, now = Date.now()): BusinessState {
  const source = record(value)
  const fallback = createDefaultBusinessState(now)
  const sourceEmployees = record(source.employees)
  const employees = Object.fromEntries(EMPLOYEE_ROLE_IDS.map((roleId) => {
    const base = fallback.employees[roleId]
    const raw = record(sourceEmployees[roleId])
    const rawSettings = record(raw.settings)
    return [roleId, {
      ...base,
      roleId,
      isHired: typeof raw.isHired === 'boolean' ? raw.isHired : base.isHired,
      isEnabled: typeof raw.isEnabled === 'boolean' ? raw.isEnabled : false,
      trainingLevel: Math.max(0, Math.min(BUSINESS_MAX_TRAINING_LEVEL, Math.floor(finite(raw.trainingLevel)))),
      status: ['locked', 'available', 'paused', 'running', 'awaiting-approval'].includes(String(raw.status)) ? raw.status : base.status,
      assignment: typeof raw.assignment === 'string' ? raw.assignment : base.assignment,
      allocatedCapital: Math.max(0, finite(raw.allocatedCapital)),
      availableCapital: Math.max(0, finite(raw.availableCapital)),
      reservedCapital: Math.max(0, finite(raw.reservedCapital)),
      spentCapital: Math.max(0, finite(raw.spentCapital)),
      totalOperatingExpenses: Math.max(0, finite(raw.totalOperatingExpenses)),
      realizedBusinessIncome: Math.max(0, finite(raw.realizedBusinessIncome)),
      completedOperationCount: Math.max(0, Math.floor(finite(raw.completedOperationCount))),
      nextActionAt: Math.max(0, finite(raw.nextActionAt)),
      lastActionAt: Math.max(0, finite(raw.lastActionAt)),
      payrollSettledThrough: Math.max(0, finite(raw.payrollSettledThrough)),
      lastPauseReason: typeof raw.lastPauseReason === 'string' ? raw.lastPauseReason : undefined,
      recentResult: typeof raw.recentResult === 'string' ? raw.recentResult : undefined,
      settings: { ...base.settings, ...rawSettings },
    }]
  })) as BusinessEmployeesState
  const rawUsage = record(source.dailyUsage)
  const rawFinancials = record(source.financials)
  const rawWatchlists = Array.isArray(source.watchlists) ? source.watchlists : []
  const rawAlerts = Array.isArray(source.alerts) ? source.alerts : []
  const rawOperations = Array.isArray(source.recentOperations) ? source.recentOperations : []
  return {
    ...fallback,
    authoritative: source.authoritative !== false,
    employees,
    operatingCapacity: Math.max(1, Math.min(5, Math.floor(finite(source.operatingCapacity, 2)))),
    legacyOperatingCapacity: Math.max(0, Math.min(3, Math.floor(finite(source.legacyOperatingCapacity)))),
    transitionCredit: Math.max(0, Math.min(BUSINESS_TRANSITION_CREDIT_CAP, finite(source.transitionCredit))),
    transitionCreditGranted: Math.max(0, Math.min(BUSINESS_TRANSITION_CREDIT_CAP, finite(source.transitionCreditGranted))),
    migrationApplied: source.migrationApplied === true,
    migratedAt: Math.max(0, finite(source.migratedAt, now)),
    lastSchedulerAt: Math.max(0, finite(source.lastSchedulerAt, now)),
    dailyUsage: {
      dayKey: typeof rawUsage.dayKey === 'string' ? rawUsage.dayKey : new Date(now).toISOString().slice(0, 10),
      caseOperatorCases: Math.max(0, Math.floor(finite(rawUsage.caseOperatorCases))),
      salesActions: Math.max(0, Math.floor(finite(rawUsage.salesActions))),
      tradeUpInputValue: Math.max(0, finite(rawUsage.tradeUpInputValue)),
      tradeUpContracts: Math.max(0, Math.floor(finite(rawUsage.tradeUpContracts))),
      juniorTraderPurchases: Math.max(0, Math.floor(finite(rawUsage.juniorTraderPurchases))),
      juniorTraderSpend: Math.max(0, finite(rawUsage.juniorTraderSpend)),
    },
    watchlists: rawWatchlists.filter((entry) => typeof entry === 'object' && entry !== null).slice(0, BUSINESS_WATCHLIST_LIMIT) as ScoutWatchlist[],
    alerts: rawAlerts.filter((entry) => typeof entry === 'object' && entry !== null).slice(0, BUSINESS_ALERT_LIMIT) as ScoutAlert[],
    recentOperations: rawOperations.filter((entry) => typeof entry === 'object' && entry !== null).slice(0, BUSINESS_RECENT_OPERATION_LIMIT) as BusinessOperation[],
    processedOperationIds: strings(source.processedOperationIds).slice(-BUSINESS_PROCESSED_ID_LIMIT),
    financials: {
      revenue: Math.max(0, finite(rawFinancials.revenue)),
      expenses: Math.max(0, finite(rawFinancials.expenses)),
      payroll: Math.max(0, finite(rawFinancials.payroll)),
      realizedProfit: finite(rawFinancials.realizedProfit),
      grossVolume: Math.max(0, finite(rawFinancials.grossVolume)),
    },
    pendingTradeUpApproval: typeof source.pendingTradeUpApproval === 'object' && source.pendingTradeUpApproval !== null ? source.pendingTradeUpApproval as PendingTradeUpApproval : undefined,
  }
}
