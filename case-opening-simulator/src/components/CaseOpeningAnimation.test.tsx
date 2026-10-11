/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Rarity, WearCondition, type SkinBase, type SkinInstance } from '../data/models'
import { CaseOpeningAnimation } from './CaseOpeningAnimation'

const baseSkin: SkinBase = {
  id: 'ak47_redline',
  weapon: 'AK-47',
  finish: 'Redline',
  rarity: Rarity.Classified,
  baseValue: 42,
  caseIds: ['starter_case'],
  image: '/assets/placeholder.png',
}

const fillerSkin: SkinBase = {
  id: 'p250_sand_dune',
  weapon: 'P250',
  finish: 'Sand Dune',
  rarity: Rarity.Consumer,
  baseValue: 0.03,
  caseIds: ['starter_case'],
  image: '/assets/placeholder.png',
}

const knifeSkin: SkinBase = {
  id: 'knife_gold_suspense',
  weapon: 'Karambit',
  finish: 'Doppler',
  rarity: Rarity.SpecialItem,
  baseValue: 850,
  caseIds: ['starter_case'],
  image: '/assets/placeholder.png',
}

const rareNonKnifeSkin: SkinBase = {
  id: 'rare_non_knife',
  weapon: 'AWP',
  finish: 'Dragon Lore',
  rarity: Rarity.SpecialItem,
  baseValue: 1500,
  caseIds: ['starter_case'],
  image: '/assets/placeholder.png',
}

function makeItem(overrides: Partial<SkinInstance> = {}): SkinInstance {
  return {
    ...baseSkin,
    instanceId: 'drop-1',
    wear: WearCondition.FieldTested,
    floatValue: 0.234,
    marketValue: 31.5,
    isLocked: false,
    isFavorited: false,
    discoveredAt: 1_782_129_600_000,
    ...overrides,
  }
}

function makeBatchItems(count: number) {
  return Array.from({ length: count }, (_, index) => makeItem({
    instanceId: `drop-${index + 1}`,
    marketValue: 10 + index,
    rarity: index % 9 === 0 ? Rarity.Covert : Rarity.MilSpec,
  }))
}

class MockAudio {
  currentTime = 0
  pause = vi.fn()
  play = vi.fn(() => Promise.resolve())
  preload = ''
  src: string
  volume = 1

  constructor(src: string) {
    this.src = src
    audioInstances.push(this)
  }
}

let audioInstances: MockAudio[] = []

