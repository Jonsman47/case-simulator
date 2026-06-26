import { Rarity, WearCondition, type SkinInstance } from '../data/models'

export type SortCriterion =
  | 'valueDesc'
  | 'valueAsc'
  | 'rarityDesc'
  | 'rarityAsc'
  | 'newest'
  | 'oldest'
  | 'wearBest'
  | 'wearWorst'
  | 'nameAsc'
  | 'nameDesc'

export interface InventoryFilters {
  search: string
  rarities: Rarity[]
  wearConditions: WearCondition[]
  lockedOnly: boolean
  favoritedOnly: boolean
  duplicatesOnly: boolean
}

export interface InventoryViewUiState {
  filters: InventoryFilters
  sortCriterion: SortCriterion
}

export const defaultInventoryFilters: InventoryFilters = {
  search: '',
  rarities: [],
  wearConditions: [],
  lockedOnly: false,
  favoritedOnly: false,
  duplicatesOnly: false,
}

export const defaultInventoryViewUiState: InventoryViewUiState = {
  filters: defaultInventoryFilters,
  sortCriterion: 'newest',
}

export const raritySortOrder: Record<Rarity, number> = {
  [Rarity.Consumer]: 1,
  [Rarity.Industrial]: 2,
  [Rarity.MilSpec]: 3,
  [Rarity.Restricted]: 4,
  [Rarity.Classified]: 5,
  [Rarity.Covert]: 6,
  [Rarity.SpecialItem]: 7,
  [Rarity.Contraband]: 8,
}

export const wearSortOrder: Record<WearCondition, number> = {
  [WearCondition.FactoryNew]: 1,
  [WearCondition.MinimalWear]: 2,
  [WearCondition.FieldTested]: 3,
  [WearCondition.WellWorn]: 4,
  [WearCondition.BattleScarred]: 5,
}

const inventoryNameCollator = new Intl.Collator(undefined, { sensitivity: 'base' })

function compareText(left: string, right: string) {
  return inventoryNameCollator.compare(left, right)
}

function getItemName(item: SkinInstance) {
  return `${item.weapon} ${item.finish}`
}

function getSortComparator(criterion: SortCriterion) {
  return (left: SkinInstance, right: SkinInstance) => {
    switch (criterion) {
      case 'valueDesc':
        return right.marketValue - left.marketValue
      case 'valueAsc':
        return left.marketValue - right.marketValue
      case 'rarityDesc':
        return raritySortOrder[right.rarity] - raritySortOrder[left.rarity]
      case 'rarityAsc':
        return raritySortOrder[left.rarity] - raritySortOrder[right.rarity]
      case 'newest':
        return right.discoveredAt - left.discoveredAt
      case 'oldest':
        return left.discoveredAt - right.discoveredAt
      case 'wearBest': {
        const wearComparison = wearSortOrder[left.wear] - wearSortOrder[right.wear]

        return wearComparison || left.floatValue - right.floatValue
      }
      case 'wearWorst': {
        const wearComparison = wearSortOrder[right.wear] - wearSortOrder[left.wear]

        return wearComparison || right.floatValue - left.floatValue
      }
      case 'nameAsc':
        return compareText(getItemName(left), getItemName(right))
      case 'nameDesc':
        return compareText(getItemName(right), getItemName(left))
      default:
        return 0
    }
  }
}

export function getDuplicateSkinIds(inventory: SkinInstance[]) {
  const counts = inventory.reduce<Record<string, number>>((skinCounts, item) => {
    skinCounts[item.id] = (skinCounts[item.id] ?? 0) + 1
    return skinCounts
  }, {})

  return new Set(
    Object.entries(counts)
      .filter(([, count]) => count > 1)
      .map(([skinId]) => skinId),
  )
}

export function sortInventory(items: SkinInstance[], criterion: SortCriterion): SkinInstance[] {
  if (items.length <= 1) {
    return [...items]
  }

  const compare = getSortComparator(criterion)

  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => compare(left.item, right.item) || left.index - right.index)
    .map(({ item }) => item)
}

export function filterInventory(inventory: SkinInstance[], filters: InventoryFilters) {
  const rarityFilter = filters.rarities.length > 0 ? new Set(filters.rarities) : undefined
  const wearFilter = filters.wearConditions.length > 0 ? new Set(filters.wearConditions) : undefined
  const duplicateSkinIds = filters.duplicatesOnly ? getDuplicateSkinIds(inventory) : undefined
  const search = filters.search.trim().toLowerCase()
  const hasSearch = search.length > 0

  return inventory.filter((item) => {
    if (hasSearch) {
      const weapon = item.weapon.toLowerCase()
      const finish = item.finish.toLowerCase()

      if (
        !weapon.includes(search) &&
        !finish.includes(search) &&
        !`${weapon} ${finish}`.includes(search)
      ) {
        return false
      }
    }

    if (rarityFilter && !rarityFilter.has(item.rarity)) {
      return false
    }

    if (wearFilter && !wearFilter.has(item.wear)) {
      return false
    }

    if (filters.lockedOnly && !item.isLocked) {
      return false
    }

    if (filters.favoritedOnly && !item.isFavorited) {
      return false
    }

    if (duplicateSkinIds && !duplicateSkinIds.has(item.id)) {
      return false
    }

    return true
  })
}

export function filterAndSortInventory(
  inventory: SkinInstance[],
  filters: InventoryFilters,
  sortCriterion: SortCriterion,
) {
  return sortInventory(filterInventory(inventory, filters), sortCriterion)
}
