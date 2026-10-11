import pricesCsv from './Skins_Price.csv?raw'
import {
  WearCondition,
  getWearValueMultiplier,
  type SkinBase,
} from './models'
import type { GeneratedSkinPriceRecord } from './generated/skinPrices.generated'

type CsvRow = Record<string, string>

export type WearPriceMap = Partial<Record<WearCondition, number>>

export interface ExternalSkinPriceRecord {
  basePrice: number
  finish: string
  normalWearPrices: WearPriceMap
  statTrakWearPrices: WearPriceMap
  weapon: string
}

const statTrakColumns: Record<WearCondition, string> = {
  [WearCondition.FactoryNew]: 'StatTrak Factory New',
  [WearCondition.MinimalWear]: 'StatTrak Minimal Wear',
  [WearCondition.FieldTested]: 'StatTrak Field-Tested',
  [WearCondition.WellWorn]: 'StatTrak Well-Worn',
  [WearCondition.BattleScarred]: 'StatTrak Battle-Scarred',
}

const normalColumns: Record<WearCondition, string> = {
  [WearCondition.FactoryNew]: 'Factory New',
  [WearCondition.MinimalWear]: 'Minimal Wear',
  [WearCondition.FieldTested]: 'Field-Tested',
  [WearCondition.WellWorn]: 'Well-Worn',
  [WearCondition.BattleScarred]: 'Battle-Scarred',
}

const baseWearPreference = [
  WearCondition.FieldTested,
  WearCondition.MinimalWear,
  WearCondition.FactoryNew,
  WearCondition.WellWorn,
  WearCondition.BattleScarred,
]
const generatedSkinPriceModules = import.meta.glob<{
  GENERATED_SKIN_PRICES: Record<string, GeneratedSkinPriceRecord>
}>('./generated/skinPrices.generated.ts', { eager: true })
const generatedSkinPrices = Object.values(generatedSkinPriceModules)[0]?.GENERATED_SKIN_PRICES ?? {}

export function createSkinPriceKey(weapon: string, finish: string) {
  return `${weapon}|${finish}`
    .normalize('NFKD')
    .toLowerCase()
    .replace(/^★\s*/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function parseCsvLine(line: string) {
  const values: string[] = []
  let currentValue = ''
  let isQuoted = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    const nextCharacter = line[index + 1]

    if (character === '"' && isQuoted && nextCharacter === '"') {
      currentValue += '"'
      index += 1
      continue
    }

    if (character === '"') {
      isQuoted = !isQuoted
      continue
    }

    if (character === ',' && !isQuoted) {
      values.push(currentValue.trim())
      currentValue = ''
      continue
    }

    currentValue += character
  }

  values.push(currentValue.trim())

  return values
}

export function parseCsvRows(csv: string): CsvRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const [headerLine, ...rowLines] = lines

  if (!headerLine) {
    return []
  }

  const headers = parseCsvLine(headerLine)

  return rowLines.map((line) => {
    const values = parseCsvLine(line)

    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = values[index] ?? ''
      return row
    }, {})
  })
}

function parseMoney(value: string) {
  const normalizedValue = value.replace(/\$/g, '').replace(/,/g, '').trim()

  if (!normalizedValue || normalizedValue.toLowerCase() === 'not possible') {
    return undefined
  }

  const parsedValue = Number(normalizedValue)

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? Number(parsedValue.toFixed(2))
    : undefined
}

function readWearPrices(row: CsvRow, columns: Record<WearCondition, string>) {
  return Object.values(WearCondition).reduce<WearPriceMap>((prices, wear) => {
    const price = parseMoney(row[columns[wear]] ?? '')

    if (typeof price === 'number') {
      prices[wear] = price
    }

    return prices
  }, {})
}

function selectBasePrice(statTrakWearPrices: WearPriceMap, normalWearPrices: WearPriceMap) {
  // Market values remain one base number per skin. Prefer StatTrak Field-Tested as
  // the representative base because the simulator's wear roll most often lands
  // there, then divide out the existing wear multiplier so drops still scale by wear.
  for (const wear of baseWearPreference) {
    const price = statTrakWearPrices[wear] ?? normalWearPrices[wear]

    if (typeof price === 'number') {
      return Number((price / getWearValueMultiplier(wear)).toFixed(2))
    }
  }

  return undefined
}

