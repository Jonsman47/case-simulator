import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  CircuitBoard,
  PackageCheck,
  Play,
  RotateCw,
  Truck,
  Warehouse,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'
import {
  DELIVERY_DESTINATIONS,
  DELIVERY_GRID_SIZE,
  DELIVERY_MAX_MOVES,
  DELIVERY_OBSTACLES,
  DELIVERY_PACKAGES,
  calculateCircuitPerformance,
  calculateDeliveryPerformance,
  calculateMiningPerformance,
  calculateWarehousePerformance,
  canMineBlock,
  createCircuitPuzzle,
  generateMiningGrid,
  getCircuitConnections,
  getCircuitHint,
  getPoweredCircuitIds,
  isCircuitSolved,
  moveDeliveryPosition,
  pointKey,
  type GridPoint,
  type MiningResource,
} from '../utils/workExpansion'
import { getWorkBaseReward, type WorkMiniGameId } from '../utils/workMinigames'
import { getSkillMinigameRewardMultiplier } from '../data/skills'
import { getClickIncomeMultiplier } from '../data/upgrades'

const workAsset = (name: string) => `/assets/work/${name}`

const miningImages: Record<MiningResource, string> = {
  coal: workAsset('ore-coal.png'),
  diamond: workAsset('ore-diamond.png'),
  dirt: workAsset('dirt-block.png'),
  gold: workAsset('ore-gold.png'),
  iron: workAsset('ore-iron.png'),
  stone: workAsset('ore-stone.png'),
}

const warehouseLanes = ['red', 'blue', 'green', 'yellow'] as const
type WarehouseLane = (typeof warehouseLanes)[number]

const crateImages: Record<WarehouseLane, string> = {
  blue: workAsset('crate-blue.png'),
  green: workAsset('crate-green.png'),
  red: workAsset('crate-red.png'),
  yellow: workAsset('crate-yellow.png'),
}

const dockImages: Record<WarehouseLane, string> = {
  blue: workAsset('sorting-dock-orange.png'),
  green: workAsset('sorting-dock-green.png'),
  red: workAsset('sorting-dock-red.png'),
  yellow: workAsset('sorting-dock-yellow.png'),
}

function useRewardPreview(gameId: WorkMiniGameId, performance: number) {
  const { state } = useGame()
  return getWorkBaseReward(gameId, performance) *
    getClickIncomeMultiplier(state.upgrades) *
    getSkillMinigameRewardMultiplier(state.learnedSkillNodeIds)
}

function ResultBanner({ performance, reward }: { performance: number; reward: number }) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-cs-green bg-cs-green/10 px-3 py-2">
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-cs-green"><CheckCircle2 size={16} /> Job complete</span>
      <span className="font-mono text-sm font-semibold text-cs-green">Score {Math.round(performance * 100)}% · +{formatCurrency(reward).replace(/\.00$/, '')}</span>
    </div>
  )
}

function StartJob({ children, icon, onStart }: { children: string; icon: ReactNode; onStart: () => void }) {
  return (
    <button className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 border border-rarity-special bg-rarity-special/10 px-4 text-sm font-semibold text-rarity-special transition hover:bg-rarity-special/20" onClick={onStart} type="button">
      {icon}{children}
    </button>
  )
}

