// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { getItemEditionLabel } from '../utils/itemEdition'
import { ItemEditionBadge } from './ItemEditionBadge'

describe('ItemEditionBadge', () => {
  it('identifies StatTrak with the complete player-facing label', () => {
    render(<ItemEditionBadge item={{ statTrak: true, souvenir: false }} />)
    expect(screen.getByText('StatTrak™')).toHaveAttribute('data-edition', 'stattrak')
    expect(screen.getByLabelText('Edition: StatTrak™')).toBeVisible()
  })

  it('identifies Souvenir without relying on color', () => {
    render(<ItemEditionBadge item={{ statTrak: false, souvenir: true }} />)
    expect(screen.getByText('Souvenir')).toHaveAttribute('data-edition', 'souvenir')
  })

  it('hides regular labels unless the surrounding UI requests them', () => {
    const { rerender } = render(<ItemEditionBadge item={{ statTrak: false, souvenir: false }} />)
    expect(screen.queryByText('Regular')).not.toBeInTheDocument()
    rerender(<ItemEditionBadge item={{ statTrak: false, souvenir: false }} showRegular />)
    expect(screen.getByText('Regular')).toBeVisible()
    expect(getItemEditionLabel({ statTrak: false, souvenir: false })).toBe('Regular')
  })
})
