import { nanoid } from 'nanoid'
import { CASE_DEFINITIONS, unlockCasesForProgress } from './cases'
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
  type SkinBase,
  type SkinInstance,
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
import { shouldAutoSell } from '../utils/autoSell'
import {
  appendMarketPriceHistory,
  hydrateMarketEvent,
  tickMarket,
  type ActiveMarketEvent,
  type MarketEventLog,
} from '../market/marketSimulation'
import { analyzeTradeUp, pickTradeUpOutcome, suggestBestTradeUps } from '../utils/tradeUp'
import { achievementsById, getNewAchievementUnlocks } from './achievements'
import { getMarketAdjustedSkinConditionPrice } from './skinPrices'
import {
  CASE_FARM_INTERVAL_MS,
  TRADING_BOT_INTERVAL_MS,
  AUCTION_HOUSE_DEAL_DURATION_MS,
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
  canPurchaseUpgrade,
  getAutomationModuleCapacity,
  getClickIncomeMultiplier,
  getTrendPredictionBonus,
  getUpgradeAutomationIntervalMultiplier,
  getUpgradeSellValueMultiplier,
  upgradesById,
} from './upgrades'
import {
  applyPrestigeEffectsToCase,
  calculatePrestigePointAward,
  canPurchasePrestigeBonus,
  getPrestigeAutomationIntervalMultiplier,
  getPrestigeMarketKnowledgeBonus,
  getPrestigeSellMultiplier,
  getPrestigeStartingMoneyBonus,
  getPrestigeEligibility,
  prestigeBonusesById,
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
  getSkillNodeStatus,
  getSkillPrestigePointMultiplier,
  getSkillSellMultiplier,
  getSkillTradeUpInputCostMultiplier,
  skillTreeNodesById,
} from './skills'
import {
  applyGameEventEffectsToCase,
  eventManager,
  gameEventsToMarketEvents,
  getGameEventCollectionRewardMultiplier,
  getGameEventPrestigePointMultiplier,
  getGameEventTradeUpInputCostMultiplier,
  type ActiveGameEvent,
} from '../events/eventManager'
import { getInventoryFreeSlots, hasInventorySpace } from '../utils/inventoryCapacity'
import { isUnlockedTrophySlot } from '../utils/trophyRoom'
import {
  applyDailyCaseDiscountToCase,
  applyDailyChallengeProgress,
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
  getWorkMiniGameCooldownRemaining,
  workMiniGamesById,
  type WorkMiniGameId,
} from '../utils/workMinigames'

const RECENT_DROPS_LIMIT = 20
const UI_EVENTS_LIMIT = 50
const skinDefinitionsById = new Map(SKIN_DEFINITIONS.map((skin) => [skin.id, skin]))

function normalizeOpenQuantity(quantity?: number) {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    return 1
  }

  return Math.max(1, Math.floor(quantity))
}

function getAutomationSaleValue(state: GameState, item: SkinInstance) {
  const baseSaleValue =
    getCurrentItemMarketValue(item, state.marketValues) *
    getAutomationSellMultiplier(state.automation) *
    getUpgradeSellValueMultiplier(state.upgrades) *
    getPrestigeSellMultiplier(state.prestigeBonuses) *
    getSkillSellMultiplier(state.learnedSkillNodeIds)

  return roundCurrency(applyCollectionSellValueBonus(
    baseSaleValue,
    item,
    state.collectionRewards,
    getGameEventCollectionRewardMultiplier(state.activeEvents),
  ))
}

