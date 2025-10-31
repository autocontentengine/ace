import { createHash, randomBytes } from 'crypto'

export function hashAPIKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex')
}

export function generateAPIKey(): string {
  const randomPart = randomBytes(16).toString('hex')
  const timestamp = Date.now().toString(36)
  return `ace_${timestamp}_${randomPart}`
}

export function validateAPIKeyFormat(apiKey: string): boolean {
  return /^ace_[a-z0-9]+_[a-f0-9]{32}$/i.test(apiKey)
}
