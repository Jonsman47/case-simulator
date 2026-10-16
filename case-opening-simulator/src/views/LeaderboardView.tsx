import { Award, BadgeCheck, Gem, RefreshCw, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createCloudBackend,
  type LeaderboardEntry,
  type LeaderboardMetric,
} from '../cloud/cloudSave'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'

const leaderboardBackend = createCloudBackend()

const metrics: { label: string; value: LeaderboardMetric }[] = [
  { label: 'Inventory Value', value: 'inventoryValue' },
  { label: 'Best Skin', value: 'mostValuableSkin' },
  { label: 'Prestige', value: 'prestigeLevel' },
  { label: 'Cases Opened', value: 'casesOpened' },
  { label: 'Total Profit', value: 'totalProfit' },
  { label: 'Rare Patterns', value: 'rarePatterns' },
  { label: 'Achievements', value: 'achievementCount' },
]

function formatMetric(entry: LeaderboardEntry, metric: LeaderboardMetric) {
  if (metric === 'inventoryValue' || metric === 'mostValuableSkin') {
    return formatCurrency(entry[metric])
  }

  if (metric === 'totalProfit') {
    return formatCurrency(entry.totalProfit)
  }

  return entry[metric].toLocaleString()
}

const PAGE_SIZE = 10

export function LeaderboardView() {
  const { cloud } = useGame()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()
  const [page, setPage] = useState(0)
  const activeMetric = cloud.metric
  const activeMetricLabel = useMemo(
    () => metrics.find((metric) => metric.value === activeMetric)?.label ?? 'Inventory Value',
    [activeMetric],
  )
  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE))
  const visibleEntries = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const personalIndex = cloud.session
    ? entries.findIndex((entry) => entry.userId === cloud.session?.user.id)
    : -1
  const loadLeaderboard = useCallback(async () => {
    setIsLoading(true)
    setError(undefined)

    try {
      setEntries(await leaderboardBackend.listLeaderboard(activeMetric))
      setPage(0)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Leaderboard could not be loaded.')
      setEntries([])
    } finally {
      setIsLoading(false)
    }
  }, [activeMetric])

  useEffect(() => {
    let isCancelled = false

    void leaderboardBackend.listLeaderboard(activeMetric)
      .then((nextEntries) => {
        if (!isCancelled) {
          setEntries(nextEntries)
          setError(undefined)
        }
      })
      .catch((nextError) => {
        if (!isCancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Leaderboard could not be loaded.')
          setEntries([])
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [activeMetric])

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-5 sm:p-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="border-l-4 border-rarity-special pl-4">
          <p className="font-mono text-xs uppercase text-rarity-special">Cloud Rankings</p>
          <h2 className="mt-1 text-3xl font-semibold text-cs-text sm:text-4xl">Leaderboards</h2>
          <p className="mt-2 text-sm text-cs-muted">
            Rankings use public or anonymous cloud-save summaries only.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 border border-rarity-special px-4 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/10"
          disabled={isLoading}
          onClick={() => void loadLeaderboard()}
          type="button"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="mt-5 grid gap-3 border border-rarity-industrial/60 bg-rarity-industrial/10 p-4 md:grid-cols-[auto_1fr] md:items-start">
        <ShieldAlert aria-hidden="true" className="text-rarity-industrial" size={20} />
        <div>
          <p className="text-sm font-semibold text-cs-text">
            {cloud.isConfigured ? 'Community rankings · client reported' : 'Local mock rankings · this browser only'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-cs-muted">
            Scores are deterministic summaries of synced saves, but gameplay is client-side. These rankings are not cheat-proof or server-authoritative.
          </p>
        </div>
      </div>

      {personalIndex >= 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-rarity-special bg-rarity-special/10 p-4">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-cs-text">
            <BadgeCheck size={17} /> Your rank for {activeMetricLabel}
          </span>
          <span className="font-mono text-lg font-semibold text-rarity-special">#{personalIndex + 1}</span>
        </div>
      ) : null}

      <div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <button
            aria-pressed={activeMetric === metric.value}
            className={[
              'border px-4 py-3 text-left transition-colors',
              activeMetric === metric.value
                ? 'border-rarity-special bg-rarity-special/10 text-rarity-special'
                : 'border-cs-border bg-cs-panel text-cs-muted hover:text-cs-text',
            ].join(' ')}
            key={metric.value}
            onClick={() => {
              setIsLoading(true)
              setPage(0)
              cloud.setMetric(metric.value)
            }}
            type="button"
          >
            <span className="font-mono text-xs uppercase">{metric.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 border border-cs-border bg-cs-bg p-3">
        <div className="mb-3 flex items-center justify-between gap-3 border border-cs-border bg-cs-panel p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-rarity-special" size={18} />
            <p className="font-mono text-xs uppercase text-cs-muted">{activeMetricLabel}</p>
          </div>
          <p className="font-mono text-xs uppercase text-cs-muted">
            {isLoading ? 'Loading' : `${entries.length} entries`}
          </p>
        </div>

        {error ? (
          <div className="border border-rarity-covert bg-rarity-covert/10 p-4 text-sm text-rarity-covert">
            {error}
          </div>
        ) : entries.length > 0 ? (
          <div className="grid gap-2">
            {visibleEntries.map((entry, index) => (
              <article
                className="grid gap-3 border border-cs-border bg-cs-panel p-4 sm:grid-cols-[4rem_1fr_auto] sm:items-center"
                key={entry.userId}
              >
                <div className="flex items-center gap-2 font-mono text-lg font-semibold text-rarity-special">
                  <Award size={18} />
                  #{page * PAGE_SIZE + index + 1}
                </div>
                <div className="min-w-0">
                  <Link className="truncate text-lg font-semibold text-cs-text hover:text-rarity-special" to={`/profile/${entry.userId}`}>
                    {entry.username}
                  </Link>
                  <p className="mt-1 text-xs text-cs-muted">
                    {entry.casesOpened.toLocaleString()} cases · Prestige {entry.prestigeLevel.toLocaleString()} · {entry.rarePatterns} rare patterns
                  </p>
                </div>
                <div className="font-mono text-lg font-semibold text-cs-green">
                  {formatMetric(entry, activeMetric)}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid min-h-72 place-items-center border border-cs-border bg-cs-panel p-8 text-center">
            <div>
              <p className="text-lg font-semibold text-cs-text">No leaderboard entries yet</p>
              <p className="mt-2 text-sm text-cs-muted">
                Create an account and sync a save to appear here.
              </p>
            </div>
          </div>
        )}

        {!isLoading && !error && entries.length > PAGE_SIZE ? (
          <div className="mt-3 flex items-center justify-between gap-3 border border-cs-border bg-cs-panel p-3">
            <button className="min-h-10 border border-cs-border px-3 text-sm text-cs-muted disabled:opacity-40" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} type="button">Previous</button>
            <span className="font-mono text-xs uppercase text-cs-muted">Page {page + 1} / {pageCount}</span>
            <button className="min-h-10 border border-cs-border px-3 text-sm text-cs-muted disabled:opacity-40" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} type="button">Next</button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-cs-muted">
        <span className="inline-flex items-center gap-1"><Gem size={14} /> Pattern values include stored premiums.</span>
        <span className="inline-flex items-center gap-1"><Sparkles size={14} /> Only opted-in public profiles appear.</span>
      </div>
    </section>
  )
}
