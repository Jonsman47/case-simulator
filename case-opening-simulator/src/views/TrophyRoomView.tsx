import { AlertTriangle, CheckCircle, Search, Sparkles, Trophy, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AssetImage } from '../components/AssetImage'
import { Rarity, TrophySlotId, type SkinInstance } from '../data/models'
import { getSkinRarityColor } from '../data/rarities'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'
import { getCurrentItemMarketValue } from '../utils/inventory'
import { getSkinRarityLabel, getWearLabel } from '../utils/itemLabels'
import {
  TROPHY_SLOT_DEFINITIONS,
  getMissingTrophyAssignments,
  getRecommendedTrophySlot,
  getTrophyCombinedValue,
  getTrophyDisplayItem,
  getTrophyInventoryItem,
  getTrophyScore,
  type TrophySlotDefinition,
} from '../utils/trophyRoom'

const rarityStyles: Record<Rarity, { border: string; text: string; tint: string }> = {
  [Rarity.Consumer]: {
    border: 'border-rarity-consumer',
    text: 'text-rarity-consumer',
    tint: 'bg-rarity-consumer/10',
  },
  [Rarity.Industrial]: {
    border: 'border-rarity-industrial',
    text: 'text-rarity-industrial',
    tint: 'bg-rarity-industrial/10',
  },
  [Rarity.MilSpec]: {
    border: 'border-rarity-mil-spec',
    text: 'text-rarity-mil-spec',
    tint: 'bg-rarity-mil-spec/10',
  },
  [Rarity.Restricted]: {
    border: 'border-rarity-restricted',
    text: 'text-rarity-restricted',
    tint: 'bg-rarity-restricted/10',
  },
  [Rarity.Classified]: {
    border: 'border-rarity-classified',
    text: 'text-rarity-classified',
    tint: 'bg-rarity-classified/10',
  },
  [Rarity.Covert]: {
    border: 'border-rarity-covert',
    text: 'text-rarity-covert',
    tint: 'bg-rarity-covert/10',
  },
  [Rarity.SpecialItem]: {
    border: 'border-rarity-special',
    text: 'text-rarity-special',
    tint: 'bg-rarity-special/10',
  },
  [Rarity.Contraband]: {
    border: 'border-rarity-contraband',
    text: 'text-rarity-contraband',
    tint: 'bg-rarity-contraband/10',
  },
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
  return `${item.weapon} ${item.finish} ${getSkinRarityLabel(item)} ${getWearLabel(item.wear)}`.toLowerCase()
}

