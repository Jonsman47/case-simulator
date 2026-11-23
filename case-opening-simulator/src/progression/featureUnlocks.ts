import { getCareerSnapshot } from '../career/careerProgress'
import type { FeatureId, GameState } from '../data/gameState'
import { getPrestigeEligibilityV2 } from '../prestige/prestigeSystem'
import { analyzeTradeUp, getTradeUpInputCount, isTradeUpEligibleItem } from '../utils/tradeUp'

export interface FeatureProgress {
  id: FeatureId
  name: string
  description: string
  current: number
  target: number
  unlocked: boolean
  path: string
}

export const featureOrder: FeatureId[] = ['collection-book', 'quests', 'market', 'cswear', 'trade-ups', 'business', 'prestige']
const progressCache = new WeakMap<GameState, FeatureProgress[]>()

export function getTradeUpEligibleProgress(state: GameState) {
  const groups = new Map<string, typeof state.inventory>()
  for (const item of state.inventory.filter(isTradeUpEligibleItem)) {
    const key = `${item.rarity}:${item.statTrak ? 'st' : 'standard'}`
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  let best = 0
  for (const group of groups.values()) {
    const count = getTradeUpInputCount(group[0]?.rarity)
    for (let length = Math.min(count, group.length); length > best; length--) {
      const sample = group.slice(0, length)
      if (length < count || analyzeTradeUp({ inputItems: sample, marketValues: state.marketValues }).canTradeUp) {
        best = length
        break
      }
    }
  }
  return best
}

export function getFeatureProgress(state: GameState): FeatureProgress[] {
  const cached = progressCache.get(state)
  if (cached) return cached
  const level = getCareerSnapshot(state.career).level
  const permanent = new Set(state.ui.featureUnlocks?.unlockedIds ?? [])
  const opened = state.statistics.casesOpened > 0
  const acquired = state.collectionBook.length > 0 || state.inventory.length > 0 || opened
  const sales = state.statistics.itemsSold + state.statistics.marketSales
  const tradeUpCount = getTradeUpEligibleProgress(state)
  const usedMarket = state.statistics.marketPurchases + state.statistics.marketSales > 0 || state.marketplace.transactions.length > 0
  const usedBusiness = Object.values(state.business.employees).some((employee) => employee.isHired)
  const prestige = getPrestigeEligibilityV2(state)
  const rows: Omit<FeatureProgress, 'unlocked'>[] = [
    { id: 'collection-book', name: 'Collection Book', description: 'Your first real skin discovery opens the collection record.', current: acquired ? 1 : 0, target: 1, path: '/collection-book' },
    { id: 'quests', name: 'Quests', description: 'Complete your first case opening to see goals and rewards.', current: opened ? 1 : 0, target: 1, path: '/quests' },
    { id: 'market', name: 'Market Price Checker', description: 'Sell one item to learn how prices work.', current: Math.min(1, sales), target: 1, path: '/market' },
    { id: 'cswear', name: 'CSWEAR', description: 'Reach Career level 3 to explore simulated trading.', current: Math.min(3, level), target: 3, path: '/cswear' },
    { id: 'trade-ups', name: 'Trade-Ups', description: 'Own ten compatible, eligible ordinary skins for a real contract.', current: Math.min(10, tradeUpCount), target: 10, path: '/trade-ups' },
    { id: 'business', name: 'Business', description: 'Reach Career level 15 to hire your first employees.', current: Math.min(15, level), target: 15, path: '/business' },
    { id: 'prestige', name: 'Prestige', description: 'Complete the Career path and objectives shown on the Prestige page.', current: prestige.canPrestige ? 1 : 0, target: 1, path: '/prestige' },
  ]
  const progress = rows.map((row) => ({ ...row, unlocked: permanent.has(row.id) || row.current >= row.target || (row.id === 'cswear' && usedMarket) || (row.id === 'trade-ups' && state.statistics.tradeUpsCompleted > 0) || (row.id === 'business' && usedBusiness) || (row.id === 'prestige' && state.prestigeLevel > 0) }))
  progressCache.set(state, progress)
  return progress
}

export function isFeatureUnlocked(state: GameState, id: FeatureId) {
  return getFeatureProgress(state).find((feature) => feature.id === id)?.unlocked ?? false
}
