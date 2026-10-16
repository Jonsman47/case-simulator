declare module 'csgo-blue-gem-calculator' {
  interface ColorPercentages {
    blue: number
    purple: number
    gold: number
    other: number
  }

  export interface BlueGemPercentages {
    seed: number
    top?: ColorPercentages
    magazine?: ColorPercentages
    playside?: ColorPercentages
    backside?: ColorPercentages
  }

  export default class BlueGemCalculator {
    getSupportedItems(finish: 'Case Hardened' | 'Heat Treated'): string[]
    getPercentages(
      finish: 'Case Hardened' | 'Heat Treated',
      item: string,
      seed: number,
    ): BlueGemPercentages
  }
}
