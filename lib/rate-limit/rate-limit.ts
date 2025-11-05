import { supabaseServer } from '@/lib/supabase'

const supabase = supabaseServer()

/**
 * true => rate-limited (429)
 * false => ok
 */
export async function isRateLimited(userId: string | null, endpoint = 'default'): Promise<boolean> {
  const safeUserId =
    userId && /[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}/i.test(userId)
      ? userId
      : '00000000-0000-0000-0000-000000000000'

  const { data, error } = await supabase.rpc('check_rate_limit', {
    input_user_id: safeUserId,
    input_endpoint: endpoint,
  })

  if (error) {
    // fail-open: non bloccare il traffico in caso di errore RPC
    console.error('Rate limit RPC error:', error)
    return false
  }
  return data === true
}
