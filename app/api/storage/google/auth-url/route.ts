export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}.supabase.co`, supabaseServiceKey) 
  : null

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token') || ''
    const clientUserId = request.nextUrl.searchParams.get('clientUserId') || ''
    
    // Validate session token if provided
    let userId = '00000000-0000-0000-0000-000000000000'
    let stateVal = ''
    if (supabase && token) {
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        userId = user.id
        stateVal = token || userId
      }
    } else if (clientUserId) {
      userId = clientUserId
      stateVal = `client:${clientUserId}`
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUri = `${appUrl}/api/storage/google/callback`

    if (!clientId) {
      console.error('[Google Drive Auth] Client ID not configured')
      return NextResponse.json({ error: 'Google Client Credentials not configured in ERP.' }, { status: 500 })
    }

    // Google Drive scopes: full drive access, user profile, and user email
    const scope = [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' ')

    // Force prompt=consent and access_type=offline to guarantee we get a refresh_token
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scope,
      access_type: 'offline',
      prompt: 'select_account consent',
      state: stateVal || userId // pass token or userId as state to retrieve in callback
    }).toString()

    return NextResponse.json({ url: authUrl })
  } catch (err: any) {
    console.error('[Google Drive Auth init error]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
