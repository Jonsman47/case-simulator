import { CAREER_RANKS, getCumulativeXpForLevel } from './careerProgress'

export type CareerArchetypeId =
  | 'casual'
  | 'regular'
  | 'dedicated'
  | 'opening-focused'
  | 'trading-focused'
  | 'collection-focused'
  | 'trade-up-focused'

export interface CareerArchetypeAssumption {
  id: CareerArchetypeId
  label: string
  /** Provisional effective XP/hour after current anti-farming rules. */
  effectiveXpPerHour: number
  note: string
}

export const CAREER_ARCHETYPE_ASSUMPTIONS: CareerArchetypeAssumption[] = [
  { id: 'casual', label: 'Casual', effectiveXpPerHour: 900, note: 'Short mixed sessions with low transaction volume.' },
  { id: 'regular', label: 'Regular', effectiveXpPerHour: 2_200, note: 'Mixed active play with recurring Work and trading.' },
  { id: 'dedicated', label: 'Dedicated', effectiveXpPerHour: 4_200, note: 'High-engagement mixed play using several systems.' },
  { id: 'opening-focused', label: 'Opening focused', effectiveXpPerHour: 2_400, note: 'Paid openings constrained by negative expected return and repetition decay.' },
  { id: 'trading-focused', label: 'Trading focused', effectiveXpPerHour: 4_600, note: 'Frequent ledger-backed profitable trades without wash trading.' },
  { id: 'collection-focused', label: 'Collection focused', effectiveXpPerHour: 3_600, note: 'Novelty is strong early and slows as the catalog fills.' },
  { id: 'trade-up-focused', label: 'Trade-up focused', effectiveXpPerHour: 3_300, note: 'Varied contracts; repeated identical inputs are diminished.' },
]

export interface CareerProjection {
  id: CareerArchetypeId
  label: string
  effectiveXpPerHour: number
  hoursToRanks: Record<string, number>
  note: string
}

export function projectCareerArchetypes(
  assumptions = CAREER_ARCHETYPE_ASSUMPTIONS,
): CareerProjection[] {
  return assumptions.map((assumption) => ({
    ...assumption,
    hoursToRanks: Object.fromEntries(CAREER_RANKS.map((rank) => [
      rank.id,
      Number((getCumulativeXpForLevel(rank.minimumLevel) / assumption.effectiveXpPerHour).toFixed(1)),
    ])),
  }))
}
