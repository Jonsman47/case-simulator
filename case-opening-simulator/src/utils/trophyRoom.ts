import { Rarity, type SkinInstance, type TrophyAssignments } from '../data/models'
import { getSkillTrophySlotBonus } from '../data/skills'
import { getMarketAdjustedSkinConditionPrice } from '../data/skinPrices'
import { applyWearMultiplier } from './wear'

export interface TrophySlotDefinition {
  id: string
  index: number
  title: string
}

const rarityScore: Record<Rarity, number> = {
  [Rarity.Consumer]: 1,
  [Rarity.Industrial]: 2,
  [Rarity.MilSpec]: 3,
  [Rarity.Restricted]: 4,
  [Rarity.Classified]: 5,
  [Rarity.Covert]: 6,
  [Rarity.SpecialItem]: 7,
  [Rarity.Contraband]: 8,
}

export const BASE_TROPHY_SLOT_COUNT = 12
export const TROPHY_SLOT_ID_PREFIX = 'showcase_'

export function createTrophySlotId(index: number) {
  return `${TROPHY_SLOT_ID_PREFIX}${index}`
}

export function getTrophyRoomSlotCount(learnedSkillNodeIds: string[] = []) {
  return BASE_TROPHY_SLOT_COUNT + getSkillTrophySlotBonus(learnedSkillNodeIds)
}

export function createTrophySlotDefinitions(slotCount = BASE_TROPHY_SLOT_COUNT): TrophySlotDefinition[] {
  return Array.from({ length: Math.max(BASE_TROPHY_SLOT_COUNT, Math.floor(slotCount)) }, (_, index) => {
    const displayIndex = index + 1

    return {
      id: createTrophySlotId(displayIndex),
      index: displayIndex,
      title: `Showcase Slot ${displayIndex}`,
    }
  })
}

export const TROPHY_SLOT_DEFINITIONS = createTrophySlotDefinitions()
export const trophySlotDefinitionsById = new Map(TROPHY_SLOT_DEFINITIONS.map((slot) => [slot.id, slot]))

function getTrophyItemValue(item: SkinInstance, marketValues?: Record<string, number>) {
  const generatedPrice = getMarketAdjustedSkinConditionPrice({
    fallbackValue: undefined,
    isStatTrak: Boolean(item.statTrak),
    marketValues,
    skin: item,
    wear: item.wear,
  })

  if (typeof generatedPrice === 'number') {
    return generatedPrice
  }

  const currentBaseValue = marketValues?.[item.id]

  if (typeof currentBaseValue === 'number') {
    return applyWearMultiplier(currentBaseValue, item.wear, item.floatValue)
  }

  return item.marketValue
}

export function createDefaultTrophyAssignments(): TrophyAssignments {
  return {}
}

export function getTrophyAssignmentsList(trophyAssignments: TrophyAssignments) {
  return Object.values(trophyAssignments)
    .filter((assignment): assignment is NonNullable<typeof assignment> => Boolean(assignment))
    .sort((left, right) => left.slotId.localeCompare(right.slotId, undefined, { numeric: true }))
}

export function isUnlockedTrophySlot(slotId: string, learnedSkillNodeIds: string[] = []) {
  const match = new RegExp(`^${TROPHY_SLOT_ID_PREFIX}(\\d+)$`).exec(slotId)
  const slotIndex = match ? Number.parseInt(match[1], 10) : 0

  return Number.isFinite(slotIndex) && slotIndex >= 1 && slotIndex <= getTrophyRoomSlotCount(learnedSkillNodeIds)
}

export function getTrophyScore(trophyAssignments: TrophyAssignments) {
  const assignments = getTrophyAssignmentsList(trophyAssignments)
  const items = assignments
    .map((assignment) => assignment.itemId)
    .filter(Boolean)
  const combinedValue = assignments.reduce(
    (total) => total,
    0,
  )

  return Math.round(combinedValue + items.length * 50)
}

export function getTrophyScoreForInventory(
  trophyAssignments: TrophyAssignments,
  inventory: SkinInstance[],
  marketValues?: Record<string, number>,
) {
  const inventoryById = new Map(inventory.map((item) => [item.instanceId, item]))
  const items = getTrophyAssignmentsList(trophyAssignments)
    .map((assignment) => inventoryById.get(assignment.itemId))
    .filter((item): item is SkinInstance => Boolean(item))
  const combinedValue = items.reduce((total, item) => total + getTrophyItemValue(item, marketValues), 0)
  const rarityBonus = items.reduce((total, item) => total + rarityScore[item.rarity] * 25, 0)

  return Math.round(combinedValue + rarityBonus + items.length * 50)
}

export function getTrophyCombinedValue(
  trophyAssignments: TrophyAssignments,
  inventory: SkinInstance[] = [],
  marketValues?: Record<string, number>,
) {
  const inventoryById = new Map(inventory.map((item) => [item.instanceId, item]))

  return Number(
    getTrophyAssignmentsList(trophyAssignments)
      .reduce((total, assignment) => {
        const item = inventoryById.get(assignment.itemId)

        return item ? total + getTrophyItemValue(item, marketValues) : total
      }, 0)
      .toFixed(2),
  )
}

export function getMissingTrophyAssignments(
  trophyAssignments: TrophyAssignments,
  inventory: SkinInstance[],
) {
  const inventoryIds = new Set(inventory.map((item) => item.instanceId))

  return getTrophyAssignmentsList(trophyAssignments).filter((assignment) => {
    return !inventoryIds.has(assignment.itemId)
  })
}

export function getTrophyInventoryItem(
  trophyAssignments: TrophyAssignments,
  inventory: SkinInstance[],
  slotId: string,
) {
  const assignment = trophyAssignments[slotId]

  if (!assignment) {
    return undefined
  }

  return inventory.find((item) => item.instanceId === assignment.itemId)
}

export function getTrophyDisplayItem(
  trophyAssignments: TrophyAssignments,
  inventory: SkinInstance[],
  slotId: string,
) {
  return getTrophyInventoryItem(trophyAssignments, inventory, slotId)
}

export function getFirstAvailableTrophySlot(trophyAssignments: TrophyAssignments, learnedSkillNodeIds: string[] = []) {
  return createTrophySlotDefinitions(getTrophyRoomSlotCount(learnedSkillNodeIds))
    .find((slot) => !trophyAssignments[slot.id])
    ?.id ?? createTrophySlotId(1)
}
