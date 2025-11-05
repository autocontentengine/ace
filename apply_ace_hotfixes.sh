#!/usr/bin/env bash
set -euo pipefail

# Run this from the Next.js project root (folder that contains package.json and app/)
if [[ ! -f "package.json" || ! -d "app" ]]; then
  echo "❌ Run this from the Next.js project root (where package.json and app/ exist)."
  exit 1
fi

echo "🔧 Applying ACE hotfix pack..."

# --- Create directories (no parentheses in paths; safe for Git Bash) ---
mkdir -p "lib/auth" "lib/rate-limit" "lib" "utils" "types" \
  "app/api/health" "app/api/auth/keys" "app/api/jobs" "app/api/jobs/[id]/events" "app/api/generate" \
  "app"

# ---------------- lib/auth/middleware.ts ----------------
cat > lib/auth/middleware.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

export type AuthenticatedRequest = NextRequest & { user?: { id: string; role?: string } }

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Returns null on success (and attaches req.user), or a NextResponse error on failure.
 */
export async function authenticateRequest(req: AuthenticatedRequest) {
  const apiKey = req.headers.get('x-api-key')?.trim()
  if (!apiKey) return NextResponse.json({ error: 'Missing API key' }, { status: 401 })

  const keyHash = sha256Hex(apiKey)
  const { data, error } = await supabase
    .from('api_keys')
    .select('user_id, role')
    .eq('key_hash', keyHash)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  ;(req as AuthenticatedRequest).user = { id: data.user_id, role: (data as any).role ?? 'user' }
  return null
}
EOF

# ---------------- lib/auth/crypto.ts ----------------
cat > lib/auth/crypto.ts << 'EOF'
import { randomBytes, createHash } from 'crypto'

export async function generateAPIKey() {
  const raw = 'ace_' + randomBytes(24).toString('hex') // ~ace_ + 48 hex chars
  const hashedKey = createHash('sha256').update(raw).digest('hex')
  return { apiKey: raw, hashedKey }
}

export function hashAPIKey(key: string) {
  return createHash('sha256').update(key).digest('hex')
}
EOF

# ---------------- lib/rate-limit/rate-limit.ts ----------------
cat > lib/rate-limit/rate-limit.ts << 'EOF'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

export async function isRateLimited(userId: string | null, endpoint = 'default'): Promise<boolean> {
  const safeUserId = userId && /[0-9a-f-]{36}/i.test(userId) ? userId : '00000000-0000-0000-0000-000000000000'
  const { data, error } = await supabase.rpc('check_rate_limit', {
    input_user_id: safeUserId,
    input_endpoint: endpoint,
  })
  if (error) {
    console.error('Rate limit RPC error:', error)
    return false // fail-open
  }
  return data === true
}
EOF

# ---------------- lib/rate-limit/middleware.ts ----------------
cat > lib/rate-limit/middleware.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server'
import { isRateLimited } from './rate-limit'

export async function enforceRateLimit(req: NextRequest, endpoint = 'default') {
  const userId = (req as any).user?.id ?? req.headers.get('x-user-id') ?? null
  const limited = await isRateLimited(userId, endpoint)
  return limited ? NextResponse.json({ error: 'Too many requests' }, { status: 429 }) : null
}
EOF

# ---------------- lib/config.ts ----------------
cat > lib/config.ts << 'EOF'
import { z } from 'zod'

export const ConfigSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(10),
  UPSTASH_REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_TOKEN: z.string().optional(),
  ALERT_WEBHOOK_URL: z.string().url().optional(),
  GROQ_API_KEY: z.string().min(10),
  BUDGET_CAP_EUR: z.coerce.number().min(1).default(20),
})

export function getConfig() {
  const parsed = ConfigSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error('Invalid env: ' + JSON.stringify(parsed.error.format()))
  }
  return parsed.data
}
EOF

# ---------------- lib/security.ts ----------------
cat > lib/security.ts << 'EOF'
export function sanitizeUserInput(s:string){
  return s.replace(/<\s*script[^>]*>.*?<\s*\/\s*script>/gis,'')
          .replace(/on[a-z]+\s*=\s*['\"][^'\"]*['\"]/gi,'')
}
export function normalizeBrief(b:string){ return b.toLowerCase().replace(/\s+/g,' ').slice(0,500) }
EOF

# ---------------- types/global.ts ----------------
cat > types/global.ts << 'EOF'
import type { NextRequest } from 'next/server'
export type AuthenticatedRequest = NextRequest & { user?: { id: string; role?: string } }
EOF

# ---------------- app/api/health/route.ts ----------------
cat > app/api/health/route.ts << 'EOF'
export async function GET() {
  return Response.json({ ok: true, ts: new Date().toISOString() })
}
EOF

# ---------------- app/api/jobs/route.ts ----------------
cat > app/api/jobs/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import type { AuthenticatedRequest } from '@/types/global'
import { authenticateRequest } from '@/lib/auth/middleware'
import { createClient } from '@supabase/supabase-js'
import { enforceRateLimit } from '@/lib/rate-limit/middleware'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)

export async function POST(req: AuthenticatedRequest) {
  const authErr = await authenticateRequest(req)
  if (authErr) return authErr

  const rlErr = await enforceRateLimit(req, 'jobs:POST')
  if (rlErr) return rlErr

  try {
    const body = await req.json()
    const type = body?.type ?? 'generic'
    const payload = body?.payload ?? null

    const { data, error } = await supabase
      .from('jobs')
      .insert({ type, payload_json: payload })
      .select('id')
      .single()

    if (error || !data) {
      console.error('DB insert error', error)
      return NextResponse.json({ error: 'DB insert failed' }, { status: 500 })
    }
    return NextResponse.json({ jobId: data.id })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
}
EOF

# ---------------- app/api/auth/keys/route.ts ----------------
cat > app/api/auth/keys/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateAPIKey } from '@/lib/auth/crypto'
import { authenticateRequest } from '@/lib/auth/middleware'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)

