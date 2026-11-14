import {
  BadgeCheck,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  Gem,
  Info,
  LockKeyhole,
  PackageOpen,
  Repeat2,
  Search,
  ShieldCheck,
  TrendingUp,
  Trophy,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CAREER_RANKS,
  getCareerSnapshot,
  type CareerSpecializationId,
} from '../career/careerProgress'
import {
  CAREER_UPGRADE_COUNTS,
  CAREER_UPGRADE_DEFINITIONS,
  getActiveCareerUpgradeCapabilities,
  getCareerUpgradeCurrentEffect,
  getCareerUpgradeNextEffect,
  getCareerUpgradeStatus,
  getSpecializationUpgradeProgress,
  type CareerUpgradeDefinition,
  type UpgradeSpecialization,
} from '../career/careerUpgrades'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'
import { getPrestigeEligibilityV2 } from '../prestige/prestigeSystem'

type UpgradeFilter = 'all' | 'available' | 'affordable' | 'locked' | 'purchased' | 'maxed'

const specializationCards: Array<{
  id: UpgradeSpecialization
  label: string
  description: string
  icon: LucideIcon
}> = [
  { id: 'caseOpening', label: 'Case Opening', description: 'Workflow, research, collection planning and safe Case Operator controls.', icon: PackageOpen },
  { id: 'trading', label: 'Trading', description: 'Price evidence, CSWEAR research, selling and manual negotiation insight.', icon: TrendingUp },
  { id: 'collecting', label: 'Collecting', description: 'Discovery research, organization, storage and showcase capacity.', icon: Gem },
  { id: 'tradeUps', label: 'Trade-Ups', description: 'Honest EV, probability, float planning and Specialist safeguards.', icon: Repeat2 },
  { id: 'business', label: 'Business', description: 'Employee capacity, scheduling, infrastructure and ledger-backed reporting.', icon: BriefcaseBusiness },
]

const activityRows: Array<[string, CareerSpecializationId]> = [
  ['Opening', 'caseOpening'],
  ['Trading', 'trading'],
  ['Collecting', 'collecting'],
  ['Trade-Ups', 'tradeUps'],
  ['Work', 'work'],
  ['Business', 'business'],
]

function ProgressBar({ label, value }: { label: string; value: number }) {
  const percentage = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="text-cs-muted">{label}</span><span className="font-mono text-rarity-special">{percentage}%</span></div>
      <div aria-label={label} aria-valuemax={100} aria-valuemin={0} aria-valuenow={percentage} className="h-2 overflow-hidden border border-cs-border bg-cs-surface" role="progressbar"><div className="h-full bg-rarity-special transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${percentage}%` }} /></div>
    </div>
  )
}

