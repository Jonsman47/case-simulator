/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
import { ItemDetailModal } from './ItemDetailModal'

vi.mock('react-chartjs-2', () => ({
  Line: () => <div aria-label="Price history chart" role="img" />,
}))

afterEach(() => {
  cleanup()
})

function makeItem(overrides: Partial<SkinInstance> = {}): SkinInstance {
  return {
    id: 'ak47_redline',
    weapon: 'AK-47',
    finish: 'Redline',
    rarity: Rarity.Classified,
    baseValue: 100,
    caseIds: ['starter_case'],
    image: '/assets/placeholder.png',
    instanceId: 'item-1',
    wear: WearCondition.FieldTested,
    floatValue: 0.245,
    marketValue: 75,
    isLocked: false,
    isFavorited: false,
    discoveredAt: new Date('2026-06-22T12:00:00.000Z').getTime(),
    ...overrides,
  }
}

function ItemDetailModalHarness({
  closeSpy,
  initialItems = [makeItem()],
}: {
  closeSpy?: () => void
  initialItems?: SkinInstance[]
}) {
  const [isOpen, setIsOpen] = useState(true)
  const [items, setItems] = useState(initialItems)
  const [activeItemId, setActiveItemId] = useState(initialItems[0]?.instanceId)
  const item = items.find((inventoryItem) => inventoryItem.instanceId === activeItemId)

  if (!isOpen) {
    return <p>Closed</p>
  }

  return (
    <ItemDetailModal
      item={item}
      items={items}
      onClose={() => {
        closeSpy?.()
        setIsOpen(false)
      }}
      onItemChange={(nextItem) => setActiveItemId(nextItem.instanceId)}
      onSell={(itemId) => {
        setItems((currentItems) => currentItems.filter((inventoryItem) => inventoryItem.instanceId !== itemId))
      }}
      onToggleFavorite={(itemId) => {
        setItems((currentItems) =>
          currentItems.map((inventoryItem) =>
            inventoryItem.instanceId === itemId
              ? { ...inventoryItem, isFavorited: !inventoryItem.isFavorited }
              : inventoryItem,
          ),
        )
      }}
      onToggleLock={(itemId) => {
        setItems((currentItems) =>
          currentItems.map((inventoryItem) =>
            inventoryItem.instanceId === itemId
              ? { ...inventoryItem, isLocked: !inventoryItem.isLocked }
              : inventoryItem,
          ),
        )
      }}
      saleValue={item?.marketValue}
    />
  )
}

describe('ItemDetailModal', () => {
  it('confirms the exact sale in a separate dialog and restores focus after cancellation', async () => {
    render(<ItemDetailModalHarness />)
    const sell = screen.getByRole('button', { name: 'Sell Instantly' })
    fireEvent.click(sell)
    const confirmation = screen.getByRole('dialog', { name: 'Confirm sale' })
    expect(confirmation).toBeInTheDocument()
    expect(confirmation).toHaveTextContent('AK-47 | Redline')
    expect(confirmation).toHaveTextContent('Field-Tested')
    expect(confirmation).toHaveTextContent('$75.00')
    expect(screen.getByRole('button', { name: 'Confirm Sale' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Confirm sale' })).not.toBeInTheDocument()
    await vi.waitFor(() => expect(sell).toHaveFocus())
    fireEvent.click(sell)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Sale' }))
    expect(screen.getByText('Closed')).toBeInTheDocument()
  })

  it('does not offer instant sale for a locked item', () => {
    render(<ItemDetailModalHarness initialItems={[makeItem({ isLocked: true })]} />)
    expect(screen.getByRole('button', { name: 'Sell Instantly' })).toBeDisabled()
  })

  it('toggles lock and favorite flags through the modal actions', () => {
    render(<ItemDetailModalHarness />)

    fireEvent.click(screen.getByRole('button', { name: 'Lock item' }))
    expect(screen.getByRole('button', { name: 'Unlock item' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Favorite item' }))
    expect(screen.getByRole('button', { name: 'Unfavorite item' })).toBeInTheDocument()
  }, 15_000)

  it('closes on backdrop click', () => {
    const closeSpy = vi.fn()

    render(<ItemDetailModalHarness closeSpy={closeSpy} />)

    fireEvent.mouseDown(screen.getByTestId('item-detail-backdrop'))

    expect(closeSpy).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: /AK-47 \| Redline/i })).not.toBeInTheDocument()
  }, 15_000)

  it('closes on Escape', () => {
    const closeSpy = vi.fn()

    render(<ItemDetailModalHarness closeSpy={closeSpy} />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(closeSpy).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: /AK-47 \| Redline/i })).not.toBeInTheDocument()
  }, 15_000)

  it('moves between inventory items with arrow keys', () => {
    const nextItem = makeItem({
      id: 'm4a1s_printstream',
      weapon: 'M4A1-S',
      finish: 'Printstream',
      instanceId: 'item-2',
    })

    render(<ItemDetailModalHarness initialItems={[makeItem(), nextItem]} />)

    fireEvent.keyDown(document, { key: 'ArrowRight' })

    expect(screen.getByRole('heading', { name: 'M4A1-S | Printstream' })).toBeInTheDocument()
  }, 15_000)

  it('zooms the item image with a pinch gesture', () => {
    render(<ItemDetailModalHarness />)

    const image = screen.getByAltText('AK-47 Redline')
    const imageSurface = image.parentElement

    expect(imageSurface).not.toBeNull()

    fireEvent.touchStart(imageSurface as HTMLElement, {
      touches: [
        { clientX: 0, clientY: 0 },
        { clientX: 100, clientY: 0 },
      ],
    })
    fireEvent.touchMove(imageSurface as HTMLElement, {
      touches: [
        { clientX: 0, clientY: 0 },
        { clientX: 160, clientY: 0 },
      ],
    })

    expect(image).toHaveStyle({ transform: 'scale(1.6)' })
  }, 15_000)
})
