import { getCumulativeXpForLevel } from '../../career/careerProgress'
import { deriveSimulationSeed, createSimulationRandom } from './seededRandom'
import { summarizeDistribution, type DistributionSummary } from './statistics'

export type CareerProfileId =
  | 'casual'
  | 'regular'
  | 'dedicated'
  | 'expertTrader'
  | 'openingFocused'
  | 'collector'
  | 'tradeUpSpecialist'
  | 'businessSpecialist'
  | 'patternHunter'
  | 'automationHeavy'

export type DecisionQuality = 'novice' | 'competent' | 'expert'

export interface CareerProfile {
  id: CareerProfileId
  label: string
  activeHoursPerDay: number
  offlineHoursPerActiveHour: number
  xpPerActiveHour: number
  cashPerActiveHour: number
  cashVolatility: number
  idleFraction: number
}

export interface CareerSimulationConfig {
  seed: number
  careersPerCombination: number
  maximumEngagedHours: number
}

export interface CareerCombinationResult {
  profile: CareerProfileId
  quality: DecisionQuality
  sampleSize: number
  hoursToLevel15: DistributionSummary
  hoursToFirstPrestige: DistributionSummary
  hoursToLevel100: DistributionSummary
  netWorthAt800Hours: DistributionSummary
  xpPerHour: DistributionSummary
  bankruptcyRate: number
  stallRate: number
  elapsedDaysToFirstPrestige: DistributionSummary
}

export const CAREER_SIMULATION_PROFILES: readonly CareerProfile[] = [
  { id: 'casual', label: 'Casual', activeHoursPerDay: 0.5, offlineHoursPerActiveHour: 3, xpPerActiveHour: 1_500, cashPerActiveHour: 180, cashVolatility: 0.45, idleFraction: 0.2 },
  { id: 'regular', label: 'Regular', activeHoursPerDay: 1.5, offlineHoursPerActiveHour: 2, xpPerActiveHour: 2_750, cashPerActiveHour: 520, cashVolatility: 0.35, idleFraction: 0.12 },
  { id: 'dedicated', label: 'Dedicated', activeHoursPerDay: 4, offlineHoursPerActiveHour: 1.2, xpPerActiveHour: 3_850, cashPerActiveHour: 850, cashVolatility: 0.32, idleFraction: 0.08 },
  { id: 'expertTrader', label: 'Expert trader', activeHoursPerDay: 3, offlineHoursPerActiveHour: 0.8, xpPerActiveHour: 4_600, cashPerActiveHour: 1_650, cashVolatility: 0.55, idleFraction: 0.06 },
  { id: 'openingFocused', label: 'Opening-focused', activeHoursPerDay: 2, offlineHoursPerActiveHour: 1.8, xpPerActiveHour: 2_350, cashPerActiveHour: -90, cashVolatility: 1.1, idleFraction: 0.1 },
  { id: 'collector', label: 'Collector', activeHoursPerDay: 2, offlineHoursPerActiveHour: 1.4, xpPerActiveHour: 3_050, cashPerActiveHour: 170, cashVolatility: 0.6, idleFraction: 0.1 },
  { id: 'tradeUpSpecialist', label: 'Trade-up specialist', activeHoursPerDay: 2.5, offlineHoursPerActiveHour: 1, xpPerActiveHour: 3_250, cashPerActiveHour: 620, cashVolatility: 0.7, idleFraction: 0.09 },
  { id: 'businessSpecialist', label: 'Business specialist', activeHoursPerDay: 2, offlineHoursPerActiveHour: 3.5, xpPerActiveHour: 3_000, cashPerActiveHour: 430, cashVolatility: 0.4, idleFraction: 0.14 },
  { id: 'patternHunter', label: 'Pattern hunter', activeHoursPerDay: 2.5, offlineHoursPerActiveHour: 1.3, xpPerActiveHour: 2_850, cashPerActiveHour: 720, cashVolatility: 1.25, idleFraction: 0.16 },
  { id: 'automationHeavy', label: 'Automation-heavy', activeHoursPerDay: 0.75, offlineHoursPerActiveHour: 8, xpPerActiveHour: 1_350, cashPerActiveHour: 240, cashVolatility: 0.3, idleFraction: 0.35 },
] as const

