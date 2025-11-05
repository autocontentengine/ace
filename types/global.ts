import type { NextRequest } from 'next/server'
export type AuthenticatedRequest = NextRequest & { user?: { id: string; role?: string } }
