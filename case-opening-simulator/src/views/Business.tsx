import { nanoid } from 'nanoid'
import { Link } from 'react-router-dom'
import { cloneElement, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import {
  BadgeDollarSign,
  BellRing,
  Boxes,
  BriefcaseBusiness,
  Calculator,
  CirclePause,
  CirclePlay,
  Eye,
  GraduationCap,
  HandCoins,
  PackageOpen,
  Radar,
  ReceiptText,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Trash2,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useGame } from '../hooks/useGame'
import { GlossaryTerm } from '../components/GlossaryTerm'
import {
  BUSINESS_MAX_TRAINING_LEVEL,
  EMPLOYEE_ROLE_DEFINITIONS,
  EMPLOYEE_ROLE_IDS,
  getActiveEmployeeCount,
  getBusinessReservedFunds,
  getEmployeeHireCost,
  getEmployeeHourlyWage,
  getEmployeeTrainingCost,
  getOperatingCapacity,
  isEmployeeUnlocked,
  type BusinessEmployeeState,
  type EmployeeRoleId,
} from '../business/business'
import { formatCurrency } from '../utils/format'
import { getInventoryCapacity, getInventoryFreeSlots } from '../utils/inventoryCapacity'
import { AssetImage } from '../components/AssetImage'
import { CASE_DEFINITIONS } from '../data/cases'
import { requiresCaseLicense } from '../data/casePricing'
import { SKIN_DEFINITIONS } from '../data/skins'
import { AutomationModuleId, CaseStatus, Rarity, WearCondition } from '../data/models'
import {
  getCareerBusinessIntervalMultiplier,
  getCareerCaseOperatorBatchBonus,
  getCareerListingCapacityBonus,
  getCareerOperatingCapacityBonus,
  getCareerPayrollDiscount,
  getCareerScoutCandidateBonus,
  getCareerScoutWatchlistBonus,
  getCareerTradeUpApprovalBonus,
  getCareerTradeUpContractBonus,
  getCareerTrainingDiscount,
  getCareerUpgradeEffect,
  type CareerUpgradeState,
} from '../career/careerUpgrades'

const roleIcons: Record<EmployeeRoleId, LucideIcon> = {
  caseOperator: PackageOpen,
  salesAssistant: Tags,
  marketScout: Radar,
  tradeUpSpecialist: Calculator,
  juniorTrader: HandCoins,
}

const roleArtwork: Record<EmployeeRoleId, string> = {
  caseOperator: '/assets/business/case-operator.png',
  salesAssistant: '/assets/business/sales-assistant.png',
  marketScout: '/assets/business/market-scout.png',
  tradeUpSpecialist: '/assets/business/trade-up-specialist.png',
  juniorTrader: '/assets/business/junior-trader.png',
}

function formatDuration(ms: number) {
  if (ms <= 0) return 'Due now'
  const minutes = Math.ceil(ms / 60_000)
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
}

export function Business() {
  const { dispatch, purchaseAuctionDeal, purchaseAutomationModule, state, toggleAutomationModule } = useGame()
  const [selectedRole, setSelectedRole] = useState<EmployeeRoleId>()
  const [budget, setBudget] = useState('250')
  const [watchName, setWatchName] = useState('Bargain watch')
  const [watchSkin, setWatchSkin] = useState('')
  const [watchPrice, setWatchPrice] = useState('')
  const [watchDiscount, setWatchDiscount] = useState('10')
  const [watchWeapon, setWatchWeapon] = useState('')
  const [watchWear, setWatchWear] = useState('')
  const [watchMinFloat, setWatchMinFloat] = useState('')
  const [watchMaxFloat, setWatchMaxFloat] = useState('')
  const [watchPattern, setWatchPattern] = useState('')
  const [watchClassification, setWatchClassification] = useState('')
  const [watchSeller, setWatchSeller] = useState('')
  const [watchEdition, setWatchEdition] = useState('any')
  const [editingWatchId, setEditingWatchId] = useState<string>()
  const [now] = useState(() => Date.now())
  const latestOperationId = state.business.recentOperations[0]?.id
  const previousOperationId = useRef(latestOperationId)
  const [highlightedOperationId, setHighlightedOperationId] = useState<string>()
  useEffect(() => {
    if (!latestOperationId || latestOperationId === previousOperationId.current) return
    previousOperationId.current = latestOperationId
    setHighlightedOperationId(latestOperationId)
    const timer = window.setTimeout(() => setHighlightedOperationId(undefined), 1_200)
    return () => window.clearTimeout(timer)
  }, [latestOperationId])
  const activeCount = getActiveEmployeeCount(state.business)
  const capacity = getOperatingCapacity(state.business) + getCareerOperatingCapacityBonus(state.careerUpgrades)
  const reserved = getBusinessReservedFunds(state.business)
  const pendingAlerts = state.business.alerts.filter((alert) => alert.status === 'new' && alert.expiresAt > now)
  const inventoryCapacity = getInventoryCapacity(state)
  const selectedEmployee = selectedRole ? state.business.employees[selectedRole] : undefined
  const availableCaseIds = CASE_DEFINITIONS.filter((caseDefinition) => state.casesUnlocked.includes(caseDefinition.id) || (caseDefinition.status === CaseStatus.Unlocked && !requiresCaseLicense(caseDefinition))).map((caseDefinition) => caseDefinition.id)
  const weapons = useMemo(() => [...new Set(SKIN_DEFINITIONS.map((skin) => skin.weapon))].sort(), [])

  const hire = (roleId: EmployeeRoleId) => dispatch({ type: 'HIRE_EMPLOYEE', roleId, requestId: nanoid() })
  const train = (roleId: EmployeeRoleId) => dispatch({ type: 'TRAIN_EMPLOYEE', roleId, requestId: nanoid() })
  const allocate = (roleId: EmployeeRoleId) => dispatch({ type: 'ALLOCATE_EMPLOYEE_BUDGET', roleId, amount: Number(budget), requestId: nanoid() })
  const release = (roleId: EmployeeRoleId) => dispatch({ type: 'RELEASE_EMPLOYEE_BUDGET', roleId, requestId: nanoid() })

  return (
    <section className="w-full space-y-3">
      <header className="border border-cs-border bg-cs-surface p-5 sm:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="border-l-4 border-rarity-mil-spec pl-4">
            <p className="font-mono text-xs uppercase text-rarity-mil-spec">Career operations</p>
            <h1 className="mt-1 text-3xl font-semibold text-cs-text sm:text-4xl">Business</h1>
            <p className="mt-2 flex flex-wrap gap-3 text-xs text-cs-muted"><GlossaryTerm term="payroll" /><GlossaryTerm term="operatingBudget" /><GlossaryTerm term="costBasis" /></p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-cs-muted">Employees automate configured routines using real cash, items, wages, market supply and risk limits. Negotiation and exceptional acquisitions remain your decisions.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Active employees" value={`${activeCount}/${capacity}`} />
            <Metric label="Reserved funds" value={formatCurrency(reserved)} />
            <Metric label="Pending alerts" value={String(pendingAlerts.length)} />
            <Metric label="Transition credit" value={formatCurrency(state.business.transitionCredit)} />
          </div>
        </div>
      </header>

      <section aria-labelledby="employees-heading" className="border border-cs-border bg-cs-surface p-3 sm:p-4">
        <div className="flex items-center gap-2"><BriefcaseBusiness className="text-rarity-mil-spec" size={20} /><h2 className="text-xl font-semibold text-cs-text" id="employees-heading">Employees</h2></div>
        <div className="content-card-grid mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-5">
          {EMPLOYEE_ROLE_IDS.map((roleId) => <EmployeeCard careerUpgrades={state.careerUpgrades} employee={state.business.employees[roleId]} key={roleId} now={now} onConfigure={() => setSelectedRole(roleId)} onHire={() => hire(roleId)} onToggle={() => dispatch({ type: 'TOGGLE_EMPLOYEE', roleId, now: Date.now() })} onTrain={() => train(roleId)} unlocked={isEmployeeUnlocked(roleId, state.career)} />)}
        </div>
      </section>

      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <div className="min-w-0 space-y-3">
          <section className="border border-cs-border bg-cs-surface p-4 sm:p-6">
            <div className="flex items-center gap-2"><BellRing className="text-rarity-special" size={20} /><h2 className="text-xl font-semibold text-cs-text">Research & alerts</h2></div>
            <form className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5" onSubmit={(event) => {
              event.preventDefault()
              const watchlist = {
                name: watchName.trim() || 'Watchlist',
                enabled: true,
                skinId: watchSkin.trim() || undefined,
                weapon: watchWeapon || undefined,
                wear: watchWear ? watchWear as WearCondition : undefined,
                minimumFloat: watchMinFloat ? Number(watchMinFloat) : undefined,
                maximumFloat: watchMaxFloat ? Number(watchMaxFloat) : undefined,
                patternId: watchPattern ? Number(watchPattern) : undefined,
                patternClassification: watchClassification.trim() || undefined,
                maximumPrice: watchPrice ? Number(watchPrice) : undefined,
                minimumDiscount: Math.max(0, Number(watchDiscount) / 100),
                minimumConfidence: .5,
                seller: watchSeller.trim() || undefined,
                statTrak: watchEdition === 'stattrak' ? true : undefined,
                souvenir: watchEdition === 'souvenir' ? true : undefined,
                lastScannedAt: 0,
                scanCursor: 0,
                scannedCandidates: 0,
              }
              if (editingWatchId) dispatch({ type: 'UPDATE_SCOUT_WATCHLIST', watchlistId: editingWatchId, watchlist, now: Date.now() })
              else dispatch({ type: 'CREATE_SCOUT_WATCHLIST', requestId: nanoid(), watchlist: { id: nanoid(), ...watchlist }, now: Date.now() })
              setEditingWatchId(undefined)
            }}>
              <Field label="Watchlist name"><input required value={watchName} onChange={(event) => setWatchName(event.target.value)} /></Field>
              <Field label="Exact skin ID"><input placeholder="Optional" value={watchSkin} onChange={(event) => setWatchSkin(event.target.value)} /></Field>
              <Field label="Weapon"><select onChange={(event) => setWatchWeapon(event.target.value)} value={watchWeapon}><option value="">Any weapon</option>{weapons.map((weapon) => <option key={weapon} value={weapon}>{weapon}</option>)}</select></Field>
              <Field label="Wear"><select onChange={(event) => setWatchWear(event.target.value)} value={watchWear}><option value="">Any wear</option>{Object.values(WearCondition).map((wear) => <option key={wear} value={wear}>{wear}</option>)}</select></Field>
              <Field label="Edition"><select onChange={(event) => setWatchEdition(event.target.value)} value={watchEdition}><option value="any">Any edition</option><option value="stattrak">StatTrak</option><option value="souvenir">Souvenir</option></select></Field>
              <Field label="Minimum float"><input max="1" min="0" placeholder="0" step="0.000001" type="number" value={watchMinFloat} onChange={(event) => setWatchMinFloat(event.target.value)} /></Field>
              <Field label="Maximum float"><input max="1" min="0" placeholder="1" step="0.000001" type="number" value={watchMaxFloat} onChange={(event) => setWatchMaxFloat(event.target.value)} /></Field>
              <Field label="Pattern ID"><input max="1000" min="0" placeholder="Optional" type="number" value={watchPattern} onChange={(event) => setWatchPattern(event.target.value)} /></Field>
              <Field label="Pattern class / phase"><input placeholder="Blue Gem, Fade, Ruby…" value={watchClassification} onChange={(event) => setWatchClassification(event.target.value)} /></Field>
              <Field label="Maximum price"><input min="0" placeholder="No maximum" type="number" value={watchPrice} onChange={(event) => setWatchPrice(event.target.value)} /></Field>
              <Field label="Minimum discount %"><input max="90" min="0" type="number" value={watchDiscount} onChange={(event) => setWatchDiscount(event.target.value)} /></Field>
              <Field label="Seller contains"><input placeholder="Optional" value={watchSeller} onChange={(event) => setWatchSeller(event.target.value)} /></Field>
              <button className="min-h-11 self-end border border-rarity-special bg-rarity-special/10 px-3 font-semibold text-rarity-special hover:bg-rarity-special/20" type="submit"><span className="inline-flex items-center gap-2"><Radar size={16} /> {editingWatchId ? 'Save watch' : 'Add watch'}</span></button>
              {editingWatchId ? <button className="min-h-11 self-end border border-cs-border px-3 text-cs-muted" onClick={() => setEditingWatchId(undefined)} type="button">Cancel edit</button> : null}
            </form>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {pendingAlerts.map((alert) => <article className="border border-rarity-special/60 bg-cs-panel p-3" key={alert.id}><div className="flex gap-3"><AssetImage alt="" className="h-16 w-20 shrink-0 object-contain" src={alert.image} /><div className="min-w-0 flex-1"><h3 className="truncate font-semibold text-cs-text">{alert.skinName}</h3><p className="mt-1 text-sm text-cs-muted">{alert.seller} · {formatCurrency(alert.price)} · {(alert.discount * 100).toFixed(1)}% below estimate</p><p className="mt-1 text-xs text-cs-muted">Pattern {alert.patternId ?? '—'} · float {alert.float.toFixed(6)} · {alert.confidence}</p></div></div><div className="mt-3 flex flex-wrap gap-2"><Link className="inline-flex min-h-9 items-center gap-2 border border-rarity-special px-3 text-sm font-semibold text-rarity-special" to={`/cswear?skin=${encodeURIComponent(alert.skinId)}&listing=${encodeURIComponent(alert.listingId)}`}><Eye size={15} /> View offer</Link><button className="min-h-9 border border-cs-border px-3 text-sm text-cs-muted" onClick={() => dispatch({ type: 'SET_SCOUT_ALERT_STATUS', alertId: alert.id, status: 'reviewed' })} type="button">Mark reviewed</button><button aria-label="Dismiss alert" className="grid h-9 w-9 place-items-center border border-cs-border text-cs-muted" onClick={() => dispatch({ type: 'SET_SCOUT_ALERT_STATUS', alertId: alert.id, status: 'dismissed' })} type="button"><X size={15} /></button></div></article>)}
              {pendingAlerts.length === 0 ? <EmptyState text="The Market Scout reports genuine matching offers here. Scan coverage is bounded and shown per watchlist." /> : null}
            </div>
            <div className="mt-4 space-y-2">{state.business.watchlists.map((watchlist) => <div className="flex flex-wrap items-center gap-3 border border-cs-border bg-cs-panel px-3 py-2 text-sm" key={watchlist.id}><span className="font-semibold text-cs-text">{watchlist.name}</span><span className="text-cs-muted">{watchlist.scannedCandidates.toLocaleString()} candidates inspected</span><span className="text-cs-muted">{watchlist.lastScannedAt ? new Date(watchlist.lastScannedAt).toLocaleString() : 'Not scanned yet'}</span><button className="ml-auto border border-cs-border px-2 py-1 text-xs text-cs-muted" onClick={() => { setEditingWatchId(watchlist.id); setWatchName(watchlist.name); setWatchSkin(watchlist.skinId ?? ''); setWatchWeapon(watchlist.weapon ?? ''); setWatchWear(watchlist.wear ?? ''); setWatchMinFloat(watchlist.minimumFloat?.toString() ?? ''); setWatchMaxFloat(watchlist.maximumFloat?.toString() ?? ''); setWatchPattern(watchlist.patternId?.toString() ?? ''); setWatchClassification(watchlist.patternClassification ?? ''); setWatchPrice(watchlist.maximumPrice?.toString() ?? ''); setWatchDiscount((watchlist.minimumDiscount * 100).toString()); setWatchSeller(watchlist.seller ?? ''); setWatchEdition(watchlist.statTrak ? 'stattrak' : watchlist.souvenir ? 'souvenir' : 'any') }} type="button">Edit</button><button aria-label={`Delete ${watchlist.name}`} className="text-cs-muted hover:text-rarity-covert" onClick={() => dispatch({ type: 'REMOVE_SCOUT_WATCHLIST', watchlistId: watchlist.id, requestId: nanoid() })} type="button"><Trash2 size={15} /></button></div>)}</div>
          </section>

          <section className="border border-cs-border bg-cs-surface p-4 sm:p-6">
            <div className="flex items-center gap-2"><ReceiptText className="text-cs-green" size={20} /><h2 className="text-xl font-semibold text-cs-text">Recent operations</h2></div>
            <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[42rem] text-left text-sm"><thead className="font-mono text-[10px] uppercase text-cs-muted"><tr><th className="p-2">Time</th><th className="p-2">Employee</th><th className="p-2">Result</th><th className="p-2">Revenue</th><th className="p-2">Expense</th><th className="p-2">Realized</th></tr></thead><tbody>{state.business.recentOperations.slice(0, 20).map((operation) => <tr className={`border-t border-cs-border transition-colors duration-300 motion-reduce:transition-none ${highlightedOperationId === operation.id ? 'bg-cs-green/10' : ''}`} key={operation.id}><td className="p-2 text-cs-muted">{new Date(operation.timestamp).toLocaleString()}</td><td className="p-2 text-cs-text">{EMPLOYEE_ROLE_DEFINITIONS[operation.employeeRole].name}</td><td className="p-2 text-cs-text">{operation.description}</td><td className="p-2 text-cs-green">{formatCurrency(operation.revenue)}</td><td className="p-2 text-rarity-covert">{formatCurrency(operation.expense)}</td><td className="p-2 text-cs-text">{formatCurrency(operation.realizedProfit)}</td></tr>)}</tbody></table></div>
            {state.business.recentOperations.length === 0 ? <EmptyState text="Completed, paid operations appear here. Idle scans and failed checks never create fake revenue." /> : null}
          </section>
        </div>

        <aside className="space-y-3 xl:sticky xl:top-2 xl:self-start">
          <section className="border border-cs-border bg-cs-surface p-4"><div className="flex items-center gap-2"><BadgeDollarSign className="text-cs-green" size={20} /><h2 className="text-xl font-semibold text-cs-text">Financial overview</h2></div><div className="mt-4 grid grid-cols-2 gap-2"><Metric label="Revenue" value={formatCurrency(state.business.financials.revenue)} /><Metric label="Expenses" value={formatCurrency(state.business.financials.expenses)} /><Metric label="Payroll" value={formatCurrency(state.business.financials.payroll)} /><Metric label="Realized result" value={formatCurrency(state.business.financials.realizedProfit)} /><Metric label="Gross volume" value={formatCurrency(state.business.financials.grossVolume)} /><Metric label="Inventory value" value={formatCurrency(state.inventoryValue)} /></div><p className="mt-3 text-xs leading-5 text-cs-muted">Reserved funds are not expenses. Purchases are cost basis, and unrealized discounts are not profit.</p></section>
          <section className="border border-cs-border bg-cs-surface p-4"><div className="flex items-center gap-2"><Boxes className="text-rarity-classified" size={20} /><h2 className="text-xl font-semibold text-cs-text">Facilities</h2></div><div className="mt-4 grid grid-cols-2 gap-2"><Metric label="Warehouse" value={`${state.inventory.length}/${inventoryCapacity}`} /><Metric label="Free slots" value={String(getInventoryFreeSlots(state))} /><Metric label="Operating capacity" value={`${activeCount}/${capacity}`} /><Metric label="Legacy entitlement" value={`+${state.business.legacyOperatingCapacity}`} /></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><button className="min-h-10 border border-rarity-classified/60 px-3 text-sm font-semibold text-rarity-classified" onClick={() => purchaseAutomationModule(AutomationModuleId.WarehouseSystem)} type="button">Expand Warehouse</button>{state.automation.modules[AutomationModuleId.AuctionHouse].level <= 0 ? <button className="min-h-10 border border-rarity-special/60 px-3 text-sm font-semibold text-rarity-special" onClick={() => purchaseAutomationModule(AutomationModuleId.AuctionHouse)} type="button">Unlock Auction House</button> : <button className="min-h-10 border border-rarity-special/60 px-3 text-sm font-semibold text-rarity-special" onClick={() => toggleAutomationModule(AutomationModuleId.AuctionHouse)} type="button">{state.automation.modules[AutomationModuleId.AuctionHouse].isEnabled ? 'Pause auctions' : 'Resume auctions'}</button>}</div><p className="mt-3 text-xs text-cs-muted">Existing Warehouse levels remain active. Over-capacity inventories are never deleted.</p></section>
          <AuctionDeals now={now} onBuy={purchaseAuctionDeal} state={state} />
          {state.business.pendingTradeUpApproval ? <section className="border border-rarity-special bg-rarity-special/10 p-4"><h2 className="font-semibold text-cs-text">Contract approval required</h2><p className="mt-2 text-sm text-cs-muted">{state.business.pendingTradeUpApproval.reason}</p><div className="mt-3 grid grid-cols-2 gap-2"><Metric label="Input value" value={formatCurrency(state.business.pendingTradeUpApproval.inputValue)} /><Metric label="Expected profit" value={formatCurrency(state.business.pendingTradeUpApproval.expectedProfit)} /></div><button className="mt-3 w-full border border-rarity-special px-3 py-2 font-semibold text-rarity-special" onClick={() => dispatch({ type: 'CONFIRM_BUSINESS_TRADE_UP', approvalId: state.business.pendingTradeUpApproval!.id, requestId: nanoid(), now: Date.now() })} type="button">Confirm contract manually</button></section> : null}
        </aside>
      </div>

      {selectedRole && selectedEmployee ? <ConfigurationPanel budget={budget} employee={selectedEmployee} onAllocate={() => allocate(selectedRole)} onBudgetChange={setBudget} onClose={() => setSelectedRole(undefined)} onRelease={() => release(selectedRole)} onSettings={(settings) => dispatch({ type: 'UPDATE_EMPLOYEE_SETTINGS', roleId: selectedRole, settings, now: Date.now() })} unlockedCaseIds={availableCaseIds} /> : null}
    </section>
  )
}

