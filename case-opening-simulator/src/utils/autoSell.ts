import {
  AutoSellRuleType,
  Rarity,
  WearCondition,
  type AutoSellRule,
  type SkinInstance,
} from '../data/models'
import { raritySortOrder, wearSortOrder } from './inventoryFilters'
import { roundCurrency } from './safeNumbers'
import { isExceptionalPattern } from './skinPatterns'

export interface AutoSellDecision {
  matchedRule?: AutoSellRule
  shouldSell: boolean
}

export interface AutoSellSimulation {
  items: SkinInstance[]
  totalValue: number
}

function isSpecialOrKnife(item: SkinInstance) {
  const weapon = item.weapon.toLowerCase()

  return (
    item.rarity === Rarity.SpecialItem ||
    item.rarity === Rarity.Contraband ||
    weapon.includes('knife') ||
    weapon.includes('glove') ||
    item.weapon.includes('★')
  )
}

function hasFactoryNewProtection(item: SkinInstance, rules: AutoSellRule[]) {
  return (
    item.wear === WearCondition.FactoryNew &&
    rules.some((rule) => rule.enabled && rule.type === AutoSellRuleType.KeepFactoryNew)
  )
}

function isProtectedFromAutoSell(item: SkinInstance, rules: AutoSellRule[]) {
  return item.isLocked || item.isFavorited || isExceptionalPattern(item) || hasFactoryNewProtection(item, rules)
}

export function getDuplicateKeeper(inventory: SkinInstance[], skinId: string) {
  const matchingItems = inventory.filter((item) => item.id === skinId)

  if (matchingItems.length === 0) {
    return undefined
  }

  return [...matchingItems].sort((left, right) => {
    const valueDifference = right.marketValue - left.marketValue

    if (valueDifference !== 0) {
      return valueDifference
    }

    const floatDifference = left.floatValue - right.floatValue

    if (floatDifference !== 0) {
      return floatDifference
    }

    const discoveryDifference = left.discoveredAt - right.discoveredAt

    return discoveryDifference !== 0
      ? discoveryDifference
      : left.instanceId.localeCompare(right.instanceId)
  })[0]
}

export function getKeepBestDuplicateSaleCandidates(inventory: SkinInstance[], rules: AutoSellRule[]) {
  const isEnabled = rules.some((rule) => rule.enabled && rule.type === AutoSellRuleType.SellDuplicatesKeepOne)
  if (!isEnabled) return []

  const groups = new Map<string, SkinInstance[]>()
  for (const item of inventory) groups.set(item.id, [...(groups.get(item.id) ?? []), item])

  return [...groups.values()].flatMap((copies) => {
    if (copies.length <= 1) return []
    const protectedCopies = copies.filter((item) => isProtectedFromAutoSell(item, rules))
    const eligibleCopies = copies.filter((item) => !isProtectedFromAutoSell(item, rules))
    const eligibleKeeper = getDuplicateKeeper(eligibleCopies, copies[0].id)

    // Protected copies never become sale candidates. When one exists, the best
    // eligible copy is also retained so enabling the rule cannot discard a more
    // valuable usable copy merely because the protected one must remain.
    if (protectedCopies.length > 0) {
      return eligibleCopies.filter((item) => item.instanceId !== eligibleKeeper?.instanceId)
    }

    return eligibleCopies.filter((item) => item.instanceId !== eligibleKeeper?.instanceId)
  })
}

function isDuplicateCopyToSell(item: SkinInstance, inventory: SkinInstance[]) {
  const matchingItems = inventory.filter((inventoryItem) => inventoryItem.id === item.id)

  if (matchingItems.length <= 1) {
    return false
  }

  return getDuplicateKeeper(inventory, item.id)?.instanceId !== item.instanceId
}

function evaluateRule(
  item: SkinInstance,
  rule: AutoSellRule,
  inventory: SkinInstance[],
): boolean | undefined {
  switch (rule.type) {
    case AutoSellRuleType.KeepFactoryNew:
      return item.wear === WearCondition.FactoryNew ? false : undefined
    case AutoSellRuleType.MinValue:
      return typeof rule.valueThreshold === 'number' && item.marketValue < rule.valueThreshold
    case AutoSellRuleType.SellBelowValuePerRarity: {
      const threshold = rule.valueThresholdsByRarity?.[item.rarity]

      return typeof threshold === 'number' && item.marketValue < threshold
    }
    case AutoSellRuleType.SellNonFavoritedBelow:
      return (
        !item.isFavorited &&
        typeof rule.valueThreshold === 'number' &&
        item.marketValue < rule.valueThreshold
      )
    case AutoSellRuleType.SellNonKnifeUnderValue:
      if (isSpecialOrKnife(item) && typeof rule.valueThreshold === 'number' && item.marketValue < rule.valueThreshold) {
        return false
      }

      return (
        !isSpecialOrKnife(item) &&
        typeof rule.valueThreshold === 'number' &&
        item.marketValue < rule.valueThreshold
      )
    case AutoSellRuleType.MaxRarity:
      return (
        Boolean(rule.rarityThreshold) &&
        raritySortOrder[item.rarity] <= raritySortOrder[rule.rarityThreshold!]
      )
    case AutoSellRuleType.MaxWear:
    case AutoSellRuleType.SellWearBelow:
      return (
        Boolean(rule.wearThreshold) &&
        wearSortOrder[item.wear] > wearSortOrder[rule.wearThreshold!]
      )
    case AutoSellRuleType.SellDuplicates:
      return isDuplicateCopyToSell(item, inventory)
    case AutoSellRuleType.SellDuplicatesKeepOne:
      return isDuplicateCopyToSell(item, inventory) ? true : false
    default:
      return undefined
  }
}

export function evaluateAutoSell(
  item: SkinInstance,
  rules: AutoSellRule[],
  inventory: SkinInstance[] = [],
): AutoSellDecision {
  if (isProtectedFromAutoSell(item, rules)) {
    return { shouldSell: false }
  }

  for (const rule of rules) {
    if (!rule.enabled) {
      continue
    }

    const decision = evaluateRule(item, rule, inventory)

    if (typeof decision === 'boolean') {
      return {
        matchedRule: rule,
        shouldSell: decision,
      }
    }
  }

  return { shouldSell: false }
}

export function shouldAutoSell(
  item: SkinInstance,
  rules: AutoSellRule[],
  inventory: SkinInstance[] = [],
) {
  return evaluateAutoSell(item, rules, inventory).shouldSell
}

export function simulateAutoSell(inventory: SkinInstance[], rules: AutoSellRule[]): AutoSellSimulation {
  const items = inventory.filter((item) => evaluateAutoSell(item, rules, inventory).shouldSell)

  return {
    items,
    totalValue: roundCurrency(items.reduce((total, item) => total + item.marketValue, 0)),
  }
}
