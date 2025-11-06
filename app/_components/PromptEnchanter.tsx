// app/_components/PromptEnchanter.tsx
'use client'
import { useState } from 'react'

export default function PromptEnchanter({ onUse }: { onUse: (p: string) => void }) {
  const [raw, setRaw] = useState('')
  const [goal, setGoal] = useState('')
  const [improved, setImproved] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function enhance() {
    setErr(null)
    setBusy(true)
    try {
      const r = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: raw, goal }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'errore enhance')
      setImproved(j.prompt)
    } catch (e: any) {
      setErr(e?.message ?? 'errore')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div className="text-sm text-slate-300">Prompt di partenza</div>
      <textarea
        className="w-full rounded-lg border border-white/10 bg-white/[0.06] p-3 text-sm outline-none"
        rows={5}
        placeholder="Descrivi brand, tono, obiettivi, formato…"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
      />
      <input
        className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm outline-none"
        placeholder="Obiettivo (facoltativo: e.g. vendite skincare Q4)"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          onClick={enhance}
          disabled={busy || !raw}
          className="rounded-lg px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? 'Miglioro…' : 'Migliora prompt'}
        </button>
        <button
          onClick={() => onUse(improved || raw)}
          disabled={!raw && !improved}
          className="rounded-lg px-4 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
        >
          Usa per generare
        </button>
      </div>
      {improved && (
        <div>
          <div className="text-sm text-slate-300 mb-1">Prompt migliorato</div>
          <textarea
            className="w-full rounded-lg border border-white/10 bg-white/[0.06] p-3 text-sm outline-none"
            rows={6}
            value={improved}
            onChange={(e) => setImproved(e.target.value)}
          />
        </div>
      )}
      {err && <div className="text-sm text-rose-400">{err}</div>}
    </div>
  )
}
