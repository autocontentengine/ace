// app/_components/Track.tsx
'use client'

import { useEffect } from 'react'

export default function Track({ path }: { path: string }) {
  useEffect(() => {
    // Dedup semplice per Strict Mode dev
    const key = `ace_track_sent:${path}`
    if (typeof window !== 'undefined') {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    }

    const controller = new AbortController()

    fetch('/api/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path }),
      signal: controller.signal,
      // keepalive aiuta se l’utente cambia pagina velocemente
      keepalive: true,
    }).catch(() => {})

    return () => controller.abort()
  }, [path])

  return null
}
