/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { GlossaryTerm } from './GlossaryTerm'

describe('contextual glossary', () => {
  afterEach(cleanup)
  it('opens from hover and focus, reveals details, links to Help, and closes with Escape', () => {
    render(<MemoryRouter><GlossaryTerm term="float" /></MemoryRouter>)
    const trigger = screen.getByRole('button', { name: 'Explain Float' })
    fireEvent.mouseEnter(trigger)
    expect(screen.getByRole('dialog', { name: 'Float explanation' })).toHaveTextContent('How worn a skin is')
    fireEvent.click(screen.getByRole('button', { name: 'More details' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('valid float range')
    expect(screen.getByRole('link', { name: 'Help Center' })).toHaveAttribute('href', '/help?term=float')
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.focus(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('opens with a tap and stays within a narrow viewport', () => {
    render(<MemoryRouter><GlossaryTerm term="openingFunds" /></MemoryRouter>)
    const trigger = screen.getByRole('button', { name: 'Explain Case Opening Funds' })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Case Opening Funds explanation' })).toHaveTextContent('It pays first')
    fireEvent.click(screen.getByRole('button', { name: 'More details' }))
    expect(screen.getByRole('dialog', { name: 'Case Opening Funds explanation' })).toHaveTextContent('cannot buy skins')
    fireEvent.click(screen.getByRole('dialog', { name: 'Case Opening Funds explanation' }).querySelector('button[aria-label="Close explanation"]')!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