function EmployeeCard({ careerUpgrades, employee, now, onConfigure, onHire, onToggle, onTrain, unlocked }: { careerUpgrades: CareerUpgradeState; employee: BusinessEmployeeState; now: number; onConfigure: () => void; onHire: () => void; onToggle: () => void; onTrain: () => void; unlocked: boolean }) {
  const definition = EMPLOYEE_ROLE_DEFINITIONS[employee.roleId]
  const Icon = roleIcons[employee.roleId]
  const wage = getEmployeeHourlyWage(employee.roleId, employee.trainingLevel) * (1 - getCareerPayrollDiscount(careerUpgrades))
  const trainingCost = getEmployeeTrainingCost(employee.roleId, employee.trainingLevel) * (1 - getCareerTrainingDiscount(careerUpgrades))
  const intervalImprovement = Math.round((1 - getCareerBusinessIntervalMultiplier(careerUpgrades)) * 100)
  const roleCareerEffect = employee.roleId === 'caseOperator'
    ? `+${getCareerCaseOperatorBatchBonus(careerUpgrades)} batch · +${getCareerUpgradeEffect(careerUpgrades, 'business.caseCapacityReserve')} reserve`
    : employee.roleId === 'salesAssistant'
      ? `+${getCareerListingCapacityBonus(careerUpgrades)} listing capacity`
      : employee.roleId === 'marketScout'
        ? `+${getCareerScoutWatchlistBonus(careerUpgrades)} watchlists · +${getCareerScoutCandidateBonus(careerUpgrades)} scan`
        : employee.roleId === 'tradeUpSpecialist'
          ? `+${getCareerTradeUpContractBonus(careerUpgrades)} contracts · +${getCareerTradeUpApprovalBonus(careerUpgrades)} threshold`
          : `+${getCareerUpgradeEffect(careerUpgrades, 'business.juniorCandidates')} candidates`
  return <article className="employee-card flex min-w-0 flex-col overflow-clip border border-cs-border bg-cs-panel"><div className="relative grid min-h-24 place-items-center border-b border-cs-border bg-[radial-gradient(circle_at_50%_72%,rgb(var(--rarity-mil-spec)/.22),transparent_62%)]"><AssetImage alt={`${definition.name} employee`} className="h-20 w-20 object-contain [image-rendering:pixelated]" src={roleArtwork[employee.roleId]} /><span className={`absolute right-2 top-2 inline-flex items-center gap-1 border px-2 py-1 font-mono text-[10px] uppercase ${employee.isEnabled ? 'border-cs-green/70 bg-cs-green/10 text-cs-green' : 'border-cs-border bg-cs-surface/90 text-cs-muted'}`}><span className={employee.isEnabled ? 'employee-status-dot h-1.5 w-1.5 rounded-full bg-cs-green' : 'h-1.5 w-1.5 rounded-full bg-cs-muted'} />{employee.isEnabled ? 'Working' : employee.isHired ? 'Paused' : 'Vacant'}</span></div><div className="flex flex-1 flex-col p-2.5"><div className="flex items-start gap-2"><div className="grid h-8 w-8 shrink-0 place-items-center border border-rarity-mil-spec/60 bg-rarity-mil-spec/10 text-rarity-mil-spec"><Icon size={17} /></div><div className="min-w-0"><h3 className="font-semibold text-cs-text">{definition.name}</h3><p className="mt-0.5 text-xs leading-4 text-cs-muted">{definition.description}</p></div></div><div className="mt-2 grid grid-cols-2 gap-1.5"><Metric label="Training" value={`${employee.trainingLevel}/${BUSINESS_MAX_TRAINING_LEVEL}`} /><Metric label="Wage / hour" value={formatCurrency(wage)} /><Metric label="Operating fund" value={formatCurrency(employee.availableCapital)} /><Metric label="Next action" value={employee.isEnabled ? formatDuration(employee.nextActionAt - now) : 'Paused'} /><Metric label="Career scheduler" value={intervalImprovement > 0 ? `${intervalImprovement}% faster` : 'Standard'} /><Metric label="Career role tools" value={roleCareerEffect} /></div><p className={`mt-2 min-h-8 text-xs leading-4 ${employee.lastPauseReason ? 'text-rarity-covert' : 'text-cs-muted'}`}>{employee.lastPauseReason ?? employee.recentResult ?? (unlocked ? `Ready at Career level ${definition.unlockLevel}.` : `Unlocks at Career level ${definition.unlockLevel}.`)}</p><div className="mt-auto grid grid-cols-2 gap-2 pt-2">{!employee.isHired ? <button className="col-span-2 min-h-9 border border-rarity-special px-3 text-sm font-semibold text-rarity-special disabled:border-cs-border disabled:text-cs-muted" disabled={!unlocked} onClick={onHire} type="button"><span className="inline-flex items-center gap-2"><BriefcaseBusiness size={15} /> Hire · {formatCurrency(getEmployeeHireCost(employee.roleId))}</span></button> : <><button className="min-h-9 border border-cs-border px-2 text-sm text-cs-text" onClick={onToggle} type="button"><span className="inline-flex items-center gap-2">{employee.isEnabled ? <CirclePause size={15} /> : <CirclePlay size={15} />}{employee.isEnabled ? 'Pause' : 'Start'}</span></button><button className="min-h-9 border border-cs-border px-2 text-sm text-cs-text" onClick={onConfigure} type="button"><span className="inline-flex items-center gap-2"><Settings2 size={15} /> Configure</span></button><button className="col-span-2 min-h-9 border border-rarity-classified/60 px-2 text-sm text-rarity-classified disabled:text-cs-muted" disabled={employee.trainingLevel >= BUSINESS_MAX_TRAINING_LEVEL} onClick={onTrain} type="button"><span className="inline-flex items-center gap-2"><GraduationCap size={15} /> Train · {employee.trainingLevel >= BUSINESS_MAX_TRAINING_LEVEL ? 'Max' : formatCurrency(trainingCost)}</span></button></>}</div></div></article>
}

