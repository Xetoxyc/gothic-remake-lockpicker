import './style.css'
import type { ChestRecord } from './game/chest'
import { mountChestPanel, saveChestFromPanel } from './game/chestPanel'
import { mountLockCards, updateLockCards } from './game/lockCards'
import { solveLock, type SolveMove } from './game/solver'
import { renderSolution } from './game/solutionPanel'
import { clampGateCount, createGameState } from './game/types'

const state = createGameState()
let cachedSolutionMoves: SolveMove[] | undefined

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main class="layout">
  <section class="game-area" aria-label="Game area">
    <label class="gate-select">
      <span>Gates</span>
      <select id="gate-count" aria-label="Number of gates">
        <option value="4">4 gates</option>
        <option value="5">5 gates</option>
        <option value="6" selected>6 gates</option>
      </select>
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
const gateCountEl = document.querySelector<HTMLSelectElement>('#gate-count')!

function syncGateSelect(): void {
  gateCountEl.value = String(clampGateCount(state.gateCount))
}

function refreshCards(): void {
  updateLockCards(lockCardsEl, state)
}

function handleChestLoad(chest?: ChestRecord): void {
  cachedSolutionMoves = chest?.solutionMoves
  syncGateSelect()
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

gateCountEl.addEventListener('change', () => {
  state.gateCount = clampGateCount(Number(gateCountEl.value))
  cachedSolutionMoves = undefined
  inputsEl.innerHTML = ''
  remountCards()
})

syncGateSelect()
remountCards()

mountChestPanel(chestPanelEl, {
  state,
  onLoad: handleChestLoad,
  getSolutionMoves: () => cachedSolutionMoves,
})
