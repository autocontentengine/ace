// app/demo/page.tsx
'use client'

import { useState } from 'react'
import PromptEnchanter from '@/app/_components/PromptEnchanter'
import Track from '@/app/_components/Track'

type Lang = 'it' | 'en'

type StrategyResult = {
  weekly: { day: string; post: string; asset: 'carousel' | 'image' | 'reel' | 'story' }[]
  rubrics: { name: string; cadence: string; angles: string[] }[]
  image_prompts: string[]
  hashtags: string[][]
} | null

export default function DemoPage() {
  const [lang, setLang] = useState<Lang>('it')
  const [prompt, setPrompt] = useState('')
  const [enhanced, setEnhanced] = useState('')
  const [hooks, setHooks] = useState<string[]>([])
  const [captions, setCaptions] = useState<string[]>([])
  const [jsonOut, setJsonOut] = useState<string>('')
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [carouselBusy, setCarouselBusy] = useState(false)
  const [ground, setGround] = useState(false)

  // Strategy tab
  const [tab, setTab] = useState<'copy' | 'strategy'>('copy')
  const [brand, setBrand] = useState('')
  const [audience, setAudience] = useState('')
  const [goals, setGoals] = useState<string>('')
  const [strategy, setStrategy] = useState<StrategyResult>(null)

  const textToUse = (enhanced || prompt).trim()

  async function generateCopy() {
    if (!textToUse) return
    setBusy(true)
    try {
      // JSON “piatto” → TOON out (come nei tuoi test), ma passo anche ground
      const res = await fetch('/api/generate/copy', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'text/toon',
        },
        body: JSON.stringify({ brief: textToUse, lang, ground }),
      })
      const txt = await res.text()
      setJsonOut(txt)
      // estraggo hooks/captions solo per render a lista (non affidabile always)
      const hooks = Array.from(txt.matchAll(/^\s{2}(.+)$/gm))
        .map((m: any) => m[1])
        .slice(0, 7)
      setHooks(hooks)
      // non sempre parse captions bene → mostro il TOON intero sotto
    } catch (_e) {
      /* noop */
    } finally {
      setBusy(false)
    }
  }

  async function enhancePrompt() {
    if (!prompt.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, lang }),
      })
      const data = await res.json()
      if (data?.prompt) setEnhanced(data.prompt)
    } catch {
      /* noop */
    } finally {
      setBusy(false)
    }
  }

  async function makeCover(format: 'svg' | 'png' = 'svg') {
    if (!textToUse) return
    const res = await fetch('/api/image/cover', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: textToUse, format }),
    })
    if (!res.ok) return
    const blob = await res.blob()
    setCoverUrl(URL.createObjectURL(blob))
  }

  async function makeCoverViaHorde() {
    if (!textToUse) return
    setBusy(true)
    try {
      const res = await fetch('/api/image/horde', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: textToUse,
          model: 'stable-diffusion-xl-1.0',
        }),
      })
      if (!res.ok) throw new Error('Horde generation failed')
      const blob = await res.blob()
      setCoverUrl(URL.createObjectURL(blob))
    } catch {
      /* noop */
    } finally {
      setBusy(false)
    }
  }

  async function makeCoverProcedural(format: 'svg' | 'png' = 'svg') {
    if (!textToUse) return
    const res = await fetch('/api/image/procedural', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cover: { text: textToUse, width: 1024, height: 1024, format, border: true, seed: 'ace' },
      }),
    })
    if (!res.ok) return
    const blob = await res.blob()
    setCoverUrl(URL.createObjectURL(blob))
  }

  async function makeCarousel() {
    const slides = (hooks.length ? hooks.slice(0, 5) : [textToUse]).filter(Boolean)
    if (slides.length === 0) return
    setCarouselBusy(true)
    try {
      const res = await fetch('/api/carousel', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'ace_test_12345678901234567890123456789012',
        },
        body: JSON.stringify({ slides, theme: 'dark' }),
      })
      if (!res.ok) throw new Error('carousel failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'carousel.zip'
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      a.remove()
    } catch {
      /* noop */
    } finally {
      setCarouselBusy(false)
    }
  }

  async function generateStrategy() {
    if (!brand || !audience || !goals.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/generate/strategy?format=json', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          strategy: {
            brand,
            audience,
            goals: goals
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            lang,
          },
        }),
      })
      const j = await res.json()
      setStrategy(j?.result ?? null)
    } catch {
      /* noop */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <Track path="/demo" />
      <header className="mx-auto max-w-4xl px-6 pt-12 pb-6">
        <h1 className="text-2xl font-semibold">Demo — Hooks, Captions, Strategy & Covers</h1>
        <p className="text-sm text-slate-400 mt-2">
          Grounded copy (opzionale), strategia e cover procedurali.
        </p>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24 space-y-10">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          <button
            className={`px-3 py-1 rounded ${tab === 'copy' ? 'bg-indigo-600' : 'bg-slate-700'}`}
            onClick={() => setTab('copy')}
          >
            Copy
          </button>
          <button
            className={`px-3 py-1 rounded ${tab === 'strategy' ? 'bg-indigo-600' : 'bg-slate-700'}`}
            onClick={() => setTab('strategy')}
          >
            Strategy
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-slate-400 text-sm">Language:</span>
            <button
              className={`px-3 py-1 rounded ${lang === 'it' ? 'bg-indigo-600' : 'bg-slate-700'}`}
              onClick={() => setLang('it')}
            >
              IT
            </button>
            <button
              className={`px-3 py-1 rounded ${lang === 'en' ? 'bg-indigo-600' : 'bg-slate-700'}`}
              onClick={() => setLang('en')}
            >
              EN
            </button>
          </div>
        </div>

        {tab === 'copy' ? (
          <>
            {/* Prompt */}
            <section className="grid gap-4">
              <label className="text-sm text-slate-300">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder={
                  lang === 'it'
                    ? 'Esempio: brand skincare premium, tono raffinato'
                    : 'Example: premium skincare brand, refined tone'
                }
                className="w-full rounded-lg bg-[#0F172A] border border-slate-700 p-3 outline-none"
              />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={ground}
                    onChange={(e) => setGround(e.target.checked)}
                  />
                  Grounded (Wikipedia)
                </label>
              </div>

              {/* Prompt Enchanter */}
              <div className="rounded-xl border border-slate-800 p-3 bg-[#0F172A]">
                <div className="text-sm mb-2 text-slate-300">Prompt Enchanter</div>
                <PromptEnchanter onUse={(p: string) => setEnhanced(p)} />
                {enhanced && (
                  <div className="mt-3">
                    <div className="text-xs text-slate-400 mb-1">Enhanced</div>
                    <textarea
                      value={enhanced}
                      onChange={(e) => setEnhanced(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg bg-[#0B1220] border border-slate-800 p-2"
                    />
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={enhancePrompt}
                    className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                    disabled={busy}
                  >
                    {busy ? '...' : lang === 'it' ? 'Migliora (API)' : 'Enhance (API)'}
                  </button>
                </div>
              </div>
            </section>

            {/* Actions */}
            <section className="flex flex-wrap items-center gap-2">
              <button
                onClick={generateCopy}
                className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
                disabled={busy || !textToUse}
              >
                {busy
                  ? '...'
                  : lang === 'it'
                    ? 'Genera Hooks & Caption'
                    : 'Generate Hooks & Captions'}
              </button>
              <button
                onClick={() => makeCarousel()}
                className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
                disabled={carouselBusy || (!hooks.length && !textToUse)}
              >
                {carouselBusy ? '...' : 'Crea Carousel (ZIP)'}
              </button>

              {/* Covers */}
              <button
                onClick={() => makeCover('svg')}
                className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                disabled={!textToUse}
              >
                Cover (SVG)
              </button>
              <button
                onClick={() => makeCover('png')}
                className="px-3 py-2 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50"
                disabled={!textToUse}
              >
                Cover (PNG)
              </button>
              <HordeCoverButton disabled={!textToUse} onClick={makeCoverViaHorde} />
              <button
                onClick={() => makeCoverProcedural('svg')}
                className="px-3 py-2 rounded bg-purple-700 hover:bg-purple-600 disabled:opacity-50"
                disabled={!textToUse}
              >
                Cover Procedural (SVG)
              </button>
              <button
                onClick={() => makeCoverProcedural('png')}
                className="px-3 py-2 rounded bg-purple-800 hover:bg-purple-700 disabled:opacity-50"
                disabled={!textToUse}
              >
                Cover Procedural (PNG)
              </button>
            </section>

            {/* Results */}
            <section className="grid gap-6">
              {hooks.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Hooks</h3>
                  <ul className="list-disc pl-6 space-y-1 text-slate-200">
                    {hooks.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}
              {jsonOut && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">TOON</h3>
                  <pre className="rounded-lg bg-[#0F172A] border border-slate-800 p-3 overflow-auto text-sm">
                    {jsonOut}
                  </pre>
                </div>
              )}
              {coverUrl && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Cover</h3>
                  <img
                    src={coverUrl}
                    alt="cover"
                    className="w-full max-w-[540px] rounded-lg border border-slate-800"
                  />
                </div>
              )}
            </section>
          </>
        ) : (
          // Strategy tab
          <section className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-slate-300">Brand</label>
                <input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full rounded-lg bg-[#0F172A] border border-slate-700 p-2"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300">Audience</label>
                <input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full rounded-lg bg-[#0F172A] border border-slate-700 p-2"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300">Goals (comma sep.)</label>
                <input
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  className="w-full rounded-lg bg-[#0F172A] border border-slate-700 p-2"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={generateStrategy}
                className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
                disabled={busy || !brand || !audience || !goals}
              >
                {busy ? '...' : 'Genera Strategy'}
              </button>
            </div>
            {strategy && (
              <div className="grid gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Weekly</h3>
                  <ul className="list-disc pl-6 space-y-1 text-slate-200">
                    {strategy.weekly.map((w, i) => (
                      <li key={i}>
                        <span className="text-slate-400">{w.day}:</span> {w.post}{' '}
                        <span className="text-slate-500">({w.asset})</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Rubrics</h3>
                  <ul className="list-disc pl-6 space-y-1 text-slate-200">
                    {strategy.rubrics.map((r, i) => (
                      <li key={i}>
                        <strong>{r.name}</strong> — {r.cadence}. Angles: {r.angles.join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Image prompts</h3>
                  <ul className="list-disc pl-6 space-y-1 text-slate-200">
                    {strategy.image_prompts.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Hashtags groups</h3>
                  <ul className="list-disc pl-6 space-y-1 text-slate-200">
                    {strategy.hashtags.map((grp, i) => (
                      <li key={i}>{grp.join(' ')}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

/** Inline: bottone “Cover via Horde” (così evitiamo l’import mancante) */
function HordeCoverButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 rounded bg-purple-700 hover:bg-purple-600 disabled:opacity-50"
      title="Genera immagine via Horde (gratis, ma più lenta)"
    >
      Cover via Horde
    </button>
  )
}
