// app/api/generate/copy/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isRateLimited, clientUUID } from '@/lib/rate-limit/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Lang = 'it' | 'en'
type Body = {
  brief: string
  lang?: Lang
  n_hooks?: number
  n_captions?: number
}

const MODEL = 'llama-3.3-70b-versatile'
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const API_KEY = process.env.GROQ_API_KEY || ''

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  try {
    if (!API_KEY) {
      return NextResponse.json({ ok: false, error: 'missing_groq_api_key' }, { status: 500 })
    }

    // --- Rate limit guard ---
    const userId = clientUUID(req)
    const limited = await isRateLimited(userId, 'generate_copy')
    if (limited) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
    }

    const b = (await req.json()) as Body
    const brief = (b.brief || '').trim()
    const lang: Lang = b.lang === 'en' ? 'en' : 'it'
    const nHooks = clampInt(b.n_hooks ?? 7, 3, 12)
    const nCaptions = clampInt(b.n_captions ?? 5, 3, 12)

    if (!brief) {
      return NextResponse.json({ ok: false, error: 'missing_brief' }, { status: 400 })
    }

    const system = lang === 'en' ? SYSTEM_EN : SYSTEM_IT
    const user = buildUserPrompt(brief, lang, nHooks, nCaptions)

    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.8,
        max_tokens: 800,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
          { role: 'user', content: FEWSHOTS[lang] },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      return NextResponse.json(
        { ok: false, error: 'groq_error', status: resp.status, text: txt },
        { status: 502 }
      )
    }

    const json = await resp.json()
    const content: string = json?.choices?.[0]?.message?.content ?? '{}'
    const parsed = safeParse(content)

    // Normalizza & migliora
    const hooks = postProcessHooks(parsed.hooks ?? [], lang, nHooks)
    const captions = postProcessCaptions(parsed.captions ?? [], lang, nCaptions)

    const latency_ms = Date.now() - t0
    return NextResponse.json(
      {
        ok: true,
        brief,
        lang,
        model: MODEL,
        latency_ms,
        result: { hooks, captions },
      },
      { status: 200 }
    )
  } catch (e) {
    console.error('[generate/copy] error', e)
    return NextResponse.json(
      { ok: false, error: 'bad_request', message: String(e) },
      { status: 400 }
    )
  }
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function buildUserPrompt(brief: string, lang: Lang, nHooks: number, nCaptions: number) {
  const req =
    lang === 'en'
      ? `BRIEF: ${brief}\n\nReturn tight, punchy marketing copy.`
      : `BRIEF: ${brief}\n\nRitorna copy marketing breve e incisivo.`
  return JSON.stringify({
    task: 'hooks_captions',
    lang,
    constraints: {
      hooks: { count: nHooks, max_words: 8, ban_words: BANLIST[lang] },
      captions: { count: nCaptions, max_chars: 160, ban_words: BANLIST[lang] },
      tone: 'brand-consistent, concrete, modern',
      avoid: ['cliché', 'over-promising', 'spammy CTA'],
    },
    format: { type: 'json', shape: { hooks: ['...'], captions: ['...'] } },
    brief: req,
  })
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

const BANLIST: Record<Lang, string[]> = {
  it: ['scopri', 'trasforma', 'sblocca', 'rivoluziona', 'impareggiabile', 'definitivo'],
  en: ['discover', 'transform', 'unlock', 'revolutionize', 'unbeatable', 'ultimate'],
}

const SYSTEM_IT = `
Sei un copywriter senior per social. Genera HOOK (<=8 parole, senza cliché) e CAPTION (<=160 caratteri) in ITALIANO.
Evita superlativi abusati. Tono moderno, concreto, focalizzato su beneficio/USP. Rispondi SOLO in JSON valido {"hooks":[], "captions":[]}.
`.trim()

const SYSTEM_EN = `
You are a senior social copywriter. Generate HOOKS (<=8 words, no clichés) and CAPTIONS (<=160 chars) in ENGLISH.
Avoid overused superlatives. Modern, concrete tone with clear benefits/USPs. Reply ONLY valid JSON {"hooks":[], "captions":[]}.
`.trim()

const FEWSHOTS: Record<Lang, string> = {
  it: JSON.stringify({
    positive_example: {
      hooks: ['Routine semplice, risultati visibili', 'Pelle luminosa, zero fronzoli'],
      captions: [
        'Ingredienti essenziali, efficacia reale. La tua pelle, al meglio ogni giorno.',
        'Formula pulita. Risultati che vedi e senti.',
      ],
    },
    negative_example: {
      hooks: ['Scopri il segreto definitivo!!!', 'Trasforma la tua vita per sempre'],
      captions: [
        'Il prodotto migliore di sempre—risultati miracolosi in 3 giorni!!!',
        'Sblocca la pelle perfetta in un attimo!',
      ],
    },
  }),
  en: JSON.stringify({
    positive_example: {
      hooks: ['Clean routine, visible results', 'Radiant skin, no fuss'],
      captions: [
        'Essential ingredients. Real efficacy. Your skin, at its best—daily.',
        'Clean formula. Results you can feel and see.',
      ],
    },
    negative_example: {
      hooks: ['Discover the ultimate secret!!!', 'Transform your life forever'],
      captions: [
        'The best product ever—miracle results in 3 days!!!',
        'Unlock perfect skin instantly!',
      ],
    },
  }),
}

// ---------- Post-processing & rerank ----------

function postProcessHooks(hooks: string[], _lang: Lang, target: number) {
  const cleaned = hooks
    .map((h) => normalizeLine(h, _lang))
    .filter(Boolean)
    .filter((h) => !containsBanned(h!, BANLIST[_lang]))
  const deduped = dedupeCaseInsensitive(cleaned as string[])
  const reranked = rerankHooks(deduped)
  return padIfShort(reranked, _lang, target)
}

function postProcessCaptions(caps: string[], _lang: Lang, target: number) {
  const cleaned = caps
    .map((c) => normalizeSentence(c, _lang))
    .filter(Boolean)
    .filter((c) => !containsBanned(c!, BANLIST[_lang]))
  const deduped = dedupeCaseInsensitive(cleaned as string[])
  const reranked = rerankCaptions(deduped)
  return padIfShort(reranked, _lang, target, true)
}

function normalizeLine(s: string, _lang: Lang) {
  let t = s.trim()
  if (!t) return ''
  t = t.replace(/[!?.]{2,}$/u, '!').replace(/\s{2,}/g, ' ')
  t = t[0].toUpperCase() + t.slice(1)
  if (/^[A-Z\s]+$/.test(t)) t = toTitleCase(t.toLowerCase())
  const words = t.split(/\s+/)
  if (words.length > 10) t = words.slice(0, 10).join(' ')
  return t
}

function normalizeSentence(s: string, _lang: Lang) {
  let t = s.trim()
  if (!t) return ''
  t = t.replace(/\s{2,}/g, ' ')
  if (!/[.?!…]$/.test(t)) t += '.'
  if (/^[A-Z\s]+$/.test(t)) t = toTitleCase(t.toLowerCase())
  if (t.length > 180) t = t.slice(0, 177).trimEnd() + '…'
  return t[0].toUpperCase() + t.slice(1)
}

function containsBanned(s: string, banned: string[]) {
  const low = s.toLowerCase()
  return banned.some((w) => low.includes(w))
}

function dedupeCaseInsensitive(arr: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of arr) {
    const k = s.toLowerCase()
    if (!seen.has(k)) {
      seen.add(k)
      out.push(s)
    }
  }
  return out
}

