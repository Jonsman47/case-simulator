import { Rarity, type SkinBase } from './models'

export type Prng = () => number

export interface DropTableEntry {
  skinId: string
  weight: number
}

export type RarityWeightMap = Record<Rarity, number>

export interface SkinDropOdds {
  skinId: string
  rarity: Rarity
  weight: number
  probability: number
}

export interface DropOdds {
  caseId: string
  totalWeight: number
  rarityOdds: Partial<Record<Rarity, number>>
  skinOdds: SkinDropOdds[]
}

export const RARITY_WEIGHTS: RarityWeightMap = {
  [Rarity.Consumer]: 100,
  [Rarity.Industrial]: 50,
  [Rarity.MilSpec]: 20,
  [Rarity.Restricted]: 5,
  [Rarity.Classified]: 2,
  [Rarity.Covert]: 0.5,
  [Rarity.SpecialItem]: 0.05,
  [Rarity.Contraband]: 0.01,
}

export function normalizeDropTable(dropTable: DropTableEntry[]) {
  if (dropTable.length === 0) {
    return []
  }

  const positiveEntries = dropTable.map((entry) => ({
    ...entry,
    weight: Math.max(0, entry.weight),
  }))
  const totalWeight = positiveEntries.reduce((total, entry) => total + entry.weight, 0)

  if (totalWeight <= 0) {
    const equalWeight = 100 / positiveEntries.length
    return positiveEntries.map((entry) => ({
      ...entry,
      weight: equalWeight,
    }))
  }

  return positiveEntries.map((entry) => ({
    ...entry,
    weight: (entry.weight / totalWeight) * 100,
  }))
}

export function pickDrop(dropTable: DropTableEntry[], prng: Prng = Math.random) {
  if (dropTable.length === 0) {
    throw new Error('Cannot pick a drop from an empty drop table.')
  }

  const normalizedDropTable = normalizeDropTable(dropTable)
  const totalWeight = normalizedDropTable.reduce((total, entry) => total + entry.weight, 0)

  if (totalWeight <= 0) {
    throw new Error('Cannot pick a drop from a zero-weight drop table.')
  }

  let targetWeight = Math.min(Math.max(prng(), 0), 0.999999999999) * totalWeight

  for (const drop of normalizedDropTable) {
    targetWeight -= drop.weight

    if (targetWeight < 0) {
      return drop.skinId
    }
  }

  return normalizedDropTable[normalizedDropTable.length - 1].skinId
}

export function buildDropTableFromRarities(
  skinIds: string[],
  skinsById: Map<string, SkinBase>,
  rarityMultipliers: Partial<Record<Rarity, number>> = {},
  skinMultipliers: Record<string, number> = {},
) {
  const rawDropTable = skinIds.map((skinId) => {
    const skin = skinsById.get(skinId)

    if (!skin) {
      return {
        skinId,
        weight: 0,
      }
    }

    return {
      skinId,
      weight:
        RARITY_WEIGHTS[skin.rarity] *
        (rarityMultipliers[skin.rarity] ?? 1) *
        (skinMultipliers[skinId] ?? 1),
    }
  })

  return normalizeDropTable(rawDropTable)
}

export function calculateDropOdds(
  caseId: string,
  dropTable: DropTableEntry[],
  skinsById: Map<string, SkinBase>,
): DropOdds {
  const normalizedDropTable = normalizeDropTable(dropTable)
  const totalWeight = normalizedDropTable.reduce((total, drop) => total + drop.weight, 0)
  const skinOdds = normalizedDropTable.map((drop) => {
    const rarity = skinsById.get(drop.skinId)?.rarity ?? Rarity.Consumer

    return {
      skinId: drop.skinId,
      rarity,
      weight: drop.weight,
      probability: totalWeight > 0 ? (drop.weight / totalWeight) * 100 : 0,
    }
  })
  const rarityOdds = skinOdds.reduce<Partial<Record<Rarity, number>>>((odds, drop) => {
    odds[drop.rarity] = (odds[drop.rarity] ?? 0) + drop.probability
    return odds
  }, {})

  return {
    caseId,
    totalWeight,
    rarityOdds,
    skinOdds,
  }
}
