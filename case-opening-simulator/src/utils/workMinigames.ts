export type WorkMiniGameId = 'poopCleaning' | 'sortBoxes'

export interface WorkMiniGameDefinition {
  cooldownMs: number
  id: WorkMiniGameId
  name: string
  reward: number
}

export type WorkMiniGameCooldowns = Partial<Record<WorkMiniGameId, number>>

export const WORK_MINIGAMES: WorkMiniGameDefinition[] = [
  {
    cooldownMs: 3 * 60 * 1_000,
    id: 'poopCleaning',
    name: 'Poop Cleaning',
    reward: 10,
  },
  {
    cooldownMs: 20 * 60 * 1_000,
    id: 'sortBoxes',
    name: 'Sort Boxes',
    reward: 20,
  },
]

export const workMiniGamesById = new Map(WORK_MINIGAMES.map((game) => [game.id, game]))

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
