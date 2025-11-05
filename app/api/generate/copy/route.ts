// app/api/generate/copy/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

type GroqMsg = { role: 'system' | 'user' | 'assistant'; content: string }

function extractJson(text: string) {
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

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    brief?: string
    model?: string
  }

  const brief = (body?.brief ?? '').toString().trim()
  const model = (body?.model ?? process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile')
    .toString()
    .trim()
  const apiKey = process.env.GROQ_API_KEY?.trim()

  if (!apiKey) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }
  if (!brief) {
    return NextResponse.json({ error: 'Missing brief' }, { status: 400 })
  }

  const messages: GroqMsg[] = [
    {
      role: 'system',
      content:
        'Sei un copywriter per social in italiano. Rispondi solo in JSON nel formato { "hooks": string[], "captions": string[], "carousels": [{ "title": string, "slides": string[] }] }. Niente testo fuori dal JSON.',
    },
    {
      role: 'user',
      content: `Brief: ${brief}\nGenera 10 hook, 10 caption e 2 caroselli (5 slide ciascuno).`,
    },
  ]

  const payload = {
    model,
    temperature: 0.7,
    messages,
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const details = await res.text()
      return NextResponse.json(
        { error: 'Groq error', status: res.status, model, details },
        { status: 500 }
      )
    }

    const json = (await res.json()) as any
    const content: string = json?.choices?.[0]?.message?.content ?? ''
    const parsed = extractJson(content)

    const result =
      parsed && typeof parsed === 'object'
        ? {
            hooks: Array.isArray(parsed.hooks) ? parsed.hooks.slice(0, 20) : undefined,
            captions: Array.isArray(parsed.captions) ? parsed.captions.slice(0, 20) : undefined,
            carousels: Array.isArray(parsed.carousels) ? parsed.carousels : undefined,
            raw: content,
          }
        : {
            hooks: content.split('\n').slice(0, 10),
            captions: content.split('\n').slice(10, 20),
            carousels: [{ title: 'Carosello', slides: content.split('\n').slice(20, 25) }],
            raw: content,
          }

    return NextResponse.json({ ok: true, brief, model, result })
  } catch {
    return NextResponse.json(
      { error: 'Groq error', status: 500, model, details: 'unknown error' },
      { status: 500 }
    )
  }
}
