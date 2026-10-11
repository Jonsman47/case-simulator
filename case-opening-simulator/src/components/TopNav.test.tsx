/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { getPrimaryNavigationItems } from '../data/navigation'
import { TopNav } from './TopNav'

afterEach(() => {
  cleanup()
})

describe('TopNav', () => {
  it('keeps Credits as the final right-aligned red navigation item and Work in normal tabs', () => {
    expect(getPrimaryNavigationItems()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Work',
          path: '/work',
        }),
      ]),
    )
    expect(getPrimaryNavigationItems().at(-1)).toMatchObject({
      align: 'right',
      label: 'Credits',
      path: '/credits',
      tone: 'danger',
    })
  })

  it('opens a mobile navigation drawer and closes it after route selection', () => {
    render(
      <MemoryRouter initialEntries={['/inventory']}>
        <TopNav />
      </MemoryRouter>,
    )

    const menuButton = screen.getByRole('button', {
      name: 'Open navigation menu, current screen Inventory',
    })

    expect(menuButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(menuButton)

    expect(menuButton).toHaveAttribute('aria-expanded', 'true')

    const drawer = screen.getByRole('dialog', { name: 'Primary navigation' })

    fireEvent.click(within(drawer).getByRole('link', { name: 'Cases' }))

    expect(screen.queryByRole('dialog', { name: 'Primary navigation' })).not.toBeInTheDocument()
  })

  it('only shows the admin panel link for admin users', () => {
    render(
      <MemoryRouter initialEntries={['/market']}>
        <TopNav />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', {
      name: 'Open navigation menu, current screen Market',
    }))

    expect(screen.queryByRole('link', { name: 'Admin Panel' })).not.toBeInTheDocument()

    cleanup()

    render(
      <MemoryRouter initialEntries={['/market']}>
        <TopNav isAdminUser />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', {
      name: 'Open navigation menu, current screen Market',
    }))

    expect(screen.getAllByRole('link', { name: 'Admin Panel' }).length).toBeGreaterThan(0)
  })
})
