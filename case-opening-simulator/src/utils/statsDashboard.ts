import type { ChartData } from 'chart.js'
import type { GameState } from '../data/gameState'
import { Rarity } from '../data/models'
import { SKIN_DEFINITIONS } from '../data/skins'
import { getCurrentItemMarketValue, trimInventoryValueHistory, type InventoryValuePoint } from './inventory'
import { getRarityLabel } from './itemLabels'

export type StatsTimeRange = 'session' | '24h' | '7d' | 'all'

export interface StatsSessionBaseline {
  casesOpened: number
  drops: number
  inventoryValue: number
  moneyEarned: number
  moneySpent: number
  startedAt: number
  tradeUpsCompleted: number
}

export interface StatsRarityBucket {
  color: string
  count: number
  percentage: number
  rarity: Rarity
}

export interface StatsMilestone {
  description: string
  id: string
  label: string
  timestamp: number
}

export interface StatsComparatives {
  averageCasesPerHour: number
  averageNetPerHour: number
  sessionCasesOpened: number
  sessionCasesPerHour: number
  sessionNet: number
  sessionValueChange: number
}

export interface StatsDashboardSummary {
  achievementsUnlocked: number
  autoOpenerLevel: number
  automationModulesPurchased: number
  automationModuleLevels: number
  casesUnlocked: number
  comparatives: StatsComparatives
  filteredInventoryValueHistory: InventoryValuePoint[]
  highestItemValue: number
  inventoryCount: number
  inventoryValue: number
  itemsSold: number
  milestones: StatsMilestone[]
  moneyEarned: number
  moneySpent: number
  netProfit: number
  prestigeLevel: number
  rareDropsClassifiedPlus: number
  rarityBuckets: StatsRarityBucket[]
  timePlayedMs: number
  totalCasesOpened: number
  totalDrops: number
  tradeUpsCompleted: number
}

const dayMs = 24 * 60 * 60 * 1_000
const hourMs = 60 * 60 * 1_000

export const statsRarityOrder = [
  Rarity.Consumer,
  Rarity.Industrial,
  Rarity.MilSpec,
  Rarity.Restricted,
  Rarity.Classified,
  Rarity.Covert,
  Rarity.SpecialItem,
  Rarity.Contraband,
]

export const statsRarityColors: Record<Rarity, string> = {
  [Rarity.Consumer]: '#9ca3af',
  [Rarity.Industrial]: '#5e98d9',
  [Rarity.MilSpec]: '#4b69ff',
  [Rarity.Restricted]: '#8847ff',
  [Rarity.Classified]: '#d32ce6',
  [Rarity.Covert]: '#eb4b4b',
  [Rarity.SpecialItem]: '#ffd700',
  [Rarity.Contraband]: '#e4ae39',
}

const skinDefinitionsById = new Map(SKIN_DEFINITIONS.map((skin) => [skin.id, skin]))

