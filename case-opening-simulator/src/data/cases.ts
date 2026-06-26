import {
  buildDropTableFromRarities,
  calculateDropOdds,
  type DropOdds,
  type DropTableEntry,
} from './dropLogic'
import { CaseStatus, Rarity, type CaseDefinition } from './models'
import type { ImportedCaseDefinition } from './importedAssetTypes'
import { SKIN_DEFINITIONS } from './skins'
import { applyCasePricingBalance, requiresCaseLicense } from './casePricing'

const PLACEHOLDER_CASE_IMAGE = '/assets/placeholder.png'
const skinsById = new Map(SKIN_DEFINITIONS.map((skin) => [skin.id, skin]))
const generatedCaseModules = import.meta.glob<{
  CASE_DEFINITIONS: ImportedCaseDefinition[]
}>('./generated/cases.generated.ts', { eager: true })

type RarityMultipliers = Partial<Record<Rarity, number>>

function createDropTable(
  skinIds: string[],
  rarityMultipliers: RarityMultipliers = {},
  skinMultipliers: Record<string, number> = {},
): DropTableEntry[] {
  return buildDropTableFromRarities(skinIds, skinsById, rarityMultipliers, skinMultipliers)
}

const lowTierSkew: RarityMultipliers = {
  [Rarity.Consumer]: 1.35,
  [Rarity.Industrial]: 1,
  [Rarity.MilSpec]: 0.7,
  [Rarity.Restricted]: 0.28,
  [Rarity.Classified]: 0.12,
  [Rarity.Covert]: 0.035,
  [Rarity.SpecialItem]: 0.008,
}

const standardSkew: RarityMultipliers = {
  [Rarity.Consumer]: 1,
  [Rarity.Industrial]: 1,
  [Rarity.MilSpec]: 0.9,
  [Rarity.Restricted]: 0.55,
  [Rarity.Classified]: 0.3,
  [Rarity.Covert]: 0.12,
  [Rarity.SpecialItem]: 0.025,
}

const modernPremiumSkew: RarityMultipliers = {
  [Rarity.Industrial]: 0.85,
  [Rarity.MilSpec]: 1,
  [Rarity.Restricted]: 0.85,
  [Rarity.Classified]: 0.55,
  [Rarity.Covert]: 0.24,
  [Rarity.SpecialItem]: 0.05,
}

const legacySkew: RarityMultipliers = {
  [Rarity.MilSpec]: 0.85,
  [Rarity.Restricted]: 1,
  [Rarity.Classified]: 0.85,
  [Rarity.Covert]: 0.5,
  [Rarity.SpecialItem]: 0.1,
}

const ultraLegacySkew: RarityMultipliers = {
  [Rarity.Industrial]: 0.18,
  [Rarity.MilSpec]: 0.4,
  [Rarity.Restricted]: 0.9,
  [Rarity.Classified]: 2.5,
  [Rarity.Covert]: 6,
  [Rarity.SpecialItem]: 2,
  [Rarity.Contraband]: 240,
}

export const PLACEHOLDER_CASE_DEFINITIONS: CaseDefinition[] = [
  {
    id: 'starter_case',
    name: 'Starter Case',
    cost: 0.2,
    status: CaseStatus.Unlocked,
    image: PLACEHOLDER_CASE_IMAGE,
    releaseDate: Date.UTC(2026, 0, 1),
    dropTable: createDropTable(
      [
        'p250_sand_dune',
        'nova_predator',
        'mp7_army_recon',
        'galil_ar_blue_titanium',
        'p90_elite_build',
        'famas_meow_36',
        'glock18_moonrise',
        'ump45_primal_saber',
        'm4a1_s_printstream',
        'specialist_gloves_fade',
      ],
      lowTierSkew,
    ),
  },
  {
    id: 'fracture_style_case',
    name: 'Fracture-style Case',
    cost: 0.75,
    status: CaseStatus.Unlocked,
    image: PLACEHOLDER_CASE_IMAGE,
    releaseDate: Date.UTC(2026, 1, 15),
    unlockRequirement: {
      casesOpened: 5,
    },
    dropTable: createDropTable(
      [
        'mp7_army_recon',
        'galil_ar_blue_titanium',
        'tec9_ice_cap',
        'ssg08_abyss',
        'p90_elite_build',
        'usp_s_ticket_to_hell',
        'glock18_moonrise',
        'mp9_food_chain',
        'desert_eagle_mecha_industries',
        'mac10_neon_rider',
        'karambit_doppler',
      ],
      standardSkew,
    ),
  },
  {
    id: 'revolution_style_case',
    name: 'Revolution-style Case',
    cost: 1.5,
    status: CaseStatus.Locked,
    image: PLACEHOLDER_CASE_IMAGE,
    releaseDate: Date.UTC(2026, 2, 20),
    unlockRequirement: {
      casesOpened: 25,
    },
    dropTable: createDropTable(
      [
        'tec9_ice_cap',
        'p90_elite_build',
        'ssg08_abyss',
        'famas_meow_36',
        'usp_s_ticket_to_hell',
        'glock18_moonrise',
        'mp9_food_chain',
        'desert_eagle_mecha_industries',
        'mac10_neon_rider',
        'm4a1_s_printstream',
        'specialist_gloves_fade',
      ],
      modernPremiumSkew,
    ),
  },
  {
    id: 'kilowatt_style_case',
    name: 'Kilowatt-style Case',
    cost: 2.5,
    status: CaseStatus.Locked,
    image: PLACEHOLDER_CASE_IMAGE,
    releaseDate: Date.UTC(2026, 3, 30),
    unlockRequirement: {
      casesOpened: 75,
      prestigeLevel: 1,
    },
    dropTable: createDropTable(
      [
        'galil_ar_blue_titanium',
        'tec9_ice_cap',
        'famas_meow_36',
        'ssg08_abyss',
        'glock18_moonrise',
        'usp_s_ticket_to_hell',
        'mp9_food_chain',
        'desert_eagle_mecha_industries',
        'ak47_redline',
        'm4a1_s_printstream',
        'specialist_gloves_fade',
      ],
      modernPremiumSkew,
      {
        ak47_redline: 1.35,
      },
    ),
  },
  {
    id: 'legacy_rare_case',
    name: 'Legacy Rare Case',
    cost: 10,
    status: CaseStatus.Locked,
    image: PLACEHOLDER_CASE_IMAGE,
    releaseDate: Date.UTC(2024, 9, 10),
    unlockRequirement: {
      casesOpened: 150,
      prestigeLevel: 2,
    },
    retirement: {
      date: Date.UTC(2027, 0, 1),
    },
    dropTable: createDropTable(
      [
        'ssg08_abyss',
        'p90_elite_build',
        'usp_s_ticket_to_hell',
        'glock18_moonrise',
        'mp9_food_chain',
        'desert_eagle_mecha_industries',
        'ump45_primal_saber',
        'ak47_redline',
        'awp_asiimov',
        'm4a1_s_printstream',
        'karambit_doppler',
      ],
      legacySkew,
    ),
  },
  {
    id: 'ultra_legacy_case',
    name: 'Ultra Legacy Case',
    cost: 50,
    status: CaseStatus.Retired,
    image: PLACEHOLDER_CASE_IMAGE,
    releaseDate: Date.UTC(2023, 5, 1),
    unlockRequirement: {
      casesOpened: 300,
      prestigeLevel: 3,
    },
    retirement: {
      date: Date.UTC(2025, 0, 1),
    },
    dropTable: createDropTable(
      [
        'galil_ar_blue_titanium',
        'ssg08_abyss',
        'glock18_moonrise',
        'usp_s_ticket_to_hell',
        'desert_eagle_mecha_industries',
        'mp9_food_chain',
        'ump45_primal_saber',
        'ak47_redline',
        'mac10_neon_rider',
        'awp_asiimov',
        'm4a1_s_printstream',
        'karambit_doppler',
        'specialist_gloves_fade',
        'm4a4_howl',
      ],
      ultraLegacySkew,
      {
        m4a4_howl: 1.6,
      },
    ),
  },
]

