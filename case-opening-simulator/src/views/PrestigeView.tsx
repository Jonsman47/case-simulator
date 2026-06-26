import {
  AlertTriangle,
  CheckCircle,
  Gem,
  Lock,
  RotateCcw,
  Shield,
  ShoppingCart,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { defaultGameState } from '../data/gameState'
import type { ComponentType } from 'react'
import { PrestigeBonusId, type PrestigeBonusLevels } from '../data/models'
import {
  PRESTIGE_BONUS_DEFINITIONS,
  PRESTIGE_CASES_OPENED_THRESHOLD,
  PRESTIGE_MONEY_EARNED_THRESHOLD,
  PRESTIGE_MONEY_SPENT_THRESHOLD,
  calculatePrestigePointAward,
  canPurchasePrestigeBonus,
  getPrestigeAutomationIntervalMultiplier,
  getPrestigeBonusLevel,
  getPrestigeCaseDiscount,
  getPrestigeEligibility,
  getPrestigeInventoryCapacityBonus,
  getPrestigeLuckBonus,
  getPrestigeMarketKnowledgeBonus,
  getPrestigeSellMultiplier,
  getPrestigeStartingMoneyBonus,
  type PrestigeBonusDefinition,
} from '../data/prestige'
import { getSkillPrestigePointMultiplier } from '../data/skills'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'
import { PRESTIGE_INVENTORY_VALUE_THRESHOLD } from '../utils/inventory'

function formatPercent(value: number) {
  return `${Number((value * 100).toFixed(1))}%`
}

function ProgressMeter({
  current,
  formatValue = formatCurrency,
  label,
  target,
}: {
  current: number
  formatValue?: (value: number) => string
  label: string
  target: number
}) {
  const progress = Math.min(100, (current / target) * 100)

  return (
    <div className="border border-cs-border bg-cs-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase text-cs-muted">{label}</p>
        <p className="font-mono text-xs uppercase text-cs-text">{Math.floor(progress)}%</p>
      </div>
      <div className="mt-3 h-3 border border-cs-border bg-cs-surface">
        <div className="h-full bg-rarity-special transition-[width]" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-2 flex justify-between gap-3 text-sm">
        <span className="text-cs-muted">{formatValue(current)}</span>
        <span className="text-cs-text">{formatValue(target)}</span>
      </div>
    </div>
  )
}

function BonusStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-cs-border bg-cs-panel px-3 py-2">
      <p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-cs-text">{value}</p>
    </div>
  )
}

const prestigeBonusIcons: Record<PrestigeBonusId, ComponentType<{ className?: string; size?: number }>> = {
  [PrestigeBonusId.AutomationSpeed]: Shield,
  [PrestigeBonusId.CaseDiscount]: Shield,
  [PrestigeBonusId.DropLuck]: Sparkles,
  [PrestigeBonusId.InventoryCapacity]: Shield,
  [PrestigeBonusId.MarketKnowledge]: Gem,
  [PrestigeBonusId.SellValue]: Sparkles,
  [PrestigeBonusId.StartingMoney]: Gem,
}

function PrestigeBonusCard({
  definition,
  onPurchase,
  points,
  prestigeBonuses,
}: {
  definition: PrestigeBonusDefinition
  onPurchase: (bonusId: PrestigeBonusId) => void
  points: number
  prestigeBonuses: PrestigeBonusLevels
}) {
  const Icon = prestigeBonusIcons[definition.id]
  const purchase = canPurchasePrestigeBonus(definition, {
    prestigeBonuses,
    prestigePoints: points,
  })
  const level = getPrestigeBonusLevel(prestigeBonuses, definition.id)
  const progress = (level / definition.maxLevel) * 100
  const disabled = purchase.isMaxLevel || !purchase.canAfford

  return (
    <article className="flex min-h-72 flex-col border border-cs-border bg-cs-panel p-4" title={definition.description}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center border border-rarity-special bg-rarity-special/10 text-rarity-special">
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase text-cs-muted">Permanent Bonus</p>
            <h3 className="mt-1 truncate text-lg font-semibold text-cs-text">{definition.name}</h3>
          </div>
        </div>
        <span className="shrink-0 border border-cs-border bg-cs-surface px-2 py-1 font-mono text-[10px] uppercase text-cs-muted">
          Lv {level}/{definition.maxLevel}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-cs-muted">{definition.description}</p>

      <div className="mt-4 h-2 border border-cs-border bg-cs-surface">
        <div className="h-full bg-rarity-special transition-[width]" style={{ width: `${progress}%` }} />
      </div>

      <dl className="mt-4 grid gap-2 text-sm">
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

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-cs-border pt-4">
        <div>
          <p className="font-mono text-[10px] uppercase text-cs-muted">Cost</p>
          <p className="mt-1 text-sm font-semibold text-cs-text">
            {purchase.isMaxLevel ? 'Complete' : `${purchase.cost} PP`}
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 border border-rarity-special bg-rarity-special/10 px-3 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20 disabled:cursor-not-allowed disabled:border-cs-border disabled:bg-transparent disabled:text-cs-muted"
          disabled={disabled}
          onClick={() => onPurchase(definition.id)}
          type="button"
        >
          {disabled ? <Lock size={16} /> : <ShoppingCart size={16} />}
          {purchase.isMaxLevel ? 'Maxed' : purchase.canAfford ? 'Buy' : 'Need PP'}
        </button>
      </div>
    </article>
  )
}

