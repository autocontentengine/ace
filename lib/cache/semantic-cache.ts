import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function cacheLookup(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('semantic_cache')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    console.error('Cache lookup error:', error);
    return null;
  }

  return data?.value || null;
}

export async function cacheStore(key: string, val: string, ttl: number = 604800): Promise<void> {
  const { error } = await supabase
    .from('semantic_cache')
    .upsert({
      key,
      value: val,
      expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
    });

  if (error) {
    console.error('Cache store error:', error);
  }
}

export function normalizeBrief(brief: string): string {
  return brief
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}
