export const POOP_CLEANUP_REWARD = 10
export const POOP_CLEANUP_COOLDOWN_MS = 3 * 60 * 1000
// Stored separately from the main save so refreshing immediately cannot replay the recovery job.
export const POOP_CLEANUP_LAST_COMPLETED_KEY = 'case-opening-simulator:poop-cleanup:last-completed'

function getStorage(storage?: Storage | null) {
  if (storage !== undefined) {
    return storage
  }

  if (typeof window === 'undefined') {
    return undefined
  }

  return window.localStorage
}

export function readPoopCleanupLastCompleted(storage?: Storage | null) {
  try {
    const storedValue = getStorage(storage)?.getItem(POOP_CLEANUP_LAST_COMPLETED_KEY)
    const timestamp = storedValue ? Number.parseInt(storedValue, 10) : 0

    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0
  } catch {
    return 0
  }
}

export function writePoopCleanupLastCompleted(timestamp: number, storage?: Storage | null) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return
  }

  try {
    getStorage(storage)?.setItem(POOP_CLEANUP_LAST_COMPLETED_KEY, String(Math.floor(timestamp)))
  } catch {
    // Cooldown persistence is best effort; the reducer still awards only from the active UI flow.
  }
}

export function getPoopCleanupCooldownRemaining(now: number, lastCompletedAt: number) {
  if (!Number.isFinite(now) || !Number.isFinite(lastCompletedAt) || lastCompletedAt <= 0) {
    return 0
  }

  return Math.max(0, POOP_CLEANUP_COOLDOWN_MS - (now - lastCompletedAt))
}

export function formatPoopCleanupCooldown(remainingMs: number) {
  const safeRemainingMs = Math.max(0, remainingMs)
  const totalSeconds = Math.ceil(safeRemainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
