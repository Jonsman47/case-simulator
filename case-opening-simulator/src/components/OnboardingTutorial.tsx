import { ArrowLeft, ArrowRight, Pause, Play, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { FeatureId, OnboardingStepId } from '../data/gameState'
import { useGame } from '../hooks/useGame'

interface Step {
  id: OnboardingStepId
  title: string
  body: string
  mode: 'dialog' | 'spotlight' | 'wait'
  target?: string
  requiredRoute?: string
  destination?: string
  needsEvent?: boolean
  recovery: string
}

const steps: Step[] = [
  { id: 'welcome', title: 'Welcome', body: 'This is a CS2 case-opening simulator. Open cases to get random weapon skins, grow your collection, complete quests, and build your trading career.', mode: 'dialog', recovery: 'Continue or skip.' },
  { id: 'cash', title: 'Your cash', body: 'Opening a case costs money. Your balance is shown here. If you run low, Work is a reliable way to earn more.', mode: 'spotlight', target: 'wallet-balance', recovery: 'Continue when you have found your balance.' },
  { id: 'cases_nav', title: 'Find a case', body: 'Cases contain random skins. Choose Cases to see the real prices and odds.', mode: 'spotlight', target: 'nav-cases', destination: '/cases', needsEvent: true, recovery: 'Use Go to Cases if navigation is hidden.' },
  { id: 'select_starter_case', title: 'Choose an affordable case', body: 'Select this case to see its opening controls. Your cash and any Case Opening Funds can help pay for it.', mode: 'spotlight', target: 'starter-case', requiredRoute: '/cases', needsEvent: true, recovery: 'If no case is affordable, visit Work, then resume here.' },
  { id: 'open_case', title: 'Open one case', body: 'The displayed cost is paid once. The skin is random. Use the real Open 1 button while this guide stays visible.', mode: 'spotlight', target: 'open-case-controls', requiredRoute: '/cases', needsEvent: true, recovery: 'If cash is low, pause and earn more in Work.' },
  { id: 'await_opening_result', title: 'Watch the result', body: 'The opening has been recorded. Wait for the skin reveal before moving on.', mode: 'wait', needsEvent: true, recovery: 'After a reload, you can continue from your saved opening.' },
  { id: 'understand_drop', title: 'Your new skin', body: 'Rarity is the drop tier. Wear describes its condition. Estimated value shows what the market suggests it may be worth.', mode: 'spotlight', target: 'opening-result', recovery: 'The result may have closed; continue to Inventory.' },
  { id: 'inventory_nav', title: 'Visit Inventory', body: 'Your acquired skins live in Inventory. You can keep them, collect them, or sell them later.', mode: 'spotlight', target: 'nav-inventory', destination: '/inventory', needsEvent: true, recovery: 'Use Go to Inventory if navigation is hidden.' },
  { id: 'inspect_item', title: 'Inspect your skin', body: 'Select the skin you just opened to see its details. You do not need to sell it.', mode: 'spotlight', target: 'acquired-item', requiredRoute: '/inventory', needsEvent: true, recovery: 'If it was auto-sold, review the opening in Recent Activity and skip this step.' },
  { id: 'quests', title: 'Quests give you goals', body: 'Quests turn openings and collecting into goals with rewards. Visit Quests to see a beginner objective.', mode: 'spotlight', target: 'nav-quests', destination: '/quests', needsEvent: true, recovery: 'Use Go to Quests if its navigation is hidden.' },
  { id: 'work', title: 'Earn cash in Work', body: 'If you need more money to open cases, Work minigames let you earn it. You can explore now or skip this step.', mode: 'spotlight', target: 'nav-work', destination: '/work', needsEvent: true, recovery: 'Use Go to Work or Skip step.' },
  { id: 'finish_home', title: 'You are ready', body: 'Home now shows Continue Opening, current goals, available rewards, and your next unlock. Return here whenever you need a next move.', mode: 'dialog', requiredRoute: '/', recovery: 'Go Home, then finish.' },
]

function useSpotlight(target: string | undefined, active: boolean) {
  const [rect, setRect] = useState<DOMRect | undefined>()
  useEffect(() => {
    if (!active || !target) return
    let frame = 0
    let trackingMotion = false
    let watched: Element | null = null
    let resizeObserver: ResizeObserver | undefined
    const measure = () => {
      const choices = [...document.querySelectorAll(`[data-onboarding-target="${target}"]`)]
      const visible = (candidate: Element) => { const box = candidate.getBoundingClientRect(); return box.width > 0 && box.height > 0 }
      const mobileMenu = document.querySelector('[data-onboarding-target="mobile-menu"]')
      const node = choices.find(visible) ?? (target.startsWith('nav-') && mobileMenu && visible(mobileMenu) ? mobileMenu : null)
      if (node !== watched) {
        resizeObserver?.disconnect()
        watched = node
        if (node) {
          resizeObserver = new ResizeObserver(schedule)
          resizeObserver.observe(node)
        }
      }
      const next = node?.getBoundingClientRect()
      setRect((previous) => next && previous && Math.abs(previous.x - next.x) < 0.5 && Math.abs(previous.y - next.y) < 0.5 && Math.abs(previous.width - next.width) < 0.5 && Math.abs(previous.height - next.height) < 0.5 ? previous : next)
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    const trackMotion = () => {
      measure()
      if (trackingMotion) frame = requestAnimationFrame(trackMotion)
    }
    const onTransitionStart = (event: Event) => {
      if (!watched || !(event.target instanceof Element) || !(watched === event.target || watched.contains(event.target))) return
      trackingMotion = true
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(trackMotion)
    }
    const onTransitionEnd = () => { trackingMotion = false; schedule() }
    const mutation = new MutationObserver(schedule)
    mutation.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    document.addEventListener('transitionrun', onTransitionStart, true)
    document.addEventListener('transitionend', onTransitionEnd, true)
    schedule()
    return () => { mutation.disconnect(); resizeObserver?.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true); document.removeEventListener('transitionrun', onTransitionStart, true); document.removeEventListener('transitionend', onTransitionEnd, true) }
  }, [active, target])
  return active ? rect : undefined
}

function getPanelStyle(rect: DOMRect | undefined): CSSProperties {
  const width = Math.min(360, window.innerWidth - 16)
  if (!rect) return { left: 8, bottom: 8, width }
  const gap = 12
  const height = 230
  const below = window.innerHeight - rect.bottom
  const above = rect.top
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left))
  if (below >= height + gap) return { left, top: rect.bottom + gap, width }
  if (above >= height + gap) return { left, bottom: window.innerHeight - rect.top + gap, width }
  if (rect.right + gap + width < window.innerWidth) return { left: rect.right + gap, top: Math.max(8, Math.min(window.innerHeight - height - 8, rect.top)), width }
  if (rect.left - gap - width > 0) return { left: rect.left - gap - width, top: Math.max(8, Math.min(window.innerHeight - height - 8, rect.top)), width }
  return { left: 8, bottom: 8, width }
}

