import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import type { MarketPriceHistory, MarketPricePoint } from '../market/marketSimulation'
import { formatCurrency } from '../utils/format'
import {
  filterPriceHistoryByScale,
  formatPriceHistoryLabel,
  priceHistoryScaleOptions,
  summarizePriceHistory,
  type PriceHistoryScale,
} from '../utils/priceHistory'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

export interface PriceChartProps {
  accentColor?: string
  className?: string
  history: MarketPriceHistory
  initialScale?: PriceHistoryScale
  now?: number
  skinId: string
  title?: string
}

const defaultAccentColor = '#ffd700'
const emptyHistoryPoints: MarketPricePoint[] = []

export function PriceChart({
  accentColor = defaultAccentColor,
  className = '',
  history,
  initialScale = '24h',
  now,
  skinId,
  title = 'Price History',
}: PriceChartProps) {
  const [scale, setScale] = useState<PriceHistoryScale>(initialScale)
  const allPoints = history[skinId] ?? emptyHistoryPoints
  const visiblePoints = useMemo(
    () => filterPriceHistoryByScale(allPoints, scale, now),
    [allPoints, now, scale],
  )
  const summary = useMemo(() => summarizePriceHistory(visiblePoints), [visiblePoints])
  const hasUsableHistory = visiblePoints.length >= 2
  const chartData = useMemo<ChartData<'line'>>(
    () => ({
      labels: visiblePoints.map((point) => formatPriceHistoryLabel(point.timestamp, scale)),
      datasets: [
        {
          backgroundColor: `${accentColor}24`,
          borderColor: accentColor,
          data: visiblePoints.map((point) => point.value),
          fill: true,
          pointBackgroundColor: accentColor,
          pointBorderColor: '#080b10',
          pointRadius: 2,
          tension: 0.32,
        },
      ],
    }),
    [accentColor, scale, visiblePoints],
  )
  const chartOptions = useMemo<ChartOptions<'line'>>(
    () => ({
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
    [visiblePoints],
  )
  const changeTone = (summary?.changePercent ?? 0) >= 0 ? 'text-cs-green' : 'text-rarity-covert'

  return (
    <div className={['border border-cs-border bg-cs-panel p-4', className].filter(Boolean).join(' ')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-cs-text">{title}</h3>
          {summary ? (
            <p className="mt-1 font-mono text-xs uppercase text-cs-muted">
              Avg {formatCurrency(summary.averagePrice)} /{' '}
              <span className={changeTone}>{summary.changePercent >= 0 ? '+' : ''}{summary.changePercent}%</span>
            </p>
          ) : (
            <p className="mt-1 font-mono text-xs uppercase text-cs-muted">Waiting for market ticks</p>
          )}
        </div>
        <div className="grid grid-cols-3 border border-cs-border bg-cs-surface p-1">
          {priceHistoryScaleOptions.map((option) => (
            <button
              aria-pressed={scale === option.value}
              className={[
                'px-2 py-1 font-mono text-[10px] uppercase transition-colors',
                scale === option.value
                  ? 'bg-rarity-special/10 text-rarity-special'
                  : 'text-cs-muted hover:text-cs-text',
              ].join(' ')}
              key={option.value}
              onClick={() => setScale(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {hasUsableHistory ? (
        <div className="mt-4 h-44">
          <Line aria-label={`${title} chart`} data={chartData} options={chartOptions} />
        </div>
      ) : (
        <div className="mt-4 grid min-h-44 place-items-center border border-cs-border bg-cs-surface p-4 text-center text-sm text-cs-muted">
          Price history will appear after the market has at least two ticks in this range.
        </div>
      )}
    </div>
  )
}
