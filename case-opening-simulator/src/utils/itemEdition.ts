import type { SkinInstance } from '../data/models'

export type ItemEdition = 'regular' | 'stattrak' | 'souvenir'

export function getItemEdition(item: Pick<SkinInstance, 'souvenir' | 'statTrak'>): ItemEdition {
  if (item.statTrak) return 'stattrak'
  if (item.souvenir) return 'souvenir'
  return 'regular'
}

export function getItemEditionLabel(item: Pick<SkinInstance, 'souvenir' | 'statTrak'>) {
  const edition = getItemEdition(item)
  if (edition === 'stattrak') return 'StatTrak™'
  if (edition === 'souvenir') return 'Souvenir'
  return 'Regular'
}
