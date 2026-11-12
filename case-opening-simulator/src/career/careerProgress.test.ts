import { describe, expect, it } from 'vitest'
import { gameReducer } from '../data/gameReducer'
import { defaultGameState, type GameState } from '../data/gameState'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
import { parseGameSaveText } from '../utils/save'
import {
  CAREER_LEVEL_CAP,
  CAREER_RANKS,
  createCareerState,
  getCareerLevelFromXp,
  getCareerRankForLevel,
  getCumulativeXpForLevel,
  getDiminishingXpMultiplier,
  recordCareerAction,
  startNextCareerRun,
} from './careerProgress'

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...structuredClone(defaultGameState),
    career: createCareerState({ now: 1_000, runId: 'run-test' }),
    hasUsedFirstCaseHook: true,
    ...overrides,
  }
}

function makeItem(overrides: Partial<SkinInstance> = {}): SkinInstance {
  return {
    id: 'ak47_test',
    weapon: 'AK-47',
    finish: 'Test Finish',
    rarity: Rarity.Classified,
    baseValue: 100,
    baseMarketValue: 100,
    caseIds: ['starter_case'],
    image: '/assets/placeholder.png',
    instanceId: 'career-item-1',
    wear: WearCondition.FactoryNew,
    floatValue: 0.02,
    marketValue: 100,
    isLocked: false,
    isFavorited: false,
    discoveredAt: 2_000,
    paintSeed: 661,
    pattern: {
      family: 'case_hardened',
      name: 'Blue Gem — Tier 1',
      premiumMultiplier: 2,
      referenceConfidence: 'verified',
      tier: 'exceptional',
    },
    patternPremium: 100,
    ...overrides,
  }
}

describe('Career XP curve and ranks', () => {
  it('uses the documented cumulative formula monotonically through level 100', () => {
    expect(getCumulativeXpForLevel(1)).toBe(0)
    for (let level = 1; level <= CAREER_LEVEL_CAP; level += 1) {
      const expected = Math.round(
        1_000 * Math.pow(level - 1, 1.72) +
        2_500 * Math.pow(Math.max(0, level - 25), 1.28),
      )
      expect(getCumulativeXpForLevel(level)).toBe(expected)
      if (level > 1) {
        expect(getCumulativeXpForLevel(level)).toBeGreaterThan(getCumulativeXpForLevel(level - 1))
      }
      expect(getCareerLevelFromXp(expected)).toBe(level)
      if (level > 1) expect(getCareerLevelFromXp(expected - 1)).toBe(level - 1)
    }
    expect(getCareerLevelFromXp(Number.MAX_SAFE_INTEGER)).toBe(100)
  })

  it('transitions at exactly the six documented rank gates', () => {
    for (const rank of CAREER_RANKS) {
      expect(getCareerRankForLevel(rank.minimumLevel).id).toBe(rank.id)
    }
    expect(getCareerRankForLevel(14).id).toBe('case-addict')
    expect(getCareerRankForLevel(34).id).toBe('independent-trader')
    expect(getCareerRankForLevel(99).id).toBe('market-mogul')
  })

  it('applies the documented diminishing-return floor without making activity worthless', () => {
    expect(getDiminishingXpMultiplier(5, 5)).toBe(1)
    expect(getDiminishingXpMultiplier(6, 5)).toBeCloseTo(1 / 1.12)
    expect(getDiminishingXpMultiplier(10_000, 5)).toBe(0.2)
  })
})

