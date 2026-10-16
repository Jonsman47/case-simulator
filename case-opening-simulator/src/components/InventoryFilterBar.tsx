import { RotateCcw, Search, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Rarity, WearCondition } from '../data/models'
import {
  defaultInventoryViewUiState,
  type InventoryFilters,
  type SortCriterion,
} from '../utils/inventoryFilters'

const sortOptions: { label: string; value: SortCriterion }[] = [
  { label: 'Value (High -> Low)', value: 'valueDesc' },
  { label: 'Value (Low -> High)', value: 'valueAsc' },
  { label: 'Rarity (Rare -> Common)', value: 'rarityDesc' },
  { label: 'Rarity (Common -> Rare)', value: 'rarityAsc' },
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Wear (Best -> Worst)', value: 'wearBest' },
  { label: 'Wear (Worst -> Best)', value: 'wearWorst' },
  { label: 'Name (A -> Z)', value: 'nameAsc' },
  { label: 'Name (Z -> A)', value: 'nameDesc' },
  { label: 'Pattern Premium', value: 'patternDesc' },
]

const rarityOptions = [
  Rarity.Consumer,
  Rarity.Industrial,
  Rarity.MilSpec,
  Rarity.Restricted,
  Rarity.Classified,
  Rarity.Covert,
  Rarity.SpecialItem,
  Rarity.Contraband,
]

const wearOptions = [
  WearCondition.FactoryNew,
  WearCondition.MinimalWear,
  WearCondition.FieldTested,
  WearCondition.WellWorn,
  WearCondition.BattleScarred,
]

function formatOptionLabel(value: string) {
  return value
    .replace('MilSpec', 'Mil-Spec')
    .replace('SpecialItem', 'Special Item')
    .replace('FactoryNew', 'Factory New')
    .replace('MinimalWear', 'Minimal Wear')
    .replace('FieldTested', 'Field-Tested')
    .replace('WellWorn', 'Well-Worn')
    .replace('BattleScarred', 'Battle-Scarred')
}

function hasActiveFilters(filters: InventoryFilters, sortCriterion: SortCriterion) {
  return (
    filters.search.trim().length > 0 ||
    filters.rarities.length > 0 ||
    filters.wearConditions.length > 0 ||
    filters.lockedOnly ||
    filters.favoritedOnly ||
    filters.duplicatesOnly ||
    filters.specialPatternsOnly ||
    sortCriterion !== defaultInventoryViewUiState.sortCriterion
  )
}

function MultiSelectDropdown<T extends string>({
  label,
  onChange,
  options,
  selected,
}: {
  label: string
  onChange: (values: T[]) => void
  options: T[]
  selected: T[]
}) {
  const selectedSet = useMemo(() => new Set(selected), [selected])

  return (
    <details className="relative border border-cs-border bg-cs-panel">
      <summary className="min-h-11 cursor-pointer px-3 py-2 text-sm font-medium text-cs-text">
        {label}
        <span className="ml-2 font-mono text-xs text-cs-muted">{selected.length}</span>
      </summary>
      <div className="fixed inset-x-3 top-24 z-30 max-h-[calc(100dvh-7rem)] overflow-y-auto border border-cs-border bg-cs-surface p-2 shadow-glow sm:absolute sm:left-0 sm:top-full sm:mt-1 sm:w-56">
        <div className="space-y-1">
          {options.map((option) => (
            <label
              className="flex min-h-11 items-center gap-2 px-2 py-1 text-sm text-cs-muted hover:bg-cs-panel hover:text-cs-text"
              key={option}
            >
              <input
                checked={selectedSet.has(option)}
                className="h-4 w-4 accent-rarity-special"
                onChange={() => {
                  const nextSelected = new Set(selected)

                  if (nextSelected.has(option)) {
                    nextSelected.delete(option)
                  } else {
                    nextSelected.add(option)
                  }

                  onChange(Array.from(nextSelected))
                }}
                type="checkbox"
              />
              {formatOptionLabel(option)}
            </label>
          ))}
        </div>
      </div>
    </details>
  )
}

function ToggleButton({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      aria-pressed={checked}
      className={[
        'inline-flex min-h-11 items-center gap-2 border px-3 py-2 text-sm transition-colors',
        checked
          ? 'border-rarity-special bg-rarity-special/10 text-rarity-special'
          : 'border-cs-border bg-cs-panel text-cs-muted hover:text-cs-text',
      ].join(' ')}
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span
        className={[
          'h-2.5 w-2.5 border',
          checked ? 'border-rarity-special bg-rarity-special' : 'border-cs-border bg-cs-surface',
        ].join(' ')}
      />
      {label}
    </button>
  )
}

