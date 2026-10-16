import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultDropsByRarity, defaultGameState, type GameState } from '../data/gameState'
import {
  AutomationModuleId,
  AutoSellRuleType,
  PrestigeBonusId,
  Rarity,
  SkillNodeId,
  TrophySlotId,
  UpgradeId,
  WearCondition,
  type AutoSellRule,
  type CollectionEntry,
  type CollectionRewardProgress,
  type SkinInstance,
} from '../data/models'
import {
  BACKUP_INTERVAL_MS,
  CURRENT_SAVE_VERSION,
  PERSISTED_MARKET_HISTORY_MAX_POINTS,
  PERSISTED_MARKET_HISTORY_MAX_TRACKED_SKINS,
  SAVE_STORAGE_KEY,
  SaveGameError,
  createSaveEnvelope,
  exportGameStateToFile,
  loadGame,
  loadGameState,
  loadGameStateOrDefault,
  parseGameSaveText,
  saveGame,
  serializeGameState,
  shouldPromptForBackup,
} from './save'
import { getInventoryValue } from './inventory'
import { POOP_CLEANUP_LAST_COMPLETED_KEY } from './poopCleanupMinigame'
import { createMarketEvent } from '../market/marketSimulation'
import { eventManager } from '../events/eventManager'
import { createDefaultDailyRewardsState } from '../rewards/dailyRewards'

function installLocalStorage() {
  const store = new Map<string, string>()

  vi.stubGlobal('window', {
    localStorage: {
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      removeItem: (key: string) => store.delete(key),
      setItem: (key: string, value: string) => store.set(key, value),
    },
  })

  return store
}

function makeItem(overrides: Partial<SkinInstance> = {}): SkinInstance {
  return {
    id: 'ak47_redline',
    weapon: 'AK-47',
    finish: 'Redline',
    rarity: Rarity.Classified,
    baseValue: 38,
    caseIds: ['starter_case'],
    image: '/assets/placeholder.png',
    instanceId: 'item-1',
    wear: WearCondition.FieldTested,
    floatValue: 0.2,
    marketValue: 32.5,
    isLocked: false,
    isFavorited: true,
    discoveredAt: 1_782_147_600_000,
    ...overrides,
  }
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...defaultGameState,
    inventory: [],
    autoSellRules: [],
    collectionBook: [],
    recentDrops: [],
    lastOpenedItems: [],
    uiEvents: [],
    upgradePoints: 0,
    achievements: [],
    statistics: {
      ...defaultGameState.statistics,
      dropsByRarity: { ...defaultDropsByRarity },
    },
    ...overrides,
  }
}

