import type { Prng } from './dropLogic'
import {
  AutomationModuleId,
  PrestigeBonusId,
  Rarity,
  SkillNodeId,
  UpgradeId,
  type AchievementProgress,
  type AutomationState,
  type AutoSellRule,
  type CollectionEntry,
  type CollectionRewardProgress,
  type DailyChallenge,
  type DailyRewardClaim,
  type DailyRewardsState,
  type PrestigeBonusLevels,
  type SkinInstance,
  type TrophyAssignments,
  type UpgradeLevels,
} from './models'
import {
  createInitialMarketHistory,
  createInitialMarketValues,
  createInitialMarketTrends,
  type ActiveMarketEvent,
  type MarketEventLog,
  type MarketPriceHistory,
  type MarketTrendArrow,
  type MarketTickResult,
} from '../market/marketSimulation'
import type {
  ActiveGameEvent,
  GameEventLog,
  GameEventType,
} from '../events/eventManager'
import {
  defaultInventoryViewUiState,
  type InventoryViewUiState,
} from '../utils/inventoryFilters'
import type { InventoryValuePoint } from '../utils/inventory'
import { defaultAutomationState } from '../utils/automation'
import { createDefaultUpgradeLevels } from './upgrades'
import { createDefaultPrestigeBonusLevels } from './prestige'
import { createDefaultLearnedSkillNodeIds } from './skills'
import { createDefaultTrophyAssignments } from '../utils/trophyRoom'
import { createDefaultDailyRewardsState } from '../rewards/dailyRewards'
import type { WorkMiniGameCooldowns, WorkMiniGameId } from '../utils/workMinigames'

export type RarityKey =
  | 'consumer'
  | 'industrial'
  | 'milSpec'
  | 'restricted'
  | 'classified'
  | 'covert'
  | 'special'
  | 'contraband'

export type ThemeMode = 'dark' | 'light'
export type AnimationSpeed = 'normal' | 'fast' | 'skip'
export type LanguageCode = 'en' | 'cs' | 'de' | 'es' | 'fr'
export type RarityColorScheme = Record<Rarity, string>

export const defaultRarityColors: RarityColorScheme = {
  [Rarity.Consumer]: '#9ca3af',
  [Rarity.Industrial]: '#5e98d9',
  [Rarity.MilSpec]: '#4b69ff',
  [Rarity.Restricted]: '#8847ff',
  [Rarity.Classified]: '#d32ce6',
  [Rarity.Covert]: '#eb4b4b',
  [Rarity.SpecialItem]: '#ffd700',
  [Rarity.Contraband]: '#e4ae39',
}

export interface GameSettings {
  animationSpeed: AnimationSpeed
  animationsEnabled: boolean
  autosaveEnabled: boolean
  autoSellNotificationsEnabled: boolean
  backupPromptEnabled: boolean
  debugMode: boolean
  highContrastMode: boolean
  language: LanguageCode
  largeText: boolean
  marketSimulationEnabled: boolean
  marketEventBannersEnabled: boolean
  musicEnabled: boolean
  rarityColors: RarityColorScheme
  recentDropFeedAnimationsEnabled: boolean
  simplifiedAnimations: boolean
  soundEnabled: boolean
  soundVolume: number
  theme: ThemeMode
}

export type InventoryItem = SkinInstance

export type DropRarityCounts = Record<Rarity, number>

export interface GameStatistics {
  auctionPurchases: number
  auctionSavings: number
  casesOpened: number
  moneySpent: number
  moneyEarned: number
  itemsSold: number
  tradeUpsCompleted: number
  drops: number
  rareDrops: number
  patternDrops: number
  exceptionalPatternDrops: number
  workJobsCompleted: number
  bestPrecisionScore: number
  bestMemoryScore: number
  dropsByRarity: DropRarityCounts
}

export type OnboardingStepId = 'open_case' | 'view_inventory' | 'sell_item' | 'enable_auto_sell'
export type OnboardingTipId = 'collection_book_after_drop' | 'trade_up_ready' | 'auto_sell_ready'

export interface OnboardingUiState {
  activeStepId?: OnboardingStepId
  completedStepIds: OnboardingStepId[]
  dismissedTipIds: OnboardingTipId[]
  isDismissed: boolean
  isReviewing: boolean
}

