import { useMemo, useState } from 'react'
import { AssetImage } from '../components/AssetImage'
import { CaseOpenControls, type CaseOpenOptions } from '../components/CaseOpenControls'
import { ItemDetailModal } from '../components/ItemDetailModal'
import { PlaceholderView } from '../components/PlaceholderView'
import { RecentDropsFeed } from '../components/RecentDropsFeed'
import type { SkinInstance } from '../data/models'
import { getMaxMultiOpenBatch } from '../data/upgrades'
import { useGame } from '../hooks/useGame'
import { canOpenCaseFromSelection } from '../utils/caseSelection'
import { formatCurrency } from '../utils/format'
import { getCurrentItemMarketValue } from '../utils/inventory'

export function Main() {
  const {
    assignTrophyItem,
    availableCases,
    openCase,
    sellItem,
    state,
    toggleItemFavorite,
    toggleItemLock,
  } = useGame()
  const [activeItem, setActiveItem] = useState<SkinInstance | undefined>(undefined)
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>()
  const openableCases = useMemo(() => {
    const cases = availableCases.filter((caseDef) => canOpenCaseFromSelection(caseDef, state))

    return [...cases].sort((left, right) => {
      const leftFavorite = state.favoriteCaseIds.includes(left.id) ? 0 : 1
      const rightFavorite = state.favoriteCaseIds.includes(right.id) ? 0 : 1

      return leftFavorite - rightFavorite || left.cost - right.cost || left.name.localeCompare(right.name)
    })
  }, [availableCases, state])
  const selectedCase = useMemo(() => {
    return openableCases.find((caseDef) => caseDef.id === selectedCaseId) ?? openableCases[0]
  }, [openableCases, selectedCaseId])
  const modalItem = useMemo(() => {
    if (!activeItem) {
      return undefined
    }

    return state.inventory.find((item) => item.instanceId === activeItem.instanceId) ?? activeItem
  }, [activeItem, state.inventory])
  const modalItemIsOwned = modalItem
    ? state.inventory.some((item) => item.instanceId === modalItem.instanceId)
    : false
  const activeItemSaleValue = useMemo(() => {
    if (!modalItem) {
      return undefined
    }

    return getCurrentItemMarketValue(modalItem, state.marketValues)
  }, [modalItem, state.marketValues])
  function handleOpenSelectedCase(quantity: number, options: CaseOpenOptions) {
    if (!selectedCase) {
      return
    }

    openCase(selectedCase.id, quantity, options)
  }

  return (
    <PlaceholderView accent="special" title="Main">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(19rem,22rem)_minmax(0,1fr)]">
        <div className="min-w-0 border border-cs-border bg-cs-surface p-4">
          <div className="grid min-h-44 place-items-center border border-cs-border bg-cs-panel">
            <AssetImage alt="" className="h-32 w-32 object-contain" src={selectedCase?.image} />
          </div>
          <div className="mt-4">
            <label className="block text-sm text-cs-muted">
              Active Case
              <select
                className="mt-2 w-full border border-cs-border bg-cs-panel px-3 py-2 text-cs-text outline-none focus:border-rarity-special"
                disabled={openableCases.length === 0}
                onChange={(event) => setSelectedCaseId(event.target.value)}
                value={selectedCase?.id ?? ''}
              >
                {openableCases.map((caseDef) => (
                  <option key={caseDef.id} value={caseDef.id}>
                    {caseDef.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedCase ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="border border-cs-border bg-cs-panel px-3 py-2">
                  <p className="font-mono text-[10px] uppercase text-cs-muted">Cost</p>
                  <p className="mt-1 font-semibold text-cs-text">{formatCurrency(selectedCase.cost)}</p>
                </div>
                <div className="border border-cs-border bg-cs-panel px-3 py-2">
                  <p className="font-mono text-[10px] uppercase text-cs-muted">Drop Odds</p>
                  <p className="mt-1 font-semibold text-rarity-special">By rarity</p>
                </div>
              </div>
            ) : null}
            {selectedCase ? (
              <div className="mt-4" data-onboarding-target="open-case-controls">
                <CaseOpenControls
                  canOpen={canOpenCaseFromSelection(selectedCase, state)}
                  caseDef={selectedCase}
                  maxQuantity={getMaxMultiOpenBatch(state.upgrades, state.learnedSkillNodeIds)}
                  money={state.money}
                  onOpen={handleOpenSelectedCase}
                />
              </div>
            ) : (
              <p className="mt-4 border border-cs-border bg-cs-panel px-3 py-2 text-sm text-cs-muted">
                No openable cases
              </p>
            )}
          </div>
        </div>
        <RecentDropsFeed
          animateHighlights={state.settings.recentDropFeedAnimationsEnabled && !state.settings.simplifiedAnimations}
          drops={state.recentDrops}
          inventory={state.inventory}
          marketValues={state.marketValues}
          onOpenItem={setActiveItem}
        />
      </div>

      <ItemDetailModal
        isOwned={modalItemIsOwned}
        item={modalItem}
        items={state.inventory}
        onClose={() => setActiveItem(undefined)}
        onItemChange={setActiveItem}
        onAddToTrophyRoom={(itemId, slotId) => assignTrophyItem(slotId, itemId)}
        onSell={sellItem}
        onToggleFavorite={toggleItemFavorite}
        onToggleLock={toggleItemLock}
        marketHistory={state.marketHistory}
        saleValue={activeItemSaleValue}
      />

    </PlaceholderView>
  )
}
