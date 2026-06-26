import {
  type CSSProperties,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { CheckSquare, Copy } from 'lucide-react'
import { Grid } from 'react-window'
import { BulkActionsToolbar } from '../components/BulkActionsToolbar'
import { InventoryFilterBar } from '../components/InventoryFilterBar'
import { InventoryItemCard } from '../components/InventoryItemCard'
import { InventoryValueChart } from '../components/InventoryValueChart'
import { Tooltip } from '../components/Tooltip'
import type { SkinInstance } from '../data/models'
import {
  defaultInventoryViewUiState,
  getDuplicateSkinIds,
  useInventoryFilters,
} from '../hooks/useInventoryFilters'
import { useGame } from '../hooks/useGame'
import { getCurrentItemMarketValue } from '../utils/inventory'
import { selectDuplicates } from '../utils/inventoryBulk'
import { formatCurrency } from '../utils/format'

const ItemDetailModal = lazy(() => (
  import('../components/ItemDetailModal').then((module) => ({ default: module.ItemDetailModal }))
))

const CARD_ROW_HEIGHT_DESKTOP = 360
const CARD_ROW_HEIGHT_MOBILE = 336
const MIN_GRID_HEIGHT = 360
const MAX_GRID_HEIGHT = 760

function useElementWidth() {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!element) {
      return undefined
    }

    const updateWidth = () => {
      const nextWidth = Math.round(element.getBoundingClientRect().width)

      setWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth)
    }
    const resizeObserver = new ResizeObserver(updateWidth)

    updateWidth()
    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
    }
  }, [element])

  return [setElement, width] as const
}

function getColumnCount(width: number) {
  if (width < 520) {
    return 1
  }

  if (width < 760) {
    return 2
  }

  if (width < 1000) {
    return 3
  }

  if (width < 1240) {
    return 4
  }

  return 5
}

function getCardRowHeight(width: number) {
  return width < 520 ? CARD_ROW_HEIGHT_MOBILE : CARD_ROW_HEIGHT_DESKTOP
}

interface GridCellProps {
  bulkSelectMode: boolean
  columnCount: number
  duplicateSkinIds: Set<string>
  items: SkinInstance[]
  onOpenItem: (item: SkinInstance) => void
  onToggleFavorite: (itemId: string) => void
  onToggleLock: (itemId: string) => void
  onToggleSelect: (itemId: string, index: number, isRangeSelection: boolean) => void
  selectedIds: Set<string>
}

function InventoryGridCell({
  ariaAttributes,
  bulkSelectMode,
  columnCount,
  columnIndex,
  duplicateSkinIds,
  items,
  onOpenItem,
  onToggleFavorite,
  onToggleLock,
  onToggleSelect,
  rowIndex,
  selectedIds,
  style,
}: GridCellProps & {
  ariaAttributes: {
    'aria-colindex': number
    role: 'gridcell'
  }
  columnIndex: number
  rowIndex: number
  style: CSSProperties
}) {
  const itemIndex = rowIndex * columnCount + columnIndex
  const item = items[itemIndex]

  if (!item) {
    return null
  }

  return (
    <div {...ariaAttributes} style={style}>
      <div className="h-full p-1.5">
        <InventoryItemCard
          bulkSelectMode={bulkSelectMode}
          index={itemIndex}
          isDuplicateSkin={duplicateSkinIds.has(item.id)}
          isSelected={selectedIds.has(item.instanceId)}
          item={item}
          onOpen={onOpenItem}
          onToggleFavorite={onToggleFavorite}
          onToggleLock={onToggleLock}
          onToggleSelect={onToggleSelect}
        />
      </div>
    </div>
  )
}

