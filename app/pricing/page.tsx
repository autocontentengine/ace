'use client'

import { useState } from 'react'

export default function PricingPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [resp, setResp] = useState<string>('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setResp('')
    try {
      const body = [
        'lead:',
        `  email: ${email}`,
        name.trim() ? `  name: ${name.trim()}` : '',
        '  source: pricing',
      ]
        .filter(Boolean)
        .join('\n')

      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'text/toon; charset=utf-8', accept: 'text/toon' },
        body,
      })
      const text = await res.text()
      setResp(text)
      setStatus(res.ok ? 'ok' : 'error')
    } catch (e) {
      setResp(String(e))
      setStatus('error')
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">Pricing</h1>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Starter</h2>
          <p className="text-sm text-neutral-500 mb-4">Ideale per testare.</p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>5 pack/mese</li>
            <li>Carousel ZIP</li>
            <li>Copy TOON</li>
          </ul>
        </div>
        <div className="rounded-2xl border p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Pro</h2>
          <p className="text-sm text-neutral-500 mb-4">Per creator/PMM.</p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>Illimitato fair-use</li>
            <li>Horde backgrounds</li>
            <li>Analytics & quality</li>
          </ul>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-10 rounded-2xl border p-6 shadow-sm grid gap-4">
        <h3 className="text-lg font-semibold">Resta aggiornato • Lead capture</h3>
        <input
          type="email"
          required
          placeholder="email@tuodominio.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border px-3 py-2"
        />
        <input
          type="text"
          placeholder="Nome (opzionale)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-xl border px-3 py-2"
        />
        <button
          disabled={status === 'loading'}
          className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50"
        >
          {status === 'loading' ? 'Invio…' : 'Invia'}
        </button>

        {resp && (
          <pre className="mt-2 rounded-xl bg-neutral-50 border p-3 text-xs overflow-auto">
            {resp}
          </pre>
        )}
      </form>
    </main>
  )
}
