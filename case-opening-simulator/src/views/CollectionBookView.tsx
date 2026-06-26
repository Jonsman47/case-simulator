import { Award, CheckCircle, ChevronLeft, ChevronRight, Info, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AssetImage } from '../components/AssetImage'
import { ItemDetailModal } from '../components/ItemDetailModal'
import { getSkinRarityColor } from '../data/rarities'
import { SKIN_DEFINITIONS } from '../data/skins'
import { Rarity, type SkinInstance } from '../data/models'
import { useGame } from '../hooks/useGame'
import {
  buildSkinCollectionRows,
  calculateCollectionCompletion,
  rarityCollectionOrder,
  wearConditionOrder,
  wearShortLabels,
  type SkinCollectionRow,
} from '../utils/collectionBook'
import {
  getCollectionRewardStatuses,
  type CollectionRewardStatus,
} from '../utils/collectionRewards'
import { formatCurrency } from '../utils/format'
import { getCurrentItemMarketValue } from '../utils/inventory'
import { getRarityLabel, getSkinRarityLabel } from '../utils/itemLabels'
import type { GameUiEvent } from '../data/gameState'

const CARDS_PER_PAGE = 8

const rarityStyles: Record<Rarity, { bar: string; border: string; text: string; tint: string }> = {
  [Rarity.Consumer]: {
    bar: 'bg-rarity-consumer',
    border: 'border-rarity-consumer',
    text: 'text-rarity-consumer',
    tint: 'bg-rarity-consumer/10',
  },
  [Rarity.Industrial]: {
    bar: 'bg-rarity-industrial',
    border: 'border-rarity-industrial',
    text: 'text-rarity-industrial',
    tint: 'bg-rarity-industrial/10',
  },
  [Rarity.MilSpec]: {
    bar: 'bg-rarity-mil-spec',
    border: 'border-rarity-mil-spec',
    text: 'text-rarity-mil-spec',
    tint: 'bg-rarity-mil-spec/10',
  },
  [Rarity.Restricted]: {
    bar: 'bg-rarity-restricted',
    border: 'border-rarity-restricted',
    text: 'text-rarity-restricted',
    tint: 'bg-rarity-restricted/10',
  },
  [Rarity.Classified]: {
    bar: 'bg-rarity-classified',
    border: 'border-rarity-classified',
    text: 'text-rarity-classified',
    tint: 'bg-rarity-classified/10',
  },
  [Rarity.Covert]: {
    bar: 'bg-rarity-covert',
    border: 'border-rarity-covert',
    text: 'text-rarity-covert',
    tint: 'bg-rarity-covert/10',
  },
  [Rarity.SpecialItem]: {
    bar: 'bg-rarity-special',
    border: 'border-rarity-special',
    text: 'text-rarity-special',
    tint: 'bg-rarity-special/10',
  },
  [Rarity.Contraband]: {
    bar: 'bg-rarity-contraband',
    border: 'border-rarity-contraband',
    text: 'text-rarity-contraband',
    tint: 'bg-rarity-contraband/10',
  },
}

const raritySortOrder = new Map(rarityCollectionOrder.map((rarity, index) => [rarity, index]))

function ToggleFilter({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="relative inline-flex items-center gap-2 border border-cs-border bg-cs-panel px-3 py-2 text-sm text-cs-muted">
      <input
        checked={checked}
        className="absolute left-3 top-1/2 h-5 w-9 -translate-y-1/2 cursor-pointer opacity-0"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span
        className={[
          'pointer-events-none h-5 w-9 border p-0.5 transition-colors',
          checked ? 'border-rarity-special bg-rarity-special/20' : 'border-cs-border bg-cs-surface',
        ].join(' ')}
      >
        <span
          className={[
            'pointer-events-none block h-3.5 w-3.5 transition-transform',
            checked ? 'translate-x-4 bg-rarity-special' : 'bg-cs-muted',
          ].join(' ')}
        />
      </span>
      {label}
    </label>
  )
}

type CollectionRewardEvent = Extract<GameUiEvent, { type: 'collection_reward_unlocked' }>

function RewardBadge({ label, title }: { label: string; title: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 border border-cs-border bg-cs-panel px-3 py-2 text-xs text-cs-muted"
      title={title}
    >
      <Info size={14} />
      {label}
    </span>
  )
}

