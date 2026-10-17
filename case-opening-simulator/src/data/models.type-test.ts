import {
  AutoSellRuleType,
  AutomationModuleId,
  CaseStatus,
  PrestigeBonusId,
  Rarity,
  SkillNodeId,
  TrophySlotId,
  UpgradeId,
  WearCondition,
  getRarityWeightMultiplier,
  getWearValueMultiplier,
  type AutoSellRule,
  type CaseDefinition,
  type CollectionEntry,
  type PlayerState,
  type SkinBase,
  type SkinInstance,
} from './models'
import { createDefaultDailyRewardsState } from '../rewards/dailyRewards'

export const exampleSkinBase: SkinBase = {
  id: 'ak-47-redline',
  weapon: 'AK-47',
  finish: 'Redline',
  rarity: Rarity.Classified,
  baseValue: 42.5,
  caseIds: ['phoenix-case'],
  image: '/assets/placeholder.png',
  statTrak: true,
}

export const exampleSkinInstance: SkinInstance = {
  ...exampleSkinBase,
  instanceId: 'drop-001',
  wear: WearCondition.FieldTested,
  floatValue: 0.2784,
  marketValue: 38.45,
  isLocked: false,
  isFavorited: true,
  discoveredAt: 1_782_147_600_000,
}

export const exampleCaseDefinition: CaseDefinition = {
  id: 'phoenix-case',
  name: 'Operation Phoenix Weapon Case',
  cost: 2.5,
  status: CaseStatus.Unlocked,
  dropTable: [
    { skinId: 'ak-47-redline', weight: 2 },
    { skinId: 'awp-asiimov', weight: 1 },
  ],
  image: '/cases/phoenix-case.png',
  unlockRequirement: {
    casesOpened: 10,
    prestigeLevel: 1,
  },
}

export const exampleAutoSellRule: AutoSellRule = {
  id: 'sell-low-value',
  type: AutoSellRuleType.MinValue,
  enabled: true,
  valueThreshold: 0.5,
  excludedIds: ['ak-47-redline'],
}

export const exampleCollectionEntry: CollectionEntry = {
  skinId: 'ak-47-redline',
  foundWearConditions: [WearCondition.FieldTested],
  bestFloat: 0.2784,
  highestValue: 38.45,
  timesFound: 1,
  firstFoundAt: 1_782_147_600_000,
}

