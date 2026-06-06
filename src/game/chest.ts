import type { SolveMove } from './solver'
import {
  clampGateCount,
  CARD_COUNT,
  DEFAULT_GATE_COUNT,
  createEmptyCard,
  type GameState,
  type LinkType,
} from './types'

export type ChestRecord = {
  name: string
  // Optional for backward compatibility: older saves had no gateCount and were
  // always 6 gates. When missing we fall back to the number of saved pins.
  gateCount?: number
  initialPins: (number | null)[]
  solutionPins: (number | null)[]
  links?: LinkType[][]
  solutionMoves?: SolveMove[]
}

export type ChestListItem = {
  id: string
  name: string
}

export function gameStateToChest(
  name: string,
  state: GameState,
  solutionMoves?: SolveMove[],
): ChestRecord {
  const gateCount = clampGateCount(state.gateCount ?? DEFAULT_GATE_COUNT)

  const chest: ChestRecord = {
    name: name.trim(),
    gateCount,
    initialPins: state.cards
      .slice(0, gateCount)
      .map((card) => (card.startPin === null ? null : card.startPin + 1)),
    solutionPins: state.cards
      .slice(0, gateCount)
      .map((card) => (card.correctPin === null ? null : card.correctPin + 1)),
    links: state.links.slice(0, gateCount).map((row) => row.slice(0, gateCount)),
  }

  if (solutionMoves !== undefined) {
    chest.solutionMoves = solutionMoves.map((move) => ({ ...move }))
  }

  return chest
}

export function applyChestToGameState(state: GameState, chest: ChestRecord): void {
  const gateCount = clampGateCount(chest.gateCount ?? chest.initialPins.length)
  state.gateCount = gateCount

  for (let i = 0; i < CARD_COUNT; i++) {
    if (i < gateCount) {
      const initial = chest.initialPins[i] ?? null
      const solution = chest.solutionPins[i] ?? null

      const startIndex = initial === null ? null : initial - 1
      const correctIndex = solution === null ? null : solution - 1

      state.cards[i].startPin = startIndex
      state.cards[i].currentPin = startIndex
      state.cards[i].correctPin = correctIndex
    } else {
      // Reset inactive gates to defaults so stale data never leaks in.
      Object.assign(state.cards[i], createEmptyCard())
    }
  }

  for (let i = 0; i < CARD_COUNT; i++) {
    for (let j = 0; j < CARD_COUNT; j++) {
      state.links[i][j] =
        i < gateCount && j < gateCount ? chest.links?.[i]?.[j] ?? 'none' : 'none'
    }
  }
}

type ChestBackend = {
  list: () => Promise<ChestListItem[]>
  get: (id: string) => Promise<ChestRecord>
  save: (chest: ChestRecord) => Promise<ChestListItem>
  remove: (id: string) => Promise<void>
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'chest'
  )
}

// --- localStorage backend ---------------------------------------------------

const STORAGE_KEY = 'gothic.chests'

function readStore(): Record<string, ChestRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ChestRecord>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store: Record<string, ChestRecord>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

const localBackend: ChestBackend = {
  async list() {
    const store = readStore()
    return Object.entries(store)
      .map(([id, chest]) => ({ id, name: chest.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  },
  async get(id) {
    const chest = readStore()[id]
    if (!chest) throw new Error('Chest not found')
    return chest
  },
  async save(chest) {
    const id = slugify(chest.name)
    const store = readStore()
    store[id] = chest
    writeStore(store)
    return { id, name: chest.name }
  },
  async remove(id) {
    const store = readStore()
    if (!store[id]) throw new Error('Chest not found')
    delete store[id]
    writeStore(store)
  },
}

// --- file backend (Vite dev API at /api/chests) -----------------------------

const fileBackend: ChestBackend = {
  async list() {
    const response = await fetch('/api/chests')
    if (!response.ok) throw new Error('Failed to load chest list')
    return response.json() as Promise<ChestListItem[]>
  },
  async get(id) {
    const response = await fetch(`/api/chests/${id}`)
    if (!response.ok) throw new Error('Chest not found')
    return response.json() as Promise<ChestRecord>
  },
  async save(chest) {
    const response = await fetch('/api/chests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chest),
    })
    if (!response.ok) throw new Error('Failed to save chest')
    return response.json() as Promise<ChestListItem>
  },
  async remove(id) {
    const response = await fetch(`/api/chests/${id}`, { method: 'DELETE' })
    if (!response.ok) throw new Error('Failed to delete chest')
  },
}

// --- backend selection ------------------------------------------------------

const backendName = String(import.meta.env.VITE_STORAGE_BACKEND ?? 'local')
  .trim()
  .toLowerCase()

const backend: ChestBackend = backendName === 'file' ? fileBackend : localBackend

export function getStorageBackendName(): 'file' | 'local' {
  return backend === fileBackend ? 'file' : 'local'
}

export function listChests(): Promise<ChestListItem[]> {
  return backend.list()
}

export function getChest(id: string): Promise<ChestRecord> {
  return backend.get(id)
}

export function saveChest(chest: ChestRecord): Promise<ChestListItem> {
  return backend.save(chest)
}

export function deleteChest(id: string): Promise<void> {
  return backend.remove(id)
}
