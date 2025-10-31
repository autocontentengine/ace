import { NextRequest } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const jobId = id

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const stages = [
        { stage: 'analyzing_brief', progress: 20 },
        { stage: 'generating_copy', progress: 40 },
        { stage: 'creating_carousel', progress: 70 },
        { stage: 'finalizing', progress: 100 }
      ]

      for (const update of stages) {
        const event = {
          jobId,
          status: 'running',
          progress: update.progress,
          stage: update.stage,
          timestamp: new Date().toISOString()
        }

        controller.enqueue(
          encoder.encode(`event: progress\ndata: ${JSON.stringify(event)}\n\n`)
        )
        
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      controller.enqueue(
        encoder.encode(`event: complete\ndata: ${JSON.stringify({
          jobId,
          status: 'completed',
          progress: 100,
          timestamp: new Date().toISOString()
        })}\n\n`)
      )
      
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
