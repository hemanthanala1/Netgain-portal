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
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature, 
      invoiceId 
    } = await request.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !invoiceId) {
      return NextResponse.json({ error: 'Missing required payment details' }, { status: 400 })
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

    const { razorpaySecretKey } = settings.payment

    if (!razorpaySecretKey) {
      return NextResponse.json({ error: 'Razorpay secret not found' }, { status: 400 })
    }

    const decryptedSecret = decrypt(razorpaySecretKey)

    // Verify signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`
    const expectedSignature = crypto
      .createHmac('sha256', decryptedSecret)
      .update(text)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    // Update the invoice in Supabase
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        payment_gateway: 'razorpay',
        payment_id: razorpay_payment_id,
        payment_order_id: razorpay_order_id,
        payment_signature: razorpay_signature,
        payment_method: 'Razorpay Online',
        payment_date: new Date().toISOString()
      })
      .eq('doc_id', invoiceId)

    if (updateError) {
      console.error('Error updating invoice:', updateError)
      return NextResponse.json({ error: 'Failed to update invoice status' }, { status: 500 })
    }

    // Log Activity
    await supabase.from('system_activities').insert({
      user_name: 'Client / Razorpay',
      action: `Payment received for Invoice ${invoiceId} via Razorpay`,
      module: 'finance'
    })

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error verifying Razorpay payment:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
