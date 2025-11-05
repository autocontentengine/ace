import { randomBytes, createHash } from 'crypto'

export async function generateAPIKey() {
  const raw = 'ace_' + randomBytes(24).toString('hex') // ~ace_ + 48 hex chars
  const hashedKey = createHash('sha256').update(raw).digest('hex')
  return { apiKey: raw, hashedKey }
}

export function hashAPIKey(key: string) {
  return createHash('sha256').update(key).digest('hex')
}
