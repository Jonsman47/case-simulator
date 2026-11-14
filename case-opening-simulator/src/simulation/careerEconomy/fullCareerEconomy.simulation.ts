import { describe, expect, it } from 'vitest'
import { CASE_DEFINITIONS } from '../../data/cases'
import { SKIN_DEFINITIONS } from '../../data/skins'
import { createInitialMarketValues } from '../../market/marketSimulation'
import { auditCareerUpgrades, auditEmployeeEconomy, getFiveTierMasteryHours, runCareerSimulations, selectRepresentativeCases, simulatePatternAwareCaseEconomy } from './index'

const FULL_SIMULATION_SEED = 0xC52E_5008

describe('full deterministic Career economy simulation', () => {
  it('runs the documented large career, case, upgrade and employee samples', () => {
    const startedAt = performance.now()
    const careerResults = runCareerSimulations({ seed: FULL_SIMULATION_SEED, careersPerCombination: 10_000, maximumEngagedHours: 800 })
    const marketValues = createInitialMarketValues()
    const representativeCases = selectRepresentativeCases(CASE_DEFINITIONS, SKIN_DEFINITIONS)
    const caseResults = representativeCases.map((caseDef, index) => simulatePatternAwareCaseEconomy({
      caseDef,
      iterations: 100_000,
      marketValues,
      seed: FULL_SIMULATION_SEED + index * 7_919,
      skins: SKIN_DEFINITIONS,
    }))
    const upgrades = auditCareerUpgrades()
    const employees = auditEmployeeEconomy()
    const regular = careerResults.find((entry) => entry.profile === 'regular' && entry.quality === 'competent')!
    const output = {
      version: 1,
      seed: FULL_SIMULATION_SEED,
      careerSamples: careerResults.reduce((sum, entry) => sum + entry.sampleSize, 0),
      careerResults,
      caseSamples: caseResults.reduce((sum, entry) => sum + entry.iterations, 0),
      caseResults,
      upgradeRows: upgrades.length,
      employeeRows: employees.length,
      competentRegularFiveTierMastery: getFiveTierMasteryHours(regular.xpPerHour.median),
      elapsedMilliseconds: Number((performance.now() - startedAt).toFixed(2)),
    }
    console.log(`CAREER_ECONOMY_SIMULATION_RESULT=${JSON.stringify(output)}`)
    expect(output.careerSamples).toBe(300_000)
    expect(output.caseSamples).toBeGreaterThanOrEqual(400_000)
    expect(upgrades).toHaveLength(95)
    expect(employees).toHaveLength(45)
  }, 120_000)
})
