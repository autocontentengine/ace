// app/api/lead/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readToonOrJson, toonFromObject } from '@/lib/toon/io'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Guard DEV: evita scritture remote se DISABLE_REMOTE_DEV=1
function isRemoteDevDisabled() {
  return process.env.NODE_ENV !== 'production' && process.env.DISABLE_REMOTE_DEV === '1'
}
function createAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  try {
    const { data } = await readToonOrJson(req)
    // Supportiamo "lead:" o top-level
    const payload = data?.lead && typeof data.lead === 'object' ? (data.lead as any) : (data as any)

    const email = String(payload.email || '').trim()
    const name = (payload.name ? String(payload.name) : null) || null
    const source = (payload.source ? String(payload.source) : null) || null

    if (!email) {
      return new NextResponse('error: missing_email\n', {
        status: 400,
        headers: { 'content-type': 'text/toon; charset=utf-8' },
      })
    }

    if (isRemoteDevDisabled()) {
      const resp = toonFromObject({
        ok: true,
        dry_run: true,
        saved: { email, name, source },
        latency_ms: Date.now() - t0,
      } as any)
      return new NextResponse(resp + '\n', {
        status: 200,
        headers: { 'content-type': 'text/toon; charset=utf-8' },
      })
    }

    const supabase = createAdmin()
    const { error } = await supabase.from('leads').insert({
      email,
      name,
      source,
    })

    if (error) {
      const resp = toonFromObject({
        ok: false,
        error: 'supabase_insert_failed',
        details: error.message,
      })
      return new NextResponse(resp + '\n', {
        status: 500,
        headers: { 'content-type': 'text/toon; charset=utf-8' },
      })
    }

    const ok = toonFromObject({
      ok: true,
      saved: { email, name, source },
      latency_ms: Date.now() - t0,
    } as any)
    return new NextResponse(ok + '\n', {
      status: 200,
      headers: { 'content-type': 'text/toon; charset=utf-8' },
    })
  } catch (e: any) {
    const resp = toonFromObject({
      ok: false,
      error: 'unexpected',
      message: e?.message ?? String(e),
    })
    return new NextResponse(resp + '\n', {
      status: 500,
      headers: { 'content-type': 'text/toon; charset=utf-8' },
    })
  }
}
