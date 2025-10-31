import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { generateAPIKey, hashAPIKey } from '@/lib/auth/crypto'
import { authenticateRequest } from '@/lib/auth/middleware'

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req)
  
  if (auth.error || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Authentication failed' }, 
      { status: auth.status || 401 }
    )
  }

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, role, permissions, created_at')
    .eq('user_id', auth.user.id)

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ keys: data })
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req)
  
  if (auth.error || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Authentication failed' }, 
      { status: auth.status || 401 }
    )
  }

  const { role = 'user', permissions = [] } = await req.json()

  const apiKey = generateAPIKey()
  const keyHash = hashAPIKey(apiKey)

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: auth.user.id,
      key_hash: keyHash,
      role,
      permissions
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
  }

  return NextResponse.json({
    apiKey,
    id: data.id,
    role: data.role,
    permissions: data.permissions
  })
}
