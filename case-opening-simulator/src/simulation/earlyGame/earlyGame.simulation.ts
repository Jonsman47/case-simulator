import { describe, expect, it } from 'vitest'
import { runAllEarlyGameScenarios } from './earlyGameSimulation'

describe('deterministic early-game scenarios', () => {
  it('measures the 15/30/60/120-minute loop for five viable playstyles', () => {
    const results = runAllEarlyGameScenarios(500)
    console.log(`EARLY_GAME_SIMULATION_RESULT=${JSON.stringify({ version: 1, runsPerPlaystyle: 500, results })}`)
    expect(results).toHaveLength(5)
    expect(results.every((result) => result.checkpoints.map((row) => row.minute).join(',') === '15,30,60,120')).toBe(true)
    expect(results.every((result) => result.checkpoints.at(-1)!.casesOpened > 0)).toBe(true)
    expect(results.every((result) => !result.checkpoints.at(-1)!.bankrupt)).toBe(true)
  }, 120_000)
})
