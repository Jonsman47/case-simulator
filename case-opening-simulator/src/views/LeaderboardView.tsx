import { Award, RefreshCw, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  { label: 'Prestige', value: 'prestigeLevel' },
  { label: 'Cases Opened', value: 'casesOpened' },
  { label: 'Total Profit', value: 'totalProfit' },
]

function formatMetric(entry: LeaderboardEntry, metric: LeaderboardMetric) {
  if (metric === 'inventoryValue') {
    return formatCurrency(entry.inventoryValue)
  }

  if (metric === 'totalProfit') {
    return formatCurrency(entry.totalProfit)
  }

  return metric === 'prestigeLevel'
    ? entry.prestigeLevel.toLocaleString()
    : entry.casesOpened.toLocaleString()
}

export function LeaderboardView() {
  const { cloud } = useGame()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()
  const activeMetric = cloud.metric
  const activeMetricLabel = useMemo(
    () => metrics.find((metric) => metric.value === activeMetric)?.label ?? 'Inventory Value',
    [activeMetric],
  )
  const loadLeaderboard = useCallback(async () => {
    setIsLoading(true)
    setError(undefined)

    try {
      setEntries(await leaderboardBackend.listLeaderboard(activeMetric))
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
            {entries.map((entry, index) => (
              <article
                className="grid gap-3 border border-cs-border bg-cs-panel p-4 sm:grid-cols-[4rem_1fr_auto] sm:items-center"
                key={`${entry.userId}-${index}`}
              >
                <div className="flex items-center gap-2 font-mono text-lg font-semibold text-rarity-special">
                  <Award size={18} />
                  #{index + 1}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-cs-text">{entry.username}</h3>
                  <p className="mt-1 text-xs text-cs-muted">
                    {entry.casesOpened.toLocaleString()} cases / Prestige {entry.prestigeLevel.toLocaleString()}
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
      </div>
    </section>
  )
}