export function InventoryFilterBar({
  filters,
  onFiltersChange,
  onReset,
  onSortCriterionChange,
  sortCriterion,
}: {
  filters: InventoryFilters
  onFiltersChange: (filters: Partial<InventoryFilters>) => void
  onReset: () => void
  onSortCriterionChange: (sortCriterion: SortCriterion) => void
  sortCriterion: SortCriterion
}) {
  const [searchDraft, setSearchDraft] = useState(filters.search)
  const searchDebounceRef = useRef<number | undefined>(undefined)
  const canReset = hasActiveFilters(filters, sortCriterion)

  useEffect(() => {
    return () => {
      if (typeof searchDebounceRef.current === 'number') {
        window.clearTimeout(searchDebounceRef.current)
      }
    }
  }, [])

  function handleSearchChange(value: string) {
    setSearchDraft(value)

    if (typeof searchDebounceRef.current === 'number') {
      window.clearTimeout(searchDebounceRef.current)
    }

    searchDebounceRef.current = window.setTimeout(() => {
      onFiltersChange({ search: value })
    }, 220)
  }

  function handleReset() {
    if (typeof searchDebounceRef.current === 'number') {
      window.clearTimeout(searchDebounceRef.current)
    }

    setSearchDraft(defaultInventoryViewUiState.filters.search)
    onReset()
  }

  return (
    <div className="mt-5 border border-cs-border bg-cs-bg p-3" data-swipe-ignore="true">
      <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_18rem_auto]">
        <label className="relative block">
          <span className="sr-only">Search inventory</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cs-muted"
            size={16}
          />
          <input
            autoCapitalize="none"
            autoComplete="off"
            className="min-h-11 w-full border border-cs-border bg-cs-panel py-2 pl-9 pr-3 text-base text-cs-text outline-none focus:border-rarity-special sm:text-sm"
            enterKeyHint="search"
            inputMode="search"
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search weapon or finish"
            type="search"
            value={searchDraft}
          />
        </label>

        <label className="flex min-h-11 items-center gap-2 border border-cs-border bg-cs-panel px-3 py-2 text-sm text-cs-muted">
          Sort
          <select
            className="min-h-9 min-w-0 flex-1 bg-cs-surface px-2 py-1 text-cs-text outline-none"
            onChange={(event) => onSortCriterionChange(event.target.value as SortCriterion)}
            value={sortCriterion}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 border border-cs-border px-3 py-2 text-sm font-medium text-cs-muted transition-colors hover:text-cs-text disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canReset}
          onClick={handleReset}
          type="button"
        >
          <RotateCcw size={16} />
          Reset Filters
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <MultiSelectDropdown
          label="Rarity"
          onChange={(rarities) => onFiltersChange({ rarities })}
          options={rarityOptions}
          selected={filters.rarities}
        />
        <MultiSelectDropdown
          label="Wear"
          onChange={(wearConditions) => onFiltersChange({ wearConditions })}
          options={wearOptions}
          selected={filters.wearConditions}
        />
        <ToggleButton
          checked={filters.lockedOnly}
          label="Locked"
          onChange={(lockedOnly) => onFiltersChange({ lockedOnly })}
        />
        <ToggleButton
          checked={filters.favoritedOnly}
          label="Favorited"
          onChange={(favoritedOnly) => onFiltersChange({ favoritedOnly })}
        />
        <ToggleButton
          checked={filters.duplicatesOnly}
          label="Duplicates"
          onChange={(duplicatesOnly) => onFiltersChange({ duplicatesOnly })}
        />
        <button
          aria-pressed={filters.specialPatternsOnly}
          className={[
            'inline-flex min-h-11 items-center gap-2 border px-3 py-2 text-sm transition-colors',
            filters.specialPatternsOnly
              ? 'border-rarity-special bg-rarity-special/10 text-rarity-special'
              : 'border-cs-border bg-cs-panel text-cs-muted hover:text-cs-text',
          ].join(' ')}
          onClick={() => onFiltersChange({ specialPatternsOnly: !filters.specialPatternsOnly })}
          title="Show only notable, rare, exceptional, or iconic paint patterns"
          type="button"
        >
          <Sparkles size={15} />
          Special Patterns
        </button>
      </div>

      {filters.duplicatesOnly ? (
        <p className="mt-3 text-xs text-cs-muted">
          Duplicate results are highlighted for bulk actions.
        </p>
      ) : null}
    </div>
  )
}