function Metric({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return <div className="min-w-0 border border-cs-border bg-cs-panel px-3 py-2"><p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p><p className="mt-1 break-words text-sm font-semibold text-cs-text" data-testid={testId}>{value}</p></div>
}

function UpgradeCard({ definition, expanded, onExpand }: { definition: CareerUpgradeDefinition; expanded: boolean; onExpand: () => void }) {
  const { dispatch, state } = useGame()
  const status = getCareerUpgradeStatus(definition, { career: state.career, money: state.money, upgrades: state.careerUpgrades })
  const canPurchase = !status.isMaxLevel && status.levelMet && status.activityMet && status.prerequisitesMet && status.canAfford
  const lockedReasons = [
    !status.levelMet ? `Career level ${definition.requiredLevel}` : '',
    !status.activityMet ? `${definition.requiredSpecializationXp.toLocaleString()} specialization XP` : '',
    ...status.prerequisiteStatuses.filter((entry) => !entry.met).map((entry) => entry.name),
  ].filter(Boolean)

  return (
    <article className={['min-w-0 border bg-cs-panel', canPurchase ? 'border-rarity-special/60' : status.level > 0 ? 'border-cs-green/50' : 'border-cs-border'].join(' ')} data-upgrade-id={definition.id}>
      <button aria-expanded={expanded} className="flex w-full items-start gap-3 p-3 text-left sm:p-4" onClick={onExpand} type="button">
        <span className={['mt-0.5 grid h-9 w-9 shrink-0 place-items-center border', status.level > 0 ? 'border-cs-green/60 text-cs-green' : 'border-cs-border text-cs-muted'].join(' ')}>{status.level > 0 ? <BadgeCheck size={17} /> : <LockKeyhole size={16} />}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-cs-text">{definition.name}</span><span className="font-mono text-[10px] uppercase text-cs-muted">Lv {status.level}/{definition.maxLevel}</span></span>
          <span className="mt-1 block text-xs leading-5 text-cs-muted">{definition.description}</span>
          <span className="mt-2 block text-xs font-medium text-rarity-special">Next: {getCareerUpgradeNextEffect(definition, status.level)}</span>
        </span>
        {expanded ? <ChevronUp className="mt-1 shrink-0 text-cs-muted" size={16} /> : <ChevronDown className="mt-1 shrink-0 text-cs-muted" size={16} />}
      </button>
      {expanded ? (
        <div className="border-t border-cs-border p-3 sm:p-4">
          <div className="grid gap-2 sm:grid-cols-2"><Metric label="Current effect" value={getCareerUpgradeCurrentEffect(definition, status.level)} /><Metric label="Next effect" value={getCareerUpgradeNextEffect(definition, status.level)} /><Metric label="Gameplay consumer" value={definition.consumer} /><Metric label="Reset policy" value="Resets on Prestige" /></div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-cs-border bg-cs-surface p-3">
            <div className="min-w-0 text-xs leading-5 text-cs-muted">
              {lockedReasons.length > 0 ? <p>Requires: {lockedReasons.join(' · ')}</p> : <p>All unlock requirements met.</p>}
              {!status.isMaxLevel ? <p>Cost {formatCurrency(status.cost)}{status.creditUsed > 0 ? ` · ${formatCurrency(status.creditUsed)} transition credit · ${formatCurrency(status.cashCost)} cash` : ''}</p> : <p>Every available level is active.</p>}
            </div>
            <button className="min-h-10 shrink-0 border border-rarity-special px-4 text-sm font-semibold text-rarity-special hover:bg-rarity-special/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rarity-special disabled:border-cs-border disabled:text-cs-muted disabled:hover:bg-transparent" disabled={!canPurchase} onClick={() => dispatch({ type: 'PURCHASE_CAREER_UPGRADE', upgradeId: definition.id, now: Date.now() })} type="button">{status.isMaxLevel ? 'Maximum level' : canPurchase ? `Purchase · ${formatCurrency(status.cashCost)}` : 'Locked'}</button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

export function Career() {
  const { state } = useGame()
  const [specialization, setSpecialization] = useState<UpgradeSpecialization>('caseOpening')
  const [filter, setFilter] = useState<UpgradeFilter>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string>()
  const snapshot = getCareerSnapshot(state.career)
  const rankRecord = [...state.career.rankHistory].reverse().find((entry) => entry.rankId === snapshot.rank.id)
  const selectedSpecialization = specializationCards.find((entry) => entry.id === specialization) ?? specializationCards[0]
  const activeCapabilities = getActiveCareerUpgradeCapabilities(state.careerUpgrades, specialization)
  const prestigeEligibility = getPrestigeEligibilityV2(state)
  const availableUpgradeCount = CAREER_UPGRADE_DEFINITIONS.filter((definition) => {
    const status = getCareerUpgradeStatus(definition, { career: state.career, money: state.money, upgrades: state.careerUpgrades })
    return !status.isMaxLevel && status.levelMet && status.activityMet && status.prerequisitesMet && status.canAfford
  }).length

  const visibleDefinitions = useMemo(() => {
    const query = search.trim().toLowerCase()
    return CAREER_UPGRADE_DEFINITIONS
      .filter((definition) => definition.specialization === specialization)
      .filter((definition) => !query || `${definition.name} ${definition.description} ${definition.group}`.toLowerCase().includes(query))
      .filter((definition) => {
        const status = getCareerUpgradeStatus(definition, { career: state.career, money: state.money, upgrades: state.careerUpgrades })
        if (filter === 'available') return !status.isMaxLevel && status.levelMet && status.activityMet && status.prerequisitesMet
        if (filter === 'affordable') return !status.isMaxLevel && status.levelMet && status.activityMet && status.prerequisitesMet && status.canAfford
        if (filter === 'locked') return !status.levelMet || !status.activityMet || !status.prerequisitesMet
        if (filter === 'purchased') return status.level > 0
        if (filter === 'maxed') return status.isMaxLevel
        return true
      })
      .sort((left, right) => {
        const leftStatus = getCareerUpgradeStatus(left, { career: state.career, money: state.money, upgrades: state.careerUpgrades })
        const rightStatus = getCareerUpgradeStatus(right, { career: state.career, money: state.money, upgrades: state.careerUpgrades })
        const leftAvailable = !leftStatus.isMaxLevel && leftStatus.levelMet && leftStatus.activityMet && leftStatus.prerequisitesMet && leftStatus.canAfford ? 0 : 1
        const rightAvailable = !rightStatus.isMaxLevel && rightStatus.levelMet && rightStatus.activityMet && rightStatus.prerequisitesMet && rightStatus.canAfford ? 0 : 1
        return leftAvailable - rightAvailable || left.requiredLevel - right.requiredLevel || left.name.localeCompare(right.name)
      })
  }, [filter, search, specialization, state.career, state.careerUpgrades, state.money])

  const grouped = useMemo(() => {
    const groups = new Map<string, CareerUpgradeDefinition[]>()
    visibleDefinitions.forEach((definition) => groups.set(definition.group, [...(groups.get(definition.group) ?? []), definition]))
    return [...groups.entries()]
  }, [visibleDefinitions])

  return (
    <section className="w-full space-y-5">
      <header className="border border-cs-border bg-cs-surface p-4 sm:p-6 lg:p-7">
        <div className="flex flex-col gap-4 border-b border-cs-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="border-l-4 border-rarity-special pl-4"><p className="font-mono text-xs uppercase text-rarity-special">Trading career</p><h1 className="mt-1 text-3xl font-semibold text-cs-text sm:text-4xl">Career &amp; Upgrades</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-cs-muted">Ninety-five working upgrades across five independent paths. Research reveals information; it never changes official case odds, predicts drops, or guarantees profit.</p></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="Career level" testId="career-level" value={`${snapshot.level}`} /><Metric label="Rank" testId="career-rank" value={snapshot.rank.name} /><Metric label="Balance" value={formatCurrency(state.money)} /><Metric label="Transition credit" value={formatCurrency(state.careerUpgrades.migration.transitionCredit)} /></div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.45fr)]">
          <div className="border border-cs-border bg-cs-panel p-4" data-testid="career-xp"><div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[10px] uppercase text-cs-muted">Current-run XP</p><p className="mt-1 text-xl font-semibold text-cs-text">{snapshot.currentRunXp.toLocaleString()} current-run XP</p><p className="mt-1 text-xs text-cs-muted">Next level at {snapshot.nextLevelXp.toLocaleString()} XP</p></div><Trophy className="text-rarity-special" size={24} /></div><div className="mt-4"><ProgressBar label={snapshot.level >= 100 ? 'Career level complete' : `Progress to level ${snapshot.level + 1}`} value={snapshot.levelProgress} /></div></div>
          <div className="border border-cs-border bg-cs-panel p-4"><p className="font-mono text-[10px] uppercase text-cs-muted">Next rank</p><p className="mt-1 font-semibold text-cs-text">{snapshot.nextRank?.name ?? 'CS2 Trading Legend'}</p><p className="mt-2 text-xs leading-5 text-cs-muted">{snapshot.nextRank ? `Reach Career level ${snapshot.nextRank.minimumLevel}. Ranks are earned through XP, not forced waiting.` : `Highest career rank reached ${rankRecord ? `on ${new Date(rankRecord.earnedAt).toLocaleDateString()}` : ''}.`}</p></div>
        </div>
      </header>

      <section className="border border-cs-border bg-cs-surface p-4 sm:p-5" aria-labelledby="next-career-goals">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase text-rarity-special">What to do next</p>
            <h2 className="mt-1 text-xl font-semibold text-cs-text" id="next-career-goals">Career goals</h2>
          </div>
          <Link className="border border-cs-border px-3 py-2 text-xs font-semibold text-cs-muted hover:text-cs-text" to="/progress">View achievements &amp; stats</Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Metric label="Next level" value={snapshot.level >= 100 ? 'Level cap reached' : `${snapshot.xpForNextLevel.toLocaleString()} XP remaining`} />
          <Metric label="Available upgrades" value={availableUpgradeCount > 0 ? `${availableUpgradeCount} affordable now` : 'Build branch XP or cash'} />
          <Metric label="Next Prestige goal" value={prestigeEligibility.canPrestige ? `${prestigeEligibility.tier.name} is optional and ready` : prestigeEligibility.reasons[0] ?? 'Review Prestige paths'} />
        </div>
      </section>

      <section className="border border-cs-border bg-cs-surface p-4 sm:p-6" aria-labelledby="specializations-title">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-xs uppercase text-rarity-special">Choose a path</p><h2 className="mt-1 text-xl font-semibold text-cs-text" id="specializations-title">Specializations</h2></div><p className="text-xs text-cs-muted">{CAREER_UPGRADE_COUNTS.total} nodes · flexible cross-training</p></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5" role="tablist" aria-label="Career specializations">
          {specializationCards.map((entry) => { const Icon = entry.icon; const progress = getSpecializationUpgradeProgress(state.careerUpgrades, entry.id); const active = entry.id === specialization; return <button aria-selected={active} className={['min-w-0 border p-3 text-left', active ? 'border-rarity-special bg-rarity-special/10' : 'border-cs-border bg-cs-panel hover:border-cs-muted'].join(' ')} key={entry.id} onClick={() => { setSpecialization(entry.id); setExpandedId(undefined) }} role="tab" type="button"><span className="flex items-center gap-2"><Icon className={active ? 'text-rarity-special' : 'text-cs-muted'} size={18} /><span className="font-semibold text-cs-text">{entry.label}</span></span><span className="mt-2 block text-xs leading-5 text-cs-muted">{entry.description}</span><span className="mt-2 block font-mono text-[10px] uppercase text-cs-muted">{progress.purchased}/{progress.nodes} nodes · {progress.completedLevels}/{progress.maximumLevels} levels</span></button> })}
        </div>
      </section>

      <section className="border border-cs-border bg-cs-surface p-4 sm:p-6" aria-labelledby="upgrade-explorer-title">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="font-mono text-xs uppercase text-rarity-special">{selectedSpecialization.label}</p><h2 className="mt-1 text-2xl font-semibold text-cs-text" id="upgrade-explorer-title">Upgrade explorer</h2><p className="mt-1 max-w-2xl text-sm text-cs-muted">Open one upgrade to see its exact consumer, next effect, cost, prerequisites and Prestige policy.</p></div><label className="flex min-h-10 min-w-0 items-center gap-2 border border-cs-border bg-cs-panel px-3 lg:w-72"><Search className="shrink-0 text-cs-muted" size={16} /><span className="sr-only">Search upgrades</span><input className="min-w-0 flex-1 bg-transparent text-sm text-cs-text outline-none" onChange={(event) => setSearch(event.target.value)} placeholder="Search this branch" value={search} /></label></div>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Upgrade filters">{(['all', 'available', 'affordable', 'locked', 'purchased', 'maxed'] as UpgradeFilter[]).map((entry) => <button className={['min-h-9 border px-3 text-xs capitalize', filter === entry ? 'border-rarity-special bg-rarity-special/10 text-rarity-special' : 'border-cs-border text-cs-muted'].join(' ')} key={entry} onClick={() => setFilter(entry)} type="button">{entry}</button>)}</div>
        <aside className="mt-4 border border-cs-border bg-cs-panel p-3" aria-label={`${selectedSpecialization.label} active toolkit`}>
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-cs-text">Active specialization toolkit</p><span className="font-mono text-[10px] uppercase text-cs-muted">{activeCapabilities.length} active nodes</span></div>
          {activeCapabilities.length > 0 ? <ul className="mt-3 grid gap-2 md:grid-cols-2">{activeCapabilities.map((capability) => <li className="min-w-0 border border-cs-border bg-cs-surface px-3 py-2" key={capability.id}><p className="text-xs font-semibold text-cs-text">{capability.name} · Lv {capability.level}</p><p className="mt-1 text-xs text-rarity-special">{capability.effect}</p><p className="mt-1 text-[11px] leading-4 text-cs-muted">Active in: {capability.consumer}</p></li>)}</ul> : <p className="mt-2 text-xs leading-5 text-cs-muted">Purchase an upgrade in this branch to activate its research tool or mechanical consumer. Locked tools do not reveal data or apply hidden effects.</p>}
        </aside>
        {grouped.length > 0 ? <div className="mt-5 space-y-5">{grouped.map(([group, definitions]) => <section key={group}><h3 className="flex items-center gap-2 font-semibold text-cs-text"><ShieldCheck className="text-cs-green" size={17} />{group}</h3><div className="mt-2 grid gap-2 xl:grid-cols-2">{definitions.map((definition) => <UpgradeCard definition={definition} expanded={expandedId === definition.id} key={definition.id} onExpand={() => setExpandedId((current) => current === definition.id ? undefined : definition.id)} />)}</div></section>)}</div> : <div className="mt-5 border border-cs-border bg-cs-panel p-6 text-center text-sm text-cs-muted">No upgrades match this filter.</div>}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,.45fr)]">
        <section className="border border-cs-border bg-cs-surface p-4 sm:p-6" aria-labelledby="activity-title"><div className="flex items-center gap-2"><WalletCards className="text-cs-green" size={19} /><h2 className="font-semibold text-cs-text" id="activity-title">Career activity</h2></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{activityRows.map(([label, id]) => <Metric key={id} label={`${label} XP`} value={(state.career.specializations[id]?.currentRunXp ?? 0).toLocaleString()} />)}</div></section>
        <section className="border border-cs-border bg-cs-surface p-4 sm:p-6" aria-labelledby="milestones-title"><div className="flex items-center gap-2"><Info className="text-rarity-special" size={18} /><h2 className="font-semibold text-cs-text" id="milestones-title">Recent milestones</h2></div>{state.career.recentMilestones.length > 0 ? <ol className="mt-3 space-y-2">{state.career.recentMilestones.slice(0, 5).map((milestone) => <li className="border-l-2 border-cs-border pl-3" key={milestone.id}><p className="text-sm font-medium text-cs-text">{milestone.title}</p><p className="mt-1 text-xs leading-5 text-cs-muted">{milestone.description}</p></li>)}</ol> : <p className="mt-3 border border-cs-border bg-cs-panel p-3 text-sm text-cs-muted">Complete a paid opening, Work job, trade, contract, discovery, or Business operation to begin your log.</p>}</section>
      </div>

      {state.careerUpgrades.migration.note ? <aside className="border border-rarity-special/40 bg-rarity-special/5 px-4 py-3 text-xs leading-5 text-cs-muted"><span className="font-semibold text-rarity-special">Legacy transition:</span> {state.careerUpgrades.migration.note}</aside> : null}
      <section className="border border-cs-border bg-cs-surface p-4" aria-labelledby="rank-path-title"><h2 className="font-semibold text-cs-text" id="rank-path-title">Career rank path</h2><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">{CAREER_RANKS.map((rank) => { const reached = snapshot.level >= rank.minimumLevel; return <div className={['min-w-0 border p-3', reached ? 'border-rarity-special/50 bg-rarity-special/5' : 'border-cs-border bg-cs-panel'].join(' ')} key={rank.id}><p className={['font-mono text-[10px] uppercase', reached ? 'text-rarity-special' : 'text-cs-muted'].join(' ')}>Level {rank.minimumLevel}</p><p className="mt-1 text-sm font-semibold text-cs-text">{rank.name}</p></div> })}</div></section>
    </section>
  )
}
