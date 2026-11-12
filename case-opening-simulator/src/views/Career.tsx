import {
  BadgeCheck,
  BriefcaseBusiness,
  Clock3,
  Gem,
  PackageOpen,
  Repeat2,
  Route,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import type { ComponentType } from 'react'
import {
  CAREER_RANKS,
  getCareerSnapshot,
  type CareerSpecializationId,
} from '../career/careerProgress'
import { useGame } from '../hooks/useGame'

const numberFormatter = new Intl.NumberFormat('en-US')

const specializationCards: Array<{
  id: CareerSpecializationId
  label: string
  description: string
  icon: ComponentType<{ className?: string; size?: number }>
}> = [
  {
    id: 'caseOpening',
    label: 'Case Opening',
    description: 'Paid openings and genuinely unusual discoveries.',
    icon: PackageOpen,
  },
  {
    id: 'trading',
    label: 'Trading',
    description: 'Ledger-backed realized results on CSWEAR.',
    icon: TrendingUp,
  },
  {
    id: 'collecting',
    label: 'Collecting',
    description: 'First skins, new wear variants, and special Patterns.',
    icon: Gem,
  },
  {
    id: 'tradeUps',
    label: 'Trade-Ups',
    description: 'Completed contracts with repeat-strategy protection.',
    icon: Repeat2,
  },
  {
    id: 'business',
    label: 'Business',
    description: 'Employee operations begin in Career Overhaul Prompt 3.',
    icon: BriefcaseBusiness,
  },
]

function ProgressBar({
  label,
  value,
}: {
  label: string
  value: number
}) {
  const percentage = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-cs-muted">{label}</span>
        <span className="font-mono text-rarity-special">{percentage}%</span>
      </div>
      <div
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percentage}
        className="h-2 overflow-hidden border border-cs-border bg-cs-surface"
        role="progressbar"
      >
        <div className="h-full bg-rarity-special transition-[width] duration-300" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

function formatDate(timestamp: number) {
  if (!timestamp) return 'Not recorded'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(timestamp)
}

export function Career() {
  const { state } = useGame()
  const career = state.career
  const snapshot = getCareerSnapshot(career)
  const rankRecord = [...career.rankHistory].reverse().find((entry) => entry.rankId === snapshot.rank.id)
  const activityRows: Array<[string, CareerSpecializationId]> = [
    ['Opening', 'caseOpening'],
    ['Trading', 'trading'],
    ['Collecting', 'collecting'],
    ['Trade-Ups', 'tradeUps'],
    ['Work', 'work'],
    ['Business', 'business'],
  ]

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-4 sm:p-6 lg:p-7">
      <header className="flex flex-col gap-4 border-b border-cs-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="border-l-4 border-rarity-special pl-4">
          <p className="font-mono text-xs uppercase text-rarity-special">Trading career</p>
          <h1 className="mt-1 text-3xl font-semibold text-cs-text sm:text-4xl">Career &amp; Upgrades</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-cs-muted">
            Career XP rewards real discoveries, skilled work, completed contracts, and economic outcomes—not UI clicks or market revaluation.
          </p>
        </div>
        <div className="flex items-center gap-3 border border-cs-border bg-cs-panel px-4 py-3">
          <Trophy aria-hidden="true" className="text-rarity-special" size={22} />
          <div>
            <p className="font-mono text-[10px] uppercase text-cs-muted">Current rank</p>
            <p className="font-semibold text-cs-text" data-testid="career-rank">{snapshot.rank.name}</p>
          </div>
        </div>
      </header>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
        <article className="min-w-0 border border-cs-border bg-cs-panel p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center border border-rarity-special bg-rarity-special/10 text-rarity-special">
                <BadgeCheck aria-hidden="true" size={24} />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase text-cs-muted">Career level</p>
                <p className="text-3xl font-semibold text-cs-text" data-testid="career-level">{snapshot.level}</p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="font-mono text-xs text-cs-text" data-testid="career-xp">
                {numberFormatter.format(snapshot.currentRunXp)} current-run XP
              </p>
              <p className="mt-1 text-xs text-cs-muted">{numberFormatter.format(snapshot.lifetimeXp)} lifetime XP</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <ProgressBar
              label={snapshot.level >= 100
                ? 'Maximum career level reached'
                : `${numberFormatter.format(snapshot.xpIntoLevel)} XP in level · ${numberFormatter.format(snapshot.xpForNextLevel)} needed`}
              value={snapshot.levelProgress}
            />
            <ProgressBar
              label={snapshot.nextRank
                ? `${snapshot.levelsToNextRank} levels to ${snapshot.nextRank.name}`
                : 'Highest career rank reached'}
              value={snapshot.rankProgress}
            />
          </div>
        </article>

        <article className="min-w-0 border border-cs-border bg-cs-panel p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Route aria-hidden="true" className="text-rarity-special" size={18} />
            <h2 className="font-semibold text-cs-text">Rank milestone</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-cs-muted">{snapshot.rank.description}</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1">
            <div className="border border-cs-border bg-cs-surface px-3 py-2">
              <dt className="font-mono text-[10px] uppercase text-cs-muted">Earned</dt>
              <dd className="mt-1 text-cs-text">{formatDate(rankRecord?.earnedAt ?? 0)}</dd>
            </div>
            <div className="border border-cs-border bg-cs-surface px-3 py-2">
              <dt className="font-mono text-[10px] uppercase text-cs-muted">Next requirement</dt>
              <dd className="mt-1 text-cs-text">{snapshot.nextRank?.milestone ?? 'Career legend achieved'}</dd>
            </div>
          </dl>
        </article>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <section aria-labelledby="specializations-title">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-cs-text" id="specializations-title">Specializations</h2>
              <p className="mt-1 text-xs text-cs-muted">Activity-backed foundations for the upgrade paths arriving in Prompt 4.</p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {specializationCards.map(({ description, icon: Icon, id, label }) => {
              const progress = career.specializations[id]
              return (
                <article className="min-w-0 border border-cs-border bg-cs-panel p-4" key={id}>
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center border border-cs-border bg-cs-surface text-rarity-special">
                      <Icon aria-hidden="true" size={17} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-cs-text">{label}</h3>
                      <p className="mt-1 text-xs leading-5 text-cs-muted">{description}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-cs-border pt-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase text-cs-muted">Lifetime XP</p>
                      <p className="mt-1 font-semibold text-cs-text">{numberFormatter.format(progress.lifetimeXp)}</p>
                    </div>
                    <p className="font-mono text-[10px] uppercase text-cs-muted">{numberFormatter.format(progress.activityCount)} events</p>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <div className="grid content-start gap-4">
          <section className="border border-cs-border bg-cs-panel p-4" aria-labelledby="activity-title">
            <div className="flex items-center gap-2">
              <TrendingUp aria-hidden="true" className="text-rarity-special" size={18} />
              <h2 className="font-semibold text-cs-text" id="activity-title">Career activity</h2>
            </div>
            <div className="mt-3 divide-y divide-cs-border border border-cs-border">
              {activityRows.map(([label, id]) => (
                <div className="flex items-center justify-between gap-3 bg-cs-surface px-3 py-2 text-sm" key={id}>
                  <span className="text-cs-muted">{label}</span>
                  <span className="font-mono text-cs-text">{numberFormatter.format(career.specializations[id].currentRunXp)} XP</span>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-cs-border bg-cs-panel p-4" aria-labelledby="milestones-title">
            <div className="flex items-center gap-2">
              <Clock3 aria-hidden="true" className="text-rarity-special" size={18} />
              <h2 className="font-semibold text-cs-text" id="milestones-title">Recent milestones</h2>
            </div>
            {career.recentMilestones.length > 0 ? (
              <ol className="mt-3 space-y-2">
                {career.recentMilestones.slice(0, 5).map((milestone) => (
                  <li className="border-l-2 border-cs-border pl-3" key={milestone.id}>
                    <p className="text-sm font-medium text-cs-text">{milestone.title}</p>
                    <p className="mt-1 text-xs leading-5 text-cs-muted">{milestone.description}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 border border-cs-border bg-cs-surface p-3 text-sm text-cs-muted">
                Complete a paid opening, Work job, trade, contract, or discovery to begin your career log.
              </p>
            )}
          </section>
        </div>
      </div>

      {career.migration.note ? (
        <aside className="mt-5 border border-rarity-special/40 bg-rarity-special/5 px-4 py-3 text-xs leading-5 text-cs-muted">
          <span className="font-semibold text-rarity-special">Legacy transition:</span> {career.migration.note}
        </aside>
      ) : null}

      <section className="mt-5 border border-cs-border bg-cs-panel p-4" aria-labelledby="rank-path-title">
        <h2 className="font-semibold text-cs-text" id="rank-path-title">Career rank path</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {CAREER_RANKS.map((rank) => {
            const reached = snapshot.level >= rank.minimumLevel
            return (
              <div className={[
                'min-w-0 border p-3',
                reached ? 'border-rarity-special/50 bg-rarity-special/5' : 'border-cs-border bg-cs-surface',
              ].join(' ')} key={rank.id}>
                <p className={['font-mono text-[10px] uppercase', reached ? 'text-rarity-special' : 'text-cs-muted'].join(' ')}>
                  Level {rank.minimumLevel}
                </p>
                <p className="mt-1 text-sm font-semibold text-cs-text">{rank.name}</p>
              </div>
            )
          })}
        </div>
      </section>
    </section>
  )
}
