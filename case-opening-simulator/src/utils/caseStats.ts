import { pickDrop, normalizeDropTable, type Prng } from '../data/dropLogic'
import { Rarity, type AutoSellRule, type CaseDefinition, type SkinBase, type SkinInstance } from '../data/models'
import { SKIN_DEFINITIONS } from '../data/skins'
import { shouldAutoSell } from './autoSell'
import { getWearConditionForFloat, randomFloatForSkin } from './wear'

export interface CaseDropStat {
  finish: string
  marketValue: number
  probability: number
  rarity: Rarity
  skinId: string
  weapon: string
  weight: number
}

export interface CaseRarityStat {
  itemCount: number
  probability: number
  rarity: Rarity
  weight: number
}

export interface CaseBestDropStat {
  chance: number
  marketValue: number
  skin: SkinBase
}

export interface CaseStats {
  bestDrop: CaseBestDropStat | undefined
  dropRows: CaseDropStat[]
  rarityStats: CaseRarityStat[]
  totalWeight: number
}

export interface CaseSimulationRequest {
  applyAutoSell: boolean
  autoSellRules: AutoSellRule[]
  caseDef: CaseDefinition
  iterations: number
  marketValues: Record<string, number>
  seed?: number
  skins?: SkinBase[]
}

export interface CaseSimulationResult {
  autoSellApplied: boolean
  autoSellAverageProfit: number
  autoSoldCount: number
  autoSoldValue: number
  averageDropValue: number
  averageProfit: number
  bestDropChance: number
  bestDropHits: number
  dropsByRarity: Record<Rarity, number>
  iterations: number
  rareDropRate: number
  totalCost: number
  totalDropValue: number
}

const rarityOrder = [
  Rarity.Consumer,
  Rarity.Industrial,
  Rarity.MilSpec,
  Rarity.Restricted,
  Rarity.Classified,
  Rarity.Covert,
  Rarity.SpecialItem,
  Rarity.Contraband,
]

function roundCurrency(value: number) {
  return Number(value.toFixed(2))
}

function roundPercent(value: number) {
  return Number(value.toFixed(6))
}

function createSkinMap(skins: SkinBase[]) {
  return new Map(skins.map((skin) => [skin.id, skin]))
}

function getMarketValue(skin: SkinBase, marketValues: Record<string, number>) {
  return marketValues[skin.id] ?? skin.baseValue
}

function createRarityNumberRecord(initialValue: number): Record<Rarity, number> {
  return rarityOrder.reduce(
    (record, rarity) => ({
      ...record,
      [rarity]: initialValue,
    }),
    {} as Record<Rarity, number>,
  )
}

function isRareSimulationDrop(rarity: Rarity) {
  return rarity === Rarity.Covert || rarity === Rarity.SpecialItem || rarity === Rarity.Contraband
}

export function createSeededPrng(seed = 1): Prng {
  let state = Math.max(1, Math.floor(seed)) >>> 0

  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 4_294_967_296
  }
}

export function calculateCaseStats(
  caseDef: CaseDefinition,
  marketValues: Record<string, number>,
  skins: SkinBase[] = SKIN_DEFINITIONS,
): CaseStats {
  const skinsById = createSkinMap(skins)
  const normalizedDropTable = normalizeDropTable(caseDef.dropTable)
  const totalWeight = normalizedDropTable.reduce((total, drop) => total + drop.weight, 0)
  const rarityStatsByRarity = new Map<Rarity, CaseRarityStat>()

  const dropRows = normalizedDropTable
    .map((drop) => {
      const skin = skinsById.get(drop.skinId)
      const probability = totalWeight > 0 ? (drop.weight / totalWeight) * 100 : 0
      const marketValue = skin ? getMarketValue(skin, marketValues) : 0
      const rarity = skin?.rarity ?? Rarity.Consumer
      const currentRarityStats = rarityStatsByRarity.get(rarity) ?? {
        itemCount: 0,
        probability: 0,
        rarity,
        weight: 0,
      }

      rarityStatsByRarity.set(rarity, {
        ...currentRarityStats,
        itemCount: currentRarityStats.itemCount + 1,
        probability: currentRarityStats.probability + probability,
        weight: currentRarityStats.weight + drop.weight,
      })

      return {
        finish: skin?.finish ?? drop.skinId,
        marketValue: roundCurrency(marketValue),
        probability: roundPercent(probability),
        rarity,
        skinId: drop.skinId,
        weapon: skin?.weapon ?? 'Unknown',
        weight: Number(drop.weight.toFixed(6)),
      }
    })
    .sort((left, right) => right.marketValue - left.marketValue || right.probability - left.probability)

  const rarityStats = rarityOrder
    .map((rarity) => rarityStatsByRarity.get(rarity))
    .filter((stat): stat is CaseRarityStat => Boolean(stat))
    .map((stat) => ({
      ...stat,
      probability: roundPercent(stat.probability),
      weight: Number(stat.weight.toFixed(6)),
    }))
  const bestDrop = dropRows.reduce<CaseBestDropStat | undefined>((best, row) => {
    const skin = skinsById.get(row.skinId)

    if (!skin) {
      return best
    }

    if (!best || row.marketValue > best.marketValue) {
      return {
        chance: row.probability,
        marketValue: row.marketValue,
        skin,
      }
    }

    return best
  }, undefined)

  return {
    bestDrop,
    dropRows,
    rarityStats,
    totalWeight: Number(totalWeight.toFixed(6)),
  }
}

