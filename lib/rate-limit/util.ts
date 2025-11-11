// lib/rate-limit/util.ts
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

// UUID v5-like deterministico da IP+UA (per anon)
export function clientUUID(req: NextRequest): string {
  const hdr = req.headers
  const explicit = hdr.get('x-ace-user-id') || ''
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(explicit))
    return explicit.toLowerCase()

  const ip = (hdr.get('x-forwarded-for') || '').split(',')[0]?.trim() || '0.0.0.0'
  const ua = hdr.get('user-agent') || 'ua'
  const hash = crypto.createHash('sha1').update(`${ip}|${ua}`).digest('hex')
  // format: 8-4-4-4-12 con versione 5 e variante 'a'
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}
