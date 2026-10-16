/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultDropsByRarity, defaultGameState, type GameState } from '../data/gameState'
import { Rarity, WearCondition, type AchievementProgress, type SkinInstance } from '../data/models'
import {
  LocalCloudBackend,
  createCloudSaveEnvelope,
  isOfflineError,
  mergeGameStates,
  parseCloudSaveEnvelope,
} from './cloudSave'

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...defaultGameState,
    inventory: [],
    collectionBook: [],
    recentDrops: [],
    lastOpenedItems: [],
    uiEvents: [],
    statistics: {
      ...defaultGameState.statistics,
      dropsByRarity: { ...defaultDropsByRarity },
    },
    ...overrides,
  }
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
    isFavorited: false,
    discoveredAt: 1_782_147_600_000,
    ...overrides,
  }
}

describe('cloud save backend', () => {
  let localStorageStore: Map<string, string>

  beforeEach(() => {
    localStorageStore = new Map<string, string>()

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => localStorageStore.clear(),
        getItem: (key: string) => localStorageStore.get(key) ?? null,
        removeItem: (key: string) => {
          localStorageStore.delete(key)
        },
        setItem: (key: string, value: string) => {
          localStorageStore.set(key, value)
        },
      },
    })
  })

  afterEach(() => {
    localStorageStore.clear()
    vi.restoreAllMocks()
  })

  it('creates an account, logs in, round-trips a save, and exposes leaderboard rows', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_782_147_700_000)
    const backend = new LocalCloudBackend('cloud-save-test')
    const session = await backend.signUp('Player@Example.COM', 'secret-pass', 'CaseAce')

    expect(session.user.email).toBe('player@example.com')
    await expect(backend.signUp('player@example.com', 'secret-pass')).rejects.toThrow(/exists/i)

    await backend.logout()
    const loginSession = await backend.login('PLAYER@example.com', 'secret-pass')
    const item = makeItem({ marketValue: 321.5 })
    const state = makeState({
      inventory: [item],
      inventoryValue: 321.5,
      lastSaved: 1_782_147_700_000,
      marketValues: {
        ...defaultGameState.marketValues,
        [item.id]: 321.5,
      },
      money: 1234,
      statistics: {
        ...defaultGameState.statistics,
        casesOpened: 42,
        dropsByRarity: { ...defaultDropsByRarity },
        moneyEarned: 800,
        moneySpent: 350,
      },
    })
    const saved = await backend.saveSave(loginSession, createCloudSaveEnvelope(state))
    const loaded = await backend.loadSave(loginSession)

    expect(saved.revision).toBe(1)
    expect(loaded?.revision).toBe(1)
    expect(parseCloudSaveEnvelope(loaded!.envelope).money).toBe(1234)

    const entries = await backend.listLeaderboard('casesOpened')

    expect(entries[0]).toMatchObject({
      casesOpened: 42,
      totalProfit: 450,
      username: 'CaseAce',
    })
    expect(entries[0].inventoryValue).toBeGreaterThan(0)
  })

  it('treats the local backend offline mode as a syncable offline error', async () => {
    const backend = new LocalCloudBackend('cloud-save-offline-test')

    backend.forceOffline = true

    await expect(backend.signUp('player@example.com', 'secret-pass')).rejects.toSatisfy(isOfflineError)
  })

  it('uses the newest inventory and money while still merging achievement progress', () => {
    const localAchievement: AchievementProgress = {
      id: 'first_case_opened',
      isClaimed: false,
      unlockedAt: 1_782_147_600_000,
    }
    const cloudAchievement: AchievementProgress = {
      id: 'first_case_opened',
      isClaimed: true,
      unlockedAt: 1_782_147_650_000,
    }
    const localItem = makeItem({ discoveredAt: 1_782_147_700_000, instanceId: 'local-item', marketValue: 10 })
    const cloudItem = makeItem({ discoveredAt: 1_782_147_650_000, instanceId: 'cloud-item', marketValue: 20 })
    const merged = mergeGameStates(
      makeState({
        achievements: [localAchievement],
        inventory: [localItem],
        lastSaved: 1_782_147_700_000,
        money: 100,
      }),
      makeState({
        achievements: [cloudAchievement],
        inventory: [cloudItem],
        lastSaved: 1_782_147_650_000,
        money: 250,
        prestigeLevel: 2,
      }),
    )

    expect(merged.inventory.map((item) => item.instanceId)).toEqual(['local-item'])
    expect(merged.achievements).toEqual([
      {
        id: 'first_case_opened',
        isClaimed: true,
        unlockedAt: localAchievement.unlockedAt,
      },
    ])
    expect(merged.money).toBe(100)
    expect(merged.prestigeLevel).toBe(2)
  })

  it('preserves paint seeds and pattern valuation through cloud merge', () => {
    const patternedItem = makeItem({
      instanceId: 'patterned-item',
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
    const merged = mergeGameStates(
      makeState({ inventory: [patternedItem], lastSaved: 200 }),
      makeState({ inventory: [], lastSaved: 100 }),
    )

    expect(merged.inventory[0]).toMatchObject({
      paintSeed: 661,
      patternPremium: 9_900,
      pattern: { tier: 'iconic' },
    })
  })
})
