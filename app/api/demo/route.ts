// app/api/demo/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

type GroqMsg = { role: 'system' | 'user' | 'assistant'; content: string }

function extractJson(text: string) {
  // prova a prendere blocco ```json ... ```
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1] : text
  const objMatch = raw.match(/\{[\s\S]*\}$/)
  const candidate = objMatch ? objMatch[0] : raw
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

async function callGroq({ model, brief }: { model: string; brief: string }): Promise<{
  hooks?: string[]
  captions?: string[]
  carousels?: { title: string; slides: string[] }[]
  raw?: string
}> {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) throw new Error('Missing GROQ_API_KEY')

  const messages: GroqMsg[] = [
    {
      role: 'system',
      content:
        'Sei un copywriter per social in italiano. Rispondi solo in JSON nel formato { "hooks": string[], "captions": string[], "carousels": [{ "title": string, "slides": string[] }] }. Niente testo fuori dal JSON.',
    },
    {
      role: 'user',
      content: `Brief: ${brief}\nGenera 3 hook brevi, 3 caption concise, 1 carosello con 5 slide.`,
    },
  ]

  const payload = {
    model,
    temperature: 0.7,
    messages,
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Groq ${res.status}: ${txt}`)
  }

  const json = (await res.json()) as any
  const content: string = json?.choices?.[0]?.message?.content ?? ''
  const parsed = extractJson(content)

  if (parsed && typeof parsed === 'object') {
    return {
      hooks: Array.isArray(parsed.hooks) ? parsed.hooks.slice(0, 10) : undefined,
      captions: Array.isArray(parsed.captions) ? parsed.captions.slice(0, 10) : undefined,
      carousels: Array.isArray(parsed.carousels) ? parsed.carousels : undefined,
      raw: content,
    }
  }

  // fallback minimale
  const lines = content
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    hooks: lines.slice(0, 3),
    captions: lines.slice(3, 6),
    carousels: [{ title: 'Carosello', slides: lines.slice(6, 11) }],
    raw: content,
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { brief?: string }
  const brief = (body?.brief ?? '').toString().trim()

  if (!brief) {
    return NextResponse.json({ ok: false, error: 'Missing brief' }, { status: 400 })
  }

  try {
    const model = process.env.GROQ_MODEL_DEMO || 'llama-3.1-8b-instant'
    const out = await callGroq({ model, brief })
    return NextResponse.json({ ok: true, result: out, model })
  } catch {
    return NextResponse.json({ ok: false, error: 'Demo failed' }, { status: 500 })
  }
}
