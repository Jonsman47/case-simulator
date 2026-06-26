export const MAX_CURRENCY_VALUE = 999_999_999_999

export function clampNumber(value: number, min = 0, max = MAX_CURRENCY_VALUE) {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(max, Math.max(min, value))
}

export function roundCurrency(value: number) {
  return Number(clampNumber(value).toFixed(2))
}