export function DiamondMinerJob() {
  const { dispatch } = useGame()
  const [blocks, setBlocks] = useState(() => generateMiningGrid(1))
  const [minedIds, setMinedIds] = useState<Set<string>>(() => new Set())
  const [hits, setHits] = useState<Record<string, number>>({})
  const [resources, setResources] = useState<Partial<Record<MiningResource, number>>>({})
  const [actions, setActions] = useState(18)
  const [deepestRow, setDeepestRow] = useState(0)
  const [status, setStatus] = useState<'idle' | 'running' | 'finished'>('idle')
  const [performance, setPerformance] = useState(0)
  const completedRef = useRef(false)
  const reward = useRewardPreview('diamondMiner', performance)

  const complete = useCallback((score: number) => {
    if (completedRef.current) return
    completedRef.current = true
    setPerformance(score)
    setStatus('finished')
    dispatch({ type: 'COMPLETE_WORK_MINIGAME', gameId: 'diamondMiner', now: Date.now(), performance: score })
  }, [dispatch])

  function start() {
    completedRef.current = false
    setBlocks(generateMiningGrid(Math.floor(Math.random() * 0xffff_ffff)))
    setMinedIds(new Set())
    setHits({})
    setResources({})
    setActions(18)
    setDeepestRow(0)
    setPerformance(0)
    setStatus('running')
  }

  function mine(blockId: string) {
    if (status !== 'running' || actions <= 0 || minedIds.has(blockId)) return
    const block = blocks.find((candidate) => candidate.id === blockId)
    if (!block || !canMineBlock(block, minedIds)) return
    const nextActions = actions - 1
    const nextHitCount = (hits[blockId] ?? 0) + 1
    const nextHits = { ...hits, [blockId]: nextHitCount }
    let nextResources = resources
    let nextDepth = deepestRow

    if (nextHitCount >= block.hardness) {
      nextResources = { ...resources, [block.resource]: (resources[block.resource] ?? 0) + 1 }
      nextDepth = Math.max(deepestRow, block.row)
      setMinedIds(new Set(minedIds).add(block.id))
      setResources(nextResources)
      setDeepestRow(nextDepth)
    }

    setHits(nextHits)
    setActions(nextActions)
    if (nextActions <= 0) complete(calculateMiningPerformance(nextResources, nextDepth))
  }

  return (
    <section data-testid="diamondMiner-game">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="font-mono text-[10px] uppercase text-rarity-special">Depth strategy · 20 minute cooldown</p><h3 className="mt-1 text-xl font-semibold text-cs-text">Diamond Miner</h3><p className="mt-1 max-w-2xl text-sm text-cs-muted">Click a reachable block to mine it, then dig through it to reach deeper blocks. Hard rocks need more hits. Find valuable ores and diamonds in 18 swings; cash out after your first find, or use every swing. More valuable finds and greater depth improve your reward.</p></div>
        <img alt="Pixel pickaxe" className="h-12 w-12 object-contain [image-rendering:pixelated]" src={workAsset('pickaxe.png')} />
      </div>
      {status === 'idle' ? <StartJob icon={<Play size={16} />} onStart={start}>Start mining</StartJob> : null}
      {status !== 'idle' ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="grid grid-cols-6 gap-1 border border-cs-border bg-[#090d14] p-2" aria-label="Mining grid">
            {blocks.map((block) => {
              const mined = minedIds.has(block.id)
              const accessible = canMineBlock(block, minedIds)
              const damage = hits[block.id] ?? 0
              return <button aria-label={`${block.resource} block at depth ${block.row + 1}`} className={`relative aspect-square min-w-0 border p-1 transition ${mined ? 'border-cs-green/30 bg-cs-green/5 opacity-20' : accessible ? 'border-cs-border bg-cs-panel hover:-translate-y-0.5 hover:border-rarity-special' : 'cursor-not-allowed border-cs-border/40 bg-black/25 opacity-35'}`} disabled={status !== 'running' || mined || !accessible} key={block.id} onClick={() => mine(block.id)} type="button">
                <img alt="" className="h-full w-full object-contain [image-rendering:pixelated]" src={miningImages[block.resource]} />
                {!mined && damage > 0 ? <span className="absolute inset-x-1 bottom-1 h-1 bg-black/50"><i className="block h-full bg-rarity-special" style={{ width: `${damage / block.hardness * 100}%` }} /></span> : null}
              </button>
            })}
          </div>
          <aside className="grid content-start gap-2">
            <div className="border border-cs-border bg-cs-panel p-3"><p className="font-mono text-[10px] uppercase text-cs-muted">Swings remaining</p><p className="mt-1 font-mono text-2xl font-bold text-rarity-special">{actions}</p><p className="mt-1 text-xs text-cs-muted">Harder blocks need more hits.</p></div>
            <div className="grid grid-cols-2 gap-2">{(['coal', 'iron', 'gold', 'diamond'] as const).map((resource) => <div className="flex items-center gap-2 border border-cs-border bg-cs-panel p-2" key={resource}><img alt="" className="h-7 w-7 [image-rendering:pixelated]" src={miningImages[resource]} /><span className="font-mono text-xs uppercase text-cs-text">{resources[resource] ?? 0}</span></div>)}</div>
            <p className="font-mono text-xs uppercase text-cs-muted">Depth {deepestRow + 1}/7</p>
            {status === 'running' && minedIds.size > 0 ? <button className="min-h-10 border border-cs-border px-3 text-sm text-cs-text" onClick={() => complete(calculateMiningPerformance(resources, deepestRow))} type="button">Cash out safely</button> : null}
          </aside>
        </div>
      ) : null}
      {status === 'finished' ? <ResultBanner performance={performance} reward={reward} /> : null}
    </section>
  )
}

