import type { SkinInstance } from '../data/models'
import { getCurrentItemMarketValue } from './inventory'
import { getTradeUpCompatibilityReason, getTradeUpInputCount, isTradeUpEligibleItem, tradeUpRarityOrder } from './tradeUp'

export type TradeUpQuickFillMode = 'cheapest' | 'lowest-float' | 'random' | 'remaining'

export interface TradeUpQuickFillOptions {
  candidates: SkinInstance[]
  capacity: number
  marketValues: Record<string, number>
  mode: TradeUpQuickFillMode
  random?: () => number
  selectedItems: SkinInstance[]
}

export interface TradeUpQuickFillResult {
  addedIds: string[]
  itemIds: string[]
  message?: string
}

function shuffled<T>(values: T[], random: () => number) {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

function sortCandidates(
  candidates: SkinInstance[],
  marketValues: Record<string, number>,
  mode: TradeUpQuickFillMode,
  random: () => number,
) {
  if (mode === 'random') return shuffled(candidates, random)
  if (mode === 'lowest-float') return [...candidates].sort((left, right) => left.floatValue - right.floatValue || left.instanceId.localeCompare(right.instanceId))
  if (mode === 'cheapest') return [...candidates].sort((left, right) => getCurrentItemMarketValue(left, marketValues) - getCurrentItemMarketValue(right, marketValues) || left.instanceId.localeCompare(right.instanceId))
  return candidates
}

function editionGroup(item: Pick<SkinInstance, 'statTrak'>) {
  return item.statTrak ? 'stattrak' : 'standard'
}

export function selectTradeUpQuickFill({
  candidates,
  capacity,
  marketValues,
  mode,
  random = Math.random,
  selectedItems,
}: TradeUpQuickFillOptions): TradeUpQuickFillResult {
  const selected = selectedItems.slice(0, capacity)
  const selectedIds = new Set(selected.map((item) => item.instanceId))
  const remaining = Math.max(0, capacity - selected.length)
  if (remaining === 0) return { addedIds: [], itemIds: selected.map((item) => item.instanceId), message: 'The contract is already full.' }

  const seenIds = new Set<string>()
  const eligible = candidates.filter((item) => (
    !selectedIds.has(item.instanceId)
    && !seenIds.has(item.instanceId) && Boolean(seenIds.add(item.instanceId))
    && isTradeUpEligibleItem(item)
    && !getTradeUpCompatibilityReason(item, selected)
  ))

  let compatiblePool = eligible
  if (selected.length === 0) {
    const groups = [...tradeUpRarityOrder].reverse().flatMap((rarity) =>
      ['standard', 'stattrak'].map((group) => ({
        group,
        items: eligible.filter((item) => item.rarity === rarity && editionGroup(item) === group),
      })).filter((group) => group.items.length > 0),
    )
    const completeGroups = groups.filter((group) => group.items.length >= getTradeUpInputCount(group.items[0].rarity))
    if (completeGroups.length > 0) {
      if (mode === 'random') compatiblePool = completeGroups[Math.floor(random() * completeGroups.length)].items
      else if (mode === 'cheapest') compatiblePool = completeGroups.sort((left, right) => {
        const leftCost = sortCandidates(left.items, marketValues, mode, random).slice(0, remaining).reduce((total, item) => total + getCurrentItemMarketValue(item, marketValues), 0)
        const rightCost = sortCandidates(right.items, marketValues, mode, random).slice(0, remaining).reduce((total, item) => total + getCurrentItemMarketValue(item, marketValues), 0)
        return leftCost - rightCost
      })[0].items
      else if (mode === 'lowest-float') compatiblePool = completeGroups.sort((left, right) => sortCandidates(left.items, marketValues, mode, random)[0].floatValue - sortCandidates(right.items, marketValues, mode, random)[0].floatValue)[0].items
      else compatiblePool = completeGroups[0].items
    } else {
      compatiblePool = groups.sort((left, right) => right.items.length - left.items.length)[0]?.items ?? []
    }
  }

  const ordered = sortCandidates(compatiblePool, marketValues, mode, random)
  const requiresCompletePool = mode !== 'remaining'
  if (requiresCompletePool && ordered.length < remaining) {
    return {
      addedIds: [],
      itemIds: selected.map((item) => item.instanceId),
      message: `Need ${remaining} compatible eligible item${remaining === 1 ? '' : 's'}, but only ${ordered.length} match the current filters.`,
    }
  }

  const additions = ordered.slice(0, remaining)
  return {
    addedIds: additions.map((item) => item.instanceId),
    itemIds: [...selected.map((item) => item.instanceId), ...additions.map((item) => item.instanceId)],
    message: additions.length < remaining
      ? `Added ${additions.length}; ${remaining - additions.length} slot${remaining - additions.length === 1 ? '' : 's'} still need compatible eligible items.`
      : undefined,
  }
}
