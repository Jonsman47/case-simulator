import { ArrowRight, BriefcaseBusiness, Gift, LockKeyhole, PackageOpen, Sparkles } from 'lucide-react'
import { nanoid } from 'nanoid'
import type { MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AssetImage } from '../components/AssetImage'
import { achievementsById } from '../data/achievements'
import { getCareerSnapshot } from '../career/careerProgress'
import { useGame } from '../hooks/useGame'
import { getNotificationCountForPath } from '../notifications/notificationSelectors'
import { getFeatureProgress, getTradeUpEligibleProgress } from '../progression/featureUnlocks'
import { QUEST_DEFINITIONS, getQuestProgressState, getQuestStageStatus, isQuestUnlocked } from '../quests/questSystem'
import { getOpeningCreditQuote } from '../rewards/dailyRewards'
import { canOpenCaseFromSelection } from '../utils/caseSelection'
import { formatCurrency } from '../utils/format'

function rewardLabel(reward: { money?: number; openingCredits?: number; careerXp?: number }) {
  return [reward.money ? formatCurrency(reward.money) : '', reward.openingCredits ? `${reward.openingCredits} credit` : '', reward.careerXp ? `${reward.careerXp} XP` : ''].filter(Boolean).join(' · ') || 'Progress reward'
}

export function Main() {
  const navigate = useNavigate()
  const { availableCases, cloud, dispatch, state } = useGame()
  const career = getCareerSnapshot(state.career)
  const features = getFeatureProgress(state)
  const nextUnlock = features.find((feature) => !feature.unlocked)
  const openable = availableCases.filter((caseDef) => canOpenCaseFromSelection(caseDef, state)).sort((a, b) => a.cost - b.cost)
  const lastCaseId = state.ui.featureUnlocks?.selectedCaseId
  const selectedCase = openable.find((caseDef) => caseDef.id === lastCaseId) ?? openable[0]
  const quote = selectedCase ? getOpeningCreditQuote(selectedCase.cost, state.dailyRewards.openingCredits) : undefined
  const canAfford = Boolean(quote && quote.cashCost <= state.money)
  const goals = state.quests.trackedQuestIds
    .map((id) => QUEST_DEFINITIONS.find((quest) => quest.id === id))
    .filter((quest) => quest && isQuestUnlocked(state, quest) && !getQuestProgressState(state, quest).completedAt)
    .slice(0, 3)
  const readyQuest = goals.find((quest) => getQuestStageStatus(state, quest!).complete && !quest!.stages[getQuestProgressState(state, quest!).stageIndex]?.requirements.some((requirement) => requirement.type === 'deliver_item'))
  const questRewardCount = getNotificationCountForPath(state, '/quests')
  const achievementRewardCount = getNotificationCountForPath(state, '/progress')
  const rewardCount = questRewardCount + achievementRewardCount + getNotificationCountForPath(state, '/rewards')
  const activity = [
    ...state.recentDrops.slice(0, 4).map((item) => ({ id: `drop:${item.instanceId}`, time: item.discoveredAt, title: `${item.weapon} | ${item.finish}`, detail: `${item.rarity} · ${item.wear}`, image: item.image, path: '/inventory' })),
    ...state.ui.tradeUpHistory.slice(0, 3).map((entry) => ({ id: `trade:${entry.id}`, time: entry.createdAt, title: 'Trade-Up completed', detail: `${entry.outputItem.weapon} | ${entry.outputItem.finish}`, image: entry.outputItem.image, path: '/trade-ups' })),
    ...QUEST_DEFINITIONS.flatMap((quest) => { const completedAt = getQuestProgressState(state, quest).completedAt; return completedAt ? [{ id: `quest:${quest.id}`, time: completedAt, title: 'Quest completed', detail: quest.name, image: '', path: '/quests' }] : [] }),
    ...state.career.rankHistory.filter((entry) => entry.level > 1 && entry.earnedAt > state.career.runStartedAt).slice(-3).map((entry) => ({ id: `rank:${entry.rankId}:${entry.earnedAt}`, time: entry.earnedAt, title: 'Career promotion', detail: `Reached ${entry.rankId} at level ${entry.level}`, image: '', path: '/career' })),
    ...state.achievements.slice(-3).map((entry) => ({ id: `achievement:${entry.id}:${entry.unlockedAt}`, time: entry.unlockedAt, title: 'Achievement unlocked', detail: achievementsById.get(entry.id)?.name ?? entry.id, image: '', path: '/progress?tab=achievements' })),
  ].sort((a, b) => b.time - a.time).slice(0, 4)
  const quickActions = [
    { label: 'Cases', path: '/cases' }, { label: 'Inventory', path: '/inventory' }, { label: 'Work', path: '/work' },
    { label: 'Quests', path: '/quests', feature: 'quests' }, { label: 'Collection Book', path: '/collection-book', feature: 'collection-book' },
    { label: 'CSWEAR', path: '/cswear', feature: 'cswear' }, { label: 'Trade-Ups', path: '/trade-ups', feature: 'trade-ups' }, { label: 'Business', path: '/business', feature: 'business' },
  ]
  const recommendation = rewardCount > 0
    ? { title: 'Rewards are ready', detail: 'Claim your earned rewards.', path: questRewardCount ? '/quests' : achievementRewardCount ? '/progress?tab=achievements' : '/rewards', action: 'Claim rewards' }
    : !canAfford
      ? { title: 'Need cash for another case?', detail: 'Work minigames earn money without selling your skins.', path: '/work', action: 'Go to Work' }
      : features.find((feature) => feature.id === 'trade-ups')?.unlocked && getTradeUpEligibleProgress(state) >= 10
        ? { title: 'A contract is available', detail: 'Review compatible inputs and outcomes before combining skins.', path: '/trade-ups', action: 'Review Trade-Ups' }
        : undefined

  function continueOpening() {
    if (!selectedCase || !canAfford) return
    dispatch({ type: 'UPDATE_FEATURE_UNLOCK_STATE', featureUnlocks: { selectedCaseId: selectedCase.id } })
    navigate(`/cases?case=${encodeURIComponent(selectedCase.id)}`)
  }

  function claimReadyQuest(event: MouseEvent<HTMLButtonElement>) {
    if (!readyQuest) return
    dispatch({ type: 'CLAIM_QUEST_STAGE', questId: readyQuest.id, requestId: `quest:${readyQuest.id}:${nanoid()}`, now: Math.round(performance.timeOrigin + event.timeStamp) })
  }

  return <section className="home-hub w-full min-w-0 space-y-3" aria-label="Home gameplay hub">
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border border-cs-border bg-cs-surface px-4 py-3">
      <div className="min-w-0"><p className="font-mono text-[10px] uppercase tracking-widest text-rarity-special">Your next move</p><h2 className="text-lg font-semibold text-cs-text">Welcome{cloud.profile?.displayName ? `, ${cloud.profile.displayName}` : ''}</h2><p className="text-xs text-cs-muted">{career.rank.name} · Level {career.level} · Prestige {state.prestigeLevel}</p></div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs"><span className="border border-cs-border bg-cs-panel px-2 py-1.5">XP {career.xpIntoLevel.toLocaleString()} / {(career.nextLevelXp - career.currentLevelStartXp).toLocaleString()}</span>{rewardCount > 0 && recommendation ? <Link className="border border-cs-green px-2 py-1.5 text-cs-green" to={recommendation.path}>{rewardCount} rewards ready</Link> : null}</div>
    </div>
    <div className={`grid min-w-0 gap-3 ${recommendation ? 'lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,1fr)]' : ''}`}>
      <section className="min-w-0 border border-rarity-special/60 bg-cs-surface p-3 sm:p-4" data-onboarding-target="home-continue">
        <div className="flex items-center gap-2 text-rarity-special"><PackageOpen size={18} /><h3 className="text-base font-semibold">Continue Opening</h3></div>
        {selectedCase ? <div className="mt-2 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center"><div className="grid h-28 w-full shrink-0 place-items-center border border-cs-border bg-cs-panel max-[360px]:h-16 sm:w-32"><AssetImage alt={selectedCase.name} className="h-24 w-24 object-contain max-[360px]:h-14 max-[360px]:w-14" src={selectedCase.image} /></div><div className="min-w-0 flex-1"><p className="font-semibold text-cs-text">{selectedCase.name}</p><p className="mt-1 text-xs text-cs-muted">Opening price {formatCurrency(selectedCase.cost)}{quote?.creditUsed ? ` · ${formatCurrency(quote.creditUsed)} opening credit applied` : ''}</p><p className="mt-1 text-xs text-cs-muted">Cash cost {formatCurrency(quote?.cashCost ?? selectedCase.cost)} · Available {formatCurrency(state.money)}</p><div className="mt-3 flex flex-wrap gap-2"><button className="inline-flex min-h-11 items-center gap-2 border border-rarity-special bg-rarity-special/15 px-4 text-sm font-semibold text-rarity-special disabled:opacity-50" disabled={!canAfford} onClick={continueOpening} type="button">{state.statistics.casesOpened ? 'Continue Opening' : 'Choose your first case'} <ArrowRight size={16} /></button><Link className="inline-flex min-h-11 items-center border border-cs-border px-3 text-xs text-cs-muted" to="/cases">All cases</Link></div>{!canAfford ? <p className="mt-2 text-xs text-cs-amber">Earn cash in Work to afford this opening.</p> : null}</div></div> : <p className="mt-3 text-sm text-cs-muted">No case is currently available. Explore Cases for the next unlock.</p>}
      </section>
      {recommendation ? <section className="min-w-0 border border-cs-border bg-cs-surface p-3 sm:p-4"><div className="flex items-center gap-2 text-cs-green"><Sparkles size={18} /><h3 className="font-semibold">Recommended next</h3></div><p className="mt-3 font-semibold">{recommendation.title}</p><p className="mt-1 text-sm text-cs-muted">{recommendation.detail}</p><Link className="mt-3 inline-flex min-h-10 items-center gap-2 border border-cs-green px-3 text-sm font-semibold text-cs-green" to={recommendation.path}>{recommendation.action} <ArrowRight size={15} /></Link></section> : null}
    </div>
    <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
      <section className="min-w-0 border border-cs-border bg-cs-surface p-3" data-onboarding-target="home-goals"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Current goals</h3><Link className="text-xs text-cs-muted hover:text-cs-text" to="/quests">See all</Link></div>{readyQuest ? <button className="mt-2 min-h-9 border border-cs-green px-3 text-xs font-semibold text-cs-green" onClick={claimReadyQuest} type="button">Claim {readyQuest.name} reward</button> : null}<div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">{goals.length ? goals.map((quest) => { const progress = getQuestProgressState(state, quest!); const stage = quest!.stages[progress.stageIndex]; const status = getQuestStageStatus(state, quest!); const total = status.requirements.reduce((sum, part) => sum + part.target, 0); const current = status.requirements.reduce((sum, part) => sum + Math.min(part.current, part.target), 0); return <Link className="min-w-0 border border-cs-border bg-cs-panel p-2 hover:border-rarity-special" key={quest!.id} to={`/quests?quest=${quest!.id}`}><p className="text-sm font-semibold">{quest!.name}</p><p className="mt-1 text-xs text-cs-muted">{stage?.description}</p><div className="mt-2 h-1.5 bg-cs-border"><div className="h-full bg-rarity-special" style={{ width: `${total ? current / total * 100 : 100}%` }} /></div><p className="mt-1 text-xs text-cs-muted">{current}/{total} · {rewardLabel(stage?.reward ?? {})}</p><span className="mt-2 inline-block text-xs text-rarity-special">{status.complete ? 'Claim quest →' : 'View goal →'}</span></Link> }) : <Link className="col-span-full border border-cs-border bg-cs-panel p-3 text-sm text-cs-muted" to={features.find((feature) => feature.id === 'quests')?.unlocked ? '/quests' : '/cases'}>{state.statistics.casesOpened ? 'Track a quest to see your next goal here.' : 'Open your first case to unlock quests and start collecting.'}</Link>}</div></section>
      <section className="min-w-0 border border-cs-border bg-cs-surface p-3" data-onboarding-target="home-unlock"><h3 className="font-semibold">Next unlock</h3>{nextUnlock ? <><p className="mt-2 text-sm font-semibold text-rarity-special">{nextUnlock.name}</p><p className="mt-1 text-xs text-cs-muted">{nextUnlock.description}</p><div className="mt-2 h-1.5 bg-cs-border"><div className="h-full bg-rarity-special" style={{ width: `${nextUnlock.current / nextUnlock.target * 100}%` }} /></div><p className="mt-1 text-xs text-cs-muted">{nextUnlock.current}/{nextUnlock.target}</p></> : <p className="mt-2 text-sm text-cs-muted">Every feature is available. Keep pursuing Career goals.</p>}</section>
    </div>
    <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
      <section className="min-w-0 border border-cs-border bg-cs-surface p-3"><h3 className="font-semibold">Quick actions</h3><div className="mt-2 flex flex-wrap gap-2">{quickActions.map((action) => { const feature = features.find((entry) => entry.id === action.feature); return feature && !feature.unlocked ? <span className="inline-flex min-h-9 items-center gap-1 border border-cs-border px-2 text-xs text-cs-muted" key={action.path} title={feature.description}><LockKeyhole size={13} /> {action.label} · {feature.current}/{feature.target}</span> : <Link className="inline-flex min-h-9 items-center border border-cs-border px-3 text-xs text-cs-text hover:border-rarity-special" key={action.path} to={action.path}>{action.label}</Link> })}</div></section>
      <section className="min-w-0 border border-cs-border bg-cs-surface p-3"><div className="flex items-center gap-2"><BriefcaseBusiness size={17} className="text-rarity-special" /><h3 className="font-semibold">Recent activity</h3></div>{activity.length ? <div className="mt-2 space-y-1">{activity.map((entry) => <Link className="flex min-w-0 items-center gap-2 border border-cs-border bg-cs-panel p-1.5 text-xs" key={entry.id} to={entry.path}>{entry.image ? <AssetImage alt="" className="h-9 w-9 shrink-0 object-contain" src={entry.image} /> : <Gift size={18} className="shrink-0 text-rarity-special" />}<span className="min-w-0"><span className="block truncate font-semibold">{entry.title}</span><span className="block truncate text-cs-muted">{entry.detail}</span></span></Link>)}</div> : <p className="mt-2 text-sm text-cs-muted">Your first opening, quest, or trade-up will appear here.</p>}</section>
    </div>
  </section>
}
