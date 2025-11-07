// app/api/image/horde/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  prompt: string
  negative?: string
  width?: number
  height?: number
  steps?: number
  cfg_scale?: number
  sampler_name?: string
  n?: number
  model?: string[] // es. ["SDXL 1.0"] se disponibile in Horde
  nsfw?: boolean
  format?: 'binary' | 'base64' // default: binary (image/png)
}

const HORDE_BASE = 'https://aihorde.net/api/v2'
const API_KEY = process.env.HORDE_API_KEY?.trim() || '0000000000' // free anon
const DEFAULT_W = 768
const DEFAULT_H = 960

export async function POST(req: NextRequest) {
  try {
    const b = (await req.json()) as Body
    const prompt = (b.prompt || '').trim()
    if (!prompt) {
      return NextResponse.json({ ok: false, error: 'missing_prompt' }, { status: 400 })
    }

    const width = Number.isFinite(b.width) ? Math.min(1536, Math.max(512, b.width!)) : DEFAULT_W
    const height = Number.isFinite(b.height) ? Math.min(1536, Math.max(512, b.height!)) : DEFAULT_H
    const steps = Number.isFinite(b.steps) ? Math.min(50, Math.max(8, b.steps!)) : 28
    const cfg = Number.isFinite(b.cfg_scale) ? Math.min(15, Math.max(3, b.cfg_scale!)) : 7
    const sampler = b.sampler_name || 'k_euler'
    const n = Number.isFinite(b.n) ? Math.min(4, Math.max(1, b.n!)) : 1
    const models = b.model && b.model.length ? b.model : undefined
    const nsfw = !!b.nsfw
    const respondAs = b.format === 'base64' ? 'base64' : 'binary'

    // 1) Crea job
    const createRes = await fetch(`${HORDE_BASE}/generate/async`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: API_KEY,
      },
      body: JSON.stringify({
        prompt,
        nsfw,
        // evitiamo sorprese: filtri attivi e worker non "trusted" ok
        censor_nsfw: !nsfw,
        trusted_workers: false,
        models, // opzionale
        params: {
          width,
          height,
          steps,
          cfg_scale: cfg,
          sampler_name: sampler,
          n,
        },
      }),
    })

    if (!createRes.ok) {
      const t = await safeText(createRes)
      return NextResponse.json(
        { ok: false, stage: 'create', status: createRes.status, text: t },
        { status: 502 }
      )
    }

    const created = (await createRes.json()) as { id: string }
    if (!created?.id) {
      return NextResponse.json({ ok: false, error: 'no_job_id' }, { status: 502 })
    }

    // 2) Poll finché pronto (max ~60s)
    const started = Date.now()
    let done = false
    while (!done && Date.now() - started < 60_000) {
      await sleep(3000)
      const check = await fetch(`${HORDE_BASE}/generate/check/${created.id}`, {
        headers: { apikey: API_KEY },
        cache: 'no-store',
      })
      if (!check.ok) continue
      const j = (await check.json()) as { done: boolean }
      done = !!j?.done
    }

    // 3) Recupera generazioni
    const statusRes = await fetch(`${HORDE_BASE}/generate/status/${created.id}`, {
      headers: { apikey: API_KEY },
      cache: 'no-store',
    })

    if (!statusRes.ok) {
      const t = await safeText(statusRes)
      return NextResponse.json(
        { ok: false, stage: 'status', status: statusRes.status, text: t },
        { status: 502 }
      )
    }

    const statusJson = (await statusRes.json()) as {
      generations?: Array<{ img: string; seed?: number; model?: string }>
    }

    const first = statusJson.generations?.[0]
    if (!first?.img) {
      return NextResponse.json({ ok: false, error: 'no_image_ready' }, { status: 504 })
    }

    // Horde ritorna base64 (senza header data:)
    if (respondAs === 'base64') {
      return NextResponse.json({ ok: true, image_base64: first.img }, { status: 200 })
    }

    const buf = Buffer.from(first.img, 'base64')
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'cache-control': 'no-store',
        'content-disposition': 'inline; filename="horde.png"',
      },
    })
  } catch (e) {
    console.error('[image/horde] error', e)
    return NextResponse.json(
      { ok: false, error: 'bad_request', message: String(e) },
      { status: 400 }
    )
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
async function safeText(r: Response) {
  try {
    return await r.text()
  } catch {
    return ''
  }
}
