import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gameReducer } from './gameReducer'
import { defaultDropsByRarity, defaultGameState, type GameState, type GameUiEvent } from './gameState'
import { eventManager } from '../events/eventManager'
import {
  AutomationModuleId,
  AutoSellRuleType,
  DailyChallengeType,
  PrestigeBonusId,
  Rarity,
  SkillNodeId,
  TrophySlotId,
  UpgradeId,
  WearCondition,
  type DailyChallenge,
  type SkinInstance,
} from './models'
import {
  createDefaultDailyRewardsState,
  getLocalDayKey,
  getPreviousLocalDayKey,
} from '../rewards/dailyRewards'
import { MAX_CURRENCY_VALUE } from '../utils/safeNumbers'

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...defaultGameState,
    inventory: [],
    collectionBook: [],
    recentDrops: [],
    lastOpenedItems: [],
    uiEvents: [],
    casesUnlocked: ['starter_case', 'fracture_style_case'],
    specialEventCaseIds: [],
    statistics: {
      ...defaultGameState.statistics,
      dropsByRarity: { ...defaultDropsByRarity },
    },
    ...overrides,
  }
}

function makeItem(overrides: Partial<SkinInstance> = {}): SkinInstance {
  return {
    id: 'test_skin',
    weapon: 'AK-47',
    finish: 'Test Pattern',
    rarity: Rarity.Classified,
    baseValue: 100,
    caseIds: ['starter_case'],
    image: '/assets/placeholder.png',
    instanceId: 'item-1',
    wear: WearCondition.FactoryNew,
    floatValue: 0,
    marketValue: 10,
    isLocked: false,
    isFavorited: false,
    discoveredAt: Date.now(),
    ...overrides,
  }
}

function makeTradeUpItems(overrides: Partial<SkinInstance> = {}) {
  return Array.from({ length: 10 }, (_, index) =>
    makeItem({
      id: 'p250_sand_dune',
      weapon: 'P250',
      finish: 'Sand Dune',
      rarity: Rarity.Consumer,
      baseValue: 0.03,
      caseIds: ['starter_case'],
      instanceId: `trade-up-item-${index}`,
      ...overrides,
    }),
  )
}

function makeDailyChallenge(overrides: Partial<DailyChallenge> = {}): DailyChallenge {
  return {
    id: 'daily-challenge-1',
    type: DailyChallengeType.OpenCases,
    title: 'Open cases',
    description: 'Open cases today.',
    target: 1,
    progress: 0,
    reward: { money: 5 },
    isClaimed: false,
    generatedAt: Date.now(),
    ...overrides,
  }
}

function nonAchievementEventTypes(state: GameState) {
  return state.uiEvents
    .filter((event) => event.type !== 'achievement_unlocked' && event.type !== 'collection_reward_unlocked')
    .map((event) => event.type)
}

function findUiEvent<TEventType extends GameUiEvent['type']>(
  state: GameState,
  type: TEventType,
) {
  return state.uiEvents.find((event): event is Extract<GameUiEvent, { type: TEventType }> => (
    event.type === type
  ))
}