function roundMetric(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function isValidTimestamp(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function createStatsSessionBaseline(state: GameState, startedAt = Date.now()): StatsSessionBaseline {
  return {
    casesOpened: state.statistics.casesOpened,
    drops: state.statistics.drops,
    inventoryValue: state.inventoryValue,
    moneyEarned: state.statistics.moneyEarned,
    moneySpent: state.statistics.moneySpent,
    startedAt,
    tradeUpsCompleted: state.statistics.tradeUpsCompleted,
  }
}

export function getStatsWindowStart(
  range: StatsTimeRange,
  now: number,
  sessionStartedAt: number,
) {
  if (range === 'session') {
    return sessionStartedAt
  }

  if (range === '24h') {
    return now - dayMs
  }

  if (range === '7d') {
    return now - 7 * dayMs
  }

  return 0
}

export function filterStatsHistoryByRange(
  history: InventoryValuePoint[],
  range: StatsTimeRange,
  now: number,
  sessionStartedAt: number,
) {
  const sortedHistory = trimInventoryValueHistory(history)
  const windowStart = getStatsWindowStart(range, now, sessionStartedAt)

  if (windowStart <= 0) {
    return sortedHistory
  }

  return sortedHistory.filter((point) => point.timestamp >= windowStart && point.timestamp <= now)
}

function getHighestItemValue(state: GameState) {
  const currentInventoryValues = state.inventory.map((item) => (
    getCurrentItemMarketValue(item, state.marketValues)
  ))
  const historicCollectionValues = state.collectionBook.map((entry) => entry.highestValue ?? 0)
  const recentDropValues = state.recentDrops.map((item) => item.marketValue)

  return roundMetric(Math.max(0, ...currentInventoryValues, ...historicCollectionValues, ...recentDropValues))
}

function getFirstActivityTimestamp(state: GameState) {
  const timestamps = [
    ...state.inventory.map((item) => item.discoveredAt),
    ...state.recentDrops.map((item) => item.discoveredAt),
    ...state.collectionBook.map((entry) => entry.firstFoundAt),
    ...state.achievements.map((achievement) => achievement.unlockedAt),
    ...state.inventoryValueHistory.map((point) => point.timestamp),
    ...Object.values(state.marketHistory).flatMap((points) => points.map((point) => point.timestamp)),
    state.lastSaved,
  ].filter(isValidTimestamp)

  if (timestamps.length === 0) {
    return undefined
  }

  return Math.min(...timestamps)
}

function getAchievementTimestamp(state: GameState, achievementId: string) {
  return state.achievements.find((achievement) => achievement.id === achievementId)?.unlockedAt
}

function buildMilestones(state: GameState, range: StatsTimeRange, now: number, sessionStartedAt: number) {
  const windowStart = getStatsWindowStart(range, now, sessionStartedAt)
  const entryBySkinId = new Map(state.collectionBook.map((entry) => [entry.skinId, entry]))
  const firstCollectionEntry = [...state.collectionBook]
    .filter((entry) => isValidTimestamp(entry.firstFoundAt))
    .sort((left, right) => left.firstFoundAt - right.firstFoundAt)[0]
  const firstRareEntry = [...state.collectionBook]
    .filter((entry) => {
      const rarity = skinDefinitionsById.get(entry.skinId)?.rarity

      return (
        isValidTimestamp(entry.firstFoundAt) &&
        (rarity === Rarity.Classified ||
          rarity === Rarity.Covert ||
          rarity === Rarity.SpecialItem ||
          rarity === Rarity.Contraband)
      )
    })
    .sort((left, right) => left.firstFoundAt - right.firstFoundAt)[0]
  const firstRareSkin = firstRareEntry ? skinDefinitionsById.get(firstRareEntry.skinId) : undefined
  const milestones: StatsMilestone[] = []

  if (firstCollectionEntry) {
    const skin = skinDefinitionsById.get(firstCollectionEntry.skinId)

    milestones.push({
      description: skin ? `${skin.weapon} | ${skin.finish}` : firstCollectionEntry.skinId,
      id: 'first_case_opened',
      label: 'First case opened',
      timestamp: firstCollectionEntry.firstFoundAt,
    })
  }

  if (firstRareEntry && firstRareSkin) {
    milestones.push({
      description: `${getRarityLabel(firstRareSkin.rarity)} drop: ${firstRareSkin.weapon} | ${firstRareSkin.finish}`,
      id: 'first_rare_drop',
      label: 'First rare drop',
      timestamp: firstRareEntry.firstFoundAt,
    })
  }

  const firstProfitAt = getAchievementTimestamp(state, 'first_profit_case')
  const firstPrestigeAt = getAchievementTimestamp(state, 'first_prestige')
  const firstTradeUpAt = getAchievementTimestamp(state, 'first_trade_up')
  const firstSpecialAt = getAchievementTimestamp(state, 'first_special_item')
  const firstCovertAt = getAchievementTimestamp(state, 'first_covert')

  if (firstProfitAt) {
    milestones.push({
      description: 'Money earned from a sale or auto-sale.',
      id: 'first_profit_case',
      label: 'First profit',
      timestamp: firstProfitAt,
    })
  }

  if (firstCovertAt) {
    milestones.push({
      description: 'First Covert item discovered.',
      id: 'first_covert',
      label: 'First Covert',
      timestamp: firstCovertAt,
    })
  }

  if (firstSpecialAt) {
    milestones.push({
      description: 'First knife or special item discovered.',
      id: 'first_special_item',
      label: 'First Special Item',
      timestamp: firstSpecialAt,
    })
  }

  if (firstTradeUpAt) {
    milestones.push({
      description: 'First trade-up contract completed.',
      id: 'first_trade_up',
      label: 'First trade-up',
      timestamp: firstTradeUpAt,
    })
  }

  if (firstPrestigeAt) {
    milestones.push({
      description: `Prestige level ${state.prestigeLevel}`,
      id: 'first_prestige',
      label: 'First prestige',
      timestamp: firstPrestigeAt,
    })
  }

  const uniqueMilestones = new Map(milestones.map((milestone) => [milestone.id, milestone]))

  return [...uniqueMilestones.values()]
    .filter((milestone) => milestone.timestamp >= windowStart && milestone.timestamp <= now)
    .filter((milestone) => milestone.id !== 'first_case_opened' || entryBySkinId.size > 0)
    .sort((left, right) => right.timestamp - left.timestamp)
}

function buildRarityBuckets(state: GameState): StatsRarityBucket[] {
  const totalDrops = Math.max(0, state.statistics.drops)

  return statsRarityOrder.map((rarity) => {
    const count = state.statistics.dropsByRarity[rarity] ?? 0
    const percentage = totalDrops > 0 ? (count / totalDrops) * 100 : 0

    return {
      color: statsRarityColors[rarity],
      count,
      percentage: roundMetric(percentage, 1),
      rarity,
    }
  })
}

function getComparatives(
  state: GameState,
  baseline: StatsSessionBaseline,
  now: number,
  timePlayedMs: number,
): StatsComparatives {
  const sessionHours = Math.max((now - baseline.startedAt) / hourMs, 1 / 60)
  const lifetimeHours = Math.max(timePlayedMs / hourMs, 1 / 60)
  const sessionCasesOpened = Math.max(0, state.statistics.casesOpened - baseline.casesOpened)
  const sessionMoneyEarned = state.statistics.moneyEarned - baseline.moneyEarned
  const sessionMoneySpent = state.statistics.moneySpent - baseline.moneySpent
  const sessionNet = roundMetric(sessionMoneyEarned - sessionMoneySpent)

  return {
    averageCasesPerHour: roundMetric(state.statistics.casesOpened / lifetimeHours, 1),
    averageNetPerHour: roundMetric((state.statistics.moneyEarned - state.statistics.moneySpent) / lifetimeHours),
    sessionCasesOpened,
    sessionCasesPerHour: roundMetric(sessionCasesOpened / sessionHours, 1),
    sessionNet,
    sessionValueChange: roundMetric(state.inventoryValue - baseline.inventoryValue),
  }
}

export function calculateStatsDashboardSummary({
  baseline,
  now,
  range,
  state,
}: {
  baseline: StatsSessionBaseline
  now: number
  range: StatsTimeRange
  state: GameState
}): StatsDashboardSummary {
  const firstActivityAt = getFirstActivityTimestamp(state)
  const timePlayedMs = firstActivityAt ? Math.max(0, now - firstActivityAt) : 0
  const automationModules = Object.values(state.automation.modules)
  const rarityBuckets = buildRarityBuckets(state)
  const rareDropsClassifiedPlus = [
    Rarity.Classified,
    Rarity.Covert,
    Rarity.SpecialItem,
    Rarity.Contraband,
  ].reduce((total, rarity) => total + (state.statistics.dropsByRarity[rarity] ?? 0), 0)

  return {
    achievementsUnlocked: state.achievements.length,
    autoOpenerLevel: state.automation.autoOpener.level,
    automationModulesPurchased: automationModules.filter((moduleState) => moduleState.level > 0).length,
    automationModuleLevels: automationModules.reduce((total, moduleState) => total + moduleState.level, 0),
    casesUnlocked: state.casesUnlocked.length,
    comparatives: getComparatives(state, baseline, now, timePlayedMs),
    filteredInventoryValueHistory: filterStatsHistoryByRange(
      state.inventoryValueHistory,
      range,
      now,
      baseline.startedAt,
    ),
    highestItemValue: getHighestItemValue(state),
    inventoryCount: state.inventory.length,
    inventoryValue: state.inventoryValue,
    itemsSold: state.statistics.itemsSold,
    milestones: buildMilestones(state, range, now, baseline.startedAt),
    moneyEarned: state.statistics.moneyEarned,
    moneySpent: state.statistics.moneySpent,
    netProfit: roundMetric(state.statistics.moneyEarned - state.statistics.moneySpent),
    prestigeLevel: state.prestigeLevel,
    rareDropsClassifiedPlus,
    rarityBuckets,
    timePlayedMs,
    totalCasesOpened: state.statistics.casesOpened,
    totalDrops: state.statistics.drops,
    tradeUpsCompleted: state.statistics.tradeUpsCompleted,
  }
}

export function buildRarityDistributionChartData(
  summary: StatsDashboardSummary,
): ChartData<'bar'> {
  return {
    labels: summary.rarityBuckets.map((bucket) => getRarityLabel(bucket.rarity)),
    datasets: [
      {
        backgroundColor: summary.rarityBuckets.map((bucket) => `${bucket.color}cc`),
        borderColor: summary.rarityBuckets.map((bucket) => bucket.color),
        borderWidth: 1,
        data: summary.rarityBuckets.map((bucket) => bucket.count),
      },
    ],
  }
}

export function buildRarityPieChartData(summary: StatsDashboardSummary): ChartData<'pie'> {
  const visibleBuckets = summary.rarityBuckets.filter((bucket) => bucket.count > 0)

  return {
    labels: visibleBuckets.map((bucket) => getRarityLabel(bucket.rarity)),
    datasets: [
      {
        backgroundColor: visibleBuckets.map((bucket) => bucket.color),
        borderColor: '#080b10',
        borderWidth: 2,
        data: visibleBuckets.map((bucket) => bucket.count),
      },
    ],
  }
}

export function buildMoneyFlowChartData(summary: StatsDashboardSummary): ChartData<'bar'> {
  return {
    labels: ['Spent', 'Earned', 'Net'],
    datasets: [
      {
        backgroundColor: ['#eb4b4bcc', '#22c55ecc', summary.netProfit >= 0 ? '#ffd700cc' : '#eb4b4bcc'],
        borderColor: ['#eb4b4b', '#22c55e', summary.netProfit >= 0 ? '#ffd700' : '#eb4b4b'],
        borderWidth: 1,
        data: [summary.moneySpent, summary.moneyEarned, summary.netProfit],
      },
    ],
  }
}

export function buildInventoryValueLineChartData(
  points: InventoryValuePoint[],
): ChartData<'line'> {
  return {
    labels: points.map((point) => new Date(point.timestamp).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
    })),
    datasets: [
      {
        backgroundColor: 'rgba(34, 197, 94, 0.14)',
        borderColor: '#22c55e',
        data: points.map((point) => point.value),
        fill: true,
        pointRadius: 2,
        tension: 0.35,
      },
    ],
  }
}

