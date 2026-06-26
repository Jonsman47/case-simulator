import { Rarity, WearCondition, type CollectionEntry, type SkinBase, type SkinInstance } from '../data/models'

export const wearConditionOrder = [
  WearCondition.FactoryNew,
  WearCondition.MinimalWear,
  WearCondition.FieldTested,
  WearCondition.WellWorn,
  WearCondition.BattleScarred,
]

export const wearShortLabels: Record<WearCondition, string> = {
  [WearCondition.FactoryNew]: 'FN',
  [WearCondition.MinimalWear]: 'MW',
  [WearCondition.FieldTested]: 'FT',
  [WearCondition.WellWorn]: 'WW',
  [WearCondition.BattleScarred]: 'BS',
}

export const rarityCollectionOrder = [
  Rarity.Consumer,
  Rarity.Industrial,
  Rarity.MilSpec,
  Rarity.Restricted,
  Rarity.Classified,
  Rarity.Covert,
  Rarity.SpecialItem,
  Rarity.Contraband,
]

export interface CollectionProgressBucket {
  discovered: number
  percentage: number
  total: number
}

export interface CollectionProgress {
  byRarity: Record<Rarity, CollectionProgressBucket>
  discovered: number
  percentage: number
  total: number
}

export interface SkinCollectionRow {
  entry: CollectionEntry | undefined
  holdsBestFloat: boolean
  holdsHighestValue: boolean
  isCompletedWearSet: boolean
  isDiscovered: boolean
  skin: SkinBase
}

function percent(discovered: number, total: number) {
  if (total <= 0) {
    return 0
  }

  return Number(((discovered / total) * 100).toFixed(1))
}

export function getCollectionEntryMap(collectionBook: CollectionEntry[]) {
  return new Map(collectionBook.map((entry) => [entry.skinId, entry]))
}

export function isCompletedWearSet(entry: CollectionEntry | undefined) {
  if (!entry) {
    return false
  }

  const foundWearConditions = new Set(entry.foundWearConditions)

  return wearConditionOrder.every((wear) => foundWearConditions.has(wear))
}

function hasSameNumber(left: number | undefined, right: number, tolerance = 0.000001) {
  return typeof left === 'number' && Math.abs(left - right) <= tolerance
}

export function getHeldCollectionRecords(
  skinId: string,
  entry: CollectionEntry | undefined,
  inventory: SkinInstance[],
) {
  if (!entry) {
    return {
      holdsBestFloat: false,
      holdsHighestValue: false,
    }
  }

  const matchingItems = inventory.filter((item) => item.id === skinId)

  return {
    holdsBestFloat: matchingItems.some((item) => hasSameNumber(entry.bestFloat, item.floatValue)),
    holdsHighestValue: matchingItems.some((item) => hasSameNumber(entry.highestValue, item.marketValue)),
  }
}

export function buildSkinCollectionRows(
  skins: SkinBase[],
  collectionBook: CollectionEntry[],
  inventory: SkinInstance[],
): SkinCollectionRow[] {
  const entryMap = getCollectionEntryMap(collectionBook)

  return skins.map((skin) => {
    const entry = entryMap.get(skin.id)
    const records = getHeldCollectionRecords(skin.id, entry, inventory)

    return {
      skin,
      entry,
      isDiscovered: Boolean(entry),
      isCompletedWearSet: isCompletedWearSet(entry),
      holdsBestFloat: records.holdsBestFloat,
      holdsHighestValue: records.holdsHighestValue,
    }
  })
}

export function calculateCollectionCompletion(
  skins: SkinBase[],
  collectionBook: CollectionEntry[],
): CollectionProgress {
  const entryMap = getCollectionEntryMap(collectionBook)
  const byRarity = rarityCollectionOrder.reduce(
    (progressByRarity, rarity) => {
      const raritySkins = skins.filter((skin) => skin.rarity === rarity)
      const discovered = raritySkins.filter((skin) => entryMap.has(skin.id)).length

      return {
        ...progressByRarity,
        [rarity]: {
          discovered,
          total: raritySkins.length,
          percentage: percent(discovered, raritySkins.length),
        },
      }
    },
    {} as Record<Rarity, CollectionProgressBucket>,
  )
  const discovered = skins.filter((skin) => entryMap.has(skin.id)).length

  return {
    discovered,
    total: skins.length,
    percentage: percent(discovered, skins.length),
    byRarity,
  }
}
