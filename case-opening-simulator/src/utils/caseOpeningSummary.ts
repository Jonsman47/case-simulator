import type { GameState, GameUiEvent } from '../data/gameState'

type CaseOpeningStartedEvent = Extract<GameUiEvent, { type: 'case_opening_started' }>
type ItemsAutoSoldEvent = Extract<GameUiEvent, { type: 'items_auto_sold' }>

export interface LatestCaseOpeningSummary {
  autoSoldEvent: ItemsAutoSoldEvent | undefined
  startedEvent: CaseOpeningStartedEvent
}

export function getLatestCaseOpeningSummary(state: GameState): LatestCaseOpeningSummary | undefined {
  const startedEvent = state.uiEvents.find(
    (event): event is CaseOpeningStartedEvent => event.type === 'case_opening_started',
  )

  if (!startedEvent || state.lastOpenedItems.length === 0) {
    return undefined
  }

  const autoSoldEvent = state.uiEvents.find((event): event is ItemsAutoSoldEvent => {
    return (
      event.type === 'items_auto_sold' &&
      event.createdAt === startedEvent.createdAt
    )
  })

  return {
    autoSoldEvent,
    startedEvent,
  }
}