export async function GET(req: NextRequest) {
  const authErr = await authenticateRequest(req as any)
  if (authErr) return authErr
  const userId = (req as any).user?.id as string

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, key_hash, role, created_at, permissions')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 })
  return NextResponse.json({ keys: data })
}

export async function POST(req: NextRequest) {
  const authErr = await authenticateRequest(req as any)
  if (authErr) return authErr
  const userId = (req as any).user?.id as string

  const { apiKey, hashedKey } = await generateAPIKey()
  const { data, error } = await supabase
    .from('api_keys')
    .insert({ user_id: userId, key_hash: hashedKey, role: 'user', permissions: [] })
    .select('id, permissions')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Failed to create key' }, { status: 500 })
  // Show raw key only once
  return NextResponse.json({ id: data.id, apiKey, permissions: data.permissions })
}
EOF

# ---------------- app/api/jobs/[id]/events/route.ts (SSE) ----------------
# Note: use runtime 'nodejs' to avoid Edge crypto limitations with Node's crypto hashing in auth.
cat > "app/api/jobs/[id]/events/route.ts" << 'EOF'
import { authenticateRequest } from '@/lib/auth/middleware'
import type { AuthenticatedRequest } from '@/types/global'

// Force Node runtime to keep using Node 'crypto' in auth middleware
export const runtime = 'nodejs'

export async function GET(req: AuthenticatedRequest, { params }: { params: { id: string } }) {
  const authErr = await authenticateRequest(req)
  if (authErr) return authErr

  const jobId = params.id
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: any) => controller.enqueue(encoder.encode(`event: update\ndata: ${JSON.stringify(event)}\n\n`))
      const iv = setInterval(() => send({ status: 'running', jobId, ts: Date.now() }), 2000)
      const timeout = setTimeout(() => {
        send({ status: 'done', jobId, ts: Date.now() })
        clearInterval(iv)
        controller.close()
      }, 7000)
      controller.enqueue(encoder.encode(`event: open\ndata: {"jobId":"${jobId}"}\n\n`))
      ;(stream as any).cancel = () => { clearInterval(iv); clearTimeout(timeout) }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    }
  })
}
EOF

# ---------------- app/api/generate/copy/route.ts (MVP using Groq) ----------------
cat > app/api/generate/copy/route.ts << 'EOF'
import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth/middleware'
import type { AuthenticatedRequest } from '@/types/global'
import { getConfig } from '@/lib/config'
import { normalizeBrief } from '@/lib/security'

export async function POST(req: AuthenticatedRequest) {
  const authErr = await authenticateRequest(req)
  if (authErr) return authErr

  const { GROQ_API_KEY } = getConfig()
  const body = await req.json().catch(() => ({}))
  const brief = normalizeBrief(body?.brief ?? 'contenuti social per brand generico in italiano')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'Sei un copywriter senior per contenuti social. Scrivi in italiano, tono chiaro, conciso, orientato alla conversione.' },
        { role: 'user', content: `Brief: ${brief}\n\nGenera:\n- 10 hook virali (max 80 char)\n- 10 caption (max 200 char)\n- 5 outline carosello (5–7 slide)\nRispondi in JSON con campi: hooks[], captions[], carousels[] (ogni carousel ha title e slides[]).` }
      ]}
    )
  })

  if (!res.ok) {
    const txt = await res.text()
    return NextResponse.json({ error: 'Groq error', details: txt }, { status: 500 })
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  let parsed
  try { parsed = JSON.parse(content) } catch { parsed = { raw: content } }

  return NextResponse.json({ ok: true, brief, result: parsed })
}
EOF

# ---------------- app/page.tsx (simple landing; no parentheses in path) ----------------
cat > "app/page.tsx" << 'EOF'
export default function Landing() {
  return (
    <main className="min-h-screen p-8 flex items-center justify-center">
      <div className="max-w-2xl text-center space-y-4">
        <h1 className="text-4xl font-bold">ACE — Automated Content Engine</h1>
        <p className="text-lg opacity-80">Da brief a asset pubblicabili (copy + caroselli) in minuti.</p>
        <div className="space-x-4">
          <a className="px-4 py-2 rounded-xl bg-black text-white" href="/api/health">Health</a>
          <a className="px-4 py-2 rounded-xl border" href="https://gum.co/ace-starter-pack">Acquista Starter Pack</a>
        </div>
      </div>
    </main>
  )
}
EOF

# ---------------- tsconfig.json (stable) ----------------
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
EOF

# ---------------- .gitignore hygiene ----------------
# (Append; duplicates are harmless)
cat >> .gitignore << 'EOF'

# build
.next
# cache
.turbo
# pnpm
.pnpm-store
# ts buildinfo
*.tsbuildinfo
# env
.env.local
EOF

echo "✅ Files written."

echo ""
echo "➡️ NEXT STEPS:"
echo "1) In Supabase → SQL Editor → esegui supabase_add_rate_limit.sql (crea RPC check_rate_limit)."
echo "2) Prepara .env.local con SUPABASE_URL, SUPABASE_ANON_KEY, GROQ_API_KEY, BUDGET_CAP_EUR=20"
echo "3) Installa e avvia: pnpm install && pnpm dev"
echo "4) Test veloci:"
echo "   curl http://localhost:3000/api/health"
echo "   curl -X POST http://localhost:3000/api/generate/copy -H 'x-api-key: <tua-key>' -H 'content-type: application/json' -d '{\"brief\":\"brand fitness\"}'"
