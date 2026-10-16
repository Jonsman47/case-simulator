import BlueGemCalculator, { type BlueGemPercentages } from 'csgo-blue-gem-calculator'
import { FadeCalculator } from 'csgo-fade-percentage-calculator'
import type { SkinBase, SkinInstance, SkinPattern } from '../data/models'
import { roundCurrency } from './safeNumbers'

export const MAX_PATTERN_ADJUSTED_VALUE = 1_000_000_000

const blueGemCalculator = new BlueGemCalculator()
const akTierOneSeeds = new Set([151, 179, 321, 387, 661, 670, 955])
const akTierTwoSeeds = new Set([4, 13, 168, 429, 592, 905])
const fiveSevenTierOneSeeds = new Set([278, 363, 670, 690, 768, 868])
const karambitMarbleFadeFirstMaxSeeds = new Set([412])
const karambitMarbleFadeSecondMaxSeeds = new Set([16, 146, 241, 359, 393, 541, 602, 649, 688, 701])

const dopplerPhases: Record<number, string> = {
  415: 'Ruby',
  416: 'Sapphire',
  417: 'Black Pearl',
  418: 'Phase 1',
  419: 'Phase 2',
  420: 'Phase 3',
  421: 'Phase 4',
}

const gammaDopplerPhases: Record<number, string> = {
  568: 'Emerald',
  569: 'Phase 1',
  570: 'Phase 2',
  571: 'Phase 3',
  572: 'Phase 4',
}

const tierRank = {
  standard: 0,
  notable: 1,
  rare: 2,
  exceptional: 3,
  iconic: 4,
} as const

function standardPattern(family: SkinPattern['family'] = 'standard', name = 'Standard pattern'): SkinPattern {
  return {
    family,
    name,
    tier: 'standard',
    premiumMultiplier: 1,
    referenceConfidence: 'neutral',
  }
}

function normalizeSeed(seed: number) {
  return Math.min(1000, Math.max(0, Math.trunc(seed)))
}

export function generatePaintSeed(prng: () => number = Math.random) {
  const roll = prng()
  const normalizedRoll = Number.isFinite(roll) ? Math.min(0.999999999999, Math.max(0, roll)) : 0

  return Math.floor(normalizedRoll * 1001)
}

function getBluePercentage(percentages: BlueGemPercentages) {
  return percentages.top?.blue ?? percentages.playside?.blue
}

function getBlueGemPercentage(skin: SkinBase, seed: number) {
  const finish = skin.finish === 'Heat Treated' ? 'Heat Treated' : 'Case Hardened'

  try {
    if (!blueGemCalculator.getSupportedItems(finish).includes(skin.weapon)) {
      return undefined
    }

    return getBluePercentage(blueGemCalculator.getPercentages(finish, skin.weapon, seed))
  } catch {
    return undefined
  }
}

function classifyAkCaseHardened(seed: number, bluePercentage?: number): SkinPattern {
  if (seed === 661) {
    return {
      family: 'case_hardened',
      name: 'AK-47 Blue Gem · Pattern 661',
      tier: 'iconic',
      premiumMultiplier: 100,
      referenceConfidence: 'estimated',
      bluePercentage,
      description: 'Widely documented as the most desirable AK-47 Case Hardened pattern. Premium is a conservative game estimate, not a live appraisal.',
    }
  }

  if (akTierOneSeeds.has(seed)) {
    return {
      family: 'case_hardened',
      name: 'AK-47 Blue Gem · Tier 1',
      tier: 'exceptional',
      premiumMultiplier: 18,
      referenceConfidence: 'estimated',
      bluePercentage,
    }
  }

  if (akTierTwoSeeds.has(seed)) {
    return {
      family: 'case_hardened',
      name: 'AK-47 Blue Gem · Tier 2',
      tier: 'rare',
      premiumMultiplier: 6,
      referenceConfidence: 'estimated',
      bluePercentage,
    }
  }

  return standardPattern('case_hardened', 'Case Hardened')
}

function classifyFiveSevenCaseHardened(seed: number, bluePercentage?: number): SkinPattern {
  if (fiveSevenTierOneSeeds.has(seed)) {
    return {
      family: 'case_hardened',
      name: 'Five-SeveN Blue Gem · Tier 1',
      tier: 'exceptional',
      premiumMultiplier: seed === 278 || seed === 690 ? 8 : 6,
      referenceConfidence: 'estimated',
      bluePercentage,
    }
  }

  return standardPattern('case_hardened', 'Case Hardened')
}