const shouldUseGeneratedCaseDefinitions = import.meta.env.MODE !== 'test'
const generatedCaseDefinitions = shouldUseGeneratedCaseDefinitions
  ? Object.values(generatedCaseModules)[0]?.CASE_DEFINITIONS ?? []
  : []

export const USING_GENERATED_CASE_DEFINITIONS = generatedCaseDefinitions.length > 0

export const CASE_DEFINITIONS: CaseDefinition[] = USING_GENERATED_CASE_DEFINITIONS
  ? applyCasePricingBalance(generatedCaseDefinitions, skinsById)
  : PLACEHOLDER_CASE_DEFINITIONS

export interface CaseUnlockProgress {
  casesOpened: number
  prestigeLevel?: number
}

export function getDropTableWeightTotal(caseDef: CaseDefinition) {
  return caseDef.dropTable.reduce((total, drop) => total + drop.weight, 0)
}

export function createDefaultMarketValues() {
  return Object.fromEntries(SKIN_DEFINITIONS.map((skin) => [skin.id, skin.baseValue]))
}

export function getAvailableCases(caseDefinitions: CaseDefinition[]) {
  return caseDefinitions.filter((caseDef) => {
    return caseDef.status === CaseStatus.Unlocked || caseDef.status === CaseStatus.Retired
  })
}

export function unlockCasesForProgress(
  caseDefinitions: CaseDefinition[],
  progress: CaseUnlockProgress,
  unlockedCaseIds: string[],
) {
  const unlockedIdSet = new Set(unlockedCaseIds)

  return caseDefinitions.map((caseDef) => {
    if (caseDef.status !== CaseStatus.Locked) {
      return caseDef
    }

    if (requiresCaseLicense(caseDef)) {
      return unlockedIdSet.has(caseDef.id)
        ? { ...caseDef, status: CaseStatus.Unlocked }
        : caseDef
    }

    const requirement = caseDef.unlockRequirement

    if (!requirement) {
      return unlockedIdSet.has(caseDef.id) ? { ...caseDef, status: CaseStatus.Unlocked } : caseDef
    }

    const hasCaseProgress = progress.casesOpened >= requirement.casesOpened
    const hasPrestigeProgress = (progress.prestigeLevel ?? 0) >= (requirement.prestigeLevel ?? 0)

    if (unlockedIdSet.has(caseDef.id) || (hasCaseProgress && hasPrestigeProgress)) {
      return {
        ...caseDef,
        status: CaseStatus.Unlocked,
      }
    }

    return caseDef
  })
}

export function retireCasesByDate(caseDefinitions: CaseDefinition[], currentDate = Date.now()) {
  return caseDefinitions.map((caseDef) => {
    if (!caseDef.retirement || caseDef.retirement.date > currentDate) {
      return caseDef
    }

    return {
      ...caseDef,
      status: CaseStatus.Retired,
    }
  })
}

export function getDropOdds(caseId: string): DropOdds | undefined {
  const caseDef = CASE_DEFINITIONS.find((definition) => definition.id === caseId)

  if (!caseDef) {
    return undefined
  }

  return calculateDropOdds(caseId, caseDef.dropTable, skinsById)
}
