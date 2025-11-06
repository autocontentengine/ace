// app/api/generate/copy/route.ts
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const PUBLIC_TEST_KEY = 'ace_test_12345678901234567890123456789012'
const PRIVATE_API_KEY = process.env.PRIVATE_API_KEY // opzionale

function isAuthorized(req: NextRequest) {
  const k = req.headers.get('x-api-key') ?? ''
  return k === PUBLIC_TEST_KEY || (PRIVATE_API_KEY && k === PRIVATE_API_KEY)
}

type Body = {
  brief: string
  lang?: 'it' | 'en'
}

function fallbackGenerate(brief: string, lang: 'it' | 'en') {
  const h_it = [
    'Svegliati e brilla!',
    'Meno parole, più impatto.',
    'La semplicità che funziona.',
    'Dove la qualità parla.',
    'Fallo a modo tuo.',
    'Ogni giorno, meglio.',
    'Pensato per ispirare.',
    'Il tuo prossimo passo.',
  ]
  const h_en = [
    'Wake up and shine!',
    'Fewer words, more impact.',
    'Simplicity that works.',
    'Where quality speaks.',
    'Do it your way.',
    'Better every day.',
    'Built to inspire.',
    'Your next move.',
  ]
  const c_it = [
    `Brief: ${brief}. Trova il tuo tono e resta costante.`,
    `Parti dall’essenziale: messaggi chiari, immagini pulite.`,
    `Parla al tuo pubblico, una promessa chiara alla volta.`,
    `Ogni post è un test: misura, migliora, ripeti.`,
    `Più valore, meno rumore.`,
  ]
  const c_en = [
    `Brief: ${brief}. Find your tone and stay consistent.`,
    `Start from the essentials: clear copy, clean visuals.`,
    `Speak to your audience, one clear promise at a time.`,
    `Every post is a test: measure, improve, repeat.`,
    `More value, less noise.`,
  ]
  const hooks = (lang === 'it' ? h_it : h_en).slice(0, 6)
  const captions = (lang === 'it' ? c_it : c_en).slice(0, 5)
  return { hooks, captions }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    const { brief, lang = 'it' } = (await req.json()) as Body
    if (!brief || typeof brief !== 'string') {
      return NextResponse.json({ ok: false, error: 'invalid brief' }, { status: 400 })
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY
    const targetLang = lang === 'en' ? 'English' : 'Italiano'

    if (!GROQ_API_KEY) {
      const { hooks, captions } = fallbackGenerate(brief, lang)
      return NextResponse.json({
        ok: true,
        brief,
        model: 'fallback-local',
        result: { hooks, captions },
      })
    }

    const system = `You are a marketing copywriter. Write concise social hooks and captions in ${targetLang}. Keep it natural, catchy, and useful.`
    const user = `BRIEF: ${brief}

Return ONLY a minified JSON object with:
{
  "hooks": ["... up to 8 short hooks ..."],
  "captions": ["... 5-8 short captions ..."]
}`

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 512,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (!resp.ok) {
      const txt = await resp.text()
      console.error('[generate/copy] groq error', resp.status, txt)
      const { hooks, captions } = fallbackGenerate(brief, lang)
      return NextResponse.json({
        ok: true,
        brief,
        model: 'fallback-local',
        result: { hooks, captions },
      })
    }

    const data = await resp.json()
    const content = data?.choices?.[0]?.message?.content ?? '{}'
    let parsed: any = {}
    try {
      parsed = JSON.parse(content)
    } catch {
      parsed = {}
    }
    const hooks: string[] = Array.isArray(parsed.hooks) ? parsed.hooks.slice(0, 8) : []
    const captions: string[] = Array.isArray(parsed.captions) ? parsed.captions.slice(0, 8) : []

    return NextResponse.json({
      ok: true,
      brief,
      model: 'llama-3.3-70b-versatile',
      result: { hooks, captions },
    })
  } catch (e: any) {
    console.error('[generate/copy] error', e)
    return NextResponse.json({ ok: false, error: 'unhandled' }, { status: 500 })
  }
}
