export type WorkMiniGameId = 'poopCleaning' | 'sortBoxes' | 'precisionStrike' | 'memoryCircuit'

export interface WorkMiniGameDefinition {
  cooldownMs: number
  id: WorkMiniGameId
  name: string
  performanceMaxMultiplier: number
  performanceMinMultiplier: number
  reward: number
}

export type WorkMiniGameCooldowns = Partial<Record<WorkMiniGameId, number>>

export const WORK_MINIGAMES: WorkMiniGameDefinition[] = [
  {
    cooldownMs: 3 * 60 * 1_000,
    id: 'poopCleaning',
    name: 'Poop Cleaning',
    performanceMaxMultiplier: 1,
    performanceMinMultiplier: 1,
    reward: 10,
  },
  {
    cooldownMs: 20 * 60 * 1_000,
    id: 'sortBoxes',
    name: 'Sort Boxes',
    performanceMaxMultiplier: 1,
    performanceMinMultiplier: 1,
    reward: 20,
  },
  {
    cooldownMs: 8 * 60 * 1_000,
    id: 'precisionStrike',
    name: 'Precision Strike',
    performanceMaxMultiplier: 1.35,
    performanceMinMultiplier: 0.65,
    reward: 14,
  },
  {
    cooldownMs: 15 * 60 * 1_000,
    id: 'memoryCircuit',
    name: 'Memory Circuit',
    performanceMaxMultiplier: 1.3,
    performanceMinMultiplier: 0.7,
    reward: 18,
  },
]

export const workMiniGamesById = new Map(WORK_MINIGAMES.map((game) => [game.id, game]))

export function normalizeWorkPerformance(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.min(1, Math.max(0, value ?? 1))
}

export function getWorkPerformanceMultiplier(gameId: WorkMiniGameId, performance?: number) {
  const definition = workMiniGamesById.get(gameId)

  if (!definition || definition.performanceMaxMultiplier === definition.performanceMinMultiplier) {
    return 1
  }

  const normalizedPerformance = normalizeWorkPerformance(performance)

  return definition.performanceMinMultiplier +
    (definition.performanceMaxMultiplier - definition.performanceMinMultiplier) * normalizedPerformance
}

export function getWorkBaseReward(gameId: WorkMiniGameId, performance?: number) {
  const definition = workMiniGamesById.get(gameId)

  return definition ? definition.reward * getWorkPerformanceMultiplier(gameId, performance) : 0
}

export function getWorkMiniGameCooldownRemaining(
  gameId: WorkMiniGameId,
  now: number,
  cooldowns: WorkMiniGameCooldowns,
) {
  const definition = workMiniGamesById.get(gameId)

  if (!definition) {
    return 0
  }

  const completedAt = cooldowns[gameId] ?? 0

  return Math.max(0, completedAt + definition.cooldownMs - now)
}

export function formatWorkCooldown(value: number) {
  const totalSeconds = Math.ceil(value / 1_000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
