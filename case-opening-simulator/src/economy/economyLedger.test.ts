import { describe, expect, it, vi } from 'vitest'
import { gameReducer } from '../data/gameReducer'
import { defaultGameState, type GameState } from '../data/gameState'
import { Rarity, WearCondition, type NpcMarketListing, type SkinInstance } from '../data/models'
import { createDefaultMarketplaceState, createMarketplaceNpc } from '../marketplace/marketplace'
import { ECONOMY_LEDGER_HISTORY_LIMIT, getLedgerFinancialSnapshot } from './economyLedger'

function makeItem(overrides: Partial<SkinInstance> = {}): SkinInstance {
  return {
    id: 'ledger-skin',
    weapon: 'AK-47',
    finish: 'Ledger Test',
    rarity: Rarity.MilSpec,
    baseValue: 100,
    caseIds: ['kilowatt-case'],
    image: '/assets/placeholder.png',
    instanceId: 'ledger-item-1',
    wear: WearCondition.FieldTested,
    floatValue: .2,
    marketValue: 100,
    isLocked: false,
    isFavorited: false,
    discoveredAt: 1,
    ...overrides,
  }
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...defaultGameState,
    inventory: [],
    collectionBook: [],
    recentDrops: [],
    lastOpenedItems: [],
    uiEvents: [],
    marketplace: createDefaultMarketplaceState(0),
    ...overrides,
  }
}

function makeListing(item = makeItem()): NpcMarketListing {
  return {
    id: 'ledger-listing',
    item,
    seller: createMarketplaceNpc(7, item),
    askingPrice: 80,
    reservationPrice: 75,
    fairMarketValue: 100,
    liquidityScore: .8,
    scarcityScore: .2,
    createdAt: 1,
    expiresAt: 100_000,
  }
}

describe('authoritative economy ledger', () => {
  it('records a successful Work reward once and ignores a cooldown replay', () => {
    const first = gameReducer(makeState({ money: 0 }), {
      type: 'COMPLETE_WORK_MINIGAME',
      gameId: 'poopCleaning',
      now: 300_001,
      performance: 1,
    })
    const replayed = gameReducer(first, {
      type: 'COMPLETE_WORK_MINIGAME',
      gameId: 'poopCleaning',
      now: 300_002,
      performance: 1,
    })

    expect(first.economyLedger.recentTransactions).toHaveLength(1)
    expect(first.economyLedger.recentTransactions[0]).toMatchObject({
      type: 'work-reward',
      moneyDelta: 10,
      allocation: { workIncome: 10 },
    })
    expect(replayed.economyLedger.recentTransactions).toHaveLength(1)
    expect(replayed.money).toBe(first.money)
  })

  it('uses marketplace request IDs for exact-once cash, item, and ledger recording', () => {
    const listing = makeListing()
    const state = makeState({
      money: 500,
      marketplace: { ...createDefaultMarketplaceState(0), npcListings: [listing] },
    })
    const action = {
      type: 'BUY_MARKET_LISTING' as const,
      listingId: listing.id,
      requestId: 'ledger-request-1',
      now: 100,
    }
    const purchased = gameReducer(state, action)
    const replayed = gameReducer(purchased, action)

    expect(purchased.money).toBe(420)
    expect(purchased.inventory).toHaveLength(1)
    expect(purchased.economyLedger.recentTransactions[0]).toMatchObject({
      id: 'buy_market_listing:ledger-request-1',
      type: 'marketplace-purchase',
      moneyDelta: -80,
    })
    expect(purchased.economyLedger.itemCostBasis[listing.item.instanceId]).toBe(80)
    expect(replayed.money).toBe(420)
    expect(replayed.inventory).toHaveLength(1)
    expect(replayed.economyLedger.recentTransactions).toHaveLength(1)
  })

  it('separates cash flow, inventory value, and realized trading profit', () => {
    const listing = makeListing()
    const purchased = gameReducer(makeState({
      money: 500,
      marketplace: { ...createDefaultMarketplaceState(0), npcListings: [listing] },
    }), {
      type: 'BUY_MARKET_LISTING',
      listingId: listing.id,
      requestId: 'basis-buy',
      now: 100,
    })
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(200)
    const sold = gameReducer(purchased, { type: 'SELL_ITEM', itemId: listing.item.instanceId })
    const snapshot = getLedgerFinancialSnapshot(sold)

    expect(snapshot.totalExpenses).toBe(80)
    expect(snapshot.totalIncome).toBeGreaterThan(80)
    expect(snapshot.realizedTradingProfit).toBeCloseTo(snapshot.totalIncome - 80, 2)
    expect(snapshot.inventoryValue).toBe(0)
    expect(snapshot.economicNetWorth).toBe(sold.money)
    nowSpy.mockRestore()
  })

  it('records case cost and generated item identity in one economic transaction', () => {
    const opened = gameReducer(makeState({ money: 10 }), {
      type: 'OPEN_CASE',
      payload: {
        caseId: 'starter_case',
        openingEventId: 'ledger-opening-1',
        now: 1_000,
      },
    })
    const transaction = opened.economyLedger.recentTransactions[0]

    expect(transaction.id).toBe('case-opening:ledger-opening-1')
    expect(transaction.type).toBe('case-opening')
    expect(transaction.allocation.caseOpeningSpend).toBeGreaterThan(0)
    expect(transaction.itemDeltas.some((item) => item.kind === 'acquired')).toBe(true)
  })

  it('keeps detailed history bounded while retaining lifetime aggregates', () => {
    let state = makeState({ money: 0 })
    for (let index = 0; index < ECONOMY_LEDGER_HISTORY_LIMIT + 25; index += 1) {
      state = gameReducer(state, { type: 'ADD_MONEY', amount: 1 })
    }

    expect(state.economyLedger.recentTransactions).toHaveLength(ECONOMY_LEDGER_HISTORY_LIMIT)
    expect(state.economyLedger.lifetime.cashIncome).toBe(ECONOMY_LEDGER_HISTORY_LIMIT + 25)
    expect(state.economyLedger.lifetime.transactionCount).toBe(ECONOMY_LEDGER_HISTORY_LIMIT + 25)
    expect(new Set(state.economyLedger.recentTransactions.map((entry) => entry.id)).size)
      .toBe(ECONOMY_LEDGER_HISTORY_LIMIT)
  })
})