export function OnboardingTutorial() {
  const { dispatch, state, updateOnboardingState } = useGame()
  const location = useLocation()
  const navigate = useNavigate()
  const onboarding = state.ui.onboarding
  const index = Math.max(0, steps.findIndex((step) => step.id === onboarding.activeStepId))
  const step = steps[index]
  const open = (!onboarding.isDismissed || onboarding.isReviewing) && !onboarding.isPaused
  const openingDialogOpen = Boolean(document.querySelector('[aria-label="Case opening animation"]'))
  const targetRect = useSpotlight(step.target, open && step.mode === 'spotlight' && (!openingDialogOpen || step.id === 'understand_drop'))
  const [domRevision, setDomRevision] = useState(0)
  const [selectedCaseEvent, setSelectedCaseEvent] = useState(0)
  const selectedCaseBaseline = useRef(0)
  const [activeUnlock, setActiveUnlock] = useState<FeatureId>()
  const featureUnlocks = state.ui.featureUnlocks
  const nextUnpresented = useMemo(() => featureUnlocks.unlockedIds.find((id) => !(featureUnlocks.presentedIds ?? []).includes(id)), [featureUnlocks])
  const featureAtRoute = featureUnlocks.unlockedIds.find((id) => `/${id}` === location.pathname || (id === 'market' && location.pathname === '/market'))

  const advance = useCallback((nextIndex: number, completed = true) => {
    const next = steps[Math.max(0, Math.min(steps.length - 1, nextIndex))]
    if (next.id === 'select_starter_case') selectedCaseBaseline.current = selectedCaseEvent
    updateOnboardingState({
      activeStepId: next.id,
      lastValidStepId: next.id,
      completedStepIds: completed ? Array.from(new Set([...onboarding.completedStepIds, step.id])) : onboarding.completedStepIds,
      caseOpenBaseline: step.id === 'welcome' ? state.statistics.casesOpened : onboarding.caseOpenBaseline,
      openedItemId: step.id === 'open_case' ? state.lastOpenedItems[0]?.instanceId : onboarding.openedItemId,
      isDismissed: false, isPaused: false, isReviewing: true,
    })
  }, [onboarding, selectedCaseEvent, state.lastOpenedItems, state.statistics.casesOpened, step.id, updateOnboardingState])

  const finish = useCallback(() => updateOnboardingState({ activeStepId: 'finish_home', lastValidStepId: 'finish_home', completedStepIds: steps.map((entry) => entry.id), isDismissed: true, isPaused: false, isReviewing: false }), [updateOnboardingState])

  useEffect(() => {
    const selected = () => setSelectedCaseEvent((value) => value + 1)
    window.addEventListener('tutorial:case-selected', selected)
    return () => window.removeEventListener('tutorial:case-selected', selected)
  }, [])

  useEffect(() => {
    if (open || activeUnlock || !nextUnpresented || state.marketplace.pendingAcquisition || document.querySelector('[aria-label="Case opening animation"]')) return
    const timer = window.setTimeout(() => {
      setActiveUnlock(nextUnpresented)
      dispatch({ type: 'UPDATE_FEATURE_UNLOCK_STATE', featureUnlocks: { presentedIds: [...(featureUnlocks.presentedIds ?? []), nextUnpresented] } })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [activeUnlock, dispatch, featureUnlocks.presentedIds, nextUnpresented, open, state.marketplace.pendingAcquisition])

  useEffect(() => {
    if (!open) return
    const mutation = new MutationObserver(() => setDomRevision((value) => value + 1))
    mutation.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-reveal-complete', 'data-item-instance-id'] })
    return () => mutation.disconnect()
  }, [open])

  useEffect(() => {
    if (!open) return
    if (step.id === 'cases_nav' && location.pathname === '/cases') advance(index + 1)
    else if (step.id === 'select_starter_case' && selectedCaseEvent > selectedCaseBaseline.current && location.pathname === '/cases') advance(index + 1)
    else if (step.id === 'open_case' && state.statistics.casesOpened > (onboarding.caseOpenBaseline ?? state.statistics.casesOpened)) advance(index + 1)
    else if (step.id === 'await_opening_result' && onboarding.openedItemId && document.querySelector(`[data-reveal-complete="${onboarding.openedItemId}"]`)) advance(index + 1)
    else if (step.id === 'inventory_nav' && location.pathname === '/inventory') advance(index + 1)
    else if (step.id === 'inspect_item' && onboarding.openedItemId && document.querySelector(`[data-onboarding-target="item-details"][data-item-instance-id="${onboarding.openedItemId}"]`)) advance(index + 1)
    else if (step.id === 'quests' && location.pathname === '/quests') advance(index + 1)
    else if (step.id === 'work' && location.pathname === '/work') advance(index + 1)
  }, [advance, domRevision, index, location.pathname, onboarding.caseOpenBaseline, onboarding.openedItemId, open, selectedCaseEvent, state.statistics.casesOpened, step.id])

  if (onboarding.isPaused && !onboarding.isDismissed) return <button className="fixed bottom-3 right-3 z-[80] inline-flex min-h-11 items-center gap-2 border border-rarity-special bg-cs-surface px-3 text-sm font-semibold text-rarity-special shadow-glow" onClick={() => updateOnboardingState({ isPaused: false, isReviewing: true })} type="button"><Play size={16} /> Resume tutorial</button>

  if (open) {
    const centered = step.mode === 'dialog'
    const needsRoute = step.requiredRoute && location.pathname !== step.requiredRoute
    const targetMissing = step.mode === 'spotlight' && !targetRect
    const canContinueSaved = step.id === 'await_opening_result' && Boolean(onboarding.openedItemId && state.lastOpenedItems.some((item) => item.instanceId === onboarding.openedItemId)) && !openingDialogOpen
    return <>
      {centered ? <div className="fixed inset-0 z-[65] bg-black/75" /> : step.mode === 'wait' || (openingDialogOpen && step.id !== 'understand_drop') ? null : targetRect ? <div aria-hidden="true" className={`pointer-events-none fixed rounded border-2 border-rarity-special shadow-[0_0_0_9999px_rgba(0,0,0,.68),0_0_24px_rgb(var(--rarity-special)_/_0.6)] ${step.id === 'understand_drop' ? 'z-[100]' : 'z-[65]'}`} style={{ left: Math.max(2, targetRect.left - 4), top: Math.max(2, targetRect.top - 4), width: targetRect.width + 8, height: targetRect.height + 8 }} /> : <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[65] bg-black/50" />}
      <aside aria-label="Interactive beginner tutorial" className={`fixed ${openingDialogOpen ? 'z-[110]' : 'z-[70]'} max-h-[calc(100dvh-1rem)] overflow-y-auto border border-rarity-special bg-cs-surface p-3 shadow-glow ${centered ? 'left-1/2 top-1/2 w-[min(28rem,calc(100vw-1rem))] -translate-x-1/2 -translate-y-1/2' : ''}`} data-testid="onboarding-tutorial" style={centered ? undefined : getPanelStyle(targetRect)}>
        <div className="flex items-start gap-3"><img alt="" className="h-12 w-12 shrink-0 rounded-full border border-rarity-special bg-cs-panel" src={`${import.meta.env.BASE_URL}assets/guide-portrait.svg`} /><div className="min-w-0 flex-1"><p className="font-mono text-[10px] uppercase text-rarity-special">Guide · {index + 1}/{steps.length}</p><h2 className="mt-1 font-semibold text-cs-text">{step.title}</h2></div><button aria-label="Skip beginner tutorial" className="grid h-9 w-9 shrink-0 place-items-center border border-cs-border text-cs-muted" onClick={() => updateOnboardingState({ isDismissed: true, isPaused: false, isReviewing: false })} type="button"><X size={16} /></button></div>
        <p className="mt-3 text-sm leading-5 text-cs-text">{step.body}</p>
        {openingDialogOpen && step.id === 'inventory_nav' ? <p className="mt-2 text-xs text-cs-amber">Close the result panel, then choose Inventory.</p> : null}
        {needsRoute || targetMissing ? <p className="mt-2 text-xs text-cs-amber">{step.recovery}</p> : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1"><button aria-label="Previous tutorial step" className="inline-flex min-h-9 items-center gap-1 border border-cs-border px-2 text-xs text-cs-muted disabled:opacity-30" disabled={index === 0} onClick={() => advance(index - 1, false)} type="button"><ArrowLeft size={13} /> Back</button><button className="inline-flex min-h-9 items-center gap-1 border border-cs-border px-2 text-xs text-cs-muted" onClick={() => updateOnboardingState({ isPaused: true, isReviewing: false })} type="button"><Pause size={13} /> Pause</button></div><div className="flex gap-1">{step.id === 'work' || step.id === 'inspect_item' ? <button className="min-h-9 border border-cs-border px-2 text-xs text-cs-muted" onClick={() => advance(index + 1)} type="button">Skip step</button> : null}{needsRoute || (targetMissing && step.destination) ? <button className="min-h-9 border border-rarity-special px-2 text-xs text-rarity-special" onClick={() => navigate(step.requiredRoute ?? step.destination!)} type="button">Go to {step.requiredRoute === '/' ? 'Home' : step.requiredRoute === '/cases' ? 'Cases' : step.requiredRoute === '/inventory' ? 'Inventory' : step.destination?.slice(1)}</button> : null}{(step.mode === 'dialog' && !needsRoute) || step.id === 'cash' || step.id === 'understand_drop' || canContinueSaved ? <button className="inline-flex min-h-9 items-center gap-1 border border-rarity-special bg-rarity-special/10 px-3 text-xs font-semibold text-rarity-special" onClick={() => step.id === 'finish_home' ? finish() : advance(index + 1)} type="button">{step.id === 'finish_home' ? 'Finish' : 'Continue'} <ArrowRight size={13} /></button> : null}</div></div>
      </aside>
    </>
  }

  if (state.marketplace.pendingAcquisition || document.querySelector('[aria-label="Case opening animation"]')) return null
  const labels: Record<string, string> = { 'collection-book': 'Collection Book', quests: 'Quests', market: 'Market Price Checker', cswear: 'CSWEAR', 'trade-ups': 'Trade-Ups', business: 'Business', prestige: 'Prestige' }
  const paths: Record<string, string> = { 'collection-book': '/collection-book', quests: '/quests', market: '/market', cswear: '/cswear', 'trade-ups': '/trade-ups', business: '/business', prestige: '/prestige' }
  const unlockDescriptions: Record<string, string> = { 'collection-book': 'Your first skin discovery is recorded. Explore what you have found.', quests: 'Your first opening has started a real goal with a claimable reward.', market: 'Your first sale opened the price checker.', cswear: 'Your Career progress opened simulated skin trading.', 'trade-ups': 'You have enough compatible skins to combine ten into a higher-rarity result.', business: 'Career level 15 opens your first employee roles.', prestige: 'Your Career path is eligible for a Prestige review.' }
  if (!activeUnlock && !nextUnpresented && featureAtRoute && !featureUnlocks.introducedIds.includes(featureAtRoute)) {
    const explanations: Record<string, string> = {
      'collection-book': 'Discovered skins stay recorded here even after you sell them.',
      quests: 'Pick a goal, follow its progress, and claim earned rewards.',
      market: 'Compare estimated prices before selling or trading.',
      cswear: 'Browse simulated offers and check the full cost before buying.',
      'trade-ups': 'Ten compatible skins can be consumed for one higher-rarity result. Review the contract first.',
      business: 'Employees unlock through Career levels and require wages and budgets.',
      prestige: 'Review the exact eligibility and reset effects before committing.',
    }
    return <aside aria-label={`${labels[featureAtRoute]} introduction`} className="pointer-events-none fixed bottom-3 left-3 z-[70] w-[min(22rem,calc(100vw-1.5rem))] border border-rarity-special bg-cs-surface p-3 shadow-glow max-sm:bottom-auto max-sm:top-3" role="status"><p className="font-mono text-[10px] uppercase text-rarity-special">First visit</p><h2 className="mt-1 font-semibold">{labels[featureAtRoute]}</h2><p className="mt-1 text-sm text-cs-muted">{explanations[featureAtRoute]}</p><button className="pointer-events-auto mt-3 min-h-9 border border-rarity-special px-3 text-xs font-semibold text-rarity-special" onClick={() => dispatch({ type: 'UPDATE_FEATURE_UNLOCK_STATE', featureUnlocks: { introducedIds: [...featureUnlocks.introducedIds, featureAtRoute] } })} type="button">Got it</button></aside>
  }
  if (!activeUnlock) return null
  const acknowledge = () => { dispatch({ type: 'UPDATE_FEATURE_UNLOCK_STATE', featureUnlocks: { acknowledgedIds: [...featureUnlocks.acknowledgedIds, activeUnlock] } }); setActiveUnlock(undefined) }
  return <aside aria-label="Feature unlocked" className="pointer-events-none fixed bottom-3 left-3 z-[70] w-[min(22rem,calc(100vw-1.5rem))] border border-rarity-special bg-cs-surface p-3 shadow-glow max-sm:bottom-auto max-sm:top-3" role="status"><p className="font-mono text-[10px] uppercase text-rarity-special">New feature</p><h2 className="mt-1 font-semibold">{labels[activeUnlock]} Unlocked!</h2><p className="mt-1 text-sm text-cs-muted">{unlockDescriptions[activeUnlock]}</p><div className="mt-3 flex gap-2"><button className="pointer-events-auto min-h-9 border border-rarity-special px-3 text-xs font-semibold text-rarity-special" onClick={() => { acknowledge(); navigate(paths[activeUnlock]) }} type="button">Try {labels[activeUnlock]}</button><button className="pointer-events-auto min-h-9 border border-cs-border px-3 text-xs text-cs-muted" onClick={acknowledge} type="button">Maybe later</button></div></aside>
}
