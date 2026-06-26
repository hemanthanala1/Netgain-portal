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
    const body = await request.json()
    console.log('[CAL.COM WEBHOOK RECEIVED]', JSON.stringify(body, null, 2))

    if (!supabase) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 })
    }

    const { triggerEvent, payload } = body
    if (!payload) {
      return NextResponse.json({ error: 'Payload is missing' }, { status: 400 })
    }

    const uid = payload.uid || payload.bookingId
    if (!uid) {
      return NextResponse.json({ error: 'Booking UID is missing' }, { status: 400 })
    }

    // Resolve client details
    const attendee = payload.attendees?.[0] || {}
    const responses = payload.responses || {}
    const clientName = attendee.name || responses.name?.value || responses.name || payload.clientName || 'Cal.com Client'
    const clientEmail = attendee.email || responses.email?.value || responses.email || payload.clientEmail || 'guest@example.com'
    const clientPhone = attendee.phoneNumber || responses.phone?.value || responses.phone || payload.clientPhone || ''

    // Resolve timing details
    const startTime = payload.startTime || payload.start || ''
    if (!startTime) {
      return NextResponse.json({ error: 'Start time is missing' }, { status: 400 })
    }
    const startDateObj = new Date(startTime)
    let dateStr = ''
    let timeStr = '00:00:00'

    if (startTime.includes('T')) {
      const eventTimezone = payload.timezone || attendee.timeZone || 'Asia/Kolkata'
      dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: eventTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(startDateObj)
      timeStr = new Intl.DateTimeFormat('en-GB', { timeZone: eventTimezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(startDateObj)
    } else {
      dateStr = startTime
    }

    // Duration in minutes
    let duration = Number(payload.length)
    if (!duration && payload.endTime) {
      const endTimeObj = new Date(payload.endTime)
      duration = Math.round((endTimeObj.getTime() - startDateObj.getTime()) / (1000 * 60))
    }
    if (!duration) duration = 30 // Fallback

    // Resolve meet link
    const meetLink = payload.metadata?.videoCallUrl || payload.videoCallUrl || payload.location || ''

    // Resolve status based on trigger event
    let status = 'upcoming'
    if (triggerEvent === 'BOOKING_CANCELLED') {
      status = 'cancelled'
    } else if (triggerEvent === 'BOOKING_RESCHEDULED') {
      status = 'rescheduled'
    } else if (triggerEvent === 'BOOKING_COMPLETED') {
      status = 'completed'
    }

    // Try to find an existing meeting to merge and avoid duplicates
    let existingMeeting = null
    let duplicateIdToDelete = null

    const { data: byBookingUid } = await supabase
      .from('meetings')
      .select('id, calendar_event_id, client_phone')
      .eq('cal_booking_uid', uid)
      .maybeSingle()

    const { data: byEmailAndTime } = await supabase
      .from('meetings')
      .select('id, calendar_event_id, client_phone')
      .eq('client_email', clientEmail)
      .eq('meeting_date', dateStr)
      .eq('meeting_time', timeStr)
      .maybeSingle()

    if (byBookingUid && byEmailAndTime) {
      if (byBookingUid.id === byEmailAndTime.id) {
        existingMeeting = byBookingUid
      } else {
        // Different rows! This is a duplicate.
        // We prefer the one that already has a calendar_event_id (so we retain the link to Google Calendar),
        // or we default to byBookingUid.
        if (byEmailAndTime.calendar_event_id) {
          existingMeeting = byEmailAndTime
          duplicateIdToDelete = byBookingUid.id
        } else {
          existingMeeting = byBookingUid
          duplicateIdToDelete = byEmailAndTime.id
        }
      }
    } else if (byBookingUid) {
      existingMeeting = byBookingUid
    } else if (byEmailAndTime) {
      existingMeeting = byEmailAndTime
    }

    if (duplicateIdToDelete && existingMeeting) {
      // Move any communication logs to the one we keep
      await supabase
        .from('communication_logs')
        .update({ meeting_id: existingMeeting.id })
        .eq('meeting_id', duplicateIdToDelete)

      // Delete the duplicate row
      await supabase
        .from('meetings')
        .delete()
        .eq('id', duplicateIdToDelete)
    }

    let mergedCalendarEventId = ''
    let mergedClientPhone = clientPhone

    if (byBookingUid && byEmailAndTime) {
      mergedCalendarEventId = byBookingUid.calendar_event_id || byEmailAndTime.calendar_event_id || ''
      mergedClientPhone = clientPhone || byBookingUid.client_phone || byEmailAndTime.client_phone || ''
    } else if (existingMeeting) {
      mergedCalendarEventId = existingMeeting.calendar_event_id || ''
      mergedClientPhone = clientPhone || existingMeeting.client_phone || ''
    }

    const meetingData: any = {
      cal_booking_uid: uid,
      event_type: payload.title || payload.eventTitle || 'Cal.com Booking',
      client_name: clientName,
      client_email: clientEmail,
      client_phone: mergedClientPhone,
      meeting_date: dateStr,
      meeting_time: timeStr,
      meeting_duration: duration,
      status,
      meet_link: meetLink,
      timezone: payload.timezone || attendee.timeZone || 'UTC',
      notes: payload.description || responses.notes?.value || responses.notes || '',
      updated_at: new Date().toISOString()
    }

    if (existingMeeting) {
      meetingData.id = existingMeeting.id
    }
    if (mergedCalendarEventId) {
      meetingData.calendar_event_id = mergedCalendarEventId
    }

    const { data, error } = await supabase
      .from('meetings')
      .upsert(meetingData, { onConflict: 'id' })
      .select()

    if (error) {
      console.error('[CAL.COM WEBHOOK UPSERT ERROR]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, meeting: data?.[0] })
  } catch (err: any) {
    console.error('[CAL.COM WEBHOOK ROUTE ERROR]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
