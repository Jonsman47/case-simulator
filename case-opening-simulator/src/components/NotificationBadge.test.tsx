/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NotificationBadge } from './NotificationBadge'

describe('NotificationBadge', () => {
  it('has a descriptive accessible label and caps visible counts at 99+', () => {
    render(<NotificationBadge count={120} label="Achievements & Stats" />)
    expect(screen.getByRole('status', { name: 'Achievements & Stats, 120 notifications' })).toHaveTextContent('99+')
  })

  it('renders nothing for zero', () => {
    const { container } = render(<NotificationBadge count={0} label="Quests" />)
    expect(container).toBeEmptyDOMElement()
  })
})
