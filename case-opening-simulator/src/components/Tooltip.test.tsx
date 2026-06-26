/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Tooltip } from './Tooltip'

afterEach(() => {
  cleanup()
})

describe('Tooltip', () => {
  it('shows on hover and hides when the pointer leaves', () => {
    render(
      <Tooltip label="Explain expected value">
        Expected value is an average over many openings.
      </Tooltip>,
    )

    const trigger = screen.getByRole('button', { name: 'Explain expected value' })

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    fireEvent.mouseEnter(trigger)

    expect(screen.getByRole('tooltip')).toHaveTextContent('Expected value is an average')

    fireEvent.mouseLeave(trigger)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('supports keyboard focus and blur', () => {
    render(
      <Tooltip label="Explain balance">
        Balance is spendable cash.
      </Tooltip>,
    )

    const trigger = screen.getByRole('button', { name: 'Explain balance' })

    fireEvent.focus(trigger)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Balance is spendable cash.')

    fireEvent.blur(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
