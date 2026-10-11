import { resolvePublicAssetUrl } from './publicAsset'

export const SOUND_ASSETS = {
  achievementFanfare: resolvePublicAssetUrl('/sounds/achievement-fanfare.wav'),
  eventEnd: resolvePublicAssetUrl('/sounds/event-end.wav'),
  eventStart: resolvePublicAssetUrl('/sounds/event-start.wav'),
  itemFavorite: resolvePublicAssetUrl('/sounds/item-favorite.wav'),
  itemLock: resolvePublicAssetUrl('/sounds/item-lock.wav'),
  itemSell: resolvePublicAssetUrl('/sounds/item-sell.wav'),
  prestige: resolvePublicAssetUrl('/sounds/prestige.wav'),
  tradeUpResult: resolvePublicAssetUrl('/sounds/trade-up-result.wav'),
  uiClick: resolvePublicAssetUrl('/sounds/ui-click.wav'),
} as const

export const CASE_OPENING_SOUND_SRC = resolvePublicAssetUrl('/sounds/case-opening.mp3')

export type SoundId = keyof typeof SOUND_ASSETS

export const ALL_SOUND_IDS = Object.keys(SOUND_ASSETS) as SoundId[]
