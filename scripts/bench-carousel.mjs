// node scripts/bench-carousel.mjs http://localhost:3000 10
const base = process.argv[2] || 'http://localhost:3000'
const n = Number(process.argv[3] || 10)

const payload = {
  slides: ['One', 'Two', 'Three', 'Four', 'Five'],
  count: 5,
  background: 'plain',
  formats: ['svg', 'png'],
  profiles: ['portrait'],
}

const times = []
  ; (async () => {
    for (let i = 0; i < n; i++) {
      const t0 = Date.now()
      const r = await fetch(`${base}/api/carousel`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      await r.arrayBuffer()
      times.push(Date.now() - t0)
    }
    times.sort((a, b) => a - b)
    const p50 = times[Math.floor(times.length * 0.5)] || 0
    const p95 = times[Math.floor(times.length * 0.95)] || 0
    console.log({ count: times.length, p50_ms: p50, p95_ms: p95, samples: times })
  })()
