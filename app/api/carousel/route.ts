// app/api/carousel/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import sharp from 'sharp'
import { guardOr429 } from '@/lib/rate-limit/rate-limit'
import { parseTOON } from '@/lib/toon/parse'

export const runtime = 'nodejs'

// ---------- Tipi ----------
type BgKind = 'plain' | 'horde'
type Format = 'svg' | 'png'
type Profile = 'square' | 'portrait' | 'story'

type Body = {
  slides?: string[]
  count?: number
  profiles?: Profile[]
  formats?: Format[]
  width?: number
  height?: number
  background?: BgKind
  hordePromptTemplate?: string
}

// ---------- Costanti ----------
const DEFAULT_COUNT = 5 as const
const PROFILES: Record<Profile, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
}

// ---------- Utils base ----------
function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength)
  new Uint8Array(ab).set(u8)
  return ab
}

function escapeXml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function pickFontSize(text: string): number {
  const len = text.trim().length
  if (len > 110) return 40
  if (len > 80) return 48
  if (len > 55) return 56
  if (len > 32) return 64
  return 72
}

function wrapWords(text: string, maxWordsPerLine: number): string[] {
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let buf: string[] = []
  for (const w of words) {
    if (buf.length >= maxWordsPerLine) {
      lines.push(buf.join(' '))
      buf = []
    }
    buf.push(w)
  }
  if (buf.length) lines.push(buf.join(' '))
  return lines
}

function palette(i: number) {
  const sets = [
    { bg1: '#0B0F1A', bg2: '#0F172A', fg: '#FFFFFF', subtle: '#94A3B8', accent: '#8B5CF6' },
    { bg1: '#111827', bg2: '#0B1220', fg: '#F9FAFB', subtle: '#D1D5DB', accent: '#60A5FA' },
    { bg1: '#0F172A', bg2: '#1E293B', fg: '#FFFFFF', subtle: '#CBD5E1', accent: '#34D399' },
  ]
  return sets[i % sets.length]
}

/**
 * buildSlideSVG con clamp delle righe (anti overflow).
 */
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
  const rawLines = wrapWords(text, wordsPerLine)

  const titleTop = pad + 120
  const titleBottom = height - pad - 64
  const lineH = Math.round(fs * 1.15)
  const maxLines = Math.max(1, Math.floor((titleBottom - titleTop) / lineH))

  const lines = rawLines.slice(0, maxLines)
  if (rawLines.length > maxLines) {
    const last = lines[lines.length - 1]
    lines[lines.length - 1] = (last.replace(/\.*$/, '').trimEnd() + '…').trim()
  }

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

  <rect x="8" y="8" width="${width - 16}" height="${height - 16}" rx="24" fill="none" stroke="${colors.accent}" stroke-opacity="0.35"/>

  <g transform="translate(${pad}, ${pad})">
    <rect x="0" y="0" width="140" height="40" rx="20" fill="${colors.accent}" fill-opacity="0.25" />
    <text x="70" y="26" text-anchor="middle" class="badge">Slide ${String(idx + 1).padStart(2, '0')}</text>
  </g>

  <g transform="translate(${pad}, ${titleTop})">
    ${lines
      .map(
        (line, i) =>
          `<text class="title" x="0" y="${i * lineH}" font-size="${fs}">${escapeXml(line)}</text>`
      )
      .join('\n    ')}
  </g>
</svg>`
}

function ensureCount(items: string[], n: number): string[] {
  const out = items.slice(0, n)
  while (out.length < n) out.push(`Slide ${String(out.length + 1).padStart(2, '0')}`)
  return out
}

async function svgToPng(svg: string, width: number, height: number): Promise<Uint8Array> {
  const buf = await sharp(Buffer.from(svg)).resize(width, height, { fit: 'cover' }).png().toBuffer()
  return new Uint8Array(buf)
}

async function tryHordeBg(
  text: string,
  width: number,
  height: number,
  template?: string
): Promise<string | undefined> {
  try {
    const prompt =
      template
        ?.replaceAll('{text}', text)
        .replaceAll('{w}', String(width))
        .replaceAll('{h}', String(height)) ?? `${text}, minimal abstract background`
    const resp = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/image/horde`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, width, height, steps: 8, format: 'png' }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!resp.ok) return undefined
    const u8 = new Uint8Array(await resp.arrayBuffer())
    const b64 = Buffer.from(u8).toString('base64')
    return `data:image/png;base64,${b64}`
  } catch {
    return undefined
  }
}

