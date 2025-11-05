// lib/supabase/client.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

export function supabaseBrowser(): SupabaseClient {
  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''

  if (!url || !anonKey) {
    // In dev possiamo loggare, in prod meglio silenzioso
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[supabaseBrowser] Missing NEXT_PUBLIC_SUPABASE_* or SUPABASE_* envs')
    }
  }

  browserClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
    global: { headers: { 'X-Client-Info': 'ace-browser' } },
  })
  return browserClient
}