export function buildStatsCsv(summary: StatsDashboardSummary) {
  const metricRows = [
    ['metric', 'value'],
    ['total_cases_opened', summary.totalCasesOpened],
    ['money_spent', summary.moneySpent],
    ['money_earned', summary.moneyEarned],
    ['net_profit', summary.netProfit],
    ['total_drops', summary.totalDrops],
    ['rare_drops_classified_plus', summary.rareDropsClassifiedPlus],
    ['highest_item_value', summary.highestItemValue],
    ['items_sold', summary.itemsSold],
    ['trade_ups_completed', summary.tradeUpsCompleted],
    ['cases_unlocked', summary.casesUnlocked],
    ['achievements_unlocked', summary.achievementsUnlocked],
    ['auto_opener_level', summary.autoOpenerLevel],
    ['automation_modules_purchased', summary.automationModulesPurchased],
    ['automation_module_levels', summary.automationModuleLevels],
    ['prestige_level', summary.prestigeLevel],
  ]
  const rarityRows = summary.rarityBuckets.map((bucket) => [
    `drops_${bucket.rarity}`,
    bucket.count,
  ])

  return [...metricRows, ...rarityRows]
    .map((row) => row.map((value) => String(value).replaceAll('"', '""')).map((value) => `"${value}"`).join(','))
    .join('\n')
}
