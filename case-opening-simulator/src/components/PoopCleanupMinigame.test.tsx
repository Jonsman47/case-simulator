/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PoopCleanupMinigame } from './PoopCleanupMinigame'

describe('PoopCleanupMinigame', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('hides each clicked pile and completes after all three are cleaned', () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()

    render(<PoopCleanupMinigame onClose={vi.fn()} onComplete={onComplete} />)

    expect(screen.getByText('0 / 3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clean pile 1' }))
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Clean pile 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clean pile 3' }))

    expect(screen.getByText('3 / 3')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(220)
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
