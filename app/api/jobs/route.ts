import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { authenticateRequest } from '@/lib/auth/middleware'
import { rateLimitMiddleware } from '@/lib/rate-limit/middleware'

export async function POST(req: NextRequest) {
  // Autenticazione
  const auth = await authenticateRequest(req)
  if (auth.error || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Authentication failed' }, 
      { status: auth.status || 401 }
    )
  }

  // Rate limiting
  const rateLimit = await rateLimitMiddleware(req, auth.user.id, 'jobs-create')
  if (rateLimit.error) {
    return NextResponse.json(
      { error: rateLimit.error }, 
      { status: rateLimit.status, headers: rateLimit.headers }
    )
  }

  const { type, payload } = await req.json()

  // Crea job nel database
  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      project_id: auth.user.id,
      type,
      payload_json: payload,
      status: 'queued',
      progress: 0
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
  }

  return NextResponse.json({ 
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    eventsUrl: `/api/jobs/${job.id}/events`
  }, { 
    headers: rateLimit.headers 
  })
}
