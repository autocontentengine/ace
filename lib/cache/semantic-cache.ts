// lib/cache/semantic-cache.ts
type RedisLike = {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string, mode?: string, ttlSeconds?: number) => Promise<unknown>
}

const redis: RedisLike | null = null

// Esempio di inizializzazione lazy; sostituisci con Upstash o altro quando pronto
function getRedis(): RedisLike | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) return null
  // Qui potresti creare il client reale (Upstash, ioredis, ecc.)
  // Per ora ritorniamo null se non configurato
  return null
}

export async function cacheLookup(key: string) {
  const r = getRedis()
  if (!r) return null
  try {
    return await r.get(key)
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.warn('[cacheLookup] error', e)
    return null
  }
}

export async function cacheStore(key: string, val: string, ttl = 60 * 60 * 24 * 7) {
  const r = getRedis()
  if (!r) return false
  try {
    await r.set(key, val, 'EX', ttl)
    return true
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.warn('[cacheStore] error', e)
    return false
  }
}
