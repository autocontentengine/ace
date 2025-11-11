// node scripts/bench-generate.mjs http://localhost:3000 20
const base = process.argv[2] || 'http://localhost:3000'
const n = Number(process.argv[3] || 20)

const times = []
  ; (async () => {
    for (let i = 0; i < n; i++) {
      const t0 = Date.now()
      const r = await fetch(`${base}/api/generate/copy`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brief: `fitness brand ${i}`, lang: 'en' }),
      })
      await r.text()
      times.push(Date.now() - t0)
    }
    times.sort((a, b) => a - b)
    const p50 = times[Math.floor(times.length * 0.5)] || 0
    const p95 = times[Math.floor(times.length * 0.95)] || 0
    console.log({ count: times.length, p50_ms: p50, p95_ms: p95, samples: times })
  })()
