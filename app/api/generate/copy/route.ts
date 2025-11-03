import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { brief } = body

    const groqApiKey = process.env.GROQ_API_KEY
    if (!groqApiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY non configurata' }, { status: 500 })
    }

    // Esegui chiamata all’API Groq
    const response = await fetch('https://api.groq.com/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: brief,
      }),
    })

    const data = await response.json()
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error('Errore in /api/generate/copy:', error)
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
