import { describe, expect, it } from 'vitest'
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_DISPLAY_CATEGORIES,
  getAchievementScope,
  getNewAchievementUnlocks,
  getObtainableWearVariantCount,
} from './achievements'
import { SKIN_DEFINITIONS } from './skins'
import { defaultGameState } from './gameState'
import { Rarity, WearCondition, type SkinBase } from './models'
import { getPossibleWearFloatRangesForSkin } from '../utils/wear'

describe('achievement catalog', () => {
  it('contains a long-term milestone catalog with hidden surprises', () => {
    const achievementIds = new Set(ACHIEVEMENTS.map((achievement) => achievement.id))
    const hiddenAchievements = ACHIEVEMENTS.filter((achievement) => achievement.isHidden)

    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(80)
    expect(achievementIds.size).toBe(ACHIEVEMENTS.length)
    expect(hiddenAchievements.length).toBeGreaterThanOrEqual(5)
  })

  it('uses the six integrated categories and explicit bounded run challenges', () => {
    expect(ACHIEVEMENT_DISPLAY_CATEGORIES).toEqual([
      'Case Opening',
      'Trading',
      'Collecting',
      'Trade-Ups',
      'Business',
      'Career & Prestige',
    ])
    const runAchievements = ACHIEVEMENTS.filter((achievement) => getAchievementScope(achievement) === 'currentRun')
    expect(runAchievements.length).toBeGreaterThanOrEqual(5)
    expect(runAchievements.every((achievement) => achievement.target && achievement.reward)).toBe(true)
  })

  it('counts only wear variants allowed by each skin float range', () => {
    const obtainable = getObtainableWearVariantCount()
    expect(obtainable).toBeGreaterThan(SKIN_DEFINITIONS.length)
    expect(obtainable).toBeLessThanOrEqual(SKIN_DEFINITIONS.length * 5)

    const restrictedSkin: SkinBase = {
      id: 'restricted-test-skin',
      weapon: 'Test',
      finish: 'Restricted',
      rarity: Rarity.Covert,
      baseValue: 1,
      caseIds: [],
      image: '',
      minFloat: 0,
      maxFloat: 0.08,
    }
    const possibleWear = Object.keys(getPossibleWearFloatRangesForSkin(restrictedSkin))
    expect(possibleWear).toEqual([WearCondition.FactoryNew, WearCondition.MinimalWear])
  })

  it('keeps retired legacy definitions non-obtainable for claim-history compatibility', () => {
    const retired = ACHIEVEMENTS.filter((achievement) => achievement.isRetired)
    expect(retired.length).toBeGreaterThan(0)
    expect(retired.every((achievement) => achievement.getBlockedReason)).toBe(true)
  })

  it('keys Current Run completion to the active Career run', () => {
    const state = {
      ...defaultGameState,
      statistics: { ...defaultGameState.statistics, casesOpened: 250 },
    }
    const unlocks = getNewAchievementUnlocks(state, 123)
    expect(unlocks.progress).toContainEqual(expect.objectContaining({
      id: 'run_cases_250',
      scope: 'currentRun',
      runId: state.career.runId,
      unlockedAt: 123,
    }))
  })
})
