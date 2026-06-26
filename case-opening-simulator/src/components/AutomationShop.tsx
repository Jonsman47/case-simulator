import {
  Banknote,
  Boxes,
  Bot,
  BriefcaseBusiness,
  ChartCandlestick,
  Power,
  PowerOff,
  ServerCog,
  ShoppingCart,
  Wrench,
} from 'lucide-react'
import { AutomationModuleId } from '../data/models'
import { useGame } from '../hooks/useGame'
import {
  AUTOMATION_MODULE_DEFINITIONS,
  AUTOMATION_MODULE_IDS,
  getAutomationModuleUpgradeCost,
} from '../utils/automation'
import { formatCurrency } from '../utils/format'

const moduleAccentClasses: Record<AutomationModuleId, string> = {
  [AutomationModuleId.OpeningDesk]: 'border-rarity-mil-spec text-rarity-mil-spec',
  [AutomationModuleId.CaseFarm]: 'border-cs-green text-cs-green',
  [AutomationModuleId.TradingBot]: 'border-rarity-restricted text-rarity-restricted',
  [AutomationModuleId.MarketAnalyst]: 'border-rarity-industrial text-rarity-industrial',
  [AutomationModuleId.WarehouseSystem]: 'border-rarity-classified text-rarity-classified',
  [AutomationModuleId.AuctionHouse]: 'border-rarity-special text-rarity-special',
}

const moduleIconMap = {
  [AutomationModuleId.OpeningDesk]: Bot,
  [AutomationModuleId.CaseFarm]: Banknote,
  [AutomationModuleId.TradingBot]: ServerCog,
  [AutomationModuleId.MarketAnalyst]: ChartCandlestick,
  [AutomationModuleId.WarehouseSystem]: Boxes,
  [AutomationModuleId.AuctionHouse]: BriefcaseBusiness,
}

export function AutomationShop() {
  const { purchaseAutomationModule, state, toggleAutomationModule } = useGame()

  return (
    <section className="border border-cs-border bg-cs-panel p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase text-rarity-special">Upgrade Paths</p>
          <h3 className="mt-1 text-xl font-semibold text-cs-text">Automation Shop</h3>
        </div>
        <p className="text-sm text-cs-muted">Modules run only while enabled.</p>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {AUTOMATION_MODULE_IDS.map((moduleId) => {
          const definition = AUTOMATION_MODULE_DEFINITIONS[moduleId]
          const moduleState = state.automation.modules[moduleId]
          const Icon = moduleIconMap[moduleId]
          const cost = getAutomationModuleUpgradeCost(moduleId, moduleState.level)
          const isMaxLevel = moduleState.level >= definition.maxLevel
          const canPurchase = !isMaxLevel && state.money >= cost

          return (
            <article
              className={`border bg-cs-surface p-3 ${moduleAccentClasses[moduleId]}`}
              key={moduleId}
            >
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center border border-current bg-cs-panel">
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="text-base font-semibold text-cs-text">{definition.name}</h4>
                      <p className="mt-1 font-mono text-[10px] uppercase text-cs-muted">
                        Level {moduleState.level}/{definition.maxLevel} / {definition.resourceLabel}
                      </p>
                    </div>
                    <span
                      className={[
                        'border px-2 py-1 font-mono text-[10px] uppercase',
                        moduleState.isEnabled
                          ? 'border-cs-green text-cs-green'
                          : 'border-cs-border text-cs-muted',
                      ].join(' ')}
                    >
                      {moduleState.isEnabled ? 'Running' : 'Off'}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-cs-muted">{definition.description}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <ModuleMetric label="Current" value={definition.getCurrentBenefit(moduleState.level)} />
                <ModuleMetric
                  label={isMaxLevel ? 'Next' : 'Upgrade'}
                  value={isMaxLevel ? 'Maxed' : definition.getNextBenefit(moduleState.level)}
                />
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  className="inline-flex flex-1 items-center justify-center gap-2 border border-rarity-special bg-rarity-special/10 px-3 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20 disabled:cursor-not-allowed disabled:border-cs-border disabled:bg-transparent disabled:text-cs-muted"
                  disabled={!canPurchase}
                  onClick={() => purchaseAutomationModule(moduleId)}
                  type="button"
                >
                  {isMaxLevel ? <Wrench size={16} /> : <ShoppingCart size={16} />}
                  {isMaxLevel ? 'Max Level' : formatCurrency(cost)}
                </button>
                <button
                  className="inline-flex flex-1 items-center justify-center gap-2 border border-cs-border px-3 py-2 text-sm font-medium text-cs-muted transition-colors hover:text-cs-text disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={moduleState.level <= 0}
                  onClick={() => toggleAutomationModule(moduleId)}
                  type="button"
                >
                  {moduleState.isEnabled ? <PowerOff size={16} /> : <Power size={16} />}
                  {moduleState.isEnabled ? 'Pause' : 'Enable'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function ModuleMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-cs-border bg-cs-panel px-3 py-2">
      <p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-cs-text">{value}</p>
    </div>
  )
}