function classifyMeasuredBluePattern(family: 'case_hardened' | 'heat_treated', bluePercentage?: number): SkinPattern {
  const label = family === 'heat_treated' ? 'Heat Treated' : 'Case Hardened'

  if (bluePercentage === undefined) {
    return standardPattern(family, label)
  }

  const thresholds = family === 'heat_treated'
    ? [
        { minimum: 90, multiplier: 6, tier: 'exceptional' as const },
        { minimum: 80, multiplier: 3, tier: 'rare' as const },
        { minimum: 70, multiplier: 1.6, tier: 'notable' as const },
      ]
    : [
        { minimum: 95, multiplier: 8, tier: 'exceptional' as const },
        { minimum: 90, multiplier: 4, tier: 'rare' as const },
        { minimum: 80, multiplier: 2, tier: 'notable' as const },
        { minimum: 70, multiplier: 1.35, tier: 'notable' as const },
      ]
  const match = thresholds.find((entry) => bluePercentage >= entry.minimum)

  if (!match) {
    return {
      ...standardPattern(family, label),
      bluePercentage,
    }
  }

  return {
    family,
    name: `${label} · High Blue Coverage`,
    tier: match.tier,
    premiumMultiplier: match.multiplier,
    referenceConfidence: 'estimated',
    bluePercentage,
    description: 'Coverage is calculated from paint-seed pattern pixels. The premium is a conservative in-game estimate rather than a community tier claim.',
  }
}

function classifyCaseHardened(skin: SkinBase, seed: number): SkinPattern {
  const bluePercentage = getBlueGemPercentage(skin, seed)

  if (skin.weapon === 'AK-47') {
    return classifyAkCaseHardened(seed, bluePercentage)
  }

  if (skin.weapon === 'Five-SeveN') {
    return classifyFiveSevenCaseHardened(seed, bluePercentage)
  }

  if (skin.weapon === 'Karambit' && seed === 387) {
    return {
      family: 'case_hardened',
      name: 'Karambit Blue Gem · Pattern 387',
      tier: 'iconic',
      premiumMultiplier: 250,
      referenceConfidence: 'estimated',
      bluePercentage,
      description: 'Documented as an iconic Karambit Blue Gem. The simulator premium is deliberately bounded and is not a live appraisal.',
    }
  }

  return classifyMeasuredBluePattern('case_hardened', bluePercentage)
}

function classifyFade(skin: SkinBase, seed: number): SkinPattern {
  let fadePercentage: number | undefined

  try {
    if (FadeCalculator.getSupportedWeapons().includes(skin.weapon)) {
      fadePercentage = FadeCalculator.getFadePercentage(skin.weapon, seed).percentage
    }
  } catch {
    fadePercentage = undefined
  }

  if (fadePercentage === undefined) {
    return standardPattern('fade', 'Fade')
  }

  if (fadePercentage >= 99.5) {
    return { family: 'fade', name: 'Full Fade', tier: 'exceptional', premiumMultiplier: 1.35, referenceConfidence: 'estimated', fadePercentage }
  }

  if (fadePercentage >= 97) {
    return { family: 'fade', name: 'Near Full Fade', tier: 'rare', premiumMultiplier: 1.2, referenceConfidence: 'estimated', fadePercentage }
  }

  if (fadePercentage >= 93) {
    return { family: 'fade', name: 'High Fade', tier: 'notable', premiumMultiplier: 1.1, referenceConfidence: 'estimated', fadePercentage }
  }

  return { ...standardPattern('fade', 'Fade'), fadePercentage }
}

