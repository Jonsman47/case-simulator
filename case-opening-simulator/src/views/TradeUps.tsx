import { ArrowUpRight, Check, Lock, Shuffle, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AssetImage } from '../components/AssetImage'
import { CASE_DEFINITIONS } from '../data/cases'
import type { GameUiEvent } from '../data/gameState'
import { Rarity, type SkinInstance } from '../data/models'
import { getSkinRarityColor } from '../data/rarities'
import { SKIN_DEFINITIONS } from '../data/skins'
import { getSkillTradeUpInputCostMultiplier } from '../data/skills'
import { getGameEventTradeUpInputCostMultiplier } from '../events/eventManager'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'
import { getCurrentItemMarketValue } from '../utils/inventory'
import { getRarityLabel, getSkinRarityLabel, getWearLabel } from '../utils/itemLabels'
import {
  TRADE_UP_INPUT_COUNT,
  analyzeTradeUp,
  getNextTradeUpRarity,
  isTradeUpEligibleItem,
  tradeUpRarityOrder,
} from '../utils/tradeUp'

const rarityBorderClasses: Record<Rarity, string> = {
  [Rarity.Consumer]: 'border-rarity-consumer',
  [Rarity.Industrial]: 'border-rarity-industrial',
  [Rarity.MilSpec]: 'border-rarity-mil-spec',
  [Rarity.Restricted]: 'border-rarity-restricted',
  [Rarity.Classified]: 'border-rarity-classified',
  [Rarity.Covert]: 'border-rarity-covert',
  [Rarity.SpecialItem]: 'border-rarity-special',
  [Rarity.Contraband]: 'border-rarity-contraband',
}

const rarityTextClasses: Record<Rarity, string> = {
  [Rarity.Consumer]: 'text-rarity-consumer',
  [Rarity.Industrial]: 'text-rarity-industrial',
  [Rarity.MilSpec]: 'text-rarity-mil-spec',
  [Rarity.Restricted]: 'text-rarity-restricted',
  [Rarity.Classified]: 'text-rarity-classified',
  [Rarity.Covert]: 'text-rarity-covert',
  [Rarity.SpecialItem]: 'text-rarity-special',
  [Rarity.Contraband]: 'text-rarity-contraband',
}

const tradeableRarities = tradeUpRarityOrder.filter((rarity) => getNextTradeUpRarity(rarity))
const casesById = new Map(CASE_DEFINITIONS.map((caseDef) => [caseDef.id, caseDef]))
const skinsById = new Map(SKIN_DEFINITIONS.map((skin) => [skin.id, skin]))
const fallbackSkinImage = '/assets/placeholder.png'

function getLatestTradeUpEvent(events: GameUiEvent[]) {
  return events.find((event): event is Extract<GameUiEvent, { type: 'trade_up_completed' }> => {
    return event.type === 'trade_up_completed'
  })
}

function buildRarityCounts(items: SkinInstance[]) {
  return tradeableRarities.reduce(
    (counts, rarity) => ({
      ...counts,
      [rarity]: items.filter((item) => item.rarity === rarity).length,
    }),
    {} as Record<Rarity, number>,
  )
}

function isRealSkinImage(image: string | undefined) {
  return Boolean(image && image !== fallbackSkinImage)
}

function getResolvedSkinImage(item: Pick<SkinInstance, 'id' | 'image'>) {
  const catalogImage = skinsById.get(item.id)?.image

  // Old saves and imported catalogs can disagree about image paths. Prefer the
  // instance image when it is specific, then fall back to the current catalog,
  // and only use the placeholder when neither source has a usable asset.
  if (isRealSkinImage(item.image)) {
    return item.image
  }

  if (isRealSkinImage(catalogImage)) {
    return catalogImage
  }

  return item.image || catalogImage || fallbackSkinImage
}

