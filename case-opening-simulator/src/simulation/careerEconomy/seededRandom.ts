export interface SeededRandom {
  next: () => number
  normal: (mean?: number, standardDeviation?: number) => number
  integer: (minimum: number, maximum: number) => number
}

/** Mulberry32 is small, deterministic and intentionally simulation-only. */
export function createSimulationRandom(seed: number): SeededRandom {
  let state = Math.max(1, Math.floor(seed)) >>> 0
  let spareNormal: number | undefined

  const next = () => {
    state = (state + 0x6D2B79F5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }

  const normal = (mean = 0, standardDeviation = 1) => {
    if (spareNormal !== undefined) {
      const result = spareNormal
      spareNormal = undefined
      return mean + result * standardDeviation
    }
    const first = Math.max(Number.EPSILON, next())
    const second = next()
    const magnitude = Math.sqrt(-2 * Math.log(first))
    const angle = 2 * Math.PI * second
    spareNormal = magnitude * Math.sin(angle)
    return mean + magnitude * Math.cos(angle) * standardDeviation
  }

  return {
    next,
    normal,
    integer: (minimum, maximum) => {
      const low = Math.ceil(Math.min(minimum, maximum))
      const high = Math.floor(Math.max(minimum, maximum))
      return low + Math.floor(next() * (high - low + 1))
    },
  }
}

export function deriveSimulationSeed(seed: number, label: string) {
  let hash = Math.max(1, Math.floor(seed)) >>> 0
  for (let index = 0; index < label.length; index += 1) {
    hash ^= label.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0 || 1
}
