// lib/auth/middleware.ts
import { NextResponse } from 'next/server'
import type { AuthenticatedRequest } from '@/types/global'
import { supabaseServer } from '@/lib/supabase'
import { createHash } from 'crypto'

const supabase = supabaseServer()

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Autentica tramite header x-api-key.
 * - Su OK: attacca req.user = { id, role } e ritorna null
 * - Su KO: ritorna NextResponse con errore (401)
 */
export async function authenticateRequest(req: AuthenticatedRequest) {
  const apiKey = req.headers.get('x-api-key')?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 })
  }

  const keyHash = sha256Hex(apiKey)

  const { data, error } = await supabase
    .from('api_keys')
    .select('user_id, role')
    .eq('key_hash', keyHash)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  const reqAuth = req as AuthenticatedRequest
  reqAuth.user = { id: data.user_id, role: (data as any).role ?? 'user' }
  return null
}