export function TradeUps() {
  const { state, tradeUpItems } = useGame()
  const [activeRarity, setActiveRarity] = useState<Rarity>(Rarity.Consumer)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const eligibleItems = useMemo(
    () => state.inventory.filter(isTradeUpEligibleItem),
    [state.inventory],
  )
  const rarityCounts = useMemo(() => buildRarityCounts(eligibleItems), [eligibleItems])
  const selectedItems = useMemo(() => {
    const selectedIdSet = selectedIds

    return state.inventory.filter((item) => selectedIdSet.has(item.instanceId))
  }, [selectedIds, state.inventory])
  const activeItems = useMemo(
    () => eligibleItems.filter((item) => item.rarity === activeRarity),
    [activeRarity, eligibleItems],
  )
  const tradeUpInputCostMultiplier =
    getSkillTradeUpInputCostMultiplier(state.learnedSkillNodeIds) *
    getGameEventTradeUpInputCostMultiplier(state.activeEvents)
  const analysis = useMemo(
    () => analyzeTradeUp({
      inputCostMultiplier: tradeUpInputCostMultiplier,
      inputItems: selectedItems,
      marketValues: state.marketValues,
    }),
    [selectedItems, state.marketValues, tradeUpInputCostMultiplier],
  )
  const latestTradeUpEvent = getLatestTradeUpEvent(state.uiEvents)

  function toggleSelected(item: SkinInstance) {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(item.instanceId)) {
        nextIds.delete(item.instanceId)
        return nextIds
      }

      const currentSelection = state.inventory.filter((inventoryItem) =>
        nextIds.has(inventoryItem.instanceId),
      )
      const currentRarity = currentSelection[0]?.rarity

      if (currentRarity && currentRarity !== item.rarity) {
        return new Set([item.instanceId])
      }

      if (nextIds.size >= TRADE_UP_INPUT_COUNT) {
        return nextIds
      }

      nextIds.add(item.instanceId)
      return nextIds
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function executeTradeUp() {
    if (!analysis.canTradeUp) {
      return
    }

    tradeUpItems(Array.from(selectedIds))
    clearSelection()
  }

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-5 sm:p-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="border-l-4 border-rarity-restricted pl-4">
          <p className="font-mono text-xs uppercase text-rarity-restricted">Contracts</p>
          <h2 className="mt-1 text-3xl font-semibold text-cs-text sm:text-4xl">Trade Ups</h2>
          <p className="mt-2 max-w-2xl text-sm text-cs-muted">
            Combine 10 unlocked, non-favorited skins of the same rarity into one skin from the next tier.
          </p>
        </div>
        <div className="grid gap-2 border border-cs-border bg-cs-panel p-3 sm:grid-cols-3">
          <StatPill label="Selected" value={`${selectedItems.length}/${TRADE_UP_INPUT_COUNT}`} />
          <StatPill label="Input Value" value={formatCurrency(analysis.inputValue)} />
          <StatPill label="Possible Outcomes" value={analysis.outcomes.length.toLocaleString()} />
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            {tradeableRarities.map((rarity) => (
              <button
                aria-pressed={activeRarity === rarity}
                className={[
                  'inline-flex items-center gap-2 border px-3 py-2 font-mono text-xs uppercase transition-colors',
                  activeRarity === rarity
                    ? `${rarityBorderClasses[rarity]} ${rarityTextClasses[rarity]} bg-cs-panel`
                    : 'border-cs-border text-cs-muted hover:text-cs-text',
                ].join(' ')}
                key={rarity}
                onClick={() => {
                  setActiveRarity(rarity)
                  clearSelection()
                }}
                type="button"
              >
                {getRarityLabel(rarity)}
                <span className="text-cs-muted">{rarityCounts[rarity]}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {activeItems.length > 0 ? (
              activeItems.map((item) => (
                <TradeUpItemButton
                  isSelected={selectedIds.has(item.instanceId)}
                  item={item}
                  key={item.instanceId}
                  marketValue={getCurrentItemMarketValue(item, state.marketValues)}
                  onToggle={toggleSelected}
                />
              ))
            ) : (
              <div className="col-span-full grid min-h-56 place-items-center border border-cs-border bg-cs-panel p-8 text-center">
                <div>
                  <p className="text-lg font-semibold text-cs-text">No eligible skins</p>
                  <p className="mt-2 text-sm text-cs-muted">
                    Locked, favorited, Covert, Special Item, and Contraband skins are excluded.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="border border-cs-border bg-cs-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase text-cs-muted">Contract Preview</p>
                <h3 className="mt-1 text-xl font-semibold text-cs-text">
                  {analysis.inputRarity && analysis.outcomeRarity
                    ? `${getRarityLabel(analysis.inputRarity)} to ${getRarityLabel(analysis.outcomeRarity)}`
                    : 'Select inputs'}
                </h3>
              </div>
              <Shuffle className="text-rarity-restricted" size={22} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <StatPill label="Input" value={formatCurrency(analysis.inputValue)} />
              <StatPill label="Outputs" value={analysis.outcomes.length.toLocaleString()} />
              <StatPill label="Selected" value={`${selectedItems.length}/${TRADE_UP_INPUT_COUNT}`} />
            </div>

            {analysis.message ? (
              <div className="mt-4 border border-rarity-covert/60 bg-rarity-covert/10 p-3 text-sm text-rarity-covert">
                <p>{analysis.message}</p>
              </div>
            ) : null}

            <button
              className="mt-4 inline-flex w-full items-center justify-center gap-2 border border-rarity-restricted bg-rarity-restricted/10 px-4 py-3 font-semibold text-rarity-restricted transition-colors hover:bg-rarity-restricted/20 disabled:cursor-not-allowed disabled:border-cs-border disabled:bg-transparent disabled:text-cs-muted"
              disabled={!analysis.canTradeUp}
              onClick={executeTradeUp}
              type="button"
            >
              <ArrowUpRight size={18} />
              Trade Up
            </button>
          </section>

          <section className="border border-cs-border bg-cs-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-cs-text">Possible Outcomes</h3>
              <span className="font-mono text-xs uppercase text-cs-muted">
                {analysis.outcomes.length} skins
              </span>
            </div>
            <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {analysis.outcomes.length > 0 ? (
                analysis.outcomes.map((outcome) => (
                  <OutcomeRow outcome={outcome} key={outcome.skin.id} />
                ))
              ) : (
                <div className="grid min-h-32 place-items-center border border-cs-border bg-cs-surface p-4 text-center text-sm text-cs-muted">
                  Select 10 valid inputs to calculate outcome odds.
                </div>
              )}
            </div>
          </section>

          {latestTradeUpEvent ? (
            <section className="animate-pulse border border-rarity-special bg-cs-panel p-4 shadow-glow">
              <p className="font-mono text-xs uppercase text-rarity-special">Latest Result</p>
              <div className="mt-3 flex items-center gap-3">
                <div
                  className="grid h-20 w-20 place-items-center border bg-cs-surface"
                  style={{
                    borderColor: getSkinRarityColor(latestTradeUpEvent.item),
                    backgroundColor: `${getSkinRarityColor(latestTradeUpEvent.item)}14`,
                  }}
                >
                  <AssetImage
                    alt=""
                    className="h-14 w-14 object-contain"
                    src={getResolvedSkinImage(latestTradeUpEvent.item)}
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-cs-text">
                    {latestTradeUpEvent.item.weapon} | {latestTradeUpEvent.item.finish}
                  </h3>
                  <p
                    className="mt-1 font-mono text-xs uppercase"
                    style={{ color: getSkinRarityColor(latestTradeUpEvent.item) }}
                  >
                    {getSkinRarityLabel(latestTradeUpEvent.item)}
                  </p>
                  <p className="mt-1 text-sm text-cs-muted">
                    {getWearLabel(latestTradeUpEvent.item.wear)} / {formatCurrency(latestTradeUpEvent.item.marketValue)}
                  </p>
                </div>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </section>
  )
}

function StatPill({
  label,
  tone = 'text-cs-text',
  value,
}: {
  label: string
  tone?: string
  value: string
}) {
  return (
    <div className="border border-cs-border bg-cs-surface px-3 py-2">
      <p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  )
}

function TradeUpItemButton({
  isSelected,
  item,
  marketValue,
  onToggle,
}: {
  isSelected: boolean
  item: SkinInstance
  marketValue: number
  onToggle: (item: SkinInstance) => void
}) {
  const rarityColor = getSkinRarityColor(item)

  return (
    <button
      className={[
        'group relative grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 border bg-cs-panel p-3 text-left transition-colors hover:bg-cs-panelMuted',
        isSelected ? 'ring-2 ring-rarity-special' : '',
      ].join(' ')}
      onClick={() => onToggle(item)}
      style={{ borderColor: rarityColor }}
      type="button"
    >
      <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center border border-cs-border bg-cs-surface text-cs-muted">
        {isSelected ? <Check className="text-rarity-special" size={14} /> : null}
      </span>
      <span
        className="grid h-16 w-16 place-items-center border bg-cs-surface"
        style={{ borderColor: rarityColor, backgroundColor: `${rarityColor}14` }}
      >
        <AssetImage alt="" className="h-12 w-12 object-contain" src={getResolvedSkinImage(item)} />
      </span>
      <span className="min-w-0 pr-7">
        <span className="block truncate text-sm font-semibold text-cs-text">
          {item.weapon} | {item.finish}
        </span>
        <span className="mt-1 block font-mono text-[10px] uppercase text-cs-muted">
          {getWearLabel(item.wear)} / {item.floatValue.toFixed(3)}
        </span>
        <span className="mt-2 flex items-center gap-2 text-xs">
          {item.isLocked ? <Lock size={13} /> : null}
          {item.isFavorited ? <Star size={13} /> : null}
          <span className="font-semibold text-cs-green">{formatCurrency(marketValue)}</span>
        </span>
      </span>
    </button>
  )
}

function OutcomeRow({ outcome }: { outcome: ReturnType<typeof analyzeTradeUp>['outcomes'][number] }) {
  const sourceNames = outcome.sourceCaseIds
    .map((caseId) => casesById.get(caseId)?.name ?? caseId)
    .join(', ')
  const rarityColor = getSkinRarityColor(outcome.skin)

  return (
    <article className="border bg-cs-surface p-3" style={{ borderColor: rarityColor }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center border bg-cs-panel"
            style={{ borderColor: rarityColor }}
          >
            <AssetImage alt="" className="h-9 w-9 object-contain" src={getResolvedSkinImage(outcome.skin)} />
          </span>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-cs-text">
              {outcome.skin.weapon} | {outcome.skin.finish}
            </h4>
            <p className="mt-1 truncate font-mono text-[10px] uppercase text-cs-muted" title={sourceNames}>
              {sourceNames}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-xs uppercase text-rarity-special">{outcome.probability}%</p>
          <p className="mt-1 text-sm font-semibold text-cs-green">{formatCurrency(outcome.value)}</p>
        </div>
      </div>
    </article>
  )
}
