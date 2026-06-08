import { getMoveDeltas, type Direction } from './movement'
import { DEFAULT_GATE_COUNT, HOLE_COUNT, type GameState, type LinkType } from './types'

export type SolveMove = {
  card: number
  direction: Direction
}

export type SolveResult =
  | { ok: true; moves: SolveMove[] }
  | { ok: false; error: string }

// 7-gate locks use a larger state space (7^7); use sparse maps instead of
// pre-allocating typed arrays sized to STATE_COUNT.
const SPARSE_BFS_GATE_COUNT = 7

// Precompute the per-card shift caused by each of the (gateCount * 2) moves
// (move index = cardIndex * 2 + (left ? 0 : 1)).
function buildMoveDeltas(links: LinkType[][], gateCount: number): number[][] {
  const moves: number[][] = []

  for (let card = 0; card < gateCount; card++) {
    for (const direction of ['left', 'right'] as const) {
      const deltas = getMoveDeltas(links, card, direction, gateCount)
      const row = new Array<number>(gateCount).fill(0)
      for (const [index, step] of deltas) row[index] = step
      moves.push(row)
    }
  }

  return moves
}

function buildPowers(gateCount: number): number[] {
  return Array.from({ length: gateCount }, (_, i) => HOLE_COUNT ** i)
}

function encodeState(positions: number[], pow: number[]): number {
  let code = 0
  for (let i = 0; i < positions.length; i++) code += positions[i] * pow[i]
  return code
}

function decodeState(code: number, gateCount: number, pow: number[]): number[] {
  const current = new Array<number>(gateCount)
  for (let i = 0; i < gateCount; i++) {
    current[i] = Math.floor(code / pow[i]) % HOLE_COUNT
  }
  return current
}

function moveToSolveMove(moveIndex: number): SolveMove {
  return {
    card: (moveIndex >> 1) + 1,
    direction: (moveIndex & 1) === 0 ? 'left' : 'right',
  }
}

function reconstructPath(
  startCode: number,
  targetCode: number,
  prevState: (code: number) => number | undefined,
  prevMove: (code: number) => number | undefined,
): SolveMove[] {
  const moves: SolveMove[] = []
  let s = targetCode
  while (s !== startCode) {
    moves.push(moveToSolveMove(prevMove(s)!))
    s = prevState(s)!
  }
  moves.reverse()
  return moves
}

function bfsCore(
  startCode: number,
  targetCode: number,
  gateCount: number,
  pow: number[],
  moveDeltas: number[][],
  visited: {
    has: (code: number) => boolean
    add: (code: number) => void
  },
  record: (code: number, from: number, move: number) => void,
  getPrev: (code: number) => { from: number; move: number } | undefined,
): SolveResult {
  type Node = {
    code: number
    lastGate: number | null
    switches: number
  }

  const moveCount = gateCount * 2

  let currentLayer: Node[] = [
    {
      code: startCode,
      lastGate: null,
      switches: 0,
    },
  ]

  visited.add(startCode)

  while (currentLayer.length > 0) {
    const nextLayer: Node[] = []

    /**
     * For states discovered in THIS layer:
     * keep only the variant with the fewest switches.
     */
    const layerBest = new Map<
      number,
      {
        from: number
        move: number
        switches: number
        lastGate: number
      }
    >()

    for (const node of currentLayer) {
      const current = decodeState(node.code, gateCount, pow)

      for (let m = 0; m < moveCount; m++) {
        const row = moveDeltas[m]

        let legal = true
        let nextCode = 0

        for (let i = 0; i < gateCount; i++) {
          const value = current[i] + row[i]

          if (value < 0 || value >= HOLE_COUNT) {
            legal = false
            break
          }

          nextCode += value * pow[i]
        }

        if (!legal) continue

        // Already reached in a previous BFS depth.
        if (visited.has(nextCode)) continue

        const gate = (m >> 1) + 1

        const newSwitches =
          node.lastGate !== null && node.lastGate !== gate
            ? node.switches + 1
            : node.switches

        const existing = layerBest.get(nextCode)

        if (
          !existing ||
          newSwitches < existing.switches
        ) {
          layerBest.set(nextCode, {
            from: node.code,
            move: m,
            switches: newSwitches,
            lastGate: gate,
          })
        }
      }
    }

    // Commit the best candidates of this depth.
    for (const [nextCode, info] of layerBest.entries()) {
      visited.add(nextCode)

      record(
        nextCode,
        info.from,
        info.move,
      )

      if (nextCode === targetCode) {
        return {
          ok: true,
          moves: reconstructPath(
            startCode,
            targetCode,
            (c) => getPrev(c)?.from,
            (c) => getPrev(c)?.move,
          ),
        }
      }

      nextLayer.push({
        code: nextCode,
        lastGate: info.lastGate,
        switches: info.switches,
      })
    }

    currentLayer = nextLayer
  }

  return {
    ok: false,
    error:
      'No solution: the target pins cannot be reached without pushing a pin past the edge.',
  }
}