export const defaultOnboardingUiState: OnboardingUiState = {
  activeStepId: 'open_case',
  completedStepIds: [],
  dismissedTipIds: [],
  isDismissed: false,
  isReviewing: false,
}

export interface GameUiState {
  inventory: InventoryViewUiState
  onboarding: OnboardingUiState
}

export type GameUiEvent =
  | {
      id: string
      type: 'case_opening_started'
      caseId: string
      quantity: number
      firstCaseHook?: 'nearMissGold' | 'forcedGold'
      createdAt: number
    }
  | {
      id: string
      type: 'drop_revealed'
      caseId: string
      item: SkinInstance
      createdAt: number
    }
  | {
      id: string
      type: 'case_opening_failed'
      caseId: string
      message: string
      createdAt: number
    }
  | {
      id: string
      type: 'item_sold'
      item: SkinInstance
      salePrice: number
      createdAt: number
    }
  | {
      id: string
      type: 'items_sold'
      items: SkinInstance[]
      itemCount: number
      salePrice: number
      skippedLockedCount: number
      createdAt: number
    }
  | {
      id: string
      type: 'item_sale_failed'
      itemId: string
      message: string
      createdAt: number
    }
  | {
      id: string
      type: 'item_lock_toggled'
      item: SkinInstance
      isLocked: boolean
      createdAt: number
    }
  | {
      id: string
      type: 'item_favorite_toggled'
      item: SkinInstance
      isFavorited: boolean
      createdAt: number
    }
  | {
      id: string
      type: 'items_auto_sold'
      items: SkinInstance[]
      itemCount: number
      salePrice: number
      createdAt: number
    }
  | {
      id: string
      type: 'trade_up_completed'
      inputItems: SkinInstance[]
      item: SkinInstance
      createdAt: number
    }
  | {
      id: string
      type: 'trade_up_failed'
      message: string
      createdAt: number
    }
  | {
      id: string
      type: 'achievement_unlocked'
      achievementId: string
      name: string
      reward?: {
        money?: number
        upgradePoints?: number
        skillPoints?: number
        badge?: string
      }
      createdAt: number
    }
  | {
      id: string
      type: 'collection_reward_unlocked'
      reward: CollectionRewardProgress
      title: string
      effectLabel: string
      createdAt: number
    }
  | {
      id: string
      type: 'game_event_started'
      eventId: string
      name: string
      description: string
      createdAt: number
    }
  | {
      id: string
      type: 'game_event_ended'
      eventId: string
      name: string
      createdAt: number
    }
  | {
      id: string
      type: 'daily_reward_claimed'
      reward: DailyRewardClaim
      createdAt: number
    }
  | {
      id: string
      type: 'daily_challenge_claimed'
      challenge: DailyChallenge
      createdAt: number
    }
  | {
      id: string
      type: 'daily_challenge_rerolled'
      challenge: DailyChallenge
      createdAt: number
    }
  | {
      id: string
      type: 'minigame_completed'
      name: string
      reward: number
      createdAt: number
    }
  | {
      id: string
      type: 'prestige_completed'
      awardedPoints: number
      prestigeLevel: number
      createdAt: number
    }

export interface GameState {
  money: number
  inventory: InventoryItem[]
  inventoryValue: number
  inventoryValueHistory: InventoryValuePoint[]
  casesUnlocked: string[]
  favoriteCaseIds: string[]
  specialEventCaseIds: string[]
  autoSellRules: AutoSellRule[]
  automation: AutomationState
  upgrades: UpgradeLevels
  trophyAssignments: TrophyAssignments
  dailyRewards: DailyRewardsState
  collectionBook: CollectionEntry[]
  collectionRewards: CollectionRewardProgress[]
  recentDrops: SkinInstance[]
  lastOpenedItems: SkinInstance[]
  hasUsedFirstCaseHook: boolean
  lastPoopCleaningAt: number
  workMiniGameCooldowns: WorkMiniGameCooldowns
  uiEvents: GameUiEvent[]
  lastError?: string
  prestigeLevel: number
  prestigePoints: number
  prestigeBonuses: PrestigeBonusLevels
  upgradePoints: number
  skillPoints: number
  learnedSkillNodeIds: SkillNodeId[]
  achievements: AchievementProgress[]
  marketValues: Record<string, number>
  marketHistory: MarketPriceHistory
  marketTrends: Record<string, MarketTrendArrow>
  activeEvents: ActiveGameEvent[]
  upcomingEvents: ActiveGameEvent[]
  eventHistory: GameEventLog[]
  activeMarketEvents: ActiveMarketEvent[]
  upcomingMarketEvents: ActiveMarketEvent[]
  marketEventHistory: MarketEventLog[]
  lastMarketTick: number
  lastEventTick: number
  statistics: GameStatistics
  settings: GameSettings
  ui: GameUiState
  lastBackupAt: number
  lastSaved: number
}

