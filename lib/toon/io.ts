// lib/toon/io.ts
import type { NextRequest } from 'next/server'
import { parseTOON, looksLikeTOON, type Json } from './parse'

export async function readToonOrJson(req: NextRequest): Promise<{ data: any; isTOON: boolean }> {
  const ctype = (req.headers.get('content-type') || '').toLowerCase()
  if (ctype.includes('text/toon') || ctype.includes('text/plain')) {
    const txt = await req.text()
    return { data: parseTOON(txt), isTOON: true }
  }
  // prova comunque a capire se è TOON anche se header è sbagliato
  const raw = await req.text().catch(() => '')
  if (looksLikeTOON(raw)) return { data: parseTOON(raw), isTOON: true }
  // fallback JSON
  try {
    const data = raw ? JSON.parse(raw) : {}
    return { data, isTOON: false }
  } catch {
    return { data: {}, isTOON: false }
  }
}

function pad(n: number) {
  return '  '.repeat(n)
}

export function toonFromObject(obj: Record<string, Json>, level = 0): string {
  const p = pad(level)
  const lines: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) {
      lines.push(`${p}${k}: null`)
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      lines.push(`${p}${k}: ${String(v)}`)
    } else if (typeof v === 'string') {
      lines.push(`${p}${k}: ${v}`)
    } else if (Array.isArray(v)) {
      lines.push(`${p}${k}[${v.length}]{text}:`)
      for (const item of v) lines.push(`${pad(level + 1)}${String(item)}`)
    } else {
      lines.push(`${p}${k}:`)
      lines.push(toonFromObject(v as Record<string, Json>, level + 1))
    }
  }
  return lines.join('\n')
}
