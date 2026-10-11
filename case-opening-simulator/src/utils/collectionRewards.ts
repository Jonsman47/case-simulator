import { CASE_DEFINITIONS } from '../data/cases'
import { normalizeDropTable, type DropTableEntry } from '../data/dropLogic'
import {
  Rarity,
  type CaseDefinition,
  type CollectionEntry,
  type CollectionRewardProgress,
  type CollectionRewardType,
  type SkinBase,
  type SkinInstance,
} from '../data/models'
import { SKIN_DEFINITIONS } from '../data/skins'
import { rarityCollectionOrder, wearConditionOrder } from './collectionBook'

export const WEAPON_SELL_BONUS = 0.01
export const CASE_COLLECTION_DISCOUNT = 0.05
export const RARITY_LUCK_BONUS = 0.02
export const FULL_GAME_PRESTIGE_BONUS = 1
export const MAX_COLLECTION_CASE_DISCOUNT = 0.5

export interface CollectionRewardDefinition {
  id: string
  type: CollectionRewardType
  targetId: string
  title: string
  description: string
  effectLabel: string
  bonus: number
  carriesOver?: boolean
}

export interface CollectionRewardStatus {
  definition: CollectionRewardDefinition
  discovered: number
  isUnlocked: boolean
  percentage: number
  total: number
}

const raritySortIndex = new Map(rarityCollectionOrder.map((rarity, index) => [rarity, index]))

function percent(discovered: number, total: number) {
  if (total <= 0) {
    return 0
  }

  return Number(((discovered / total) * 100).toFixed(1))
}

