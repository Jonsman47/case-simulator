import { pickDrop, type DropTableEntry, type Prng } from '../data/dropLogic'
import { Rarity, type SkinBase, type SkinInstance, type WearCondition } from '../data/models'
import { getMarketAdjustedSkinConditionPrice } from '../data/skinPrices'
import { SKIN_DEFINITIONS } from '../data/skins'
import { getCurrentItemMarketValue } from './inventory'
import { isExceptionalPattern } from './skinPatterns'
import { getSkinFloatRange, getWearConditionForFloat } from './wear'

export const NORMAL_TRADE_UP_INPUT_COUNT = 10
export const COVERT_TRADE_UP_INPUT_COUNT = 5
export const TRADE_UP_INPUT_COUNT = NORMAL_TRADE_UP_INPUT_COUNT
export const PROFITABLE_TRADE_UP_EPSILON = 0.75
export const ROUGHLY_EQUAL_TRADE_UP_EPSILON = 0.75

export const tradeUpRarityOrder = [
  Rarity.Consumer,
  Rarity.Industrial,
  Rarity.MilSpec,
  Rarity.Restricted,
  Rarity.Classified,
  Rarity.Covert,
  Rarity.SpecialItem,
]

export interface TradeUpOutcome {
  expectedContribution: number
  probability: number
  predictedFloat: number
  predictedWear: WearCondition
  skin: SkinBase
  sourceCaseIds: string[]
  sourceGroups: string[]
  value: number
  weight: number
  isStatTrak: boolean
}

