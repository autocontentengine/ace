// app/api/carousel/route.ts
import { NextRequest } from 'next/server'
import JSZip from 'jszip'
import { z } from 'zod'

export const runtime = 'nodejs'

const BodySchema = z.object({
  brief: z.string().min(3, 'brief troppo corto'),
  count: z.number().int().min(1).max(12).default(5),
  theme: z.enum(['dark', 'light']).default('dark'),
})

function svgSlide({
  w = 1080,
  h = 1350,
  title,
  subtitle,
  theme,
}: {
  w?: number
  h?: number
  title: string
  subtitle: string
  theme: 'dark' | 'light'
}) {
  const bg = theme === 'dark' ? '#0b0f19' : '#ffffff'
  const fg = theme === 'dark' ? '#e6edf3' : '#0b0f19'
  const accent = theme === 'dark' ? '#7c3aed' : '#4f46e5'

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.05"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="${bg}"/>
  <rect x="40" y="40" width="${w - 80}" height="${h - 80}" rx="40" fill="url(#g)" stroke="${accent}" stroke-opacity="0.2"/>
  <g fill="${fg}">
    <text x="80" y="260" font-size="72" font-family="system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif" font-weight="700">${escapeXml(
      title
    )}</text>
    <text x="80" y="360" font-size="36" font-family="system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif" opacity="0.9">${escapeXml(
      subtitle
    )}</text>
  </g>
  <g opacity="0.08">
    <circle cx="${w - 200}" cy="${h - 220}" r="140" fill="${accent}"/>
    <circle cx="${w - 320}" cy="${h - 320}" r="90" fill="${accent}"/>
  </g>
  <text x="${w - 60}" y="${h - 60}" text-anchor="end" font-size="22" fill="${fg}" opacity="0.6" font-family="system-ui">ACE • autocontentengine</text>
</svg>`
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const { brief, count, theme } = BodySchema.parse(json)

    const baseTitle = brief.slice(0, 60)
    const slides = Array.from({ length: count }, (_, i) => {
      const title = `${baseTitle} — Slide ${String(i + 1).padStart(2, '0')}`
      const subtitle =
        i === 0 ? 'Hook principale' : i === count - 1 ? 'Call to Action' : 'Valore / Beneficio'
      return svgSlide({ title, subtitle, theme })
    })

    const zip = new JSZip()
    slides.forEach((svg, i) => {
      const name = `slide_${String(i + 1).padStart(2, '0')}.svg`
      zip.file(name, svg)
    })

    // 🔴 Importante: generiamo come ARRAYBUFFER (niente Buffer)
    const buf: ArrayBuffer = await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    })

    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="carousel.zip"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    return Response.json(
      { error: 'bad_request', details: String(e?.message || e) },
      { status: 400 }
    )
  }
}
