import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'
import { InventoryValueChart } from './InventoryValueChart'
import { Tooltip } from './Tooltip'

export function StatusHeader() {
  const { cloud, state } = useGame()

  return (
    <header className="border-b border-cs-border bg-cs-surface/90 px-3 py-2 shadow-glow sm:px-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase text-cs-amber">Case Opening Simulator</p>
          <h1 className="mt-0.5 text-lg font-semibold text-cs-text sm:text-2xl">
            Case Opening Simulator
          </h1>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <div className="min-w-0 border border-cs-border bg-cs-panel px-3 py-2">
            <p className="flex items-center gap-2 font-mono text-xs uppercase text-cs-muted">
              Balance
              <Tooltip label="Explain balance">
                Balance is spendable cash for cases, licenses, upgrades, and automation.
              </Tooltip>
            </p>
            <p className="mt-0.5 truncate text-base font-semibold text-rarity-special">
              {formatCurrency(state.money)}
            </p>
          </div>
          <div className="min-w-0 border border-cs-border bg-cs-panel px-3 py-2">
            <p className="flex items-center gap-2 font-mono text-xs uppercase text-cs-muted">
              Inventory Value
              <Tooltip label="Explain inventory value">
                Inventory value uses current market prices, so it can rise or fall even while you keep the same skins.
              </Tooltip>
            </p>
            <p className="mt-0.5 truncate text-base font-semibold text-cs-green">
              {formatCurrency(state.inventoryValue)}
            </p>
          </div>
          <div className="min-w-0 border border-cs-border bg-cs-panel px-3 py-2">
            <p className="font-mono text-xs uppercase text-cs-muted">Items</p>
            <p className="mt-0.5 truncate text-base font-semibold text-cs-text">{state.inventory.length}</p>
          </div>
          <div className="min-w-0 border border-cs-border bg-cs-panel px-3 py-2">
            <p className="font-mono text-xs uppercase text-cs-muted">Cloud</p>
            <p
              className={[
                'mt-0.5 truncate text-base font-semibold capitalize',
                cloud.status === 'synced' ? 'text-cs-green' : '',
                cloud.status === 'syncing' ? 'text-rarity-special' : '',
                cloud.status === 'offline' ? 'text-rarity-industrial' : '',
                cloud.status === 'error' ? 'text-rarity-covert' : '',
                cloud.status === 'idle' ? 'text-cs-muted' : '',
              ].join(' ')}
            >
              {cloud.session ? cloud.status : 'Local'}
            </p>
          </div>
          <InventoryValueChart
            compact
            currentValue={state.inventoryValue}
            history={state.inventoryValueHistory}
            title="Trend"
          />
        </div>
      </div>
    </header>
  )
}