const qualityXpMultiplier: Record<DecisionQuality, number> = { novice: 0.76, competent: 1, expert: 1.2 }
const qualityCashMultiplier: Record<DecisionQuality, number> = { novice: 0.42, competent: 1, expert: 1.42 }
const decisionQualities: readonly DecisionQuality[] = ['novice', 'competent', 'expert']

function rounded(value: number) {
  return Number(value.toFixed(2))
}

/**
 * Aggregate model: activity rates are calibrated from production XP awards,
 * cooldowns, operation caps and transaction fees. It does not predict hidden
 * seller reservations or future RNG. Stochastic variation represents session
 * mix and market availability, not privileged information.
 */
export function runCareerSimulations(config: CareerSimulationConfig): CareerCombinationResult[] {
  const level15Xp = getCumulativeXpForLevel(15)
  const firstPrestigeXp = getCumulativeXpForLevel(25)
  const level100Xp = getCumulativeXpForLevel(100)
  const results: CareerCombinationResult[] = []

  for (const profile of CAREER_SIMULATION_PROFILES) {
    for (const quality of decisionQualities) {
      const rng = createSimulationRandom(deriveSimulationSeed(config.seed, `${profile.id}:${quality}`))
      const level15Hours: number[] = []
      const firstPrestigeHours: number[] = []
      const level100Hours: number[] = []
      const netWorthAt800: number[] = []
      const xpRates: number[] = []
      const firstPrestigeDays: number[] = []
      let bankruptcies = 0
      let stalls = 0

      for (let index = 0; index < config.careersPerCombination; index += 1) {
        const rateNoise = Math.max(0.55, rng.normal(1, 0.13))
        const xpRate = Math.max(100, profile.xpPerActiveHour * qualityXpMultiplier[quality] * rateNoise * (1 - profile.idleFraction * 0.35))
        const marketShock = rng.normal(1, profile.cashVolatility)
        const qualityCash = profile.cashPerActiveHour >= 0
          ? profile.cashPerActiveHour * qualityCashMultiplier[quality]
          : profile.cashPerActiveHour * (quality === 'expert' ? 0.75 : quality === 'novice' ? 1.35 : 1)
        const hourlyCash = qualityCash * marketShock
        const employeeUnlock = level15Xp / xpRate
        const firstPrestige = firstPrestigeXp / xpRate
        const level100 = level100Xp / xpRate
        const passiveContribution = Math.max(0, profile.cashPerActiveHour) * 0.08 * profile.offlineHoursPerActiveHour
        const netWorth = Math.max(0, 100 + 800 * (hourlyCash + passiveContribution))
        const recoveryFloor = profile.id === 'openingFocused' ? 45 : 20

        level15Hours.push(employeeUnlock)
        firstPrestigeHours.push(firstPrestige)
        level100Hours.push(level100)
        netWorthAt800.push(netWorth)
        xpRates.push(xpRate)
        firstPrestigeDays.push(firstPrestige / profile.activeHoursPerDay)
        if (hourlyCash < -recoveryFloor && rng.next() < Math.min(0.8, Math.abs(hourlyCash) / 1_000)) bankruptcies += 1
        if (firstPrestige > config.maximumEngagedHours || netWorth <= 0 && firstPrestige > 100) stalls += 1
      }

      results.push({
        profile: profile.id,
        quality,
        sampleSize: config.careersPerCombination,
        hoursToLevel15: summarizeDistribution(level15Hours),
        hoursToFirstPrestige: summarizeDistribution(firstPrestigeHours),
        hoursToLevel100: summarizeDistribution(level100Hours),
        netWorthAt800Hours: summarizeDistribution(netWorthAt800),
        xpPerHour: summarizeDistribution(xpRates),
        bankruptcyRate: rounded(bankruptcies / config.careersPerCombination),
        stallRate: rounded(stalls / config.careersPerCombination),
        elapsedDaysToFirstPrestige: summarizeDistribution(firstPrestigeDays),
      })
    }
  }
  return results
}

export function getFiveTierMasteryHours(xpPerHour: number) {
  const levelGates = [25, 30, 36, 45, 55]
  const acceleration = [1, 1.1, 1.2, 1.3, 1.4]
  const tiers = levelGates.map((level, index) => ({
    tier: index + 1,
    level,
    hours: rounded(getCumulativeXpForLevel(level) / (xpPerHour * acceleration[index])),
  }))
  return {
    tiers,
    cumulativeHours: rounded(tiers.reduce((sum, tier) => sum + tier.hours, 0)),
  }
}
