import { describe, expect, it } from 'vitest'
import { pickDrop, RARITY_WEIGHTS } from './dropLogic'
import { Rarity } from './models'

describe('drop logic', () => {
  it('picks drops deterministically with an injected PRNG', () => {
    const dropTable = [
      { skinId: 'common_skin', weight: 70 },
      { skinId: 'rare_skin', weight: 20 },
      { skinId: 'mythic_skin', weight: 10 },
    ]

    expect(pickDrop(dropTable, () => 0)).toBe('common_skin')
    expect(pickDrop(dropTable, () => 0.7)).toBe('rare_skin')
    expect(pickDrop(dropTable, () => 0.95)).toBe('mythic_skin')
  })

  it('falls back to equal odds when every weight is zero', () => {
    const dropTable = [
      { skinId: 'first_skin', weight: 0 },
      { skinId: 'second_skin', weight: 0 },
    ]

    expect(pickDrop(dropTable, () => 0.24)).toBe('first_skin')
    expect(pickDrop(dropTable, () => 0.74)).toBe('second_skin')
  })

  it('keeps global rarity baselines ordered from common to rare', () => {
    expect(RARITY_WEIGHTS[Rarity.Consumer]).toBeGreaterThan(RARITY_WEIGHTS[Rarity.Industrial])
    expect(RARITY_WEIGHTS[Rarity.Industrial]).toBeGreaterThan(RARITY_WEIGHTS[Rarity.MilSpec])
    expect(RARITY_WEIGHTS[Rarity.MilSpec]).toBeGreaterThan(RARITY_WEIGHTS[Rarity.Restricted])
    expect(RARITY_WEIGHTS[Rarity.Restricted]).toBeGreaterThan(RARITY_WEIGHTS[Rarity.Classified])
    expect(RARITY_WEIGHTS[Rarity.Classified]).toBeGreaterThan(RARITY_WEIGHTS[Rarity.Covert])
    expect(RARITY_WEIGHTS[Rarity.Covert]).toBeGreaterThan(RARITY_WEIGHTS[Rarity.SpecialItem])
    expect(RARITY_WEIGHTS[Rarity.SpecialItem]).toBeGreaterThan(RARITY_WEIGHTS[Rarity.Contraband])
  })
})
