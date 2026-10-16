import { AlertTriangle, Eye, Search, Sparkles, Trophy, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AssetImage } from '../components/AssetImage'
import { ItemDetailModal } from '../components/ItemDetailModal'
import { PatternBadge } from '../components/PatternInfo'
import { Rarity, type SkinInstance } from '../data/models'
import { getSkinRarityColor } from '../data/rarities'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'
import { getCurrentItemMarketValue } from '../utils/inventory'
import { getSkinRarityLabel, getWearLabel } from '../utils/itemLabels'
import {
  createTrophySlotDefinitions,
  getMissingTrophyAssignments,
  getTrophyCombinedValue,
  getTrophyDisplayItem,
  getTrophyInventoryItem,
  getTrophyRoomSlotCount,
  getTrophyScoreForInventory,
  type TrophySlotDefinition,
} from '../utils/trophyRoom'

const rarityStyles: Record<Rarity, { border: string }> = {
  [Rarity.Consumer]: { border: 'border-rarity-consumer' },
  [Rarity.Industrial]: { border: 'border-rarity-industrial' },
  [Rarity.MilSpec]: { border: 'border-rarity-mil-spec' },
  [Rarity.Restricted]: { border: 'border-rarity-restricted' },
  [Rarity.Classified]: { border: 'border-rarity-classified' },
  [Rarity.Covert]: { border: 'border-rarity-covert' },
  [Rarity.SpecialItem]: { border: 'border-rarity-special' },
  [Rarity.Contraband]: { border: 'border-rarity-contraband' },
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-cs-border bg-cs-panel px-3 py-2">
      <p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-cs-text">{value}</p>
    </div>
  )
}

function getItemSearchText(item: SkinInstance) {
  return `${item.weapon} ${item.finish} ${getSkinRarityLabel(item)} ${getWearLabel(item.wear)} ${item.pattern?.name ?? ''} ${item.paintSeed ?? ''}`.toLowerCase()
}

