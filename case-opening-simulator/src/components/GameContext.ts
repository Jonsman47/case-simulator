import { createContext, type Dispatch } from 'react'
import type { DropOdds } from '../data/dropLogic'
import type { GameAction, GameSettings, GameState, InventoryItem, OnboardingUiState } from '../data/gameState'
import type {
  AutomationModuleId,
  AutoSellRule,
  CaseDefinition,
  PrestigeBonusId,
  SkillNodeId,
  UpgradeId,
} from '../data/models'
import type { GameEventType } from '../events/eventManager'
import type { InventoryViewUiState } from '../utils/inventoryFilters'
import type { CloudSession, CloudSyncStatus, LeaderboardMetric } from '../cloud/cloudSave'

export interface GameContextValue {
  state: GameState
  caseDefinitions: CaseDefinition[]
  availableCases: CaseDefinition[]
  dispatch: Dispatch<GameAction>
  addMoney: (amount: number) => void
  spendMoney: (amount: number) => void
  addItem: (item: InventoryItem) => void
  removeItem: (itemId: string) => void
  toggleItemLock: (itemId: string) => void
  toggleItemFavorite: (itemId: string) => void
  sellItem: (itemId: string) => void
  sellItems: (itemIds: string[]) => void
  tradeUpItems: (itemIds: string[]) => void
  claimAchievementReward: (achievementId: string) => void
  claimDailyReward: () => void
  claimDailyChallenge: (challengeId: string) => void
  rerollDailyChallenge: (challengeId: string) => void
  refreshDailyRewards: () => void
  purchaseAutoOpener: (caseId?: string) => void
  setAutoOpenerCase: (caseId: string) => void
  toggleAutoOpener: (isEnabled?: boolean) => void
  purchaseAutomationModule: (moduleId: AutomationModuleId) => void
  purchaseAuctionDeal: (dealId: string) => void
  toggleAutomationModule: (moduleId: AutomationModuleId, isEnabled?: boolean) => void
  purchaseUpgrade: (upgradeId: UpgradeId) => void
  prestige: () => void
  purchasePrestigeBonus: (bonusId: PrestigeBonusId) => void
  learnSkillNode: (nodeId: SkillNodeId) => void
  triggerGameEvent: (eventType: GameEventType) => void
  tickEventsNow: () => void
  assignTrophyItem: (slotId: string, itemId: string) => void
  removeTrophyItem: (slotId: string) => void
  getSelectedItemsValue: (itemIds: string[]) => number
  unlockCase: (caseId: string) => void
  purchaseCaseLicense: (caseId: string) => void
  toggleCaseFavorite: (caseId: string) => void
  openCase: (caseId: string, quantity?: number, options?: { skipAnimations?: boolean }) => void
  updateMarketValue: (skinId: string, value: number) => void
  tickMarketNow: () => void
  updateSettings: (settings: Partial<GameSettings>) => void
  addAutoSellRule: (rule: AutoSellRule) => void
  updateAutoSellRule: (ruleId: string, rule: Partial<AutoSellRule>) => void
  removeAutoSellRule: (ruleId: string) => void
  reorderAutoSellRules: (ruleIds: string[]) => void
  updateInventoryViewState: (inventory: Partial<InventoryViewUiState>) => void
  updateOnboardingState: (onboarding: Partial<OnboardingUiState>) => void
  markBackupCreated: (now?: number) => void
  replaceGameState: (state: GameState) => void
  getDropOddsForCase: (caseId: string) => DropOdds | undefined
  clearGameError: () => void
  clearUiEvents: () => void
  resetGame: () => void
  cloud: {
    error?: string
    forceSync: () => Promise<void>
    isConfigured: boolean
    lastSyncedAt?: number
    login: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
    metric: LeaderboardMetric
    requestPasswordReset: (email: string) => Promise<void>
    session: CloudSession | null
    setMetric: (metric: LeaderboardMetric) => void
    signUp: (email: string, password: string, username?: string) => Promise<void>
    status: CloudSyncStatus
  }
}

export const GameContext = createContext<GameContextValue | undefined>(undefined)
