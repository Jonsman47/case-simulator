import { Box, BrainCircuit, Check, Clock3, Crosshair, Play, RotateCcw, Sparkles, Target, Trash2, Trophy } from 'lucide-react'
import { Component, useCallback, useEffect, useRef, useState, type DragEvent, type ReactElement, type ReactNode } from 'react'
import { getSkillMinigameRewardMultiplier } from '../data/skills'
import { getClickIncomeMultiplier } from '../data/upgrades'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'
import { writePoopCleanupLastCompleted } from '../utils/poopCleanupMinigame'
import { formatWorkCooldown, getWorkBaseReward, getWorkMiniGameCooldownRemaining, type WorkMiniGameId } from '../utils/workMinigames'

const poopIds = ['left', 'center', 'right'] as const
const boxIds = ['red', 'blue', 'green', 'yellow'] as const
const memoryPadLabels = ['Amber', 'Cyan', 'Violet', 'Green'] as const
const precisionAttempts = 5
const memoryRoundLengths = [3, 4, 5] as const
type SortBoxId = (typeof boxIds)[number]

const sortBoxStyles: Record<SortBoxId, { box: string; container: string; sorted: string }> = {
  blue: { box: 'border-blue-200 bg-blue-600 text-white', container: 'border-blue-300 bg-blue-500/15 text-blue-100', sorted: 'border-blue-200 bg-blue-600 text-white' },
  green: { box: 'border-emerald-200 bg-emerald-600 text-white', container: 'border-emerald-300 bg-emerald-500/15 text-emerald-100', sorted: 'border-emerald-200 bg-emerald-600 text-white' },
  red: { box: 'border-red-200 bg-red-600 text-white', container: 'border-red-300 bg-red-500/15 text-red-100', sorted: 'border-red-200 bg-red-600 text-white' },
  yellow: { box: 'border-yellow-200 bg-yellow-400 text-slate-950', container: 'border-yellow-300 bg-yellow-400/15 text-yellow-100', sorted: 'border-yellow-200 bg-yellow-400 text-slate-950' },
}

const memoryPadStyles = [
  'border-amber-300 bg-amber-400/15 text-amber-100',
  'border-cyan-300 bg-cyan-400/15 text-cyan-100',
  'border-violet-300 bg-violet-400/15 text-violet-100',
  'border-emerald-300 bg-emerald-400/15 text-emerald-100',
] as const

function getRewardMultiplier(upgrades: Parameters<typeof getClickIncomeMultiplier>[0], learnedSkillNodeIds: Parameters<typeof getSkillMinigameRewardMultiplier>[0]) {
  return getClickIncomeMultiplier(upgrades) * getSkillMinigameRewardMultiplier(learnedSkillNodeIds)
}

function getCurrentTimestamp() {
  return Date.now()
}

function formatWorkReward(value: number) {
  return formatCurrency(value).replace(/\.00$/, '')
}

function shuffle<T>(values: readonly T[]) {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

function playWorkTone(enabled: boolean, volume: number, kind: 'good' | 'perfect' | 'miss') {
  if (!enabled || typeof AudioContext === 'undefined') return
  try {
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = kind === 'perfect' ? 880 : kind === 'good' ? 620 : 180
    gain.gain.value = Math.min(0.12, Math.max(0.02, volume * 0.1))
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + (kind === 'miss' ? 0.12 : 0.08))
    oscillator.addEventListener('ended', () => void context.close(), { once: true })
  } catch {
    // Optional audio feedback must not interrupt a completed job.
  }
}

export function WorkView() {
  return (
    <section className="grid w-full min-w-0 gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-l-4 border-cs-green pl-4">
        <div>
          <p className="font-mono text-xs uppercase text-cs-green">Skill Jobs</p>
          <h2 className="mt-1 text-3xl font-semibold text-cs-text">Work</h2>
          <p className="mt-2 max-w-2xl text-sm text-cs-muted">Short, cooldown-limited jobs for early-game cash. Better play improves skill-job rewards within a fixed safe cap.</p>
        </div>
        <div className="inline-flex items-center gap-2 border border-cs-border bg-cs-panel px-3 py-2 font-mono text-xs uppercase text-cs-muted"><Trophy size={15} /> Four available jobs</div>
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <WorkJobErrorBoundary title="Poop Cleaning"><PoopCleaningJob /></WorkJobErrorBoundary>
        <WorkJobErrorBoundary title="Sort Boxes"><SortBoxesJob /></WorkJobErrorBoundary>
        <WorkJobErrorBoundary title="Precision Strike"><PrecisionStrikeJob /></WorkJobErrorBoundary>
        <WorkJobErrorBoundary title="Memory Circuit"><MemoryCircuitJob /></WorkJobErrorBoundary>
      </div>
    </section>
  )
}

