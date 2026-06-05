# Gothic Remake Lockpick Solver

A browser-based solver for the Gothic 1 / Gothic Remake lockpicking minigame. Set up a lock (start pins, target pins, and card links), hit **Solve**, and get the shortest click sequence to open it.

**Live demo:** https://xetoxyc.github.io/gothic-remake-lockpicker/

## Features

- **4, 5, or 6 gates** — select at the top to match the lock you are solving
- **Shortest solution** — bounded BFS finds the minimum number of clicks under hard-wall rules (pins stop at holes 1 and 7, no wraparound)
- **Card links** — direct one-hop links: Same (S) or Opposite (O) between any two gates
- **Chest save/load** — name and store lock setups for later
- **Compact solution view** — consecutive identical moves are grouped (`Card 1 - left x3`)

## How to use

1. **Start pin** — left-click a hole (inner ring)
2. **Correct pin** — right-click a hole (outer ring); new locks default to hole 4
3. **Links** — click cells in the grid next to each gate: empty → S → O
4. **Gate count** — pick 4, 5, or 6 gates at the top to match the lock
5. **Solve** — click the button below the gates; the move list appears on the right

Moves are shown as `gate - direction` (e.g. `3 - left` = slide gate 3 left).

## Local development

```bash
npm install
cp .env.example .env   # optional — see storage backends below
npm run dev
```

Open http://localhost:5173

### Storage backends

| Mode | Env value | Where chests are saved |
|------|-----------|------------------------|
| **local** (default for builds) | `VITE_STORAGE_BACKEND=local` | Browser `localStorage` |
| **file** (dev only) | `VITE_STORAGE_BACKEND=file` | `data/chests/*.json` via the Vite dev API |

Copy `.env.example` to `.env` and set `VITE_STORAGE_BACKEND=file` if you want chests as JSON files while developing locally. The deployed GitHub Pages site always uses `localStorage` — there is no server API in production.

Sample chests for local file mode live in `data/chests/`.

### Build

```bash
npm run build
npm run preview
```

For a local preview that matches GitHub Pages paths:

```bash
VITE_BASE_PATH=/gothic-remake-lockpicker/ npm run build
npm run preview
```

## GitHub Pages deployment

The repo includes `.github/workflows/deploy-pages.yml`. On every push to `main`, it builds the app and deploys the `dist` folder.

**Important:** In the repo **Settings → Pages**, set **Source** to **GitHub Actions**, not “Deploy from a branch”. If Pages serves the raw repository, the browser will request `/src/main.ts` and you will get 404 errors — only the built `dist` output works.

After a successful deploy, the site is at:

```
https://<username>.github.io/<repo-name>/
```

For this repo: https://xetoxyc.github.io/gothic-remake-lockpicker/

## Project layout

```
src/
  main.ts              App entry
  game/
    types.ts           Gate/card state
    movement.ts        Pin movement and wall rules
    solver.ts          BFS shortest-path solver
    lockCards.ts       Lock UI
    chest.ts           Chest persistence
    chestPanel.ts      Save/load panel
    solutionPanel.ts   Solution output
data/chests/           Example chest JSON (local file backend)
plugins/chestStorage.ts  Vite dev API for file storage
```

## Lock rules (solver model)

- 7 holes per gate, numbered 1–7 left to right
- Pressing a gate moves its pin; linked gates move in the same or opposite direction
- Links are **direct only** (one hop, no chaining)
- **Hard walls** — if any affected pin would leave holes 1–7, the move is blocked
- The solver returns the fewest legal clicks to reach all target pins
