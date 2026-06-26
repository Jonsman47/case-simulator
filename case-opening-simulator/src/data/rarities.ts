import type { ImportedRarityDefinition, ImportedSkinDefinition } from './importedAssetTypes'
import { Rarity, type SkinBase } from './models'

const fallbackRarityColors: Record<Rarity, string> = {
  [Rarity.Consumer]: '#b0c3d9',
  [Rarity.Industrial]: '#5e98d9',
  [Rarity.MilSpec]: '#4b69ff',
  [Rarity.Restricted]: '#8847ff',
  [Rarity.Classified]: '#d32ce6',
  [Rarity.Covert]: '#eb4b4b',
  [Rarity.SpecialItem]: '#ffd700',
  [Rarity.Contraband]: '#e4ae39',
}

export const rarityDefinitions = [
  { key: 'consumer', borderClass: 'border-rarity-consumer' },
  { key: 'industrial', borderClass: 'border-rarity-industrial' },
  { key: 'milSpec', borderClass: 'border-rarity-mil-spec' },
  { key: 'restricted', borderClass: 'border-rarity-restricted' },
  { key: 'classified', borderClass: 'border-rarity-classified' },
  { key: 'covert', borderClass: 'border-rarity-covert' },
  { key: 'special', borderClass: 'border-rarity-special' },
  { key: 'contraband', borderClass: 'border-rarity-contraband' },
] as const

const generatedRarityModules = import.meta.glob<{
  RARITIES?: Record<string, ImportedRarityDefinition>
  RARITY_DEFINITIONS?: Record<string, ImportedRarityDefinition>
}>('./generated/rarities.generated.ts', { eager: true })

const generatedRarityModule = Object.values(generatedRarityModules)[0]

export const RARITIES =
  generatedRarityModule?.RARITIES ??
  generatedRarityModule?.RARITY_DEFINITIONS ??
  {}

export function hasImportedSkinMetadata(skin: SkinBase): skin is ImportedSkinDefinition {
  return (
    'rarityId' in skin &&
    typeof skin.rarityId === 'string' &&
    'minFloat' in skin &&
    typeof skin.minFloat === 'number' &&
    'maxFloat' in skin &&
    typeof skin.maxFloat === 'number'
  )
}

export function getSkinRarityDefinition(skin: SkinBase) {
  return hasImportedSkinMetadata(skin) ? RARITIES[skin.rarityId] : undefined
}

export function getSkinRarityColor(skin: SkinBase) {
  return (
    getSkinRarityDefinition(skin)?.color ??
    (hasImportedSkinMetadata(skin) ? skin.rarityColor : undefined) ??
    fallbackRarityColors[skin.rarity]
  )
}

export function getSkinRarityDisplayName(skin: SkinBase) {
  return getSkinRarityDefinition(skin)?.name
}

export function getRarityFallbackColor(rarity: Rarity) {
  return fallbackRarityColors[rarity]
}
