import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'
import {
  formatWorkCooldown,
  getWorkMiniGameCooldownRemaining,
  WORK_MINIGAMES,
  workMiniGamesById,
  type WorkMiniGameId,
} from '../utils/workMinigames'
import { writePoopCleanupLastCompleted } from '../utils/poopCleanupMinigame'
import { getClickIncomeMultiplier } from '../data/upgrades'
import { getSkillMinigameRewardMultiplier } from '../data/skills'

const poopIds = ['left', 'center', 'right'] as const
const poopPositions = [
  { left: '17%', top: '58%' },
  { left: '52%', top: '34%' },
  { left: '78%', top: '63%' },
] as const
const boxIds = ['red', 'blue', 'green', 'yellow'] as const
type SortBoxId = (typeof boxIds)[number]

function getCurrentTimestamp() {
  return Date.now()
}

function getDisplayedWorkReward(
  baseReward: number,
  upgrades: Parameters<typeof getClickIncomeMultiplier>[0],
  learnedSkillNodeIds: Parameters<typeof getSkillMinigameRewardMultiplier>[0],
) {
  return baseReward * getClickIncomeMultiplier(upgrades) * getSkillMinigameRewardMultiplier(learnedSkillNodeIds)
}

function formatWorkReward(value: number) {
  return formatCurrency(value).replace(/\.00$/, '')
}

interface SortPositionSlot {
  key: string
  left: string
  top: string
}

interface SortBoxesLayout {
  boxes: Record<SortBoxId, SortPositionSlot>
  containers: Record<SortBoxId, SortPositionSlot>
}

const boxPositionSlots: SortPositionSlot[] = [
  { key: 'box-a', left: '14%', top: '22%' },
  { key: 'box-b', left: '37%', top: '18%' },
  { key: 'box-c', left: '62%', top: '27%' },
  { key: 'box-d', left: '83%', top: '20%' },
]

const containerPositionSlots: SortPositionSlot[] = [
  { key: 'container-a', left: '15%', top: '68%' },
  { key: 'container-b', left: '38%', top: '72%' },
  { key: 'container-c', left: '62%', top: '67%' },
  { key: 'container-d', left: '84%', top: '72%' },
]

const sortBoxStyles: Record<SortBoxId, { box: string; container: string; sorted: string }> = {
  blue: {
    box: 'border-blue-200 bg-blue-600 text-white',
    container: 'border-blue-300 bg-blue-500/15 text-blue-100',
    sorted: 'border-blue-200 bg-blue-600 text-white',
  },
  green: {
    box: 'border-emerald-200 bg-emerald-600 text-white',
    container: 'border-emerald-300 bg-emerald-500/15 text-emerald-100',
    sorted: 'border-emerald-200 bg-emerald-600 text-white',
  },
  red: {
    box: 'border-red-200 bg-red-600 text-white',
    container: 'border-red-300 bg-red-500/15 text-red-100',
    sorted: 'border-red-200 bg-red-600 text-white',
  },
  yellow: {
    box: 'border-yellow-200 bg-yellow-400 text-slate-950',
    container: 'border-yellow-300 bg-yellow-400/15 text-yellow-100',
    sorted: 'border-yellow-200 bg-yellow-400 text-slate-950',
  },
}

export function WorkView() {
  return (
    <section className="grid gap-5">
      <div className="border-l-4 border-cs-green pl-4">
        <p className="font-mono text-xs uppercase text-cs-green">Emergency Jobs</p>
        <h2 className="mt-1 text-3xl font-semibold text-cs-text">Work</h2>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <WorkJobErrorBoundary title="Poop Cleaning">
          <PoopCleaningJob />
        </WorkJobErrorBoundary>
        <WorkJobErrorBoundary title="Sort Boxes">
          <SortBoxesJob />
        </WorkJobErrorBoundary>
      </div>
    </section>
  )
}

class WorkJobErrorBoundary extends Component<
  { children: ReactNode; title: string },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="border border-rarity-covert bg-cs-surface p-4">
          <h3 className="text-xl font-semibold text-cs-text">{this.props.title}</h3>
          <p className="mt-2 text-sm text-cs-muted">
            This job hit a problem. Return to Work and try again.
          </p>
          <button
            className="mt-3 min-h-10 border border-cs-border px-3 text-sm font-semibold text-cs-text hover:border-rarity-special"
            onClick={() => this.setState({ hasError: false })}
            type="button"
          >
            Reset job
          </button>
        </section>
      )
    }

    return this.props.children
  }
}

