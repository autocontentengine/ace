// app/demo/page.tsx
'use client'
import { useState } from 'react'

type DemoResult = {
  ok: boolean
  model?: string
  result?: {
    hooks?: string[]
    captions?: string[]
    carousels?: { title: string; slides: string[] }[]
    raw?: string
  }
  error?: string
}

export default function DemoPage() {
  const [brief, setBrief] = useState('brand fitness, tono energico')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DemoResult | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function runDemo(e?: React.FormEvent) {
    e?.preventDefault()
    setLoading(true)
    setErr(null)
    setData(null)
    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brief }),
      })
      const json = (await res.json()) as DemoResult
      if (!res.ok || !json.ok) setErr(json.error || `HTTP ${res.status}`)
      else setData(json)
    } catch (e: any) {
      setErr(e?.message || 'errore')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Demo: 3 hook gratis</h1>
      <p className="text-sm text-gray-500">
        Inserisci un brief. Generiamo 3 hook, 3 caption e 1 carosello (outline).
      </p>

      <form onSubmit={runDemo} className="space-y-3">
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          className="w-full rounded-xl border p-3"
          rows={3}
          placeholder="es. ecommerce skincare minimal, tono premium"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl px-4 py-2 font-medium shadow border hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? 'Generazione…' : 'Genera'}
        </button>
      </form>

      {err && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Errore: {err}
        </div>
      )}

      {data?.result && (
        <section className="space-y-6">
          {data.result.hooks && (
            <div>
              <h2 className="font-semibold mb-2">Hook</h2>
              <ul className="list-disc pl-5 space-y-1">
                {data.result.hooks.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          {data.result.captions && (
            <div>
              <h2 className="font-semibold mb-2">Caption</h2>
              <ul className="list-disc pl-5 space-y-1">
                {data.result.captions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {data.result.carousels && (
            <div>
              <h2 className="font-semibold mb-2">Carosello</h2>
              {data.result.carousels.map((car, i) => (
                <div key={i} className="rounded-xl border p-3 mb-3">
                  <div className="font-medium">{car.title}</div>
                  <ol className="list-decimal pl-5 space-y-1 mt-1">
                    {car.slides.map((s, j) => (
                      <li key={j}>{s}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}

          {data.result.raw && (
            <details className="rounded-xl border p-3">
              <summary className="cursor-pointer">Raw output</summary>
              <pre className="text-xs whitespace-pre-wrap">{data.result.raw}</pre>
            </details>
          )}
        </section>
      )}
    </main>
  )
}
