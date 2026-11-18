// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Rarity, WearCondition } from '../data/models'
import { AcquisitionReveal } from './AcquisitionReveal'

const acquisition = {
  id: 'trade-reveal-1',
  createdAt: 1,
  source: 'trade-up' as const,
  item: {
    id: 'output', weapon: 'AK-47', finish: 'Result', rarity: Rarity.Classified,
    baseValue: 100, caseIds: ['case'], image: '/output.png', instanceId: 'result-instance',
    wear: WearCondition.MinimalWear, floatValue: .12, marketValue: 85, isLocked: false,
    isFavorited: false, discoveredAt: 1, paintSeed: 661, statTrak: true,
  },
}

describe('AcquisitionReveal', () => {
  afterEach(cleanup)
  it('uses a skippable saved-result sequence for Trade-Ups', () => {
    const claim = vi.fn()
    render(<AcquisitionReveal acquisition={acquisition} onClaim={claim} tradeUpResult={{ inputValue: 100, outputValue: 85, profit: -15 }} />)
    expect(screen.getByText('Contract sealed')).toBeVisible()
    expect(screen.getByText(/already saved/i)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Skip reveal' }))
    expect(screen.getByText('Contract Result')).toBeVisible()
    expect(screen.getByText('StatTrak™')).toBeVisible()
    expect(screen.getByText('-$15.00')).toBeVisible()
    expect(claim).not.toHaveBeenCalled()
  })

  it('reveals immediately when reduced motion is enabled', () => {
    render(<AcquisitionReveal acquisition={acquisition} onClaim={() => undefined} reducedMotion />)
    expect(screen.getByText('Contract Result')).toBeVisible()
    expect(screen.queryByText('Contract sealed')).not.toBeInTheDocument()
  })
})
