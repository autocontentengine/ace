// app/api/carousel/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { isRateLimited, clientUUID } from '@/lib/rate-limit/rate-limit'

export const runtime = 'nodejs'

type BgKind = 'plain' | 'horde'
type Body = {
  slides?: string[]
  count?: number
  width?: number
  height?: number
  background?: BgKind
  /** se usi la tua /api/image/horde puoi passare un prompt template qui (opzionale) */
  hordePromptTemplate?: string
  /** nuovi: formati e profili di export */
  formats?: Array<'svg' | 'png'>
  profiles?: Array<'square' | 'portrait' | 'story'>
}

const DEFAULT_W = 1080
const DEFAULT_H = 1350
const DEFAULT_COUNT = 5

const PROFILE_SIZES = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 }, // 4:5
  story: { width: 1080, height: 1920 }, // 9:16
} as const
type Profile = keyof typeof PROFILE_SIZES
function isProfile(x: unknown): x is Profile {
  return x === 'square' || x === 'portrait' || x === 'story'
}

/** Converte un Uint8Array in un ArrayBuffer “pulito” (garantito, non SharedArrayBuffer). */
function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength)
  new Uint8Array(ab).set(u8)
  return ab
}

/** Escape base XML per sicurezza. */
function escapeXml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

/** Semplice “auto-fit” del font: più testo → font più piccolo. */
function pickFontSize(text: string): number {
  const len = text.trim().length
  if (len > 110) return 40
  if (len > 80) return 48
  if (len > 55) return 56
  if (len > 32) return 64
  return 72
}

/** Wrap con limite di righe e ellissi sull’ultima riga. */
function wrapWords(text: string, maxWordsPerLine: number, maxLines = 5): string[] {
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let buf: string[] = []
  for (const w of words) {
    if (buf.length >= maxWordsPerLine) {
      lines.push(buf.join(' '))
      buf = []
      if (lines.length >= maxLines) break
    }
    buf.push(w)
  }
  if (lines.length < maxLines && buf.length) lines.push(buf.join(' '))
  const totalCapacity = maxWordsPerLine * maxLines
  if (words.length > totalCapacity || (lines.length === maxLines && buf.length)) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/…?$/, '') + '…'
  }
  return lines
}

/** Colori carini per sfondo semplice. */
function palette(i: number) {
  const sets = [
    { bg1: '#0B0F1A', bg2: '#0F172A', fg: '#FFFFFF', subtle: '#94A3B8', accent: '#8B5CF6' },
    { bg1: '#111827', bg2: '#0B1220', fg: '#F9FAFB', subtle: '#D1D5DB', accent: '#60A5FA' },
    { bg1: '#0F172A', bg2: '#1E293B', fg: '#FFFFFF', subtle: '#CBD5E1', accent: '#34D399' },
  ]
  return sets[i % sets.length]
}

/** Costruisce un SVG per una singola slide. */
function buildSlideSVG(
  text: string,
  idx: number,
  opts: { width: number; height: number; background: BgKind; bgDataUrl?: string }
) {
  const { width, height, background, bgDataUrl } = opts
  const colors = palette(idx)
  const pad = 64

  const fs = pickFontSize(text)
  const wordsPerLine = fs >= 72 ? 6 : fs >= 64 ? 7 : fs >= 56 ? 8 : fs >= 48 ? 9 : 10
  const lines = wrapWords(text, wordsPerLine, 5)

  const titleYStart = pad + 120
  const lineH = Math.round(fs * 1.15)

  const bgNode =
    background === 'horde' && bgDataUrl
      ? `<image href="${bgDataUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" opacity="0.9"/>`
      : `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#g)"/>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${colors.bg1}"/>
      <stop offset="100%" stop-color="${colors.bg2}"/>
    </linearGradient>
    <style>
      .title {
        font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial;
        font-weight: 800;
        fill: ${colors.fg};
        letter-spacing: -0.02em;
      }
      .badge {
        font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial;
        font-size: 16px;
        fill: ${colors.fg};
      }
    </style>
  </defs>

  ${bgNode}

  <!-- cornice -->
  <rect x="8" y="8" width="${width - 16}" height="${height - 16}" rx="24" fill="none" stroke="${colors.accent}" stroke-opacity="0.35"/>

  <!-- badge -->
  <g transform="translate(${pad}, ${pad})">
    <rect x="0" y="0" width="140" height="40" rx="20" fill="${colors.accent}" fill-opacity="0.25" />
    <text x="70" y="26" text-anchor="middle" class="badge">Slide ${String(idx + 1).padStart(2, '0')}</text>
  </g>

  <!-- titolo -->
  <g transform="translate(${pad}, ${titleYStart})">
    ${lines
      .map(
        (line, i) =>
          `<text class="title" x="0" y="${i * lineH}" font-size="${fs}">${escapeXml(line)}</text>`
      )
      .join('\n')}
  </g>
</svg>`
}

