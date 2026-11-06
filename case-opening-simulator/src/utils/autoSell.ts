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
import { getInstantSaleRate } from '../marketplace/marketplace'

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
  const duplicateRule = rules.find((rule) => rule.enabled && rule.type === AutoSellRuleType.SellDuplicatesKeepOne)
  const rarePatternProtected = duplicateRule?.protectRarePatterns !== false && isExceptionalPattern(item)
  const specialProtected = duplicateRule?.protectSpecialItems !== false && Boolean(duplicateRule) && isSpecialOrKnife(item)
  const statTrakProtected = Boolean(duplicateRule) && item.statTrak && duplicateRule?.includeStatTrak !== true
  const souvenirProtected = Boolean(duplicateRule) && item.souvenir && duplicateRule?.includeSouvenir !== true
  return item.isLocked || item.isFavorited || rarePatternProtected || specialProtected || statTrakProtected || souvenirProtected || hasFactoryNewProtection(item, rules)
}

function sortDuplicateCopies(inventory: SkinInstance[], skinId: string) {
  const matchingItems = inventory.filter((item) => item.id === skinId)
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
  })
}

export function getDuplicateKeeper(inventory: SkinInstance[], skinId: string) {
  return sortDuplicateCopies(inventory, skinId)[0]
}

export function getKeepBestDuplicateSaleCandidates(inventory: SkinInstance[], rules: AutoSellRule[]) {
  const isEnabled = rules.some((rule) => rule.enabled && rule.type === AutoSellRuleType.SellDuplicatesKeepOne)
  if (!isEnabled) return []

  const groups = new Map<string, SkinInstance[]>()
  for (const item of inventory) groups.set(item.id, [...(groups.get(item.id) ?? []), item])

  return [...groups.values()].flatMap((copies) => {
    if (copies.length <= 1) return []
    const duplicateRule = rules.find((rule) => rule.enabled && rule.type === AutoSellRuleType.SellDuplicatesKeepOne)
    const keepCount = Math.max(1, Math.floor(duplicateRule?.keepCount ?? 1))
    const protectedCopies = copies.filter((item) => isProtectedFromAutoSell(item, rules))
    const eligibleCopies = copies.filter((item) => !isProtectedFromAutoSell(item, rules))
    const keptEligibleIds = new Set(sortDuplicateCopies(eligibleCopies, copies[0].id).slice(0, keepCount).map((item) => item.instanceId))

    // Protected copies are retained in addition to the requested eligible keep
    // count. This conservative behavior cannot sacrifice a valuable usable copy
    // merely because another copy is locked or favorited.
    void protectedCopies
    return eligibleCopies.filter((item) => !keptEligibleIds.has(item.instanceId))
  })
}

function isDuplicateCopyToSell(item: SkinInstance, inventory: SkinInstance[], keepCount = 1) {
  const matchingItems = inventory.filter((inventoryItem) => inventoryItem.id === item.id)

  if (matchingItems.length <= 1) {
    return false
  }

  const keepers = new Set(sortDuplicateCopies(inventory, item.id).slice(0, Math.max(1, keepCount)).map((copy) => copy.instanceId))
  return !keepers.has(item.instanceId)
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
      return isDuplicateCopyToSell(item, inventory, Math.floor(rule.keepCount ?? 1)) ? true : false
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
    totalValue: roundCurrency(items.reduce((total, item) => total + item.marketValue * getInstantSaleRate(item), 0)),
  }
}
