import { describe, expect, it } from 'vitest'
import { projectCareerArchetypes } from './careerAnalysis'

describe('preliminary Career progression projections', () => {
  it('projects every requested player archetype deterministically', () => {
    const projections = projectCareerArchetypes()
    expect(projections.map((projection) => projection.id)).toEqual([
      'casual',
      'regular',
      'dedicated',
      'opening-focused',
      'trading-focused',
      'collection-focused',
      'trade-up-focused',
    ])
    expect(projections.every((projection) => projection.hoursToRanks['case-addict'] === 0)).toBe(true)
    expect(projections.every((projection) => projection.hoursToRanks['cs2-trading-legend'] > 0)).toBe(true)
  })

  it('shows the tuned single-run level-100 range without making it a first-Prestige requirement', () => {
    const byId = new Map(projectCareerArchetypes().map((projection) => [projection.id, projection]))
    expect(byId.get('dedicated')?.hoursToRanks['cs2-trading-legend']).toBe(741.9)
    expect(byId.get('trading-focused')?.hoursToRanks['cs2-trading-legend']).toBe(677.4)
    expect(byId.get('casual')?.hoursToRanks['cs2-trading-legend']).toBeGreaterThan(3_000)
    expect(byId.get('opening-focused')?.hoursToRanks['cs2-trading-legend']).toBeGreaterThan(1_000)
  })
})
