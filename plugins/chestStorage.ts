import fs from 'node:fs/promises'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

type LinkType = 'none' | 'same' | 'opposite'
type SolveMove = { card: number; direction: 'left' | 'right' }

export type ChestRecord = {
  name: string
  gateCount?: number
  initialPins: (number | null)[]
  solutionPins: (number | null)[]
  links?: LinkType[][]
  solutionMoves?: SolveMove[]
}

type ChestListItem = {
  id: string
  name: string
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

function chestPath(chestsDir: string, id: string): string {
  const safeId = id.replace(/[^a-z0-9-]/g, '')
  return path.join(chestsDir, `${safeId}.json`)
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function isValidChest(data: unknown): data is ChestRecord {
  if (!data || typeof data !== 'object') return false
  const chest = data as ChestRecord
  if (typeof chest.name !== 'string' || !chest.name.trim()) return false
  if (!Array.isArray(chest.initialPins)) return false

  const gateCount = chest.initialPins.length
  if (gateCount < 4 || gateCount > 7) return false

  if (chest.gateCount !== undefined && chest.gateCount !== gateCount) return false
  if (!Array.isArray(chest.solutionPins) || chest.solutionPins.length !== gateCount) {
    return false
  }

  const isValidPin = (pin: unknown) =>
    pin === null || (typeof pin === 'number' && Number.isInteger(pin) && pin >= 1 && pin <= 7)

  if (!chest.initialPins.every(isValidPin) || !chest.solutionPins.every(isValidPin)) {
    return false
  }

  if (chest.links !== undefined) {
    if (!Array.isArray(chest.links) || chest.links.length !== gateCount) return false
    if (
      !chest.links.every(
        (row) =>
          Array.isArray(row) &&
          row.length === gateCount &&
          row.every((cell) => cell === 'none' || cell === 'same' || cell === 'opposite'),
      )
    ) {
      return false
    }
  }

  if (chest.solutionMoves !== undefined) {
    if (!Array.isArray(chest.solutionMoves)) return false
    if (
      !chest.solutionMoves.every(
        (move) =>
          move &&
          typeof move === 'object' &&
          typeof move.card === 'number' &&
          Number.isInteger(move.card) &&
          move.card >= 1 &&
          move.card <= gateCount &&
          (move.direction === 'left' || move.direction === 'right'),
      )
    ) {
      return false
    }
  }

  return true
}

function getPathname(url: string | undefined): string {
  if (!url) return ''
  return url.split('?')[0]?.split('#')[0] ?? ''
}

export function chestStoragePlugin(chestsDir: string): Plugin {
  const handler = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void,
  ): Promise<void> => {
    const pathname = getPathname(req.url)
    if (!pathname.startsWith('/api/chests')) return next()

    try {
      await fs.mkdir(chestsDir, { recursive: true })

      if (pathname === '/api/chests' && req.method === 'GET') {
        const files = await fs.readdir(chestsDir)
        const chests: ChestListItem[] = []

        for (const file of files) {
          if (!file.endsWith('.json')) continue
          const id = file.slice(0, -5)
          const raw = await fs.readFile(path.join(chestsDir, file), 'utf8')
          const data = JSON.parse(raw) as ChestRecord
          chests.push({ id, name: data.name })
        }

        chests.sort((a, b) => a.name.localeCompare(b.name))
        sendJson(res, 200, chests)
        return
      }

      if (pathname === '/api/chests' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req)) as ChestRecord
        if (!isValidChest(body)) {
          sendJson(res, 400, { error: 'Invalid chest data' })
          return
        }

        const id = slugify(body.name)
        const filePath = chestPath(chestsDir, id)
        await fs.writeFile(filePath, `${JSON.stringify(body, null, 2)}\n`, 'utf8')
        sendJson(res, 200, { id, name: body.name })
        return
      }

      const match = pathname.match(/^\/api\/chests\/([a-z0-9-]+)$/)
      if (match) {
        const id = match[1]
        const filePath = chestPath(chestsDir, id)

        if (req.method === 'GET') {
          try {
            const raw = await fs.readFile(filePath, 'utf8')
            sendJson(res, 200, JSON.parse(raw))
          } catch {
            sendJson(res, 404, { error: 'Chest not found' })
          }
          return
        }

        if (req.method === 'DELETE') {
          try {
            await fs.unlink(filePath)
            sendJson(res, 200, { ok: true })
          } catch {
            sendJson(res, 404, { error: 'Chest not found' })
          }
          return
        }
      }

      sendJson(res, 405, { error: 'Method not allowed' })
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Server error',
      })
    }
  }

  return {
    name: 'chest-storage',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}
