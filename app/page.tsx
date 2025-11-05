// app/page.tsx
'use client'

import { useState } from 'react'

const REPO_URL = 'https://github.com/autocontentengine/ace'

const CLI_SNIPPET = String.raw`# Health
curl -s http://localhost:3000/api/health | jq '.'

# Demo (public)
curl -s -X POST http://localhost:3000/api/demo \
  -H "content-type: application/json" \
  -d '{"brief":"ecommerce skincare minimal, tono premium"}' | head -c 600

# Generate copy (API key richiesta)
curl -s -X POST http://localhost:3000/api/generate/copy \
  -H "content-type: application/json" \
  -H "x-api-key: ace_test_12345678901234567890123456789012" \
  -d '{"brief":"brand fitness, tono energico"}' | head -c 600

# Jobs + SSE
curl -s -X POST http://localhost:3000/api/jobs \
  -H "content-type: application/json" \
  -H "x-api-key: ace_test_12345678901234567890123456789012" \
  -d '{"type":"test","payload":{"brief":"hello"}}'

# Prendi l'ID restituito e:
curl -N http://localhost:3000/api/jobs/JOB_ID/events \
  -H "x-api-key: ace_test_12345678901234567890123456789012"
`

function Card(props: { title: string; desc: string; href: string; emoji?: string }) {
  return (
    <a
      href={props.href}
      className="group block rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5 backdrop-blur transition hover:border-zinc-700 hover:bg-zinc-900"
    >
      <div className="flex items-center gap-2 text-zinc-100">
        <span className="text-lg">{props.emoji ?? '🔗'}</span>
        <h3 className="font-semibold">{props.title}</h3>
      </div>
      <p className="mt-1 text-sm text-zinc-400 group-hover:text-zinc-300">{props.desc}</p>
    </a>
  )
}

export default function Home() {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(CLI_SNIPPET)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch (err) {
      // gestiamo l'errore per evitare il no-empty
      console.error('Clipboard copy failed:', err)
      setCopied(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0d12] text-zinc-100">
      {/* hero */}
      <section className="mx-auto max-w-6xl px-6 pb-10 pt-14">
        <h1 className="text-3xl font-bold tracking-tight">
          ACE — <span className="text-zinc-300">Automated Content Engine</span>
        </h1>
        <p className="mt-1 text-zinc-400">
          Da brief → contenuti social e pack esportabili. Stack: Next.js + Supabase + Groq.
        </p>

        {/* cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card
            emoji="🧪"
            title="Prova la demo"
            desc="Genera 3 hook, 3 caption e 1 carosello (public, senza API key)."
            href="/demo"
          />
          <Card
            emoji="🩺"
            title="Health API"
            desc="Verifica stato runtime e risposta API."
            href="/api/health"
          />
          <Card
            emoji="📦"
            title="Repository"
            desc="Codice sorgente, roadmap e documentazione."
            href={REPO_URL}
          />
          <Card
            emoji="🗺️"
            title="Roadmap"
            desc="Week 1–2: auth/RBAC, rate limit, SSE, demo pubblica, prima vendita."
            href={REPO_URL}
          />
        </div>

        {/* CLI block */}
        <div className="mt-10">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">Test rapidi (CLI)</h2>
            <button
              onClick={copy}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
            >
              {copied ? 'Copiato ✓' : 'Copia'}
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0f1115]">
            <div className="flex items-center gap-1 border-b border-zinc-800/80 bg-[#0c0e13] px-3 py-2">
              <span className="h-3 w-3 rounded-full bg-red-500/70" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
              <span className="h-3 w-3 rounded-full bg-green-500/70" />
              <span className="ml-3 text-xs text-zinc-400">bash</span>
            </div>
            <pre className="max-h-[380px] overflow-auto p-4 text-[13px] leading-6 text-zinc-200">
              <code>{CLI_SNIPPET}</code>
            </pre>
          </div>
        </div>

        <footer className="mt-10 text-xs text-zinc-500">
          © {new Date().getFullYear()} ACE. Built with Next.js, Supabase, Groq.
        </footer>
      </section>
    </main>
  )
}