describe('CaseOpeningAnimation', () => {
  beforeEach(() => {
    audioInstances = []
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    vi.stubGlobal('Audio', MockAudio)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('starts the mp3 immediately, rolls after the lead-in, and reveals at the 8 second cue', () => {
    const finalItem = makeItem()
    const onComplete = vi.fn()

    render(
      <CaseOpeningAnimation
        finalItem={finalItem}
        onComplete={onComplete}
        potentialSkins={[
          { skin: fillerSkin, weight: 99 },
          { skin: baseSkin, weight: 1 },
        ]}
        soundEnabled
        speed="normal"
      />,
    )

    expect(audioInstances).toHaveLength(1)
    expect(audioInstances[0]?.play).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('case-opening-reel')).toHaveAttribute('data-phase', 'ready')
    expect(screen.getByTestId('case-pre-roll-hero')).toBeInTheDocument()
    expect(screen.getByTestId('case-pre-roll-hero').style.getPropertyValue('--case-accent')).toBe(
      'rgb(var(--rarity-special))',
    )
    expect(screen.getByTestId('opening-result')).not.toHaveTextContent('AK-47 | Redline')
    expect(screen.queryByTestId('case-opening-target')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1_249)
    })

    expect(screen.getByTestId('case-opening-reel')).toHaveAttribute('data-phase', 'ready')

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(screen.getByTestId('case-opening-reel')).toHaveAttribute('data-phase', 'spinning')
    expect(screen.getByTestId('case-opening-target')).toHaveTextContent('AK-47 | Redline')
    expect(screen.getByTestId('case-opening-target')).not.toHaveClass('border-rarity-special')
    expect(screen.queryByTestId('animated-rolling-case')).not.toBeInTheDocument()
    expect(screen.getByTestId('roulette-track')).toHaveAttribute('data-reel-length', '87')
    expect(screen.getByTestId('roulette-track')).toHaveAttribute('data-after-target-count', '30')
    expect(screen.getByTestId('roulette-track').style.transform).toBe('translate3d(-70rem, 0, 0)')

    act(() => {
      vi.advanceTimersToNextFrame()
      vi.advanceTimersToNextFrame()
    })

    expect(screen.getByTestId('roulette-track').style.transform).toBe('translate3d(-490rem, 0, 0)')
    expect(screen.getByTestId('roulette-track').style.transitionProperty).toBe('transform')
    expect(screen.getByTestId('roulette-track').style.paddingLeft).toBe('calc(50% - 4rem)')
    expect(screen.getByTestId('roulette-track').style.width).toBe('max-content')

    act(() => {
      vi.advanceTimersByTime(6_750)
    })

    expect(screen.getByTestId('opening-result')).toHaveTextContent('AK-47 | Redline')
    expect(screen.getByTestId('opening-result')).toHaveClass('border-cs-border')
    expect(screen.getByTestId('opening-result')).not.toHaveClass('border-rarity-classified')
    expect(audioInstances[0]?.pause).toHaveBeenCalledTimes(1)
    expect(audioInstances[0]?.currentTime).toBe(0)
    expect(onComplete).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(650)
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith(finalItem)
  }, 15_000)

  it('applies the opening speed bonus to reel and completion timing', () => {
    const finalItem = makeItem()
    const onComplete = vi.fn()

    render(
      <CaseOpeningAnimation
        finalItem={finalItem}
        onComplete={onComplete}
        potentialSkins={[{ skin: fillerSkin, weight: 100 }]}
        speed="normal"
        speedBonus={1}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(624)
    })
    expect(screen.getByTestId('case-opening-reel')).toHaveAttribute('data-phase', 'ready')

    act(() => {
      vi.advanceTimersByTime(1)
      vi.advanceTimersByTime(3_375)
    })
    expect(screen.getByTestId('opening-result')).toHaveTextContent('AK-47 | Redline')

    act(() => {
      vi.advanceTimersByTime(325)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('reveals promptly when the animation is skipped', () => {
    const finalItem = makeItem({ rarity: Rarity.MilSpec })
    const onComplete = vi.fn()

    render(
      <CaseOpeningAnimation
        finalItem={finalItem}
        onComplete={onComplete}
        potentialSkins={[{ skin: fillerSkin, weight: 100 }]}
        speed="normal"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Skip opening animation' }))

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(screen.getByTestId('opening-result')).toHaveTextContent('AK-47 | Redline')
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith(finalItem)
  })

  it('renders 10 simultaneous reels for a 10 case open', () => {
    const finalItems = makeBatchItems(10)

    render(
      <CaseOpeningAnimation
        finalItem={finalItems[0]}
        finalItems={finalItems}
        onComplete={vi.fn()}
        potentialSkins={[{ skin: fillerSkin, weight: 100 }]}
      />,
    )

    expect(screen.getAllByTestId('case-pre-roll-cell')).toHaveLength(10)
    screen.getAllByTestId('case-pre-roll-cell').forEach((cell) => {
      expect(cell.style.getPropertyValue('--case-accent')).toBe('rgb(var(--rarity-special))')
      expect(cell).toHaveClass('border-rarity-special')
    })

    act(() => {
      vi.advanceTimersByTime(1_250)
    })

    expect(screen.getAllByTestId('case-opening-target')).toHaveLength(10)
    screen.getAllByTestId('case-opening-target').forEach((target) => {
      expect(target).not.toHaveClass('border-rarity-special')
    })
    expect(screen.getAllByTestId('roulette-track')[0]).toHaveAttribute('data-reel-length', '49')
  }, 15_000)

  it('renders 100 simultaneous case cells and reels for a 100 case open', () => {
    const finalItems = makeBatchItems(100)

    render(
      <CaseOpeningAnimation
        finalItem={finalItems[0]}
        finalItems={finalItems}
        onComplete={vi.fn()}
        potentialSkins={[{ skin: fillerSkin, weight: 100 }]}
      />,
    )

    expect(screen.getAllByTestId('case-pre-roll-cell')).toHaveLength(100)

    act(() => {
      vi.advanceTimersByTime(1_250)
    })

    expect(screen.getAllByTestId('case-opening-target')).toHaveLength(100)
    expect(screen.getAllByTestId('roulette-track')[0]).toHaveAttribute('data-reel-length', '31')
  }, 15_000)

  it('caps 1000-open animation rendering while keeping the batch count visible', () => {
    const finalItems = makeBatchItems(1000)

    render(
      <CaseOpeningAnimation
        finalItem={finalItems[0]}
        finalItems={finalItems}
        onComplete={vi.fn()}
        potentialSkins={[{ skin: fillerSkin, weight: 100 }]}
      />,
    )

    expect(screen.getAllByTestId('case-pre-roll-cell')).toHaveLength(120)
    expect(screen.getByTestId('hidden-batch-count')).toHaveTextContent('+880 more')

    act(() => {
      vi.advanceTimersByTime(1_250)
    })

    expect(screen.getAllByTestId('case-opening-target')).toHaveLength(120)
    expect(screen.queryByTestId('animated-rolling-case')).not.toBeInTheDocument()
  }, 15_000)

  it('uses the mystery suspense image for knife targets until reveal completes', () => {
    const finalItem = makeItem({
      ...knifeSkin,
      instanceId: 'knife-1',
      marketValue: 820,
      rarity: Rarity.Covert,
    })

    render(
      <CaseOpeningAnimation
        finalItem={finalItem}
        onComplete={vi.fn()}
        potentialSkins={[
          { skin: fillerSkin, weight: 100 },
          { skin: knifeSkin, weight: 1 },
        ]}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(1_250)
    })

    expect(screen.getByTestId('case-opening-target')).toHaveTextContent('Rare Special Item | Mystery Drop')
    expect(screen.getByTestId('case-opening-target')).toHaveClass('border-rarity-covert')
    expect(screen.getByTestId('case-opening-target')).not.toHaveClass('border-rarity-special')
    expect(screen.getByTestId('gold-suspense-placeholder')).toHaveAttribute('src', '/assets/GOLDGOLDGOLD.png')
    expect(screen.getByTestId('case-opening-target')).not.toHaveTextContent('Karambit | Doppler')

    act(() => {
      vi.advanceTimersByTime(6_750)
    })

    expect(screen.getByTestId('opening-result')).toHaveTextContent('Karambit | Doppler')
  }, 15_000)

  it('keeps knife reveals open until the player closes them', () => {
    const finalItem = makeItem({
      ...knifeSkin,
      instanceId: 'knife-manual-close',
      marketValue: 820,
    })
    const onComplete = vi.fn()

    render(
      <CaseOpeningAnimation
        finalItem={finalItem}
        onComplete={onComplete}
        potentialSkins={[{ skin: fillerSkin, weight: 100 }]}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(8_000)
    })

    expect(screen.getByTestId('opening-result')).toHaveTextContent('Karambit | Doppler')

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(onComplete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Close'))

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith(finalItem)
  }, 15_000)

  it('uses suspense art for all Special Item targets until reveal completes', () => {
    const finalItem = makeItem({
      ...rareNonKnifeSkin,
      instanceId: 'special-1',
      marketValue: 1500,
    })

    render(
      <CaseOpeningAnimation
        finalItem={finalItem}
        onComplete={vi.fn()}
        potentialSkins={[{ skin: fillerSkin, weight: 100 }]}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(1_250)
    })

    expect(screen.getByTestId('case-opening-target')).toHaveTextContent('Rare Special Item | Mystery Drop')
    expect(screen.getByTestId('gold-suspense-placeholder')).toHaveAttribute('src', '/assets/GOLDGOLDGOLD.png')

    act(() => {
      vi.advanceTimersByTime(6_750)
    })

    expect(screen.getByTestId('opening-result')).toHaveTextContent('AWP | Dragon Lore')
  }, 15_000)

  it('places a near-miss gold placeholder beside the real winning card', () => {
    const finalItem = makeItem({
      ...fillerSkin,
      instanceId: 'near-miss-normal',
      marketValue: 0.03,
    })

    render(
      <CaseOpeningAnimation
        finalItem={finalItem}
        firstCaseHook="nearMissGold"
        onComplete={vi.fn()}
        potentialSkins={[{ skin: fillerSkin, weight: 100 }]}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(1_250)
    })

    expect(screen.getByTestId('case-opening-target')).toHaveTextContent('P250 | Sand Dune')
    expect(screen.getByTestId('case-opening-target')).not.toHaveTextContent('Rare Special Item | Mystery Drop')
    expect(screen.getByTestId('gold-suspense-placeholder')).toHaveAttribute('src', '/assets/GOLDGOLDGOLD.png')
  }, 15_000)
})
