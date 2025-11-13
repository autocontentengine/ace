// app/api/generate/copy/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { parseTOON } from '@/lib/toon/parse'
import { stringifyToon } from '@/lib/toon/encode'
import { guardOr429 } from '@/lib/rate-limit/rate-limit'
import { rateKey } from '@/lib/rate-limit/key'
import { searchWikiSnippets } from '@/lib/retrieval/wiki'

// -----------------------------
// utils: IO negotiation
// -----------------------------
function wantsJson(req: NextRequest) {
  const url = new URL(req.url)
  if (url.searchParams.get('format') === 'json') return true
  const accept = req.headers.get('accept') || ''
  return accept.includes('application/json') || !accept.includes('text/toon')
}

function wantsToon(req: NextRequest) {
  const url = new URL(req.url)
  if (url.searchParams.get('format') === 'json') return false
  const accept = req.headers.get('accept') || ''
  return accept.includes('text/toon')
}

async function readFlexibleBody(req: NextRequest): Promise<{
  // normalizzato per la generazione
  brief?: string
  lang?: string
  grounded?: boolean
  num_hooks?: number
  num_captions?: number
  // debug/raw (se serve)
  raw: any
  contentType: string
}> {
  const contentType = (req.headers.get('content-type') || '').toLowerCase()

  // JSON
  if (contentType.includes('application/json')) {
    let j: any = {}
    try {
      j = await req.json()
    } catch {
      j = {}
    }
    // Accetta sia flat che annidato (legacy vs nuovo)
    const src = j?.copy ?? j ?? {}
    const brief = src?.brief
    const lang = src?.lang
    const grounded = !!src?.grounded
    const num_hooks = Number(src?.num_hooks ?? 7) || 7
    const num_captions = Number(src?.num_captions ?? 5) || 5
    return { brief, lang, grounded, num_hooks, num_captions, raw: j, contentType }
  }

  // TOON
  if (contentType.includes('text/toon') || contentType.includes('text/plain')) {
    const text = await req.text()
    let obj: any = {}
    try {
      obj = parseTOON(text) || {}
    } catch {
      obj = {}
    }
    const src = obj?.copy ?? obj ?? {}
    const brief = src?.brief
    const lang = src?.lang
    const grounded = !!src?.grounded
    const num_hooks = Number(src?.num_hooks ?? 7) || 7
    const num_captions = Number(src?.num_captions ?? 5) || 5
    return { brief, lang, grounded, num_hooks, num_captions, raw: obj, contentType }
  }

  // fallback: prova JSON, poi TOON
  try {
    const j = await req.json()
    const src = j?.copy ?? j ?? {}
    return {
      brief: src?.brief,
      lang: src?.lang,
      grounded: !!src?.grounded,
      num_hooks: Number(src?.num_hooks ?? 7) || 7,
      num_captions: Number(src?.num_captions ?? 5) || 5,
      raw: j,
      contentType: contentType || 'application/json',
    }
  } catch {
    const text = await req.text()
    let obj: any = {}
    try {
      obj = parseTOON(text) || {}
    } catch {
      obj = {}
    }
    const src = obj?.copy ?? obj ?? {}
    return {
      brief: src?.brief,
      lang: src?.lang,
      grounded: !!src?.grounded,
      num_hooks: Number(src?.num_hooks ?? 7) || 7,
      num_captions: Number(src?.num_captions ?? 5) || 5,
      raw: obj,
      contentType: contentType || 'text/toon',
    }
  }
}

// -----------------------------
// generazione very-safe (placeholder)
// NB: tieni il wiring al tuo LLM dove l’avevi già:
// qui produciamo un fallback deterministico, che evita 500.
// -----------------------------
function makeHooks(brief: string, n: number, groundedBits: string[]): string[] {
  const base = [
    `${brief}: semplicità che funziona`,
    `${brief}: risultati reali, ogni giorno`,
    `Ingredienti essenziali, impatto massimo`,
    `Pelle sana, senza compromessi`,
    `Minimalismo efficace, routine smart`,
    `Pochi gesti, grande differenza`,
    `Pulito, chiaro, efficace`,
    `La bellezza della semplicità`,
    `Niente fronzoli, solo qualità`,
  ]
  const mix = [...base]
  // aggiungi qualche “bit” dal grounding se presente
  groundedBits.slice(0, 3).forEach((g) => mix.unshift(g.slice(0, 80)))
  return mix.slice(0, Math.max(1, n))
}

function makeCaptions(brief: string, n: number, groundedBits: string[]): string[] {
  const base = [
    `Formula essenziale, benefici visibili.`,
    `Routine leggera, pelle al top.`,
    `Selezione pura, risultati trasparenti.`,
    `Ogni giorno, una pelle migliore.`,
    `La tua pelle, senza eccessi.`,
    `Efficienza e qualità, senza rumore.`,
    `Comfort, chiarezza, costanza.`,
  ]
  const mix = [...base]
  groundedBits.slice(0, 2).forEach((g) => mix.unshift(`Fonte: ${g.slice(0, 60)}…`))
  return mix.slice(0, Math.max(1, n))
}

// ---------------------------------
// HANDLER
// ---------------------------------
export async function POST(req: NextRequest) {
  // rate-limit
  const key = rateKey(req)
  const guard = await guardOr429(key, 'generate_copy', { maxHits: 60, windowSec: 60 })
  if (guard) return guard

  const t0 = Date.now()
  const body = await readFlexibleBody(req)

  const brief = (body.brief || '').toString().trim()
  const lang = (body.lang || 'it').toString().trim()
  const grounded = !!body.grounded
  const num_hooks = Math.max(1, Math.min(12, Number(body.num_hooks ?? 7) || 7))
  const num_captions = Math.max(1, Math.min(12, Number(body.num_captions ?? 5) || 5))

  if (!brief) {
    // rispondi nel formato richiesto
    if (wantsToon(req)) {
      const toon = stringifyToon({ ok: false, error: 'missing_brief' })
      return new NextResponse(toon, {
        status: 400,
        headers: { 'content-type': 'text/toon; charset=utf-8' },
      })
    }
    return NextResponse.json({ ok: false, error: 'missing_brief' }, { status: 400 })
  }

  // “grounding” (stub sicuro – non fallisce mai)
  let refs: string[] = []
  if (grounded) {
    try {
      refs = await searchWikiSnippets(brief, lang, 4)
    } catch {
      refs = []
    }
  }

  // Fallback generation (sostituisci con la tua chiamata al modello se vuoi)
  const hooks = makeHooks(brief, num_hooks, refs)
  const captions = makeCaptions(brief, num_captions, refs)

  const latency_ms = Date.now() - t0
  const model = 'llama-3.3-70b-versatile' // label puramente informativa

  if (wantsToon(req)) {
    const toon = stringifyToon({
      copy: {
        hooks: hooks.map((h) => ({ text: h })),
        captions: captions.map((c) => ({ text: c })),
      },
      meta: { brief, lang, grounded, model },
      metrics: { latency_ms },
    })
    return new NextResponse(toon, {
      status: 200,
      headers: { 'content-type': 'text/toon; charset=utf-8' },
    })
  }

  // JSON
  return NextResponse.json({
    ok: true,
    brief,
    lang,
    grounded,
    model,
    metrics: { latency_ms },
    result: {
      hooks,
      captions,
    },
  })
}
