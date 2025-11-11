// app/api/image/horde/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { parseToon } from '@/lib/toon/encode'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** -------------------- Tipi -------------------- */
type Body = {
  prompt?: string
  width?: number
  height?: number
  steps?: number
  model?: string
  sampler?: string
  timeout_ms?: number
  /** 'png' preferito; l'endpoint risponde sempre png o svg fallback */
  format?: 'png' | 'svg'
}

type GenResult =
  | {
      ok: true
      bytes: Uint8Array
      contentType: 'image/png' | 'image/svg+xml'
      cacheable: boolean
      modelUsed: string
      meta?: Record<string, unknown>
      elapsedMs: number
      cache: 'hit' | 'miss'
      error?: undefined
    }
  | {
      ok: false
      bytes: Uint8Array
      contentType: 'image/svg+xml'
      cacheable: boolean
      modelUsed: string
      meta?: Record<string, unknown>
      elapsedMs: number
      cache: 'miss' | 'hit'
      error: string
    }

/** -------------------- Config -------------------- */
const HORDE_API_KEY = process.env.HORDE_API_KEY || ''
const DEFAULT_MODEL = 'stable-diffusion-1.5'
const FALLBACK_MODEL = 'stable-diffusion-1.5'
const DEFAULT_STEPS = 8
const DEFAULT_TIMEOUT_MS = Number(process.env.HORDE_POLL_TIMEOUT_MS || 60_000)
const DEFAULT_FORMAT: Body['format'] = 'png'
const MAX_DIM = 1024
const MIN_DIM = 64
const CACHE_TTL_MS = 10 * 60_000 // 10 minuti
const CACHE_MAX = 256 // massimo elementi in cache

/** -------------------- Cache LRU+TTL -------------------- */
type CacheEntry = {
  bytes: Uint8Array
  contentType: 'image/png' | 'image/svg+xml'
  expiresAt: number
  modelUsed: string
}

const CACHE = new Map<string, CacheEntry>()

function cacheKey(b: Required<Pick<Body, 'prompt' | 'width' | 'height' | 'steps' | 'model'>>) {
  return JSON.stringify(b)
}

function getCache(key: string): CacheEntry | null {
  const it = CACHE.get(key)
  if (!it) return null
  if (Date.now() > it.expiresAt) {
    CACHE.delete(key)
    return null
  }
  // LRU touch
  CACHE.delete(key)
  CACHE.set(key, it)
  return it
}

function setCache(key: string, val: CacheEntry) {
  if (CACHE.size >= CACHE_MAX) {
    const firstKey = CACHE.keys().next().value
    if (firstKey) CACHE.delete(firstKey)
  }
  CACHE.set(key, val)
}

/** -------------------- Util -------------------- */
function clampTo64(n: number) {
  const x = Math.max(MIN_DIM, Math.min(MAX_DIM, Math.round(n)))
  return Math.round(x / 64) * 64
}

// ✅ Ritorna SEMPRE un ArrayBuffer “pulito” (mai SharedArrayBuffer)
function u8ToArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength)
  new Uint8Array(ab).set(u8)
  return ab
}