function appendEvents(state: GameState, events: GameUiEvent[]) {
  return [...events, ...state.uiEvents].slice(0, UI_EVENTS_LIMIT)
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

function completeWorkMiniGame(state: GameState, gameId: WorkMiniGameId, now = Date.now()): GameState {
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
    definition.reward *
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

  return {
    ...state,
    money: roundCurrency(clampNumber(state.money) + reward),
    lastPoopCleaningAt: gameId === 'poopCleaning' ? now : state.lastPoopCleaningAt,
    workMiniGameCooldowns,
    lastError: undefined,
    statistics: {
      ...state.statistics,
      moneyEarned: roundCurrency(state.statistics.moneyEarned + reward),
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

function filterDropTableByRarity(
  dropTable: { skinId: string; weight: number }[],
  predicate: (skin: SkinBase) => boolean,
) {
  return dropTable.filter((drop) => {
    const skin = skinDefinitionsById.get(drop.skinId)

    return skin ? predicate(skin) : false
  })
}

function pickDropFromTable(dropTable: { skinId: string; weight: number }[]) {
  return dropTable.length > 0 ? pickDrop(dropTable) : undefined
}

function getFirstCaseHookDrop(
  dropTable: { skinId: string; weight: number }[],
  hookRoll: number,
) {
  const specialDropTable = filterDropTableByRarity(dropTable, (skin) => skin.rarity === Rarity.SpecialItem)
  const normalDropTable = filterDropTableByRarity(dropTable, (skin) => skin.rarity !== Rarity.SpecialItem)
  const wantsForcedGold = hookRoll >= 0.8

  if (wantsForcedGold && specialDropTable.length > 0) {
    return {
      hook: 'forcedGold' as const,
      skinId: pickDropFromTable(specialDropTable),
    }
  }

  return {
    hook: 'nearMissGold' as const,
    skinId: pickDropFromTable(normalDropTable) ?? pickDropFromTable(dropTable),
  }
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
  const isStatTrak = hasStatTrak && prng() < 0.1
  const isSouvenir = !isStatTrak && hasSouvenir && prng() < 0.01
  const fallbackMarketValue = roundCurrency(applyWearMultiplier(marketBaseValue, wear, floatValue))
  const realMarketValue = getMarketAdjustedSkinConditionPrice({
    fallbackValue: fallbackMarketValue,
    isStatTrak,
    marketValues: state.marketValues,
    skin,
    wear,
  }) ?? fallbackMarketValue

  return {
    ...skin,
    instanceId: nanoid(),
    wear,
    floatValue,
    marketValue: roundCurrency(realMarketValue),
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

  return applyDailyCaseDiscountToCase(eventCaseDef, state.dailyRewards, now)
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
  firstCaseHookRoll?: number,
  openingEventId?: string,
): GameState {
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
  const affordableQuantity = Math.floor(currentMoney / dailyCaseDef.cost)
  const freeSlots = getInventoryFreeSlots(state)
  const actualQuantity = Math.min(quantity, affordableQuantity, freeSlots)

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
  let firstCaseHook: 'nearMissGold' | 'forcedGold' | undefined

  for (let index = 0; index < actualQuantity; index += 1) {
    const hookDrop = !state.hasUsedFirstCaseHook && index === 0
      ? getFirstCaseHookDrop(
          dailyCaseDef.dropTable,
          Math.min(Math.max(firstCaseHookRoll ?? Math.random(), 0), 0.999999),
        )
      : undefined
    const skinId = hookDrop?.skinId ?? pickDrop(dailyCaseDef.dropTable)
    firstCaseHook = hookDrop?.hook ?? firstCaseHook
    const skin = skinId ? skinDefinitionsById.get(skinId) : undefined
    const fallbackSkin = skin ?? getFallbackSkinForCase(dailyCaseDef.dropTable)

    if (!fallbackSkin) {
      return failOpenCase(state, caseId, 'Drop table could not be resolved.', openingEventId)
    }

    if (!skin) {
      console.error(`Missing skin "${skinId ?? 'unknown'}" in drop table for case "${caseId}". Falling back to ${fallbackSkin.id}.`)
    }

    const item = createSkinInstance(fallbackSkin, state, discoveredAt)
    openedItems.push(item)
    collectionBook = updateCollectionBook(collectionBook, item)
    inventory = [item, ...inventory]

    if (shouldAutoSell(item, state.autoSellRules, inventory)) {
      const soldItem = {
        ...item,
        marketValue: getAutomationSaleValue(state, item),
      }

      autoSoldItems.push(soldItem)
      inventory = inventory.filter((inventoryItem) => inventoryItem.instanceId !== item.instanceId)
    }
  }

  const totalCost = roundCurrency(dailyCaseDef.cost * actualQuantity)
  const autoSellValue = roundCurrency(
    autoSoldItems.reduce((total, item) => total + item.marketValue, 0),
  )
  const money = roundCurrency(currentMoney - totalCost + autoSellValue)
  const rareDrops = openedItems.filter((item) => isRareDrop(item.rarity)).length
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
      firstCaseHook,
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
    inventory,
    collectionBook,
    recentDrops: [...openedItems, ...state.recentDrops].slice(0, RECENT_DROPS_LIMIT),
    lastOpenedItems: openedItems,
    hasUsedFirstCaseHook: state.hasUsedFirstCaseHook || Boolean(firstCaseHook),
    lastError: partialOpenMessage,
    uiEvents: appendEvents(state, events),
    casesUnlocked: getUnlockedCaseIdsAfterOpening(state, casesOpened),
    statistics: {
      ...state.statistics,
      casesOpened,
      drops: state.statistics.drops + openedItems.length,
      rareDrops: state.statistics.rareDrops + rareDrops,
      moneySpent: roundCurrency(state.statistics.moneySpent + totalCost),
      moneyEarned: roundCurrency(state.statistics.moneyEarned + autoSellValue),
      itemsSold: state.statistics.itemsSold + autoSoldItems.length,
      dropsByRarity,
    },
  }, discoveredAt)
  const caseProgressState = withDailyChallengeProgress(
    openedState,
    {
      type: 'cases_opened',
      amount: actualQuantity,
    },
    discoveredAt,
  )
  const dropProgressState = withDropChallengeProgress(caseProgressState, openedItems, discoveredAt)

  return autoSellValue > 0
    ? withDailyChallengeProgress(
        dropProgressState,
        {
          type: 'sell_value',
          amount: autoSellValue,
        },
        discoveredAt,
      )
    : dropProgressState
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
  const currentAutoOpener = state.automation.autoOpener
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
  const moduleState = state.automation.modules[moduleId]
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

function purchaseUpgrade(state: GameState, upgradeId: UpgradeId): GameState {
  const definition = upgradesById.get(upgradeId)

  if (!definition) {
    return {
      ...state,
      lastError: 'Upgrade not found.',
    }
  }

  const purchase = canPurchaseUpgrade(definition, state)

  if (purchase.isMaxLevel) {
    return {
      ...state,
      lastError: 'Upgrade is already maxed.',
    }
  }

  if (!purchase.requirementsMet) {
    return {
      ...state,
      lastError: 'Upgrade requirements are not met.',
    }
  }

  if (!purchase.canAfford) {
    return {
      ...state,
      lastError: 'Not enough resources to purchase upgrade.',
    }
  }

  const nextLevel = purchase.level + 1

  return {
    ...state,
    money: roundCurrency(clampNumber(state.money) - purchase.cost.money),
    upgradePoints: state.upgradePoints - purchase.cost.upgradePoints,
    upgrades: {
      ...state.upgrades,
      [definition.id]: nextLevel,
    },
    lastError: undefined,
    statistics: {
      ...state.statistics,
      moneySpent: roundCurrency(state.statistics.moneySpent + purchase.cost.money),
    },
  }
}

function purchasePrestigeBonus(state: GameState, bonusId: PrestigeBonusId): GameState {
  const definition = prestigeBonusesById.get(bonusId)

  if (!definition) {
    return {
      ...state,
      lastError: 'Prestige bonus not found.',
    }
  }

  const purchase = canPurchasePrestigeBonus(definition, state)

  if (purchase.isMaxLevel) {
    return {
      ...state,
      lastError: 'Prestige bonus is already maxed.',
    }
  }

  if (!purchase.canAfford) {
    return {
      ...state,
      lastError: 'Not enough prestige points.',
    }
  }

  return {
    ...state,
    prestigePoints: state.prestigePoints - purchase.cost,
    prestigeBonuses: {
      ...state.prestigeBonuses,
      [definition.id]: purchase.level + 1,
    },
    lastError: undefined,
  }
}

function learnSkillNode(state: GameState, nodeId: SkillNodeId): GameState {
  const definition = skillTreeNodesById.get(nodeId)

  if (!definition) {
    return {
      ...state,
      lastError: 'Skill node not found.',
    }
  }

  const status = getSkillNodeStatus(definition, state)

  if (status.isLearned) {
    return {
      ...state,
      lastError: 'Skill node is already learned.',
    }
  }

  if (!status.hasPrerequisites) {
    return {
      ...state,
      lastError: 'Skill prerequisites are not met.',
    }
  }

  if (!status.canAfford) {
    return {
      ...state,
      lastError: 'Not enough skill points.',
    }
  }

  return {
    ...state,
    skillPoints: state.skillPoints - definition.cost,
    learnedSkillNodeIds: [...state.learnedSkillNodeIds, definition.id],
    lastError: undefined,
  }
}

function assignTrophyItem(
  state: GameState,
  slotId: string,
  itemId: string,
  now = Date.now(),
): GameState {
  if (!isUnlockedTrophySlot(slotId, state.learnedSkillNodeIds)) {
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

function prestigeRun(state: GameState, now = Date.now()): GameState {
  const snapshot = {
    achievements: state.achievements,
    casesOpened: state.statistics.casesOpened,
    collectionRewards: state.collectionRewards,
    inventoryValue: state.inventoryValue,
    moneyEarned: state.statistics.moneyEarned,
    moneySpent: state.statistics.moneySpent,
    prestigeBonuses: state.prestigeBonuses,
    prestigeLevel: state.prestigeLevel,
    prestigePoints: state.prestigePoints,
  }
  const eligibility = getPrestigeEligibility(snapshot)

  if (!eligibility.canPrestige) {
    return {
      ...state,
      lastError: eligibility.reason,
    }
  }

  const baseAwardedPoints = calculatePrestigePointAward(snapshot)
  const awardedPoints = Math.max(
    1,
    Math.ceil(
      baseAwardedPoints *
        getSkillPrestigePointMultiplier(state.learnedSkillNodeIds) *
        getGameEventPrestigePointMultiplier(state.activeEvents),
    ),
  )
  const startingMoney = roundCurrency(
    defaultGameState.money + getPrestigeStartingMoneyBonus(state.prestigeBonuses),
  )
  const prestigeEvent: GameUiEvent = {
    id: nanoid(),
    type: 'prestige_completed',
    awardedPoints,
    prestigeLevel: state.prestigeLevel + 1,
    createdAt: now,
  }

  return withInventoryValuation({
    ...defaultGameState,
    money: startingMoney,
    prestigeLevel: state.prestigeLevel + 1,
    prestigePoints: state.prestigePoints + awardedPoints,
    prestigeBonuses: state.prestigeBonuses,
    skillPoints: state.skillPoints + awardedPoints,
    learnedSkillNodeIds: state.learnedSkillNodeIds,
    achievements: state.achievements,
    collectionBook: state.collectionBook,
    collectionRewards: state.collectionRewards,
    trophyAssignments: state.trophyAssignments,
    settings: state.settings,
    ui: state.ui,
    uiEvents: appendEvents(state, [prestigeEvent]),
    lastError: undefined,
    lastSaved: now,
  }, now)
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

  if (!moduleState.isEnabled || moduleState.level <= 0) {
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
    inputCostMultiplier:
      getSkillTradeUpInputCostMultiplier(state.learnedSkillNodeIds) *
      getGameEventTradeUpInputCostMultiplier(state.activeEvents),
    inventory: state.inventory,
    marketValues: state.marketValues,
    limit: 1,
  })
  const minimumProfit = getTradingBotMinimumProfit(moduleState.level)

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

  const nextState = withInventoryValuation({
    ...state,
    money: roundCurrency(clampNumber(state.money) - deal.price),
    inventory: [deal.item, ...state.inventory],
    collectionBook: updateCollectionBook(state.collectionBook, deal.item),
    recentDrops: [deal.item, ...state.recentDrops].slice(0, RECENT_DROPS_LIMIT),
    lastOpenedItems: [deal.item],
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
    },
    lastError: undefined,
  }, now)

  return withDropChallengeProgress(nextState, [deal.item], now)
}

function tickAutomation(state: GameState, now = Date.now(), prng: Prng = Math.random): GameState {
  let nextState = tickAutoOpener(state, now)

  nextState = tickOpeningDesk(nextState, now)
  nextState = tickCaseFarm(nextState, now)
  nextState = tickTradingBot(nextState, now)
  nextState = tickAuctionHouse(nextState, now, prng)

  return nextState
}

function tradeUpItems(state: GameState, itemIds: string[]): GameState {
  const uniqueItemIds = Array.from(new Set(itemIds))

  if (uniqueItemIds.length !== 10) {
    return failTradeUp(state, 'Select exactly 10 skins for a trade-up contract.')
  }

  const selectedItems = uniqueItemIds
    .map((itemId) => state.inventory.find((item) => item.instanceId === itemId))
    .filter((item): item is SkinInstance => Boolean(item))

  if (selectedItems.length !== 10) {
    return failTradeUp(state, 'One or more selected skins are no longer in your inventory.')
  }

  const analysis = analyzeTradeUp({
    inputCostMultiplier:
      getSkillTradeUpInputCostMultiplier(state.learnedSkillNodeIds) *
      getGameEventTradeUpInputCostMultiplier(state.activeEvents),
    inputItems: selectedItems,
    marketValues: state.marketValues,
  })

  if (!analysis.canTradeUp) {
    return failTradeUp(state, analysis.message ?? 'This trade-up contract is not valid.')
  }

  const outputSkin = pickTradeUpOutcome(analysis.outcomes)

  if (!outputSkin) {
    return failTradeUp(state, 'No valid trade-up result could be generated.')
  }

  const completedAt = Date.now()
  const outputItem = createSkinInstance(outputSkin, state, completedAt, getTradeUpOutputFloat(selectedItems, outputSkin))
  const selectedIdSet = new Set(uniqueItemIds)
  const event: GameUiEvent = {
    id: nanoid(),
    type: 'trade_up_completed',
    inputItems: selectedItems,
    item: outputItem,
    createdAt: completedAt,
  }

  const tradedState = withInventoryValuation({
    ...state,
    inventory: [
      outputItem,
      ...state.inventory.filter((item) => !selectedIdSet.has(item.instanceId)),
    ],
    collectionBook: updateCollectionBook(state.collectionBook, outputItem),
    recentDrops: [outputItem, ...state.recentDrops].slice(0, RECENT_DROPS_LIMIT),
    lastOpenedItems: [outputItem],
    lastError: undefined,
    uiEvents: appendEvents(state, [event]),
    statistics: {
      ...state.statistics,
      tradeUpsCompleted: state.statistics.tradeUpsCompleted + 1,
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

  const salePrice = getAutomationSaleValue(state, item)
  const soldItem = {
    ...item,
    marketValue: salePrice,
  }
  const soldAt = Date.now()
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
    lastError: undefined,
    uiEvents: appendEvents(state, [event]),
    statistics: {
      ...state.statistics,
      moneyEarned: roundCurrency(state.statistics.moneyEarned + salePrice),
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

  const soldItems = saleSummary.saleableItems.map((item) => ({
    ...item,
    marketValue: getAutomationSaleValue(state, item),
  }))
  const soldItemIds = new Set(soldItems.map((item) => item.instanceId))
  const saleValue = roundCurrency(soldItems.reduce((total, item) => total + item.marketValue, 0))
  const soldAt = Date.now()
  const event: GameUiEvent = {
    id: nanoid(),
    type: 'items_sold',
    items: soldItems,
    itemCount: soldItems.length,
    salePrice: saleValue,
    skippedLockedCount: saleSummary.lockedItems.length,
    createdAt: soldAt,
  }
  const lockedMessage =
    saleSummary.lockedItems.length > 0
      ? `${saleSummary.lockedItems.length} locked item${saleSummary.lockedItems.length === 1 ? '' : 's'} skipped.`
      : undefined

  return withDailyChallengeProgress(withInventoryValuation({
    ...state,
    money: roundCurrency(clampNumber(state.money) + saleValue),
    inventory: state.inventory.filter((item) => !soldItemIds.has(item.instanceId)),
    lastError: lockedMessage,
    uiEvents: appendEvents(state, [event]),
    statistics: {
      ...state.statistics,
      moneyEarned: roundCurrency(state.statistics.moneyEarned + saleValue),
      itemsSold: state.statistics.itemsSold + soldItems.length,
    },
  }, soldAt), {
    type: 'sell_value',
    amount: saleValue,
  }, soldAt)
}

function claimAchievementReward(
  state: GameState,
  achievementId: string,
  now = Date.now(),
): GameState {
  const achievement = achievementsById.get(achievementId)
  const progress = state.achievements.find((entry) => entry.id === achievementId)

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

  return {
    ...state,
    money: roundCurrency(clampNumber(state.money) + (reward.money ?? 0)),
    upgradePoints: state.upgradePoints + (reward.upgradePoints ?? 0),
    skillPoints: state.skillPoints + (reward.skillPoints ?? 0),
    achievements: state.achievements.map((entry) => {
      if (entry.id !== achievementId) {
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
      recentDrops: [item, ...nextState.recentDrops].slice(0, RECENT_DROPS_LIMIT),
      lastOpenedItems: [item],
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
    caseDiscountPercent?: number
    durationMs?: number
  },
  now: number,
) {
  const money = reward.money ?? 0
  const rewardedState = {
    ...state,
    money: roundCurrency(clampNumber(state.money) + money),
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
      return completeWorkMiniGame(state, action.gameId, action.now)
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
    case 'PRESTIGE':
      return withProgressionUnlocks(prestigeRun(state, action.now), action.now)
    case 'PURCHASE_PRESTIGE_BONUS':
      return purchasePrestigeBonus(state, action.bonusId)
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
        action.payload.firstCaseHookRoll,
        action.payload.openingEventId,
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

      return withProgressionUnlocks(withInventoryValuation({
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
    case 'RESET_GAME':
      return defaultGameState
    default:
      return state
  }
}

function getTradeUpOutputFloat(inputItems: SkinInstance[], outputSkin: SkinBase) {
  const averageInputFloat = inputItems.reduce((total, item) => total + item.floatValue, 0) / inputItems.length
  const metadata = outputSkin as SkinBase & { minFloat?: number; maxFloat?: number }
  const minFloat = typeof metadata.minFloat === 'number' ? Math.max(0, Math.min(1, metadata.minFloat)) : 0
  const maxFloat = typeof metadata.maxFloat === 'number' ? Math.max(minFloat, Math.min(1, metadata.maxFloat)) : 1

  return Number((minFloat + averageInputFloat * (maxFloat - minFloat)).toFixed(6))
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  return validateGameState(reduceGameState(state, action))
}

