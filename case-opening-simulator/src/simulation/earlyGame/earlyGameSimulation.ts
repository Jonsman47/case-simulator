import { CASE_DEFINITIONS } from '../../data/cases'
import { pickDrop } from '../../data/dropLogic'
import { SKIN_DEFINITIONS } from '../../data/skins'
import { getMarketAdjustedSkinConditionPrice } from '../../data/skinPrices'
import { applyWearMultiplier, getWearConditionForFloat, randomFloatForSkin } from '../../utils/wear'
import { applyPatternPremium, classifySkinPattern, generatePaintSeed } from '../../utils/skinPatterns'
import { createInitialMarketValues } from '../../market/marketSimulation'
import { createSimulationRandom, deriveSimulationSeed } from '../careerEconomy/seededRandom'

export type EarlyGamePlaystyle = 'opening-first' | 'balanced' | 'trader-secondary' | 'collector' | 'poor-decisions'

export interface EarlyGameCheckpoint {
  activeMinutes: number
  bankrupt: boolean
  casesOpened: number
  cash: number
  careerXp: number
  discoveries: number
  fundingEarned: number
  fundingSpent: number
  inventoryValue: number
  longestRecoveryWaitMinutes: number
  minute: number
  objectivesCompleted: number
  upgradesPurchased: number
  waitingMinutes: number
}

export interface EarlyGameScenarioResult {
  checkpoints: EarlyGameCheckpoint[]
  playstyle: EarlyGamePlaystyle
  runs: number
}

const checkpointMinutes = [15, 30, 60, 120]
const styles: Record<EarlyGamePlaystyle, { openingEvery: number; sellRate: number; workIncomePerMinute: number; tradeIncomePerMinute: number }> = {
  'opening-first': { openingEvery: 1, sellRate: 0.93, workIncomePerMinute: 0.25, tradeIncomePerMinute: 0 },
  balanced: { openingEvery: 2, sellRate: 0.91, workIncomePerMinute: 0.8, tradeIncomePerMinute: 0.15 },
  'trader-secondary': { openingEvery: 3, sellRate: 0.9, workIncomePerMinute: 0.35, tradeIncomePerMinute: 0.75 },
  collector: { openingEvery: 3, sellRate: 0.35, workIncomePerMinute: 0.65, tradeIncomePerMinute: 0.1 },
  'poor-decisions': { openingEvery: 1, sellRate: 0.4, workIncomePerMinute: 0.15, tradeIncomePerMinute: 0 },
}

function round(value: number) {
  return Number(value.toFixed(2))
}

