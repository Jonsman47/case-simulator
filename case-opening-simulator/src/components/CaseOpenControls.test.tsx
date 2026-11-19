/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CaseStatus, type CaseDefinition } from '../data/models'
import { CaseOpenControls } from './CaseOpenControls'

const caseDef: CaseDefinition = {
  id: 'kilowatt_case',
  name: 'Kilowatt Case',
  cost: 2.65,
  status: CaseStatus.Unlocked,
  dropTable: [{ skinId: 'ak47_redline', weight: 1 }],
  image: '/assets/placeholder.png',
}

describe('CaseOpenControls', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('shows all compact quantities with non-wrapping labels', () => {
    const onOpen = vi.fn()

    render(<CaseOpenControls canOpen caseDef={caseDef} money={100} onOpen={onOpen} />)

    expect(screen.getByRole('button', { name: /^open 1$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^open 10$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^open 5$/i })).toHaveClass('whitespace-nowrap')
    expect(screen.queryByRole('button', { name: /open 100/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^open 10$/i }))

    expect(onOpen).toHaveBeenCalledWith(10, { skipAnimations: false })
  })

  it('shows upgraded Open 20 and Open 30 actions when max quantity increases', () => {
    const onOpen = vi.fn()

    render(<CaseOpenControls canOpen caseDef={caseDef} maxQuantity={30} money={500} onOpen={onOpen} />)

    expect(screen.getByRole('button', { name: /^open 20$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^open 30$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /open 100/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^open 30$/i }))

    expect(onOpen).toHaveBeenCalledWith(30, { skipAnimations: false })
  })

  it('adds later batch buttons only after progression raises the max quantity', () => {
    const onOpen = vi.fn()

    render(<CaseOpenControls canOpen caseDef={caseDef} maxQuantity={100} money={1_000} onOpen={onOpen} />)

    expect(screen.getByRole('button', { name: /^open 40$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^open 100$/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^open 100$/i }))

    expect(onOpen).toHaveBeenCalledWith(100, { skipAnimations: false })
  })

  it('remembers the last opening quantity for a repeated case-opening loop', () => {
    const firstOpen = vi.fn()
    const firstRender = render(<CaseOpenControls canOpen caseDef={caseDef} money={100} onOpen={firstOpen} />)
    const firstControls = within(firstRender.container)

    fireEvent.click(firstControls.getByRole('button', { name: /^open 5$/i }))
    expect(firstControls.getByRole('button', { name: /^open 5$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(firstControls.getByText('Repeat preference: Open 5')).toBeInTheDocument()

    firstRender.unmount()
    const secondRender = render(<CaseOpenControls canOpen caseDef={caseDef} money={100} onOpen={vi.fn()} />)
    const secondControls = within(secondRender.container)

    expect(secondControls.getByRole('button', { name: /^open 5$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(secondControls.getByText('Repeat preference: Open 5')).toBeInTheDocument()
  })
})