function ConfigurationPanel({ budget, employee, onAllocate, onBudgetChange, onClose, onRelease, onSettings, unlockedCaseIds }: { budget: string; employee: BusinessEmployeeState; onAllocate: () => void; onBudgetChange: (value: string) => void; onClose: () => void; onRelease: () => void; onSettings: (settings: Record<string, unknown>) => void; unlockedCaseIds: string[] }) {
  const settings = employee.settings as unknown as Record<string, unknown>
  const numericKeys = useMemo(() => Object.entries(settings).filter(([key, value]) => typeof value === 'number' && key !== 'intervalMs').slice(0, 10), [settings])
  const intervalSeconds = Math.round(Number(settings.intervalMs ?? 60_000) / 1_000)
  return <div aria-modal="true" className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/80 p-3" role="dialog"><section className="my-auto max-h-[calc(100vh-1.5rem)] w-full max-w-3xl overflow-y-auto border border-rarity-mil-spec bg-cs-surface p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs uppercase text-rarity-mil-spec">Employee configuration</p><h2 className="mt-1 text-2xl font-semibold text-cs-text">{EMPLOYEE_ROLE_DEFINITIONS[employee.roleId].name}</h2><p className="mt-1 text-sm text-cs-muted">{employee.assignment}</p></div><button aria-label="Close configuration" className="grid h-9 w-9 place-items-center border border-cs-border text-cs-muted" onClick={onClose} type="button"><X size={16} /></button></div><section className="mt-4 border border-cs-border bg-cs-panel p-3"><div className="flex items-center gap-2"><WalletCards size={17} className="text-cs-green" /><h3 className="font-semibold text-cs-text">Operating budget</h3></div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input aria-label="Budget amount" className="min-h-10 min-w-0 flex-1 border border-cs-border bg-cs-surface px-3 text-cs-text" min="0.01" onChange={(event) => onBudgetChange(event.target.value)} step="0.01" type="number" value={budget} /><button className="min-h-10 border border-cs-green px-3 font-semibold text-cs-green" onClick={onAllocate} type="button">Allocate</button><button className="min-h-10 border border-cs-border px-3 text-cs-muted" disabled={employee.availableCapital <= 0} onClick={onRelease} type="button">Release unused</button></div><p className="mt-2 text-xs text-cs-muted">Allocated funds leave the wallet and return exactly once when released. They cover real purchases, cases and payroll.</p></section><section className="mt-4"><h3 className="font-semibold text-cs-text">Assignment and policy</h3><div className="mt-3 grid gap-2 sm:grid-cols-2"><Field label="Operation interval (seconds)"><input min="10" onChange={(event) => onSettings({ intervalMs: Number(event.target.value) * 1_000 })} step="1" type="number" value={String(intervalSeconds)} /></Field><RolePolicyFields employee={employee} onSettings={onSettings} settings={settings} unlockedCaseIds={unlockedCaseIds} /></div></section><section className="mt-4"><h3 className="font-semibold text-cs-text">Risk and workflow limits</h3><p className="mt-1 text-xs text-cs-muted">Percent-like fields use decimals: 0.10 means 10%. Limits are validated again in the reducer.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{numericKeys.map(([key, value]) => <Field key={key} label={formatSettingLabel(key)}><input min={key === 'minimumProfitMargin' ? '-1' : '0'} onChange={(event) => onSettings({ [key]: Number(event.target.value) })} step={key.toLowerCase().includes('roi') || key.toLowerCase().includes('discount') || key.toLowerCase().includes('float') || key.toLowerCase().includes('margin') || key.toLowerCase().includes('confidence') ? '.01' : '1'} type="number" value={String(value)} /></Field>)}</div></section><p className="mt-4 border border-cs-border bg-cs-panel p-3 text-xs leading-5 text-cs-muted"><ShieldCheck className="mr-2 inline text-cs-green" size={15} />Locked, favorite, trophy and special or exceptional Pattern items remain protected regardless of these settings.</p></section></div>
}