export function runEarlyGameScenario(playstyle: EarlyGamePlaystyle, runs = 500, seed = 0xC52E_EA21): EarlyGameScenarioResult {
  const style = styles[playstyle]
  const marketValues = createInitialMarketValues()
  const skinsById = new Map(SKIN_DEFINITIONS.map((skin) => [skin.id, skin]))
  const eligibleCases = CASE_DEFINITIONS
    .filter((caseDef) => caseDef.cost > 0 && caseDef.cost <= 5 && caseDef.dropTable.length > 0)
    .sort((left, right) => left.cost - right.cost)
  const openingCases = [eligibleCases[0], eligibleCases.at(-1)].filter((caseDef) => caseDef !== undefined)
  const aggregates = new Map(checkpointMinutes.map((minute) => [minute, {
    activeMinutes: 0, bankrupt: 0, casesOpened: 0, cash: 0, careerXp: 0, discoveries: 0,
    fundingEarned: 0, fundingSpent: 0, inventoryValue: 0, longestRecoveryWaitMinutes: 0,
    objectivesCompleted: 0, upgradesPurchased: 0, waitingMinutes: 0,
  }]))

  for (let run = 0; run < runs; run += 1) {
    const rng = createSimulationRandom(deriveSimulationSeed(seed + run, playstyle))
    let cash = 100
    let credits = 0
    let fundingEarned = 0
    let fundingSpent = 0
    let casesOpened = 0
    let careerXp = 0
    let inventoryValue = 0
    let upgradesPurchased = 0
    let activeMinutes = 0
    let waitingMinutes = 0
    let recoveryWait = 0
    let longestRecoveryWait = 0
    const discoveries = new Set<string>()
    const completedObjectives = new Set<string>()
    const openedCaseIds = new Set<string>()

    for (let minute = 1; minute <= 120; minute += 1) {
      let acted = false
      cash += style.workIncomePerMinute + (minute >= 30 ? style.tradeIncomePerMinute : 0)
      if (style.workIncomePerMinute + (minute >= 30 ? style.tradeIncomePerMinute : 0) > 0.4) acted = true

      if (minute % style.openingEvery === 0 && openingCases.length > 0) {
        const caseDef = playstyle === 'poor-decisions' && casesOpened >= 3
          ? openingCases.at(-1)!
          : casesOpened >= 5
            ? openingCases[casesOpened % openingCases.length]
            : openingCases[0]
        const maximumCredit = Math.min(credits, caseDef.cost * 0.35, 1.25)
        const cashCost = caseDef.cost - maximumCredit
        if (cash >= cashCost) {
          cash -= cashCost
          credits -= maximumCredit
          fundingSpent += maximumCredit
          casesOpened += 1
          openedCaseIds.add(caseDef.id)
          acted = true
          recoveryWait = 0
          const skin = skinsById.get(pickDrop(caseDef.dropTable, rng.next))
          if (skin) {
            const floatValue = randomFloatForSkin(skin, rng.next)
            const wear = getWearConditionForFloat(skin, floatValue)
            const baseValue = marketValues[skin.id] ?? skin.baseValue
            const fallback = applyWearMultiplier(baseValue, wear, floatValue)
            const conditionValue = getMarketAdjustedSkinConditionPrice({ fallbackValue: fallback, isStatTrak: false, isSouvenir: false, marketValues, skin, wear }) ?? fallback
            const value = applyPatternPremium(conditionValue, classifySkinPattern(skin, generatePaintSeed(rng.next)))
            const isDiscovery = !discoveries.has(skin.id)
            discoveries.add(skin.id)
            careerXp += 12 + (isDiscovery ? 25 : 0)
            inventoryValue += value * (1 - style.sellRate)
            cash += value * style.sellRate
          }

          const objectiveAwards: Array<[string, boolean, number]> = [
            ['open-three', casesOpened >= 3, 2],
            ['two-sessions', casesOpened >= 2, 1.5],
            ['two-cases', openedCaseIds.size >= 2, 1.5],
            ['two-discoveries', discoveries.size >= 2, 2],
          ]
          for (const [id, complete, award] of objectiveAwards) {
            if (complete && !completedObjectives.has(id)) {
              completedObjectives.add(id)
              const granted = Math.min(20 - credits, award)
              credits += granted
              fundingEarned += granted
            }
          }
        } else {
          recoveryWait += 1
          longestRecoveryWait = Math.max(longestRecoveryWait, recoveryWait)
        }
      }

      if (upgradesPurchased === 0 && minute >= 30 && cash >= 300) {
        cash -= 300
        upgradesPurchased = 1
        acted = true
      }

      if (acted) activeMinutes += 1
      else waitingMinutes += 1

      if (checkpointMinutes.includes(minute)) {
        const aggregate = aggregates.get(minute)!
        aggregate.activeMinutes += activeMinutes
        aggregate.bankrupt += cash < 0.2 && inventoryValue < 0.2 ? 1 : 0
        aggregate.casesOpened += casesOpened
        aggregate.cash += cash
        aggregate.careerXp += careerXp
        aggregate.discoveries += discoveries.size
        aggregate.fundingEarned += fundingEarned
        aggregate.fundingSpent += fundingSpent
        aggregate.inventoryValue += inventoryValue
        aggregate.longestRecoveryWaitMinutes += longestRecoveryWait
        aggregate.objectivesCompleted += completedObjectives.size
        aggregate.upgradesPurchased += upgradesPurchased
        aggregate.waitingMinutes += waitingMinutes
      }
    }
  }

  return {
    playstyle,
    runs,
    checkpoints: checkpointMinutes.map((minute) => {
      const aggregate = aggregates.get(minute)!
      return {
        minute,
        activeMinutes: round(aggregate.activeMinutes / runs),
        bankrupt: aggregate.bankrupt / runs >= 0.5,
        casesOpened: round(aggregate.casesOpened / runs),
        cash: round(aggregate.cash / runs),
        careerXp: round(aggregate.careerXp / runs),
        discoveries: round(aggregate.discoveries / runs),
        fundingEarned: round(aggregate.fundingEarned / runs),
        fundingSpent: round(aggregate.fundingSpent / runs),
        inventoryValue: round(aggregate.inventoryValue / runs),
        longestRecoveryWaitMinutes: round(aggregate.longestRecoveryWaitMinutes / runs),
        objectivesCompleted: round(aggregate.objectivesCompleted / runs),
        upgradesPurchased: round(aggregate.upgradesPurchased / runs),
        waitingMinutes: round(aggregate.waitingMinutes / runs),
      }
    }),
  }
}

export function runAllEarlyGameScenarios(runs = 500) {
  return (Object.keys(styles) as EarlyGamePlaystyle[]).map((style) => runEarlyGameScenario(style, runs))
}
