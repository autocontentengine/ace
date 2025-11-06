// app/page.tsx
import Link from 'next/link'
import Track from '@/app/_components/Track'

const SHOW_DEV = process.env.NEXT_PUBLIC_SHOW_DEV === '1'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B0F1A] to-[#0F172A] text-white">
      <header className="mx-auto max-w-5xl px-6 pt-16 pb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
          ⚡ Da brief ad asset pubblicabile in <b className="ml-1">10 minuti</b>
        </div>

        <h1 className="mt-6 text-4xl md:text-5xl font-semibold leading-tight tracking-tight">
          ACE — Autocontent Engine
        </h1>

        <p className="mt-4 max-w-2xl text-slate-300">
          Genera <b>copy</b> e <b>caroselli</b> da brief. API veloci, costi prevedibili, qualità
          costante.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium hover:bg-indigo-500"
            href="/demo"
          >
            🧪 Prova la demo
          </Link>
          <Link
            className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-medium hover:bg-slate-700"
            href="/pricing"
          >
            💳 Prezzi
          </Link>
          <Link
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium hover:bg-white/[0.08]"
            href="/docs"
          >
            📚 Docs
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-lg font-semibold">Copy di qualità</h3>
            <p className="mt-2 text-sm text-slate-300">
              Hook, caption, caroselli in italiano naturale, pronti per social/adv.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-lg font-semibold">API semplici</h3>
            <p className="mt-2 text-sm text-slate-300">
              Endpoint chiari, SSE per stato job, export ZIP pronto.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-lg font-semibold">Costo sotto controllo</h3>
            <p className="mt-2 text-sm text-slate-300">
              Modelli ottimizzati + overage basso per asset extra.
            </p>
          </div>
        </div>

        {SHOW_DEV && (
          <section className="mt-10 grid gap-6 md:grid-cols-3">
            <Link
              href="/api/health"
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06]"
            >
              <h3 className="text-lg font-semibold">🩺 Health API</h3>
              <p className="mt-2 text-sm text-slate-300">Verifica stato runtime e risposta API.</p>
            </Link>

            <a
              href="https://github.com/autocontentengine/ace"
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06]"
            >
              <h3 className="text-lg font-semibold">📦 Repository</h3>
              <p className="mt-2 text-sm text-slate-300">
                Codice sorgente, roadmap e documentazione.
              </p>
            </a>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-lg font-semibold">🗺️ Roadmap</h3>
              <p className="mt-2 text-sm text-slate-300">
                Week 1–2: auth/RBAC, rate limit, SSE, demo pubblica, prima vendita.
              </p>
            </div>
          </section>
        )}
      </main>

      <Track path="/" />
    </div>
  )
}