function classifyPaintKitPhase(family: 'doppler' | 'gamma_doppler', skin: SkinBase): SkinPattern {
  const phase = skin.phase ?? (skin.paintIndex === undefined
    ? undefined
    : family === 'doppler' ? dopplerPhases[skin.paintIndex] : gammaDopplerPhases[skin.paintIndex])
  const normalizedPhase = phase?.toLowerCase()
  const isGamma = family === 'gamma_doppler'
  const multiplier = normalizedPhase === 'emerald'
    ? 4
    : normalizedPhase === 'sapphire'
      ? 4
      : normalizedPhase === 'ruby'
        ? 3.5
        : normalizedPhase === 'black pearl'
          ? 3
          : normalizedPhase === 'phase 2'
            ? (isGamma ? 1.25 : 1.2)
            : normalizedPhase === 'phase 4'
              ? 1.1
              : 1
  const tier = multiplier >= 3
    ? 'exceptional'
    : multiplier > 1.1
      ? 'rare'
      : multiplier > 1
        ? 'notable'
        : 'standard'

  return {
    family,
    name: phase ? `${isGamma ? 'Gamma Doppler' : 'Doppler'} · ${phase}` : isGamma ? 'Gamma Doppler' : 'Doppler',
    tier,
    premiumMultiplier: multiplier,
    referenceConfidence: phase ? 'verified' : 'neutral',
    phase,
    description: 'Doppler variants are paint-kit phases; the paint seed is stored but does not choose the phase.',
  }
}

function classifyMarbleFade(skin: SkinBase, seed: number): SkinPattern {
  if (skin.weapon !== 'Karambit') {
    return standardPattern('marble_fade', 'Marble Fade')
  }

  if (karambitMarbleFadeFirstMaxSeeds.has(seed)) {
    return { family: 'marble_fade', name: 'Karambit 1st Max Fire & Ice', tier: 'iconic', premiumMultiplier: 6, referenceConfidence: 'estimated' }
  }

  if (karambitMarbleFadeSecondMaxSeeds.has(seed)) {
    return { family: 'marble_fade', name: 'Karambit 2nd Max Fire & Ice', tier: 'exceptional', premiumMultiplier: 3, referenceConfidence: 'estimated' }
  }

  return standardPattern('marble_fade', 'Marble Fade')
}

export function classifySkinPattern(skin: SkinBase, rawSeed: number): SkinPattern {
  const seed = normalizeSeed(rawSeed)
  const finish = skin.finish.toLowerCase()

  if (finish === 'case hardened') {
    return classifyCaseHardened(skin, seed)
  }

  if (finish === 'heat treated') {
    return classifyMeasuredBluePattern('heat_treated', getBlueGemPercentage(skin, seed))
  }

  if (finish === 'fade') {
    return classifyFade(skin, seed)
  }

  if (finish === 'gamma doppler') {
    return classifyPaintKitPhase('gamma_doppler', skin)
  }

  if (finish === 'doppler') {
    return classifyPaintKitPhase('doppler', skin)
  }

  if (finish === 'marble fade') {
    return classifyMarbleFade(skin, seed)
  }

  if (finish === 'crimson web') {
    return standardPattern('crimson_web', 'Crimson Web')
  }

  if (finish === 'slaughter') {
    return standardPattern('slaughter', 'Slaughter')
  }

  return standardPattern()
}

export function applyPatternPremium(baseValue: number, pattern?: Pick<SkinPattern, 'premiumMultiplier'>) {
  const safeBase = Number.isFinite(baseValue) ? Math.max(0, baseValue) : 0
  const rawMultiplier = pattern?.premiumMultiplier
  const multiplier = Number.isFinite(rawMultiplier) ? Math.max(1, rawMultiplier ?? 1) : 1

  return roundCurrency(Math.min(MAX_PATTERN_ADJUSTED_VALUE, safeBase * multiplier))
}

export function getPatternPremiumValue(baseValue: number, pattern?: SkinPattern) {
  return roundCurrency(Math.max(0, applyPatternPremium(baseValue, pattern) - Math.max(0, baseValue)))
}

export function getPatternTierRank(pattern?: SkinPattern) {
  return pattern ? tierRank[pattern.tier] : 0
}

export function isSpecialPattern(item: Pick<SkinInstance, 'pattern'>) {
  return getPatternTierRank(item.pattern) >= tierRank.notable
}

export function isExceptionalPattern(item: Pick<SkinInstance, 'pattern'>) {
  return getPatternTierRank(item.pattern) >= tierRank.exceptional
}

export function getPatternTierLabel(pattern?: SkinPattern) {
  if (!pattern) {
    return 'Legacy item'
  }

  return pattern.tier.charAt(0).toUpperCase() + pattern.tier.slice(1)
}
