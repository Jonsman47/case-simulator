import { describe, expect, it } from 'vitest'
import { Rarity, WearCondition, type SkinBase, type SkinInstance } from '../data/models'
import {
  TRADE_UP_INPUT_COUNT,
  analyzeTradeUp,
  calculateTradeUpOutputFloat,
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
    expect(getNextTradeUpRarity(Rarity.Covert)).toBe(Rarity.SpecialItem)
  })

  it('excludes locked and favorited items while allowing current Covert contracts', () => {
    expect(isTradeUpEligibleItem(makeItem())).toBe(true)
    expect(isTradeUpEligibleItem(makeItem({ isLocked: true }))).toBe(false)
    expect(isTradeUpEligibleItem(makeItem({ isFavorited: true }))).toBe(false)
    expect(isTradeUpEligibleItem(makeItem({ rarity: Rarity.Covert }))).toBe(true)
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

  it('uses five Covert inputs and current per-input collection weighting for special outcomes', () => {
    const inputs = Array.from({ length: 5 }, (_, index) => makeItem({
      instanceId: `covert-${index}`,
      rarity: Rarity.Covert,
      caseIds: [index < 3 ? 'case-a' : 'case-b'],
      marketValue: 100,
    }))
    const special = (id: string, weapon: string, caseIds: string[]): SkinBase => ({
      id, weapon, finish: id, rarity: Rarity.SpecialItem, baseValue: 500, caseIds,
      image: '/assets/placeholder.png', hasStatTrak: true,
    })
    const skins = [
      special('knife-a', 'Karambit', ['case-a']),
      special('glove-a', 'Sport Gloves', ['case-a']),
      special('knife-b', 'Bayonet', ['case-b']),
    ]
    const analysis = analyzeTradeUp({ inputItems: inputs, marketValues: {}, skins })
    expect(analysis.canTradeUp).toBe(true)
    expect(analysis.inputCount).toBe(5)
    expect(analysis.outcomes.map((outcome) => [outcome.skin.id, outcome.probability])).toEqual([
      ['knife-b', 40],
      ['knife-a', 30],
      ['glove-a', 30],
    ])
    expect(analysis.outcomes.reduce((sum, outcome) => sum + outcome.probability, 0)).toBeCloseTo(100, 8)
  })

  it('allows only StatTrak knives from five StatTrak Covert inputs', () => {
    const inputs = Array.from({ length: 5 }, (_, index) => makeItem({
      instanceId: `st-${index}`, rarity: Rarity.Covert, caseIds: ['case-a'], statTrak: true,
    }))
    const skins: SkinBase[] = [
      { id: 'knife', weapon: 'Karambit', finish: 'Test', rarity: Rarity.SpecialItem, baseValue: 500, caseIds: ['case-a'], image: '' },
      { id: 'gloves', weapon: 'Sport Gloves', finish: 'Test', rarity: Rarity.SpecialItem, baseValue: 500, caseIds: ['case-a'], image: '' },
    ]
    const analysis = analyzeTradeUp({ inputItems: inputs, marketValues: {}, skins })
    expect(analysis.canTradeUp).toBe(true)
    expect(analysis.outputIsStatTrak).toBe(true)
    expect(analysis.outcomes.map((outcome) => outcome.skin.id)).toEqual(['knife'])
    expect(analysis.outcomes[0]?.isStatTrak).toBe(true)
  })

  it('rejects mixed StatTrak contracts but permits Souvenir inputs as regular edition', () => {
    const mixedStatTrak = makeTradeUpInputs()
    mixedStatTrak[0] = { ...mixedStatTrak[0], statTrak: true }
    expect(analyzeTradeUp({ inputItems: mixedStatTrak, marketValues: {} }).isSameEdition).toBe(false)

    const souvenirInputs = makeTradeUpInputs().map((item, index) => ({ ...item, souvenir: index % 2 === 0 }))
    const analysis = analyzeTradeUp({ inputItems: souvenirInputs, marketValues: {} })
    expect(analysis.isSameEdition).toBe(true)
    expect(analysis.outputIsStatTrak).toBe(false)
    expect(analysis.outcomes.every((outcome) => !outcome.isStatTrak)).toBe(true)
  })

  it('normalizes every input against its own float range before mapping each output range', () => {
    const inputs = makeTradeUpInputs({ minFloat: .1, maxFloat: .5, floatValue: .3 })
    const output: SkinBase = {
      id: 'output', weapon: 'AK-47', finish: 'Output', rarity: Rarity.Industrial,
      baseValue: 10, caseIds: ['starter_case'], image: '', minFloat: .2, maxFloat: .8,
    }
    expect(calculateTradeUpOutputFloat(inputs, output)).toBe(.5)
  })
})
