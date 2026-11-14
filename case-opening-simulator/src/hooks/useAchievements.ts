import { useMemo } from 'react'
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_DISPLAY_CATEGORIES,
  getAchievementDisplayCategory,
  getAchievementProgress,
} from '../data/achievements'
import type { AchievementDisplayCategory } from '../data/models'
import { useGame } from './useGame'

export function useAchievements() {
  const { claimAchievementReward, claimAllAchievementRewards, state } = useGame()
  const groupedAchievements = useMemo(() => {
    return ACHIEVEMENT_DISPLAY_CATEGORIES.reduce(
      (groups, category) => {
        groups[category] = ACHIEVEMENTS.filter((achievement) => getAchievementDisplayCategory(achievement) === category)
        return groups
      },
      {} as Record<AchievementDisplayCategory, typeof ACHIEVEMENTS>,
    )
  }, [])
  const unlockedCount = state.achievements.length
  const claimableCount = ACHIEVEMENTS.filter((achievement) => {
    const progress = getAchievementProgress(state.achievements, achievement.id, state.career.runId)

    return Boolean(progress && !progress.isClaimed && achievement.reward)
  }).length

  return {
    achievements: ACHIEVEMENTS,
    categories: ACHIEVEMENT_DISPLAY_CATEGORIES,
    claimAchievementReward,
    claimAllAchievementRewards,
    claimableCount,
    getProgress: (achievementId: string) => getAchievementProgress(state.achievements, achievementId, state.career.runId),
    groupedAchievements,
    unlockedCount,
  }
}
