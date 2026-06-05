import {
  HOLE_COUNT,
  linkLabel,
  nextLinkType,
  type CardState,
  type GameState,
  type LinkType,
} from './types'

function renderHole(
  cardIndex: number,
  holeIndex: number,
  card: CardState,
): string {
  const isCurrent = card.currentPin === holeIndex
  const isCorrect = card.correctPin === holeIndex

  return `
    <button
      type="button"
      class="hole"
      data-card="${cardIndex}"
      data-hole="${holeIndex}"
      aria-label="Card ${cardIndex + 1}, hole ${holeIndex + 1}"
      title="${holeIndex + 1}"
    >
      <span class="hole-socket"></span>
      <span class="hole-number">${holeIndex + 1}</span>
      ${isCurrent ? '<span class="pin-ring pin-ring--current" aria-hidden="true"></span>' : ''}
      ${isCorrect ? '<span class="pin-ring pin-ring--correct" aria-hidden="true"></span>' : ''}
    </button>
  `
}

function renderLinkCell(
  cardIndex: number,
  targetIndex: number,
  link: LinkType,
): string {
  const isSelf = cardIndex === targetIndex
  const label = isSelf ? '—' : linkLabel(link)

  return `
    <button
      type="button"
      class="link-cell${isSelf ? ' link-cell--disabled' : ''}"
      data-card="${cardIndex}"
      data-target="${targetIndex}"
      ${isSelf ? 'disabled' : ''}
      aria-label="Card ${cardIndex + 1} link to ${targetIndex + 1}: ${isSelf ? 'self' : link}"
      title="${isSelf ? '' : `${link || 'none'} → ${targetIndex + 1}`}"
    >${label}</button>
  `
}

function renderLinkGrid(cardIndex: number, links: LinkType[][], gateCount: number): string {
  const cells = Array.from({ length: gateCount }, (_, targetIndex) =>
    renderLinkCell(cardIndex, targetIndex, links[cardIndex][targetIndex]),
  ).join('')

  return `
    <div class="link-grid" aria-label="Card ${cardIndex + 1} links">
      <div class="link-grid-cells">${cells}</div>
      <div class="link-grid-labels">
        ${Array.from({ length: gateCount }, (_, i) => `<span>${i + 1}</span>`).join('')}
      </div>
    </div>
  `
}

function renderCard(
  cardIndex: number,
  card: CardState,
  links: LinkType[][],
  gateCount: number,
): string {
  const holes = Array.from({ length: HOLE_COUNT }, (_, holeIndex) =>
    renderHole(cardIndex, holeIndex, card),
  ).join('')

  return `
    <article class="card" data-card="${cardIndex}">
      <header class="card-label">${cardIndex + 1}</header>
      <div class="card-face">
        <div class="holes">${holes}</div>
      </div>
      ${renderLinkGrid(cardIndex, links, gateCount)}
    </article>
  `
}

function setPin(
  cards: CardState[],
  cardIndex: number,
  holeIndex: number,
  pin: 'startPin' | 'correctPin',
): void {
  const card = cards[cardIndex]
  const next = card[pin] === holeIndex ? null : holeIndex
  card[pin] = next

  if (pin === 'startPin') {
    card.currentPin = next
  }
}

function updateHoleRings(cardEl: HTMLElement, card: CardState): void {
  cardEl.querySelectorAll<HTMLButtonElement>('.hole').forEach((hole) => {
    const holeIndex = Number(hole.dataset.hole)
    const isCurrent = card.currentPin === holeIndex
    const isCorrect = card.correctPin === holeIndex

    hole.querySelector('.pin-ring--current')?.remove()
    hole.querySelector('.pin-ring--correct')?.remove()

    if (isCurrent) {
      hole.insertAdjacentHTML(
        'beforeend',
        '<span class="pin-ring pin-ring--current" aria-hidden="true"></span>',
      )
    }
    if (isCorrect) {
      hole.insertAdjacentHTML(
        'beforeend',
        '<span class="pin-ring pin-ring--correct" aria-hidden="true"></span>',
      )
    }
  })
}

function updateLinkCells(cardEl: HTMLElement, cardIndex: number, links: LinkType[][]): void {
  cardEl.querySelectorAll<HTMLButtonElement>('.link-cell:not(.link-cell--disabled)').forEach((cell) => {
    const targetIndex = Number(cell.dataset.target)
    const link = links[cardIndex][targetIndex]
    cell.textContent = linkLabel(link)
    cell.title = `${link || 'none'} → ${targetIndex + 1}`
    cell.setAttribute('aria-label', `Card ${cardIndex + 1} link to ${targetIndex + 1}: ${link}`)
  })
}

type LockCardsOptions = {
  onChange: () => void
  onSolve?: () => void
}

let mountController: AbortController | null = null

export function mountLockCards(
  container: HTMLElement,
  state: GameState,
  options: LockCardsOptions | (() => void),
): void {
  const { cards, links, gateCount } = state
  const onChange = typeof options === 'function' ? options : options.onChange
  const onSolve = typeof options === 'function' ? undefined : options.onSolve

  // Each remount replaces innerHTML but listeners on the container persist.
  // Abort the previous mount so clicks are not handled twice (which would
  // toggle a pin on and immediately back off).
  mountController?.abort()
  mountController = new AbortController()
  const { signal } = mountController

  container.innerHTML = `
    <div class="cards-grid">
      ${cards
        .slice(0, gateCount)
        .map((card, index) => renderCard(index, card, links, gateCount))
        .join('')}
    </div>
    <button type="button" id="solve-btn" class="solve-btn">Solve</button>
    <p class="card-hint">
      Click hole: start pin (inner). Right-click: correct pin (outer). Link grid: ∅ / S / O.
    </p>
  `

  container.querySelector<HTMLButtonElement>('#solve-btn')?.addEventListener(
    'click',
    () => {
      onSolve?.()
    },
    { signal },
  )

  container.addEventListener(
    'click',
    (event) => {
    const target = event.target as HTMLElement

    const linkCell = target.closest<HTMLButtonElement>('.link-cell:not(.link-cell--disabled)')
    if (linkCell) {
      const cardIndex = Number(linkCell.dataset.card)
      const targetIndex = Number(linkCell.dataset.target)
      links[cardIndex][targetIndex] = nextLinkType(links[cardIndex][targetIndex])
      onChange()
      return
    }

    const hole = target.closest<HTMLButtonElement>('.hole')
    if (!hole) return

    const cardIndex = Number(hole.dataset.card)
    const holeIndex = Number(hole.dataset.hole)
    setPin(cards, cardIndex, holeIndex, 'startPin')
    onChange()
  },
    { signal },
  )

  container.addEventListener(
    'contextmenu',
    (event) => {
      const hole = (event.target as HTMLElement).closest<HTMLButtonElement>('.hole')
      if (!hole) return

      event.preventDefault()
      const cardIndex = Number(hole.dataset.card)
      const holeIndex = Number(hole.dataset.hole)
      setPin(cards, cardIndex, holeIndex, 'correctPin')
      onChange()
    },
    { signal },
  )
}

export function updateLockCards(container: HTMLElement, state: GameState): void {
  const { cards, links, gateCount } = state

  cards.slice(0, gateCount).forEach((card, cardIndex) => {
    const cardEl = container.querySelector<HTMLElement>(`.card[data-card="${cardIndex}"]`)
    if (!cardEl) return

    updateHoleRings(cardEl, card)
    updateLinkCells(cardEl, cardIndex, links)
  })
}
