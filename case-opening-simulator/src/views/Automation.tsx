import { BadgePercent, Bot, Boxes, Clock, Pause, Play, ShoppingCart, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AssetImage } from '../components/AssetImage'
import { AutomationShop } from '../components/AutomationShop'
import { getSkinRarityColor } from '../data/rarities'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'
import {
  AUTOMATION_MODULE_DEFINITIONS,
  AUTOMATION_MODULE_IDS,
  CASE_FARM_INTERVAL_MS,
  TRADING_BOT_INTERVAL_MS,
  getAutoOpenerProgress,
  getAutoOpenerTimeRemainingMs,
  getAutoOpenerUpgradeCost,
  getAuctionHouseRefreshMs,
  getCaseFarmIncomePerTick,
  getMarketAnalystSellBonus,
  getOpeningDeskBatchSize,
  getOpeningDeskIntervalMs,
  getTradingBotMinimumProfit,
} from '../utils/automation'
import { getSkinRarityLabel } from '../utils/itemLabels'
import {
  AutomationModuleId,
  type AutomationModuleState,
  type SkinInstance,
} from '../data/models'
import { getAutomationModuleCapacity, getUpgradeAutomationIntervalMultiplier } from '../data/upgrades'
import { getPrestigeAutomationIntervalMultiplier } from '../data/prestige'
import { getSkillAutomationIntervalMultiplier } from '../data/skills'
import { getInventoryCapacity, getInventoryFreeSlots } from '../utils/inventoryCapacity'

