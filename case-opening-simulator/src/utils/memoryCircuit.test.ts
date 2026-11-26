import { describe, expect, it } from 'vitest'
import { createMemorySequence, getMemoryRoundSequence, memoryPadFrequencies } from './memoryCircuit'

describe('Memory Circuit sequence', () => {
  it('repeats the same prefix across the 3, 5, and 7 signal rounds', () => {
    let index = 0
    const values = [0, 0.25, 0.5, 0.75, 0.25, 0.5, 0.75]
    const sequence = createMemorySequence(() => values[index++])
    expect(sequence).toEqual([0, 1, 2, 3, 1, 2, 3])
    expect(getMemoryRoundSequence(sequence, 0)).toEqual([0, 1, 2])
    expect(getMemoryRoundSequence(sequence, 1)).toEqual([0, 1, 2, 3, 1])
    expect(getMemoryRoundSequence(sequence, 2)).toEqual(sequence)
  })

  it('assigns a distinct note to every visual pad', () => {
    expect(new Set(memoryPadFrequencies).size).toBe(4)
  })
})
