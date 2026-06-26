/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
import { InventoryItemCard } from './InventoryItemCard'

const item: SkinInstance = {
  id: 'ak47_redline',
  weapon: 'AK-47',
  finish: 'Redline',
  rarity: Rarity.Classified,
  baseValue: 38,
  caseIds: ['starter_case'],
  image: '/assets/placeholder.png',
  instanceId: 'item-1',
  wear: WearCondition.FieldTested,
  floatValue: 0.2,
  marketValue: 32.5,
  isLocked: false,
  isFavorited: false,
  discoveredAt: 1_782_147_600_000,
}

function renderCard(overrides: Partial<Parameters<typeof InventoryItemCard>[0]> = {}) {
  const props = {
    bulkSelectMode: false,
    index: 0,
    isDuplicateSkin: false,
    isSelected: false,
    item,
    onOpen: vi.fn(),
    onToggleFavorite: vi.fn(),
    onToggleLock: vi.fn(),
    onToggleSelect: vi.fn(),
    ...overrides,
  }

  render(<InventoryItemCard {...props} />)

  return props
}

describe('InventoryItemCard touch selection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('selects on long press without opening the item afterward', () => {
    const props = renderCard()
    const card = screen.getByTitle('Tap to inspect, long press to select')

    fireEvent.pointerDown(card, { pointerType: 'touch' })

    act(() => {
      vi.advanceTimersByTime(520)
    })

    expect(props.onToggleSelect).toHaveBeenCalledWith(item.instanceId, 0, false)

    fireEvent.pointerUp(card, { pointerType: 'touch' })
    fireEvent.click(card)

    expect(props.onOpen).not.toHaveBeenCalled()
  })

  it('selects from the context menu gesture', () => {
    const props = renderCard()

    fireEvent.contextMenu(screen.getByTitle('Tap to inspect, long press to select'))

    expect(props.onToggleSelect).toHaveBeenCalledWith(item.instanceId, 0, false)
  })
})
