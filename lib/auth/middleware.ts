import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { hashAPIKey } from './crypto'

export async function authenticateRequest(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('api_key')
  
  if (!apiKey) {
    return { error: 'API key required', status: 401 }
  }

  try {
    const keyHash = hashAPIKey(apiKey)
    
    const { data, error } = await supabase
      .from('api_keys')
      .select('user_id, role, permissions, users(email)')
      .eq('key_hash', keyHash)
      .single()

    if (error || !data) {
      return { error: 'Invalid API key', status: 401 }
    }

    return {
      user: {
        id: data.user_id,
        email: data.users?.email,
        role: data.role,
        permissions: data.permissions || []
      }
    }
  } catch (error) {
    return { error: 'Authentication failed', status: 500 }
  }
}
