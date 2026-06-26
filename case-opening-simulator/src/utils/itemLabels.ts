import { Rarity, WearCondition, type SkinBase } from '../data/models'
import { getSkinRarityDisplayName } from '../data/rarities'

const wearLabels: Record<WearCondition, string> = {
  [WearCondition.FactoryNew]: 'Factory New',
  [WearCondition.MinimalWear]: 'Minimal Wear',
  [WearCondition.FieldTested]: 'Field-Tested',
  [WearCondition.WellWorn]: 'Well-Worn',
  [WearCondition.BattleScarred]: 'Battle-Scarred',
}

export function getRarityLabel(rarity: Rarity) {
  if (rarity === Rarity.MilSpec) {
    return 'Mil-Spec'
  }

  if (rarity === Rarity.SpecialItem) {
    return 'Special Item'
  }

  return rarity
}

export function getSkinRarityLabel(skin: SkinBase) {
  return getSkinRarityDisplayName(skin) ?? getRarityLabel(skin.rarity)
}

export function getWearLabel(wear: WearCondition) {
  return wearLabels[wear]
}
