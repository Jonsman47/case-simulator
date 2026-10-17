import type { GameState, InventoryItem } from '../data/gameState'
import { getMarketAdjustedSkinConditionPrice } from '../data/skinPrices'
import { roundCurrency } from './safeNumbers'
import { applyWearMultiplier } from './wear'
import { applyPatternPremium } from './skinPatterns'

export const INVENTORY_VALUE_HISTORY_LIMIT = 100
export const PRESTIGE_INVENTORY_VALUE_THRESHOLD = 1_000_000

const dayMs = 24 * 60 * 60 * 1_000

export interface InventoryValuePoint {
  timestamp: number
  value: number
}

export interface InventoryValueSummary {
  changePercent: number
  currentValue: number
  previousValue: number
  periodLabel: '24h' | 'session'
}

export function getCurrentItemMarketValue(
  item: InventoryItem,
  marketValues: GameState['marketValues'],
) {
  const generatedPrice = getMarketAdjustedSkinConditionPrice({
    fallbackValue: undefined,
    isStatTrak: Boolean(item.statTrak),
    isSouvenir: Boolean(item.souvenir),
    marketValues,
    skin: item,
    wear: item.wear,
  })

  if (typeof generatedPrice === 'number') {
    return applyPatternPremium(generatedPrice, item.pattern)
  }

  const currentBaseValue = marketValues[item.id]

  if (typeof currentBaseValue === 'number') {
    return applyPatternPremium(
      applyWearMultiplier(currentBaseValue, item.wear, item.floatValue),
      item.pattern,
    )
  }

  return item.marketValue
}

export function getInventoryValue(
  inventory: InventoryItem[],
  marketValues: GameState['marketValues'],
) {
  return roundCurrency(inventory.reduce((total, item) => {
    return total + getCurrentItemMarketValue(item, marketValues)
  }, 0))
}

export function trimInventoryValueHistory(
  history: InventoryValuePoint[],
  limit = INVENTORY_VALUE_HISTORY_LIMIT,
) {
  return [...history]
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value))
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-limit)
}

export function appendInventoryValueHistory(
  history: InventoryValuePoint[],
  value: number,
  timestamp = Date.now(),
  limit = INVENTORY_VALUE_HISTORY_LIMIT,
) {
  const nextPoint = {
    timestamp,
    value: roundCurrency(value),
  }
  const existingHistory = trimInventoryValueHistory(history, limit)
  const lastPoint = existingHistory[existingHistory.length - 1]

  if (lastPoint?.timestamp === timestamp) {
    return [...existingHistory.slice(0, -1), nextPoint]
  }

  return trimInventoryValueHistory([...existingHistory, nextPoint], limit)
}

export function summarizeInventoryValueHistory(
  history: InventoryValuePoint[],
): InventoryValueSummary | undefined {
  const sortedHistory = trimInventoryValueHistory(history)

  if (sortedHistory.length === 0) {
    return undefined
  }

  const currentPoint = sortedHistory[sortedHistory.length - 1]
  const previousDayCutoff = currentPoint.timestamp - dayMs
  const previousDayPoint = [...sortedHistory].reverse().find((point) => point.timestamp <= previousDayCutoff)
  const comparisonPoint = previousDayPoint ?? sortedHistory[0]
  const changePercent =
    comparisonPoint.value > 0
      ? ((currentPoint.value - comparisonPoint.value) / comparisonPoint.value) * 100
      : 0

  return {
    changePercent: Number(changePercent.toFixed(2)),
    currentValue: currentPoint.value,
    previousValue: comparisonPoint.value,
    periodLabel: previousDayPoint ? '24h' : 'session',
  }
}

export function canPrestigeWithInventoryValue(
  inventoryValue: number,
  threshold = PRESTIGE_INVENTORY_VALUE_THRESHOLD,
) {
  return inventoryValue >= threshold
}
