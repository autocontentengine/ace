import { supabase } from '@/lib/supabase/client'

export function normalizeBrief(brief: string): string {
  return brief
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

export async function cacheLookup(normalizedBrief: string) {
  // Per ora usiamo Supabase come cache semplice
  const { data } = await supabase
    .from('jobs')
    .select('id, payload_json, created_at')
    .ilike('payload_json->>brief', `%${normalizedBrief}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    
  return data && data.length > 0 ? data[0] : null
}

export async function cacheStore(normalizedBrief: string, result: any) {
  // Per ora solo log, implementeremo cache vera più tardi
  console.log('Cache would store:', normalizedBrief, result)
}
