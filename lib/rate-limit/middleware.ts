// lib/rate-limit/middleware.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { guardOr429 } from './rate-limit'

/**
 * Middleware helper:
 *  - Ritorna 429 se rate-limited
 *  - Ritorna null se OK
 */
export async function enforceRateLimit(
  req: NextRequest,
  endpoint = 'default',
  maxHits = 60
): Promise<NextResponse | null> {
  return guardOr429(req, { endpoint, maxHits })
}
