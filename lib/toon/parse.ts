// lib/toon/parse.ts
export type Json = null | boolean | number | string | Json[] | { [k: string]: Json }

type Line = { indent: number; raw: string }

function toLines(s: string): Line[] {
  return s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((raw) => {
      const m = raw.match(/^(\s*)/)
      const indent = m ? Math.floor((m[1]?.length ?? 0) / 2) : 0
      return { indent, raw: raw.trimEnd() }
    })
    .filter((l) => l.raw.trim() !== '')
}

function parseScalar(v: string): Json {
  const t = v.trim()
  if (t === 'null') return null
  if (t === 'true') return true
  if (t === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  return t
}

/** Parsea blocchi del tipo:
 *  hooks[3]{text}:
 *    riga1
 *    riga2
 *    riga3
 */
function isArrayHeader(s: string) {
  return /^([A-Za-z0-9_]+)\[(\d+)\]\{[A-Za-z0-9_,\s]+\}:$/.test(s.trim())
}
function parseArrayHeaderKey(s: string) {
  const m = s.trim().match(/^([A-Za-z0-9_]+)\[(\d+)\]\{([A-Za-z0-9_,\s]+)\}:$/)
  if (!m) return null
  return { key: m[1]!, count: Number(m[2]!), cols: m[3]!.split(',').map((x) => x.trim()) }
}

export function parseTOON(input: string): Record<string, Json> {
  const lines = toLines(input)
  const root: Record<string, Json> = {}
  const stack: Array<{ obj: Record<string, Json>; indent: number }> = [{ obj: root, indent: -1 }]

  let i = 0
  while (i < lines.length) {
    const { indent, raw } = lines[i]!
    // gestisci indent
    while (stack.length && indent <= stack[stack.length - 1]!.indent) stack.pop()
    const ctx = stack[stack.length - 1]!.obj

    const t = raw.trim()
    // array header
    if (isArrayHeader(t)) {
      const head = parseArrayHeaderKey(t)!
      i++
      const arr: string[] = []
      while (i < lines.length && lines[i]!.indent > indent) {
        const row = lines[i]!.raw.trim()
        if (row.length) arr.push(row)
        i++
      }
      ctx[head.key] = arr
      continue
    }

    // sezione "key:" → nuovo oggetto
    if (t.endsWith(':') && !t.includes(' ')) {
      const key = t.slice(0, -1)
      const obj: Record<string, Json> = {}
      ctx[key] = obj
      stack.push({ obj, indent })
      i++
      continue
    }

    // kv "key: value"
    const kv = t.match(/^([^:]+):\s*(.*)$/)
    if (kv) {
      const key = kv[1]!.trim()
      const val = parseScalar(kv[2] ?? '')
      ctx[key] = val
      i++
      continue
    }

    // fallback: ignora riga
    i++
  }

  return root
}

/** Heuristica: il body sembra TOON? */
export function looksLikeTOON(s: string): boolean {
  if (!s) return false
  // euristiche sobrie: presenza di ":" su molte righe o header array
  const lines = s.split('\n')
  const colon = lines.filter((l) => l.includes(':')).length
  return colon >= Math.min(3, Math.ceil(lines.length / 2)) || /\[[0-9]+\]\{/.test(s)
}
