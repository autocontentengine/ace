// lib/rate-limit/rate-limit.ts
import { supabaseServer } from '@/lib/supabase'

const supabase = supabaseServer()

/**
 * Ritorna TRUE se l’utente è rate-limited per l'endpoint indicato.
 * La funzione Postgres `check_rate_limit(uuid, text)` deve restituire boolean.
 */
export async function isRateLimited(userId: string | null, endpoint = 'default'): Promise<boolean> {
  try {
    if (!userId) return false
    const { data, error } = await supabase.rpc('check_rate_limit', {
      input_user_id: userId,
      input_endpoint: endpoint,
    })
    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[rate-limit] RPC error', error)
      }
      return false
    }
    return Boolean(data)
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[rate-limit] error', e)
    }
    return false
  }
}

// Re-export del clientUUID dal file util.ts (senza estensione)
export { clientUUID } from './util'
