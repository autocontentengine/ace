// app/thanks/page.tsx
import Track from '@/app/_components/Track'

// NB: tipizziamo "loosely" per evitare mismatch col PageProps generato da Next 16
export default async function ThanksPage({ searchParams }: any) {
  const sp = await searchParams // in Next 16 può essere una Promise
  const email = sp?.email ?? ''
  const source = sp?.source ?? ''

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B0F1A] to-[#0F172A] text-white">
      <header className="mx-auto max-w-3xl px-6 pt-16 pb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">✅ Grazie!</h1>
        <p className="mt-3 text-slate-300">Ti avviseremo non appena il piano sarà attivo.</p>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-16 space-y-4">
        {email && (
          <p className="text-sm text-slate-300">
            <span className="text-slate-400">Email:</span>{' '}
            <span className="font-medium">{email}</span>
          </p>
        )}
        {source && (
          <p className="text-sm text-slate-300">
            <span className="text-slate-400">Source:</span>{' '}
            <span className="font-medium">{source}</span>
          </p>
        )}

        <div className="mt-6">
          <a
            href="/"
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium"
          >
            Torna alla home
          </a>
        </div>
      </main>

      <Track path="/thanks" />
    </div>
  )
}
