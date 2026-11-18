import { ArrowLeft, ArrowRight, BookOpen, Boxes, BriefcaseBusiness, Compass, Gem, HelpCircle, PackageOpen, Pause, Play, ScrollText, ShoppingCart, Sparkles, Store, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getCareerSnapshot } from '../career/careerProgress'
import type { OnboardingStepId, OnboardingTipId } from '../data/gameState'
import { getPrestigeEligibilityV2 } from '../prestige/prestigeSystem'
import { useGame } from '../hooks/useGame'

interface TutorialStep {
  body: string
  action?: boolean
  hint: string
  icon: typeof Compass
  id: OnboardingStepId
  path?: string
  targetId?: string
  title: string
}

interface FeatureGuide {
  body: string
  id: OnboardingTipId
  path: string
  title: string
}

const BEGINNER_TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'welcome', title: 'Welcome to your CS2 trading career', body: 'Open cases, study real item details, collect skins and build a trading business. We guide real actions without granting or spending anything for you.', hint: 'Choose Next when you are ready.', icon: Compass },
  { id: 'cases_nav', title: 'Open the Cases catalog', body: 'Cases contain a random skin and each paid opening has a visible case-and-key cost. Official rarity odds are independent; there is no pity counter.', hint: 'Click the highlighted Cases navigation entry.', icon: PackageOpen, path: '/cases', targetId: 'nav-cases', action: true },
  { id: 'select_starter_case', title: 'Choose an affordable starter case', body: 'Start small. The card shows the total opening cost and the details panel shows the actual rarity table.', hint: 'Select the highlighted starter case.', icon: ShoppingCart, path: '/cases', targetId: 'starter-case', action: true },
  { id: 'open_case', title: 'Open one case', body: 'Open 1 deducts the displayed cost exactly once and predetermines one reward. If you cannot afford it, pause here and use Work; the tutorial never creates money.', hint: 'Click Open 1 and keep this guide open.', icon: ShoppingCart, path: '/cases', targetId: 'open-case-controls', action: true },
  { id: 'await_opening_result', title: 'Watch the opening finish', body: 'The reel is presentation only: the authoritative reward has already been selected. This step waits for the actual reveal instead of the button press.', hint: 'Wait until the winning skin is fully revealed.', icon: Sparkles, path: '/cases', action: true },
  { id: 'understand_drop', title: 'Read your result', body: 'Rarity describes drop tier. Wear comes from float; lower is usually cleaner. Pattern is the permanent paint seed, and only documented finish-specific variants receive premiums.', hint: 'Review the result, then continue.', icon: Gem },
  { id: 'inventory_nav', title: 'Visit Inventory', body: 'Kept rewards appear in Inventory exactly once. It is the source of truth for owned instances, including float, Pattern, edition, lock and favorite state.', hint: 'Click the highlighted Inventory navigation entry.', icon: Boxes, path: '/inventory', targetId: 'nav-inventory', action: true },
  { id: 'inspect_item', title: 'Inspect the exact item', body: 'Open a card to see base value, wear, float, Pattern classification and estimated final value. The thumbnail is generic and does not render the exact paint seed.', hint: 'Select a skin card and open its details.', icon: Gem, path: '/inventory', targetId: 'inventory-grid', action: true },
  { id: 'collection', title: 'Collection records discoveries', body: 'The Collection Book remembers a discovery after selling. All Time survives Prestige; Current Run tracks the present career chapter.', hint: 'Open Collection Book.', icon: BookOpen, path: '/collection-book', targetId: 'nav-collection-book', action: true },
  { id: 'quests', title: 'Track a beginner quest', body: 'Quest stages use real opening, discovery, Work and market activity. Completed stages become claimable and show a numbered navigation badge.', hint: 'Open Quests & Characters and track a useful quest.', icon: ScrollText, path: '/quests', targetId: 'nav-quests', action: true },
  { id: 'work', title: 'Recover cash with Work', body: 'Work jobs are skill-based early-game income with persistent cooldowns and capped rewards. They do not alter case odds.', hint: 'Open Work to see the available jobs.', icon: BriefcaseBusiness, path: '/work', targetId: 'nav-work', action: true },
  { id: 'selling_vs_cswear', title: 'Choose how to sell', body: 'Instant sale provides immediate discounted liquidity. A CSWEAR listing moves the exact item into escrow and may sell later after fees. You do not need to sell your first skin.', hint: 'Keep the item if you prefer; continue when the difference is clear.', icon: Store },
  { id: 'career', title: 'Build Career XP', body: 'Meaningful openings, discoveries, trading, contracts and skilled Work earn Career XP. Levels unlock upgrades and later employees; repetitive farming has diminishing returns.', hint: 'Open Career & Upgrades to see your next objective, then finish.', icon: Sparkles, path: '/career', targetId: 'nav-career', action: true },
]

