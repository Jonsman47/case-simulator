export const memoryRoundLengths = [3, 5, 7] as const
export const memoryPadFrequencies = [392, 523.25, 659.25, 783.99] as const

export function createMemorySequence(random: () => number = Math.random): number[] {
  return Array.from({ length: memoryRoundLengths[2] }, () => Math.min(3, Math.max(0, Math.floor(random() * 4))))
}

export function getMemoryRoundSequence(sequence: readonly number[], round: number): number[] {
  return sequence.slice(0, memoryRoundLengths[round] ?? memoryRoundLengths[2])
}
