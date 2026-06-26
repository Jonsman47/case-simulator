import { describe, expect, it } from 'vitest'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
import {
  TRADE_UP_INPUT_COUNT,
  analyzeTradeUp,
  calculateTradeUpOutcomes,
  getNextTradeUpRarity,
  getTradeUpProfitability,
  isTradeUpEligibleItem,
  suggestBestTradeUps,
} from './tradeUp'

function makeItem(overrides: Partial<SkinInstance> = {}): SkinInstance {
  return {
    id: 'p250_sand_dune',
    weapon: 'P250',
    finish: 'Sand Dune',
    rarity: Rarity.Consumer,
    baseValue: 0.03,
    caseIds: ['starter_case'],
    image: '/assets/placeholder.png',
    instanceId: 'item-1',
    wear: WearCondition.FieldTested,
    floatValue: 0.2,
    marketValue: 0.03,
    isLocked: false,
    isFavorited: false,
    discoveredAt: 1_782_147_600_000,
    ...overrides,
  }
}

function makeTradeUpInputs(overrides: Partial<SkinInstance> = {}) {
  return Array.from({ length: TRADE_UP_INPUT_COUNT }, (_, index) =>
    makeItem({
      instanceId: `item-${index}`,
      ...overrides,
    }),
  )
}

describe('trade-up utilities', () => {
  it('maps eligible rarities to the next output rarity', () => {
    expect(getNextTradeUpRarity(Rarity.Consumer)).toBe(Rarity.Industrial)
    expect(getNextTradeUpRarity(Rarity.Classified)).toBe(Rarity.Covert)
    expect(getNextTradeUpRarity(Rarity.Covert)).toBeUndefined()
  })

  it('excludes locked, favorited, and top-tier items from selection', () => {
    expect(isTradeUpEligibleItem(makeItem())).toBe(true)
    expect(isTradeUpEligibleItem(makeItem({ isLocked: true }))).toBe(false)
    expect(isTradeUpEligibleItem(makeItem({ isFavorited: true }))).toBe(false)
    expect(isTradeUpEligibleItem(makeItem({ rarity: Rarity.Covert }))).toBe(false)
  })

  it('calculates equal outcome odds from selected case sources', () => {
    const outcomes = calculateTradeUpOutcomes({
      inputItems: makeTradeUpInputs(),
      marketValues: {},
    })
    const probabilityTotal = outcomes.reduce((total, outcome) => total + outcome.probability, 0)

    expect(outcomes.length).toBeGreaterThan(0)
    expect(outcomes.every((outcome) => outcome.skin.rarity === Rarity.Industrial)).toBe(true)
    expect(probabilityTotal).toBeCloseTo(100, 1)
    expect(outcomes.every((outcome) => outcome.sourceCaseIds.includes('starter_case'))).toBe(true)
  })

  it('calculates expected value from outcome contributions', () => {
    const analysis = analyzeTradeUp({
      inputItems: makeTradeUpInputs(),
      marketValues: {
        galil_ar_blue_titanium: 10,
      },
    })
    const contributionTotal = analysis.outcomes.reduce(
      (total, outcome) => total + outcome.expectedContribution,
      0,
    )

    expect(analysis.expectedValue).toBeCloseTo(contributionTotal, 1)
    expect(analysis.outcomes[0]).toMatchObject({
      expectedContribution: expect.any(Number),
      probability: expect.any(Number),
      value: expect.any(Number),
    })
  })

  it('labels profitability with green, red, and neutral states', () => {
    expect(getTradeUpProfitability(1)).toBe('profitable')
    expect(getTradeUpProfitability(-1)).toBe('unprofitable')
    expect(getTradeUpProfitability(0.1)).toBe('roughlyEqual')
    expect(getTradeUpProfitability(10, false)).toBe('invalid')
  })

  it('finds profitable trade-up suggestions from eligible inventory', () => {
    const inventory = makeTradeUpInputs({
      marketValue: 0.01,
    })
    const suggestions = suggestBestTradeUps({
      inventory,
      marketValues: {
        p250_sand_dune: 0.01,
        galil_ar_blue_titanium: 10,
      },
    })

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].analysis.expectedProfit).toBeGreaterThan(0)
    expect(suggestions[0].inputItems).toHaveLength(TRADE_UP_INPUT_COUNT)
  })

  it('requires exactly ten same-rarity unprotected inputs', () => {
    expect(analyzeTradeUp({
      inputItems: makeTradeUpInputs().slice(0, 9),
      marketValues: {},
    })).toMatchObject({
      canTradeUp: false,
      isCorrectCount: false,
    })

    expect(analyzeTradeUp({
      inputItems: [
        ...makeTradeUpInputs().slice(0, 9),
        makeItem({
          instanceId: 'industrial-item',
          rarity: Rarity.Industrial,
        }),
      ],
      marketValues: {},
    })).toMatchObject({
      canTradeUp: false,
      isSameRarity: false,
    })

    expect(analyzeTradeUp({
      inputItems: makeTradeUpInputs({ isFavorited: true }),
      marketValues: {},
    })).toMatchObject({
      canTradeUp: false,
      hasProtectedItems: true,
    })
  })
})
