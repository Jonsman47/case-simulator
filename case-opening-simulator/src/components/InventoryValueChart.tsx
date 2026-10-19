import type { ChartData, ChartOptions } from 'chart.js'
import { Info } from 'lucide-react'
import { useMemo } from 'react'
import { DeferredLineChart } from './DeferredChart'
import { formatCurrency } from '../utils/format'
import {
  summarizeInventoryValueHistory,
  trimInventoryValueHistory,
  type InventoryValuePoint,
} from '../utils/inventory'

interface InventoryValueChartProps {
  className?: string
  compact?: boolean
  currentValue: number
  history: InventoryValuePoint[]
  title?: string
}

const inventoryValueTooltip =
  'Inventory value changes with market movement, auto-sell, trade-ups, and manual sales.'

function formatHistoryLabel(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function InventoryValueChart({
  className = '',
  compact = false,
  currentValue,
  history,
  title = 'Inventory Value Trend',
}: InventoryValueChartProps) {
  const visiblePoints = useMemo(() => trimInventoryValueHistory(history), [history])
  const summary = useMemo(() => summarizeInventoryValueHistory(visiblePoints), [visiblePoints])
  const hasUsableHistory = visiblePoints.length >= 2
  const chartData = useMemo<ChartData<'line'>>(
    () => ({
      labels: visiblePoints.map((point) => formatHistoryLabel(point.timestamp)),
      datasets: [
        {
          backgroundColor: 'rgba(34, 197, 94, 0.14)',
          borderColor: '#22c55e',
          data: visiblePoints.map((point) => point.value),
          fill: true,
          pointRadius: compact ? 0 : 2,
          tension: 0.35,
        },
      ],
    }),
    [compact, visiblePoints],
  )
  const chartOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      animation: false,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => formatCurrency(Number(context.parsed.y)),
            title: (items) => {
              const index = items[0]?.dataIndex ?? 0
              const timestamp = visiblePoints[index]?.timestamp

              return timestamp ? new Date(timestamp).toLocaleString() : ''
            },
          },
        },
      },
      responsive: true,
      scales: {
        x: {
          display: false,
          grid: { display: false },
        },
        y: {
          display: false,
          grid: { display: false },
        },
      },
    }),
    [visiblePoints],
  )
  const changePercent = summary?.changePercent ?? 0
  const changeTone = changePercent >= 0 ? 'text-cs-green' : 'text-rarity-covert'
  const periodLabel = summary?.periodLabel === '24h' ? '24h' : 'session'

  return (
    <section
      className={[
        'border border-cs-border bg-cs-panel',
        compact ? 'p-3' : 'p-4',
        className,
      ].filter(Boolean).join(' ')}
      title={inventoryValueTooltip}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className={compact ? 'font-mono text-xs uppercase text-cs-muted' : 'text-lg font-semibold text-cs-text'}>
              {title}
            </h3>
            <Info className="text-cs-muted" size={compact ? 12 : 14} aria-hidden="true" />
          </div>
          <p className={compact ? 'mt-1 text-sm font-semibold text-cs-text' : 'mt-1 text-xl font-semibold text-cs-text'}>
            {formatCurrency(currentValue)}
          </p>
        </div>
        <p className={['font-mono text-xs uppercase', changeTone].join(' ')}>
          {changePercent >= 0 ? '+' : ''}
          {changePercent}% {periodLabel}
        </p>
      </div>

      {hasUsableHistory ? (
        <div className={compact ? 'mt-3 h-12' : 'mt-4 h-24'}>
          <DeferredLineChart aria-label={`${title} chart`} data={chartData} options={chartOptions} />
        </div>
      ) : (
        <div className={[
          'mt-3 grid place-items-center border border-cs-border bg-cs-surface text-center text-xs text-cs-muted',
          compact ? 'h-12 px-2' : 'h-24 px-4',
        ].join(' ')}>
          Trend appears after value changes.
        </div>
      )}
    </section>
  )
}
