import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useReducer,
  useState,
} from 'react'
import {
  CASE_DEFINITIONS,
  getAvailableCases,
  retireCasesByDate,
  unlockCasesForProgress,
} from '../data/cases'
import { getCaseLicenseCost } from '../data/casePricing'
import { calculateDropOdds } from '../data/dropLogic'
import { SKIN_DEFINITIONS } from '../data/skins'
import {
  type GameSettings,
  type GameState,
  type InventoryItem,
} from '../data/gameState'
import type {
  AutomationModuleId,
  AutoSellRule,
  PrestigeBonusId,
  SkillNodeId,
  TrophySlotId,
  UpgradeId,
} from '../data/models'
import { gameReducer } from '../data/gameReducer'
import { MARKET_TICK_MS } from '../market/marketSimulation'
import {
  GAME_EVENT_TICK_MS,
  applyGameEventEffectsToCases,
  type GameEventType,
} from '../events/eventManager'
import { loadGameStateOrDefault, saveGame } from '../utils/save'
import {
  calculateOfflineProgress,
  type OfflineProgressResult,
} from '../utils/offlineProgress'
import { applyCollectionRewardsToCases } from '../utils/collectionRewards'
import { applyUpgradeEffectsToCases } from '../data/upgrades'
import { applyPrestigeEffectsToCases } from '../data/prestige'
import { applySkillEffectsToCases } from '../data/skills'
import { getExternalSkinMarketValues, HAS_EXTERNAL_SKIN_PRICES } from '../data/skinPrices'
import { applyDailyRewardsToCases } from '../rewards/dailyRewards'
import type { InventoryViewUiState } from '../utils/inventoryFilters'
import { getSelectedItemsValue as calculateSelectedItemsValue } from '../utils/inventoryBulk'
import {
  createCloudBackend,
  createCloudSaveEnvelope,
  isOfflineError,
  LocalCloudBackend,
  mergeGameStates,
  parseCloudSaveEnvelope,
  type CloudBackend,
  type CloudSession,
  type CloudSyncStatus,
  type LeaderboardMetric,
} from '../cloud/cloudSave'
import { GameContext } from './GameContext'
import { OfflineProgressModal } from './OfflineProgressModal'

