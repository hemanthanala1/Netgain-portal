import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt, encrypt } from '@/lib/crypto-helper'
import crypto from 'crypto'

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
    const { newMeeting, generateMeetLink } = body

    if (!newMeeting || !newMeeting.client_name || !newMeeting.client_email || !newMeeting.meeting_date || !newMeeting.meeting_time) {
      return NextResponse.json({ error: 'Missing required meeting details' }, { status: 400 })
    }

    let hangoutLink = newMeeting.meet_link || ''
    let calendarEventId = ''
    let timezone = 'UTC'

    if (generateMeetLink) {
      // Retrieve google credentials
      const { data: existingData } = await supabase
        .from('company_settings')
        .select('comm')
        .eq('user_id', user.id)
        .maybeSingle()

      const comm = existingData?.comm || {}
      const encryptedAccessToken = comm.googleAccessToken || ''
      const encryptedRefreshToken = comm.googleRefreshToken || ''

      if (!encryptedAccessToken) {
        return NextResponse.json({ error: 'Google Calendar not connected. Please connect it in settings.' }, { status: 400 })
      }

      const accessToken = decrypt(encryptedAccessToken)
      const refreshToken = decrypt(encryptedRefreshToken)

      const isMock = accessToken.startsWith('mock_') || refreshToken.startsWith('mock_') || !process.env.GOOGLE_CLIENT_ID

      if (isMock) {
        hangoutLink = 'https://meet.google.com/mock-meet-link'
        calendarEventId = `mock_event_${Date.now()}`
      } else {
        // Real Flow: Refresh access token if possible
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
            console.warn('Failed to refresh google token, attempting sync with current token:', err)
          }
        }

        const startDateTime = new Date(`${newMeeting.meeting_date}T${newMeeting.meeting_time}:00`)
        const endDateTime = new Date(startDateTime.getTime() + (newMeeting.meeting_duration || 30) * 60000)

        // Use timezone from request or fallback to UTC
        timezone = newMeeting.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

        const eventPayload = {
          summary: newMeeting.event_type || 'Meeting',
          description: [
            `Meeting with ${newMeeting.client_name}`,
            newMeeting.notes ? `\nAgenda:\n${newMeeting.notes}` : ''
          ].filter(Boolean).join('\n'),
          start: {
            dateTime: startDateTime.toISOString(),
            timeZone: timezone,
          },
          end: {
            dateTime: endDateTime.toISOString(),
            timeZone: timezone,
          },
          attendees: [
            { email: newMeeting.client_email }
          ],
          conferenceData: {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: 'hangoutsMeet' }
            }
          }
        }

        const meetRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1`,
          {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${currentAccessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventPayload)
          }
        )

        const meetData = await meetRes.json()

        if (!meetRes.ok) {
          throw new Error(meetData.error?.message || 'Google API meeting creation failed')
        }

        hangoutLink = meetData.hangoutLink || hangoutLink
        calendarEventId = meetData.id || calendarEventId
      }
    }

    const meetingData = {
      ...newMeeting,
      status: 'upcoming',
      meet_link: hangoutLink,
      calendar_event_id: calendarEventId || null,
      timezone: timezone,
    }

    const { data, error } = await supabase
      .from('meetings')
      .insert([meetingData])
      .select('*')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, meeting: data })
  } catch (err: any) {
    console.error('Create meeting error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