function formatDuration(ms: number) {
  const seconds = Math.ceil(ms / 1_000)

  if (seconds < 60) {
    return `${seconds}s`
  }

  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function getRemainingMs(moduleState: AutomationModuleState, intervalMs: number, now: number) {
  return Math.max(0, intervalMs - (now - moduleState.lastRunTime))
}

function getModuleIntervalMs(moduleState: AutomationModuleState) {
  if (moduleState.id === AutomationModuleId.OpeningDesk) {
    return getOpeningDeskIntervalMs(moduleState.level)
  }

  if (moduleState.id === AutomationModuleId.CaseFarm) {
    return CASE_FARM_INTERVAL_MS
  }

  if (moduleState.id === AutomationModuleId.TradingBot) {
    return TRADING_BOT_INTERVAL_MS
  }

  if (moduleState.id === AutomationModuleId.AuctionHouse) {
    return getAuctionHouseRefreshMs(moduleState.level)
  }

  return undefined
}

function getModuleTotalLabel(moduleState: AutomationModuleState) {
  if (moduleState.id === AutomationModuleId.OpeningDesk) {
    return `${moduleState.totalGenerated} cases opened`
  }

  if (moduleState.id === AutomationModuleId.CaseFarm) {
    return `${formatCurrency(moduleState.totalGenerated)} farmed`
  }

  if (moduleState.id === AutomationModuleId.TradingBot) {
    return `${formatCurrency(moduleState.totalGenerated)} contract edge`
  }

  if (moduleState.id === AutomationModuleId.MarketAnalyst) {
    return `+${Math.round(getMarketAnalystSellBonus(moduleState.level) * 100)}% sell value`
  }

  if (moduleState.id === AutomationModuleId.WarehouseSystem) {
    return 'Capacity expansion active'
  }

  return `${moduleState.totalRuns} deal refreshes`
}

function getModuleDetailLabel(moduleState: AutomationModuleState, unlockedCaseCount: number) {
  if (moduleState.id === AutomationModuleId.OpeningDesk) {
    return `${getOpeningDeskBatchSize(moduleState.level)} cases per run`
  }

  if (moduleState.id === AutomationModuleId.CaseFarm) {
    return `${formatCurrency(getCaseFarmIncomePerTick(moduleState.level, unlockedCaseCount))} per tick`
  }

  if (moduleState.id === AutomationModuleId.TradingBot) {
    return `Min +${formatCurrency(getTradingBotMinimumProfit(moduleState.level))} edge`
  }

  return 'Passive module'
}

export function Automation() {
  const {
    availableCases,
    purchaseAutoOpener,
    purchaseAuctionDeal,
    setAutoOpenerCase,
    state,
    toggleAutoOpener,
  } = useGame()
  const [now, setNow] = useState(() => Date.now())
  const autoOpener = state.automation.autoOpener
  const automationIntervalMultiplier =
    getUpgradeAutomationIntervalMultiplier(state.upgrades) *
    getPrestigeAutomationIntervalMultiplier(state.prestigeBonuses) *
    getSkillAutomationIntervalMultiplier(state.learnedSkillNodeIds)
  const effectiveAutoOpener = useMemo(() => ({
    ...autoOpener,
    intervalMs: Math.round(autoOpener.intervalMs * automationIntervalMultiplier),
  }), [autoOpener, automationIntervalMultiplier])
  const selectedCaseId = autoOpener.caseId ?? availableCases[0]?.id ?? 'starter_case'
  const selectedCase = availableCases.find((caseDef) => caseDef.id === selectedCaseId)
  const upgradeCost = getAutoOpenerUpgradeCost(autoOpener.level)
  const canAffordUpgrade = state.money >= upgradeCost
  const progress = getAutoOpenerProgress(effectiveAutoOpener, now)
  const remainingMs = getAutoOpenerTimeRemainingMs(effectiveAutoOpener, now)
  const recentAutomationDrops = useMemo(() => state.recentDrops.slice(0, 6), [state.recentDrops])
  const inventoryCapacity = getInventoryCapacity(state)
  const freeSlots = getInventoryFreeSlots(state)
  const auctionModule = state.automation.modules[AutomationModuleId.AuctionHouse]
  const auctionDeals = state.automation.auctionHouse.deals.filter((deal) => deal.expiresAt > now)
  const activeModules = useMemo(
    () =>
      AUTOMATION_MODULE_IDS.map((moduleId) => state.automation.modules[moduleId]).filter((moduleState) => {
        return moduleState.isEnabled && moduleState.level > 0
      }),
    [state.automation.modules],
  )
  const moduleCapacity = getAutomationModuleCapacity(state.upgrades)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-5 sm:p-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="border-l-4 border-rarity-mil-spec pl-4">
          <p className="font-mono text-xs uppercase text-rarity-mil-spec">Idle Systems</p>
          <h2 className="mt-1 text-3xl font-semibold text-cs-text sm:text-4xl">Automation</h2>
          <p className="mt-2 max-w-2xl text-sm text-cs-muted">
            Buy modules, pick a case, and let the simulator work while you manage the market.
          </p>
        </div>
        <div className="grid gap-2 border border-cs-border bg-cs-panel p-3 sm:grid-cols-4">
          <StatPill label="Level" value={String(autoOpener.level)} />
          <StatPill label="Interval" value={formatDuration(effectiveAutoOpener.intervalMs)} />
          <StatPill label="Auto Opens" value={String(autoOpener.totalOpened)} />
          <StatPill label="Modules" value={`${activeModules.filter((module) => module.id !== AutomationModuleId.WarehouseSystem).length}/${moduleCapacity}`} />
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.75fr)]">
        <div className="space-y-5">
          <section className="border border-cs-border bg-cs-panel p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 place-items-center border border-rarity-mil-spec bg-rarity-mil-spec/10 text-rarity-mil-spec">
                  <Bot size={24} />
                </div>
                <div>
                  <p className="font-mono text-xs uppercase text-cs-muted">Core Module</p>
                  <h3 className="mt-1 text-2xl font-semibold text-cs-text">Auto Opener</h3>
                  <p className="mt-2 text-sm text-cs-muted">
                    Next upgrade costs {formatCurrency(upgradeCost)}.
                  </p>
                </div>
              </div>
              <button
                className="inline-flex items-center justify-center gap-2 border border-rarity-special bg-rarity-special/10 px-4 py-3 font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20 disabled:cursor-not-allowed disabled:border-cs-border disabled:bg-transparent disabled:text-cs-muted"
                disabled={!canAffordUpgrade}
                onClick={() => purchaseAutoOpener(selectedCaseId)}
                type="button"
              >
                <ShoppingCart size={18} />
                {autoOpener.level > 0 ? 'Upgrade' : 'Purchase'}
              </button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="font-mono text-xs uppercase text-cs-muted">Selected Case</span>
                <select
                  className="mt-2 w-full border border-cs-border bg-cs-surface px-3 py-3 text-sm text-cs-text outline-none focus:border-rarity-special"
                  onChange={(event) => setAutoOpenerCase(event.target.value)}
                  value={selectedCaseId}
                >
                  {availableCases.map((caseDef) => (
                    <option key={caseDef.id} value={caseDef.id}>
                      {caseDef.name} / {formatCurrency(caseDef.cost)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="border border-cs-border bg-cs-surface p-3">
                <p className="font-mono text-xs uppercase text-cs-muted">Status</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className={autoOpener.isEnabled ? 'text-cs-green' : 'text-cs-muted'}>
                    {autoOpener.isEnabled ? 'Running' : 'Paused'}
                  </p>
                  <button
                    className="inline-flex items-center gap-2 border border-cs-border px-3 py-2 text-sm font-medium text-cs-muted transition-colors hover:text-cs-text disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={autoOpener.level <= 0}
                    onClick={() => toggleAutoOpener()}
                    type="button"
                  >
                    {autoOpener.isEnabled ? <Pause size={16} /> : <Play size={16} />}
                    {autoOpener.isEnabled ? 'Pause' : 'Resume'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 border border-cs-border bg-cs-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="text-rarity-mil-spec" size={18} />
                  <p className="font-mono text-xs uppercase text-cs-muted">Next Open</p>
                </div>
                <p className="font-mono text-xs uppercase text-cs-text">
                  {autoOpener.isEnabled ? formatDuration(remainingMs) : 'Paused'}
                </p>
              </div>
              <div className="mt-3 h-3 border border-cs-border bg-cs-panel">
                <div
                  className="h-full bg-rarity-mil-spec transition-[width]"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-cs-muted">
                <span>{selectedCase?.name ?? 'No case selected'}</span>
                <span>{selectedCase ? formatCurrency(selectedCase.cost) : formatCurrency(0)}</span>
              </div>
            </div>
          </section>

          <AutomationShop />

          <section className="min-w-0 border border-cs-border bg-cs-panel p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center border border-rarity-special bg-rarity-special/10 text-rarity-special">
                  <BadgePercent size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold text-cs-text">Auction House Deals</h3>
                  <p className="mt-1 text-sm text-cs-muted">Limited simulated offers; each purchase is charged and delivered exactly once.</p>
                </div>
              </div>
              <span className="shrink-0 border border-cs-border bg-cs-surface px-3 py-2 font-mono text-[10px] uppercase text-cs-muted">
                {auctionModule.isEnabled && auctionModule.level > 0
                  ? `Refresh ${formatDuration(Math.max(0, state.automation.auctionHouse.nextRefreshTime - now))}`
                  : 'Module inactive'}
              </span>
            </div>

            <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
              {auctionDeals.map((deal) => {
                const rarityColor = getSkinRarityColor(deal.item)
                const canBuy = state.money >= deal.price && freeSlots > 0

                return (
                  <article className="min-w-0 border bg-cs-surface p-3" key={deal.id} style={{ borderColor: rarityColor }}>
                    <div className="flex min-w-0 gap-3">
                      <div className="grid h-20 w-20 shrink-0 place-items-center border border-cs-border bg-cs-panel">
                        <AssetImage alt="" className="h-16 w-16 object-contain" src={deal.item.image} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate font-semibold text-cs-text">{deal.item.weapon} | {deal.item.finish}</h4>
                        <p className="mt-1 font-mono text-[10px] uppercase" style={{ color: rarityColor }}>
                          {getSkinRarityLabel(deal.item)} / {deal.item.wear}
                        </p>
                        <p className="mt-2 text-sm text-cs-muted">
                          <span className="line-through">{formatCurrency(deal.listPrice)}</span>{' '}
                          <strong className="text-cs-green">{formatCurrency(deal.price)}</strong>
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase text-rarity-special">
                        {Math.round(deal.discount * 100)}% off / {formatDuration(deal.expiresAt - now)} left
                      </span>
                      <button
                        className="inline-flex items-center gap-2 border border-rarity-special px-3 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/10 disabled:cursor-not-allowed disabled:border-cs-border disabled:text-cs-muted"
                        disabled={!canBuy}
                        onClick={() => purchaseAuctionDeal(deal.id)}
                        title={freeSlots <= 0 ? 'Inventory is full' : state.money < deal.price ? 'Not enough money' : 'Purchase deal'}
                        type="button"
                      >
                        <ShoppingCart size={15} /> Buy
                      </button>
                    </div>
                  </article>
                )
              })}
              {auctionDeals.length === 0 ? (
                <div className="grid min-h-32 place-items-center border border-cs-border bg-cs-surface p-4 text-center text-sm text-cs-muted sm:col-span-2">
                  {auctionModule.level > 0 ? 'The Auction House is waiting for its next refresh.' : 'Purchase the Auction House module to generate offers.'}
                </div>
              ) : null}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <StatPill label="Deals Purchased" value={String(state.statistics.auctionPurchases)} />
              <StatPill label="Auction Savings" value={formatCurrency(state.statistics.auctionSavings)} />
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="border border-cs-border bg-cs-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-cs-text">Warehouse</h3>
              <Boxes className="text-rarity-classified" size={20} />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <StatPill label="Used" value={`${state.inventory.length} / ${inventoryCapacity}`} />
              <StatPill label="Free Slots" value={String(freeSlots)} />
            </div>
            <p className="mt-3 text-xs leading-5 text-cs-muted">
              Full storage pauses item-generating purchases and automation before money is spent. Existing over-capacity saves remain intact.
            </p>
          </section>
          <section className="border border-cs-border bg-cs-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-cs-text">Active Tasks</h3>
              <Clock className="text-rarity-mil-spec" size={20} />
            </div>
            <div className="mt-4 space-y-2">
              {autoOpener.isEnabled && autoOpener.level > 0 ? (
                <TaskRow
                  detail={`1 case / ${selectedCase?.name ?? 'selected case'}`}
                  name="Auto Opener"
                  next={formatDuration(remainingMs)}
                  total={`${autoOpener.totalOpened} cases opened`}
                />
              ) : null}
              {activeModules.map((moduleState) => {
                const definition = AUTOMATION_MODULE_DEFINITIONS[moduleState.id]
                const baseIntervalMs = getModuleIntervalMs(moduleState)
                const intervalMs = baseIntervalMs
                  ? Math.round(baseIntervalMs * automationIntervalMultiplier)
                  : undefined
                const next = intervalMs
                  ? formatDuration(getRemainingMs(moduleState, intervalMs, now))
                  : 'Passive'

                return (
                  <TaskRow
                    detail={getModuleDetailLabel(moduleState, state.casesUnlocked.length)}
                    key={moduleState.id}
                    name={definition.name}
                    next={next}
                    total={getModuleTotalLabel(moduleState)}
                  />
                )
              })}
              {!autoOpener.isEnabled && activeModules.length === 0 ? (
                <div className="grid min-h-28 place-items-center border border-cs-border bg-cs-surface p-4 text-center text-sm text-cs-muted">
                  Purchase and enable a module to start background work.
                </div>
              ) : null}
            </div>
          </section>

          <section className="border border-cs-border bg-cs-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-cs-text">Automation Drops</h3>
              <Zap className="text-rarity-special" size={20} />
            </div>
            <div className="mt-4 space-y-2">
              {recentAutomationDrops.length > 0 ? (
                recentAutomationDrops.map((item) => (
                  <AutomationDropRow item={item} key={item.instanceId} />
                ))
              ) : (
                <div className="grid min-h-28 place-items-center border border-cs-border bg-cs-surface p-4 text-center text-sm text-cs-muted">
                  Recent drops appear here after automation opens cases.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}

function TaskRow({
  detail,
  name,
  next,
  total,
}: {
  detail: string
  name: string
  next: string
  total: string
}) {
  return (
    <article className="border border-cs-border bg-cs-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-cs-text">{name}</h4>
          <p className="mt-1 font-mono text-[10px] uppercase text-cs-muted">{detail}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-xs uppercase text-rarity-mil-spec">{next}</p>
          <p className="mt-1 text-xs text-cs-muted">{total}</p>
        </div>
      </div>
    </article>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-cs-border bg-cs-surface px-3 py-2">
      <p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-cs-text">{value}</p>
    </div>
  )
}

function AutomationDropRow({ item }: { item: SkinInstance }) {
  const rarityColor = getSkinRarityColor(item)

  return (
    <article className="border bg-cs-surface p-3" style={{ borderColor: rarityColor }}>
      <div className="flex items-center gap-3">
        <div
          className="grid h-14 w-14 place-items-center border bg-cs-panel"
          style={{ borderColor: rarityColor, backgroundColor: `${rarityColor}14` }}
        >
          <AssetImage alt="" className="h-10 w-10 object-contain" src={item.image} />
        </div>
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-cs-text">
            {item.weapon} | {item.finish}
          </h4>
          <p className="mt-1 font-mono text-[10px] uppercase text-cs-muted">
            <span style={{ color: rarityColor }}>{getSkinRarityLabel(item)}</span> / {formatCurrency(item.marketValue)}
          </p>
        </div>
      </div>
    </article>
  )
}
