import { Rarity, type SkinBase, type WearCondition } from './models'
import type { ImportedSkinDefinition } from './importedAssetTypes'
import type { Prng } from './dropLogic'
import { randomFloatForCondition, randomWearConditionForSkin } from '../utils/wear'
import { applyExternalSkinPrices } from './skinPrices'

const PLACEHOLDER_SKIN_IMAGE = '/assets/placeholder.png'
const generatedSkinModules = import.meta.glob<{
  SKIN_DEFINITIONS: ImportedSkinDefinition[]
}>('./generated/skins.generated.ts', { eager: true })

export const PLACEHOLDER_SKIN_DEFINITIONS: SkinBase[] = [
  {
    id: 'p250_sand_dune',
    weapon: 'P250',
    finish: 'Sand Dune',
    rarity: Rarity.Consumer,
    baseValue: 0.03,
    caseIds: ['starter_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
  },
  {
    id: 'nova_predator',
    weapon: 'Nova',
    finish: 'Predator',
    rarity: Rarity.Consumer,
    baseValue: 0.04,
    caseIds: ['starter_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
  },
  {
    id: 'mp7_army_recon',
    weapon: 'MP7',
    finish: 'Army Recon',
    rarity: Rarity.Consumer,
    baseValue: 0.05,
    caseIds: ['starter_case', 'fracture_style_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
  },
  {
    id: 'galil_ar_blue_titanium',
    weapon: 'Galil AR',
    finish: 'Blue Titanium',
    rarity: Rarity.Industrial,
    baseValue: 0.35,
    caseIds: ['starter_case', 'fracture_style_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
  },
  {
    id: 'tec9_ice_cap',
    weapon: 'Tec-9',
    finish: 'Ice Cap',
    rarity: Rarity.Industrial,
    baseValue: 0.45,
    caseIds: ['fracture_style_case', 'revolution_style_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
    statTrak: true,
  },
  {
    id: 'ssg08_abyss',
    weapon: 'SSG 08',
    finish: 'Abyss',
    rarity: Rarity.MilSpec,
    baseValue: 1.05,
    caseIds: ['fracture_style_case', 'legacy_rare_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
    statTrak: true,
  },
  {
    id: 'p90_elite_build',
    weapon: 'P90',
    finish: 'Elite Build',
    rarity: Rarity.MilSpec,
    baseValue: 0.9,
    caseIds: ['starter_case', 'revolution_style_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
    statTrak: true,
  },
  {
    id: 'glock18_moonrise',
    weapon: 'Glock-18',
    finish: 'Moonrise',
    rarity: Rarity.Restricted,
    baseValue: 1.45,
    caseIds: ['starter_case', 'kilowatt_style_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
    statTrak: true,
  },
  {
    id: 'usp_s_ticket_to_hell',
    weapon: 'USP-S',
    finish: 'Ticket to Hell',
    rarity: Rarity.Restricted,
    baseValue: 1.2,
    caseIds: ['fracture_style_case', 'revolution_style_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
    statTrak: true,
  },
  {
    id: 'desert_eagle_mecha_industries',
    weapon: 'Desert Eagle',
    finish: 'Mecha Industries',
    rarity: Rarity.Classified,
    baseValue: 6.75,
    caseIds: ['kilowatt_style_case', 'legacy_rare_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
    statTrak: true,
  },
  {
    id: 'ak47_redline',
    weapon: 'AK-47',
    finish: 'Redline',
    rarity: Rarity.Classified,
    baseValue: 42.5,
    caseIds: ['legacy_rare_case', 'ultra_legacy_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
    statTrak: true,
  },
  {
    id: 'm4a1_s_printstream',
    weapon: 'M4A1-S',
    finish: 'Printstream',
    rarity: Rarity.Covert,
    baseValue: 183.2,
    caseIds: ['revolution_style_case', 'kilowatt_style_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
    statTrak: true,
  },
  {
    id: 'awp_asiimov',
    weapon: 'AWP',
    finish: 'Asiimov',
    rarity: Rarity.Covert,
    baseValue: 129.75,
    caseIds: ['legacy_rare_case', 'ultra_legacy_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
    statTrak: true,
  },
  {
    id: 'famas_meow_36',
    weapon: 'FAMAS',
    finish: 'Meow 36',
    rarity: Rarity.MilSpec,
    baseValue: 0.65,
    caseIds: ['starter_case', 'kilowatt_style_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
    statTrak: true,
  },
  {
    id: 'mp9_food_chain',
    weapon: 'MP9',
    finish: 'Food Chain',
    rarity: Rarity.Classified,
    baseValue: 8.4,
    caseIds: ['fracture_style_case', 'kilowatt_style_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
    statTrak: true,
  },
  {
    id: 'mac10_neon_rider',
    weapon: 'MAC-10',
    finish: 'Neon Rider',
    rarity: Rarity.Covert,
    baseValue: 11.8,
    caseIds: ['revolution_style_case', 'ultra_legacy_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
    statTrak: true,
  },
  {
    id: 'm4a4_howl',
    weapon: 'M4A4',
    finish: 'Howl',
    rarity: Rarity.Contraband,
    baseValue: 5000,
    caseIds: ['ultra_legacy_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
  },
  {
    id: 'ump45_primal_saber',
    weapon: 'UMP-45',
    finish: 'Primal Saber',
    rarity: Rarity.Classified,
    baseValue: 5.2,
    caseIds: ['starter_case', 'fracture_style_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
    statTrak: true,
  },
  {
    id: 'karambit_doppler',
    weapon: 'Karambit',
    finish: 'Doppler',
    rarity: Rarity.SpecialItem,
    baseValue: 1890,
    caseIds: ['fracture_style_case', 'legacy_rare_case', 'ultra_legacy_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
  },
  {
    id: 'specialist_gloves_fade',
    weapon: 'Specialist Gloves',
    finish: 'Fade',
    rarity: Rarity.SpecialItem,
    baseValue: 720,
    caseIds: ['starter_case', 'revolution_style_case', 'kilowatt_style_case'],
    image: PLACEHOLDER_SKIN_IMAGE,
  },
]

const shouldUseGeneratedSkinDefinitions = import.meta.env.MODE !== 'test'
const generatedSkinDefinitions = shouldUseGeneratedSkinDefinitions
  ? Object.values(generatedSkinModules)[0]?.SKIN_DEFINITIONS ?? []
  : []

export const USING_GENERATED_SKIN_DEFINITIONS = generatedSkinDefinitions.length > 0
const shouldApplyExternalSkinPrices = import.meta.env.MODE !== 'test'

const rawSkinDefinitions: SkinBase[] = USING_GENERATED_SKIN_DEFINITIONS
  ? generatedSkinDefinitions
  : PLACEHOLDER_SKIN_DEFINITIONS

export const SKIN_DEFINITIONS: SkinBase[] = shouldApplyExternalSkinPrices
  ? applyExternalSkinPrices(rawSkinDefinitions)
  : rawSkinDefinitions

// Placeholder seed data only. Production builds import CS2 metadata and hydrate
// matching base prices from Skins_Price.csv while preserving fallback values.
export function randomWearCondition(randomValue = Math.random()) {
  return randomWearConditionForSkin(SKIN_DEFINITIONS[0], () => randomValue)
}

export function randomFloatForWear(condition: WearCondition, randomValue = Math.random()) {
  return randomFloatForCondition(condition, () => randomValue)
}

export function getRandomSkinDefinition(prngOrValue: Prng | number = Math.random) {
  const randomValue = typeof prngOrValue === 'function' ? prngOrValue() : prngOrValue
  const index = Math.floor(randomValue * SKIN_DEFINITIONS.length)

  return SKIN_DEFINITIONS[Math.min(index, SKIN_DEFINITIONS.length - 1)]
}
