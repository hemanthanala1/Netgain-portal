import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role to bypass RLS for inserting push subscriptions
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { subscription, userType, userId, clientCompany, userAgent, resubscribe } = body

    if (!subscription || !userType || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: subscription, userType, userId' },
        { status: 400 }
      )
    }

    const endpoint = subscription.endpoint as string
    if (!endpoint) {
      return NextResponse.json({ error: 'Invalid subscription: missing endpoint' }, { status: 400 })
    }

    // Upsert based on endpoint (each browser/device has a unique endpoint)
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(
        {
          user_type: userType,
          user_id: userId,
          client_company: clientCompany || null,
          subscription: subscription,
          user_agent: userAgent || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_type,user_id',
          ignoreDuplicates: false,
        }
      )

    if (error) {
      // If upsert fails (e.g. unique constraint issue), try a simple insert
      const { error: insertError } = await supabaseAdmin
        .from('push_subscriptions')
        .insert({
          user_type: userType,
          user_id: userId,
          client_company: clientCompany || null,
          subscription: subscription,
          user_agent: userAgent || null,
        })
      
      if (insertError) {
        console.error('[push/register] DB error:', insertError)
        // Don't fail the request — push registration should be best-effort
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[push/register] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
