/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AssetImage } from './AssetImage'

describe('AssetImage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('retries a failed asset once and then falls back to the placeholder', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123)

    render(<AssetImage alt="skin" src="/assets/missing.png" />)

    const image = screen.getByAltText('skin')

    fireEvent.error(image)
    expect(image).toHaveAttribute('src', '/assets/missing.png?retry=123')

    fireEvent.error(image)
    expect(image).toHaveAttribute('src', '/assets/placeholder.png')
  })
})
