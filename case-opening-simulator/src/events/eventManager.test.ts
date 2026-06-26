import { describe, expect, it } from 'vitest'
import { CASE_DEFINITIONS } from '../data/cases'
import { Rarity } from '../data/models'
import { SKIN_DEFINITIONS } from '../data/skins'
import {
  EventManager,
  GAME_EVENT_TICK_MS,
  applyGameEventEffectsToCase,
  getGameEventTradeUpInputCostMultiplier,
  type ActiveGameEvent,
} from './eventManager'

const skinsById = new Map(SKIN_DEFINITIONS.map((skin) => [skin.id, skin]))

function fixedPrng(value: number) {
  return () => value
}

function getRarityWeight(caseId: string, rarity: Rarity, events: ActiveGameEvent[] = []) {
  const caseDef = CASE_DEFINITIONS.find((definition) => definition.id === caseId)

  if (!caseDef) {
    return 0
  }

  const eventCase = applyGameEventEffectsToCase(caseDef, events, skinsById)

  return eventCase.dropTable.reduce((total, drop) => {
    const skin = skinsById.get(drop.skinId)

    return skin?.rarity === rarity ? total + drop.weight : total
  }, 0)
}

describe('EventManager', () => {
  it('applies event effects only while events are active', () => {
    const now = Date.UTC(2026, 5, 24, 12)
    const manager = new EventManager()
    const event = manager.createEvent({
      durationMs: GAME_EVENT_TICK_MS,
      now,
      prng: fixedPrng(0.1),
      type: 'KnifeWeekend',
    })
    const activeTick = manager.tick({
      activeEvents: [event],
      autoSchedule: false,
      now,
    })
    const expiredTick = manager.tick({
      activeEvents: [event],
      autoSchedule: false,
      now: now + GAME_EVENT_TICK_MS,
    })
    const baselineSpecialWeight = getRarityWeight('starter_case', Rarity.SpecialItem)
    const activeSpecialWeight = getRarityWeight('starter_case', Rarity.SpecialItem, activeTick.activeEvents)

    expect(activeTick.activeEvents).toHaveLength(1)
    expect(activeSpecialWeight).toBeGreaterThan(baselineSpecialWeight)
    expect(expiredTick.activeEvents).toEqual([])
    expect(expiredTick.eventHistory[0]).toMatchObject({
      id: event.id,
      type: 'KnifeWeekend',
    })
  })

  it('stacks overlapping non-exclusive event effects', () => {
    const now = Date.UTC(2026, 5, 24, 12)
    const manager = new EventManager()
    const knifeWeekend = manager.createEvent({
      now,
      prng: fixedPrng(0.1),
      type: 'KnifeWeekend',
    })
    const winterCases = manager.createEvent({
      now,
      prng: fixedPrng(0.2),
      type: 'WinterCases',
    })
    const tick = manager.tick({
      activeEvents: [knifeWeekend, winterCases],
      autoSchedule: false,
      now,
    })
    const starterCase = CASE_DEFINITIONS.find((definition) => definition.id === 'starter_case')
    const eventCase = starterCase
      ? applyGameEventEffectsToCase(starterCase, tick.activeEvents, skinsById)
      : undefined

    expect(tick.activeEvents.map((event) => event.type).sort()).toEqual(['KnifeWeekend', 'WinterCases'])
    expect(eventCase?.cost).toBe(0.18)
    expect(getRarityWeight('starter_case', Rarity.SpecialItem, tick.activeEvents)).toBeGreaterThan(
      getRarityWeight('starter_case', Rarity.SpecialItem, [knifeWeekend]),
    )
  })

  it('overrides overlapping exclusive events by priority', () => {
    const now = Date.UTC(2026, 5, 24, 12)
    const manager = new EventManager()
    const boom = manager.createEvent({
      now,
      prng: fixedPrng(0.1),
      type: 'MarketBoom',
    })
    const crash = manager.createEvent({
      now,
      prng: fixedPrng(0.2),
      type: 'MarketCrash',
    })
    const tick = manager.tick({
      activeEvents: [boom, crash],
      autoSchedule: false,
      now,
    })

    expect(tick.activeEvents).toHaveLength(1)
    expect(tick.activeEvents[0]?.type).toBe('MarketCrash')
    expect(tick.endedEvents[0]?.type).toBe('MarketBoom')
  })

  it('exposes trade-up discounts while Trade-Up Madness is active', () => {
    const now = Date.UTC(2026, 5, 24, 12)
    const manager = new EventManager()
    const tradeUpMadness = manager.createEvent({
      now,
      prng: fixedPrng(0.1),
      type: 'TradeUpMadness',
    })

    expect(getGameEventTradeUpInputCostMultiplier([tradeUpMadness])).toBe(0.9)
  })
})
