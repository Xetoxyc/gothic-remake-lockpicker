import './style.css'
import type { ChestRecord } from './game/chest'
import { mountChestPanel, saveChestFromPanel } from './game/chestPanel'
import { mountLockCards, updateLockCards } from './game/lockCards'
import { solveLock, type SolveMove } from './game/solver'
import { renderSolution, solutionViewHint, type SolutionView } from './game/solutionPanel'
import { clampGateCount, createGameState, resetGameState } from './game/types'

const state = createGameState()
let cachedSolutionMoves: SolveMove[] | undefined
let cachedSolutionResult: ReturnType<typeof solveLock> | undefined
let solutionView: SolutionView = 'moves'

type TabId = 'setup' | 'solution'

const MOBILE_MQ = window.matchMedia('(max-width: 767px)')

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main class="layout" data-active-tab="setup">
  <section class="game-area" aria-label="Game area">
    <header class="app-header">
      <h1 class="app-title">Gothic Lockpick Solver</h1>
      <p class="app-subtitle">Set up a lock, then press <strong>Solve</strong> for the shortest click sequence.</p>
    </header>

    <details class="help-panel" aria-label="How to use">
      <summary class="help-title">How it works</summary>
      <div class="help-grid">
        <div class="help-item help-item--wide">
          <h3>Orientation</h3>
          <p>In-game, the metal plates stack toward you. <strong>Gate 1</strong> is the plate furthest away; the highest gate number is the front plate where the lockpick enters. This tool lists gates top to bottom in that same order.</p>
          <p>On each plate, <strong>holes 1–7</strong> run left to right along the top row — match the red labels in the screenshot when setting start and target pins.</p>
          <figure class="help-figure">
            <img
              src="${import.meta.env.BASE_URL}lock-orientation.png"
              alt="Gothic lock plates numbered 1 through 6 from back to front, with holes 1 through 7 labeled left to right on the rearmost plate"
              width="794"
              height="601"
              loading="lazy"
            />
            <figcaption>Gate numbers (1 = back) and hole numbers (1 = left) as shown in-game.</figcaption>
          </figure>
        </div>
        <div class="help-item">
          <h3>Holes (1–7)</h3>
          <p>Each gate has seven holes, left to right. Pick where the pin <em>starts</em> and where it must <em>end up</em>.</p>
          <ul class="help-legend">
            <li>
              <span class="legend-swatch legend-swatch--start" aria-hidden="true"></span>
              <span class="help-desktop-only"><strong>Start pin</strong> — left-click a hole (gold inner ring)</span>
              <span class="help-mobile-only"><strong>Start pin</strong> — select Start mode, then tap a hole (gold inner ring)</span>
            </li>
            <li>
              <span class="legend-swatch legend-swatch--target" aria-hidden="true"></span>
              <span class="help-desktop-only"><strong>Target pin</strong> — right-click a hole (green outer ring). New gates default to hole 4.</span>
              <span class="help-mobile-only"><strong>Target pin</strong> — select Target mode, then tap a hole (green outer ring). New gates default to hole 4.</span>
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
    </details>

    <div class="gate-toolbar">
      <label class="gate-select">
        <span>Number of gates</span>
        <select id="gate-count" aria-label="Number of gates">
          <option value="4">4 gates</option>
          <option value="5">5 gates</option>
          <option value="6" selected>6 gates</option>
          <option value="7">7 gates</option>
        </select>
      </label>
      <button type="button" id="reset-lock" class="reset-btn">Reset</button>
    </div>
    <div id="lock-cards"></div>
  </section>

  <aside class="sidebar" aria-label="Sidebar">
    <div class="sidebar-chest">
      <div id="chest-panel"></div>
    </div>
    <div class="sidebar-solution">
      <div class="solution-header">
        <h2>Solution</h2>
        <div class="solution-view-toggle" role="radiogroup" aria-label="Solution format">
          <label class="solution-view-option">
            <input type="radio" name="solution-view" value="moves" checked />
            <span>Moves</span>
          </label>
          <label class="solution-view-option">
            <input type="radio" name="solution-view" value="input" />
            <span>Input chain</span>
          </label>
        </div>
      </div>
      <p class="panel-hint" id="solution-hint"></p>
      <ul id="inputs"></ul>
    </div>
  </aside>

  <nav class="tab-bar" role="tablist" aria-label="Main">
    <button type="button" class="tab-btn" role="tab" data-tab="setup" aria-selected="true">Setup</button>
    <button type="button" class="tab-btn" role="tab" data-tab="solution" aria-selected="false">Solution</button>
  </nav>
