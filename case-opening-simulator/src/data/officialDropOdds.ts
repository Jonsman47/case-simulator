import { Rarity, type CaseDefinition, type SkinBase } from './models'

export interface OfficialRarityDropOdd {
  probability: number
  rarity: Rarity
}

// Official CS weapon-case rarity odds disclosed through Perfect World/Valve regional compliance.
// Ratios are 1:5 between adjacent weapon rarities, with Rare Special at 2:5 of Covert.
export const OFFICIAL_WEAPON_CASE_RARITY_ODDS: OfficialRarityDropOdd[] = [
  { rarity: Rarity.MilSpec, probability: 125 / 156.4 * 100 },
  { rarity: Rarity.Restricted, probability: 25 / 156.4 * 100 },
  { rarity: Rarity.Classified, probability: 5 / 156.4 * 100 },
  { rarity: Rarity.Covert, probability: 1 / 156.4 * 100 },
  { rarity: Rarity.SpecialItem, probability: .4 / 156.4 * 100 },
]

export function getOfficialWeaponCaseRarityOdds() {
  return OFFICIAL_WEAPON_CASE_RARITY_ODDS
}

const officialOddsByRarity = new Map(
  OFFICIAL_WEAPON_CASE_RARITY_ODDS.map(({ rarity, probability }) => [rarity, probability / 100]),
)

/** Reweights a standard weapon case while preserving relative within-tier odds. */
export function applyOfficialWeaponCaseOdds(
  dropTable: CaseDefinition['dropTable'],
  skinsById: ReadonlyMap<string, Pick<SkinBase, 'rarity'>>,
) {
  const totals = new Map<Rarity, number>()
  for (const drop of dropTable) {
    const rarity = skinsById.get(drop.skinId)?.rarity
    if (rarity) totals.set(rarity, (totals.get(rarity) ?? 0) + Math.max(0, drop.weight))
  }
  if (!OFFICIAL_WEAPON_CASE_RARITY_ODDS.every(({ rarity }) => (totals.get(rarity) ?? 0) > 0)) {
    return dropTable.map((drop) => ({ ...drop }))
  }
  return dropTable.map((drop) => {
    const rarity = skinsById.get(drop.skinId)?.rarity
    const tierTotal = rarity ? totals.get(rarity) : undefined
    const tierProbability = rarity ? officialOddsByRarity.get(rarity) : undefined
    return rarity && tierTotal && tierProbability !== undefined
      ? { ...drop, weight: (Math.max(0, drop.weight) / tierTotal) * tierProbability }
      : { ...drop }
  })
}

export function getCaseRarityOdds(
  caseDef: Pick<CaseDefinition, 'dropTable'>,
  skinsById: ReadonlyMap<string, Pick<SkinBase, 'rarity'>>,
) {
  const total = caseDef.dropTable.reduce((sum, drop) => sum + Math.max(0, drop.weight), 0)
  const odds = new Map<Rarity, number>()
  if (total <= 0) return odds
  for (const drop of caseDef.dropTable) {
    const rarity = skinsById.get(drop.skinId)?.rarity
    if (rarity) odds.set(rarity, (odds.get(rarity) ?? 0) + (Math.max(0, drop.weight) / total) * 100)
  }
  return odds
}
