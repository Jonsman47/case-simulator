import {
  Bot,
  CheckCircle,
  Clock,
  Gem,
  GitBranch,
  Lock,
  Repeat,
  Shield,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { SkillNodeId } from '../data/models'
import {
  SKILL_TREE_NODES,
  SKILL_TREE_GRAPH_HEIGHT,
  SKILL_TREE_GRAPH_WIDTH,
  SKILL_TREE_NODE_HEIGHT,
  SKILL_TREE_NODE_WIDTH,
  getSkillAutoOpenSlotBonus,
  getSkillAutomationIntervalMultiplier,
  getSkillCosmeticTier,
  getSkillEffectSummaries,
  getSkillEventChanceBonus,
  getSkillInventoryCapacityBonus,
  getSkillLicenseDiscount,
  getSkillMinigameRewardMultiplier,
  getSkillMarketKnowledgeBonus,
  getSkillMultiOpenBatchBonus,
  getSkillNodeStatus,
  getSkillOfflineEarningsMultiplier,
  getSkillOpeningFlowBonus,
  getSkillPrestigePointMultiplier,
  getSkillSellMultiplier,
  getSkillSpecialDropPressure,
  getSkillTradeUpInputCostMultiplier,
  getSkillWearBonusWeight,
  skillTreeNodesById,
  type SkillNodeStatus,
  type SkillTreeNodeDefinition,
} from '../data/skills'
import { useGame } from '../hooks/useGame'

const skillIcons: Partial<Record<SkillNodeId, ComponentType<{ className?: string; size?: number }>>> = {
  [SkillNodeId.BulkAutomation]: Bot,
  [SkillNodeId.EventHunter]: Clock,
  [SkillNodeId.GoldenTouch]: Gem,
  [SkillNodeId.MarketOracle]: TrendingUp,
  [SkillNodeId.OfflineOperator]: Shield,
  [SkillNodeId.PrestigeScholar]: Sparkles,
  [SkillNodeId.SellSpecialist]: Repeat,
  [SkillNodeId.TradeUpEdge]: GitBranch,
  [SkillNodeId.WearWhisperer]: Sparkles,
}

const skillTreeEdges = SKILL_TREE_NODES.flatMap((node) => {
  return node.prerequisites.map((prerequisiteId) => ({
    from: prerequisiteId,
    to: node.id,
  }))
})

function formatPercent(value: number) {
  return `${Number((value * 100).toFixed(1))}%`
}

function getNodeTone(status: SkillNodeStatus) {
  if (status.isLearned) {
    return 'border-cs-green bg-cs-green/10 text-cs-green'
  }

  if (status.canLearn) {
    return 'border-rarity-special bg-rarity-special/10 text-rarity-special shadow-glow'
  }

  return 'border-cs-border bg-cs-panel text-cs-muted'
}

function getLearnLabel(status: SkillNodeStatus) {
  if (status.isLearned) {
    return 'Learned'
  }

  if (!status.hasPrerequisites) {
    return 'Locked'
  }

  if (!status.canAfford) {
    return 'Need SP'
  }

  return 'Learn'
}

function ResourcePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-cs-border bg-cs-panel px-3 py-2">
      <p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-cs-text">{value}</p>
    </div>
  )
}

function EffectPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-cs-border bg-cs-panel p-3">
      <p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-cs-text">{value}</p>
    </div>
  )
}

function SkillEdge({
  from,
  learnedIds,
  to,
}: {
  from: SkillNodeId
  learnedIds: Set<SkillNodeId>
  to: SkillNodeId
}) {
  const fromNode = skillTreeNodesById.get(from)
  const toNode = skillTreeNodesById.get(to)

  if (!fromNode || !toNode) {
    return null
  }

  const isActive = learnedIds.has(from) && learnedIds.has(to)
  const startX = fromNode.position.x + SKILL_TREE_NODE_WIDTH
  const startY = fromNode.position.y + SKILL_TREE_NODE_HEIGHT / 2
  const endX = toNode.position.x
  const endY = toNode.position.y + SKILL_TREE_NODE_HEIGHT / 2
  const midpointX = (startX + endX) / 2

  return (
    <path
      className={isActive ? 'stroke-cs-green' : 'stroke-cs-border'}
      d={`M ${startX} ${startY} C ${midpointX} ${startY}, ${midpointX} ${endY}, ${endX} ${endY}`}
      fill="none"
      strokeDasharray={isActive ? undefined : '6 8'}
      strokeWidth={isActive ? 3 : 2}
    />
  )
}

