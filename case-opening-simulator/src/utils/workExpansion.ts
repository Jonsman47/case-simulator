export type MiningResource = 'dirt' | 'stone' | 'coal' | 'iron' | 'gold' | 'diamond'

export interface MiningBlock {
  column: number
  hardness: number
  id: string
  resource: MiningResource
  row: number
}

const MINING_HARDNESS: Record<MiningResource, number> = {
  coal: 2,
  diamond: 3,
  dirt: 1,
  gold: 3,
  iron: 2,
  stone: 2,
}

function createPrng(seed: number) {
  let value = seed >>> 0 || 0x9e3779b9
  return () => {
    value = (Math.imul(value, 1_664_525) + 1_013_904_223) >>> 0
    return value / 0x1_0000_0000
  }
}

export function generateMiningGrid(seed: number, rows = 7, columns = 6): MiningBlock[] {
  const random = createPrng(seed)
  const blocks: MiningBlock[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const roll = random()
      const depth = row / Math.max(1, rows - 1)
      let resource: MiningResource = row < 2 ? 'dirt' : 'stone'

      if (row >= 4 && roll < 0.025 + depth * 0.018) resource = 'diamond'
      else if (row >= 3 && roll < 0.095 + depth * 0.025) resource = 'gold'
      else if (row >= 2 && roll < 0.21) resource = 'iron'
      else if (row >= 1 && roll < 0.39) resource = 'coal'

      blocks.push({
        column,
        hardness: MINING_HARDNESS[resource],
        id: `mine-${row}-${column}`,
        resource,
        row,
      })
    }
  }

  return blocks
}

export function canMineBlock(block: MiningBlock, minedIds: ReadonlySet<string>) {
  return block.row === 0 || minedIds.has(`mine-${block.row - 1}-${block.column}`)
}

export function calculateMiningPerformance(
  resources: Partial<Record<MiningResource, number>>,
  deepestRow: number,
  totalRows = 7,
) {
  const value =
    (resources.coal ?? 0) * 1 +
    (resources.iron ?? 0) * 2 +
    (resources.gold ?? 0) * 4 +
    (resources.diamond ?? 0) * 9
  const depthScore = Math.max(0, deepestRow) / Math.max(1, totalRows - 1)
  return Math.min(1, value / 24 * 0.75 + depthScore * 0.25)
}

export interface GridPoint {
  column: number
  row: number
}

export const DELIVERY_GRID_SIZE = 5
export const DELIVERY_MAX_MOVES = 22
export const DELIVERY_OBSTACLES = new Set(['0-2', '1-2', '3-1', '3-3'])
export const DELIVERY_PACKAGES = ['1-1', '4-0'] as const
export const DELIVERY_DESTINATIONS = ['0-4', '4-4'] as const

export function pointKey(point: GridPoint) {
  return `${point.row}-${point.column}`
}

export function moveDeliveryPosition(
  point: GridPoint,
  direction: 'down' | 'left' | 'right' | 'up',
  obstacles: ReadonlySet<string> = DELIVERY_OBSTACLES,
) {
  const delta = direction === 'up'
    ? { row: -1, column: 0 }
    : direction === 'down'
      ? { row: 1, column: 0 }
      : direction === 'left'
        ? { row: 0, column: -1 }
        : { row: 0, column: 1 }
  const next = { row: point.row + delta.row, column: point.column + delta.column }

  if (
    next.row < 0 ||
    next.column < 0 ||
    next.row >= DELIVERY_GRID_SIZE ||
    next.column >= DELIVERY_GRID_SIZE ||
    obstacles.has(pointKey(next))
  ) {
    return point
  }

  return next
}

export function calculateDeliveryPerformance(delivered: number, movesUsed: number) {
  const completion = Math.min(1, Math.max(0, delivered) / DELIVERY_DESTINATIONS.length)
  const efficiency = Math.max(0, 1 - Math.max(0, movesUsed - 12) / 10)
  return Math.min(1, completion * 0.8 + efficiency * 0.2)
}

export function calculateWarehousePerformance(correct: number, mistakes: number, total = 10) {
  const accuracy = correct / Math.max(1, correct + mistakes)
  const completion = correct / Math.max(1, total)
  return Math.min(1, Math.max(0, accuracy * 0.65 + completion * 0.35))
}

export type CircuitDirection = 'e' | 'n' | 's' | 'w'
export type CircuitPieceType = 'corner' | 'endpoint' | 'straight'

