// app/api/image/procedural/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readBody } from '@/lib/toon/io'
import { guardRequest } from '@/lib/rate-limit/rate-limit'
import { buildProceduralCover } from '@/lib/image/procedural'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const guard = await guardRequest(req, 'image_procedural', {
    windowSec: 60,
    maxHits: 30,
    bucket: 'image',
    contentType: 'image/svg+xml',
  })
  if (guard) return guard

  const { data } = await readBody<{
    title?: string
    width?: number
    height?: number
    seed?: number
    theme?: string
  }>(req)

  const title = (data.title ?? 'Procedural Cover').slice(0, 120)
  const width = Math.max(128, Math.min(2048, Number(data.width ?? 1080)))
  const height = Math.max(128, Math.min(2048, Number(data.height ?? 1350)))
  const seed = Number.isFinite(data.seed) ? Number(data.seed) : undefined
  const theme = data.theme ?? 'indigo'

  const svg = buildProceduralCover({ title, width, height, seed, theme })

  return new NextResponse(svg, {
    headers: {
      'content-type': 'image/svg+xml',
      'cache-control': 'no-store',
      'content-disposition': `inline; filename="procedural_${width}x${height}.svg"`,
    },
  })
}
