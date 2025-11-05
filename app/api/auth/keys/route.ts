export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { generateAPIKey } from '@/lib/auth/crypto'
import { authenticateRequest } from '@/lib/auth/middleware'

const supabase = supabaseServer()

// Lista chiavi dell'utente autenticato
export async function GET(req: NextRequest) {
  const authErr = await authenticateRequest(req as any)
  if (authErr) return authErr
  const userId = (req as any).user?.id as string

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, key_hash, role, created_at, permissions')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 })
  return NextResponse.json({ keys: data })
}

// Crea una nuova API key (ritorna la raw key SOLO una volta)
export async function POST(req: NextRequest) {
  const authErr = await authenticateRequest(req as any)
  if (authErr) return authErr
  const userId = (req as any).user?.id as string

  const { apiKey, hashedKey } = await generateAPIKey()

  const { data, error } = await supabase
    .from('api_keys')
    .insert({ user_id: userId, key_hash: hashedKey, role: 'user', permissions: [] })
    .select('id, permissions')
    .single()

  if (error || !data) {
    console.error('Create key error', error)
    return NextResponse.json({ error: 'Failed to create key' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id, apiKey, permissions: data.permissions })
}
