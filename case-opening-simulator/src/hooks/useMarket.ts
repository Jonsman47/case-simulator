import { useMemo } from 'react'
import { useGame } from './useGame'

export function useMarket() {
  const { state, tickMarketNow } = useGame()

  return useMemo(
    () => ({
      activeEvents: state.activeMarketEvents,
      eventHistory: state.marketEventHistory,
      lastMarketTick: state.lastMarketTick,
      priceHistory: state.marketHistory,
      marketTrends: state.marketTrends,
      prices: state.marketValues,
      tickMarketNow,
      upcomingEvents: state.upcomingMarketEvents,
    }),
    [
      state.activeMarketEvents,
      state.lastMarketTick,
      state.marketEventHistory,
      state.marketHistory,
      state.marketTrends,
      state.marketValues,
      state.upcomingMarketEvents,
      tickMarketNow,
    ],
  )
}
