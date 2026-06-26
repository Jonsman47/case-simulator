import { describe, expect, it } from 'vitest'
import { Rarity, type SkinBase } from './models'
import {
  applyExternalSkinPrices,
  createSkinPriceKey,
  parseCsvRows,
  parseExternalSkinPrices,
} from './skinPrices'

const csv = [
  'Weapon,Case,Rarity,Min Wear,Max Wear,Case_1,StatTrak Factory New,StatTrak Minimal Wear,StatTrak Field-Tested,StatTrak Well-Worn,StatTrak Battle-Scarred,Factory New,Minimal Wear,Field-Tested,Well-Worn,Battle-Scarred',
  'AK-47,Redline,Classified Rifle,0.10,0.70,Operation Phoenix Weapon Case,Not Possible,$268.31,$46.00,$40.29,$27.57,Not Possible,$89.21,$17.87,$14.50,$13.65',
  'M4A1-S,Printstream,Covert Rifle,0.00,0.80,Operation Broken Fang Case,"$1,194.85",$549.99,$313.97,$302.27,$212.72,$489.49,$272.71,$188.79,$166.75,$117.72',
].join('\n')

const redline: SkinBase = {
  id: 'ak47_redline',
  weapon: 'AK-47',
  finish: 'Redline',
  rarity: Rarity.Classified,
  baseValue: 42.5,
  caseIds: ['operation_phoenix_case'],
  image: '/assets/placeholder.png',
}

describe('external skin price CSV', () => {
  it('parses quoted money values with comma thousands separators', () => {
    const rows = parseCsvRows(csv)

    expect(rows[1]?.['StatTrak Factory New']).toBe('$1,194.85')
  })

  it('maps weapon and finish to a representative StatTrak base price', () => {
    const records = parseExternalSkinPrices(csv)
    const redlineRecord = records.get(createSkinPriceKey('AK-47', 'Redline'))

    expect(redlineRecord?.basePrice).toBe(61.33)
  })

  it('applies CSV prices while preserving fallback prices for missing skins', () => {
    const [pricedRedline, fallbackSkin] = applyExternalSkinPrices([
      redline,
      {
        ...redline,
        id: 'missing_skin',
        finish: 'Missing Finish',
        baseValue: 7,
      },
    ])

    expect(pricedRedline?.baseValue).toBeGreaterThan(redline.baseValue)
    expect(fallbackSkin?.baseValue).toBe(7)
  })
})