function PrestigeConfirmModal({
  award,
  onCancel,
  onConfirm,
}: {
  award: number
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
      <div className="w-full max-w-2xl border border-rarity-special bg-cs-panel p-5 shadow-glow">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center border border-rarity-special bg-rarity-special/10 text-rarity-special">
            <RotateCcw size={22} />
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-cs-text">Confirm Prestige</h3>
            <p className="mt-2 text-sm leading-6 text-cs-muted">
              This reset clears the current run and grants {award} prestige point{award === 1 ? '' : 's'}.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="border border-rarity-covert bg-rarity-covert/10 p-3">
            <p className="font-mono text-xs uppercase text-rarity-covert">Reset</p>
            <p className="mt-2 text-sm text-cs-muted">
              Money, inventory, unlocked cases, automation, run upgrades, recent drops, market events, and run stats.
            </p>
          </div>
          <div className="border border-cs-green bg-cs-green/10 p-3">
            <p className="font-mono text-xs uppercase text-cs-green">Preserved</p>
            <p className="mt-2 text-sm text-cs-muted">
              Prestige level, prestige points, permanent bonuses, achievements, collection book, and collection rewards.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            className="border border-cs-border px-4 py-2 text-sm font-semibold text-cs-muted transition-colors hover:text-cs-text"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 border border-rarity-special bg-rarity-special/10 px-4 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20"
            onClick={onConfirm}
            type="button"
          >
            <RotateCcw size={16} />
            Prestige
          </button>
        </div>
      </div>
    </div>
  )
}

