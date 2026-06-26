import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js'
import {
  BarChart3,
  Bot,
  Clipboard,
  Clock3,
  Download,
  Gem,
  Medal,
  Package,
  Repeat2,
  Trophy,
  Wallet,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { Bar, Line, Pie } from 'react-chartjs-2'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'
import { getRarityLabel } from '../utils/itemLabels'
import {
  buildInventoryValueLineChartData,
  buildMoneyFlowChartData,
  buildRarityDistributionChartData,
  buildRarityPieChartData,
  buildStatsCsv,
  calculateStatsDashboardSummary,
  createStatsSessionBaseline,
  type StatsDashboardSummary,
  type StatsTimeRange,
} from '../utils/statsDashboard'

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
)

const rangeOptions: { label: string; value: StatsTimeRange }[] = [
  { label: 'Session', value: 'session' },
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' },
  { label: 'All', value: 'all' },
]

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  notation: 'compact',
})

function formatCompactNumber(value: number) {
  return compactNumberFormatter.format(value)
}

function formatDuration(ms: number) {
  if (ms <= 0) {
    return '0m'
  }

  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / 1_440)
  const hours = Math.floor((totalMinutes % 1_440) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    return `${days}d ${hours}h`
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${minutes}m`
}

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}

function toneClass(tone: 'amber' | 'green' | 'red' | 'text') {
  if (tone === 'amber') {
    return 'text-rarity-special'
  }

  if (tone === 'green') {
    return 'text-cs-green'
  }

  if (tone === 'red') {
    return 'text-rarity-covert'
  }

  return 'text-cs-text'
}

function MetricCard({
  icon: Icon,
  label,
  subLabel,
  tone = 'text',
  value,
}: {
  icon: ComponentType<{ className?: string; size?: number }>
  label: string
  subLabel?: string
  tone?: 'amber' | 'green' | 'red' | 'text'
  value: string
}) {
  return (
    <article className="border border-cs-border bg-cs-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p>
          <p className={['mt-2 truncate text-2xl font-semibold', toneClass(tone)].join(' ')}>
            {value}
          </p>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center border border-cs-border bg-cs-surface text-cs-muted">
          <Icon size={18} />
        </div>
      </div>
      {subLabel ? <p className="mt-3 text-xs text-cs-muted">{subLabel}</p> : null}
    </article>
  )
}

function ChartPanel({
  children,
  subtitle,
  title,
}: {
  children: ReactNode
  subtitle?: string
  title: string
}) {
  return (
    <section className="border border-cs-border bg-cs-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-cs-text">{title}</h3>
          {subtitle ? <p className="mt-1 font-mono text-xs uppercase text-cs-muted">{subtitle}</p> : null}
        </div>
        <BarChart3 aria-hidden="true" className="text-rarity-special" size={18} />
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="grid h-64 place-items-center border border-cs-border bg-cs-surface p-5 text-center text-sm text-cs-muted">
      {label}
    </div>
  )
}

function RangeControl({
  range,
  setRange,
}: {
  range: StatsTimeRange
  setRange: (range: StatsTimeRange) => void
}) {
  return (
    <div className="grid grid-cols-4 border border-cs-border bg-cs-panel p-1">
      {rangeOptions.map((option) => (
        <button
          aria-pressed={range === option.value}
          className={[
            'px-3 py-2 font-mono text-[10px] uppercase transition-colors',
            range === option.value
              ? 'bg-rarity-special/10 text-rarity-special'
              : 'text-cs-muted hover:text-cs-text',
          ].join(' ')}
          key={option.value}
          onClick={() => setRange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function RarityBreakdown({ summary }: { summary: StatsDashboardSummary }) {
  return (
    <section className="border border-cs-border bg-cs-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-cs-text">Rarity Breakdown</h3>
        <span className="font-mono text-xs uppercase text-cs-muted">
          {summary.totalDrops.toLocaleString()} drops
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {summary.rarityBuckets.map((bucket) => {
          return (
            <div key={bucket.rarity}>
              <div className="flex justify-between gap-3 text-xs">
                <span style={{ color: bucket.color }}>{getRarityLabel(bucket.rarity)}</span>
                <span className="font-mono text-cs-muted">
                  {bucket.count.toLocaleString()} / {bucket.percentage}%
                </span>
              </div>
              <div className="mt-1 h-2 border border-cs-border bg-cs-surface">
                <div
                  className="h-full"
                  style={{
                    backgroundColor: bucket.color,
                    width: `${Math.min(100, bucket.percentage)}%`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function MilestoneTimeline({ summary }: { summary: StatsDashboardSummary }) {
  return (
    <section className="border border-cs-border bg-cs-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-cs-text">Milestone Timeline</h3>
        <Medal aria-hidden="true" className="text-rarity-special" size={18} />
      </div>
      {summary.milestones.length > 0 ? (
        <ol className="mt-4 space-y-3">
          {summary.milestones.map((milestone) => (
            <li className="border-l-2 border-rarity-special bg-cs-surface px-3 py-2" key={milestone.id}>
              <p className="text-sm font-semibold text-cs-text">{milestone.label}</p>
              <p className="mt-1 text-xs text-cs-muted">{milestone.description}</p>
              <p className="mt-2 font-mono text-[10px] uppercase text-cs-muted">
                {formatDateTime(milestone.timestamp)}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-4 grid min-h-40 place-items-center border border-cs-border bg-cs-surface p-4 text-center text-sm text-cs-muted">
          No milestones in this range.
        </div>
      )}
    </section>
  )
}

function Comparatives({ summary }: { summary: StatsDashboardSummary }) {
  const sessionVsAverage =
    summary.comparatives.sessionCasesPerHour - summary.comparatives.averageCasesPerHour
  const comparisonTone = sessionVsAverage >= 0 ? 'text-cs-green' : 'text-rarity-covert'

  return (
    <section className="border border-cs-border bg-cs-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-cs-text">Session vs Average</h3>
        <Clock3 aria-hidden="true" className="text-rarity-industrial" size={18} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SmallStat label="Session Cases" value={summary.comparatives.sessionCasesOpened.toLocaleString()} />
        <SmallStat
          label="Session Pace"
          value={`${summary.comparatives.sessionCasesPerHour}/h`}
          valueClass={comparisonTone}
        />
        <SmallStat label="Average Pace" value={`${summary.comparatives.averageCasesPerHour}/h`} />
        <SmallStat
          label="Session Net"
          value={formatCurrency(summary.comparatives.sessionNet)}
          valueClass={summary.comparatives.sessionNet >= 0 ? 'text-cs-green' : 'text-rarity-covert'}
        />
        <SmallStat
          label="Value Change"
          value={formatCurrency(summary.comparatives.sessionValueChange)}
          valueClass={summary.comparatives.sessionValueChange >= 0 ? 'text-cs-green' : 'text-rarity-covert'}
        />
        <SmallStat
          label="Avg Net / Hour"
          value={formatCurrency(summary.comparatives.averageNetPerHour)}
          valueClass={summary.comparatives.averageNetPerHour >= 0 ? 'text-cs-green' : 'text-rarity-covert'}
        />
      </div>
    </section>
  )
}

function SmallStat({
  label,
  value,
  valueClass = 'text-cs-text',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="border border-cs-border bg-cs-surface px-3 py-2">
      <p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p>
      <p className={['mt-1 text-sm font-semibold', valueClass].join(' ')}>{value}</p>
    </div>
  )
}

export function StatsView() {
  const { state } = useGame()
  const [range, setRange] = useState<StatsTimeRange>('all')
  const [session] = useState(() => {
    const startedAt = Date.now()

    return {
      baseline: createStatsSessionBaseline(state, startedAt),
      startedAt,
    }
  })
  const [now, setNow] = useState(session.startedAt)
  const [exportMessage, setExportMessage] = useState<string | undefined>()

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 30_000)

    return () => window.clearInterval(intervalId)
  }, [])

  const baseline = session.baseline
  const summary = useMemo(
    () => calculateStatsDashboardSummary({ baseline, now, range, state }),
    [baseline, now, range, state],
  )
  const rarityBarData = useMemo(() => buildRarityDistributionChartData(summary), [summary])
  const rarityPieData = useMemo(() => buildRarityPieChartData(summary), [summary])
  const moneyFlowData = useMemo(() => buildMoneyFlowChartData(summary), [summary])
  const inventoryLineData = useMemo(
    () => buildInventoryValueLineChartData(summary.filteredInventoryValueHistory),
    [summary.filteredInventoryValueHistory],
  )
  const csv = useMemo(() => buildStatsCsv(summary), [summary])
  const hasDropData = summary.totalDrops > 0
  const hasInventoryHistory = summary.filteredInventoryValueHistory.length >= 2
  const chartOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => String(context.parsed.y),
          },
        },
      },
      responsive: true,
      scales: {
        x: {
          grid: { color: 'rgba(154, 168, 187, 0.1)' },
          ticks: { color: '#9aa8bb', font: { size: 10 } },
        },
        y: {
          grid: { color: 'rgba(154, 168, 187, 0.12)' },
          ticks: { color: '#9aa8bb', font: { size: 10 } },
        },
      },
    }),
    [],
  )
  const currencyBarOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      ...chartOptions,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => formatCurrency(Number(context.parsed.y)),
          },
        },
      },
      scales: {
        ...chartOptions.scales,
        y: {
          grid: { color: 'rgba(154, 168, 187, 0.12)' },
          ticks: {
            callback: (value) => `$${value}`,
            color: '#9aa8bb',
            font: { size: 10 },
          },
        },
      },
    }),
    [chartOptions],
  )
  const lineOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => formatCurrency(Number(context.parsed.y)),
          },
        },
      },
      responsive: true,
      scales: {
        x: {
          grid: { color: 'rgba(154, 168, 187, 0.1)' },
          ticks: { color: '#9aa8bb', font: { size: 10 } },
        },
        y: {
          grid: { color: 'rgba(154, 168, 187, 0.12)' },
          ticks: {
            callback: (value) => `$${value}`,
            color: '#9aa8bb',
            font: { size: 10 },
          },
        },
      },
    }),
    [],
  )
  const pieOptions = useMemo<ChartOptions<'pie'>>(
    () => ({
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            boxWidth: 10,
            color: '#d7e0ec',
            font: { size: 10 },
          },
          position: 'bottom',
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${context.parsed}`,
          },
        },
      },
      responsive: true,
    }),
    [],
  )

  async function copyStats() {
    try {
      await navigator.clipboard.writeText(csv)
      setExportMessage('Stats copied')
    } catch {
      setExportMessage('Clipboard unavailable')
    }
  }

  function downloadCsv() {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = url
    anchor.download = `case-opening-stats-${new Date(now).toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    setExportMessage('CSV downloaded')
  }

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-5 sm:p-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="border-l-4 border-rarity-special pl-4">
          <p className="font-mono text-xs uppercase text-rarity-special">Performance log</p>
          <h2 className="mt-1 text-3xl font-semibold text-cs-text sm:text-4xl">Stats</h2>
          <p className="mt-2 max-w-2xl text-sm text-cs-muted">
            Lifetime totals, live inventory trend, and milestone telemetry.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <RangeControl range={range} setRange={setRange} />
          <div className="flex gap-2">
            <button
              className="inline-flex items-center gap-2 border border-cs-border bg-cs-panel px-3 py-2 text-sm text-cs-muted transition-colors hover:text-cs-text"
              onClick={copyStats}
              type="button"
            >
              <Clipboard size={15} />
              Copy
            </button>
            <button
              className="inline-flex items-center gap-2 border border-rarity-special bg-rarity-special/10 px-3 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20"
              onClick={downloadCsv}
              type="button"
            >
              <Download size={15} />
              CSV
            </button>
          </div>
          {exportMessage ? (
            <p className="font-mono text-[10px] uppercase text-cs-green">{exportMessage}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Package}
          label="Cases Opened"
          subLabel={`${summary.totalDrops.toLocaleString()} total drops`}
          value={summary.totalCasesOpened.toLocaleString()}
        />
        <MetricCard
          icon={Wallet}
          label="Net Profit"
          subLabel={`${formatCurrency(summary.moneyEarned)} earned / ${formatCurrency(summary.moneySpent)} spent`}
          tone={summary.netProfit >= 0 ? 'green' : 'red'}
          value={formatCurrency(summary.netProfit)}
        />
        <MetricCard
          icon={Gem}
          label="Rare Drops"
          subLabel="Classified and above"
          tone="amber"
          value={summary.rareDropsClassifiedPlus.toLocaleString()}
        />
        <MetricCard
          icon={Trophy}
          label="Highest Item"
          subLabel={`${summary.inventoryCount.toLocaleString()} items held`}
          tone="green"
          value={formatCurrency(summary.highestItemValue)}
        />
        <MetricCard
          icon={Wallet}
          label="Inventory Value"
          subLabel="Current market valuation"
          tone="green"
          value={formatCurrency(summary.inventoryValue)}
        />
        <MetricCard
          icon={Repeat2}
          label="Trade-Ups"
          subLabel={`${summary.itemsSold.toLocaleString()} items sold`}
          value={summary.tradeUpsCompleted.toLocaleString()}
        />
        <MetricCard
          icon={Bot}
          label="Automation"
          subLabel={`Auto Opener L${summary.autoOpenerLevel} / ${summary.automationModulesPurchased} modules`}
          value={`${summary.automationModuleLevels} lvls`}
        />
        <MetricCard
          icon={Clock3}
          label="Time Played"
          subLabel={`Prestige ${summary.prestigeLevel} / ${summary.casesUnlocked} cases unlocked`}
          value={formatDuration(summary.timePlayedMs)}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid gap-4 2xl:grid-cols-2">
          <ChartPanel
            subtitle={`${formatCompactNumber(summary.totalDrops)} drops`}
            title="Drop Rarity Distribution"
          >
            {hasDropData ? (
              <div className="h-64">
                <Bar aria-label="Drop rarity distribution chart" data={rarityBarData} options={chartOptions} />
              </div>
            ) : (
              <EmptyChart label="Open cases to populate rarity distribution." />
            )}
          </ChartPanel>

          <ChartPanel subtitle="Spent / earned / net" title="Money Flow">
            <div className="h-64">
              <Bar aria-label="Money flow chart" data={moneyFlowData} options={currencyBarOptions} />
            </div>
          </ChartPanel>

          <ChartPanel subtitle={`${range.toUpperCase()} scope`} title="Inventory Value Trend">
            {hasInventoryHistory ? (
              <div className="h-64">
                <Line aria-label="Stats inventory value chart" data={inventoryLineData} options={lineOptions} />
              </div>
            ) : (
              <EmptyChart label="Inventory trend appears after value changes in this range." />
            )}
          </ChartPanel>

          <ChartPanel subtitle="Held drop share" title="Rarity Share">
            {hasDropData ? (
              <div className="h-64">
                <Pie aria-label="Drop rarity share chart" data={rarityPieData} options={pieOptions} />
              </div>
            ) : (
              <EmptyChart label="Rarity share appears after your first drop." />
            )}
          </ChartPanel>
        </div>

        <div className="grid gap-4">
          <RarityBreakdown summary={summary} />
          <MilestoneTimeline summary={summary} />
        </div>
      </div>

      <div className="mt-4">
        <Comparatives summary={summary} />
      </div>
    </section>
  )
}
