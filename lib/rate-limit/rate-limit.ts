import { supabase } from '@/lib/supabase/client'

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

export const rateLimitTiers = {
  free: { maxRequests: 100, windowMs: 3600000 }, // 100 requests/hour
  starter: { maxRequests: 1000, windowMs: 3600000 }, // 1000 requests/hour
  pro: { maxRequests: 10000, windowMs: 3600000 } // 10000 requests/hour
}

export async function checkRateLimit(
  userId: string, 
  endpoint: string, 
  tier: keyof typeof rateLimitTiers = 'free'
): Promise<{ allowed: boolean; remaining: number }> {
  const config = rateLimitTiers[tier]
  const windowStart = new Date(Date.now() - config.windowMs).toISOString()
  
  // Clean up old entries
  await supabase
    .from('rate_limit_counters')
    .delete()
    .lt('window_start', windowStart)

  // Get or create current window counter
  const { data, error } = await supabase
    .from('rate_limit_counters')
    .select('tokens')
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .gte('window_start', windowStart)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw error
  }

  const currentTokens = data?.tokens || 0

  if (currentTokens >= config.maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  // Increment counter
  if (data) {
    await supabase
      .from('rate_limit_counters')
      .update({ tokens: currentTokens + 1 })
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .gte('window_start', windowStart)
  } else {
    await supabase
      .from('rate_limit_counters')
      .insert({
        user_id: userId,
        endpoint,
        window_start: new Date().toISOString(),
        tokens: 1
      })
  }

  return { 
    allowed: true, 
    remaining: Math.max(0, config.maxRequests - (currentTokens + 1))
  }
}
