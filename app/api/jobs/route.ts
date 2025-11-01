import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { authenticateRequest } from '@/lib/auth/middleware'
import { rateLimitMiddleware } from '@/lib/rate-limit/middleware'

export async function POST(req: NextRequest) {
  // Applica rate limiting
  const rateLimit = await rateLimitMiddleware(req)
  if (rateLimit.status !== 200) {
    return rateLimit
  }

  // Autenticazione
  const auth = await authenticateRequest(req)
  if (auth.status !== 200) {
    return auth
  }

  try {
    const userId = auth.headers.get('x-user-id')
    const { type, payload } = await req.json()

    // Inserisci il job nel database
    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        project_id: userId,
        type,
        payload_json: payload,
        status: 'queued'
      })
      .select()
      .single()

    if (error) {
      console.error('Job creation error:', error)
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      eventsUrl: `/api/jobs/${job.id}/events`
    })
  } catch {
    console.error('Jobs route error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (auth.status !== 200) {
    return auth
  }

  try {
    const userId = auth.headers.get('x-user-id')
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('project_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    return NextResponse.json({ jobs })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
