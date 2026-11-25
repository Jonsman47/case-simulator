import { nanoid } from 'nanoid'
import { getToastPriority } from '../notifications/toastPolicy'
import { awardQuestCareerXp, getCareerLevelFromXp, recordCareerAction, startNextCareerRun } from '../career/careerProgress'
import {
  careerUpgradesById,
  getCareerBusinessIntervalMultiplier,
  getCareerCaseOperatorBatchBonus,
  getCareerListingCapacityBonus,
  getCareerOperatingCapacityBonus,
  getCareerPayrollDiscount,
  getCareerScoutCandidateBonus,
  getCareerScoutWatchlistBonus,
  getCareerSellerFeeDiscount,
  getCareerTradeUpApprovalBonus,
  getCareerTradeUpContractBonus,
  getCareerTrainingDiscount,
  getCareerUpgradeEffect,
  getCareerUpgradeStatus,
  resetCareerUpgradesForPrestige,
} from '../career/careerUpgrades'
import { CASE_DEFINITIONS, unlockCasesForProgress } from './cases'
import { applyOfficialWeaponCaseOdds } from './officialDropOdds'
import { getCaseLicenseCost, requiresCaseLicense } from './casePricing'
import { pickDrop, type Prng } from './dropLogic'
import { defaultGameState, type GameAction, type GameState, type GameUiEvent } from './gameState'
import {
  AutomationModuleId,
  CaseStatus,
  DailyRewardKind,
  PrestigeBonusId,
  Rarity,
  SkillNodeId,
  UpgradeId,
  type AutoSellRule,
  type CollectionEntry,
  type NpcMarketListing,
  type SkinBase,
  type SkinInstance,
  WearCondition,
} from './models'
import { SKIN_DEFINITIONS } from './skins'
import {
  applyWearMultiplier,
  getWearConditionForFloat,
  randomFloatForSkin,
} from '../utils/wear'
import {
  appendInventoryValueHistory,
  getCurrentItemMarketValue,
  getInventoryValue,
} from '../utils/inventory'
import { getBulkSaleSummary } from '../utils/inventoryBulk'
import { getKeepBestDuplicateSaleCandidates, shouldAutoSell } from '../utils/autoSell'
import {
  appendMarketPriceHistory,
  hydrateMarketEvent,
  tickMarket,
  type ActiveMarketEvent,
  type MarketEventLog,
} from '../market/marketSimulation'
import { analyzeTradeUp, pickTradeUpOutcome, suggestBestTradeUps } from '../utils/tradeUp'
import { getFeatureProgress } from '../progression/featureUnlocks'
import {
  getInstantSaleQuote,
  hasProcessedMarketplaceRequest,
  MARKETPLACE_LISTING_DURATION_MS,
  negotiateNpcListing,
  rememberMarketplaceRequest,
  tickMarketplace,
} from '../marketplace/marketplace'
import { achievementsById, getAchievementProgress, getAchievementScope, getNewAchievementUnlocks } from './achievements'
import { getMarketAdjustedSkinConditionPrice } from './skinPrices'
import {
  applyPatternPremium,
  classifySkinPattern,
  generatePaintSeed,
  getPatternPremiumValue,
  isExceptionalPattern,
  isSpecialPattern,
} from '../utils/skinPatterns'
import {
  CASE_FARM_INTERVAL_MS,
  TRADING_BOT_INTERVAL_MS,
  AUCTION_HOUSE_DEAL_DURATION_MS,
  AUTO_OPENER_MAX_LEVEL,
  AUTOMATION_MODULE_DEFINITIONS,
  getAuctionHouseDealCount,
  getAuctionHouseDiscount,
  getAuctionHouseRefreshMs,
  getAutomationModuleUpgradeCost,
  getAutomationSellMultiplier,
  getAutoOpenerIntervalMs,
  getAutoOpenerUpgradeCost,
  getCaseFarmIncomePerTick,
  getOpeningDeskBatchSize,
  getOpeningDeskIntervalMs,
  getTradingBotMinimumProfit,
} from '../utils/automation'
import {
  applyCollectionRewardsToCase,
  applyCollectionSellValueBonus,
  getCollectionRewardDefinitions,
  getNewCollectionRewardUnlocks,
} from '../utils/collectionRewards'
import {
  applyUpgradeEffectsToCase,
  getAutomationModuleCapacity,
  getClickIncomeMultiplier,
  getTrendPredictionBonus,
  getUpgradeAutomationIntervalMultiplier,
  getUpgradeSellValueMultiplier,
} from './upgrades'
import {
  applyPrestigeEffectsToCase,
  getPrestigeAutomationIntervalMultiplier,
  getPrestigeMarketKnowledgeBonus,
  getPrestigeSellMultiplier,
} from './prestige'
import {
  applySkillEffectsToCase,
  getSkillAuctionDealSlotBonus,
  getSkillAutomationIntervalMultiplier,
  getSkillEventChanceBonus,
  getSkillLicenseDiscount,
  getSkillMarketKnowledgeBonus,
  getSkillMinigameRewardMultiplier,
  getSkillPassiveIncomeMultiplier,
  getSkillSellMultiplier,
  getSkillTradeUpInputCostMultiplier,
} from './skills'
import {
  applyGameEventEffectsToCase,
  eventManager,
  gameEventsToMarketEvents,
  getGameEventCollectionRewardMultiplier,
  getGameEventTradeUpInputCostMultiplier,
  type ActiveGameEvent,
} from '../events/eventManager'
import {
  calculatePrestigePointsV2,
  cloneVaultItems,
  createPrestigeRecoveryProof,
  getPrestigeEligibilityV2,
  getPrestigeStartingCash as getCareerPrestigeStartingCash,
  getPrestigeBusinessCostMultiplier,
  purchasePrestigePerk,
  validateVaultSelection,
} from '../prestige/prestigeSystem'
import {
  MAX_TRACKED_QUESTS,
  QUEST_DEFINITIONS,
  QUEST_REQUEST_LIMIT,
  getQuestProgressState,
  getQuestStageStatus,
  isQuestItemEligible,
  isQuestUnlocked,
  questsById,
  recordQuestActivity,
  resetQuestsForPrestige,
} from '../quests/questSystem'
import { recordDropJournalAction } from '../quests/dropJournal'
import { getInventoryFreeSlots, hasInventorySpace } from '../utils/inventoryCapacity'
import { isUnlockedTrophySlot } from '../utils/trophyRoom'
import {
  applyDailyCaseDiscountToCase,
  applyDailyChallengeProgress,
  addOpeningCredits,
  getOpeningCreditQuote,
  getNextDailyRewardInfo,
  markDailyChallengeClaimed,
  refreshDailyRewardsState,
  rerollDailyChallenge,
  type DailyChallengeProgressEvent,
} from '../rewards/dailyRewards'
import { clampNumber, normalizeMoney, roundCurrency } from '../utils/safeNumbers'
import {
  getPoopCleanupCooldownRemaining,
} from '../utils/poopCleanupMinigame'
import {
  getWorkBaseReward,
  getWorkMiniGameCooldownRemaining,
  normalizeWorkPerformance,
  workMiniGamesById,
  type WorkMiniGameId,
} from '../utils/workMinigames'
import { recordEconomyAction, startNextEconomyRun } from '../economy/economyLedger'
import {
  BUSINESS_MAX_TRAINING_LEVEL,
  EMPLOYEE_ROLE_DEFINITIONS,
  EMPLOYEE_ROLE_IDS,
  getActiveEmployeeCount,
  getCaseOperatorMaximumBatch,
  getEmployeeHireCost,
  getEmployeeHourlyWage,
  getEmployeeOperationInterval,
  getEmployeeTrainingCost,
  getOperatingCapacity,
  getScoutCandidateLimit,
  isBusinessProtectedItem,
  isEmployeeUnlocked,
  refreshBusinessDay,
  rememberBusinessOperation,
  type BusinessOperation,
  type EmployeeRoleId,
  type ScoutWatchlist,
} from '../business/business'
import { generateVirtualListingPage, getCredibleDealScore } from '../marketplace/virtualMarket'

const RECENT_DROPS_LIMIT = 20
const UI_EVENTS_LIMIT = 50
export const AUCTION_INSTANT_RESALE_COOLDOWN_MS = 24 * 60 * 60 * 1_000
const skinDefinitionsById = new Map(SKIN_DEFINITIONS.map((skin) => [skin.id, skin]))

function normalizeOpenQuantity(quantity?: number) {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    return 1
  }

  return Math.max(1, Math.floor(quantity))
}

function getAutomationSaleValue(state: GameState, item: SkinInstance) {
  const progressionMultiplier =
    getAutomationSellMultiplier(state.automation) *
    getUpgradeSellValueMultiplier(state.upgrades) *
    getPrestigeSellMultiplier(state.prestigeBonuses) *
    getSkillSellMultiplier(state.learnedSkillNodeIds)
  const collectionMultiplier = applyCollectionSellValueBonus(
    1,
    item,
    state.collectionRewards,
    getGameEventCollectionRewardMultiplier(state.activeEvents),
  )

  return getInstantSaleQuote(
    item,
    state.marketValues,
    progressionMultiplier * collectionMultiplier,
  ).value
}

