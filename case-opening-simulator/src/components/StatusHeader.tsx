import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'
import { InventoryValueChart } from './InventoryValueChart'
import { Tooltip } from './Tooltip'

export function StatusHeader() {
  const { cloud, state } = useGame()

  return (
    <header className="border-b border-cs-border bg-cs-surface/90 px-2.5 py-1 shadow-glow">
      <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase text-cs-amber">CS2 economy &amp; career</p>
          <h1 className="text-base font-semibold text-cs-text sm:text-lg">
            Case Opening Simulator
          </h1>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <div className="min-w-0 border border-cs-border bg-cs-panel px-2 py-1">
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
          <div className="min-w-0 border border-cs-border bg-cs-panel px-2 py-1">
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
          <div className="min-w-0 border border-cs-border bg-cs-panel px-2 py-1">
            <p className="font-mono text-xs uppercase text-cs-muted">Items</p>
            <p className="mt-0.5 truncate text-base font-semibold text-cs-text">{state.inventory.length}</p>
          </div>
          <details className="group relative min-w-0 border border-cs-border bg-cs-panel px-2 py-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="flex items-center gap-1 font-mono text-xs uppercase text-cs-muted"><Cloud size={13} /> Account</span>
                <span className={[
                  'mt-0.5 block truncate text-base font-semibold',
                  cloud.status === 'synced' ? 'text-cs-green' : '',
                  cloud.status === 'syncing' ? 'text-rarity-special' : '',
                  cloud.status === 'offline' ? 'text-rarity-industrial' : '',
                  cloud.status === 'conflict' || cloud.status === 'error' ? 'text-rarity-covert' : '',
                  cloud.status === 'idle' ? 'text-cs-muted' : '',
                ].join(' ')}>{cloud.profile?.displayName ?? 'Local Guest'}</span>
              </span>
              <ChevronDown className="shrink-0 transition-transform group-open:rotate-180" size={15} />
            </summary>
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 grid w-56 gap-1 border border-cs-border bg-cs-surface p-2 shadow-glow">
              <p className="px-2 py-1 font-mono text-[10px] uppercase text-cs-muted">{cloud.session ? `Cloud ${cloud.status}` : 'Guest mode · local save'}</p>
              <Link className="flex min-h-10 items-center gap-2 border border-transparent px-2 text-sm text-cs-text hover:border-cs-border" to="/profile"><UserRound size={15} /> My Profile</Link>
              <Link className="flex min-h-10 items-center gap-2 border border-transparent px-2 text-sm text-cs-text hover:border-cs-border" to="/settings"><Cloud size={15} /> Account & Sync</Link>
              {cloud.session ? <button className="flex min-h-10 items-center gap-2 border border-transparent px-2 text-left text-sm text-rarity-covert hover:border-rarity-covert/50" onClick={() => void cloud.logout()} type="button"><LogOut size={15} /> Secure Logout</button> : null}
            </div>
          </details>
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
import { ChevronDown, Cloud, LogOut, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
