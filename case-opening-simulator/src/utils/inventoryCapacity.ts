import {
  AutomationModuleId,
  type AutomationState,
  type PrestigeBonusLevels,
  type SkillNodeId,
  type UpgradeLevels,
} from '../data/models'
import { getPrestigeInventoryCapacityBonus } from '../data/prestige'
import { getSkillInventoryCapacityBonus } from '../data/skills'
import { getWarehouseUpgradeCapacityBonus } from '../data/upgrades'
import { getWarehouseCapacityBonus } from './automation'

export const BASE_INVENTORY_CAPACITY = 250

export function getInventoryCapacity({
  automation,
  learnedSkillNodeIds,
  prestigeBonuses,
  upgrades,
}: {
  automation: AutomationState
  learnedSkillNodeIds: SkillNodeId[]
  prestigeBonuses: PrestigeBonusLevels
  upgrades: UpgradeLevels
}) {
  const warehouseLevel = automation.modules[AutomationModuleId.WarehouseSystem]?.level ?? 0

  return (
    BASE_INVENTORY_CAPACITY +
    getWarehouseCapacityBonus(warehouseLevel) +
    getWarehouseUpgradeCapacityBonus(upgrades) +
    getPrestigeInventoryCapacityBonus(prestigeBonuses) +
    getSkillInventoryCapacityBonus(learnedSkillNodeIds)
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
