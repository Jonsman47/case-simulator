import { describe, expect, it } from 'vitest'
import { Rarity, type SkinBase } from '../data/models'
import {
  MARKET_HISTORY_MAX_TRACKED_SKINS,
  MARKET_HISTORY_MAX_POINTS,
  MARKET_TICK_MS,
  MIN_MARKET_VALUE,
  PREDEFINED_MARKET_EVENTS,
  appendMarketPriceHistory,
  createMarketEvent,
  tickMarket,
  type ActiveMarketEvent,
} from './marketSimulation'

const testSkins: SkinBase[] = [
  {
    id: 'cheap_skin',
    weapon: 'P250',
    finish: 'Test',
    rarity: Rarity.Consumer,
    baseValue: 1,
    caseIds: ['starter_case'],
    image: '/assets/placeholder.png',
  },
  {
    id: 'm4a4_howl',
    weapon: 'M4A4',
    finish: 'Howl',
    rarity: Rarity.Contraband,
    baseValue: 5000,
    caseIds: ['ultra_legacy_case'],
    image: '/assets/placeholder.png',
  },
]

function fixedPrng(value: number) {
  return () => value
}

describe('marketSimulation', () => {
  it('evolves prices over time using a random walk', () => {
    const result = tickMarket({
      marketValues: {
        cheap_skin: 1,
        m4a4_howl: 5000,
      },
      prng: fixedPrng(0.75),
      skins: testSkins,
    })

    expect(result.marketValues.cheap_skin).toBeGreaterThan(1)
    expect(result.marketTrends.cheap_skin).toBe('↑')
  })

  it('never lets prices fall below the market floor', () => {
    const crashEvent: ActiveMarketEvent = {
      id: 'crash',
      type: 'MarketCrash',
      label: 'Market crash',
      impactPerTick: -0.99,
      startedAt: 1,
      ticksRemaining: 1,
      totalTicks: 1,
    }
    const result = tickMarket({
      activeEvents: [crashEvent],
      marketValues: {
        cheap_skin: 0.01,
        m4a4_howl: 0.01,
      },
      prng: fixedPrng(0),
      skins: testSkins,
    })

    expect(result.marketValues.cheap_skin).toBe(MIN_MARKET_VALUE)
    expect(result.marketValues.m4a4_howl).toBe(MIN_MARKET_VALUE)
  })

  it('moves retired-case skins upward during a retired boost event', () => {
    const now = Date.UTC(2026, 5, 22)
    const retiredBoost = createMarketEvent({
      now,
      prng: fixedPrng(0.5),
      type: 'RetiredBoost',
    })
    const result = tickMarket({
      activeEvents: [retiredBoost],
      marketValues: {
        cheap_skin: 1,
        m4a4_howl: 5000,
      },
      now,
      prng: fixedPrng(0.5),
      skins: testSkins,
    })

    expect(result.marketValues.m4a4_howl).toBeGreaterThan(5000)
    expect(result.marketTrends.m4a4_howl).toBe('↑')
  })

  it('predefined event effects can modify prices directly', () => {
    const knifeWeekend = PREDEFINED_MARKET_EVENTS.find((event) => event.id === 'KnifeWeekend')
    const prices = {
      cheap_skin: 1,
      karambit_doppler: 1000,
    }

    knifeWeekend?.effect(prices)

    expect(prices.cheap_skin).toBe(1)
    expect(prices.karambit_doppler).toBe(1150)
  })

  it('applies active timed event effects during market ticks', () => {
    const now = Date.UTC(2026, 5, 22, 12)
    const event = createMarketEvent({
      durationMs: MARKET_TICK_MS,
      now,
      prng: fixedPrng(0.5),
      type: 'MarketBoom',
    })
    const testEvent = {
      ...event,
      affectedSkinIds: testSkins.map((skin) => skin.id),
    }
    const result = tickMarket({
      activeEvents: [testEvent],
      marketValues: {
        cheap_skin: 1,
        m4a4_howl: 5000,
      },
      now,
      prng: fixedPrng(0.5),
      skins: testSkins,
    })

    expect(result.marketValues.cheap_skin).toBe(1.08)
    expect(result.marketValues.m4a4_howl).toBe(5400)
    expect(result.activeEvents).toHaveLength(1)
  })

  it('moves ended events into event history on schedule', () => {
    const now = Date.UTC(2026, 5, 22, 12)
    const event = createMarketEvent({
      durationMs: MARKET_TICK_MS,
      now,
      prng: fixedPrng(0.5),
      type: 'MarketCrash',
    })
    const result = tickMarket({
      activeEvents: [event],
      marketValues: {
        cheap_skin: 1,
        m4a4_howl: 5000,
      },
      now: now + MARKET_TICK_MS,
      prng: fixedPrng(0.5),
      skins: testSkins,
    })

    expect(result.activeEvents).toEqual([])
    expect(result.eventHistory[0]).toMatchObject({
      id: event.id,
      type: 'MarketCrash',
      name: 'Market Crash',
    })
  })

  it('schedules upcoming events from player progress without overlapping active events', () => {
    const now = Date.UTC(2026, 5, 22, 12)
    const result = tickMarket({
      casesOpened: 75,
      marketValues: {
        cheap_skin: 1,
        m4a4_howl: 5000,
      },
      now,
      prng: fixedPrng(0.5),
      skins: testSkins,
    })

    expect(result.upcomingEvents).toHaveLength(1)
    expect(result.upcomingEvents[0]).toMatchObject({
      type: 'OperationEvent',
      triggeredAtCasesOpened: 75,
    })
    expect(result.upcomingEvents[0]?.startTime).toBe(now + 5 * MARKET_TICK_MS)
  })

  it('starts upcoming retired case events and exposes temporary case access', () => {
    const now = Date.UTC(2026, 5, 22, 12)
    const event = createMarketEvent({
      now,
      prng: fixedPrng(0.5),
      startTime: now + MARKET_TICK_MS,
      type: 'RetiredCaseWeek',
    })
    const result = tickMarket({
      marketValues: {
        cheap_skin: 1,
        m4a4_howl: 5000,
      },
      now: now + MARKET_TICK_MS,
      prng: fixedPrng(0.5),
      skins: testSkins,
      upcomingEvents: [event],
    })

    expect(result.activeEvents[0]?.type).toBe('RetiredCaseWeek')
    expect(result.specialEventCaseIds).toContain('ultra_legacy_case')
    expect(result.marketValues.m4a4_howl).toBeGreaterThan(5000)
  })

  it('records price history for each market tick', () => {
    const now = Date.UTC(2026, 5, 22, 12)
    const result = tickMarket({
      marketValues: {
        cheap_skin: 1,
        m4a4_howl: 5000,
      },
      now,
      prng: fixedPrng(0.75),
      skins: testSkins,
    })

    expect(result.marketHistory.cheap_skin).toEqual([
      {
        timestamp: now,
        value: result.marketValues.cheap_skin,
      },
    ])
    expect(result.marketHistory.m4a4_howl?.[0]?.value).toBe(result.marketValues.m4a4_howl)
  })

  it('trims price history to the configured point limit', () => {
    const now = Date.UTC(2026, 5, 22, 12)
    const existingPoints = Array.from({ length: MARKET_HISTORY_MAX_POINTS + 5 }, (_, index) => ({
      timestamp: now - (MARKET_HISTORY_MAX_POINTS + 5 - index) * 60_000,
      value: 1 + index / 100,
    }))
    const result = tickMarket({
      marketHistory: {
        cheap_skin: existingPoints,
      },
      marketValues: {
        cheap_skin: 1,
        m4a4_howl: 5000,
      },
      now,
      prng: fixedPrng(0.5),
      skins: testSkins,
    })

    expect(result.marketHistory.cheap_skin).toHaveLength(MARKET_HISTORY_MAX_POINTS)
    expect(result.marketHistory.cheap_skin?.at(-1)).toEqual({
      timestamp: now,
      value: result.marketValues.cheap_skin,
    })
  })

  it('caps tracked market history while preserving explicitly tracked inventory skins', () => {
    const skins = Array.from({ length: MARKET_HISTORY_MAX_TRACKED_SKINS + 30 }, (_, index): SkinBase => ({
      id: `skin_${index}`,
      weapon: 'P250',
      finish: `Stress ${index}`,
      rarity: Rarity.Consumer,
      baseValue: index + 1,
      caseIds: ['starter_case'],
      image: '/assets/placeholder.png',
    }))
    const trackedSkin = skins[skins.length - 1]
    const history = appendMarketPriceHistory({
      marketValues: Object.fromEntries(skins.map((skin) => [skin.id, skin.baseValue])),
      now: Date.UTC(2026, 5, 22),
      skins,
      trackedSkinIds: [trackedSkin.id],
    })

    expect(Object.keys(history)).toHaveLength(MARKET_HISTORY_MAX_TRACKED_SKINS)
    expect(history[trackedSkin.id]).toBeDefined()
    expect(history.skin_0).toBeUndefined()
  })
})
