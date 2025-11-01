import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function rateLimitMiddleware(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id') || 'anonymous';
    const endpoint = new URL(request.url).pathname;
    
    // Usa l'ora corrente arrotondata al minuto per la finestra
    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
    
    // Trova o crea il contatore per questa finestra
    const { data: counter, error } = await supabase
      .from('rate_limit_counters')
      .select('tokens')
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .eq('window_start', windowStart.toISOString())
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Rate limit query error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const currentTokens = counter?.tokens || 0;
    const maxTokens = 100; // Limite per minuto
    
    if (currentTokens >= maxTokens) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' }, 
        { 
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': maxTokens.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': (Math.floor(Date.now() / 1000) + 60).toString()
          }
        }
      );
    }

    // Incrementa il contatore
    const { error: updateError } = await supabase
      .from('rate_limit_counters')
      .upsert({
        user_id: userId,
        endpoint,
        window_start: windowStart.toISOString(),
        tokens: currentTokens + 1
      });

    if (updateError) {
      console.error('Rate limit update error:', updateError);
    }

    // Restituisci una risposta NextResponse valida per il successo
    return NextResponse.next();
  } catch (err) {
    console.error('Rate limit middleware error:', err);
    // In caso di errore, permette la richiesta ma logga l'errore
    return NextResponse.next();
  }
}
