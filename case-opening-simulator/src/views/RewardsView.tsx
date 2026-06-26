import {
  CalendarDays,
  Check,
  Coins,
  Gift,
  RefreshCw,
  Sparkles,
  Target,
  Ticket,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  DAILY_FREE_REROLLS,
  DAILY_REWARD_SEQUENCE,
  getNextDailyRewardInfo,
  getNextLocalResetTime,
} from '../rewards/dailyRewards'
import { DailyChallengeType, DailyRewardKind, type DailyChallenge, type DailyRewardDefinition } from '../data/models'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'
import { getRarityLabel } from '../utils/itemLabels'

function formatCountdown(ms: number) {
  const safeMs = Math.max(0, ms)
  const hours = Math.floor(safeMs / 3_600_000)
  const minutes = Math.floor((safeMs % 3_600_000) / 60_000)
  const seconds = Math.floor((safeMs % 60_000) / 1_000)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatDailyReward(reward: DailyRewardDefinition) {
  if (reward.kind === DailyRewardKind.Money) {
    return formatCurrency(reward.money ?? 0)
  }

  if (reward.kind === DailyRewardKind.CaseDiscountBuff) {
    return `${Math.round((reward.caseDiscountPercent ?? 0) * 100)}% case discount`
  }

  if (reward.kind === DailyRewardKind.RandomSkin) {
    return reward.skinRarity ? `Random ${getRarityLabel(reward.skinRarity)} skin` : 'Random skin'
  }

  return 'Rare case access'
}

function formatChallengeReward(challenge: DailyChallenge) {
  const reward = challenge.reward

  return [
    reward.money ? formatCurrency(reward.money) : undefined,
    reward.caseDiscountPercent ? `${Math.round(reward.caseDiscountPercent * 100)}% case discount` : undefined,
  ]
    .filter(Boolean)
    .join(' / ')
}

function formatChallengeProgress(challenge: DailyChallenge) {
  if (challenge.type === DailyChallengeType.SellValue) {
    return `${formatCurrency(challenge.progress)} / ${formatCurrency(challenge.target)}`
  }

  return `${Math.floor(challenge.progress)} / ${challenge.target}`
}

function formatChallengeKind(challenge: DailyChallenge) {
  if (challenge.type === DailyChallengeType.OpenCases) {
    return 'Opening'
  }

  if (challenge.type === DailyChallengeType.SellValue) {
    return 'Selling'
  }

  if (challenge.type === DailyChallengeType.ObtainRarity) {
    return challenge.rarity ? `Find ${getRarityLabel(challenge.rarity)}` : 'Find rarity'
  }

  return 'Trade ups'
}

export function RewardsView() {
  const {
    claimDailyChallenge,
    claimDailyReward,
    refreshDailyRewards,
    rerollDailyChallenge,
    state,
  } = useGame()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    refreshDailyRewards()

    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [refreshDailyRewards])

  const rewardInfo = useMemo(() => {
    return getNextDailyRewardInfo(state.dailyRewards, now)
  }, [now, state.dailyRewards])
  const nextResetAt = getNextLocalResetTime(now)
  const rerollsRemaining = Math.max(0, DAILY_FREE_REROLLS - state.dailyRewards.freeRerollsUsed)
  const activeDiscount = state.dailyRewards.caseDiscountBuff?.expiresAt
    ? state.dailyRewards.caseDiscountBuff
    : undefined

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-5 sm:p-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="border-l-4 border-rarity-special pl-4">
          <p className="font-mono text-xs uppercase text-rarity-special">Daily Circuit</p>
          <h2 className="mt-1 text-3xl font-semibold text-cs-text sm:text-4xl">Rewards</h2>
          <p className="mt-2 max-w-2xl text-sm text-cs-muted">
            Claim a daily streak reward, clear today&apos;s tasks, and build your bankroll.
          </p>
        </div>
        <div className="grid gap-2 border border-cs-border bg-cs-panel p-3 sm:grid-cols-3">
          <SummaryPill label="Streak" value={`${state.dailyRewards.streak} day${state.dailyRewards.streak === 1 ? '' : 's'}`} />
          <SummaryPill label="Reset" value={formatCountdown(nextResetAt - now)} />
          <SummaryPill label="Rerolls" value={`${rerollsRemaining}/${DAILY_FREE_REROLLS}`} />
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[22rem_1fr]">
        <section className="border border-cs-border bg-cs-panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase text-cs-amber">Next Claim</p>
              <h3 className="mt-1 text-2xl font-semibold text-cs-text">
                Day {rewardInfo.nextStreak}
              </h3>
              <p className="mt-2 text-sm text-cs-muted">{formatDailyReward(rewardInfo.reward)}</p>
            </div>
            <div className="grid h-11 w-11 place-items-center border border-rarity-special bg-rarity-special/10 text-rarity-special">
              <Gift size={20} />
            </div>
          </div>

          <button
            className="mt-5 inline-flex w-full items-center justify-center gap-2 border border-rarity-special bg-rarity-special/10 px-4 py-3 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20 disabled:cursor-not-allowed disabled:border-cs-border disabled:bg-transparent disabled:text-cs-muted"
            disabled={rewardInfo.alreadyClaimedToday}
            onClick={claimDailyReward}
            type="button"
          >
            {rewardInfo.alreadyClaimedToday ? <Check size={17} /> : <Gift size={17} />}
            {rewardInfo.alreadyClaimedToday ? 'Claimed Today' : 'Claim Daily Reward'}
          </button>

          {activeDiscount && activeDiscount.expiresAt > now ? (
            <div
              className="mt-4 border border-cs-green bg-cs-green/10 p-3"
              title="Case costs are discounted until this buff expires."
            >
              <div className="flex items-center gap-2 text-cs-green">
                <Ticket size={16} />
                <p className="font-mono text-xs uppercase">Active Discount</p>
              </div>
              <p className="mt-1 text-sm text-cs-text">
                {Math.round(activeDiscount.percent * 100)}% off cases for{' '}
                {formatCountdown(activeDiscount.expiresAt - now)}
              </p>
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-7 gap-2">
            {DAILY_REWARD_SEQUENCE.map((reward) => {
              const isNext = reward.day === rewardInfo.reward.day

              return (
                <div
                  className={[
                    'border p-2 text-center',
                    isNext ? 'border-rarity-special bg-rarity-special/10' : 'border-cs-border bg-cs-surface',
                  ].join(' ')}
                  key={reward.day}
                  title={formatDailyReward(reward)}
                >
                  <p className="font-mono text-[10px] uppercase text-cs-muted">Day</p>
                  <p className={isNext ? 'text-lg font-semibold text-rarity-special' : 'text-lg font-semibold text-cs-text'}>
                    {reward.day}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="border border-cs-border bg-cs-panel p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-xs uppercase text-cs-amber">Challenge Board</p>
              <h3 className="mt-1 text-2xl font-semibold text-cs-text">Today&apos;s Tasks</h3>
            </div>
            <div className="inline-flex items-center gap-2 border border-cs-border bg-cs-surface px-3 py-2 text-sm text-cs-muted">
              <CalendarDays size={16} />
              New tasks in {formatCountdown(nextResetAt - now)}
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {state.dailyRewards.challenges.map((challenge) => {
              const progressPercent = Math.min(100, (challenge.progress / challenge.target) * 100)
              const canClaim = !challenge.isClaimed && challenge.progress >= challenge.target
              const canReroll = !challenge.isClaimed && rerollsRemaining > 0

              return (
                <article className="border border-cs-border bg-cs-surface p-4" key={challenge.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 text-rarity-special">
                        <Target size={15} />
                        <p className="font-mono text-[10px] uppercase">{formatChallengeKind(challenge)}</p>
                      </div>
                      <h4 className="mt-1 text-lg font-semibold text-cs-text">{challenge.title}</h4>
                    </div>
                    {challenge.isClaimed ? (
                      <span className="inline-flex shrink-0 items-center gap-1 border border-cs-green bg-cs-green/10 px-2 py-1 font-mono text-[10px] uppercase text-cs-green">
                        <Check size={13} />
                        Claimed
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 min-h-10 text-sm text-cs-muted">{challenge.description}</p>
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-mono uppercase text-cs-muted">Progress</span>
                      <span className="font-semibold text-cs-text">{formatChallengeProgress(challenge)}</span>
                    </div>
                    <div className="mt-2 h-3 border border-cs-border bg-cs-panel">
                      <div className="h-full bg-rarity-special" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="border border-cs-border bg-cs-panel px-3 py-2">
                      <div className="flex items-center gap-2 text-cs-green">
                        <Coins size={15} />
                        <p className="font-mono text-[10px] uppercase">Reward</p>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-cs-text">
                        {formatChallengeReward(challenge) || 'Daily credit'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="inline-flex items-center gap-2 border border-cs-border bg-cs-panel px-3 py-2 text-xs font-semibold text-cs-muted transition-colors hover:border-cs-amber hover:text-cs-text disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!canReroll}
                        onClick={() => rerollDailyChallenge(challenge.id)}
                        title="Reroll one unclaimed challenge per day for free."
                        type="button"
                      >
                        <RefreshCw size={14} />
                        Reroll
                      </button>
                      <button
                        className="inline-flex items-center gap-2 border border-cs-green bg-cs-green/10 px-3 py-2 text-xs font-semibold text-cs-green transition-colors hover:bg-cs-green/20 disabled:cursor-not-allowed disabled:border-cs-border disabled:bg-transparent disabled:text-cs-muted"
                        disabled={!canClaim}
                        onClick={() => claimDailyChallenge(challenge.id)}
                        type="button"
                      >
                        <Sparkles size={14} />
                        Claim
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
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
