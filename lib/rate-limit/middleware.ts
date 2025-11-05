// lib/rate-limit/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { isRateLimited } from './rate-limit'

/**
 * Ritorna:
 *  - NextResponse 429 se rate-limited
 *  - null se ok
 */
export async function enforceRateLimit(req: NextRequest, endpoint = 'default') {
  const userId = (req as any).user?.id ?? req.headers.get('x-user-id') ?? null
  const limited = await isRateLimited(userId, endpoint)
  return limited ? NextResponse.json({ error: 'Too many requests' }, { status: 429 }) : null
}
