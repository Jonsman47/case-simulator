import { Check, Gift, Lock, Medal, Trophy } from 'lucide-react'
import { useAchievements } from '../hooks/useAchievements'
import { useGame } from '../hooks/useGame'
import type { Achievement, AchievementCategory } from '../data/models'
import { formatCurrency } from '../utils/format'

const categoryAccentClasses: Record<AchievementCategory, string> = {
  Opening: 'border-rarity-mil-spec text-rarity-mil-spec',
  Drops: 'border-rarity-covert text-rarity-covert',
  Inventory: 'border-cs-green text-cs-green',
  'Trade Ups': 'border-rarity-restricted text-rarity-restricted',
  Progression: 'border-rarity-special text-rarity-special',
  Collection: 'border-rarity-classified text-rarity-classified',
  Automation: 'border-rarity-industrial text-rarity-industrial',
  'Trophy Room': 'border-rarity-contraband text-rarity-contraband',
}

function formatReward(achievement: Achievement) {
  const reward = achievement.reward

  if (!reward) {
    return 'Cosmetic record'
  }

  return [
    reward.money ? formatCurrency(reward.money) : undefined,
    reward.upgradePoints ? `${reward.upgradePoints} upgrade point${reward.upgradePoints === 1 ? '' : 's'}` : undefined,
    reward.skillPoints ? `${reward.skillPoints} skill point${reward.skillPoints === 1 ? '' : 's'}` : undefined,
    reward.badge ? `${reward.badge} badge` : undefined,
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
    claimableCount,
    getProgress,
    groupedAchievements,
    unlockedCount,
  } = useAchievements()
  const completion = achievements.length > 0 ? Math.round((unlockedCount / achievements.length) * 100) : 0

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-3 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="border-l-4 border-rarity-special pl-4">
          <p className="font-mono text-xs uppercase text-rarity-special">Milestones</p>
          <h2 className="mt-1 text-2xl font-semibold text-cs-text sm:text-3xl">Achievements</h2>
          <p className="mt-2 max-w-2xl text-sm text-cs-muted">
            Track collection, opening, trade-up, automation, and prestige milestones.
          </p>
        </div>
        <div className="grid gap-2 border border-cs-border bg-cs-panel p-2 sm:grid-cols-5">
          <SummaryPill label="Unlocked" value={`${unlockedCount}/${achievements.length}`} />
          <SummaryPill label="Complete" value={`${completion}%`} />
          <SummaryPill label="Claimable" value={String(claimableCount)} />
          <SummaryPill label="Upgrade Points" value={String(state.upgradePoints)} />
          <SummaryPill label="Skill Points" value={String(state.skillPoints)} />
        </div>
      </div>

      <div className="mt-5 h-3 border border-cs-border bg-cs-panel">
        <div className="h-full bg-rarity-special" style={{ width: `${completion}%` }} />
      </div>

      <div className="mt-4 space-y-5">
        {categories.map((category) => {
          const categoryAchievements = groupedAchievements[category]
          const unlockedInCategory = categoryAchievements.filter((achievement) =>
            getProgress(achievement.id),
          ).length

          return (
            <section key={category}>
              <div className={`flex items-center gap-2 border-l-4 pl-3 ${categoryAccentClasses[category]}`}>
                <Trophy size={16} />
                <h3 className="text-lg font-semibold text-cs-text">{category}</h3>
                <span className="font-mono text-xs uppercase text-cs-muted">
                  {unlockedInCategory}/{categoryAchievements.length}
                </span>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {categoryAchievements.map((achievement) => {
                  const progress = getProgress(achievement.id)
                  const isUnlocked = Boolean(progress)
                  const isClaimable = Boolean(progress && !progress.isClaimed && achievement.reward)
                  const displayName = achievement.isHidden && !isUnlocked
                    ? 'Hidden Achievement'
                    : achievement.name
                  const displayDescription = achievement.isHidden && !isUnlocked
                    ? 'Keep playing to reveal this surprise milestone.'
                    : achievement.description
                  const displayReward = achievement.isHidden && !isUnlocked
                    ? 'Hidden reward'
                    : formatReward(achievement)

                  return (
                    <article
                      className={[
                        'border bg-cs-panel p-3',
                        isUnlocked ? categoryAccentClasses[category] : 'border-cs-border text-cs-muted',
                      ].join(' ')}
                      key={achievement.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] uppercase text-cs-muted">
                            {isUnlocked ? 'Unlocked' : 'Locked'}
                          </p>
                          <h4 className="mt-1 text-lg font-semibold text-cs-text">
                            {displayName}
                          </h4>
                        </div>
                        <div className="grid h-8 w-8 shrink-0 place-items-center border border-current bg-cs-surface">
                          {isUnlocked ? <Check size={16} /> : <Lock size={16} />}
                        </div>
                      </div>

                      <p className="mt-2 line-clamp-2 min-h-10 text-sm text-cs-muted">{displayDescription}</p>
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
