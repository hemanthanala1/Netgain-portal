import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'
import { encrypt, decrypt } from '@/lib/crypto-helper'

const SETTINGS_PATH = path.join(process.cwd(), '.nbos-settings.json')

// Initialize Supabase client (service role for server-side operations)
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
// Normalize URL: handle bare project ref IDs
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`
}
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

const SENSITIVE_FIELDS = {
  comm: ['smtpPass', 'waToken', 'resendApiKey', 'sendgridApiKey', 'twilioAuthToken', 'msg91Authkey', 'textlocalApiKey', 'twilioWaToken', 'googleAccessToken', 'googleRefreshToken'],
  ai: ['claudeKey', 'openaiKey', 'geminiKey']
}

function isMaskedValue(val: string) {
  if (!val) return false
  return /^[•\*]+$/.test(val)
}

function maskSensitiveData(comm: any, ai: any) {
  const safeComm = { ...comm }
  SENSITIVE_FIELDS.comm.forEach(field => {
    if (safeComm[field]) {
      safeComm[field] = '••••••••'
    }
  })

  const safeAi = { ...ai }
  SENSITIVE_FIELDS.ai.forEach(field => {
    if (safeAi[field]) {
      safeAi[field] = '••••••••'
    }
  })

  return { comm: safeComm, ai: safeAi }
}

// GET — load settings
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (supabase && token) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        console.error('Supabase fetch error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (data) {
        const masked = maskSensitiveData(data.comm || {}, data.ai || {})
        return NextResponse.json({
          company: data.company,
          founder: data.founder,
          bank: data.bank,
          comm: { ...data.comm, ...masked.comm },
          ai: { ...data.ai, ...masked.ai },
          docs: data.docs,
          isGoogleConnected: !!(data.comm?.googleRefreshToken || data.comm?.googleAccessToken || (data as any).google_oauth),
          googleEmail: data.comm?.googleEmail || null,
          updatedAt: data.updated_at
        })
      }
    }

    // Fallback: load from local JSON file
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8')
      const parsed = JSON.parse(raw)
      const masked = maskSensitiveData(parsed.comm || {}, parsed.ai || {})
      return NextResponse.json({
        ...parsed,
        comm: { ...parsed.comm, ...masked.comm },
        ai: { ...parsed.ai, ...masked.ai },
        isGoogleConnected: !!(parsed.comm?.googleRefreshToken || parsed.comm?.googleAccessToken || parsed.google_oauth),
        googleEmail: parsed.comm?.googleEmail || null
      })
    }

    return NextResponse.json({})
  } catch (err: any) {
    console.error('Settings GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — save settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { company, founder, bank, comm, ai, docs } = body

    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let existingComm: any = {}
    let existingAi: any = {}

    if (supabase && token) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { data: existingData } = await supabase
        .from('company_settings')
        .select('comm, ai')
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingData) {
        existingComm = existingData.comm || {}
        existingAi = existingData.ai || {}
      }

      // Process comm fields, merging with existing to preserve keys like Google tokens
      const processedComm = { ...existingComm, ...comm }
      SENSITIVE_FIELDS.comm.forEach(field => {
        if (isMaskedValue(comm[field])) {
          processedComm[field] = existingComm[field] || ''
        } else if (comm[field]) {
          processedComm[field] = encrypt(comm[field])
        } else if (comm[field] === '') {
          processedComm[field] = ''
        }
      })

      // Process ai fields
      const processedAi = { ...existingAi, ...ai }
      SENSITIVE_FIELDS.ai.forEach(field => {
        if (isMaskedValue(ai[field])) {
          processedAi[field] = existingAi[field] || ''
        } else if (ai[field]) {
          processedAi[field] = encrypt(ai[field])
        } else if (ai[field] === '') {
          processedAi[field] = ''
        }
      })

      const { error } = await supabase
        .from('company_settings')
        .upsert({
          user_id: user.id,
          company: company || {},
          founder: founder || {},
          bank: bank || {},
          comm: processedComm,
          ai: processedAi,
          docs: docs || {},
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })

      if (error) {
        console.error('Supabase upsert error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Sync founder details
      if (founder) {
        try {
          const { data: founderProfile } = await supabase
            .from('profiles')
            .select('id, settings')
            .eq('role', 'Founder')
            .maybeSingle()

          if (founderProfile) {
            const currentSettings = founderProfile.settings || {}

            await supabase
              .from('profiles')
              .update({
                full_name: founder.name,
                email: founder.email,
                settings: {
                  ...currentSettings,
                  phone: founder.phone
                },
                updated_at: new Date().toISOString()
              })
              .eq('id', founderProfile.id)

            await supabase
              .from('team_members')
              .update({
                name: founder.name,
                phone: founder.phone
              })
              .eq('email', founder.email)
          }
        } catch (syncErr) {
          console.error('Error syncing founder settings:', syncErr)
        }
      }

      // Mirror to local file (with encrypted credentials so local operations stay secure)
      try {
        const mirror = { 
          company: company || {}, 
          founder: founder || {}, 
          bank: bank || {}, 
          comm: processedComm, 
          ai: processedAi, 
          docs: docs || {}, 
          updatedAt: new Date().toISOString() 
        }
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(mirror, null, 2), 'utf-8')
      } catch (mirrorErr) {
        console.warn('Could not mirror settings to local file:', mirrorErr)
      }

      return NextResponse.json({ ok: true, source: 'supabase' })
    }

    // Fallback: save to local JSON file
    let existing: any = {}
    if (fs.existsSync(SETTINGS_PATH)) {
      try {
        existing = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
        existingComm = existing.comm || {}
        existingAi = existing.ai || {}
      } catch (_) {}
    }

    // Process comm fields
    const processedComm = { ...existingComm, ...comm }
    SENSITIVE_FIELDS.comm.forEach(field => {
      if (isMaskedValue(comm[field])) {
        processedComm[field] = existingComm[field] || ''
      } else if (comm[field]) {
        processedComm[field] = encrypt(comm[field])
      } else if (comm[field] === '') {
        processedComm[field] = ''
      }
    })

    // Process ai fields
    const processedAi = { ...existingAi, ...ai }
    SENSITIVE_FIELDS.ai.forEach(field => {
      if (isMaskedValue(ai[field])) {
        processedAi[field] = existingAi[field] || ''
      } else if (ai[field]) {
        processedAi[field] = encrypt(ai[field])
      } else if (ai[field] === '') {
        processedAi[field] = ''
      }
    })

    const merged = { 
      ...existing, 
      company, 
      founder, 
      bank, 
      comm: processedComm, 
      ai: processedAi, 
      docs, 
      updatedAt: new Date().toISOString() 
    }
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), 'utf-8')
    return NextResponse.json({ ok: true, source: 'local' })
  } catch (err: any) {
    console.error('Settings POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
