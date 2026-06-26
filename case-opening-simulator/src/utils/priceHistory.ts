import type { MarketPricePoint } from '../market/marketSimulation'

export type PriceHistoryScale = '24h' | '7d' | '30d'

export const priceHistoryScaleOptions: { label: string; value: PriceHistoryScale }[] = [
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
]

const scaleDurations: Record<PriceHistoryScale, number> = {
  '24h': 24 * 60 * 60 * 1_000,
  '7d': 7 * 24 * 60 * 60 * 1_000,
  '30d': 30 * 24 * 60 * 60 * 1_000,
}

export interface PriceHistorySummary {
  averagePrice: number
  changePercent: number
  endValue: number
  startValue: number
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2))
}

export function getLatestHistoryTimestamp(points: MarketPricePoint[]) {
  return points.length > 0 ? points[points.length - 1].timestamp : Date.now()
}

export function filterPriceHistoryByScale(
  points: MarketPricePoint[],
  scale: PriceHistoryScale,
  now = getLatestHistoryTimestamp(points),
) {
  const minTimestamp = now - scaleDurations[scale]

  return points
    .filter((point) => point.timestamp >= minTimestamp && point.timestamp <= now)
    .sort((left, right) => left.timestamp - right.timestamp)
}

export function summarizePriceHistory(points: MarketPricePoint[]): PriceHistorySummary | undefined {
  if (points.length === 0) {
    return undefined
  }

  const startValue = points[0].value
  const endValue = points[points.length - 1].value
  const averagePrice = points.reduce((total, point) => total + point.value, 0) / points.length
  const changePercent = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0

  return {
    averagePrice: roundCurrency(averagePrice),
    changePercent: Number(changePercent.toFixed(2)),
    endValue,
    startValue,
  }
}

export function formatPriceHistoryLabel(timestamp: number, scale: PriceHistoryScale) {
  const date = new Date(timestamp)

  if (scale === '24h') {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