export interface TradeUpAnalysis {
  canTradeUp: boolean
  expectedProfit: number
  expectedValue: number
  hasProtectedItems: boolean
  inputCount: number
  inputRarity?: Rarity
  inputValue: number
  isCorrectCount: boolean
  isSameEdition: boolean
  isSameRarity: boolean
  message?: string
  outcomeRarity?: Rarity
  outcomes: TradeUpOutcome[]
  profitability: TradeUpProfitability
  outputIsStatTrak: boolean
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

export function getTradeUpInputCount(rarity?: Rarity) {
  return rarity === Rarity.Covert ? COVERT_TRADE_UP_INPUT_COUNT : NORMAL_TRADE_UP_INPUT_COUNT
}

export function getTradeUpItemValue(item: SkinInstance, marketValues: Record<string, number>) {
  return getCurrentItemMarketValue(item, marketValues)
}

export function getTradeUpProfitability(expectedProfit: number, canTradeUp = true): TradeUpProfitability {
  if (!canTradeUp) return 'invalid'
  if (expectedProfit > ROUGHLY_EQUAL_TRADE_UP_EPSILON) return 'profitable'
  if (expectedProfit < -ROUGHLY_EQUAL_TRADE_UP_EPSILON) return 'unprofitable'
  return 'roughlyEqual'
}

export function getNextTradeUpRarity(rarity: Rarity) {
  const rarityIndex = tradeUpRarityOrder.indexOf(rarity)
  if (rarityIndex < 0 || rarityIndex >= tradeUpRarityOrder.length - 1) return undefined
  return tradeUpRarityOrder[rarityIndex + 1]
}

export function isTradeUpEligibleItem(item: SkinInstance) {
  return Boolean(getNextTradeUpRarity(item.rarity)) && !item.isLocked && !item.isFavorited && !isExceptionalPattern(item)
}

export function getTradeUpInputRarity(items: SkinInstance[]) {
  if (items.length === 0) return undefined
  const inputRarity = items[0].rarity
  return items.every((item) => item.rarity === inputRarity) ? inputRarity : undefined
}

export function getTradeUpInputValue(items: SkinInstance[], marketValues: Record<string, number>, inputCostMultiplier = 1) {
  return roundCurrency(items.reduce((total, item) => total + getTradeUpItemValue(item, marketValues), 0) * Math.max(0, inputCostMultiplier))
}

export function getNormalizedTradeUpFloat(items: SkinInstance[]) {
  if (items.length === 0) return 0
  return items.reduce((total, item) => {
    const range = getSkinFloatRange(item)
    const size = range.max - range.min
    const normalized = size > 0 ? (item.floatValue - range.min) / size : 0
    return total + Math.min(1, Math.max(0, normalized))
  }, 0) / items.length
}

export function calculateTradeUpOutputFloat(inputItems: SkinInstance[], outputSkin: SkinBase) {
  const normalizedAverage = getNormalizedTradeUpFloat(inputItems)
  const outputRange = getSkinFloatRange(outputSkin)
  return Number((outputRange.min + normalizedAverage * (outputRange.max - outputRange.min)).toFixed(6))
}

function getSourceGroup(item: SkinInstance, covertContract: boolean) {
  if (covertContract) return [...item.caseIds].sort()[0]
  const collection = [...(item.collections ?? [])].sort()[0]
  return collection ? `collection:${collection}` : `case:${[...item.caseIds].sort()[0] ?? ''}`
}

function getOutputsForSource(sourceGroup: string, outcomeRarity: Rarity, isStatTrak: boolean, skins: SkinBase[]) {
  if (outcomeRarity === Rarity.SpecialItem) {
    return skins.filter((skin) => {
      if (skin.rarity !== Rarity.SpecialItem || !skin.caseIds.includes(sourceGroup)) return false
      if (!isStatTrak) return true
      // The imported catalog marks special-item finishes as non-StatTrak because
      // their ordinary market row is non-StatTrak. Current Covert contracts can
      // nevertheless create StatTrak knives; gloves/wraps remain ineligible.
      return !/glove|wrap/i.test(skin.weapon)
    })
  }
  if (sourceGroup.startsWith('collection:')) {
    const collection = sourceGroup.slice('collection:'.length)
    return skins.filter((skin) => skin.rarity === outcomeRarity && skin.collections?.includes(collection))
  }
  const caseId = sourceGroup.replace(/^case:/, '')
  return skins.filter((skin) => skin.rarity === outcomeRarity && skin.caseIds.includes(caseId))
}

function getOutcomeValue(skin: SkinBase, wear: WearCondition, isStatTrak: boolean, marketValues: Record<string, number>) {
  return roundCurrency(getMarketAdjustedSkinConditionPrice({
    fallbackValue: marketValues[skin.id] ?? skin.baseValue,
    isStatTrak,
    isSouvenir: false,
    marketValues,
    skin,
    wear,
  }) ?? marketValues[skin.id] ?? skin.baseValue)
}

export function calculateTradeUpOutcomes({
  inputItems,
  marketValues,
  skins = SKIN_DEFINITIONS,
}: {
  inputItems: SkinInstance[]
  marketValues: Record<string, number>
  skins?: SkinBase[]
}) {
  const inputRarity = getTradeUpInputRarity(inputItems)
  const outcomeRarity = inputRarity ? getNextTradeUpRarity(inputRarity) : undefined
  if (!inputRarity || !outcomeRarity || inputItems.length === 0) return []
  const isStatTrak = inputItems.every((item) => Boolean(item.statTrak))
  const sourceGroups = new Map<string, number>()
  for (const item of inputItems) {
    const source = getSourceGroup(item, inputRarity === Rarity.Covert)
    if (source) sourceGroups.set(source, (sourceGroups.get(source) ?? 0) + 1)
  }
  const probabilityBySkin = new Map<string, { probability: number; sourceGroups: Set<string> }>()
  for (const [sourceGroup, inputCount] of sourceGroups) {
    const outputs = getOutputsForSource(sourceGroup, outcomeRarity, isStatTrak, skins)
    if (outputs.length === 0) continue
    const probability = (inputCount / inputItems.length) / outputs.length
    for (const skin of outputs) {
      const current = probabilityBySkin.get(skin.id) ?? { probability: 0, sourceGroups: new Set<string>() }
      current.probability += probability
      current.sourceGroups.add(sourceGroup)
      probabilityBySkin.set(skin.id, current)
    }
  }
  const totalProbability = [...probabilityBySkin.values()].reduce((sum, entry) => sum + entry.probability, 0)
  if (totalProbability <= 0) return []
  const skinsById = new Map(skins.map((skin) => [skin.id, skin]))
  return [...probabilityBySkin.entries()].flatMap(([skinId, entry]) => {
    const skin = skinsById.get(skinId)
    if (!skin) return []
    const normalizedProbability = entry.probability / totalProbability
    const predictedFloat = calculateTradeUpOutputFloat(inputItems, skin)
    const predictedWear = getWearConditionForFloat(skin, predictedFloat)
    const value = getOutcomeValue(skin, predictedWear, isStatTrak, marketValues)
    const sourceGroupsForOutcome = [...entry.sourceGroups].sort()
    return [{
      expectedContribution: roundCurrency(value * normalizedProbability),
      probability: normalizedProbability * 100,
      predictedFloat,
      predictedWear,
      skin,
      sourceCaseIds: sourceGroupsForOutcome.filter((source) => !source.startsWith('collection:')).map((source) => source.replace(/^case:/, '')),
      sourceGroups: sourceGroupsForOutcome,
      value,
      weight: normalizedProbability,
      isStatTrak,
    }]
  }).sort((left, right) => right.probability - left.probability || right.value - left.value)
}

export function analyzeTradeUp({
  inputCostMultiplier = 1,
  inputItems,
  marketValues,
  skins = SKIN_DEFINITIONS,
}: {
  inputCostMultiplier?: number
  inputItems: SkinInstance[]
  marketValues: Record<string, number>
  skins?: SkinBase[]
}): TradeUpAnalysis {
  const inputRarity = getTradeUpInputRarity(inputItems)
  const outcomeRarity = inputRarity ? getNextTradeUpRarity(inputRarity) : undefined
  const inputCount = getTradeUpInputCount(inputRarity)
  const hasProtectedItems = inputItems.some((item) => item.isLocked || item.isFavorited || isExceptionalPattern(item))
  const isCorrectCount = inputItems.length === inputCount
  const isSameRarity = Boolean(inputRarity)
  const statTrakCount = inputItems.filter((item) => item.statTrak).length
  const isSameEdition = statTrakCount === 0 || statTrakCount === inputItems.length
  const outputIsStatTrak = inputItems.length > 0 && statTrakCount === inputItems.length
  const inputValue = getTradeUpInputValue(inputItems, marketValues, inputCostMultiplier)
  const outcomes = isCorrectCount && isSameRarity && isSameEdition && !hasProtectedItems
    ? calculateTradeUpOutcomes({ inputItems, marketValues, skins })
    : []
  const expectedValue = roundCurrency(outcomes.reduce((total, outcome) => total + outcome.expectedContribution, 0))
  const expectedProfit = roundCurrency(expectedValue - inputValue)
  let message: string | undefined
  if (!isCorrectCount) message = `Select exactly ${inputCount} ${inputRarity === Rarity.Covert ? 'Covert ' : ''}skins.`
  else if (!isSameRarity) message = 'All selected skins must have the same rarity.'
  else if (!isSameEdition) message = 'StatTrak items cannot be mixed with regular or Souvenir items.'
  else if (hasProtectedItems) message = 'Locked, favorited, or exceptional-pattern skins cannot be used in trade-ups.'
  else if (!outcomeRarity) message = 'This rarity cannot be traded up.'
  else if (outcomes.length === 0) message = inputRarity === Rarity.Covert
    ? 'These collections do not have an eligible knife or glove pool for this contract edition.'
    : 'No valid next-rarity outcomes exist for the represented collections.'
  const canTradeUp = !message && outcomes.length > 0
  return {
    canTradeUp, expectedProfit, expectedValue, hasProtectedItems, inputCount, inputRarity, inputValue,
    isCorrectCount, isSameEdition, isSameRarity, message, outcomeRarity, outcomes,
    profitability: getTradeUpProfitability(expectedProfit, canTradeUp), outputIsStatTrak,
  }
}

export function pickTradeUpOutcome(outcomes: TradeUpOutcome[], prng: Prng = Math.random) {
  const dropTable: DropTableEntry[] = outcomes.map((outcome) => ({ skinId: outcome.skin.id, weight: outcome.weight }))
  const selectedSkinId = pickDrop(dropTable, prng)
  return outcomes.find((outcome) => outcome.skin.id === selectedSkinId)
}

function getSuggestionCandidateGroups(inventory: SkinInstance[]) {
  const groups = new Map<string, SkinInstance[]>()
  for (const item of inventory.filter(isTradeUpEligibleItem)) {
    const key = `${item.rarity}:${item.statTrak ? 'st' : 'regular'}`
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups.values()].filter((group) => group.length >= getTradeUpInputCount(group[0]?.rarity))
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
  const suggestions: TradeUpSuggestion[] = []
  for (const group of getSuggestionCandidateGroups(inventory)) {
    const inputCount = getTradeUpInputCount(group[0]?.rarity)
    const inputItems = [...group].sort((a, b) => getTradeUpItemValue(a, marketValues) - getTradeUpItemValue(b, marketValues)).slice(0, inputCount)
    const analysis = analyzeTradeUp({ inputCostMultiplier, inputItems, marketValues })
    if (analysis.canTradeUp && analysis.expectedProfit > PROFITABLE_TRADE_UP_EPSILON) suggestions.push({ analysis, inputItems, score: analysis.expectedProfit })
  }
  return suggestions.sort((a, b) => b.score - a.score).slice(0, limit)
}
