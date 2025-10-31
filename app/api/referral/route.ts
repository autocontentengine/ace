import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function POST(req: NextRequest) {
  try {
    const { referralCode, userId } = await req.json()
    
    if (!referralCode || !userId) {
      return NextResponse.json({ error: 'Missing referralCode or userId' }, { status: 400 })
    }

    // Per ora registriamo l'evento in una tabella semplice
    const { error } = await supabase
      .from('revenue_events') // Usiamo revenue_events come placeholder
      .insert({
        source: `referral:${referralCode}`,
        amount_eur: 0, // Segnaliamo referral senza revenue
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Referral tracking error:', error)
      return NextResponse.json({ error: 'Failed to track referral' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Referral tracked successfully' 
    })
  } catch (error) {
    console.error('Referral error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