export type GameAction =
  | { type: 'ADD_MONEY'; amount: number }
  | { type: 'COMPLETE_POOP_CLEANING'; now?: number }
  | { type: 'COMPLETE_POOP_CLEANUP_MINIGAME'; reward?: number; now?: number }
  | { type: 'COMPLETE_WORK_MINIGAME'; gameId: WorkMiniGameId; now?: number; performance?: number }
  | { type: 'SPEND_MONEY'; amount: number }
  | { type: 'ADD_ITEM'; item: InventoryItem }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'TOGGLE_ITEM_LOCK'; itemId: string }
  | { type: 'TOGGLE_ITEM_FAVORITE'; itemId: string }
  | { type: 'SELL_ITEM'; itemId: string }
  | { type: 'SELL_ITEMS'; itemIds: string[] }
  | { type: 'TRADE_UP'; itemIds: string[] }
  | { type: 'PURCHASE_AUTO_OPENER'; caseId?: string; now?: number }
  | { type: 'SET_AUTO_OPENER_CASE'; caseId: string }
  | { type: 'TOGGLE_AUTO_OPENER'; isEnabled?: boolean; now?: number }
  | { type: 'PURCHASE_AUTOMATION_MODULE'; moduleId: AutomationModuleId; now?: number }
  | { type: 'TOGGLE_AUTOMATION_MODULE'; moduleId: AutomationModuleId; isEnabled?: boolean; now?: number }
  | { type: 'PURCHASE_UPGRADE'; upgradeId: UpgradeId; now?: number }
  | { type: 'PRESTIGE'; now?: number }
  | { type: 'PURCHASE_PRESTIGE_BONUS'; bonusId: PrestigeBonusId; now?: number }
  | { type: 'LEARN_SKILL_NODE'; nodeId: SkillNodeId; now?: number }
  | { type: 'ASSIGN_TROPHY_ITEM'; slotId: string; itemId: string; now?: number }
  | { type: 'REMOVE_TROPHY_ITEM'; slotId: string }
  | { type: 'CLAIM_DAILY_REWARD'; now?: number }
  | { type: 'CLAIM_DAILY_CHALLENGE'; challengeId: string; now?: number }
  | { type: 'REROLL_DAILY_CHALLENGE'; challengeId: string; now?: number }
  | { type: 'REFRESH_DAILY_REWARDS'; now?: number }
  | { type: 'TICK_AUTOMATION'; now?: number; prng?: Prng }
  | { type: 'PURCHASE_AUCTION_DEAL'; dealId: string; now?: number }
  | { type: 'CLAIM_ACHIEVEMENT_REWARD'; achievementId: string; now?: number }
  | { type: 'UNLOCK_CASE'; caseId: string }
  | { type: 'PURCHASE_CASE_LICENSE'; caseId: string; licenseCost?: number; now?: number }
  | { type: 'TOGGLE_CASE_FAVORITE'; caseId: string }
  | {
      type: 'OPEN_CASE'
      payload: {
        caseId: string
        quantity?: number
        firstCaseHookRoll?: number
        openingEventId?: string
        now?: number
      }
    }
  | { type: 'UPDATE_MARKET_VALUE'; skinId: string; value: number }
  | { type: 'APPLY_EXTERNAL_SKIN_PRICES'; marketValues: Record<string, number>; now?: number }
  | { type: 'TICK_EVENTS'; now?: number; prng?: Prng; scheduleTicks?: number }
  | { type: 'TRIGGER_GAME_EVENT'; eventType: GameEventType; now?: number; durationMs?: number }
  | { type: 'TICK_MARKET'; now?: number; prng?: Prng; recordHistory?: boolean }
  | { type: 'APPLY_MARKET_TICK'; tick: MarketTickResult }
  | { type: 'APPLY_OFFLINE_PROGRESS'; state: GameState }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<GameSettings> }
  | { type: 'ADD_AUTO_SELL_RULE'; rule: AutoSellRule }
  | { type: 'UPDATE_AUTO_SELL_RULE'; ruleId: string; rule: Partial<AutoSellRule> }
  | { type: 'REMOVE_AUTO_SELL_RULE'; ruleId: string }
  | { type: 'REORDER_AUTO_SELL_RULES'; ruleIds: string[] }
  | { type: 'UPDATE_INVENTORY_VIEW_STATE'; inventory: Partial<InventoryViewUiState> }
  | { type: 'UPDATE_ONBOARDING_STATE'; onboarding: Partial<OnboardingUiState> }
  | { type: 'MARK_BACKUP_CREATED'; now?: number }
  | { type: 'REPLACE_GAME_STATE'; state: GameState }
  | { type: 'CLEAR_GAME_ERROR' }
  | { type: 'CLEAR_UI_EVENTS' }
  | { type: 'RESET_GAME' }