function RolePolicyFields({ employee, onSettings, settings, unlockedCaseIds }: { employee: BusinessEmployeeState; onSettings: (settings: Record<string, unknown>) => void; settings: Record<string, unknown>; unlockedCaseIds: string[] }) {
  if (employee.roleId === 'caseOperator') {
    const availableCases = CASE_DEFINITIONS.filter((caseDefinition) => unlockedCaseIds.includes(caseDefinition.id))
    const selectedCaseId = availableCases.some((caseDefinition) => caseDefinition.id === settings.caseId) ? String(settings.caseId) : availableCases[0]?.id ?? ''
    return <><Field label="Selected case"><select disabled={availableCases.length === 0} onChange={(event) => onSettings({ caseId: event.target.value })} value={selectedCaseId}>{availableCases.map((caseDefinition) => <option key={caseDefinition.id} value={caseDefinition.id}>{caseDefinition.name} · {formatCurrency(caseDefinition.cost)}</option>)}</select></Field><ToggleField checked={Boolean(settings.allowAutoSell)} label="Use existing auto-sell rules" onChange={(checked) => onSettings({ allowAutoSell: checked })} /></>
  }
  if (employee.roleId === 'salesAssistant') return <><Field label="Workflow"><select onChange={(event) => onSettings({ mode: event.target.value })} value={String(settings.mode)}><option value="instant">Instant sell</option><option value="list">CSWEAR listings</option><option value="mixed">Mixed</option></select></Field><Field label="Allowed weapons (comma separated)"><input onBlur={(event) => onSettings({ allowedWeapons: splitValues(event.target.value) })} placeholder="Empty allows all" defaultValue={(settings.allowedWeapons as string[]).join(', ')} /></Field><ToggleField checked={Boolean(settings.relistExpired)} label="Relist expired ordinary items" onChange={(checked) => onSettings({ relistExpired: checked })} /><MultiChoice label="Allowed rarities" options={Object.values(Rarity)} selected={settings.allowedRarities as string[]} onChange={(values) => onSettings({ allowedRarities: values })} /></>
  if (employee.roleId === 'tradeUpSpecialist') return <><Field label="Allowed collections (comma separated)"><input onBlur={(event) => onSettings({ allowedCollections: splitValues(event.target.value) })} placeholder="Empty allows all" defaultValue={(settings.allowedCollections as string[]).join(', ')} /></Field><MultiChoice label="Allowed input rarities" options={Object.values(Rarity).filter((rarity) => rarity !== Rarity.SpecialItem && rarity !== Rarity.Contraband)} selected={settings.allowedRarities as string[]} onChange={(values) => onSettings({ allowedRarities: values })} /></>
  if (employee.roleId === 'juniorTrader') return <><Field label="Allowed weapons (comma separated)"><input onBlur={(event) => onSettings({ allowedWeapons: splitValues(event.target.value) })} placeholder="Empty allows all" defaultValue={(settings.allowedWeapons as string[]).join(', ')} /></Field><MultiChoice label="Allowed wear" options={Object.values(WearCondition)} selected={settings.allowedWear as string[]} onChange={(values) => onSettings({ allowedWear: values })} /></>
  return <p className="border border-cs-border bg-cs-panel p-3 text-sm text-cs-muted sm:col-span-2">The Scout only notifies. Configure exact weapon, skin, Pattern, float, edition, seller and price filters under Research & alerts.</p>
}

