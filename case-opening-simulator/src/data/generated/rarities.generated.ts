import type { ImportedRarityDefinition } from '../importedAssetTypes'

export const RARITY_DEFINITIONS = {
  "rarity_ancient": { id: "rarity_ancient", name: "Extraordinary", color: "#eb4b4b" },
  "rarity_ancient_weapon": { id: "rarity_ancient_weapon", name: "Covert", color: "#eb4b4b" },
  "rarity_common_weapon": { id: "rarity_common_weapon", name: "Consumer Grade", color: "#b0c3d9" },
  "rarity_contraband_weapon": { id: "rarity_contraband_weapon", name: "Contraband", color: "#e4ae39" },
  "rarity_legendary": { id: "rarity_legendary", name: "Exotic", color: "#d32ce6" },
  "rarity_legendary_weapon": { id: "rarity_legendary_weapon", name: "Classified", color: "#d32ce6" },
  "rarity_mythical": { id: "rarity_mythical", name: "Remarkable", color: "#8847ff" },
  "rarity_mythical_weapon": { id: "rarity_mythical_weapon", name: "Restricted", color: "#8847ff" },
  "rarity_rare": { id: "rarity_rare", name: "High Grade", color: "#4b69ff" },
  "rarity_rare_weapon": { id: "rarity_rare_weapon", name: "Mil-Spec Grade", color: "#4b69ff" },
  "rarity_special_item": { id: "rarity_special_item", name: "Special Item", color: "#ffd700" },
  "rarity_uncommon_weapon": { id: "rarity_uncommon_weapon", name: "Industrial Grade", color: "#5e98d9" },
} satisfies Record<string, ImportedRarityDefinition>

export const RARITIES = RARITY_DEFINITIONS
