export interface DistributionSummary {
  count: number
  mean: number
  median: number
  p10: number
  p90: number
  minimum: number
  maximum: number
  confidence95: { low: number; high: number }
}

function percentile(sorted: number[], ratio: number) {
  if (sorted.length === 0) return 0
  const position = (sorted.length - 1) * ratio
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

function rounded(value: number) {
  return Number(value.toFixed(2))
}

export function summarizeDistribution(values: readonly number[]): DistributionSummary {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right)
  if (finite.length === 0) {
    return { count: 0, mean: 0, median: 0, p10: 0, p90: 0, minimum: 0, maximum: 0, confidence95: { low: 0, high: 0 } }
  }
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length
  const variance = finite.length > 1
    ? finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (finite.length - 1)
    : 0
  const margin = 1.96 * Math.sqrt(variance / finite.length)
  return {
    count: finite.length,
    mean: rounded(mean),
    median: rounded(percentile(finite, 0.5)),
    p10: rounded(percentile(finite, 0.1)),
    p90: rounded(percentile(finite, 0.9)),
    minimum: rounded(finite[0]),
    maximum: rounded(finite[finite.length - 1]),
    confidence95: { low: rounded(mean - margin), high: rounded(mean + margin) },
  }
}
