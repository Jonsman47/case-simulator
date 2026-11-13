import {
  AutomationModuleId,
  type AutomationState,
  type PrestigeBonusLevels,
} from '../data/models'
import type { CareerUpgradeState } from '../career/careerUpgrades'
import { getCareerInventoryCapacityBonus } from '../career/careerUpgrades'
import { getPrestigeInventoryCapacityBonus } from '../data/prestige'
import { getWarehouseCapacityBonus } from './automation'

export const BASE_INVENTORY_CAPACITY = 250

export function getInventoryCapacity({
  automation,
  careerUpgrades,
  prestigeBonuses,
}: {
  automation: AutomationState
  careerUpgrades?: CareerUpgradeState
  prestigeBonuses: PrestigeBonusLevels
}) {
  const warehouseLevel = automation.modules[AutomationModuleId.WarehouseSystem]?.level ?? 0

  return (
    BASE_INVENTORY_CAPACITY +
    getWarehouseCapacityBonus(warehouseLevel) +
    getPrestigeInventoryCapacityBonus(prestigeBonuses) +
    (careerUpgrades ? getCareerInventoryCapacityBonus(careerUpgrades) : 0)
  )
}

export function getInventoryFreeSlots(
  state: Parameters<typeof getInventoryCapacity>[0] & { inventory: unknown[] },
) {
  return Math.max(0, getInventoryCapacity(state) - state.inventory.length)
}

export function hasInventorySpace(
  state: Parameters<typeof getInventoryFreeSlots>[0],
  requiredSlots = 1,
) {
  return getInventoryFreeSlots(state) >= Math.max(0, Math.floor(requiredSlots))
}
