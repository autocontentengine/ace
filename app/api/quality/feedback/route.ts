import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function createAdmin() {
  const url = process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const supabase = createAdmin()
    const { error } = await supabase.from('quality_feedback').insert({
      endpoint: b.endpoint,
      brief_hash: b.brief_hash,
      score_auto: b.score_auto,
      score_manual: b.score_manual ?? null,
      latency_ms: b.latency_ms ?? null,
      meta: b.meta ?? null,
    })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 })
  }
}
