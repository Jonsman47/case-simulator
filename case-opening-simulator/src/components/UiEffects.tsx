import { Sparkles, Trophy } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameUiEvent } from '../data/gameState'
import { useGame } from '../hooks/useGame'
import { useSound } from '../hooks/useSound'

interface CelebrationState {
  id: string
  title: string
  subtitle: string
  variant: 'achievement' | 'reward'
}

interface PrestigeState {
  id: string
  awardedPoints: number
  prestigeLevel: number
}

function isInteractiveClickTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false
  }

  return Boolean(target.closest('button:not(:disabled), a[href], [role="button"]'))
}

function getCelebrationForEvent(event: GameUiEvent): CelebrationState | undefined {
  if (event.type === 'achievement_unlocked') {
    return {
      id: event.id,
      title: event.name,
      subtitle: event.reward ? 'Reward ready to claim' : 'Achievement unlocked',
      variant: 'achievement',
    }
  }

  if (event.type === 'collection_reward_unlocked') {
    return {
      id: event.id,
      title: event.title,
      subtitle: event.effectLabel,
      variant: 'reward',
    }
  }

  if (event.type === 'daily_challenge_claimed') {
    return {
      id: event.id,
      title: event.challenge.title,
      subtitle: 'Daily challenge reward claimed',
      variant: 'reward',
    }
  }

  return undefined
}

function Confetti({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return null
  }

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 14 }, (_, index) => (
        <span
          className="achievement-confetti"
          key={index}
          style={{
            animationDelay: `${index * 42}ms`,
            left: `${8 + ((index * 7) % 84)}%`,
          }}
        />
      ))}
    </div>
  )
}

function PrestigeBurst({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return null
  }

  return (
    <div aria-hidden="true" className="absolute inset-0">
      {Array.from({ length: 3 }, (_, index) => (
        <span
          className="prestige-pulse-ring"
          key={index}
          style={{ animationDelay: `${index * 260}ms` }}
        />
      ))}
      {Array.from({ length: 24 }, (_, index) => (
        <span
          className="rare-particle"
          key={`prestige-${index}`}
          style={{
            animationDelay: `${index * 32}ms`,
            left: `${8 + ((index * 11) % 84)}%`,
            top: `${18 + ((index * 17) % 62)}%`,
          }}
        />
      ))}
    </div>
  )
}

