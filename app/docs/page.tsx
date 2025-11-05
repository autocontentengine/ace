// app/docs/page.tsx
import React from 'react'

export default function DocsPage() {
  const endpoint = 'https://ace-six-gules.vercel.app'
  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-6">ACE API Docs</h1>
        <p className="text-neutral-300 mb-8">
          Endpoints principali. Per gli endpoint protetti usa l’header{' '}
          <code className="bg-black/40 px-1 py-0.5 rounded">x-api-key</code>.
        </p>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Health</h2>
          <pre className="bg-black/40 p-4 rounded-md overflow-auto text-sm">
            {`curl -s ${endpoint}/api/health`}
          </pre>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Demo (pubblica)</h2>
          <pre className="bg-black/40 p-4 rounded-md overflow-auto text-sm">
            {`curl -s -X POST ${endpoint}/api/demo \\
  -H "content-type: application/json" \\
  -d '{"brief":"ecommerce skincare minimal, tono premium"}'`}
          </pre>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Generate Copy (protetto)</h2>
          <pre className="bg-black/40 p-4 rounded-md overflow-auto text-sm">
            {`curl -s -X POST ${endpoint}/api/generate/copy \\
  -H "content-type: application/json" \\
  -H "x-api-key: <LA_TUA_API_KEY>" \\
  -d '{"brief":"brand fitness, tono energico"}'`}
          </pre>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Jobs + SSE (protetto)</h2>
          <pre className="bg-black/40 p-4 rounded-md overflow-auto text-sm">
            {`JOB_ID=$(curl -s -X POST ${endpoint}/api/jobs \\
  -H "content-type: application/json" \\
  -H "x-api-key: <LA_TUA_API_KEY>" \\
  -d '{"type":"test","payload":{"brief":"hello prod"}}' \\
  | grep -oP '"jobId"\\s*:\\s*"\\K[^"]+')

curl -N "${endpoint}/api/jobs/$JOB_ID/events" \\
  -H "x-api-key: <LA_TUA_API_KEY>"`}
          </pre>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Carousel ZIP (protetto)</h2>
          <pre className="bg-black/40 p-4 rounded-md overflow-auto text-sm">
            {`curl -s -X POST ${endpoint}/api/carousel \\
  -H "content-type: application/json" \\
  -H "x-api-key: <LA_TUA_API_KEY>" \\
  -d '{"brief":"ecommerce skincare minimal, tono premium","count":5,"theme":"dark"}' \\
  -o carousel.zip

unzip -l carousel.zip   # verifica che ci siano slide_01.svg ...`}
          </pre>
        </section>

        <div className="mt-12 text-neutral-400 text-sm">
          Suggerimenti: usa <code>head -c 40</code> sullo ZIP per evitare di scaricare JSON/HTML di
          errore.
        </div>
      </div>
    </main>
  )
}