export function PackageDeliveryJob() {
  const { dispatch } = useGame()
  const [status, setStatus] = useState<'idle' | 'running' | 'finished'>('idle')
  const [position, setPosition] = useState<GridPoint>({ column: 0, row: 0 })
  const [packages, setPackages] = useState<Set<string>>(() => new Set(DELIVERY_PACKAGES))
  const [destinations, setDestinations] = useState<Set<string>>(() => new Set(DELIVERY_DESTINATIONS))
  const [carrying, setCarrying] = useState(0)
  const [delivered, setDelivered] = useState(0)
  const [moves, setMoves] = useState(0)
  const [feedback, setFeedback] = useState('Collect a parcel, then reach a beacon.')
  const [performance, setPerformance] = useState(0)
  const [deliveredFlash, setDeliveredFlash] = useState<string>()
  const completedRef = useRef(false)
  const gameRef = useRef<HTMLElement>(null)
  const reward = useRewardPreview('packageDelivery', performance)

  const complete = useCallback((nextDelivered: number, nextMoves: number) => {
    if (completedRef.current) return
    const score = calculateDeliveryPerformance(nextDelivered, nextMoves)
    completedRef.current = true
    setPerformance(score)
    setStatus('finished')
    dispatch({ type: 'COMPLETE_WORK_MINIGAME', gameId: 'packageDelivery', now: Date.now(), performance: score })
  }, [dispatch])

  const move = useCallback((direction: 'down' | 'left' | 'right' | 'up') => {
    if (status !== 'running' || completedRef.current) return
    const next = moveDeliveryPosition(position, direction)
    if (next.row === position.row && next.column === position.column) { setFeedback('Route blocked — choose another street.'); return }
    const key = pointKey(next)
    const nextMoves = moves + 1
    let nextCarrying = carrying
    let nextDelivered = delivered
    if (packages.has(key)) { const nextPackages = new Set(packages); nextPackages.delete(key); setPackages(nextPackages); nextCarrying += 1; setFeedback('Package collected.') }
    else if (destinations.has(key) && nextCarrying > 0) { const nextDestinations = new Set(destinations); nextDestinations.delete(key); setDestinations(nextDestinations); nextCarrying -= 1; nextDelivered += 1; setDeliveredFlash(key); window.setTimeout(() => setDeliveredFlash(undefined), 700); setFeedback('Delivery confirmed — target secured!') }
    else setFeedback('Keep moving.')
    setPosition(next); setMoves(nextMoves); setCarrying(nextCarrying); setDelivered(nextDelivered)
    if (nextDelivered >= DELIVERY_DESTINATIONS.length || nextMoves >= DELIVERY_MAX_MOVES) complete(nextDelivered, nextMoves)
  }, [carrying, complete, delivered, destinations, moves, packages, position, status])

  function start() {
    completedRef.current = false; setStatus('running'); setPosition({ column: 0, row: 0 }); setPackages(new Set(DELIVERY_PACKAGES)); setDestinations(new Set(DELIVERY_DESTINATIONS)); setCarrying(0); setDelivered(0); setMoves(0); setPerformance(0); setDeliveredFlash(undefined); setFeedback('Collect a parcel, then reach a green delivery target.'); window.requestAnimationFrame(() => gameRef.current?.focus())
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    const key = event.key.toLowerCase()
    const direction = key === 'arrowup' || key === 'w' ? 'up' : key === 'arrowdown' || key === 's' ? 'down' : key === 'arrowleft' || key === 'a' ? 'left' : key === 'arrowright' || key === 'd' ? 'right' : undefined
    if (!direction || status !== 'running') return
    event.preventDefault()
    move(direction)
  }

  return (
    <section data-testid="packageDelivery-game" onKeyDown={handleKeyDown} ref={gameRef} tabIndex={status === 'running' ? 0 : -1}>
      <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase text-rarity-special">Route planning · 15 minute cooldown</p><h3 className="mt-1 text-xl font-semibold text-cs-text">Package Delivery</h3><p className="mt-1 text-sm text-cs-muted">Collect both parcels and deliver them to the green targets in 22 moves. Use WASD, arrow keys, or touch controls while the game is focused.</p></div><Truck className="text-rarity-special" size={28} /></div>
      {status === 'idle' ? <StartJob icon={<Play size={16} />} onStart={start}>Start route</StartJob> : null}
      {status !== 'idle' ? <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="grid grid-cols-5 gap-1 border border-cs-border bg-[#0a0f16] p-2 focus-within:border-rarity-special" aria-label="Delivery map">{Array.from({ length: DELIVERY_GRID_SIZE * DELIVERY_GRID_SIZE }, (_, index) => { const point={ row: Math.floor(index / DELIVERY_GRID_SIZE), column: index % DELIVERY_GRID_SIZE }; const key=pointKey(point); const obstacle=DELIVERY_OBSTACLES.has(key); const occupied=point.row===position.row&&point.column===position.column; return <div className={`relative aspect-square overflow-hidden border ${obstacle ? 'border-rarity-covert/40 bg-rarity-covert/15' : 'border-cs-border bg-cover'}`} key={key} style={obstacle ? undefined : { backgroundImage: `url(${workAsset('road-tile.png')})` }}>{packages.has(key) ? <img alt="Waiting package" className="absolute inset-1 h-[calc(100%-0.5rem)] w-[calc(100%-0.5rem)] object-contain [image-rendering:pixelated]" src={workAsset('package.png')} /> : null}{destinations.has(key) ? <span aria-label="Delivery target" className="absolute inset-0.5 grid animate-pulse place-items-center border-2 border-cs-green bg-cs-green/35 text-white shadow-[inset_0_0_16px_rgb(var(--cs-green)/0.45),0_0_14px_rgb(var(--cs-green)/0.55)] motion-reduce:animate-none"><PackageCheck size={22} strokeWidth={3} /><span className="sr-only">Green delivery target</span></span> : null}{deliveredFlash === key ? <span className="absolute inset-0 z-20 grid place-items-center bg-cs-green/80 text-white"><CheckCircle2 size={28} /></span> : null}{occupied ? <img alt="Delivery vehicle" className="absolute inset-1 z-10 h-[calc(100%-0.5rem)] w-[calc(100%-0.5rem)] object-contain drop-shadow-lg" src={workAsset('delivery-van.png')} /> : null}</div> })}</div>
        <aside><div className="grid grid-cols-2 gap-2"><div className="border border-cs-border bg-cs-panel p-2"><p className="font-mono text-[10px] uppercase text-cs-muted">Moves</p><p className="font-mono text-lg text-cs-text">{moves}/{DELIVERY_MAX_MOVES}</p></div><div className="border border-cs-border bg-cs-panel p-2"><p className="font-mono text-[10px] uppercase text-cs-muted">Delivered</p><p className="font-mono text-lg text-cs-green">{delivered}/2</p></div></div><p aria-live="polite" className="mt-2 min-h-10 text-xs text-cs-muted">{feedback} {carrying ? `Carrying ${carrying}.` : ''}</p><div className="mx-auto mt-2 grid w-32 grid-cols-3 gap-1"><span /><button aria-label="Drive up" className="grid h-10 place-items-center border border-cs-border text-cs-text" disabled={status !== 'running'} onClick={() => move('up')} type="button"><ArrowUp size={18} /></button><span /><button aria-label="Drive left" className="grid h-10 place-items-center border border-cs-border text-cs-text" disabled={status !== 'running'} onClick={() => move('left')} type="button"><ArrowLeft size={18} /></button><button aria-label="Drive down" className="grid h-10 place-items-center border border-cs-border text-cs-text" disabled={status !== 'running'} onClick={() => move('down')} type="button"><ArrowDown size={18} /></button><button aria-label="Drive right" className="grid h-10 place-items-center border border-cs-border text-cs-text" disabled={status !== 'running'} onClick={() => move('right')} type="button"><ArrowRight size={18} /></button></div></aside>
      </div> : null}
      {status === 'finished' ? <ResultBanner performance={performance} reward={reward} /> : null}
    </section>
  )
}

