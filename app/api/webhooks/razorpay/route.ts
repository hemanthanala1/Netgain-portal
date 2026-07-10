import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { decrypt } from '@/lib/crypto-helper'

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`
}
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-razorpay-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    // Fetch company settings for Razorpay Webhook Secret
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('payment')
      .limit(1)
      .maybeSingle()

    if (settingsError || !settings || !settings.payment) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 400 })
    }

    const { razorpayWebhookSecret } = settings.payment

    if (!razorpayWebhookSecret) {
      return NextResponse.json({ error: 'Razorpay webhook secret not found' }, { status: 400 })
    }

    const decryptedWebhookSecret = decrypt(razorpayWebhookSecret)

    const expectedSignature = crypto
      .createHmac('sha256', decryptedWebhookSecret)
      .update(rawBody)
      .digest('hex')

    if (expectedSignature !== signature) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
    }

    const event = JSON.parse(rawBody)

    // Handle payment.captured
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity
      const invoiceId = payment.description || payment.notes?.invoice_id

      if (invoiceId) {
        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            status: 'paid',
            payment_gateway: 'razorpay',
            payment_id: payment.id,
            payment_order_id: payment.order_id,
            payment_method: payment.method || 'Razorpay Online',
            payment_date: new Date(payment.created_at * 1000).toISOString()
          })
          .eq('doc_id', invoiceId)
          .neq('status', 'paid') // Only update if not already paid by the client-side verify

        if (!updateError) {
          // Check if it was updated by verifying if row was modified? Supabase REST doesn't tell us easily if no rows were matched unless we select it. 
          // So just insert an activity log to be safe. We could fetch the invoice first to ensure we don't log duplicates, but it's okay for now.
          await supabase.from('system_activities').insert({
            user_name: 'Webhook / Razorpay',
            action: `Webhook processed: Payment captured for ${invoiceId}`,
            module: 'finance'
          })
        }
      }
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error handling Razorpay webhook:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