describe('save system', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('round-trips money, inventory, auto-sell rules, and collection entries', () => {
    installLocalStorage()
    vi.spyOn(Date, 'now').mockReturnValue(1_782_147_700_000)
    const item = makeItem()
    const autoSellRule: AutoSellRule = {
      id: 'sell-low-value',
      type: AutoSellRuleType.MinValue,
      enabled: true,
      valueThreshold: 1,
      excludedIds: [item.id],
    }
    const collectionEntry: CollectionEntry = {
      skinId: item.id,
      foundWearConditions: [item.wear],
      bestFloat: item.floatValue,
      highestValue: item.marketValue,
      timesFound: 3,
      firstFoundAt: item.discoveredAt,
    }
    const collectionReward: CollectionRewardProgress = {
      id: 'weapon:ak_47',
      type: 'WeaponSellBonus',
      targetId: 'AK-47',
      bonus: 0.01,
      unlockedAt: 1_782_147_630_000,
    }
    const upcomingEvent = createMarketEvent({
      now: 1_782_147_700_000,
      prng: () => 0.25,
      startTime: 1_782_147_760_000,
      type: 'KnifeWeekend',
    })
    const activeGameEvent = eventManager.createEvent({
      now: 1_782_147_700_000,
      prng: () => 0.2,
      type: 'TradeUpMadness',
    })
    const upcomingGameEvent = eventManager.createEvent({
      now: 1_782_147_700_000,
      prng: () => 0.3,
      startTime: 1_782_147_760_000,
      type: 'RetiredCaseWeek',
    })
    const dailyRewards = {
      ...createDefaultDailyRewardsState(1_782_147_700_000),
      streak: 3,
      lastClaimTime: 1_782_147_650_000,
      lastClaimDayKey: '2026-06-23',
      freeRerollsUsed: 1,
      caseDiscountBuff: {
        percent: 0.05,
        expiresAt: 1_782_148_700_000,
      },
    }
    const marketValues = {
      ...defaultGameState.marketValues,
      [item.id]: 40,
    }
    const inventoryValue = getInventoryValue([item], marketValues)
    const settings = {
      ...defaultGameState.settings,
      animationSpeed: 'skip' as const,
      autosaveEnabled: false,
      autoSellNotificationsEnabled: false,
      backupPromptEnabled: false,
      highContrastMode: true,
      language: 'cs' as const,
      largeText: true,
      marketEventBannersEnabled: false,
      musicEnabled: false,
      rarityColors: {
        ...defaultGameState.settings.rarityColors,
        [Rarity.Covert]: '#123456',
      },
      recentDropFeedAnimationsEnabled: false,
      soundEnabled: false,
      soundVolume: 0.35,
      theme: 'light' as const,
    }
    const state = makeState({
      money: 1234.56,
      upgradePoints: 4,
      skillPoints: 3,
      learnedSkillNodeIds: [SkillNodeId.SellSpecialist],
      prestigePoints: 6,
      prestigeBonuses: {
        ...defaultGameState.prestigeBonuses,
        [PrestigeBonusId.SellValue]: 2,
      },
      upgrades: {
        ...defaultGameState.upgrades,
        [UpgradeId.CaseContract]: 2,
      },
      achievements: [
        {
          id: 'first_case_opened',
          isClaimed: true,
          unlockedAt: 1_782_147_620_000,
        },
      ],
      inventory: [item],
      inventoryValue,
      inventoryValueHistory: [
        {
          timestamp: 1_782_147_650_000,
          value: 25,
        },
      ],
      autoSellRules: [autoSellRule],
      automation: {
        ...defaultGameState.automation,
        autoOpener: {
          caseId: 'fracture_style_case',
          intervalMs: 25_000,
          isEnabled: true,
          lastOpenTime: 1_782_147_690_000,
          level: 2,
          totalOpened: 4,
        },
        modules: {
          ...defaultGameState.automation.modules,
          [AutomationModuleId.CaseFarm]: {
            ...defaultGameState.automation.modules[AutomationModuleId.CaseFarm],
            isEnabled: true,
            lastRunTime: 1_782_147_680_000,
            level: 2,
            totalGenerated: 12.5,
            totalRuns: 4,
          },
        },
      },
      collectionBook: [collectionEntry],
      collectionRewards: [collectionReward],
      lastPoopCleaningAt: 1_782_147_660_000,
      workMiniGameCooldowns: {
        poopCleaning: 1_782_147_660_000,
        sortBoxes: 1_782_147_670_000,
      },
      dailyRewards,
      settings,
      trophyAssignments: {
        [TrophySlotId.MostExpensiveSkin]: {
          slotId: TrophySlotId.MostExpensiveSkin,
          itemId: item.instanceId,
          assignedAt: 1_782_147_640_000,
        },
      },
      marketValues,
      marketHistory: {
        ...defaultGameState.marketHistory,
        [item.id]: [
          {
            timestamp: 1_782_147_600_000,
            value: 38,
          },
          {
            timestamp: 1_782_147_700_000,
            value: 40,
          },
        ],
      },
      activeEvents: [activeGameEvent],
      upcomingEvents: [upcomingGameEvent],
      eventHistory: [],
      upcomingMarketEvents: [upcomingEvent],
      lastBackupAt: 1_782_147_500_000,
      statistics: {
        ...defaultGameState.statistics,
        casesOpened: 1,
        drops: 1,
        tradeUpsCompleted: 2,
        dropsByRarity: {
          ...defaultDropsByRarity,
          [Rarity.Classified]: 1,
        },
      },
    })

    saveGame(state)

    const loadedPlayerState = loadGame()
    const loadedGameState = loadGameState()

    expect(loadedPlayerState).toMatchObject({
      money: 1234.56,
      upgradePoints: 4,
      skillPoints: 3,
      learnedSkillNodeIds: [SkillNodeId.SellSpecialist],
      prestigePoints: 6,
      prestigeBonuses: {
        ...defaultGameState.prestigeBonuses,
        [PrestigeBonusId.SellValue]: 2,
      },
      upgrades: {
        ...defaultGameState.upgrades,
        [UpgradeId.CaseContract]: 2,
      },
      achievements: [
        {
          id: 'first_case_opened',
          isClaimed: true,
          unlockedAt: 1_782_147_620_000,
        },
      ],
      inventory: [item],
      inventoryValue,
      autoSellRules: [autoSellRule],
      automation: {
        autoOpener: {
          caseId: 'fracture_style_case',
          intervalMs: 25_000,
          isEnabled: true,
          lastOpenTime: 1_782_147_690_000,
          level: 2,
          totalOpened: 4,
        },
        modules: {
          ...defaultGameState.automation.modules,
          [AutomationModuleId.CaseFarm]: {
            ...defaultGameState.automation.modules[AutomationModuleId.CaseFarm],
            isEnabled: true,
            lastRunTime: 1_782_147_680_000,
            level: 2,
            totalGenerated: 12.5,
            totalRuns: 4,
          },
        },
      },
      collectionBook: [collectionEntry],
      collectionRewards: [collectionReward],
      lastPoopCleaningAt: 1_782_147_660_000,
      workMiniGameCooldowns: {
        poopCleaning: 1_782_147_660_000,
        sortBoxes: 1_782_147_670_000,
      },
      dailyRewards,
      trophyAssignments: {
        [TrophySlotId.MostExpensiveSkin]: {
          slotId: TrophySlotId.MostExpensiveSkin,
          itemId: item.instanceId,
          assignedAt: 1_782_147_640_000,
        },
      },
      eventHistory: [],
      lastBackupAt: 1_782_147_500_000,
      lastSaved: 1_782_147_700_000,
    })
    expect(loadedPlayerState?.activeEvents.map((event) => event.id)).toEqual([activeGameEvent.id])
    expect(loadedPlayerState?.upcomingEvents.map((event) => event.id)).toEqual([upcomingGameEvent.id])
    expect(loadedPlayerState?.eventHistory).toEqual([])
    expect(loadedGameState?.marketValues[item.id]).toBe(40)
    expect(loadedGameState?.inventoryValue).toBe(inventoryValue)
    expect(loadedGameState?.inventoryValueHistory).toEqual([
      {
        timestamp: 1_782_147_650_000,
        value: 25,
      },
      {
        timestamp: 1_782_147_700_000,
        value: inventoryValue,
      },
    ])
    expect(loadedGameState?.marketHistory[item.id]).toEqual([
      {
        timestamp: 1_782_147_600_000,
        value: 38,
      },
      {
        timestamp: 1_782_147_700_000,
        value: 40,
      },
    ])
    expect(loadedGameState?.activeEvents.map((event) => event.id)).toEqual([activeGameEvent.id])
    expect(loadedGameState?.upcomingEvents.map((event) => event.id)).toEqual([upcomingGameEvent.id])
    expect(loadedGameState?.eventHistory).toEqual([])
    expect(loadedGameState?.lastBackupAt).toBe(1_782_147_500_000)
    expect(loadedGameState?.lastPoopCleaningAt).toBe(1_782_147_660_000)
    expect(loadedGameState?.workMiniGameCooldowns).toMatchObject({
      poopCleaning: 1_782_147_660_000,
      sortBoxes: 1_782_147_670_000,
    })
    expect(loadedGameState?.settings).toMatchObject(settings)
    expect(loadedGameState?.upcomingMarketEvents.map((event) => event.id)).toEqual([upcomingEvent.id])
    expect(loadedGameState?.activeMarketEvents).toEqual([])
    expect(loadedGameState?.marketEventHistory).toEqual([])
    expect(loadedGameState?.statistics.dropsByRarity[Rarity.Classified]).toBe(1)
    expect(loadedGameState?.statistics.tradeUpsCompleted).toBe(2)
  })

  it('migrates legacy unversioned saves by adding missing default fields', () => {
    const store = installLocalStorage()
    const item = makeItem()
    const legacyState = {
      money: 500,
      inventory: [item],
      casesUnlocked: ['starter_case'],
      collectionBook: [],
      prestigeLevel: 0,
      marketValues: {
        [item.id]: 38,
      },
      statistics: {
        casesOpened: 1,
        moneySpent: 0.2,
        moneyEarned: 0,
        drops: 1,
        rareDrops: 0,
        dropsByRarity: {
          [Rarity.Classified]: 1,
        },
      },
    }

    store.set(SAVE_STORAGE_KEY, JSON.stringify(legacyState))

    const loadedState = loadGameState()

    expect(loadedState?.statistics.itemsSold).toBe(0)
    expect(loadedState?.statistics.tradeUpsCompleted).toBe(0)
    expect(loadedState?.autoSellRules).toEqual([])
    expect(loadedState?.automation).toEqual(defaultGameState.automation)
    expect(loadedState?.collectionRewards).toEqual([])
    expect(loadedState?.trophyAssignments).toEqual({})
    expect(loadedState?.upgrades).toEqual(defaultGameState.upgrades)
    expect(loadedState?.prestigePoints).toBe(0)
    expect(loadedState?.prestigeBonuses).toEqual(defaultGameState.prestigeBonuses)
    expect(loadedState?.upgradePoints).toBe(0)
    expect(loadedState?.skillPoints).toBe(0)
    expect(loadedState?.learnedSkillNodeIds).toEqual([])
    expect(loadedState?.achievements).toEqual([])
    expect(loadedState?.lastBackupAt).toBe(0)
    expect(loadedState?.settings).toEqual(defaultGameState.settings)
    expect(loadedState?.marketHistory[item.id]?.[0]?.value).toBe(38)
    expect(loadedState?.upcomingMarketEvents).toEqual([])
    expect(loadedState?.activeEvents).toEqual([])
    expect(loadedState?.upcomingEvents).toEqual([])
    expect(loadedState?.eventHistory).toEqual([])
    expect(loadedState?.dailyRewards.challenges).toHaveLength(4)
    expect(loadedState?.inventoryValue).toBe(getInventoryValue([item], { [item.id]: 38 }))
    expect(loadedState?.inventoryValueHistory[0]?.value).toBe(loadedState?.inventoryValue)
    expect(loadedState?.ui.onboarding).toEqual(defaultGameState.ui.onboarding)
    expect(loadedState?.lastPoopCleaningAt).toBe(0)
  })

  it('deduplicates inventory instance ids when saving and loading', () => {
    installLocalStorage()
    const item = makeItem({ instanceId: 'duplicate-item', marketValue: 10 })
    const duplicate = makeItem({ instanceId: 'duplicate-item', marketValue: 999 })

    saveGame(makeState({ inventory: [item, duplicate] }))

    expect(loadGameState()?.inventory.map((inventoryItem) => inventoryItem.instanceId)).toEqual(['duplicate-item'])
  })

  it('bounds persisted market history and keeps compact autosaves below browser quota pressure', () => {
    const now = 1_782_147_700_000
    const importantItem = makeItem({ id: 'important-skin', instanceId: 'important-instance', marketValue: 10_000 })
    const marketHistory = Object.fromEntries(
      Array.from({ length: 240 }, (_, skinIndex) => [
        `skin-${skinIndex}`,
        Array.from({ length: 180 }, (_, pointIndex) => ({
          timestamp: now - (180 - pointIndex) * 60_000,
          value: skinIndex + pointIndex / 100,
        })),
      ]),
    )
    marketHistory[importantItem.id] = Array.from({ length: 180 }, (_, pointIndex) => ({
      timestamp: now - (180 - pointIndex) * 60_000,
      value: 10_000 + pointIndex,
    }))

    const envelope = createSaveEnvelope(makeState({
      inventory: [importantItem],
      marketHistory,
    }))
    const serialized = serializeGameState(envelope.state)

    expect(Object.keys(envelope.state.marketHistory)).toHaveLength(PERSISTED_MARKET_HISTORY_MAX_TRACKED_SKINS)
    expect(envelope.state.marketHistory[importantItem.id]).toHaveLength(PERSISTED_MARKET_HISTORY_MAX_POINTS)
    expect(serialized).not.toContain('\n')
    expect(serialized.length).toBeLessThan(2_000_000)
  })

  it('repairs invalid saved money without restoring a corrupted value', () => {
    installLocalStorage()
    const state = makeState({ money: 125 })

    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({
      version: CURRENT_SAVE_VERSION,
      savedAt: 1_782_147_700_000,
      state: {
        ...state,
        money: 'broken',
      },
    }))

    expect(loadGameState()?.money).toBe(defaultGameState.money)
  })

  it('migrates legacy trophy item snapshots to item id references only', () => {
    const item = makeItem()
    const text = JSON.stringify({
      version: 24,
      savedAt: 1_782_147_700_000,
      state: {
        ...makeState({
          inventory: [],
          trophyAssignments: {} as GameState['trophyAssignments'],
        }),
        trophyAssignments: {
          showcase_1: {
            slotId: 'showcase_1',
            item,
            assignedAt: 1_782_147_640_000,
          },
        },
      },
    })

    const loadedState = parseGameSaveText(text)

    expect(loadedState.inventory).toEqual([])
    expect(loadedState.trophyAssignments.showcase_1).toEqual({
      slotId: 'showcase_1',
      itemId: item.instanceId,
      assignedAt: 1_782_147_640_000,
    })
    expect(JSON.stringify(loadedState.trophyAssignments)).not.toContain('"weapon"')
  })

  it('uses the dedicated poop cleaning timestamp when a refresh happens before autosave', () => {
    const store = installLocalStorage()
    const completedAt = 1_782_147_660_000

    store.set(POOP_CLEANUP_LAST_COMPLETED_KEY, String(completedAt))

    expect(loadGameState()).toBeNull()
    expect(loadGameStateOrDefault().lastPoopCleaningAt).toBe(completedAt)
  })

  it('throws a friendly error for unreadable save files', () => {
    expect(() => parseGameSaveText('{not-json')).toThrow(SaveGameError)
    expect(() => parseGameSaveText('{not-json')).toThrow('Save file could not be read.')
  })

  it('preserves the first-case hook flag through save and load', () => {
    const state = makeState({ hasUsedFirstCaseHook: true })
    const loadedState = parseGameSaveText(JSON.stringify(createSaveEnvelope(state)))

    expect(loadedState.hasUsedFirstCaseHook).toBe(true)
  })

  it('preserves pattern metadata and migrates legacy items without rerolling them', () => {
    const patternedItem = makeItem({
      paintSeed: 661,
      baseMarketValue: 100,
      patternPremium: 9_900,
      marketValue: 10_000,
      pattern: {
        family: 'case_hardened',
        name: 'AK-47 Blue Gem · Pattern 661',
        tier: 'iconic',
        premiumMultiplier: 100,
        referenceConfidence: 'estimated',
      },
    })
    const patternedState = makeState({ inventory: [patternedItem] })
    const roundTripped = parseGameSaveText(JSON.stringify(createSaveEnvelope(patternedState)))

    expect(roundTripped.inventory[0]).toMatchObject({ paintSeed: 661, pattern: { tier: 'iconic' } })

    const legacyItem = makeItem()
    const migrated = parseGameSaveText(JSON.stringify({
      version: 28,
      savedAt: Date.now(),
      state: makeState({ inventory: [legacyItem] }),
    }))

    expect(migrated.inventory[0]?.paintSeed).toBeUndefined()
    expect(migrated.inventory[0]?.pattern).toBeUndefined()
    expect(migrated.statistics.patternDrops).toBe(0)
    expect(migrated.statistics.exceptionalPatternDrops).toBe(0)
  })

  it('migrates version 21 saves with backup and autosave defaults', () => {
    const migrated = parseGameSaveText(JSON.stringify({
      version: 21,
      savedAt: 1_782_147_700_000,
      state: {
        ...defaultGameState,
        settings: {
          ...defaultGameState.settings,
          autosaveEnabled: 'bad',
          backupPromptEnabled: 'bad',
        },
      },
    }))

    expect(createSaveEnvelope(migrated).version).toBe(CURRENT_SAVE_VERSION)
    expect(migrated.lastBackupAt).toBe(0)
    expect(migrated.hasUsedFirstCaseHook).toBe(false)
    expect(migrated.settings.autosaveEnabled).toBe(true)
    expect(migrated.settings.backupPromptEnabled).toBe(true)
  })

  it('detects weekly backup prompts and exports JSON through the download hook', () => {
    const now = 1_782_147_700_000
    const state = makeState({
      lastBackupAt: now - BACKUP_INTERVAL_MS - 1,
    })
    const download = vi.fn()

    expect(shouldPromptForBackup(state, now)).toBe(true)

    const result = exportGameStateToFile(state, {
      download,
      fileName: 'backup.json',
    })

    expect(download).toHaveBeenCalledWith(expect.any(String), 'backup.json')
    expect(JSON.parse(result.json)).toMatchObject({
      version: CURRENT_SAVE_VERSION,
      state: {
        money: state.money,
      },
    })
  })

  it('does not prompt for backups when disabled or still inside the interval', () => {
    const now = 1_782_147_700_000

    expect(shouldPromptForBackup(makeState({
      lastBackupAt: now - BACKUP_INTERVAL_MS + 1,
    }), now)).toBe(false)
    expect(shouldPromptForBackup(makeState({
      lastBackupAt: now - BACKUP_INTERVAL_MS - 1,
      settings: {
        ...defaultGameState.settings,
        backupPromptEnabled: false,
      },
    }), now)).toBe(false)
  })
})
