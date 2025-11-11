'use client'

import { useEffect } from 'react'

function sid(): string {
  try {
    const k = 'ace:sid'
    let v = sessionStorage.getItem(k)
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36)
      sessionStorage.setItem(k, v)
    }
    return v
  } catch {
    return 'anon'
  }
}

export default function Track({ path }: { path?: string }) {
  useEffect(() => {
    const session_id = sid()
    const body = [
      'track:',
      `  event: page_view`,
      `  path: ${path || (typeof location !== 'undefined' ? location.pathname : '/')}`,
      typeof document !== 'undefined' && document.referrer ? `  referer: ${document.referrer}` : '',
      `  session_id: ${session_id}`,
    ]
      .filter(Boolean)
      .join('\n')

    fetch('/api/track', {
      method: 'POST',
      headers: { 'content-type': 'text/toon; charset=utf-8', accept: 'text/toon' },
      body,
      // fire-and-forget
      keepalive: true,
    }).catch(() => {})
  }, [path])

  return null
}
