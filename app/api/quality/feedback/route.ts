// app/api/quality/feedback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseTOON } from '@/lib/toon/parse'
import { stringifyToon } from '@/lib/toon/encode'

// Supabase (best-effort)
import { createClient } from '@supabase/supabase-js'
const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FeedbackSchema = z.object({
  endpoint: z.string().min(1),
  latency_ms: z.number().int().nonnegative().optional(),
  auto_score: z.number().min(0).max(10).optional(),
  manual_score: z.number().min(0).max(10).optional(),
  notes: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(), // key+value type richiesti in questa zod
})

function preferToon(req: NextRequest): boolean {
  const a = req.headers.get('accept')?.toLowerCase() ?? ''
  return a.includes('text/toon')
}

async function readBody(req: NextRequest): Promise<{
  endpoint: string
  latency_ms?: number
  auto_score?: number
  manual_score?: number
  notes?: string
  meta?: Record<string, unknown>
}> {
  const ct = req.headers.get('content-type')?.toLowerCase() ?? ''
  if (ct.includes('text/toon')) {
    const raw = await req.text()
    const t = parseTOON(raw)
    const node = (t as any).feedback ?? {}
    const feedback = FeedbackSchema.parse(node)

    // Se meta era una stringa multi-linea, prova a convertirla in record
    if (!feedback.meta && typeof node.meta === 'string') {
      const meta: Record<string, unknown> = {}
      const lines = (node.meta as string).split('\n')
      lines.forEach((line: string) => {
        const m = line.match(/^\s*([\w.-]+):\s*(.+)\s*$/)
        if (m) {
          const k = m[1]
          const v = m[2]
          try {
            ;(meta as any)[k] = JSON.parse(v)
          } catch {
            if (v === 'true' || v === 'false') (meta as any)[k] = v === 'true'
            else if (!Number.isNaN(Number(v))) (meta as any)[k] = Number(v)
            else (meta as any)[k] = v
          }
        }
      })
      feedback.meta = meta
    }

    return feedback
  }

  // JSON annidato: { feedback: {...} }
  const j = await req.json().catch(() => ({}))
  const feedback = FeedbackSchema.parse(j?.feedback ?? {})
  return feedback
}

export async function POST(req: NextRequest) {
  try {
    const payload = await readBody(req)

    // Persistenza best-effort (non blocca la risposta)
    if (supabase) {
      const { error } = await supabase.from('quality_feedback').insert([
        {
          endpoint: payload.endpoint,
          latency_ms: payload.latency_ms ?? null,
          auto_score: payload.auto_score ?? null,
          manual_score: payload.manual_score ?? null,
          notes: payload.notes ?? null,
          meta: payload.meta ?? {},
        },
      ])
      if (error) {
        console.warn('[quality/feedback] supabase insert failed:', error.message)
        const resTOON = stringifyToon({ ok: true, warn: 'supabase_insert_failed' })
        return preferToon(req)
          ? new NextResponse(resTOON, {
              status: 200,
              headers: { 'content-type': 'text/toon; charset=utf-8' },
            })
          : NextResponse.json({ ok: true, warn: 'supabase_insert_failed' })
      }
    }

    const resTOON = stringifyToon({ ok: true })
    return preferToon(req)
      ? new NextResponse(resTOON, {
          status: 200,
          headers: { 'content-type': 'text/toon; charset=utf-8' },
        })
      : NextResponse.json({ ok: true })
  } catch (e) {
    const msg =
      e instanceof z.ZodError
        ? { error: 'invalid_payload', issues: e.format() }
        : { error: 'bad_request', message: e instanceof Error ? e.message : String(e) }

    const resTOON = stringifyToon({ ok: false, ...msg })
    return preferToon(req)
      ? new NextResponse(resTOON, {
          status: 400,
          headers: { 'content-type': 'text/toon; charset=utf-8' },
        })
      : NextResponse.json({ ok: false, ...msg }, { status: 400 })
  }
}
