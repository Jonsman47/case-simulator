/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChartData } from 'chart.js'
import { PriceChart } from './PriceChart'

vi.mock('react-chartjs-2', () => ({
  Line: ({ data, ...props }: { data: ChartData<'line'>; 'aria-label': string }) => (
    <div
      aria-label={props['aria-label']}
      data-labels={JSON.stringify(data.labels)}
      data-values={JSON.stringify(data.datasets[0].data)}
      role="img"
    />
  ),
}))

const now = Date.UTC(2026, 5, 22, 12)
const dayMs = 24 * 60 * 60 * 1_000
const hourMs = 60 * 60 * 1_000

afterEach(() => {
  cleanup()
})

describe('PriceChart', () => {
  it('builds chart data from stored history and updates when switching scales', async () => {
    const user = userEvent.setup()

    render(
      <PriceChart
        history={{
          ak47_redline: [
            { timestamp: now - 8 * dayMs, value: 40 },
            { timestamp: now - 2 * dayMs, value: 50 },
            { timestamp: now - 3 * hourMs, value: 60 },
            { timestamp: now, value: 80 },
          ],
        }}
        initialScale="30d"
        now={now}
        skinId="ak47_redline"
      />,
    )

    expect(await screen.findByRole('img', { name: 'Price History chart' })).toHaveAttribute(
      'data-values',
      JSON.stringify([40, 50, 60, 80]),
    )
    expect(screen.getByText(/Avg \$57\.50/i)).toBeInTheDocument()
    expect(screen.getByText(/\+100%/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '24H' }))

    expect(await screen.findByRole('img', { name: 'Price History chart' })).toHaveAttribute(
      'data-values',
      JSON.stringify([60, 80]),
    )
    expect(screen.getByText(/Avg \$70\.00/i)).toBeInTheDocument()
    expect(screen.getByText(/\+33\.33%/i)).toBeInTheDocument()
  })

  it('shows a placeholder when the selected range has too little history', () => {
    render(
      <PriceChart
        history={{
          ak47_redline: [{ timestamp: now, value: 80 }],
        }}
        now={now}
        skinId="ak47_redline"
      />,
    )

    expect(screen.queryByRole('img', { name: 'Price History chart' })).not.toBeInTheDocument()
    expect(screen.getByText(/at least two ticks/i)).toBeInTheDocument()
  })
})
