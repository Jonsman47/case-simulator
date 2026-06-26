import { Rarity, TrophySlotId, type SkinInstance, type TrophyAssignments } from '../data/models'
import { getRarityLabel, getWearLabel } from './itemLabels'
import { applyWearMultiplier } from './wear'

export interface TrophySlotDefinition {
  id: TrophySlotId
  title: string
  subtitle: string
  statLabel: string
  getStatValue: (item: SkinInstance) => string
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(value)
}

function formatProfit(item: SkinInstance) {
  const profit = item.marketValue - item.baseValue

  return `${profit >= 0 ? '+' : ''}${formatCurrency(profit)}`
}

function getTrophyItemValue(item: SkinInstance, marketValues?: Record<string, number>) {
  const currentBaseValue = marketValues?.[item.id]

  if (typeof currentBaseValue === 'number') {
    return applyWearMultiplier(currentBaseValue, item.wear, item.floatValue)
  }

  return item.marketValue
}

export const TROPHY_SLOT_DEFINITIONS: TrophySlotDefinition[] = [
  {
    id: TrophySlotId.BestKnife,
    title: 'Best Knife',
    subtitle: 'Blade spotlight',
    statLabel: 'Value',
    getStatValue: (item) => formatCurrency(item.marketValue),
  },
  {
    id: TrophySlotId.BestGloves,
    title: 'Best Gloves',
    subtitle: 'Gold rack',
    statLabel: 'Value',
    getStatValue: (item) => formatCurrency(item.marketValue),
  },
  {
    id: TrophySlotId.MostExpensiveSkin,
    title: 'Most Expensive Skin',
    subtitle: 'Market crown',
    statLabel: 'Market Value',
    getStatValue: (item) => formatCurrency(item.marketValue),
  },
  {
    id: TrophySlotId.RarestSkin,
    title: 'Rarest Skin',
    subtitle: 'Rarity plinth',
    statLabel: 'Rarity',
    getStatValue: (item) => getRarityLabel(item.rarity),
  },
  {
    id: TrophySlotId.BestFloat,
    title: 'Best Float',
    subtitle: 'Precision display',
    statLabel: 'Float',
    getStatValue: (item) => item.floatValue.toFixed(3),
  },
  {
    id: TrophySlotId.BiggestProfitPull,
    title: 'Biggest Profit Pull',
    subtitle: 'Profit marker',
    statLabel: 'Profit',
    getStatValue: formatProfit,
  },
  {
    id: TrophySlotId.FavouriteCollection,
    title: 'Favourite Collection',
    subtitle: 'Personal hall',
    statLabel: 'Wear',
    getStatValue: (item) => getWearLabel(item.wear),
  },
]

export const trophySlotDefinitionsById = new Map(TROPHY_SLOT_DEFINITIONS.map((slot) => [slot.id, slot]))

export function createDefaultTrophyAssignments(): TrophyAssignments {
  return {}
}

export function getTrophyAssignmentsList(trophyAssignments: TrophyAssignments) {
  return TROPHY_SLOT_DEFINITIONS
    .map((slot) => trophyAssignments[slot.id])
    .filter((assignment): assignment is NonNullable<typeof assignment> => Boolean(assignment))
}

export function getTrophyScore(trophyAssignments: TrophyAssignments, marketValues?: Record<string, number>) {
  const assignments = getTrophyAssignmentsList(trophyAssignments)
  const combinedValue = assignments.reduce(
    (total, assignment) => total + getTrophyItemValue(assignment.item, marketValues),
    0,
  )
  const rarityBonus = assignments.reduce(
    (total, assignment) => total + rarityScore[assignment.item.rarity] * 25,
    0,
  )

  return Math.round(combinedValue + rarityBonus + assignments.length * 50)
}

export function getTrophyCombinedValue(trophyAssignments: TrophyAssignments, marketValues?: Record<string, number>) {
  return Number(
    getTrophyAssignmentsList(trophyAssignments)
      .reduce((total, assignment) => total + getTrophyItemValue(assignment.item, marketValues), 0)
      .toFixed(2),
  )
}

export function getMissingTrophyAssignments(
  trophyAssignments: TrophyAssignments,
  inventory: SkinInstance[],
) {
  const inventoryIds = new Set(inventory.map((item) => item.instanceId))

  return getTrophyAssignmentsList(trophyAssignments).filter((assignment) => {
    return !inventoryIds.has(assignment.item.instanceId)
  })
}

export function getTrophyInventoryItem(
  trophyAssignments: TrophyAssignments,
  inventory: SkinInstance[],
  slotId: TrophySlotId,
) {
  const assignment = trophyAssignments[slotId]

  if (!assignment) {
    return undefined
  }

  return inventory.find((item) => item.instanceId === assignment.item.instanceId)
}

export function getTrophyDisplayItem(
  trophyAssignments: TrophyAssignments,
  inventory: SkinInstance[],
  slotId: TrophySlotId,
) {
  return getTrophyInventoryItem(trophyAssignments, inventory, slotId) ?? trophyAssignments[slotId]?.item
}

export function isKnifeItem(item: SkinInstance) {
  const weapon = item.weapon.toLowerCase()

  return weapon.includes('knife') || weapon.includes('karambit')
}

export function isGloveItem(item: SkinInstance) {
  return item.weapon.toLowerCase().includes('glove')
}

export function getRecommendedTrophySlot(
  item: SkinInstance,
  state: { trophyAssignments: TrophyAssignments },
) {
  if (isKnifeItem(item)) {
    return TrophySlotId.BestKnife
  }

  if (isGloveItem(item)) {
    return TrophySlotId.BestGloves
  }

  const currentMostExpensive = state.trophyAssignments[TrophySlotId.MostExpensiveSkin]?.item

  if (!currentMostExpensive || item.marketValue > currentMostExpensive.marketValue) {
    return TrophySlotId.MostExpensiveSkin
  }

  return TrophySlotId.FavouriteCollection
}
