// app/demo/page.tsx
'use client'

import { useState } from 'react'
import PromptEnchanter from '@/app/_components/PromptEnchanter'
import Track from '@/app/_components/Track'

type DemoResult = {
  hooks: string[]
  captions: string[]
}

export default function DemoPage() {
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState<DemoResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function generateCopy() {
    setErr(null)
    const brief = prompt.trim() || 'ecommerce skincare minimal, tono premium'
    try {
      setBusy(true)
      const r = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brief }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Errore API demo')
      setResult({ hooks: j.result.hooks || [], captions: j.result.captions || [] })
    } catch (e: any) {
      setErr(e?.message ?? 'Errore')
    } finally {
      setBusy(false)
    }
  }

  function resetAll() {
    setPrompt('')
    setResult(null)
    setErr(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B0F1A] to-[#0F172A] text-white">
      <header className="mx-auto max-w-5xl px-6 pt-12 pb-6">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">🧪 Demo</h1>
        <p className="mt-2 text-slate-300">Genera 3 hook + 3 caption (public, senza API key).</p>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-16 space-y-8">
        <PromptEnchanter onUse={setPrompt} />

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <div className="text-sm text-slate-300">Prompt attuale</div>
          <textarea
            className="w-full rounded-lg border border-white/10 bg-white/[0.06] p-3 text-sm outline-none"
            rows={5}
            placeholder="Incolla/modifica qui il prompt da usare…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <div className="flex gap-2">
            <button
              onClick={generateCopy}
              disabled={busy}
              className="rounded-lg px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
            >
              {busy ? 'Genero…' : 'Genera copy (demo pubblica)'}
            </button>
            <button
              onClick={resetAll}
              className="rounded-lg px-4 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600"
            >
              Reset
            </button>
          </div>

          {err && <div className="text-sm text-rose-400">{err}</div>}
        </div>

        {result && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-lg font-semibold">Hook (3)</h3>
              <ul className="mt-3 list-disc pl-5 text-sm text-slate-200 space-y-1">
                {result.hooks.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-lg font-semibold">Caption (3)</h3>
              <ul className="mt-3 list-disc pl-5 text-sm text-slate-200 space-y-1">
                {result.captions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>

      <Track path="/demo" />
    </div>
  )
}