function ToggleField({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) { return <label className="flex min-h-12 items-center gap-3 border border-cs-border bg-cs-panel px-3 py-2 text-sm text-cs-text"><input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" /><span>{label}</span></label> }
function MultiChoice({ label, onChange, options, selected }: { label: string; onChange: (values: string[]) => void; options: string[]; selected: string[] }) { return <fieldset className="border border-cs-border bg-cs-panel px-3 py-2 sm:col-span-2"><legend className="px-1 font-mono text-[10px] uppercase text-cs-muted">{label}</legend><div className="flex flex-wrap gap-2">{options.map((option) => <label className="inline-flex min-h-8 items-center gap-2 border border-cs-border px-2 text-xs text-cs-text" key={option}><input checked={selected.includes(option)} onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((value) => value !== option))} type="checkbox" />{option}</label>)}</div></fieldset> }
function splitValues(value: string) { return Array.from(new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean))) }
function formatSettingLabel(key: string) { return key.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase()) }

function AuctionDeals({ now, onBuy, state }: { now: number; onBuy: (id: string) => void; state: ReturnType<typeof useGame>['state'] }) {
  const module = state.automation.modules[AutomationModuleId.AuctionHouse]
  const deals = state.automation.auctionHouse.deals.filter((deal) => deal.expiresAt > now)
  return <section className="border border-cs-border bg-cs-surface p-4"><div className="flex items-center gap-2"><ShoppingCart className="text-rarity-special" size={20} /><h2 className="text-xl font-semibold text-cs-text">Auction House</h2></div><p className="mt-2 text-xs text-cs-muted">Independent market offers remain available; they are not employee-generated income.</p><div className="mt-3 space-y-2">{deals.slice(0, 3).map((deal) => <div className="flex items-center gap-2 border border-cs-border bg-cs-panel p-2" key={deal.id}><AssetImage alt="" className="h-12 w-14 object-contain" src={deal.item.image} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-cs-text">{deal.item.weapon} | {deal.item.finish}</p><p className="text-xs text-cs-muted">{formatCurrency(deal.price)} · {formatDuration(deal.expiresAt - now)}</p></div><button className="min-h-9 border border-rarity-special px-2 text-sm text-rarity-special" onClick={() => onBuy(deal.id)} type="button">Buy</button></div>)}{deals.length === 0 ? <p className="border border-cs-border bg-cs-panel p-3 text-sm text-cs-muted">{module.level > 0 ? 'Waiting for the next independent deal refresh.' : 'No Auction House entitlement is active.'}</p> : null}</div></section>
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-0 border border-cs-border bg-cs-panel px-3 py-2"><p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p><p className="mt-1 break-words text-sm font-semibold text-cs-text" title={value}>{value}</p></div> }
function Field({ children, label }: { children: ReactElement<{ className?: string }>; label: string }) { return <label className="block border border-cs-border bg-cs-panel px-3 py-2"><span className="font-mono text-[10px] uppercase text-cs-muted">{label}</span>{cloneElement(children, { className: `mt-1 w-full bg-transparent text-sm text-cs-text outline-none ${children.props.className ?? ''}` })}</label> }
function EmptyState({ text }: { text: string }) { return <div className="grid min-h-28 place-items-center border border-cs-border bg-cs-panel p-4 text-center text-sm text-cs-muted">{text}</div> }
