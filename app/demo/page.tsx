'use client'

import { useState } from 'react'
import Track from '@/app/_components/Track'

type Lang = 'it' | 'en'

export default function DemoPage() {
  const [lang, setLang] = useState<Lang>('it')
  const [prompt, setPrompt] = useState('ecommerce skincare minimal, tono premium')
  const [enhancing, setEnhancing] = useState(false)
  const [loadingCopy, setLoadingCopy] = useState(false)
  const [loadingZip, setLoadingZip] = useState(false)

  const [hooks, setHooks] = useState<string[]>([])
  const [captions, setCaptions] = useState<string[]>([])
  const [zipUrl, setZipUrl] = useState<string | null>(null)

  async function onEnhance() {
    try {
      setEnhancing(true)
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, lang }),
      })
      const data = await res.json()
      if (data?.prompt) setPrompt(data.prompt)
    } catch (e) {
      console.error(e)
    } finally {
      setEnhancing(false)
    }
  }

  async function onGenerateCopy() {
    try {
      setLoadingCopy(true)
      const res = await fetch('/api/generate/copy', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'ace_test_12345678901234567890123456789012',
        },
        body: JSON.stringify({ brief: prompt, lang }),
      })
      const data = await res.json()
      const h: string[] = data?.result?.hooks ?? []
      const c: string[] = data?.result?.captions ?? []
      setHooks(h.slice(0, 6))
      setCaptions(c.slice(0, 6))
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingCopy(false)
    }
  }

  async function onGenerateCarousel() {
    try {
      setLoadingZip(true)
      const res = await fetch('/api/carousel', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'ace_test_12345678901234567890123456789012',
        },
        body: JSON.stringify({ brief: prompt, count: 5, theme: 'dark' }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setZipUrl(url)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingZip(false)
    }
  }

  async function onMakeCover(text: string) {
    try {
      const res = await fetch('/api/image/cover', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text,
          width: 1080,
          height: 1350,
          theme: 'dark',
          format: 'svg', // png opzionale se hai resvg
        }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      // apri subito in tab per download rapido
      window.open(url, '_blank')
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B0F1A] to-[#0F172A] text-white">
      <header className="mx-auto max-w-5xl px-6 pt-16 pb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">🧪 Demo</h1>
        <p className="mt-3 text-slate-300">
          Genera hook, caption, caroselli e sfondi immagine. Public (hook/caption) e protetto
          (carosello).
        </p>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20 space-y-8">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-white/10 overflow-hidden">
              <button
                onClick={() => setLang('it')}
                className={`px-3 py-1 text-sm ${lang === 'it' ? 'bg-indigo-600' : 'bg-transparent'}`}
              >
                🇮🇹 IT
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1 text-sm ${lang === 'en' ? 'bg-indigo-600' : 'bg-transparent'}`}
              >
                🇬🇧 EN
              </button>
            </div>

            <button
              onClick={onEnhance}
              className="rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-sm"
              disabled={enhancing}
            >
              ✨ Enhance prompt {enhancing ? '…' : ''}
            </button>
          </div>

          <textarea
            className="mt-4 w-full rounded-lg border border-white/10 bg-white/[0.06] p-3 text-sm outline-none placeholder:text-slate-500 focus:border-indigo-400"
            rows={3}
            placeholder={
              lang === 'it'
                ? 'Descrivi il brand/prodotto, tono, audience…'
                : 'Describe brand/product, tone, audience…'
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={onGenerateCopy}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium disabled:opacity-60"
              disabled={loadingCopy}
            >
              {loadingCopy ? 'Generazione…' : '⚡ Genera Hook & Caption'}
            </button>

            <button
              onClick={onGenerateCarousel}
              className="rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm font-medium disabled:opacity-60"
              disabled={loadingZip}
            >
              {loadingZip ? 'Creo ZIP…' : '🗂️ Genera Carosello (ZIP)'}
            </button>

            {zipUrl && (
              <a
                href={zipUrl}
                download="carousel.zip"
                className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium hover:bg-white/[0.08]"
              >
                ⬇️ Scarica ZIP
              </a>
            )}
          </div>
        </section>

        {!!hooks.length && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-lg font-semibold">Hook</h3>
            <ul className="mt-3 space-y-2">
              {hooks.map((h, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 inline-block size-1.5 rounded-full bg-emerald-400" />
                  <div className="flex-1">
                    <div className="text-sm">{h}</div>
                    <button
                      onClick={() => onMakeCover(h)}
                      className="mt-2 rounded-md bg-slate-700 hover:bg-slate-600 px-2 py-1 text-xs"
                    >
                      🖼️ Crea cover da questo hook
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!!captions.length && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-lg font-semibold">Caption</h3>
            <ul className="mt-3 space-y-2">
              {captions.map((c, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 inline-block size-1.5 rounded-full bg-indigo-400" />
                  <div className="flex-1">
                    <div className="text-sm">{c}</div>
                    <button
                      onClick={() => onMakeCover(c)}
                      className="mt-2 rounded-md bg-slate-700 hover:bg-slate-600 px-2 py-1 text-xs"
                    >
                      🖼️ Crea cover da questa caption
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <Track path="/demo" />
    </div>
  )
}