class WorkJobErrorBoundary extends Component<{ children: ReactNode; title: string }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (!this.state.hasError) return this.props.children
    return <section className="border border-rarity-covert bg-cs-surface p-4"><h3 className="text-xl font-semibold text-cs-text">{this.props.title}</h3><p className="mt-2 text-sm text-cs-muted">This job hit a problem. No reward or cooldown was applied.</p><button className="mt-3 inline-flex min-h-11 items-center gap-2 border border-cs-border px-3 text-sm font-semibold text-cs-text hover:border-rarity-special" onClick={() => this.setState({ hasError: false })} type="button"><RotateCcw size={16} /> Reset job</button></section>
  }
}

function JobFrame({ children, description, gameId, icon, instructions, onReset, title }: { children: (isOnCooldown: boolean) => ReactElement; description: string; gameId: WorkMiniGameId; icon: ReactNode; instructions: string; onReset: () => void; title: string }) {
  const { state } = useGame()
  const [now, setNow] = useState(() => Date.now())
  const cooldownRemaining = getWorkMiniGameCooldownRemaining(gameId, now, state.workMiniGameCooldowns)
  const isOnCooldown = cooldownRemaining > 0
  const wasOnCooldownRef = useRef(isOnCooldown)
  const economyMultiplier = getRewardMultiplier(state.upgrades, state.learnedSkillNodeIds)
  const rewardMin = getWorkBaseReward(gameId, 0) * economyMultiplier
  const rewardMax = getWorkBaseReward(gameId, 1) * economyMultiplier

  useEffect(() => {
    if (!isOnCooldown) return
    const intervalId = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(intervalId)
  }, [isOnCooldown])
  useEffect(() => { if (wasOnCooldownRef.current && !isOnCooldown) onReset(); wasOnCooldownRef.current = isOnCooldown }, [isOnCooldown, onReset])

  return <section className="min-w-0 border border-cs-border bg-cs-surface p-4 shadow-[0_14px_40px_rgb(0_0_0_/_0.18)]">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center border border-cs-border bg-cs-panel text-rarity-special">{icon}</span><div className="min-w-0"><p className="font-mono text-[10px] uppercase tracking-wide text-cs-muted">{description}</p><h3 className="mt-1 text-xl font-semibold text-cs-text">{title}</h3></div></div><div className="shrink-0 border border-cs-border bg-cs-panel px-3 py-2 text-right"><p className="font-mono text-[10px] uppercase text-cs-muted">Reward</p><p className="mt-1 whitespace-nowrap font-mono text-sm font-semibold text-cs-green">+{formatWorkReward(rewardMin)}{rewardMax !== rewardMin ? `–${formatWorkReward(rewardMax)}` : ''}</p></div></div>
    <p className="mt-3 text-sm leading-6 text-cs-muted">{instructions}</p>
    {isOnCooldown ? <div className="mt-4 flex min-h-24 items-center justify-between gap-4 border border-cs-border bg-cs-panel px-4 py-4"><div><p className="font-mono text-[10px] uppercase text-cs-muted">Available in</p><p className="mt-1 font-mono text-xl font-semibold text-cs-text">{formatWorkCooldown(cooldownRemaining)}</p></div><Clock3 className="text-cs-muted" size={28} /></div> : children(isOnCooldown)}
  </section>
}

