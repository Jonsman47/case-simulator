import { describe, expect, it } from 'vitest'
import { Rarity, type SkinBase } from './models'
import { getSkinRarityColor, getSkinRarityDisplayName } from './rarities'

type ImportedSkinTest = SkinBase & {
  maxFloat: number
  minFloat: number
  rarityColor: string
  rarityId: string
}

function makeImportedSkin(overrides: Partial<ImportedSkinTest> = {}): SkinBase {
  return {
    id: 'special_item',
    weapon: 'Karambit',
    finish: 'Doppler',
    rarity: Rarity.SpecialItem,
    baseValue: 1_500,
    caseIds: ['test_case'],
    image: '/assets/placeholder.png',
    maxFloat: 1,
    minFloat: 0,
    rarityColor: '#eb4b4b',
    rarityId: 'rarity_ancient',
    ...overrides,
  } as ImportedSkinTest
}

describe('rarity display helpers', () => {
  it('always displays knives, gloves, and gold-tier skins as gold Special Items', () => {
    const specialItem = makeImportedSkin()

    expect(getSkinRarityDisplayName(specialItem)).toBe('Special Item')
    expect(getSkinRarityColor(specialItem)).toBe('#ffd700')
  })

  it('keeps Covert items red and separate from Special Item', () => {
    const covertItem = makeImportedSkin({
      finish: 'Printstream',
      rarity: Rarity.Covert,
      rarityColor: '#eb4b4b',
      rarityId: 'rarity_ancient_weapon',
      weapon: 'M4A1-S',
    })

    expect(getSkinRarityDisplayName(covertItem)).toBe('Covert')
    expect(getSkinRarityColor(covertItem)).toBe('#eb4b4b')
  })
})
