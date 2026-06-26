import { CaseStatus, Rarity, type CaseDefinition, type SkinBase } from './models'

export interface CasePricingRule {
  csFloatPrice: number
  gamePrice: number
  licenseCost?: number
  name: string
  unlockedByDefault: boolean
}

const keyCost = 2.49
const licenseCostMultiplier = 35

function price(csFloatPrice: number, unlockedByDefault = false): CasePricingRule {
  const gamePrice = Number((csFloatPrice + keyCost).toFixed(2))

  return {
    csFloatPrice,
    gamePrice,
    licenseCost: unlockedByDefault ? undefined : Number((gamePrice * licenseCostMultiplier).toFixed(2)),
    name: '',
    unlockedByDefault,
  }
}

function normalizeCaseName(name: string) {
  return name
    .toLowerCase()
    .replace(/^cs:go weapon case$/, 'cs:go weapon case 1')
    .replace(/\bweapon case\b/g, 'case')
    .replace(/[^\w:]+/g, ' ')
    .trim()
}

export const CASE_PRICING_TABLE = [
  ['Kilowatt Case', price(0.16, true)],
  ['Revolution Case', price(0.23, true)],
  ['Recoil Case', price(0.3)],
  ['Snakebite Case', price(0.47)],
  ['Fracture Case', price(0.48)],
  ['Fever Case', price(0.55)],
  ['Clutch Case', price(0.6)],
  ['Gallery Case', price(0.79)],
  ['CS20 Case', price(1.11)],
  ['Dreams & Nightmares Case', price(1.13)],
  ['Danger Zone Case', price(1.2)],
  ['Prisma 2 Case', price(1.25)],
  ['Prisma Case', price(1.27)],
  ['Falchion Case', price(1.39)],
  ['Shadow Case', price(1.53)],
  ['Horizon Case', price(1.66)],
  ['Revolver Case', price(2.58)],
  ['Spectrum 2 Case', price(2.71)],
  ['Gamma 2 Case', price(2.89)],
  ['Chroma 3 Case', price(2.94)],
  ['Gamma Case', price(3.02)],
  ['Operation Wildfire Case', price(3.05)],
  ['Chroma 2 Case', price(3.4)],
  ['Spectrum Case', price(3.53)],
  ['Operation Phoenix Case', price(3.56)],
  ['Chroma Case', price(4.61)],
  ['Operation Vanguard Case', price(5.44)],
  ['Shattered Web Case', price(5.58)],
  ['Operation Broken Fang Case', price(6.05)],
  ['Operation Breakout Case', price(7.21)],
  ['Huntsman Weapon Case', price(8.03)],
  ['Operation Riptide Case', price(9.98)],
  ['Winter Offensive Case', price(10.03)],
  ['CS:GO Weapon Case 3', price(12.55)],
  ['eSports 2014 Summer Case', price(14.77)],
  ['Glove Case', price(15.73)],
  ['CS:GO Weapon Case 2', price(20.43)],
  ['eSports 2013 Winter Case', price(23.18)],
  ['Operation Hydra Case', price(32.75)],
  ['eSports 2013 Case', price(51.65)],
  ['Operation Bravo Case', price(56.31)],
  ['CS:GO Weapon Case 1', price(119)],
] as const

export const casePricingByName = new Map(
  CASE_PRICING_TABLE.map(([name, rule]) => [
    normalizeCaseName(name),
    {
      ...rule,
      name,
    },
  ]),
)

export function getCasePricing(caseDef: CaseDefinition) {
  return casePricingByName.get(normalizeCaseName(caseDef.name))
}

