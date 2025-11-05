'use client'
import React, { useState } from 'react'
export default function PricingPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'ok' | 'err' | 'loading'>('idle')
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    const r = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, source: 'pricing' }),
    })
    setStatus(r.ok ? 'ok' : 'err')
    if (r.ok) setEmail('')
  }
  return (
    <main className="min-h-screen bg-[#0B0F14] text-white flex items-center">
      <div className="max-w-xl mx-auto px-6">
        <h1 className="text-3xl font-bold mb-3">Pricing</h1>
        <p className="text-neutral-300 mb-6">
          Early access: gratis per i primi 20 utenti. Lascia l’email, ti inviamo la API key.
        </p>
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            className="flex-1 bg-black/40 border border-white/10 rounded-md px-3 py-2 outline-none"
            placeholder="la-tua@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            className="bg-white text-black rounded-md px-4 py-2 font-medium disabled:opacity-60"
            disabled={status === 'loading' || !email}
          >
            {status === 'loading' ? 'Invio…' : 'Richiedi accesso'}
          </button>
        </form>
        {status === 'ok' && (
          <p className="text-emerald-400 mt-3">Fatto! Ti scriviamo a breve con la API key.</p>
        )}
        {status === 'err' && <p className="text-red-400 mt-3">Errore imprevisto. Riprova.</p>}
      </div>
    </main>
  )
}
