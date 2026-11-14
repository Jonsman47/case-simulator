import type { GameState } from '../data/gameState'
import type { SkinInstance } from '../data/models'
import { getCareerLevelFromXp } from '../career/careerProgress'

export type PrestigePathId = 'opening' | 'trading' | 'patterns' | 'tradeUps' | 'business'
export type PrestigePerkId = 'xpAcceleration' | 'startingCash' | 'researchRetention' | 'legacyVault' | 'businessEfficiency' | 'careerCosmetics'

export interface PrestigeTierDefinition {
  tier: number
  name: string
  minimumLevel: number
  minimumScore: number
  requiredPrimaryPaths: number
  requiredSupportPaths: number
  basePoints: number
}

export interface PrestigePathProgress {
  id: PrestigePathId
  name: string
  primaryValue: number
  primaryTarget: number
  supportValue: number
  supportTarget: number
  primaryMet: boolean
  supportMet: boolean
  description: string
}

export interface PrestigeScore {
  total: number
  level: number
  bestPath: number
  secondPath: number
  breadth: number
  solvency: number
  stewardship: number
}

export interface PrestigeRunArchive {
  id: string
  requestId: string
  runId: string
  startedAt: number
  endedAt: number
  durationMs: number
  tier: number
  tierName: string
  score: number
  awardedPoints: number
  endingCash: number
  endingInventoryValue: number
  careerXp: number
  highestCareerLevel?: number
  realizedProfit?: number
  collectionDiscoveries?: number
  businessResult?: number
  pathsCompleted: PrestigePathId[]
  vaultedItemIds: string[]
}

export interface PrestigeCompletion {
  requestId: string
  completedAt: number
  tier: number
  score: number
  awardedPoints: number
}

export interface PrestigeSystemState {
  schemaVersion: 1
  highestTier: number
  completedRuns: number
  totalPointsEarned: number
  totalPointsSpent: number
  perkLevels: Record<PrestigePerkId, number>
  completedRequestIds: string[]
  runHistory: PrestigeRunArchive[]
  lastCompletion?: PrestigeCompletion
  migrationNote?: string
}

export const PRESTIGE_HISTORY_LIMIT = 24
export const PRESTIGE_REQUEST_LIMIT = 96

export const PRESTIGE_TIERS: PrestigeTierDefinition[] = [
  { tier: 1, name: 'Fresh Start', minimumLevel: 25, minimumScore: 70, requiredPrimaryPaths: 1, requiredSupportPaths: 1, basePoints: 3 },
  { tier: 2, name: 'Established Operator', minimumLevel: 30, minimumScore: 74, requiredPrimaryPaths: 1, requiredSupportPaths: 1, basePoints: 5 },
  { tier: 3, name: 'Professional Reset', minimumLevel: 36, minimumScore: 78, requiredPrimaryPaths: 1, requiredSupportPaths: 2, basePoints: 8 },
  { tier: 4, name: 'Mogul Reinvestment', minimumLevel: 45, minimumScore: 82, requiredPrimaryPaths: 1, requiredSupportPaths: 2, basePoints: 12 },
  { tier: 5, name: 'Legendary Legacy', minimumLevel: 55, minimumScore: 86, requiredPrimaryPaths: 2, requiredSupportPaths: 2, basePoints: 17 },
]

const perkCaps: Record<PrestigePerkId, number> = {
  xpAcceleration: 8,
  startingCash: 5,
  researchRetention: 5,
  legacyVault: 9,
  businessEfficiency: 5,
  careerCosmetics: 5,
}

export const PRESTIGE_PERKS: Array<{ id: PrestigePerkId; name: string; description: string; baseCost: number; maxLevel: number }> = [
  { id: 'xpAcceleration', name: 'Career Momentum', description: '+5% Career XP per level, capped at +40%.', baseCost: 3, maxLevel: 8 },
  { id: 'startingCash', name: 'Seed Capital', description: 'Adds a fixed $250 starting cash per level. It does not scale with wealth.', baseCost: 2, maxLevel: 5 },
  { id: 'researchRetention', name: 'Research Notes', description: 'Retains a bounded 5% of run research progress per level.', baseCost: 3, maxLevel: 5 },
  { id: 'legacyVault', name: 'Legacy Vault', description: 'Adds one permanent Vault slot per level, from 1 up to 10.', baseCost: 4, maxLevel: 9 },
  { id: 'businessEfficiency', name: 'Operations Manual', description: 'Reduces payroll and operating costs by 2% per level, capped at 10%.', baseCost: 4, maxLevel: 5 },
  { id: 'careerCosmetics', name: 'Legacy Insignia', description: 'Unlocks permanent career titles and profile flourishes only.', baseCost: 2, maxLevel: 5 },
]

