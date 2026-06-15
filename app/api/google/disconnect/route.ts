import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`
}
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!supabase || !token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Retrieve existing settings
    const { data: existingData, error: fetchError } = await supabase
      .from('company_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError) {
      throw new Error(fetchError.message)
    }

    if (existingData) {
      const comm = { ...existingData.comm }
      
      // Delete Google-specific credentials
      delete comm.googleAccessToken
      delete comm.googleRefreshToken
      delete comm.googleConnectedAt
      delete comm.googleTokenExpiresAt

      const { error: updateError } = await supabase
        .from('company_settings')
        .update({
          comm,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      if (updateError) {
        throw new Error(updateError.message)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Google disconnect error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
