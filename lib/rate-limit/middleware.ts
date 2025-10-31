import { NextRequest } from 'next/server'
import { checkRateLimit } from './rate-limit'

export async function rateLimitMiddleware(
  req: NextRequest,
  userId: string,
  endpoint: string
) {
  const tier = 'free' // Per ora tutti free, poi basato su user tier
  const result = await checkRateLimit(userId, endpoint, tier)
  
  if (!result.allowed) {
    return {
      error: `Rate limit exceeded. Try again in ${60} minutes.`,
      status: 429,
      headers: {
        'Retry-After': '3600',
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': (Date.now() + 3600000).toString()
      }
    }
  }

  return {
    headers: {
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': (Date.now() + 3600000).toString()
    }
  }
}
