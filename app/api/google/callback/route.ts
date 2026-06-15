export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { encrypt } from '@/lib/crypto-helper'

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`
}
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code') || ''
    const state = request.nextUrl.searchParams.get('state') || ''

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is missing' }, { status: 400 })
    }

    let userId = '00000000-0000-0000-0000-000000000000'
    if (supabase && state) {
      // First try to authenticate the user by token (if state was passed as token)
      const { data: { user } } = await supabase.auth.getUser(state)
      if (user) {
        userId = user.id
      } else {
        // Fallback: treat state as user_id directly
        userId = state
      }
    }

    let accessToken = ''
    let refreshToken = ''
    let expiresAt = ''

    if (code === 'mock_google_oauth_code_xyz') {
      // Mock Flow
      accessToken = 'mock_google_access_token_value'
      refreshToken = 'mock_google_refresh_token_value'
      expiresAt = new Date(Date.now() + 3600 * 1000).toISOString()
    } else {
      // Real Flow
      const client_id = process.env.GOOGLE_CLIENT_ID
      const client_secret = process.env.GOOGLE_CLIENT_SECRET
      const redirect_uri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/google/callback`

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: client_id || '',
          client_secret: client_secret || '',
          redirect_uri,
          grant_type: 'authorization_code'
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error_description || data.error || 'Failed to exchange token')
      }

      accessToken = data.access_token
      refreshToken = data.refresh_token || '' // Might not be returned if prompt=consent was omitted
      expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString()
    }

    let googleEmail = ''
    if (code !== 'mock_google_oauth_code_xyz' && accessToken) {
      try {
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        if (profileRes.ok) {
          const profile = await profileRes.json()
          if (profile.email) googleEmail = profile.email
        }
      } catch (err) {
        console.warn('Failed to fetch Google profile info:', err)
      }
    }

    if (supabase) {
      // Retrieve existing company settings to merge
      const { data: existingData } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      const existingComm = existingData?.comm || {}

      // Update tokens (encrypting access and refresh tokens)
      const updatedComm = {
        ...existingComm,
        googleAccessToken: encrypt(accessToken),
        googleConnectedAt: new Date().toISOString(),
        googleTokenExpiresAt: expiresAt,
        googleEmail
      }

      if (refreshToken) {
        updatedComm.googleRefreshToken = encrypt(refreshToken)
      }

      // Upsert into company_settings
      const { error: upsertError } = await supabase
        .from('company_settings')
        .upsert({
          user_id: userId,
          comm: updatedComm,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })

      if (upsertError) {
        throw new Error('Database upsert failed: ' + upsertError.message)
      }
    }

    // Redirect user back to the settings page with success flash
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const settingsUrl = `${appUrl}/settings?tab=comms&connected=google`
    return NextResponse.redirect(settingsUrl)
  } catch (err: any) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
