import { CASE_DEFINITIONS } from '../data/cases'
import { pickDrop, type DropTableEntry, type Prng } from '../data/dropLogic'
import { Rarity, type CaseDefinition, type SkinBase, type SkinInstance } from '../data/models'
import { SKIN_DEFINITIONS } from '../data/skins'
import { applyWearMultiplier } from './wear'

export const TRADE_UP_INPUT_COUNT = 10
export const PROFITABLE_TRADE_UP_EPSILON = 0.75
export const ROUGHLY_EQUAL_TRADE_UP_EPSILON = 0.75

export const tradeUpRarityOrder = [
  Rarity.Consumer,
  Rarity.Industrial,
  Rarity.MilSpec,
  Rarity.Restricted,
  Rarity.Classified,
  Rarity.Covert,
]

export interface TradeUpOutcome {
  expectedContribution: number
  probability: number
  skin: SkinBase
  sourceCaseIds: string[]
  value: number
  weight: number
}

export interface TradeUpAnalysis {
  canTradeUp: boolean
  expectedProfit: number
  expectedValue: number
  hasProtectedItems: boolean
  inputRarity?: Rarity
  inputValue: number
  isCorrectCount: boolean
  isSameRarity: boolean
  message?: string
  outcomeRarity?: Rarity
  outcomes: TradeUpOutcome[]
  profitability: TradeUpProfitability
}

export interface TradeUpSuggestion {
  analysis: TradeUpAnalysis
  inputItems: SkinInstance[]
  score: number
}

export type TradeUpProfitability = 'profitable' | 'roughlyEqual' | 'unprofitable' | 'invalid'

function roundCurrency(value: number) {
  return Number(value.toFixed(2))
}

function getSkinMarketValue(skin: SkinBase, marketValues: Record<string, number>) {
  return marketValues[skin.id] ?? skin.baseValue
}

export function getTradeUpItemValue(item: SkinInstance, marketValues: Record<string, number>) {
  const currentBaseValue = marketValues[item.id]

  if (typeof currentBaseValue === 'number') {
    return applyWearMultiplier(currentBaseValue, item.wear, item.floatValue)
  }

  return item.marketValue
}

export function getTradeUpProfitability(expectedProfit: number, canTradeUp = true): TradeUpProfitability {
  if (!canTradeUp) {
    return 'invalid'
  }

  if (expectedProfit > ROUGHLY_EQUAL_TRADE_UP_EPSILON) {
    return 'profitable'
  }

  if (expectedProfit < -ROUGHLY_EQUAL_TRADE_UP_EPSILON) {
    return 'unprofitable'
  }

  return 'roughlyEqual'
}

export function getNextTradeUpRarity(rarity: Rarity) {
  const rarityIndex = tradeUpRarityOrder.indexOf(rarity)

  if (rarityIndex < 0 || rarityIndex >= tradeUpRarityOrder.length - 1) {
    return undefined
  }

  return tradeUpRarityOrder[rarityIndex + 1]
}

export function isTradeUpEligibleItem(item: SkinInstance) {
  return Boolean(getNextTradeUpRarity(item.rarity)) && !item.isLocked && !item.isFavorited
}

export function getTradeUpInputRarity(items: SkinInstance[]) {
  if (items.length === 0) {
    return undefined
  }

  const inputRarity = items[0].rarity

  return items.every((item) => item.rarity === inputRarity) ? inputRarity : undefined
}

export function getTradeUpInputValue(
  items: SkinInstance[],
  marketValues: Record<string, number>,
  inputCostMultiplier = 1,
) {
  return roundCurrency(
    items.reduce((total, item) => total + getTradeUpItemValue(item, marketValues), 0) *
      Math.max(0, inputCostMultiplier),
  )
}

