// app/api/jobs/[id]/events/route.ts
import { authenticateRequest } from '@/lib/auth/middleware'
import type { AuthenticatedRequest } from '@/types/global'

export const runtime = 'nodejs' // teniamo Node per usare 'crypto' nel middleware

export async function GET(
  req: AuthenticatedRequest,
  ctx: { params: Promise<{ id: string }> } // <-- in Next 16 è una Promise
) {
  const authErr = await authenticateRequest(req)
  if (authErr) return authErr

  const { id } = await ctx.params // <-- unwrap Promise
  const jobId = id
  const encoder = new TextEncoder()

  // definiamo iv/timeout in outer scope così sono visibili in cancel()
  let iv: ReturnType<typeof setInterval> | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: any) =>
        controller.enqueue(encoder.encode(`event: update\ndata: ${JSON.stringify(event)}\n\n`))

      // heartbeat finto per demo
      iv = setInterval(() => send({ status: 'running', jobId, ts: Date.now() }), 2000)

      timeout = setTimeout(() => {
        send({ status: 'done', jobId, ts: Date.now() })
        if (iv) clearInterval(iv)
        controller.close()
      }, 7000)

      controller.enqueue(encoder.encode(`event: open\ndata: {"jobId":"${jobId}"}\n\n`))
    },
    cancel() {
      if (iv) clearInterval(iv)
      if (timeout) clearTimeout(timeout)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
