import { ArrowUpDown, BriefcaseBusiness, Check, Crosshair, Gift, Library, Lock, Medal, PackageCheck, TrendingUp, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAchievements } from '../hooks/useAchievements'
import { useGame } from '../hooks/useGame'
import type { Achievement, AchievementDisplayCategory } from '../data/models'
import { formatCurrency } from '../utils/format'
import { getAchievementCareerXp } from '../career/careerProgress'
import {
  getAchievementBlockedReason,
  getAchievementProgressValue,
  getAchievementScope,
} from '../data/achievements'

const categoryAccentClasses: Record<AchievementDisplayCategory, string> = {
  'Case Opening': 'border-rarity-mil-spec text-rarity-mil-spec',
  Trading: 'border-cs-green text-cs-green',
  Collecting: 'border-rarity-classified text-rarity-classified',
  'Trade-Ups': 'border-rarity-restricted text-rarity-restricted',
  Business: 'border-rarity-industrial text-rarity-industrial',
  'Career & Prestige': 'border-rarity-special text-rarity-special',
}

const categoryIcons: Record<AchievementDisplayCategory, LucideIcon> = {
  'Case Opening': Crosshair,
  Trading: TrendingUp,
  Collecting: Library,
  'Trade-Ups': ArrowUpDown,
  Business: BriefcaseBusiness,
  'Career & Prestige': Medal,
}

function formatReward(achievement: Achievement, careerXp = 0) {
  const reward = achievement.reward

  return [
    (reward?.money || reward?.upgradePoints || reward?.skillPoints)
      ? `${formatCurrency((reward?.money ?? 0) + (reward?.upgradePoints ?? 0) * 100 + (reward?.skillPoints ?? 0) * 50)} cash${reward?.upgradePoints || reward?.skillPoints ? ' (includes legacy point conversion)' : ''}`
      : undefined,
    reward?.badge ? `${reward.badge} badge` : undefined,
    careerXp > 0 ? `${careerXp} Career XP` : undefined,
    !reward && careerXp <= 0 ? 'Cosmetic record' : undefined,
  ]
    .filter(Boolean)
    .join(' / ')
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}

