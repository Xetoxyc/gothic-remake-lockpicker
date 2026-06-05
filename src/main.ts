import './style.css'
import type { ChestRecord } from './game/chest'
import { mountChestPanel, saveChestFromPanel } from './game/chestPanel'
import { mountLockCards, updateLockCards } from './game/lockCards'
import { solveLock, type SolveMove } from './game/solver'
import { renderSolution } from './game/solutionPanel'
import { createGameState, MIN_GATE_COUNT, MAX_GATE_COUNT } from './game/types'

const state = createGameState()
let cachedSolutionMoves: SolveMove[] | undefined

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main class="layout">
  <section class="game-area" aria-label="Game area">
    <label class="gate-toggle">
      <input type="checkbox" id="five-gate" />
      <span>5-gate lock (uncheck for 6 gates)</span>
    </label>
    <div id="lock-cards"></div>
  </section>
  <aside class="input-list" aria-label="Input list">
    <div id="chest-panel"></div>
    <h2>Solution</h2>
    <ul id="inputs"></ul>
  </aside>
</main>
`

const lockCardsEl = document.querySelector<HTMLDivElement>('#lock-cards')!
const chestPanelEl = document.querySelector<HTMLDivElement>('#chest-panel')!
const inputsEl = document.querySelector<HTMLUListElement>('#inputs')!
const fiveGateEl = document.querySelector<HTMLInputElement>('#five-gate')!

function syncGateToggle(): void {
  fiveGateEl.checked = state.gateCount === MIN_GATE_COUNT
}

function refreshCards(): void {
  updateLockCards(lockCardsEl, state)
}

function handleChestLoad(chest?: ChestRecord): void {
  cachedSolutionMoves = chest?.solutionMoves
  syncGateToggle()
  remountCards()
  if (cachedSolutionMoves !== undefined) {
    renderSolution(inputsEl, { ok: true, moves: cachedSolutionMoves })
  } else {
    inputsEl.innerHTML = ''
  }
}

async function runSolve(): Promise<void> {
  const result = solveLock(state)
  renderSolution(inputsEl, result)
  if (!result.ok) return

  cachedSolutionMoves = result.moves
  await saveChestFromPanel(chestPanelEl, state, {
    solutionMoves: result.moves,
    statusMessage: `Solution saved (${result.moves.length} moves)`,
    onLoad: handleChestLoad,
  })
}

function remountCards(): void {
  mountLockCards(lockCardsEl, state, {
    onChange: refreshCards,
    onSolve: runSolve,
  })
}

fiveGateEl.addEventListener('change', () => {
  state.gateCount = fiveGateEl.checked ? MIN_GATE_COUNT : MAX_GATE_COUNT
  cachedSolutionMoves = undefined
  inputsEl.innerHTML = ''
  remountCards()
})

syncGateToggle()
remountCards()

mountChestPanel(chestPanelEl, {
  state,
  onLoad: handleChestLoad,
  getSolutionMoves: () => cachedSolutionMoves,
})
