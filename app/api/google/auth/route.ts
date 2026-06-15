export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`
}
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token') || ''
    
    // Validate that the request came from a valid session if Supabase is initialized
    let userId = '00000000-0000-0000-0000-000000000000'
    if (supabase && token) {
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (user) {
        userId = user.id
      }
    }

    const client_id = process.env.GOOGLE_CLIENT_ID
    const redirect_uri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/google/callback`

    if (!client_id) {
      console.error('Google Client Credentials not configured.')
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings?error=google_oauth_not_configured`)
    }

    const scope = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' ')
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=select_account%20consent&state=${encodeURIComponent(token || userId)}`
    
    return NextResponse.redirect(authUrl)
  } catch (err: any) {
    console.error('Google OAuth init error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
