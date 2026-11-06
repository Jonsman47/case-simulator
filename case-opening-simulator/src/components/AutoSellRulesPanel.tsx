import { nanoid } from 'nanoid'
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { type Dispatch, type DragEvent, type SetStateAction, useMemo, useState } from 'react'
import {
  AutoSellRuleType,
  Rarity,
  WearCondition,
  type AutoSellRule,
  type SkinInstance,
} from '../data/models'
import { simulateAutoSell } from '../utils/autoSell'
import { formatCurrency } from '../utils/format'
import { getRarityLabel, getWearLabel } from '../utils/itemLabels'
import { Tooltip } from './Tooltip'

interface RuleDraft {
  enabled: boolean
  includeSouvenir: boolean
  includeStatTrak: boolean
  keepCount: string
  protectRarePatterns: boolean
  protectSpecialItems: boolean
  rarityThreshold: Rarity
  type: AutoSellRuleType
  valueThreshold: string
  valueThresholdsByRarity: Record<Rarity, string>
  wearThreshold: WearCondition
}

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

const defaultRarityThresholds: Record<Rarity, string> = {
  [Rarity.Consumer]: '0.25',
  [Rarity.Industrial]: '0.45',
  [Rarity.MilSpec]: '0.75',
  [Rarity.Restricted]: '1.25',
  [Rarity.Classified]: '2.50',
  [Rarity.Covert]: '5.00',
  [Rarity.SpecialItem]: '20.00',
  [Rarity.Contraband]: '100.00',
}

const defaultDraft: RuleDraft = {
  enabled: true,
  includeSouvenir: false,
  includeStatTrak: false,
  keepCount: '1',
  protectRarePatterns: true,
  protectSpecialItems: true,
  rarityThreshold: Rarity.MilSpec,
  type: AutoSellRuleType.MinValue,
  valueThreshold: '0.75',
  valueThresholdsByRarity: defaultRarityThresholds,
  wearThreshold: WearCondition.FieldTested,
}

const ruleTypeOptions = [
  AutoSellRuleType.MinValue,
  AutoSellRuleType.MaxRarity,
  AutoSellRuleType.SellDuplicates,
  AutoSellRuleType.MaxWear,
  AutoSellRuleType.SellBelowValuePerRarity,
  AutoSellRuleType.SellWearBelow,
  AutoSellRuleType.SellNonFavoritedBelow,
  AutoSellRuleType.SellDuplicatesKeepOne,
  AutoSellRuleType.SellNonKnifeUnderValue,
  AutoSellRuleType.KeepFactoryNew,
]

const ruleTypeLabels: Record<AutoSellRuleType, string> = {
  [AutoSellRuleType.MinValue]: 'Min Value',
  [AutoSellRuleType.MaxRarity]: 'Max Rarity',
  [AutoSellRuleType.SellDuplicates]: 'Sell Duplicates',
  [AutoSellRuleType.MaxWear]: 'Max Wear',
  [AutoSellRuleType.SellBelowValuePerRarity]: 'Sell Below Value Per Rarity',
  [AutoSellRuleType.SellWearBelow]: 'Sell Wear Below',
  [AutoSellRuleType.SellNonFavoritedBelow]: 'Sell Non-Favorited Below',
  [AutoSellRuleType.SellDuplicatesKeepOne]: 'Sell Duplicates — Keep Best',
  [AutoSellRuleType.SellNonKnifeUnderValue]: 'Sell Non-Knife Under Value',
  [AutoSellRuleType.KeepFactoryNew]: 'Keep Factory New',
  [AutoSellRuleType.ExcludedIds]: 'Excluded IDs',
}

function parseMoney(value: string) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0
}

function parseRarityThresholds(draft: RuleDraft) {
  return rarityOptions.reduce<Partial<Record<Rarity, number>>>((thresholds, rarity) => {
    return {
      ...thresholds,
      [rarity]: parseMoney(draft.valueThresholdsByRarity[rarity]),
    }
  }, {})
}

