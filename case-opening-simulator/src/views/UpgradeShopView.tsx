import {
  Bot,
  CheckCircle,
  Lock,
  Package,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react'
import { useMemo, useState, type ComponentType } from 'react'
import { UpgradeCategory, type UpgradeId } from '../data/models'
import {
  UPGRADE_CATEGORY_ORDER,
  UPGRADE_DEFINITIONS,
  canPurchaseUpgrade,
  getCaseCostReduction,
  getClickIncomeMultiplier,
  getMaxMultiOpenBatch,
  getModuleBaySlots,
  getOpeningAnimationSpeedBonus,
  getRarityLuckBonus,
  getTrendPredictionBonus,
  getUpgradeAutomationIntervalMultiplier,
  getUpgradeLevel,
  getUpgradeSellValueMultiplier,
  getWarehouseUpgradeCapacityBonus,
  type UpgradeDefinition,
} from '../data/upgrades'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'

const categoryIcons: Record<UpgradeCategory, ComponentType<{ className?: string; size?: number }>> = {
  [UpgradeCategory.Opening]: Zap,
  [UpgradeCategory.Clicker]: Wallet,
  [UpgradeCategory.Market]: TrendingUp,
  [UpgradeCategory.Automation]: Bot,
  [UpgradeCategory.Capacity]: Package,
  [UpgradeCategory.Luck]: Sparkles,
}

function categoryAccentClass(category: UpgradeCategory) {
  switch (category) {
    case UpgradeCategory.Opening:
      return 'border-rarity-special text-rarity-special'
    case UpgradeCategory.Clicker:
      return 'border-cs-green text-cs-green'
    case UpgradeCategory.Market:
      return 'border-rarity-industrial text-rarity-industrial'
    case UpgradeCategory.Automation:
      return 'border-rarity-mil-spec text-rarity-mil-spec'
    case UpgradeCategory.Capacity:
      return 'border-rarity-restricted text-rarity-restricted'
    case UpgradeCategory.Luck:
      return 'border-rarity-covert text-rarity-covert'
    default:
      return 'border-cs-border text-cs-muted'
  }
}

function formatPercent(value: number) {
  return `${Number((value * 100).toFixed(1))}%`
}

function ResourcePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-cs-border bg-cs-panel px-3 py-2">
      <p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-cs-text">{value}</p>
    </div>
  )
}

function EffectSummary({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="border border-cs-border bg-cs-panel p-2">
      <p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-cs-text">{value}</p>
    </div>
  )
}

function getPurchaseLabel({
  canAfford,
  isMaxLevel,
  requirementsMet,
}: {
  canAfford: boolean
  isMaxLevel: boolean
  requirementsMet: boolean
}) {
  if (isMaxLevel) {
    return 'Maxed'
  }

  if (!requirementsMet) {
    return 'Locked'
  }

  if (!canAfford) {
    return 'Need Resources'
  }

  return 'Purchase'
}

