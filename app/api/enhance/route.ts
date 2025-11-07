// app/api/enhance/route.ts
import { NextResponse } from 'next/server'

type Lang = 'it' | 'en'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { prompt, lang = 'it' } = (await req.json()) as { prompt: string; lang?: Lang }

    const sys = [
      `You rewrite briefs into concise, detailed prompts for social content generation.`,
      `ALWAYS write 100% in LANG=<${lang}>. Do not mix languages.`,
      `Keep 4–6 bullet constraints (style, audience, tone, product specifics).`,
    ].join('\n')

    const usr = [
      `Original brief: ${prompt}`,
      `Return only the improved prompt text (no JSON, no bullets symbol).`,
    ].join('\n')

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      // fallback locale (no LLM)
      const fallback =
        lang === 'en'
          ? `Refined prompt (offline): ${prompt}`
          : `Prompt migliorato (offline): ${prompt}`
      return NextResponse.json({ ok: true, prompt: fallback })
    }

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.4,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: usr },
        ],
      }),
    })
    const j = await r.json()
    const out = j?.choices?.[0]?.message?.content?.trim() ?? ''

    return NextResponse.json({ ok: true, prompt: out })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: 'bad_request', message: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    )
  }
}
