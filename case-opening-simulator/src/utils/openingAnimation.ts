import { Rarity, type CaseDefinition, type SkinBase, type SkinInstance } from '../data/models'

export interface WeightedSkinOption {
  skin: SkinBase
  weight: number
}

export const openingRarityRank: Record<Rarity, number> = {
  [Rarity.Consumer]: 0,
  [Rarity.Industrial]: 1,
  [Rarity.MilSpec]: 2,
  [Rarity.Restricted]: 3,
  [Rarity.Classified]: 4,
  [Rarity.Covert]: 5,
  [Rarity.SpecialItem]: 6,
  [Rarity.Contraband]: 7,
}

export function isPremiumRevealDrop(item: Pick<SkinInstance, 'rarity'>) {
  return (
    item.rarity === Rarity.Covert ||
    item.rarity === Rarity.SpecialItem ||
    item.rarity === Rarity.Contraband
  )
}

export function isHighlightedRecentDrop(item: Pick<SkinInstance, 'rarity'>) {
  return openingRarityRank[item.rarity] >= openingRarityRank[Rarity.Classified]
}

export function shouldPlayOpeningAnimation(
  items: SkinInstance[],
  animationsEnabled: boolean,
  skipAnimations: boolean,
) {
  if (!animationsEnabled || items.length === 0) {
    return false
  }

  return !skipAnimations || items.some(isPremiumRevealDrop)
}

export function selectOpeningAnimationItem(items: SkinInstance[], preferPremiumDrop: boolean) {
  if (items.length === 0) {
    return undefined
  }

  const sortedItems = [...items].sort((left, right) => {
    return (
      openingRarityRank[right.rarity] - openingRarityRank[left.rarity] ||
      right.marketValue - left.marketValue ||
      right.discoveredAt - left.discoveredAt
    )
  })

  if (!preferPremiumDrop) {
    return sortedItems[0]
  }

  return sortedItems.find(isPremiumRevealDrop) ?? sortedItems[0]
}

export function getPotentialSkinOptions(
  caseDef: CaseDefinition | undefined,
  skinsById: Map<string, SkinBase>,
): WeightedSkinOption[] {
  if (!caseDef) {
    return []
  }

  return caseDef.dropTable.flatMap((drop) => {
    const skin = skinsById.get(drop.skinId)

    return skin ? [{ skin, weight: drop.weight }] : []
  })
}