function getCaseTierMultiplier(caseIndex: number, caseCount: number) {
  const progression = caseCount <= 1 ? 0 : caseIndex / (caseCount - 1)

  if (progression <= 0.18) {
    return {
      [Rarity.Consumer]: 0.86,
      [Rarity.Industrial]: 0.92,
      [Rarity.MilSpec]: 1,
      [Rarity.Restricted]: 1.16,
      [Rarity.Classified]: 1.28,
      [Rarity.Covert]: 1.34,
      [Rarity.SpecialItem]: 1.18,
      [Rarity.Contraband]: 1,
    }
  }

  if (progression <= 0.62) {
    return {
      [Rarity.Consumer]: 0.96,
      [Rarity.Industrial]: 0.98,
      [Rarity.MilSpec]: 1,
      [Rarity.Restricted]: 1.04,
      [Rarity.Classified]: 1.04,
      [Rarity.Covert]: 0.98,
      [Rarity.SpecialItem]: 0.95,
      [Rarity.Contraband]: 0.9,
    }
  }

  return {
    [Rarity.Consumer]: 1.08,
    [Rarity.Industrial]: 1.05,
    [Rarity.MilSpec]: 1,
    [Rarity.Restricted]: 0.96,
    [Rarity.Classified]: 0.9,
    [Rarity.Covert]: 0.82,
    [Rarity.SpecialItem]: 0.78,
    [Rarity.Contraband]: 0.72,
  }
}

function normalizeDropWeights(dropTable: CaseDefinition['dropTable']) {
  const totalWeight = dropTable.reduce((total, drop) => total + Math.max(0, drop.weight), 0)

  if (totalWeight <= 0) {
    return dropTable
  }

  return dropTable.map((drop) => ({
    ...drop,
    weight: Number(((Math.max(0, drop.weight) / totalWeight) * 100).toFixed(6)),
  }))
}

function balanceDropTable(
  caseDef: CaseDefinition,
  caseIndex: number,
  caseCount: number,
  skinsById: Map<string, SkinBase>,
) {
  const multipliers = getCaseTierMultiplier(caseIndex, caseCount)

  return normalizeDropWeights(
    caseDef.dropTable.map((drop) => {
      const rarity = skinsById.get(drop.skinId)?.rarity
      const multiplier = rarity ? multipliers[rarity] : 1

      return {
        ...drop,
        weight: drop.weight * multiplier,
      }
    }),
  )
}

// Pricing source: user-provided CSFloat table from CSGOSKINS.GG, dated 2026-06-24.
// The in-game open price is CSFloat case price + the $2.49 key price.
// License cost started at 20x in the source table, then was raised to 35x for the
// 500-600 hour progression target. Kilowatt and Revolution remain starter cases.
// Drop-table multipliers are deliberately rank-based: early cases get modest rare-tier help,
// middle cases stay close to imported rarity balance, and expensive cases keep rare payouts scarce.
export function applyCasePricingBalance(
  caseDefinitions: CaseDefinition[],
  skinsById: Map<string, SkinBase>,
) {
  const pricedCases: { caseDef: CaseDefinition; pricing: CasePricingRule }[] = []

  for (const caseDef of caseDefinitions) {
    const pricing = getCasePricing(caseDef)

    if (pricing) {
      pricedCases.push({ caseDef, pricing })
    }
  }

  pricedCases.sort((left, right) => left.pricing.gamePrice - right.pricing.gamePrice)

  return pricedCases.map(({ caseDef, pricing }, index) => ({
    ...caseDef,
    cost: pricing.gamePrice,
    csFloatPrice: pricing.csFloatPrice,
    caseLicenseCost: pricing.licenseCost,
    status: pricing.unlockedByDefault ? CaseStatus.Unlocked : CaseStatus.Locked,
    unlockRequirement: pricing.unlockedByDefault ? undefined : caseDef.unlockRequirement,
    dropTable: balanceDropTable(caseDef, index, pricedCases.length, skinsById),
  }))
}

export function requiresCaseLicense(caseDef: CaseDefinition) {
  return typeof caseDef.caseLicenseCost === 'number' && caseDef.caseLicenseCost > 0
}

export function getCaseLicenseCost(caseDef: CaseDefinition) {
  if (!requiresCaseLicense(caseDef)) {
    return 0
  }

  return Number((caseDef.caseLicenseCost ?? caseDef.cost * licenseCostMultiplier).toFixed(2))
}