export function parseExternalSkinPrices(csv: string) {
  const records = new Map<string, ExternalSkinPriceRecord>()

  for (const row of parseCsvRows(csv)) {
    const weapon = row.Weapon
    const finish = row.Case

    if (!weapon || !finish) {
      continue
    }

    const statTrakWearPrices = readWearPrices(row, statTrakColumns)
    const normalWearPrices = readWearPrices(row, normalColumns)
    const basePrice = selectBasePrice(statTrakWearPrices, normalWearPrices)

    if (typeof basePrice !== 'number') {
      continue
    }

    records.set(createSkinPriceKey(weapon, finish), {
      basePrice,
      finish,
      normalWearPrices,
      statTrakWearPrices,
      weapon,
    })
  }

  return records
}

export const EXTERNAL_SKIN_PRICES_BY_KEY = parseExternalSkinPrices(pricesCsv)
export const HAS_EXTERNAL_SKIN_PRICES = EXTERNAL_SKIN_PRICES_BY_KEY.size > 0
export const GENERATED_SKIN_PRICES_BY_ID = generatedSkinPrices
export const HAS_GENERATED_SKIN_PRICES = Object.keys(GENERATED_SKIN_PRICES_BY_ID).length > 0

export function getExternalSkinPriceRecord(skin: Pick<SkinBase, 'finish' | 'weapon'>) {
  return EXTERNAL_SKIN_PRICES_BY_KEY.get(createSkinPriceKey(skin.weapon, skin.finish))
}

export function getGeneratedSkinPriceRecord(skin: Pick<SkinBase, 'id'>) {
  return GENERATED_SKIN_PRICES_BY_ID[skin.id]
}

export function getSkinConditionPrice(
  skin: Pick<SkinBase, 'baseValue' | 'id'>,
  wear: WearCondition,
  isStatTrak = false,
) {
  const generatedRecord = getGeneratedSkinPriceRecord(skin)
  const generatedPrice = isStatTrak
    ? generatedRecord?.statTrak[wear] ?? generatedRecord?.normal[wear]
    : generatedRecord?.normal[wear]

  if (typeof generatedPrice === 'number') {
    return generatedPrice
  }

  return undefined
}

export function getRepresentativeSkinPrice(skin: SkinBase) {
  const generatedRecord = getGeneratedSkinPriceRecord(skin)

  if (typeof generatedRecord?.representativePrice === 'number') {
    return generatedRecord.representativePrice
  }

  return getExternalSkinPriceRecord(skin)?.basePrice ?? skin.baseValue
}

export function getMarketAdjustedSkinConditionPrice({
  fallbackValue,
  isStatTrak = false,
  marketValues,
  skin,
  wear,
}: {
  fallbackValue?: number
  isStatTrak?: boolean
  marketValues?: Record<string, number>
  skin: SkinBase
  wear: WearCondition
}) {
  const conditionPrice = getSkinConditionPrice(skin, wear, isStatTrak)

  if (typeof conditionPrice !== 'number') {
    return fallbackValue
  }

  const representativePrice = getRepresentativeSkinPrice(skin)
  const marketRepresentative = marketValues?.[skin.id]

  if (
    typeof marketRepresentative === 'number' &&
    marketRepresentative > 0 &&
    representativePrice > 0
  ) {
    return Number((conditionPrice * (marketRepresentative / representativePrice)).toFixed(2))
  }

  return conditionPrice
}

export function applyExternalSkinPrices<TSkin extends SkinBase>(skins: TSkin[]) {
  return skins.map((skin) => {
    const generatedRecord = getGeneratedSkinPriceRecord(skin)

    if (generatedRecord) {
      return {
        ...skin,
        baseValue: generatedRecord.representativePrice,
      }
    }

    const priceRecord = getExternalSkinPriceRecord(skin)

    if (!priceRecord) {
      return skin
    }

    return {
      ...skin,
      baseValue: priceRecord.basePrice,
    }
  })
}

export function getExternalSkinMarketValues(skins: SkinBase[]) {
  return Object.fromEntries(
    skins
      .map((skin) => {
        const generatedRecord = getGeneratedSkinPriceRecord(skin)

        if (generatedRecord) {
          return [skin.id, generatedRecord.representativePrice] as const
        }

        const priceRecord = getExternalSkinPriceRecord(skin)

        return priceRecord ? [skin.id, priceRecord.basePrice] as const : undefined
      })
      .filter((entry): entry is readonly [string, number] => Boolean(entry)),
  )
}
