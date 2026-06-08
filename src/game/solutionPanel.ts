import { groupInputChain, movesToInputChain } from './inputChain'
import { formatMove, type SolveMove, type SolveResult } from './solver'

export type SolutionView = 'moves' | 'input'

type MoveRun = {
  move: SolveMove
  count: number
}

function groupMoves(moves: SolveMove[]): MoveRun[] {
  const runs: MoveRun[] = []

  for (const move of moves) {
    const last = runs[runs.length - 1]
    if (last && last.move.card === move.card && last.move.direction === move.direction) {
      last.count++
    } else {
      runs.push({ move, count: 1 })
    }
  }

  return runs
}

function inputKeyClass(key: string): string {
  switch (key) {
    case 'R':
      return 'input-key input-key--reset'
    case 'W':
    case 'S':
      return 'input-key input-key--nav'
    default:
      return 'input-key input-key--move'
  }
}

function renderInputChain(moves: SolveMove[], gateCount: number): string {
  const chain = movesToInputChain(moves, gateCount)
  const runs = groupInputChain(chain)
  const keys = runs
    .map((run) => {
      const label = run.count > 1 ? `${run.key}<span class="solution-repeat">×${run.count}</span>` : run.key
      return `<kbd class="${inputKeyClass(run.key)}">${label}</kbd>`
    })
    .join('<span class="input-chain-sep" aria-hidden="true">·</span>')

  return `
    <li class="solution-input-chain">
      <div class="input-chain-keys">${keys}</div>
    </li>
  `
}

function renderMoveList(moves: SolveMove[]): string {
  const runs = groupMoves(moves)

  return runs
    .map((run, index) => {
      const label = formatMove(run.move)
      const repeat = run.count > 1 ? ` <span class="solution-repeat">×${run.count}</span>` : ''
      return `<li class="solution-step"><span class="solution-index">${index + 1}.</span> ${label}${repeat}</li>`
    })
    .join('')
}

export function renderSolution(
  container: HTMLElement,
  result: SolveResult,
  options: { view: SolutionView; gateCount: number },
): void {
  if (!result.ok) {
    container.innerHTML = `<li class="solution-error">${result.error}</li>`
    return
  }

  if (result.moves.length === 0) {
    container.innerHTML = `<li class="solution-empty">Already solved</li>`
    return
  }

  container.innerHTML =
    options.view === 'input'
      ? renderInputChain(result.moves, options.gateCount)
      : renderMoveList(result.moves)
}

export function solutionViewHint(view: SolutionView): string {
  if (view === 'input') {
    return 'Keyboard input chain. R resets the cursor to the front gate; W/S move between gates; A/D slide left/right. Consecutive identical keys are grouped.'
  }

  return 'Shortest legal move sequence. In-game: Left (A), Right (D). Consecutive identical presses are grouped.'
}
