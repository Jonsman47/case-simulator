export const SOUND_ASSETS = {
  achievementFanfare: '/sounds/achievement-fanfare.wav',
  eventEnd: '/sounds/event-end.wav',
  eventStart: '/sounds/event-start.wav',
  itemFavorite: '/sounds/item-favorite.wav',
  itemLock: '/sounds/item-lock.wav',
  itemSell: '/sounds/item-sell.wav',
  prestige: '/sounds/prestige.wav',
  tradeUpResult: '/sounds/trade-up-result.wav',
  uiClick: '/sounds/ui-click.wav',
} as const

export const CASE_OPENING_SOUND_SRC = '/sounds/case-opening.mp3'

export type SoundId = keyof typeof SOUND_ASSETS

export const ALL_SOUND_IDS = Object.keys(SOUND_ASSETS) as SoundId[]
