export async function GET() {
  return Response.json({ 
    ok: true, 
    ts: new Date().toISOString(),
    stage: "Day 0 - Setup Complete"
  })
}
