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
    <header class="app-header">
      <h1 class="app-title">Gothic Lockpick Solver</h1>
      <p class="app-subtitle">Set up a lock, then press <strong>Solve</strong> for the shortest click sequence.</p>
    </header>

    <section class="help-panel" aria-label="How to use">
      <h2 class="help-title">How it works</h2>
      <div class="help-grid">
        <div class="help-item">
          <h3>Holes (1–7)</h3>
          <p>Each gate has seven holes, left to right. Pick where the pin <em>starts</em> and where it must <em>end up</em>.</p>
          <ul class="help-legend">
            <li>
              <span class="legend-swatch legend-swatch--start" aria-hidden="true"></span>
              <span><strong>Start pin</strong> — left-click a hole (gold inner ring)</span>
            </li>
            <li>
              <span class="legend-swatch legend-swatch--target" aria-hidden="true"></span>
              <span><strong>Target pin</strong> — right-click a hole (green outer ring). New gates default to hole 4.</span>
            </li>
          </ul>
        </div>
        <div class="help-item">
          <h3>Link grid</h3>
          <p>Next to each gate is a small grid. Each column is another gate number. Click a cell to cycle the link type when <em>this</em> gate moves:</p>
          <ul class="help-legend help-legend--links">
            <li><span class="link-legend link-legend--none">·</span> <strong>None</strong> — no effect on that gate</li>
            <li><span class="link-legend link-legend--same">S</span> <strong>Same (S)</strong> — linked gate moves the same direction</li>
            <li><span class="link-legend link-legend--opposite">O</span> <strong>Opposite (O)</strong> — linked gate moves the other way</li>
          </ul>
        </div>
      </div>
    </section>

    <label class="gate-select">
      <span>Number of gates</span>
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
    <p class="panel-hint">Shortest legal move sequence. Consecutive identical presses are grouped.</p>
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
