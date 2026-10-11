import type { ActiveGameEvent, GameEventLog } from '../events/eventManager'
import type { WorkMiniGameCooldowns } from '../utils/workMinigames'

export enum Rarity {
  Consumer = 'Consumer',
  Industrial = 'Industrial',
  MilSpec = 'MilSpec',
  Restricted = 'Restricted',
  Classified = 'Classified',
  Covert = 'Covert',
  SpecialItem = 'SpecialItem',
  Contraband = 'Contraband',
}

export enum WearCondition {
  FactoryNew = 'FactoryNew',
  MinimalWear = 'MinimalWear',
  FieldTested = 'FieldTested',
  WellWorn = 'WellWorn',
  BattleScarred = 'BattleScarred',
}

export enum CaseStatus {
  Locked = 'Locked',
  Unlocked = 'Unlocked',
  Retired = 'Retired',
}

export enum UpgradeCategory {
  Opening = 'Opening Upgrades',
  Clicker = 'Clicker Upgrades',
  Market = 'Market Upgrades',
  Automation = 'Automation Upgrades',
  Capacity = 'Capacity Upgrades',
  Luck = 'Luck Upgrades',
}

export enum UpgradeId {
  OpeningMotor = 'opening_motor',
  BulkLoader = 'bulk_loader',
  CaseContract = 'case_contract',
  WearTuning = 'wear_tuning',
  ClickIncome = 'click_income',
  MarketSignal = 'market_signal',
  TrendScanner = 'trend_scanner',
  AutomationServos = 'automation_servos',
  ModuleBay = 'module_bay',
  WarehouseRows = 'warehouse_rows',
  RarityLuck = 'rarity_luck',
}

export enum PrestigeBonusId {
  SellValue = 'sell_value',
  CaseDiscount = 'case_discount',
  DropLuck = 'drop_luck',
  AutomationSpeed = 'automation_speed',
  StartingMoney = 'starting_money',
  InventoryCapacity = 'inventory_capacity',
  MarketKnowledge = 'market_knowledge',
}

export enum SkillNodeId {
  SellSpecialist = 'sell_specialist',
  WearWhisperer = 'wear_whisperer',
  BulkAutomation = 'bulk_automation',
  TradeUpEdge = 'trade_up_edge',
  MarketOracle = 'market_oracle',
  GoldenTouch = 'golden_touch',
  OfflineOperator = 'offline_operator',
  EventHunter = 'event_hunter',
  PrestigeScholar = 'prestige_scholar',
}

export enum TrophySlotId {
  BestKnife = 'best_knife',
  BestGloves = 'best_gloves',
  MostExpensiveSkin = 'most_expensive_skin',
  RarestSkin = 'rarest_skin',
  BestFloat = 'best_float',
  BiggestProfitPull = 'biggest_profit_pull',
  FavouriteCollection = 'favourite_collection',
}

export enum DailyRewardKind {
  Money = 'money',
  CaseDiscountBuff = 'case_discount_buff',
  RandomSkin = 'random_skin',
  RareCase = 'rare_case',
}

export enum DailyChallengeType {
  OpenCases = 'open_cases',
  SellValue = 'sell_value',
  ObtainRarity = 'obtain_rarity',
  CompleteTradeUps = 'complete_trade_ups',
}

export interface DailyRewardDefinition {
  day: number
  kind: DailyRewardKind
  label: string
  money?: number
  caseDiscountPercent?: number
  durationMs?: number
  skinRarity?: Rarity
  caseId?: string
}

export interface DailyRewardClaim {
  claimedAt: number
  day: number
  dayKey: string
  label: string
}

export interface DailyCaseDiscountBuff {
  percent: number
  expiresAt: number
}

export interface DailyChallengeReward {
  money?: number
  caseDiscountPercent?: number
  durationMs?: number
}

export interface DailyChallenge {
  id: string
  type: DailyChallengeType
  title: string
  description: string
  target: number
  progress: number
  reward: DailyChallengeReward
  isClaimed: boolean
  rarity?: Rarity
  generatedAt: number
}

export interface DailyRewardsState {
  streak: number
  lastClaimTime: number
  lastClaimDayKey?: string
  lastChallengeResetDayKey: string
  freeRerollDayKey?: string
  freeRerollsUsed: number
  caseDiscountBuff?: DailyCaseDiscountBuff
  lastReward?: DailyRewardClaim
  challenges: DailyChallenge[]
}

export enum AutoSellRuleType {
  MinValue = 'minValue',
  MaxRarity = 'maxRarity',
  SellDuplicates = 'sellDuplicates',
  MaxWear = 'maxWear',
  SellBelowValuePerRarity = 'sellBelowValuePerRarity',
  SellWearBelow = 'sellWearBelow',
  SellNonFavoritedBelow = 'sellNonFavoritedBelow',
  SellDuplicatesKeepOne = 'sellDuplicatesKeepOne',
  SellNonKnifeUnderValue = 'sellNonKnifeUnderValue',
  KeepFactoryNew = 'keepFactoryNew',
  ExcludedIds = 'excludedIds',
}

export interface SkinBase {
  id: string
  weapon: string
  finish: string
  rarity: Rarity
  baseValue: number
  caseIds: string[]
  image: string
  statTrak?: boolean
  souvenir?: boolean
}

export interface SkinInstance extends SkinBase {
  instanceId: string
  wear: WearCondition
  floatValue: number
  marketValue: number
  isLocked: boolean
  isFavorited: boolean
  discoveredAt: number
}

export interface TrophyAssignment {
  slotId: string
  itemId: string
  assignedAt: number
}

export type TrophyAssignments = Record<string, TrophyAssignment | undefined>