function solveWithTypedArrays(
  startCode: number,
  targetCode: number,
  gateCount: number,
  pow: number[],
  moveDeltas: number[][],
): SolveResult {
  const stateCount = HOLE_COUNT ** gateCount
  const visited = new Uint8Array(stateCount)
  const prevState = new Int32Array(stateCount)
  const prevMove = new Int8Array(stateCount)

  return bfsCore(
    startCode,
    targetCode,
    gateCount,
    pow,
    moveDeltas,
    {
      has: (code) => visited[code] === 1,
      add: (code) => {
        visited[code] = 1
      },
    },
    (code, from, move) => {
      prevState[code] = from
      prevMove[code] = move
    },
    (code) => ({ from: prevState[code], move: prevMove[code] }),
  )
}

function solveWithSparseMaps(
  startCode: number,
  targetCode: number,
  gateCount: number,
  pow: number[],
  moveDeltas: number[][],
): SolveResult {
  const visited = new Set<number>([startCode])
  const prev = new Map<number, { from: number; move: number }>()

  return bfsCore(
    startCode,
    targetCode,
    gateCount,
    pow,
    moveDeltas,
    {
      has: (code) => visited.has(code),
      add: (code) => {
        visited.add(code)
      },
    },
    (code, from, move) => {
      prev.set(code, { from, move })
    },
    (code) => prev.get(code),
  )
}

// Breadth-first search over the bounded state space. Pins cannot wrap around the
// edges, so a move is only legal when every affected pin stays within holes 1-7.
// BFS guarantees the returned sequence has the fewest possible clicks.
export function solveLock(state: GameState): SolveResult {
  const gateCount = state.gateCount ?? DEFAULT_GATE_COUNT

  const positions: number[] = []
  const targets: number[] = []

  for (let i = 0; i < gateCount; i++) {
    const card = state.cards[i]

    if (card.currentPin === null) {
      return { ok: false, error: `Set a start pin on card ${i + 1}` }
    }
    if (card.correctPin === null) {
      return { ok: false, error: `Set a correct pin on card ${i + 1}` }
    }

    positions.push(card.currentPin)
    targets.push(card.correctPin)
  }

  const pow = buildPowers(gateCount)
  const startCode = encodeState(positions, pow)
  const targetCode = encodeState(targets, pow)

  if (startCode === targetCode) {
    return { ok: true, moves: [] }
  }

  const moveDeltas = buildMoveDeltas(state.links, gateCount)

  if (gateCount >= SPARSE_BFS_GATE_COUNT) {
    return solveWithSparseMaps(startCode, targetCode, gateCount, pow, moveDeltas)
  }

  return solveWithTypedArrays(startCode, targetCode, gateCount, pow, moveDeltas)
}

export function formatMove(move: SolveMove): string {
  const direction =
    move.direction === 'left' ? 'Left (A)' : 'Right (D)'
  return `Gate ${move.card} — ${direction}`
}
