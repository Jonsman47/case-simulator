import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { History, Lock, Star } from 'lucide-react'
import { type TouchEvent, useMemo, useRef, useState } from 'react'
import { Pie } from 'react-chartjs-2'
import { AssetImage } from '../components/AssetImage'
import { BatchOpenSummaryModal } from '../components/BatchOpenSummaryModal'
import { CaseOpeningAnimation } from '../components/CaseOpeningAnimation'
import { CaseOpenControls, type CaseOpenOptions } from '../components/CaseOpenControls'
import { PriceChart } from '../components/PriceChart'
import { getCaseLicenseCost, requiresCaseLicense } from '../data/casePricing'
import { getOfficialWeaponCaseRarityOdds, type OfficialRarityDropOdd } from '../data/officialDropOdds'
import { SKIN_DEFINITIONS } from '../data/skins'
import type { AnimationSpeed, GameState } from '../data/gameState'
import { CaseStatus, Rarity, UpgradeId, type CaseDefinition, type SkinBase } from '../data/models'
import { getSkinRarityColor } from '../data/rarities'
import { useGame } from '../hooks/useGame'
import {
  canOpenCaseFromSelection,
  filterCases,
  getBestPossibleDrop,
  getCaseStatusLabel,
  getRarityTextClass,
  getUnlockProgressLabel,
  sortCases,
  type CaseFilter,
  type CaseSort,
} from '../utils/caseSelection'
import { calculateCaseStats } from '../utils/caseStats'
import { formatCurrency } from '../utils/format'
import { getLatestCaseOpeningSummary } from '../utils/caseOpeningSummary'
import { getRarityLabel, getSkinRarityLabel } from '../utils/itemLabels'
import {
  getPotentialSkinOptions,
  selectOpeningAnimationItem,
  shouldPlayOpeningAnimation,
} from '../utils/openingAnimation'
import { getMaxMultiOpenBatch, getUpgradeLevel } from '../data/upgrades'

ChartJS.register(ArcElement, Legend, Tooltip)

const skinsById = new Map(SKIN_DEFINITIONS.map((skin) => [skin.id, skin]))

const filterOptions: { label: string; value: CaseFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Unlocked', value: 'unlocked' },
  { label: 'Locked', value: 'locked' },
  { label: 'Retired', value: 'retired' },
]

const sortOptions: { label: string; value: CaseSort }[] = [
  { label: 'Cost', value: 'cost' },
  { label: 'Name', value: 'name' },
  { label: 'Unlock Progress', value: 'unlockProgress' },
]

const rarityChartColors: Record<Rarity, string> = {
  [Rarity.Consumer]: '#9ca3af',
  [Rarity.Industrial]: '#5e98d9',
  [Rarity.MilSpec]: '#4b69ff',
  [Rarity.Restricted]: '#8847ff',
  [Rarity.Classified]: '#d32ce6',
  [Rarity.Covert]: '#eb4b4b',
  [Rarity.SpecialItem]: '#ffd700',
  [Rarity.Contraband]: '#e4ae39',
}

type CaseDetailTab = 'overview' | 'stats'

function getEffectiveAnimationSpeed(speed: AnimationSpeed, state: GameState): AnimationSpeed {
  const motorLevel = getUpgradeLevel(state.upgrades, UpgradeId.OpeningMotor)

  if (motorLevel <= 0 || speed === 'fast' || speed === 'skip') {
    return speed
  }

  if (motorLevel === 1) {
    return 'fast'
  }

  return 'fast'
}

