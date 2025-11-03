export async function GET() {
  const envCheck = {
    SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
    GROQ_API_KEY: process.env.GROQ_API_KEY ? 'SET' : 'MISSING',
  };

  return Response.json({ 
    ok: true, 
    ts: new Date().toISOString(),
    stage: "Day 0 - Setup Complete",
    env: envCheck
  })
}
