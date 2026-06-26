import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/crypto-helper'
import net from 'net'

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`
}
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

// Helper to test SMTP connection (socket ping)
function testSmtpSocket(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(4000)
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => {
      resolve(false)
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.connect(port, host)
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { channel, provider, credentials } = body

    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let existingComm: any = {}
    if (supabase && token) {
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        const { data } = await supabase
          .from('company_settings')
          .select('comm')
          .eq('user_id', user.id)
          .maybeSingle()
        if (data) {
          existingComm = data.comm || {}
        }
      }
    }

    // Helper to resolve credential (from input or decrypted from database if masked)
    const getCredValue = (val: string, field: string) => {
      if (val === '••••••••') {
        const encrypted = existingComm[field] || ''
        return decrypt(encrypted)
      }
      return val || ''
    }

    if (channel === 'email') {
      if (provider === 'smtp') {
        const host = credentials.smtpHost || ''
        const port = Number(credentials.smtpPort) || 587
        const success = await testSmtpSocket(host, port)
        if (!success) {
          return NextResponse.json({ success: false, error: `Could not connect to SMTP server ${host}:${port}` })
        }
        return NextResponse.json({ success: true, message: 'SMTP Port is open and reachable!' })
      } 
      
      if (provider === 'resend') {
        const key = getCredValue(credentials.resendApiKey, 'resendApiKey')
        if (!key) return NextResponse.json({ success: false, error: 'Resend API Key is required' })
        const res = await fetch('https://api.resend.com/emails', {
          headers: { Authorization: `Bearer ${key}` }
        })
        if (res.status === 401) {
          return NextResponse.json({ success: false, error: 'Invalid Resend API Key' })
        }
        return NextResponse.json({ success: true, message: 'Resend API Key is valid!' })
      }

      if (provider === 'sendgrid') {
        const key = getCredValue(credentials.sendgridApiKey, 'sendgridApiKey')
        if (!key) return NextResponse.json({ success: false, error: 'SendGrid API Key is required' })
        const res = await fetch('https://api.sendgrid.com/v3/scopes', {
          headers: { Authorization: `Bearer ${key}` }
        })
        if (res.status === 401) {
          return NextResponse.json({ success: false, error: 'Invalid SendGrid API Key' })
        }
        return NextResponse.json({ success: true, message: 'SendGrid API Key is valid!' })
      }
    }

    if (channel === 'whatsapp') {
      if (provider === 'meta') {
        const tokenVal = getCredValue(credentials.waToken, 'waToken')
        const phoneId = credentials.waPhoneId || ''
        if (!tokenVal || !phoneId) {
          return NextResponse.json({ success: false, error: 'Meta Token and Phone ID are required' })
        }
        const res = await fetch(`https://graph.facebook.com/v17.0/${phoneId}`, {
          headers: { Authorization: `Bearer ${tokenVal}` }
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          return NextResponse.json({ success: false, error: err.error?.message || 'Invalid Meta credentials' })
        }
        return NextResponse.json({ success: true, message: 'Meta WhatsApp credentials are valid!' })
      }

      if (provider === 'twilio') {
        const sid = credentials.twilioWaSid || ''
        const tokenVal = getCredValue(credentials.twilioWaToken, 'twilioWaToken')
        if (!sid || !tokenVal) {
          return NextResponse.json({ success: false, error: 'Twilio SID and Auth Token are required' })
        }
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
          headers: {
            Authorization: 'Basic ' + Buffer.from(sid + ':' + tokenVal).toString('base64')
          }
        })
        if (!res.ok) {
          return NextResponse.json({ success: false, error: 'Invalid Twilio credentials' })
        }
        return NextResponse.json({ success: true, message: 'Twilio WhatsApp configuration is valid!' })
      }
    }

    if (channel === 'sms') {
      if (provider === 'twilio') {
        const sid = credentials.twilioAccountSid || ''
        const tokenVal = getCredValue(credentials.twilioAuthToken, 'twilioAuthToken')
        if (!sid || !tokenVal) {
          return NextResponse.json({ success: false, error: 'Twilio Account SID and Auth Token are required' })
        }
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
          headers: {
            Authorization: 'Basic ' + Buffer.from(sid + ':' + tokenVal).toString('base64')
          }
        })
        if (!res.ok) {
          return NextResponse.json({ success: false, error: 'Invalid Twilio credentials' })
        }
        return NextResponse.json({ success: true, message: 'Twilio SMS credentials are valid!' })
      }

      if (provider === 'msg91') {
        const key = getCredValue(credentials.msg91Authkey, 'msg91Authkey')
        if (!key) return NextResponse.json({ success: false, error: 'MSG91 Authkey is required' })
        const res = await fetch('https://control.msg91.com/api/v1/account', {
          headers: { authkey: key }
        })
        if (!res.ok) {
          return NextResponse.json({ success: false, error: 'Invalid MSG91 Authkey' })
        }
        return NextResponse.json({ success: true, message: 'MSG91 credentials are valid!' })
      }

      if (provider === 'textlocal') {
        const key = getCredValue(credentials.textlocalApiKey, 'textlocalApiKey')
        if (!key) return NextResponse.json({ success: false, error: 'TextLocal API Key is required' })
        const res = await fetch(`https://api.textlocal.in/get_balance?apiKey=${encodeURIComponent(key)}`)
        const data = await res.json().catch(() => ({}))
        if (data.status === 'failure') {
          return NextResponse.json({ success: false, error: data.errors?.[0]?.message || 'Invalid TextLocal API Key' })
        }
        return NextResponse.json({ success: true, message: 'TextLocal credentials are valid!' })
      }
    }

    return NextResponse.json({ success: false, error: 'Unsupported provider or channel' })
  } catch (err: any) {
    console.error('[TEST CONNECTION API]', err)
    return NextResponse.json({ success: false, error: err.message || 'Connection test failed' })
  }
}
