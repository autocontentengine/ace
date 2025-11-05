// app/api/jobs/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import type { AuthenticatedRequest } from '@/types/global'
import { authenticateRequest } from '@/lib/auth/middleware'
import { enforceRateLimit } from '@/lib/rate-limit/middleware'
import { supabaseServer } from '@/lib/supabase'

const supabase = supabaseServer()

export async function POST(req: AuthenticatedRequest) {
  const authErr = await authenticateRequest(req)
  if (authErr) return authErr

  const rlErr = await enforceRateLimit(req, 'jobs:POST')
  if (rlErr) return rlErr

  try {
    const body = await req.json().catch(() => ({}))
    const type = body?.type ?? 'generic'
    const payload = body?.payload ?? null
    const userId = (req as any).user?.id as string | undefined

    const { data, error } = await supabase
      .from('jobs')
      .insert({ user_id: userId ?? null, type, payload_json: payload })
      .select('id')
      .single()

    if (error || !data) {
      console.error('DB insert error', error)
      return NextResponse.json({ error: 'DB insert failed' }, { status: 500 })
    }
    return NextResponse.json({ jobId: data.id })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
}