export interface CaseDefinition {
  id: string
  name: string
  cost: number
  csFloatPrice?: number
  caseLicenseCost?: number
  status: CaseStatus
  dropTable: {
    skinId: string
    weight: number
  }[]
  image: string
  releaseDate?: number
  unlockRequirement?: {
    casesOpened: number
    prestigeLevel?: number
  }
  retirement?: {
    date: number
  }
}

export interface AutoSellRule {
  id: string
  type: AutoSellRuleType
  enabled: boolean
  valueThreshold?: number
  valueThresholdsByRarity?: Partial<Record<Rarity, number>>
  rarityThreshold?: Rarity
  wearThreshold?: WearCondition
  sellDuplicates?: boolean
  excludedIds?: string[]
}

export interface CollectionEntry {
  skinId: string
  foundWearConditions: WearCondition[]
  bestFloat?: number
  highestValue?: number
  timesFound: number
  firstFoundAt: number
}

export type CollectionRewardType =
  | 'WeaponSellBonus'
  | 'CaseDiscount'
  | 'RarityLuck'
  | 'FullGamePrestigeBonus'

export interface CollectionRewardProgress {
  id: string
  type: CollectionRewardType
  targetId: string
  bonus: number
  unlockedAt: number
  carriesOver?: boolean
}

export type UpgradeLevels = Partial<Record<UpgradeId, number>>
export type PrestigeBonusLevels = Partial<Record<PrestigeBonusId, number>>

export type AchievementCategory =
  | 'Opening'
  | 'Drops'
  | 'Inventory'
  | 'Trade Ups'
  | 'Progression'
  | 'Collection'
  | 'Automation'
  | 'Trophy Room'

export interface AchievementReward {
  money?: number
  upgradePoints?: number
  skillPoints?: number
  badge?: string
}

export interface AchievementProgress {
  id: string
  isClaimed: boolean
  unlockedAt: number
}

export interface AutoOpenerState {
  caseId?: string
  intervalMs: number
  isEnabled: boolean
  lastOpenTime: number
  level: number
  totalOpened: number
}

export enum AutomationModuleId {
  OpeningDesk = 'openingDesk',
  CaseFarm = 'caseFarm',
  TradingBot = 'tradingBot',
  MarketAnalyst = 'marketAnalyst',
  WarehouseSystem = 'warehouseSystem',
  AuctionHouse = 'auctionHouse',
}

export interface AutomationModuleState {
  id: AutomationModuleId
  isEnabled: boolean
  lastRunTime: number
  level: number
  totalGenerated: number
  totalRuns: number
}

export type AutomationModulesState = Record<AutomationModuleId, AutomationModuleState>

export interface AuctionHouseDeal {
  id: string
  item: SkinInstance
  listPrice: number
  price: number
  discount: number
  createdAt: number
  expiresAt: number
}

export interface AuctionHouseState {
  deals: AuctionHouseDeal[]
  lastRefreshTime: number
  nextRefreshTime: number
}

export interface AutomationState {
  autoOpener: AutoOpenerState
  auctionHouse: AuctionHouseState
  modules: AutomationModulesState
}

export interface PlayerState {
  money: number
  inventory: SkinInstance[]
  inventoryValue: number
  inventoryValueHistory: {
    timestamp: number
    value: number
  }[]
  unlockedCases: string[]
  autoSellRules: AutoSellRule[]
  automation: AutomationState
  upgrades: UpgradeLevels
  trophyAssignments: TrophyAssignments
  dailyRewards: DailyRewardsState
  collectionBook: CollectionEntry[]
  collectionRewards: CollectionRewardProgress[]
  hasUsedFirstCaseHook: boolean
  lastPoopCleaningAt: number
  workMiniGameCooldowns: WorkMiniGameCooldowns
  prestigeLevel: number
  prestigePoints: number
  prestigeBonuses: PrestigeBonusLevels
  upgradePoints: number
  skillPoints: number
  learnedSkillNodeIds: SkillNodeId[]
  achievements: AchievementProgress[]
  marketValues: {
    [skinId: string]: number
  }
  marketHistory: {
    [skinId: string]: {
      timestamp: number
      value: number
    }[]
  }
  activeEvents: ActiveGameEvent[]
  upcomingEvents: ActiveGameEvent[]
  eventHistory: GameEventLog[]
  statistics: {
    auctionPurchases: number
    auctionSavings: number
    casesOpened: number
    moneySpent: number
    moneyEarned: number
    itemsSold: number
    tradeUpsCompleted: number
    drops: number
    rareDrops: number
    dropsByRarity: Record<Rarity, number>
  }
  lastBackupAt: number
  lastSaved: number
}

export interface Achievement {
  id: string
  name: string
  description: string
  category: AchievementCategory
  condition: (state: PlayerState) => boolean
  isHidden?: boolean
  reward?: AchievementReward
  unlockedAt?: number
}

const wearValueMultipliers: Record<WearCondition, number> = {
  [WearCondition.FactoryNew]: 1,
  [WearCondition.MinimalWear]: 0.9,
  [WearCondition.FieldTested]: 0.75,
  [WearCondition.WellWorn]: 0.6,
  [WearCondition.BattleScarred]: 0.4,
}

const rarityWeightMultipliers: Record<Rarity, number> = {
  [Rarity.Consumer]: 1,
  [Rarity.Industrial]: 1.4,
  [Rarity.MilSpec]: 2,
  [Rarity.Restricted]: 3.5,
  [Rarity.Classified]: 6,
  [Rarity.SpecialItem]: 8,
  [Rarity.Contraband]: 9,
  [Rarity.Covert]: 10,
}

export function getWearValueMultiplier(wear: WearCondition) {
  return wearValueMultipliers[wear]
}

export function getRarityWeightMultiplier(rarity: Rarity) {
  return rarityWeightMultipliers[rarity]
}
