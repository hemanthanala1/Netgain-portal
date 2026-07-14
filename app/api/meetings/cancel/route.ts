import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt, encrypt } from '@/lib/crypto-helper'

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

    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No meeting IDs provided' }, { status: 400 })
    }

    // Fetch the meetings to check if they have calendar_event_id
    const { data: meetings, error: fetchError } = await supabase
      .from('meetings')
      .select('id, calendar_event_id')
      .in('id', ids)

    if (fetchError) {
      throw fetchError
    }

    const meetingsWithCalendarIds = meetings.filter(m => m.calendar_event_id && !m.calendar_event_id.startsWith('mock_'))
    
    // If there are meetings tied to Google Calendar, retrieve Google credentials
    if (meetingsWithCalendarIds.length > 0) {
      const { data: existingData } = await supabase
        .from('company_settings')
        .select('comm')
        .eq('user_id', user.id)
        .maybeSingle()

      const comm = existingData?.comm || {}
      const encryptedAccessToken = comm.googleAccessToken || ''
      const encryptedRefreshToken = comm.googleRefreshToken || ''

      if (encryptedAccessToken) {
        const accessToken = decrypt(encryptedAccessToken)
        const refreshToken = decrypt(encryptedRefreshToken)
        
        let currentAccessToken = accessToken
        if (refreshToken) {
          try {
            const client_id = process.env.GOOGLE_CLIENT_ID
            const client_secret = process.env.GOOGLE_CLIENT_SECRET
            const res = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                refresh_token: refreshToken,
                client_id: client_id || '',
                client_secret: client_secret || '',
                grant_type: 'refresh_token'
              })
            })
            const data = await res.json()
            if (res.ok && data.access_token) {
              currentAccessToken = data.access_token
              
              // Save new access token back to DB
              const updatedComm = {
                ...comm,
                googleAccessToken: encrypt(currentAccessToken),
                googleTokenExpiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString()
              }
              await supabase
                .from('company_settings')
                .update({ comm: updatedComm })
                .eq('user_id', user.id)
            }
          } catch (err) {
            console.warn('Failed to refresh google token during cancellation:', err)
          }
        }

        // Cancel each Google Calendar event
        for (const meeting of meetingsWithCalendarIds) {
          try {
            const res = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events/${meeting.calendar_event_id}?sendUpdates=all`,
              {
                method: 'DELETE',
                headers: { 
                  'Authorization': `Bearer ${currentAccessToken}`
                }
              }
            )
            // It's okay if it fails (e.g. already deleted), we just log and proceed
            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}))
              console.warn(`Failed to delete event ${meeting.calendar_event_id}:`, errorData)
            }
          } catch (err) {
            console.warn(`Error deleting event ${meeting.calendar_event_id} from Google Calendar:`, err)
          }
        }
      }
    }

    // Now update all requested meetings to 'cancelled' status in Supabase
    const { error: updateError } = await supabase
      .from('meetings')
      .update({ status: 'cancelled' })
      .in('id', ids)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ success: true, count: ids.length })
  } catch (err: any) {
    console.error('Cancel meetings error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
