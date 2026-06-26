/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameContext, type GameContextValue } from '../components/GameContext'
import { defaultGameState, type GameState } from '../data/gameState'
import { soundTestControls, useSound } from './useSound'

class MockAudioSource {
  buffer: AudioBuffer | null = null
  connect = vi.fn()
  start = vi.fn()
}

class MockGainNode {
  connect = vi.fn()
  gain = { value: 1 }
}

const decodedBuffer = {} as AudioBuffer
let createdSources: MockAudioSource[] = []
let createdGains: MockGainNode[] = []

class MockAudioContext {
  destination = {}
  state = 'running'
  decodeAudioData = vi.fn(async () => decodedBuffer)
  resume = vi.fn(async () => undefined)

  createBufferSource() {
    const source = new MockAudioSource()

    createdSources.push(source)

    return source
  }

  createGain() {
    const gain = new MockGainNode()

    createdGains.push(gain)

    return gain
  }
}

function makeState(overrides: Partial<GameState['settings']> = {}): GameState {
  return {
    ...defaultGameState,
    settings: {
      ...defaultGameState.settings,
      ...overrides,
    },
  }
}

function renderSoundHarness(state: GameState) {
  function SoundHarness() {
    const sound = useSound()

    return (
      <>
        <output data-testid="sound-enabled">{String(sound.isEnabled)}</output>
        <output data-testid="sound-volume">{sound.volume}</output>
        <button onClick={() => sound.play('uiClick', { volume: 0.5 })} type="button">
          Play
        </button>
      </>
    )
  }

  return render(
    <GameContext.Provider value={{ state } as unknown as GameContextValue}>
      <SoundHarness />
    </GameContext.Provider>,
  )
}

describe('useSound', () => {
  beforeEach(() => {
    createdGains = []
    createdSources = []
    soundTestControls.clearCache()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        arrayBuffer: async () => new ArrayBuffer(8),
      })),
    )
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: MockAudioContext,
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('does not load or play sounds when disabled', async () => {
    renderSoundHarness(makeState({ soundEnabled: false }))

    expect(screen.getByTestId('sound-enabled')).toHaveTextContent('false')

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))

    await Promise.resolve()

    expect(fetch).not.toHaveBeenCalled()
    expect(createdSources).toHaveLength(0)
  })

  it('preloads and plays with the configured volume multiplier', async () => {
    renderSoundHarness(makeState({ soundEnabled: true, soundVolume: 0.4 }))

    expect(screen.getByTestId('sound-enabled')).toHaveTextContent('true')
    expect(screen.getByTestId('sound-volume')).toHaveTextContent('0.4')

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))

    await waitFor(() => {
      expect(createdSources[0]?.start).toHaveBeenCalledTimes(1)
    })

    expect(fetch).toHaveBeenCalled()
    expect(createdGains[0]?.gain.value).toBeCloseTo(0.2)
  })
})