describe('Career XP event pipeline', () => {
  it('awards exact-once XP for a paid case opening and its first discoveries', () => {
    const state = makeState({ money: 10 })
    const action = {
      type: 'OPEN_CASE' as const,
      payload: {
        caseId: 'starter_case',
        openingEventId: 'opening-career-1',
        now: 2_000,
      },
    }
    const opened = gameReducer(state, action)
    const replayed = recordCareerAction(opened, opened, action)

    expect(opened.career.currentRunXp).toBeGreaterThan(0)
    expect(opened.career.recentEvents.some((event) => event.type === 'case-opening')).toBe(true)
    expect(opened.career.recentEvents.some((event) => event.type === 'collection-discovery')).toBe(true)
    expect(replayed.career.currentRunXp).toBe(opened.career.currentRunXp)
  })

  it('diminishes repeated openings in a rolling window without reducing them to zero', () => {
    let state = makeState({ money: 100 })
    for (let index = 0; index < 25; index += 1) {
      state = gameReducer(state, {
        type: 'OPEN_CASE',
        payload: {
          caseId: 'starter_case',
          openingEventId: `opening-spam-${index}`,
          now: 10_000 + index,
        },
      })
    }
    const openingEvents = state.career.recentEvents
      .filter((event) => event.type === 'case-opening')
      .reverse()
    expect(openingEvents).toHaveLength(25)
    expect(openingEvents[19]?.multiplier).toBe(1)
    expect(openingEvents[20]?.multiplier).toBeLessThan(1)
    expect(openingEvents.every((event) => event.multiplier >= 0.2 && event.xp >= 1)).toBe(true)
  })

  it('awards performance-based Work XP only after a confirmed job completion', () => {
    const state = makeState()
    const completed = gameReducer(state, {
      type: 'COMPLETE_WORK_MINIGAME',
      gameId: 'precisionStrike',
      now: 50_000_000,
      performance: 1,
    })
    const replayed = gameReducer(completed, {
      type: 'COMPLETE_WORK_MINIGAME',
      gameId: 'precisionStrike',
      now: 50_000_000,
      performance: 1,
    })

    expect(completed.career.specializations.work.currentRunXp).toBe(45)
    expect(replayed.career.specializations.work.currentRunXp).toBe(45)
  })

  it('uses known item cost basis for realized trade XP and rejects self-trades', () => {
    const item = makeItem()
    const before = makeState({
      economyLedger: {
        ...structuredClone(defaultGameState.economyLedger),
        itemCostBasis: { [item.instanceId]: 70 },
      },
    })
    const transaction = {
      id: 'market-sale-1',
      type: 'player-sale' as const,
      item,
      price: 100,
      fairMarketValue: 100,
      counterparty: 'Collector-17',
      createdAt: 3_000,
    }
    const sold = recordCareerAction(before, {
      ...before,
      marketplace: {
        ...before.marketplace,
        transactions: [transaction],
      },
    }, { type: 'TICK_MARKETPLACE', now: 3_000 })
    const replayed = recordCareerAction(sold, sold, { type: 'TICK_MARKETPLACE', now: 3_000 })
    const selfTrade = recordCareerAction(before, {
      ...before,
      marketplace: {
        ...before.marketplace,
        transactions: [{ ...transaction, id: 'market-sale-self', counterparty: 'Player' }],
      },
    }, { type: 'TICK_MARKETPLACE', now: 3_000 })

    expect(sold.career.specializations.trading.currentRunXp).toBeGreaterThan(20)
    expect(replayed.career.currentRunXp).toBe(sold.career.currentRunXp)
    expect(selfTrade.career.currentRunXp).toBe(0)
  })

  it('awards achievement XP exactly once and suppresses legacy achievement conversion', () => {
    const progress = { id: 'first_case_opened', isClaimed: false, unlockedAt: 2_000 }
    const before = makeState({ achievements: [progress] })
    const claimedState = { ...before, achievements: [{ ...progress, isClaimed: true }] }
    const claimed = recordCareerAction(before, claimedState, {
      type: 'CLAIM_ACHIEVEMENT_REWARD',
      achievementId: progress.id,
      now: 3_000,
    })
    const replayed = recordCareerAction(claimed, claimed, {
      type: 'CLAIM_ACHIEVEMENT_REWARD',
      achievementId: progress.id,
      now: 3_000,
    })
    const legacyBefore = {
      ...before,
      career: { ...before.career, legacyAchievementIds: [progress.id] },
    }
    const legacyClaim = recordCareerAction(legacyBefore, {
      ...legacyBefore,
      achievements: [{ ...progress, isClaimed: true }],
    }, {
      type: 'CLAIM_ACHIEVEMENT_REWARD',
      achievementId: progress.id,
      now: 3_000,
    })

    expect(claimed.career.currentRunXp).toBeGreaterThan(0)
    expect(replayed.career.currentRunXp).toBe(claimed.career.currentRunXp)
    expect(legacyClaim.career.currentRunXp).toBe(0)
  })

  it('resets current-run XP on prestige while preserving lifetime progress', () => {
    const career = createCareerState({ now: 1_000, runId: 'old-run' })
    career.currentRunXp = 2_000
    career.lifetimeXp = 4_000
    career.specializations.trading.currentRunXp = 700
    career.specializations.trading.lifetimeXp = 900
    const next = startNextCareerRun(career, 'new-run', 5_000)

    expect(next.currentRunXp).toBe(0)
    expect(next.lifetimeXp).toBe(4_000)
    expect(next.specializations.trading.currentRunXp).toBe(0)
    expect(next.specializations.trading.lifetimeXp).toBe(900)
  })
})

describe('Career save migration', () => {
  it('migrates v34 once without fabricating XP history or changing assets', () => {
    const item = makeItem()
    const legacyState = {
      ...structuredClone(defaultGameState),
      career: undefined,
      money: 12_345.67,
      inventory: [item],
      collectionBook: [{
        skinId: item.id,
        foundWearConditions: [item.wear],
        timesFound: 1,
        firstFoundAt: item.discoveredAt,
      }],
      achievements: [{ id: 'first_case_opened', isClaimed: true, unlockedAt: 1_500 }],
      lastSaved: 4_000,
    }
    const loaded = parseGameSaveText(JSON.stringify({
      version: 34,
      savedAt: 4_000,
      state: legacyState,
    }))

    expect(loaded.money).toBe(12_345.67)
    expect(loaded.inventory[0]).toMatchObject({
      instanceId: item.instanceId,
      paintSeed: 661,
      pattern: item.pattern,
    })
    expect(loaded.career.migration.legacyBaselineApplied).toBe(true)
    expect(loaded.career.migration.legacyBaselineXp).toBeGreaterThan(0)
    expect(loaded.career.recentEvents).toEqual([])
    expect(loaded.career.legacyAchievementIds).toContain('first_case_opened')
  })
})
