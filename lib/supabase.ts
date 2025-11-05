// lib/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let singleton: SupabaseClient | null = null

export function supabaseServer(): SupabaseClient {
  if (singleton) return singleton

  const url = process.env.SUPABASE_URL ?? ''
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const anon = process.env.SUPABASE_ANON_KEY ?? ''

  if (!url) {
    console.warn('[supabaseServer] Missing SUPABASE_URL')
  }
  const key = serviceRole || anon
  if (!key) {
    console.warn('[supabaseServer] Missing SUPABASE_SERVICE_ROLE_KEY/ANON_KEY')
  }

  singleton = createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'ace-server' } },
  })
  return singleton
}
