import { formatMove, type SolveMove, type SolveResult } from './solver'

type MoveRun = {
  move: SolveMove
  count: number
}

// Merge consecutive identical presses into a single run. Order is preserved, so
// the displayed sequence is exactly the same clicks - just compacted.
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

export function renderSolution(container: HTMLElement, result: SolveResult): void {
  if (!result.ok) {
    container.innerHTML = `<li class="solution-error">${result.error}</li>`
    return
  }

  if (result.moves.length === 0) {
    container.innerHTML = `<li class="solution-empty">Already solved</li>`
    return
  }

  const runs = groupMoves(result.moves)

  const steps = runs
    .map((run, index) => {
      const label = formatMove(run.move)
      const repeat = run.count > 1 ? ` <span class="solution-repeat">x${run.count}</span>` : ''
      return `<li class="solution-step"><span class="solution-index">${index + 1}.</span> ${label}${repeat}</li>`
    })
    .join('')

  container.innerHTML = steps
}
