import type { DropTableEntry } from './dropLogic'
import type { CaseDefinition, SkinBase, WearCondition } from './models'

export interface ImportedWearRange {
  min: number
  max: number
}

export interface ImportedSkinDefinition extends SkinBase {
  displayName: string
  weaponId: string
  patternId: string
  minFloat: number
  maxFloat: number
  rarityId: string
  rarityColor: string
  hasStatTrak: boolean
  hasSouvenir: boolean
  collections: string[]
  wearRanges: Partial<Record<WearCondition, ImportedWearRange>>
}

export interface ImportedDropTableEntry extends DropTableEntry {
  rarityId: string
  isRare?: boolean
}

export interface ImportedCaseDefinition extends Omit<CaseDefinition, 'dropTable'> {
  displayName: string
  dropTable: ImportedDropTableEntry[]
  lootList?: string | null
}

export interface ImportedRarityDefinition {
  id: string
  name: string
  color: string
}
