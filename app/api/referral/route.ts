// app/api/referral/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

/**
 * Endpoint pubblico "referral light".
 * Uso previsto (client-side / link):  GET /api/referral?ref=<code>&utm_source=...&utm_campaign=...
 * Salva un evento minimale in error_logs (route='referral', context_json).
 * NB: usiamo SERVICE_ROLE lato server, quindi RLS non blocca.
 */
export async function GET(req: NextRequest) {
  const supabase = supabaseServer()

  try {
    const url = new URL(req.url)
    const qp = url.searchParams

    const ref = (qp.get('ref') || qp.get('r') || '').slice(0, 64)
    const source = (qp.get('source') || qp.get('utm_source') || '').slice(0, 64)
    const campaign = (qp.get('campaign') || qp.get('utm_campaign') || '').slice(0, 64)
    const medium = (qp.get('utm_medium') || '').slice(0, 64)

    const ua = req.headers.get('user-agent') || 'unknown'
    const ip =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      req.headers.get('cf-connecting-ip') ||
      ''

    // Soft validate
    if (!ref) {
      return NextResponse.json({ ok: true, saved: false, reason: 'missing_ref' })
    }

    // (Opzionale) Rate limit super-light via RPC condivisa
    try {
      const { data: limited } = await supabase.rpc('check_rate_limit', {
        input_user_id: '00000000-0000-0000-0000-000000000000',
        input_endpoint: 'referral',
      })
      if (limited) {
        return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
      }
    } catch {
      // se l'RPC non c'è/errore → continuiamo lo stesso
    }

    // Log minimal in error_logs (tabella esistente)
    const { error } = await supabase.from('error_logs').insert({
      route: 'referral',
      error_message: 'ref',
      context_json: { ref, source, campaign, medium, ip, ua },
      user_agent: ua,
    })

    if (error) {
      console.error('[referral] db insert error', error)
      return NextResponse.json({ ok: false, error: 'db_insert_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, saved: true })
  } catch (e) {
    console.error('[referral] unexpected', e)
    return NextResponse.json({ ok: false, error: 'unexpected' }, { status: 500 })
  }
}