function PoopCleaningJob() {
  const [cleanedIds, setCleanedIds] = useState<Set<string>>(() => new Set())
  const [successMessage, setSuccessMessage] = useState<string>()
  const [errorMessage, setErrorMessage] = useState<string>()
  const completedRef = useRef(false)
  const { dispatch, state } = useGame()
  const reset = useCallback(() => { completedRef.current = false; setCleanedIds(new Set()); setErrorMessage(undefined); setSuccessMessage(undefined) }, [])
  function cleanPoop(poopId: string) {
    if (completedRef.current || cleanedIds.has(poopId)) return
    const nextIds = new Set(cleanedIds); nextIds.add(poopId); setCleanedIds(nextIds)
    if (nextIds.size !== poopIds.length) return
    const completedAt = getCurrentTimestamp(); completedRef.current = true
    try { writePoopCleanupLastCompleted(completedAt); dispatch({ type: 'COMPLETE_WORK_MINIGAME', gameId: 'poopCleaning', now: completedAt }); setSuccessMessage(`Yard cleared. +${formatWorkReward(getWorkBaseReward('poopCleaning') * getRewardMultiplier(state.upgrades, state.learnedSkillNodeIds))}`) }
    catch { completedRef.current = false; setErrorMessage('Poop Cleaning hit a problem. No reward or cooldown was applied.') }
  }
  return <JobFrame description="3 targets · 3 minute cooldown" gameId="poopCleaning" icon={<Trash2 size={20} />} instructions="Clear each marked pile. Large targets and keyboard focus make the rescue job usable with mouse, touch, or keyboard." onReset={reset} title="Poop Cleaning">{() => <><div aria-label="Poop cleaning grass field" className="mt-4 grid min-h-52 grid-cols-3 items-end gap-3 overflow-hidden border border-cs-border bg-[linear-gradient(135deg,rgb(44_122_72)_0_25%,rgb(35_104_64)_25%_50%,rgb(44_122_72)_50%_75%,rgb(35_104_64)_75%)] bg-[length:46px_46px] p-4 sm:gap-6">{poopIds.map((poopId, index) => { const isCleaned = cleanedIds.has(poopId); return <button aria-label={`Clean poop ${index + 1}`} className={`grid min-h-24 min-w-0 place-items-center border p-2 transition-all ${isCleaned ? 'border-cs-green bg-cs-green/20 text-cs-green' : 'border-cs-border bg-cs-panel/95 shadow-glow hover:-translate-y-1 hover:border-cs-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-cs-green'}`} disabled={isCleaned} key={poopId} onClick={() => cleanPoop(poopId)} type="button">{isCleaned ? <Check size={28} /> : <PoopPileIcon />}</button> })}</div><ProgressFooter errorMessage={errorMessage} progressLabel={`${cleanedIds.size} / ${poopIds.length} cleared`} successMessage={successMessage} /></>}</JobFrame>
}