function SkillNodeCard({
  definition,
  onLearn,
  status,
}: {
  definition: SkillTreeNodeDefinition
  onLearn: (nodeId: SkillNodeId) => void
  status: SkillNodeStatus
}) {
  const Icon = skillIcons[definition.id] ?? Sparkles
  const missingPrerequisites = status.missingPrerequisites
    .map((nodeId) => skillTreeNodesById.get(nodeId)?.name ?? nodeId)
    .join(', ')

  return (
    <article
      className={[
        'absolute flex flex-col border p-3 transition-colors',
        getNodeTone(status),
      ].join(' ')}
      style={{
        height: SKILL_TREE_NODE_HEIGHT,
        left: definition.position.x,
        top: definition.position.y,
        width: SKILL_TREE_NODE_WIDTH,
      }}
      title={definition.description}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center border border-current bg-cs-surface">
            <Icon size={17} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase text-cs-muted">Cost {definition.cost} SP</p>
            <h3 className="truncate text-sm font-semibold text-cs-text">{definition.name}</h3>
          </div>
        </div>
        {status.isLearned ? <CheckCircle className="shrink-0 text-cs-green" size={18} /> : <Lock className="shrink-0" size={18} />}
      </div>

      <p className="mt-2 line-clamp-2 text-xs leading-5 text-cs-muted">{definition.effectLabel}</p>
      {missingPrerequisites ? (
        <p className="mt-1 truncate font-mono text-[10px] uppercase text-cs-muted" title={missingPrerequisites}>
          Requires {missingPrerequisites}
        </p>
      ) : (
        <p className="mt-1 font-mono text-[10px] uppercase text-cs-muted">No prerequisites</p>
      )}

      <button
        className="mt-auto inline-flex items-center justify-center gap-2 border border-current bg-cs-surface px-3 py-2 text-xs font-semibold transition-colors hover:bg-cs-panelMuted disabled:cursor-not-allowed disabled:border-cs-border disabled:text-cs-muted"
        disabled={!status.canLearn}
        onClick={() => onLearn(definition.id)}
        type="button"
      >
        {status.canLearn ? <Sparkles size={14} /> : <Lock size={14} />}
        {getLearnLabel(status)}
      </button>
    </article>
  )
}

