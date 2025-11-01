import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sha256 } from 'crypto-hash';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function authenticateRequest(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json({ error: 'API key missing' }, { status: 401 });
  }

  try {
    const keyHash = await sha256(apiKey);
    
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('user_id, role, permissions')
      .eq('key_hash', keyHash)
      .single();

    if (keyError || !keyData) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', keyData.user_id);
    requestHeaders.set('x-user-role', keyData.role);
    requestHeaders.set('x-user-permissions', JSON.stringify(keyData.permissions));

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (err) {
    console.error('Auth middleware error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Export alias per compatibilità
export const authMiddleware = authenticateRequest;
