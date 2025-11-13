// lib/rate-limit/rate-limit.ts
import { NextResponse } from 'next/server'

type RateKey = string
export type RateLimitOpts = {
  windowSec: number
  maxHits: number
  bucket?: string
  contentType?: string
}

const buckets = new Map<
  string,
  {
    count: number
    windowStart: number
  }
>()

function keyFor(id: string | null, endpoint: string, bucket?: string): RateKey {
  const uid = typeof id === 'string' ? id : 'anon'
  const b = bucket ?? 'default'
  return `${endpoint}:${b}:${uid}`
}

export async function isRateLimited(
  id: string | null,
  endpoint: string,
  opts: RateLimitOpts
): Promise<boolean> {
  const now = Date.now()
  const key = keyFor(id, endpoint, opts.bucket)
  const rec = buckets.get(key)

  if (!rec || now - rec.windowStart > opts.windowSec * 1000) {
    buckets.set(key, { count: 1, windowStart: now })
    return false
  }

  if (rec.count >= opts.maxHits) return true
  rec.count++
  return false
}

export async function guardOr429(id: string | null, endpoint: string, opts: RateLimitOpts) {
  const limited = await isRateLimited(id, endpoint, opts)
  return limited
    ? NextResponse.json(
        { ok: false, error: 'rate_limited' },
        {
          status: 429,
          headers: opts.contentType ? { 'content-type': opts.contentType } : {},
        }
      )
    : null
}

export async function guardRequest(req: Request, endpoint: string, opts: RateLimitOpts) {
  const userId = (req as any).user?.id ?? req.headers.get('x-user-id') ?? null
  return guardOr429(userId, endpoint, opts)
}