function TrophySlotCard({
  displayItem,
  inventoryItem,
  isMissing,
  marketValues,
  onOpenDetails,
  onRemove,
  onSelect,
  slot,
}: {
  displayItem: SkinInstance | undefined
  inventoryItem: SkinInstance | undefined
  isMissing: boolean
  marketValues: Record<string, number>
  onOpenDetails: (item: SkinInstance) => void
  onRemove: (slotId: string) => void
  onSelect: (slotId: string) => void
  slot: TrophySlotDefinition
}) {
  const rarityColor = displayItem ? getSkinRarityColor(displayItem) : undefined
  const styles = displayItem ? rarityStyles[displayItem.rarity] : undefined
  const value = displayItem ? getCurrentItemMarketValue(inventoryItem ?? displayItem, marketValues) : 0

  return (
    <article
      className={[
        'min-h-80 border bg-cs-panel p-3 transition-colors',
        styles?.border ?? 'border-cs-border',
      ].join(' ')}
      style={rarityColor ? { borderColor: rarityColor } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase text-cs-muted">Slot {slot.index}</p>
          <h3 className="mt-1 text-sm font-semibold text-cs-text">{slot.title}</h3>
        </div>
        {isMissing ? <AlertTriangle className="text-rarity-covert" size={17} /> : null}
      </div>

      <button
        className="mt-3 grid h-28 w-full place-items-center border bg-cs-surface"
        onClick={() => onSelect(slot.id)}
        style={rarityColor ? { borderColor: rarityColor } : undefined}
        type="button"
      >
        {displayItem ? (
          <AssetImage
            alt={`${displayItem.weapon} ${displayItem.finish}`}
            className="h-24 w-24 object-contain transition-transform hover:scale-105"
            src={displayItem.image}
          />
        ) : (
          <Trophy className="text-cs-muted" size={38} />
        )}
      </button>
      {displayItem ? <div className="mt-2"><PatternBadge compact item={displayItem} /></div> : null}

      {displayItem ? (
        <div className="mt-3">
          <h4 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-cs-text">
            {displayItem.weapon} | {displayItem.finish}
          </h4>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <SummaryPill label="Value" value={formatCurrency(value)} />
            <SummaryPill label="Float" value={displayItem.floatValue.toFixed(3)} />
            <SummaryPill label="Rarity" value={getSkinRarityLabel(displayItem)} />
            <SummaryPill label="Wear" value={getWearLabel(displayItem.wear)} />
          </div>
          {isMissing ? (
            <p className="mt-2 border border-rarity-covert bg-rarity-covert/10 px-2 py-1.5 text-xs text-rarity-covert">
              Missing from inventory.
            </p>
          ) : null}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              className="inline-flex min-h-10 items-center justify-center gap-1 border border-cs-border px-2 text-xs font-semibold text-cs-muted hover:text-cs-text"
              onClick={() => onOpenDetails(inventoryItem ?? displayItem)}
              type="button"
            >
              <Eye size={13} />
              View
            </button>
            <button
              className="min-h-10 border border-rarity-special px-2 text-xs font-semibold text-rarity-special hover:bg-rarity-special/10"
              onClick={() => onSelect(slot.id)}
              type="button"
            >
              Replace
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-1 border border-rarity-covert px-2 text-xs font-semibold text-rarity-covert hover:bg-rarity-covert/10"
              onClick={() => onRemove(slot.id)}
              type="button"
            >
              <X size={13} />
              Remove
            </button>
          </div>
        </div>
      ) : isMissing ? (
        <div className="mt-3">
          <p className="min-h-10 text-sm font-semibold leading-5 text-rarity-covert">
            Missing from inventory.
          </p>
          <p className="mt-2 text-xs leading-5 text-cs-muted">
            This showcased item was sold, traded, or removed.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className="min-h-10 border border-rarity-special px-2 text-xs font-semibold text-rarity-special hover:bg-rarity-special/10"
              onClick={() => onSelect(slot.id)}
              type="button"
            >
              Replace
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-1 border border-rarity-covert px-2 text-xs font-semibold text-rarity-covert hover:bg-rarity-covert/10"
              onClick={() => onRemove(slot.id)}
              type="button"
            >
              <X size={13} />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          className="mt-3 min-h-10 w-full border border-rarity-special bg-rarity-special/10 px-3 text-sm font-semibold text-rarity-special hover:bg-rarity-special/20"
          onClick={() => onSelect(slot.id)}
          type="button"
        >
          Choose Skin
        </button>
      )}
    </article>
  )
}

function InventoryCandidateButton({
  item,
  onAssign,
  slotId,
}: {
  item: SkinInstance
  onAssign: (slotId: string, itemId: string) => void
  slotId: string
}) {
  const rarityColor = getSkinRarityColor(item)

  return (
    <button
      className="grid w-full grid-cols-[4rem_minmax(0,1fr)] gap-3 border bg-cs-surface p-3 text-left transition-colors hover:bg-cs-panelMuted"
      onClick={() => onAssign(slotId, item.instanceId)}
      style={{ borderColor: rarityColor }}
      type="button"
    >
      <span
        className="grid h-14 w-14 place-items-center border bg-cs-panel"
        style={{ borderColor: rarityColor }}
      >
        <AssetImage alt="" className="h-11 w-11 object-contain" src={item.image} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-cs-text">
          {item.weapon} | {item.finish}
        </span>
        <span className="mt-1 block font-mono text-[10px] uppercase text-cs-muted">
          {getSkinRarityLabel(item)}
        </span>
        <span className="mt-1 block text-xs text-cs-muted">
          {getWearLabel(item.wear)} / {item.floatValue.toFixed(3)} / {formatCurrency(item.marketValue)}
        </span>
      </span>
    </button>
  )
}

export function TrophyRoomView() {
  const {
    assignTrophyItem,
    removeTrophyItem,
    sellItem,
    state,
    toggleItemFavorite,
    toggleItemLock,
  } = useGame()
  const slotDefinitions = useMemo(
    () => createTrophySlotDefinitions(getTrophyRoomSlotCount(state.learnedSkillNodeIds)),
    [state.learnedSkillNodeIds],
  )
  const [selectedSlotId, setSelectedSlotId] = useState(slotDefinitions[0]?.id ?? 'showcase_1')
  const [activeItem, setActiveItem] = useState<SkinInstance | undefined>()
  const [search, setSearch] = useState('')
  const missingAssignments = useMemo(
    () => getMissingTrophyAssignments(state.trophyAssignments, state.inventory),
    [state.inventory, state.trophyAssignments],
  )
  const trophyScore = getTrophyScoreForInventory(state.trophyAssignments, state.inventory, state.marketValues)
  const combinedValue = getTrophyCombinedValue(state.trophyAssignments, state.inventory, state.marketValues)
  const filledCount = slotDefinitions.filter((slot) => state.trophyAssignments[slot.id]).length
  const filteredInventory = useMemo(() => {
    const searchText = search.trim().toLowerCase()
    const sortedItems = [...state.inventory].sort((left, right) => {
      return right.marketValue - left.marketValue || left.floatValue - right.floatValue
    })

    return searchText ? sortedItems.filter((item) => getItemSearchText(item).includes(searchText)) : sortedItems
  }, [search, state.inventory])
  const selectedSlot = slotDefinitions.find((slot) => slot.id === selectedSlotId) ?? slotDefinitions[0]

  function assignSelectedSlot(slotId: string, itemId: string) {
    assignTrophyItem(slotId, itemId)
  }

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-5 sm:p-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="border-l-4 border-rarity-special pl-4">
          <p className="font-mono text-xs uppercase text-rarity-special">Showcase Vault</p>
          <h2 className="mt-1 text-3xl font-semibold text-cs-text sm:text-4xl">Trophy Room</h2>
          <p className="mt-2 max-w-2xl text-sm text-cs-muted">
            Put any owned skin into any slot. Sold or traded trophies stay visible with a missing warning.
          </p>
        </div>
        <div className="grid gap-2 border border-cs-border bg-cs-panel p-3 sm:grid-cols-3">
          <SummaryPill label="Room Score" value={String(trophyScore)} />
          <SummaryPill label="Combined Value" value={formatCurrency(combinedValue)} />
          <SummaryPill label="Filled Slots" value={`${filledCount}/${slotDefinitions.length}`} />
        </div>
      </div>

      {missingAssignments.length > 0 ? (
        <div className="mt-5 flex items-start gap-2 border border-rarity-covert bg-rarity-covert/10 p-3 text-sm text-rarity-covert">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} />
          <p>{missingAssignments.length} showcased item{missingAssignments.length === 1 ? '' : 's'} no longer in inventory.</p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {slotDefinitions.map((slot) => {
            const assignment = state.trophyAssignments[slot.id]
            const inventoryItem = getTrophyInventoryItem(state.trophyAssignments, state.inventory, slot.id)
            const displayItem = getTrophyDisplayItem(state.trophyAssignments, state.inventory, slot.id)
            const isMissing = Boolean(assignment && !inventoryItem)

            return (
              <TrophySlotCard
                displayItem={displayItem}
                inventoryItem={inventoryItem}
                isMissing={isMissing}
                key={slot.id}
                marketValues={state.marketValues}
                onOpenDetails={setActiveItem}
                onRemove={removeTrophyItem}
                onSelect={setSelectedSlotId}
                slot={slot}
              />
            )
          })}
        </div>

        <aside className="border border-cs-border bg-cs-panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase text-cs-muted">Skin Selector</p>
              <h3 className="mt-1 text-xl font-semibold text-cs-text">{selectedSlot?.title ?? 'Showcase Slot'}</h3>
            </div>
            <Sparkles className="text-rarity-special" size={22} />
          </div>

          <label className="mt-4 block text-sm text-cs-muted">
            Active slot
            <select
              className="mt-2 w-full border border-cs-border bg-cs-surface px-3 py-2 text-cs-text outline-none focus:border-rarity-special"
              onChange={(event) => setSelectedSlotId(event.target.value)}
              value={selectedSlotId}
            >
              {slotDefinitions.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.title}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 block text-sm text-cs-muted">
            Search inventory
            <span className="mt-2 flex items-center gap-2 border border-cs-border bg-cs-surface px-3 py-2 focus-within:border-rarity-special">
              <Search size={16} />
              <input
                className="min-w-0 flex-1 bg-transparent text-cs-text outline-none"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Weapon, finish, rarity"
                value={search}
              />
            </span>
          </label>

          <div className="mt-4 max-h-[42rem] space-y-2 overflow-y-auto pr-1">
            {filteredInventory.length > 0 ? (
              filteredInventory.map((item) => (
                <InventoryCandidateButton
                  item={item}
                  key={item.instanceId}
                  onAssign={assignSelectedSlot}
                  slotId={selectedSlotId}
                />
              ))
            ) : (
              <div className="grid min-h-40 place-items-center border border-cs-border bg-cs-surface p-4 text-center text-sm text-cs-muted">
                No inventory items match this search.
              </div>
            )}
          </div>
        </aside>
      </div>

      <ItemDetailModal
        isOwned={activeItem ? state.inventory.some((item) => item.instanceId === activeItem.instanceId) : false}
        item={activeItem}
        items={state.inventory}
        marketHistory={state.marketHistory}
        onClose={() => setActiveItem(undefined)}
        onItemChange={setActiveItem}
        onSell={sellItem}
        onToggleFavorite={toggleItemFavorite}
        onToggleLock={toggleItemLock}
        saleValue={activeItem ? getCurrentItemMarketValue(activeItem, state.marketValues) : undefined}
      />
    </section>
  )
}
