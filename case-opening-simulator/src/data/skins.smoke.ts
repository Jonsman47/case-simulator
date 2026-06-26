import {
  SKIN_DEFINITIONS,
  randomFloatForWear,
  randomWearCondition,
  getRandomSkinDefinition,
} from './skins'

export function logRandomSkinSamples(sampleSize = 20) {
  const samples = Array.from({ length: sampleSize }, () => {
    const skin = getRandomSkinDefinition()
    const wear = randomWearCondition()

    return {
      skinId: skin.id,
      weapon: skin.weapon,
      finish: skin.finish,
      rarity: skin.rarity,
      wear,
      floatValue: randomFloatForWear(wear),
    }
  })

  const distribution = samples.reduce<Record<string, number>>((counts, sample) => {
    counts[sample.wear] = (counts[sample.wear] ?? 0) + 1
    return counts
  }, {})

  console.table(samples)
  console.table(distribution)

  return samples
}

export const seededSkinCount = SKIN_DEFINITIONS.length