function createRuleFromDraft(draft: RuleDraft, id = nanoid()): AutoSellRule {
  const numericThreshold = parseMoney(draft.valueThreshold)

  return {
    id,
    type: draft.type,
    enabled: draft.enabled,
    valueThreshold:
      draft.type === AutoSellRuleType.MinValue ||
      draft.type === AutoSellRuleType.SellNonFavoritedBelow ||
      draft.type === AutoSellRuleType.SellNonKnifeUnderValue
        ? numericThreshold
        : undefined,
    valueThresholdsByRarity:
      draft.type === AutoSellRuleType.SellBelowValuePerRarity
        ? parseRarityThresholds(draft)
        : undefined,
    rarityThreshold: draft.type === AutoSellRuleType.MaxRarity ? draft.rarityThreshold : undefined,
    wearThreshold:
      draft.type === AutoSellRuleType.MaxWear || draft.type === AutoSellRuleType.SellWearBelow
        ? draft.wearThreshold
        : undefined,
    sellDuplicates:
      draft.type === AutoSellRuleType.SellDuplicates ||
      draft.type === AutoSellRuleType.SellDuplicatesKeepOne
        ? true
        : undefined,
    keepCount: draft.type === AutoSellRuleType.SellDuplicatesKeepOne
      ? Math.max(1, Math.floor(parseMoney(draft.keepCount)))
      : undefined,
    includeSouvenir: draft.type === AutoSellRuleType.SellDuplicatesKeepOne ? draft.includeSouvenir : undefined,
    includeStatTrak: draft.type === AutoSellRuleType.SellDuplicatesKeepOne ? draft.includeStatTrak : undefined,
    protectRarePatterns: draft.type === AutoSellRuleType.SellDuplicatesKeepOne ? draft.protectRarePatterns : undefined,
    protectSpecialItems: draft.type === AutoSellRuleType.SellDuplicatesKeepOne ? draft.protectSpecialItems : undefined,
  }
}

function createDraftFromRule(rule: AutoSellRule): RuleDraft {
  const editableType = ruleTypeOptions.includes(rule.type)
    ? rule.type
    : AutoSellRuleType.MinValue
  const valueThresholdsByRarity = rarityOptions.reduce(
    (thresholds, rarity) => ({
      ...thresholds,
      [rarity]: String(rule.valueThresholdsByRarity?.[rarity] ?? defaultRarityThresholds[rarity]),
    }),
    {} as Record<Rarity, string>,
  )

  return {
    enabled: rule.enabled,
    includeSouvenir: rule.includeSouvenir ?? false,
    includeStatTrak: rule.includeStatTrak ?? false,
    keepCount: String(rule.keepCount ?? 1),
    protectRarePatterns: rule.protectRarePatterns ?? true,
    protectSpecialItems: rule.protectSpecialItems ?? true,
    rarityThreshold: rule.rarityThreshold ?? defaultDraft.rarityThreshold,
    type: editableType,
    valueThreshold: String(rule.valueThreshold ?? defaultDraft.valueThreshold),
    valueThresholdsByRarity,
    wearThreshold: rule.wearThreshold ?? defaultDraft.wearThreshold,
  }
}

function getRuleThresholdLabel(rule: AutoSellRule) {
  switch (rule.type) {
    case AutoSellRuleType.MinValue:
      return `Below ${formatCurrency(rule.valueThreshold ?? 0)}`
    case AutoSellRuleType.MaxRarity:
      return `${getRarityLabel(rule.rarityThreshold ?? Rarity.Consumer)} and lower`
    case AutoSellRuleType.SellDuplicates:
      return 'Extra duplicate copies'
    case AutoSellRuleType.MaxWear:
    case AutoSellRuleType.SellWearBelow:
      return `Worse than ${getWearLabel(rule.wearThreshold ?? WearCondition.FieldTested)}`
    case AutoSellRuleType.SellBelowValuePerRarity:
      return 'Custom value threshold per rarity'
    case AutoSellRuleType.SellNonFavoritedBelow:
      return `Non-favorited below ${formatCurrency(rule.valueThreshold ?? 0)}`
    case AutoSellRuleType.SellDuplicatesKeepOne:
      return `Keep the ${Math.max(1, rule.keepCount ?? 1)} highest-value eligible ${Math.max(1, rule.keepCount ?? 1) === 1 ? 'copy' : 'copies'}; protected items are never sold`
    case AutoSellRuleType.SellNonKnifeUnderValue:
      return `Non-knife below ${formatCurrency(rule.valueThreshold ?? 0)}`
    case AutoSellRuleType.KeepFactoryNew:
      return 'Never auto-sell Factory New'
    default:
      return 'Custom'
  }
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items]
  const [item] = nextItems.splice(fromIndex, 1)

  if (!item) {
    return items
  }

  nextItems.splice(toIndex, 0, item)

  return nextItems
}

