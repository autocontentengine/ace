// app/api/lead/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Guard: salta scritture solo in DEV quando DISABLE_REMOTE_DEV=1
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
    const { email, source } = (await req.json().catch(() => ({}))) as {
      email?: string
      source?: string
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'Email non valida' }, { status: 400 })
    }

    const supabase = createAdmin()
    const { error } = await supabase.from('leads').insert({
      email,
      source: source ?? 'pricing',
    })

    // dedupe soft: se violi unique(email) rispondi lo stesso ok
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ ok: true, deduped: true })
      }
      console.error('[lead] insert error', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[lead] unhandled', e)
    return NextResponse.json({ ok: false, error: 'Unhandled error' }, { status: 500 })
  }
}