describe('gameReducer OPEN_CASE', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-22T12:00:00.000Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('deducts money, adds an item, updates stats, and records collection progress', () => {
    const state = makeState({ money: 10 })
    const nextState = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case' },
    })

    expect(nextState.money).toBe(9.8)
    expect(nextState.inventory).toHaveLength(1)
    expect(nextState.inventory[0]).toMatchObject({
      id: 'p250_sand_dune',
      weapon: 'P250',
      finish: 'Sand Dune',
      rarity: Rarity.Consumer,
      marketValue: 0.03,
      isLocked: false,
      isFavorited: false,
      discoveredAt: Date.now(),
    })
    expect(nextState.inventory[0]?.instanceId).toEqual(expect.any(String))
    expect(nextState.statistics).toMatchObject({
      casesOpened: 1,
      drops: 1,
      moneySpent: 0.2,
    })
    expect(nextState.statistics.dropsByRarity[Rarity.Consumer]).toBe(1)
    expect(nextState.collectionBook).toEqual([
      {
        skinId: 'p250_sand_dune',
        foundWearConditions: ['FactoryNew'],
        bestFloat: 0,
        highestValue: 0.03,
        timesFound: 1,
        firstFoundAt: Date.now(),
      },
    ])
    expect(nextState.recentDrops).toHaveLength(1)
    expect(nextState.lastOpenedItems).toHaveLength(1)
    expect(nonAchievementEventTypes(nextState)).toEqual([
      'case_opening_started',
      'drop_revealed',
    ])
  })

  it('unlocks achievements once when their conditions are met', () => {
    const state = makeState({ money: 10 })
    const firstOpenState = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case' },
    })
    const secondOpenState = gameReducer(firstOpenState, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case' },
    })
    const achievementEvent = findUiEvent(firstOpenState, 'achievement_unlocked')

    expect(firstOpenState.achievements).toContainEqual({
      id: 'first_case_opened',
      isClaimed: false,
      unlockedAt: Date.now(),
    })
    expect(achievementEvent).toMatchObject({
      achievementId: 'first_case_opened',
      name: 'First Crack',
    })
    expect(
      secondOpenState.achievements.filter((achievement) => achievement.id === 'first_case_opened'),
    ).toHaveLength(1)
    expect(
      secondOpenState.uiEvents.filter((event) => (
        event.type === 'achievement_unlocked' && event.achievementId === 'first_case_opened'
      )),
    ).toHaveLength(1)
  })

  it('unlocks collection rewards once when a collection set is completed', () => {
    const state = makeState({ money: 10 })
    const firstOpenState = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case' },
    })
    const secondOpenState = gameReducer(firstOpenState, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case' },
    })
    const rewardEvent = findUiEvent(firstOpenState, 'collection_reward_unlocked')

    expect(firstOpenState.collectionRewards).toContainEqual(
      expect.objectContaining({
        id: 'weapon:p250',
        type: 'WeaponSellBonus',
        targetId: 'P250',
      }),
    )
    expect(rewardEvent).toMatchObject({
      title: 'P250 Specialist',
      effectLabel: '+1% sell value',
    })
    expect(
      secondOpenState.collectionRewards.filter((reward) => reward.id === 'weapon:p250'),
    ).toHaveLength(1)
  })

  it('claims achievement rewards once and blocks repeat claims', () => {
    const state = makeState({
      money: 10,
      upgradePoints: 0,
      achievements: [
        {
          id: 'first_case_opened',
          isClaimed: false,
          unlockedAt: Date.now(),
        },
        {
          id: 'cases_opened_100',
          isClaimed: false,
          unlockedAt: Date.now(),
        },
      ],
    })
    const moneyClaimedState = gameReducer(state, {
      type: 'CLAIM_ACHIEVEMENT_REWARD',
      achievementId: 'first_case_opened',
      now: Date.now(),
    })
    const pointsClaimedState = gameReducer(moneyClaimedState, {
      type: 'CLAIM_ACHIEVEMENT_REWARD',
      achievementId: 'cases_opened_100',
      now: Date.now(),
    })
    const repeatClaimState = gameReducer(pointsClaimedState, {
      type: 'CLAIM_ACHIEVEMENT_REWARD',
      achievementId: 'first_case_opened',
      now: Date.now(),
    })

    expect(moneyClaimedState.money).toBe(20)
    expect(pointsClaimedState.upgradePoints).toBe(1)
    expect(pointsClaimedState.skillPoints).toBe(1)
    expect(repeatClaimState.money).toBe(20)
    expect(repeatClaimState.upgradePoints).toBe(1)
    expect(repeatClaimState.skillPoints).toBe(1)
    expect(repeatClaimState.lastError).toBe('Achievement reward already claimed.')
    expect(
      repeatClaimState.achievements.find((achievement) => achievement.id === 'first_case_opened'),
    ).toMatchObject({ isClaimed: true })
  })

  it('caps multi-open quantities to the number of cases the player can afford', () => {
    const state = makeState({ money: 0.5 })
    const nextState = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case', quantity: 5 },
    })

    expect(nextState.money).toBe(0.1)
    expect(nextState.inventory).toHaveLength(2)
    expect(nextState.statistics.casesOpened).toBe(2)
    expect(nextState.statistics.moneySpent).toBe(0.4)
    expect(nextState.lastError).toBe('Opened 2 of 5 requested cases.')
  })

  it('deducts the full multi-open cost and yields the requested number of drops', () => {
    const state = makeState({ money: 10 })
    const nextState = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case', quantity: 10 },
    })

    expect(nextState.money).toBe(8)
    expect(nextState.inventory).toHaveLength(10)
    expect(nextState.lastOpenedItems).toHaveLength(10)
    expect(nextState.statistics.casesOpened).toBe(10)
    expect(nextState.statistics.drops).toBe(10)
    expect(nextState.statistics.moneySpent).toBe(2)
    expect(nextState.statistics.dropsByRarity[Rarity.Consumer]).toBe(10)
  })

  it('prevents opening when no cases can be afforded', () => {
    const state = makeState({ money: 0 })
    const nextState = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case' },
    })

    expect(nextState.money).toBe(0)
    expect(nextState.inventory).toHaveLength(0)
    expect(nextState.statistics.casesOpened).toBe(0)
    expect(nextState.lastError).toBe('Not enough money to open this case.')
    expect(nextState.uiEvents[0]?.type).toBe('case_opening_failed')
  })

  it('keeps collection entries immutable while updating repeat drops', () => {
    const state = makeState({ money: 10 })
    const firstOpen = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case' },
    })
    const secondOpen = gameReducer(firstOpen, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case' },
    })

    expect(firstOpen.collectionBook[0]?.timesFound).toBe(1)
    expect(secondOpen.collectionBook[0]?.timesFound).toBe(2)
    expect(secondOpen.collectionBook[0]?.bestFloat).toBe(0)
    expect(secondOpen.collectionBook[0]?.highestValue).toBe(0.03)
  })

  it('adds newly found wear conditions when repeat drops expand a collection entry', () => {
    vi.mocked(Math.random)
      .mockReset()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.5)
    const state = makeState({ money: 10 })
    const firstOpen = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case' },
    })
    const secondOpen = gameReducer(firstOpen, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case' },
    })

    expect(secondOpen.collectionBook[0]?.skinId).toBe('p250_sand_dune')
    expect(secondOpen.collectionBook[0]?.foundWearConditions).toEqual([
      WearCondition.FactoryNew,
      WearCondition.MinimalWear,
    ])
    expect(secondOpen.collectionBook[0]?.timesFound).toBe(2)
  })

  it('auto-sells matching drops during case opening', () => {
    const state = makeState({
      money: 10,
      autoSellRules: [
        {
          enabled: true,
          id: 'low-value',
          type: AutoSellRuleType.MinValue,
          valueThreshold: 1,
        },
      ],
    })
    const nextState = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case' },
    })

    expect(nextState.money).toBe(9.83)
    expect(nextState.inventory).toHaveLength(0)
    expect(nextState.recentDrops).toHaveLength(1)
    expect(nextState.collectionBook[0]?.skinId).toBe('p250_sand_dune')
    expect(nextState.statistics.moneyEarned).toBe(0.03)
    expect(nextState.statistics.itemsSold).toBe(1)
    expect(nonAchievementEventTypes(nextState)).toEqual([
      'case_opening_started',
      'drop_revealed',
      'items_auto_sold',
    ])
  })

  it('accumulates auto-sold items during multi-open batches', () => {
    const state = makeState({
      money: 10,
      autoSellRules: [
        {
          enabled: true,
          id: 'low-value',
          type: AutoSellRuleType.MinValue,
          valueThreshold: 1,
        },
      ],
    })
    const nextState = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case', quantity: 10 },
    })
    const autoSoldEvent = nextState.uiEvents.find((event) => event.type === 'items_auto_sold')

    expect(nextState.money).toBe(8.3)
    expect(nextState.inventory).toHaveLength(0)
    expect(nextState.lastOpenedItems).toHaveLength(10)
    expect(nextState.statistics.moneySpent).toBe(2)
    expect(nextState.statistics.moneyEarned).toBe(0.3)
    expect(nextState.statistics.itemsSold).toBe(10)
    expect(autoSoldEvent).toMatchObject({
      itemCount: 10,
      salePrice: 0.3,
    })
  })

  it('does not auto-sell when matching rules are disabled', () => {
    const state = makeState({
      money: 10,
      autoSellRules: [
        {
          enabled: false,
          id: 'low-value',
          type: AutoSellRuleType.MinValue,
          valueThreshold: 1,
        },
      ],
    })
    const nextState = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case' },
    })

    expect(nextState.money).toBe(9.8)
    expect(nextState.inventory).toHaveLength(1)
    expect(nextState.statistics.itemsSold).toBe(0)
    expect(nonAchievementEventTypes(nextState)).toEqual([
      'case_opening_started',
      'drop_revealed',
    ])
  })

  it('allows retired cases if the player already owns access', () => {
    const state = makeState({
      money: 100,
      casesUnlocked: ['starter_case', 'ultra_legacy_case'],
    })
    const nextState = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'ultra_legacy_case' },
    })

    expect(nextState.money).toBe(50)
    expect(nextState.inventory).toHaveLength(1)
    expect(nextState.lastError).toBeUndefined()
  })

  it('blocks retired cases without prior access or special event access', () => {
    const state = makeState({ money: 100 })
    const nextState = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'ultra_legacy_case' },
    })

    expect(nextState.money).toBe(100)
    expect(nextState.inventory).toHaveLength(0)
    expect(nextState.lastError).toBe('Case is locked or unavailable.')
  })

  it('toggles inventory lock and favorite flags immutably', () => {
    const openedState = gameReducer(makeState({ money: 10 }), {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case' },
    })
    const itemId = openedState.inventory[0]?.instanceId ?? ''
    const lockedState = gameReducer(openedState, { type: 'TOGGLE_ITEM_LOCK', itemId })
    const favoritedState = gameReducer(lockedState, { type: 'TOGGLE_ITEM_FAVORITE', itemId })

    expect(openedState.inventory[0]?.isLocked).toBe(false)
    expect(lockedState.inventory[0]?.isLocked).toBe(true)
    expect(favoritedState.inventory[0]?.isFavorited).toBe(true)
  })

  it('assigns and removes trophy room items by slot', () => {
    const item = makeItem()
    const state = makeState({ inventory: [item] })
    const assignedState = gameReducer(state, {
      type: 'ASSIGN_TROPHY_ITEM',
      slotId: TrophySlotId.MostExpensiveSkin,
      itemId: item.instanceId,
      now: Date.now(),
    })
    const removedState = gameReducer(assignedState, {
      type: 'REMOVE_TROPHY_ITEM',
      slotId: TrophySlotId.MostExpensiveSkin,
    })

    expect(assignedState.trophyAssignments[TrophySlotId.MostExpensiveSkin]).toEqual({
      slotId: TrophySlotId.MostExpensiveSkin,
      item,
      assignedAt: Date.now(),
    })
    expect(state.trophyAssignments[TrophySlotId.MostExpensiveSkin]).toBeUndefined()
    expect(removedState.trophyAssignments[TrophySlotId.MostExpensiveSkin]).toBeUndefined()
  })

  it('keeps trophy snapshots when displayed items leave the inventory', () => {
    const item = makeItem()
    const state = makeState({
      money: 50,
      inventory: [item],
      trophyAssignments: {
        [TrophySlotId.MostExpensiveSkin]: {
          slotId: TrophySlotId.MostExpensiveSkin,
          item,
          assignedAt: Date.now(),
        },
      },
      marketValues: {
        ...defaultGameState.marketValues,
        [item.id]: 200,
      },
    })
    const soldState = gameReducer(state, { type: 'SELL_ITEM', itemId: item.instanceId })

    expect(soldState.inventory).toEqual([])
    expect(soldState.trophyAssignments[TrophySlotId.MostExpensiveSkin]?.item).toEqual(item)
  })

  it('adds, updates, and removes auto-sell rules', () => {
    const rule = {
      enabled: true,
      id: 'rule-1',
      type: AutoSellRuleType.MinValue,
      valueThreshold: 1,
    }
    const addedState = gameReducer(makeState(), {
      type: 'ADD_AUTO_SELL_RULE',
      rule,
    })
    const updatedState = gameReducer(addedState, {
      type: 'UPDATE_AUTO_SELL_RULE',
      ruleId: rule.id,
      rule: { enabled: false, valueThreshold: 2 },
    })
    const removedState = gameReducer(updatedState, {
      type: 'REMOVE_AUTO_SELL_RULE',
      ruleId: rule.id,
    })

    expect(addedState.autoSellRules).toEqual([rule])
    expect(updatedState.autoSellRules[0]).toMatchObject({
      enabled: false,
      id: rule.id,
      valueThreshold: 2,
    })
    expect(removedState.autoSellRules).toEqual([])
  })

  it('reorders auto-sell rules by id order', () => {
    const firstRule = {
      enabled: true,
      id: 'rule-1',
      type: AutoSellRuleType.MinValue,
      valueThreshold: 1,
    }
    const secondRule = {
      enabled: true,
      id: 'rule-2',
      type: AutoSellRuleType.KeepFactoryNew,
    }
    const state = makeState({
      autoSellRules: [firstRule, secondRule],
    })
    const nextState = gameReducer(state, {
      type: 'REORDER_AUTO_SELL_RULES',
      ruleIds: [secondRule.id, firstRule.id],
    })

    expect(nextState.autoSellRules.map((rule) => rule.id)).toEqual(['rule-2', 'rule-1'])
  })

  it('sells an unlocked item using the latest market value', () => {
    const item = makeItem()
    const state = makeState({
      money: 50,
      inventory: [item],
      collectionBook: [
        {
          skinId: item.id,
          foundWearConditions: [item.wear],
          bestFloat: item.floatValue,
          highestValue: item.marketValue,
          timesFound: 2,
          firstFoundAt: item.discoveredAt,
        },
      ],
      marketValues: {
        ...defaultGameState.marketValues,
        [item.id]: 200,
      },
    })
    const nextState = gameReducer(state, { type: 'SELL_ITEM', itemId: item.instanceId })

    expect(nextState.money).toBe(260)
    expect(nextState.inventory).toHaveLength(0)
    expect(nextState.statistics.moneyEarned).toBe(210)
    expect(nextState.statistics.itemsSold).toBe(1)
    expect(nextState.collectionBook[0]?.timesFound).toBe(2)
    expect(findUiEvent(nextState, 'item_sold')).toMatchObject({
      type: 'item_sold',
      salePrice: 210,
    })
  })

  it('applies collection sell value bonuses when selling', () => {
    const item = makeItem()
    const state = makeState({
      money: 50,
      inventory: [item],
      collectionRewards: [
        {
          id: 'weapon:ak_47',
          type: 'WeaponSellBonus',
          targetId: 'AK-47',
          bonus: 0.01,
          unlockedAt: Date.now(),
        },
      ],
      marketValues: {
        ...defaultGameState.marketValues,
        [item.id]: 200,
      },
    })
    const nextState = gameReducer(state, { type: 'SELL_ITEM', itemId: item.instanceId })

    expect(nextState.money).toBe(262.1)
    expect(nextState.statistics.moneyEarned).toBe(212.1)
  })

  it('applies collection case discounts when opening cases', () => {
    const state = makeState({
      money: 10,
      collectionRewards: [
        {
          id: 'case:starter_case',
          type: 'CaseDiscount',
          targetId: 'starter_case',
          bonus: 0.05,
          unlockedAt: Date.now(),
        },
      ],
    })
    const nextState = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case' },
    })

    expect(nextState.money).toBe(9.81)
    expect(nextState.statistics.moneySpent).toBe(0.19)
  })

  it('applies active event case discounts when opening cases', () => {
    const now = Date.now()
    const winterCases = eventManager.createEvent({
      now,
      prng: () => 0.1,
      type: 'WinterCases',
    })
    const state = makeState({
      activeEvents: [winterCases],
      money: 10,
    })
    const nextState = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case' },
    })

    expect(nextState.money).toBe(9.82)
    expect(nextState.statistics.moneySpent).toBe(0.18)
  })

  it('manually triggers gameplay events and emits a start notification', () => {
    const now = Date.now()
    const nextState = gameReducer(makeState(), {
      type: 'TRIGGER_GAME_EVENT',
      eventType: 'RetiredCaseWeek',
      now,
    })

    expect(nextState.activeEvents[0]).toMatchObject({
      type: 'RetiredCaseWeek',
      startTime: now,
    })
    expect(nextState.specialEventCaseIds).toContain('ultra_legacy_case')
    expect(findUiEvent(nextState, 'game_event_started')).toMatchObject({
      name: 'Retired Case Week',
    })
  })

  it('ends gameplay events on schedule and records history', () => {
    const now = Date.now()
    const event = eventManager.createEvent({
      durationMs: 1_000,
      now,
      prng: () => 0.1,
      type: 'KnifeWeekend',
    })
    const state = makeState({ activeEvents: [event] })
    const nextState = gameReducer(state, {
      type: 'TICK_EVENTS',
      now: now + 1_000,
    })

    expect(nextState.activeEvents).toEqual([])
    expect(nextState.eventHistory[0]).toMatchObject({
      id: event.id,
      type: 'KnifeWeekend',
    })
    expect(findUiEvent(nextState, 'game_event_ended')).toMatchObject({
      name: 'Knife Weekend',
    })
  })

  it('blocks locked item sales until the item is unlocked', () => {
    const item = makeItem({ isLocked: true })
    const state = makeState({
      money: 50,
      inventory: [item],
      marketValues: {
        ...defaultGameState.marketValues,
        [item.id]: 200,
      },
    })
    const blockedState = gameReducer(state, { type: 'SELL_ITEM', itemId: item.instanceId })

    expect(blockedState.money).toBe(50)
    expect(blockedState.inventory).toHaveLength(1)
    expect(blockedState.statistics.moneyEarned).toBe(0)
    expect(blockedState.statistics.itemsSold).toBe(0)
    expect(blockedState.lastError).toBe('Locked items cannot be sold unless unlocked.')
    expect(blockedState.uiEvents[0]?.type).toBe('item_sale_failed')

    const unlockedState = gameReducer(blockedState, {
      type: 'TOGGLE_ITEM_LOCK',
      itemId: item.instanceId,
    })
    const soldState = gameReducer(unlockedState, { type: 'SELL_ITEM', itemId: item.instanceId })

    expect(soldState.money).toBe(260)
    expect(soldState.inventory).toHaveLength(0)
    expect(soldState.statistics.itemsSold).toBe(1)
  })

  it('keeps collection history when an item is sold', () => {
    const item = makeItem()
    const collectionEntry = {
      skinId: item.id,
      foundWearConditions: [item.wear],
      bestFloat: item.floatValue,
      highestValue: item.marketValue,
      timesFound: 1,
      firstFoundAt: item.discoveredAt,
    }
    const state = makeState({
      money: 50,
      inventory: [item],
      collectionBook: [collectionEntry],
      marketValues: {
        ...defaultGameState.marketValues,
        [item.id]: 200,
      },
    })
    const nextState = gameReducer(state, { type: 'SELL_ITEM', itemId: item.instanceId })

    expect(nextState.inventory).toHaveLength(0)
    expect(nextState.collectionBook).toEqual([collectionEntry])
  })

  it('bulk sells only unlocked selected items and skips locked items', () => {
    const item = makeItem({ instanceId: 'item-1', id: 'test_skin' })
    const lockedItem = makeItem({
      id: 'locked_skin',
      instanceId: 'item-2',
      isLocked: true,
    })
    const cheapItem = makeItem({
      id: 'cheap_skin',
      instanceId: 'item-3',
    })
    const collectionEntry = {
      skinId: item.id,
      foundWearConditions: [item.wear],
      bestFloat: item.floatValue,
      highestValue: item.marketValue,
      timesFound: 2,
      firstFoundAt: item.discoveredAt,
    }
    const state = makeState({
      money: 50,
      inventory: [item, lockedItem, cheapItem],
      collectionBook: [collectionEntry],
      marketValues: {
        ...defaultGameState.marketValues,
        [item.id]: 200,
        [lockedItem.id]: 300,
        [cheapItem.id]: 10,
      },
    })
    const nextState = gameReducer(state, {
      type: 'SELL_ITEMS',
      itemIds: [item.instanceId, lockedItem.instanceId, cheapItem.instanceId],
    })

    expect(nextState.money).toBe(270.5)
    expect(nextState.inventory.map((inventoryItem) => inventoryItem.instanceId)).toEqual([
      lockedItem.instanceId,
    ])
    expect(nextState.statistics.moneyEarned).toBe(220.5)
    expect(nextState.statistics.itemsSold).toBe(2)
    expect(nextState.collectionBook).toEqual([collectionEntry])
    expect(nextState.lastError).toBe('1 locked item skipped.')
    expect(findUiEvent(nextState, 'items_sold')).toMatchObject({
      type: 'items_sold',
      itemCount: 2,
      salePrice: 220.5,
      skippedLockedCount: 1,
    })
  })

  it('does not bulk sell when every selected item is locked', () => {
    const lockedItem = makeItem({ isLocked: true })
    const state = makeState({
      money: 50,
      inventory: [lockedItem],
      marketValues: {
        ...defaultGameState.marketValues,
        [lockedItem.id]: 200,
      },
    })
    const nextState = gameReducer(state, {
      type: 'SELL_ITEMS',
      itemIds: [lockedItem.instanceId],
    })

    expect(nextState.money).toBe(50)
    expect(nextState.inventory).toEqual([lockedItem])
    expect(nextState.statistics.itemsSold).toBe(0)
    expect(nextState.lastError).toBe('Selected items are locked and cannot be sold.')
    expect(nextState.uiEvents[0]?.type).toBe('item_sale_failed')
  })

  it('stores inventory value and history when an item is added', () => {
    const item = makeItem()
    const state = makeState({
      marketValues: {
        ...defaultGameState.marketValues,
        [item.id]: 200,
      },
    })
    const nextState = gameReducer(state, { type: 'ADD_ITEM', item })

    expect(nextState.inventoryValue).toBe(210)
    expect(nextState.inventoryValueHistory).toEqual([
      {
        timestamp: item.discoveredAt,
        value: 210,
      },
    ])
  })

  it('updates inventory value immediately when an item is sold', () => {
    const item = makeItem()
    const state = makeState({
      money: 50,
      inventory: [item],
      inventoryValue: 210,
      inventoryValueHistory: [
        {
          timestamp: Date.now() - 1_000,
          value: 210,
        },
      ],
      marketValues: {
        ...defaultGameState.marketValues,
        [item.id]: 200,
      },
    })
    const nextState = gameReducer(state, { type: 'SELL_ITEM', itemId: item.instanceId })

    expect(nextState.inventoryValue).toBe(0)
    expect(nextState.inventoryValueHistory[nextState.inventoryValueHistory.length - 1]).toEqual({
      timestamp: Date.now(),
      value: 0,
    })
  })

  it('updates inventory value when market prices change', () => {
    const item = makeItem()
    const state = makeState({
      inventory: [item],
      inventoryValue: 105,
      inventoryValueHistory: [
        {
          timestamp: Date.now() - 1_000,
          value: 105,
        },
      ],
      marketValues: {
        ...defaultGameState.marketValues,
        [item.id]: 100,
      },
    })
    const nextState = gameReducer(state, {
      type: 'UPDATE_MARKET_VALUE',
      skinId: item.id,
      value: 200,
    })

    expect(nextState.inventoryValue).toBe(210)
    expect(nextState.inventoryValueHistory[nextState.inventoryValueHistory.length - 1]).toEqual({
      timestamp: Date.now(),
      value: 210,
    })
  })

  it('trades 10 same-rarity unlocked skins into the next rarity', () => {
    const inputItems = makeTradeUpItems()
    const state = makeState({
      inventory: inputItems,
      collectionBook: [],
    })
    const nextState = gameReducer(state, {
      type: 'TRADE_UP',
      itemIds: inputItems.map((item) => item.instanceId),
    })
    const resultItem = nextState.inventory[0]

    expect(nextState.inventory).toHaveLength(1)
    expect(resultItem?.rarity).toBe(Rarity.Industrial)
    expect(resultItem?.caseIds).toContain('starter_case')
    expect(nextState.collectionBook[0]).toMatchObject({
      skinId: resultItem?.id,
      timesFound: 1,
    })
    expect(nextState.statistics.tradeUpsCompleted).toBe(1)
    expect(findUiEvent(nextState, 'trade_up_completed')).toMatchObject({
      type: 'trade_up_completed',
      item: resultItem,
    })
    expect(nextState.inventoryValue).toBeGreaterThan(0)
  })

  it('requires exactly 10 selected skins for a trade-up', () => {
    const inputItems = makeTradeUpItems().slice(0, 9)
    const state = makeState({
      inventory: inputItems,
    })
    const nextState = gameReducer(state, {
      type: 'TRADE_UP',
      itemIds: inputItems.map((item) => item.instanceId),
    })

    expect(nextState.inventory).toEqual(inputItems)
    expect(nextState.statistics.tradeUpsCompleted).toBe(0)
    expect(nextState.lastError).toBe('Select exactly 10 skins for a trade-up contract.')
  })

  it('prevents locked or favorited skins from being consumed in trade-ups', () => {
    const inputItems = makeTradeUpItems()
    const lockedItem = {
      ...inputItems[0],
      isLocked: true,
    }
    const favoritedItem = {
      ...inputItems[1],
      isFavorited: true,
    }
    const state = makeState({
      inventory: [lockedItem, favoritedItem, ...inputItems.slice(2)],
    })
    const nextState = gameReducer(state, {
      type: 'TRADE_UP',
      itemIds: state.inventory.map((item) => item.instanceId),
    })

    expect(nextState.inventory).toEqual(state.inventory)
    expect(nextState.statistics.tradeUpsCompleted).toBe(0)
    expect(nextState.lastError).toBe('Locked or favorited skins cannot be used in trade-ups.')
  })

  it('purchases Auto Opener and deducts the upgrade cost', () => {
    const state = makeState({ money: 500 })
    const nextState = gameReducer(state, {
      type: 'PURCHASE_AUTO_OPENER',
      caseId: 'starter_case',
      now: Date.now(),
    })

    expect(nextState.money).toBe(150)
    expect(nextState.automation.autoOpener).toMatchObject({
      caseId: 'starter_case',
      isEnabled: true,
      level: 1,
      lastOpenTime: Date.now(),
    })
    expect(nextState.statistics.moneySpent).toBe(350)
  })

  it('opens one selected case when Auto Opener reaches its interval', () => {
    const now = Date.now()
    const state = makeState({
      money: 10,
      automation: {
        ...defaultGameState.automation,
        autoOpener: {
          caseId: 'starter_case',
          intervalMs: 30_000,
          isEnabled: true,
          lastOpenTime: now - 30_000,
          level: 1,
          totalOpened: 0,
        },
      },
    })
    const nextState = gameReducer(state, { type: 'TICK_AUTOMATION', now })

    expect(nextState.money).toBe(9.8)
    expect(nextState.inventory).toHaveLength(1)
    expect(nextState.recentDrops).toHaveLength(1)
    expect(nextState.statistics.casesOpened).toBe(1)
    expect(nextState.automation.autoOpener).toMatchObject({
      isEnabled: true,
      lastOpenTime: now,
      totalOpened: 1,
    })
  })

  it('does not auto open early and pauses when the player lacks funds', () => {
    const now = Date.now()
    const activeAutomation = {
      autoOpener: {
        caseId: 'starter_case',
        intervalMs: 30_000,
        isEnabled: true,
        lastOpenTime: now - 10_000,
        level: 1,
        totalOpened: 0,
      },
    }
    const earlyState = makeState({
      money: 10,
      automation: {
        ...defaultGameState.automation,
        ...activeAutomation,
      },
    })
    const unchangedState = gameReducer(earlyState, { type: 'TICK_AUTOMATION', now })

    expect(unchangedState).toBe(earlyState)

    const brokeState = makeState({
      money: 0,
      automation: {
        ...defaultGameState.automation,
        autoOpener: {
          ...activeAutomation.autoOpener,
          lastOpenTime: now - 30_000,
        },
      },
    })
    const pausedState = gameReducer(brokeState, { type: 'TICK_AUTOMATION', now })

    expect(pausedState.statistics.casesOpened).toBe(0)
    expect(pausedState.automation.autoOpener.isEnabled).toBe(false)
    expect(pausedState.lastError).toBe('Auto Opener paused: not enough money.')
  })

  it('purchases and toggles automation modules', () => {
    const now = Date.now()
    const state = makeState({ money: 5_000 })
    const purchasedState = gameReducer(state, {
      type: 'PURCHASE_AUTOMATION_MODULE',
      moduleId: AutomationModuleId.CaseFarm,
      now,
    })
    const toggledState = gameReducer(purchasedState, {
      type: 'TOGGLE_AUTOMATION_MODULE',
      moduleId: AutomationModuleId.CaseFarm,
      now: now + 1_000,
    })

    expect(purchasedState.money).toBe(3_500)
    expect(purchasedState.statistics.moneySpent).toBe(1_500)
    expect(purchasedState.automation.modules[AutomationModuleId.CaseFarm]).toMatchObject({
      isEnabled: true,
      lastRunTime: now,
      level: 1,
    })
    expect(toggledState.automation.modules[AutomationModuleId.CaseFarm].isEnabled).toBe(false)
  })

  it('purchases upgrades, deducts money, and increases the level', () => {
    const state = makeState({ money: 2_000 })
    const nextState = gameReducer(state, {
      type: 'PURCHASE_UPGRADE',
      upgradeId: UpgradeId.CaseContract,
      now: Date.now(),
    })

    expect(nextState.money).toBe(750)
    expect(nextState.upgrades[UpgradeId.CaseContract]).toBe(1)
    expect(nextState.statistics.moneySpent).toBe(1_250)
    expect(nextState.lastError).toBeUndefined()
  })

  it('does not purchase upgrades past max level', () => {
    const state = makeState({
      money: 100_000,
      upgrades: {
        ...defaultGameState.upgrades,
        [UpgradeId.CaseContract]: 5,
      },
    })
    const nextState = gameReducer(state, {
      type: 'PURCHASE_UPGRADE',
      upgradeId: UpgradeId.CaseContract,
      now: Date.now(),
    })

    expect(nextState.money).toBe(100_000)
    expect(nextState.upgrades[UpgradeId.CaseContract]).toBe(5)
    expect(nextState.lastError).toBe('Upgrade is already maxed.')
  })

  it('enforces upgrade prerequisites and point costs', () => {
    const lockedState = gameReducer(makeState({
      money: 100_000,
      upgradePoints: 10,
    }), {
      type: 'PURCHASE_UPGRADE',
      upgradeId: UpgradeId.RarityLuck,
      now: Date.now(),
    })
    const brokeState = gameReducer(makeState({
      money: 100_000,
      prestigeLevel: 1,
      upgradePoints: 0,
    }), {
      type: 'PURCHASE_UPGRADE',
      upgradeId: UpgradeId.RarityLuck,
      now: Date.now(),
    })
    const purchasedState = gameReducer(makeState({
      money: 100_000,
      prestigeLevel: 1,
      upgradePoints: 2,
    }), {
      type: 'PURCHASE_UPGRADE',
      upgradeId: UpgradeId.RarityLuck,
      now: Date.now(),
    })

    expect(lockedState.upgrades[UpgradeId.RarityLuck]).toBe(0)
    expect(lockedState.lastError).toBe('Upgrade requirements are not met.')
    expect(brokeState.upgrades[UpgradeId.RarityLuck]).toBe(0)
    expect(brokeState.lastError).toBe('Not enough resources to purchase upgrade.')
    expect(purchasedState.upgrades[UpgradeId.RarityLuck]).toBe(1)
    expect(purchasedState.upgradePoints).toBe(1)
  })

  it('prestiges an eligible run and resets run progress while preserving permanent progress', () => {
    const item = makeItem()
    const state = makeState({
      money: 123,
      inventory: [item],
      inventoryValue: 1_000_000,
      casesUnlocked: ['starter_case', 'fracture_style_case', 'revolution_style_case'],
      upgrades: {
        ...defaultGameState.upgrades,
        [UpgradeId.CaseContract]: 2,
      },
      automation: {
        ...defaultGameState.automation,
        autoOpener: {
          ...defaultGameState.automation.autoOpener,
          isEnabled: true,
          level: 2,
        },
      },
      skillPoints: 1,
      learnedSkillNodeIds: [SkillNodeId.SellSpecialist],
      collectionBook: [
        {
          skinId: item.id,
          foundWearConditions: [item.wear],
          bestFloat: item.floatValue,
          highestValue: item.marketValue,
          timesFound: 1,
          firstFoundAt: item.discoveredAt,
        },
      ],
      statistics: {
        ...defaultGameState.statistics,
        casesOpened: 25_000,
        moneyEarned: 500_000,
        moneySpent: 250_000,
        dropsByRarity: { ...defaultDropsByRarity },
      },
    })
    const nextState = gameReducer(state, { type: 'PRESTIGE', now: Date.now() })

    expect(nextState.money).toBe(defaultGameState.money)
    expect(nextState.inventory).toEqual([])
    expect(nextState.casesUnlocked).toEqual(defaultGameState.casesUnlocked)
    expect(nextState.upgrades).toEqual(defaultGameState.upgrades)
    expect(nextState.automation).toEqual(defaultGameState.automation)
    expect(nextState.collectionBook).toHaveLength(1)
    expect(nextState.prestigeLevel).toBe(1)
    expect(nextState.prestigePoints).toBe(7)
    expect(nextState.skillPoints).toBe(8)
    expect(nextState.learnedSkillNodeIds).toEqual([SkillNodeId.SellSpecialist])
    expect(nextState.achievements).toContainEqual({
      id: 'first_prestige',
      isClaimed: false,
      unlockedAt: Date.now(),
    })
  })

  it('blocks prestige before thresholds are reached', () => {
    const state = makeState({
      inventoryValue: 1_000,
      statistics: {
        ...defaultGameState.statistics,
        moneyEarned: 1_000,
        dropsByRarity: { ...defaultDropsByRarity },
      },
    })
    const nextState = gameReducer(state, { type: 'PRESTIGE', now: Date.now() })

    expect(nextState.prestigeLevel).toBe(0)
    expect(nextState.lastError).toBe('Open enough cases, spend enough money, and reach either the inventory value or sell earnings threshold.')
  })

  it('purchases prestige bonuses and blocks maxed bonuses', () => {
    const purchasedState = gameReducer(makeState({ prestigePoints: 3 }), {
      type: 'PURCHASE_PRESTIGE_BONUS',
      bonusId: PrestigeBonusId.SellValue,
      now: Date.now(),
    })
    const maxedState = gameReducer(makeState({
      prestigePoints: 999,
      prestigeBonuses: {
        ...defaultGameState.prestigeBonuses,
        [PrestigeBonusId.SellValue]: 15,
      },
    }), {
      type: 'PURCHASE_PRESTIGE_BONUS',
      bonusId: PrestigeBonusId.SellValue,
      now: Date.now(),
    })

    expect(purchasedState.prestigePoints).toBe(1)
    expect(purchasedState.prestigeBonuses[PrestigeBonusId.SellValue]).toBe(1)
    expect(maxedState.prestigeBonuses[PrestigeBonusId.SellValue]).toBe(15)
    expect(maxedState.lastError).toBe('Prestige bonus is already maxed.')
  })

  it('Opening Desk opens a batch on its slower interval', () => {
    const now = Date.now()
    const state = makeState({
      money: 10,
      automation: {
        ...defaultGameState.automation,
        autoOpener: {
          ...defaultGameState.automation.autoOpener,
          caseId: 'starter_case',
        },
        modules: {
          ...defaultGameState.automation.modules,
          [AutomationModuleId.OpeningDesk]: {
            ...defaultGameState.automation.modules[AutomationModuleId.OpeningDesk],
            isEnabled: true,
            lastRunTime: now - 90_000,
            level: 1,
          },
        },
      },
    })
    const nextState = gameReducer(state, { type: 'TICK_AUTOMATION', now })

    expect(nextState.money).toBe(9.6)
    expect(nextState.inventory).toHaveLength(2)
    expect(nextState.statistics.casesOpened).toBe(2)
    expect(nextState.automation.modules[AutomationModuleId.OpeningDesk]).toMatchObject({
      isEnabled: true,
      lastRunTime: now,
      totalGenerated: 2,
      totalRuns: 1,
    })
  })

  it('Case Farm generates passive money when enabled', () => {
    const now = Date.now()
    const state = makeState({
      money: 10,
      casesUnlocked: ['starter_case', 'fracture_style_case', 'revolution_style_case'],
      automation: {
        ...defaultGameState.automation,
        modules: {
          ...defaultGameState.automation.modules,
          [AutomationModuleId.CaseFarm]: {
            ...defaultGameState.automation.modules[AutomationModuleId.CaseFarm],
            isEnabled: true,
            lastRunTime: now - 10_000,
            level: 2,
          },
        },
      },
    })
    const nextState = gameReducer(state, { type: 'TICK_AUTOMATION', now })

    expect(nextState.money).toBe(12.8)
    expect(nextState.automation.modules[AutomationModuleId.CaseFarm]).toMatchObject({
      lastRunTime: now,
      totalGenerated: 2.8,
      totalRuns: 1,
    })
  })

  it('Market Analyst sell bonus applies only while the module is enabled', () => {
    const item = makeItem()
    const state = makeState({
      money: 50,
      inventory: [item],
      marketValues: {
        ...defaultGameState.marketValues,
        [item.id]: 100,
      },
      automation: {
        ...defaultGameState.automation,
        modules: {
          ...defaultGameState.automation.modules,
          [AutomationModuleId.MarketAnalyst]: {
            ...defaultGameState.automation.modules[AutomationModuleId.MarketAnalyst],
            isEnabled: true,
            level: 3,
          },
        },
      },
    })
    const soldState = gameReducer(state, { type: 'SELL_ITEM', itemId: item.instanceId })

    expect(soldState.money).toBe(158.15)
    expect(soldState.statistics.moneyEarned).toBe(108.15)
  })

  it('applies upgrade sell value bonuses when selling', () => {
    const item = makeItem()
    const state = makeState({
      money: 50,
      inventory: [item],
      marketValues: {
        ...defaultGameState.marketValues,
        [item.id]: 200,
      },
      upgrades: {
        ...defaultGameState.upgrades,
        [UpgradeId.MarketSignal]: 2,
      },
    })
    const soldState = gameReducer(state, { type: 'SELL_ITEM', itemId: item.instanceId })

    expect(soldState.money).toBe(266.3)
    expect(soldState.statistics.moneyEarned).toBe(216.3)
  })

  it('applies prestige sell value bonuses when selling', () => {
    const item = makeItem()
    const state = makeState({
      money: 50,
      inventory: [item],
      marketValues: {
        ...defaultGameState.marketValues,
        [item.id]: 200,
      },
      prestigeBonuses: {
        ...defaultGameState.prestigeBonuses,
        [PrestigeBonusId.SellValue]: 2,
      },
    })
    const soldState = gameReducer(state, { type: 'SELL_ITEM', itemId: item.instanceId })

    expect(soldState.money).toBe(276.8)
    expect(soldState.statistics.moneyEarned).toBe(226.8)
  })

  it('applies upgrade case discounts when opening cases', () => {
    const state = makeState({
      money: 10,
      upgrades: {
        ...defaultGameState.upgrades,
        [UpgradeId.CaseContract]: 5,
      },
    })
    const nextState = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case' },
    })

    expect(nextState.money).toBe(9.82)
    expect(nextState.statistics.moneySpent).toBe(0.18)
  })

  it('applies prestige case discounts and starting money bonuses', () => {
    const discountedState = gameReducer(makeState({
      money: 10,
      prestigeBonuses: {
        ...defaultGameState.prestigeBonuses,
        [PrestigeBonusId.CaseDiscount]: 2,
      },
    }), {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case' },
    })
    const prestigedState = gameReducer(makeState({
      inventoryValue: 1_000_000,
      prestigeBonuses: {
        ...defaultGameState.prestigeBonuses,
        [PrestigeBonusId.StartingMoney]: 2,
      },
      statistics: {
        ...defaultGameState.statistics,
        casesOpened: 25_000,
        moneyEarned: 500_000,
        moneySpent: 250_000,
        dropsByRarity: { ...defaultDropsByRarity },
      },
    }), {
      type: 'PRESTIGE',
      now: Date.now(),
    })

    expect(discountedState.money).toBe(9.81)
    expect(discountedState.statistics.moneySpent).toBe(0.19)
    expect(prestigedState.money).toBe(4_050)
  })

  it('applies automation speed upgrades to auto opening intervals', () => {
    const now = Date.now()
    const state = makeState({
      money: 10,
      upgrades: {
        ...defaultGameState.upgrades,
        [UpgradeId.AutomationServos]: 1,
      },
      automation: {
        ...defaultGameState.automation,
        autoOpener: {
          caseId: 'starter_case',
          intervalMs: 30_000,
          isEnabled: true,
          lastOpenTime: now - 28_500,
          level: 1,
          totalOpened: 0,
        },
      },
    })
    const nextState = gameReducer(state, { type: 'TICK_AUTOMATION', now })

    expect(nextState.statistics.casesOpened).toBe(1)
    expect(nextState.automation.autoOpener.totalOpened).toBe(1)
  })

  it('applies prestige automation speed bonuses to auto opening intervals', () => {
    const now = Date.now()
    const state = makeState({
      money: 10,
      prestigeBonuses: {
        ...defaultGameState.prestigeBonuses,
        [PrestigeBonusId.AutomationSpeed]: 1,
      },
      automation: {
        ...defaultGameState.automation,
        autoOpener: {
          caseId: 'starter_case',
          intervalMs: 30_000,
          isEnabled: true,
          lastOpenTime: now - 28_800,
          level: 1,
          totalOpened: 0,
        },
      },
    })
    const nextState = gameReducer(state, { type: 'TICK_AUTOMATION', now })

    expect(nextState.statistics.casesOpened).toBe(1)
    expect(nextState.automation.autoOpener.totalOpened).toBe(1)
  })

  it('learns skill nodes by spending skill points and enforces prerequisites', () => {
    const rootState = gameReducer(makeState({ skillPoints: 2 }), {
      type: 'LEARN_SKILL_NODE',
      nodeId: SkillNodeId.SellSpecialist,
      now: Date.now(),
    })
    const lockedState = gameReducer(makeState({ skillPoints: 3 }), {
      type: 'LEARN_SKILL_NODE',
      nodeId: SkillNodeId.TradeUpEdge,
      now: Date.now(),
    })
    const duplicateState = gameReducer(rootState, {
      type: 'LEARN_SKILL_NODE',
      nodeId: SkillNodeId.SellSpecialist,
      now: Date.now(),
    })

    expect(rootState.skillPoints).toBe(1)
    expect(rootState.learnedSkillNodeIds).toEqual([SkillNodeId.SellSpecialist])
    expect(lockedState.learnedSkillNodeIds).toEqual([])
    expect(lockedState.lastError).toBe('Skill prerequisites are not met.')
    expect(duplicateState.skillPoints).toBe(1)
    expect(duplicateState.lastError).toBe('Skill node is already learned.')
  })

  it('applies skill sell value bonuses when selling', () => {
    const item = makeItem()
    const state = makeState({
      money: 50,
      inventory: [item],
      learnedSkillNodeIds: [SkillNodeId.SellSpecialist],
      marketValues: {
        ...defaultGameState.marketValues,
        [item.id]: 200,
      },
    })
    const soldState = gameReducer(state, { type: 'SELL_ITEM', itemId: item.instanceId })

    expect(soldState.money).toBe(264.2)
    expect(soldState.statistics.moneyEarned).toBe(214.2)
  })

  it('applies skill automation speed bonuses to auto opening intervals', () => {
    const now = Date.now()
    const state = makeState({
      money: 10,
      learnedSkillNodeIds: [SkillNodeId.BulkAutomation],
      automation: {
        ...defaultGameState.automation,
        autoOpener: {
          caseId: 'starter_case',
          intervalMs: 30_000,
          isEnabled: true,
          lastOpenTime: now - 28_500,
          level: 1,
          totalOpened: 0,
        },
      },
    })
    const nextState = gameReducer(state, { type: 'TICK_AUTOMATION', now })

    expect(nextState.statistics.casesOpened).toBe(1)
    expect(nextState.automation.autoOpener.totalOpened).toBe(1)
  })

  it('boosts prestige point and skill point yield with Prestige Scholar', () => {
    const state = makeState({
      inventoryValue: 1_000_000,
      learnedSkillNodeIds: [SkillNodeId.PrestigeScholar],
      statistics: {
        ...defaultGameState.statistics,
        casesOpened: 25_000,
        moneyEarned: 500_000,
        moneySpent: 250_000,
        dropsByRarity: { ...defaultDropsByRarity },
      },
    })
    const nextState = gameReducer(state, { type: 'PRESTIGE', now: Date.now() })

    expect(nextState.prestigePoints).toBe(9)
    expect(nextState.skillPoints).toBe(9)
    expect(nextState.learnedSkillNodeIds).toEqual([SkillNodeId.PrestigeScholar])
  })

  it('claims a daily reward once per local day', () => {
    const now = Date.now()
    const state = makeState({
      money: 0,
      dailyRewards: createDefaultDailyRewardsState(now),
    })

    const claimedState = gameReducer(state, { type: 'CLAIM_DAILY_REWARD', now })
    const repeatedState = gameReducer(claimedState, { type: 'CLAIM_DAILY_REWARD', now })

    expect(claimedState.money).toBe(1)
    expect(claimedState.dailyRewards.streak).toBe(1)
    expect(claimedState.dailyRewards.lastClaimDayKey).toBe(getLocalDayKey(now))
    expect(findUiEvent(claimedState, 'daily_reward_claimed')).toBeDefined()
    expect(repeatedState.money).toBe(1)
    expect(repeatedState.lastError).toBe('Daily reward already claimed today.')
  })

  it('continues daily streaks from yesterday and grants the day-two case discount', () => {
    const now = Date.now()
    const state = makeState({
      dailyRewards: {
        ...createDefaultDailyRewardsState(now),
        streak: 1,
        lastClaimDayKey: getPreviousLocalDayKey(now),
      },
    })

    const nextState = gameReducer(state, { type: 'CLAIM_DAILY_REWARD', now })

    expect(nextState.dailyRewards.streak).toBe(2)
    expect(nextState.dailyRewards.caseDiscountBuff).toMatchObject({
      percent: 0.05,
    })
  })

  it('updates open, sell, and rarity daily challenge progress from gameplay actions', () => {
    const now = Date.now()
    const dailyRewards = {
      ...createDefaultDailyRewardsState(now),
      challenges: [
        makeDailyChallenge({
          id: 'open',
          type: DailyChallengeType.OpenCases,
          target: 1,
          progress: 0,
        }),
        makeDailyChallenge({
          id: 'sell',
          type: DailyChallengeType.SellValue,
          target: 10,
          progress: 0,
        }),
        makeDailyChallenge({
          id: 'rarity',
          type: DailyChallengeType.ObtainRarity,
          rarity: Rarity.Consumer,
          target: 1,
          progress: 0,
        }),
      ],
    }
    const state = makeState({
      money: 10,
      dailyRewards,
    })

    const openedState = gameReducer(state, {
      type: 'OPEN_CASE',
      payload: { caseId: 'starter_case' },
    })
    const itemToSell = makeItem({
      instanceId: 'daily-sell-item',
      marketValue: 10,
      discoveredAt: now,
    })
    const soldState = gameReducer({
      ...openedState,
      inventory: [itemToSell, ...openedState.inventory],
      marketValues: {
        ...openedState.marketValues,
        [itemToSell.id]: 10,
      },
    }, { type: 'SELL_ITEM', itemId: itemToSell.instanceId })

    expect(openedState.dailyRewards.challenges.find((challenge) => challenge.id === 'open')?.progress).toBe(1)
    expect(openedState.dailyRewards.challenges.find((challenge) => challenge.id === 'rarity')?.progress).toBe(1)
    expect(soldState.dailyRewards.challenges.find((challenge) => challenge.id === 'sell')?.progress).toBe(10)
  })

  it('claims completed daily challenge rewards and blocks repeated claims', () => {
    const now = Date.now()
    const completedChallenge = makeDailyChallenge({
      id: 'completed',
      target: 3,
      progress: 3,
      reward: { money: 12, caseDiscountPercent: 0.05, durationMs: 60_000 },
    })
    const state = makeState({
      money: 0,
      dailyRewards: {
        ...createDefaultDailyRewardsState(now),
        challenges: [completedChallenge],
      },
    })

    const claimedState = gameReducer(state, {
      type: 'CLAIM_DAILY_CHALLENGE',
      challengeId: completedChallenge.id,
      now,
    })
    const repeatedState = gameReducer(claimedState, {
      type: 'CLAIM_DAILY_CHALLENGE',
      challengeId: completedChallenge.id,
      now,
    })

    expect(claimedState.money).toBe(12)
    expect(claimedState.dailyRewards.caseDiscountBuff).toMatchObject({ percent: 0.05 })
    expect(claimedState.dailyRewards.challenges[0]?.isClaimed).toBe(true)
    expect(findUiEvent(claimedState, 'daily_challenge_claimed')).toBeDefined()
    expect(repeatedState.money).toBe(12)
    expect(repeatedState.lastError).toBe('Daily challenge is not ready to claim.')
  })

  it('rerolls one unclaimed daily challenge for free each day', () => {
    const now = Date.now()
    const dailyRewards = createDefaultDailyRewardsState(now)
    const firstChallengeId = dailyRewards.challenges[0]?.id ?? ''
    const state = makeState({ dailyRewards })

    const rerolledState = gameReducer(state, {
      type: 'REROLL_DAILY_CHALLENGE',
      challengeId: firstChallengeId,
      now,
    })
    const blockedState = gameReducer(rerolledState, {
      type: 'REROLL_DAILY_CHALLENGE',
      challengeId: rerolledState.dailyRewards.challenges[1]?.id ?? '',
      now,
    })

    expect(rerolledState.dailyRewards.freeRerollsUsed).toBe(1)
    expect(rerolledState.dailyRewards.challenges[0]?.id).not.toBe(firstChallengeId)
    expect(findUiEvent(rerolledState, 'daily_challenge_rerolled')).toBeDefined()
    expect(blockedState.dailyRewards.freeRerollsUsed).toBe(1)
    expect(blockedState.lastError).toBe('No free daily challenge rerolls remain.')
  })

  it('updates settings without replacing untouched preferences', () => {
    const state = makeState()
    const nextState = gameReducer(state, {
      type: 'UPDATE_SETTINGS',
      settings: {
        autoSellNotificationsEnabled: false,
        theme: 'light',
      },
    })

    expect(nextState.settings.autoSellNotificationsEnabled).toBe(false)
    expect(nextState.settings.theme).toBe('light')
    expect(nextState.settings.soundEnabled).toBe(defaultGameState.settings.soundEnabled)
    expect(nextState.settings.rarityColors).toEqual(defaultGameState.settings.rarityColors)
  })

  it('prevents spend underflow and reports a friendly error', () => {
    const state = makeState({ money: 2 })
    const nextState = gameReducer(state, { type: 'SPEND_MONEY', amount: 5 })

    expect(nextState.money).toBe(2)
    expect(nextState.lastError).toBe('Not enough money.')
  })

  it('clamps money increases to the supported currency range', () => {
    const state = makeState({ money: 10 })
    const nextState = gameReducer(state, { type: 'ADD_MONEY', amount: Number.MAX_SAFE_INTEGER })
    const invalidState = gameReducer(state, { type: 'ADD_MONEY', amount: Number.POSITIVE_INFINITY })

    expect(nextState.money).toBe(MAX_CURRENCY_VALUE)
    expect(invalidState.money).toBe(10)
  })

  it('awards the poop cleanup minigame reward from zero money', () => {
    const state = makeState({ money: 0 })
    const nextState = gameReducer(state, {
      type: 'COMPLETE_POOP_CLEANUP_MINIGAME',
      reward: 5,
      now: 1_782_216_000_000,
    })

    expect(nextState.money).toBe(5)
    expect(findUiEvent(nextState, 'minigame_completed')).toMatchObject({
      name: 'A Clean Pooping Job',
      reward: 5,
      createdAt: 1_782_216_000_000,
    })
  })

  it('rejects duplicate inventory instance ids', () => {
    const item = makeItem({ instanceId: 'duplicate-item' })
    const state = makeState({ inventory: [item] })
    const nextState = gameReducer(state, { type: 'ADD_ITEM', item })

    expect(nextState.inventory).toHaveLength(1)
    expect(nextState.lastError).toBe('Item already exists in inventory.')
  })

  it('sanitizes invalid market values before storing them', () => {
    const state = makeState({
      marketValues: {
        test_skin: 10,
      },
    })
    const nextState = gameReducer(state, {
      type: 'UPDATE_MARKET_VALUE',
      skinId: 'test_skin',
      value: Number.POSITIVE_INFINITY,
    })

    expect(nextState.marketValues.test_skin).toBe(0)
  })

  it('starts fresh saves with exactly fifty dollars', () => {
    expect(defaultGameState.money).toBe(50)
  })
})
