// app/demo/page.tsx
'use client'

import { useState } from 'react'
import PromptEnchanter from '@/app/_components/PromptEnchanter'
import Track from '@/app/_components/Track'

type Lang = 'it' | 'en'

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

  const textToUse = (enhanced || prompt).trim()

  async function generateCopy() {
    if (!textToUse) return
    setBusy(true)
    try {
      const res = await fetch('/api/generate/copy', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'ace_test_12345678901234567890123456789012',
        },
        body: JSON.stringify({ brief: textToUse, lang }),
      })
      const data = await res.json()
      if (data?.result) {
        setHooks(data.result.hooks ?? [])
        setCaptions(data.result.captions ?? [])
        setJsonOut(JSON.stringify(data.result, null, 2))
      }
    } catch (e) {
      console.error(e)
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
      if (data?.enhanced) setEnhanced(data.enhanced)
    } catch (e) {
      console.error(e)
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
    // Richiede .env con HORDE_API_KEY (già impostato) e la route /api/image/horde creata
    if (!textToUse) return
    setBusy(true)
    try {
      const res = await fetch('/api/image/horde', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: textToUse,
          model: 'stable-diffusion-xl-1.0', // es: puoi cambiarlo nella route horde
        }),
      })
      if (!res.ok) throw new Error('Horde generation failed')
      const blob = await res.blob()
      setCoverUrl(URL.createObjectURL(blob))
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
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
        body: JSON.stringify({
          slides,
          theme: 'dark',
          // opzionale: prova lo sfondo da Horde dietro i testi
          // background: 'horde',
          // hordePromptTemplate: 'Luxury skincare background, minimal, high-contrast, ...',
        }),
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
    } catch (e) {
      console.error(e)
    } finally {
      setCarouselBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <Track path="/demo" />
      <header className="mx-auto max-w-4xl px-6 pt-12 pb-6">
        <h1 className="text-2xl font-semibold">Demo — Hooks, Captions, Carousel & Covers</h1>
        <p className="text-sm text-slate-400 mt-2">
          Scegli lingua, scrivi un prompt, migliora, genera.
        </p>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24 space-y-10">
        {/* Lang switch */}
        <div className="flex items-center gap-2">
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

          {/* Prompt Enchanter (usa solo onUse) */}
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
            {busy ? '...' : lang === 'it' ? 'Genera Hooks & Caption' : 'Generate Hooks & Captions'}
          </button>

          <button
            onClick={() => makeCarousel()}
            className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
            disabled={carouselBusy || (!hooks.length && !textToUse)}
          >
            {carouselBusy ? '...' : 'Crea Carousel (ZIP)'}
          </button>

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

          {/* Cover via Horde (immagini fotografiche/illustrazioni) */}
          <HordeCoverButton disabled={!textToUse} onClick={makeCoverViaHorde} />
        </section>

        {/* Results */}
        <section className="grid gap-6">
          {/* Hooks */}
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

          {/* Captions */}
          {captions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Captions</h3>
              <ul className="list-disc pl-6 space-y-1 text-slate-200">
                {captions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* JSON */}
          {jsonOut && (
            <div>
              <h3 className="text-lg font-semibold mb-2">JSON</h3>
              <pre className="rounded-lg bg-[#0F172A] border border-slate-800 p-3 overflow-auto text-sm">
                {jsonOut}
              </pre>
            </div>
          )}

          {/* Cover preview */}
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
