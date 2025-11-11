// app/api/generate/copy/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Lang = 'it' | 'en'
type BodyJsonFlat = { brief?: string; lang?: Lang; n_hooks?: number; n_captions?: number }
type BodyJsonNested = { copy?: BodyJsonFlat }

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const API_KEY = process.env.GROQ_API_KEY || ''

// ---------- IO helpers ----------

function wantsJson(req: NextRequest) {
  const url = new URL(req.url)
  if (url.searchParams.get('format') === 'json') return true
  const accept = req.headers.get('accept') || ''
  return /\bapplication\/json\b/i.test(accept)
}

function contentType(req: NextRequest) {
  return (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
}

/** Parse TOON minimale per input: supporta sia "copy: { brief, lang }" che "brief/lang" piatti. */
async function parseToonInput(req: NextRequest): Promise<BodyJsonFlat> {
  const raw = await req.text()
  const out: BodyJsonFlat = {}

  // Normalizza line-endings e rimuove BOM
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')

  // Estrae blocco "copy:" se presente
  let block = text
  const mCopy = text.match(/^[ \t]*copy:[ \t]*\n([\s\S]*)$/m)
  if (mCopy) block = mCopy[1]

  // Prende solo righe tipo "key: value"
  const lines = block.split('\n')
  for (const ln of lines) {
    const m = ln.match(/^[ \t]*([A-Za-z0-9_]+)[ \t]*:[ \t]*(.+?)\s*$/)
    if (!m) continue
    const k = m[1].toLowerCase()
    const v = m[2]
    if (k === 'brief') out.brief = v
    else if (k === 'lang') out.lang = v === 'en' ? 'en' : 'it'
    else if (k === 'n_hooks') out.n_hooks = clampInt(Number(v), 1, 20)
    else if (k === 'n_captions') out.n_captions = clampInt(Number(v), 1, 20)
  }
  return out
}

async function readInput(req: NextRequest): Promise<BodyJsonFlat> {
  const ct = contentType(req)
  if (ct === 'text/toon') {
    return parseToonInput(req)
  }
  // JSON: supporta sia annidato che piatto
  const j = (await req.json().catch(() => ({}))) as BodyJsonNested | BodyJsonFlat
  // @ts-expect-error runtime merge
  const flat: BodyJsonFlat = j?.copy || j || {}
  return flat
}

function replyToon(payload: {
  hooks: string[]
  captions: string[]
  brief: string
  lang: Lang
  latency_ms: number
}) {
  const { hooks, captions, brief, lang, latency_ms } = payload
  const hooksBlock =
    hooks.length > 0
      ? '  hooks[' +
        hooks.length +
        ']{text}:\n' +
        hooks.map((h) => `    ${escapeToon(h)}`).join('\n')
      : '  hooks[0]{text}:'
  const captionsBlock =
    captions.length > 0
      ? '  captions[' +
        captions.length +
        ']{text}:\n' +
        captions.map((c) => `    ${escapeToon(c)}`).join('\n')
      : '  captions[0]{text}:'

  const toon =
    'copy:\n' +
    hooksBlock +
    '\n' +
    captionsBlock +
    '\nmeta:\n' +
    `  brief: ${escapeToon(brief)}\n` +
    `  lang: ${lang}\n` +
    `  model: ${MODEL}\n` +
    'metrics:\n' +
    `  latency_ms: ${latency_ms}\n`

  return new NextResponse(toon, {
    status: 200,
    headers: { 'content-type': 'text/toon; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function replyJson(payload: {
  hooks: string[]
  captions: string[]
  brief: string
  lang: Lang
  latency_ms: number
}) {
  const { hooks, captions, brief, lang, latency_ms } = payload
  return NextResponse.json(
    {
      ok: true,
      brief,
      lang,
      model: MODEL,
      metrics: { latency_ms },
      result: { hooks, captions },
    },
    { status: 200 }
  )
}

function errorToon(status: number, code: string, extra?: Record<string, unknown>) {
  const base =
    `ok: false\n` +
    `error: ${code}\n` +
    (extra
      ? Object.entries(extra)
          .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join('\n') + '\n'
      : '')
  return new NextResponse(base, {
    status,
    headers: { 'content-type': 'text/toon; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function escapeToon(s: string) {
  return s
    .replace(/\r?\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ---------- Prompting ----------

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
        'Il prodotto migliore di sempre, risultati miracolosi in 3 giorni!!!',
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

// ---------- Route ----------

export async function POST(req: NextRequest) {
  const wantsJsonOut = wantsJson(req)

  try {
    if (!API_KEY) {
      const err = wantsJsonOut
        ? NextResponse.json({ ok: false, error: 'missing_groq_api_key' }, { status: 500 })
        : errorToon(500, 'missing_groq_api_key')
      return err
    }

    // Accetta TOON e JSON (annidato/flat)
    const inBody = await readInput(req)
    const brief = (inBody.brief || '').trim()
    const lang: Lang = inBody.lang === 'en' ? 'en' : 'it'
    const nHooks = clampInt(inBody.n_hooks ?? 7, 3, 12)
    const nCaptions = clampInt(inBody.n_captions ?? 5, 3, 12)

    if (!brief) {
      return wantsJsonOut
        ? NextResponse.json({ ok: false, error: 'missing_brief' }, { status: 400 })
        : errorToon(400, 'missing_brief')
    }

    const system = lang === 'en' ? SYSTEM_EN : SYSTEM_IT
    const user = buildUserPrompt(brief, lang, nHooks, nCaptions)

    const t0 = Date.now()
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
      const err = wantsJsonOut
        ? NextResponse.json(
            { ok: false, error: 'groq_error', status: resp.status, text: txt },
            { status: 502 }
          )
        : errorToon(502, 'groq_error', { status: resp.status, text: txt })
      return err
    }

    const latency_ms = Date.now() - t0
    const json = await resp.json()
    const content: string = json?.choices?.[0]?.message?.content ?? '{}'
    const parsed = safeParse(content)

    // Normalizza & migliora
    const hooks = postProcessHooks(parsed.hooks ?? [], lang, nHooks)
    const captions = postProcessCaptions(parsed.captions ?? [], lang, nCaptions)

    // Auto-feedback fire-and-forget (TOON)
    void sendAutoFeedback(req, {
      endpoint: 'generate_copy',
      latency_ms,
      auto_score: heuristicScore(hooks, captions),
      manual_score: undefined,
      meta: { brief, lang },
    }).catch(() => {})

    const payload = { hooks, captions, brief, lang, latency_ms }
    return wantsJsonOut ? replyJson(payload) : replyToon(payload)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return wantsJsonOut
      ? NextResponse.json({ ok: false, error: 'bad_request', message: msg }, { status: 400 })
      : errorToon(400, 'bad_request', { message: msg })
  }
}

// ---------- Helpers ----------

function clampInt(n: number | undefined, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.floor(n!)))
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

function postProcessHooks(hooks: string[], lang: Lang, target: number) {
  const cleaned = hooks
    .map((h) => normalizeLine(h, lang))
    .filter(Boolean)
    .filter((h) => !containsBanned(h!, BANLIST[lang]))
  const deduped = dedupeCaseInsensitive(cleaned as string[])
  const reranked = rerankHooks(deduped, lang)
  return padIfShort(reranked, lang, target)
}

function postProcessCaptions(caps: string[], lang: Lang, target: number) {
  const cleaned = caps
    .map((c) => normalizeSentence(c, lang))
    .filter(Boolean)
    .filter((c) => !containsBanned(c!, BANLIST[lang]))
  const deduped = dedupeCaseInsensitive(cleaned as string[])
  const reranked = rerankCaptions(deduped)
  return padIfShort(reranked, lang, target, true)
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

function rerankHooks(list: string[], lang: Lang) {
  return [...list].sort((a, b) => scoreHook(b, lang) - scoreHook(a, lang))
}

function rerankCaptions(list: string[]) {
  return [...list].sort((a, b) => scoreCaption(b) - scoreCaption(a))
}

function scoreHook(s: string, _lang: Lang) {
  const words = s.trim().split(/\s+/).length
  const ideal = 6
  const lenScore = 1 - Math.min(1, Math.abs(words - ideal) / ideal)
  const power =
    /(\bskin|\bpelle|\bclean|\broutine|\bradiant|\bglow|\bresults|\bresultati|\bessenziale)/i.test(
      s
    )
      ? 0.3
      : 0
  const noPunct = /[!?]$/.test(s) ? 0 : 0.1
  return lenScore + power + noPunct
}

function scoreCaption(s: string) {
  const len = s.length
  const ideal = 120
  const lenScore = 1 - Math.min(1, Math.abs(len - ideal) / ideal)
  const hasBenefit =
    /\b(benefit|results|efficacy|routine|ingredient|formula|pelle|risultati|efficacia)\b/i.test(s)
      ? 0.2
      : 0
  return lenScore + hasBenefit
}

function padIfShort(list: string[], lang: Lang, target: number, sentence = false) {
  if (list.length === 0) {
    // se vuoto, usa un seed minimale
    list = ['More value, less noise']
  }
  const out = [...list]
  while (out.length < target) {
    const base = (list[out.length % list.length] ?? 'More value, less noise').trim()
    const v = sentence ? base + ' ' : base + ' •'
    out.push(normalizeLine(v, lang))
  }
  return out.slice(0, target)
}

function toTitleCase(s: string) {
  return s.replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase())
}

// ---------- Auto feedback ----------

async function sendAutoFeedback(
  req: NextRequest,
  p: {
    endpoint: string
    latency_ms: number
    auto_score?: number
    manual_score?: number
    meta?: Record<string, unknown>
  }
) {
  try {
    const url = new URL('/api/quality/feedback', req.url)
    const toon =
      'feedback:\n' +
      `  endpoint: ${p.endpoint}\n` +
      `  latency_ms: ${Math.max(0, Math.floor(p.latency_ms))}\n` +
      (typeof p.auto_score === 'number' ? `  auto_score: ${p.auto_score}\n` : '') +
      (typeof p.manual_score === 'number' ? `  manual_score: ${p.manual_score}\n` : '') +
      (p.meta
        ? '  meta:\n' +
          Object.entries(p.meta)
            .map(([k, v]) => `    ${k}: ${String(v)}`)
            .join('\n') +
          '\n'
        : '')
    await fetch(url.toString(), {
      method: 'POST',
      headers: { 'content-type': 'text/toon' },
      body: toon,
    }).catch(() => {})
  } catch {
    // ignora
  }
}

function heuristicScore(hooks: string[], captions: string[]) {
  // heuritica banalotta 0..10
  const h = Math.min(10, hooks.length * 1.0)
  const c = Math.min(10, captions.length * 1.2)
  return Math.round(((h + c) / 2) * 10) / 10
}
