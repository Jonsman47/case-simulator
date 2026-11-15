import { describe, expect, it } from 'vitest'
import { PrestigeBonusId, SkillNodeId, UpgradeId, type PrestigeBonusLevels, type UpgradeLevels } from '../data/models'
import { getPrestigeAutomationIntervalMultiplier, getPrestigeSellMultiplier } from '../data/prestige'
import { getSkillAutomationIntervalMultiplier, getSkillMinigameRewardMultiplier, getSkillPassiveIncomeMultiplier, getSkillSellMultiplier } from '../data/skills'
import { getClickIncomeMultiplier, getUpgradeAutomationIntervalMultiplier, getUpgradeSellValueMultiplier } from '../data/upgrades'
import { CASE_FARM_INTERVAL_MS, getAuctionHouseDealCount, getAuctionHouseDiscount, getAuctionHouseRefreshMs, getCaseFarmIncomePerTick, getMarketAnalystSellBonus } from './automation'
import { getWorkBaseReward, workMiniGamesById, type WorkMiniGameId } from './workMinigames'

const workIds: WorkMiniGameId[] = ['poopCleaning', 'sortBoxes', 'precisionStrike', 'memoryCircuit', 'diamondMiner', 'packageDelivery', 'warehouseRush', 'circuitRepair']

function workIncomePerHour(upgrades: UpgradeLevels, skills: SkillNodeId[], performance: number) {
  const multiplier = getClickIncomeMultiplier(upgrades) * getSkillMinigameRewardMultiplier(skills)
  return workIds.reduce((total, gameId) => {
    const game = workMiniGamesById.get(gameId)!
    return total + getWorkBaseReward(gameId, performance) * multiplier * (60 * 60_000 / game.cooldownMs)
  }, 0)
}

describe('economy balance scenarios', () => {
  it('keeps archived Work modifiers neutral during the Career transition', () => {
    const early = workIncomePerHour({}, [], 0.6)
    const mid = workIncomePerHour({ [UpgradeId.ClickIncome]: 3 }, ['minigame_3' as SkillNodeId], 0.6)
    const late = workIncomePerHour({ [UpgradeId.ClickIncome]: 10 }, ['minigame_10' as SkillNodeId], 1)

    expect(early).toBeCloseTo(676.96, 1)
    expect(mid).toBeCloseTo(676.96, 1)
    expect(late).toBeCloseTo(783.68, 1)
    expect(mid).toBe(early)
    expect(late).toBeGreaterThan(mid)
    expect(early).toBeLessThan(700)
  })

  it('keeps Case Farm growth finite and tied to costly progression', () => {
    const earlyHourly = getCaseFarmIncomePerTick(1, 2) * (60 * 60_000 / CASE_FARM_INTERVAL_MS)
    const midHourly = getCaseFarmIncomePerTick(5, 20) * (60 * 60_000 / CASE_FARM_INTERVAL_MS)
    const lateBaseHourly = getCaseFarmIncomePerTick(10, 42) * (60 * 60_000 / CASE_FARM_INTERVAL_MS)
    const lateSkills = ['passive_income_10' as SkillNodeId]

    expect(earlyHourly).toBe(360)
    expect(midHourly).toBeCloseTo(14_652, 2)
    expect(lateBaseHourly).toBeCloseTo(82_368, 2)
    expect(lateBaseHourly * getSkillPassiveIncomeMultiplier(lateSkills)).toBeCloseTo(82_368, 2)
  })

  it('caps discount, deal-count, speed, and sale multiplier stacking', () => {
    const maxSkills = [
      'automation_10' as SkillNodeId,
      'auto_sell_10' as SkillNodeId,
      'market_10' as SkillNodeId,
    ]
    const maxUpgrades: UpgradeLevels = {
      [UpgradeId.AutomationServos]: 5,
      [UpgradeId.MarketSignal]: 5,
    }
    const maxPrestige = {
      [PrestigeBonusId.AutomationSpeed]: 15,
      [PrestigeBonusId.SellValue]: 15,
    } as PrestigeBonusLevels
    const automationIntervalMultiplier = getUpgradeAutomationIntervalMultiplier(maxUpgrades) * getPrestigeAutomationIntervalMultiplier(maxPrestige) * getSkillAutomationIntervalMultiplier(maxSkills)
    const saleMultiplier = (1 + getMarketAnalystSellBonus(8)) * getUpgradeSellValueMultiplier(maxUpgrades) * getPrestigeSellMultiplier(maxPrestige) * getSkillSellMultiplier(maxSkills)

    expect(getAuctionHouseDiscount(999)).toBe(0.24)
    expect(getAuctionHouseDealCount(999, 999)).toBe(8)
    expect(getAuctionHouseRefreshMs(999)).toBe(7 * 60_000)
    expect(automationIntervalMultiplier).toBeGreaterThanOrEqual(0.29)
    expect(saleMultiplier).toBeLessThan(2.1)
    expect(Number.isFinite(saleMultiplier)).toBe(true)
  })
})
