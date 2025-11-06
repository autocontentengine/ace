// app/api/demo/route.ts
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

type Body = { brief?: string; lang?: 'it' | 'en' }

function rand<T>(arr: T[], n: number) {
  const out: T[] = []
  const copy = arr.slice()
  while (out.length < n && copy.length) {
    const i = Math.floor(Math.random() * copy.length)
    out.push(copy.splice(i, 1)[0])
  }
  return out
}

function demoGenerate(brief: string, lang: 'it' | 'en') {
  const hooks_it = [
    'Semplice. Chiaro. Efficace.',
    'Dai voce al tuo brand.',
    'Less is more (davvero).',
    'Ogni post, un’idea concreta.',
    'Contenuti che convertono.',
    'Dettagli che fanno la differenza.',
  ]
  const hooks_en = [
    'Simple. Clear. Effective.',
    'Give your brand a voice.',
    'Less is more (really).',
    'Every post, a concrete idea.',
    'Content that converts.',
    'Details that make the difference.',
  ]
  const caps_it = [
    `Brief: ${brief}. Tono naturale, beneficio al centro, call to action chiara.`,
    'Sii breve: un gancio forte e un invito concreto.',
    'Sperimenta: misura cosa funziona e replica.',
    'Parla come il tuo pubblico, non come un manuale.',
  ]
  const caps_en = [
    `Brief: ${brief}. Natural tone, benefit upfront, clear call to action.`,
    'Keep it short: strong hook and concrete ask.',
    'Experiment: measure what works and repeat.',
    'Speak like your audience, not like a manual.',
  ]

  return {
    hooks: rand(lang === 'it' ? hooks_it : hooks_en, 3),
    captions: rand(lang === 'it' ? caps_it : caps_en, 3),
  }
}

export async function POST(req: NextRequest) {
  try {
    const { brief = 'ecommerce skincare minimal, premium tone', lang = 'it' } = (await req
      .json()
      .catch(() => ({}))) as Body

    const result = demoGenerate(brief, lang)
    return NextResponse.json({ ok: true, result })
  } catch (e: any) {
    console.error('[demo] error', e)
    return NextResponse.json({ ok: false, error: 'unhandled' }, { status: 500 })
  }
}