export function createDefaultPrestigeSystem(legacyLevel = 0, legacyBonuses: Record<string, unknown> = {}): PrestigeSystemState {
  const legacy = (id: string) => Math.max(0, Math.floor(Number(legacyBonuses[id]) || 0))
  return {
    schemaVersion: 1,
    highestTier: Math.min(5, Math.max(0, Math.floor(legacyLevel))),
    completedRuns: Math.max(0, Math.floor(legacyLevel)),
    totalPointsEarned: 0,
    totalPointsSpent: 0,
    perkLevels: {
      xpAcceleration: Math.min(8, Math.ceil((legacy('drop_luck') + legacy('market_knowledge')) / 3)),
      startingCash: Math.min(5, Math.ceil(legacy('starting_money') / 3)),
      researchRetention: Math.min(5, Math.ceil((legacy('sell_value') + legacy('case_discount')) / 6)),
      legacyVault: Math.min(9, legacy('inventory_capacity')),
      businessEfficiency: Math.min(5, Math.ceil(legacy('automation_speed') / 2)),
      careerCosmetics: Math.min(5, Math.max(0, Math.floor(legacyLevel))),
    },
    completedRequestIds: [],
    runHistory: [],
    migrationNote: legacyLevel > 0 ? 'Legacy prestige level preserved. Historical path detail was unavailable.' : undefined,
  }
}

export function normalizePrestigeSystem(value: unknown, legacyLevel = 0): PrestigeSystemState {
  const defaults = createDefaultPrestigeSystem(legacyLevel)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults
  const source = value as Record<string, unknown>
  const rawPerks = source.perkLevels && typeof source.perkLevels === 'object' ? source.perkLevels as Record<string, unknown> : {}
  const perkLevels = Object.fromEntries(Object.keys(defaults.perkLevels).map((id) => {
    const perkId = id as PrestigePerkId
    const raw = Number(rawPerks[id] ?? 0)
    return [perkId, Math.min(perkCaps[perkId], Math.max(0, Number.isFinite(raw) ? Math.floor(raw) : 0))]
  })) as Record<PrestigePerkId, number>
  const history = Array.isArray(source.runHistory) ? source.runHistory.filter((entry): entry is PrestigeRunArchive => Boolean(entry && typeof entry === 'object' && typeof (entry as PrestigeRunArchive).id === 'string')).slice(0, PRESTIGE_HISTORY_LIMIT) : []
  return {
    schemaVersion: 1,
    highestTier: Math.min(5, Math.max(defaults.highestTier, Math.floor(Number(source.highestTier) || 0))),
    completedRuns: Math.max(defaults.completedRuns, Math.floor(Number(source.completedRuns) || 0)),
    totalPointsEarned: Math.max(0, Math.floor(Number(source.totalPointsEarned) || 0)),
    totalPointsSpent: Math.max(0, Math.floor(Number(source.totalPointsSpent) || 0)),
    perkLevels,
    completedRequestIds: Array.isArray(source.completedRequestIds) ? Array.from(new Set(source.completedRequestIds.filter((id): id is string => typeof id === 'string'))).slice(-PRESTIGE_REQUEST_LIMIT) : [],
    runHistory: history,
    lastCompletion: source.lastCompletion && typeof source.lastCompletion === 'object' ? source.lastCompletion as PrestigeCompletion : undefined,
    migrationNote: typeof source.migrationNote === 'string' ? source.migrationNote : defaults.migrationNote,
  }
}

export function getNextPrestigeTier(system: PrestigeSystemState) {
  return PRESTIGE_TIERS[Math.min(system.highestTier, PRESTIGE_TIERS.length - 1)]
}

function tierScale(tier: number) { return 1 + (tier - 1) * 0.45 }

