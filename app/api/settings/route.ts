import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'

const SETTINGS_PATH = path.join(process.cwd(), '.nbos-settings.json')

// Initialize Supabase client (service role for server-side operations)
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
// Normalize URL: handle bare project ref IDs (same logic as lib/supabase.ts)
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`
}
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

// GET — load settings
export async function GET(request: NextRequest) {
  try {
    // Try to get auth token from request
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (supabase && token) {
      // Verify user and fetch their settings from Supabase
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Fetch settings from company_settings table
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is ok
        console.error('Supabase fetch error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (data) {
        return NextResponse.json({
          company: data.company,
          founder: data.founder,
          bank: data.bank,
          comm: data.comm,
          ai: data.ai,
          docs: data.docs,
          updatedAt: data.updated_at
        })
      }
    }

    // Fallback: load from local JSON file if Supabase is not configured
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8')
      return NextResponse.json(JSON.parse(raw))
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

    // Try to save to Supabase
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (supabase && token) {
      // Verify user
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Upsert settings to company_settings table
      const { error } = await supabase
        .from('company_settings')
        .upsert({
          user_id: user.id,
          company: company || {},
          founder: founder || {},
          bank: bank || {},
          comm: comm || {},
          ai: ai || {},
          docs: docs || {},
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })

      if (error) {
        console.error('Supabase upsert error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Also mirror to local file so the PDF generator always has fresh settings
      try {
        const mirror = { company: company || {}, founder: founder || {}, bank: bank || {}, comm: comm || {}, ai: ai || {}, docs: docs || {}, updatedAt: new Date().toISOString() }
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(mirror, null, 2), 'utf-8')
      } catch (mirrorErr) {
        console.warn('Could not mirror settings to local file:', mirrorErr)
      }

      return NextResponse.json({ ok: true, source: 'supabase' })
    }

    // Fallback: save to local JSON file
    let existing: any = {}
    if (fs.existsSync(SETTINGS_PATH)) {
      existing = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
    }
    const merged = { ...existing, company, founder, bank, comm, ai, docs, updatedAt: new Date().toISOString() }
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), 'utf-8')
    return NextResponse.json({ ok: true, source: 'local' })
  } catch (err: any) {
    console.error('Settings POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
