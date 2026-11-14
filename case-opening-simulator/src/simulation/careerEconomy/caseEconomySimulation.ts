import { pickDrop } from '../../data/dropLogic'
import { getMarketAdjustedSkinConditionPrice } from '../../data/skinPrices'
import { Rarity, type CaseDefinition, type SkinBase } from '../../data/models'
import { applyPatternPremium, classifySkinPattern, generatePaintSeed } from '../../utils/skinPatterns'
import { applyWearMultiplier, getWearConditionForFloat, randomFloatForSkin } from '../../utils/wear'
import { createSimulationRandom } from './seededRandom'
import { summarizeDistribution, type DistributionSummary } from './statistics'

export interface CaseEconomyResult {
  caseId: string
  caseName: string
  seed: number
  iterations: number
  openingCost: number
  meanReward: number
  medianReward: number
  expectedProfit: number
  expectedReturn: number
  rareDropRate: number
  rewardDistribution: DistributionSummary
  xpPerDollar: number
}

function round(value: number, decimals = 4) {
  return Number(value.toFixed(decimals))
}

export function simulatePatternAwareCaseEconomy(input: {
  caseDef: CaseDefinition
  iterations: number
  marketValues: Record<string, number>
  seed: number
  skins: readonly SkinBase[]
}): CaseEconomyResult {
  const rng = createSimulationRandom(input.seed)
  const skinsById = new Map(input.skins.map((skin) => [skin.id, skin]))
  const rewards: number[] = []
  let rareDrops = 0
  let estimatedXp = 0

  for (let index = 0; index < input.iterations; index += 1) {
    const skin = skinsById.get(pickDrop(input.caseDef.dropTable, rng.next))
    if (!skin) continue
    const floatValue = randomFloatForSkin(skin, rng.next)
    const wear = getWearConditionForFloat(skin, floatValue)
    const supportsStatTrak = 'hasStatTrak' in skin ? Boolean(skin.hasStatTrak) : Boolean(skin.statTrak)
    const supportsSouvenir = 'hasSouvenir' in skin ? Boolean(skin.hasSouvenir) : Boolean(skin.souvenir)
    const statTrak = supportsStatTrak && rng.next() < 0.1
    const souvenir = !statTrak && supportsSouvenir && rng.next() < 0.01
    const representative = input.marketValues[skin.id] ?? skin.baseValue
    const fallback = applyWearMultiplier(representative, wear, floatValue)
    const conditionValue = getMarketAdjustedSkinConditionPrice({ fallbackValue: fallback, isStatTrak: statTrak, isSouvenir: souvenir, marketValues: input.marketValues, skin, wear }) ?? fallback
    const pattern = classifySkinPattern(skin, generatePaintSeed(rng.next))
    const value = applyPatternPremium(conditionValue, pattern)
    rewards.push(value)
    if ([Rarity.Covert, Rarity.SpecialItem, Rarity.Contraband].includes(skin.rarity)) rareDrops += 1
    estimatedXp += 12 + Math.min(40, Math.log2(Math.max(1, value)) * 3)
  }

  const distribution = summarizeDistribution(rewards)
  const totalCost = input.caseDef.cost * rewards.length
  const meanReward = distribution.mean
  return {
    caseId: input.caseDef.id,
    caseName: input.caseDef.name,
    seed: input.seed,
    iterations: rewards.length,
    openingCost: input.caseDef.cost,
    meanReward,
    medianReward: distribution.median,
    expectedProfit: round(meanReward - input.caseDef.cost, 2),
    expectedReturn: round(input.caseDef.cost > 0 ? meanReward / input.caseDef.cost : 0),
    rareDropRate: round(rewards.length > 0 ? rareDrops / rewards.length : 0, 6),
    rewardDistribution: distribution,
    xpPerDollar: round(totalCost > 0 ? estimatedXp / totalCost : 0),
  }
}

export function selectRepresentativeCases(cases: readonly CaseDefinition[], skins: readonly SkinBase[]) {
  const sorted = [...cases].filter((entry) => entry.cost > 0 && entry.dropTable.length > 0).sort((left, right) => left.cost - right.cost)
  const patternSkinIds = new Set(skins.filter((skin) => /case hardened|fade|doppler|marble fade|heat treated/i.test(skin.finish)).map((skin) => skin.id))
  const patternCase = sorted.find((entry) => entry.dropTable.some((drop) => patternSkinIds.has(drop.skinId)))
  const rareCase = [...sorted].sort((left, right) => {
    const rareCount = (caseDef: CaseDefinition) => caseDef.dropTable.filter((drop) => {
      const skin = skins.find((candidate) => candidate.id === drop.skinId)
      return skin?.rarity === Rarity.SpecialItem || skin?.rarity === Rarity.Contraband
    }).length
    return rareCount(right) - rareCount(left)
  })[0]
  const candidates = [
    sorted[0],
    sorted[Math.floor(sorted.length * 0.25)],
    sorted[Math.floor(sorted.length / 2)],
    sorted[Math.floor(sorted.length * 0.75)],
    sorted.at(-1),
    rareCase,
    patternCase,
    ...sorted,
  ]
  return Array.from(new Map(candidates.filter(Boolean).map((entry) => [entry!.id, entry!])).values()).slice(0, 5)
}
