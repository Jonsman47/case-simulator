import { useMemo } from 'react'
import { useGame } from './useGame'

export function useEvents() {
  const { state, tickEventsNow, triggerGameEvent } = useGame()

  return useMemo(
    () => ({
      activeEvents: state.activeEvents,
      eventHistory: state.eventHistory,
      tickEventsNow,
      triggerGameEvent,
      upcomingEvents: state.upcomingEvents,
    }),
    [
      state.activeEvents,
      state.eventHistory,
      state.upcomingEvents,
      tickEventsNow,
      triggerGameEvent,
    ],
  )
}
