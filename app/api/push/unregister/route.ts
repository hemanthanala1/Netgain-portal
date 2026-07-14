import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { endpoint, userType, userId } = body

    if (!endpoint && !userId) {
      return NextResponse.json({ error: 'Provide endpoint or userId to unregister' }, { status: 400 })
    }

    let query = supabaseAdmin.from('push_subscriptions').delete()

    if (endpoint) {
      // Delete by specific endpoint (most precise)
      query = query.contains('subscription', { endpoint })
    } else if (userId && userType) {
      // Delete all subscriptions for this user
      query = query.eq('user_type', userType).eq('user_id', userId)
    }

    const { error } = await query

    if (error) {
      console.error('[push/unregister] DB error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[push/unregister] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
