/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import {
  formatPoopCleanupCooldown,
  getPoopCleanupCooldownRemaining,
  POOP_CLEANUP_COOLDOWN_MS,
  POOP_CLEANUP_LAST_COMPLETED_KEY,
  readPoopCleanupLastCompleted,
  writePoopCleanupLastCompleted,
} from './poopCleanupMinigame'

function createStorageMock(): Storage {
  const store = new Map<string, string>()

  return {
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }
}

describe('poopCleanupMinigame', () => {
  it('tracks an hourly cooldown from the stored completion timestamp', () => {
    const completedAt = 1_000_000

    expect(getPoopCleanupCooldownRemaining(completedAt, 0)).toBe(0)
    expect(getPoopCleanupCooldownRemaining(completedAt + 30 * 60 * 1000, completedAt)).toBe(30 * 60 * 1000)
    expect(getPoopCleanupCooldownRemaining(completedAt + POOP_CLEANUP_COOLDOWN_MS, completedAt)).toBe(0)
  })

  it('round-trips the completion timestamp through localStorage', () => {
    const storage = createStorageMock()

    storage.removeItem(POOP_CLEANUP_LAST_COMPLETED_KEY)
    writePoopCleanupLastCompleted(123_456, storage)

    expect(readPoopCleanupLastCompleted(storage)).toBe(123_456)
  })

  it('formats cooldown time for the main menu button', () => {
    expect(formatPoopCleanupCooldown(61_000)).toBe('1:01')
    expect(formatPoopCleanupCooldown(0)).toBe('0:00')
  })
})
