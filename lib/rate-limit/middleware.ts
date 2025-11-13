// lib/rate-limit/middleware.ts
import { NextRequest } from 'next/server'
import { guardOr429 } from './rate-limit'
import { rateKey } from './key'

/**
 * Ritorna:
 *  - NextResponse 429 se rate-limited
 *  - null se ok
 */
export async function enforceRateLimit(
  req: NextRequest,
  endpoint = 'default',
  maxHits = 60,
  windowSec = 60
) {
  const key = rateKey(req)
  // NB: guardOr429(key, endpoint, { maxHits, windowSec })
  const guard = await guardOr429(key, endpoint, { maxHits, windowSec })
  return guard ?? null
}
