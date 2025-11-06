// app/pricing/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Track from '@/app/_components/Track'

type Tier = {
  readonly id: 'free' | 'starter' | 'pro' | 'business'
  readonly name: string
  readonly priceEur: number
  readonly quota: number
  readonly overageEurPerAsset: number | null
  readonly features: readonly string[]
  readonly ctaLabel: string
  readonly highlight?: boolean
}

const TIERS: readonly Tier[] = [
  {
    id: 'free',
    name: 'Free',
    priceEur: 0,
    quota: 10,
    overageEurPerAsset: null,
    features: ['10 asset/mese', 'Generazione copy + caroselli (base)', 'Senza API'],
    ctaLabel: 'Provalo gratis',
  },
  {
    id: 'starter',
    name: 'Starter',
    priceEur: 9,
    quota: 300,
    overageEurPerAsset: 0.03,
    features: ['300 asset/mese', 'API base', '1 workspace', 'Export ZIP caroselli'],
    ctaLabel: 'Prenota Starter',
    highlight: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceEur: 29,
    quota: 1500,
    overageEurPerAsset: 0.03,
    features: ['1.500 asset/mese', 'API prioritaria', '3 workspace', 'Template premium'],
    ctaLabel: 'Prenota Pro',
  },
  {
    id: 'business',
    name: 'Business',
    priceEur: 79,
    quota: 6000,
    overageEurPerAsset: 0.02,
    features: ['6.000 asset/mese', 'SLA light', 'Accessi team', 'Assistenza dedicata'],
    ctaLabel: 'Parla con noi',
  },
] as const

export default function PricingPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>, source: string) {
    e.preventDefault()
    setError(null)
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Inserisci un’email valida')
      return
    }
    try {
      setPending(true)
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, source }),
      })
      if (!res.ok) throw new Error('Lead non salvato')
      router.push(`/thanks?email=${encodeURIComponent(email)}&source=${encodeURIComponent(source)}`)
    } catch (err: any) {
      setError(err?.message ?? 'Errore sconosciuto')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B0F1A] to-[#0F172A] text-white">
      <header className="mx-auto max-w-6xl px-6 pt-14 pb-6">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Prezzi semplici, scalabili
        </h1>
        <p className="mt-3 text-slate-300">
          Paga solo quello che usi. Quando superi la quota mensile, continui con un piccolo overage
          per asset.
        </p>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t) => (
            <div
              key={t.id}
              className={
                'rounded-2xl p-6 border bg-white/[0.03] ' +
                (t.highlight
                  ? 'border-indigo-400/50 bg-white/5 shadow-[0_0_0_1px_rgba(99,102,241,0.25)]'
                  : 'border-white/10')
              }
            >
              {t.highlight && (
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
                  ⭐ Più scelto
                </div>
              )}
              <h3 className="text-xl font-semibold">{t.name}</h3>
              <div className="mt-4 flex items-end gap-2">
                <div className="text-3xl font-bold">{t.priceEur} €</div>
                <div className="text-sm text-slate-400">/ mese</div>
              </div>
              <div className="mt-2 text-sm text-slate-300">
                Quota: <strong>{t.quota}</strong> asset/mese
                {t.overageEurPerAsset != null && (
                  <>
                    {' '}
                    • Overage: <strong>{t.overageEurPerAsset.toFixed(2)} €</strong>/asset
                  </>
                )}
              </div>
              <ul className="mt-5 space-y-2 text-sm text-slate-300">
                {t.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 inline-block size-1.5 rounded-full bg-emerald-400" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <form className="mt-6 space-y-2" onSubmit={(e) => onSubmit(e, `pricing:${t.id}`)}>
                <label className="block text-xs text-slate-400">
                  Lascia la tua email: ti avvisiamo/abilitiamo il piano
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    inputMode="email"
                    placeholder="tuo@email.com"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <button
                    className={
                      'shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ' +
                      (t.highlight
                        ? 'bg-indigo-600 hover:bg-indigo-500'
                        : 'bg-slate-700 hover:bg-slate-600')
                    }
                    disabled={pending}
                  >
                    {pending ? 'Invio…' : t.ctaLabel}
                  </button>
                </div>
                {error && <div className="text-xs text-rose-400">{error}</div>}
              </form>
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-slate-400">
          * Overage = costo per ogni asset extra oltre la quota inclusa nel mese. I prezzi sono IVA
          esclusa. Per esigenze su misura contattaci:{' '}
          <span className="ml-1 underline">autocontentengine@gmail.com</span>.
        </p>
      </main>

      <Track path="/pricing" />
    </div>
  )
}
