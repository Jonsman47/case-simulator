import type { GameState } from '../data/gameState'
import { createPrestigeRecoveryProof } from '../prestige/prestigeSystem'
import { parseGameSaveText, serializeGameState } from './save'

export const PRESTIGE_RECOVERY_STORAGE_KEY = 'case-opening-simulator:prestige-recovery:latest'

export interface PrestigeRecoveryBackup {
  proof: string
  state: GameState
}

export function writeAndVerifyPrestigeRecovery(
  state: GameState,
  storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage,
): PrestigeRecoveryBackup {
  const serialized = serializeGameState(state)
  const expectedProof = createPrestigeRecoveryProof(state)
  storage.setItem(PRESTIGE_RECOVERY_STORAGE_KEY, serialized)
  const readBack = storage.getItem(PRESTIGE_RECOVERY_STORAGE_KEY)
  if (!readBack) throw new Error('Prestige recovery backup could not be read back from storage.')
  const restored = parseGameSaveText(readBack)
  const actualProof = createPrestigeRecoveryProof(restored)
  if (actualProof !== expectedProof) throw new Error('Prestige recovery backup does not match the current run.')
  return { proof: actualProof, state: restored }
}

export function loadPrestigeRecoveryBackup(
  storage: Pick<Storage, 'getItem'> = window.localStorage,
): PrestigeRecoveryBackup | undefined {
  const serialized = storage.getItem(PRESTIGE_RECOVERY_STORAGE_KEY)
  if (!serialized) return undefined
  const state = parseGameSaveText(serialized)
  return { proof: createPrestigeRecoveryProof(state), state }
}

export function clearPrestigeRecoveryBackup(
  storage: Pick<Storage, 'removeItem'> = window.localStorage,
) {
  storage.removeItem(PRESTIGE_RECOVERY_STORAGE_KEY)
}