// ---------- Parser input (TOON o JSON) ----------
async function readBody(req: NextRequest): Promise<Body> {
  const ct = (req.headers.get('content-type') || '').toLowerCase()
  if (ct.includes('text/toon')) {
    const raw = await req.text()
    const doc = parseTOON(raw) as any
    const payload = doc?.carousel ?? doc ?? {}
    return {
      slides: Array.isArray(payload.slides) ? payload.slides.map(String) : undefined,
      count: Number.isFinite(payload.count) ? Number(payload.count) : undefined,
      profiles: Array.isArray(payload.profiles) ? payload.profiles : undefined,
      formats: Array.isArray(payload.formats) ? payload.formats : undefined,
      width: Number.isFinite(payload.width) ? Number(payload.width) : undefined,
      height: Number.isFinite(payload.height) ? Number(payload.height) : undefined,
      background: payload.background === 'horde' ? 'horde' : 'plain',
      hordePromptTemplate:
        typeof payload.hordePromptTemplate === 'string' ? payload.hordePromptTemplate : undefined,
    }
  }

  const j = await req.json().catch(() => ({}) as any)
  const payload = j?.carousel ?? j ?? {}
  return {
    slides: Array.isArray(payload.slides) ? payload.slides.map(String) : undefined,
    count: Number.isFinite(payload.count) ? Number(payload.count) : undefined,
    profiles: Array.isArray(payload.profiles) ? payload.profiles : undefined,
    formats: Array.isArray(payload.formats) ? payload.formats : undefined,
    width: Number.isFinite(payload.width) ? Number(payload.width) : undefined,
    height: Number.isFinite(payload.height) ? Number(payload.height) : undefined,
    background: payload.background === 'horde' ? 'horde' : 'plain',
    hordePromptTemplate:
      typeof payload.hordePromptTemplate === 'string' ? payload.hordePromptTemplate : undefined,
  }
}

// ---------- Handler ----------
export async function POST(req: NextRequest) {
  const guard = await guardOr429(req, { endpoint: 'carousel', maxHits: 60, windowSec: 60 })
  if (guard) return guard

  try {
    const body = await readBody(req)

    const count = Number.isFinite(body.count)
      ? Math.max(1, Math.min(10, body.count!))
      : DEFAULT_COUNT
    const profiles = (body.profiles?.length ? body.profiles : (['portrait'] as Profile[])).filter(
      (p): p is Profile => p === 'square' || p === 'portrait' || p === 'story'
    )
    const formats = (body.formats?.length ? body.formats : (['svg'] as Format[])).filter(
      (f): f is Format => f === 'svg' || f === 'png'
    )

    const baseSlides =
      Array.isArray(body.slides) && body.slides.length
        ? body.slides.map((s) => s.toString())
        : ['Hook 1', 'Hook 2', 'Hook 3']
    const slides = ensureCount(baseSlides, count)

    const background: BgKind = body.background === 'horde' ? 'horde' : 'plain'
    const hordeTemplate = body.hordePromptTemplate

    const zip = new JSZip()

    const manifestLines: string[] = [
      'carousel:',
      `  count: ${count}`,
      `  profiles[${profiles.length}]${profiles.length ? '{text}' : ''}:`,
      ...profiles.map((p) => `    ${p}`),
      `  formats[${formats.length}]${formats.length ? '{text}' : ''}:`,
      ...formats.map((f) => `    ${f}`),
      `  background: ${background}`,
    ]

    for (let i = 0; i < slides.length; i++) {
      const txt = slides[i]

      for (const profile of profiles) {
        const dims = PROFILES[profile]
        const width = body.width && body.width > 0 ? Math.floor(body.width) : dims.width
        const height = body.height && body.height > 0 ? Math.floor(body.height) : dims.height

        let bgDataUrl: string | undefined
        if (background === 'horde') {
          const perBgGuard = await guardOr429(req, {
            endpoint: 'carousel_bg',
            bucket: profile,
            maxHits: 15,
            windowSec: 60,
          })
          if (perBgGuard) {
            bgDataUrl = undefined
          } else {
            bgDataUrl = await tryHordeBg(txt, width, height, hordeTemplate)
          }
        }

        const svg = buildSlideSVG(txt, i, { width, height, background, bgDataUrl })
        const nameSvg = `slide_${String(i + 1).padStart(2, '0')}_${profile}.svg`
        zip.file(nameSvg, svg)

        if (formats.includes('png')) {
          const perPngGuard = await guardOr429(req, {
            endpoint: 'carousel_png',
            bucket: profile,
            maxHits: 60,
            windowSec: 60,
          })
          if (!perPngGuard) {
            const pngU8 = await svgToPng(svg, width, height)
            const namePng = `slide_${String(i + 1).padStart(2, '0')}_${profile}.png`
            zip.file(namePng, pngU8)
          }
        }

        if (!formats.includes('svg')) {
          zip.remove(nameSvg)
        }
      }
    }

    zip.file('manifest.toon', manifestLines.join('\n'))

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
