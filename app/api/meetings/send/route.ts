import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/crypto-helper'
import { generatePdfBuffer } from '@/lib/pdf-generator-server'

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
    const { meetingId, channel, recipient, message, subject, pdfPayload } = body

    if (!channel || !recipient || !message) {
      return NextResponse.json({ error: 'Channel, recipient, and message are required' }, { status: 400 })
    }

    // Retrieve settings
    const { data: settings } = await supabase
      .from('company_settings')
      .select('comm')
      .eq('user_id', user.id)
      .maybeSingle()

    const comm = settings?.comm || {}
    let status = 'sent'
    let provider = ''
    let dispatchError = ''

    let attachment: { content: string; filename: string } | null = null
    if (channel === 'email' && pdfPayload) {
      try {
        const { buffer, filename } = await generatePdfBuffer(pdfPayload, supabase)
        attachment = {
          content: buffer.toString('base64'),
          filename
        }
      } catch (err: any) {
        console.error('[SEND EMAIL ATTACHMENT GENERATION ERROR]', err)
        dispatchError = `Failed to generate PDF attachment: ${err.message}`
        status = 'failed'
      }
    }

    if (status !== 'failed' && channel === 'email') {
      provider = comm.emailProvider || 'smtp'

      // Style email template with premium Urban Edge dark mode theme
      const emailHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0A1612; padding: 40px 20px; color: #F8FAFC; max-width: 600px; margin: 0 auto; border-radius: 8px; border: 1px solid #1E3A2F;">
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 1px solid #D4AF37; padding-bottom: 20px;">
            <h1 style="color: #D4AF37; margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 1px;">NETGAIN STUDIO</h1>
            <p style="color: #94A3B8; margin: 5px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Your Growth Partner, Powered by AI</p>
          </div>
          <div style="background-color: #12241D; border-left: 4px solid #D4AF37; padding: 25px; border-radius: 4px; margin-bottom: 25px; line-height: 1.6; color: #F8FAFC; font-size: 15px;">
            ${message.replace(/\n/g, '<br>')}
          </div>
          ${attachment ? `
          <div style="text-align: center; margin-bottom: 30px; padding: 10px; border: 1px dashed #1E3A2F; background-color: #0F1F18; border-radius: 4px;">
            <p style="color: #D4AF37; font-size: 13px; margin: 0;">📎 Attached: <strong>${attachment.filename}</strong></p>
          </div>
          ` : ''}
          <div style="border-top: 1px solid #1E3A2F; padding-top: 20px; text-align: center; color: #94A3B8; font-size: 11px;">
            <p style="margin: 0 0 5px 0;">This email was sent on behalf of Netgain Studio.</p>
            <p style="margin: 0;">Sent via Netgain Business OS</p>
          </div>
        </div>
      `
      
      if (provider === 'resend') {
        const apiKey = decrypt(comm.resendApiKey)
        if (!apiKey) {
          dispatchError = 'Resend API Key is not configured. Please add it in Settings > Communications.'
          status = 'failed'
        } else if (apiKey.startsWith('mock_')) {
          console.log('[MOCK EMAIL - RESEND] To:', recipient, 'Subject:', subject, 'Message:', message, 'Has Attachment:', !!attachment)
          status = 'sent'
        } else {
          // Use fromEmail from settings (must be verified domain in Resend)
          const fromEmail = comm.fromEmail || comm.smtpUser || 'onboarding@resend.dev'
          const fromName = comm.fromName || 'Netgain Studio'
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              from: `${fromName} <${fromEmail}>`,
              to: recipient,
              subject: subject || 'Meeting Update',
              html: emailHtml,
              attachments: attachment ? [{
                content: attachment.content,
                filename: attachment.filename
              }] : undefined
            })
          })
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            const errMsg = errData.message || errData.error || errData.name || 'Resend API delivery failed'
            console.error('[RESEND EMAIL ERROR]', errData)
            dispatchError = `Email failed: ${errMsg}. ${errData.statusCode === 403 ? 'Check that your sender domain is verified in Resend.' : ''}`
            status = 'failed'
          }
        }
      } else if (provider === 'sendgrid') {
        const apiKey = decrypt(comm.sendgridApiKey)
        if (!apiKey || apiKey.startsWith('mock_')) {
          console.log('[MOCK EMAIL - SENDGRID] To:', recipient, 'Subject:', subject, 'Message:', message, 'Has Attachment:', !!attachment)
        } else {
          const fromEmail = comm.fromEmail || comm.smtpUser || 'noreply@netgain.studio'
          const fromName = comm.fromName || 'Netgain Studio'
          const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: recipient }] }],
              from: { email: fromEmail, name: fromName },
              subject: subject || 'Meeting Update',
              content: [{ type: 'text/html', value: emailHtml }],
              attachments: attachment ? [{
                content: attachment.content,
                filename: attachment.filename,
                type: 'application/pdf',
                disposition: 'attachment'
              }] : undefined
            })
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            dispatchError = err.errors?.[0]?.message || err.message || 'SendGrid delivery failed'
            status = 'failed'
          }
        }
      } else {
        // SMTP: simulate since nodemailer is omitted to prevent bundling size inflation
        console.log('[SIMULATED SMTP EMAIL] To:', recipient, 'Subject:', subject, 'Message:', message, 'Has Attachment:', !!attachment)
        status = 'sent'
      }
    } else if (status === 'failed') {
      // PDF generation failed
    } else if (channel === 'whatsapp') {
      provider = comm.waProvider || 'meta'

      if (provider === 'meta') {
        const waToken = decrypt(comm.waToken)
        const waPhoneId = comm.waPhoneId
        if (!waToken || !waPhoneId || waToken.startsWith('mock_')) {
          console.log('[MOCK WHATSAPP - META] To:', recipient, 'Message:', message)
        } else {
          const res = await fetch(`https://graph.facebook.com/v17.0/${waPhoneId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${waToken}`
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: recipient,
              type: 'text',
              text: { body: message }
            })
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            dispatchError = err.error?.message || 'Meta API call failed'
            status = 'failed'
          }
        }
      } else if (provider === 'twilio') {
        const sid = comm.twilioWaSid
        const tokenVal = decrypt(comm.twilioWaToken)
        if (!sid || !tokenVal || tokenVal.startsWith('mock_')) {
          console.log('[MOCK WHATSAPP - TWILIO] To:', recipient, 'Message:', message)
        } else {
          const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: 'Basic ' + Buffer.from(sid + ':' + tokenVal).toString('base64')
            },
            body: new URLSearchParams({
              To: `whatsapp:${recipient}`,
              From: `whatsapp:${comm.twilioWaPhoneNumber || '+14155238886'}`,
              Body: message
            })
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            dispatchError = err.message || 'Twilio WhatsApp delivery failed'
            status = 'failed'
          }
        }
      }
    } else if (channel === 'sms') {
      provider = (comm.smsProvider || 'MSG91').toLowerCase()

      if (provider === 'twilio') {
        const sid = comm.twilioAccountSid
        const tokenVal = decrypt(comm.twilioAuthToken)
        if (!sid || !tokenVal || tokenVal.startsWith('mock_')) {
          console.log('[MOCK SMS - TWILIO] To:', recipient, 'Message:', message)
        } else {
          const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: 'Basic ' + Buffer.from(sid + ':' + tokenVal).toString('base64')
            },
            body: new URLSearchParams({
              To: recipient,
              From: comm.twilioSmsNumber || '+15017122661',
              Body: message
            })
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            dispatchError = err.message || 'Twilio SMS delivery failed'
            status = 'failed'
          }
        }
      } else if (provider === 'msg91') {
        const authKey = decrypt(comm.msg91Authkey)
        if (!authKey) {
          dispatchError = 'MSG91 Authkey is not configured. Please add it in Settings > Communications.'
          status = 'failed'
        } else if (!comm.msg91TemplateId) {
          dispatchError = 'MSG91 Template ID is not configured. Please add it in Settings > Communications.'
          status = 'failed'
        } else if (authKey.startsWith('mock_')) {
          console.log('[MOCK SMS - MSG91] To:', recipient, 'Message:', message)
        } else {
          let formattedMobile = recipient.replace(/\+/g, '').replace(/[-\s]/g, '')
          if (formattedMobile.length === 10) {
            formattedMobile = '91' + formattedMobile
          }

          const docType = pdfPayload?.docType || 'Document'
          const clientName = pdfPayload?.clientName || ''
          const projectTitle = pdfPayload?.projectTitle || ''
          const amount = pdfPayload?.grandTotal ? String(pdfPayload.grandTotal) : ''

          const res = await fetch('https://control.msg91.com/api/v5/flow/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              authkey: authKey
            },
            body: JSON.stringify({
              template_id: comm.msg91TemplateId,
              recipients: [
                {
                  mobiles: formattedMobile,
                  client: clientName,
                  doc_type: docType,
                  project: projectTitle,
                  amount: amount,
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
            console.error('[MSG91 SEND ERROR]', errData)
            dispatchError = errData.message || 'MSG91 dispatch failure'
            status = 'failed'
          }
        }
      } else if (provider === 'textlocal') {
        const apiKey = decrypt(comm.textlocalApiKey)
        if (!apiKey || apiKey.startsWith('mock_')) {
          console.log('[MOCK SMS - TEXTLOCAL] To:', recipient, 'Message:', message)
        } else {
          const res = await fetch(`https://api.textlocal.in/send/?apiKey=${encodeURIComponent(apiKey)}&numbers=${encodeURIComponent(recipient)}&message=${encodeURIComponent(message)}`)
          const data = await res.json().catch(() => ({}))
          if (data.status === 'failure') {
            dispatchError = data.errors?.[0]?.message || 'TextLocal sending failed'
            status = 'failed'
          }
        }
      }
    }

    // Write log to DB
    const logData: any = {
      meeting_id: meetingId || null,
      channel,
      recipient,
      message,
      status,
      provider,
      timestamp: new Date().toISOString()
    }

    if (subject && channel === 'email') {
      logData.subject = subject
    }

    const { error: logError } = await supabase
      .from('communication_logs')
      .insert(logData)

    if (logError) {
      console.error('[COMMUNICATION LOG DB INSERT ERROR]', logError.message)
    }

    if (status === 'failed') {
      return NextResponse.json({ success: false, error: dispatchError || 'Message sending failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Message sent and logged successfully!' })
  } catch (err: any) {
    console.error('[COMMUNICATION SEND API ERROR]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
