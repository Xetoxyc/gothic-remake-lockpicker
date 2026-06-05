import { getMoveDeltas, type Direction } from './movement'
import { CARD_COUNT, HOLE_COUNT, type GameState, type LinkType } from './types'

export type SolveMove = {
  card: number
  direction: Direction
}

export type SolveResult =
  | { ok: true; moves: SolveMove[] }
  | { ok: false; error: string }

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

function moveToSolveMove(moveIndex: number): SolveMove {
  return {
    card: (moveIndex >> 1) + 1,
    direction: (moveIndex & 1) === 0 ? 'left' : 'right',
  }
}

// Breadth-first search over the bounded state space. Pins cannot wrap around the
// edges, so a move is only legal when every affected pin stays within holes 1-7.
// BFS guarantees the returned sequence has the fewest possible clicks.
export function solveLock(state: GameState): SolveResult {
  const gateCount = state.gateCount ?? CARD_COUNT

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

  const MOVE_COUNT = gateCount * 2
  const POW = Array.from({ length: gateCount }, (_, i) => HOLE_COUNT ** i)
  const STATE_COUNT = HOLE_COUNT ** gateCount

  let startCode = 0
  let targetCode = 0
  for (let i = 0; i < gateCount; i++) {
    startCode += positions[i] * POW[i]
    targetCode += targets[i] * POW[i]
  }

  if (startCode === targetCode) {
    return { ok: true, moves: [] }
  }

  const moveDeltas = buildMoveDeltas(state.links, gateCount)

  const visited = new Uint8Array(STATE_COUNT)
  const prevState = new Int32Array(STATE_COUNT)
  const prevMove = new Int8Array(STATE_COUNT)
  const queue = new Int32Array(STATE_COUNT)
  let head = 0
  let tail = 0

  visited[startCode] = 1
  queue[tail++] = startCode

  const current = new Array<number>(gateCount)

  while (head < tail) {
    const code = queue[head++]

    for (let i = 0; i < gateCount; i++) {
      current[i] = Math.floor(code / POW[i]) % HOLE_COUNT
    }

    for (let m = 0; m < MOVE_COUNT; m++) {
      const row = moveDeltas[m]
      let legal = true
      let nextCode = 0

      for (let i = 0; i < gateCount; i++) {
        const value = current[i] + row[i]
        if (value < 0 || value >= HOLE_COUNT) {
          legal = false
          break
        }
        nextCode += value * POW[i]
      }

      if (!legal || visited[nextCode]) continue

      visited[nextCode] = 1
      prevState[nextCode] = code
      prevMove[nextCode] = m

      if (nextCode === targetCode) {
        const moves: SolveMove[] = []
        let s = nextCode
        while (s !== startCode) {
          moves.push(moveToSolveMove(prevMove[s]))
          s = prevState[s]
        }
        moves.reverse()
        return { ok: true, moves }
      }

      queue[tail++] = nextCode
    }
  }

  return {
    ok: false,
    error:
      'No solution: the target pins cannot be reached without pushing a pin past the edge.',
  }
}

export function formatMove(move: SolveMove): string {
  return `${move.card} - ${move.direction}`
}