function getStepIndex(id: OnboardingStepId | undefined) {
  const index = BEGINNER_TUTORIAL_STEPS.findIndex((step) => step.id === id)
  return index < 0 ? 0 : index
}

function useTargetRect(targetId: string | undefined, active: boolean) {
  const [rect, setRect] = useState<DOMRect>()
  useEffect(() => {
    if (!active || !targetId) return
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setRect(document.querySelector<HTMLElement>(`[data-onboarding-target="${targetId}"]`)?.getBoundingClientRect()))
    }
    const observer = new MutationObserver(update)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [active, targetId])
  return active ? rect : undefined
}

function getFeatureGuides(state: ReturnType<typeof useGame>['state'], pathname: string): FeatureGuide[] {
  const level = getCareerSnapshot(state.career).level
  const hired = Object.values(state.business.employees).some((employee) => employee.isHired)
  const eligibility = getPrestigeEligibilityV2(state)
  const nearPrestige = eligibility.canPrestige || level >= Math.max(1, eligibility.tier.minimumLevel - 3)
  return [
    ...(pathname === '/cswear' ? [{ id: 'cswear' as const, title: 'CSWEAR trading', body: 'Compare asking price with credible estimated value, negotiate manually, and remember that listed items stay in escrow until sale, cancellation or expiry.', path: '/cswear' }] : []),
    ...(pathname === '/trade-ups' || state.inventory.length >= 5 ? [{ id: 'trade_up' as const, title: 'Trade-Up contracts', body: 'Contracts permanently consume 10 same-rarity inputs, or 5 eligible Covert inputs. Review exact probabilities, float mapping and opportunity cost.', path: '/trade-ups' }] : []),
    ...(pathname === '/career' ? [{ id: 'career' as const, title: 'Career & Upgrades', body: 'Career level comes from XP; each specialization tracks real activity. Upgrades also require activity and prerequisite nodes, not only cash.', path: '/career' }] : []),
    ...(pathname === '/business' && !hired ? [{ id: 'business' as const, title: 'Hiring your first employee', body: 'Employees have hiring costs, wages, budgets and risk controls. Paused employees do not operate, and valuable decisions still require you.', path: '/business' }] : []),
    ...(hired && pathname === '/business' ? [{ id: 'business_setup' as const, title: 'Configure operations', body: 'Allocate only the budget you can risk, set role limits, review wages, then enable the employee. Closing this guide changes nothing.', path: '/business' }] : []),
    ...(state.business.employees.marketScout.isHired ? [{ id: 'market_scout' as const, title: 'Market Scout alerts', body: 'Watchlists define coverage. Scouts report credible matches for review; they never automatically buy exceptional items.', path: '/business' }] : []),
    ...(pathname === '/quests' ? [{ id: 'quests' as const, title: 'Quests & Collection Hunts', body: 'Track stages, distinguish discovery from ownership, and claim completed rewards. NPC delivery consumes the exact selected item.', path: '/quests' }] : []),
    ...(nearPrestige || pathname === '/prestige' ? [{ id: 'prestige' as const, title: 'Prestige safely', body: 'Prestige resets the current career chapter for PP. Review the reset list, Legacy Vault and recovery backup; this guide cannot reset anything.', path: '/prestige' }] : []),
    ...(state.dropJournal.entries.length > 0 ? [{ id: 'drop_journal' as const, title: 'Permanent Drop Journal', body: 'Notable opening records preserve the real item and value-at-discovery. Open Completed & Journal to clear its unread badge.', path: '/quests?tab=completed' }] : []),
  ]
}

