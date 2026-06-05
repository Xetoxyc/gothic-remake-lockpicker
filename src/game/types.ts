export const CARD_COUNT = 6 // maximum number of gates we keep state for
export const MIN_GATE_COUNT = 4
export const MAX_GATE_COUNT = CARD_COUNT
export const HOLE_COUNT = 7
export const DEFAULT_SOLUTION_PIN = 3 // hole 4

export type LinkType = 'none' | 'same' | 'opposite'

export type CardState = {
  startPin: number | null
  correctPin: number | null
  currentPin: number | null
}

export type GameState = {
  // Number of active gates (4, 5, or 6). We always keep CARD_COUNT cards/links
  // in memory so changing the gate count never loses data; only the first
  // gateCount entries are rendered and solved.
  gateCount: number
  cards: CardState[]
  links: LinkType[][]
}

export function createEmptyCard(): CardState {
  return {
    startPin: null,
    correctPin: DEFAULT_SOLUTION_PIN,
    currentPin: null,
  }
}

export function createEmptyCards(): CardState[] {
  return Array.from({ length: CARD_COUNT }, createEmptyCard)
}

export function createEmptyLinks(): LinkType[][] {
  return Array.from({ length: CARD_COUNT }, () =>
    Array.from({ length: CARD_COUNT }, () => 'none' as LinkType),
  )
}

export function createGameState(): GameState {
  return {
    gateCount: MAX_GATE_COUNT,
    cards: createEmptyCards(),
    links: createEmptyLinks(),
  }
}

export function clampGateCount(value: number): number {
  if (!Number.isFinite(value)) return MAX_GATE_COUNT
  return Math.min(MAX_GATE_COUNT, Math.max(MIN_GATE_COUNT, Math.round(value)))
}

export const LINK_CYCLE: LinkType[] = ['none', 'same', 'opposite']

export function nextLinkType(current: LinkType): LinkType {
  const index = LINK_CYCLE.indexOf(current)
  return LINK_CYCLE[(index + 1) % LINK_CYCLE.length]
}

export function linkLabel(type: LinkType): string {
  switch (type) {
    case 'same':
      return 'S'
    case 'opposite':
      return 'O'
    default:
      return ''
  }
}
