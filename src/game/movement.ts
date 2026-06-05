import { CARD_COUNT, HOLE_COUNT, type LinkType } from './types'

export type Direction = 'left' | 'right'

export function getMoveDeltas(
  links: LinkType[][],
  cardIndex: number,
  direction: Direction,
  cardCount: number = CARD_COUNT,
): Map<number, number> {
  const step = direction === 'left' ? 1 : -1
  const deltas = new Map<number, number>()

  deltas.set(cardIndex, step)

  for (let to = 0; to < cardCount; to++) {
    if (to === cardIndex) continue

    const link = links[cardIndex][to]
    if (link === 'same') deltas.set(to, step)
    if (link === 'opposite') deltas.set(to, -step)
  }

  return deltas
}

// The lock has hard walls: hole 1 (index 0) is the far left, hole 7
// (index HOLE_COUNT - 1) is the far right. Pins do not wrap around, so a move is
// only legal if every affected pin stays within bounds. Returns the resulting
// positions, or null if the move would push any pin past an edge.
export function simulateMove(
  positions: number[],
  links: LinkType[][],
  cardIndex: number,
  direction: Direction,
  cardCount: number = CARD_COUNT,
): number[] | null {
  if (positions[cardIndex] === undefined) return null

  const deltas = getMoveDeltas(links, cardIndex, direction, cardCount)
  const next = positions.slice()

  for (const [index, step] of deltas) {
    const value = positions[index] + step
    if (value < 0 || value >= HOLE_COUNT) return null
    next[index] = value
  }

  return next
}
