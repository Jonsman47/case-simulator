import { describe, expect, it } from 'vitest'
import { defaultGameState } from '../data/gameState'
import { createPrestigeRecoveryProof } from '../prestige/prestigeSystem'
import { loadPrestigeRecoveryBackup, PRESTIGE_RECOVERY_STORAGE_KEY, writeAndVerifyPrestigeRecovery } from './prestigeRecovery'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

describe('Prestige recovery storage', () => {
  it('writes, parses, and verifies an exact current-run snapshot', () => {
    const storage = memoryStorage()
    const state = { ...defaultGameState, money: 12_345 }
    const recovery = writeAndVerifyPrestigeRecovery(state, storage)
    expect(recovery.proof).toBe(createPrestigeRecoveryProof(state))
    expect(recovery.state.money).toBe(12_345)
    expect(loadPrestigeRecoveryBackup(storage)?.proof).toBe(recovery.proof)
  })

  it('fails closed when storage returns stale or corrupted bytes', () => {
    const stale = JSON.stringify({ version: 39, savedAt: 1, state: defaultGameState })
    const storage = {
      setItem: () => undefined,
      getItem: () => stale,
    }
    expect(() => writeAndVerifyPrestigeRecovery({ ...defaultGameState, money: 9_999 }, storage)).toThrow('does not match')
    expect(() => loadPrestigeRecoveryBackup({ getItem: () => '{broken' })).toThrow()
  })

  it('uses a dedicated key and never mutates the snapshot while loading', () => {
    const storage = memoryStorage()
    writeAndVerifyPrestigeRecovery(defaultGameState, storage)
    const before = storage.getItem(PRESTIGE_RECOVERY_STORAGE_KEY)
    loadPrestigeRecoveryBackup(storage)
    expect(storage.getItem(PRESTIGE_RECOVERY_STORAGE_KEY)).toBe(before)
  })
})
