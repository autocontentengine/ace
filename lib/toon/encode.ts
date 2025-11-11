// lib/toon/encode.ts
//
// TOON: formato testuale minimale stile "YAML-light"
// Obiettivo: parsing/serializzazione semplice per request/response API.
//
// Supporta:
// - key: value
// - annidamento via indentazione (2 spazi)
// - numeri/boolean/null auto-cast
// - oggetti annidati
//
// NON ha bisogno di array per le request dei nostri endpoint (ma la stringify
// gestisce array in forma semplice).

function toPrimitive(v: string): any {
  const t = v.trim()
  if (t === '') return ''
  if (t === 'null') return null
  if (t === 'true') return true
  if (t === 'false') return false
  const n = Number(t)
  if (!Number.isNaN(n) && Number.isFinite(n)) return n
  return t
}

type StackItem = { indent: number; obj: any; key: string | null }

/** Parser TOON minimale. */
export function parseToon(input: string): any {
  const text = (input || '').replace(/\r\n/g, '\n')
  const lines = text.split('\n')

  const root: any = {}
  const stack: StackItem[] = [{ indent: -1, obj: root, key: null }]

  for (const raw of lines) {
    const line = raw.replace(/\t/g, '  ').replace(/\s+$/g, '')
    if (!line.trim()) continue

    const indentSpaces = line.match(/^ */)?.[0]?.length ?? 0
    const indent = Math.floor(indentSpaces / 2)
    const content = line.slice(indent * 2)

    // separatore chiave:valore (prima ':')
    const idx = content.indexOf(':')
    if (idx === -1) {
      // riga malformata → ignoriamo
      continue
    }
    const keyRaw = content.slice(0, idx).trim()
    const valueRaw = content.slice(idx + 1).trim()

    // normalizza chiave eliminando eventuali suffissi come [7]{text} (non servono in input)
    const key = keyRaw.replace(/\[.*?\]|\{.*?\}/g, '').trim()

    // sistema lo stack in base all'indent corrente
    while (stack.length && stack[stack.length - 1].indent >= indent) {
      stack.pop()
    }
    const parent = stack[stack.length - 1]?.obj
    if (!parent || typeof parent !== 'object') continue

    if (valueRaw === '') {
      // "key:" → nuovo oggetto annidato
      const obj: any = {}
      parent[key] = obj
      stack.push({ indent, obj, key })
    } else {
      // "key: value"
      parent[key] = toPrimitive(valueRaw)
    }
  }

  return root
}

/** Serializzatore TOON semplice (per debug/risposte). */
export function stringifyToon(value: any, indent = 0): string {
  const pad = (n: number) => '  '.repeat(n)

  if (value === null) return 'null'
  if (typeof value !== 'object') {
    if (typeof value === 'string') return value
    return String(value)
  }

  if (Array.isArray(value)) {
    // forma compatta:
    // key:
    //   - a
    //   - b
    return value
      .map(
        (item) =>
          `${pad(indent)}- ${typeof item === 'object' ? '\n' + stringifyToon(item, indent + 1) : stringifyToon(item, 0)}`
      )
      .join('\n')
  }

  // oggetto
  const lines: string[] = []
  for (const k of Object.keys(value)) {
    const v = value[k]
    if (v === null || typeof v !== 'object') {
      lines.push(
        `${pad(indent)}${k}: ${v === null ? 'null' : typeof v === 'string' ? v : String(v)}`
      )
    } else if (Array.isArray(v)) {
      lines.push(`${pad(indent)}${k}:`)
      for (const item of v) {
        if (item === null || typeof item !== 'object') {
          lines.push(
            `${pad(indent + 1)}- ${item === null ? 'null' : typeof item === 'string' ? item : String(item)}`
          )
        } else {
          lines.push(`${pad(indent + 1)}-`)
          lines.push(stringifyToon(item, indent + 2))
        }
      }
    } else {
      lines.push(`${pad(indent)}${k}:`)
      lines.push(stringifyToon(v, indent + 1))
    }
  }
  return lines.join('\n')
}

/** Utility: content-type preferito TOON? */
export function wantsToon(req: Request | { headers: Headers }): boolean {
  const h = req.headers.get('accept') || ''
  return /text\/toon/i.test(h)
}

/** Utility: content-type è TOON? */
export function isToonContent(req: Request | { headers: Headers }): boolean {
  const h = req.headers.get('content-type') || ''
  return /^text\/toon\b/i.test(h)
}