function slugTarget(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function getEntryMap(collectionBook: CollectionEntry[]) {
  return new Map(collectionBook.map((entry) => [entry.skinId, entry]))
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

export function getCollectionRewardDefinitions(
  skins: SkinBase[] = SKIN_DEFINITIONS,
  caseDefinitions: CaseDefinition[] = CASE_DEFINITIONS,
): CollectionRewardDefinition[] {
  const weapons = Array.from(new Set(skins.map((skin) => skin.weapon))).sort((left, right) =>
    left.localeCompare(right),
  )
  const weaponRewards = weapons.map((weapon) => ({
    id: `weapon:${slugTarget(weapon)}`,
    type: 'WeaponSellBonus' as const,
    targetId: weapon,
    title: `${weapon} Specialist`,
    description: `Discover every seeded ${weapon} finish.`,
    effectLabel: '+1% sell value',
    bonus: WEAPON_SELL_BONUS,
  }))
  const caseRewards = caseDefinitions.map((caseDef) => ({
    id: `case:${caseDef.id}`,
    type: 'CaseDiscount' as const,
    targetId: caseDef.id,
    title: `${caseDef.name} Complete`,
    description: `Discover every skin in ${caseDef.name}.`,
    effectLabel: '5% case discount',
    bonus: CASE_COLLECTION_DISCOUNT,
  }))
  const rarityRewards = rarityCollectionOrder.map((rarity) => ({
    id: `rarity:${rarity}`,
    type: 'RarityLuck' as const,
    targetId: rarity,
    title: `${rarity} Tier Complete`,
    description: `Discover every seeded ${rarity} skin.`,
    effectLabel: '+2% higher-tier luck',
    bonus: RARITY_LUCK_BONUS,
  }))
  const fullGameReward = {
    id: 'full-game:wear-master',
    type: 'FullGamePrestigeBonus' as const,
    targetId: 'all-skins-all-wears',
    title: 'Full Wear Archive',
    description: 'Discover every seeded skin in every wear condition.',
    effectLabel: '+1 permanent prestige bonus',
    bonus: FULL_GAME_PRESTIGE_BONUS,
    carriesOver: true,
  }

  return uniqueById([...weaponRewards, ...caseRewards, ...rarityRewards, fullGameReward])
}

function getTargetSkinIds(
  definition: CollectionRewardDefinition,
  skins: SkinBase[],
  caseDefinitions: CaseDefinition[],
) {
  switch (definition.type) {
    case 'WeaponSellBonus':
      return skins.filter((skin) => skin.weapon === definition.targetId).map((skin) => skin.id)
    case 'CaseDiscount': {
      const caseDef = caseDefinitions.find((candidate) => candidate.id === definition.targetId)

      return Array.from(new Set(caseDef?.dropTable.map((drop) => drop.skinId) ?? []))
    }
    case 'RarityLuck':
      return skins.filter((skin) => skin.rarity === definition.targetId).map((skin) => skin.id)
    case 'FullGamePrestigeBonus':
      return skins.map((skin) => skin.id)
    default:
      return []
  }
}

function getRewardStatus(
  definition: CollectionRewardDefinition,
  collectionBook: CollectionEntry[],
  unlockedRewardIds: Set<string>,
  skins: SkinBase[],
  caseDefinitions: CaseDefinition[],
): CollectionRewardStatus {
  const entryMap = getEntryMap(collectionBook)
  const targetSkinIds = getTargetSkinIds(definition, skins, caseDefinitions)

  if (definition.type === 'FullGamePrestigeBonus') {
    const total = targetSkinIds.length * wearConditionOrder.length
    const discovered = targetSkinIds.reduce((count, skinId) => {
      const foundWearConditions = new Set(entryMap.get(skinId)?.foundWearConditions ?? [])

      return count + wearConditionOrder.filter((wear) => foundWearConditions.has(wear)).length
    }, 0)

    return {
      definition,
      discovered,
      isUnlocked: unlockedRewardIds.has(definition.id) || (total > 0 && discovered >= total),
      percentage: percent(discovered, total),
      total,
    }
  }

  const discovered = targetSkinIds.filter((skinId) => entryMap.has(skinId)).length
  const total = targetSkinIds.length

  return {
    definition,
    discovered,
    isUnlocked: unlockedRewardIds.has(definition.id) || (total > 0 && discovered >= total),
    percentage: percent(discovered, total),
    total,
  }
}

export function getCollectionRewardStatuses({
  caseDefinitions = CASE_DEFINITIONS,
  collectionBook,
  collectionRewards,
  skins = SKIN_DEFINITIONS,
}: {
  caseDefinitions?: CaseDefinition[]
  collectionBook: CollectionEntry[]
  collectionRewards: CollectionRewardProgress[]
  skins?: SkinBase[]
}) {
  const unlockedRewardIds = new Set(collectionRewards.map((reward) => reward.id))

  return getCollectionRewardDefinitions(skins, caseDefinitions).map((definition) =>
    getRewardStatus(definition, collectionBook, unlockedRewardIds, skins, caseDefinitions),
  )
}

export function getNewCollectionRewardUnlocks({
  caseDefinitions = CASE_DEFINITIONS,
  collectionBook,
  collectionRewards,
  skins = SKIN_DEFINITIONS,
  unlockedAt = Date.now(),
}: {
  caseDefinitions?: CaseDefinition[]
  collectionBook: CollectionEntry[]
  collectionRewards: CollectionRewardProgress[]
  skins?: SkinBase[]
  unlockedAt?: number
}) {
  const unlockedRewardIds = new Set(collectionRewards.map((reward) => reward.id))

  return getCollectionRewardStatuses({
    caseDefinitions,
    collectionBook,
    collectionRewards,
    skins,
  })
    .filter((status) => status.isUnlocked && !unlockedRewardIds.has(status.definition.id))
    .map((status) => ({
      id: status.definition.id,
      type: status.definition.type,
      targetId: status.definition.targetId,
      bonus: status.definition.bonus,
      carriesOver: status.definition.carriesOver,
      unlockedAt,
    }))
}

export function getCollectionSellValueMultiplier(
  item: Pick<SkinInstance, 'weapon'>,
  collectionRewards: CollectionRewardProgress[],
  rewardMultiplier = 1,
) {
  const sellBonus = collectionRewards
    .filter((reward) => reward.type === 'WeaponSellBonus' && reward.targetId === item.weapon)
    .reduce((total, reward) => total + reward.bonus, 0)

  return 1 + sellBonus * Math.max(0, rewardMultiplier)
}

export function applyCollectionSellValueBonus(
  value: number,
  item: Pick<SkinInstance, 'weapon'>,
  collectionRewards: CollectionRewardProgress[],
  rewardMultiplier = 1,
) {
  return value * getCollectionSellValueMultiplier(item, collectionRewards, rewardMultiplier)
}

export function getCollectionCaseDiscount(
  caseId: string,
  collectionRewards: CollectionRewardProgress[],
  rewardMultiplier = 1,
) {
  const discount = collectionRewards
    .filter((reward) => reward.type === 'CaseDiscount' && reward.targetId === caseId)
    .reduce((total, reward) => total + reward.bonus, 0)

  return Math.min(MAX_COLLECTION_CASE_DISCOUNT, discount * Math.max(0, rewardMultiplier))
}

export function getCollectionCaseCost(
  caseDef: Pick<CaseDefinition, 'cost' | 'id'>,
  collectionRewards: CollectionRewardProgress[],
  rewardMultiplier = 1,
) {
  const discount = getCollectionCaseDiscount(caseDef.id, collectionRewards, rewardMultiplier)

  return Number((caseDef.cost * (1 - discount)).toFixed(2))
}

export function getCollectionPrestigeBonus(collectionRewards: CollectionRewardProgress[]) {
  return collectionRewards
    .filter((reward) => reward.type === 'FullGamePrestigeBonus')
    .reduce((total, reward) => total + reward.bonus, 0)
}

export function getCarryOverCollectionRewards(collectionRewards: CollectionRewardProgress[]) {
  return collectionRewards.filter((reward) => reward.carriesOver)
}

function getRarityLuckBonusForSkin(
  skin: SkinBase | undefined,
  collectionRewards: CollectionRewardProgress[],
  rewardMultiplier = 1,
) {
  if (!skin) {
    return 0
  }

  const skinRarityIndex = raritySortIndex.get(skin.rarity) ?? 0

  return collectionRewards
    .filter((reward) => {
      if (reward.type !== 'RarityLuck' || !Object.values(Rarity).includes(reward.targetId as Rarity)) {
        return false
      }

      const rewardRarityIndex = raritySortIndex.get(reward.targetId as Rarity) ?? 0

      return skinRarityIndex > rewardRarityIndex
    })
    .reduce((total, reward) => total + reward.bonus, 0) * Math.max(0, rewardMultiplier)
}

export function applyCollectionLuckToDropTable(
  dropTable: DropTableEntry[],
  collectionRewards: CollectionRewardProgress[],
  skins: SkinBase[] = SKIN_DEFINITIONS,
  rewardMultiplier = 1,
) {
  const skinsById = new Map(skins.map((skin) => [skin.id, skin]))

  return normalizeDropTable(
    dropTable.map((drop) => {
      const luckBonus = getRarityLuckBonusForSkin(
        skinsById.get(drop.skinId),
        collectionRewards,
        rewardMultiplier,
      )

      return {
        ...drop,
        weight: drop.weight * (1 + luckBonus),
      }
    }),
  )
}

export function applyCollectionRewardsToCase(
  caseDef: CaseDefinition,
  collectionRewards: CollectionRewardProgress[],
  skins: SkinBase[] = SKIN_DEFINITIONS,
  rewardMultiplier = 1,
): CaseDefinition {
  // Stacking order: case discounts add together and are capped, then luck rewards
  // multiply higher-rarity weights before the drop table is normalized.
  return {
    ...caseDef,
    cost: getCollectionCaseCost(caseDef, collectionRewards, rewardMultiplier),
    dropTable: applyCollectionLuckToDropTable(
      caseDef.dropTable,
      collectionRewards,
      skins,
      rewardMultiplier,
    ),
  }
}

export function applyCollectionRewardsToCases(
  caseDefinitions: CaseDefinition[],
  collectionRewards: CollectionRewardProgress[],
  skins: SkinBase[] = SKIN_DEFINITIONS,
  rewardMultiplier = 1,
) {
  return caseDefinitions.map((caseDef) =>
    applyCollectionRewardsToCase(caseDef, collectionRewards, skins, rewardMultiplier),
  )
}