export interface CircuitPiece {
  column: number
  id: string
  rotation: number
  row: number
  type: CircuitPieceType
  solutionRotation: number
}

const directionOrder: CircuitDirection[] = ['n', 'e', 's', 'w']
const baseConnections: Record<CircuitPieceType, CircuitDirection[]> = {
  corner: ['n', 'e'],
  endpoint: ['e'],
  straight: ['e', 'w'],
}

const circuitLayout: Omit<CircuitPiece, 'rotation'>[] = [
  { column: 0, id: 'circuit-0', row: 0, type: 'straight', solutionRotation: 0 },
  { column: 1, id: 'circuit-1', row: 0, type: 'straight', solutionRotation: 0 },
  { column: 2, id: 'circuit-2', row: 0, type: 'straight', solutionRotation: 0 },
  { column: 3, id: 'circuit-3', row: 0, type: 'corner', solutionRotation: 2 },
  { column: 0, id: 'circuit-4', row: 1, type: 'corner', solutionRotation: 1 },
  { column: 1, id: 'circuit-5', row: 1, type: 'straight', solutionRotation: 0 },
  { column: 2, id: 'circuit-6', row: 1, type: 'straight', solutionRotation: 0 },
  { column: 3, id: 'circuit-7', row: 1, type: 'corner', solutionRotation: 3 },
  { column: 0, id: 'circuit-8', row: 2, type: 'corner', solutionRotation: 0 },
  { column: 1, id: 'circuit-9', row: 2, type: 'straight', solutionRotation: 0 },
  { column: 2, id: 'circuit-10', row: 2, type: 'straight', solutionRotation: 0 },
  { column: 3, id: 'circuit-11', row: 2, type: 'straight', solutionRotation: 0 },
]

const opposite: Record<CircuitDirection, CircuitDirection> = { e: 'w', n: 's', s: 'n', w: 'e' }
const directionDelta: Record<CircuitDirection, GridPoint> = {
  e: { column: 1, row: 0 },
  n: { column: 0, row: -1 },
  s: { column: 0, row: 1 },
  w: { column: -1, row: 0 },
}

export function getCircuitConnections(piece: CircuitPiece) {
  const rotation = ((piece.rotation % 4) + 4) % 4
  return baseConnections[piece.type].map((direction) =>
    directionOrder[(directionOrder.indexOf(direction) + rotation) % directionOrder.length])
}

export function createCircuitPuzzle(seed: number): CircuitPiece[] {
  const random = createPrng(seed)
  const pieces = circuitLayout.map((piece) => ({ ...piece, rotation: Math.floor(random() * 4) }))
  if (isCircuitSolved(pieces)) pieces[0] = { ...pieces[0], rotation: (pieces[0].rotation + 1) % 4 }
  return pieces
}

export function getPoweredCircuitIds(pieces: readonly CircuitPiece[]) {
  const byPosition = new Map(pieces.map((piece) => [`${piece.row}-${piece.column}`, piece]))
  const start = byPosition.get('0-0')
  const visited = new Set<string>()
  if (!start || !getCircuitConnections(start).includes('w')) return visited

  const queue = [start]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current.id)) continue
    visited.add(current.id)

    for (const direction of getCircuitConnections(current)) {
      const delta = directionDelta[direction]
      const neighbor = byPosition.get(`${current.row + delta.row}-${current.column + delta.column}`)
      if (neighbor && getCircuitConnections(neighbor).includes(opposite[direction])) queue.push(neighbor)
    }
  }

  return visited
}

export function getCircuitHint(pieces: readonly CircuitPiece[]) {
  return pieces.find((piece) => {
    const rotationPeriod = piece.type === 'straight' ? 2 : 4
    return piece.rotation % rotationPeriod !== piece.solutionRotation % rotationPeriod
  })
}

export function isCircuitSolved(pieces: readonly CircuitPiece[]) {
  const sink = pieces.find((piece) => piece.row === 2 && piece.column === 3)
  return Boolean(
    sink &&
    getCircuitConnections(sink).includes('e') &&
    getPoweredCircuitIds(pieces).has(sink.id),
  )
}

export function calculateCircuitPerformance(moves: number, moveLimit = 24) {
  return Math.min(1, Math.max(0, 1 - Math.max(0, moves - 8) / Math.max(1, moveLimit - 8)))
}