export function Achievements() {
  const { state } = useGame()
  const {
    achievements,
    categories,
    claimAchievementReward,
    claimAllAchievementRewards,
    claimableCount,
    getProgress,
    groupedAchievements,
  } = useAchievements()
  const [claimSummary, setClaimSummary] = useState<string>()
  const [filter, setFilter] = useState<'all' | 'available' | 'inProgress' | 'completed' | 'claimable' | 'lifetime' | 'currentRun'>('all')
  const visibleAchievements = useMemo(() => achievements.filter((achievement) => {
    const progress = getProgress(achievement.id)
    if (achievement.isRetired && !progress) return false
    const value = getAchievementProgressValue(achievement, state)
    const target = achievement.target ?? 1
    if (filter === 'available') return !progress && !achievement.isHidden && !achievement.isRetired
    if (filter === 'inProgress') return !progress && value > 0 && value < target
    if (filter === 'completed') return Boolean(progress)
    if (filter === 'claimable') return Boolean(progress && !progress.isClaimed && achievement.reward)
    if (filter === 'lifetime') return getAchievementScope(achievement) === 'lifetime'
    if (filter === 'currentRun') return getAchievementScope(achievement) === 'currentRun'
    return true
  }), [achievements, filter, getProgress, state])
  const visibleByCategory = useMemo(() => Object.fromEntries(categories.map((category) => [
    category,
    groupedAchievements[category].filter((achievement) => visibleAchievements.includes(achievement)),
  ])) as typeof groupedAchievements, [categories, groupedAchievements, visibleAchievements])
  const claimableSummary = useMemo(() => achievements.reduce((summary, achievement) => {
    const progress = getProgress(achievement.id)
    if (!progress || progress.isClaimed || !achievement.reward) return summary
    summary.money += achievement.reward.money ?? 0
    summary.money += (achievement.reward.skillPoints ?? 0) * 50 + (achievement.reward.upgradePoints ?? 0) * 100
    summary.badges += achievement.reward.badge ? 1 : 0
    if (!state.career.legacyAchievementIds.includes(achievement.id)) {
      summary.careerXp += getAchievementCareerXp(achievement.id)
    }
    return summary
  }, { badges: 0, careerXp: 0, money: 0 }), [achievements, getProgress, state.career.legacyAchievementIds])
  const activeAchievementCount = achievements.filter((achievement) => !achievement.isRetired).length
  const activeUnlockedCount = achievements.filter((achievement) => !achievement.isRetired && getProgress(achievement.id)).length
  const completion = activeAchievementCount > 0 ? Math.round((activeUnlockedCount / activeAchievementCount) * 100) : 0

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-3 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="border-l-4 border-rarity-special pl-4">
          <p className="font-mono text-xs uppercase text-rarity-special">Milestones</p>
          <h2 className="mt-1 text-2xl font-semibold text-cs-text sm:text-3xl">Achievements</h2>
          <p className="mt-2 max-w-2xl text-sm text-cs-muted">
            Lifetime accomplishments and bounded Current Run goals across the complete trading career.
          </p>
        </div>
        <div className="content-card-grid grid gap-2 border border-cs-border bg-cs-panel p-2 sm:grid-cols-5">
          <SummaryPill label="Completed" value={`${activeUnlockedCount}/${activeAchievementCount}`} />
          <SummaryPill label="Complete" value={`${completion}%`} />
          <SummaryPill label="Claimable" value={String(claimableCount)} />
          <SummaryPill label="Lifetime" value={String(achievements.filter((achievement) => getAchievementScope(achievement) === 'lifetime' && getProgress(achievement.id)).length)} />
          <SummaryPill label="Current Run" value={String(achievements.filter((achievement) => getAchievementScope(achievement) === 'currentRun' && getProgress(achievement.id)).length)} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-cs-border bg-cs-panel p-3">
        <div>
          <p className="font-mono text-[10px] uppercase text-cs-muted">Ready rewards</p>
          <p aria-live="polite" className="mt-1 text-sm text-cs-text">{claimSummary ?? (claimableCount > 0 ? `${claimableCount} achievement rewards can be claimed together.` : 'Everything currently unlocked has been claimed.')}</p>
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 border border-rarity-special bg-rarity-special/10 px-4 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20 disabled:cursor-not-allowed disabled:border-cs-border disabled:bg-transparent disabled:text-cs-muted"
          disabled={claimableCount === 0}
          onClick={() => {
            const parts = [
              claimableSummary.money ? formatCurrency(claimableSummary.money) : '',
              claimableSummary.badges ? `${claimableSummary.badges} badges` : '',
              claimableSummary.careerXp ? `${claimableSummary.careerXp} Career XP` : '',
            ].filter(Boolean)
            claimAllAchievementRewards()
            setClaimSummary(`Claimed ${claimableCount} rewards: ${parts.join(', ')}.`)
          }}
          type="button"
        >
          <PackageCheck size={17} />
          Claim All ({claimableCount})
        </button>
      </div>

      <div className="mt-5 h-3 border border-cs-border bg-cs-panel">
        <div className="h-full bg-rarity-special" style={{ width: `${completion}%` }} />
      </div>

      <div aria-label="Achievement filters" className="mt-4 flex flex-wrap gap-2">
        {([
          ['all', 'All'],
          ['available', 'Available'],
          ['inProgress', 'In Progress'],
          ['completed', 'Completed'],
          ['claimable', 'Claimable'],
          ['lifetime', 'Lifetime'],
          ['currentRun', 'Current Run'],
        ] as const).map(([value, label]) => (
          <button
            aria-pressed={filter === value}
            className={[
              'min-h-10 border px-3 py-2 text-xs font-semibold transition-colors',
              filter === value
                ? 'border-rarity-special bg-rarity-special/10 text-rarity-special'
                : 'border-cs-border bg-cs-panel text-cs-muted hover:text-cs-text',
            ].join(' ')}
            key={value}
            onClick={() => setFilter(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-5">
        {categories.map((category) => {
          const CategoryIcon = categoryIcons[category]
          const categoryAchievements = visibleByCategory[category]
          if (categoryAchievements.length === 0) return null
          const unlockedInCategory = categoryAchievements.filter((achievement) =>
            getProgress(achievement.id),
          ).length

          return (
            <section key={category}>
              <div className={`flex items-center gap-2 border-l-4 pl-3 ${categoryAccentClasses[category]}`}>
                <CategoryIcon size={16} />
                <h3 className="text-lg font-semibold text-cs-text">{category}</h3>
                <span className="font-mono text-xs uppercase text-cs-muted">
                  {unlockedInCategory}/{categoryAchievements.length}
                </span>
              </div>

              <div className="content-card-grid mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {categoryAchievements.map((achievement) => {
                  const progress = getProgress(achievement.id)
                  const isUnlocked = Boolean(progress)
                  const isClaimable = Boolean(progress && !progress.isClaimed && achievement.reward)
                  const scope = getAchievementScope(achievement)
                  const progressValue = getAchievementProgressValue(achievement, state)
                  const target = achievement.target ?? 1
                  const progressPercent = Math.min(100, Math.max(0, progressValue / Math.max(0.000001, target) * 100))
                  const blockedReason = !isUnlocked ? getAchievementBlockedReason(achievement, state) : undefined
                  const displayName = achievement.isHidden && !isUnlocked
                    ? 'Hidden Achievement'
                    : achievement.name
                  const displayDescription = achievement.isHidden && !isUnlocked
                    ? 'Keep playing to reveal this surprise milestone.'
                    : achievement.description
                  const displayReward = achievement.isHidden && !isUnlocked
                    ? 'Hidden reward'
                    : formatReward(
                        achievement,
                        state.career.legacyAchievementIds.includes(achievement.id)
                          ? 0
                          : getAchievementCareerXp(achievement.id),
                      )

                  return (
                    <article
                      data-layout-card="true"
                      className={[
                        'border bg-cs-panel p-3',
                        isUnlocked ? categoryAccentClasses[category] : 'border-cs-border text-cs-muted',
                      ].join(' ')}
                      key={achievement.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] uppercase text-cs-muted">
                            {achievement.isRetired ? 'Legacy record' : scope === 'currentRun' ? 'Current Run' : 'Lifetime'}
                          </p>
                          <h4 className="mt-1 text-lg font-semibold text-cs-text">
                            {displayName}
                          </h4>
                        </div>
                        <div className="grid h-8 w-8 shrink-0 place-items-center border border-current bg-cs-surface">
                          {isUnlocked ? <Check size={16} /> : <Lock size={16} />}
                        </div>
                      </div>

                      <p className="mt-2 min-h-10 text-sm text-cs-muted">{displayDescription}</p>
                      {!achievement.isHidden || isUnlocked ? (
                        <div className="mt-3">
                          <div className="flex justify-between gap-3 font-mono text-[10px] uppercase text-cs-muted">
                            <span>{isUnlocked ? 'Completed' : progressValue > 0 ? 'In progress' : 'Available'}</span>
                            <span>{Math.min(progressValue, target).toLocaleString()} / {target.toLocaleString()}</span>
                          </div>
                          <div className="mt-1 h-2 border border-cs-border bg-cs-surface">
                            <div className="h-full bg-current" style={{ width: `${isUnlocked ? 100 : progressPercent}%` }} />
                          </div>
                          {blockedReason ? <p className="mt-2 text-xs text-cs-muted">{blockedReason}</p> : null}
                        </div>
                      ) : null}
                      <div className="mt-3 border border-cs-border bg-cs-surface p-2">
                        <div className="flex items-center gap-2">
                          <Gift size={15} />
                          <p className="font-mono text-[10px] uppercase text-cs-muted">Reward</p>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-cs-text">
                          {displayReward}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-cs-muted">
                          {progress ? formatDate(progress.unlockedAt) : 'Hidden until completed'}
                        </p>
                        {progress?.isClaimed ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase text-cs-green">
                            <Medal size={13} />
                            Claimed
                          </span>
                        ) : achievement.reward ? (
                          <button
                            className="inline-flex items-center gap-2 border border-rarity-special bg-rarity-special/10 px-3 py-2 text-xs font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20 disabled:cursor-not-allowed disabled:border-cs-border disabled:bg-transparent disabled:text-cs-muted"
                            disabled={!isClaimable}
                            onClick={() => claimAchievementReward(achievement.id)}
                            type="button"
                          >
                            <Gift size={14} />
                            Claim
                          </button>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-cs-border bg-cs-surface px-3 py-2">
      <p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-cs-text">{value}</p>
    </div>
  )
}
