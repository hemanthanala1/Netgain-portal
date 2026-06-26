import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/crypto-helper'

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`
}
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

// Direct lightweight sender helper inside the cron to dispatch communications
async function dispatchMessage(supabaseClient: any, meeting: any, channel: 'email' | 'whatsapp' | 'sms', recipient: string, subject: string, message: string, commSettings: any) {
  let status = 'sent'
  let provider = ''
  let dispatchError = ''

  try {
    if (channel === 'email') {
      provider = commSettings.emailProvider || 'smtp'
      if (provider === 'resend') {
        const apiKey = decrypt(commSettings.resendApiKey)
        if (!apiKey || apiKey.startsWith('mock_')) {
          console.log('[CRON MOCK EMAIL - RESEND] To:', recipient, 'Subject:', subject)
        } else {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              from: commSettings.smtpUser || 'info@netgain.studio',
              to: recipient,
              subject,
              html: `<p>${message.replace(/\n/g, '<br>')}</p>`
            })
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            dispatchError = err.message || 'Resend failure'
            status = 'failed'
          }
        }
      } else if (provider === 'sendgrid') {
        const apiKey = decrypt(commSettings.sendgridApiKey)
        if (!apiKey || apiKey.startsWith('mock_')) {
          console.log('[CRON MOCK EMAIL - SENDGRID] To:', recipient, 'Subject:', subject)
        } else {
          const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: recipient }] }],
              from: { email: commSettings.smtpUser || 'info@netgain.studio' },
              subject,
              content: [{ type: 'text/html', value: `<p>${message.replace(/\n/g, '<br>')}</p>` }]
            })
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            dispatchError = err.message || 'SendGrid failure'
            status = 'failed'
          }
        }
      } else {
        console.log('[CRON SIMULATED SMTP EMAIL] To:', recipient, 'Subject:', subject)
      }
    } else if (channel === 'whatsapp') {
      provider = commSettings.waProvider || 'meta'
      if (provider === 'meta') {
        const waToken = decrypt(commSettings.waToken)
        const waPhoneId = commSettings.waPhoneId
        if (!waToken || !waPhoneId || waToken.startsWith('mock_')) {
          console.log('[CRON MOCK WHATSAPP - META] To:', recipient)
        } else {
          const res = await fetch(`https://graph.facebook.com/v17.0/${waPhoneId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: recipient,
              type: 'text',
              text: { body: message }
            })
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            dispatchError = err.error?.message || 'Meta failure'
            status = 'failed'
          }
        }
      }
    } else if (channel === 'sms') {
      provider = (commSettings.smsProvider || 'MSG91').toLowerCase()
      if (provider === 'twilio') {
        const sid = commSettings.twilioAccountSid
        const tokenVal = decrypt(commSettings.twilioAuthToken)
        if (!sid || !tokenVal || tokenVal.startsWith('mock_')) {
          console.log('[CRON MOCK SMS - TWILIO] To:', recipient)
        } else {
          const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: 'Basic ' + Buffer.from(sid + ':' + tokenVal).toString('base64')
            },
            body: new URLSearchParams({
              To: recipient,
              From: commSettings.twilioSmsNumber || '+15017122661',
              Body: message
            })
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            dispatchError = err.message || 'Twilio SMS failure'
            status = 'failed'
          }
        }
      } else if (provider === 'msg91') {
        const authKey = decrypt(commSettings.msg91Authkey)
        if (!authKey) {
          dispatchError = 'MSG91 Authkey is not configured. Please add it in Settings > Communications.'
          status = 'failed'
        } else if (!commSettings.msg91TemplateId) {
          dispatchError = 'MSG91 Template ID is not configured. Please add it in Settings > Communications.'
          status = 'failed'
        } else if (authKey.startsWith('mock_')) {
          console.log('[CRON MOCK SMS - MSG91] To:', recipient, 'Message:', message)
        } else {
          let formattedMobile = recipient.replace(/\+/g, '').replace(/[-\s]/g, '')
          if (formattedMobile.length === 10) {
            formattedMobile = '91' + formattedMobile
          }

          const res = await fetch('https://control.msg91.com/api/v5/flow/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              authkey: authKey
            },
            body: JSON.stringify({
              template_id: commSettings.msg91TemplateId,
              recipients: [
                {
                  mobiles: formattedMobile,
                  message: message,
                  msg: message,
                  var: message,
                  otp: message
                }
              ]
            })
          })
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            dispatchError = errData.message || 'MSG91 dispatch failure'
            status = 'failed'
          }
        }
      }
    }

    // Write log to DB
    const logData: any = {
      meeting_id: meeting.id,
      channel,
      recipient,
      message,
      status,
      provider,
      timestamp: new Date().toISOString()
    }
    if (channel === 'email') logData.subject = subject

    await supabaseClient.from('communication_logs').insert(logData)
    return { success: status === 'sent', error: dispatchError }
  } catch (err: any) {
    console.error('[CRON DISPATCH ERROR]', err)
    return { success: false, error: err.message }
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase database client not configured' }, { status: 500 })
    }

    // Load all company settings containing comms config (to retrieve credentials)
    // For automated background cron, we fetch settings using service role key
    const { data: allSettings, error: settingsError } = await supabase
      .from('company_settings')
      .select('*')
    
    if (settingsError || !allSettings || allSettings.length === 0) {
      return NextResponse.json({ error: 'No company settings configured' }, { status: 400 })
    }

    // We take the first settings configuration for credentials context
    const config = allSettings[0]
    const commSettings = config.comm || {}

    // Fetch all active/upcoming meetings within timeframe
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('*')
      .in('status', ['upcoming', 'rescheduled', 'completed'])

    if (meetingsError || !meetings) {
      return NextResponse.json({ error: meetingsError?.message || 'No meetings found' }, { status: 400 })
    }

    const now = new Date()
    const nowTime = now.getTime()
    let processedCount = 0

    for (const meeting of meetings) {
      const meetingDateTime = new Date(`${meeting.meeting_date}T${meeting.meeting_time}`)
      const meetingTimeMs = meetingDateTime.getTime()
      const timeDiffMs = meetingTimeMs - nowTime
      const hoursDiff = timeDiffMs / (1000 * 3600)

      // Fetch existing communications sent for this meeting
      const { data: sentLogs } = await supabase
        .from('communication_logs')
        .select('message')
        .eq('meeting_id', meeting.id)

      const loggedMessages = sentLogs?.map(l => l.message.toLowerCase()) || []

      // Helper to check if a reminder was already dispatched
      const hasSent24h = loggedMessages.some(m => m.includes('24-hour reminder') || m.includes('scheduled for tomorrow'))
      const hasSent1h = loggedMessages.some(m => m.includes('starts in 1 hour') || m.includes('meeting starts soon'))
      const hasSentFollowUp = loggedMessages.some(m => m.includes('thank you for meeting') || m.includes('discussion follow-up'))

      // 1. 24-Hour Reminder: Meeting is starting in 23 to 25 hours
      if (hoursDiff > 23 && hoursDiff <= 25 && !hasSent24h && meeting.status !== 'completed') {
        const subject = `Reminder: Meeting Tomorrow - ${meeting.event_type}`
        const msg = `Hi ${meeting.client_name},\n\nThis is a 24-hour reminder that we have a meeting scheduled for tomorrow, ${meeting.meeting_date} at ${meeting.meeting_time.slice(0, 5)} for "${meeting.event_type}".\n\nLet us know if you need to reschedule. Looking forward to speaking!\n\nBest,\nNetgain Team`
        
        // Dispatch email
        await dispatchMessage(supabase, meeting, 'email', meeting.client_email, subject, msg, commSettings)
        processedCount++
      }

      // 2. 1-Hour Reminder: Meeting is starting in 45 minutes to 75 minutes
      if (hoursDiff > 0.75 && hoursDiff <= 1.25 && !hasSent1h && meeting.status !== 'completed') {
        const subject = `Starts in 1 Hour: ${meeting.event_type}`
        const msg = `Hi ${meeting.client_name},\n\nOur meeting "${meeting.event_type}" starts in 1 hour at ${meeting.meeting_time.slice(0, 5)}.\n\n${meeting.meet_link ? 'Join link: ' + meeting.meet_link : 'We will connect shortly.'}\n\nSee you soon!\n\nNetgain Team`
        
        // Dispatch email
        await dispatchMessage(supabase, meeting, 'email', meeting.client_email, subject, msg, commSettings)
        
        // Also dispatch SMS/WhatsApp if client_phone is configured
        if (meeting.client_phone) {
          const smsMsg = `Hi ${meeting.client_name}, our meeting starts in 1 hour at ${meeting.meeting_time.slice(0, 5)}.${meeting.meet_link ? ' Join Meet: ' + meeting.meet_link : ''} - Netgain Team`
          await dispatchMessage(supabase, meeting, 'sms', meeting.client_phone, '', smsMsg, commSettings)
        }
        processedCount++
      }

      // 3. Completed Follow-up: Meeting was completed, time diff is negative (passed) and not flagged
      if (meeting.status === 'completed' && hoursDiff < 0 && hoursDiff >= -4 && !hasSentFollowUp) {
        const subject = `Thank you for your time: ${meeting.event_type}`
        const msg = `Hi ${meeting.client_name},\n\nThank you for meeting with us today for the "${meeting.event_type}".\n\nIf you have any questions or require further details, feel free to reply directly to this email.\n\nWarm regards,\nNetgain Team`
        
        await dispatchMessage(supabase, meeting, 'email', meeting.client_email, subject, msg, commSettings)
        processedCount++
      }
    }

    return NextResponse.json({ success: true, processed: processedCount })
  } catch (err: any) {
    console.error('[CRON API ERROR]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
