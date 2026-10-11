import { describe, expect, it } from 'vitest'
import { CaseStatus, SkillNodeId, WearCondition, type CaseDefinition, type SkinBase } from './models'
import {
  applySkillEffectsToCase,
  getSkillBranchTier,
  getSkillLicenseDiscount,
  getSkillNodeStatus,
  normalizeLearnedSkillNodeIds,
  randomWearConditionForSkinWithSkills,
  SKILL_TREE_NODES,
  skillTreeNodesById,
} from './skills'
import { SKIN_DEFINITIONS } from './skins'

const skinsById = new Map(SKIN_DEFINITIONS.map((skin) => [skin.id, skin]))

describe('skill tree data helpers', () => {
  it('generates a long-term tree with persisted branch nodes', () => {
    const branchNodeId = 'license_3' as SkillNodeId
    const totalSkillPointCost = SKILL_TREE_NODES.reduce((total, node) => total + node.cost, 0)

    expect(SKILL_TREE_NODES.length).toBeGreaterThanOrEqual(100)
    expect(totalSkillPointCost).toBeGreaterThanOrEqual(300)
    expect(skillTreeNodesById.get(branchNodeId)?.prerequisites).toEqual(['license_2'])
    expect(normalizeLearnedSkillNodeIds([branchNodeId, 'not-real'])).toEqual([branchNodeId])
    expect(getSkillBranchTier([branchNodeId], 'license')).toBe(3)
    expect(getSkillLicenseDiscount([branchNodeId])).toBeCloseTo(0.045)
  })

  it('reports learnable and locked node states from prerequisites and skill points', () => {
    const rootNode = skillTreeNodesById.get(SkillNodeId.SellSpecialist)
    const childNode = skillTreeNodesById.get(SkillNodeId.TradeUpEdge)

    expect(rootNode).toBeDefined()
    expect(childNode).toBeDefined()

    const rootStatus = getSkillNodeStatus(rootNode!, {
      learnedSkillNodeIds: [],
      skillPoints: 1,
    })
    const lockedStatus = getSkillNodeStatus(childNode!, {
      learnedSkillNodeIds: [],
      skillPoints: 3,
    })
    const unlockedStatus = getSkillNodeStatus(childNode!, {
      learnedSkillNodeIds: [SkillNodeId.SellSpecialist],
      skillPoints: 3,
    })

    expect(rootStatus.canLearn).toBe(true)
    expect(lockedStatus.canLearn).toBe(false)
    expect(lockedStatus.missingPrerequisites).toEqual([SkillNodeId.SellSpecialist])
    expect(unlockedStatus.canLearn).toBe(true)
  })

  it('improves wear rolls toward better conditions when Wear Whisperer is learned', () => {
    const skin = skinsById.get('p250_sand_dune') as SkinBase
    const prng = () => 0.3

    expect(randomWearConditionForSkinWithSkills(skin, [], prng)).toBe(WearCondition.FieldTested)
    expect(
      randomWearConditionForSkinWithSkills(skin, [SkillNodeId.WearWhisperer], prng),
    ).toBe(WearCondition.MinimalWear)
  })

  it('boosts special item pressure while preserving total drop weight', () => {
    const caseDef: CaseDefinition = {
      id: 'skill_test_case',
      name: 'Skill Test Case',
      cost: 1,
      status: CaseStatus.Unlocked,
      dropTable: [
        { skinId: 'p250_sand_dune', weight: 99.95 },
        { skinId: 'karambit_doppler', weight: 0.05 },
      ],
      image: '/assets/placeholder.png',
    }
    const originalTotal = caseDef.dropTable.reduce((total, drop) => total + drop.weight, 0)
    const adjustedCase = applySkillEffectsToCase(
      caseDef,
      [SkillNodeId.GoldenTouch],
      skinsById,
    )
    const adjustedTotal = adjustedCase.dropTable.reduce((total, drop) => total + drop.weight, 0)
    const specialDrop = adjustedCase.dropTable.find((drop) => drop.skinId === 'karambit_doppler')

    expect(adjustedTotal).toBeCloseTo(originalTotal, 6)
    expect(specialDrop?.weight).toBeGreaterThan(0.05)
  })
})
