import { describe, expect, it } from 'vitest'
import { DailyChallengeType, Rarity, type DailyChallenge } from '../data/models'
import {
  applyDailyChallengeProgress,
  applyDailyCaseDiscountToCase,
  addOpeningCredits,
  createDefaultDailyRewardsState,
  getLocalDayKey,
  getNextDailyRewardInfo,
  getOpeningCreditQuote,
  getPreviousLocalDayKey,
  refreshDailyRewardsState,
} from './dailyRewards'
import { CASE_DEFINITIONS } from '../data/cases'

function makeChallenge(overrides: Partial<DailyChallenge> = {}): DailyChallenge {
  return {
    id: 'challenge-1',
    type: DailyChallengeType.OpenCases,
    title: 'Open cases',
    description: 'Open cases today.',
    target: 10,
    progress: 0,
    reward: { money: 5 },
    isClaimed: false,
    generatedAt: new Date(2026, 5, 24, 12).getTime(),
    ...overrides,
  }
}

describe('daily rewards helpers', () => {
  it('uses local day keys to continue or reset streaks', () => {
    const now = new Date(2026, 5, 24, 12).getTime()
    const todayKey = getLocalDayKey(now)
    const yesterdayKey = getPreviousLocalDayKey(now)

    expect(getNextDailyRewardInfo(createDefaultDailyRewardsState(now), now)).toMatchObject({
      alreadyClaimedToday: false,
      nextStreak: 1,
      todayKey,
    })

    expect(getNextDailyRewardInfo({
      ...createDefaultDailyRewardsState(now),
      streak: 3,
      lastClaimDayKey: todayKey,
    }, now)).toMatchObject({
      alreadyClaimedToday: true,
      nextStreak: 3,
    })

    expect(getNextDailyRewardInfo({
      ...createDefaultDailyRewardsState(now),
      streak: 3,
      lastClaimDayKey: yesterdayKey,
    }, now).nextStreak).toBe(4)

    expect(getNextDailyRewardInfo({
      ...createDefaultDailyRewardsState(now),
      streak: 3,
      lastClaimDayKey: '2026-06-20',
    }, now).nextStreak).toBe(1)
  })

  it('refreshes challenges and free rerolls at the next local day boundary', () => {
    const yesterday = new Date(2026, 5, 23, 12).getTime()
    const today = new Date(2026, 5, 24, 9).getTime()
    const yesterdayState = {
      ...createDefaultDailyRewardsState(yesterday),
      freeRerollsUsed: 1,
    }

    const refreshed = refreshDailyRewardsState(yesterdayState, today)

    expect(refreshed.lastChallengeResetDayKey).toBe(getLocalDayKey(today))
    expect(refreshed.freeRerollsUsed).toBe(0)
    expect(refreshed.challenges).toHaveLength(4)
    expect(refreshed.challenges[0]?.id).not.toBe(yesterdayState.challenges[0]?.id)
  })

  it('does not regenerate rewards or claims when the local clock moves backward', () => {
    const future = new Date(2026, 5, 25, 12).getTime()
    const past = new Date(2026, 5, 24, 12).getTime()
    const futureState = {
      ...createDefaultDailyRewardsState(future),
      streak: 4,
      lastClaimDayKey: getLocalDayKey(future),
      freeRerollsUsed: 1,
    }

    const refreshed = refreshDailyRewardsState(futureState, past)
    expect(refreshed.lastChallengeResetDayKey).toBe(getLocalDayKey(future))
    expect(refreshed.challenges.map((challenge) => challenge.id)).toEqual(
      futureState.challenges.map((challenge) => challenge.id),
    )
    expect(refreshed.freeRerollsUsed).toBe(1)
    expect(getNextDailyRewardInfo(refreshed, past).alreadyClaimedToday).toBe(true)
  })

  it('tracks challenge progress by objective type without exceeding targets', () => {
    const challenges = [
      makeChallenge({ id: 'open', type: DailyChallengeType.OpenCases, target: 10 }),
      makeChallenge({ id: 'sell', type: DailyChallengeType.SellValue, target: 100 }),
      makeChallenge({
        id: 'rarity',
        type: DailyChallengeType.ObtainRarity,
        target: 1,
        rarity: Rarity.Classified,
      }),
    ]

    const opened = applyDailyChallengeProgress(challenges, { type: 'cases_opened', amount: 12 })
    const sold = applyDailyChallengeProgress(opened, { type: 'sell_value', amount: 33.33 })
    const rarity = applyDailyChallengeProgress(sold, {
      type: 'rarity_obtained',
      rarity: Rarity.Classified,
    })

    expect(rarity.find((challenge) => challenge.id === 'open')?.progress).toBe(10)
    expect(rarity.find((challenge) => challenge.id === 'sell')?.progress).toBe(33.33)
    expect(rarity.find((challenge) => challenge.id === 'rarity')?.progress).toBe(1)
  })

  it('counts distinct cases, discoveries, and sessions exactly once', () => {
    const challenges = [
      makeChallenge({ type: DailyChallengeType.OpenDifferentCases, target: 2 }),
      makeChallenge({ id: 'discover', type: DailyChallengeType.DiscoverSkins, target: 3 }),
      makeChallenge({ id: 'session', type: DailyChallengeType.CompleteOpeningSessions, target: 2 }),
    ]
    const first = applyDailyChallengeProgress(challenges, { type: 'cases_opened', amount: 5, caseId: 'case-a' })
    const duplicate = applyDailyChallengeProgress(first, { type: 'cases_opened', amount: 3, caseId: 'case-a' })
    const discovered = applyDailyChallengeProgress(duplicate, { type: 'skins_discovered', skinIds: ['a', 'b', 'a'] })
    const session = applyDailyChallengeProgress(discovered, { type: 'opening_session', sessionId: 'session-a' })
    const replayed = applyDailyChallengeProgress(session, { type: 'opening_session', sessionId: 'session-a' })

    expect(replayed[0].progress).toBe(1)
    expect(replayed[1].progress).toBe(2)
    expect(replayed[2].progress).toBe(1)
  })

  it('caps case-only funds and spends them before wallet cash at any case price', () => {
    expect(addOpeningCredits(19, 5)).toBe(20)
    expect(getOpeningCreditQuote(4, 10, 2)).toEqual({
      eligible: true,
      fullCost: 8,
      creditUsed: 8,
      cashCost: 0,
    })
    expect(getOpeningCreditQuote(6, 2, 1)).toEqual({ eligible: true, fullCost: 6, creditUsed: 2, cashCost: 4 })
    expect(getOpeningCreditQuote(6, 0, 1)).toEqual({ eligible: false, fullCost: 6, creditUsed: 0, cashCost: 6 })
  })

  it('applies active daily case discounts and drops expired discounts', () => {
    const now = new Date(2026, 5, 24, 12).getTime()
    const starterCase = CASE_DEFINITIONS[0]

    expect(applyDailyCaseDiscountToCase(starterCase, {
      ...createDefaultDailyRewardsState(now),
      caseDiscountBuff: {
        percent: 0.1,
        expiresAt: now + 60_000,
      },
    }, now).cost).toBe(0.18)

    expect(applyDailyCaseDiscountToCase(starterCase, {
      ...createDefaultDailyRewardsState(now),
      caseDiscountBuff: {
        percent: 0.1,
        expiresAt: now - 1,
      },
    }, now).cost).toBe(starterCase.cost)
  })
})
