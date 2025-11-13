// lib/toon/io.ts
import { NextRequest, NextResponse } from 'next/server'
import { parseTOON } from './parse'
import { stringifyToon } from './encode'

export type BodyFormat = 'json' | 'toon'
export type ReadBodyResult<T = any> = { data: T; format: BodyFormat }

function wantToon(req: NextRequest) {
  const accept = req.headers.get('accept') || ''
  return accept.includes('text/toon')
}

export function negotiateFormat(req: NextRequest): BodyFormat {
  return wantToon(req) ? 'toon' : 'json'
}

export async function readBody<T = any>(req: NextRequest): Promise<ReadBodyResult<T>> {
  const ctype = (req.headers.get('content-type') || '').toLowerCase()

  // text/toon
  if (ctype.includes('text/toon')) {
    const raw = await req.text()
    const obj = parseTOON(raw) as T
    return { data: obj, format: 'toon' }
  }

  // application/json
  if (ctype.includes('application/json')) {
    const json = await req.json()
    return { data: json as T, format: 'json' }
  }

  // fallback: prova JSON poi TOON
  const raw = await req.text()
  try {
    const j = JSON.parse(raw)
    return { data: j as T, format: 'json' }
  } catch {
    try {
      const t = parseTOON(raw)
      return { data: t as T, format: 'toon' }
    } catch {
      return { data: {} as T, format: 'json' }
    }
  }
}

// writer helpers
export function writeJson(obj: unknown, init?: ResponseInit) {
  return NextResponse.json(obj, init)
}

export function writeToon(obj: unknown, init?: ResponseInit) {
  const body = stringifyToon(obj)
  return new NextResponse(body, {
    ...init,
    headers: {
      'content-type': 'text/toon; charset=utf-8',
      ...(init?.headers || {}),
    },
  })
}

/* ---------- Back-compat exports ---------- */

// Vecchio nome: accetta sia TOON che JSON e ritorna { data, format }
export async function readToonOrJson<T = any>(req: NextRequest): Promise<ReadBodyResult<T>> {
  return readBody<T>(req)
}

// Vecchio nome: restituisce stringa TOON da un oggetto
export function toonFromObject(obj: unknown): string {
  return stringifyToon(obj)
}

// Re-export richiesto dagli endpoint che importano da '@/lib/toon/io'
export { stringifyToon }
