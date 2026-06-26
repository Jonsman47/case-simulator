import { useMemo } from 'react'
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  getAchievementProgress,
} from '../data/achievements'
import type { AchievementCategory } from '../data/models'
import { useGame } from './useGame'

export function useAchievements() {
  const { claimAchievementReward, state } = useGame()
  const groupedAchievements = useMemo(() => {
    return ACHIEVEMENT_CATEGORIES.reduce(
      (groups, category) => {
        groups[category] = ACHIEVEMENTS.filter((achievement) => achievement.category === category)
        return groups
      },
      {} as Record<AchievementCategory, typeof ACHIEVEMENTS>,
    )
  }, [])
  const unlockedCount = state.achievements.length
  const claimableCount = ACHIEVEMENTS.filter((achievement) => {
    const progress = getAchievementProgress(state.achievements, achievement.id)

    return Boolean(progress && !progress.isClaimed && achievement.reward)
  }).length

  return {
    achievements: ACHIEVEMENTS,
    categories: ACHIEVEMENT_CATEGORIES,
    claimAchievementReward,
    claimableCount,
    getProgress: (achievementId: string) => getAchievementProgress(state.achievements, achievementId),
    groupedAchievements,
    unlockedCount,
  }
}
