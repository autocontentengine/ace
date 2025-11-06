// app/api/track/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function remoteDevDisabled() {
  return process.env.NODE_ENV !== 'production' && process.env.DISABLE_REMOTE_DEV === '1'
}

function createAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  if (remoteDevDisabled()) {
    return NextResponse.json({ ok: true, skipped: 'remote dev disabled' })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { path?: string }
    const path = body.path ?? '/'

    const h = req.headers
    const xff = h.get('x-forwarded-for') ?? ''
    const realIp = h.get('x-real-ip') ?? ''
    const ip = (xff.split(',')[0]?.trim() || realIp || '').slice(0, 255) || null

    const origin = h.get('origin') || null
    // header standard HTTP è "referer"; in DB la colonna si chiama "referrer"
    const referrer = h.get('referer') || h.get('referrer') || null

    const supabase = createAdmin()
    const { error } = await supabase.from('page_views').insert({
      path,
      ip,
      origin,
      referrer,
    })

    if (error) {
      console.error('[track] insert error', error)
      // non blocchiamo il rendering lato utente
      return NextResponse.json({ ok: true, warn: error.message })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[track] unhandled', e)
    return NextResponse.json({ ok: true, warn: 'unhandled' })
  }
}