function CollectionRewardModal({
  event,
  onClose,
}: {
  event: CollectionRewardEvent
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md animate-pulse border border-rarity-special bg-cs-panel p-5 shadow-glow">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center border border-rarity-special bg-rarity-special/10 text-rarity-special">
              <Award size={24} />
            </div>
            <div>
              <p className="font-mono text-xs uppercase text-rarity-special">Collection Reward</p>
              <h3 className="mt-1 text-xl font-semibold text-cs-text">{event.title}</h3>
            </div>
          </div>
          <button
            aria-label="Close collection reward"
            className="grid h-9 w-9 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-4 border border-rarity-special bg-rarity-special/10 p-4">
          <p className="text-sm font-semibold text-rarity-special">{event.effectLabel}</p>
          <p className="mt-2 text-sm text-cs-muted">
            This bonus is now saved in your collection rewards.
          </p>
        </div>
      </div>
    </div>
  )
}

function CollectionRewardRow({ status }: { status: CollectionRewardStatus }) {
  const { definition } = status

  return (
    <article className="border border-cs-border bg-cs-surface p-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase text-cs-muted">{definition.type}</p>
          <h4 className="mt-1 truncate text-sm font-semibold text-cs-text">{definition.title}</h4>
        </div>
        <span
          className={[
            'inline-flex shrink-0 items-center gap-1 border px-2 py-1 font-mono text-[10px] uppercase',
            status.isUnlocked
              ? 'border-cs-green bg-cs-green/10 text-cs-green'
              : 'border-cs-border text-cs-muted',
          ].join(' ')}
        >
          {status.isUnlocked ? <CheckCircle size={12} /> : null}
          {status.isUnlocked ? 'Unlocked' : 'Locked'}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 min-h-8 text-xs text-cs-muted">{definition.description}</p>
      <div className="mt-3 h-2 border border-cs-border bg-cs-panel">
        <div
          className={status.isUnlocked ? 'h-full bg-cs-green' : 'h-full bg-rarity-special'}
          style={{ width: `${Math.min(100, status.percentage)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-mono text-cs-muted">
          {status.discovered}/{status.total}
        </span>
        <span className="font-semibold text-rarity-special">{definition.effectLabel}</span>
      </div>
    </article>
  )
}

function CollectionRewardsPanel({ statuses }: { statuses: CollectionRewardStatus[] }) {
  const unlockedCount = statuses.filter((status) => status.isUnlocked).length
  const weaponStatuses = statuses.filter((status) => status.definition.type === 'WeaponSellBonus')
  const caseStatuses = statuses.filter((status) => status.definition.type === 'CaseDiscount')
  const rarityStatuses = statuses.filter((status) => status.definition.type === 'RarityLuck')
  const fullGameStatuses = statuses.filter((status) => status.definition.type === 'FullGamePrestigeBonus')

  return (
    <section className="mt-4 border border-cs-border bg-cs-panel p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Award className="text-rarity-special" size={18} />
            <h3 className="text-lg font-semibold text-cs-text">Collection Rewards</h3>
          </div>
          <p className="mt-1 text-sm text-cs-muted">
            {unlockedCount}/{statuses.length} bonuses unlocked
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <RewardBadge label="+1% Sell Value" title="Complete every finish for a weapon type." />
          <RewardBadge label="+5% Case Discount" title="Complete every skin from a case." />
          <RewardBadge label="+2% Luck" title="Complete an entire rarity tier." />
          <RewardBadge label="Prestige Bonus" title="Complete every skin in every wear." />
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <RewardSection title="Weapon Sets" statuses={weaponStatuses} />
        <RewardSection title="Case Collections" statuses={caseStatuses} />
        <RewardSection title="Rarity Tiers" statuses={rarityStatuses} />
        <RewardSection title="Full Completion" statuses={fullGameStatuses} />
      </div>
    </section>
  )
}

function RewardSection({
  statuses,
  title,
}: {
  statuses: CollectionRewardStatus[]
  title: string
}) {
  return (
    <section>
      <h4 className="font-mono text-xs uppercase text-cs-muted">{title}</h4>
      <div className="mt-2 grid max-h-80 gap-2 overflow-auto pr-1">
        {statuses.map((status) => (
          <CollectionRewardRow key={status.definition.id} status={status} />
        ))}
      </div>
    </section>
  )
}

function CollectionCard({
  isNewlyDiscovered,
  onOpenItem,
  previewItem,
  row,
}: {
  isNewlyDiscovered: boolean
  onOpenItem: (item: SkinInstance) => void
  previewItem: SkinInstance | undefined
  row: SkinCollectionRow
}) {
  const styles = rarityStyles[row.skin.rarity]
  const rarityColor = getSkinRarityColor(row.skin)
  const foundWearConditions = new Set(row.entry?.foundWearConditions ?? [])
  const canOpenDetails = Boolean(previewItem)

  function openDetails() {
    if (previewItem) {
      onOpenItem(previewItem)
    }
  }

  return (
    <article
      className={[
        'relative flex h-full flex-col border bg-cs-panel p-2 transition-colors',
        styles.border,
        row.isDiscovered ? 'hover:bg-cs-panelMuted' : 'opacity-75',
        canOpenDetails ? 'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-rarity-special' : '',
        isNewlyDiscovered ? 'animate-pulse ring-2 ring-rarity-special' : '',
      ].join(' ')}
      onClick={openDetails}
      data-testid="collection-card"
      onKeyDown={(event) => {
        if (!canOpenDetails) {
          return
        }

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openDetails()
        }
      }}
      tabIndex={canOpenDetails ? 0 : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`font-mono text-xs uppercase ${styles.text}`} style={{ color: rarityColor }}>
          {getSkinRarityLabel(row.skin)}
        </p>
        <span
          className={[
            'border px-2 py-1 font-mono text-[10px] uppercase',
            row.isDiscovered ? 'border-cs-green text-cs-green' : 'border-cs-border text-cs-muted',
          ].join(' ')}
        >
          {row.isDiscovered ? 'Discovered' : 'Unknown'}
        </span>
      </div>

      <div
        className={`mt-2 grid h-24 place-items-center border ${styles.border} ${styles.tint}`}
        style={{
          backgroundColor: `${rarityColor}1a`,
          borderColor: rarityColor,
        }}
      >
        <AssetImage
          alt=""
          className={['h-16 w-16 object-contain', row.isDiscovered ? 'opacity-90' : 'grayscale'].join(' ')}
          draggable={false}
          src={row.skin.image}
        />
        {!row.isDiscovered ? (
          <div className="absolute inset-x-2 top-10 grid h-24 place-items-center bg-black/35">
            <span className="border border-cs-border bg-cs-bg px-3 py-1 font-mono text-xs uppercase text-cs-muted">
              Undiscovered
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-2 min-w-0">
        <h3 className="truncate text-sm font-semibold text-cs-text">
          {row.skin.weapon} | {row.skin.finish}
        </h3>
        <p className="mt-1 text-xs text-cs-muted">
          Found {row.entry?.timesFound ?? 0} time{row.entry?.timesFound === 1 ? '' : 's'}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {wearConditionOrder.map((wear) => {
          const isFound = foundWearConditions.has(wear)

          return (
            <span
              className={[
                'grid h-6 min-w-6 place-items-center border px-1 font-mono text-[10px]',
                isFound
                  ? 'border-cs-green bg-cs-green/10 text-cs-green'
                  : 'border-cs-border bg-cs-surface text-cs-muted',
              ].join(' ')}
              key={wear}
              title={wearShortLabels[wear]}
            >
              {wearShortLabels[wear]}
            </span>
          )
        })}
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <RecordStat
          isHeld={row.holdsBestFloat}
          label="Best Float"
          value={typeof row.entry?.bestFloat === 'number' ? row.entry.bestFloat.toFixed(6) : '--'}
        />
        <RecordStat
          isHeld={row.holdsHighestValue}
          label="Highest Value"
          value={typeof row.entry?.highestValue === 'number' ? formatCurrency(row.entry.highestValue) : '--'}
        />
      </dl>

      {row.isCompletedWearSet ? (
        <p className="mt-2 border border-rarity-special bg-rarity-special/10 px-2 py-1.5 font-mono text-[10px] uppercase text-rarity-special">
          Wear Set Complete
        </p>
      ) : null}
    </article>
  )
}

function RecordStat({ isHeld, label, value }: { isHeld: boolean; label: string; value: string }) {
  return (
    <div
      className={[
        'border bg-cs-surface px-2 py-1.5',
        isHeld ? 'border-rarity-special text-rarity-special' : 'border-cs-border text-cs-text',
      ].join(' ')}
    >
      <dt className="font-mono text-[10px] uppercase text-cs-muted">{label}</dt>
      <dd className="mt-1 truncate font-mono">{value}</dd>
      {isHeld ? <p className="mt-1 font-mono text-[10px] uppercase">Held Best</p> : null}
    </div>
  )
}

type CollectionSortCriterion = 'catalog' | 'valueDesc' | 'recentDesc' | 'nameAsc'

const collectionSortOptions: { label: string; value: CollectionSortCriterion }[] = [
  { label: 'Catalog Order', value: 'catalog' },
  { label: 'Most Expensive', value: 'valueDesc' },
  { label: 'Recently Acquired', value: 'recentDesc' },
  { label: 'Name A to Z', value: 'nameAsc' },
]

function getCatalogSortValue(row: SkinCollectionRow) {
  return raritySortOrder.get(row.skin.rarity) ?? 0
}

function getCollectionRowDisplayName(row: SkinCollectionRow) {
  return `${row.skin.weapon} ${row.skin.finish}`
}

function getCollectionRowValue(row: SkinCollectionRow) {
  return row.entry?.highestValue ?? row.skin.baseValue
}

function getCollectionRowRecentTimestamp(
  row: SkinCollectionRow,
  latestAcquiredBySkinId: Map<string, number>,
) {
  return latestAcquiredBySkinId.get(row.skin.id) ?? row.entry?.firstFoundAt ?? 0
}

function compareByCatalog(left: SkinCollectionRow, right: SkinCollectionRow) {
  const rarityDifference = getCatalogSortValue(left) - getCatalogSortValue(right)

  if (rarityDifference !== 0) {
    return rarityDifference
  }

  return getCollectionRowDisplayName(left).localeCompare(
    getCollectionRowDisplayName(right),
    undefined,
    { sensitivity: 'base' },
  )
}

function sortSkinRows(
  rows: SkinCollectionRow[],
  criterion: CollectionSortCriterion,
  latestAcquiredBySkinId: Map<string, number>,
) {
  return [...rows].sort((left, right) => {
    if (criterion === 'valueDesc') {
      const valueDifference = getCollectionRowValue(right) - getCollectionRowValue(left)

      return valueDifference || compareByCatalog(left, right)
    }

    if (criterion === 'recentDesc') {
      const recentDifference =
        getCollectionRowRecentTimestamp(right, latestAcquiredBySkinId) -
        getCollectionRowRecentTimestamp(left, latestAcquiredBySkinId)

      return recentDifference || compareByCatalog(left, right)
    }

    if (criterion === 'nameAsc') {
      return getCollectionRowDisplayName(left).localeCompare(
        getCollectionRowDisplayName(right),
        undefined,
        { sensitivity: 'base' },
      )
    }

    return compareByCatalog(left, right)
  })
}

function clampPage(page: number, pageCount: number) {
  if (!Number.isFinite(page)) {
    return 1
  }

  return Math.min(pageCount, Math.max(1, Math.floor(page)))
}

export function CollectionBookView() {
  const { assignTrophyItem, sellItem, state, toggleItemFavorite, toggleItemLock } = useGame()
  const [hideUndiscovered, setHideUndiscovered] = useState(true)
  const [completedOnly, setCompletedOnly] = useState(false)
  const [sortCriterion, setSortCriterion] = useState<CollectionSortCriterion>('catalog')
  const [page, setPage] = useState(1)
  const [activeItemId, setActiveItemId] = useState<string | undefined>(undefined)
  const [dismissedRewardEventId, setDismissedRewardEventId] = useState<string | undefined>()
  const latestAcquiredBySkinId = useMemo(() => {
    const timestampsBySkinId = new Map<string, number>()

    for (const entry of state.collectionBook) {
      timestampsBySkinId.set(entry.skinId, entry.firstFoundAt)
    }

    for (const item of state.inventory) {
      const currentTimestamp = timestampsBySkinId.get(item.id) ?? 0

      timestampsBySkinId.set(item.id, Math.max(currentTimestamp, item.discoveredAt))
    }

    return timestampsBySkinId
  }, [state.collectionBook, state.inventory])
  const rows = useMemo(() => {
    return sortSkinRows(
      buildSkinCollectionRows(SKIN_DEFINITIONS, state.collectionBook, state.inventory),
      sortCriterion,
      latestAcquiredBySkinId,
    )
  }, [latestAcquiredBySkinId, sortCriterion, state.collectionBook, state.inventory])
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (hideUndiscovered && !row.isDiscovered) {
        return false
      }

      if (completedOnly && !row.isCompletedWearSet) {
        return false
      }

      return true
    })
  }, [completedOnly, hideUndiscovered, rows])
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / CARDS_PER_PAGE))
  const currentPage = clampPage(page, pageCount)
  const pageRows = useMemo(() => {
    const startIndex = (currentPage - 1) * CARDS_PER_PAGE

    return filteredRows.slice(startIndex, startIndex + CARDS_PER_PAGE)
  }, [currentPage, filteredRows])
  const firstVisibleItem = filteredRows.length === 0 ? 0 : (currentPage - 1) * CARDS_PER_PAGE + 1
  const lastVisibleItem = Math.min(filteredRows.length, currentPage * CARDS_PER_PAGE)

  const progress = useMemo(
    () => calculateCollectionCompletion(SKIN_DEFINITIONS, state.collectionBook),
    [state.collectionBook],
  )
  const rewardStatuses = useMemo(
    () => getCollectionRewardStatuses({
      collectionBook: state.collectionBook,
      collectionRewards: state.collectionRewards,
    }),
    [state.collectionBook, state.collectionRewards],
  )
  const latestRewardEvent = state.uiEvents.find(
    (event): event is CollectionRewardEvent => event.type === 'collection_reward_unlocked',
  )
  const activeRewardEvent =
    latestRewardEvent && latestRewardEvent.id !== dismissedRewardEventId ? latestRewardEvent : undefined
  const newlyDiscoveredSkinIds = useMemo(() => {
    return new Set(
      state.uiEvents
        .filter((event) => event.type === 'drop_revealed')
        .map((event) => event.item.id)
        .filter((skinId) => {
          const entry = state.collectionBook.find((collectionEntry) => collectionEntry.skinId === skinId)

          return entry?.timesFound === 1
        }),
    )
  }, [state.collectionBook, state.uiEvents])
  const previewItemsBySkinId = useMemo(() => {
    const itemsBySkinId = new Map<string, SkinInstance>()

    for (const item of state.inventory) {
      const currentPreviewItem = itemsBySkinId.get(item.id)

      if (
        !currentPreviewItem ||
        item.marketValue > currentPreviewItem.marketValue ||
        (item.marketValue === currentPreviewItem.marketValue && item.floatValue < currentPreviewItem.floatValue)
      ) {
        itemsBySkinId.set(item.id, item)
      }
    }

    return itemsBySkinId
  }, [state.inventory])
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

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="border-l-4 border-rarity-classified pl-4">
          <h2 className="text-2xl font-semibold text-cs-text sm:text-3xl">Collection Book</h2>
          <p className="mt-2 text-sm text-cs-muted">
            {progress.discovered} of {progress.total} skins discovered
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[14rem_1fr]">
        <div className="border border-cs-border bg-cs-panel p-3">
          <p className="font-mono text-xs uppercase text-cs-muted">Overall Completion</p>
          <p className="mt-1 text-3xl font-semibold text-cs-text">{progress.percentage}%</p>
          <div className="mt-4 h-3 border border-cs-border bg-cs-surface">
            <div className="h-full bg-rarity-classified" style={{ width: `${progress.percentage}%` }} />
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {rarityCollectionOrder.map((rarity) => {
            const bucket = progress.byRarity[rarity]
            const styles = rarityStyles[rarity]

            return (
              <div className="border border-cs-border bg-cs-panel p-2" key={rarity}>
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-sm font-semibold ${styles.text}`}>{getRarityLabel(rarity)}</p>
                  <p className="font-mono text-xs text-cs-muted">
                    {bucket.discovered}/{bucket.total}
                  </p>
                </div>
                <div className="mt-2 h-2 border border-cs-border bg-cs-surface">
                  <div className={`h-full ${styles.bar}`} style={{ width: `${bucket.percentage}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <CollectionRewardsPanel statuses={rewardStatuses} />

      <div className="mt-4 flex flex-col gap-3 border border-cs-border bg-cs-panel p-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          <ToggleFilter
            checked={hideUndiscovered}
            label="Hide Undiscovered"
            onChange={(checked) => {
              setHideUndiscovered(checked)
              setPage(1)
            }}
          />
          <ToggleFilter
            checked={completedOnly}
            label="Completed Sets"
            onChange={(checked) => {
              setCompletedOnly(checked)
              setPage(1)
            }}
          />
        </div>
        <label className="flex min-w-56 items-center gap-2 text-sm text-cs-muted">
          Sort
          <select
            className="min-h-11 flex-1 border border-cs-border bg-cs-surface px-3 py-2 text-cs-text outline-none focus:border-rarity-special"
            onChange={(event) => {
              setSortCriterion(event.target.value as CollectionSortCriterion)
              setPage(1)
            }}
            value={sortCriterion}
          >
            {collectionSortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 border border-cs-border bg-cs-bg p-2">
        <div className="mb-2 flex flex-col gap-2 border border-cs-border bg-cs-panel p-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-xs uppercase text-cs-muted">
            Showing {firstVisibleItem}-{lastVisibleItem} of {filteredRows.length}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              aria-label="Previous collection page"
              className="inline-flex min-h-10 items-center gap-2 border border-cs-border px-3 py-2 text-sm text-cs-muted transition-colors hover:text-cs-text disabled:cursor-not-allowed disabled:opacity-40"
              disabled={currentPage <= 1}
              onClick={() => setPage(clampPage(currentPage - 1, pageCount))}
              type="button"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <label className="flex items-center gap-2 font-mono text-xs uppercase text-cs-muted">
              Page
              <input
                aria-label="Collection page"
                className="h-10 w-20 border border-cs-border bg-cs-surface px-2 text-center text-cs-text outline-none focus:border-rarity-special"
                max={pageCount}
                min={1}
                onChange={(event) => setPage(clampPage(Number(event.target.value), pageCount))}
                type="number"
                value={currentPage}
              />
              of {pageCount}
            </label>
            <button
              aria-label="Next collection page"
              className="inline-flex min-h-10 items-center gap-2 border border-cs-border px-3 py-2 text-sm text-cs-muted transition-colors hover:text-cs-text disabled:cursor-not-allowed disabled:opacity-40"
              disabled={currentPage >= pageCount}
              onClick={() => setPage(clampPage(currentPage + 1, pageCount))}
              type="button"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {pageRows.length > 0 ? (
          <div className="grid min-h-[32rem] gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {pageRows.map((row) => (
              <CollectionCard
                isNewlyDiscovered={newlyDiscoveredSkinIds.has(row.skin.id)}
                key={row.skin.id}
                onOpenItem={(item) => setActiveItemId(item.instanceId)}
                previewItem={previewItemsBySkinId.get(row.skin.id)}
                row={row}
              />
            ))}
          </div>
        ) : (
          <div className="grid min-h-80 place-items-center border border-cs-border bg-cs-panel p-8 text-center text-cs-muted">
            <div>
              <p className="text-lg font-semibold text-cs-text">No collection entries match</p>
              <p className="mt-2 text-sm">Adjust collection filters or jump back to page 1.</p>
              {currentPage > 1 ? (
                <button
                  className="mt-4 border border-rarity-special px-4 py-2 text-sm font-semibold text-rarity-special"
                  onClick={() => setPage(1)}
                  type="button"
                >
                  First Page
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <ItemDetailModal
        item={activeItem}
        items={state.inventory}
        onClose={() => setActiveItemId(undefined)}
        onItemChange={(item) => setActiveItemId(item.instanceId)}
        onAddToTrophyRoom={(itemId, slotId) => assignTrophyItem(slotId, itemId)}
        onSell={sellItem}
        onToggleFavorite={toggleItemFavorite}
        onToggleLock={toggleItemLock}
        marketHistory={state.marketHistory}
        saleValue={activeItemSaleValue}
      />

      {activeRewardEvent ? (
        <CollectionRewardModal
          event={activeRewardEvent}
          onClose={() => setDismissedRewardEventId(activeRewardEvent.id)}
        />
      ) : null}
    </section>
  )
}