/** Assicura un array di lunghezza esatta `n` (riempie o tronca). */
function ensureCount(items: string[], n: number): string[] {
  const out = items.slice(0, n)
  while (out.length < n) out.push(`Slide ${String(out.length + 1).padStart(2, '0')}`)
  return out
}

export async function POST(req: NextRequest) {
  try {
    // --- Rate limit guard ---
    const userId = clientUUID(req)
    const limited = await isRateLimited(userId, 'carousel')
    if (limited) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
    }

    const body = (await req.json()) as Body

    const count = Number.isFinite(body.count)
      ? Math.max(1, Math.min(10, body.count!))
      : DEFAULT_COUNT
    const background: BgKind = body.background === 'horde' ? 'horde' : 'plain'

    const baseSlides =
      Array.isArray(body.slides) && body.slides.length
        ? body.slides.map((s) => s.toString())
        : ['Hook 1', 'Hook 2', 'Hook 3']
    const slides = ensureCount(baseSlides, count)

    // Formati e profili (con narrowing forte)
    const rawProfiles = Array.isArray(body.profiles) ? body.profiles.filter(isProfile) : []
    const profiles: Profile[] = rawProfiles.length ? rawProfiles : ['portrait']
    const formats = Array.isArray(body.formats) && body.formats.length ? body.formats : ['svg']

    const sizes = profiles.map((p) => ({ key: p, ...PROFILE_SIZES[p] }))

    // (Opzionale) background "horde": chiama un tuo endpoint che restituisce un dataURL
    let bgDataUrl: string | undefined = undefined
    if (background === 'horde' && body.hordePromptTemplate) {
      try {
        const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ace-six-gules.vercel.app'
        const first = sizes[0]!
        const resp = await fetch(`${base}/api/image/horde`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            promptTemplate: body.hordePromptTemplate,
            width: first.width,
            height: first.height,
          }),
        })
        if (resp.ok) {
          const j = (await resp.json()) as any
          bgDataUrl = j?.dataUrl
        }
      } catch {
        bgDataUrl = undefined
      }
    }

    const zip = new JSZip()

    const wantPng = formats.includes('png')
    const wantSvg = formats.includes('svg')
    let Resvg: any = null
    if (wantPng) {
      const mod = await import('@resvg/resvg-js')
      Resvg = mod.Resvg
    }

    for (let i = 0; i < slides.length; i++) {
      for (const s of sizes) {
        const svg = buildSlideSVG(slides[i]!, i, {
          width: s.width,
          height: s.height,
          background,
          bgDataUrl,
        })
        const base = `slide_${String(i + 1).padStart(2, '0')}_${s.key}`
        if (wantSvg) zip.file(`${base}.svg`, svg)

        if (wantPng && Resvg) {
          const r = new Resvg(svg, {
            fitTo: { mode: 'width', value: s.width },
            background: 'transparent',
          })
          const pngU8: Uint8Array = r.render().asPng()
          const ab = toArrayBuffer(pngU8)
          zip.file(`${base}.png`, ab)
        }
      }
    }

    const zipU8 = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    })

    const ab = toArrayBuffer(zipU8)

    return new NextResponse(ab, {
      status: 200,
      headers: {
        'content-type': 'application/zip',
        'content-disposition': 'attachment; filename="carousel.zip"',
        'cache-control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[carousel] error', e)
    return NextResponse.json(
      { ok: false, error: 'bad_request', message: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    )
  }
}