export function calculateTradeUpOutcomes({
  cases = CASE_DEFINITIONS,
  inputItems,
  marketValues,
  skins = SKIN_DEFINITIONS,
}: {
  cases?: CaseDefinition[]
  inputItems: SkinInstance[]
  marketValues: Record<string, number>
  skins?: SkinBase[]
}) {
  const inputRarity = getTradeUpInputRarity(inputItems)
  const outcomeRarity = inputRarity ? getNextTradeUpRarity(inputRarity) : undefined

  if (!outcomeRarity) {
    return []
  }

  const casesById = new Map(cases.map((caseDef) => [caseDef.id, caseDef]))
  const skinsById = new Map(skins.map((skin) => [skin.id, skin]))
  const outcomeEntries = new Map<string, { sourceCaseIds: Set<string>; weight: number }>()

  for (const inputItem of inputItems) {
    for (const caseId of inputItem.caseIds) {
      const caseDef = casesById.get(caseId)

      if (!caseDef) {
        continue
      }

      for (const drop of caseDef.dropTable) {
        const skin = skinsById.get(drop.skinId)

        if (skin?.rarity !== outcomeRarity) {
          continue
        }

        const existingEntry = outcomeEntries.get(skin.id) ?? {
          sourceCaseIds: new Set<string>(),
          weight: 0,
        }

        existingEntry.sourceCaseIds.add(caseId)
        existingEntry.weight += 1
        outcomeEntries.set(skin.id, existingEntry)
      }
    }
  }

  const totalWeight = Array.from(outcomeEntries.values()).reduce(
    (total, entry) => total + entry.weight,
    0,
  )

  if (totalWeight <= 0) {
    return []
  }

  return Array.from(outcomeEntries.entries())
    .map(([skinId, entry]) => {
      const skin = skinsById.get(skinId)

      if (!skin) {
        return undefined
      }

      return {
        expectedContribution: roundCurrency(
          getSkinMarketValue(skin, marketValues) * (entry.weight / totalWeight),
        ),
        probability: Number(((entry.weight / totalWeight) * 100).toFixed(2)),
        skin,
        sourceCaseIds: Array.from(entry.sourceCaseIds).sort(),
        value: roundCurrency(getSkinMarketValue(skin, marketValues)),
        weight: entry.weight,
      }
    })
    .filter((outcome): outcome is TradeUpOutcome => Boolean(outcome))
    .sort((left, right) => right.probability - left.probability || right.value - left.value)
}

export function analyzeTradeUp({
  cases = CASE_DEFINITIONS,
  inputCostMultiplier = 1,
  inputItems,
  marketValues,
  skins = SKIN_DEFINITIONS,
}: {
  cases?: CaseDefinition[]
  inputCostMultiplier?: number
  inputItems: SkinInstance[]
  marketValues: Record<string, number>
  skins?: SkinBase[]
}): TradeUpAnalysis {
  const inputRarity = getTradeUpInputRarity(inputItems)
  const outcomeRarity = inputRarity ? getNextTradeUpRarity(inputRarity) : undefined
  const hasProtectedItems = inputItems.some((item) => item.isLocked || item.isFavorited)
  const isCorrectCount = inputItems.length === TRADE_UP_INPUT_COUNT
  const isSameRarity = Boolean(inputRarity)
  const inputValue = getTradeUpInputValue(inputItems, marketValues, inputCostMultiplier)
  const outcomes =
    isCorrectCount && isSameRarity && !hasProtectedItems
      ? calculateTradeUpOutcomes({ cases, inputItems, marketValues, skins })
      : []
  const expectedValue = roundCurrency(
    outcomes.reduce((total, outcome) => total + outcome.value * (outcome.probability / 100), 0),
  )
  const expectedProfit = roundCurrency(expectedValue - inputValue)
  let message: string | undefined

  if (!isCorrectCount) {
    message = `Select exactly ${TRADE_UP_INPUT_COUNT} skins.`
  } else if (!isSameRarity) {
    message = 'All selected skins must have the same rarity.'
  } else if (hasProtectedItems) {
    message = 'Locked or favorited skins cannot be used in trade-ups.'
  } else if (!outcomeRarity) {
    message = 'This rarity cannot be traded up.'
  } else if (outcomes.length === 0) {
    message = 'No valid higher-rarity outcomes exist for these case sources.'
  }

  // Manual trade-ups intentionally do not fail just because the expected value
  // is negative. The player can take risky contracts; profitability remains
  // internal signal data for automation and tests.
  const canTradeUp = !message && outcomes.length > 0
  const profitability = getTradeUpProfitability(expectedProfit, canTradeUp)
  return {
    canTradeUp,
    expectedProfit,
    expectedValue,
    hasProtectedItems,
    inputRarity,
    inputValue,
    isCorrectCount,
    isSameRarity,
    message,
    outcomeRarity,
    outcomes,
    profitability,
  }
}