export function getPrestigePathProgress(state: GameState, tier = getNextPrestigeTier(state.prestigeSystem).tier): PrestigePathProgress[] {
  const scale = tierScale(tier)
  const ledger = state.economyLedger.currentRun
  const specialDiscoveries = state.career.currentRunDiscoveryKeys.filter((key) => key.includes('rare') || key.includes('exceptional') || key.includes('iconic')).length
  const businessOperations = Object.values(state.business.employees).reduce((sum, employee) => sum + employee.completedOperationCount, 0)
  const make = (id: PrestigePathId, name: string, primaryValue: number, primaryTarget: number, supportValue: number, supportTarget: number, description: string): PrestigePathProgress => ({
    id, name, primaryValue, primaryTarget, supportValue, supportTarget,
    primaryMet: primaryValue >= primaryTarget,
    supportMet: supportValue >= supportTarget,
    description,
  })
  return [
    make('opening', 'Case Opening & Collecting', state.statistics.casesOpened, Math.round(700 * scale), state.career.currentRunDiscoveryKeys.length, Math.round(90 * scale), 'Paid openings plus genuinely new run discoveries.'),
    make('trading', 'Trading', ledger.realizedTradingProfit, Math.round(12_000 * scale), state.statistics.marketSales, Math.round(18 * scale), 'Ledger-backed realized profit and completed market sales.'),
    make('patterns', 'Pattern Hunting', specialDiscoveries, Math.max(2, Math.round(3 * scale)), state.statistics.patternDrops, Math.max(8, Math.round(12 * scale)), 'Special pattern discoveries; ordinary seed rerolls do not count.'),
    make('tradeUps', 'Trade-Ups', state.statistics.tradeUpsCompleted, Math.round(25 * scale), ledger.tradeUpOutputValue, Math.round(6_000 * scale), 'Completed contracts and honest output value.'),
    make('business', 'Business', businessOperations, Math.round(45 * scale), ledger.businessRevenue, Math.round(8_000 * scale), 'Completed employee operations and ledger-backed revenue.'),
  ]
}

function clamp100(value: number) { return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0)) }

export function calculatePrestigeScore(state: GameState, paths = getPrestigePathProgress(state)): PrestigeScore {
  const tier = getNextPrestigeTier(state.prestigeSystem)
  const level = clamp100(getCareerLevelFromXp(state.career.currentRunXp) / tier.minimumLevel * 100)
  const pathScores = paths.map((path) => clamp100(Math.max(path.primaryValue / Math.max(1, path.primaryTarget), path.supportValue / Math.max(1, path.supportTarget)) * 100)).sort((a, b) => b - a)
  const bestPath = pathScores[0] ?? 0
  const secondPath = pathScores[1] ?? 0
  const breadth = clamp100(paths.filter((path) => path.supportMet).length / Math.max(1, tier.requiredSupportPaths + 1) * 100)
  const solvency = clamp100((state.money + state.inventoryValue) / (10_000 * tierScale(tier.tier)) * 100)
  const protectedItems = state.inventory.filter((item) => item.isLocked || item.isFavorited).length
  const stewardship = clamp100((protectedItems + state.collectionBook.length / 20) / (10 * tierScale(tier.tier)) * 100)
  const total = clamp100(level * .35 + bestPath * .25 + secondPath * .15 + breadth * .10 + solvency * .10 + stewardship * .05)
  return { total: Number(total.toFixed(1)), level: Number(level.toFixed(1)), bestPath: Number(bestPath.toFixed(1)), secondPath: Number(secondPath.toFixed(1)), breadth: Number(breadth.toFixed(1)), solvency: Number(solvency.toFixed(1)), stewardship: Number(stewardship.toFixed(1)) }
}

export function getPrestigeBlockers(state: GameState) {
  const blockers: string[] = []
  if (state.marketplace.playerListings.length > 0) blockers.push('Cancel or complete all player market listings.')
  if (state.marketplace.pendingAcquisition) blockers.push('Claim the pending item acquisition.')
  if (state.marketplace.npcListings.some((listing) => listing.negotiation?.status === 'open')) blockers.push('Resolve open marketplace negotiations.')
  if (state.business.pendingTradeUpApproval) blockers.push('Resolve the pending employee trade-up approval.')
  return blockers
}

