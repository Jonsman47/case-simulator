import { Banknote, Clock, PackageCheck, ShieldAlert, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import type { OfflineProgressSummary } from '../utils/offlineProgress'
import { formatCurrency } from '../utils/format'

function formatDuration(ms: number) {
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours <= 0) {
    return `${Math.max(1, minutes)}m`
  }

  return `${hours}h ${minutes}m`
}

export function OfflineProgressModal({
  onApply,
  onDismiss,
  summary,
}: {
  onApply: () => void
  onDismiss: () => void
  summary: OfflineProgressSummary
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-0 backdrop-blur-sm sm:p-4">
      <section
        aria-labelledby="offline-progress-title"
        aria-modal="true"
        className="flex min-h-dvh w-full max-w-none flex-col overflow-y-auto border border-rarity-special bg-cs-surface shadow-glow sm:min-h-0 sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl"
        role="dialog"
      >
        <div className="border-b border-cs-border bg-cs-panel p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-rarity-special bg-rarity-special/10 text-rarity-special">
              <Clock size={22} />
            </div>
            <div>
              <p className="font-mono text-xs uppercase text-rarity-special">Welcome back</p>
              <h2 id="offline-progress-title" className="mt-1 text-xl font-semibold text-cs-text sm:text-2xl">
                Offline Progress Ready
              </h2>
              <p className="mt-2 text-sm text-cs-muted">
                Automation ran for {formatDuration(summary.appliedDurationMs)} while you were away.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryMetric
              icon={<Banknote size={18} />}
              label="Money Earned"
              value={formatCurrency(summary.moneyEarned)}
            />
            <SummaryMetric
              icon={<Sparkles size={18} />}
              label="Net Change"
              value={`${summary.netMoneyChange >= 0 ? '+' : ''}${formatCurrency(summary.netMoneyChange)}`}
            />
            <SummaryMetric
              icon={<PackageCheck size={18} />}
              label="Cases Opened"
              value={String(summary.casesOpened)}
            />
            <SummaryMetric
              icon={<PackageCheck size={18} />}
              label="Items Obtained"
              value={String(summary.itemsObtained)}
            />
          </div>

          <div className="mt-4 grid gap-2 border border-cs-border bg-cs-panel p-3 sm:grid-cols-4">
            <SmallMetric label="Auto-Sold" value={String(summary.autoSoldItems)} />
            <SmallMetric label="Trade-Ups" value={String(summary.tradeUpsCompleted)} />
            <SmallMetric label="Rare Drops" value={String(summary.rareDrops)} />
            <SmallMetric label="Spent" value={formatCurrency(summary.moneySpent)} />
          </div>

          {summary.wasCapped || summary.skippedTasks.length > 0 ? (
            <div className="mt-4 border border-rarity-covert/60 bg-rarity-covert/10 p-3 text-sm text-rarity-covert">
              <div className="flex items-start gap-2">
                <ShieldAlert className="shrink-0" size={17} />
                <div>
                  <p className="font-semibold">Some offline work was limited.</p>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    {summary.skippedTasks.map((task) => (
                      <li key={task}>{task}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-auto grid gap-2 pt-5 sm:flex sm:justify-end">
            <button
              className="inline-flex min-h-11 items-center justify-center border border-cs-border px-4 py-2 text-sm font-medium text-cs-muted transition-colors hover:text-cs-text"
              onClick={onDismiss}
              type="button"
            >
              Dismiss
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center border border-rarity-special bg-rarity-special/10 px-4 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20"
              onClick={onApply}
              type="button"
            >
              Apply Progress
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function SummaryMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="border border-cs-border bg-cs-panel p-3">
      <div className="flex items-center gap-2 text-rarity-special">
        {icon}
        <p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p>
      </div>
      <p className="mt-2 text-xl font-semibold text-cs-text">{value}</p>
    </div>
  )
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-cs-text">{value}</p>
    </div>
  )
}
