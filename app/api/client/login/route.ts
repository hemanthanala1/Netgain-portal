import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`
}
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // 1. Fetch client account
    const { data: account, error: accError } = await supabase
      .from('client_accounts')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (accError || !account) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    if (account.status !== 'active') {
      return NextResponse.json({ error: 'This client account has been deactivated' }, { status: 403 })
    }

    // 2. Verify password (supports plain text or sha256 hash comparison)
    const hashedInput = crypto.createHash('sha256').update(password).digest('hex')
    const passwordMatch = account.password === password || account.password === hashedInput

    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // 3. Fetch CRM client information to get client name and business
    const { data: client, error: clientErr } = await supabase
      .from('crm_clients')
      .select('*')
      .eq('id', account.client_id)
      .maybeSingle()

    if (clientErr || !client) {
      return NextResponse.json({ error: 'Associated client profile not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      session: {
        id: account.id,
        clientId: account.client_id,
        email: account.email,
        name: client.name,
        company: client.business || client.name,
        phone: client.phone || ''
      }
    })
  } catch (err: any) {
    console.error('[CLIENT LOGIN API]', err)
    return NextResponse.json(
      { error: err?.message || 'Authentication failed' },
      { status: 500 }
    )
  }
}
