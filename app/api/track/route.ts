// app/api/track/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readToonOrJson, toonFromObject } from '@/lib/toon/io'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    // Supportiamo "track:" o top-level
    const payload =
      data?.track && typeof data.track === 'object' ? (data.track as any) : (data as any)

    const event = String(payload.event || payload.name || '').trim() || 'page_view'
    const path = (payload.path ? String(payload.path) : null) || null
    const referer =
      payload.referer || payload.referrer ? String(payload.referer || payload.referrer) : null
    const session_id = (payload.session_id ? String(payload.session_id) : null) || null
    const ua = req.headers.get('user-agent') || null

    if (isRemoteDevDisabled()) {
      const resp = toonFromObject({
        ok: true,
        dry_run: true,
        saved: { event, path, referer, session_id },
        latency_ms: Date.now() - t0,
      } as any)
      return new NextResponse(resp + '\n', {
        status: 200,
        headers: { 'content-type': 'text/toon; charset=utf-8' },
      })
    }

    const supabase = createAdmin()
    const { error } = await supabase.from('page_views').insert({
      event,
      path,
      referer,
      session_id,
      ua,
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
      saved: { event, path, referer, session_id },
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