function JobFrame({
  children,
  description,
  gameId,
  onReset,
  title,
}: {
  children: (isOnCooldown: boolean) => ReactElement
  description: string
  gameId: WorkMiniGameId
  onReset: () => void
  title: string
}) {
  const { state } = useGame()
  const [now, setNow] = useState(() => Date.now())
  const definition = workMiniGamesById.get(gameId) ?? WORK_MINIGAMES[0]
  const cooldownRemaining = getWorkMiniGameCooldownRemaining(gameId, now, state.workMiniGameCooldowns)
  const isOnCooldown = cooldownRemaining > 0
  const wasOnCooldownRef = useRef(isOnCooldown)

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1_000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (wasOnCooldownRef.current && !isOnCooldown) {
      onReset()
    }

    wasOnCooldownRef.current = isOnCooldown
  }, [isOnCooldown, onReset])

  return (
    <section className="border border-cs-border bg-cs-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase text-cs-muted">{description}</p>
          <h3 className="mt-1 text-xl font-semibold text-cs-text">{title}</h3>
        </div>
        <div className="border border-cs-border bg-cs-panel px-3 py-2 text-right">
          <p className="font-mono text-[10px] uppercase text-cs-muted">Reward</p>
          <p className="mt-1 font-mono text-sm font-semibold text-cs-green">
            +{formatCurrency(definition.reward)}
          </p>
        </div>
      </div>

      {isOnCooldown ? (
        <div className="mt-4 border border-cs-border bg-cs-panel px-4 py-6 text-center">
          <p className="text-sm font-semibold text-cs-text">
            Come back in {formatWorkCooldown(cooldownRemaining)}.
          </p>
        </div>
      ) : children(isOnCooldown)}
    </section>
  )
}

function PoopCleaningJob() {
  const [cleanedIds, setCleanedIds] = useState<Set<string>>(() => new Set())
  const [successMessage, setSuccessMessage] = useState<string | undefined>()
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const completedRef = useRef(false)
  const { dispatch, state } = useGame()
  const progressLabel = useMemo(() => `${cleanedIds.size} / ${poopIds.length}`, [cleanedIds])

  function reset() {
    completedRef.current = false
    setCleanedIds(new Set())
    setErrorMessage(undefined)
    setSuccessMessage(undefined)
  }

  function cleanPoop(poopId: string) {
    if (completedRef.current || cleanedIds.has(poopId)) {
      return
    }

    const nextIds = new Set(cleanedIds)
    nextIds.add(poopId)
    setCleanedIds(nextIds)

    if (nextIds.size === poopIds.length) {
      const completedAt = getCurrentTimestamp()

      completedRef.current = true

      try {
        writePoopCleanupLastCompleted(completedAt)
        dispatch({ type: 'COMPLETE_WORK_MINIGAME', gameId: 'poopCleaning', now: completedAt })
        const definition = workMiniGamesById.get('poopCleaning') ?? WORK_MINIGAMES[0]
        const reward = getDisplayedWorkReward(definition.reward, state.upgrades, state.learnedSkillNodeIds)
        setSuccessMessage(`Poop cleaned. +${formatWorkReward(reward)}`)
      } catch {
        completedRef.current = false
        setErrorMessage('Poop Cleaning hit a problem. Nothing was charged or locked.')
      }
    }
  }

  return (
    <JobFrame
      description="Click 3 poops in the grass."
      gameId="poopCleaning"
      onReset={reset}
      title="Poop Cleaning"
    >
      {() => (
        <>
          <div className="mt-4 overflow-hidden border border-cs-border bg-cs-bg p-3">
            <div
              aria-label="Poop cleaning grass field"
              className="relative h-72 overflow-hidden border border-cs-border bg-[linear-gradient(135deg,rgb(44_122_72)_0_25%,rgb(35_104_64)_25%_50%,rgb(44_122_72)_50%_75%,rgb(35_104_64)_75%)] bg-[length:46px_46px]"
            >
              {poopIds.map((poopId, index) => {
                const isCleaned = cleanedIds.has(poopId)

                return (
                  <button
                    aria-label={`Clean poop ${index + 1}`}
                    className={[
                      'absolute grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center border transition-all duration-200',
                      isCleaned
                        ? 'pointer-events-none scale-50 border-cs-green/30 bg-cs-green/10 opacity-0'
                        : 'border-cs-border bg-cs-panel/95 shadow-glow hover:border-cs-green',
                    ].join(' ')}
                    disabled={isCleaned}
                    key={poopId}
                    onClick={() => cleanPoop(poopId)}
                    style={poopPositions[index]}
                    type="button"
                  >
                    <PoopPileIcon />
                  </button>
                )
              })}
            </div>
          </div>
          <ProgressFooter errorMessage={errorMessage} progressLabel={progressLabel} successMessage={successMessage} />
        </>
      )}
    </JobFrame>
  )
}

