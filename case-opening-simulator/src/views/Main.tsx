import { ArrowRight, BookOpen, BriefcaseBusiness, Boxes, ClipboardList, Gift, LockKeyhole, PackageOpen, ShoppingBag, Sparkles, Trophy, Wrench, type LucideIcon } from 'lucide-react'
import { nanoid } from 'nanoid'
import type { MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AssetImage } from '../components/AssetImage'
import { GlossaryText } from '../components/GlossaryText'
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
  return [reward.money ? formatCurrency(reward.money) : '', reward.openingCredits ? `${formatCurrency(reward.openingCredits)} toward opening cases` : '', reward.careerXp ? `${reward.careerXp} XP` : ''].filter(Boolean).join(' · ') || 'Progress reward'
}

export function Main() {
  const navigate = useNavigate()
  const { availableCases, cloud, dispatch, state } = useGame()
  const career = getCareerSnapshot(state.career)
  const features = getFeatureProgress(state)
  const nextUnlock = features.find((feature) => !feature.unlocked)
  const questsUnlocked = features.find((feature) => feature.id === 'quests')?.unlocked ?? false
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
  const quickActions: Array<{ label: string; path: string; feature?: string; icon: LucideIcon; hint: string }> = [
    { label: 'Cases', path: '/cases', icon: PackageOpen, hint: 'Open a case' },
    { label: 'Inventory', path: '/inventory', icon: Boxes, hint: 'Inspect skins' },
    { label: 'Work', path: '/work', icon: Wrench, hint: 'Earn cash' },
    { label: 'Quests', path: '/quests', feature: 'quests', icon: ClipboardList, hint: 'Follow goals' },
    { label: 'Collection Book', path: '/collection-book', feature: 'collection-book', icon: BookOpen, hint: 'Track discoveries' },
    { label: 'CSWEAR', path: '/cswear', feature: 'cswear', icon: ShoppingBag, hint: 'Trade skins' },
    { label: 'Trade-Ups', path: '/trade-ups', feature: 'trade-ups', icon: Trophy, hint: 'Build a contract' },
    { label: 'Business', path: '/business', feature: 'business', icon: BriefcaseBusiness, hint: 'Run operations' },
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
    <header className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-cs-border pb-3">
      <div className="min-w-0 flex-1"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-rarity-special">Player hub</p><h2 className="text-xl font-bold text-cs-text">Welcome{cloud.profile?.displayName ? `, ${cloud.profile.displayName}` : ''}</h2></div>
      <div className="min-w-48 flex-1 sm:max-w-xs"><div className="flex justify-between text-xs"><span>{career.rank.name} · Lv {career.level}</span><span className="text-cs-muted">{career.xpIntoLevel.toLocaleString()} / {(career.nextLevelXp - career.currentLevelStartXp).toLocaleString()} XP</span></div><div className="mt-1 h-1.5 bg-cs-panel"><div className="h-full bg-rarity-special transition-[width] motion-reduce:transition-none" style={{ width: `${Math.min(100, career.xpIntoLevel / Math.max(1, career.nextLevelXp - career.currentLevelStartXp) * 100)}%` }} /></div></div>
      <p className="font-mono text-xs text-cs-muted">Prestige {state.prestigeLevel}</p>
      {rewardCount > 0 ? <Link className="inline-flex min-h-9 items-center gap-1 border border-cs-green px-3 text-xs font-semibold text-cs-green" to={questRewardCount ? '/quests' : achievementRewardCount ? '/progress?tab=achievements' : '/rewards'}><Gift size={14} /> {rewardCount} rewards ready</Link> : null}
    </header>

    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,.7fr)]">
      <section className="relative min-w-0 overflow-hidden border border-rarity-special/60 bg-cs-surface p-4 sm:p-5" data-onboarding-target="home-continue">
        <div className="absolute inset-y-0 left-0 w-1 bg-rarity-special" aria-hidden="true" />
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-rarity-special"><PackageOpen size={16} /><span>Back to the action</span></div>
        <h3 className="mt-1 text-xl font-bold text-cs-text">Continue Opening</h3>
        {selectedCase ? <div className="mt-3 grid min-w-0 gap-4 sm:grid-cols-[minmax(9rem,14rem)_minmax(0,1fr)] sm:items-center">
          <div className="relative grid min-h-44 place-items-center border border-cs-border bg-cs-panel p-2"><AssetImage alt={selectedCase.name} className="h-40 w-full object-contain drop-shadow-[0_10px_12px_rgba(0,0,0,.55)]" src={selectedCase.image} /><span className="absolute bottom-2 left-2 bg-cs-surface/90 px-2 py-1 font-mono text-[10px] uppercase text-cs-muted">Selected case</span></div>
          <div className="min-w-0"><p className="text-lg font-semibold text-cs-text">{selectedCase.name}</p><p className="mt-1 text-xs text-cs-muted">The next opening uses the real case and key price.</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-y border-cs-border py-2 text-xs"><span>Case cost <strong className="block text-base text-cs-text">{formatCurrency(selectedCase.cost)}</strong></span>{quote?.creditUsed ? <span>Opening Funds <strong className="block text-base text-rarity-special">−{formatCurrency(quote.creditUsed)}</strong></span> : null}<span>Cash used <strong className="block text-base text-cs-green">{formatCurrency(quote?.cashCost ?? selectedCase.cost)}</strong></span></div>
            <p className="mt-2 text-xs text-cs-muted">Wallet {formatCurrency(state.money)} · <GlossaryText parts={[{ term: 'openingFunds', label: 'Case Opening Funds' }]} /> {formatCurrency(state.dailyRewards.openingCredits)}</p>
            <div className="mt-3 flex flex-wrap gap-2"><button className="inline-flex min-h-11 items-center gap-2 border border-rarity-special bg-rarity-special px-4 text-sm font-bold text-cs-bg transition-transform hover:-translate-y-0.5 motion-reduce:transform-none disabled:opacity-50" disabled={!canAfford} onClick={continueOpening} type="button">{state.statistics.casesOpened ? 'Continue Opening' : 'Choose your first case'} <ArrowRight size={16} /></button><Link className="inline-flex min-h-11 items-center border border-cs-border px-3 text-xs text-cs-muted hover:text-cs-text" to="/cases">Browse cases</Link></div>
            {!canAfford ? <Link className="mt-2 inline-block text-xs font-semibold text-cs-amber underline" to="/work">Earn cash in Work to afford this case</Link> : null}
          </div>
        </div> : <Link className="mt-4 inline-flex min-h-11 items-center gap-2 border border-rarity-special px-4 text-sm text-rarity-special" to="/cases">Explore Cases <ArrowRight size={16} /></Link>}
      </section>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <section className="min-w-0 border border-cs-border bg-cs-panel p-3" data-onboarding-target="home-unlock"><p className="font-mono text-[10px] uppercase tracking-widest text-rarity-special">Progress path</p><h3 className="mt-1 font-semibold">Next unlock</h3>{nextUnlock ? <><p className="mt-3 text-sm font-semibold text-cs-text">{nextUnlock.name}</p><p className="mt-1 text-xs text-cs-muted">{nextUnlock.description}</p><div className="mt-3 h-1.5 bg-cs-surface"><div className="h-full bg-rarity-special" style={{ width: `${Math.min(100, nextUnlock.current / nextUnlock.target * 100)}%` }} /></div><p className="mt-1 font-mono text-xs text-rarity-special">{nextUnlock.current}/{nextUnlock.target}</p></> : <p className="mt-2 text-sm text-cs-muted">Every feature is available. Keep pursuing Career goals.</p>}</section>
        {recommendation ? <section className="min-w-0 border border-cs-green/50 bg-cs-panel p-3"><div className="flex items-center gap-2 text-cs-green"><Sparkles size={16} /><h3 className="font-semibold">Recommended next</h3></div><p className="mt-2 text-sm font-semibold">{recommendation.title}</p><p className="mt-1 text-xs text-cs-muted">{recommendation.detail}</p><Link className="mt-3 inline-flex min-h-9 items-center gap-1 border border-cs-green px-3 text-xs font-semibold text-cs-green" to={recommendation.path}>{recommendation.action} <ArrowRight size={13} /></Link></section> : null}
      </div>
    </div>

    <section className="min-w-0 border border-cs-border bg-cs-surface p-3 sm:p-4" data-onboarding-target="home-goals"><div className="flex items-center justify-between gap-2"><div><p className="font-mono text-[10px] uppercase tracking-widest text-rarity-classified">Active objectives</p><h3 className="font-semibold">Current goals</h3></div>{questsUnlocked ? <Link className="text-xs text-cs-muted hover:text-cs-text" to="/quests">See all →</Link> : null}</div>{readyQuest && questsUnlocked ? <button className="mt-2 min-h-9 border border-cs-green px-3 text-xs font-semibold text-cs-green" onClick={claimReadyQuest} type="button">Claim {readyQuest.name} reward</button> : null}<div className="mt-3 flex min-w-0 flex-wrap gap-2">{goals.length ? goals.map((quest) => { const progress = getQuestProgressState(state, quest!); const stage = quest!.stages[progress.stageIndex]; const status = getQuestStageStatus(state, quest!); const total = status.requirements.reduce((sum, part) => sum + part.target, 0); const current = status.requirements.reduce((sum, part) => sum + Math.min(part.current, part.target), 0); return <Link className="w-full min-w-0 border-l-2 border-rarity-classified bg-cs-panel p-3 transition-colors hover:bg-cs-panelMuted md:max-w-[25rem]" key={quest!.id} to={questsUnlocked ? `/quests?quest=${quest!.id}` : '/cases'}><p className="text-sm font-semibold">{quest!.name}</p><p className="mt-1 line-clamp-2 text-xs text-cs-muted">{stage?.description}</p><div className="mt-2 h-1 bg-cs-surface"><div className="h-full bg-rarity-classified" style={{ width: `${total ? current / total * 100 : 100}%` }} /></div><p className="mt-1 text-xs text-cs-muted">{current}/{total} · {rewardLabel(stage?.reward ?? {})}</p><span className="mt-2 inline-block text-xs font-semibold text-rarity-classified">{questsUnlocked ? status.complete ? 'Claim quest →' : 'View goal →' : 'Open a case →'}</span></Link> }) : <Link className="w-full border-l-2 border-rarity-classified bg-cs-panel p-3 text-sm text-cs-muted md:max-w-[25rem]" to={questsUnlocked ? '/quests' : '/cases'}>{state.statistics.casesOpened ? 'Track a quest to see your next goal here.' : 'Open your first case to unlock quests and start collecting.'}</Link>}</div></section>

    <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(19rem,.8fr)]">
      <section className="min-w-0 border border-cs-border bg-cs-surface p-3 sm:p-4"><h3 className="font-semibold">Quick actions</h3><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{quickActions.map((action) => { const feature = features.find((entry) => entry.id === action.feature); const Icon = action.icon; const tile = <><Icon size={20} className="text-rarity-special" /><span className="mt-1 text-sm font-semibold">{action.label}</span><span className="text-[11px] text-cs-muted">{feature && !feature.unlocked ? `${feature.current}/${feature.target} to unlock` : action.hint}</span></>; return feature && !feature.unlocked ? <span className="flex min-h-24 min-w-0 flex-col border border-cs-border bg-cs-panel p-3 opacity-70" key={action.path} title={feature.description}><LockKeyhole size={13} className="self-end" />{tile}</span> : <Link className="flex min-h-24 min-w-0 flex-col border border-cs-border bg-cs-panel p-3 transition-colors hover:border-rarity-special hover:bg-cs-panelMuted" key={action.path} to={action.path}>{tile}</Link> })}</div></section>
      <section className="min-w-0 border border-cs-border bg-cs-surface p-3 sm:p-4"><div className="flex items-center gap-2"><Gift size={16} className="text-rarity-special" /><h3 className="font-semibold">Recent activity</h3></div>{activity.length ? <div className="mt-3 space-y-2">{activity.map((entry) => <Link className="flex min-w-0 items-center gap-3 border-l-2 border-rarity-special bg-cs-panel p-2 text-xs hover:bg-cs-panelMuted" key={entry.id} to={entry.path}>{entry.image ? <AssetImage alt="" className="h-11 w-11 shrink-0 object-contain" src={entry.image} /> : <Gift size={18} className="shrink-0 text-rarity-special" />}<span className="min-w-0"><span className="block truncate font-semibold">{entry.title}</span><span className="block truncate text-cs-muted">{entry.detail}</span></span></Link>)}</div> : <p className="mt-3 text-sm text-cs-muted">Your first opening, quest, or trade-up will appear here.</p>}</section>
    </div>
  </section>
}
