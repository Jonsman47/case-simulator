import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

function readSessionValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const stored = window.sessionStorage.getItem(key)
    return stored === null ? fallback : JSON.parse(stored) as T
  } catch {
    return fallback
  }
}

export function useSessionStorageState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readSessionValue(key, initialValue))

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Session persistence is an optional UX enhancement. Storage failures
      // must never interrupt gameplay or mutate authoritative game state.
    }
  }, [key, value])

  return [value, setValue]
}
