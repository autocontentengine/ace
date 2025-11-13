// lib/image/procedural.ts

export type ProceduralOpts = {
  title: string
  width: number
  height: number
  seed?: number
  theme?: 'indigo' | 'emerald' | 'rose' | string
}

type Palette = { bg0: string; bg1: string; stroke: string; deco: string }

function pickPalette(theme?: string): Palette {
  switch (theme) {
    case 'emerald':
      return { bg0: '#064E3B', bg1: '#10B981', stroke: '#34D399', deco: '#A7F3D0' }
    case 'rose':
      return { bg0: '#881337', bg1: '#F43F5E', stroke: '#FDA4AF', deco: '#FFE4E6' }
    case 'indigo':
    default:
      return { bg0: '#0B0F1A', bg1: '#4F46E5', stroke: '#8B5CF6', deco: '#C7D2FE' }
  }
}

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randBetween(rng: () => number, min: number, max: number) {
  return min + (max - min) * rng()
}

/**
 * Genera una cover SVG procedurale (gratis) con gradiente, bordi soft
 * e decorazioni leggere basate su seed.
 */
export function buildProceduralCover(opts: ProceduralOpts): string {
  const { title, width, height, theme = 'indigo' } = opts
  const seed = Number.isFinite(opts.seed) ? (opts.seed as number) : Math.floor(Math.random() * 1e9)

  const p = pickPalette(theme)
  const rng = mulberry32(seed)
  const pad = Math.round(Math.min(width, height) * 0.04)
  const rx = Math.round(Math.min(width, height) * 0.08)

  // leggero skew del gradiente
  const gx2 = rng() > 0.5 ? 1 : 0.85
  const gy2 = rng() > 0.5 ? 1 : 0.85

  // decorazioni: blob/circles
  const decoCount = 6
  const decos: string[] = []
  for (let i = 0; i < decoCount; i++) {
    const cx = Math.round(randBetween(rng, pad, width - pad))
    const cy = Math.round(randBetween(rng, pad, height - pad))
    const r = Math.round(
      randBetween(rng, Math.min(width, height) * 0.03, Math.min(width, height) * 0.12)
    )
    const op = randBetween(rng, 0.08, 0.18).toFixed(2)
    decos.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${p.deco}" opacity="${op}"/>`)
  }

  // linee diagonali molto soft
  const lines: string[] = []
  const step = Math.round(Math.min(width, height) * 0.12)
  for (let x = -height; x < width + height; x += step) {
    const op = randBetween(rng, 0.05, 0.12).toFixed(2)
    lines.push(
      `<line x1="${x}" y1="0" x2="${x + height}" y2="${height}" stroke="${p.stroke}" stroke-opacity="${op}" stroke-width="1"/>`
    )
  }

  // titolo
  const titleX = pad * 1.5
  const titleY = pad * 2.8
  const fontSize = Math.round(Math.min(width, height) * 0.065)
  const titleEsc = esc(title)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="${gx2}" y2="${gy2}">
      <stop offset="0%" stop-color="${p.bg0}"/>
      <stop offset="100%" stop-color="${p.bg1}"/>
    </linearGradient>
    <style>
      .t{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; fill:#fff; font-weight:800; }
      .s{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; fill:#94A3B8; }
    </style>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#g)"/>
  <g opacity="0.35">
    ${lines.join('\n    ')}
  </g>
  <g>
    ${decos.join('\n    ')}
  </g>
  <rect x="${pad / 2}" y="${pad / 2}" width="${width - pad}" height="${height - pad}" rx="${rx}" fill="none" stroke="${p.stroke}" stroke-opacity="0.35"/>
  <g transform="translate(${titleX}, ${titleY})">
    <text class="t" font-size="${fontSize}">${titleEsc}</text>
    <text class="s" font-size="${Math.round(fontSize * 0.4)}" y="${Math.round(fontSize * 0.9)}">Procedural cover — seed ${seed}</text>
  </g>
</svg>`
}
