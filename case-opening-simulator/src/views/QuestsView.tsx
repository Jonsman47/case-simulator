import { Award, BookOpenCheck, Check, ChevronRight, Clock3, Compass, Gift, PackageOpen, ScrollText, Star } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AssetImage } from '../components/AssetImage'
import { GlossaryTerm } from '../components/GlossaryTerm'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'
import {
  QUEST_DEFINITIONS,
  getEligibleDeliveryItems,
  getQuestProgressState,
  getQuestStageStatus,
  isQuestUnlocked,
  type QuestDefinition,
} from '../quests/questSystem'

type QuestTab = 'current' | 'hunts' | 'completed'

function rewardLabel(reward: QuestDefinition['stages'][number]['reward']) {
  return [reward.careerXp ? `${reward.careerXp} Career XP` : '', reward.openingCredits ? `${formatCurrency(reward.openingCredits)} toward opening cases` : '', reward.money ? `${formatCurrency(reward.money)} cash` : '', reward.title ?? reward.decoration ?? ''].filter(Boolean).join(' · ')
}

function QuestCard({ quest }: { quest: QuestDefinition }) {
  const { dispatch, state } = useGame()
  const progress = getQuestProgressState(state, quest)
  const stage = quest.stages[progress.stageIndex]
  const status = getQuestStageStatus(state, quest)
  const tracked = state.quests.trackedQuestIds.includes(quest.id)
  const eligibleItems = getEligibleDeliveryItems(state, quest)
  const [showItems, setShowItems] = useState(false)
  const isComplete = Boolean(progress.completedAt)

  return <article className="min-w-0 border border-cs-border bg-cs-panel p-3" data-testid={`quest-${quest.id}`}>
    <div className="flex min-w-0 items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] uppercase text-rarity-classified">{quest.category}</span>{quest.optional ? <span className="text-[10px] uppercase text-cs-muted">Optional</span> : null}</div>
        <h3 className="mt-1 text-lg font-semibold text-cs-text">{quest.name}</h3>
        <p className="mt-1 text-sm text-cs-muted">{quest.description}</p>
      </div>
      <button aria-label={tracked ? `Untrack ${quest.name}` : `Track ${quest.name}`} className={`border p-2 ${tracked ? 'border-rarity-special text-rarity-special' : 'border-cs-border text-cs-muted hover:text-cs-text'}`} onClick={() => dispatch({ type: 'TRACK_QUEST', questId: quest.id })} type="button"><Star aria-hidden="true" fill={tracked ? 'currentColor' : 'none'} size={16} /></button>
    </div>
    {isComplete ? <p className="mt-4 flex items-center gap-2 border border-cs-green/40 bg-cs-green/10 px-3 py-2 text-sm text-cs-green"><Check size={16} /> Quest complete</p> : stage ? <>
      <div className="mt-4 border-l-2 border-rarity-classified pl-3">
        <p className="text-sm font-semibold text-cs-text">Stage {progress.stageIndex + 1}/{quest.stages.length}: {stage.title}</p>
        <p className="mt-1 text-xs leading-5 text-cs-muted">{stage.description}</p>
      </div>
      <div className="mt-3 space-y-2">{status.requirements.map((requirement) => <div key={requirement.label}>
        <div className="flex justify-between gap-3 text-xs text-cs-muted"><span>{requirement.label}</span><span>{Math.min(requirement.current, requirement.target)}/{requirement.target}</span></div>
        <div className="mt-1 h-1.5 overflow-hidden bg-cs-surface"><div className="h-full bg-rarity-classified" style={{ width: `${Math.min(100, requirement.current / requirement.target * 100)}%` }} /></div>
      </div>)}</div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-cs-border pt-3">
        <p className="flex min-w-0 items-center gap-2 text-xs text-cs-muted"><Gift aria-hidden="true" size={15} /><span>{rewardLabel(stage.reward)}</span></p>
        {stage.requirements.some((requirement) => requirement.type === 'deliver_item') && !progress.deliveredStageIds.includes(stage.id) ? <button className="min-h-10 border border-cs-amber px-3 text-sm font-semibold text-cs-amber hover:bg-cs-amber/10" disabled={!eligibleItems.length} onClick={() => setShowItems((value) => !value)} type="button">{eligibleItems.length ? `Choose item (${eligibleItems.length})` : 'No eligible item'}</button> : <button className="min-h-10 border border-cs-green px-3 text-sm font-semibold text-cs-green hover:bg-cs-green/10 disabled:cursor-not-allowed disabled:border-cs-border disabled:text-cs-muted" disabled={!status.complete} onClick={() => dispatch({ type: 'CLAIM_QUEST_STAGE', questId: quest.id, requestId: `quest:${quest.id}:${stage.id}:${nanoid()}`, now: Date.now() })} type="button">Claim stage</button>}
      </div>
      {showItems ? <div className="mt-3 max-h-52 space-y-2 overflow-y-auto border border-cs-border bg-cs-surface p-2">{eligibleItems.map((item) => <button className="flex w-full items-center gap-3 border border-cs-border p-2 text-left hover:border-cs-amber" key={item.instanceId} onClick={() => { dispatch({ type: 'DELIVER_QUEST_ITEM', questId: quest.id, itemId: item.instanceId, requestId: `delivery:${quest.id}:${item.instanceId}:${nanoid()}`, now: Date.now() }); setShowItems(false) }} type="button"><AssetImage alt="" className="h-10 w-14 object-contain" src={item.image} /><span className="min-w-0 flex-1 truncate text-sm text-cs-text">{item.weapon} | {item.finish}</span><span className="text-xs text-cs-muted">{formatCurrency(item.marketValue)}</span></button>)}</div> : null}
      {quest.relatedCaseIds?.length ? <Link className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-rarity-special hover:underline" to={`/cases?case=${encodeURIComponent(quest.relatedCaseIds[0])}`}>Browse related case <ChevronRight size={13} /></Link> : null}
    </> : null}
  </article>
}

export function QuestsView() {
  const { dispatch, state } = useGame()
  const [params, setParams] = useSearchParams()
  const [limit, setLimit] = useState(8)
  const requestedTab = params.get('tab')
  const tab: QuestTab = requestedTab === 'hunts' || requestedTab === 'completed' ? requestedTab : 'current'
  useEffect(() => {
    if (tab !== 'completed') return
    const readIds = state.dropJournal.entries.map((entry) => entry.id).slice(-160)
    if (readIds.some((id) => !state.ui.notifications.readDropJournalEntryIds.includes(id))) {
      dispatch({ type: 'UPDATE_NOTIFICATION_STATE', notifications: { readDropJournalEntryIds: readIds } })
    }
  }, [dispatch, state, tab])
  const available = useMemo(() => QUEST_DEFINITIONS.filter((quest) => isQuestUnlocked(state, quest)), [state])
  const quests = useMemo(() => available.filter((quest) => {
    const completed = Boolean(getQuestProgressState(state, quest).completedAt)
    if (tab === 'completed') return completed
    if (completed) return false
    if (tab === 'hunts') return quest.category === 'collection'
    return tab === 'current' && quest.category !== 'collection'
  }).sort((left, right) => {
    const leftProgress = getQuestProgressState(state, left)
    const rightProgress = getQuestProgressState(state, right)
    const leftClaimable = getQuestStageStatus(state, left).complete ? 0 : 1
    const rightClaimable = getQuestStageStatus(state, right).complete ? 0 : 1
    const leftTracked = state.quests.trackedQuestIds.includes(left.id) ? 0 : 1
    const rightTracked = state.quests.trackedQuestIds.includes(right.id) ? 0 : 1
    return leftClaimable - rightClaimable || leftTracked - rightTracked || rightProgress.stageIndex - leftProgress.stageIndex || left.name.localeCompare(right.name)
  }), [available, state, tab])
  const tabs: { id: QuestTab; label: string; icon: typeof Compass }[] = [
    { id: 'current', label: 'Current Quests', icon: Compass },
    { id: 'hunts', label: 'Collection Hunts', icon: BookOpenCheck },
    { id: 'completed', label: 'Completed & Journal', icon: Award },
  ]

  return <section className="w-full border border-cs-border bg-cs-surface p-3 sm:p-5">
    <header className="flex flex-col gap-3 border-l-4 border-rarity-classified pl-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="font-mono text-xs uppercase text-rarity-classified">Goals and rewards</p><h1 className="mt-1 text-2xl font-semibold text-cs-text sm:text-3xl">Quests & Collection Hunts</h1><p className="mt-2 max-w-3xl text-sm text-cs-muted">Open cases, discover skins, and complete clear goals. Discoveries stay recorded after a sale; ownership goals need an item in Inventory, and delivery goals consume the chosen item.</p><p className="mt-2 flex flex-wrap gap-3 text-xs text-cs-muted"><GlossaryTerm term="discovery" /><GlossaryTerm term="openingFunds" /></p></div>
      <Link className="inline-flex min-h-10 items-center gap-2 border border-cs-border px-3 text-sm text-cs-muted hover:text-cs-text" to="/rewards"><Clock3 size={16} /> Daily objectives</Link>
    </header>
    <nav className="sticky top-2 z-20 mt-3 grid gap-2 border border-cs-border bg-cs-surface/95 p-1 shadow-xl backdrop-blur sm:grid-cols-3" aria-label="Quest sections">{tabs.map(({ id, label, icon: Icon }) => <button className={`flex min-h-10 items-center justify-center gap-2 border px-3 text-sm font-semibold ${tab === id ? 'border-rarity-classified bg-rarity-classified/10 text-rarity-classified' : 'border-cs-border text-cs-muted hover:text-cs-text'}`} key={id} onClick={() => { setParams({ tab: id }); setLimit(8) }} type="button"><Icon size={16} /> {label}</button>)}</nav>

    <>
      {tab === 'completed' ? <div className="mt-5 border border-cs-border bg-cs-panel p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-mono text-xs uppercase text-rarity-special">Permanent Drop Journal</p><h2 className="mt-1 text-xl font-semibold text-cs-text">{state.dropJournal.entries.length} notable openings</h2></div><div className="text-right text-xs text-cs-muted"><p>Best {formatCurrency(state.dropJournal.highestValue)}</p><p>{state.dropJournal.specialCount} Gold · {state.dropJournal.covertCount} Covert</p></div></div>{state.dropJournal.entries.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{[...state.dropJournal.entries].reverse().slice(0, 12).map((entry) => <div className="flex min-w-0 items-center gap-3 border border-cs-border bg-cs-surface p-2" key={entry.id}><AssetImage alt="" className="h-12 w-16 object-contain" src={entry.image} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-cs-text">{entry.weapon} | {entry.finish}</p><p className="truncate text-xs text-cs-muted">Pattern #{entry.paintSeed ?? '—'} · {entry.wear}</p><p className="text-xs text-rarity-special">{formatCurrency(entry.valueAtDiscovery)}{entry.isPersonalBest ? ' · Personal best' : ''}</p></div></div>)}</div> : <p className="mt-4 flex items-center gap-2 text-sm text-cs-muted"><ScrollText size={16} /> Tracking starts with v40; old openings are not fabricated.</p>}</div> : null}
      <div className="content-card-grid mt-3 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">{quests.slice(0, limit).map((quest) => <QuestCard key={quest.id} quest={quest} />)}</div>
      {!quests.length ? <div className="mt-5 border border-cs-border bg-cs-panel p-8 text-center"><PackageOpen className="mx-auto text-cs-muted" size={28} /><p className="mt-3 text-cs-text">No quests in this section yet.</p></div> : null}
      {quests.length > limit ? <button className="mx-auto mt-4 block min-h-11 border border-cs-border px-5 text-sm text-cs-muted hover:text-cs-text" onClick={() => setLimit((value) => value + 8)} type="button">Show more quests</button> : null}
    </>
  </section>
}