</main>
`

const layoutEl = document.querySelector<HTMLDivElement>('.layout')!
const lockCardsEl = document.querySelector<HTMLDivElement>('#lock-cards')!
const chestPanelEl = document.querySelector<HTMLDivElement>('#chest-panel')!
const inputsEl = document.querySelector<HTMLUListElement>('#inputs')!
const solutionHintEl = document.querySelector<HTMLParagraphElement>('#solution-hint')!
const solutionViewInputs = document.querySelectorAll<HTMLInputElement>(
  '.solution-view-toggle input[name="solution-view"]',
)
const gateCountEl = document.querySelector<HTMLSelectElement>('#gate-count')!
const resetLockEl = document.querySelector<HTMLButtonElement>('#reset-lock')!
const tabButtons = document.querySelectorAll<HTMLButtonElement>('.tab-bar [role="tab"]')

function isMobileLayout(): boolean {
  return MOBILE_MQ.matches
}

function setActiveTab(tab: TabId): void {
  layoutEl.dataset.activeTab = tab
  tabButtons.forEach((btn) => {
    const selected = btn.dataset.tab === tab
    btn.setAttribute('aria-selected', String(selected))
    btn.classList.toggle('tab-btn--active', selected)
  })

  if (tab === 'setup') {
    layoutEl.scrollTo(0, 0)
  } else {
    document.querySelector<HTMLElement>('.sidebar-solution')?.scrollTo(0, 0)
  }
}

function syncGateSelect(): void {
  gateCountEl.value = String(clampGateCount(state.gateCount))
}

function refreshCards(): void {
  updateLockCards(lockCardsEl, state)
}

function syncSolutionHint(): void {
  solutionHintEl.textContent = solutionViewHint(solutionView)
}

function renderCachedSolution(): void {
  if (!cachedSolutionResult) {
    inputsEl.innerHTML = ''
    return
  }

  renderSolution(inputsEl, cachedSolutionResult, {
    view: solutionView,
    gateCount: clampGateCount(state.gateCount),
  })
}

function handleChestLoad(chest?: ChestRecord): void {
  cachedSolutionMoves = chest?.solutionMoves
  cachedSolutionResult =
    cachedSolutionMoves !== undefined ? { ok: true, moves: cachedSolutionMoves } : undefined
  syncGateSelect()
  remountCards()
  renderCachedSolution()
}

async function runSolve(): Promise<void> {
  const result = solveLock(state)
  cachedSolutionResult = result
  renderCachedSolution()

  if (result.ok && isMobileLayout()) {
    setActiveTab('solution')
  }

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

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    setActiveTab(btn.dataset.tab as TabId)
  })
})

function resetLock(): void {
  resetGameState(state)
  cachedSolutionMoves = undefined
  cachedSolutionResult = undefined
  inputsEl.innerHTML = ''
  remountCards()
}

gateCountEl.addEventListener('change', () => {
  state.gateCount = clampGateCount(Number(gateCountEl.value))
  cachedSolutionMoves = undefined
  cachedSolutionResult = undefined
  inputsEl.innerHTML = ''
  remountCards()
})

solutionViewInputs.forEach((input) => {
  input.addEventListener('change', () => {
    if (!input.checked) return
    solutionView = input.value as SolutionView
    syncSolutionHint()
    renderCachedSolution()
  })
})

resetLockEl.addEventListener('click', resetLock)

syncGateSelect()
syncSolutionHint()
setActiveTab('setup')
remountCards()

mountChestPanel(chestPanelEl, {
  state,
  onLoad: handleChestLoad,
  getSolutionMoves: () => cachedSolutionMoves,
})
