import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Razorpay from 'razorpay'
import { decrypt } from '@/lib/crypto-helper'

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`
}
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

export async function POST(request: NextRequest) {
  try {
    const { invoiceId, amount, currency = 'INR' } = await request.json()

    if (!invoiceId || !amount) {
      return NextResponse.json({ error: 'Missing invoiceId or amount' }, { status: 400 })
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    // Fetch company settings for Razorpay credentials
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('payment')
      .limit(1)
      .maybeSingle()

    if (settingsError || !settings || !settings.payment) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 400 })
    }

    const { razorpayEnabled, razorpayKeyId, razorpaySecretKey } = settings.payment

    if (!razorpayEnabled) {
      return NextResponse.json({ error: 'Razorpay is disabled' }, { status: 400 })
    }

    if (!razorpayKeyId || !razorpaySecretKey) {
      return NextResponse.json({ error: 'Razorpay credentials not found' }, { status: 400 })
    }

    const decryptedSecret = decrypt(razorpaySecretKey)

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: decryptedSecret
    })

    const options = {
      amount: Math.round(amount * 100), // Razorpay expects amount in smallest currency unit (paise)
      currency,
      receipt: invoiceId,
      payment_capture: 1 // Auto-capture
    }

    const order = await razorpay.orders.create(options)

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    })

  } catch (error: any) {
    console.error('Error creating Razorpay order:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
