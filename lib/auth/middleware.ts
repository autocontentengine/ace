import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

export async function middleware(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 })
  }

  const hashed = sha256(apiKey)
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('hash', hashed)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 403 })
  }

  return NextResponse.next()
}
