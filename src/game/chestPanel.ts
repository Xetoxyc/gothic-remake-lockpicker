import {
  applyChestToGameState,
  deleteChest,
  gameStateToChest,
  getChest,
  listChests,
  saveChest,
  type ChestListItem,
  type ChestRecord,
} from './chest'
import type { SolveMove } from './solver'
import type { GameState } from './types'

type ChestPanelOptions = {
  state: GameState
  onLoad: (chest?: ChestRecord) => void
  getSolutionMoves?: () => SolveMove[] | undefined
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function setStatus(container: HTMLElement, message: string, isError = false): void {
  const status = container.querySelector<HTMLElement>('.chest-status')
  if (!status) return
  status.textContent = message
  status.classList.toggle('chest-status--error', isError)
}

export function getChestName(container: HTMLElement): string {
  return container.querySelector<HTMLInputElement>('#chest-name')?.value.trim() ?? ''
}

export async function saveChestFromPanel(
  container: HTMLElement,
  state: GameState,
  options: {
    solutionMoves?: SolveMove[]
    statusMessage?: string
    onLoad?: (chest?: ChestRecord) => void
  } = {},
): Promise<boolean> {
  const { solutionMoves, statusMessage, onLoad } = options
  const name = getChestName(container)
  if (!name) {
    setStatus(container, 'Enter a chest name to save solution', true)
    return false
  }

  try {
    const saved = await saveChest(gameStateToChest(name, state, solutionMoves))
    setStatus(container, statusMessage ?? `Saved "${saved.name}"`)
    if (onLoad) await renderChestList(container, onLoad, state)
    return true
  } catch {
    setStatus(container, 'Failed to save chest', true)
    return false
  }
}

async function renderChestList(
  container: HTMLElement,
  onLoad: (chest?: ChestRecord) => void,
  state: GameState,
): Promise<void> {
  const list = container.querySelector<HTMLUListElement>('#chest-list')
  if (!list) return

  let chests: ChestListItem[] = []
  try {
    chests = await listChests()
  } catch {
    list.innerHTML = '<li class="chest-empty">Could not load chests</li>'
    return
  }

  if (chests.length === 0) {
    list.innerHTML = '<li class="chest-empty">No saved chests yet</li>'
    return
  }

  list.innerHTML = chests
    .map(
      (chest) => `
      <li class="chest-item" data-id="${chest.id}">
        <span class="chest-item-name">${escapeHtml(chest.name)}</span>
        <div class="chest-item-actions">
          <button type="button" class="chest-btn chest-btn--load" data-id="${chest.id}">Load</button>
          <button type="button" class="chest-btn chest-btn--delete" data-id="${chest.id}">Del</button>
        </div>
      </li>
    `,
    )
    .join('')

  list.querySelectorAll<HTMLButtonElement>('.chest-btn--load').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const chest = await getChest(button.dataset.id!)
        applyChestToGameState(state, chest)
        const nameInput = container.querySelector<HTMLInputElement>('#chest-name')
        if (nameInput) nameInput.value = chest.name
        setStatus(container, `Loaded "${chest.name}"`)
        onLoad(chest)
      } catch {
        setStatus(container, 'Failed to load chest', true)
      }
    })
  })

  list.querySelectorAll<HTMLButtonElement>('.chest-btn--delete').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await deleteChest(button.dataset.id!)
        setStatus(container, 'Chest deleted')
        await renderChestList(container, onLoad, state)
      } catch {
        setStatus(container, 'Failed to delete chest', true)
      }
    })
  })
}

export function mountChestPanel(container: HTMLElement, options: ChestPanelOptions): void {
  const { state, onLoad, getSolutionMoves } = options

  container.innerHTML = `
    <section class="chest-panel">
      <h2>Chests</h2>
      <label class="chest-field">
        <span>Name</span>
        <input id="chest-name" type="text" placeholder="Chest name" />
      </label>
      <button type="button" id="chest-save" class="chest-save">Save chest</button>
      <p class="chest-status" aria-live="polite"></p>
      <ul id="chest-list" class="chest-list"></ul>
    </section>
  `

  container.querySelector<HTMLButtonElement>('#chest-save')!.addEventListener('click', async () => {
    await saveChestFromPanel(container, state, {
      solutionMoves: getSolutionMoves?.(),
      onLoad,
    })
  })

  void renderChestList(container, onLoad, state)
}
