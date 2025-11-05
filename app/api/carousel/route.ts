import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth/middleware'
import type { AuthenticatedRequest } from '@/types/global'

export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req)

  // 🛡️ Se null o NextResponse → ritorna errore 401
  if (!authResult || authResult instanceof NextResponse) {
    return authResult ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { user } = authResult as AuthenticatedRequest

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ✅ Tutto OK
  const carousel = {
    id: 'mock-carousel-id',
    userId: user.id,
    slides: [
      { title: 'Slide 1', content: 'Contenuto slide 1' },
      { title: 'Slide 2', content: 'Contenuto slide 2' },
    ],
  }

  return NextResponse.json({ carousel })
}