function SortBoxesJob() {
  const { dispatch, state } = useGame()
  const [isStarted, setIsStarted] = useState(false)
  const [boxOrder, setBoxOrder] = useState<SortBoxId[]>([...boxIds])
  const [binOrder, setBinOrder] = useState<SortBoxId[]>([...boxIds])
  const [selectedBox, setSelectedBox] = useState<SortBoxId>()
  const [sortedIds, setSortedIds] = useState<Set<SortBoxId>>(() => new Set())
  const [successMessage, setSuccessMessage] = useState<string>()
  const [errorMessage, setErrorMessage] = useState<string>()
  const completedRef = useRef(false)
  const reset = useCallback(() => { completedRef.current = false; setIsStarted(false); setSelectedBox(undefined); setSortedIds(new Set()); setErrorMessage(undefined); setSuccessMessage(undefined) }, [])
  function startRound() { setBoxOrder(shuffle(boxIds)); setBinOrder(shuffle(boxIds)); setSelectedBox(undefined); setSortedIds(new Set()); setErrorMessage(undefined); setSuccessMessage(undefined); setIsStarted(true) }
  function dropBox(boxId: SortBoxId, containerId: SortBoxId) {
    if (completedRef.current || sortedIds.has(boxId)) return
    if (boxId !== containerId) { setSelectedBox(undefined); setErrorMessage('Wrong bin — match the color label and try again.'); return }
    const nextIds = new Set(sortedIds); nextIds.add(boxId); setSortedIds(nextIds); setSelectedBox(undefined); setErrorMessage(undefined)
    if (nextIds.size !== boxIds.length) return
    const completedAt = getCurrentTimestamp(); completedRef.current = true
    try { dispatch({ type: 'COMPLETE_WORK_MINIGAME', gameId: 'sortBoxes', now: completedAt }); setSuccessMessage(`All four boxes sorted. +${formatWorkReward(getWorkBaseReward('sortBoxes') * getRewardMultiplier(state.upgrades, state.learnedSkillNodeIds))}`) }
    catch { completedRef.current = false; setErrorMessage('Sort Boxes hit a problem. No reward or cooldown was applied.') }
  }
  function onDrop(event: DragEvent<HTMLButtonElement>, containerId: SortBoxId) { event.preventDefault(); const id = getSortBoxId(event.dataTransfer.getData('text/plain')) ?? selectedBox; if (id) dropBox(id, containerId) }
  return <JobFrame description="Color matching · 20 minute cooldown" gameId="sortBoxes" icon={<Box size={20} />} instructions="Drag a crate to its matching dock, or select a crate and activate a dock. The orders change each run." onReset={reset} title="Sort Boxes">{() => <>{!isStarted ? <StartPanel action="Start Sort Boxes" icon={<Play size={16} />} onStart={startRound} text="Four crates, four clearly separated docks. Wrong matches return safely." /> : <div className="mt-4 grid gap-4 border border-cs-border bg-cs-bg p-3 sm:p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-mono text-[10px] uppercase text-cs-muted">Unsorted crates</p><button className="min-h-10 border border-cs-border px-3 text-xs font-semibold uppercase text-cs-text hover:border-rarity-special" onClick={() => setIsStarted(false)} type="button">Close job</button></div><div aria-label="Sort Boxes crates" className="grid grid-cols-2 gap-3 sm:grid-cols-4">{boxOrder.map((boxId) => <button aria-label={`${capitalize(boxId)} box`} className={`grid min-h-20 min-w-0 place-items-center border-2 px-2 font-mono text-xs font-bold uppercase transition ${sortedIds.has(boxId) ? 'pointer-events-none scale-95 opacity-25' : 'hover:-translate-y-1'} ${selectedBox === boxId ? 'ring-2 ring-rarity-special ring-offset-2 ring-offset-cs-bg' : ''} ${sortBoxStyles[boxId].box}`} data-position-key={`box-${boxOrder.indexOf(boxId)}`} draggable={!sortedIds.has(boxId)} key={boxId} onClick={() => { if (!sortedIds.has(boxId)) { setSelectedBox(boxId); setErrorMessage(undefined) } }} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', boxId); setSelectedBox(boxId) }} type="button">{sortedIds.has(boxId) ? <Check size={20} /> : `${boxId} crate`}</button>)}</div><div className="h-px bg-cs-border" /><p className="font-mono text-[10px] uppercase text-cs-muted">Loading docks</p><div aria-label="Sort Boxes sorting area" className="grid grid-cols-2 gap-3 sm:grid-cols-4">{binOrder.map((boxId) => <button aria-label={`${capitalize(boxId)} container`} className={`grid min-h-24 min-w-0 place-items-center border-2 border-dashed p-2 text-center font-mono text-xs font-bold uppercase transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rarity-special ${selectedBox && selectedBox !== boxId ? 'opacity-70' : ''} ${sortBoxStyles[boxId].container}`} data-position-key={`container-${binOrder.indexOf(boxId)}`} key={boxId} onClick={() => { if (selectedBox) dropBox(selectedBox, boxId) }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, boxId)} type="button">{sortedIds.has(boxId) ? <span className={`inline-flex items-center gap-1 border px-2 py-2 ${sortBoxStyles[boxId].sorted}`}><Check size={14} /> loaded</span> : `${boxId} dock`}</button>)}</div></div>}<ProgressFooter errorMessage={errorMessage} progressLabel={`Sorted ${sortedIds.size}/${boxIds.length}`} successMessage={successMessage} /></>}</JobFrame>
}

function PrecisionStrikeJob() {
  const { dispatch, state } = useGame()
  const [status, setStatus] = useState<'idle' | 'running' | 'finished'>('idle')
  const [attempt, setAttempt] = useState(0)
  const [indicator, setIndicator] = useState(0)
  const [target, setTarget] = useState(50)
  const [scores, setScores] = useState<number[]>([])
  const [feedback, setFeedback] = useState('')
  const positionRef = useRef(0); const directionRef = useRef(1); const lastFrameRef = useRef(0); const frameRef = useRef<number | undefined>(undefined); const completedRef = useRef(false)
  const reset = useCallback(() => { completedRef.current = false; setStatus('idle'); setAttempt(0); setIndicator(0); setScores([]); setFeedback('') }, [])
  const finishAttempt = useCallback(() => {
    if (status !== 'running' || completedRef.current) return
    const distance = Math.abs(positionRef.current - target)
    const score = distance <= 3 ? 1 : distance <= 10 ? 0.65 : Math.max(0, 0.28 - distance / 100)
    playWorkTone(state.settings.soundEnabled, state.settings.soundVolume, distance <= 3 ? 'perfect' : distance <= 10 ? 'good' : 'miss')
    const nextScores = [...scores, score]; setScores(nextScores); setFeedback(distance <= 3 ? 'Perfect!' : distance <= 10 ? 'Good hit' : 'Miss')
    if (attempt + 1 >= precisionAttempts) { const performance = nextScores.reduce((sum, value) => sum + value, 0) / precisionAttempts; completedRef.current = true; setStatus('finished'); dispatch({ type: 'COMPLETE_WORK_MINIGAME', gameId: 'precisionStrike', now: getCurrentTimestamp(), performance }); return }
    setAttempt((value) => value + 1); setTarget(18 + Math.random() * 64); positionRef.current = Math.random() > 0.5 ? 0 : 100; directionRef.current = positionRef.current === 0 ? 1 : -1; setIndicator(positionRef.current)
  }, [attempt, dispatch, scores, state.settings.soundEnabled, state.settings.soundVolume, status, target])
  useEffect(() => {
    if (status !== 'running') return
    lastFrameRef.current = performance.now()
    const tick = (timestamp: number) => { const delta = Math.min(40, timestamp - lastFrameRef.current); lastFrameRef.current = timestamp; let next = positionRef.current + directionRef.current * delta * (0.05 + attempt * 0.006); if (next >= 100) { next = 100; directionRef.current = -1 } else if (next <= 0) { next = 0; directionRef.current = 1 } positionRef.current = next; setIndicator(next); frameRef.current = window.requestAnimationFrame(tick) }
    frameRef.current = window.requestAnimationFrame(tick); return () => { if (frameRef.current) window.cancelAnimationFrame(frameRef.current) }
  }, [attempt, status])
  useEffect(() => { if (status !== 'running') return; const onKeyDown = (event: KeyboardEvent) => { if (event.code === 'Space' && !event.repeat) { event.preventDefault(); finishAttempt() } }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown) }, [finishAttempt, status])
  function start() { completedRef.current = false; positionRef.current = 0; directionRef.current = 1; setIndicator(0); setTarget(18 + Math.random() * 64); setAttempt(0); setScores([]); setFeedback(''); setStatus('running') }
  const performanceScore = scores.length ? scores.reduce((sum, value) => sum + value, 0) / precisionAttempts : 0
  const reward = getWorkBaseReward('precisionStrike', performanceScore) * getRewardMultiplier(state.upgrades, state.learnedSkillNodeIds)
  return <JobFrame description="Reflex timing · 8 minute cooldown" gameId="precisionStrike" icon={<Crosshair size={20} />} instructions="Stop the moving marker inside the target. The small bright center is perfect; the larger zone is good. Five attempts get progressively faster." onReset={reset} title="Precision Strike">{() => status === 'idle' ? <StartPanel action="Start Precision Strike" icon={<Target size={16} />} onStart={start} text="Press Space, click, or tap. The target moves to a new random position every attempt." /> : <div className="mt-4 border border-cs-border bg-cs-bg p-4"><div className="flex items-center justify-between gap-3 font-mono text-xs uppercase text-cs-muted"><span>Attempt {Math.min(attempt + 1, precisionAttempts)} / {precisionAttempts}</span><span>{feedback || 'Track the marker'}</span></div><button aria-label="Stop precision marker" className="relative mt-5 block h-20 w-full overflow-hidden border border-cs-border bg-cs-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-rarity-special" disabled={status === 'finished'} onClick={finishAttempt} type="button"><span className="absolute inset-y-0 w-[20%] -translate-x-1/2 bg-cs-green/15" style={{ left: `${target}%` }} /><span className="absolute inset-y-0 w-[6%] -translate-x-1/2 bg-rarity-special/40 shadow-glow" style={{ left: `${target}%` }} /><span className="absolute inset-y-0 w-1 -translate-x-1/2 bg-white shadow-[0_0_12px_white]" style={{ left: `${indicator}%` }} /></button><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-1" aria-label="Precision attempt scores">{Array.from({ length: precisionAttempts }, (_, index) => <span className={`h-2 w-10 ${scores[index] === undefined ? 'bg-cs-border' : scores[index] >= 1 ? 'bg-rarity-special' : scores[index] >= 0.65 ? 'bg-cs-green' : 'bg-rarity-covert'}`} key={index} />)}</div>{status === 'finished' ? <p className="font-mono text-sm font-semibold text-cs-green">Score {Math.round(performanceScore * 100)}% · +{formatWorkReward(reward)}</p> : <span className="text-xs text-cs-muted">Space / click / tap</span>}</div></div>}</JobFrame>
}

function MemoryCircuitJob() {
  const { dispatch, state } = useGame()
  const [phase, setPhase] = useState<'idle' | 'showing' | 'input' | 'finished'>('idle')
  const [round, setRound] = useState(0); const [sequence, setSequence] = useState<number[]>([]); const [displayIndex, setDisplayIndex] = useState(0); const [inputIndex, setInputIndex] = useState(0); const [litPad, setLitPad] = useState<number>(); const [earnedSteps, setEarnedSteps] = useState(0); const [feedback, setFeedback] = useState(''); const completedRef = useRef(false)
  const totalSteps = memoryRoundLengths.reduce((sum, value) => sum + value, 0)
  const reset = useCallback(() => { completedRef.current = false; setPhase('idle'); setRound(0); setSequence([]); setDisplayIndex(0); setInputIndex(0); setLitPad(undefined); setEarnedSteps(0); setFeedback('') }, [])
  const beginRound = useCallback((nextRound: number) => { const nextSequence = Array.from({ length: memoryRoundLengths[nextRound] }, () => Math.floor(Math.random() * memoryPadLabels.length)); setRound(nextRound); setSequence(nextSequence); setDisplayIndex(0); setInputIndex(0); setLitPad(nextSequence[0]); setFeedback('Watch the sequence'); setPhase('showing') }, [])
  useEffect(() => { if (phase !== 'showing' || sequence.length === 0) return; const timeout = window.setTimeout(() => { const nextIndex = displayIndex + 1; if (nextIndex >= sequence.length) { setLitPad(undefined); setFeedback('Repeat it'); setPhase('input') } else { setLitPad(sequence[nextIndex]); setDisplayIndex(nextIndex) } }, 520); return () => window.clearTimeout(timeout) }, [displayIndex, phase, sequence])
  const finishGame = useCallback((finalSteps: number) => { if (completedRef.current) return; const performance = finalSteps / totalSteps; completedRef.current = true; setPhase('finished'); setFeedback(`${Math.round(performance * 100)}% recall`); dispatch({ type: 'COMPLETE_WORK_MINIGAME', gameId: 'memoryCircuit', now: getCurrentTimestamp(), performance }) }, [dispatch, totalSteps])
  const choosePad = useCallback((pad: number) => {
    if (phase !== 'input' || completedRef.current) return
    setLitPad(pad); window.setTimeout(() => setLitPad(undefined), 140)
    if (pad !== sequence[inputIndex]) { playWorkTone(state.settings.soundEnabled, state.settings.soundVolume, 'miss'); setFeedback('Sequence broken'); if (round + 1 >= memoryRoundLengths.length) finishGame(earnedSteps); else window.setTimeout(() => beginRound(round + 1), 450); return }
    const nextSteps = earnedSteps + 1; setEarnedSteps(nextSteps); playWorkTone(state.settings.soundEnabled, state.settings.soundVolume, 'good')
    if (inputIndex + 1 >= sequence.length) { setFeedback('Circuit complete'); if (round + 1 >= memoryRoundLengths.length) finishGame(nextSteps); else window.setTimeout(() => beginRound(round + 1), 450) } else setInputIndex((value) => value + 1)
  }, [beginRound, earnedSteps, finishGame, inputIndex, phase, round, sequence, state.settings.soundEnabled, state.settings.soundVolume])
  useEffect(() => { if (phase !== 'input') return; const onKeyDown = (event: KeyboardEvent) => { const pad = Number(event.key) - 1; if (pad >= 0 && pad < 4) choosePad(pad) }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown) }, [choosePad, phase])
  const performanceScore = earnedSteps / totalSteps
  const reward = getWorkBaseReward('memoryCircuit', performanceScore) * getRewardMultiplier(state.upgrades, state.learnedSkillNodeIds)
  return <JobFrame description="Memory sequence · 15 minute cooldown" gameId="memoryCircuit" icon={<BrainCircuit size={20} />} instructions="Watch and repeat three growing light sequences. Use the four buttons or number keys 1–4. Accuracy, not luck, sets the reward." onReset={reset} title="Memory Circuit">{() => phase === 'idle' ? <StartPanel action="Start Memory Circuit" icon={<Sparkles size={16} />} onStart={() => { completedRef.current = false; setEarnedSteps(0); beginRound(0) }} text="Three rounds: remember sequences of 3, 4, then 5 signals." /> : <div className="mt-4 border border-cs-border bg-cs-bg p-4"><div className="flex items-center justify-between gap-3 font-mono text-xs uppercase text-cs-muted"><span>Round {round + 1} / {memoryRoundLengths.length}</span><span>{feedback}</span></div><div className="mt-4 grid grid-cols-2 gap-3">{memoryPadLabels.map((label, index) => <button aria-label={`Memory pad ${index + 1}: ${label}`} className={`min-h-24 border-2 font-mono text-xs font-bold uppercase transition-all ${memoryPadStyles[index]} ${litPad === index ? 'scale-[1.03] bg-white/30 shadow-glow' : ''} ${phase !== 'input' ? 'cursor-default' : 'hover:bg-white/10'}`} disabled={phase !== 'input'} key={label} onClick={() => choosePad(index)} type="button"><span className="block text-lg">{index + 1}</span>{label}</button>)}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="font-mono text-xs uppercase text-cs-muted">Recall {earnedSteps}/{totalSteps}</span>{phase === 'finished' ? <span className="font-mono text-sm font-semibold text-cs-green">+{formatWorkReward(reward)}</span> : <span className="text-xs text-cs-muted">Keyboard 1–4 / tap</span>}</div></div>}</JobFrame>
}

function StartPanel({ action, icon, onStart, text }: { action: string; icon: ReactNode; onStart: () => void; text: string }) {
  return <div className="mt-4 flex min-h-28 flex-col items-start justify-between gap-4 border border-cs-border bg-cs-bg p-4 sm:flex-row sm:items-center"><p className="max-w-md text-sm text-cs-muted">{text}</p><button className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-rarity-special bg-rarity-special/10 px-4 text-sm font-semibold text-rarity-special transition hover:bg-rarity-special/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rarity-special" onClick={onStart} type="button">{icon}{action}</button></div>
}
function getSortBoxId(value: string): SortBoxId | undefined { return boxIds.find((boxId) => boxId === value) }
function capitalize(value: string) { return `${value.charAt(0).toUpperCase()}${value.slice(1)}` }
function ProgressFooter({ errorMessage, progressLabel, successMessage }: { errorMessage?: string; progressLabel: string; successMessage?: string }) { return <><div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3 border border-cs-border bg-cs-panel px-3 py-2"><span className="font-mono text-xs uppercase text-cs-muted">Progress</span><span className="min-w-0 font-mono text-sm font-semibold text-cs-green">{progressLabel}</span></div>{successMessage ? <p className="mt-3 border border-cs-green bg-cs-green/10 px-3 py-2 text-sm font-semibold text-cs-green">{successMessage}</p> : null}{errorMessage ? <p className="mt-3 border border-rarity-covert bg-rarity-covert/10 px-3 py-2 text-sm font-semibold text-rarity-covert">{errorMessage}</p> : null}</> }
function PoopPileIcon() { return <span aria-hidden="true" className="relative block h-12 w-14"><span className="absolute bottom-0 left-1/2 h-6 w-12 -translate-x-1/2 rounded-full bg-[#6b3b1f] shadow-[inset_0_-5px_0_rgb(51_28_15_/_0.55)]" /><span className="absolute bottom-4 left-1/2 h-6 w-10 -translate-x-1/2 rounded-full bg-[#7a4628] shadow-[inset_0_-5px_0_rgb(66_35_18_/_0.5)]" /><span className="absolute bottom-8 left-1/2 h-5 w-7 -translate-x-1/2 rounded-full bg-[#8a5431] shadow-[inset_0_-4px_0_rgb(66_35_18_/_0.42)]" /></span> }