export function WarehouseRushJob() {
  const { dispatch } = useGame()
  const [status, setStatus] = useState<'idle' | 'running' | 'finished'>('idle')
  const [items] = useState<WarehouseLane[]>(() => Array.from({ length: 10 }, () => warehouseLanes[Math.floor(Math.random() * warehouseLanes.length)]))
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [performance, setPerformance] = useState(0)
  const [drag, setDrag] = useState<{ pointerId: number; x: number; y: number }>()
  const completedRef = useRef(false)
  const settledIndexRef = useRef(-1)
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | undefined>(undefined)
  const boxRef = useRef<HTMLImageElement>(null)
  const reward = useRewardPreview('warehouseRush', performance)
  const current = items[index]

  const complete = useCallback((nextCorrect: number, nextMistakes: number) => {
    if (completedRef.current) return
    const score = calculateWarehousePerformance(nextCorrect, nextMistakes, 10)
    completedRef.current = true; setPerformance(score); setStatus('finished')
    dispatch({ type: 'COMPLETE_WORK_MINIGAME', gameId: 'warehouseRush', now: Date.now(), performance: score })
  }, [dispatch])

  const clearDrag = useCallback(() => {
    const active = dragRef.current
    if (active && boxRef.current?.hasPointerCapture(active.pointerId)) boxRef.current.releasePointerCapture(active.pointerId)
    dragRef.current = undefined
    setDrag(undefined)
  }, [])

  const settle = useCallback((lane?: WarehouseLane) => {
    if (status === 'finished' || completedRef.current || !current || settledIndexRef.current === index) return
    settledIndexRef.current = index
    clearDrag()
    if (status === 'idle') setStatus('running')
    const matched = lane === current
    const nextCorrect = correct + (matched ? 1 : 0)
    const nextMistakes = mistakes + (matched ? 0 : 1)
    setCorrect(nextCorrect); setMistakes(nextMistakes); setFeedback(matched ? 'Correct lane' : lane ? 'Wrong dock' : 'Package missed')
    if (index + 1 >= items.length) complete(nextCorrect, nextMistakes)
    else setIndex((value) => value + 1)
  }, [clearDrag, complete, correct, current, index, items.length, mistakes, status])

  useEffect(() => {
    if (status !== 'running' || !current) return
    const timeout = window.setTimeout(() => settle(undefined), Math.max(850, 1_750 - index * 75))
    return () => window.clearTimeout(timeout)
  }, [current, index, settle, status])

  useEffect(() => {
    if (status === 'finished') return
    const onKeyDown = (event: KeyboardEvent) => { const lane = warehouseLanes[Number(event.key) - 1]; if (lane && !event.repeat) { event.preventDefault(); settle(lane) } }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [settle, status])

  useEffect(() => {
    const cancel = () => clearDrag()
    window.addEventListener('blur', cancel)
    return () => window.removeEventListener('blur', cancel)
  }, [clearDrag])

  function pointerDown(event: ReactPointerEvent<HTMLImageElement>) {
    if (status === 'finished' || dragRef.current || settledIndexRef.current === index) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const next = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    dragRef.current = next
    setDrag(next)
    if (status === 'idle') setStatus('running')
  }

  function pointerMove(event: ReactPointerEvent<HTMLImageElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    const next = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    dragRef.current = next
    setDrag(next)
  }

  function pointerEnd(event: ReactPointerEvent<HTMLImageElement>, cancelled = false) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    const target = cancelled ? null : document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-warehouse-lane]')
    const lane = warehouseLanes.find((entry) => entry === target?.dataset.warehouseLane)
    clearDrag()
    if (cancelled) setFeedback('Drag cancelled. Try again.')
    else if (lane) settle(lane)
    else setFeedback('Drop a box on a colored bin.')
  }

  return (
    <section data-testid="warehouseRush-game">
      <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase text-rarity-special">Timed sorting · 18 minute cooldown</p><h3 className="mt-1 text-xl font-semibold text-cs-text">Warehouse Rush</h3><p className="mt-1 text-sm text-cs-muted">Drag each moving box into the matching color bin, tap a bin, or press its number (1–4). Correct bins score points; wrong bins and boxes that reach the end count as mistakes. The round starts with your first action and ends after ten boxes.</p></div><Warehouse className="text-rarity-special" size={28} /></div>
      {status !== 'finished' ? <div className="mt-3 border border-cs-border bg-[#0a0f16] p-3"><div className="flex items-center justify-between font-mono text-xs uppercase text-cs-muted"><span>Package {Math.min(index + 1, 10)}/10</span><span>{correct} correct · {mistakes} missed</span></div><div className="relative mt-3 flex h-28 items-center justify-center overflow-hidden border border-cs-border bg-cs-panel work-conveyor"><div className="absolute inset-x-0 bottom-0 h-7 bg-repeat-x [image-rendering:pixelated]" style={{ backgroundImage: `url(${workAsset('conveyor-horizontal.png')})`, backgroundSize: '32px 32px' }} />{current ? <img alt={`${current} package`} className={`relative z-10 h-20 w-20 cursor-grab touch-none select-none object-contain [image-rendering:pixelated] ${status === 'running' && !drag ? 'work-package-arrival' : ''} ${drag ? 'opacity-35' : ''}`} draggable={false} key={index} onPointerCancel={(event) => pointerEnd(event, true)} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} ref={boxRef} src={crateImages[current]} /> : null}</div><p aria-live="polite" className="mt-2 min-h-5 text-center text-xs font-semibold text-cs-green">{feedback || (status === 'idle' ? 'Pick up the box or choose a bin to begin.' : 'Sort the next box.')}</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{warehouseLanes.map((lane, laneIndex) => <button aria-label={`Sort into ${lane} dock`} className={`flex min-h-20 min-w-0 items-center justify-center gap-2 border bg-cs-panel px-2 text-xs font-semibold uppercase text-cs-text transition ${drag ? 'border-rarity-special bg-rarity-special/10' : 'border-cs-border hover:border-rarity-special'}`} data-warehouse-lane={lane} key={lane} onClick={() => { if (!dragRef.current) settle(lane) }} type="button"><span className="font-mono text-rarity-special">{laneIndex + 1}</span><img alt="" className="h-10 w-10 object-contain [image-rendering:pixelated]" src={dockImages[lane]} /><span className="truncate">{lane}</span></button>)}</div></div> : null}
      {drag && current ? <img alt="" aria-hidden="true" className="pointer-events-none fixed z-[100] h-20 w-20 -translate-x-1/2 -translate-y-1/2 object-contain opacity-90 drop-shadow-xl [image-rendering:pixelated]" src={crateImages[current]} style={{ left: drag.x, top: drag.y }} /> : null}
      {status === 'finished' ? <ResultBanner performance={performance} reward={reward} /> : null}
    </section>
  )
}