function appendEvents(state: GameState, events: GameUiEvent[]) {
  const seen = new Set<string>()
  const unique = [...events, ...state.uiEvents].filter((event) => {
    const identity = event.type === 'case_opening_failed' || event.type === 'item_sale_failed' || event.type === 'trade_up_failed'
      ? `${event.type}:${event.message}`
      : `${event.type}:${event.id}`
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
  const critical = unique.filter((event) => getToastPriority(event) === 'critical')
  let ordinarySlots = Math.max(0, UI_EVENTS_LIMIT - critical.length)
  return unique.filter((event) => getToastPriority(event) === 'critical' || ordinarySlots-- > 0)
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

function syncMarketEventsFromGameEvents({
  activeGameEvents,
  activeMarketEvents,
  endedGameEvents = [],
  marketEventHistory,
  now,
  upcomingGameEvents,
  upcomingMarketEvents,
}: {
  activeGameEvents: ActiveGameEvent[]
  activeMarketEvents: ActiveMarketEvent[]
  endedGameEvents?: ActiveGameEvent[]
  marketEventHistory: MarketEventLog[]
  now: number
  upcomingGameEvents: ActiveGameEvent[]
  upcomingMarketEvents: ActiveMarketEvent[]
}) {
  const gameActive = gameEventsToMarketEvents(activeGameEvents)
    .map((event) => hydrateMarketEvent(event, now))
  const gameUpcoming = gameEventsToMarketEvents(upcomingGameEvents)
    .map((event) => hydrateMarketEvent(event, now))
  const gameTypes = new Set([...gameActive, ...gameUpcoming].map((event) => event.type))
  const retainedActive = activeMarketEvents.filter((event) => (
    !event.id.startsWith('game:') && !gameTypes.has(event.type) && (event.endTime ?? Number.POSITIVE_INFINITY) > now
  ))
  const retainedUpcoming = upcomingMarketEvents.filter((event) => (
    !event.id.startsWith('game:') && !gameTypes.has(event.type) && (event.endTime ?? Number.POSITIVE_INFINITY) > now
  ))
  const existingLogIds = new Set(marketEventHistory.map((event) => event.id))
  const endedLogs: MarketEventLog[] = endedGameEvents.flatMap((event) => {
    const marketEventType = event.effects.marketEventType
    const id = `game:${event.id}`

    if (!marketEventType || existingLogIds.has(id)) {
      return []
    }

    return [{
      id,
      type: marketEventType,
      label: event.name,
      name: event.name,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      endedAt: now,
      effectSummary: event.effectSummary,
      triggeredAtCasesOpened: event.triggeredAtCasesOpened,
    }]
  })

  return {
    activeMarketEvents: uniqueById([...retainedActive, ...gameActive]),
    marketEventHistory: [...endedLogs, ...marketEventHistory].slice(0, 30),
    upcomingMarketEvents: uniqueById([...retainedUpcoming, ...gameUpcoming]),
  }
}

function dedupeInventoryItems(items: SkinInstance[]) {
  const seenIds = new Set<string>()

  return items.filter((item) => {
    if (seenIds.has(item.instanceId)) {
      if (import.meta.env?.DEV) {
        console.warn('Duplicate inventory instanceId removed from game state.', item.instanceId)
      }

      return false
    }

    seenIds.add(item.instanceId)
    return true
  })
}

function validateGameState(state: GameState): GameState {
  const money = normalizeMoney(state.money, defaultGameState.money)
  const inventory = dedupeInventoryItems(state.inventory)

  if (money === state.money && inventory.length === state.inventory.length) {
    return state
  }

  return withInventoryValuation({
    ...state,
    money,
    inventory,
  }, state.lastSaved || Date.now())
}

function completeWorkMiniGame(
  state: GameState,
  gameId: WorkMiniGameId,
  now = Date.now(),
  performance?: number,
): GameState {
  const definition = workMiniGamesById.get(gameId)

  if (!definition) {
    return {
      ...state,
      lastError: 'Work mini-game not found.',
    }
  }

  if (getWorkMiniGameCooldownRemaining(gameId, now, state.workMiniGameCooldowns) > 0) {
    return {
      ...state,
      lastError: `${definition.name} is still on cooldown.`,
    }
  }

  const reward = roundCurrency(
    getWorkBaseReward(gameId, performance) *
    getClickIncomeMultiplier(state.upgrades) *
    getSkillMinigameRewardMultiplier(state.learnedSkillNodeIds),
  )
  const event: GameUiEvent = {
    id: nanoid(),
    type: 'minigame_completed',
    name: definition.name,
    reward,
    createdAt: now,
  }
  const workMiniGameCooldowns = {
    ...state.workMiniGameCooldowns,
    [gameId]: now,
  }
  const normalizedPerformance = normalizeWorkPerformance(performance)

  return {
    ...state,
    money: roundCurrency(clampNumber(state.money) + reward),
    lastPoopCleaningAt: gameId === 'poopCleaning' ? now : state.lastPoopCleaningAt,
    workMiniGameCooldowns,
    lastError: undefined,
    statistics: {
      ...state.statistics,
      moneyEarned: roundCurrency(state.statistics.moneyEarned + reward),
      workJobsCompleted: state.statistics.workJobsCompleted + 1,
      bestPrecisionScore: gameId === 'precisionStrike'
        ? Math.max(state.statistics.bestPrecisionScore, normalizedPerformance)
        : state.statistics.bestPrecisionScore,
      bestMemoryScore: gameId === 'memoryCircuit'
        ? Math.max(state.statistics.bestMemoryScore, normalizedPerformance)
        : state.statistics.bestMemoryScore,
    },
    uiEvents: appendEvents(state, [event]),
  }
}

function getEventScheduleChanceBonus(state: GameState) {
  return Math.min(
    0.2,
    getSkillEventChanceBonus(state.learnedSkillNodeIds) +
    getSkillMarketKnowledgeBonus(state.learnedSkillNodeIds) +
    getTrendPredictionBonus(state.upgrades) +
    getPrestigeMarketKnowledgeBonus(state.prestigeBonuses),
  )
}

function completePoopCleaning(state: GameState, now = Date.now()): GameState {
  if (getPoopCleanupCooldownRemaining(now, state.lastPoopCleaningAt) > 0) {
    return {
      ...state,
      lastError: 'Poop Cleaning is still on cooldown.',
    }
  }

  return completeWorkMiniGame(
    {
      ...state,
      workMiniGameCooldowns: {
        ...state.workMiniGameCooldowns,
        poopCleaning: state.lastPoopCleaningAt,
      },
    },
    'poopCleaning',
    now,
  )
}

function withAchievementUnlocks(state: GameState, unlockedAt = Date.now()): GameState {
  const { progress, unlockedDefinitions } = getNewAchievementUnlocks(state, unlockedAt)

  if (progress.length === 0) {
    return state
  }

  const events: GameUiEvent[] = unlockedDefinitions.map((achievement) => ({
    id: nanoid(),
    type: 'achievement_unlocked',
    achievementId: achievement.id,
    name: achievement.name,
    reward: achievement.reward,
    createdAt: unlockedAt,
  }))

  return {
    ...state,
    achievements: [...state.achievements, ...progress],
    uiEvents: appendEvents(state, events),
  }
}

function withCollectionRewardUnlocks(state: GameState, unlockedAt = Date.now()): GameState {
  const progress = getNewCollectionRewardUnlocks({
    collectionBook: state.collectionBook,
    collectionRewards: state.collectionRewards,
    unlockedAt,
  })

  if (progress.length === 0) {
    return state
  }

  const definitionsById = new Map(getCollectionRewardDefinitions().map((definition) => [definition.id, definition]))
  const events: GameUiEvent[] = progress.map((reward) => {
    const definition = definitionsById.get(reward.id)

    return {
      id: nanoid(),
      type: 'collection_reward_unlocked',
      reward,
      title: definition?.title ?? reward.id,
      effectLabel: definition?.effectLabel ?? 'Collection bonus unlocked',
      createdAt: unlockedAt,
    }
  })

  return {
    ...state,
    collectionRewards: [...state.collectionRewards, ...progress],
    uiEvents: appendEvents(state, events),
  }
}

function withProgressionUnlocks(state: GameState, unlockedAt = Date.now()) {
  return withAchievementUnlocks(withCollectionRewardUnlocks(state, unlockedAt), unlockedAt)
}

function withInventoryValuation(state: GameState, timestamp = Date.now()): GameState {
  const inventoryValue = getInventoryValue(state.inventory, state.marketValues)

  return {
    ...state,
    inventoryValue,
    inventoryValueHistory: appendInventoryValueHistory(
      state.inventoryValueHistory,
      inventoryValue,
      timestamp,
    ),
  }
}

function getFallbackSkinForCase(dropTable: { skinId: string }[]) {
  const firstCatalogSkin = SKIN_DEFINITIONS[0]

  for (const drop of dropTable) {
    const skin = skinDefinitionsById.get(drop.skinId)

    if (skin) {
      return skin
    }
  }

  return firstCatalogSkin
}

function withDailyChallengeProgress(
  state: GameState,
  progressEvent: DailyChallengeProgressEvent,
  now = Date.now(),
): GameState {
  const dailyRewards = refreshDailyRewardsState(state.dailyRewards, now)
  const challenges = applyDailyChallengeProgress(dailyRewards.challenges, progressEvent)

  if (challenges === dailyRewards.challenges) {
    return {
      ...state,
      dailyRewards,
    }
  }

  return {
    ...state,
    dailyRewards: {
      ...dailyRewards,
      challenges,
    },
  }
}

function withDropChallengeProgress(state: GameState, items: SkinInstance[], now = Date.now()) {
  return items.reduce((nextState, item) => (
    withDailyChallengeProgress(
      nextState,
      {
        type: 'rarity_obtained',
        rarity: item.rarity,
        amount: 1,
      },
      now,
    )
  ), state)
}

function canOpenCase(caseDef: (typeof CASE_DEFINITIONS)[number], state: GameState) {
  if (state.specialEventCaseIds.includes(caseDef.id)) {
    return true
  }

  if (state.casesUnlocked.includes(caseDef.id)) {
    return true
  }

  if (caseDef.status === CaseStatus.Unlocked && !requiresCaseLicense(caseDef)) {
    return true
  }

  if (caseDef.status === CaseStatus.Retired) {
    return false
  }

  if (requiresCaseLicense(caseDef)) {
    return false
  }

  const requirement = caseDef.unlockRequirement

  if (!requirement) {
    return false
  }

  return (
    state.statistics.casesOpened >= requirement.casesOpened &&
    state.prestigeLevel >= (requirement.prestigeLevel ?? 0)
  )
}

function createSkinInstance(
  skin: SkinBase,
  state: GameState,
  discoveredAt: number,
  forcedFloatValue?: number,
  prng: () => number = Math.random,
  forcedEdition?: { statTrak: boolean; souvenir: boolean },
): SkinInstance {
  const floatValue = typeof forcedFloatValue === 'number'
    ? Number(Math.min(1, Math.max(0, forcedFloatValue)).toFixed(6))
    : randomFloatForSkin(skin, prng)
  const wear = getWearConditionForFloat(skin, floatValue)
  const marketBaseValue = clampNumber(state.marketValues[skin.id] ?? skin.baseValue)
  const hasStatTrak = 'hasStatTrak' in skin
    ? Boolean(skin.hasStatTrak)
    : Boolean(skin.statTrak)
  const hasSouvenir = 'hasSouvenir' in skin
    ? Boolean(skin.hasSouvenir)
    : Boolean(skin.souvenir)
  const isStatTrak = forcedEdition ? forcedEdition.statTrak : hasStatTrak && prng() < 0.1
  const isSouvenir = forcedEdition ? forcedEdition.souvenir : !isStatTrak && hasSouvenir && prng() < 0.01
  const fallbackMarketValue = roundCurrency(applyWearMultiplier(marketBaseValue, wear, floatValue))
  const realMarketValue = getMarketAdjustedSkinConditionPrice({
    fallbackValue: fallbackMarketValue,
    isStatTrak,
    isSouvenir,
    marketValues: state.marketValues,
    skin,
    wear,
  }) ?? fallbackMarketValue
  const paintSeed = generatePaintSeed(prng)
  const pattern = classifySkinPattern(skin, paintSeed)
  const baseMarketValue = roundCurrency(realMarketValue)
  const marketValue = applyPatternPremium(baseMarketValue, pattern)

  return {
    ...skin,
    instanceId: nanoid(),
    wear,
    floatValue,
    marketValue,
    baseMarketValue,
    paintSeed,
    pattern,
    patternPremium: getPatternPremiumValue(baseMarketValue, pattern),
    statTrak: isStatTrak,
    souvenir: isSouvenir,
    isLocked: false,
    isFavorited: false,
    discoveredAt,
  }
}

function getEffectiveCaseDefinition(
  state: GameState,
  caseDef: (typeof CASE_DEFINITIONS)[number],
  now: number,
) {
  const collectionCaseDef = applyCollectionRewardsToCase(
    caseDef,
    state.collectionRewards,
    SKIN_DEFINITIONS,
    getGameEventCollectionRewardMultiplier(state.activeEvents),
  )
  const upgradeCaseDef = applyUpgradeEffectsToCase(collectionCaseDef, state.upgrades, skinDefinitionsById)
  const prestigeCaseDef = applyPrestigeEffectsToCase(upgradeCaseDef, state.prestigeBonuses, skinDefinitionsById)
  const skillCaseDef = applySkillEffectsToCase(
    prestigeCaseDef,
    state.learnedSkillNodeIds,
    skinDefinitionsById,
  )
  const eventCaseDef = applyGameEventEffectsToCase(
    skillCaseDef,
    state.activeEvents,
    skinDefinitionsById,
  )

  const discountedCaseDef = applyDailyCaseDiscountToCase(eventCaseDef, state.dailyRewards, now)
  return discountedCaseDef.oddsProfile === 'standard-weapon-case'
    ? { ...discountedCaseDef, dropTable: applyOfficialWeaponCaseOdds(discountedCaseDef.dropTable, skinDefinitionsById) }
    : discountedCaseDef
}

function updateCollectionBook(
  collectionBook: CollectionEntry[],
  item: SkinInstance,
): CollectionEntry[] {
  const existingEntry = collectionBook.find((entry) => entry.skinId === item.id)

  if (!existingEntry) {
    return [
      ...collectionBook,
      {
        skinId: item.id,
        foundWearConditions: [item.wear],
        bestFloat: item.floatValue,
        highestValue: item.marketValue,
        timesFound: 1,
        firstFoundAt: item.discoveredAt,
      },
    ]
  }

  return collectionBook.map((entry) => {
    if (entry.skinId !== item.id) {
      return entry
    }

    return {
      ...entry,
      foundWearConditions: entry.foundWearConditions.includes(item.wear)
        ? entry.foundWearConditions
        : [...entry.foundWearConditions, item.wear],
      bestFloat:
        typeof entry.bestFloat === 'number'
          ? Math.min(entry.bestFloat, item.floatValue)
          : item.floatValue,
      highestValue:
        typeof entry.highestValue === 'number'
          ? Math.max(entry.highestValue, item.marketValue)
          : item.marketValue,
      timesFound: entry.timesFound + 1,
    }
  })
}

function isRareDrop(rarity: Rarity) {
  return rarity === Rarity.Covert || rarity === Rarity.SpecialItem || rarity === Rarity.Contraband
}

function getUnlockedCaseIdsAfterOpening(state: GameState, casesOpened: number) {
  const unlockedDefinitions = unlockCasesForProgress(
    CASE_DEFINITIONS,
    {
      casesOpened,
      prestigeLevel: state.prestigeLevel,
    },
    state.casesUnlocked,
  )

  return Array.from(
    new Set([
      ...state.casesUnlocked,
      ...unlockedDefinitions
        .filter((caseDef) => caseDef.status === CaseStatus.Unlocked)
        .map((caseDef) => caseDef.id),
    ]),
  )
}

function failOpenCase(
  state: GameState,
  caseId: string,
  message: string,
  openingEventId?: string,
): GameState {
  const event: GameUiEvent = {
    id: openingEventId ?? nanoid(),
    type: 'case_opening_failed',
    caseId,
    message,
    createdAt: Date.now(),
  }

  return {
    ...state,
    lastOpenedItems: [],
    lastError: message,
    uiEvents: appendEvents(state, [event]),
  }
}

function purchaseCaseLicense(state: GameState, caseId: string, providedLicenseCost?: number): GameState {
  const caseDef = CASE_DEFINITIONS.find((definition) => definition.id === caseId)

  if (!caseDef) {
    return {
      ...state,
      lastError: 'Case not found.',
    }
  }

  if (!requiresCaseLicense(caseDef)) {
    return {
      ...state,
      lastError: 'This case does not require a license.',
    }
  }

  if (state.casesUnlocked.includes(caseId)) {
    return {
      ...state,
      lastError: 'Case license already owned.',
    }
  }

  const normalizedProvidedLicenseCost = Number.isFinite(providedLicenseCost)
    ? roundCurrency(clampNumber(providedLicenseCost ?? 0))
    : 0
  const baseLicenseCost = normalizedProvidedLicenseCost > 0
    ? normalizedProvidedLicenseCost
    : getCaseLicenseCost(caseDef)
  const licenseCost = roundCurrency(baseLicenseCost * (1 - getSkillLicenseDiscount(state.learnedSkillNodeIds)))
  const currentMoney = clampNumber(state.money)

  if (currentMoney < licenseCost) {
    return {
      ...state,
      lastError: `Need $${licenseCost.toFixed(2)} to buy this case license.`,
    }
  }

  return {
    ...state,
    money: roundCurrency(currentMoney - licenseCost),
    casesUnlocked: [...state.casesUnlocked, caseId],
    lastError: undefined,
    statistics: {
      ...state.statistics,
      moneySpent: roundCurrency(state.statistics.moneySpent + licenseCost),
    },
  }
}

function failItemSale(state: GameState, itemId: string, message: string): GameState {
  const event: GameUiEvent = {
    id: nanoid(),
    type: 'item_sale_failed',
    itemId,
    message,
    createdAt: Date.now(),
  }

  return {
    ...state,
    lastError: message,
    uiEvents: appendEvents(state, [event]),
  }
}

function failTradeUp(state: GameState, message: string): GameState {
  const event: GameUiEvent = {
    id: nanoid(),
    type: 'trade_up_failed',
    message,
    createdAt: Date.now(),
  }

  return {
    ...state,
    lastError: message,
    uiEvents: appendEvents(state, [event]),
  }
}

function openCase(
  state: GameState,
  caseId: string,
  requestedQuantity = 1,
  openedAt = Date.now(),
  openingEventId?: string,
  useOpeningCredits = false,
): GameState {
  if (openingEventId && state.uiEvents.some((event) => event.id === openingEventId && event.type === 'case_opening_started')) return state
  const baseCaseDef = CASE_DEFINITIONS.find((definition) => definition.id === caseId)

  if (!baseCaseDef) {
    return failOpenCase(state, caseId, 'Case not found.', openingEventId)
  }

  if (!canOpenCase(baseCaseDef, state)) {
    return failOpenCase(
      state,
      caseId,
      requiresCaseLicense(baseCaseDef)
        ? `Case license required. Buy access for $${getCaseLicenseCost(baseCaseDef).toFixed(2)}.`
        : 'Case is locked or unavailable.',
      openingEventId,
    )
  }

  const dailyCaseDef = getEffectiveCaseDefinition(state, baseCaseDef, openedAt)
  const quantity = normalizeOpenQuantity(requestedQuantity)

  if (!Number.isFinite(dailyCaseDef.cost) || dailyCaseDef.cost <= 0) {
    return failOpenCase(state, caseId, 'Case price is invalid.', openingEventId)
  }

  const currentMoney = clampNumber(state.money)
  const freeSlots = getInventoryFreeSlots(state)
  const quantityWithSpace = Math.min(quantity, freeSlots)
  let actualQuantity = quantityWithSpace

  while (actualQuantity > 0) {
    const quote = getOpeningCreditQuote(
      dailyCaseDef.cost,
      useOpeningCredits ? state.dailyRewards.openingCredits : 0,
      actualQuantity,
    )
    if (quote.cashCost <= currentMoney) break
    actualQuantity -= 1
  }

  if (actualQuantity <= 0) {
    return failOpenCase(
      state,
      caseId,
      freeSlots <= 0
        ? 'Inventory is full. Sell items or expand the Warehouse before opening another case.'
        : 'Not enough money to open this case.',
      openingEventId,
    )
  }

  const discoveredAt = openedAt
  const openedItems: SkinInstance[] = []
  const autoSoldItems: SkinInstance[] = []
  let collectionBook = state.collectionBook
  let inventory = state.inventory
  const knownSkinIds = new Set(state.collectionBook.map((entry) => entry.skinId))
  const discoveredSkinIds = new Set<string>()

  for (let index = 0; index < actualQuantity; index += 1) {
    const skinId = pickDrop(dailyCaseDef.dropTable)
    const skin = skinId ? skinDefinitionsById.get(skinId) : undefined
    const fallbackSkin = skin ?? getFallbackSkinForCase(dailyCaseDef.dropTable)

    if (!fallbackSkin) {
      return failOpenCase(state, caseId, 'Drop table could not be resolved.', openingEventId)
    }

    if (!skin) {
      console.error(`Missing skin "${skinId ?? 'unknown'}" in drop table for case "${caseId}". Falling back to ${fallbackSkin.id}.`)
    }

    const item = createSkinInstance(fallbackSkin, state, discoveredAt)
    if (!knownSkinIds.has(item.id)) discoveredSkinIds.add(item.id)
    openedItems.push(item)
    collectionBook = updateCollectionBook(collectionBook, item)
    inventory = [item, ...inventory]

    const directSaleItems = shouldAutoSell(item, state.autoSellRules, inventory) ? [item] : []
    const duplicateSaleItems = getKeepBestDuplicateSaleCandidates(inventory, state.autoSellRules)
    const saleItemsById = new Map(
      [...directSaleItems, ...duplicateSaleItems].map((saleItem) => [saleItem.instanceId, saleItem]),
    )

    if (saleItemsById.size > 0) {
      const soldIds = new Set(saleItemsById.keys())
      autoSoldItems.push(...[...saleItemsById.values()].map((saleItem) => ({
        ...saleItem,
        marketValue: getAutomationSaleValue(state, saleItem),
      })))
      inventory = inventory.filter((inventoryItem) => !soldIds.has(inventoryItem.instanceId))
    }
  }

  const openingCreditQuote = getOpeningCreditQuote(
    dailyCaseDef.cost,
    useOpeningCredits ? state.dailyRewards.openingCredits : 0,
    actualQuantity,
  )
  const totalCost = openingCreditQuote.cashCost
  const autoSellValue = roundCurrency(
    autoSoldItems.reduce((total, item) => total + item.marketValue, 0),
  )
  const money = roundCurrency(currentMoney - totalCost + autoSellValue)
  const rareDrops = openedItems.filter((item) => isRareDrop(item.rarity)).length
  const patternDrops = openedItems.filter(isSpecialPattern).length
  const exceptionalPatternDrops = openedItems.filter(isExceptionalPattern).length
  const dropsByRarity = openedItems.reduce(
    (counts, item) => ({
      ...counts,
      [item.rarity]: counts[item.rarity] + 1,
    }),
    state.statistics.dropsByRarity,
  )
  const casesOpened = state.statistics.casesOpened + actualQuantity
  const partialOpenMessage =
    actualQuantity < quantity ? `Opened ${actualQuantity} of ${quantity} requested cases.` : undefined
  const events: GameUiEvent[] = [
    {
      id: openingEventId ?? nanoid(),
      type: 'case_opening_started',
      caseId,
      quantity: actualQuantity,
      cashCost: totalCost,
      createdAt: discoveredAt,
    },
    ...openedItems.map((item) => ({
      id: nanoid(),
      type: 'drop_revealed' as const,
      caseId,
      item,
      createdAt: item.discoveredAt,
    })),
    ...(autoSoldItems.length > 0
      ? [
          {
            id: nanoid(),
            type: 'items_auto_sold' as const,
            items: autoSoldItems,
            itemCount: autoSoldItems.length,
            salePrice: autoSellValue,
            createdAt: discoveredAt,
          },
        ]
      : []),
  ]

  const openedState = withInventoryValuation({
    ...state,
    money,
    dailyRewards: {
      ...state.dailyRewards,
      openingCredits: roundCurrency(
        Math.max(0, state.dailyRewards.openingCredits - openingCreditQuote.creditUsed),
      ),
    },
    inventory,
    collectionBook,
    currentRunCollectionBook: openedItems.reduce(updateCollectionBook, state.currentRunCollectionBook),
    recentDrops: [...openedItems, ...state.recentDrops].slice(0, RECENT_DROPS_LIMIT),
    lastOpenedItems: openedItems,
    // Backward-compatible tombstone only. First openings no longer alter results
    // or insert a fabricated Gold near-miss into the reel.
    hasUsedFirstCaseHook: true,
    lastError: partialOpenMessage,
    uiEvents: appendEvents(state, events),
    casesUnlocked: getUnlockedCaseIdsAfterOpening(state, casesOpened),
    statistics: {
      ...state.statistics,
      casesOpened,
      drops: state.statistics.drops + openedItems.length,
      rareDrops: state.statistics.rareDrops + rareDrops,
      patternDrops: state.statistics.patternDrops + patternDrops,
      exceptionalPatternDrops: state.statistics.exceptionalPatternDrops + exceptionalPatternDrops,
      moneySpent: roundCurrency(state.statistics.moneySpent + totalCost),
      moneyEarned: roundCurrency(state.statistics.moneyEarned + autoSellValue),
      itemSaleRevenue: roundCurrency(state.statistics.itemSaleRevenue + autoSellValue),
      itemsSold: state.statistics.itemsSold + autoSoldItems.length,
      dropsByRarity,
    },
  }, discoveredAt)
  const caseProgressState = withDailyChallengeProgress(
    openedState,
    {
      type: 'cases_opened',
      amount: actualQuantity,
      caseId,
      sessionId: openingEventId,
    },
    discoveredAt,
  )
  const dropProgressState = withDropChallengeProgress(caseProgressState, openedItems, discoveredAt)
  const discoveryProgressState = discoveredSkinIds.size > 0
    ? withDailyChallengeProgress(
        dropProgressState,
        { type: 'skins_discovered', skinIds: [...discoveredSkinIds] },
        discoveredAt,
      )
    : dropProgressState
  const sessionProgressState = openingEventId
    ? withDailyChallengeProgress(
        discoveryProgressState,
        { type: 'opening_session', sessionId: openingEventId },
        discoveredAt,
      )
    : discoveryProgressState
  const collectionProgressState = withDailyChallengeProgress(
    sessionProgressState,
    { type: 'collection_size', amount: collectionBook.length },
    discoveredAt,
  )

  return autoSellValue > 0
    ? withDailyChallengeProgress(
        collectionProgressState,
        {
          type: 'sell_value',
          amount: autoSellValue,
        },
        discoveredAt,
      )
    : collectionProgressState
}

function failAutomation(state: GameState, message: string): GameState {
  return {
    ...state,
    automation: {
      ...state.automation,
      autoOpener: {
        ...state.automation.autoOpener,
        isEnabled: false,
      },
    },
    lastError: message,
  }
}

function failAutomationModule(
  state: GameState,
  moduleId: AutomationModuleId,
  message: string,
): GameState {
  const moduleState = state.automation.modules[moduleId]

  return {
    ...state,
    automation: {
      ...state.automation,
      modules: {
        ...state.automation.modules,
        [moduleId]: {
          ...moduleState,
          isEnabled: false,
        },
      },
    },
    lastError: message,
  }
}

function purchaseAutoOpener(state: GameState, caseId?: string, now = Date.now()): GameState {
  if (state.business.authoritative) return { ...state, lastError: 'Auto Opener has retired. Hire and configure the Case Operator on the Business page.' }
  const currentAutoOpener = state.automation.autoOpener

  if (currentAutoOpener.level >= AUTO_OPENER_MAX_LEVEL) {
    return {
      ...state,
      lastError: 'Auto Opener is already at its effective maximum level.',
    }
  }
  const cost = getAutoOpenerUpgradeCost(currentAutoOpener.level)

  if (clampNumber(state.money) < cost) {
    return {
      ...state,
      lastError: 'Not enough money to purchase Auto Opener.',
    }
  }

  const nextLevel = currentAutoOpener.level + 1

  return {
    ...state,
    money: roundCurrency(clampNumber(state.money) - cost),
    automation: {
      ...state.automation,
      autoOpener: {
        ...currentAutoOpener,
        caseId: caseId ?? currentAutoOpener.caseId ?? 'starter_case',
        intervalMs: getAutoOpenerIntervalMs(nextLevel),
        isEnabled: true,
        lastOpenTime: now,
        level: nextLevel,
      },
    },
    lastError: undefined,
    statistics: {
      ...state.statistics,
      moneySpent: roundCurrency(state.statistics.moneySpent + cost),
    },
  }
}

function purchaseAutomationModule(
  state: GameState,
  moduleId: AutomationModuleId,
  now = Date.now(),
): GameState {
  if (state.business.authoritative && moduleId !== AutomationModuleId.WarehouseSystem && moduleId !== AutomationModuleId.AuctionHouse) {
    return { ...state, lastError: 'This legacy module has retired. Its replacement is managed through Business employees.' }
  }
  const moduleState = state.automation.modules[moduleId]
  const definition = AUTOMATION_MODULE_DEFINITIONS[moduleId]

  if (!moduleState || !definition) {
    return { ...state, lastError: 'Automation module not found.' }
  }

  if (moduleState.level >= definition.maxLevel) {
    return { ...state, lastError: `${definition.name} is already maxed.` }
  }
  const cost = getAutomationModuleUpgradeCost(moduleId, moduleState.level)

  if (clampNumber(state.money) < cost) {
    return {
      ...state,
      lastError: 'Not enough money to purchase automation upgrade.',
    }
  }

  const nextLevel = moduleState.level + 1
  const consumesSlot = moduleId !== AutomationModuleId.WarehouseSystem
  const activeModuleCount = Object.values(state.automation.modules).filter((candidate) => (
    candidate.id !== AutomationModuleId.WarehouseSystem && candidate.level > 0 && candidate.isEnabled
  )).length
  const hasOpenSlot = !consumesSlot || moduleState.isEnabled || activeModuleCount < getAutomationModuleCapacity(state.upgrades)

  return {
    ...state,
    money: roundCurrency(clampNumber(state.money) - cost),
    automation: {
      ...state.automation,
      modules: {
        ...state.automation.modules,
        [moduleId]: {
          ...moduleState,
          isEnabled: hasOpenSlot,
          lastRunTime: moduleState.level > 0 ? moduleState.lastRunTime : now,
          level: nextLevel,
        },
      },
    },
    lastError: hasOpenSlot
      ? undefined
      : 'Upgrade purchased. Enable it after pausing another module or expanding Module Bays.',
    statistics: {
      ...state.statistics,
      moneySpent: roundCurrency(state.statistics.moneySpent + cost),
    },
  }
}

function purchaseUpgrade(state: GameState, _upgradeId: UpgradeId): GameState {
  void _upgradeId
  return {
    ...state,
    lastError: 'Legacy run upgrades are archived. Use Career & Upgrades for active progression.',
  }
}

function purchaseCareerUpgrade(state: GameState, upgradeId: string, now = Date.now()): GameState {
  const definition = careerUpgradesById.get(upgradeId)
  if (!definition) return { ...state, lastError: 'Career upgrade not found.' }
  const purchase = getCareerUpgradeStatus(definition, {
    career: state.career,
    money: state.money,
    upgrades: state.careerUpgrades,
  })
  if (purchase.isMaxLevel) return { ...state, lastError: 'Career upgrade is already maxed.' }
  if (!purchase.levelMet) return { ...state, lastError: `Career level ${definition.requiredLevel} is required.` }
  if (!purchase.activityMet) return { ...state, lastError: 'More activity in this specialization is required.' }
  if (!purchase.prerequisitesMet) return { ...state, lastError: 'Career upgrade prerequisites are not met.' }
  if (!purchase.canAfford) return { ...state, lastError: 'Not enough cash or transition credit.' }

  const creditUsed = purchase.creditUsed
  const cashCost = purchase.cashCost
  return {
    ...state,
    money: roundCurrency(clampNumber(state.money) - cashCost),
    careerUpgrades: {
      ...state.careerUpgrades,
      levels: {
        ...state.careerUpgrades.levels,
        [definition.id]: purchase.level + 1,
      },
      purchasedAt: {
        ...state.careerUpgrades.purchasedAt,
        [definition.id]: now,
      },
      migration: {
        ...state.careerUpgrades.migration,
        transitionCredit: roundCurrency(state.careerUpgrades.migration.transitionCredit - creditUsed),
      },
    },
    lastError: undefined,
    statistics: {
      ...state.statistics,
      moneySpent: roundCurrency(state.statistics.moneySpent + cashCost),
    },
  }
}

function purchasePrestigeBonus(state: GameState, _bonusId: PrestigeBonusId): GameState {
  void _bonusId
  return {
    ...state,
    lastError: 'Legacy Prestige bonuses were retired in save v38. Use the permanent perk tree.',
  }
}

function learnSkillNode(state: GameState, _nodeId: SkillNodeId): GameState {
  void _nodeId
  return {
    ...state,
    lastError: 'The legacy Skill Tree is archived. Its investment was converted once in save v37.',
  }
}

function assignTrophyItem(
  state: GameState,
  slotId: string,
  itemId: string,
  now = Date.now(),
): GameState {
  if (!isUnlockedTrophySlot(slotId, state.learnedSkillNodeIds, state.careerUpgrades)) {
    return {
      ...state,
      lastError: 'Trophy slot not found.',
    }
  }

  const item = state.inventory.find((inventoryItem) => inventoryItem.instanceId === itemId)

  if (!item) {
    return {
      ...state,
      lastError: 'Trophy item must be in your inventory before it can be assigned.',
    }
  }

  return {
    ...state,
    trophyAssignments: {
      ...state.trophyAssignments,
      [slotId]: {
        slotId,
        itemId: item.instanceId,
        assignedAt: now,
      },
    },
    lastError: undefined,
  }
}

function removeTrophyItem(state: GameState, slotId: string): GameState {
  if (!state.trophyAssignments[slotId]) {
    return state
  }

  const nextAssignments = { ...state.trophyAssignments }

  delete nextAssignments[slotId]

  return {
    ...state,
    trophyAssignments: nextAssignments,
    lastError: undefined,
  }
}

function prestigeRun(
  state: GameState,
  requestId: string,
  sourceRunId: string,
  vaultItemIds: string[],
  backupProof: string,
  now = Date.now(),
): GameState {
  if (!requestId || state.prestigeSystem.completedRequestIds.includes(requestId)) return state
  if (sourceRunId !== state.economyLedger.currentRunId || !requestId.includes(sourceRunId)) {
    return { ...state, lastError: 'Prestige request belongs to a different run. No progress was reset.' }
  }
  if (!backupProof || backupProof !== createPrestigeRecoveryProof(state)) {
    return { ...state, lastError: 'Prestige recovery backup was not verified for this exact run state. No progress was reset.' }
  }
  const eligibility = getPrestigeEligibilityV2(state)
  if (!eligibility.canPrestige) return { ...state, lastError: eligibility.reasons[0] ?? 'Prestige requirements are not complete.' }
  const vaultSelection = validateVaultSelection(state, vaultItemIds)
  if (!vaultSelection.valid) return { ...state, lastError: `Choose no more than ${vaultSelection.capacity} owned Legacy Vault items.` }
  const selectedIds = new Set(vaultSelection.unique)
  const vaultedItems = cloneVaultItems(state.inventory.filter((item) => selectedIds.has(item.instanceId)))
  const awardedPoints = calculatePrestigePointsV2(state)
  const tier = eligibility.tier
  const startingMoney = roundCurrency(getCareerPrestigeStartingCash(state.prestigeSystem))
  const prestigeEvent: GameUiEvent = {
    id: nanoid(),
    type: 'prestige_completed',
    awardedPoints,
    prestigeLevel: state.prestigeLevel + 1,
    createdAt: now,
  }

  const prestigedState = withInventoryValuation({
    ...defaultGameState,
    statistics: { ...defaultGameState.statistics, itemSaleRevenue: state.statistics.itemSaleRevenue },
    achievementLifetime: {
      casesOpened: state.achievementLifetime.casesOpened + state.statistics.casesOpened,
      moneySpent: roundCurrency(state.achievementLifetime.moneySpent + state.statistics.moneySpent),
      tradeUpsCompleted: state.achievementLifetime.tradeUpsCompleted + state.statistics.tradeUpsCompleted,
      auctionPurchases: state.achievementLifetime.auctionPurchases + state.statistics.auctionPurchases,
      dropsByRarity: Object.fromEntries(Object.entries(state.statistics.dropsByRarity).map(([rarity, count]) => [rarity, count + state.achievementLifetime.dropsByRarity[rarity as Rarity]])) as typeof state.statistics.dropsByRarity,
    },
    money: startingMoney,
    inventory: vaultedItems,
    prestigeLevel: state.prestigeLevel + 1,
    prestigePoints: state.prestigePoints + awardedPoints,
    prestigeBonuses: state.prestigeBonuses,
    prestigeSystem: {
      ...state.prestigeSystem,
      highestTier: Math.max(state.prestigeSystem.highestTier, tier.tier),
      completedRuns: state.prestigeSystem.completedRuns + 1,
      totalPointsEarned: state.prestigeSystem.totalPointsEarned + awardedPoints,
      completedRequestIds: [...state.prestigeSystem.completedRequestIds, requestId].slice(-96),
      lastCompletion: { requestId, completedAt: now, tier: tier.tier, score: eligibility.score.total, awardedPoints },
      runHistory: [{
        id: `prestige-run:${requestId}`,
        requestId,
        runId: state.economyLedger.currentRunId,
        startedAt: state.economyLedger.currentRunStartedAt,
        endedAt: now,
        durationMs: Math.max(0, now - state.economyLedger.currentRunStartedAt),
        tier: tier.tier,
        tierName: tier.name,
        score: eligibility.score.total,
        awardedPoints,
        endingCash: state.money,
        endingInventoryValue: state.inventoryValue,
        careerXp: state.career.currentRunXp,
        highestCareerLevel: getCareerLevelFromXp(state.career.currentRunXp),
        realizedProfit: state.economyLedger.currentRun.realizedTradingProfit,
        collectionDiscoveries: state.currentRunCollectionBook.length,
        businessResult: state.economyLedger.currentRun.businessRevenue - state.economyLedger.currentRun.businessExpenses,
        pathsCompleted: eligibility.paths.filter((path) => path.primaryMet).map((path) => path.id),
        vaultedItemIds: vaultedItems.map((item) => item.instanceId),
      }, ...state.prestigeSystem.runHistory].slice(0, 24),
    },
    // Legacy Skill Points remain a historical counter. Prestige no longer
    // mints an obsolete currency after the v37 Career migration.
    skillPoints: state.skillPoints,
    learnedSkillNodeIds: state.learnedSkillNodeIds,
    achievements: state.achievements.filter((progress) => {
      const definition = achievementsById.get(progress.id)
      return !definition || getAchievementScope(definition) === 'lifetime'
    }),
    collectionBook: state.collectionBook,
    quests: resetQuestsForPrestige(state.quests, now),
    dropJournal: state.dropJournal,
    collectionRewards: state.collectionRewards,
    trophyAssignments: Object.fromEntries(Object.entries(state.trophyAssignments).filter(([, assignment]) => assignment && selectedIds.has(assignment.itemId))),
    settings: state.settings,
    ui: state.ui,
    business: {
      ...defaultGameState.business,
      migrationApplied: state.business.migrationApplied,
      migratedAt: state.business.migratedAt,
      transitionCreditGranted: state.business.transitionCreditGranted,
      transitionCredit: 0,
      legacyOperatingCapacity: state.business.legacyOperatingCapacity,
      lastSchedulerAt: now,
      dailyUsage: refreshBusinessDay(defaultGameState.business, now).dailyUsage,
    },
    careerUpgrades: resetCareerUpgradesForPrestige(
      state.careerUpgrades,
      Math.min(.25, state.prestigeSystem.perkLevels.researchRetention * .05),
    ),
    uiEvents: appendEvents(state, [prestigeEvent]),
    lastError: undefined,
    lastSaved: now,
  }, now)

  const economyLedger = startNextEconomyRun(state, prestigedState, now)
  economyLedger.itemCostBasis = Object.fromEntries(vaultedItems.flatMap((item) => {
    const basis = state.economyLedger.itemCostBasis[item.instanceId]
    return basis === undefined ? [] : [[item.instanceId, basis]]
  }))
  return {
    ...prestigedState,
    economyLedger,
    career: startNextCareerRun(state.career, economyLedger.currentRunId, now),
  }
}

function setAutoOpenerCase(state: GameState, caseId: string): GameState {
  return {
    ...state,
    automation: {
      ...state.automation,
      autoOpener: {
        ...state.automation.autoOpener,
        caseId,
      },
    },
  }
}

function toggleAutomationModule(
  state: GameState,
  moduleId: AutomationModuleId,
  isEnabled?: boolean,
  now = Date.now(),
): GameState {
  if (state.business.authoritative && moduleId !== AutomationModuleId.WarehouseSystem && moduleId !== AutomationModuleId.AuctionHouse) {
    return { ...state, lastError: 'This legacy module is retired and cannot run alongside Business employees.' }
  }
  const moduleState = state.automation.modules[moduleId]

  if (moduleState.level <= 0) {
    return {
      ...state,
      lastError: 'Purchase this automation module before enabling it.',
    }
  }

  const nextIsEnabled = typeof isEnabled === 'boolean' ? isEnabled : !moduleState.isEnabled

  if (nextIsEnabled && moduleId !== AutomationModuleId.WarehouseSystem) {
    const activeModuleCount = Object.values(state.automation.modules).filter((candidate) => (
      candidate.id !== AutomationModuleId.WarehouseSystem && candidate.level > 0 && candidate.isEnabled
    )).length

    if (!moduleState.isEnabled && activeModuleCount >= getAutomationModuleCapacity(state.upgrades)) {
      return {
        ...state,
        lastError: 'All automation slots are occupied. Pause a module or expand Module Bays.',
      }
    }
  }

  return {
    ...state,
    automation: {
      ...state.automation,
      modules: {
        ...state.automation.modules,
        [moduleId]: {
          ...moduleState,
          isEnabled: nextIsEnabled,
          lastRunTime: nextIsEnabled ? now : moduleState.lastRunTime,
        },
      },
    },
    lastError: undefined,
  }
}

function toggleAutoOpener(state: GameState, isEnabled?: boolean, now = Date.now()): GameState {
  if (state.business.authoritative) return { ...state, lastError: 'Auto Opener has retired. Use the Case Operator instead.' }
  const autoOpener = state.automation.autoOpener

  if (autoOpener.level <= 0) {
    return {
      ...state,
      lastError: 'Purchase Auto Opener before enabling automation.',
    }
  }

  const nextIsEnabled = typeof isEnabled === 'boolean' ? isEnabled : !autoOpener.isEnabled

  return {
    ...state,
    automation: {
      ...state.automation,
      autoOpener: {
        ...autoOpener,
        isEnabled: nextIsEnabled,
        lastOpenTime: nextIsEnabled ? now : autoOpener.lastOpenTime,
      },
    },
    lastError: undefined,
  }
}

function tickAutoOpener(state: GameState, now = Date.now()): GameState {
  const autoOpener = state.automation.autoOpener

  if (!autoOpener.isEnabled || autoOpener.level <= 0 || !autoOpener.caseId) {
    return state
  }

  const intervalMs = Math.round(
    autoOpener.intervalMs *
    getUpgradeAutomationIntervalMultiplier(state.upgrades) *
    getPrestigeAutomationIntervalMultiplier(state.prestigeBonuses) *
    getSkillAutomationIntervalMultiplier(state.learnedSkillNodeIds),
  )

  if (now - autoOpener.lastOpenTime < intervalMs) {
    return state
  }

  const caseDef = CASE_DEFINITIONS.find((definition) => definition.id === autoOpener.caseId)

  if (!caseDef || !canOpenCase(caseDef, state)) {
    return failAutomation(state, 'Auto Opener paused: selected case is unavailable.')
  }

  const dailyCaseDef = getEffectiveCaseDefinition(state, caseDef, now)

  if (clampNumber(state.money) < dailyCaseDef.cost) {
    return failAutomation(state, 'Auto Opener paused: not enough money.')
  }

  const openedState = openCase(state, autoOpener.caseId, 1, now)

  if (openedState.statistics.casesOpened === state.statistics.casesOpened) {
    return failAutomation(openedState, openedState.lastError ?? 'Auto Opener paused.')
  }

  return {
    ...openedState,
    automation: {
      ...openedState.automation,
      autoOpener: {
        ...openedState.automation.autoOpener,
        isEnabled: true,
        lastOpenTime: now,
        totalOpened: openedState.automation.autoOpener.totalOpened + 1,
      },
    },
  }
}

function tickOpeningDesk(state: GameState, now = Date.now()): GameState {
  const moduleState = state.automation.modules[AutomationModuleId.OpeningDesk]

  if (!moduleState.isEnabled || moduleState.level <= 0) {
    return state
  }

  const intervalMs = Math.round(
    getOpeningDeskIntervalMs(moduleState.level) *
    getUpgradeAutomationIntervalMultiplier(state.upgrades) *
    getPrestigeAutomationIntervalMultiplier(state.prestigeBonuses) *
    getSkillAutomationIntervalMultiplier(state.learnedSkillNodeIds),
  )

  if (now - moduleState.lastRunTime < intervalMs) {
    return state
  }

  const caseId = state.automation.autoOpener.caseId ?? 'starter_case'
  const caseDef = CASE_DEFINITIONS.find((definition) => definition.id === caseId)

  if (!caseDef || !canOpenCase(caseDef, state)) {
    return failAutomationModule(
      state,
      AutomationModuleId.OpeningDesk,
      'Opening Desk paused: selected case is unavailable.',
    )
  }

  const dailyCaseDef = getEffectiveCaseDefinition(state, caseDef, now)

  if (clampNumber(state.money) < dailyCaseDef.cost) {
    return failAutomationModule(
      state,
      AutomationModuleId.OpeningDesk,
      'Opening Desk paused: not enough money.',
    )
  }

  const openedState = openCase(state, caseId, getOpeningDeskBatchSize(moduleState.level), now)
  const openedCount = openedState.statistics.casesOpened - state.statistics.casesOpened

  if (openedCount <= 0) {
    return failAutomationModule(
      openedState,
      AutomationModuleId.OpeningDesk,
      openedState.lastError ?? 'Opening Desk paused.',
    )
  }

  const latestModuleState = openedState.automation.modules[AutomationModuleId.OpeningDesk]

  return {
    ...openedState,
    automation: {
      ...openedState.automation,
      modules: {
        ...openedState.automation.modules,
        [AutomationModuleId.OpeningDesk]: {
          ...latestModuleState,
          isEnabled: true,
          lastRunTime: now,
          totalGenerated: latestModuleState.totalGenerated + openedCount,
          totalRuns: latestModuleState.totalRuns + 1,
        },
      },
    },
  }
}

function tickCaseFarm(state: GameState, now = Date.now()): GameState {
  const moduleState = state.automation.modules[AutomationModuleId.CaseFarm]

  if (state.business.authoritative || !moduleState.isEnabled || moduleState.level <= 0) {
    return state
  }

  const intervalMs = Math.round(
    CASE_FARM_INTERVAL_MS *
    getUpgradeAutomationIntervalMultiplier(state.upgrades) *
    getPrestigeAutomationIntervalMultiplier(state.prestigeBonuses) *
    getSkillAutomationIntervalMultiplier(state.learnedSkillNodeIds),
  )

  if (now - moduleState.lastRunTime < intervalMs) {
    return state
  }

  const income = roundCurrency(
    getCaseFarmIncomePerTick(moduleState.level, state.casesUnlocked.length) *
      getSkillPassiveIncomeMultiplier(state.learnedSkillNodeIds),
  )

  return {
    ...state,
    money: roundCurrency(clampNumber(state.money) + income),
    automation: {
      ...state.automation,
      modules: {
        ...state.automation.modules,
        [AutomationModuleId.CaseFarm]: {
          ...moduleState,
          lastRunTime: now,
          totalGenerated: roundCurrency(moduleState.totalGenerated + income),
          totalRuns: moduleState.totalRuns + 1,
        },
      },
    },
    lastError: undefined,
  }
}

function tickTradingBot(state: GameState, now = Date.now()): GameState {
  const moduleState = state.automation.modules[AutomationModuleId.TradingBot]

  if (!moduleState.isEnabled || moduleState.level <= 0) {
    return state
  }

  const intervalMs = Math.round(
    TRADING_BOT_INTERVAL_MS *
    getUpgradeAutomationIntervalMultiplier(state.upgrades) *
    getPrestigeAutomationIntervalMultiplier(state.prestigeBonuses) *
    getSkillAutomationIntervalMultiplier(state.learnedSkillNodeIds),
  )

  if (now - moduleState.lastRunTime < intervalMs) {
    return state
  }

  const [suggestion] = suggestBestTradeUps({
    inventory: state.inventory,
    marketValues: state.marketValues,
    limit: 1,
  })
  const minimumProfit = roundCurrency(
    getTradingBotMinimumProfit(moduleState.level) *
    getSkillTradeUpInputCostMultiplier(state.learnedSkillNodeIds) *
    getGameEventTradeUpInputCostMultiplier(state.activeEvents),
  )

  if (!suggestion || suggestion.analysis.expectedProfit < minimumProfit) {
    return {
      ...state,
      automation: {
        ...state.automation,
        modules: {
          ...state.automation.modules,
          [AutomationModuleId.TradingBot]: {
            ...moduleState,
            lastRunTime: now,
            totalRuns: moduleState.totalRuns + 1,
          },
        },
      },
    }
  }

  const tradedState = tradeUpItems(
    state,
    suggestion.inputItems.map((item) => item.instanceId),
  )
  const latestModuleState = tradedState.automation.modules[AutomationModuleId.TradingBot]

  return {
    ...tradedState,
    automation: {
      ...tradedState.automation,
      modules: {
        ...tradedState.automation.modules,
        [AutomationModuleId.TradingBot]: {
          ...latestModuleState,
          lastRunTime: now,
          totalGenerated: roundCurrency(
            latestModuleState.totalGenerated + suggestion.analysis.expectedProfit,
          ),
          totalRuns: latestModuleState.totalRuns + 1,
        },
      },
    },
  }
}

function pickAuctionSkin(state: GameState, level: number, prng: Prng) {
  const affordableCeiling = Math.max(250, clampNumber(state.money) * 3)
  const regularCandidates = SKIN_DEFINITIONS.filter((skin) => {
    const value = state.marketValues[skin.id] ?? skin.baseValue

    return Number.isFinite(value) && value > 0 && value <= affordableCeiling
  })
  const premiumCandidates = SKIN_DEFINITIONS.filter((skin) => (
    skin.rarity === Rarity.Classified ||
    skin.rarity === Rarity.Covert ||
    skin.rarity === Rarity.SpecialItem ||
    skin.rarity === Rarity.Contraband
  ))
  const rareDealChance = Math.min(0.06, 0.01 + level * 0.006)
  const candidates = prng() < rareDealChance && premiumCandidates.length > 0
    ? premiumCandidates
    : regularCandidates.length > 0
      ? regularCandidates
      : SKIN_DEFINITIONS

  return candidates[Math.min(candidates.length - 1, Math.floor(prng() * candidates.length))]
}

function tickAuctionHouse(state: GameState, now = Date.now(), prng: Prng = Math.random): GameState {
  const moduleState = state.automation.modules[AutomationModuleId.AuctionHouse]
  const existingDeals = state.automation.auctionHouse.deals.filter((deal) => deal.expiresAt > now)

  if (!moduleState.isEnabled || moduleState.level <= 0) {
    if (existingDeals.length === state.automation.auctionHouse.deals.length) {
      return state
    }

    return {
      ...state,
      automation: {
        ...state.automation,
        auctionHouse: {
          ...state.automation.auctionHouse,
          deals: existingDeals,
        },
      },
    }
  }

  if (state.automation.auctionHouse.nextRefreshTime > now && existingDeals.length > 0) {
    return existingDeals.length === state.automation.auctionHouse.deals.length
      ? state
      : {
          ...state,
          automation: {
            ...state.automation,
            auctionHouse: {
              ...state.automation.auctionHouse,
              deals: existingDeals,
            },
          },
        }
  }

  const dealCount = getAuctionHouseDealCount(
    moduleState.level,
    getSkillAuctionDealSlotBonus(state.learnedSkillNodeIds),
  )
  const maxDiscount = getAuctionHouseDiscount(moduleState.level)
  const deals = Array.from({ length: dealCount }, (_, index) => {
    const skin = pickAuctionSkin(state, moduleState.level, prng)
    const item = createSkinInstance(skin, state, now, undefined, prng)
    const discount = Number((maxDiscount * (0.55 + prng() * 0.45)).toFixed(3))
    const listPrice = Math.max(0.01, item.marketValue)

    return {
      id: `auction-${now}-${index}-${Math.floor(prng() * 1_000_000)}`,
      item,
      listPrice,
      price: roundCurrency(Math.max(0.01, listPrice * (1 - discount))),
      discount,
      createdAt: now,
      expiresAt: now + AUCTION_HOUSE_DEAL_DURATION_MS,
    }
  })
  const refreshMs = getAuctionHouseRefreshMs(moduleState.level)

  return {
    ...state,
    automation: {
      ...state.automation,
      auctionHouse: {
        deals,
        lastRefreshTime: now,
        nextRefreshTime: now + refreshMs,
      },
      modules: {
        ...state.automation.modules,
        [AutomationModuleId.AuctionHouse]: {
          ...moduleState,
          lastRunTime: now,
          totalRuns: moduleState.totalRuns + 1,
        },
      },
    },
    lastError: undefined,
  }
}

function purchaseAuctionDeal(state: GameState, dealId: string, now = Date.now()): GameState {
  const deal = state.automation.auctionHouse.deals.find((candidate) => candidate.id === dealId)

  if (!deal || deal.expiresAt <= now) {
    return {
      ...state,
      lastError: 'This Auction House deal is no longer available.',
      automation: {
        ...state.automation,
        auctionHouse: {
          ...state.automation.auctionHouse,
          deals: state.automation.auctionHouse.deals.filter((candidate) => candidate.expiresAt > now),
        },
      },
    }
  }

  if (!hasInventorySpace(state)) {
    return {
      ...state,
      lastError: 'Inventory is full. Sell items or expand the Warehouse before buying this deal.',
    }
  }

  if (clampNumber(state.money) < deal.price) {
    return {
      ...state,
      lastError: 'Not enough money to purchase this Auction House deal.',
    }
  }

  const purchasedItem: SkinInstance = {
    ...deal.item,
    instantSaleAvailableAt: now + AUCTION_INSTANT_RESALE_COOLDOWN_MS,
  }
  const nextState = withInventoryValuation({
    ...state,
    money: roundCurrency(clampNumber(state.money) - deal.price),
    inventory: [purchasedItem, ...state.inventory],
    collectionBook: updateCollectionBook(state.collectionBook, purchasedItem),
    currentRunCollectionBook: updateCollectionBook(state.currentRunCollectionBook, purchasedItem),
    recentDrops: [purchasedItem, ...state.recentDrops].slice(0, RECENT_DROPS_LIMIT),
    lastOpenedItems: [purchasedItem],
    automation: {
      ...state.automation,
      auctionHouse: {
        ...state.automation.auctionHouse,
        deals: state.automation.auctionHouse.deals.filter((candidate) => candidate.id !== dealId),
      },
    },
    statistics: {
      ...state.statistics,
      auctionPurchases: state.statistics.auctionPurchases + 1,
      auctionSavings: roundCurrency(state.statistics.auctionSavings + deal.listPrice - deal.price),
      moneySpent: roundCurrency(state.statistics.moneySpent + deal.price),
      patternDrops: state.statistics.patternDrops + (isSpecialPattern(purchasedItem) ? 1 : 0),
      exceptionalPatternDrops: state.statistics.exceptionalPatternDrops + (isExceptionalPattern(purchasedItem) ? 1 : 0),
    },
    lastError: undefined,
  }, now)

  return withDropChallengeProgress(nextState, [purchasedItem], now)
}

function tickAutomation(state: GameState, now = Date.now(), prng: Prng = Math.random): GameState {
  // Save schema v36 makes Business the only authority for employee work. The
  // legacy scheduler remains solely for the independent Auction House market.
  if (state.business.authoritative) return tickAuctionHouse(state, now, prng)
  let nextState = tickAutoOpener(state, now)
  nextState = tickOpeningDesk(nextState, now)
  nextState = tickCaseFarm(nextState, now)
  nextState = tickTradingBot(nextState, now)
  return tickAuctionHouse(nextState, now, prng)
}

function appendBusinessProcessedId(state: GameState, requestId: string) {
  if (state.business.processedOperationIds.includes(requestId)) return state
  return {
    ...state,
    business: {
      ...state.business,
      processedOperationIds: [...state.business.processedOperationIds, requestId].slice(-800),
    },
  }
}

function spendWithTransitionCredit(state: GameState, cost: number) {
  const creditUsed = Math.min(state.business.transitionCredit, cost)
  const cashCost = roundCurrency(cost - creditUsed)
  if (state.money < cashCost) return undefined
  return {
    cashCost,
    creditUsed,
    state: {
      ...state,
      money: roundCurrency(state.money - cashCost),
      business: { ...state.business, transitionCredit: roundCurrency(state.business.transitionCredit - creditUsed) },
      statistics: { ...state.statistics, moneySpent: roundCurrency(state.statistics.moneySpent + cashCost) },
    },
  }
}

function getEffectiveEmployeeInterval(state: GameState, roleId: EmployeeRoleId, trainingLevel: number) {
  return Math.max(10_000, Math.round(
    getEmployeeOperationInterval(roleId, trainingLevel) * getCareerBusinessIntervalMultiplier(state.careerUpgrades),
  ))
}

function getEffectiveEmployeeHourlyWage(state: GameState, roleId: EmployeeRoleId, trainingLevel: number) {
  return roundCurrency(
    getEmployeeHourlyWage(roleId, trainingLevel) *
      (1 - getCareerPayrollDiscount(state.careerUpgrades)) *
      getPrestigeBusinessCostMultiplier(state.prestigeSystem),
  )
}

function getEffectiveCaseOperatorBatch(state: GameState, trainingLevel: number) {
  return Math.min(10, getCaseOperatorMaximumBatch(trainingLevel) + getCareerCaseOperatorBatchBonus(state.careerUpgrades))
}

function hireBusinessEmployee(state: GameState, roleId: EmployeeRoleId, requestId: string, now: number) {
  if (state.business.processedOperationIds.includes(requestId)) return state
  const employee = state.business.employees[roleId]
  if (!employee || employee.isHired) return { ...state, lastError: employee ? `${EMPLOYEE_ROLE_DEFINITIONS[roleId].name} is already hired.` : 'Employee role not found.' }
  if (!isEmployeeUnlocked(roleId, state.career)) return { ...state, lastError: `${EMPLOYEE_ROLE_DEFINITIONS[roleId].name} unlocks at Career level ${EMPLOYEE_ROLE_DEFINITIONS[roleId].unlockLevel}.` }
  const purchase = spendWithTransitionCredit(state, getEmployeeHireCost(roleId))
  if (!purchase) return { ...state, lastError: 'Not enough available cash or transition credit to hire this employee.' }
  const hired = {
    ...employee,
    isHired: true,
    status: 'paused' as const,
    payrollSettledThrough: now,
    nextActionAt: now + getEffectiveEmployeeInterval(state, roleId, 0),
    assignment: roleId === 'marketScout' ? 'Scan watchlists' : 'Ready to configure',
  }
  const operation: BusinessOperation = { id: `hire:${requestId}`, employeeRole: roleId, type: 'hire', timestamp: now, description: `Hired ${EMPLOYEE_ROLE_DEFINITIONS[roleId].name}`, grossVolume: 0, revenue: 0, expense: purchase.cashCost, realizedProfit: -purchase.cashCost, relatedItemIds: [] }
  const next = {
    ...purchase.state,
    business: rememberBusinessOperation({ ...purchase.state.business, employees: { ...purchase.state.business.employees, [roleId]: hired } }, operation),
    lastError: purchase.creditUsed > 0 ? `Used $${purchase.creditUsed.toFixed(2)} of legacy Business transition credit.` : undefined,
  }
  return appendBusinessProcessedId(next, requestId)
}

function trainBusinessEmployee(state: GameState, roleId: EmployeeRoleId, requestId: string, now: number) {
  if (state.business.processedOperationIds.includes(requestId)) return state
  const employee = state.business.employees[roleId]
  if (!employee?.isHired) return { ...state, lastError: 'Hire this employee before training.' }
  if (employee.trainingLevel >= BUSINESS_MAX_TRAINING_LEVEL) return { ...state, lastError: 'This employee has reached the effective training maximum.' }
  const cost = roundCurrency(getEmployeeTrainingCost(roleId, employee.trainingLevel) * (1 - getCareerTrainingDiscount(state.careerUpgrades)))
  const purchase = spendWithTransitionCredit(state, cost)
  if (!purchase) return { ...state, lastError: 'Not enough available cash or transition credit for training.' }
  const nextLevel = employee.trainingLevel + 1
  const trained = { ...employee, trainingLevel: nextLevel, nextActionAt: employee.isEnabled ? Math.min(employee.nextActionAt || now, now + getEffectiveEmployeeInterval(state, roleId, nextLevel)) : employee.nextActionAt }
  const operation: BusinessOperation = { id: `training:${requestId}`, employeeRole: roleId, type: 'training', timestamp: now, description: `Trained ${EMPLOYEE_ROLE_DEFINITIONS[roleId].name} to level ${nextLevel}`, grossVolume: 0, revenue: 0, expense: purchase.cashCost, realizedProfit: -purchase.cashCost, relatedItemIds: [] }
  const next = { ...purchase.state, business: rememberBusinessOperation({ ...purchase.state.business, employees: { ...purchase.state.business.employees, [roleId]: trained } }, operation), lastError: undefined }
  return appendBusinessProcessedId(next, requestId)
}

function toggleBusinessEmployee(state: GameState, roleId: EmployeeRoleId, isEnabled: boolean | undefined, now: number) {
  const employee = state.business.employees[roleId]
  if (!employee?.isHired) return { ...state, lastError: 'Hire this employee first.' }
  const enable = isEnabled ?? !employee.isEnabled
  if (enable && getActiveEmployeeCount(state.business) >= getOperatingCapacity(state.business) + getCareerOperatingCapacityBonus(state.careerUpgrades) && !employee.isEnabled) return { ...state, lastError: 'Business operating capacity is full. Pause another employee first.' }
  if (enable && employee.availableCapital < getEffectiveEmployeeHourlyWage(state, roleId, employee.trainingLevel)) return { ...state, lastError: 'Allocate enough operating funds to cover at least one hour of wages.' }
  return {
    ...state,
    business: {
      ...state.business,
      employees: { ...state.business.employees, [roleId]: { ...employee, isEnabled: enable, status: enable ? 'running' : 'paused', lastPauseReason: undefined, payrollSettledThrough: enable ? now : employee.payrollSettledThrough, nextActionAt: enable ? now + getEffectiveEmployeeInterval(state, roleId, employee.trainingLevel) : employee.nextActionAt } },
    },
    lastError: undefined,
  }
}

function updateBusinessEmployeeSettings(state: GameState, roleId: EmployeeRoleId, update: Record<string, unknown>, now: number) {
  const employee = state.business.employees[roleId]
  if (!employee) return state
  const nextSettings = { ...employee.settings } as typeof employee.settings
  const finite = (key: string, fallback: number, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) => {
    const value = Number(update[key] ?? fallback)
    return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback
  }
  if (roleId === 'caseOperator') {
    const caseSettings = employee.settings as typeof state.business.employees.caseOperator.settings
    const caseId = typeof update.caseId === 'string' && CASE_DEFINITIONS.some((entry) => entry.id === update.caseId) ? update.caseId : caseSettings.caseId
    Object.assign(nextSettings, {
      caseId,
      intervalMs: Math.max(getEffectiveEmployeeInterval(state, roleId, employee.trainingLevel), finite('intervalMs', caseSettings.intervalMs, 10_000, 24 * 60 * 60_000)),
      batchSize: Math.max(1, Math.min(getEffectiveCaseOperatorBatch(state, employee.trainingLevel), Math.floor(finite('batchSize', caseSettings.batchSize, 1, 10)))),
      maximumCasesPerShift: Math.floor(finite('maximumCasesPerShift', caseSettings.maximumCasesPerShift, 1, 10_000)),
      minimumWalletReserve: finite('minimumWalletReserve', caseSettings.minimumWalletReserve),
      stopLoss: finite('stopLoss', caseSettings.stopLoss, .01),
      inventoryCapacityReserve: Math.floor(finite('inventoryCapacityReserve', caseSettings.inventoryCapacityReserve, 0, 10_000)),
      allowAutoSell: typeof update.allowAutoSell === 'boolean' ? update.allowAutoSell : caseSettings.allowAutoSell,
    })
  } else if (roleId === 'salesAssistant') {
    const current = employee.settings as typeof state.business.employees.salesAssistant.settings
    Object.assign(nextSettings, {
      intervalMs: Math.max(getEffectiveEmployeeInterval(state, roleId, employee.trainingLevel), finite('intervalMs', current.intervalMs, 10_000, 24 * 60 * 60_000)),
      keepBestDuplicates: Math.floor(finite('keepBestDuplicates', current.keepBestDuplicates, 1, 100)),
      allowedWeapons: Array.isArray(update.allowedWeapons) ? update.allowedWeapons.filter((value): value is string => typeof value === 'string').slice(0, 100) : current.allowedWeapons,
      allowedRarities: Array.isArray(update.allowedRarities) ? update.allowedRarities.filter((value): value is Rarity => Object.values(Rarity).includes(value as Rarity)) : current.allowedRarities,
      maximumItemValue: finite('maximumItemValue', current.maximumItemValue, .01),
      minimumSaleQuote: finite('minimumSaleQuote', current.minimumSaleQuote, 0),
      minimumListingPrice: finite('minimumListingPrice', current.minimumListingPrice, .01),
      minimumProfitMargin: finite('minimumProfitMargin', current.minimumProfitMargin, -1, 10),
      maximumListingDiscount: finite('maximumListingDiscount', current.maximumListingDiscount, 0, .35),
      maximumActiveListings: Math.floor(finite('maximumActiveListings', current.maximumActiveListings, 1, 12 + getCareerListingCapacityBonus(state.careerUpgrades))),
      repricingIntervalMs: finite('repricingIntervalMs', current.repricingIntervalMs, 60_000, 30 * 24 * 60 * 60_000),
      relistExpired: typeof update.relistExpired === 'boolean' ? update.relistExpired : current.relistExpired,
      mode: update.mode === 'instant' || update.mode === 'list' || update.mode === 'mixed' ? update.mode : current.mode,
      confirmationThreshold: finite('confirmationThreshold', current.confirmationThreshold, .01),
    })
  } else if (roleId === 'marketScout') {
    const current = employee.settings as typeof state.business.employees.marketScout.settings
    Object.assign(nextSettings, {
      intervalMs: Math.max(getEffectiveEmployeeInterval(state, roleId, employee.trainingLevel), finite('intervalMs', current.intervalMs, 10_000, 24 * 60 * 60_000)),
      minimumValuationConfidence: finite('minimumValuationConfidence', current.minimumValuationConfidence, 0, 1),
    })
  } else if (roleId === 'tradeUpSpecialist') {
    const current = employee.settings as typeof state.business.employees.tradeUpSpecialist.settings
    Object.assign(nextSettings, {
      intervalMs: Math.max(getEffectiveEmployeeInterval(state, roleId, employee.trainingLevel), finite('intervalMs', current.intervalMs, 10_000, 24 * 60 * 60_000)),
      maximumInputValue: finite('maximumInputValue', current.maximumInputValue, .01),
      maximumDailyConsumedValue: finite('maximumDailyConsumedValue', current.maximumDailyConsumedValue, .01),
      minimumExpectedProfit: finite('minimumExpectedProfit', current.minimumExpectedProfit, 0),
      minimumExpectedRoi: finite('minimumExpectedRoi', current.minimumExpectedRoi, 0, 10),
      allowedCollections: Array.isArray(update.allowedCollections) ? update.allowedCollections.filter((value): value is string => typeof value === 'string').slice(0, 100) : current.allowedCollections,
      allowedRarities: Array.isArray(update.allowedRarities) ? update.allowedRarities.filter((value): value is Rarity => Object.values(Rarity).includes(value as Rarity)) : current.allowedRarities,
      maximumContractsPerShift: Math.floor(finite('maximumContractsPerShift', current.maximumContractsPerShift, 1, 5 + getCareerTradeUpContractBonus(state.careerUpgrades))),
      confirmationThreshold: finite('confirmationThreshold', current.confirmationThreshold, .01, 500 + getCareerTradeUpApprovalBonus(state.careerUpgrades)),
    })
  } else {
    const current = employee.settings as typeof state.business.employees.juniorTrader.settings
    const minimumFloat = finite('minimumFloat', current.minimumFloat, 0, 1)
    Object.assign(nextSettings, {
      intervalMs: Math.max(getEffectiveEmployeeInterval(state, roleId, employee.trainingLevel), finite('intervalMs', current.intervalMs, 10_000, 24 * 60 * 60_000)),
      maximumPurchasePrice: finite('maximumPurchasePrice', current.maximumPurchasePrice, .01),
      maximumDailyTransactions: Math.floor(finite('maximumDailyTransactions', current.maximumDailyTransactions, 1, 100)),
      minimumDiscount: finite('minimumDiscount', current.minimumDiscount, 0, .9),
      minimumValuationConfidence: finite('minimumValuationConfidence', current.minimumValuationConfidence, 0, 1),
      allowedWeapons: Array.isArray(update.allowedWeapons) ? update.allowedWeapons.filter((value): value is string => typeof value === 'string').slice(0, 100) : current.allowedWeapons,
      allowedWear: Array.isArray(update.allowedWear) ? update.allowedWear.filter((value): value is WearCondition => Object.values(WearCondition).includes(value as WearCondition)) : current.allowedWear,
      minimumFloat,
      maximumFloat: Math.max(minimumFloat, finite('maximumFloat', current.maximumFloat, 0, 1)),
      maximumExposurePerSkin: Math.floor(finite('maximumExposurePerSkin', current.maximumExposurePerSkin, 1, 100)),
      maximumItemValue: finite('maximumItemValue', current.maximumItemValue, .01),
      walletReserve: finite('walletReserve', current.walletReserve),
      stopLoss: finite('stopLoss', current.stopLoss, .01),
      manualApprovalThreshold: finite('manualApprovalThreshold', current.manualApprovalThreshold, .01),
    })
  }
  return { ...state, business: { ...state.business, employees: { ...state.business.employees, [roleId]: { ...employee, settings: nextSettings, nextActionAt: employee.isEnabled ? Math.min(employee.nextActionAt || now, now + getEffectiveEmployeeInterval(state, roleId, employee.trainingLevel)) : employee.nextActionAt } } }, lastError: undefined }
}

function allocateEmployeeBudget(state: GameState, roleId: EmployeeRoleId, amount: number, requestId: string) {
  if (state.business.processedOperationIds.includes(requestId)) return state
  const employee = state.business.employees[roleId]
  const normalized = roundCurrency(Math.max(0, amount))
  if (!employee?.isHired || normalized <= 0 || state.money < normalized) return { ...state, lastError: !employee?.isHired ? 'Hire this employee first.' : 'Not enough wallet cash for that allocation.' }
  const next = { ...state, money: roundCurrency(state.money - normalized), business: { ...state.business, employees: { ...state.business.employees, [roleId]: { ...employee, allocatedCapital: roundCurrency(employee.allocatedCapital + normalized), availableCapital: roundCurrency(employee.availableCapital + normalized) } } }, lastError: undefined }
  return appendBusinessProcessedId(next, requestId)
}

function releaseEmployeeBudget(state: GameState, roleId: EmployeeRoleId, amount: number | undefined, requestId: string) {
  if (state.business.processedOperationIds.includes(requestId)) return state
  const employee = state.business.employees[roleId]
  if (!employee) return state
  const released = roundCurrency(Math.min(employee.availableCapital, Math.max(0, amount ?? employee.availableCapital)))
  const next = { ...state, money: roundCurrency(state.money + released), business: { ...state.business, employees: { ...state.business.employees, [roleId]: { ...employee, allocatedCapital: roundCurrency(Math.max(0, employee.allocatedCapital - released)), availableCapital: roundCurrency(employee.availableCapital - released) } } }, lastError: undefined }
  return appendBusinessProcessedId(next, requestId)
}

function pauseEmployee(state: GameState, roleId: EmployeeRoleId, reason: string, now: number) {
  const employee = state.business.employees[roleId]
  return { ...state, business: { ...state.business, employees: { ...state.business.employees, [roleId]: { ...employee, isEnabled: false, status: 'paused' as const, lastPauseReason: reason, nextActionAt: now } } } }
}

function settleEmployeePayroll(state: GameState, roleId: EmployeeRoleId, now: number) {
  const employee = state.business.employees[roleId]
  if (!employee.isHired || !employee.isEnabled) return state
  const from = employee.payrollSettledThrough || employee.lastActionAt || now
  const elapsed = Math.min(24 * 60 * 60_000, Math.max(0, now - from))
  if (elapsed < 60_000) return state
  const wage = getEffectiveEmployeeHourlyWage(state, roleId, employee.trainingLevel)
  const due = roundCurrency(wage * elapsed / 3_600_000)
  if (due <= 0) return state
  if (employee.availableCapital < due) return pauseEmployee(state, roleId, `Paused: needs $${due.toFixed(2)} payroll, but only $${employee.availableCapital.toFixed(2)} is allocated.`, now)
  const operation: BusinessOperation = { id: `payroll:${roleId}:${from}:${now}`, employeeRole: roleId, type: 'payroll', timestamp: now, description: `${EMPLOYEE_ROLE_DEFINITIONS[roleId].name} payroll`, grossVolume: 0, revenue: 0, expense: due, realizedProfit: -due, relatedItemIds: [] }
  const paid = { ...employee, availableCapital: roundCurrency(employee.availableCapital - due), spentCapital: roundCurrency(employee.spentCapital + due), totalOperatingExpenses: roundCurrency(employee.totalOperatingExpenses + due), payrollSettledThrough: now }
  return { ...state, business: rememberBusinessOperation({ ...state.business, employees: { ...state.business.employees, [roleId]: paid } }, operation), statistics: { ...state.statistics, moneySpent: roundCurrency(state.statistics.moneySpent + due) } }
}

function trophyItemIds(state: GameState) {
  return new Set(Object.values(state.trophyAssignments).flatMap((entry) => entry?.itemId ? [entry.itemId] : []))
}

function finishEmployeeOperation(state: GameState, roleId: EmployeeRoleId, operation: BusinessOperation, now: number, recentResult: string) {
  const employee = state.business.employees[roleId]
  const updated = { ...employee, status: 'running' as const, lastActionAt: now, nextActionAt: now + getEffectiveEmployeeInterval(state, roleId, employee.trainingLevel), completedOperationCount: employee.completedOperationCount + 1, recentResult, lastPauseReason: undefined }
  return { ...state, business: rememberBusinessOperation({ ...state.business, employees: { ...state.business.employees, [roleId]: updated } }, operation) }
}

function runCaseOperator(state: GameState, now: number, prng: Prng) {
  void prng
  const roleId = 'caseOperator' as const
  const employee = state.business.employees[roleId]
  const settings = employee.settings
  const selectedCase = CASE_DEFINITIONS.find((candidate) => candidate.id === settings.caseId)
  const caseDef = selectedCase && canOpenCase(selectedCase, state) ? selectedCase : CASE_DEFINITIONS.find((candidate) => canOpenCase(candidate, state))
  if (!caseDef) return pauseEmployee(state, roleId, 'Paused: no case is currently available.', now)
  const effectiveCase = getEffectiveCaseDefinition(state, caseDef, now)
  const monitoredReserve = settings.inventoryCapacityReserve + Math.floor(
    getCareerUpgradeEffect(state.careerUpgrades, 'business.caseCapacityReserve'),
  )
  if (state.money < settings.minimumWalletReserve) return pauseEmployee(state, roleId, 'Paused: player wallet reserve reached.', now)
  if (getInventoryFreeSlots(state) <= monitoredReserve) return pauseEmployee(state, roleId, 'Paused: inventory capacity reserve reached.', now)
  const shiftRemaining = Math.max(0, settings.maximumCasesPerShift - state.business.dailyUsage.caseOperatorCases)
  const freeSlots = Math.max(0, getInventoryFreeSlots(state) - monitoredReserve)
  const maximumAffordable = Math.floor(employee.availableCapital / effectiveCase.cost)
  const batch = Math.min(settings.batchSize, getEffectiveCaseOperatorBatch(state, employee.trainingLevel), shiftRemaining, freeSlots, maximumAffordable)
  if (batch <= 0) {
    const reason = freeSlots <= 0 ? 'Paused: inventory capacity reserve reached.' : shiftRemaining <= 0 ? 'Paused: shift case limit reached.' : 'Paused: assigned budget cannot cover the selected case.'
    return pauseEmployee(state, roleId, reason, now)
  }
  if (employee.spentCapital + effectiveCase.cost * batch > settings.stopLoss) return pauseEmployee(state, roleId, 'Paused: configured stop-loss reached.', now)
  const beforeFund = employee.availableCapital
  const wallet = state.money
  const opened = openCase({ ...state, money: beforeFund, autoSellRules: settings.allowAutoSell ? state.autoSellRules : [] }, caseDef.id, batch, now, `business-case:${now}:${employee.completedOperationCount}`)
  const openedCount = opened.statistics.casesOpened - state.statistics.casesOpened
  if (openedCount <= 0) return pauseEmployee({ ...opened, money: wallet }, roleId, opened.lastError ?? 'Paused: opening could not complete.', now)
  const fundAfter = opened.money
  const spent = roundCurrency(effectiveCase.cost * openedCount)
  const autoSaleRevenue = roundCurrency(Math.max(0, fundAfter - beforeFund + spent))
  const nextEmployee = { ...opened.business.employees[roleId], availableCapital: fundAfter, spentCapital: roundCurrency(employee.spentCapital + spent), totalOperatingExpenses: roundCurrency(employee.totalOperatingExpenses + spent), realizedBusinessIncome: roundCurrency(employee.realizedBusinessIncome + autoSaleRevenue) }
  let next = { ...opened, money: wallet, autoSellRules: state.autoSellRules, business: { ...opened.business, employees: { ...opened.business.employees, [roleId]: nextEmployee }, dailyUsage: { ...opened.business.dailyUsage, caseOperatorCases: opened.business.dailyUsage.caseOperatorCases + openedCount } } }
  const items = opened.lastOpenedItems.map((item) => item.instanceId)
  next = finishEmployeeOperation(next, roleId, { id: `business-case:${now}:${employee.completedOperationCount}`, employeeRole: roleId, type: 'case-opened', timestamp: now, description: `Opened ${openedCount} × ${caseDef.name}`, grossVolume: spent + autoSaleRevenue, revenue: autoSaleRevenue, expense: spent, realizedProfit: autoSaleRevenue - spent, relatedItemIds: items }, now, `Opened ${openedCount} ${caseDef.name}`)
  return next
}

function getOrdinaryDuplicateCandidate(state: GameState, keepBestDuplicates: number) {
  const protectedIds = trophyItemIds(state)
  const groups = new Map<string, SkinInstance[]>()
  for (const item of state.inventory) {
    const key = `${item.id}:${item.statTrak ? 'st' : item.souvenir ? 'souvenir' : 'normal'}`
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups.values()].flatMap((items) => {
    if (items.length < 2) return []
    const protectedItems = items.filter((item) => isBusinessProtectedItem(item, protectedIds))
    const eligible = items.filter((item) => !isBusinessProtectedItem(item, protectedIds)).sort((a, b) => b.marketValue - a.marketValue || a.instanceId.localeCompare(b.instanceId))
    return eligible.slice(Math.max(0, Math.max(0, keepBestDuplicates) - protectedItems.length))
  }).sort((a, b) => a.marketValue - b.marketValue || a.instanceId.localeCompare(b.instanceId))[0]
}

function runSalesAssistant(state: GameState, now: number) {
  const roleId = 'salesAssistant' as const
  const employee = state.business.employees[roleId]
  const settings = employee.settings
  const candidate = getOrdinaryDuplicateCandidate(state, settings.keepBestDuplicates)
  if (!candidate) {
    const listing = state.marketplace.playerListings.find((entry) => !isBusinessProtectedItem(entry.item, trophyItemIds(state)))
    const lastReprice = listing ? state.business.recentOperations.find((operation) => operation.type === 'listing-repriced' && operation.relatedMarketplaceId === listing.id) : undefined
    if (listing && now - (lastReprice?.timestamp ?? listing.createdAt) >= settings.repricingIntervalMs) {
      const floor = Math.max(settings.minimumListingPrice, listing.fairMarketValue * (1 - Math.min(.35, settings.maximumListingDiscount)))
      const askingPrice = roundCurrency(Math.max(floor, listing.askingPrice * .98))
      if (askingPrice < listing.askingPrice) {
        const next = { ...state, marketplace: { ...state.marketplace, playerListings: state.marketplace.playerListings.map((entry) => entry.id === listing.id ? { ...entry, askingPrice } : entry) } }
        return finishEmployeeOperation(next, roleId, { id: `business-reprice:${listing.id}:${now}`, employeeRole: roleId, type: 'listing-repriced', timestamp: now, description: `Repriced ${listing.item.weapon} | ${listing.item.finish} without resetting expiry`, grossVolume: askingPrice, revenue: 0, expense: 0, realizedProfit: 0, relatedItemIds: [listing.item.instanceId], relatedMarketplaceId: listing.id }, now, `Repriced listing to $${askingPrice.toFixed(2)}`)
      }
    }
    const expired = settings.relistExpired ? state.marketplace.transactions.find((transaction) => transaction.type === 'listing-cancelled' && state.inventory.some((item) => item.instanceId === transaction.item.instanceId) && !isBusinessProtectedItem(transaction.item, trophyItemIds(state))) : undefined
    if (expired && !state.business.recentOperations.some((operation) => operation.type === 'market-listing' && operation.relatedItemIds.includes(expired.item.instanceId) && operation.timestamp >= expired.createdAt)) {
      const ask = roundCurrency(Math.max(settings.minimumListingPrice, expired.fairMarketValue * (1 - Math.min(.35, settings.maximumListingDiscount))))
      const requestId = `business-relist:${expired.item.instanceId}:${expired.createdAt}`
      const relisted = listItemOnMarket(state, expired.item.instanceId, ask, requestId, now)
      if (relisted.marketplace.playerListings.length > state.marketplace.playerListings.length) return finishEmployeeOperation(relisted, roleId, { id: requestId, employeeRole: roleId, type: 'market-listing', timestamp: now, description: `Relisted expired ${expired.item.weapon} | ${expired.item.finish}`, grossVolume: ask, revenue: 0, expense: 0, realizedProfit: 0, relatedItemIds: [expired.item.instanceId], relatedMarketplaceId: relisted.marketplace.playerListings[0]?.id }, now, 'Relisted an expired ordinary item')
    }
    return { ...state, business: { ...state.business, employees: { ...state.business.employees, [roleId]: { ...employee, lastActionAt: now, nextActionAt: now + getEffectiveEmployeeInterval(state, roleId, employee.trainingLevel), recentResult: 'No eligible ordinary duplicate or listing task found' } } } }
  }
  if (candidate.marketValue > Math.min(settings.maximumItemValue, settings.confirmationThreshold)) return pauseEmployee(state, roleId, 'Paused: eligible duplicate exceeds the manual confirmation threshold.', now)
  if (!settings.allowedRarities.includes(candidate.rarity)) return { ...state, business: { ...state.business, employees: { ...state.business.employees, [roleId]: { ...employee, lastActionAt: now, nextActionAt: now + getEffectiveEmployeeInterval(state, roleId, employee.trainingLevel), recentResult: 'Eligible duplicate is outside allowed rarities' } } } }
  if (settings.allowedWeapons.length > 0 && !settings.allowedWeapons.includes(candidate.weapon)) return { ...state, business: { ...state.business, employees: { ...state.business.employees, [roleId]: { ...employee, lastActionAt: now, nextActionAt: now + getEffectiveEmployeeInterval(state, roleId, employee.trainingLevel), recentResult: 'Eligible duplicate is outside allowed weapons' } } } }
  const listingLimit = Math.min(settings.maximumActiveListings, 12 + getCareerListingCapacityBonus(state.careerUpgrades))
  const shouldList = settings.mode === 'list' || (settings.mode === 'mixed' && state.marketplace.playerListings.length < listingLimit && employee.completedOperationCount % 2 === 1)
  if (shouldList && state.marketplace.playerListings.length < listingLimit) {
    const fair = getCurrentItemMarketValue(candidate, state.marketValues)
    const ask = roundCurrency(Math.max(settings.minimumListingPrice, fair * (1 - Math.min(.35, settings.maximumListingDiscount))))
    const requestId = `business-list:${candidate.instanceId}:${now}`
    const listed = listItemOnMarket(state, candidate.instanceId, ask, requestId, now)
    if (listed.marketplace.playerListings.length === state.marketplace.playerListings.length) return pauseEmployee(listed, roleId, listed.lastError ?? 'Paused: listing could not be created.', now)
    return finishEmployeeOperation(listed, roleId, { id: requestId, employeeRole: roleId, type: 'market-listing', timestamp: now, description: `Listed ${candidate.weapon} | ${candidate.finish} on CSWEAR`, grossVolume: ask, revenue: 0, expense: 0, realizedProfit: 0, relatedItemIds: [candidate.instanceId], relatedMarketplaceId: listed.marketplace.playerListings[0]?.id }, now, `Listed ${candidate.weapon} | ${candidate.finish}`)
  }
  const quote = getAutomationSaleValue(state, candidate)
  const basis = state.economyLedger.itemCostBasis[candidate.instanceId]
  if (basis !== undefined && (quote - basis) / Math.max(.01, basis) < settings.minimumProfitMargin) return { ...state, business: { ...state.business, employees: { ...state.business.employees, [roleId]: { ...employee, lastActionAt: now, nextActionAt: now + getEffectiveEmployeeInterval(state, roleId, employee.trainingLevel), recentResult: 'Skipped duplicate below configured profit margin' } } } }
  if (quote < settings.minimumSaleQuote) return pauseEmployee(state, roleId, 'Paused: instant-sale quote is below the configured floor.', now)
  const sold = sellItem(state, candidate.instanceId)
  if (sold.inventory.length === state.inventory.length) return pauseEmployee(sold, roleId, sold.lastError ?? 'Paused: duplicate could not be sold.', now)
  const operation = { id: `business-sale:${candidate.instanceId}:${now}`, employeeRole: roleId, type: 'instant-sale' as const, timestamp: now, description: `Sold ordinary duplicate ${candidate.weapon} | ${candidate.finish}`, grossVolume: quote, revenue: quote, expense: 0, realizedProfit: quote - (state.economyLedger.itemCostBasis[candidate.instanceId] ?? candidate.marketValue), relatedItemIds: [candidate.instanceId] }
  return finishEmployeeOperation({ ...sold, business: { ...sold.business, dailyUsage: { ...sold.business.dailyUsage, salesActions: sold.business.dailyUsage.salesActions + 1 } } }, roleId, operation, now, `Sold duplicate for $${quote.toFixed(2)}`)
}

function watchlistMatchesListing(watchlist: ScoutWatchlist, listing: NpcMarketListing, now: number) {
  const discount = (listing.fairMarketValue - listing.askingPrice) / Math.max(.01, listing.fairMarketValue)
  const confidence = listing.item.pattern?.referenceConfidence === 'verified' ? 1 : listing.item.pattern?.referenceConfidence === 'estimated' ? .75 : .65
  return (!watchlist.skinId || listing.item.id === watchlist.skinId) && (!watchlist.weapon || listing.item.weapon === watchlist.weapon) && (!watchlist.wear || listing.item.wear === watchlist.wear) && (watchlist.minimumFloat === undefined || listing.item.floatValue >= watchlist.minimumFloat) && (watchlist.maximumFloat === undefined || listing.item.floatValue <= watchlist.maximumFloat) && (watchlist.patternId === undefined || listing.item.paintSeed === watchlist.patternId) && (!watchlist.patternClassification || listing.item.pattern?.name.toLowerCase().includes(watchlist.patternClassification.toLowerCase())) && (watchlist.maximumPrice === undefined || listing.askingPrice <= watchlist.maximumPrice) && discount >= watchlist.minimumDiscount && confidence >= watchlist.minimumConfidence && (!watchlist.seller || listing.seller.username.toLowerCase().includes(watchlist.seller.toLowerCase())) && (watchlist.maximumListingAgeMs === undefined || now - listing.createdAt <= watchlist.maximumListingAgeMs) && (watchlist.expiringWithinMs === undefined || listing.expiresAt - now <= watchlist.expiringWithinMs) && (watchlist.statTrak === undefined || Boolean(listing.item.statTrak) === watchlist.statTrak) && (watchlist.souvenir === undefined || Boolean(listing.item.souvenir) === watchlist.souvenir)
}

function runMarketScout(state: GameState, now: number) {
  const roleId = 'marketScout' as const
  const employee = state.business.employees[roleId]
  const watchlist = state.business.watchlists.find((entry) => entry.enabled)
  if (!watchlist) return pauseEmployee(state, roleId, 'Paused: create and enable a watchlist first.', now)
  const skinCandidates = watchlist.skinId ? SKIN_DEFINITIONS.filter((skin) => skin.id === watchlist.skinId) : SKIN_DEFINITIONS.filter((skin) => !watchlist.weapon || skin.weapon === watchlist.weapon)
  if (skinCandidates.length === 0) return pauseEmployee(state, roleId, 'Paused: watchlist has no matching catalog skins.', now)
  const scanLimit = getScoutCandidateLimit(employee.trainingLevel) + getCareerScoutCandidateBonus(state.careerUpgrades)
  const skin = skinCandidates[watchlist.scanCursor % skinCandidates.length]
  const filters = { wear: watchlist.wear ?? 'all' as const, minFloat: watchlist.minimumFloat, maxFloat: watchlist.maximumFloat, patternId: watchlist.patternId, patternClassification: watchlist.patternClassification, maxPrice: watchlist.maximumPrice, seller: watchlist.seller, edition: watchlist.statTrak ? 'stattrak' as const : watchlist.souvenir ? 'souvenir' as const : 'all' as const }
  const result = generateVirtualListingPage({ skin, marketValues: state.marketValues, epoch: state.marketplace.virtualMarketEpoch, seed: state.marketplace.virtualMarketSeed, removedListingIds: state.marketplace.removedVirtualListingIds, overrides: state.marketplace.npcListings.filter((listing) => listing.item.id === skin.id), filters, sort: 'best-deals', pageSize: Math.min(100, scanLimit), now })
  const alertedIds = new Set(state.business.alerts.map((alert) => alert.listingId))
  const listing = result.listings.find((candidate) => !alertedIds.has(candidate.id) && watchlistMatchesListing(watchlist, candidate, now))
  const nextWatchlists = state.business.watchlists.map((entry) => entry.id === watchlist.id ? { ...entry, lastScannedAt: now, scanCursor: entry.scanCursor + 1, scannedCandidates: entry.scannedCandidates + result.scanned } : entry)
  if (!listing) return { ...state, business: { ...state.business, watchlists: nextWatchlists, employees: { ...state.business.employees, [roleId]: { ...employee, lastActionAt: now, nextActionAt: now + getEffectiveEmployeeInterval(state, roleId, employee.trainingLevel), recentResult: `Scanned ${result.scanned} candidates; no genuine match` } } } }
  const discount = (listing.fairMarketValue - listing.askingPrice) / Math.max(.01, listing.fairMarketValue)
  const alert = { id: `alert:${watchlist.id}:${listing.id}`, watchlistId: watchlist.id, listingId: listing.id, skinId: listing.item.id, skinName: `${listing.item.weapon} | ${listing.item.finish}`, image: listing.item.image, seller: listing.seller.username, price: listing.askingPrice, wear: listing.item.wear, float: listing.item.floatValue, patternId: listing.item.paintSeed, patternClassification: listing.item.pattern?.name, estimatedValue: listing.fairMarketValue, discount, confidence: listing.item.pattern?.referenceConfidence === 'verified' ? 'market' as const : listing.item.pattern?.referenceConfidence === 'estimated' ? 'listing' as const : 'simulator-estimate' as const, expiresAt: listing.expiresAt, discoveredAt: now, status: 'new' as const }
  const next = { ...state, business: { ...state.business, watchlists: nextWatchlists, alerts: [alert, ...state.business.alerts].slice(0, 80) } }
  return finishEmployeeOperation(next, roleId, { id: `scout:${listing.id}`, employeeRole: roleId, type: 'scout-match', timestamp: now, description: `Found ${alert.skinName} at ${(discount * 100).toFixed(1)}% below estimate`, grossVolume: listing.askingPrice, revenue: 0, expense: 0, realizedProfit: 0, relatedItemIds: [], relatedMarketplaceId: listing.id }, now, `Found ${alert.skinName}`)
}

function runTradeUpSpecialist(state: GameState, now: number, prng: Prng) {
  const roleId = 'tradeUpSpecialist' as const
  const employee = state.business.employees[roleId]
  const settings = employee.settings
  const contractLimit = Math.min(settings.maximumContractsPerShift, 5 + getCareerTradeUpContractBonus(state.careerUpgrades))
  if (state.business.dailyUsage.tradeUpContracts >= contractLimit || state.business.dailyUsage.tradeUpInputValue >= settings.maximumDailyConsumedValue) return pauseEmployee(state, roleId, 'Paused: daily contract risk limit reached.', now)
  const protectedIds = trophyItemIds(state)
  const candidateLimit = Math.min(50, 10 + Math.floor(
    getCareerUpgradeEffect(state.careerUpgrades, 'business.tradeUpCandidates'),
  ))
  const suggestions = suggestBestTradeUps({ inventory: state.inventory.filter((item) => !isBusinessProtectedItem(item, protectedIds)), marketValues: state.marketValues, limit: candidateLimit })
  const suggestion = suggestions.find(({ analysis, inputItems }) => {
    const roi = analysis.expectedProfit / Math.max(.01, analysis.inputValue)
    return analysis.hasCompleteValuation && analysis.inputValue <= settings.maximumInputValue && state.business.dailyUsage.tradeUpInputValue + analysis.inputValue <= settings.maximumDailyConsumedValue && analysis.expectedProfit >= settings.minimumExpectedProfit && roi >= settings.minimumExpectedRoi && settings.allowedRarities.includes(inputItems[0]?.rarity) && (settings.allowedCollections.length === 0 || inputItems.every((item) => item.collections?.some((id) => settings.allowedCollections.includes(id))))
  })
  if (!suggestion) return { ...state, business: { ...state.business, employees: { ...state.business.employees, [roleId]: { ...employee, lastActionAt: now, nextActionAt: now + getEffectiveEmployeeInterval(state, roleId, employee.trainingLevel), recentResult: 'No genuinely eligible positive-EV contract' } } } }
  const covert = suggestion.inputItems[0]?.rarity === Rarity.Covert
  const automaticThreshold = Math.min(settings.confirmationThreshold, 500 + getCareerTradeUpApprovalBonus(state.careerUpgrades))
  if (covert || suggestion.analysis.inputValue >= automaticThreshold) {
    const approval = { id: `trade-approval:${now}:${employee.completedOperationCount}`, inputItemIds: suggestion.inputItems.map((item) => item.instanceId), inputValue: suggestion.analysis.inputValue, expectedOutputValue: suggestion.analysis.expectedValue, expectedProfit: suggestion.analysis.expectedProfit, expectedRoi: suggestion.analysis.expectedProfit / Math.max(.01, suggestion.analysis.inputValue), createdAt: now, reason: covert ? 'Five-Covert special-output contracts require manual confirmation.' : 'Input value exceeds the manual confirmation threshold.' }
    return { ...state, business: { ...state.business, pendingTradeUpApproval: approval, employees: { ...state.business.employees, [roleId]: { ...employee, isEnabled: false, status: 'awaiting-approval' as const, lastPauseReason: approval.reason, lastActionAt: now } } } }
  }
  const traded = tradeUpItems(state, suggestion.inputItems.map((item) => item.instanceId), now, prng)
  if (traded.statistics.tradeUpsCompleted === state.statistics.tradeUpsCompleted) return pauseEmployee(traded, roleId, traded.lastError ?? 'Paused: contract execution failed.', now)
  const output = traded.lastOpenedItems[0]
  const realized = (output?.marketValue ?? 0) - suggestion.analysis.inputValue
  const next = { ...traded, business: { ...traded.business, dailyUsage: { ...traded.business.dailyUsage, tradeUpContracts: traded.business.dailyUsage.tradeUpContracts + 1, tradeUpInputValue: roundCurrency(traded.business.dailyUsage.tradeUpInputValue + suggestion.analysis.inputValue) } } }
  return finishEmployeeOperation(next, roleId, { id: `business-tradeup:${output?.instanceId ?? now}`, employeeRole: roleId, type: 'trade-up', timestamp: now, description: `Completed an honest-EV contract`, grossVolume: suggestion.analysis.inputValue + (output?.marketValue ?? 0), revenue: 0, expense: 0, realizedProfit: realized, relatedItemIds: [...suggestion.inputItems.map((item) => item.instanceId), ...(output ? [output.instanceId] : [])] }, now, `Contract result ${realized >= 0 ? '+' : ''}$${realized.toFixed(2)}`)
}

function runJuniorTrader(state: GameState, now: number) {
  const roleId = 'juniorTrader' as const
  const employee = state.business.employees[roleId]
  const settings = employee.settings
  if (state.business.dailyUsage.juniorTraderPurchases >= settings.maximumDailyTransactions) return pauseEmployee(state, roleId, 'Paused: daily purchase limit reached.', now)
  if (state.money < settings.walletReserve) return pauseEmployee(state, roleId, 'Paused: player wallet reserve reached.', now)
  if (state.business.dailyUsage.juniorTraderSpend >= settings.stopLoss) return pauseEmployee(state, roleId, 'Paused: daily stop-loss reached.', now)
  const affordable = Math.min(settings.maximumPurchasePrice, employee.availableCapital)
  if (affordable <= 0) return pauseEmployee(state, roleId, 'Paused: assigned purchase budget is empty.', now)
  const start = employee.completedOperationCount % SKIN_DEFINITIONS.length
  let selected: NpcMarketListing | undefined
  const juniorCandidateLimit = 24 + Math.floor(getCareerUpgradeEffect(state.careerUpgrades, 'business.juniorCandidates'))
  for (let offset = 0; offset < Math.min(juniorCandidateLimit, SKIN_DEFINITIONS.length); offset += 1) {
    const skin = SKIN_DEFINITIONS[(start + offset) % SKIN_DEFINITIONS.length]
    if (settings.allowedWeapons.length > 0 && !settings.allowedWeapons.includes(skin.weapon)) continue
    const page = generateVirtualListingPage({ skin, marketValues: state.marketValues, epoch: state.marketplace.virtualMarketEpoch, seed: state.marketplace.virtualMarketSeed, removedListingIds: state.marketplace.removedVirtualListingIds, overrides: state.marketplace.npcListings.filter((listing) => listing.item.id === skin.id), filters: { maxPrice: affordable, minFloat: settings.minimumFloat, maxFloat: settings.maximumFloat }, sort: 'best-deals', pageSize: 8, now })
    selected = page.listings.find((listing) => {
      const confidence = listing.item.pattern?.referenceConfidence === 'verified' ? 1 : listing.item.pattern?.referenceConfidence === 'estimated' ? .75 : .65
      return settings.allowedWear.includes(listing.item.wear) && listing.item.marketValue <= settings.maximumItemValue && listing.askingPrice < settings.manualApprovalThreshold && state.business.dailyUsage.juniorTraderSpend + listing.askingPrice <= settings.stopLoss && !isExceptionalPattern(listing.item) && confidence >= settings.minimumValuationConfidence && getCredibleDealScore(listing) >= settings.minimumDiscount && state.inventory.filter((item) => item.id === listing.item.id).length < settings.maximumExposurePerSkin
    })
    if (selected) break
  }
  if (!selected) return { ...state, business: { ...state.business, employees: { ...state.business.employees, [roleId]: { ...employee, lastActionAt: now, nextActionAt: now + getEffectiveEmployeeInterval(state, roleId, employee.trainingLevel), recentResult: 'No credible ordinary bargain within limits' } } } }
  const wallet = state.money
  const beforeFund = employee.availableCapital
  const requestId = `business-buy:${selected.id}`
  const purchased = buyMarketListing({ ...state, money: beforeFund }, selected.id, requestId, selected, undefined, now)
  if (purchased.inventory.length === state.inventory.length) return pauseEmployee({ ...purchased, money: wallet }, roleId, purchased.lastError ?? 'Paused: listing could not be purchased.', now)
  const cost = roundCurrency(beforeFund - purchased.money)
  const nextEmployee = { ...purchased.business.employees[roleId], availableCapital: purchased.money, spentCapital: roundCurrency(employee.spentCapital + cost), totalOperatingExpenses: roundCurrency(employee.totalOperatingExpenses + cost) }
  const next = { ...purchased, money: wallet, business: { ...purchased.business, employees: { ...purchased.business.employees, [roleId]: nextEmployee }, dailyUsage: { ...purchased.business.dailyUsage, juniorTraderPurchases: purchased.business.dailyUsage.juniorTraderPurchases + 1, juniorTraderSpend: roundCurrency(purchased.business.dailyUsage.juniorTraderSpend + cost) } } }
  return finishEmployeeOperation(next, roleId, { id: requestId, employeeRole: roleId, type: 'market-purchase', timestamp: now, description: `Purchased ${selected.item.weapon} | ${selected.item.finish} at a credible discount`, grossVolume: cost, revenue: 0, expense: cost, realizedProfit: 0, relatedItemIds: [selected.item.instanceId], relatedMarketplaceId: selected.id }, now, `Purchased ${selected.item.weapon} | ${selected.item.finish}`)
}

function tickBusiness(state: GameState, now: number, prng: Prng = Math.random, maxOperations = 1) {
  const removedListings = new Set(state.marketplace.removedVirtualListingIds)
  let next = {
    ...state,
    business: {
      ...refreshBusinessDay(state.business, now),
      alerts: state.business.alerts.map((alert) => alert.status === 'new' && (alert.expiresAt <= now || removedListings.has(alert.listingId)) ? { ...alert, status: 'unavailable' as const } : alert),
    },
  }
  for (const roleId of EMPLOYEE_ROLE_IDS) next = settleEmployeePayroll(next, roleId, now)
  const schedulerCapacity = Math.max(1, Math.min(10, maxOperations + Math.floor(getCareerUpgradeEffect(state.careerUpgrades, 'business.schedulerOperations'))))
  for (let count = 0; count < schedulerCapacity; count += 1) {
    const due = EMPLOYEE_ROLE_IDS.map((roleId) => next.business.employees[roleId]).filter((employee) => employee.isHired && employee.isEnabled && employee.nextActionAt <= now).sort((a, b) => a.nextActionAt - b.nextActionAt || a.roleId.localeCompare(b.roleId))[0]
    if (!due) break
    if (due.roleId === 'caseOperator') next = runCaseOperator(next, now, prng)
    else if (due.roleId === 'salesAssistant') next = runSalesAssistant(next, now)
    else if (due.roleId === 'marketScout') next = runMarketScout(next, now)
    else if (due.roleId === 'tradeUpSpecialist') next = runTradeUpSpecialist(next, now, prng)
    else next = runJuniorTrader(next, now)
  }
  return { ...next, business: { ...next.business, lastSchedulerAt: now } }
}

function createScoutWatchlist(state: GameState, watchlist: ScoutWatchlist, requestId: string) {
  if (state.business.processedOperationIds.includes(requestId)) return state
  const limit = Math.min(12, 1 + Math.max(0, state.business.employees.marketScout.trainingLevel) + getCareerScoutWatchlistBonus(state.careerUpgrades))
  if (state.business.watchlists.length >= limit) return { ...state, lastError: `Market Scout training and Career upgrades currently support ${limit} watchlist${limit === 1 ? '' : 's'}.` }
  if (state.business.watchlists.some((entry) => entry.id === watchlist.id)) return appendBusinessProcessedId(state, requestId)
  return appendBusinessProcessedId({ ...state, business: { ...state.business, watchlists: [...state.business.watchlists, { ...watchlist, lastScannedAt: 0, scanCursor: 0, scannedCandidates: 0 }] }, lastError: undefined }, requestId)
}

function confirmBusinessTradeUp(state: GameState, approvalId: string, requestId: string, now: number) {
  if (state.business.processedOperationIds.includes(requestId)) return state
  const approval = state.business.pendingTradeUpApproval
  if (!approval || approval.id !== approvalId) return { ...state, lastError: 'This contract approval is no longer available.' }
  const traded = tradeUpItems(state, approval.inputItemIds, now)
  if (traded.statistics.tradeUpsCompleted === state.statistics.tradeUpsCompleted) return { ...traded, business: { ...traded.business, pendingTradeUpApproval: undefined } }
  const employee = traded.business.employees.tradeUpSpecialist
  const output = traded.lastOpenedItems[0]
  const realized = (output?.marketValue ?? 0) - approval.inputValue
  const next = finishEmployeeOperation({ ...traded, business: { ...traded.business, pendingTradeUpApproval: undefined, dailyUsage: { ...traded.business.dailyUsage, tradeUpContracts: traded.business.dailyUsage.tradeUpContracts + 1, tradeUpInputValue: roundCurrency(traded.business.dailyUsage.tradeUpInputValue + approval.inputValue) }, employees: { ...traded.business.employees, tradeUpSpecialist: { ...employee, isEnabled: false, status: 'paused', lastPauseReason: 'Manual contract completed. Resume when ready.' } } } }, 'tradeUpSpecialist', { id: `business-approved-tradeup:${output?.instanceId ?? now}`, employeeRole: 'tradeUpSpecialist', type: 'trade-up', timestamp: now, description: 'Completed manually approved contract', grossVolume: approval.inputValue + (output?.marketValue ?? 0), revenue: 0, expense: 0, realizedProfit: realized, relatedItemIds: [...approval.inputItemIds, ...(output ? [output.instanceId] : [])] }, now, `Approved contract result ${realized >= 0 ? '+' : ''}$${realized.toFixed(2)}`)
  return appendBusinessProcessedId(next, requestId)
}

function tradeUpItems(state: GameState, itemIds: string[], now = Date.now(), prng: Prng = Math.random): GameState {
  const uniqueItemIds = Array.from(new Set(itemIds))

  const selectedItems = uniqueItemIds
    .map((itemId) => state.inventory.find((item) => item.instanceId === itemId))
    .filter((item): item is SkinInstance => Boolean(item))

  if (selectedItems.length !== uniqueItemIds.length) {
    return failTradeUp(state, 'One or more selected skins are no longer in your inventory.')
  }

  const analysis = analyzeTradeUp({
    inputItems: selectedItems,
    marketValues: state.marketValues,
  })

  if (!analysis.canTradeUp) {
    return failTradeUp(state, analysis.message ?? 'This trade-up contract is not valid.')
  }

  const output = pickTradeUpOutcome(analysis.outcomes, prng)

  if (!output) {
    return failTradeUp(state, 'No valid trade-up result could be generated.')
  }

  const completedAt = now
  const outputItem = createSkinInstance(
    output.skin,
    state,
    completedAt,
    output.predictedFloat,
    prng,
    { statTrak: output.isStatTrak, souvenir: false },
  )
  const selectedIdSet = new Set(uniqueItemIds)
  const event: GameUiEvent = {
    id: nanoid(),
    type: 'trade_up_completed',
    inputItems: selectedItems,
    item: outputItem,
    createdAt: completedAt,
  }
  const tradeUpHistoryEntry = {
    id: event.id,
    createdAt: completedAt,
    inputItemIds: selectedItems.map((item) => item.instanceId),
    inputValue: analysis.inputValue,
    outputItem,
    outputValue: outputItem.marketValue,
    profit: Number((outputItem.marketValue - analysis.inputValue).toFixed(2)),
  }

  const tradedState = withInventoryValuation({
    ...state,
    inventory: [
      outputItem,
      ...state.inventory.filter((item) => !selectedIdSet.has(item.instanceId)),
    ],
    collectionBook: updateCollectionBook(state.collectionBook, outputItem),
    currentRunCollectionBook: updateCollectionBook(state.currentRunCollectionBook, outputItem),
    recentDrops: [outputItem, ...state.recentDrops].slice(0, RECENT_DROPS_LIMIT),
    lastOpenedItems: [outputItem],
    marketplace: {
      ...state.marketplace,
      pendingAcquisition: {
        id: nanoid(),
        source: 'trade-up',
        item: outputItem,
        createdAt: completedAt,
      },
    },
    lastError: undefined,
    uiEvents: appendEvents(state, [event]),
    ui: {
      ...state.ui,
      tradeUpHistory: [tradeUpHistoryEntry, ...state.ui.tradeUpHistory].slice(0, 24),
    },
    statistics: {
      ...state.statistics,
      tradeUpsCompleted: state.statistics.tradeUpsCompleted + 1,
      patternDrops: state.statistics.patternDrops + (isSpecialPattern(outputItem) ? 1 : 0),
      exceptionalPatternDrops: state.statistics.exceptionalPatternDrops + (isExceptionalPattern(outputItem) ? 1 : 0),
    },
  }, completedAt)
  const tradeUpProgressState = withDailyChallengeProgress(
    tradedState,
    {
      type: 'trade_ups_completed',
      amount: 1,
    },
    completedAt,
  )

  return withDropChallengeProgress(tradeUpProgressState, [outputItem], completedAt)
}

function sellItem(state: GameState, itemId: string): GameState {
  const item = state.inventory.find((inventoryItem) => inventoryItem.instanceId === itemId)

  if (!item) {
    return failItemSale(state, itemId, 'Item not found.')
  }

  if (item.isLocked) {
    return failItemSale(state, itemId, 'Locked items cannot be sold unless unlocked.')
  }

  const soldAt = Date.now()
  if ((item.instantSaleAvailableAt ?? 0) > soldAt) {
    return failItemSale(state, itemId, 'Auction purchases must be held for 24 hours before instant resale.')
  }

  const salePrice = getAutomationSaleValue(state, item)
  const soldItem = {
    ...item,
    marketValue: salePrice,
  }
  const event: GameUiEvent = {
    id: nanoid(),
    type: 'item_sold',
    item: soldItem,
    salePrice,
    createdAt: soldAt,
  }

  return withDailyChallengeProgress(withInventoryValuation({
    ...state,
    money: roundCurrency(clampNumber(state.money) + salePrice),
    inventory: state.inventory.filter((inventoryItem) => inventoryItem.instanceId !== itemId),
    marketplace: {
      ...state.marketplace,
      transactions: [{
        id: nanoid(), type: 'instant-sale' as const, item, price: salePrice,
        fairMarketValue: getCurrentItemMarketValue(item, state.marketValues), createdAt: soldAt,
      }, ...state.marketplace.transactions].slice(0, 160),
    },
    lastError: undefined,
    uiEvents: appendEvents(state, [event]),
    statistics: {
      ...state.statistics,
      moneyEarned: roundCurrency(state.statistics.moneyEarned + salePrice),
      itemSaleRevenue: roundCurrency(state.statistics.itemSaleRevenue + salePrice),
      itemsSold: state.statistics.itemsSold + 1,
    },
  }, soldAt), {
    type: 'sell_value',
    amount: salePrice,
  }, soldAt)
}

function sellItems(state: GameState, itemIds: string[]): GameState {
  const uniqueItemIds = Array.from(new Set(itemIds))
  const saleSummary = getBulkSaleSummary(state.inventory, state.marketValues, uniqueItemIds)

  if (saleSummary.selectedItems.length === 0) {
    return failItemSale(state, 'bulk', 'No selected items were found.')
  }

  if (saleSummary.saleableItems.length === 0) {
    return failItemSale(state, 'bulk', 'Selected items are locked and cannot be sold.')
  }

  const soldAt = Date.now()
  const cooldownItems = saleSummary.saleableItems.filter((item) => (item.instantSaleAvailableAt ?? 0) > soldAt)
  const eligibleItems = saleSummary.saleableItems.filter((item) => (item.instantSaleAvailableAt ?? 0) <= soldAt)

  if (eligibleItems.length === 0) {
    return failItemSale(state, 'bulk', 'Selected Auction purchases are still in their 24-hour instant-resale hold.')
  }

  const soldItems = eligibleItems.map((item) => ({
    ...item,
    marketValue: getAutomationSaleValue(state, item),
  }))
  const soldItemIds = new Set(soldItems.map((item) => item.instanceId))
  const saleValue = roundCurrency(soldItems.reduce((total, item) => total + item.marketValue, 0))
  const event: GameUiEvent = {
    id: nanoid(),
    type: 'items_sold',
    items: soldItems,
    itemCount: soldItems.length,
    salePrice: saleValue,
    skippedLockedCount: saleSummary.lockedItems.length + cooldownItems.length,
    createdAt: soldAt,
  }
  const skippedCount = saleSummary.lockedItems.length + cooldownItems.length
  const lockedMessage = skippedCount <= 0
    ? undefined
    : cooldownItems.length === 0
      ? `${saleSummary.lockedItems.length} locked item${saleSummary.lockedItems.length === 1 ? '' : 's'} skipped.`
      : `${skippedCount} protected or resale-held item${skippedCount === 1 ? '' : 's'} skipped.`

  return withDailyChallengeProgress(withInventoryValuation({
    ...state,
    money: roundCurrency(clampNumber(state.money) + saleValue),
    inventory: state.inventory.filter((item) => !soldItemIds.has(item.instanceId)),
    marketplace: {
      ...state.marketplace,
      transactions: [
        ...soldItems.map((soldItem) => ({
          id: nanoid(), type: 'instant-sale' as const, item: soldItem, price: soldItem.marketValue,
          fairMarketValue: getCurrentItemMarketValue(soldItem, state.marketValues), createdAt: soldAt,
        })),
        ...state.marketplace.transactions,
      ].slice(0, 160),
    },
    lastError: lockedMessage,
    uiEvents: appendEvents(state, [event]),
    statistics: {
      ...state.statistics,
      moneyEarned: roundCurrency(state.statistics.moneyEarned + saleValue),
      itemSaleRevenue: roundCurrency(state.statistics.itemSaleRevenue + saleValue),
      itemsSold: state.statistics.itemsSold + soldItems.length,
    },
  }, soldAt), {
    type: 'sell_value',
    amount: saleValue,
  }, soldAt)
}

function buyMarketListing(
  state: GameState,
  listingId: string,
  requestId: string,
  listingSnapshot?: NpcMarketListing,
  negotiatedPrice?: number,
  now = Date.now(),
): GameState {
  if (hasProcessedMarketplaceRequest(state.marketplace, requestId)) return state
  if (state.marketplace.removedVirtualListingIds.includes(listingId)) return { ...state, lastError: 'That listing is no longer available.' }
  const listing = state.marketplace.npcListings.find((candidate) => candidate.id === listingId)
    ?? (listingSnapshot?.id === listingId ? listingSnapshot : undefined)
  if (!listing || listing.expiresAt <= now) return { ...state, lastError: 'That listing is no longer available.' }
  const acceptedNegotiationPrice = listing.negotiation?.status === 'accepted'
    ? listing.negotiation.currentCounterOffer
    : undefined
  const requestedNegotiatedPrice = typeof negotiatedPrice === 'number' ? roundCurrency(negotiatedPrice) : undefined
  const price = requestedNegotiatedPrice !== undefined && acceptedNegotiationPrice === requestedNegotiatedPrice
    ? requestedNegotiatedPrice
    : listing.askingPrice
  if (clampNumber(state.money) < price) return { ...state, lastError: `Need $${price.toFixed(2)} to buy this listing.` }
  if (!hasInventorySpace(state)) return { ...state, lastError: 'Inventory is full. Make room before buying this listing.' }
  const transactionType = price < listing.askingPrice ? 'negotiated-purchase' as const : 'npc-purchase' as const
  const marketplace = rememberMarketplaceRequest({
    ...state.marketplace,
    npcListings: state.marketplace.npcListings.filter((candidate) => candidate.id !== listingId),
    removedVirtualListingIds: [...state.marketplace.removedVirtualListingIds, listingId],
    pendingAcquisition: {
      id: nanoid(),
      source: transactionType === 'negotiated-purchase' ? 'market-negotiation' : 'market-buy',
      item: listing.item,
      price,
      createdAt: now,
    },
    transactions: [{
      id: nanoid(),
      type: transactionType,
      item: listing.item,
      price,
      fairMarketValue: listing.fairMarketValue,
      counterparty: listing.seller.username,
      createdAt: now,
    }, ...state.marketplace.transactions].slice(0, 160),
  }, requestId)
  return withInventoryValuation({
    ...state,
    money: roundCurrency(clampNumber(state.money) - price),
    inventory: [listing.item, ...state.inventory],
    collectionBook: updateCollectionBook(state.collectionBook, listing.item),
    currentRunCollectionBook: updateCollectionBook(state.currentRunCollectionBook, listing.item),
    recentDrops: [listing.item, ...state.recentDrops].slice(0, RECENT_DROPS_LIMIT),
    marketplace,
    lastError: undefined,
    statistics: {
      ...state.statistics,
      marketPurchases: state.statistics.marketPurchases + 1,
      moneySpent: roundCurrency(state.statistics.moneySpent + price),
    },
  }, now)
}

function negotiateMarketListing(state: GameState, listingId: string, offer: number, listingSnapshot?: NpcMarketListing, now = Date.now()) {
  if (state.marketplace.removedVirtualListingIds.includes(listingId)) return { ...state, lastError: 'That listing is no longer available.' }
  const listing = state.marketplace.npcListings.find((candidate) => candidate.id === listingId)
    ?? (listingSnapshot?.id === listingId ? listingSnapshot : undefined)
  if (!listing || listing.expiresAt <= now) return { ...state, lastError: 'That listing is no longer available.' }
  if (!Number.isFinite(offer) || offer <= 0) return { ...state, lastError: 'Enter a valid offer.' }
  const result = negotiateNpcListing(listing, offer, now)
  return {
    ...state,
    marketplace: {
      ...state.marketplace,
      npcListings: state.marketplace.npcListings.some((candidate) => candidate.id === listingId)
        ? state.marketplace.npcListings.map((candidate) => candidate.id === listingId ? result.listing : candidate)
        : [result.listing, ...state.marketplace.npcListings],
    },
    lastError: result.error,
  }
}

function listItemOnMarket(
  state: GameState,
  itemId: string,
  askingPrice: number,
  requestId: string,
  now = Date.now(),
): GameState {
  if (hasProcessedMarketplaceRequest(state.marketplace, requestId)) return state
  const item = state.inventory.find((candidate) => candidate.instanceId === itemId)
  if (!item) return { ...state, lastError: 'That item is no longer in your inventory.' }
  if (item.isLocked) return { ...state, lastError: 'Unlock this item before listing it.' }
  if (!Number.isFinite(askingPrice) || askingPrice <= 0) return { ...state, lastError: 'Enter a valid asking price.' }
  const fairMarketValue = roundCurrency(getCurrentItemMarketValue(item, state.marketValues))
  const marketplace = rememberMarketplaceRequest({
    ...state.marketplace,
    playerListings: [{
      id: `player-listing-${nanoid()}`,
      item,
      askingPrice: roundCurrency(askingPrice),
      fairMarketValue,
      createdAt: now,
      expiresAt: now + MARKETPLACE_LISTING_DURATION_MS,
      status: 'active',
    }, ...state.marketplace.playerListings],
  }, requestId)
  return withInventoryValuation({
    ...state,
    inventory: state.inventory.filter((candidate) => candidate.instanceId !== itemId),
    marketplace,
    lastError: undefined,
  }, now)
}

function cancelPlayerMarketListing(state: GameState, listingId: string, requestId: string, now = Date.now()) {
  if (hasProcessedMarketplaceRequest(state.marketplace, requestId)) return state
  const listing = state.marketplace.playerListings.find((candidate) => candidate.id === listingId)
  if (!listing) return { ...state, lastError: 'That listing is no longer active.' }
  const marketplace = rememberMarketplaceRequest({
    ...state.marketplace,
    playerListings: state.marketplace.playerListings.filter((candidate) => candidate.id !== listingId),
    transactions: [{
      id: nanoid(), type: 'listing-cancelled' as const, item: listing.item, price: listing.askingPrice,
      fairMarketValue: listing.fairMarketValue, createdAt: now,
    }, ...state.marketplace.transactions].slice(0, 160),
  }, requestId)
  return withInventoryValuation({
    ...state,
    inventory: [listing.item, ...state.inventory],
    marketplace,
    lastError: undefined,
  }, now)
}

function completePlayerMarketSale(
  state: GameState,
  listingId: string,
  requestId: string,
  priceOverride?: number,
  now = Date.now(),
) {
  if (hasProcessedMarketplaceRequest(state.marketplace, requestId)) return state
  const listing = state.marketplace.playerListings.find((candidate) => candidate.id === listingId)
  if (!listing) return { ...state, lastError: 'That listing is no longer active.' }
  const price = roundCurrency(priceOverride ?? listing.askingPrice)
  const netPrice = roundCurrency(price * (1 - Math.max(0.025, 0.05 - getCareerSellerFeeDiscount(state.careerUpgrades))))
  const marketplace = rememberMarketplaceRequest({
    ...state.marketplace,
    playerListings: state.marketplace.playerListings.filter((candidate) => candidate.id !== listingId),
    transactions: [{
      id: nanoid(), type: priceOverride === undefined ? 'player-sale' as const : 'negotiated-sale' as const, item: listing.item, price,
      fairMarketValue: listing.fairMarketValue,
      counterparty: listing.incomingOffer?.buyer.username,
      createdAt: now,
    }, ...state.marketplace.transactions].slice(0, 160),
  }, requestId)
  return {
    ...state,
    money: roundCurrency(clampNumber(state.money) + netPrice),
    marketplace,
    lastError: undefined,
    statistics: {
      ...state.statistics,
      marketSales: state.statistics.marketSales + 1,
      itemsSold: state.statistics.itemsSold + 1,
      moneyEarned: roundCurrency(state.statistics.moneyEarned + netPrice),
      itemSaleRevenue: roundCurrency(state.statistics.itemSaleRevenue + netPrice),
    },
  }
}

function tickMarketplaceState(state: GameState, now = Date.now(), prng: Prng = Math.random) {
  const result = tickMarketplace(state.marketplace, state.marketValues, now, prng)
  const feeRate = Math.max(0.025, 0.05 - getCareerSellerFeeDiscount(state.careerUpgrades))
  const revenue = roundCurrency(result.completedSales.reduce((sum, listing) => sum + listing.askingPrice * (1 - feeRate), 0))
  const saleTransactions = result.completedSales.map((listing) => ({
    id: nanoid(),
    type: 'player-sale' as const,
    item: listing.item,
    price: listing.askingPrice,
    fairMarketValue: listing.fairMarketValue,
    counterparty: 'Marketplace buyer',
    createdAt: now,
  }))
  return withInventoryValuation({
    ...state,
    money: roundCurrency(clampNumber(state.money) + revenue),
    inventory: [...result.expiredListings.map((listing) => listing.item), ...state.inventory],
    marketplace: {
      ...result.marketplace,
      transactions: [
        ...saleTransactions,
        ...result.expiredListings.map((listing) => ({
          id: nanoid(),
          type: 'listing-cancelled' as const,
          item: listing.item,
          price: listing.askingPrice,
          fairMarketValue: listing.fairMarketValue,
          createdAt: now,
        })),
        ...result.marketplace.transactions,
      ].slice(0, 160),
    },
    statistics: {
      ...state.statistics,
      marketSales: state.statistics.marketSales + result.completedSales.length,
      itemsSold: state.statistics.itemsSold + result.completedSales.length,
      moneyEarned: roundCurrency(state.statistics.moneyEarned + revenue),
      itemSaleRevenue: roundCurrency(state.statistics.itemSaleRevenue + revenue),
    },
  }, now)
}

function claimAchievementReward(
  state: GameState,
  achievementId: string,
  now = Date.now(),
): GameState {
  const achievement = achievementsById.get(achievementId)
  const progress = getAchievementProgress(state.achievements, achievementId, state.career.runId)

  if (!achievement || !progress) {
    return {
      ...state,
      lastError: 'Achievement is locked.',
    }
  }

  if (progress.isClaimed) {
    return {
      ...state,
      lastError: 'Achievement reward already claimed.',
    }
  }

  const reward = achievement.reward

  if (!reward) {
    return {
      ...state,
      lastError: 'This achievement has no reward to claim.',
    }
  }

  const convertedLegacyCash = (reward.upgradePoints ?? 0) * 100 + (reward.skillPoints ?? 0) * 50

  return {
    ...state,
    money: roundCurrency(clampNumber(state.money) + (reward.money ?? 0) + convertedLegacyCash),
    uiEvents: appendEvents(state, [{ id: `achievement-claim:${achievementId}:${progress.runId ?? 'lifetime'}`, type: 'achievement_reward_claimed', count: 1, cash: roundCurrency((reward.money ?? 0) + convertedLegacyCash), createdAt: now }]),
    achievements: state.achievements.map((entry) => {
      if (entry !== progress) {
        return entry
      }

      return {
        ...entry,
        isClaimed: true,
        unlockedAt: entry.unlockedAt || now,
      }
    }),
    lastError: undefined,
  }
}

function claimAllAchievementRewards(state: GameState, now = Date.now()): GameState {
  const claimableKeys = new Set(
    state.achievements.flatMap((progress) => {
      const reward = achievementsById.get(progress.id)?.reward
      return !progress.isClaimed && reward ? [`${progress.id}:${progress.runId ?? 'lifetime'}`] : []
    }),
  )

  if (claimableKeys.size === 0) {
    return { ...state, lastError: 'No achievement rewards are ready to claim.' }
  }

  const totals = state.achievements.reduce((rewardTotals, progress) => {
    const key = `${progress.id}:${progress.runId ?? 'lifetime'}`
    if (!claimableKeys.has(key)) return rewardTotals
    const reward = achievementsById.get(progress.id)?.reward
    return {
      money: rewardTotals.money + (reward?.money ?? 0) + (reward?.upgradePoints ?? 0) * 100 + (reward?.skillPoints ?? 0) * 50,
    }
  }, { money: 0 })

  return {
    ...state,
    money: roundCurrency(clampNumber(state.money) + totals.money),
    uiEvents: appendEvents(state, [{ id: `achievement-claim-all:${now}`, type: 'achievement_reward_claimed', count: claimableKeys.size, cash: roundCurrency(totals.money), createdAt: now }]),
    achievements: state.achievements.map((entry) => claimableKeys.has(`${entry.id}:${entry.runId ?? 'lifetime'}`)
      ? { ...entry, isClaimed: true, unlockedAt: entry.unlockedAt || now }
      : entry),
    lastError: undefined,
  }
}

function getDailyRewardSkin(rewardRarity?: Rarity) {
  const candidates = SKIN_DEFINITIONS.filter((skin) => {
    return rewardRarity ? skin.rarity === rewardRarity : skin.rarity !== Rarity.SpecialItem
  })

  return candidates[Math.floor(Math.random() * candidates.length)] ?? SKIN_DEFINITIONS[0]
}

function applyDailyRewardCaseDiscount(
  state: GameState,
  percent: number | undefined,
  durationMs: number | undefined,
  now: number,
) {
  if (!percent || percent <= 0) {
    return state
  }

  return {
    ...state,
    dailyRewards: {
      ...state.dailyRewards,
      caseDiscountBuff: {
        percent,
        expiresAt: now + (durationMs ?? 24 * 60 * 60 * 1_000),
      },
    },
  }
}

function claimDailyReward(state: GameState, now = Date.now()): GameState {
  const refreshedRewards = refreshDailyRewardsState(state.dailyRewards, now)
  const rewardInfo = getNextDailyRewardInfo(refreshedRewards, now)

  if (rewardInfo.alreadyClaimedToday) {
    return {
      ...state,
      dailyRewards: refreshedRewards,
      lastError: 'Daily reward already claimed today.',
    }
  }

  if (rewardInfo.reward.kind === DailyRewardKind.RandomSkin && !hasInventorySpace(state)) {
    return {
      ...state,
      dailyRewards: refreshedRewards,
      lastError: 'Inventory is full. Make room before claiming this skin reward.',
    }
  }

  const rewardClaim = {
    claimedAt: now,
    day: rewardInfo.nextStreak,
    dayKey: rewardInfo.todayKey,
    label: rewardInfo.reward.label,
  }
  const rewardEvent: GameUiEvent = {
    id: nanoid(),
    type: 'daily_reward_claimed',
    reward: rewardClaim,
    createdAt: now,
  }
  let nextState: GameState = {
    ...state,
    dailyRewards: {
      ...refreshedRewards,
      streak: rewardInfo.nextStreak,
      lastClaimTime: now,
      lastClaimDayKey: rewardInfo.todayKey,
      lastReward: rewardClaim,
    },
    lastError: undefined,
    uiEvents: appendEvents(state, [rewardEvent]),
  }

  if (rewardInfo.reward.openingCredits) {
    nextState = {
      ...nextState,
      dailyRewards: {
        ...nextState.dailyRewards,
        openingCredits: addOpeningCredits(
          nextState.dailyRewards.openingCredits,
          rewardInfo.reward.openingCredits,
        ),
      },
    }
  }

  if (rewardInfo.reward.kind === DailyRewardKind.Money) {
    nextState = {
      ...nextState,
      money: roundCurrency(clampNumber(nextState.money) + (rewardInfo.reward.money ?? 0)),
    }
  }

  if (rewardInfo.reward.kind === DailyRewardKind.CaseDiscountBuff) {
    nextState = applyDailyRewardCaseDiscount(
      nextState,
      rewardInfo.reward.caseDiscountPercent,
      rewardInfo.reward.durationMs,
      now,
    )
  }

  if (rewardInfo.reward.kind === DailyRewardKind.RandomSkin) {
    const skin = getDailyRewardSkin(rewardInfo.reward.skinRarity)
    const item = createSkinInstance(skin, nextState, now)

    nextState = withDropChallengeProgress(withInventoryValuation({
      ...nextState,
      inventory: [item, ...nextState.inventory],
      collectionBook: updateCollectionBook(nextState.collectionBook, item),
      currentRunCollectionBook: updateCollectionBook(nextState.currentRunCollectionBook, item),
      recentDrops: [item, ...nextState.recentDrops].slice(0, RECENT_DROPS_LIMIT),
      lastOpenedItems: [item],
      statistics: {
        ...nextState.statistics,
        patternDrops: nextState.statistics.patternDrops + (isSpecialPattern(item) ? 1 : 0),
        exceptionalPatternDrops: nextState.statistics.exceptionalPatternDrops + (isExceptionalPattern(item) ? 1 : 0),
      },
    }, now), [item], now)
  }

  if (rewardInfo.reward.kind === DailyRewardKind.RareCase && rewardInfo.reward.caseId) {
    nextState = {
      ...nextState,
      casesUnlocked: Array.from(new Set([...nextState.casesUnlocked, rewardInfo.reward.caseId])),
    }
  }

  return nextState
}

function applyChallengeReward(
  state: GameState,
  reward: {
    money?: number
    openingCredits?: number
    caseDiscountPercent?: number
    durationMs?: number
  },
  now: number,
) {
  const money = reward.money ?? 0
  const rewardedState = {
    ...state,
    money: roundCurrency(clampNumber(state.money) + money),
    dailyRewards: {
      ...state.dailyRewards,
      openingCredits: addOpeningCredits(
        state.dailyRewards.openingCredits,
        reward.openingCredits ?? 0,
      ),
    },
  }

  return applyDailyRewardCaseDiscount(
    rewardedState,
    reward.caseDiscountPercent,
    reward.durationMs,
    now,
  )
}

function claimDailyChallenge(state: GameState, challengeId: string, now = Date.now()): GameState {
  const refreshedRewards = refreshDailyRewardsState(state.dailyRewards, now)
  const result = markDailyChallengeClaimed(refreshedRewards, challengeId)

  if (!result) {
    return {
      ...state,
      dailyRewards: refreshedRewards,
      lastError: 'Daily challenge is not ready to claim.',
    }
  }

  const claimedState = applyChallengeReward(
    {
      ...state,
      dailyRewards: result.dailyRewards,
      lastError: undefined,
    },
    result.challenge.reward,
    now,
  )
  const event: GameUiEvent = {
    id: nanoid(),
    type: 'daily_challenge_claimed',
    challenge: result.challenge,
    createdAt: now,
  }

  return {
    ...claimedState,
    uiEvents: appendEvents(claimedState, [event]),
  }
}

function rerollDailyChallengeAction(state: GameState, challengeId: string, now = Date.now()): GameState {
  const dailyRewards = rerollDailyChallenge(state.dailyRewards, challengeId, now)

  if (!dailyRewards) {
    return {
      ...state,
      dailyRewards: refreshDailyRewardsState(state.dailyRewards, now),
      lastError: 'No free daily challenge rerolls remain.',
    }
  }

  const rerolledChallenge = dailyRewards.challenges.find((challenge) => {
    return challenge.generatedAt === now
  })
  const event: GameUiEvent[] = rerolledChallenge
    ? [
        {
          id: nanoid(),
          type: 'daily_challenge_rerolled' as const,
          challenge: rerolledChallenge,
          createdAt: now,
        },
      ]
    : []

  return {
    ...state,
    dailyRewards,
    lastError: undefined,
    uiEvents: event.length > 0 ? appendEvents(state, event) : state.uiEvents,
  }
}

function updateAutoSellRule(
  autoSellRules: AutoSellRule[],
  ruleId: string,
  ruleUpdate: Partial<AutoSellRule>,
) {
  return autoSellRules.map((rule) => {
    if (rule.id !== ruleId) {
      return rule
    }

    return {
      ...rule,
      ...ruleUpdate,
      id: rule.id,
    }
  })
}

function reorderAutoSellRules(autoSellRules: AutoSellRule[], ruleIds: string[]) {
  const rulesById = new Map(autoSellRules.map((rule) => [rule.id, rule]))
  const orderedRules = ruleIds
    .map((ruleId) => rulesById.get(ruleId))
    .filter((rule): rule is AutoSellRule => Boolean(rule))
  const orderedRuleIds = new Set(orderedRules.map((rule) => rule.id))
  const missingRules = autoSellRules.filter((rule) => !orderedRuleIds.has(rule.id))

  return [...orderedRules, ...missingRules]
}

function appendQuestRequest(state: GameState, requestId: string) {
  return [...state.quests.processedRequestIds, requestId].slice(-QUEST_REQUEST_LIMIT)
}

function claimQuestStage(state: GameState, questId: string, requestId: string, now: number): GameState {
  if (state.quests.processedRequestIds.includes(requestId)) return state
  const definition = questsById.get(questId)
  if (!definition || !isQuestUnlocked(state, definition)) return { ...state, lastError: 'Quest is not available.' }
  const progress = getQuestProgressState(state, definition)
  const stage = definition.stages[progress.stageIndex]
  if (!stage || progress.claimedStageIds.includes(stage.id) || !getQuestStageStatus(state, definition).complete) {
    return { ...state, lastError: 'Quest stage requirements are not complete.' }
  }

  const reward = stage.reward
  const stageEventId = `${questId}:${stage.id}:${definition.repeatable ? state.quests.currentPeriod : state.economyLedger.currentRunId}`
  const isFinalStage = progress.stageIndex >= definition.stages.length - 1
  const nextProgress = {
    ...progress,
    stageIndex: isFinalStage ? progress.stageIndex : progress.stageIndex + 1,
    claimedStageIds: [...progress.claimedStageIds, stage.id],
    completedAt: isFinalStage ? now : undefined,
  }
  const moneyReward = Math.min(100, Math.max(0, Number(reward.money ?? 0)))
  const creditReward = Math.min(10, Math.max(0, Number(reward.openingCredits ?? 0)))
  const career = awardQuestCareerXp(state.career, {
    eventId: stageEventId,
    xp: reward.careerXp ?? 0,
    reason: `${definition.name}: ${stage.title}`,
    timestamp: now,
    category: definition.category === 'opening' ? 'caseOpening' : definition.category === 'contract' ? 'trading' : 'collecting',
  })
  return {
    ...state,
    money: roundCurrency(state.money + moneyReward),
    dailyRewards: { ...state.dailyRewards, openingCredits: roundCurrency(state.dailyRewards.openingCredits + creditReward) },
    career,
    quests: {
      ...state.quests,
      progress: { ...state.quests.progress, [questId]: nextProgress },
      processedRequestIds: appendQuestRequest(state, requestId),
      cosmetics: {
        decorations: reward.decoration && !state.quests.cosmetics.decorations.includes(reward.decoration)
          ? [...state.quests.cosmetics.decorations, reward.decoration]
          : state.quests.cosmetics.decorations,
        titles: reward.title && !state.quests.cosmetics.titles.includes(reward.title)
          ? [...state.quests.cosmetics.titles, reward.title]
          : state.quests.cosmetics.titles,
      },
    },
    statistics: { ...state.statistics, moneyEarned: roundCurrency(state.statistics.moneyEarned + moneyReward) },
    lastError: undefined,
    uiEvents: appendEvents(state, [{
      id: requestId,
      type: 'quest_reward_claimed',
      questId,
      message: `${stage.title} complete${creditReward ? ` · +$${creditReward.toFixed(2)} toward opening cases` : ''}`,
      createdAt: now,
    }]),
  }
}

function deliverQuestItem(state: GameState, questId: string, itemId: string, requestId: string, now: number): GameState {
  if (state.quests.processedRequestIds.includes(requestId)) return state
  const definition = questsById.get(questId)
  if (!definition || !isQuestUnlocked(state, definition)) return { ...state, lastError: 'Quest is not available.' }
  const progress = getQuestProgressState(state, definition)
  const stage = definition.stages[progress.stageIndex]
  const requirement = stage?.requirements.find((entry) => entry.type === 'deliver_item')
  const item = state.inventory.find((candidate) => candidate.instanceId === itemId)
  const trophyIds = new Set(Object.values(state.trophyAssignments).flatMap((assignment) => assignment ? [assignment.itemId] : []))
  if (!stage || !requirement || !item || item.isLocked || item.isFavorited || trophyIds.has(itemId)) {
    return { ...state, lastError: 'That item is unavailable or protected.' }
  }
  if (!isQuestItemEligible(item, requirement)) return { ...state, lastError: 'That item does not meet this request.' }
  return withInventoryValuation({
    ...state,
    inventory: state.inventory.filter((candidate) => candidate.instanceId !== itemId),
    quests: {
      ...state.quests,
      progress: { ...state.quests.progress, [questId]: { ...progress, deliveredStageIds: [...progress.deliveredStageIds, stage.id] } },
      processedRequestIds: appendQuestRequest(state, requestId),
    },
    lastError: undefined,
    uiEvents: appendEvents(state, [{ id: requestId, type: 'npc_item_delivered', questId, message: `${item.weapon} | ${item.finish} delivered for a quest.`, createdAt: now }]),
  }, now)
}

function reduceGameState(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'ADD_MONEY':
      return {
        ...state,
        money: roundCurrency(clampNumber(state.money) + clampNumber(action.amount)),
      }
    case 'COMPLETE_POOP_CLEANING':
    case 'COMPLETE_POOP_CLEANUP_MINIGAME':
      return completePoopCleaning(state, action.now)
    case 'COMPLETE_WORK_MINIGAME':
      return completeWorkMiniGame(state, action.gameId, action.now, action.performance)
    case 'SPEND_MONEY':
      if (!Number.isFinite(action.amount) || action.amount < 0) {
        return {
          ...state,
          lastError: 'Invalid spend amount.',
        }
      }

      if (clampNumber(state.money) < action.amount) {
        return {
          ...state,
          lastError: 'Not enough money.',
        }
      }

      return {
        ...state,
        money: roundCurrency(clampNumber(state.money) - action.amount),
        lastError: undefined,
      }
    case 'ADD_ITEM':
      if (state.inventory.some((item) => item.instanceId === action.item.instanceId)) {
        return {
          ...state,
          lastError: 'Item already exists in inventory.',
        }
      }


      if (!hasInventorySpace(state)) {
        return {
          ...state,
          lastError: 'Inventory is full. Sell items or expand the Warehouse first.',
        }
      }

      return withProgressionUnlocks(withInventoryValuation({
        ...state,
        inventory: [action.item, ...state.inventory],
      }, action.item.discoveredAt), action.item.discoveredAt)
    case 'REMOVE_ITEM':
      return withInventoryValuation({
        ...state,
        inventory: state.inventory.filter((item) => item.instanceId !== action.itemId),
      })
    case 'TOGGLE_ITEM_LOCK': {
      const existingItem = state.inventory.find((item) => item.instanceId === action.itemId)

      if (!existingItem) {
        return state
      }

      const updatedItem = {
        ...existingItem,
        isLocked: !existingItem.isLocked,
      }
      const event: GameUiEvent = {
        id: nanoid(),
        type: 'item_lock_toggled',
        item: updatedItem,
        isLocked: updatedItem.isLocked,
        createdAt: Date.now(),
      }

      return {
        ...state,
        inventory: state.inventory.map((item) =>
          item.instanceId === action.itemId ? updatedItem : item,
        ),
        uiEvents: appendEvents(state, [event]),
      }
    }
    case 'TOGGLE_ITEM_FAVORITE': {
      const existingItem = state.inventory.find((item) => item.instanceId === action.itemId)

      if (!existingItem) {
        return state
      }

      const updatedItem = {
        ...existingItem,
        isFavorited: !existingItem.isFavorited,
      }
      const event: GameUiEvent = {
        id: nanoid(),
        type: 'item_favorite_toggled',
        item: updatedItem,
        isFavorited: updatedItem.isFavorited,
        createdAt: Date.now(),
      }

      return {
        ...state,
        inventory: state.inventory.map((item) =>
          item.instanceId === action.itemId ? updatedItem : item,
        ),
        uiEvents: appendEvents(state, [event]),
      }
    }
    case 'SELL_ITEM':
      return withProgressionUnlocks(sellItem(state, action.itemId))
    case 'SELL_ITEMS':
      return withProgressionUnlocks(sellItems(state, action.itemIds))
    case 'TRADE_UP':
      return withProgressionUnlocks(tradeUpItems(state, action.itemIds))
    case 'BUY_MARKET_LISTING':
      return withProgressionUnlocks(buyMarketListing(state, action.listingId, action.requestId, action.listing, action.negotiatedPrice, action.now), action.now)
    case 'NEGOTIATE_MARKET_LISTING':
      return negotiateMarketListing(state, action.listingId, action.offer, action.listing, action.now)
    case 'LIST_ITEM_ON_MARKET':
      return listItemOnMarket(state, action.itemId, action.askingPrice, action.requestId, action.now)
    case 'CANCEL_PLAYER_MARKET_LISTING':
      return cancelPlayerMarketListing(state, action.listingId, action.requestId, action.now)
    case 'ACCEPT_PLAYER_MARKET_OFFER': {
      const listing = state.marketplace.playerListings.find((candidate) => candidate.id === action.listingId)
      if (!listing?.incomingOffer || listing.incomingOffer.expiresAt <= (action.now ?? Date.now())) {
        return { ...state, lastError: 'That buyer offer is no longer available.' }
      }
      return completePlayerMarketSale(state, action.listingId, action.requestId, listing.incomingOffer.amount, action.now)
    }
    case 'DECLINE_PLAYER_MARKET_OFFER':
      return {
        ...state,
        marketplace: {
          ...state.marketplace,
          playerListings: state.marketplace.playerListings.map((listing) => listing.id === action.listingId
            ? { ...listing, incomingOffer: undefined, status: 'active' as const }
            : listing),
        },
        lastError: undefined,
      }
    case 'CLAIM_ACQUISITION':
      return state.marketplace.pendingAcquisition?.id === action.acquisitionId
        ? { ...state, marketplace: { ...state.marketplace, pendingAcquisition: undefined } }
        : state
    case 'TICK_MARKETPLACE':
      return tickMarketplaceState(state, action.now, action.prng)
    case 'PURCHASE_AUTO_OPENER':
      return withProgressionUnlocks(
        purchaseAutoOpener(state, action.caseId, action.now),
        action.now,
      )
    case 'SET_AUTO_OPENER_CASE':
      return setAutoOpenerCase(state, action.caseId)
    case 'TOGGLE_AUTO_OPENER':
      return toggleAutoOpener(state, action.isEnabled, action.now)
    case 'PURCHASE_AUTOMATION_MODULE':
      return withProgressionUnlocks(
        purchaseAutomationModule(state, action.moduleId, action.now),
        action.now,
      )
    case 'TOGGLE_AUTOMATION_MODULE':
      return toggleAutomationModule(state, action.moduleId, action.isEnabled, action.now)
    case 'PURCHASE_UPGRADE':
      return withProgressionUnlocks(purchaseUpgrade(state, action.upgradeId), action.now)
    case 'PURCHASE_CAREER_UPGRADE':
      return withProgressionUnlocks(purchaseCareerUpgrade(state, action.upgradeId, action.now), action.now)
    case 'PRESTIGE':
      return withProgressionUnlocks(prestigeRun(
        state,
        action.requestId ?? `legacy-prestige:${state.economyLedger.currentRunId}`,
        action.sourceRunId ?? '',
        action.vaultItemIds ?? [],
        action.backupProof ?? '',
        action.now,
      ), action.now)
    case 'PURCHASE_PRESTIGE_BONUS':
      return purchasePrestigeBonus(state, action.bonusId)
    case 'PURCHASE_PRESTIGE_PERK':
      return purchasePrestigePerk(state, action.perkId)
    case 'LEARN_SKILL_NODE':
      return learnSkillNode(state, action.nodeId)
    case 'ASSIGN_TROPHY_ITEM':
      return withProgressionUnlocks(
        assignTrophyItem(state, action.slotId, action.itemId, action.now),
        action.now,
      )
    case 'REMOVE_TROPHY_ITEM':
      return removeTrophyItem(state, action.slotId)
    case 'TICK_AUTOMATION': {
      const nextState = tickAutomation(state, action.now, action.prng)

      return nextState === state ? state : withProgressionUnlocks(nextState, action.now)
    }
    case 'HIRE_EMPLOYEE':
      return withProgressionUnlocks(hireBusinessEmployee(state, action.roleId, action.requestId, action.now ?? Date.now()), action.now)
    case 'TRAIN_EMPLOYEE':
      return withProgressionUnlocks(trainBusinessEmployee(state, action.roleId, action.requestId, action.now ?? Date.now()), action.now)
    case 'TOGGLE_EMPLOYEE':
      return toggleBusinessEmployee(state, action.roleId, action.isEnabled, action.now ?? Date.now())
    case 'UPDATE_EMPLOYEE_SETTINGS':
      return updateBusinessEmployeeSettings(state, action.roleId, action.settings, action.now ?? Date.now())
    case 'ALLOCATE_EMPLOYEE_BUDGET':
      return allocateEmployeeBudget(state, action.roleId, action.amount, action.requestId)
    case 'RELEASE_EMPLOYEE_BUDGET':
      return releaseEmployeeBudget(state, action.roleId, action.amount ?? state.business.employees[action.roleId].availableCapital, action.requestId)
    case 'TICK_BUSINESS': {
      const nextState = tickBusiness(state, action.now ?? Date.now(), action.prng, action.maxOperations)
      return nextState === state ? state : withProgressionUnlocks(nextState, action.now)
    }
    case 'CREATE_SCOUT_WATCHLIST':
      return createScoutWatchlist(state, action.watchlist, action.requestId)
    case 'UPDATE_SCOUT_WATCHLIST':
      return { ...state, business: { ...state.business, watchlists: state.business.watchlists.map((entry) => entry.id === action.watchlistId ? { ...entry, ...action.watchlist, id: entry.id } : entry) }, lastError: undefined }
    case 'REMOVE_SCOUT_WATCHLIST':
      if (state.business.processedOperationIds.includes(action.requestId)) return state
      return appendBusinessProcessedId({ ...state, business: { ...state.business, watchlists: state.business.watchlists.filter((entry) => entry.id !== action.watchlistId), alerts: state.business.alerts.filter((alert) => alert.watchlistId !== action.watchlistId) }, lastError: undefined }, action.requestId)
    case 'SET_SCOUT_ALERT_STATUS':
      return { ...state, business: { ...state.business, alerts: state.business.alerts.map((alert) => alert.id === action.alertId ? { ...alert, status: action.status } : alert) } }
    case 'CONFIRM_BUSINESS_TRADE_UP':
      return withProgressionUnlocks(confirmBusinessTradeUp(state, action.approvalId, action.requestId, action.now ?? Date.now()), action.now)
    case 'PURCHASE_AUCTION_DEAL':
      return withProgressionUnlocks(purchaseAuctionDeal(state, action.dealId, action.now), action.now)
    case 'CLAIM_DAILY_REWARD':
      return withProgressionUnlocks(claimDailyReward(state, action.now), action.now)
    case 'CLAIM_DAILY_CHALLENGE':
      return withProgressionUnlocks(claimDailyChallenge(state, action.challengeId, action.now), action.now)
    case 'REROLL_DAILY_CHALLENGE':
      return rerollDailyChallengeAction(state, action.challengeId, action.now)
    case 'REFRESH_DAILY_REWARDS':
      return {
        ...state,
        dailyRewards: refreshDailyRewardsState(state.dailyRewards, action.now),
      }
    case 'CLAIM_ACHIEVEMENT_REWARD':
      return claimAchievementReward(state, action.achievementId, action.now)
    case 'CLAIM_ALL_ACHIEVEMENT_REWARDS':
      return claimAllAchievementRewards(state, action.now)
    case 'TRACK_QUEST': {
      const tracked = state.quests.trackedQuestIds.includes(action.questId)
        ? state.quests.trackedQuestIds.filter((id) => id !== action.questId)
        : [...state.quests.trackedQuestIds, action.questId].slice(-MAX_TRACKED_QUESTS)
      return questsById.has(action.questId) ? { ...state, quests: { ...state.quests, trackedQuestIds: tracked } } : state
    }
    case 'CLAIM_QUEST_STAGE':
      return claimQuestStage(state, action.questId, action.requestId, action.now ?? Date.now())
    case 'DELIVER_QUEST_ITEM':
      return deliverQuestItem(state, action.questId, action.itemId, action.requestId, action.now ?? Date.now())
    case 'MARK_NPC_DIALOGUE_SEEN':
      // Historical action type remains readable, but retired character actions do nothing.
      return state
    case 'UNLOCK_CASE':
      if (state.casesUnlocked.includes(action.caseId)) {
        return state
      }

      return {
        ...state,
        casesUnlocked: [...state.casesUnlocked, action.caseId],
      }
    case 'PURCHASE_CASE_LICENSE':
      return withProgressionUnlocks(purchaseCaseLicense(state, action.caseId, action.licenseCost), action.now)
    case 'TOGGLE_CASE_FAVORITE':
      if (state.favoriteCaseIds.includes(action.caseId)) {
        return {
          ...state,
          favoriteCaseIds: state.favoriteCaseIds.filter((caseId) => caseId !== action.caseId),
        }
      }

      return {
        ...state,
        favoriteCaseIds: [...state.favoriteCaseIds, action.caseId],
      }
    case 'OPEN_CASE':
      return withProgressionUnlocks(openCase(
        state,
        action.payload.caseId,
        action.payload.quantity,
        action.payload.now ?? Date.now(),
        action.payload.openingEventId,
        true,
      ))
    case 'UPDATE_MARKET_VALUE': {
      const updatedAt = Date.now()
      const nextValue = roundCurrency(action.value)
      const nextMarketValues = {
        ...state.marketValues,
        [action.skinId]: nextValue,
      }
      const skin = skinDefinitionsById.get(action.skinId)

      return withProgressionUnlocks(withInventoryValuation({
        ...state,
        marketValues: nextMarketValues,
        marketHistory: skin
          ? {
              ...state.marketHistory,
              ...appendMarketPriceHistory({
                marketHistory: state.marketHistory,
                marketValues: nextMarketValues,
                now: updatedAt,
                skins: [skin],
              }),
            }
          : state.marketHistory,
        marketTrends: {
          ...state.marketTrends,
          [action.skinId]:
            nextValue > (state.marketValues[action.skinId] ?? 0)
              ? '↑'
              : nextValue < (state.marketValues[action.skinId] ?? 0)
                ? '↓'
                : '→',
        },
      }, updatedAt), updatedAt)
    }
    case 'APPLY_EXTERNAL_SKIN_PRICES': {
      const updatedAt = action.now ?? Date.now()
      const incomingEntries = Object.entries(action.marketValues)
        .filter(([, value]) => Number.isFinite(value) && value > 0)

      if (incomingEntries.length === 0) {
        return state
      }

      const nextMarketValues = { ...state.marketValues }
      const nextMarketTrends = { ...state.marketTrends }
      let changed = false

      for (const [skinId, rawValue] of incomingEntries) {
        const nextValue = roundCurrency(rawValue)
        const previousValue = state.marketValues[skinId]

        if (previousValue === nextValue) {
          continue
        }

        nextMarketValues[skinId] = nextValue
        nextMarketTrends[skinId] =
          (nextValue > (previousValue ?? 0)
            ? 'â†‘'
            : nextValue < (previousValue ?? 0)
              ? 'â†“'
              : 'â†’') as GameState['marketTrends'][string]
        changed = true
      }

      if (!changed) {
        return state
      }

      return withProgressionUnlocks(withInventoryValuation({
        ...state,
        marketValues: nextMarketValues,
        marketTrends: nextMarketTrends,
      }, updatedAt), updatedAt)
    }
    case 'TICK_EVENTS': {
      const now = action.now ?? Date.now()
      const tick = eventManager.tick({
        activeEvents: state.activeEvents,
        casesOpened: state.statistics.casesOpened,
        eventChanceBonus: getEventScheduleChanceBonus(state),
        eventHistory: state.eventHistory,
        now,
        prng: action.prng,
        scheduleTicks: action.scheduleTicks,
        upcomingEvents: state.upcomingEvents,
      })
      const marketEvents = syncMarketEventsFromGameEvents({
        activeGameEvents: tick.activeEvents,
        activeMarketEvents: state.activeMarketEvents,
        endedGameEvents: tick.endedEvents,
        marketEventHistory: state.marketEventHistory,
        now,
        upcomingGameEvents: tick.upcomingEvents,
        upcomingMarketEvents: state.upcomingMarketEvents,
      })
      const uiEvents: GameUiEvent[] = [
        ...tick.startedEvents.map((event) => ({
          id: nanoid(),
          type: 'game_event_started' as const,
          eventId: event.id,
          name: event.name,
          description: event.description,
          createdAt: now,
        })),
        ...tick.endedEvents.map((event) => ({
          id: nanoid(),
          type: 'game_event_ended' as const,
          eventId: event.id,
          name: event.name,
          createdAt: now,
        })),
      ]

      return {
        ...state,
        ...marketEvents,
        activeEvents: tick.activeEvents,
        upcomingEvents: tick.upcomingEvents,
        eventHistory: tick.eventHistory,
        specialEventCaseIds: Array.from(new Set([
          ...tick.specialEventCaseIds,
          ...marketEvents.activeMarketEvents.flatMap((event) => event.caseIds ?? []),
        ])),
        lastEventTick: now,
        uiEvents: appendEvents(state, uiEvents),
      }
    }
    case 'TRIGGER_GAME_EVENT': {
      const now = action.now ?? Date.now()

      if ([...state.activeEvents, ...state.upcomingEvents].some((event) => event.type === action.eventType)) {
        return {
          ...state,
          lastError: 'That event is already active or scheduled.',
        }
      }

      const candidate = eventManager.createEvent({
        casesOpened: state.statistics.casesOpened,
        durationMs: action.durationMs,
        now,
        type: action.eventType,
      })
      const tick = eventManager.tick({
        activeEvents: [...state.activeEvents, candidate],
        autoSchedule: false,
        casesOpened: state.statistics.casesOpened,
        eventHistory: state.eventHistory,
        now,
        upcomingEvents: state.upcomingEvents,
      })
      const isActive = tick.activeEvents.some((event) => event.id === candidate.id)

      if (!isActive) {
        return {
          ...state,
          lastError: 'That event conflicts with a higher-priority active event.',
        }
      }

      const marketEvents = syncMarketEventsFromGameEvents({
        activeGameEvents: tick.activeEvents,
        activeMarketEvents: state.activeMarketEvents,
        endedGameEvents: tick.endedEvents,
        marketEventHistory: state.marketEventHistory,
        now,
        upcomingGameEvents: tick.upcomingEvents,
        upcomingMarketEvents: state.upcomingMarketEvents,
      })
      const startedEvent: GameUiEvent = {
        id: nanoid(),
        type: 'game_event_started',
        eventId: candidate.id,
        name: candidate.name,
        description: candidate.description,
        createdAt: now,
      }

      return {
        ...state,
        ...marketEvents,
        activeEvents: tick.activeEvents,
        upcomingEvents: tick.upcomingEvents,
        eventHistory: tick.eventHistory,
        specialEventCaseIds: Array.from(new Set([
          ...tick.specialEventCaseIds,
          ...marketEvents.activeMarketEvents.flatMap((event) => event.caseIds ?? []),
        ])),
        lastEventTick: now,
        lastError: undefined,
        uiEvents: appendEvents(state, [startedEvent]),
      }
    }
    case 'TICK_MARKET': {
      const tick = tickMarket({
        activeEvents: state.activeMarketEvents,
        casesOpened: state.statistics.casesOpened,
        eventChanceBonus: getEventScheduleChanceBonus(state),
        eventHistory: state.marketEventHistory,
        marketHistory: state.marketHistory,
        marketTrends: state.marketTrends,
        marketValues: state.marketValues,
        now: action.now,
        prng: action.prng,
        recordHistory: action.recordHistory,
        trackedSkinIds: Array.from(new Set([
          ...state.inventory.map((item) => item.id),
          ...state.recentDrops.map((item) => item.id),
          ...state.lastOpenedItems.map((item) => item.id),
        ])),
        upcomingEvents: state.upcomingMarketEvents,
      })

      const marketState = withProgressionUnlocks(withInventoryValuation({
        ...state,
        marketValues: tick.marketValues,
        marketHistory: tick.marketHistory,
        marketTrends: tick.marketTrends,
        activeMarketEvents: tick.activeEvents,
        upcomingMarketEvents: tick.upcomingEvents,
        marketEventHistory: tick.eventHistory,
        specialEventCaseIds: Array.from(new Set([
          ...state.activeEvents.flatMap((event) => event.effects.specialEventCaseIds ?? []),
          ...tick.specialEventCaseIds,
        ])),
        lastMarketTick: tick.lastMarketTick,
      }, tick.lastMarketTick), tick.lastMarketTick)

      return tickMarketplaceState(marketState, tick.lastMarketTick, action.prng)
    }
    case 'APPLY_MARKET_TICK':
      return withProgressionUnlocks(withInventoryValuation({
        ...state,
        marketValues: action.tick.marketValues,
        marketHistory: action.tick.marketHistory,
        marketTrends: action.tick.marketTrends,
        activeMarketEvents: action.tick.activeEvents,
        upcomingMarketEvents: action.tick.upcomingEvents,
        marketEventHistory: action.tick.eventHistory,
        specialEventCaseIds: Array.from(new Set([
          ...state.activeEvents.flatMap((event) => event.effects.specialEventCaseIds ?? []),
          ...action.tick.specialEventCaseIds,
        ])),
        lastMarketTick: action.tick.lastMarketTick,
      }, action.tick.lastMarketTick), action.tick.lastMarketTick)
    case 'APPLY_OFFLINE_PROGRESS':
      return withProgressionUnlocks(withInventoryValuation({
        ...action.state,
        uiEvents: [],
        lastError: undefined,
      }, action.state.lastSaved), action.state.lastSaved)
    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.settings,
        },
      }
    case 'ADD_AUTO_SELL_RULE':
      return {
        ...state,
        autoSellRules: [...state.autoSellRules, action.rule],
      }
    case 'UPDATE_AUTO_SELL_RULE':
      return {
        ...state,
        autoSellRules: updateAutoSellRule(state.autoSellRules, action.ruleId, action.rule),
      }
    case 'REMOVE_AUTO_SELL_RULE':
      return {
        ...state,
        autoSellRules: state.autoSellRules.filter((rule) => rule.id !== action.ruleId),
      }
    case 'REORDER_AUTO_SELL_RULES':
      return {
        ...state,
        autoSellRules: reorderAutoSellRules(state.autoSellRules, action.ruleIds),
      }
    case 'UPDATE_INVENTORY_VIEW_STATE':
      return {
        ...state,
        ui: {
          ...state.ui,
          inventory: {
            ...state.ui.inventory,
            ...action.inventory,
            filters: action.inventory.filters
              ? {
                  ...state.ui.inventory.filters,
                  ...action.inventory.filters,
                }
              : state.ui.inventory.filters,
          },
        },
      }
    case 'UPDATE_ONBOARDING_STATE':
      return {
        ...state,
        ui: {
          ...state.ui,
          onboarding: {
            ...state.ui.onboarding,
            ...action.onboarding,
            completedStepIds:
              action.onboarding.completedStepIds ?? state.ui.onboarding.completedStepIds,
            dismissedTipIds:
              action.onboarding.dismissedTipIds ?? state.ui.onboarding.dismissedTipIds,
          },
        },
      }
    case 'UPDATE_FEATURE_UNLOCK_STATE':
      return {
        ...state,
        ui: {
          ...state.ui,
          featureUnlocks: { ...state.ui.featureUnlocks, ...action.featureUnlocks },
        },
      }
    case 'UPDATE_NOTIFICATION_STATE':
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: {
            ...state.ui.notifications,
            ...action.notifications,
            acknowledgedUpgradeIds: action.notifications.acknowledgedUpgradeIds
              ?? state.ui.notifications.acknowledgedUpgradeIds,
            readDropJournalEntryIds: action.notifications.readDropJournalEntryIds
              ?? state.ui.notifications.readDropJournalEntryIds,
          },
        },
      }
    case 'MARK_BACKUP_CREATED':
      return {
        ...state,
        lastBackupAt: action.now ?? Date.now(),
      }
    case 'REPLACE_GAME_STATE':
      return withProgressionUnlocks(withInventoryValuation({
        ...action.state,
        uiEvents: [],
        lastError: undefined,
      }))
    case 'CLEAR_GAME_ERROR':
      return {
        ...state,
        lastError: undefined,
      }
    case 'CLEAR_UI_EVENTS':
      return {
        ...state,
        uiEvents: [],
      }
    case 'DISMISS_UI_EVENT':
      return {
        ...state,
        uiEvents: state.uiEvents.filter((event) => event.id !== action.eventId),
      }
    case 'RESET_GAME':
      return defaultGameState
    default:
      return state
  }
}

