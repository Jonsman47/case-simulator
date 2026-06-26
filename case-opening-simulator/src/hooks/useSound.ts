import { useCallback, useEffect, useMemo } from 'react'
import { useGame } from './useGame'
import { ALL_SOUND_IDS, SOUND_ASSETS, type SoundId } from '../utils/soundManifest'

type BrowserAudioContext = AudioContext & {
  resume?: () => Promise<void>
}

interface PlayOptions {
  hapticMs?: number
  volume?: number
}

interface PlaySoundOptions extends PlayOptions {
  enabled: boolean
}

const bufferCache = new Map<SoundId, AudioBuffer>()
const loadingCache = new Map<SoundId, Promise<AudioBuffer | undefined>>()
let audioContext: BrowserAudioContext | undefined

function getAudioContext() {
  if (typeof window === 'undefined') {
    return undefined
  }

  const AudioContextConstructor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextConstructor) {
    return undefined
  }

  audioContext ??= new AudioContextConstructor()

  return audioContext
}

async function loadSoundBuffer(soundId: SoundId) {
  const cachedBuffer = bufferCache.get(soundId)

  if (cachedBuffer) {
    return cachedBuffer
  }

  const pendingLoad = loadingCache.get(soundId)

  if (pendingLoad) {
    return pendingLoad
  }

  const context = getAudioContext()

  if (!context || typeof fetch === 'undefined') {
    return undefined
  }

  const loadPromise = fetch(SOUND_ASSETS[soundId])
    .then((response) => response.arrayBuffer())
    .then((arrayBuffer) => context.decodeAudioData(arrayBuffer.slice(0)))
    .then((buffer) => {
      bufferCache.set(soundId, buffer)
      loadingCache.delete(soundId)

      return buffer
    })
    .catch(() => {
      loadingCache.delete(soundId)

      return undefined
    })

  loadingCache.set(soundId, loadPromise)

  return loadPromise
}

async function preloadSoundBuffers(soundIds: SoundId[]) {
  await Promise.all(soundIds.map((soundId) => loadSoundBuffer(soundId)))
}

async function playSoundBuffer(soundId: SoundId, options: PlaySoundOptions) {
  if (!options.enabled) {
    return false
  }

  const context = getAudioContext()

  if (!context) {
    return false
  }

  const buffer = await loadSoundBuffer(soundId)

  if (!buffer) {
    return false
  }

  if (context.state === 'suspended' && context.resume) {
    await context.resume().catch(() => undefined)
  }

  const source = context.createBufferSource()
  const gain = context.createGain()

  source.buffer = buffer
  gain.gain.value = Math.max(0, Math.min(1, options.volume ?? 1))
  source.connect(gain)
  gain.connect(context.destination)
  source.start()

  return true
}

function vibrate(ms: number | undefined, enabled: boolean) {
  if (!enabled || !ms || typeof navigator === 'undefined' || !navigator.vibrate) {
    return
  }

  navigator.vibrate(ms)
}

export function useSound() {
  const { state } = useGame()
  const soundEnabled = state.settings.soundEnabled && state.settings.soundVolume > 0
  const hapticsEnabled = !state.settings.simplifiedAnimations
  const volume = state.settings.soundVolume

  useEffect(() => {
    if (!soundEnabled) {
      return
    }

    void preloadSoundBuffers(ALL_SOUND_IDS)
  }, [soundEnabled])

  const play = useCallback(
    (soundId: SoundId, options: PlayOptions = {}) => {
      vibrate(options.hapticMs, hapticsEnabled)
      void playSoundBuffer(soundId, {
        enabled: soundEnabled,
        volume: volume * (options.volume ?? 1),
      })
    },
    [hapticsEnabled, soundEnabled, volume],
  )

  const preload = useCallback((soundIds: SoundId[] = ALL_SOUND_IDS) => {
    if (!soundEnabled) {
      return
    }

    void preloadSoundBuffers(soundIds)
  }, [soundEnabled])

  return useMemo(
    () => ({
      isEnabled: soundEnabled,
      play,
      preload,
      volume,
    }),
    [play, preload, soundEnabled, volume],
  )
}

export const soundTestControls = {
  clearCache() {
    bufferCache.clear()
    loadingCache.clear()
    audioContext = undefined
  },
}