export function PrestigeView() {
  const { prestige, purchasePrestigeBonus, state } = useGame()
  const [isConfirming, setIsConfirming] = useState(false)
  const snapshot = useMemo(() => ({
    achievements: state.achievements,
    casesOpened: state.statistics.casesOpened,
    collectionRewards: state.collectionRewards,
    inventoryValue: state.inventoryValue,
    moneyEarned: state.statistics.moneyEarned,
    moneySpent: state.statistics.moneySpent,
    prestigeBonuses: state.prestigeBonuses,
    prestigeLevel: state.prestigeLevel,
    prestigePoints: state.prestigePoints,
  }), [
    state.achievements,
    state.collectionRewards,
    state.inventoryValue,
    state.prestigeBonuses,
    state.prestigeLevel,
    state.prestigePoints,
    state.statistics.casesOpened,
    state.statistics.moneyEarned,
    state.statistics.moneySpent,
  ])
  const eligibility = useMemo(() => getPrestigeEligibility(snapshot), [snapshot])
  const pointAward = useMemo(() => {
    const baseAward = calculatePrestigePointAward(snapshot)

    return Math.max(1, Math.ceil(baseAward * getSkillPrestigePointMultiplier(state.learnedSkillNodeIds)))
  }, [snapshot, state.learnedSkillNodeIds])
  const automationSpeedBonus = 1 - getPrestigeAutomationIntervalMultiplier(state.prestigeBonuses)

  function confirmPrestige() {
    prestige()
    setIsConfirming(false)
  }

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-5 sm:p-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="border-l-4 border-rarity-special pl-4">
          <p className="font-mono text-xs uppercase text-rarity-special">Long Run Reset</p>
          <h2 className="mt-1 text-3xl font-semibold text-cs-text sm:text-4xl">Prestige</h2>
          <p className="mt-2 max-w-2xl text-sm text-cs-muted">
            Convert a strong run into permanent power, then start again with a sharper baseline.
          </p>
        </div>
        <div className="grid gap-2 border border-cs-border bg-cs-panel p-3 sm:grid-cols-3">
          <BonusStat label="Prestige" value={String(state.prestigeLevel)} />
          <BonusStat label="Points" value={String(state.prestigePoints)} />
          <BonusStat label="Next Award" value={String(pointAward)} />
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          <section className="border border-cs-border bg-cs-panel p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="font-mono text-xs uppercase text-cs-muted">Eligibility</p>
                <h3 className="mt-1 text-2xl font-semibold text-cs-text">
                  {eligibility.canPrestige ? 'Prestige Ready' : 'Build The Run'}
                </h3>
                <p className="mt-2 text-sm text-cs-muted">{eligibility.reason}</p>
              </div>
              <button
                className="inline-flex items-center justify-center gap-2 border border-rarity-special bg-rarity-special/10 px-4 py-3 font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20 disabled:cursor-not-allowed disabled:border-cs-border disabled:bg-transparent disabled:text-cs-muted"
                disabled={!eligibility.canPrestige}
                onClick={() => setIsConfirming(true)}
                type="button"
              >
                {eligibility.canPrestige ? <RotateCcw size={18} /> : <Lock size={18} />}
                Prestige Run
              </button>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              <ProgressMeter
                current={state.statistics.casesOpened}
                formatValue={(value) => Math.floor(value).toLocaleString()}
                label="Cases Opened"
                target={PRESTIGE_CASES_OPENED_THRESHOLD}
              />
              <ProgressMeter
                current={state.statistics.moneySpent}
                label="Money Spent"
                target={PRESTIGE_MONEY_SPENT_THRESHOLD}
              />
              <ProgressMeter
                current={state.inventoryValue}
                label="Inventory Value"
                target={PRESTIGE_INVENTORY_VALUE_THRESHOLD}
              />
              <ProgressMeter
                current={state.statistics.moneyEarned}
                label="Sell Earnings"
                target={PRESTIGE_MONEY_EARNED_THRESHOLD}
              />
            </div>

            {state.lastError ? (
              <div className="mt-4 flex items-start gap-2 border border-rarity-covert bg-rarity-covert/10 p-3 text-sm text-rarity-covert">
                <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                <span>{state.lastError}</span>
              </div>
            ) : null}
          </section>

          <section className="border border-cs-border bg-cs-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase text-cs-muted">Prestige Shop</p>
                <h3 className="mt-1 text-2xl font-semibold text-cs-text">Permanent Bonuses</h3>
              </div>
              <Trophy className="text-rarity-special" size={22} />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {PRESTIGE_BONUS_DEFINITIONS.map((definition) => (
                <PrestigeBonusCard
                  definition={definition}
                  key={definition.id}
                  onPurchase={purchasePrestigeBonus}
                  points={state.prestigePoints}
                  prestigeBonuses={state.prestigeBonuses}
                />
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="border border-cs-border bg-cs-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-cs-text">Permanent Effects</h3>
              <CheckCircle className="text-cs-green" size={20} />
            </div>
            <div className="mt-4 grid gap-2">
              <BonusStat label="Sell Value" value={`${formatPercent(getPrestigeSellMultiplier(state.prestigeBonuses) - 1)} bonus`} />
              <BonusStat label="Case Discount" value={formatPercent(getPrestigeCaseDiscount(state.prestigeBonuses))} />
              <BonusStat label="Drop Luck" value={`${formatPercent(getPrestigeLuckBonus(state.prestigeBonuses))} pressure`} />
              <BonusStat label="Automation" value={`${formatPercent(automationSpeedBonus)} faster`} />
              <BonusStat label="Starting Cash" value={formatCurrency(defaultGameState.money + getPrestigeStartingMoneyBonus(state.prestigeBonuses))} />
              <BonusStat label="Future Slots" value={`+${getPrestigeInventoryCapacityBonus(state.prestigeBonuses)}`} />
              <BonusStat label="Market Knowledge" value={`${formatPercent(getPrestigeMarketKnowledgeBonus(state.prestigeBonuses))} accuracy`} />
            </div>
          </section>

          <section className="border border-cs-border bg-cs-panel p-4">
            <h3 className="text-xl font-semibold text-cs-text">Point Formula</h3>
            <p className="mt-3 text-sm leading-6 text-cs-muted">
              Award uses run value, cases opened, achievement count, and collection prestige bonuses.
            </p>
            <div className="mt-4 border border-cs-border bg-cs-surface p-3">
              <p className="font-mono text-[10px] uppercase text-cs-muted">Projected Award</p>
              <p className="mt-1 text-3xl font-semibold text-rarity-special">{pointAward} PP</p>
            </div>
          </section>
        </aside>
      </div>

      {isConfirming ? (
        <PrestigeConfirmModal
          award={pointAward}
          onCancel={() => setIsConfirming(false)}
          onConfirm={confirmPrestige}
        />
      ) : null}
    </section>
  )
}
