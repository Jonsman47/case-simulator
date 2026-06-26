import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS } from './achievements'

describe('achievement catalog', () => {
  it('contains a long-term milestone catalog with hidden surprises', () => {
    const achievementIds = new Set(ACHIEVEMENTS.map((achievement) => achievement.id))
    const hiddenAchievements = ACHIEVEMENTS.filter((achievement) => achievement.isHidden)

    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(80)
    expect(achievementIds.size).toBe(ACHIEVEMENTS.length)
    expect(hiddenAchievements.length).toBeGreaterThanOrEqual(5)
  })
})