function SortBoxesJob() {
  const { dispatch, state } = useGame()
  const [isStarted, setIsStarted] = useState(false)
  const [layout, setLayout] = useState<SortBoxesLayout>(() => createDefaultSortBoxesLayout())
  const [selectedBox, setSelectedBox] = useState<SortBoxId | undefined>()
  const [sortedIds, setSortedIds] = useState<Set<SortBoxId>>(() => new Set())
  const [successMessage, setSuccessMessage] = useState<string | undefined>()
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const completedRef = useRef(false)
  const definition = workMiniGamesById.get('sortBoxes') ?? WORK_MINIGAMES[0]
  const progressLabel = useMemo(() => `Sorted ${sortedIds.size}/${boxIds.length}`, [sortedIds])

  function reset() {
    completedRef.current = false
    setIsStarted(false)
    setSelectedBox(undefined)
    setSortedIds(new Set())
    setLayout(createDefaultSortBoxesLayout())
    setErrorMessage(undefined)
    setSuccessMessage(undefined)
  }

  function startRound() {
    if (completedRef.current) {
      return
    }

    setLayout(createSortBoxesLayout())
    setSelectedBox(undefined)
    setSortedIds(new Set())
    setErrorMessage(undefined)
    setSuccessMessage(undefined)
    setIsStarted(true)
  }

  function closeRound() {
    setIsStarted(false)
    setSelectedBox(undefined)
    setSortedIds(new Set())
    setErrorMessage(undefined)
  }

  function selectBox(boxId: SortBoxId) {
    if (completedRef.current || sortedIds.has(boxId)) {
      return
    }

    setSelectedBox(boxId)
    setErrorMessage(undefined)
  }

  function dropBox(boxId: SortBoxId, containerId: SortBoxId) {
    if (completedRef.current || sortedIds.has(boxId)) {
      return
    }

    if (boxId !== containerId) {
      setSelectedBox(undefined)
      setErrorMessage('Wrong container. Try the matching color.')
      return
    }

    const nextIds = new Set(sortedIds)
    nextIds.add(boxId)
    setSortedIds(nextIds)
    setSelectedBox(undefined)
    setErrorMessage(undefined)

    if (nextIds.size === boxIds.length) {
      const completedAt = getCurrentTimestamp()

      completedRef.current = true

      try {
        dispatch({ type: 'COMPLETE_WORK_MINIGAME', gameId: 'sortBoxes', now: completedAt })
        const reward = getDisplayedWorkReward(definition.reward, state.upgrades, state.learnedSkillNodeIds)
        setSuccessMessage(`${definition.name} done. +${formatCurrency(reward)}`)
      } catch {
        completedRef.current = false
        setErrorMessage(`${definition.name} hit a problem. Nothing was charged or locked.`)
      }
    }
  }

  function onDragStart(event: DragEvent<HTMLButtonElement>, boxId: SortBoxId) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', boxId)
    selectBox(boxId)
  }

  function onDrop(event: DragEvent<HTMLDivElement>, containerId: SortBoxId) {
    event.preventDefault()

    const droppedBox = getSortBoxId(event.dataTransfer.getData('text/plain')) ?? selectedBox

    if (droppedBox) {
      dropBox(droppedBox, containerId)
    }
  }

  return (
    <JobFrame
      description="Drag each colored box into the matching container."
      gameId="sortBoxes"
      onReset={reset}
      title="Sort Boxes"
    >
      {() => (
        <>
          {!isStarted ? (
            <div className="mt-4 border border-cs-border bg-cs-bg p-4">
              <p className="text-sm text-cs-muted">
                Match every box to the same-colored container. Wrong drops snap back.
              </p>
              <button
                className="mt-4 min-h-10 border border-rarity-special bg-rarity-special/10 px-4 text-sm font-semibold text-rarity-special hover:bg-rarity-special/20"
                onClick={startRound}
                type="button"
              >
                Start Sort Boxes
              </button>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden border border-cs-border bg-cs-bg p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-cs-muted">Drag a box, or click a box then click its container.</p>
                <button
                  className="min-h-9 border border-cs-border px-3 text-xs font-semibold uppercase text-cs-text hover:border-rarity-special"
                  onClick={closeRound}
                  type="button"
                >
                  Close job
                </button>
              </div>
              <div
                aria-label="Sort Boxes sorting area"
                className="relative h-80 overflow-hidden border border-cs-border bg-[linear-gradient(90deg,rgb(15_23_42)_0_24px,rgb(17_24_39)_24px_48px)]"
              >
                {boxIds.map((boxId) => {
                  if (sortedIds.has(boxId)) {
                    return null
                  }

                  const position = layout.boxes[boxId]

                  return (
                    <button
                      aria-label={`${capitalize(boxId)} box`}
                      className={[
                        'absolute grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center border-2 font-mono text-[10px] font-bold uppercase shadow-glow transition-transform hover:scale-105',
                        selectedBox === boxId ? 'ring-2 ring-rarity-special ring-offset-2 ring-offset-cs-bg' : '',
                        sortBoxStyles[boxId].box,
                      ].join(' ')}
                      data-position-key={position.key}
                      draggable
                      key={boxId}
                      onClick={() => selectBox(boxId)}
                      onDragEnd={() => setSelectedBox(undefined)}
                      onDragStart={(event) => onDragStart(event, boxId)}
                      style={position}
                      type="button"
                    >
                      {boxId}
                    </button>
                  )
                })}

                {boxIds.map((boxId) => {
                  const position = layout.containers[boxId]
                  const isSorted = sortedIds.has(boxId)

                  return (
                    <div
                      aria-label={`${capitalize(boxId)} container`}
                      className={[
                        'absolute grid h-20 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center border-2 p-2 text-center font-mono text-[10px] font-bold uppercase transition-colors',
                        selectedBox && selectedBox !== boxId ? 'border-rarity-covert/70' : '',
                        sortBoxStyles[boxId].container,
                      ].join(' ')}
                      data-position-key={position.key}
                      key={boxId}
                      onClick={() => {
                        if (selectedBox) {
                          dropBox(selectedBox, boxId)
                        }
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => onDrop(event, boxId)}
                      onKeyDown={(event) => {
                        if ((event.key === 'Enter' || event.key === ' ') && selectedBox) {
                          event.preventDefault()
                          dropBox(selectedBox, boxId)
                        }
                      }}
                      role="button"
                      style={position}
                      tabIndex={0}
                    >
                      {isSorted ? (
                        <span
                          className={[
                            'grid h-12 w-16 place-items-center border font-mono text-[10px] uppercase',
                            sortBoxStyles[boxId].sorted,
                          ].join(' ')}
                        >
                          {boxId}
                        </span>
                      ) : (
                        <span>{boxId} bin</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <ProgressFooter errorMessage={errorMessage} progressLabel={progressLabel} successMessage={successMessage} />
        </>
      )}
    </JobFrame>
  )
}

function createDefaultSortBoxesLayout(): SortBoxesLayout {
  return {
    boxes: createPositionMap(boxPositionSlots),
    containers: createPositionMap(containerPositionSlots),
  }
}

function createSortBoxesLayout(): SortBoxesLayout {
  return {
    boxes: createPositionMap(shuffleSlots(boxPositionSlots)),
    containers: createPositionMap(shuffleSlots(containerPositionSlots)),
  }
}

function createPositionMap(slots: SortPositionSlot[]) {
  return Object.fromEntries(boxIds.map((boxId, index) => [boxId, slots[index]])) as Record<SortBoxId, SortPositionSlot>
}

function shuffleSlots(slots: SortPositionSlot[]) {
  const shuffledSlots = [...slots]

  for (let index = shuffledSlots.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const currentSlot = shuffledSlots[index]

    shuffledSlots[index] = shuffledSlots[swapIndex]
    shuffledSlots[swapIndex] = currentSlot
  }

  return shuffledSlots
}

function getSortBoxId(value: string): SortBoxId | undefined {
  return boxIds.find((boxId) => boxId === value)
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

function ProgressFooter({
  errorMessage,
  progressLabel,
  successMessage,
}: {
  errorMessage: string | undefined
  progressLabel: string
  successMessage: string | undefined
}) {
  return (
    <>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-cs-border bg-cs-panel px-3 py-2">
        <span className="font-mono text-xs uppercase text-cs-muted">Progress</span>
        <span className="font-mono text-sm font-semibold text-cs-green">{progressLabel}</span>
      </div>
      {successMessage ? (
        <p className="mt-3 border border-cs-green bg-cs-green/10 px-3 py-2 text-sm font-semibold text-cs-green">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="mt-3 border border-rarity-covert bg-rarity-covert/10 px-3 py-2 text-sm font-semibold text-rarity-covert">
          {errorMessage}
        </p>
      ) : null}
    </>
  )
}

function PoopPileIcon() {
  return (
    <span aria-hidden="true" className="relative block h-12 w-14">
      <span className="absolute bottom-0 left-1/2 h-6 w-12 -translate-x-1/2 rounded-full bg-[#6b3b1f] shadow-[inset_0_-5px_0_rgb(51_28_15_/_0.55)]" />
      <span className="absolute bottom-4 left-1/2 h-6 w-10 -translate-x-1/2 rounded-full bg-[#7a4628] shadow-[inset_0_-5px_0_rgb(66_35_18_/_0.5)]" />
      <span className="absolute bottom-8 left-1/2 h-5 w-7 -translate-x-1/2 rounded-full bg-[#8a5431] shadow-[inset_0_-4px_0_rgb(66_35_18_/_0.42)]" />
    </span>
  )
}
