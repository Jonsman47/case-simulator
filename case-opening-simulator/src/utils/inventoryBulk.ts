import {
  AutoSellRuleType,
  type PrestigeBonusLevels,
  Rarity,
  type SkillNodeId,
  type AutoSellRule,
  type CollectionRewardProgress,
  type SkinInstance,
  type UpgradeLevels,
} from '../data/models'
import { getCurrentItemMarketValue } from './inventory'
import { raritySortOrder } from './inventoryFilters'
import { applyCollectionSellValueBonus } from './collectionRewards'
import { getUpgradeSellValueMultiplier } from '../data/upgrades'
import { getPrestigeSellMultiplier } from '../data/prestige'
import { getSkillSellMultiplier } from '../data/skills'
import { isExceptionalPattern } from './skinPatterns'

type MarketValues = Record<string, number>

export interface BulkSaleSummary {
  lockedItems: SkinInstance[]
  saleableItems: SkinInstance[]
  selectedItems: SkinInstance[]
  totalValue: number
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2))
}

function getItemSaleValue(
  item: SkinInstance,
  marketValues: MarketValues,
  collectionRewards: CollectionRewardProgress[] = [],
  upgrades: UpgradeLevels = {},
  prestigeBonuses: PrestigeBonusLevels = {},
  learnedSkillNodeIds: SkillNodeId[] = [],
  collectionRewardMultiplier = 1,
) {
  const upgradedValue =
    getCurrentItemMarketValue(item, marketValues) *
    getUpgradeSellValueMultiplier(upgrades) *
    getPrestigeSellMultiplier(prestigeBonuses) *
    getSkillSellMultiplier(learnedSkillNodeIds)

  return applyCollectionSellValueBonus(
    upgradedValue,
    item,
    collectionRewards,
    collectionRewardMultiplier,
  )
}

function compareDuplicateKeeper(
  left: SkinInstance,
  right: SkinInstance,
  marketValues: MarketValues,
) {
  const valueDifference = getItemSaleValue(right, marketValues) - getItemSaleValue(left, marketValues)

  if (valueDifference !== 0) {
    return valueDifference
  }

  return left.floatValue - right.floatValue
}

function isAboveRarityThreshold(item: SkinInstance, rarityThreshold: Rarity | undefined) {
  if (!rarityThreshold) {
    return false
  }

  return raritySortOrder[item.rarity] > raritySortOrder[rarityThreshold]
}

function isQuickSellProtected(
  item: SkinInstance,
  marketValues: MarketValues,
  autoSellRules: AutoSellRule[],
) {
  if (item.isLocked || item.isFavorited) {
    return true
  }

  if (item.rarity === Rarity.SpecialItem || item.rarity === Rarity.Contraband) {
    return true
  }

  if (isExceptionalPattern(item)) {
    return true
  }

  return autoSellRules.some((rule) => {
    if (!rule.enabled) {
      return false
    }

    if (
      rule.type === AutoSellRuleType.ExcludedIds &&
      rule.excludedIds?.some((excludedId) => excludedId === item.id || excludedId === item.instanceId)
    ) {
      return true
    }

    if (rule.type === AutoSellRuleType.MaxRarity) {
      return isAboveRarityThreshold(item, rule.rarityThreshold)
    }

    if (rule.type === AutoSellRuleType.MinValue && typeof rule.valueThreshold === 'number') {
      return getItemSaleValue(item, marketValues) >= rule.valueThreshold
    }

    return false
  })
}

export function getBulkSaleSummary(
  inventory: SkinInstance[],
  marketValues: MarketValues,
  instanceIds: string[],
  collectionRewards: CollectionRewardProgress[] = [],
  upgrades: UpgradeLevels = {},
  prestigeBonuses: PrestigeBonusLevels = {},
  learnedSkillNodeIds: SkillNodeId[] = [],
  collectionRewardMultiplier = 1,
): BulkSaleSummary {
  const selectedIdSet = new Set(instanceIds)
  const selectedItems = inventory.filter((item) => selectedIdSet.has(item.instanceId))
  const lockedItems = selectedItems.filter((item) => item.isLocked)
  const saleableItems = selectedItems.filter((item) => !item.isLocked)
  const totalValue = roundCurrency(
    saleableItems.reduce(
      (total, item) => total + getItemSaleValue(
        item,
        marketValues,
        collectionRewards,
        upgrades,
        prestigeBonuses,
        learnedSkillNodeIds,
        collectionRewardMultiplier,
      ),
      0,
    ),
  )

  return {
    lockedItems,
    saleableItems,
    selectedItems,
    totalValue,
  }
}

export function getSelectedItemsValue(
  inventory: SkinInstance[],
  marketValues: MarketValues,
  instanceIds: string[],
  collectionRewards: CollectionRewardProgress[] = [],
  upgrades: UpgradeLevels = {},
  prestigeBonuses: PrestigeBonusLevels = {},
  learnedSkillNodeIds: SkillNodeId[] = [],
  collectionRewardMultiplier = 1,
) {
  return getBulkSaleSummary(
    inventory,
    marketValues,
    instanceIds,
    collectionRewards,
    upgrades,
    prestigeBonuses,
    learnedSkillNodeIds,
    collectionRewardMultiplier,
  ).totalValue
}

export function selectDuplicates(
  inventory: SkinInstance[],
  marketValues: MarketValues,
  autoSellRules: AutoSellRule[] = [],
) {
  const itemsBySkinId = inventory.reduce<Map<string, SkinInstance[]>>((groups, item) => {
    const group = groups.get(item.id) ?? []

    group.push(item)
    groups.set(item.id, group)

    return groups
  }, new Map())
  const selectedIds: string[] = []

  for (const group of itemsBySkinId.values()) {
    if (group.length < 2) {
      continue
    }

    const [keeper] = [...group].sort((left, right) => {
      return compareDuplicateKeeper(left, right, marketValues)
    })

    for (const item of group) {
      if (item.instanceId === keeper.instanceId) {
        continue
      }

      if (!isQuickSellProtected(item, marketValues, autoSellRules)) {
        selectedIds.push(item.instanceId)
      }
    }
  }

  return selectedIds
}