export function OnboardingTutorial() {
  const { state, updateOnboardingState } = useGame()
  const location = useLocation()
  const navigate = useNavigate()
  const onboarding = state.ui.onboarding
  const [domTick, setDomTick] = useState(0)
  const index = getStepIndex(onboarding.activeStepId)
  const step = BEGINNER_TUTORIAL_STEPS[index]
  const open = (!onboarding.isDismissed || onboarding.isReviewing) && !onboarding.isPaused
  const onPath = !step.path || location.pathname === step.path
  const targetRect = useTargetRect(step.targetId, open && onPath)
  const dismissed = useMemo(() => new Set(onboarding.dismissedTipIds), [onboarding.dismissedTipIds])
  const featureGuide = useMemo(() => {
    if (open || state.marketplace.pendingAcquisition?.source === 'trade-up') return undefined
    return getFeatureGuides(state, location.pathname).find((guide) => !dismissed.has(guide.id))
  }, [dismissed, location.pathname, open, state])

  useEffect(() => {
    if (!open || !step.action) return
    const interval = window.setInterval(() => setDomTick((value) => value + 1), 250)
    return () => window.clearInterval(interval)
  }, [open, step.action])

  const setStep = useCallback((nextIndex: number, completeCurrent = false) => {
    const bounded = Math.max(0, Math.min(BEGINNER_TUTORIAL_STEPS.length - 1, nextIndex))
    updateOnboardingState({ activeStepId: BEGINNER_TUTORIAL_STEPS[bounded].id, caseOpenBaseline: step.id === 'welcome' ? state.statistics.casesOpened : onboarding.caseOpenBaseline, completedStepIds: completeCurrent ? Array.from(new Set([...onboarding.completedStepIds, step.id])) : onboarding.completedStepIds, isDismissed: false, isPaused: false, isReviewing: true })
  }, [onboarding.caseOpenBaseline, onboarding.completedStepIds, state.statistics.casesOpened, step.id, updateOnboardingState])

  const finish = useCallback(() => {
    updateOnboardingState({ activeStepId: 'career', completedStepIds: BEGINNER_TUTORIAL_STEPS.map((entry) => entry.id), isDismissed: true, isPaused: false, isReviewing: false })
  }, [updateOnboardingState])

  useEffect(() => {
    if (!open) return
    let completed = false
    if (step.id === 'cases_nav') completed = location.pathname === '/cases'
    if (step.id === 'select_starter_case') completed = Boolean(document.querySelector('[data-onboarding-target="starter-case"][data-case-selected="true"]'))
    if (step.id === 'open_case') completed = state.statistics.casesOpened > (onboarding.caseOpenBaseline ?? state.statistics.casesOpened)
    if (step.id === 'await_opening_result') {
      const result = document.querySelector('[data-testid="opening-result"]')
      const openingDialog = document.querySelector('[aria-label="Case opening animation"]')
      const openedAfterBaseline = state.statistics.casesOpened > (onboarding.caseOpenBaseline ?? state.statistics.casesOpened)
      completed = Boolean(
        result && state.lastOpenedItems.some((item) => result.textContent?.includes(item.finish)),
      ) || (openedAfterBaseline && state.lastOpenedItems.length > 0 && !openingDialog)
    }
    if (step.id === 'inventory_nav') completed = location.pathname === '/inventory'
    if (step.id === 'inspect_item') completed = Boolean(document.querySelector('[data-onboarding-target="item-details"]'))
    if (step.id === 'collection') completed = location.pathname === '/collection-book'
    if (step.id === 'quests') completed = location.pathname === '/quests'
    if (step.id === 'work') completed = location.pathname === '/work'
    if (step.id === 'career') completed = location.pathname === '/career'
    if (completed) {
      const timer = window.setTimeout(() => step.id === 'career' ? finish() : setStep(index + 1, true), 180)
      return () => window.clearTimeout(timer)
    }
  }, [domTick, finish, index, location.pathname, onboarding.caseOpenBaseline, open, setStep, state.lastOpenedItems, state.statistics.casesOpened, step.id, targetRect])

  if (onboarding.isPaused && !onboarding.isDismissed) return <button className="fixed bottom-3 right-3 z-[70] inline-flex min-h-11 items-center gap-2 border border-rarity-special bg-cs-surface px-3 text-sm font-semibold text-rarity-special shadow-glow" onClick={() => updateOnboardingState({ isPaused: false, isReviewing: true })} type="button"><Play size={16} /> Resume tutorial</button>

  if (open) {
    const Icon = step.icon
    const panelPosition = targetRect && targetRect.top > window.innerHeight * .52 ? 'top-3' : 'bottom-3'
    return <>{targetRect ? <div aria-hidden="true" className="pointer-events-none fixed z-[60] rounded border-2 border-rarity-special shadow-[0_0_0_4px_rgb(var(--rarity-special)_/_0.12),0_0_28px_rgb(var(--rarity-special)_/_0.35)]" style={{ left: Math.max(6, targetRect.left - 5), top: Math.max(6, targetRect.top - 5), width: Math.min(window.innerWidth - 12, targetRect.width + 10), height: targetRect.height + 10 }} /> : null}<aside aria-label="Interactive beginner tutorial" className={`fixed left-3 right-3 z-[70] max-h-[min(25rem,calc(100dvh-1.5rem))] overflow-y-auto border border-rarity-special bg-cs-surface p-3 shadow-glow sm:left-auto sm:right-4 sm:w-[25rem] ${panelPosition}`} data-testid="onboarding-tutorial"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center border border-rarity-special bg-rarity-special/10 text-rarity-special"><Icon size={18} /></span><div className="min-w-0 flex-1"><p className="font-mono text-[10px] uppercase text-rarity-special">Step {index + 1} / {BEGINNER_TUTORIAL_STEPS.length}</p><h2 className="mt-0.5 font-semibold text-cs-text">{step.title}</h2></div><button aria-label="Skip beginner tutorial" className="grid h-9 w-9 place-items-center border border-cs-border text-cs-muted hover:text-cs-text" onClick={() => updateOnboardingState({ isDismissed: true, isPaused: false, isReviewing: false })} type="button"><X size={16} /></button></div><p className="mt-2 text-sm leading-5 text-cs-muted">{step.body}</p><p className="mt-2 border-l-2 border-rarity-special bg-rarity-special/5 px-3 py-2 text-xs font-semibold text-cs-text">{step.hint}</p>{step.action && onPath && !targetRect ? <p className="mt-2 text-xs text-cs-amber">The target is not visible yet. Scroll or use Go there; Back, Pause and Skip remain available.</p> : null}<div className="mt-3 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-2"><button aria-label="Previous tutorial step" className="inline-flex min-h-9 items-center gap-1 border border-cs-border px-2 text-xs text-cs-muted disabled:opacity-30" disabled={index === 0} onClick={() => setStep(index - 1)} type="button"><ArrowLeft size={14} /> Back</button><button className="inline-flex min-h-9 items-center gap-1 border border-cs-border px-2 text-xs text-cs-muted" onClick={() => updateOnboardingState({ isPaused: true, isReviewing: false })} type="button"><Pause size={14} /> Pause</button></div><div className="flex gap-2">{step.path && !onPath ? <button className="inline-flex min-h-9 items-center gap-1 border border-rarity-special px-3 text-xs font-semibold text-rarity-special" onClick={() => navigate(step.path!)} type="button">Go there <ArrowRight size={14} /></button> : null}{!step.action ? <button className="inline-flex min-h-9 items-center gap-1 border border-rarity-special bg-rarity-special/10 px-3 text-xs font-semibold text-rarity-special" onClick={() => index === BEGINNER_TUTORIAL_STEPS.length - 1 ? finish() : setStep(index + 1, true)} type="button">{index === BEGINNER_TUTORIAL_STEPS.length - 1 ? 'Finish' : 'Next'} <ArrowRight size={14} /></button> : null}</div></div></aside></>
  }

  if (!featureGuide) return null
  return <aside aria-label={featureGuide.title} className="pointer-events-none fixed bottom-3 left-3 z-50 w-[min(24rem,calc(100vw-1.5rem))] border border-cs-border bg-cs-surface p-3 shadow-glow" role="status"><div className="flex items-start gap-3"><HelpCircle className="mt-0.5 shrink-0 text-rarity-industrial" size={18} /><div className="min-w-0 flex-1"><p className="font-mono text-[10px] uppercase text-rarity-industrial">Feature guide</p><h2 className="mt-1 font-semibold text-cs-text">{featureGuide.title}</h2></div><button aria-label={`Dismiss ${featureGuide.title}`} className="pointer-events-auto grid h-9 w-9 place-items-center border border-cs-border text-cs-muted" onClick={() => updateOnboardingState({ dismissedTipIds: Array.from(new Set([...onboarding.dismissedTipIds, featureGuide.id])) })} type="button"><X size={16} /></button></div><p className="mt-2 text-sm leading-5 text-cs-muted">{featureGuide.body}</p><div className="mt-3 flex gap-2"><button className="pointer-events-auto min-h-9 border border-rarity-industrial px-3 text-xs font-semibold text-rarity-industrial" onClick={() => { updateOnboardingState({ dismissedTipIds: Array.from(new Set([...onboarding.dismissedTipIds, featureGuide.id])) }); navigate(featureGuide.path) }} type="button">Open feature</button><button className="pointer-events-auto min-h-9 border border-cs-border px-3 text-xs text-cs-muted" onClick={() => navigate('/help')} type="button">Help Center</button></div></aside>
}
