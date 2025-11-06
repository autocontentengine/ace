// app/api/image/cover/route.ts
// Cover generator: SVG (default) o PNG (opzionale) da testo/hook/caption.
// PNG richiede @resvg/resvg-js e runtime Node.
//
// Body JSON (esempi):
// { "text":"Titolo forte", "theme":"dark", "format":"svg" }
// { "hooks":["Hook 1","Hook 2"], "theme":"light", "format":"png", "width":1080, "height":1350 }

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import INTER_400_BASE64 from '@/lib/fonts/inter-400-base64'

// Resvg gira solo in Node (non Edge).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Theme = 'dark' | 'light'
type Body = {
  text?: string
  hooks?: string[]
  captions?: string[]
  slides?: string[]
  theme?: Theme
  width?: number
  height?: number
  format?: 'svg' | 'png'
}

const DEFAULT_W = 1080
const DEFAULT_H = 1350

// -------------------------- utils --------------------------

function escapeXml(unsafe: string): string {
  return unsafe
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function pickText(b: Body): string {
  if (b.text && b.text.trim()) return b.text.trim()
  if (b.hooks?.length) return b.hooks[0]!
  if (b.captions?.length) return b.captions[0]!
  if (b.slides?.length) return b.slides[0]!
  return 'Your headline goes here'
}

function colors(theme: Theme) {
  if (theme === 'light') {
    return {
      bg1: '#F8FAFC',
      bg2: '#E2E8F0',
      fg: '#0B1220',
      accent: '#6366F1',
      subtle: '#334155',
    }
  }
  return {
    bg1: '#0B0F1A',
    bg2: '#0F172A',
    fg: '#FFFFFF',
    accent: '#8B5CF6',
    subtle: '#94A3B8',
  }
}

function wrapText(text: string, maxWordsPerLine = 10): string[] {
  const words = text.split(/\s+/)
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

function buildSVG({
  text,
  width = DEFAULT_W,
  height = DEFAULT_H,
  theme = 'dark',
}: {
  text: string
  width?: number
  height?: number
  theme?: Theme
}) {
  const c = colors(theme)
  const pad = 64
  const _maxTextWidth = width - pad * 2 // lasciato per futura gestione riga-lunga

  // Wrap manuale per evitare righe chilometriche
  const wrapped = wrapText(text, 22)

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: 'Inter400';
        font-style: normal;
        font-weight: 400;
        src: url(data:font/woff2;base64,${INTER_400_BASE64}) format('woff2');
      }
      .bg { fill: url(#g); }
      .title {
        font-family: 'Inter400', system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
        font-size: 72px;
        font-weight: 700;
        letter-spacing: -0.02em;
        line-height: 1.1;
        fill: ${c.fg};
      }
      .brand { font-family: 'Inter400', system-ui; font-size: 18px; fill: ${c.subtle}; }
      .pill { fill: ${c.accent}; fill-opacity: 0.18; }
      .pill-stroke { stroke: ${c.accent}; stroke-opacity: 0.45; }
    </style>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${c.bg1}"/>
      <stop offset="100%" stop-color="${c.bg2}"/>
    </linearGradient>
  </defs>

  <rect class="bg" x="0" y="0" width="${width}" height="${height}" rx="32"/>

  <!-- accent pill -->
  <g transform="translate(${pad}, ${pad})">
    <rect x="0" y="0" width="160" height="40" rx="20" class="pill"/>
    <rect x="0.5" y="0.5" width="159" height="39" rx="19.5" fill="none" class="pill-stroke"/>
    <text x="80" y="26" text-anchor="middle" class="brand">ACE • Autocontent Engine</text>
  </g>

  <!-- headline -->
  <g transform="translate(${pad}, ${pad + 120})">
    ${wrapped
      .map((line, i) => `<text class="title" x="0" y="${i * 84}">${escapeXml(line)}</text>`)
      .join('\n')}
  </g>

  <!-- footer -->
  <g transform="translate(${pad}, ${height - pad})">
    <text class="brand" x="0" y="0">Generated cover • ${theme.toUpperCase()}</text>
  </g>
</svg>`
  return svg
}

// -------------------------- route --------------------------

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body

    const theme: Theme = body.theme === 'light' ? 'light' : 'dark'
    const width = Number.isFinite(body.width) ? Math.max(320, body.width!) : DEFAULT_W
    const height = Number.isFinite(body.height) ? Math.max(320, body.height!) : DEFAULT_H
    const format = body.format === 'png' ? 'png' : 'svg'

    const text = pickText(body)
    const svg = buildSVG({ text, width, height, theme })

    // SVG (default)
    if (format === 'svg') {
      return new NextResponse(svg, {
        status: 200,
        headers: {
          'content-type': 'image/svg+xml; charset=utf-8',
          'content-disposition': 'inline; filename="cover.svg"',
          'cache-control': 'no-store',
        },
      })
    }

    // --- PNG (Node runtime + @resvg/resvg-js) ---
    const { Resvg } = await import('@resvg/resvg-js')
    const r = new Resvg(svg, {
      fitTo: { mode: 'width', value: width },
      background: 'transparent',
    })

    // Resvg → Uint8Array (o Buffer che estende Uint8Array). Evitiamo SharedArrayBuffer creando *sempre*
    // un nuovo ArrayBuffer e copiando i byte: così il tipo è sicuramente ArrayBuffer “puro”.
    const pngU8: Uint8Array = r.render().asPng()
    const ab = new ArrayBuffer(pngU8.byteLength)
    new Uint8Array(ab).set(pngU8)

    return new NextResponse(ab, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'content-disposition': 'inline; filename="cover.png"',
        'cache-control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[image/cover] error', e)
    return NextResponse.json(
      { ok: false, error: 'bad_request', message: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    )
  }
}