// --- Rerank “no urla”, anti-duplicati, lunghezza ideale ~42 char ---
function scoreLine(s: string) {
  const t = s.trim()
  const len = t.length
  const upperRatio = t.replace(/[^A-Z]/g, '').length / Math.max(1, len)
  const excl = (t.match(/!/g) || []).length
  const dupSeq = /(.)\1{2,}/.test(t) ? 1 : 0
  const endPunctPenalty = /[!?.,:;]$/.test(t) ? 0.1 : 0
  const lenIdeal = Math.max(0, 1 - Math.abs(len - 42) / 42)
  return lenIdeal - upperRatio - 0.2 * excl - 0.5 * dupSeq - endPunctPenalty
}

function rerankHooks(list: string[]) {
  return [...list].sort((a, b) => scoreLine(b) - scoreLine(a))
}
function rerankCaptions(list: string[]) {
  return [...list].sort((a, b) => scoreLine(b) - scoreLine(a))
}

function padIfShort(list: string[], _lang: Lang, target: number, sentence = false) {
  const out = [...list]
  while (out.length < target && list.length > 0) {
    const base = (list[out.length % list.length] ?? 'More value, less noise').trim()
    const v = sentence ? base + ' ' : base + ' •'
    out.push(normalizeLine(v, _lang))
  }
  return out.slice(0, target)
}

function toTitleCase(s: string) {
  return s.replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase())
}