export function SkillTreeView() {
  const { learnSkillNode, state } = useGame()
  const learnedIds = new Set(state.learnedSkillNodeIds)
  const learnedCount = learnedIds.size
  const activeEffects = getSkillEffectSummaries(state.learnedSkillNodeIds)
  const automationReduction = 1 - getSkillAutomationIntervalMultiplier(state.learnedSkillNodeIds)
  const tradeUpDiscount = 1 - getSkillTradeUpInputCostMultiplier(state.learnedSkillNodeIds)
  const licenseDiscount = getSkillLicenseDiscount(state.learnedSkillNodeIds)

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-5 sm:p-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="border-l-4 border-rarity-special pl-4">
          <p className="font-mono text-xs uppercase text-rarity-special">Specialisation</p>
          <h2 className="mt-1 text-3xl font-semibold text-cs-text sm:text-4xl">Skill Tree</h2>
          <p className="mt-2 max-w-2xl text-sm text-cs-muted">
            Spend skill points from prestige resets and achievement rewards on permanent playstyle branches.
          </p>
        </div>
        <div className="grid gap-2 border border-cs-border bg-cs-panel p-3 sm:grid-cols-3">
          <ResourcePill label="Skill Points" value={String(state.skillPoints)} />
          <ResourcePill label="Learned" value={`${learnedCount}/${SKILL_TREE_NODES.length}`} />
          <ResourcePill label="Prestige" value={String(state.prestigeLevel)} />
        </div>
      </div>

      {state.lastError ? (
        <div className="mt-5 border border-rarity-covert bg-rarity-covert/10 px-3 py-2 text-sm text-rarity-covert">
          {state.lastError}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 max-h-[72vh] overflow-auto border border-cs-border bg-cs-panel p-4">
          <div className="relative" style={{ height: SKILL_TREE_GRAPH_HEIGHT, width: SKILL_TREE_GRAPH_WIDTH }}>
            <svg
              aria-hidden="true"
              className="absolute inset-0"
              height={SKILL_TREE_GRAPH_HEIGHT}
              viewBox={`0 0 ${SKILL_TREE_GRAPH_WIDTH} ${SKILL_TREE_GRAPH_HEIGHT}`}
              width={SKILL_TREE_GRAPH_WIDTH}
            >
              {skillTreeEdges.map((edge) => (
                <SkillEdge
                  from={edge.from}
                  key={`${edge.from}:${edge.to}`}
                  learnedIds={learnedIds}
                  to={edge.to}
                />
              ))}
            </svg>

            {SKILL_TREE_NODES.map((definition) => (
              <SkillNodeCard
                definition={definition}
                key={definition.id}
                onLearn={learnSkillNode}
                status={getSkillNodeStatus(definition, state)}
              />
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="border border-cs-border bg-cs-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-cs-text">Active Effects</h3>
              <Sparkles className="text-rarity-special" size={22} />
            </div>
            <div className="mt-4 grid gap-2">
              <EffectPill label="Sell Value" value={`${formatPercent(getSkillSellMultiplier(state.learnedSkillNodeIds) - 1)} bonus`} />
              <EffectPill label="Wear Rolls" value={`+${getSkillWearBonusWeight(state.learnedSkillNodeIds)} FN/MW weight`} />
              <EffectPill label="Special Pressure" value={`${formatPercent(getSkillSpecialDropPressure(state.learnedSkillNodeIds))} pressure`} />
              <EffectPill label="Automation" value={`${formatPercent(automationReduction)} faster`} />
              <EffectPill label="Auto Slots" value={`+${getSkillAutoOpenSlotBonus(state.learnedSkillNodeIds)} future slot`} />
              <EffectPill label="Licenses" value={`${formatPercent(licenseDiscount)} discount`} />
              <EffectPill label="Side Job" value={`${formatPercent(getSkillMinigameRewardMultiplier(state.learnedSkillNodeIds) - 1)} reward`} />
              <EffectPill label="Trade Ups" value={`${formatPercent(tradeUpDiscount)} input discount`} />
              <EffectPill label="Market Read" value={`${formatPercent(getSkillMarketKnowledgeBonus(state.learnedSkillNodeIds))} accuracy`} />
              <EffectPill label="Offline" value={`${formatPercent(getSkillOfflineEarningsMultiplier(state.learnedSkillNodeIds) - 1)} income`} />
              <EffectPill label="Opening Flow" value={`${formatPercent(getSkillOpeningFlowBonus(state.learnedSkillNodeIds))} polish`} />
              <EffectPill label="Max Batch" value={`+${getSkillMultiOpenBatchBonus(state.learnedSkillNodeIds)} cases`} />
              <EffectPill label="Future Slots" value={`+${getSkillInventoryCapacityBonus(state.learnedSkillNodeIds)}`} />
              <EffectPill label="Cosmetics" value={`Tier ${getSkillCosmeticTier(state.learnedSkillNodeIds)}`} />
              <EffectPill label="Events" value={`${formatPercent(getSkillEventChanceBonus(state.learnedSkillNodeIds))} schedule chance`} />
              <EffectPill label="Prestige Yield" value={`${formatPercent(getSkillPrestigePointMultiplier(state.learnedSkillNodeIds) - 1)} bonus`} />
            </div>
          </section>

          <section className="border border-cs-border bg-cs-panel p-4">
            <h3 className="text-xl font-semibold text-cs-text">Unlocked Nodes</h3>
            <div className="mt-4 space-y-2">
              {activeEffects.length > 0 ? (
                activeEffects.map((effect) => (
                  <div
                    className="border border-cs-green/50 bg-cs-green/10 px-3 py-2 text-sm text-cs-green"
                    key={effect}
                  >
                    {effect}
                  </div>
                ))
              ) : (
                <div className="border border-cs-border bg-cs-surface px-3 py-4 text-sm text-cs-muted">
                  No skills learned yet.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}
