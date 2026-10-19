/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultDropsByRarity, defaultGameState, type GameState } from '../data/gameState'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
import {
  LocalCloudBackend,
  createCloudSaveEnvelope,
  createPublicPlayerSummary,
  haveSameCloudState,
  isOfflineError,
  loadAccountSave,
  loadGuestSave,
  normalizeDisplayName,
  parseCloudSaveEnvelope,
  storeAccountSave,
  storeGuestSave,
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
    const profile = await backend.updateProfile(loginSession, {
      avatarKey: 'crown',
      displayName: 'CaseAce',
      isProfilePublic: true,
      isTrophyShowcasePublic: true,
    })

    await backend.publishPlayerSummary(loginSession, createPublicPlayerSummary(state, profile))

    expect(saved.revision).toBe(1)
    expect(loaded?.revision).toBe(1)
    expect(parseCloudSaveEnvelope(loaded!.envelope).money).toBe(1234)

    const entries = await backend.listLeaderboard('casesOpened')

    expect(entries[0]).toMatchObject({
      achievementCount: 0,
      casesOpened: 42,
      totalProfit: 450,
      username: 'CaseAce',
    })
    expect(entries[0].inventoryValue).toBeGreaterThan(0)
    expect(entries[0].mostValuableSkin).toBeGreaterThan(0)
  })

  it('validates and uniquely reserves display names without exposing account existence on reset', async () => {
    const backend = new LocalCloudBackend('cloud-profile-validation-test')

    await backend.signUp('one@example.com', 'secret-pass', 'Blue Gem')
    await expect(backend.signUp('two@example.com', 'secret-pass', 'blue gem')).rejects.toThrow(/already in use/i)
    await expect(backend.requestPasswordReset('missing@example.com')).resolves.toBeUndefined()
    expect(() => normalizeDisplayName('<script>')).toThrow(/letters, numbers/i)
    expect(normalizeDisplayName('  Case   Ace  ')).toBe('Case Ace')
  })

  it('rejects stale revisions instead of overwriting newer device progress', async () => {
    const backend = new LocalCloudBackend('cloud-revision-test')
    const session = await backend.signUp('revision@example.com', 'secret-pass', 'RevisionAce')
    const first = await backend.saveSave(session, createCloudSaveEnvelope(makeState({ money: 100 })), 0)
    const second = await backend.saveSave(session, createCloudSaveEnvelope(makeState({ money: 200 })), first.revision)

    await expect(
      backend.saveSave(session, createCloudSaveEnvelope(makeState({ money: 999 })), first.revision),
    ).rejects.toMatchObject({
      name: 'CloudRevisionConflictError',
      remoteRecord: { revision: second.revision },
    })
    expect(parseCloudSaveEnvelope((await backend.loadSave(session))!.envelope).money).toBe(200)
  })

  it('publishes only opted-in summaries and only selected trophy snapshots', async () => {
    const backend = new LocalCloudBackend('cloud-profile-privacy-test')
    const owner = await backend.signUp('private@example.com', 'secret-pass', 'PrivateAce')
    const item = makeItem({
      instanceId: 'trophy-pattern',
      paintSeed: 661,
      pattern: {
        family: 'case_hardened',
        name: 'AK-47 Blue Gem · Pattern 661',
        premiumMultiplier: 100,
        referenceConfidence: 'estimated',
        tier: 'iconic',
      },
    })
    const state = makeState({
      inventory: [item],
      trophyAssignments: { showcase_1: { assignedAt: 1, itemId: item.instanceId, slotId: 'showcase_1' } },
    })
    let profile = await backend.getProfile(owner)

    await backend.publishPlayerSummary(owner, createPublicPlayerSummary(state, profile))
    await expect(backend.getPublicProfile(owner.user.id)).resolves.toBeNull()

    profile = await backend.updateProfile(owner, {
      avatarKey: 'knife',
      displayName: 'PublicAce',
      isProfilePublic: true,
      isTrophyShowcasePublic: true,
    })
    await backend.publishPlayerSummary(owner, createPublicPlayerSummary(state, profile))
    const published = await backend.getPublicProfile(owner.user.id)

    expect(published).toMatchObject({ username: 'PublicAce', trophyItems: [{ instanceId: 'trophy-pattern', paintSeed: 661 }] })
    expect(JSON.stringify(published)).not.toContain('private@example.com')
  })

  it('sorts every leaderboard category deterministically from public summaries', async () => {
    const backend = new LocalCloudBackend('cloud-leaderboard-sort-test')
    const low = await backend.signUp('low@example.com', 'secret-pass', 'LowRank')
    await backend.logout()
    const high = await backend.signUp('high@example.com', 'secret-pass', 'HighRank')
    const makePublic = async (session: typeof low, rarePatterns: number, achievementCount: number) => {
      const profile = await backend.updateProfile(session, {
        avatarKey: 'crosshair',
        displayName: session.user.username!,
        isProfilePublic: true,
        isTrophyShowcasePublic: false,
      })
      const summary = createPublicPlayerSummary(makeState(), profile)
      await backend.publishPlayerSummary(session, { ...summary, achievementCount, rarePatterns })
    }

    await makePublic(low, 1, 2)
    await makePublic(high, 9, 8)

    expect((await backend.listLeaderboard('rarePatterns')).map((entry) => entry.username)).toEqual(['HighRank', 'LowRank'])
    expect((await backend.listLeaderboard('achievementCount'))[0].achievementCount).toBe(8)
  })

  it('keeps guest and account saves separate while preserving pattern identity', () => {
    const guest = makeState({ money: 125 })
    const patterned = makeItem({
      instanceId: 'scoped-pattern',
      paintSeed: 387,
      patternPremium: 999,
      pattern: {
        family: 'case_hardened',
        name: 'Blue Gem',
        premiumMultiplier: 10,
        referenceConfidence: 'estimated',
        tier: 'exceptional',
      },
    })
    const account = makeState({ inventory: [patterned], money: 500 })

    storeGuestSave(guest)
    storeAccountSave('user-scope', account)

    expect(loadGuestSave()?.money).toBe(125)
    expect(loadAccountSave('user-scope')?.inventory[0]).toMatchObject({ instanceId: 'scoped-pattern', paintSeed: 387, patternPremium: 999, pattern: { tier: 'exceptional' } })
  })

  it('compares cloud states without treating save timestamps as gameplay conflicts', () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1_782_147_700_000)
      .mockReturnValueOnce(1_782_147_700_100)

    expect(haveSameCloudState(makeState({ lastSaved: 10 }), makeState({ lastSaved: 20 }))).toBe(true)
    expect(haveSameCloudState(makeState({ money: 10 }), makeState({ money: 11 }))).toBe(false)
  })

  it('treats the local backend offline mode as a syncable offline error', async () => {
    const backend = new LocalCloudBackend('cloud-save-offline-test')

    backend.forceOffline = true

    await expect(backend.signUp('player@example.com', 'secret-pass')).rejects.toSatisfy(isOfflineError)
  })

})
