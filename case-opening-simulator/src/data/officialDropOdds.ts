import { Rarity } from './models'

export interface OfficialRarityDropOdd {
  probability: number
  rarity: Rarity
}

// Official CS weapon-case rarity odds disclosed through Perfect World/Valve regional compliance.
// Ratios are 1:5 between adjacent weapon rarities, with Rare Special at 2:5 of Covert.
export const OFFICIAL_WEAPON_CASE_RARITY_ODDS: OfficialRarityDropOdd[] = [
  { rarity: Rarity.MilSpec, probability: 79.92327 },
  { rarity: Rarity.Restricted, probability: 15.98465 },
  { rarity: Rarity.Classified, probability: 3.19693 },
  { rarity: Rarity.Covert, probability: 0.63939 },
  { rarity: Rarity.SpecialItem, probability: 0.25575 },
]

export function getOfficialWeaponCaseRarityOdds() {
  return OFFICIAL_WEAPON_CASE_RARITY_ODDS
}
