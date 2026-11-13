import { describe, expect, it } from 'vitest'
import { defaultGameState } from '../data/gameState'
import { AutomationModuleId, PrestigeBonusId } from '../data/models'
import { BASE_INVENTORY_CAPACITY, getInventoryCapacity, getInventoryFreeSlots } from './inventoryCapacity'

describe('inventory capacity', () => {
  it('combines Warehouse, prestige, and Career storage capacity bonuses', () => {
    const state = {
      ...defaultGameState,
      automation: {
        ...defaultGameState.automation,
        modules: {
          ...defaultGameState.automation.modules,
          [AutomationModuleId.WarehouseSystem]: {
            ...defaultGameState.automation.modules[AutomationModuleId.WarehouseSystem],
            level: 2,
          },
        },
      },
      prestigeBonuses: { [PrestigeBonusId.InventoryCapacity]: 1 },
      careerUpgrades: {
        ...defaultGameState.careerUpgrades,
        levels: { 'collecting.storage-expansion': 4 },
      },
    }

    expect(getInventoryCapacity(state)).toBe(BASE_INVENTORY_CAPACITY + 1_500)
  })

  it('grandfathers over-capacity inventories without reporting negative free slots', () => {
    const state = {
      ...defaultGameState,
      inventory: Array.from({ length: BASE_INVENTORY_CAPACITY + 5 }),
    }

    expect(getInventoryFreeSlots(state)).toBe(0)
  })
})