function TrophySlotCard({
  displayItem,
  isMissing,
  isSelected,
  inventoryItem,
  marketValues,
  onRemove,
  onSelect,
  slot,
}: {
  displayItem: SkinInstance | undefined
  isMissing: boolean
  isSelected: boolean
  inventoryItem: SkinInstance | undefined
  marketValues: Record<string, number>
  onRemove: (slotId: TrophySlotId) => void
  onSelect: (slotId: TrophySlotId) => void
  slot: TrophySlotDefinition
}) {
  const styles = displayItem ? rarityStyles[displayItem.rarity] : undefined
  const rarityColor = displayItem ? getSkinRarityColor(displayItem) : undefined
  const currentItem = inventoryItem ?? displayItem
  const statValue = currentItem ? slot.getStatValue(currentItem) : 'Empty'

  return (
    <article
      className={[
        'relative min-h-96 overflow-hidden border bg-cs-panel p-4 transition-colors',
        isSelected ? 'border-rarity-special shadow-glow' : styles?.border ?? 'border-cs-border',
      ].join(' ')}
      style={isSelected || !rarityColor ? undefined : { borderColor: rarityColor }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-28 w-28 -translate-x-1/2 opacity-70"
        style={{
          backgroundColor: rarityColor ? `${rarityColor}1f` : undefined,
          clipPath: 'polygon(45% 0, 55% 0, 100% 100%, 0 100%)',
        }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase text-cs-muted">{slot.subtitle}</p>
          <h3 className="mt-1 truncate text-lg font-semibold text-cs-text">{slot.title}</h3>
        </div>
        {displayItem ? (
          <button
            aria-label={`Remove ${slot.title}`}
            className="grid h-8 w-8 shrink-0 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-rarity-covert"
            onClick={() => onRemove(slot.id)}
            title="Remove"
            type="button"
          >
            <X size={15} />
          </button>
        ) : null}
      </div>

      <button
        className="relative mt-5 flex w-full flex-col items-center text-center"
        onClick={() => onSelect(slot.id)}
        type="button"
      >
        <span
          className="grid h-36 w-full place-items-center border bg-cs-surface"
          style={rarityColor ? { borderColor: rarityColor, backgroundColor: `${rarityColor}14` } : undefined}
        >
          {displayItem ? (
            <AssetImage
              alt={`${displayItem.weapon} ${displayItem.finish}`}
              className="h-28 w-28 object-contain transition-transform duration-300 hover:scale-105"
              src={displayItem.image}
            />
          ) : (
            <Trophy className="text-cs-muted" size={46} />
          )}
        </span>
        <span className="mt-4 block h-4 w-28 border border-cs-border bg-cs-bg" />
        <span className="block h-4 w-36 border border-cs-border bg-cs-surface" />
      </button>

      {displayItem ? (
        <div className="relative mt-4">
          <h4 className="truncate text-center text-base font-semibold text-cs-text">
            {displayItem.weapon} | {displayItem.finish}
          </h4>
          <p className="mt-1 text-center font-mono text-[10px] uppercase" style={{ color: rarityColor }}>
            {getSkinRarityLabel(displayItem)}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <SummaryPill label={slot.statLabel} value={statValue} />
            <SummaryPill
              label="Value"
              value={formatCurrency(getCurrentItemMarketValue(inventoryItem ?? displayItem, marketValues))}
            />
          </div>
          {isMissing ? (
            <div className="mt-3 flex items-start gap-2 border border-rarity-covert bg-rarity-covert/10 p-2 text-xs text-rarity-covert">
              <AlertTriangle className="shrink-0" size={14} />
              <span>No longer in inventory. Replace it from the picker.</span>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 border border-cs-green/50 bg-cs-green/10 p-2 text-xs text-cs-green">
              <CheckCircle size={14} />
              <span>Currently owned</span>
            </div>
          )}
        </div>
      ) : (
        <div className="relative mt-4 text-center">
          <p className="text-sm font-semibold text-cs-text">Empty pedestal</p>
          <p className="mt-1 text-xs text-cs-muted">Select this slot, then assign an inventory item.</p>
        </div>
      )}
    </article>
  )
}

function InventoryCandidateButton({
  item,
  onAssign,
  slot,
}: {
  item: SkinInstance
  onAssign: (slotId: TrophySlotId, itemId: string) => void
  slot: TrophySlotId
}) {
  const rarityColor = getSkinRarityColor(item)

  return (
    <button
      className="grid w-full grid-cols-[4rem_minmax(0,1fr)] gap-3 border bg-cs-surface p-3 text-left transition-colors hover:bg-cs-panelMuted"
      onClick={() => onAssign(slot, item.instanceId)}
      style={{ borderColor: rarityColor }}
      type="button"
    >
      <span
        className="grid h-14 w-14 place-items-center border bg-cs-panel"
        style={{ borderColor: rarityColor, backgroundColor: `${rarityColor}14` }}
      >
        <AssetImage alt="" className="h-11 w-11 object-contain" src={item.image} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-cs-text">
          {item.weapon} | {item.finish}
        </span>
        <span className="mt-1 block font-mono text-[10px] uppercase" style={{ color: rarityColor }}>
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
  const { assignTrophyItem, removeTrophyItem, state } = useGame()
  const [selectedSlotId, setSelectedSlotId] = useState<TrophySlotId>(TrophySlotId.MostExpensiveSkin)
  const [search, setSearch] = useState('')
  const missingAssignments = useMemo(
    () => getMissingTrophyAssignments(state.trophyAssignments, state.inventory),
    [state.inventory, state.trophyAssignments],
  )
  const trophyScore = getTrophyScore(state.trophyAssignments, state.marketValues)
  const combinedValue = getTrophyCombinedValue(state.trophyAssignments, state.marketValues)
  const filledCount = TROPHY_SLOT_DEFINITIONS.filter((slot) => state.trophyAssignments[slot.id]).length
  const filteredInventory = useMemo(() => {
    const searchText = search.trim().toLowerCase()
    const sortedItems = [...state.inventory].sort((left, right) => {
      return right.marketValue - left.marketValue || left.floatValue - right.floatValue
    })

    if (!searchText) {
      return sortedItems
    }

    return sortedItems.filter((item) => getItemSearchText(item).includes(searchText))
  }, [search, state.inventory])
  const selectedSlot = TROPHY_SLOT_DEFINITIONS.find((slot) => slot.id === selectedSlotId) ?? TROPHY_SLOT_DEFINITIONS[0]
  const suggestedItems = useMemo(() => {
    return filteredInventory.filter((item) => {
      return getRecommendedTrophySlot(item, state) === selectedSlotId || selectedSlotId === TrophySlotId.FavouriteCollection
    })
  }, [filteredInventory, selectedSlotId, state])
  const pickerItems = suggestedItems.length > 0 ? suggestedItems : filteredInventory

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-5 sm:p-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="border-l-4 border-rarity-special pl-4">
          <p className="font-mono text-xs uppercase text-rarity-special">Showcase Vault</p>
          <h2 className="mt-1 text-3xl font-semibold text-cs-text sm:text-4xl">Trophy Room</h2>
          <p className="mt-2 max-w-2xl text-sm text-cs-muted">
            Curate your proudest pulls into lit pedestals. Sold or traded trophies remain displayed as archived snapshots.
          </p>
        </div>
        <div className="grid gap-2 border border-cs-border bg-cs-panel p-3 sm:grid-cols-3">
          <SummaryPill label="Room Score" value={String(trophyScore)} />
          <SummaryPill label="Combined Value" value={formatCurrency(combinedValue)} />
          <SummaryPill label="Filled Slots" value={`${filledCount}/${TROPHY_SLOT_DEFINITIONS.length}`} />
        </div>
      </div>

      {missingAssignments.length > 0 ? (
        <div className="mt-5 flex items-start gap-2 border border-rarity-covert bg-rarity-covert/10 p-3 text-sm text-rarity-covert">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} />
          <p>
            {missingAssignments.length} trophy item{missingAssignments.length === 1 ? '' : 's'} no longer in inventory.
            Use a slot's remove button or assign a replacement.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {TROPHY_SLOT_DEFINITIONS.map((slot) => {
            const inventoryItem = getTrophyInventoryItem(state.trophyAssignments, state.inventory, slot.id)
            const displayItem = getTrophyDisplayItem(state.trophyAssignments, state.inventory, slot.id)
            const isMissing = Boolean(displayItem && !inventoryItem)

            return (
              <TrophySlotCard
                displayItem={displayItem}
                inventoryItem={inventoryItem}
                isMissing={isMissing}
                isSelected={selectedSlotId === slot.id}
                key={slot.id}
                marketValues={state.marketValues}
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
              <p className="font-mono text-xs uppercase text-cs-muted">Assignment Console</p>
              <h3 className="mt-1 text-xl font-semibold text-cs-text">{selectedSlot.title}</h3>
            </div>
            <Sparkles className="text-rarity-special" size={22} />
          </div>

          <label className="mt-4 block text-sm text-cs-muted">
            Active slot
            <select
              className="mt-2 w-full border border-cs-border bg-cs-surface px-3 py-2 text-cs-text outline-none focus:border-rarity-special"
              onChange={(event) => setSelectedSlotId(event.target.value as TrophySlotId)}
              value={selectedSlotId}
            >
              {TROPHY_SLOT_DEFINITIONS.map((slot) => (
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
            {pickerItems.length > 0 ? (
              pickerItems.map((item) => (
                <InventoryCandidateButton
                  item={item}
                  key={item.instanceId}
                  onAssign={assignTrophyItem}
                  slot={selectedSlotId}
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
    </section>
  )
}