function okSvgFallback(width: number, height: number, reason: string, prompt: string) {
  const w = clampTo64(width)
  const h = clampTo64(height)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B0F1A"/>
      <stop offset="100%" stop-color="#1E293B"/>
    </linearGradient>
    <style>
      .t{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; fill:#fff; font-size:20px; font-weight:700; }
      .s{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; fill:#94A3B8; font-size:14px; }
    </style>
  </defs>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#g)"/>
  <g transform="translate(${Math.round(w * 0.08)}, ${Math.round(h * 0.2)})">
    <text class="t">${escapeXml(prompt)}</text>
    <text class="s" y="40">Fallback cover (${escapeXml(reason)})</text>
  </g>
  <rect x="8" y="8" width="${w - 16}" height="${h - 16}" rx="24" fill="none" stroke="#8B5CF6" stroke-opacity="0.35"/>
</svg>`
  return new TextEncoder().encode(svg)
}

function escapeXml(s: string) {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

async function readBody(req: NextRequest): Promise<Body> {
  const ct = req.headers.get('content-type') || ''
  if (ct.startsWith('text/toon')) {
    const txt = await req.text()
    const parsed = parseToon(txt) as any
    const b = (parsed?.image ?? parsed) as Record<string, unknown>
    return {
      prompt: String(b.prompt ?? ''),
      width: Number(b.width ?? 0) || undefined,
      height: Number(b.height ?? 0) || undefined,
      steps: Number(b.steps ?? 0) || undefined,
      model: typeof b.model === 'string' ? (b.model as string) : undefined,
      sampler: typeof b.sampler === 'string' ? (b.sampler as string) : undefined,
      timeout_ms: Number(b.timeout_ms ?? 0) || undefined,
      format: b.format === 'svg' ? 'svg' : 'png',
    }
  }
  // JSON
  const j = (await req.json().catch(() => ({}))) as Record<string, any>
  const b = (j.image ?? j) as Record<string, unknown>
  return {
    prompt: String(b.prompt ?? ''),
    width: Number(b.width ?? 0) || undefined,
    height: Number(b.height ?? 0) || undefined,
    steps: Number(b.steps ?? 0) || undefined,
    model: typeof b.model === 'string' ? (b.model as string) : undefined,
    sampler: typeof b.sampler === 'string' ? (b.sampler as string) : undefined,
    timeout_ms: Number(b.timeout_ms ?? 0) || undefined,
    format: b.format === 'svg' ? 'svg' : 'png',
  }
}

/** Simula una chiamata Stable Horde: create → poll → decode */
async function generateViaHordeOnce(args: {
  prompt: string
  width: number
  height: number
  steps: number
  model: string
  sampler?: string
  timeout_ms: number
}): Promise<{ ok: true; png: Uint8Array } | { ok: false; error: string }> {
  if (!HORDE_API_KEY) return { ok: false, error: 'missing_horde_api_key' }

  // --- CREATE
  const createResp = await fetch('https://stablehorde.net/api/v2/generate/async', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: HORDE_API_KEY,
    },
    body: JSON.stringify({
      prompt: args.prompt,
      params: {
        width: args.width,
        height: args.height,
        steps: args.steps,
        sampler_name: args.sampler || 'k_euler',
        cfg_scale: 7,
        seed: Math.floor(Math.random() * 1e9),
        post_processing: [],
        tiling: false,
        hiresfix: false,
      },
      nsfw: false,
      trusted_workers: false,
      slow_workers: true,
      workers: null,
      models: [args.model],
      r2: true,
    }),
  })

  if (!createResp.ok) {
    const text = await createResp.text().catch(() => '')
    const kudos = /KudosUpfront/i.test(text)
    return { ok: false, error: kudos ? 'kudos_upfront' : `create_fail_${createResp.status}` }
  }

  const createJson = (await createResp.json().catch(() => null)) as any
  const id = createJson?.id as string | undefined
  if (!id) return { ok: false, error: 'no_id' }

  // --- POLL
  const deadline = Date.now() + args.timeout_ms
  let done = false
  let imgB64: string | null = null
  while (!done && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500))
    const st = await fetch(`https://stablehorde.net/api/v2/generate/status/${id}`, {
      headers: { apikey: HORDE_API_KEY },
    })
    if (!st.ok) continue
    const js = (await st.json().catch(() => null)) as any
    if (js?.done && Array.isArray(js?.generations) && js.generations.length > 0) {
      imgB64 = js.generations[0]?.img as string
      done = true
      break
    }
  }

  if (!imgB64) return { ok: false, error: 'timeout' }

  // Decode base64 PNG
  const bytes = Uint8Array.from(Buffer.from(imgB64, 'base64'))
  return { ok: true, png: bytes }
}

/** end-to-end con fallback di modello */
async function generateViaHorde(
  prompt: string,
  width: number,
  height: number,
  steps: number,
  model: string,
  sampler: string | undefined,
  timeout_ms: number
): Promise<{ ok: true; png: Uint8Array; modelUsed: string } | { ok: false; error: string }> {
  const first = await generateViaHordeOnce({
    prompt,
    width,
    height,
    steps,
    model,
    sampler,
    timeout_ms,
  })
  if (first.ok) return { ok: true, png: first.png, modelUsed: model }

  if (first.error === 'kudos_upfront' || first.error.startsWith('create_fail')) {
    if (model !== FALLBACK_MODEL) {
      const fb = await generateViaHordeOnce({
        prompt,
        width,
        height,
        steps,
        model: FALLBACK_MODEL,
        sampler,
        timeout_ms,
      })
      if (fb.ok) return { ok: true, png: fb.png, modelUsed: FALLBACK_MODEL }
    }
  }

  return { ok: false, error: first.error }
}

