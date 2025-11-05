import { z } from 'zod'

export const ConfigSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(10),
  UPSTASH_REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_TOKEN: z.string().optional(),
  ALERT_WEBHOOK_URL: z.string().url().optional(),
  GROQ_API_KEY: z.string().min(10),
  BUDGET_CAP_EUR: z.coerce.number().min(1).default(20),
})

export function getConfig() {
  const parsed = ConfigSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error('Invalid env: ' + JSON.stringify(parsed.error.format()))
  }
  return parsed.data
}
