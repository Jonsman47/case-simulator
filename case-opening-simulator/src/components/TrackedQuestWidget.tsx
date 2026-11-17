import { CheckCircle2, ListChecks } from 'lucide-react'
import { Link } from 'react-router-dom'
import { QUEST_DEFINITIONS, getQuestProgressState, getQuestStageStatus, isQuestUnlocked } from '../quests/questSystem'
import { useGame } from '../hooks/useGame'

export function TrackedQuestWidget() {
  const { state } = useGame()
  const tracked = state.quests.trackedQuestIds
    .map((id) => QUEST_DEFINITIONS.find((quest) => quest.id === id))
    .filter((quest) => quest && isQuestUnlocked(state, quest) && !getQuestProgressState(state, quest).completedAt)
    .slice(0, 3)

  return (
    <aside className="mt-4 border border-cs-border bg-cs-panel/80 p-3" aria-label="Tracked quests" data-testid="tracked-quest-widget">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-mono text-xs uppercase text-rarity-classified"><ListChecks aria-hidden="true" size={15} /> Tracked quests</p>
        <Link className="text-xs font-semibold text-cs-muted hover:text-cs-text" to="/quests">View all</Link>
      </div>
      {tracked.length ? <div className="mt-2 grid gap-2 lg:grid-cols-3">{tracked.map((quest) => {
        const progress = getQuestProgressState(state, quest!)
        const stage = quest!.stages[progress.stageIndex]
        const status = getQuestStageStatus(state, quest!)
        const total = status.requirements.reduce((sum, requirement) => sum + requirement.target, 0)
        const current = status.requirements.reduce((sum, requirement) => sum + Math.min(requirement.current, requirement.target), 0)
        return <Link className="min-w-0 border border-cs-border bg-cs-surface px-3 py-2 hover:border-rarity-classified/70" key={quest!.id} to={`/quests?quest=${quest!.id}`}>
          <p className="truncate text-sm font-semibold text-cs-text">{quest!.name}</p>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-cs-muted"><span className="truncate">{stage?.title}</span><span>{current}/{total}</span></div>
          <div className="mt-2 h-1.5 overflow-hidden bg-cs-border"><div className="h-full bg-rarity-classified" style={{ width: `${total ? current / total * 100 : 100}%` }} /></div>
        </Link>
      })}</div> : <p className="mt-2 flex items-center gap-2 text-sm text-cs-muted"><CheckCircle2 aria-hidden="true" size={15} /> Track quests to see opening goals here.</p>}
    </aside>
  )
}
