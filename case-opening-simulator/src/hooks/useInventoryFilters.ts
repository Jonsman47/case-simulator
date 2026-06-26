import { useMemo } from 'react'
import type { SkinInstance } from '../data/models'
import {
  defaultInventoryFilters,
  defaultInventoryViewUiState,
  filterAndSortInventory,
  filterInventory,
  getDuplicateSkinIds,
  sortInventory,
  type InventoryFilters,
  type InventoryViewUiState,
  type SortCriterion,
} from '../utils/inventoryFilters'

export {
  defaultInventoryFilters,
  defaultInventoryViewUiState,
  filterAndSortInventory,
  filterInventory,
  getDuplicateSkinIds,
  sortInventory,
  type InventoryFilters,
  type InventoryViewUiState,
  type SortCriterion,
}

export function useInventoryFilters(
  inventory: SkinInstance[],
  filters: InventoryFilters,
  sortCriterion: SortCriterion,
) {
  return useMemo(() => {
    return filterAndSortInventory(inventory, filters, sortCriterion)
  }, [filters, inventory, sortCriterion])
}