export function UiEffects() {
  const { state } = useGame()
  const { play, preload } = useSound()
  const seenEventIdsRef = useRef(new Set<string>())
  const celebrationTimerRef = useRef<number | undefined>(undefined)
  const prestigeTimerRef = useRef<number | undefined>(undefined)
  const [celebration, setCelebration] = useState<CelebrationState | undefined>()
  const [prestige, setPrestige] = useState<PrestigeState | undefined>()
  const motionEnabled = state.settings.animationsEnabled && !state.settings.simplifiedAnimations

  const showCelebration = useCallback((nextCelebration: CelebrationState) => {
    setCelebration(nextCelebration)

    if (celebrationTimerRef.current) {
      window.clearTimeout(celebrationTimerRef.current)
    }

    celebrationTimerRef.current = window.setTimeout(() => {
      setCelebration((currentCelebration) =>
        currentCelebration?.id === nextCelebration.id ? undefined : currentCelebration,
      )
    }, 4200)
  }, [])

  const showPrestige = useCallback((nextPrestige: PrestigeState) => {
    setPrestige(nextPrestige)

    if (prestigeTimerRef.current) {
      window.clearTimeout(prestigeTimerRef.current)
    }

    prestigeTimerRef.current = window.setTimeout(() => {
      setPrestige((currentPrestige) =>
        currentPrestige?.id === nextPrestige.id ? undefined : currentPrestige,
      )
    }, 5200)
  }, [])

  useEffect(() => {
    preload()
  }, [preload])

  useEffect(() => {
    function handlePointerUp(event: PointerEvent) {
      if (isInteractiveClickTarget(event.target)) {
        play('uiClick', { hapticMs: 8, volume: 0.38 })
      }
    }

    document.addEventListener('pointerup', handlePointerUp)

    return () => {
      document.removeEventListener('pointerup', handlePointerUp)
    }
  }, [play])

  useEffect(() => {
    const newEvents = [...state.uiEvents]
      .reverse()
      .filter((event) => !seenEventIdsRef.current.has(event.id))

    if (newEvents.length === 0) {
      return
    }

    newEvents.forEach((event) => {
      seenEventIdsRef.current.add(event.id)

      if (
        event.type === 'item_sold' ||
        event.type === 'items_sold' ||
        event.type === 'items_auto_sold'
      ) {
        play('itemSell', { hapticMs: 14, volume: 0.72 })
        return
      }

      if (event.type === 'item_lock_toggled') {
        play('itemLock', { hapticMs: 10, volume: 0.62 })
        return
      }

      if (event.type === 'item_favorite_toggled') {
        play('itemFavorite', { hapticMs: 10, volume: 0.66 })
        return
      }

      if (event.type === 'trade_up_completed') {
        play('tradeUpResult', { hapticMs: 18, volume: 0.86 })
        return
      }

      if (event.type === 'achievement_unlocked') {
        play('achievementFanfare', { hapticMs: 28, volume: 0.9 })
      }

      if (event.type === 'collection_reward_unlocked' || event.type === 'daily_challenge_claimed') {
        play('achievementFanfare', { hapticMs: 18, volume: 0.7 })
      }

      if (event.type === 'daily_reward_claimed' || event.type === 'daily_challenge_rerolled') {
        play('uiClick', { hapticMs: 10, volume: 0.5 })
      }

      if (event.type === 'game_event_started') {
        play('eventStart', { hapticMs: 18, volume: 0.78 })
      }

      if (event.type === 'game_event_ended') {
        play('eventEnd', { hapticMs: 12, volume: 0.68 })
      }

      if (event.type === 'prestige_completed') {
        play('prestige', { hapticMs: 42, volume: 1 })
        showPrestige({
          id: event.id,
          awardedPoints: event.awardedPoints,
          prestigeLevel: event.prestigeLevel,
        })
      }

      const nextCelebration = getCelebrationForEvent(event)

      if (nextCelebration) {
        showCelebration(nextCelebration)
      }
    })
  }, [play, showCelebration, showPrestige, state.uiEvents])

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) {
        window.clearTimeout(celebrationTimerRef.current)
      }

      if (prestigeTimerRef.current) {
        window.clearTimeout(prestigeTimerRef.current)
      }
    }
  }, [])

  return (
    <>
      {celebration ? (
        <div
          aria-live="polite"
          className={[
            'pointer-events-none fixed left-1/2 top-5 z-[70] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden border border-rarity-special bg-cs-surface/95 p-4 text-cs-text shadow-glow',
            motionEnabled ? 'achievement-pop' : '',
          ].join(' ')}
          data-testid="achievement-pop-up"
          role="status"
        >
          <Confetti enabled={motionEnabled} />
          <div className="relative flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-rarity-special bg-rarity-special/10 text-rarity-special">
              {celebration.variant === 'achievement' ? <Trophy size={20} /> : <Sparkles size={20} />}
            </div>
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase text-rarity-special">
                {celebration.variant === 'achievement' ? 'Achievement' : 'Reward'}
              </p>
              <h2 className="truncate text-lg font-semibold text-cs-text">{celebration.title}</h2>
              <p className="mt-1 truncate text-sm text-cs-muted">{celebration.subtitle}</p>
            </div>
          </div>
        </div>
      ) : null}

      {prestige ? (
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-0 z-[65] grid place-items-center overflow-hidden bg-black/35 p-4"
          data-testid="prestige-sequence"
          role="status"
        >
          <PrestigeBurst enabled={motionEnabled} />
          <div
            className={[
              'relative border border-rarity-special bg-cs-surface/95 px-6 py-5 text-center text-cs-text shadow-glow',
              motionEnabled ? 'prestige-sequence-card' : '',
            ].join(' ')}
          >
            <p className="font-mono text-xs uppercase text-rarity-special">Prestige Complete</p>
            <h2 className="mt-2 text-3xl font-semibold text-cs-text">
              Level {prestige.prestigeLevel}
            </h2>
            <p className="mt-2 text-sm text-cs-muted">
              +{prestige.awardedPoints.toLocaleString()} prestige point
              {prestige.awardedPoints === 1 ? '' : 's'} awarded
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}