export function getPrestigeEligibilityV2(state: GameState) {
  const tier = getNextPrestigeTier(state.prestigeSystem)
  const paths = getPrestigePathProgress(state, tier.tier)
  const score = calculatePrestigeScore(state, paths)
  const level = getCareerLevelFromXp(state.career.currentRunXp)
  const primaryCount = paths.filter((path) => path.primaryMet).length
  const supportCount = paths.filter((path) => path.supportMet && !path.primaryMet).length
  const blockers = getPrestigeBlockers(state)
  const reasons = [
    ...(level < tier.minimumLevel ? [`Reach Career Level ${tier.minimumLevel}.`] : []),
    ...(score.total < tier.minimumScore ? [`Raise the run score to ${tier.minimumScore}.`] : []),
    ...(primaryCount < tier.requiredPrimaryPaths ? [`Complete ${tier.requiredPrimaryPaths} primary path${tier.requiredPrimaryPaths === 1 ? '' : 's'}.`] : []),
    ...(supportCount < tier.requiredSupportPaths ? [`Complete ${tier.requiredSupportPaths} additional support path${tier.requiredSupportPaths === 1 ? '' : 's'}.`] : []),
    ...blockers,
  ]
  return { canPrestige: reasons.length === 0, tier, paths, score, level, primaryCount, supportCount, blockers, reasons }
}

export function calculatePrestigePointsV2(state: GameState) {
  const result = getPrestigeEligibilityV2(state)
  if (!result.canPrestige) return 0
  const scoreBonus = Math.min(4, Math.max(0, Math.floor((result.score.total - result.tier.minimumScore) / 5)))
  const pathBonus = Math.min(2, result.primaryCount - result.tier.requiredPrimaryPaths)
  const firstTimeBonus = state.prestigeSystem.highestTier < result.tier.tier ? 1 : 0
  return result.tier.basePoints + scoreBonus + pathBonus + firstTimeBonus
}

export function getLegacyVaultCapacity(system: PrestigeSystemState) { return Math.min(10, 1 + system.perkLevels.legacyVault) }
export function getPrestigeXpMultiplier(system: PrestigeSystemState) { return 1 + Math.min(.4, system.perkLevels.xpAcceleration * .05) }
export function getPrestigeBusinessCostMultiplier(system: PrestigeSystemState) { return 1 - Math.min(.1, system.perkLevels.businessEfficiency * .02) }
export function getPrestigeStartingCash(system: PrestigeSystemState) { return 100 + Math.min(5, system.perkLevels.startingCash) * 250 }

export function getPrestigePerkCost(id: PrestigePerkId, currentLevel: number) {
  const perk = PRESTIGE_PERKS.find((entry) => entry.id === id)
  return perk ? Math.ceil(perk.baseCost * Math.pow(1.65, Math.max(0, currentLevel))) : Number.POSITIVE_INFINITY
}

export function getTotalPrestigePerkSpend(levels: Record<PrestigePerkId, number>) {
  return PRESTIGE_PERKS.reduce((total, perk) => {
    const level = Math.min(perk.maxLevel, Math.max(0, Math.floor(levels[perk.id] ?? 0)))
    return total + Array.from({ length: level }, (_, index) => getPrestigePerkCost(perk.id, index))
      .reduce((subtotal, cost) => subtotal + cost, 0)
  }, 0)
}

export function purchasePrestigePerk(state: GameState, id: PrestigePerkId): GameState {
  const perk = PRESTIGE_PERKS.find((entry) => entry.id === id)
  if (!perk) return { ...state, lastError: 'Unknown Prestige perk.' }
  const level = state.prestigeSystem.perkLevels[id]
  if (level >= perk.maxLevel) return { ...state, lastError: 'That Prestige perk is already complete.' }
  const cost = getPrestigePerkCost(id, level)
  if (state.prestigePoints < cost) return { ...state, lastError: `You need ${cost} Prestige Points.` }
  return {
    ...state,
    prestigePoints: state.prestigePoints - cost,
    prestigeSystem: {
      ...state.prestigeSystem,
      totalPointsSpent: state.prestigeSystem.totalPointsSpent + cost,
      perkLevels: { ...state.prestigeSystem.perkLevels, [id]: level + 1 },
    },
    lastError: undefined,
  }
}

export function validateVaultSelection(state: GameState, itemIds: string[]) {
  const unique = Array.from(new Set(itemIds))
  const capacity = getLegacyVaultCapacity(state.prestigeSystem)
  const owned = new Set(state.inventory.map((item) => item.instanceId))
  return { valid: unique.length <= capacity && unique.every((id) => owned.has(id)), unique, capacity }
}

export function cloneVaultItems(items: SkinInstance[]) { return items.map((item) => ({ ...item, pattern: item.pattern ? { ...item.pattern } : undefined })) }