function UpgradeCard({
  definition,
  onPurchase,
  state,
}: {
  definition: UpgradeDefinition
  onPurchase: (upgradeId: UpgradeId) => void
  state: ReturnType<typeof useGame>['state']
}) {
  const Icon = categoryIcons[definition.category]
  const purchase = canPurchaseUpgrade(definition, state)
  const level = getUpgradeLevel(state.upgrades, definition.id)
  const progress = (level / definition.maxLevel) * 100
  const disabled = purchase.isMaxLevel || !purchase.requirementsMet || !purchase.canAfford
  const costParts = [
    formatCurrency(purchase.cost.money),
    purchase.cost.upgradePoints > 0
      ? `${purchase.cost.upgradePoints} point${purchase.cost.upgradePoints === 1 ? '' : 's'}`
      : undefined,
  ].filter(Boolean)

  return (
    <article
      className="flex min-h-[17rem] flex-col border border-cs-border bg-cs-panel p-3"
      title={definition.description}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`grid h-8 w-8 shrink-0 place-items-center border bg-cs-surface ${categoryAccentClass(definition.category)}`}>
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase text-cs-muted">{definition.category}</p>
            <h3 className="mt-1 truncate text-base font-semibold text-cs-text">{definition.name}</h3>
          </div>
        </div>
        <span className="shrink-0 border border-cs-border bg-cs-surface px-2 py-1 font-mono text-[10px] uppercase text-cs-muted">
          Lv {level}/{definition.maxLevel}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-5 text-cs-muted">{definition.description}</p>

      <div className="mt-3">
        <div className="mb-2 flex justify-between gap-3 font-mono text-[10px] uppercase text-cs-muted">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 border border-cs-border bg-cs-surface">
          <div className="h-full bg-rarity-special transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <dl className="mt-3 grid gap-2 text-sm">
        <div className="border border-cs-border bg-cs-surface px-3 py-2">
          <dt className="font-mono text-[10px] uppercase text-cs-muted">Current</dt>
          <dd className="mt-1 text-cs-text">{definition.getCurrentEffect(level)}</dd>
        </div>
        {!purchase.isMaxLevel ? (
          <div className="border border-cs-border bg-cs-surface px-3 py-2">
            <dt className="font-mono text-[10px] uppercase text-cs-muted">Next</dt>
            <dd className="mt-1 text-cs-green">{definition.getNextEffect(level)}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-3 flex-1">
        {purchase.requirementStatuses.length > 0 ? (
          <div className="space-y-2">
            {purchase.requirementStatuses.map((requirement) => (
              <div
                className={[
                  'flex items-center gap-2 border px-2 py-1 text-xs',
                  requirement.met
                    ? 'border-cs-green/50 bg-cs-green/10 text-cs-green'
                    : 'border-cs-border bg-cs-surface text-cs-muted',
                ].join(' ')}
                key={requirement.label}
              >
                {requirement.met ? <CheckCircle size={14} /> : <Lock size={14} />}
                <span>{requirement.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-cs-border bg-cs-surface px-2 py-1 text-xs text-cs-muted">
            No prerequisites
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-cs-border pt-3">
        <div>
          <p className="font-mono text-[10px] uppercase text-cs-muted">Cost</p>
          <p className="mt-1 text-sm font-semibold text-cs-text">{purchase.isMaxLevel ? 'Complete' : costParts.join(' + ')}</p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 border border-rarity-special bg-rarity-special/10 px-3 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20 disabled:cursor-not-allowed disabled:border-cs-border disabled:bg-transparent disabled:text-cs-muted"
          disabled={disabled}
          onClick={() => onPurchase(definition.id)}
          type="button"
        >
          {disabled ? <Lock size={16} /> : <ShoppingCart size={16} />}
          {getPurchaseLabel(purchase)}
        </button>
      </div>
    </article>
  )
}

export function UpgradeShopView() {
  const { purchaseUpgrade, state } = useGame()
  const [category, setCategory] = useState<UpgradeCategory | 'all'>('all')
  const visibleUpgrades = useMemo(() => {
    return category === 'all'
      ? UPGRADE_DEFINITIONS
      : UPGRADE_DEFINITIONS.filter((definition) => definition.category === category)
  }, [category])
  const totalUpgradeLevels = useMemo(() => {
    return Object.values(state.upgrades).reduce((total, level) => total + (level ?? 0), 0)
  }, [state.upgrades])
  const automationReduction = 1 - getUpgradeAutomationIntervalMultiplier(state.upgrades)

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-3 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="border-l-4 border-rarity-special pl-4">
          <p className="font-mono text-xs uppercase text-rarity-special">Permanent Workshop</p>
          <h2 className="mt-1 text-2xl font-semibold text-cs-text sm:text-3xl">Upgrade Shop</h2>
          <p className="mt-2 max-w-2xl text-sm text-cs-muted">
            Spend cash and upgrade points on bonuses that change opening, selling, automation, and luck.
          </p>
        </div>
        <div className="grid gap-2 border border-cs-border bg-cs-panel p-2 sm:grid-cols-3">
          <ResourcePill label="Money" value={formatCurrency(state.money)} />
          <ResourcePill label="Upgrade Points" value={String(state.upgradePoints)} />
          <ResourcePill label="Levels Owned" value={String(totalUpgradeLevels)} />
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <EffectSummary label="Case Discount" value={formatPercent(getCaseCostReduction(state.upgrades))} />
        <EffectSummary label="Sell Multiplier" value={`${formatPercent(getUpgradeSellValueMultiplier(state.upgrades) - 1)} bonus`} />
        <EffectSummary label="Max Batch" value={String(getMaxMultiOpenBatch(state.upgrades, state.learnedSkillNodeIds))} />
        <EffectSummary label="Automation Speed" value={`${formatPercent(automationReduction)} faster`} />
        <EffectSummary label="Opening Speed" value={`${formatPercent(getOpeningAnimationSpeedBonus(state.upgrades))} faster`} />
        <EffectSummary label="Click Income" value={`${formatPercent(getClickIncomeMultiplier(state.upgrades) - 1)} bonus`} />
        <EffectSummary label="Prediction" value={`${formatPercent(getTrendPredictionBonus(state.upgrades))} accuracy`} />
        <EffectSummary label="Rare Luck" value={`${formatPercent(getRarityLuckBonus(state.upgrades))} pressure`} />
        <EffectSummary label="Future Slots" value={`+${getWarehouseUpgradeCapacityBonus(state.upgrades)}`} />
        <EffectSummary label="Module Bays" value={`+${getModuleBaySlots(state.upgrades)}`} />
      </div>

      {state.lastError ? (
        <div className="mt-5 border border-rarity-covert bg-rarity-covert/10 px-3 py-2 text-sm text-rarity-covert">
          {state.lastError}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          aria-pressed={category === 'all'}
          className={[
            'border px-3 py-2 text-sm transition-colors',
            category === 'all'
              ? 'border-rarity-special bg-rarity-special/10 text-rarity-special'
              : 'border-cs-border text-cs-muted hover:text-cs-text',
          ].join(' ')}
          onClick={() => setCategory('all')}
          type="button"
        >
          All
        </button>
        {UPGRADE_CATEGORY_ORDER.map((nextCategory) => (
          <button
            aria-pressed={category === nextCategory}
            className={[
              'border px-3 py-2 text-sm transition-colors',
              category === nextCategory
                ? `${categoryAccentClass(nextCategory)} bg-cs-panel`
                : 'border-cs-border text-cs-muted hover:text-cs-text',
            ].join(' ')}
            key={nextCategory}
            onClick={() => setCategory(nextCategory)}
            type="button"
          >
            {nextCategory.replace(' Upgrades', '')}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {visibleUpgrades.map((definition) => (
          <UpgradeCard
            definition={definition}
            key={definition.id}
            onPurchase={purchaseUpgrade}
            state={state}
          />
        ))}
      </div>
    </section>
  )
}
