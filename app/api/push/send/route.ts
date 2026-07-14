import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

// Configure web-push with VAPID credentials
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@netgainstudio.com'

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
}

// Use service role to read all subscriptions
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface PushPayload {
  title: string
  body: string
  url?: string
  type?: 'support' | 'document' | 'file' | 'requirement' | 'meeting' | 'payment' | 'success' | 'warning' | 'info'
  tag?: string
  notifId?: string
  icon?: string
}

/**
 * POST /api/push/send
 *
 * Send a push notification to one or more users.
 *
 * Body:
 *   targetType: 'admin' | 'client' | 'company'
 *   targetId:   userId for 'admin'/'client', company name for 'company'
 *   payload:    { title, body, url?, type?, tag? }
 *
 * targetType='admin'   → sends to all admin push subscriptions
 * targetType='client'  → sends to push subscriptions for a specific client user_id (email)
 * targetType='company' → sends to all push subscriptions matching a client_company
 */
export async function POST(req: NextRequest) {
  try {
    // VAPID validation
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('[push/send] VAPID keys not configured — skipping push')
      return NextResponse.json({ skipped: true, reason: 'VAPID keys not configured' })
    }

    const body = await req.json()
    const { targetType, targetId, payload } = body as {
      targetType: 'admin' | 'client' | 'company' | 'all_admins'
      targetId?: string
      payload: PushPayload
    }

    if (!payload?.title || !payload?.body) {
      return NextResponse.json({ error: 'payload.title and payload.body are required' }, { status: 400 })
    }

    // Build the query to find matching push subscriptions
    let query = supabaseAdmin.from('push_subscriptions').select('id, subscription, user_type, user_id')

    if (targetType === 'all_admins') {
      query = query.eq('user_type', 'admin')
    } else if (targetType === 'admin' && targetId) {
      query = query.eq('user_type', 'admin').eq('user_id', targetId)
    } else if (targetType === 'client' && targetId) {
      query = query.eq('user_type', 'client').eq('user_id', targetId)
    } else if (targetType === 'company' && targetId) {
      query = query.eq('user_type', 'client').eq('client_company', targetId)
    } else {
      return NextResponse.json({ error: 'Invalid targetType or missing targetId' }, { status: 400 })
    }

    const { data: subscriptions, error } = await query

    if (error) {
      console.error('[push/send] DB error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No active subscriptions found for this target' })
    }

    // Build the push notification JSON payload
    const pushData = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/',
      type: payload.type || 'info',
      tag: payload.tag || `netgain-${Date.now()}`,
      notifId: payload.notifId || null,
      icon: payload.icon || '/icon-192.png',
    })

    let sent = 0
    let failed = 0
    const staleEndpoints: string[] = []

    // Send push to each subscribed browser
    await Promise.allSettled(
      subscriptions.map(async (row: any) => {
        const sub = row.subscription as webpush.PushSubscription
        if (!sub?.endpoint) return

        try {
          await webpush.sendNotification(sub, pushData, {
            TTL: 60 * 60, // 1 hour time-to-live
            urgency: 'normal',
          })
          sent++
        } catch (err: any) {
          failed++
          // 410 Gone = subscription expired/invalid — remove it
          if (err.statusCode === 410 || err.statusCode === 404) {
            staleEndpoints.push(sub.endpoint)
          } else {
            console.warn('[push/send] Push error for subscription:', err.statusCode, err.message?.slice(0, 100))
          }
        }
      })
    )

    // Clean up stale subscriptions
    if (staleEndpoints.length > 0) {
      for (const endpoint of staleEndpoints) {
        await supabaseAdmin
          .from('push_subscriptions')
          .delete()
          .contains('subscription', { endpoint })
      }
    }

    return NextResponse.json({ sent, failed, total: subscriptions.length })
  } catch (err: any) {
    console.error('[push/send] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
