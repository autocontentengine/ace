// lib/rate-limit/rate-limit.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { clientUUID } from './util'

/**
 * Opzioni di rate limit.
 * - endpoint: chiave logica (es. "carousel", "generate_copy", ecc.)
 * - windowSec: finestra di rate (default 60s)
 * - maxHits: richieste consentite per finestra (default 60)
 * - bucket: (opz.) sotto-chiave per separare ulteriormente i bucket
 * - limit: (alias deprecato di maxHits, mantenuto per compatibilità)
 */
export type RateLimitOpts = {
  endpoint: string
  windowSec?: number
  maxHits?: number
  bucket?: string
  /** @deprecated usa maxHits */
  limit?: number
}

/** Store in-memory (persiste per tutta la vita del processo in dev/prod). */
type Bucket = { count: number; resetAt: number }
type Store = Map<string, Bucket>
const g = globalThis as unknown as { __ACE_RL__?: Store }
if (!g.__ACE_RL__) g.__ACE_RL__ = new Map()
const STORE: Store = g.__ACE_RL__!

/** Estrae un token API dagli header (NO React hook, nome safe per eslint). */
function readApiToken(req: NextRequest): string | null {
  const h = req.headers
  const auth = h.get('authorization')
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim()
  }
  return h.get('x-api-key') || null
}

/** Costruisce una chiave utente stabile: header esplicito → token → UUID IP+UA. */
function userKey(req: NextRequest): string {
  const h = req.headers
  const explicit = h.get('x-ace-user-id') || h.get('x-user-id') || ''
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(explicit)) {
    return explicit.toLowerCase()
  }
  const token = readApiToken(req)
  if (token) return `tok:${token}`
  return `anon:${clientUUID(req)}`
}

/** Chiave bucket globale: endpoint + (opz.) bucket + userKey. */
function bucketKey(req: NextRequest, endpoint: string, bucket?: string) {
  const suffix = bucket ? `:${bucket}` : ''
  return `${endpoint}${suffix}:${userKey(req)}`
}

/** Verifica e aggiorna il bucket: true = rate-limited. */
export async function isRateLimited(req: NextRequest, opts: RateLimitOpts): Promise<boolean> {
  const endpoint = opts.endpoint || 'default'
  const windowSec = Number.isFinite(opts.windowSec) ? Math.max(1, opts.windowSec!) : 60

  // Supporta 'limit' come alias legacy di 'maxHits'
  const rawMax = Number.isFinite(opts.maxHits)
    ? opts.maxHits!
    : Number.isFinite(opts.limit)
      ? opts.limit!
      : 60
  const maxHits = Math.max(1, rawMax)

  const key = bucketKey(req, endpoint, opts.bucket)
  const now = Date.now()
  const winMs = windowSec * 1000

  let b = STORE.get(key)
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + winMs }
    STORE.set(key, b)
  }

  if (b.count >= maxHits) {
    return true
  }

  b.count += 1
  return false
}

/**
 * Se rate-limited: ritorna NextResponse 429; altrimenti null.
 * Uso tipico:
 *   const guard = await guardOr429(req, { endpoint: 'carousel', bucket: 'png', maxHits: 60 })
 *   if (guard) return guard
 */
export async function guardOr429(
  req: NextRequest,
  opts: RateLimitOpts
): Promise<NextResponse | null> {
  const limited = await isRateLimited(req, opts)
  if (limited) {
    const windowSec = Number.isFinite(opts.windowSec) ? Math.max(1, opts.windowSec!) : 60
    const rawMax = Number.isFinite(opts.maxHits)
      ? opts.maxHits!
      : Number.isFinite(opts.limit)
        ? opts.limit!
        : 60
    const maxHits = Math.max(1, rawMax)

    return NextResponse.json(
      {
        ok: false,
        error: 'rate_limited',
        endpoint: opts.endpoint,
        bucket: opts.bucket ?? null,
        window_sec: windowSec,
        max_hits: maxHits,
      },
      { status: 429 }
    )
  }
  return null
}

/** Esporta anche clientUUID per utilizzi esterni. */
export { clientUUID } from './util'
