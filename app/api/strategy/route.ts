// app/api/strategy/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { guardOr429 } from '@/lib/rate-limit/rate-limit'
import { rateKey } from '@/lib/rate-limit/key'
import { negotiateFormat, readBody, stringifyToon } from '@/lib/toon/io'

// Accetta sia JSON flat che wrapped (TOON/JSON annidato)
const StrategyFlat = z.object({
  brand: z.string().min(1, 'brand required'),
  niche: z.string().min(1, 'niche required'),
  objective: z.string().min(1, 'objective required'),
  lang: z.string().default('en'),
})

const StrategyWrapped = z.object({ strategy: StrategyFlat })
type StrategyIn = z.infer<typeof StrategyFlat>

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // rate limit
  const key = rateKey(req)
  const guard = await guardOr429(key, 'strategy', { maxHits: 60, windowSec: 60 })
  if (guard) return guard

  // formato richiesto dal client (json|toon)
  const fmt = negotiateFormat(req)
  const wantsJson = fmt === 'json'

  // body (può essere JSON o TOON -> readBody normalizza in `data`)
  const { data } = await readBody(req)

  // normalizzazione: accetta sia wrapped che flat
  let input: StrategyIn
  const wrapped = StrategyWrapped.safeParse(data)
  if (wrapped.success) {
    input = wrapped.data.strategy
  } else {
    const flat = StrategyFlat.safeParse(data)
    if (flat.success) {
      input = flat.data
    } else {
      // restituisci errore in stile "missing_*" come negli altri endpoint
      const first = flat.error.issues[0]
      const missing = (first?.path?.[0] as string) || 'brand'
      return wantsJson
        ? NextResponse.json({ ok: false, error: `missing_${missing}` }, { status: 400 })
        : new NextResponse(`ok: false\nerror: missing_${missing}\n`, {
            status: 400,
            headers: { 'content-type': 'text/plain; charset=utf-8' },
          })
    }
  }

  // ----- Stub di strategia (sostituisci con la tua logica LLM) -----
  const plan = {
    pillars: [
      `${input.niche}: posizionamento e messaggio chiave (${input.lang})`,
      `${input.niche}: calendario editoriale per ${input.objective} (${input.lang})`,
      `${input.niche}: CTA e metriche di successo (${input.lang})`,
    ],
    channels: ['Instagram', 'TikTok', 'YouTube Shorts'],
    cadence: '3-5 post/settimana',
    examples: [
      'Hook educativi su ingredienti/benefici',
      'Before/After realistici (UGC-guided)',
      'Mini-guide “1 min di skincare”',
    ],
  }

  const resultJson = {
    ok: true,
    brand: input.brand,
    niche: input.niche,
    objective: input.objective,
    lang: input.lang,
    model: 'llama-3.3-70b-versatile',
    metrics: { latency_ms: 0 },
    result: plan,
  }

  if (wantsJson) {
    return NextResponse.json(resultJson)
  }

  // Output TOON
  const toon = stringifyToon({
    strategy: {
      brand: input.brand,
      niche: input.niche,
      objective: input.objective,
      lang: input.lang,
    },
    plan,
  })
  return new NextResponse(toon, {
    headers: { 'content-type': 'text/toon; charset=utf-8' },
  })
}