function latchFeatureUnlocks(state: GameState): GameState {
  const existing = state.ui.featureUnlocks?.unlockedIds ?? []
  const gained = getFeatureProgress(state).filter((feature) => feature.unlocked && !existing.includes(feature.id)).map((feature) => feature.id)
  if (gained.length === 0) return state
  return { ...state, ui: { ...state.ui, featureUnlocks: { ...state.ui.featureUnlocks, unlockedIds: [...existing, ...gained] } } }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const reducedState = validateGameState(reduceGameState(state, action))
  const withEconomy = recordEconomyAction(state, reducedState, action)
  const withCareer = recordCareerAction(state, withEconomy, action)
  const nextJournal = action.type === 'REPLACE_GAME_STATE' || action.type === 'RESET_GAME' || action.type === 'APPLY_OFFLINE_PROGRESS'
    ? withCareer.dropJournal
    : recordDropJournalAction(state, withCareer, action)
  const withJournal = nextJournal === withCareer.dropJournal ? withCareer : { ...withCareer, dropJournal: nextJournal }
  const actionNow = action.type === 'OPEN_CASE'
    ? action.payload.now ?? Date.now()
    : 'now' in action && typeof action.now === 'number'
      ? action.now
      : Date.now()
  const nextQuests = action.type === 'REPLACE_GAME_STATE' || action.type === 'RESET_GAME' || action.type === 'APPLY_OFFLINE_PROGRESS' || action.type === 'PRESTIGE'
    ? withJournal.quests
    : recordQuestActivity(state, withJournal, action, actionNow)
  const withQuests = nextQuests === withJournal.quests ? withJournal : { ...withJournal, quests: nextQuests }
  const newlyReady = action.type === 'CLAIM_QUEST_STAGE' || action.type === 'REPLACE_GAME_STATE' || action.type === 'RESET_GAME'
    ? []
    : QUEST_DEFINITIONS.filter((quest) => withQuests.quests.trackedQuestIds.includes(quest.id) && isQuestUnlocked(withQuests, quest) && getQuestStageStatus(withQuests, quest).complete && (!isQuestUnlocked(state, quest) || !getQuestStageStatus(state, quest).complete))
  const withQuestFeedback = newlyReady.length === 0 ? withQuests : {
    ...withQuests,
    uiEvents: appendEvents(withQuests, newlyReady.map((quest): GameUiEvent => ({
      id: `quest-ready:${quest.id}:${getQuestProgressState(withQuests, quest).stageIndex}:${actionNow}`,
      type: 'quest_stage_ready',
      questId: quest.id,
      message: `${quest.name} is ready to claim.`,
      createdAt: actionNow,
    }))),
  }
  const careerXpGained = Math.max(0, withQuestFeedback.career.currentRunXp - state.career.currentRunXp)

  const withUnlocks = action.type === 'RESET_GAME' || action.type === 'REPLACE_GAME_STATE'
    ? withQuestFeedback
    : latchFeatureUnlocks(withQuestFeedback)
  if (
    careerXpGained <= 0 ||
    action.type === 'REPLACE_GAME_STATE' ||
    action.type === 'RESET_GAME' ||
    action.type === 'APPLY_OFFLINE_PROGRESS'
  ) {
    return withUnlocks
  }

  return withDailyChallengeProgress(
    withUnlocks,
    { type: 'career_xp', amount: careerXpGained },
    actionNow,
  )
}

