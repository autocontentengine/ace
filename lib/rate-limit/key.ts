// lib/rate-limit/key.ts
import type { NextRequest } from 'next/server'

/**
 * Costruisce una chiave stabile per il rate-limit:
 *  - se c'è user.id o x-user-id → "u:<id>"
 *  - altrimenti IP (x-forwarded-for o req.ip) → "ip:<ip>"
 */
export function rateKey(req: NextRequest): string {
  const userId = (req as any)?.user?.id ?? req.headers.get('x-user-id') ?? null

  const ipHeader = req.headers.get('x-forwarded-for')
  const ip = ipHeader?.split(',')[0]?.trim() ?? (req as any)?.ip ?? '0.0.0.0'

  return userId ? `u:${userId}` : `ip:${ip}`
}
