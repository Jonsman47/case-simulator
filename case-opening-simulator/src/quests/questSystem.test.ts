import { describe, expect, it } from 'vitest'
import { defaultGameState, type GameState } from '../data/gameState'
import { gameReducer } from '../data/gameReducer'
import { Rarity, WearCondition, type SkinInstance } from '../data/models'
import { createDefaultQuestSystem, getQuestCatalogCounts, getQuestProgressState, getQuestStageStatus, QUEST_DEFINITIONS, QUEST_NPCS, resetQuestsForPrestige } from './questSystem'
import { createDefaultDropJournal, recordDropJournalAction } from './dropJournal'

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    ...defaultGameState,
    quests: createDefaultQuestSystem(1_700_000_000_000),
    dropJournal: createDefaultDropJournal(),
    ...overrides,
  }
}

function item(overrides: Partial<SkinInstance> = {}): SkinInstance {
  return {
    id: 'test-skin', instanceId: 'test-instance', weapon: 'Glock-18', finish: 'Test Finish', image: '/assets/placeholder.png',
    rarity: Rarity.Classified, baseValue: 12, marketValue: 12, caseIds: ['crate-4904'], wear: WearCondition.FieldTested,
    floatValue: .21, isLocked: false, isFavorited: false, discoveredAt: 1_700_000_000_000, paintSeed: 661,
    ...overrides,
  }
}

describe('quest and NPC progression', () => {
  it('ships 36 distinct quests and eight recurring NPCs', () => {
    expect(QUEST_DEFINITIONS).toHaveLength(36)
    expect(new Set(QUEST_DEFINITIONS.map((quest) => quest.id)).size).toBe(36)
    expect(QUEST_NPCS).toHaveLength(8)
    expect(getQuestCatalogCounts()).toEqual({ story: 8, collection: 12, opening: 8, contract: 5, repeatable: 3 })
  })

  it('claims a completed stage once with bounded credits and exact-once Career XP', () => {
    const base = state()
    const eligible = {
      ...base,
      quests: { ...base.quests, activity: { ...base.quests.activity, manualCases: 1 } },
    }
    const quest = QUEST_DEFINITIONS.find((entry) => entry.id === 'story-first-crack')!
    expect(getQuestStageStatus(eligible, quest).complete).toBe(true)
    const action = { type: 'CLAIM_QUEST_STAGE' as const, questId: quest.id, requestId: 'claim-1', now: 1_700_000_000_100 }
    const claimed = gameReducer(eligible, action)
    const replay = gameReducer(claimed, action)
    expect(getQuestProgressState(claimed, quest).stageIndex).toBe(1)
    expect(claimed.dailyRewards.openingCredits).toBe(1.5)
    expect(claimed.career.currentRunXp).toBeGreaterThan(eligible.career.currentRunXp)
    expect(replay.dailyRewards.openingCredits).toBe(claimed.dailyRewards.openingCredits)
    expect(replay.career.currentRunXp).toBe(claimed.career.currentRunXp)
  })

  it('consumes the exact delivered item once and protects locked copies', () => {
    const quest = QUEST_DEFINITIONS.find((entry) => entry.id === 'contract-maras-sidearm')!
    const eligible = state({
      inventory: [item(), item({ instanceId: 'locked', isLocked: true })],
      quests: {
        ...createDefaultQuestSystem(1_700_000_000_000),
        progress: { 'story-first-crack': { stageIndex: 2, claimedStageIds: ['open-one', 'find-three', 'wear-study'], deliveredStageIds: [], completedAt: 1_699_999_999_000 } },
      },
    })
    const action = { type: 'DELIVER_QUEST_ITEM' as const, questId: quest.id, itemId: 'test-instance', requestId: 'delivery-1', now: 1_700_000_000_100 }
    const delivered = gameReducer(eligible, action)
    const replay = gameReducer(delivered, action)
    expect(delivered.inventory.map((entry) => entry.instanceId)).toEqual(['locked'])
    expect(getQuestStageStatus(delivered, quest).complete).toBe(true)
    expect(replay.inventory).toEqual(delivered.inventory)
  })

  it('preserves lifetime stories and reputation while resetting Current Run quest progress', () => {
    const base = createDefaultQuestSystem(1_700_000_000_000)
    const reset = resetQuestsForPrestige({
      ...base,
      progress: {
        'story-first-crack': { stageIndex: 2, claimedStageIds: [], deliveredStageIds: [], completedAt: 1 },
        'story-rooks-race': { stageIndex: 1, claimedStageIds: ['meet-rook'], deliveredStageIds: [] },
      },
      npc: { ...base.npc, 'mara-voss': { ...base.npc['mara-voss'], reputation: 8 } },
    }, 1_700_100_000_000)
    expect(reset.progress['story-first-crack']?.completedAt).toBe(1)
    expect(reset.progress['story-rooks-race']).toBeUndefined()
    expect(reset.npc['mara-voss'].reputation).toBe(8)
  })
})

describe('drop journal', () => {
  it('records only genuine notable opening drops and remains exact-once and bounded', () => {
    const before = state()
    const drop = item()
    const after = { ...before, recentDrops: [drop], lastOpenedItems: [drop] }
    const action = { type: 'OPEN_CASE' as const, payload: { caseId: 'crate-4904', openingEventId: 'opening-1', now: drop.discoveredAt } }
    const first = recordDropJournalAction(before, after, action)
    const replay = recordDropJournalAction({ ...after, dropJournal: first }, { ...after, dropJournal: first }, action)
    expect(first.entries).toHaveLength(1)
    expect(first.entries[0]).toMatchObject({ instanceId: drop.instanceId, sourceCaseId: 'crate-4904', paintSeed: 661, isFirstRare: true, isPersonalBest: true })
    expect(replay.entries).toHaveLength(1)
  })

  it('does not record marketplace or daily-reward acquisitions', () => {
    const before = state()
    const after = { ...before, recentDrops: [item()] }
    expect(recordDropJournalAction(before, after, { type: 'ADD_ITEM', item: item() }).entries).toHaveLength(0)
  })
})