/** -------------------- Route -------------------- */
export async function POST(req: NextRequest) {
  const t0 = Date.now()
  const b = await readBody(req)

  // Normalizzazioni
  const prompt = (b.prompt || '').trim()
  const width = clampTo64(b.width ?? 768)
  const height = clampTo64(b.height ?? 1024)
  const steps = Math.max(1, Math.min(50, Math.round(b.steps ?? DEFAULT_STEPS)))
  const model = (b.model || DEFAULT_MODEL).trim()
  const sampler = b.sampler
  const timeout_ms = Math.max(
    3_000,
    Math.min(120_000, Math.round(b.timeout_ms ?? DEFAULT_TIMEOUT_MS))
  )
  const _format = b.format || DEFAULT_FORMAT

  // Cache key
  const key = cacheKey({ prompt, width, height, steps, model })
  const hit = getCache(key)
  if (hit) {
    const resp = new NextResponse(u8ToArrayBuffer(hit.bytes), {
      status: 200,
      headers: {
        'cache-control': 'no-store',
        'content-type': hit.contentType,
        'x-horde-used': '1',
        'x-horde-cache': 'hit',
        'x-horde-model': hit.modelUsed,
        'x-horde-error': 'none',
        'x-horde-elapsed-ms': String(Date.now() - t0),
      },
    })
    return resp
  }

  // Se manca la key → fallback immediato
  if (!HORDE_API_KEY) {
    const bytes = okSvgFallback(width, height, 'Missing API key', prompt)
    const out: GenResult = {
      ok: false,
      bytes,
      contentType: 'image/svg+xml',
      cacheable: true,
      modelUsed: 'fallback',
      elapsedMs: Date.now() - t0,
      cache: 'miss',
      error: 'missing_horde_api_key',
    }
    setCache(key, {
      bytes: out.bytes,
      contentType: out.contentType,
      modelUsed: out.modelUsed,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })
    return new NextResponse(u8ToArrayBuffer(out.bytes), {
      status: 200,
      headers: {
        'cache-control': 'no-store',
        'content-type': out.contentType,
        'content-disposition': 'inline; filename="horde_fallback.svg"',
        'x-horde-used': '1',
        'x-horde-cache': out.cache,
        'x-horde-model': out.modelUsed,
        'x-horde-error': out.error,
        'x-horde-elapsed-ms': String(out.elapsedMs),
      },
    })
  }

  // Generazione reale (con fallback modello)
  const g = await generateViaHorde(prompt, width, height, steps, model, sampler, timeout_ms)
  if (g.ok) {
    const contentType = 'image/png' as const
    const out: GenResult = {
      ok: true,
      bytes: g.png,
      contentType,
      cacheable: true,
      modelUsed: g.modelUsed,
      elapsedMs: Date.now() - t0,
      cache: 'miss',
    }
    // cache
    setCache(key, {
      bytes: out.bytes,
      contentType: out.contentType,
      modelUsed: out.modelUsed,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })
    return new NextResponse(u8ToArrayBuffer(out.bytes), {
      status: 200,
      headers: {
        'cache-control': 'no-store',
        'content-type': out.contentType,
        'x-horde-used': '1',
        'x-horde-cache': out.cache,
        'x-horde-model': out.modelUsed,
        'x-horde-error': 'none',
        'x-horde-elapsed-ms': String(out.elapsedMs),
      },
    })
  }

  // Fallback SVG su errori/timeout/kudos
  const bytes = okSvgFallback(width, height, g.error, prompt)
  const out: GenResult = {
    ok: false,
    bytes,
    contentType: 'image/svg+xml',
    cacheable: true,
    modelUsed: 'fallback',
    elapsedMs: Date.now() - t0,
    cache: 'miss',
    error: g.error,
  }
  setCache(key, {
    bytes: out.bytes,
    contentType: out.contentType,
    modelUsed: out.modelUsed,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
  return new NextResponse(u8ToArrayBuffer(out.bytes), {
    status: 200,
    headers: {
      'cache-control': 'no-store',
      'content-type': out.contentType,
      'content-disposition': 'inline; filename="horde_fallback.svg"',
      'x-horde-used': '1',
      'x-horde-cache': out.cache,
      'x-horde-model': out.modelUsed,
      'x-horde-error': g.error,
      'x-horde-elapsed-ms': String(out.elapsedMs),
    },
  })
}