export function AutoSellRulesPanel({
  inventory,
  onAddRule,
  onRemoveRule,
  onReorderRules,
  onUpdateRule,
  rules,
}: {
  inventory: SkinInstance[]
  onAddRule: (rule: AutoSellRule) => void
  onRemoveRule: (ruleId: string) => void
  onReorderRules: (ruleIds: string[]) => void
  onUpdateRule: (ruleId: string, rule: Partial<AutoSellRule>) => void
  rules: AutoSellRule[]
}) {
  const [draft, setDraft] = useState<RuleDraft>(defaultDraft)
  const [editingRuleId, setEditingRuleId] = useState<string | undefined>()
  const [draggedRuleId, setDraggedRuleId] = useState<string | undefined>()
  const isEditing = Boolean(editingRuleId)
  const activeRulesCount = useMemo(() => rules.filter((rule) => rule.enabled).length, [rules])
  const simulation = useMemo(() => simulateAutoSell(inventory, rules), [inventory, rules])
  const duplicatePreview = useMemo(() => {
    const rule = rules.find((candidate) => candidate.enabled && candidate.type === AutoSellRuleType.SellDuplicatesKeepOne)
    if (!rule) return undefined
    const sellIds = new Set(simulation.items.map((item) => item.instanceId))
    const grouped = new Map<string, SkinInstance[]>()
    for (const item of inventory) grouped.set(item.id, [...(grouped.get(item.id) ?? []), item])
    const group = [...grouped.values()]
      .filter((copies) => copies.length > Math.max(1, rule.keepCount ?? 1))
      .sort((left, right) => right.length - left.length)[0]
    if (!group) return undefined
    const ordered = [...group].sort((left, right) => right.marketValue - left.marketValue || left.instanceId.localeCompare(right.instanceId))
    return { keep: ordered.filter((item) => !sellIds.has(item.instanceId)), sell: ordered.filter((item) => sellIds.has(item.instanceId)) }
  }, [inventory, rules, simulation.items])

  function resetDraft() {
    setDraft(defaultDraft)
    setEditingRuleId(undefined)
  }

  function submitRule() {
    if (editingRuleId) {
      onUpdateRule(editingRuleId, createRuleFromDraft(draft, editingRuleId))
    } else {
      onAddRule(createRuleFromDraft(draft))
    }

    resetDraft()
  }

  function reorderRules(fromRuleId: string, toRuleId: string) {
    const fromIndex = rules.findIndex((rule) => rule.id === fromRuleId)
    const toIndex = rules.findIndex((rule) => rule.id === toRuleId)

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return
    }

    onReorderRules(moveItem(rules, fromIndex, toIndex).map((rule) => rule.id))
  }

  function moveRuleByOffset(ruleId: string, offset: number) {
    const fromIndex = rules.findIndex((rule) => rule.id === ruleId)
    const toIndex = Math.min(Math.max(fromIndex + offset, 0), rules.length - 1)

    if (fromIndex < 0 || fromIndex === toIndex) {
      return
    }

    onReorderRules(moveItem(rules, fromIndex, toIndex).map((rule) => rule.id))
  }

  function handleRuleDrop(event: DragEvent<HTMLElement>, ruleId: string) {
    event.preventDefault()

    if (draggedRuleId) {
      reorderRules(draggedRuleId, ruleId)
      setDraggedRuleId(undefined)
    }
  }

  return (
    <div className="mt-8 min-w-0 border border-cs-border bg-cs-panel p-5" data-onboarding-target="auto-sell-rules">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-cs-text">Auto-Sell Rules</h3>
            <Tooltip label="Explain auto-sell rules">
              Enabled rules run in order after drops. Keep/protection rules can prevent later sell rules from moving locked,
              favorited, or Factory New items.
            </Tooltip>
          </div>
          <p className="mt-1 font-mono text-xs uppercase text-cs-muted">
            {activeRulesCount} active / {rules.length} total
          </p>
        </div>
        <div className="border border-cs-border bg-cs-surface px-4 py-3">
          <p className="font-mono text-xs uppercase text-cs-muted">Simulation</p>
          <p className="mt-1 text-sm text-cs-text">
            {simulation.items.length} item{simulation.items.length === 1 ? '' : 's'} /{' '}
            <span className="font-semibold text-cs-green">{formatCurrency(simulation.totalValue)}</span>
          </p>
        </div>
      </div>

      {simulation.items.length > 0 ? (
        <div className="mt-4 border border-cs-border bg-cs-surface p-3 text-sm text-cs-muted">
          Current enabled rules would sell:{' '}
          {simulation.items.slice(0, 5).map((item) => `${item.weapon} | ${item.finish}`).join(', ')}
          {simulation.items.length > 5 ? ` and ${simulation.items.length - 5} more` : ''}
        </div>
      ) : null}

      {duplicatePreview ? (
        <div className="mt-3 grid gap-3 border border-cs-border bg-cs-surface p-3 sm:grid-cols-2">
          <PreviewColumn items={duplicatePreview.keep} label="Keep" tone="text-cs-green" />
          <PreviewColumn items={duplicatePreview.sell} label="Auto-sell" tone="text-rarity-covert" />
        </div>
      ) : null}

      <div className="mt-5 grid min-w-0 gap-3 lg:grid-cols-[16rem_1fr_12rem_auto]">
        <label className="min-w-0 text-sm text-cs-muted">
          Rule Type
          <select
            className="mt-2 min-w-0 max-w-full w-full border border-cs-border bg-cs-surface px-3 py-2 text-cs-text outline-none focus:border-rarity-special"
            onChange={(event) =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                type: event.target.value as AutoSellRuleType,
              }))
            }
            value={draft.type}
          >
            {ruleTypeOptions.map((ruleType) => (
              <option key={ruleType} value={ruleType}>
                {ruleTypeLabels[ruleType]}
              </option>
            ))}
          </select>
        </label>

        <ThresholdField draft={draft} setDraft={setDraft} />

        <label className="relative flex items-end gap-2 text-sm text-cs-muted">
          <input
            checked={draft.enabled}
            className="mb-2 h-4 w-4 accent-rarity-special"
            onChange={(event) =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                enabled: event.target.checked,
              }))
            }
            type="checkbox"
          />
          <span className="mb-1">Enabled</span>
        </label>

        <div className="flex items-end gap-2">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 border border-rarity-special bg-rarity-special/10 px-3 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20"
            onClick={submitRule}
            type="button"
          >
            {isEditing ? <Save size={16} /> : <Plus size={16} />}
            {isEditing ? 'Save Rule' : 'Add Rule'}
          </button>
          {isEditing ? (
            <button
              aria-label="Cancel edit"
              className="grid h-10 w-10 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text"
              onClick={resetDraft}
              title="Cancel edit"
              type="button"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      </div>

      {draft.type === AutoSellRuleType.SellDuplicatesKeepOne ? (
        <div className="mt-3 border-l-2 border-cs-green bg-cs-green/10 px-3 py-3 text-sm text-cs-muted">
          <p>Keep the requested number of highest-value copies using wear, float, StatTrak, Souvenir, and Pattern premiums. Extra copies use the same discounted instant-sale quote as manual selling.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <SafetyToggle checked={draft.protectRarePatterns} label="Protect rare Patterns" onChange={(checked) => setDraft((current) => ({ ...current, protectRarePatterns: checked }))} />
            <SafetyToggle checked={draft.protectSpecialItems} label="Protect knives & gloves" onChange={(checked) => setDraft((current) => ({ ...current, protectSpecialItems: checked }))} />
            <SafetyToggle checked={draft.includeStatTrak} label="Allow StatTrak sales" onChange={(checked) => setDraft((current) => ({ ...current, includeStatTrak: checked }))} />
            <SafetyToggle checked={draft.includeSouvenir} label="Allow Souvenir sales" onChange={(checked) => setDraft((current) => ({ ...current, includeSouvenir: checked }))} />
          </div>
          <p className="mt-2 text-xs">Locked and favorited items are always protected. Disable safeguards only when you explicitly want those editions included.</p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-2">
        {rules.length > 0 ? (
          rules.map((rule, index) => (
            <article
              className="flex flex-col gap-3 border border-cs-border bg-cs-surface p-3 sm:flex-row sm:items-center sm:justify-between"
              draggable
              key={rule.id}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={() => setDraggedRuleId(rule.id)}
              onDrop={(event) => handleRuleDrop(event, rule.id)}
            >
              <div className="flex min-w-0 gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1 grid h-8 w-8 shrink-0 place-items-center border border-cs-border text-cs-muted"
                >
                  <GripVertical size={16} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-cs-text">
                      {index + 1}. {ruleTypeLabels[rule.type]}
                    </p>
                    <span
                      className={[
                        'border px-2 py-1 font-mono text-[10px] uppercase',
                        rule.enabled
                          ? 'border-cs-green bg-cs-green/10 text-cs-green'
                          : 'border-cs-border text-cs-muted',
                      ].join(' ')}
                    >
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-cs-muted">{getRuleThresholdLabel(rule)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  aria-label={`Move ${ruleTypeLabels[rule.type]} rule up`}
                  className="grid h-10 w-10 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text disabled:opacity-40"
                  disabled={index === 0}
                  onClick={() => moveRuleByOffset(rule.id, -1)}
                  title="Move up"
                  type="button"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  aria-label={`Move ${ruleTypeLabels[rule.type]} rule down`}
                  className="grid h-10 w-10 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text disabled:opacity-40"
                  disabled={index === rules.length - 1}
                  onClick={() => moveRuleByOffset(rule.id, 1)}
                  title="Move down"
                  type="button"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  className="border border-cs-border px-3 py-2 text-sm text-cs-muted transition-colors hover:text-cs-text"
                  onClick={() => onUpdateRule(rule.id, { enabled: !rule.enabled })}
                  type="button"
                >
                  {rule.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  aria-label={`Edit ${ruleTypeLabels[rule.type]} rule`}
                  className="grid h-10 w-10 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text"
                  onClick={() => {
                    setEditingRuleId(rule.id)
                    setDraft(createDraftFromRule(rule))
                  }}
                  title="Edit rule"
                  type="button"
                >
                  <Pencil size={16} />
                </button>
                <button
                  aria-label={`Delete ${ruleTypeLabels[rule.type]} rule`}
                  className="grid h-10 w-10 place-items-center border border-rarity-covert text-rarity-covert transition-colors hover:bg-rarity-covert/10"
                  onClick={() => onRemoveRule(rule.id)}
                  title="Delete rule"
                  type="button"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="border border-cs-border bg-cs-surface p-5 text-sm text-cs-muted">
            No auto-sell rules configured.
          </div>
        )}
      </div>
    </div>
  )
}

function SafetyToggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-10 items-center gap-2 border border-cs-border bg-cs-panel px-3"><input checked={checked} className="h-4 w-4 accent-rarity-special" onChange={(event) => onChange(event.target.checked)} type="checkbox" /><span className="text-xs text-cs-text">{label}</span></label>
}

function PreviewColumn({ items, label, tone }: { items: SkinInstance[]; label: string; tone: string }) {
  return <div className="min-w-0"><p className={`font-mono text-[10px] uppercase ${tone}`}>{label}</p><div className="mt-2 space-y-1">{items.slice(0, 5).map((item, index) => <div className="flex min-w-0 justify-between gap-2 text-xs" key={item.instanceId}><span className="truncate text-cs-muted">#{index + 1} {item.weapon} | {item.finish}</span><span className="shrink-0 font-semibold text-cs-text">{formatCurrency(item.marketValue)}</span></div>)}{items.length > 5 ? <p className="text-xs text-cs-muted">+{items.length - 5} more</p> : null}</div></div>
}

function ThresholdField({
  draft,
  setDraft,
}: {
  draft: RuleDraft
  setDraft: Dispatch<SetStateAction<RuleDraft>>
}) {
  if (draft.type === AutoSellRuleType.MaxRarity) {
    return (
      <label className="min-w-0 text-sm text-cs-muted">
        Threshold
        <select
          className="mt-2 min-w-0 max-w-full w-full border border-cs-border bg-cs-surface px-3 py-2 text-cs-text outline-none focus:border-rarity-special"
          onChange={(event) =>
            setDraft((currentDraft) => ({
              ...currentDraft,
              rarityThreshold: event.target.value as Rarity,
            }))
          }
          value={draft.rarityThreshold}
        >
          {rarityOptions.map((rarity) => (
            <option key={rarity} value={rarity}>
              {getRarityLabel(rarity)}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (draft.type === AutoSellRuleType.MaxWear || draft.type === AutoSellRuleType.SellWearBelow) {
    return (
      <label className="min-w-0 text-sm text-cs-muted">
        Threshold
        <select
          className="mt-2 min-w-0 max-w-full w-full border border-cs-border bg-cs-surface px-3 py-2 text-cs-text outline-none focus:border-rarity-special"
          onChange={(event) =>
            setDraft((currentDraft) => ({
              ...currentDraft,
              wearThreshold: event.target.value as WearCondition,
            }))
          }
          value={draft.wearThreshold}
        >
          {wearOptions.map((wear) => (
            <option key={wear} value={wear}>
              {getWearLabel(wear)}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (
    draft.type === AutoSellRuleType.SellDuplicates ||
    draft.type === AutoSellRuleType.KeepFactoryNew
  ) {
    return (
      <div className="border border-cs-border bg-cs-surface px-3 py-2 text-sm text-cs-muted">
        Threshold
        <p className="mt-2 font-semibold text-cs-text">
          {draft.type === AutoSellRuleType.KeepFactoryNew ? 'Factory New protected' : 'Duplicate copies'}
        </p>
      </div>
    )
  }

  if (draft.type === AutoSellRuleType.SellDuplicatesKeepOne) {
    return (
      <label className="min-w-0 text-sm text-cs-muted">
        Copies to keep
        <input
          className="mt-2 w-full border border-cs-border bg-cs-surface px-3 py-2 text-cs-text outline-none focus:border-rarity-special"
          min="1"
          max="99"
          onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, keepCount: event.target.value }))}
          step="1"
          type="number"
          value={draft.keepCount}
        />
      </label>
    )
  }

  if (draft.type === AutoSellRuleType.SellBelowValuePerRarity) {
    return (
      <div className="border border-cs-border bg-cs-surface p-3 text-sm text-cs-muted">
        Per-rarity thresholds
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {rarityOptions.map((rarity) => (
            <label className="block" key={rarity}>
              <span className="font-mono text-[10px] uppercase">{getRarityLabel(rarity)}</span>
              <input
                className="mt-1 w-full border border-cs-border bg-cs-panel px-2 py-1 text-cs-text outline-none focus:border-rarity-special"
                min="0"
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    valueThresholdsByRarity: {
                      ...currentDraft.valueThresholdsByRarity,
                      [rarity]: event.target.value,
                    },
                  }))
                }
                step="0.01"
                type="number"
                value={draft.valueThresholdsByRarity[rarity]}
              />
            </label>
          ))}
        </div>
      </div>
    )
  }

  return (
    <label className="min-w-0 text-sm text-cs-muted">
      Threshold
      <input
        className="mt-2 min-w-0 max-w-full w-full border border-cs-border bg-cs-surface px-3 py-2 text-cs-text outline-none focus:border-rarity-special"
        min="0"
        onChange={(event) =>
          setDraft((currentDraft) => ({
            ...currentDraft,
            valueThreshold: event.target.value,
          }))
        }
        step="0.01"
        type="number"
        value={draft.valueThreshold}
      />
    </label>
  )
}