export function simulateCaseOpenings({
  applyAutoSell,
  autoSellRules,
  caseDef,
  iterations,
  marketValues,
  seed = Date.now(),
  skins = SKIN_DEFINITIONS,
}: CaseSimulationRequest): CaseSimulationResult {
  const normalizedIterations = Math.max(1, Math.floor(iterations))
  const skinsById = createSkinMap(skins)
  const prng = createSeededPrng(seed)
  const stats = calculateCaseStats(caseDef, marketValues, skins)
  const dropsByRarity = createRarityNumberRecord(0)
  const bestDropSkinId = stats.bestDrop?.skin.id
  let autoSoldCount = 0
  let autoSoldValue = 0
  let bestDropHits = 0
  let rareDrops = 0
  let simulatedInventory: SkinInstance[] = []
  let totalDropValue = 0

  for (let index = 0; index < normalizedIterations; index += 1) {
    const skinId = pickDrop(caseDef.dropTable, prng)
    const skin = skinsById.get(skinId)

    if (!skin) {
      continue
    }

    const marketValue = roundCurrency(getMarketValue(skin, marketValues))

    totalDropValue += marketValue
    dropsByRarity[skin.rarity] += 1

    if (isRareSimulationDrop(skin.rarity)) {
      rareDrops += 1
    }

    if (skin.id === bestDropSkinId) {
      bestDropHits += 1
    }

    if (applyAutoSell) {
      const floatValue = randomFloatForSkin(skin, prng)
      const wear = getWearConditionForFloat(skin, floatValue)
      const item: SkinInstance = {
        ...skin,
        discoveredAt: Date.now(),
        floatValue,
        instanceId: `simulation-${index}`,
        isFavorited: false,
        isLocked: false,
        marketValue,
        wear,
      }
      const inventoryWithItem = [item, ...simulatedInventory]

      if (shouldAutoSell(item, autoSellRules, inventoryWithItem)) {
        autoSoldCount += 1
        autoSoldValue += marketValue
      } else {
        simulatedInventory = inventoryWithItem
      }
    }
  }

  const totalCost = roundCurrency(caseDef.cost * normalizedIterations)
  const roundedDropValue = roundCurrency(totalDropValue)
  const roundedAutoSoldValue = roundCurrency(autoSoldValue)

  return {
    autoSellApplied: applyAutoSell,
    autoSellAverageProfit: roundCurrency(roundedAutoSoldValue / normalizedIterations - caseDef.cost),
    autoSoldCount,
    autoSoldValue: roundedAutoSoldValue,
    averageDropValue: roundCurrency(roundedDropValue / normalizedIterations),
    averageProfit: roundCurrency((roundedDropValue - totalCost) / normalizedIterations),
    bestDropChance: roundPercent((bestDropHits / normalizedIterations) * 100),
    bestDropHits,
    dropsByRarity,
    iterations: normalizedIterations,
    rareDropRate: roundPercent((rareDrops / normalizedIterations) * 100),
    totalCost,
    totalDropValue: roundedDropValue,
  }
}