export const examplePlayerState: PlayerState = {
  money: 2500,
  inventory: [exampleSkinInstance],
  inventoryValue: 38.45,
  inventoryValueHistory: [
    {
      timestamp: 1_782_147_600_000,
      value: 38.45,
    },
  ],
  unlockedCases: ['starter-case', 'phoenix-case'],
  autoSellRules: [exampleAutoSellRule],
  automation: {
    autoOpener: {
      caseId: 'starter-case',
      intervalMs: 30_000,
      isEnabled: true,
      lastOpenTime: 1_782_147_600_000,
      level: 1,
      totalOpened: 3,
    },
    auctionHouse: {
      deals: [],
      lastRefreshTime: 0,
      nextRefreshTime: 0,
    },
    modules: {
      [AutomationModuleId.OpeningDesk]: {
        id: AutomationModuleId.OpeningDesk,
        isEnabled: true,
        lastRunTime: 1_782_147_600_000,
        level: 1,
        totalGenerated: 2,
        totalRuns: 1,
      },
      [AutomationModuleId.CaseFarm]: {
        id: AutomationModuleId.CaseFarm,
        isEnabled: false,
        lastRunTime: 0,
        level: 0,
        totalGenerated: 0,
        totalRuns: 0,
      },
      [AutomationModuleId.TradingBot]: {
        id: AutomationModuleId.TradingBot,
        isEnabled: false,
        lastRunTime: 0,
        level: 0,
        totalGenerated: 0,
        totalRuns: 0,
      },
      [AutomationModuleId.MarketAnalyst]: {
        id: AutomationModuleId.MarketAnalyst,
        isEnabled: false,
        lastRunTime: 0,
        level: 0,
        totalGenerated: 0,
        totalRuns: 0,
      },
      [AutomationModuleId.WarehouseSystem]: {
        id: AutomationModuleId.WarehouseSystem,
        isEnabled: false,
        lastRunTime: 0,
        level: 0,
        totalGenerated: 0,
        totalRuns: 0,
      },
      [AutomationModuleId.AuctionHouse]: {
        id: AutomationModuleId.AuctionHouse,
        isEnabled: false,
        lastRunTime: 0,
        level: 0,
        totalGenerated: 0,
        totalRuns: 0,
      },
    },
  },
  upgrades: {
    [UpgradeId.CaseContract]: 1,
  },
  dailyRewards: createDefaultDailyRewardsState(1_782_147_600_000),
  collectionBook: [exampleCollectionEntry],
  collectionRewards: [
    {
      id: 'weapon:ak_47',
      type: 'WeaponSellBonus',
      targetId: 'AK-47',
      bonus: 0.01,
      unlockedAt: 1_782_147_600_000,
    },
  ],
  hasUsedFirstCaseHook: true,
  lastPoopCleaningAt: 1_782_147_500_000,
  workMiniGameCooldowns: {
    poopCleaning: 1_782_147_500_000,
  },
  trophyAssignments: {
    [TrophySlotId.MostExpensiveSkin]: {
      slotId: TrophySlotId.MostExpensiveSkin,
      itemId: exampleSkinInstance.instanceId,
      assignedAt: 1_782_147_600_000,
    },
  },
  prestigeLevel: 1,
  prestigePoints: 3,
  prestigeBonuses: {
    [PrestigeBonusId.SellValue]: 1,
  },
  upgradePoints: 2,
  skillPoints: 1,
  learnedSkillNodeIds: [SkillNodeId.SellSpecialist],
  achievements: [
    {
      id: 'first_case_opened',
      isClaimed: true,
      unlockedAt: 1_782_147_600_000,
    },
  ],
  marketValues: {
    'ak-47-redline': 38.45,
  },
  marketHistory: {
    'ak-47-redline': [
      {
        timestamp: 1_782_147_600_000,
        value: 38.45,
      },
    ],
  },
  activeEvents: [],
  upcomingEvents: [],
  eventHistory: [],
  statistics: {
    auctionPurchases: 0,
    auctionSavings: 0,
    casesOpened: 12,
    moneySpent: 30,
    moneyEarned: 7.5,
    itemsSold: 1,
    tradeUpsCompleted: 0,
    drops: 12,
    rareDrops: 1,
    patternDrops: 0,
    exceptionalPatternDrops: 0,
    workJobsCompleted: 0,
    bestPrecisionScore: 0,
    bestMemoryScore: 0,
    dropsByRarity: {
      [Rarity.Consumer]: 0,
      [Rarity.Industrial]: 0,
      [Rarity.MilSpec]: 0,
      [Rarity.Restricted]: 0,
      [Rarity.Classified]: 1,
      [Rarity.Covert]: 0,
      [Rarity.SpecialItem]: 0,
      [Rarity.Contraband]: 0,
    },
  },
  lastBackupAt: 1_782_140_000_000,
  lastSaved: 1_782_147_600_000,
}

export const exampleWearMultiplier = getWearValueMultiplier(WearCondition.FactoryNew)
export const exampleRarityMultiplier = getRarityWeightMultiplier(Rarity.Covert)

// @ts-expect-error Missing required SkinBase fields must stay a type error.
export const invalidSkinBaseMissingFields: SkinBase = {
  id: 'incomplete-skin',
  weapon: 'M4A1-S',
}

// @ts-expect-error Missing SkinInstance drop-time fields must stay a type error.
export const invalidSkinInstanceMissingDropFields: SkinInstance = {
  ...exampleSkinBase,
  instanceId: 'drop-002',
  wear: WearCondition.MinimalWear,
}

// @ts-expect-error Missing PlayerState statistics and save metadata must stay a type error.
export const invalidPlayerStateMissingFields: PlayerState = {
  money: 100,
  inventory: [],
  unlockedCases: [],
  autoSellRules: [],
  collectionBook: [],
  collectionRewards: [],
  upgrades: {},
  prestigeLevel: 0,
  prestigePoints: 0,
  prestigeBonuses: {},
  upgradePoints: 0,
  skillPoints: 0,
  learnedSkillNodeIds: [],
  achievements: [],
  marketValues: {},
}
