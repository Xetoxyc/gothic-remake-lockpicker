import type { SolveMove } from './solver'

export type InputKey = 'R' | 'W' | 'S' | 'A' | 'D'

export type InputKeyRun = {
  key: InputKey
  count: number
}

// In-game: R resets the gate cursor to the front plate (highest gate number).
// W moves the cursor toward lower gate numbers; S toward higher ones.
// A / D slide the active gate left / right.
export function movesToInputChain(moves: SolveMove[], gateCount: number): InputKey[] {
  const chain: InputKey[] = ['R']
  let cursor = gateCount

  for (const move of moves) {
    while (cursor > move.card) {
      chain.push('W')
      cursor--
    }
    while (cursor < move.card) {
      chain.push('S')
      cursor++
    }
    chain.push(move.direction === 'left' ? 'A' : 'D')
  }

  return chain
}

export function groupInputChain(chain: InputKey[]): InputKeyRun[] {
  const runs: InputKeyRun[] = []

  for (const key of chain) {
    const last = runs[runs.length - 1]
    if (last && last.key === key) {
      last.count++
    } else {
      runs.push({ key, count: 1 })
    }
  }

  return runs
}

export function formatInputChain(chain: InputKey[]): string {
  return chain.join(' ')
}
