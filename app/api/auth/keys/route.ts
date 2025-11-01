import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { generateAPIKey } from '@/lib/auth/crypto'
import { authenticateRequest } from '@/lib/auth/middleware'

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req)
  
  if (auth.status !== 200) {
    return auth
  }

  try {
    const userId = auth.headers.get('x-user-id')
    
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('id, key_hash, role, created_at')
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 })
    }

    return NextResponse.json({ keys })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req)
  
  if (auth.status !== 200) {
    return auth
  }

  try {
    const userId = auth.headers.get('x-user-id')
    const { permissions = [] } = await req.json()

    const { apiKey, hashedKey } = await generateAPIKey()
    
    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        key_hash: hashedKey,
        role: 'user',
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
      permissions: data.permissions 
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
