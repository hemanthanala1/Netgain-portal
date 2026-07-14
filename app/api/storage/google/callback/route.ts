export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { encrypt } from '@/lib/crypto-helper'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAdmin = createClient(
  supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}.supabase.co`,
  supabaseServiceKey
)

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  let redirectTarget = `${appUrl}/profile?tab=connections`

  try {
    const code = request.nextUrl.searchParams.get('code') || ''
    const state = request.nextUrl.searchParams.get('state') || ''
    const errorParam = request.nextUrl.searchParams.get('error')

    const isClient = state.startsWith('client:')
    redirectTarget = isClient
      ? `${appUrl}/client/dashboard?tab=profile`
      : `${appUrl}/profile?tab=connections`

    if (errorParam) {
      console.error('[Google OAuth Callback] Error parameter:', errorParam)
      return NextResponse.redirect(`${redirectTarget}&error=${encodeURIComponent(errorParam)}`)
    }

    if (!code) {
      return NextResponse.redirect(`${redirectTarget}&error=missing_code`)
    }

    // 1. Authenticate user from state parameter
    let userId = ''
    if (state) {
      if (isClient) {
        userId = state.replace('client:', '')
      } else {
        // First try to authenticate the user by token (if state was passed as token)
        const { data: { user } } = await supabaseAdmin.auth.getUser(state)
        if (user) {
          userId = user.id
        } else {
          // Fallback: treat state as user_id directly
          userId = state
        }
      }
    }

    if (!userId || userId === '00000000-0000-0000-0000-000000000000') {
      console.error('[Google OAuth Callback] Could not resolve valid User ID from state')
      return NextResponse.redirect(`${redirectTarget}&error=unauthorized`)
    }

    // 2. Exchange code for tokens
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = `${appUrl}/api/storage/google/callback`

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId || '',
        client_secret: clientSecret || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    })

    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || tokenData.error) {
      console.error('[Google OAuth Token Exchange Error]', tokenData)
      return NextResponse.redirect(`${redirectTarget}&error=token_exchange_failed`)
    }

    const accessToken = tokenData.access_token
    const refreshToken = tokenData.refresh_token
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString()

    if (!refreshToken) {
      console.warn('[Google OAuth Callback] No refresh token returned. User may need to consent again.')
    }

    // 3. Fetch Google User Profile
    let googleUserId = ''
    let googleEmail = ''
    try {
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (profileRes.ok) {
        const profile = await profileRes.json()
        googleUserId = profile.id || ''
        googleEmail = profile.email || ''
      }
    } catch (err) {
      console.warn('[Google OAuth Callback] Failed to fetch user info:', err)
    }

    // 4. Fetch Storage Quota
    let storageUsed = 0
    let storageTotal = 0
    try {
      const aboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (aboutRes.ok) {
        const aboutData = await aboutRes.json()
        storageUsed = Number(aboutData.storageQuota?.usage) || 0
        storageTotal = Number(aboutData.storageQuota?.limit) || 0
      }
    } catch (err) {
      console.warn('[Google OAuth Callback] Failed to fetch storage quota:', err)
    }

    // 5. Store connection details in DB
    const connectionRecord: any = {
      user_id: userId,
      google_user_id: googleUserId || null,
      google_email: googleEmail || null,
      access_token: encrypt(accessToken),
      expires_at: expiresAt,
      status: 'connected',
      storage_used: storageUsed,
      storage_total: storageTotal,
      updated_at: new Date().toISOString()
    }

    // If Google returned a refresh token, encrypt and store it
    if (refreshToken) {
      connectionRecord.refresh_token = encrypt(refreshToken)
    }

    // If updating, and we didn't receive a new refresh token (e.g. user re-authenticated without prompt=consent),
    // we want to preserve the existing refresh token. So we use upsert with Postgres.
    // If refresh_token is missing, we fetch the old one first.
    if (!refreshToken) {
      const { data: oldConn } = await supabaseAdmin
        .from('google_connections')
        .select('refresh_token')
        .eq('user_id', userId)
        .maybeSingle()
      
      if (oldConn?.refresh_token) {
        connectionRecord.refresh_token = oldConn.refresh_token
      } else {
        // We have no refresh token at all! Redirect with warning/error
        console.error('[Google OAuth Callback] No refresh token found in DB or OAuth callback')
        return NextResponse.redirect(`${redirectTarget}&error=consent_required`)
      }
    }

    const { error: dbError } = await supabaseAdmin
      .from('google_connections')
      .upsert(connectionRecord, { onConflict: 'user_id' })

    if (dbError) {
      console.error('[Google OAuth Callback] Database error:', dbError.message)
      return NextResponse.redirect(`${redirectTarget}&error=database_save_failed`)
    }

    // 6. Log activity
    try {
      await supabaseAdmin.from('google_activity_logs').insert({
        user_id: userId,
        user_name: googleEmail || 'Connected User',
        action: 'connected',
        details: `Connected Google account: ${googleEmail}`
      })
    } catch (logErr) {
      // Non-blocking log error
    }

    return NextResponse.redirect(`${redirectTarget}&connected=true`)
  } catch (err: any) {
    console.error('[Google OAuth Callback Exception]', err)
    return NextResponse.redirect(`${redirectTarget}&error=${encodeURIComponent(err.message || 'unknown_error')}`)
  }
}