function formatDate(value: number | undefined) {
  if (!value) {
    return 'Unknown'
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getCaseBadgeClass(caseDef: CaseDefinition, state: GameState) {
  if (canOpenCaseFromSelection(caseDef, state)) {
    return 'border-cs-green bg-cs-green/10 text-cs-green'
  }

  if (caseDef.status === CaseStatus.Retired) {
    return 'border-cs-amber bg-cs-amber/10 text-cs-amber'
  }

  if (requiresCaseLicense(caseDef)) {
    return 'border-cs-amber/70 bg-cs-amber/10 text-cs-amber'
  }

  return 'border-cs-border text-cs-muted'
}

function getBestDropLabel(skin: SkinBase | undefined) {
  if (!skin) {
    return 'Unknown'
  }

  return `${skin.weapon} | ${skin.finish}`
}

function CaseCard({
  bestDrop,
  caseDef,
  isFavorite,
  isSelected,
  onSelect,
  state,
}: {
  bestDrop: SkinBase | undefined
  caseDef: CaseDefinition
  isFavorite: boolean
  isSelected: boolean
  onSelect: (caseDef: CaseDefinition) => void
  state: GameState
}) {
  return (
    <button
      className={[
        'group flex min-h-[15rem] flex-col border bg-cs-panel p-2.5 text-left outline-none transition-colors hover:bg-cs-panelMuted focus-visible:ring-2 focus-visible:ring-rarity-special sm:min-h-[17rem] sm:p-3',
        isSelected ? 'border-rarity-special ring-2 ring-rarity-special' : 'border-cs-border',
      ].join(' ')}
      onClick={() => onSelect(caseDef)}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`border px-2 py-1 font-mono text-[10px] uppercase ${getCaseBadgeClass(caseDef, state)}`}>
          {getCaseStatusLabel(caseDef, state)}
        </span>
        <span className="inline-flex flex-col items-end gap-1 font-mono text-xs text-cs-muted">
          <span className="inline-flex items-center gap-2">
          {isFavorite ? <Star aria-hidden="true" fill="currentColor" size={14} className="text-rarity-special" /> : null}
          {formatCurrency(caseDef.cost)}
          </span>
          {!canOpenCaseFromSelection(caseDef, state) && requiresCaseLicense(caseDef) ? (
            <span className="inline-flex items-center gap-1 text-cs-amber">
              <Lock size={12} />
              {formatCurrency(caseDef.caseLicenseCost ?? 0)}
            </span>
          ) : null}
        </span>
      </div>

      <div className="mt-3 grid h-20 place-items-center border border-cs-border bg-cs-surface sm:h-24">
        <AssetImage alt="" className="h-16 w-16 object-contain sm:h-20 sm:w-20" draggable={false} src={caseDef.image} />
      </div>

      <div className="mt-3 min-w-0">
        <h3 className="truncate text-base font-semibold text-cs-text">{caseDef.name}</h3>
        <p className="mt-1 truncate text-xs text-cs-muted">{getUnlockProgressLabel(caseDef, state)}</p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="border border-cs-border bg-cs-surface px-2 py-1.5">
          <dt className="font-mono text-[10px] uppercase text-cs-muted">Open Cost</dt>
          <dd className="mt-1 font-semibold text-cs-text">{formatCurrency(caseDef.cost)}</dd>
        </div>
        <div className="border border-cs-border bg-cs-surface px-2 py-1.5">
          <dt className="font-mono text-[10px] uppercase text-cs-muted">Best Drop</dt>
          <dd
            className="mt-1 truncate font-semibold"
            style={bestDrop ? { color: getSkinRarityColor(bestDrop) } : undefined}
          >
            {bestDrop ? getSkinRarityLabel(bestDrop) : 'Unknown'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center gap-2 border border-cs-border bg-cs-surface p-2">
        <AssetImage alt="" className="h-10 w-10 object-contain" src={bestDrop?.image} />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-cs-text">{getBestDropLabel(bestDrop)}</p>
          <p className="mt-1 font-mono text-[10px] uppercase text-cs-muted">Preview</p>
        </div>
      </div>
    </button>
  )
}

function RarityDistributionChart({
  officialOdds,
}: {
  officialOdds: OfficialRarityDropOdd[]
}) {
  const data = useMemo<ChartData<'pie'>>(
    () => ({
      labels: officialOdds.map((stat) => getRarityLabel(stat.rarity)),
      datasets: [
        {
          backgroundColor: officialOdds.map((stat) => rarityChartColors[stat.rarity]),
          borderColor: '#080b10',
          borderWidth: 2,
          data: officialOdds.map((stat) => stat.probability),
        },
      ],
    }),
    [officialOdds],
  )
  const options = useMemo<ChartOptions<'pie'>>(
    () => ({
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#d7e0ec',
            boxWidth: 10,
            font: { size: 10 },
          },
          position: 'bottom',
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${Number(context.parsed).toFixed(3)}%`,
          },
        },
      },
      responsive: true,
    }),
    [],
  )

  return (
    <div className="border border-cs-border bg-cs-surface p-3">
      <h4 className="text-sm font-semibold text-cs-text">Rarity Distribution</h4>
      <div className="mt-3 h-56">
        <Pie aria-label="Rarity distribution chart" data={data} options={options} />
      </div>
    </div>
  )
}

function OfficialRarityOddsList({
  officialOdds,
}: {
  officialOdds: OfficialRarityDropOdd[]
}) {
  return (
    <div className="border border-cs-border bg-cs-surface p-3">
      <h4 className="text-sm font-semibold text-cs-text">Official Rarity Odds</h4>
      <p className="mt-1 text-xs text-cs-muted">
        CS weapon cases use disclosed rarity-tier odds. Individual skins are intentionally listed without per-skin rates.
      </p>
      <div className="mt-3 space-y-2">
        {officialOdds.map((odd) => (
          <div key={odd.rarity}>
            <div className="flex justify-between gap-3 text-xs">
              <span className={getRarityTextClass(odd.rarity)}>{getRarityLabel(odd.rarity)}</span>
              <span className="font-mono text-cs-muted">{odd.probability.toFixed(3)}%</span>
            </div>
            <div className="mt-1 h-2 border border-cs-border bg-cs-panel">
              <div className="h-full bg-rarity-special" style={{ width: `${Math.min(100, odd.probability)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatValue({
  label,
  tone = 'default',
  value,
}: {
  label: string
  tone?: 'default' | 'green' | 'red'
  value: string
}) {
  const valueClass =
    tone === 'green' ? 'text-cs-green' : tone === 'red' ? 'text-rarity-covert' : 'text-cs-text'

  return (
    <div className="border border-cs-border bg-cs-panel px-3 py-2">
      <p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p>
      <p className={`mt-1 font-mono font-semibold ${valueClass}`}>{value}</p>
    </div>
  )
}

function CaseStatsSection({
  caseDef,
  caseStats,
  marketSimulationEnabled,
  marketHistory,
  officialOdds,
}: {
  caseDef: CaseDefinition
  caseStats: ReturnType<typeof calculateCaseStats>
  marketSimulationEnabled: boolean
  marketHistory: GameState['marketHistory']
  officialOdds: OfficialRarityDropOdd[]
}) {
  return (
    <div className="mt-5 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatValue label="Open Cost" value={formatCurrency(caseDef.cost)} />
        <StatValue label="Skins Listed" value={caseStats.dropRows.length.toLocaleString()} />
        <StatValue label="Rarity Tiers" value={officialOdds.length.toString()} />
      </div>

      <div className="grid gap-3 2xl:grid-cols-2">
        <RarityDistributionChart officialOdds={officialOdds} />
        <OfficialRarityOddsList officialOdds={officialOdds} />
      </div>

      {marketSimulationEnabled && caseStats.bestDrop ? (
        <PriceChart
          accentColor={rarityChartColors[caseStats.bestDrop.skin.rarity]}
          history={marketHistory}
          initialScale="7d"
          skinId={caseStats.bestDrop.skin.id}
          title="Best Drop Price History"
        />
      ) : null}

      {caseStats.bestDrop ? (
        <div className="flex items-center gap-3 border border-cs-border bg-cs-surface p-3">
          <AssetImage alt="" className="h-16 w-16 object-contain" src={caseStats.bestDrop.skin.image} />
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase text-cs-muted">Highest Value Drop</p>
            <p className="truncate font-semibold text-cs-text">
              {caseStats.bestDrop.skin.weapon} | {caseStats.bestDrop.skin.finish}
            </p>
            <p className="mt-1 text-sm text-cs-green">{formatCurrency(caseStats.bestDrop.marketValue)}</p>
          </div>
        </div>
      ) : null}

      <div className="border border-cs-border bg-cs-surface p-3">
        <h4 className="text-sm font-semibold text-cs-text">Case Contents</h4>
        <div className="mt-3 max-h-96 overflow-auto">
          <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-cs-panel text-cs-muted">
              <tr>
                <th className="border border-cs-border px-2 py-2 font-mono text-[10px] uppercase">Skin</th>
                <th className="border border-cs-border px-2 py-2 font-mono text-[10px] uppercase">Rarity</th>
                <th className="border border-cs-border px-2 py-2 font-mono text-[10px] uppercase">Market</th>
              </tr>
            </thead>
            <tbody>
              {caseStats.dropRows.map((row) => {
                const skin = skinsById.get(row.skinId)
                const rarityColor = skin ? getSkinRarityColor(skin) : undefined

                return (
                  <tr key={row.skinId} className="odd:bg-cs-panel/60">
                    <td className="border border-cs-border px-2 py-2 text-cs-text">
                      {row.weapon} | {row.finish}
                    </td>
                    <td
                      className={`border border-cs-border px-2 py-2 ${skin ? '' : getRarityTextClass(row.rarity)}`}
                      style={rarityColor ? { color: rarityColor } : undefined}
                    >
                      {skin ? getSkinRarityLabel(skin) : getRarityLabel(row.rarity)}
                    </td>
                    <td className="border border-cs-border px-2 py-2 font-mono text-cs-green">
                      {formatCurrency(row.marketValue)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function shouldIgnoreTabSwipe(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return true
  }

  return Boolean(target.closest('button, a, input, select, textarea'))
}

function CaseDetailPanel({
  bestDrop,
  caseDef,
  canOpen,
  isFavorite,
  onOpen,
  onPurchaseLicense,
  onToggleFavorite,
  state,
}: {
  bestDrop: SkinBase | undefined
  caseDef: CaseDefinition
  canOpen: boolean
  isFavorite: boolean
  onOpen: (quantity: number, options: CaseOpenOptions) => void
  onPurchaseLicense: (caseId: string) => void
  onToggleFavorite: (caseId: string) => void
  state: GameState
}) {
  const touchStartRef = useRef<{ x: number; y: number } | undefined>(undefined)
  const [activeTab, setActiveTab] = useState<CaseDetailTab>('overview')
  const [pendingLicenseOpen, setPendingLicenseOpen] = useState<
    { options: CaseOpenOptions; quantity: number } | undefined
  >()
  const officialOdds = useMemo(() => getOfficialWeaponCaseRarityOdds(), [])
  const caseStats = useMemo(
    () => calculateCaseStats(caseDef, state.marketValues, SKIN_DEFINITIONS),
    [caseDef, state.marketValues],
  )
  const needsLicense = !canOpen && requiresCaseLicense(caseDef)
  const licenseCost = getCaseLicenseCost(caseDef)
  const canAffordLicense = state.money >= licenseCost

  function handleOpenFromControls(quantity: number, options: CaseOpenOptions) {
    if (needsLicense) {
      setPendingLicenseOpen({ quantity, options })
      return
    }

    onOpen(quantity, options)
  }

  function handleConfirmLicensePurchase() {
    if (!canAffordLicense) {
      return
    }

    onPurchaseLicense(caseDef.id)
    setPendingLicenseOpen(undefined)
  }

  function handlePanelTouchStart(event: TouchEvent<HTMLElement>) {
    if (event.touches.length !== 1 || shouldIgnoreTabSwipe(event.target)) {
      touchStartRef.current = undefined
      return
    }

    const touch = event.touches[0]

    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  function handlePanelTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = touchStartRef.current

    touchStartRef.current = undefined

    if (!start || shouldIgnoreTabSwipe(event.target)) {
      return
    }

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y

    if (Math.abs(deltaX) < 72 || Math.abs(deltaY) > 64 || Math.abs(deltaY) > Math.abs(deltaX) * 0.75) {
      return
    }

    setActiveTab(deltaX < 0 ? 'stats' : 'overview')
  }

  return (
    <aside
      className="border border-rarity-special bg-cs-panel p-3 shadow-glow sm:p-4"
      data-swipe-ignore="true"
      onTouchEnd={handlePanelTouchEnd}
      onTouchStart={handlePanelTouchStart}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase text-rarity-special">Selected Case</p>
      <h3 className="mt-1 text-xl font-semibold text-cs-text">{caseDef.name}</h3>
          <p className="mt-2 text-sm text-cs-muted">{getCaseStatusLabel(caseDef, state)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            aria-label={isFavorite ? 'Remove case favorite' : 'Add case favorite'}
            className={[
              'inline-flex min-h-10 items-center gap-2 border px-2 py-1 font-mono text-[10px] uppercase transition-colors',
              isFavorite
                ? 'border-rarity-special bg-rarity-special/10 text-rarity-special'
                : 'border-cs-border text-cs-muted hover:text-rarity-special',
            ].join(' ')}
            onClick={() => onToggleFavorite(caseDef.id)}
            type="button"
          >
            <Star fill={isFavorite ? 'currentColor' : 'none'} size={14} />
            Favorite
          </button>
          {caseDef.status === CaseStatus.Retired ? (
            <span className="border border-cs-amber bg-cs-amber/10 px-2 py-1 font-mono text-[10px] uppercase text-cs-amber">
              Retired
            </span>
          ) : null}
        </div>
      </div>

      {needsLicense ? (
        <div className="mt-4 border border-cs-amber/70 bg-cs-amber/10 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase text-cs-amber">Case License</p>
              <p className="mt-1 text-sm text-cs-muted">
                Buy access for {formatCurrency(licenseCost)}
              </p>
            </div>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-cs-amber px-3 py-2 text-sm font-semibold text-cs-amber transition-colors hover:bg-cs-amber/10 disabled:cursor-not-allowed disabled:border-cs-border disabled:text-cs-muted disabled:opacity-60"
              disabled={!canAffordLicense}
              onClick={() => onPurchaseLicense(caseDef.id)}
              title={!canAffordLicense ? `Need ${formatCurrency(licenseCost)}` : undefined}
              type="button"
            >
              <Lock size={16} />
              Buy License
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <CaseOpenControls
          canOpen={canOpen}
          caseDef={caseDef}
          maxQuantity={getMaxMultiOpenBatch(state.upgrades, state.learnedSkillNodeIds)}
          money={state.money}
          onOpen={handleOpenFromControls}
          requiresLicense={needsLicense}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 border border-cs-border bg-cs-surface p-1" role="tablist">
        {[
          { label: 'Overview', value: 'overview' as const },
          { label: 'Stats', value: 'stats' as const },
        ].map((tab) => (
          <button
            aria-selected={activeTab === tab.value}
            className={[
              'min-h-11 px-3 py-2 text-sm font-semibold transition-colors',
              activeTab === tab.value
                ? 'bg-rarity-special/10 text-rarity-special'
                : 'text-cs-muted hover:text-cs-text',
            ].join(' ')}
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <div className="mt-5 grid gap-3">
          <div className="flex items-center gap-3 border border-cs-border bg-cs-surface p-3">
            <AssetImage alt="" className="h-16 w-16 object-contain" src={bestDrop?.image} />
            <div className="min-w-0">
              <p className="text-sm text-cs-muted">Best possible drop</p>
              <p className="truncate font-semibold text-cs-text">{getBestDropLabel(bestDrop)}</p>
              {bestDrop ? (
                <p className="mt-1 font-mono text-xs uppercase" style={{ color: getSkinRarityColor(bestDrop) }}>
                  {getSkinRarityLabel(bestDrop)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <StatValue label="Open Cost" value={formatCurrency(caseDef.cost)} />
            <StatValue
              label="License"
              value={requiresCaseLicense(caseDef) ? formatCurrency(licenseCost) : 'Included'}
            />
          </div>

          <div className="border border-cs-border bg-cs-surface p-3">
            <div className="flex items-center gap-2">
              <History size={16} className="text-rarity-industrial" />
              <h4 className="text-sm font-semibold text-cs-text">History</h4>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="font-mono text-[10px] uppercase text-cs-muted">Release</dt>
                <dd className="mt-1 text-cs-text">{formatDate(caseDef.releaseDate)}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase text-cs-muted">Retirement</dt>
                <dd className="mt-1 text-cs-text">{formatDate(caseDef.retirement?.date)}</dd>
              </div>
            </dl>
          </div>

          <OfficialRarityOddsList officialOdds={officialOdds} />

          <div className="border border-cs-border bg-cs-surface p-3">
            <h4 className="text-sm font-semibold text-cs-text">Case Contents</h4>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {caseStats.dropRows.map((drop) => {
                const skin = skinsById.get(drop.skinId)
                const rarityColor = skin ? getSkinRarityColor(skin) : undefined

                return (
                  <div
                    className="flex items-center justify-between gap-3 border border-cs-border bg-cs-panel px-2 py-2 text-sm"
                    key={drop.skinId}
                  >
                    <span className="min-w-0 truncate text-cs-text">
                      {skin ? `${skin.weapon} | ${skin.finish}` : drop.skinId}
                    </span>
                    <span
                      className={['shrink-0 font-mono text-xs', skin ? '' : getRarityTextClass(drop.rarity)].join(' ')}
                      style={rarityColor ? { color: rarityColor } : undefined}
                    >
                      {skin ? getSkinRarityLabel(skin) : getRarityLabel(drop.rarity)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <CaseStatsSection
          caseDef={caseDef}
          caseStats={caseStats}
          marketSimulationEnabled={state.settings.marketSimulationEnabled}
          marketHistory={state.marketHistory}
          officialOdds={officialOdds}
        />
      )}

      {pendingLicenseOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-md border border-cs-amber bg-cs-panel p-5 shadow-glow">
            <p className="font-mono text-[10px] uppercase text-cs-amber">License Required</p>
            <h4 className="mt-2 text-xl font-semibold text-cs-text">Buy {caseDef.name} license?</h4>
            <p className="mt-3 text-sm text-cs-muted">
              Opening {pendingLicenseOpen.quantity} requires a one-time license for {formatCurrency(licenseCost)}.
            </p>
            {!canAffordLicense ? (
              <p className="mt-3 border border-rarity-covert bg-rarity-covert/10 px-3 py-2 text-sm text-rarity-covert">
                You need {formatCurrency(licenseCost)} to unlock this case.
              </p>
            ) : null}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                className="min-h-11 border border-cs-border px-3 py-2 text-sm font-semibold text-cs-muted transition-colors hover:text-cs-text"
                onClick={() => setPendingLicenseOpen(undefined)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="min-h-11 border border-cs-amber bg-cs-amber/10 px-3 py-2 text-sm font-semibold text-cs-amber transition-colors hover:bg-cs-amber/20 disabled:cursor-not-allowed disabled:border-cs-border disabled:bg-transparent disabled:text-cs-muted disabled:opacity-60"
                disabled={!canAffordLicense}
                onClick={handleConfirmLicensePurchase}
                type="button"
              >
                Buy License
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  )
}

export function CaseSelectionView() {
  const { caseDefinitions, openCase, purchaseCaseLicense, state, toggleCaseFavorite } = useGame()
  const [filter, setFilter] = useState<CaseFilter>('all')
  const [sort, setSort] = useState<CaseSort>('cost')
  const [summaryOptions, setSummaryOptions] = useState<CaseOpenOptions | undefined>()
  const [dismissedSummaryEventId, setDismissedSummaryEventId] = useState<string | undefined>()
  const [completedAnimationEventId, setCompletedAnimationEventId] = useState<string | undefined>()
  const casesWithDisplayData = useMemo(() => {
    return sortCases(filterCases(caseDefinitions, filter), sort, state)
  }, [caseDefinitions, filter, sort, state])
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>()
  const selectedCase = useMemo(() => {
    return (
      casesWithDisplayData.find((caseDef) => caseDef.id === selectedCaseId) ??
      casesWithDisplayData[0]
    )
  }, [casesWithDisplayData, selectedCaseId])
  const selectedBestDrop = selectedCase
    ? getBestPossibleDrop(selectedCase, skinsById, state.marketValues)
    : undefined
  const selectedCanOpen = selectedCase ? canOpenCaseFromSelection(selectedCase, state) : false
  const favoriteCaseIds = useMemo(() => new Set(state.favoriteCaseIds), [state.favoriteCaseIds])
  const latestOpeningSummary = getLatestCaseOpeningSummary(state)
  const summaryCase = latestOpeningSummary
    ? caseDefinitions.find((caseDef) => caseDef.id === latestOpeningSummary.startedEvent.caseId)
    : undefined
  const shouldAnimateOpening =
    summaryOptions !== undefined &&
    latestOpeningSummary !== undefined &&
    shouldPlayOpeningAnimation(
      state.lastOpenedItems,
      state.settings.animationsEnabled && !state.settings.simplifiedAnimations,
      summaryOptions.skipAnimations || state.settings.animationSpeed === 'skip',
    )
  const openingAnimationItem =
    shouldAnimateOpening &&
    latestOpeningSummary &&
    latestOpeningSummary.startedEvent.id !== completedAnimationEventId
      ? selectOpeningAnimationItem(state.lastOpenedItems, summaryOptions?.skipAnimations ?? false)
      : undefined
  const openingAnimationItems = openingAnimationItem ? state.lastOpenedItems : []
  const openingPotentialSkins = useMemo(() => {
    return getPotentialSkinOptions(summaryCase, skinsById)
  }, [summaryCase])
  const showBatchSummary =
    summaryOptions !== undefined &&
    latestOpeningSummary !== undefined &&
    latestOpeningSummary.startedEvent.quantity > 1 &&
    latestOpeningSummary.startedEvent.id !== dismissedSummaryEventId &&
    (!shouldAnimateOpening || latestOpeningSummary.startedEvent.id === completedAnimationEventId)

  function handleOpenCase(quantity: number, options: CaseOpenOptions) {
    setSummaryOptions(options)
    setDismissedSummaryEventId(undefined)
    setCompletedAnimationEventId(undefined)
    openCase(selectedCase?.id ?? '', quantity)
  }

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-3 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="border-l-4 border-rarity-special pl-4">
          <h2 className="text-2xl font-semibold text-cs-text sm:text-3xl">Cases</h2>
          <p className="mt-2 font-mono text-xs uppercase text-cs-muted">
            {casesWithDisplayData.length} listed / {caseDefinitions.length} total
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                aria-pressed={filter === option.value}
                className={[
                  'min-h-11 border px-3 py-2 text-sm transition-colors',
                  filter === option.value
                    ? 'border-rarity-special bg-rarity-special/10 text-rarity-special'
                    : 'border-cs-border text-cs-muted hover:text-cs-text',
                ].join(' ')}
                key={option.value}
                onClick={() => setFilter(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="flex min-h-11 items-center gap-2 border border-cs-border bg-cs-panel px-3 py-2 text-sm text-cs-muted">
            Sort
            <select
              className="min-h-9 bg-cs-surface px-2 py-1 text-cs-text outline-none"
              onChange={(event) => setSort(event.target.value as CaseSort)}
              value={sort}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(26rem,32rem)]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {casesWithDisplayData.map((caseDef) => (
            <CaseCard
              bestDrop={getBestPossibleDrop(caseDef, skinsById, state.marketValues)}
              caseDef={caseDef}
              isFavorite={favoriteCaseIds.has(caseDef.id)}
              isSelected={caseDef.id === selectedCase?.id}
              key={caseDef.id}
              onSelect={(nextCase) => setSelectedCaseId(nextCase.id)}
              state={state}
            />
          ))}
        </div>

        {selectedCase ? (
          <CaseDetailPanel
            bestDrop={selectedBestDrop}
            canOpen={selectedCanOpen}
            caseDef={selectedCase}
            isFavorite={favoriteCaseIds.has(selectedCase.id)}
            onOpen={handleOpenCase}
            onPurchaseLicense={purchaseCaseLicense}
            onToggleFavorite={toggleCaseFavorite}
            state={state}
          />
        ) : (
          <div className="grid min-h-80 place-items-center border border-cs-border bg-cs-panel p-8 text-center text-cs-muted">
            No cases match this filter.
          </div>
        )}
      </div>

      {openingAnimationItem && latestOpeningSummary && summaryOptions ? (
        <CaseOpeningAnimation
          caseImage={summaryCase?.image}
          caseName={summaryCase?.name ?? latestOpeningSummary.startedEvent.caseId}
          finalItem={openingAnimationItem}
          finalItems={openingAnimationItems}
          key={latestOpeningSummary.startedEvent.id}
          onComplete={() => setCompletedAnimationEventId(latestOpeningSummary.startedEvent.id)}
          potentialSkins={openingPotentialSkins}
          soundEnabled={state.settings.soundEnabled}
          speed={getEffectiveAnimationSpeed(state.settings.animationSpeed, state)}
          startSkipped={summaryOptions.skipAnimations || state.settings.animationSpeed === 'skip'}
        />
      ) : null}

      {showBatchSummary && latestOpeningSummary && summaryOptions ? (
        <BatchOpenSummaryModal
          autoSoldItems={latestOpeningSummary.autoSoldEvent?.items ?? []}
          caseName={summaryCase?.name ?? latestOpeningSummary.startedEvent.caseId}
          items={state.lastOpenedItems}
          onClose={() => setDismissedSummaryEventId(latestOpeningSummary.startedEvent.id)}
          openedCount={latestOpeningSummary.startedEvent.quantity}
          saleValue={latestOpeningSummary.autoSoldEvent?.salePrice ?? 0}
          skipAnimations={summaryOptions.skipAnimations}
        />
      ) : null}
    </section>
  )
}
