import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt, encrypt } from '@/lib/crypto-helper'

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`
}
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

// Mock meetings data
const MOCK_EVENTS = [
  {
    calendar_event_id: 'gcal_event_1',
    event_type: 'Discovery Call',
    client_name: 'Jane Cooper',
    client_email: 'jane.cooper@example.com',
    client_phone: '+1 (555) 234-5678',
    meeting_date: new Date(Date.now() + 1 * 24 * 3600 * 1000).toISOString().split('T')[0], // Tomorrow
    meeting_time: '10:00:00',
    meeting_duration: 30,
    status: 'upcoming',
    meet_link: 'https://meet.google.com/abc-defg-hij',
    timezone: 'Asia/Kolkata',
    notes: 'Initial discovery call to understand their custom software requirements and timeline.'
  },
  {
    calendar_event_id: 'gcal_event_2',
    event_type: 'Project Kickoff',
    client_name: 'Alex Rivera',
    client_email: 'alex.rivera@designco.com',
    client_phone: '+1 (555) 987-6543',
    meeting_date: new Date().toISOString().split('T')[0], // Today
    meeting_time: '14:30:00',
    meeting_duration: 45,
    status: 'upcoming',
    meet_link: 'https://meet.google.com/klm-nopq-rst',
    timezone: 'Asia/Kolkata',
    notes: 'Kickoff meeting for the new ERP Design system project. Walkthrough wireframes.'
  },
  {
    calendar_event_id: 'gcal_event_3',
    event_type: 'Agreement Review',
    client_name: 'Sarah Jenkins',
    client_email: 'sjenkins@techcorp.io',
    client_phone: '+91 98765 43210',
    meeting_date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().split('T')[0], // 2 days ago
    meeting_time: '11:00:00',
    meeting_duration: 60,
    status: 'completed',
    meet_link: 'https://meet.google.com/uvw-xyz1-234',
    timezone: 'Asia/Kolkata',
    notes: 'Review contract terms, payment schedules, and SOW clauses.'
  },
  {
    calendar_event_id: 'gcal_event_4',
    event_type: 'Sales Proposal',
    client_name: 'Marcus Brody',
    client_email: 'mbrody@museum.org',
    client_phone: '',
    meeting_date: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().split('T')[0], // 5 days from now
    meeting_time: '16:00:00',
    meeting_duration: 30,
    status: 'rescheduled',
    meet_link: 'https://meet.google.com/aaa-bbbb-ccc',
    timezone: 'Asia/Kolkata',
    notes: 'Presenting the custom CRM proposal and retainer pricing.'
  }
]

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
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 })
    }

    const accessToken = decrypt(encryptedAccessToken)
    const refreshToken = decrypt(encryptedRefreshToken)

    const isMock = accessToken.startsWith('mock_') || refreshToken.startsWith('mock_') || !process.env.GOOGLE_CLIENT_ID

    if (isMock) {
      console.log('[MOCK SYNC] Seeding mock meetings into Database...')
      // Upsert mock meetings into database
      for (const event of MOCK_EVENTS) {
        const { error } = await supabase
          .from('meetings')
          .upsert(event, { onConflict: 'calendar_event_id' })
        
        if (error) {
          console.error('[MOCK SYNC] Upsert failed for event', event.calendar_event_id, error.message)
        }
      }

      return NextResponse.json({ success: true, count: MOCK_EVENTS.length, source: 'mock' })
    }

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

    // Fetch primary calendar events from Google API (last 30 days and next 60 days)
    const timeMin = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    const timeMax = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString()

    const eventsRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`,
      {
        headers: { Authorization: `Bearer ${currentAccessToken}` }
      }
    )

    if (!eventsRes.ok) {
      const err = await eventsRes.json().catch(() => ({}))
      throw new Error(err.error?.message || 'Google API fetch failed')
    }

    const eventsData = await eventsRes.json()
    const items = eventsData.items || []
    let syncCount = 0

    for (const item of items) {
      // Map attendees to find the first client (non-organizer/guest)
      const attendees = item.attendees || []
      const client = attendees.find((a: any) => !a.organizer) || attendees[0] || {}
      
      const start = item.start?.dateTime || item.start?.date || ''
      if (!start) continue

      const startDate = new Date(start)
      const endDate = item.end?.dateTime || item.end?.date ? new Date(item.end.dateTime || item.end.date) : startDate
      const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60)) || 30

      const dateStr = start.split('T')[0]
      const timeStr = start.includes('T') ? start.split('T')[1].slice(0, 8) : '00:00:00'

      // Clean/determine status
      let status = 'upcoming'
      if (item.status === 'cancelled') {
        status = 'cancelled'
      } else if (new Date().getTime() > endDate.getTime()) {
        status = 'completed'
      }

      const meetingData = {
        calendar_event_id: item.id,
        event_type: item.summary || 'Google Meet',
        client_name: client.displayName || client.email?.split('@')[0] || 'Google Calendar Guest',
        client_email: client.email || 'guest@example.com',
        client_phone: '',
        meeting_date: dateStr,
        meeting_time: timeStr,
        meeting_duration: durationMinutes,
        status,
        meet_link: item.hangoutLink || item.location || '',
        timezone: item.start?.timeZone || 'UTC',
        notes: item.description || ''
      }

      const { error } = await supabase
        .from('meetings')
        .upsert(meetingData, { onConflict: 'calendar_event_id' })

      if (!error) syncCount++
    }

    return NextResponse.json({ success: true, count: syncCount, source: 'google' })
  } catch (err: any) {
    console.error('Google Calendar sync error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