export function pickTradeUpOutcome(
  outcomes: TradeUpOutcome[],
  prng: Prng = Math.random,
) {
  const dropTable: DropTableEntry[] = outcomes.map((outcome) => ({
    skinId: outcome.skin.id,
    weight: outcome.weight,
  }))
  const selectedSkinId = pickDrop(dropTable, prng)

  return outcomes.find((outcome) => outcome.skin.id === selectedSkinId)?.skin
}

function getCaseSourceKey(item: SkinInstance) {
  return [...item.caseIds].sort().join('|')
}

function getSuggestionCandidateGroups(inventory: SkinInstance[]) {
  const eligibleItems = inventory.filter(isTradeUpEligibleItem)
  const rarityGroups = new Map<Rarity, SkinInstance[]>()
  const sourceGroups = new Map<string, SkinInstance[]>()

  for (const item of eligibleItems) {
    rarityGroups.set(item.rarity, [...(rarityGroups.get(item.rarity) ?? []), item])
    sourceGroups.set(`${item.rarity}:${getCaseSourceKey(item)}`, [
      ...(sourceGroups.get(`${item.rarity}:${getCaseSourceKey(item)}`) ?? []),
      item,
    ])
  }

  return [...rarityGroups.values(), ...sourceGroups.values()].filter((group) => {
    return group.length >= TRADE_UP_INPUT_COUNT
  })
}

export function suggestBestTradeUps({
  inputCostMultiplier = 1,
  inventory,
  limit = 3,
  marketValues,
}: {
  inputCostMultiplier?: number
  inventory: SkinInstance[]
  limit?: number
  marketValues: Record<string, number>
}): TradeUpSuggestion[] {
  const suggestionsByKey = new Map<string, TradeUpSuggestion>()

  for (const group of getSuggestionCandidateGroups(inventory)) {
    const sortedGroup = [...group].sort((left, right) => {
      const valueDifference = getTradeUpItemValue(left, marketValues) - getTradeUpItemValue(right, marketValues)

      if (valueDifference !== 0) {
        return valueDifference
      }

      return left.floatValue - right.floatValue
    })
    const windows = [
      sortedGroup.slice(0, TRADE_UP_INPUT_COUNT),
      sortedGroup.slice(Math.max(0, sortedGroup.length - TRADE_UP_INPUT_COUNT)),
    ]

    for (const inputItems of windows) {
      if (inputItems.length !== TRADE_UP_INPUT_COUNT) {
        continue
      }

      const analysis = analyzeTradeUp({
        inputCostMultiplier,
        inputItems,
        marketValues,
      })

      if (!analysis.canTradeUp || analysis.expectedProfit <= PROFITABLE_TRADE_UP_EPSILON) {
        continue
      }

      const key = inputItems
        .map((item) => item.instanceId)
        .sort()
        .join('|')
      const score = analysis.expectedProfit
      const existingSuggestion = suggestionsByKey.get(key)

      if (!existingSuggestion || score > existingSuggestion.score) {
        suggestionsByKey.set(key, {
          analysis,
          inputItems,
          score,
        })
      }
    }
  }

  return [...suggestionsByKey.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
}