export function InventoryView() {
  const {
    assignTrophyItem,
    getSelectedItemsValue,
    sellItem,
    sellItems,
    state,
    toggleItemFavorite,
    toggleItemLock,
    updateInventoryViewState,
  } = useGame()
  const [bulkSelectMode, setBulkSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | undefined>(undefined)
  const [activeItemId, setActiveItemId] = useState<string | undefined>(undefined)
  const [gridContainerRef, gridWidth] = useElementWidth()
  const inventoryUiState = state.ui.inventory
  const filters = inventoryUiState.filters
  const sortCriterion = inventoryUiState.sortCriterion
  const filteredItems = useInventoryFilters(state.inventory, filters, sortCriterion)
  const duplicateSkinIds = useMemo(() => getDuplicateSkinIds(state.inventory), [state.inventory])
  const duplicateQuickSelectIds = useMemo(
    () => selectDuplicates(state.inventory, state.marketValues, state.autoSellRules),
    [state.autoSellRules, state.inventory, state.marketValues],
  )
  const selectedIdList = useMemo(() => Array.from(selectedIds), [selectedIds])
  const selectedItems = useMemo(() => {
    const selectedIdSet = new Set(selectedIdList)

    return state.inventory.filter((item) => selectedIdSet.has(item.instanceId))
  }, [selectedIdList, state.inventory])
  const selectedCount = selectedItems.length
  const lockedSelectedCount = useMemo(
    () => selectedItems.filter((item) => item.isLocked).length,
    [selectedItems],
  )
  const sellableSelectedCount = selectedCount - lockedSelectedCount
  const selectionModeActive = bulkSelectMode || selectedCount > 0
  const selectedSaleValue = useMemo(
    () => getSelectedItemsValue(selectedIdList),
    [getSelectedItemsValue, selectedIdList],
  )
  const activeItem = useMemo(() => {
    if (!activeItemId) {
      return undefined
    }

    return state.inventory.find((item) => item.instanceId === activeItemId)
  }, [activeItemId, state.inventory])
  const activeItemSaleValue = useMemo(() => {
    if (!activeItem) {
      return undefined
    }

    return getCurrentItemMarketValue(activeItem, state.marketValues)
  }, [activeItem, state.marketValues])
  const columnCount = getColumnCount(gridWidth || 1280)
  const cardRowHeight = getCardRowHeight(gridWidth || 1280)
  const rowCount = Math.ceil(filteredItems.length / columnCount)
  const gridHeight =
    filteredItems.length === 0
      ? 0
      : Math.min(MAX_GRID_HEIGHT, Math.max(MIN_GRID_HEIGHT, rowCount * cardRowHeight))
  const handleToggleSelect = useCallback((itemId: string, index: number, isRangeSelection: boolean) => {
    setSelectedIds((currentSelectedIds) => {
      const nextSelectedIds = new Set(currentSelectedIds)

      if (isRangeSelection && typeof lastSelectedIndex === 'number') {
        const startIndex = Math.min(lastSelectedIndex, index)
        const endIndex = Math.max(lastSelectedIndex, index)

        for (let itemIndex = startIndex; itemIndex <= endIndex; itemIndex += 1) {
          const item = filteredItems[itemIndex]

          if (item) {
            nextSelectedIds.add(item.instanceId)
          }
        }
      } else if (nextSelectedIds.has(itemId)) {
        nextSelectedIds.delete(itemId)
      } else {
        nextSelectedIds.add(itemId)
      }

      return nextSelectedIds
    })
    setLastSelectedIndex(index)
  }, [filteredItems, lastSelectedIndex])
  const cellProps = useMemo<GridCellProps>(
    () => ({
      bulkSelectMode: selectionModeActive,
      columnCount,
      duplicateSkinIds,
      items: filteredItems,
      onOpenItem: (item) => setActiveItemId(item.instanceId),
      onToggleFavorite: toggleItemFavorite,
      onToggleLock: toggleItemLock,
      onToggleSelect: handleToggleSelect,
      selectedIds,
    }),
    [
      columnCount,
      duplicateSkinIds,
      filteredItems,
      handleToggleSelect,
      selectionModeActive,
      selectedIds,
      toggleItemFavorite,
      toggleItemLock,
    ],
  )

  function clearSelection() {
    setSelectedIds(new Set())
    setLastSelectedIndex(undefined)
  }

  function selectDuplicateItems() {
    setBulkSelectMode(true)
    setSelectedIds(new Set(duplicateQuickSelectIds))
    setLastSelectedIndex(undefined)
  }

  function sellSelectedItems() {
    sellItems(selectedIdList)
    clearSelection()
    setBulkSelectMode(false)
  }

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-3 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="border-l-4 border-rarity-industrial pl-4">
          <h2 className="text-2xl font-semibold text-cs-text sm:text-3xl">Inventory</h2>
          <p className="mt-2 text-sm text-cs-muted">
            {filteredItems.length} of {state.inventory.length} items
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(220px,280px)_minmax(240px,320px)]">
          <div className="border border-cs-border bg-cs-panel p-4">
            <p className="flex items-center gap-2 font-mono text-xs uppercase text-cs-muted">
              Inventory Value
              <Tooltip label="Explain inventory value">
                Inventory value changes with market movement, auto-sell, trade-ups, and manual sales.
              </Tooltip>
            </p>
            <p className="mt-1 text-2xl font-semibold text-cs-green">
              {formatCurrency(state.inventoryValue)}
            </p>
            <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
          <button
            aria-pressed={selectionModeActive}
            className={[
              'inline-flex min-h-11 items-center justify-center gap-2 border px-3 py-2 text-sm font-medium transition-colors',
              selectionModeActive
                ? 'border-rarity-special bg-rarity-special/10 text-rarity-special'
                : 'border-cs-border text-cs-muted hover:text-cs-text',
            ].join(' ')}
            onClick={() => {
              if (selectionModeActive) {
                setBulkSelectMode(false)
                clearSelection()
              } else {
                setBulkSelectMode(true)
              }
            }}
            type="button"
          >
            <CheckSquare size={16} />
            Bulk Select
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-cs-border px-3 py-2 text-sm font-medium text-cs-muted transition-colors hover:text-cs-text disabled:cursor-not-allowed disabled:opacity-50"
            disabled={duplicateQuickSelectIds.length === 0}
            onClick={selectDuplicateItems}
            title="Select duplicate copies while keeping the strongest version"
            type="button"
          >
            <Copy size={16} />
            Sell Duplicates
          </button>
            </div>
          </div>
          <InventoryValueChart
            currentValue={state.inventoryValue}
            history={state.inventoryValueHistory}
          />
        </div>
      </div>

      <div data-onboarding-target="inventory-filters">
        <InventoryFilterBar
          filters={filters}
          onFiltersChange={(nextFilters) =>
            updateInventoryViewState({ filters: { ...filters, ...nextFilters } })
          }
          onReset={() => updateInventoryViewState(defaultInventoryViewUiState)}
          onSortCriterionChange={(nextSortCriterion) =>
            updateInventoryViewState({ sortCriterion: nextSortCriterion })
          }
          sortCriterion={sortCriterion}
        />
      </div>

      {selectedCount > 0 ? (
        <div className="mt-5">
          <BulkActionsToolbar
            lockedSelectedCount={lockedSelectedCount}
            onClearSelection={clearSelection}
            onSellSelected={sellSelectedItems}
            selectedCount={selectedCount}
            selectedValue={selectedSaleValue}
            sellableCount={sellableSelectedCount}
          />
        </div>
      ) : null}

      <div className="mt-5" data-onboarding-target="inventory-grid" ref={gridContainerRef}>
        {filteredItems.length > 0 && gridWidth > 0 ? (
          <Grid
            cellComponent={InventoryGridCell}
            cellProps={cellProps}
            className="border border-cs-border bg-cs-bg"
            columnCount={columnCount}
            columnWidth={Math.floor(gridWidth / columnCount)}
            defaultHeight={gridHeight}
            defaultWidth={gridWidth}
            overscanCount={2}
            rowCount={rowCount}
            rowHeight={cardRowHeight}
            style={{
              height: gridHeight,
              width: gridWidth,
            }}
          />
        ) : (
          <div className="grid min-h-80 place-items-center border border-cs-border bg-cs-panel p-8 text-center text-cs-muted">
            <div>
              <p className="text-lg font-semibold text-cs-text">No inventory items found</p>
              <p className="mt-2 text-sm">Open cases or adjust filters.</p>
            </div>
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        <ItemDetailModal
          items={filteredItems}
          item={activeItem}
          onClose={() => setActiveItemId(undefined)}
          onItemChange={(item) => setActiveItemId(item.instanceId)}
          onAddToTrophyRoom={(itemId, slotId) => assignTrophyItem(slotId, itemId)}
          onSell={sellItem}
          onToggleFavorite={toggleItemFavorite}
          onToggleLock={toggleItemLock}
          marketHistory={state.marketHistory}
          saleValue={activeItemSaleValue}
        />
      </Suspense>
    </section>
  )
}