const circuitPortClasses = {
  n: 'left-1/2 top-0 h-1/2 w-2 -translate-x-1/2',
  e: 'right-0 top-1/2 h-2 w-1/2 -translate-y-1/2',
  s: 'bottom-0 left-1/2 h-1/2 w-2 -translate-x-1/2',
  w: 'left-0 top-1/2 h-2 w-1/2 -translate-y-1/2',
} as const

export function CircuitRepairJob() {
  const { dispatch } = useGame()
  const [status, setStatus] = useState<'idle' | 'running' | 'finished'>('idle')
  const [pieces, setPieces] = useState(() => createCircuitPuzzle(1))
  const [moves, setMoves] = useState(0)
  const [performance, setPerformance] = useState(0)
  const [selectedId, setSelectedId] = useState<string>()
  const [hintId, setHintId] = useState<string>()
  const [feedback, setFeedback] = useState('Connect every tile from INPUT to OUTPUT.')
  const completedRef = useRef(false)
  const reward = useRewardPreview('circuitRepair', performance)
  const solved = useMemo(() => isCircuitSolved(pieces), [pieces])
  const poweredIds = useMemo(() => getPoweredCircuitIds(pieces), [pieces])

  const complete = useCallback((score: number) => {
    if (completedRef.current) return
    completedRef.current = true; setPerformance(score); setStatus('finished')
    dispatch({ type: 'COMPLETE_WORK_MINIGAME', gameId: 'circuitRepair', now: Date.now(), performance: score })
  }, [dispatch])

  function start() { completedRef.current = false; setPieces(createCircuitPuzzle(Math.floor(Math.random() * 0xffff_ffff))); setMoves(0); setPerformance(0); setSelectedId(undefined); setHintId(undefined); setFeedback('Power starts at INPUT. Rotate tiles to extend the bright path.'); setStatus('running') }
  function rotate(id: string) {
    if (status !== 'running') return
    const nextMoves = moves + 1
    const nextPieces = pieces.map((piece) => piece.id === id ? { ...piece, rotation: (piece.rotation + 1) % 4 } : piece)
    setPieces(nextPieces); setMoves(nextMoves); setSelectedId(id); setHintId(undefined)
    const nextPoweredCount = getPoweredCircuitIds(nextPieces).size
    setFeedback(`Power reaches ${nextPoweredCount} of ${nextPieces.length} tiles.`)
    if (isCircuitSolved(nextPieces)) { setFeedback('Circuit stable — output powered!'); complete(calculateCircuitPerformance(nextMoves)) }
    else if (nextMoves >= 24) { setFeedback('Move limit reached. The circuit remains offline.'); complete(0) }
  }

  function showHint() {
    if (status !== 'running') return
    const hint = getCircuitHint(pieces)
    if (!hint) { setFeedback('All tile orientations are correct—trace the powered path.'); return }
    setHintId(hint.id)
    setSelectedId(hint.id)
    setFeedback(`Hint: rotate the highlighted tile at row ${hint.row + 1}, column ${hint.column + 1}.`)
  }

  return (
    <section data-testid="circuitRepair-game">
      <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase text-rarity-special">Logic puzzle · 18 minute cooldown</p><h3 className="mt-1 text-xl font-semibold text-cs-text">Circuit Repair</h3><p className="mt-1 text-sm text-cs-muted">Rotate components to carry power from the amber input to the green output. Finish within 24 moves; fewer rotations score higher.</p></div><CircuitBoard className="text-rarity-special" size={28} /></div>
      {status === 'idle' ? <StartJob icon={<Play size={16} />} onStart={start}>Start repair</StartJob> : null}
      {status !== 'idle' ? <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]"><div><div className="mb-2 flex items-center justify-between gap-2 font-mono text-[10px] font-bold uppercase"><span className="border border-rarity-special bg-rarity-special/15 px-2 py-1 text-rarity-special">Input</span><span className="text-cs-muted">Follow the bright path</span><span className="border border-cs-green bg-cs-green/15 px-2 py-1 text-cs-green">Output</span></div><div className={`relative grid grid-cols-4 gap-2 border p-3 ${solved ? 'border-cs-green bg-cs-green/10 shadow-[0_0_28px_rgb(var(--cs-green)/0.2)]' : 'border-cs-border bg-[#08101a]'}`}><span className="absolute -left-2 top-[14%] h-2 w-4 bg-rarity-special shadow-glow" /><span className="absolute -right-2 bottom-[14%] h-2 w-4 bg-cs-green shadow-[0_0_12px_rgb(var(--cs-green))]" />{pieces.map((piece) => { const powered=poweredIds.has(piece.id); const selected=selectedId===piece.id; const hinted=hintId===piece.id; return <button aria-label={`Rotate circuit tile row ${piece.row + 1}, column ${piece.column + 1}${powered ? ', powered' : ', unpowered'}`} aria-pressed={selected} className={`relative aspect-square min-w-0 overflow-hidden border-2 bg-cs-panel transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-rarity-special ${hinted ? 'animate-pulse border-cs-amber shadow-[0_0_18px_rgb(var(--cs-amber)/0.45)] motion-reduce:animate-none' : selected ? 'border-rarity-special' : powered ? 'border-cs-green/80' : 'border-cs-border hover:border-rarity-special'}`} disabled={status !== 'running'} key={piece.id} onClick={() => rotate(piece.id)} type="button">{getCircuitConnections(piece).map((direction) => <span className={`absolute ${circuitPortClasses[direction]} ${powered ? 'bg-cs-green shadow-[0_0_10px_rgb(var(--cs-green))]' : 'bg-cs-muted/65'}`} key={direction} />)}<span className={`absolute left-1/2 top-1/2 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border ${powered ? 'border-cs-green bg-cs-green text-[#06120b]' : 'border-cs-muted bg-cs-surface text-cs-muted'}`}><RotateCw size={12} /></span></button> })}</div><p aria-live="polite" className={`mt-2 min-h-6 text-sm font-semibold ${solved ? 'text-cs-green' : 'text-cs-muted'}`}>{feedback}</p></div><aside className="grid content-start gap-2"><div className="border border-cs-border bg-cs-panel p-3"><p className="font-mono text-[10px] uppercase text-cs-muted">Rotations</p><p className="mt-1 font-mono text-2xl text-rarity-special">{moves}/24</p></div><div className="border border-cs-border bg-cs-panel p-3"><p className="font-mono text-[10px] uppercase text-cs-muted">Powered tiles</p><p className="mt-1 font-mono text-lg text-cs-green">{poweredIds.size}/{pieces.length}</p></div><button className="inline-flex min-h-10 items-center justify-center gap-2 border border-cs-amber/70 px-3 text-sm font-semibold text-cs-amber transition hover:bg-cs-amber/10 disabled:opacity-50" disabled={status !== 'running'} onClick={showHint} type="button"><CircuitBoard size={15} /> Hint</button><p className="text-xs leading-5 text-cs-muted">Click a tile, or focus it and press Enter/Space, to rotate clockwise.</p></aside></div> : null}
      {status === 'finished' ? <ResultBanner performance={performance} reward={reward} /> : null}
    </section>
  )
}
