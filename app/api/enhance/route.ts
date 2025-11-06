// app/api/enhance/route.ts
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { prompt, goal } = await req.json()
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ ok: false, error: 'prompt mancante' }, { status: 400 })
    }
    const apiKey = process.env.GROQ_API_KEY!
    const model = 'llama-3.3-70b-versatile'

    const sys = `Sei un "Prompt Enchanter" per social/copy design.
Rendi il prompt chiaro, strutturato e orientato a output social (hook, caption, caroselli).
Aggiungi: tone of voice, audience, formato output, vincoli (lunghezza), call to action, keyword brand-safe. Non inventare facts.`
    const user = `PROMPT UTENTE:
${prompt}

OBIETTIVO (facoltativo): ${goal ?? 'n/d'}

RISPONDI SOLO con il prompt migliorato, in italiano.`

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
      }),
    })
    if (!r.ok) {
      const txt = await r.text()
      return NextResponse.json({ ok: false, error: txt }, { status: 500 })
    }
    const data = await r.json()
    const improved = data.choices?.[0]?.message?.content?.trim()
    return NextResponse.json({ ok: true, prompt: improved ?? prompt })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'err' }, { status: 500 })
  }
}