export const defaultDropsByRarity: DropRarityCounts = {
  [Rarity.Consumer]: 0,
  [Rarity.Industrial]: 0,
  [Rarity.MilSpec]: 0,
  [Rarity.Restricted]: 0,
  [Rarity.Classified]: 0,
  [Rarity.Covert]: 0,
  [Rarity.SpecialItem]: 0,
  [Rarity.Contraband]: 0,
}

export const defaultGameState: GameState = {
  money: 100,
  inventory: [],
  inventoryValue: 0,
  inventoryValueHistory: [],
  casesUnlocked: ['starter_case', 'fracture_style_case'],
  favoriteCaseIds: [],
  specialEventCaseIds: [],
  autoSellRules: [],
  automation: defaultAutomationState,
  upgrades: createDefaultUpgradeLevels(),
  trophyAssignments: createDefaultTrophyAssignments(),
  dailyRewards: createDefaultDailyRewardsState(),
  collectionBook: [],
  collectionRewards: [],
  recentDrops: [],
  lastOpenedItems: [],
  hasUsedFirstCaseHook: false,
  lastPoopCleaningAt: 0,
  workMiniGameCooldowns: {},
  uiEvents: [],
  prestigeLevel: 0,
  prestigePoints: 0,
  prestigeBonuses: createDefaultPrestigeBonusLevels(),
  upgradePoints: 0,
  skillPoints: 0,
  learnedSkillNodeIds: createDefaultLearnedSkillNodeIds(),
  achievements: [],
  marketValues: createInitialMarketValues(),
  marketHistory: createInitialMarketHistory(),
  marketTrends: createInitialMarketTrends(),
  activeEvents: [],
  upcomingEvents: [],
  eventHistory: [],
  activeMarketEvents: [],
  upcomingMarketEvents: [],
  marketEventHistory: [],
  lastMarketTick: 0,
  lastEventTick: 0,
  statistics: {
    auctionPurchases: 0,
    auctionSavings: 0,
    casesOpened: 0,
    moneySpent: 0,
    moneyEarned: 0,
    itemsSold: 0,
    tradeUpsCompleted: 0,
    drops: 0,
    rareDrops: 0,
    patternDrops: 0,
    exceptionalPatternDrops: 0,
    workJobsCompleted: 0,
    bestPrecisionScore: 0,
    bestMemoryScore: 0,
    dropsByRarity: defaultDropsByRarity,
  },
  settings: {
    animationSpeed: 'normal',
    animationsEnabled: true,
    autosaveEnabled: true,
    autoSellNotificationsEnabled: true,
    backupPromptEnabled: true,
    debugMode: false,
    highContrastMode: false,
    language: 'en',
    largeText: false,
    marketSimulationEnabled: true,
    marketEventBannersEnabled: true,
    musicEnabled: true,
    rarityColors: defaultRarityColors,
    recentDropFeedAnimationsEnabled: true,
    simplifiedAnimations: false,
    soundEnabled: true,
    soundVolume: 0.85,
    theme: 'dark',
  },
  ui: {
    inventory: defaultInventoryViewUiState,
    onboarding: defaultOnboardingUiState,
  },
  lastBackupAt: 0,
  lastSaved: 0,
}