const skinDefinitionsById = new Map(SKIN_DEFINITIONS.map((skin) => [skin.id, skin]))
const externalSkinMarketValues = getExternalSkinMarketValues(SKIN_DEFINITIONS)
const cloudBackend: CloudBackend = createCloudBackend()
const cloudSyncDebounceMs = 2_500

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, loadGameStateOrDefault)
  const [pendingOfflineProgress, setPendingOfflineProgress] = useState<
    OfflineProgressResult | undefined
  >(() => calculateOfflineProgress(state, Date.now()))
  const stateRef = useRef(state)
  const pendingOfflineProgressRef = useRef(pendingOfflineProgress)
  const saveTimerRef = useRef<number | undefined>(undefined)
  const cloudSyncTimerRef = useRef<number | undefined>(undefined)
  const cloudSyncInFlightRef = useRef(false)
  const cloudRevisionRef = useRef(0)
  const [cloudSession, setCloudSession] = useState<CloudSession | null>(null)
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>('idle')
  const [cloudError, setCloudError] = useState<string | undefined>()
  const [lastCloudSyncedAt, setLastCloudSyncedAt] = useState<number | undefined>()
  const [leaderboardMetric, setLeaderboardMetric] = useState<LeaderboardMetric>('inventoryValue')

  useEffect(() => {
    if (import.meta.env.MODE === 'test' || !HAS_EXTERNAL_SKIN_PRICES || Object.keys(externalSkinMarketValues).length === 0) {
      return
    }

    dispatch({
      type: 'APPLY_EXTERNAL_SKIN_PRICES',
      marketValues: externalSkinMarketValues,
      now: Date.now(),
    })
  }, [])

  const caseDefinitions = useMemo(() => {
    const unlockedCases = unlockCasesForProgress(
      CASE_DEFINITIONS,
      {
        casesOpened: state.statistics.casesOpened,
        prestigeLevel: state.prestigeLevel,
      },
      state.casesUnlocked,
    )
    const retiredCases = retireCasesByDate(unlockedCases)
    const rewardedCases = applyCollectionRewardsToCases(retiredCases, state.collectionRewards)
    const upgradedCases = applyUpgradeEffectsToCases(
      rewardedCases,
      state.upgrades,
      skinDefinitionsById,
    )
    const prestigeCases = applyPrestigeEffectsToCases(
      upgradedCases,
      state.prestigeBonuses,
      skinDefinitionsById,
    )
    const skillCases = applySkillEffectsToCases(
      prestigeCases,
      state.learnedSkillNodeIds,
      skinDefinitionsById,
    )
    const eventCases = applyGameEventEffectsToCases(
      skillCases,
      state.activeEvents,
      skinDefinitionsById,
    )
    const dailyRewardCases = applyDailyRewardsToCases(eventCases, state.dailyRewards)

    return dailyRewardCases
  }, [
    state.activeEvents,
    state.casesUnlocked,
    state.collectionRewards,
    state.dailyRewards,
    state.learnedSkillNodeIds,
    state.prestigeBonuses,
    state.prestigeLevel,
    state.statistics.casesOpened,
    state.upgrades,
  ])

  const availableCases = useMemo(() => {
    const standardCases = getAvailableCases(caseDefinitions)
    const standardCaseIds = new Set(standardCases.map((caseDef) => caseDef.id))
    const specialEventCases = caseDefinitions.filter((caseDef) => {
      return state.specialEventCaseIds.includes(caseDef.id) && !standardCaseIds.has(caseDef.id)
    })

    return [...standardCases, ...specialEventCases]
  }, [caseDefinitions, state.specialEventCaseIds])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    pendingOfflineProgressRef.current = pendingOfflineProgress
  }, [pendingOfflineProgress])

  useEffect(() => {
    if (pendingOfflineProgress || !state.settings.autosaveEnabled) {
      return
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = window.setTimeout(() => {
      try {
        saveGame(stateRef.current)
      } catch (error) {
        console.error('Autosave failed', error)
      }
    }, 650)

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [pendingOfflineProgress, state])

  useEffect(() => {
    function persistLatestState() {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = undefined
      }

      if (!pendingOfflineProgressRef.current && stateRef.current.settings.autosaveEnabled) {
        try {
          saveGame(stateRef.current)
        } catch (error) {
          console.error('Autosave failed', error)
        }
      }
    }

    function persistWhenHidden() {
      if (document.visibilityState === 'hidden') {
        persistLatestState()
      }
    }

    window.addEventListener('beforeunload', persistLatestState)
    document.addEventListener('visibilitychange', persistWhenHidden)

    return () => {
      window.removeEventListener('beforeunload', persistLatestState)
      document.removeEventListener('visibilitychange', persistWhenHidden)
    }
  }, [])

  useEffect(() => {
    if (pendingOfflineProgress) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      dispatch({ type: 'TICK_EVENTS', now: Date.now() })
    }, GAME_EVENT_TICK_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [pendingOfflineProgress])

  useEffect(() => {
    if (pendingOfflineProgress) {
      return undefined
    }

    if (!state.settings.marketSimulationEnabled) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      dispatch({ type: 'TICK_MARKET', now: Date.now() })
    }, MARKET_TICK_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [pendingOfflineProgress, state.settings.marketSimulationEnabled])

  useEffect(() => {
    if (pendingOfflineProgress) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      dispatch({ type: 'REFRESH_DAILY_REWARDS', now: Date.now() })
    }, 60_000)

    dispatch({ type: 'REFRESH_DAILY_REWARDS', now: Date.now() })

    return () => {
      window.clearInterval(intervalId)
    }
  }, [pendingOfflineProgress])

  const hasActiveAutomation = useMemo(() => {
    return (
      (state.automation.autoOpener.isEnabled && state.automation.autoOpener.level > 0) ||
      Object.values(state.automation.modules).some((moduleState) => {
        return moduleState.isEnabled && moduleState.level > 0
      })
    )
  }, [state.automation.autoOpener.isEnabled, state.automation.autoOpener.level, state.automation.modules])

  useEffect(() => {
    if (pendingOfflineProgress) {
      return undefined
    }

    if (!hasActiveAutomation) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      dispatch({ type: 'TICK_AUTOMATION', now: Date.now() })
    }, 1_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [hasActiveAutomation, pendingOfflineProgress])

  const addMoney = useCallback((amount: number) => {
    dispatch({ type: 'ADD_MONEY', amount })
  }, [])

  const spendMoney = useCallback((amount: number) => {
    dispatch({ type: 'SPEND_MONEY', amount })
  }, [])

  const addItem = useCallback((item: InventoryItem) => {
    dispatch({ type: 'ADD_ITEM', item })
  }, [])

  const removeItem = useCallback((itemId: string) => {
    dispatch({ type: 'REMOVE_ITEM', itemId })
  }, [])

  const toggleItemLock = useCallback((itemId: string) => {
    dispatch({ type: 'TOGGLE_ITEM_LOCK', itemId })
  }, [])

  const toggleItemFavorite = useCallback((itemId: string) => {
    dispatch({ type: 'TOGGLE_ITEM_FAVORITE', itemId })
  }, [])

  const sellItem = useCallback((itemId: string) => {
    dispatch({ type: 'SELL_ITEM', itemId })
  }, [])

  const sellItems = useCallback((itemIds: string[]) => {
    dispatch({ type: 'SELL_ITEMS', itemIds })
  }, [])

  const tradeUpItems = useCallback((itemIds: string[]) => {
    dispatch({ type: 'TRADE_UP', itemIds })
  }, [])

  const claimAchievementReward = useCallback((achievementId: string) => {
    dispatch({ type: 'CLAIM_ACHIEVEMENT_REWARD', achievementId, now: Date.now() })
  }, [])

  const claimDailyReward = useCallback(() => {
    dispatch({ type: 'CLAIM_DAILY_REWARD', now: Date.now() })
  }, [])

  const claimDailyChallenge = useCallback((challengeId: string) => {
    dispatch({ type: 'CLAIM_DAILY_CHALLENGE', challengeId, now: Date.now() })
  }, [])

  const rerollDailyChallenge = useCallback((challengeId: string) => {
    dispatch({ type: 'REROLL_DAILY_CHALLENGE', challengeId, now: Date.now() })
  }, [])

  const refreshDailyRewards = useCallback(() => {
    dispatch({ type: 'REFRESH_DAILY_REWARDS', now: Date.now() })
  }, [])

  const purchaseAutoOpener = useCallback((caseId?: string) => {
    dispatch({ type: 'PURCHASE_AUTO_OPENER', caseId, now: Date.now() })
  }, [])

  const setAutoOpenerCase = useCallback((caseId: string) => {
    dispatch({ type: 'SET_AUTO_OPENER_CASE', caseId })
  }, [])

  const toggleAutoOpener = useCallback((isEnabled?: boolean) => {
    dispatch({ type: 'TOGGLE_AUTO_OPENER', isEnabled, now: Date.now() })
  }, [])

  const purchaseAutomationModule = useCallback((moduleId: AutomationModuleId) => {
    dispatch({ type: 'PURCHASE_AUTOMATION_MODULE', moduleId, now: Date.now() })
  }, [])

  const toggleAutomationModule = useCallback((moduleId: AutomationModuleId, isEnabled?: boolean) => {
    dispatch({ type: 'TOGGLE_AUTOMATION_MODULE', moduleId, isEnabled, now: Date.now() })
  }, [])

  const purchaseUpgrade = useCallback((upgradeId: UpgradeId) => {
    dispatch({ type: 'PURCHASE_UPGRADE', upgradeId, now: Date.now() })
  }, [])

  const prestige = useCallback(() => {
    dispatch({ type: 'PRESTIGE', now: Date.now() })
  }, [])

  const purchasePrestigeBonus = useCallback((bonusId: PrestigeBonusId) => {
    dispatch({ type: 'PURCHASE_PRESTIGE_BONUS', bonusId, now: Date.now() })
  }, [])

  const learnSkillNode = useCallback((nodeId: SkillNodeId) => {
    dispatch({ type: 'LEARN_SKILL_NODE', nodeId, now: Date.now() })
  }, [])

  const triggerGameEvent = useCallback((eventType: GameEventType) => {
    dispatch({ type: 'TRIGGER_GAME_EVENT', eventType, now: Date.now() })
  }, [])

  const tickEventsNow = useCallback(() => {
    dispatch({ type: 'TICK_EVENTS', now: Date.now() })
  }, [])

  const assignTrophyItem = useCallback((slotId: TrophySlotId, itemId: string) => {
    dispatch({ type: 'ASSIGN_TROPHY_ITEM', slotId, itemId, now: Date.now() })
  }, [])

  const removeTrophyItem = useCallback((slotId: TrophySlotId) => {
    dispatch({ type: 'REMOVE_TROPHY_ITEM', slotId })
  }, [])

  const getSelectedItemsValue = useCallback(
    (itemIds: string[]) => calculateSelectedItemsValue(
      state.inventory,
      state.marketValues,
      itemIds,
      state.collectionRewards,
      state.upgrades,
      state.prestigeBonuses,
      state.learnedSkillNodeIds,
    ),
    [
      state.collectionRewards,
      state.inventory,
      state.learnedSkillNodeIds,
      state.marketValues,
      state.prestigeBonuses,
      state.upgrades,
    ],
  )

  const unlockCase = useCallback((caseId: string) => {
    dispatch({ type: 'UNLOCK_CASE', caseId })
  }, [])

  const purchaseCaseLicense = useCallback((caseId: string) => {
    const caseDef = caseDefinitions.find((definition) => definition.id === caseId)

    dispatch({
      type: 'PURCHASE_CASE_LICENSE',
      caseId,
      licenseCost: caseDef ? getCaseLicenseCost(caseDef) : undefined,
      now: Date.now(),
    })
  }, [caseDefinitions])

  const toggleCaseFavorite = useCallback((caseId: string) => {
    dispatch({ type: 'TOGGLE_CASE_FAVORITE', caseId })
  }, [])

  const openCase = useCallback((caseId: string, quantity?: number) => {
    dispatch({ type: 'OPEN_CASE', payload: { caseId, quantity } })
  }, [])

  const updateMarketValue = useCallback((skinId: string, value: number) => {
    dispatch({ type: 'UPDATE_MARKET_VALUE', skinId, value })
  }, [])

  const tickMarketNow = useCallback(() => {
    dispatch({ type: 'TICK_MARKET', now: Date.now() })
  }, [])

  const updateSettings = useCallback((settings: Partial<GameSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings })
  }, [])

  const addAutoSellRule = useCallback((rule: AutoSellRule) => {
    dispatch({ type: 'ADD_AUTO_SELL_RULE', rule })
  }, [])

  const updateAutoSellRule = useCallback((ruleId: string, rule: Partial<AutoSellRule>) => {
    dispatch({ type: 'UPDATE_AUTO_SELL_RULE', ruleId, rule })
  }, [])

  const removeAutoSellRule = useCallback((ruleId: string) => {
    dispatch({ type: 'REMOVE_AUTO_SELL_RULE', ruleId })
  }, [])

  const reorderAutoSellRules = useCallback((ruleIds: string[]) => {
    dispatch({ type: 'REORDER_AUTO_SELL_RULES', ruleIds })
  }, [])

  const updateInventoryViewState = useCallback((inventory: Partial<InventoryViewUiState>) => {
    dispatch({ type: 'UPDATE_INVENTORY_VIEW_STATE', inventory })
  }, [])

  const updateOnboardingState = useCallback((onboarding: Partial<GameState['ui']['onboarding']>) => {
    dispatch({ type: 'UPDATE_ONBOARDING_STATE', onboarding })
  }, [])

  const markBackupCreated = useCallback((now?: number) => {
    dispatch({ type: 'MARK_BACKUP_CREATED', now })
  }, [])

  const replaceGameState = useCallback((nextState: GameState) => {
    dispatch({ type: 'REPLACE_GAME_STATE', state: nextState })
  }, [])

  const getDropOddsForCase = useCallback((caseId: string) => {
    const caseDef = caseDefinitions.find((definition) => definition.id === caseId)

    if (!caseDef) {
      return undefined
    }

    return calculateDropOdds(
      caseId,
      caseDef.dropTable,
      skinDefinitionsById,
    )
  }, [caseDefinitions])

  const resetGame = useCallback(() => {
    dispatch({ type: 'RESET_GAME' })
  }, [])

  const clearGameError = useCallback(() => {
    dispatch({ type: 'CLEAR_GAME_ERROR' })
  }, [])

  const clearUiEvents = useCallback(() => {
    dispatch({ type: 'CLEAR_UI_EVENTS' })
  }, [])

  const applyCloudRecord = useCallback((cloudState: GameState) => {
    const mergedState = mergeGameStates(stateRef.current, cloudState)

    dispatch({ type: 'REPLACE_GAME_STATE', state: mergedState })

    return mergedState
  }, [])

  const syncCloudNow = useCallback(async (sessionOverride?: CloudSession | null) => {
    const activeSession = sessionOverride ?? cloudSession

    if (!activeSession) {
      setCloudStatus('idle')
      return
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setCloudStatus('offline')
      setCloudError(undefined)
      return
    }

    if (cloudSyncInFlightRef.current) {
      return
    }

    cloudSyncInFlightRef.current = true
    setCloudStatus('syncing')
    setCloudError(undefined)

    try {
      const remoteRecord = await cloudBackend.loadSave(activeSession)
      const stateToUpload = remoteRecord
        ? applyCloudRecord(parseCloudSaveEnvelope(remoteRecord.envelope))
        : stateRef.current
      const savedRecord = await cloudBackend.saveSave(
        activeSession,
        createCloudSaveEnvelope(stateToUpload),
        remoteRecord?.revision ?? cloudRevisionRef.current,
      )

      cloudRevisionRef.current = savedRecord.revision
      setLastCloudSyncedAt(savedRecord.updatedAt)
      setCloudStatus('synced')
    } catch (error) {
      setCloudStatus(isOfflineError(error) ? 'offline' : 'error')
      setCloudError(error instanceof Error ? error.message : 'Cloud sync failed.')
    } finally {
      cloudSyncInFlightRef.current = false
    }
  }, [applyCloudRecord, cloudSession])

  const signUpCloud = useCallback(async (email: string, password: string, username?: string) => {
    setCloudStatus('syncing')
    setCloudError(undefined)

    try {
      const session = await cloudBackend.signUp(email, password, username)

      setCloudSession(session)
      await syncCloudNow(session)
    } catch (error) {
      setCloudStatus(isOfflineError(error) ? 'offline' : 'error')
      setCloudError(error instanceof Error ? error.message : 'Could not create account.')
    }
  }, [syncCloudNow])

  const loginCloud = useCallback(async (email: string, password: string) => {
    setCloudStatus('syncing')
    setCloudError(undefined)

    try {
      const session = await cloudBackend.login(email, password)

      setCloudSession(session)
      await syncCloudNow(session)
    } catch (error) {
      setCloudStatus(isOfflineError(error) ? 'offline' : 'error')
      setCloudError(error instanceof Error ? error.message : 'Could not log in.')
    }
  }, [syncCloudNow])

  const logoutCloud = useCallback(async () => {
    if (!cloudSession) {
      return
    }

    await cloudBackend.logout(cloudSession)
    setCloudSession(null)
    setCloudStatus('idle')
    setCloudError(undefined)
  }, [cloudSession])

  const requestCloudPasswordReset = useCallback(async (email: string) => {
    setCloudStatus('syncing')
    setCloudError(undefined)

    try {
      await cloudBackend.requestPasswordReset(email)
      setCloudStatus(cloudSession ? 'synced' : 'idle')
    } catch (error) {
      setCloudStatus(isOfflineError(error) ? 'offline' : 'error')
      setCloudError(error instanceof Error ? error.message : 'Could not send password reset.')
    }
  }, [cloudSession])

  useEffect(() => {
    let isCancelled = false

    void cloudBackend.getSession().then((session) => {
      if (!isCancelled) {
        setCloudSession(session)
        setCloudStatus(session ? 'synced' : 'idle')
      }
    }).catch((error) => {
      if (!isCancelled) {
        setCloudStatus(isOfflineError(error) ? 'offline' : 'error')
        setCloudError(error instanceof Error ? error.message : 'Cloud session could not be restored.')
      }
    })

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (!cloudSession || pendingOfflineProgress) {
      return undefined
    }

    if (cloudSyncTimerRef.current) {
      window.clearTimeout(cloudSyncTimerRef.current)
    }

    cloudSyncTimerRef.current = window.setTimeout(() => {
      void syncCloudNow()
    }, cloudSyncDebounceMs)

    return () => {
      if (cloudSyncTimerRef.current) {
        window.clearTimeout(cloudSyncTimerRef.current)
      }
    }
  }, [cloudSession, pendingOfflineProgress, state, syncCloudNow])

  useEffect(() => {
    function syncWhenOnline() {
      if (cloudSession) {
        void syncCloudNow()
      }
    }

    window.addEventListener('online', syncWhenOnline)

    return () => {
      window.removeEventListener('online', syncWhenOnline)
    }
  }, [cloudSession, syncCloudNow])

  const applyOfflineProgress = useCallback(() => {
    if (!pendingOfflineProgress) {
      return
    }

    dispatch({ type: 'APPLY_OFFLINE_PROGRESS', state: pendingOfflineProgress.state })
    setPendingOfflineProgress(undefined)
  }, [pendingOfflineProgress])

  const dismissOfflineProgress = useCallback(() => {
    setPendingOfflineProgress(undefined)
  }, [])

  const value = useMemo(
    () => ({
      state,
      caseDefinitions,
      availableCases,
      dispatch,
      addMoney,
      spendMoney,
      addItem,
      removeItem,
      toggleItemLock,
      toggleItemFavorite,
      sellItem,
      sellItems,
      tradeUpItems,
      claimAchievementReward,
      claimDailyReward,
      claimDailyChallenge,
      rerollDailyChallenge,
      refreshDailyRewards,
      purchaseAutoOpener,
      setAutoOpenerCase,
      toggleAutoOpener,
      purchaseAutomationModule,
      toggleAutomationModule,
      purchaseUpgrade,
      prestige,
      purchasePrestigeBonus,
      learnSkillNode,
      triggerGameEvent,
      tickEventsNow,
      assignTrophyItem,
      removeTrophyItem,
      getSelectedItemsValue,
      unlockCase,
      purchaseCaseLicense,
      toggleCaseFavorite,
      openCase,
      updateMarketValue,
      tickMarketNow,
      updateSettings,
      addAutoSellRule,
      updateAutoSellRule,
      removeAutoSellRule,
      reorderAutoSellRules,
      updateInventoryViewState,
      updateOnboardingState,
      markBackupCreated,
      replaceGameState,
      getDropOddsForCase,
      clearGameError,
      clearUiEvents,
      resetGame,
      cloud: {
        error: cloudError,
        forceSync: syncCloudNow,
        isConfigured: cloudBackend instanceof LocalCloudBackend === false,
        lastSyncedAt: lastCloudSyncedAt,
        login: loginCloud,
        logout: logoutCloud,
        metric: leaderboardMetric,
        requestPasswordReset: requestCloudPasswordReset,
        session: cloudSession,
        setMetric: setLeaderboardMetric,
        signUp: signUpCloud,
        status: cloudStatus,
      },
    }),
    [
      addItem,
      addMoney,
      addAutoSellRule,
      assignTrophyItem,
      availableCases,
      caseDefinitions,
      claimAchievementReward,
      claimDailyChallenge,
      claimDailyReward,
      clearGameError,
      clearUiEvents,
      cloudError,
      cloudSession,
      cloudStatus,
      getDropOddsForCase,
      getSelectedItemsValue,
      learnSkillNode,
      lastCloudSyncedAt,
      leaderboardMetric,
      loginCloud,
      logoutCloud,
      markBackupCreated,
      openCase,
      prestige,
      purchaseAutoOpener,
      purchaseAutomationModule,
      purchaseCaseLicense,
      purchasePrestigeBonus,
      purchaseUpgrade,
      requestCloudPasswordReset,
      replaceGameState,
      removeItem,
      removeAutoSellRule,
      removeTrophyItem,
      rerollDailyChallenge,
      reorderAutoSellRules,
      resetGame,
      refreshDailyRewards,
      sellItem,
      sellItems,
      setAutoOpenerCase,
      signUpCloud,
      syncCloudNow,
      tradeUpItems,
      spendMoney,
      state,
      tickEventsNow,
      toggleAutoOpener,
      toggleAutomationModule,
      toggleCaseFavorite,
      toggleItemFavorite,
      toggleItemLock,
      unlockCase,
      updateMarketValue,
      tickMarketNow,
      triggerGameEvent,
      updateAutoSellRule,
      updateInventoryViewState,
      updateOnboardingState,
      updateSettings,
    ],
  )

  return (
    <GameContext.Provider value={value}>
      {children}
      {pendingOfflineProgress ? (
        <OfflineProgressModal
          onApply={applyOfflineProgress}
          onDismiss={dismissOfflineProgress}
          summary={pendingOfflineProgress.summary}
        />
      ) : null}
    </GameContext.Provider>
  )
}
