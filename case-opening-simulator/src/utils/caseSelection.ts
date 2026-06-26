import type { GameState } from '../data/gameState'
import { getCaseLicenseCost, requiresCaseLicense } from '../data/casePricing'
import { CaseStatus, Rarity, type CaseDefinition, type SkinBase } from '../data/models'
import { raritySortOrder } from './inventoryFilters'
import { formatCurrency } from './format'

export type CaseFilter = 'all' | 'unlocked' | 'locked' | 'retired'
export type CaseSort = 'cost' | 'name' | 'unlockProgress'

export function canOpenCaseFromSelection(caseDef: CaseDefinition, state: GameState) {
  if (state.specialEventCaseIds.includes(caseDef.id)) {
    return true
  }

  if (state.casesUnlocked.includes(caseDef.id)) {
    return true
  }

  if (caseDef.status === CaseStatus.Unlocked && !requiresCaseLicense(caseDef)) {
    return true
  }

  if (caseDef.status === CaseStatus.Retired) {
    return state.specialEventCaseIds.includes(caseDef.id)
  }

  return false
}

export function getCaseUnlockProgressValue(caseDef: CaseDefinition, state: GameState) {
  const requirement = caseDef.unlockRequirement

  if (requiresCaseLicense(caseDef)) {
    return canOpenCaseFromSelection(caseDef, state) ? 1 : 0
  }

  if (!requirement) {
    return canOpenCaseFromSelection(caseDef, state) ? 1 : 0
  }

  const casesProgress = requirement.casesOpened <= 0
    ? 1
    : Math.min(1, state.statistics.casesOpened / requirement.casesOpened)
  const prestigeRequirement = requirement.prestigeLevel ?? 0
  const prestigeProgress = prestigeRequirement <= 0
    ? 1
    : Math.min(1, state.prestigeLevel / prestigeRequirement)

  return Math.min(casesProgress, prestigeProgress)
}

export function getUnlockProgressLabel(caseDef: CaseDefinition, state: GameState) {
  if (canOpenCaseFromSelection(caseDef, state)) {
    return caseDef.status === CaseStatus.Retired ? 'Access owned' : 'Unlocked'
  }

  const requirement = caseDef.unlockRequirement

  if (requiresCaseLicense(caseDef)) {
    return `License ${formatCurrency(getCaseLicenseCost(caseDef))}`
  }

  if (!requirement) {
    return 'Locked'
  }

  const parts = [`opens ${Math.min(state.statistics.casesOpened, requirement.casesOpened)}/${requirement.casesOpened}`]

  if (typeof requirement.prestigeLevel === 'number') {
    parts.push(`prestige ${state.prestigeLevel}/${requirement.prestigeLevel}`)
  }

  return `Unlocks after ${parts.join(' and ')}`
}

export function filterCases(caseDefinitions: CaseDefinition[], filter: CaseFilter) {
  if (filter === 'all') {
    return caseDefinitions
  }

  return caseDefinitions.filter((caseDef) => {
    if (filter === 'unlocked') {
      return caseDef.status === CaseStatus.Unlocked
    }

    if (filter === 'locked') {
      return caseDef.status === CaseStatus.Locked
    }

    return caseDef.status === CaseStatus.Retired
  })
}

export function sortCases(
  caseDefinitions: CaseDefinition[],
  sort: CaseSort,
  state: GameState,
) {
  return [...caseDefinitions].sort((left, right) => {
    switch (sort) {
      case 'cost':
        return left.cost - right.cost || left.name.localeCompare(right.name)
      case 'unlockProgress':
        return (
          getCaseUnlockProgressValue(right, state) -
          getCaseUnlockProgressValue(left, state) ||
          left.name.localeCompare(right.name)
        )
      case 'name':
      default:
        return left.name.localeCompare(right.name)
    }
  })
}

export function getBestPossibleDrop(
  caseDef: CaseDefinition,
  skinsById: Map<string, SkinBase>,
  marketValues: Record<string, number>,
) {
  return caseDef.dropTable
    .map((drop) => skinsById.get(drop.skinId))
    .filter((skin): skin is SkinBase => Boolean(skin))
    .sort((left, right) => {
      const valueDifference = (marketValues[right.id] ?? right.baseValue) - (marketValues[left.id] ?? left.baseValue)

      if (valueDifference !== 0) {
        return valueDifference
      }

      return raritySortOrder[right.rarity] - raritySortOrder[left.rarity]
    })[0]
}

export function getCaseStatusLabel(caseDef: CaseDefinition, state: GameState) {
  if (caseDef.status === CaseStatus.Retired) {
    return canOpenCaseFromSelection(caseDef, state) ? 'Event Access' : 'Retired'
  }

  if (caseDef.status === CaseStatus.Unlocked) {
    if (requiresCaseLicense(caseDef) && !canOpenCaseFromSelection(caseDef, state)) {
      return 'License Required'
    }

    return 'Unlocked'
  }

  if (requiresCaseLicense(caseDef)) {
    return canOpenCaseFromSelection(caseDef, state) ? 'Licensed' : 'License Required'
  }

  return state.specialEventCaseIds.includes(caseDef.id) ? 'Event Access' : 'Locked'
}

export function getRarityTextClass(rarity: Rarity) {
  switch (rarity) {
    case Rarity.Consumer:
      return 'text-rarity-consumer'
    case Rarity.Industrial:
      return 'text-rarity-industrial'
    case Rarity.MilSpec:
      return 'text-rarity-mil-spec'
    case Rarity.Restricted:
      return 'text-rarity-restricted'
    case Rarity.Classified:
      return 'text-rarity-classified'
    case Rarity.Covert:
      return 'text-rarity-covert'
    case Rarity.SpecialItem:
      return 'text-rarity-special'
    case Rarity.Contraband:
      return 'text-rarity-contraband'
    default:
      return 'text-cs-muted'
  }
}
