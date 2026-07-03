import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`
}
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

const TABLE_MAP: Record<string, string> = {
  Quotation: 'quotations',
  Invoice: 'invoices',
  SOW: 'sows',
  Agreement: 'agreements',
  PRD: 'prds',
  Marketing: 'marketing_reports',
  Proposal: 'proposals',
  Contract: 'contracts'
}

function parseUserAgent(ua: string) {
  let browser = 'Unknown Browser'
  let os = 'Unknown OS'
  let device = 'Desktop'

  // Browser detection
  if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Chrome') && !ua.includes('Chromium')) browser = 'Chrome'
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
  else if (ua.includes('Edge')) browser = 'Edge'
  else if (ua.includes('MSIE') || ua.includes('Trident/')) browser = 'Internet Explorer'

  // OS detection
  if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
  else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'

  // Device detection
  if (ua.includes('Mobi') || ua.includes('Android') || ua.includes('iPhone')) device = 'Mobile'
  else if (ua.includes('iPad') || ua.includes('Tablet')) device = 'Tablet'

  return { browser, os, device }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      token,
      clientName,
      company,
      email,
      phone,
      signatureType,
      signatureImage,
      signatureText,
      signatureFont,
      agreementAccepted
    } = body

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
    }

    if (!token || !clientName || !email || !signatureType || !agreementAccepted) {
      return NextResponse.json({ error: 'Missing required signature parameters' }, { status: 400 })
    }

    // 1. Resolve token
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('document_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    if (tokenError || !tokenRecord) {
      return NextResponse.json({ error: 'Invalid or expired secure token' }, { status: 404 })
    }

    if (tokenRecord.status !== 'active') {
      return NextResponse.json({ error: 'This signing link is no longer active' }, { status: 400 })
    }

    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This signing link has expired' }, { status: 410 })
    }

    const { document_id: docId, document_type: docType } = tokenRecord
    const tableName = TABLE_MAP[docType]

    if (!tableName) {
      return NextResponse.json({ error: `Unsupported document type: ${docType}` }, { status: 400 })
    }

    // 2. Fetch the raw document record
    const { data: docRecord, error: docError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', docId)
      .maybeSingle()

    if (docError || !docRecord) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (docRecord.is_locked) {
      return NextResponse.json({ error: 'This document is locked and already signed' }, { status: 400 })
    }

    // 3. Gather client details and fingerprint
    const ip = request.headers.get('x-forwarded-for') || request.ip || '127.0.0.1'
    const userAgentStr = request.headers.get('user-agent') || ''
    const { browser, os, device } = parseUserAgent(userAgentStr)

    // Generate unique verification ID
    const randomBytes = crypto.randomBytes(6).toString('hex').toUpperCase()
    const verificationId = `CERT-${randomBytes.slice(0, 4)}-${randomBytes.slice(4, 8)}-${randomBytes.slice(8, 12)}`

    // Generate hash of current document record
    const docString = JSON.stringify(docRecord)
    const documentHash = crypto.createHash('sha256').update(docString).digest('hex')

    const currentVersion = docRecord.version || 1

    // 4. Save signature details in `document_signatures`
    let sigError: any = null
    try {
      const { error } = await supabase
        .from('document_signatures')
        .insert({
          document_type: docType,
          document_id: docId,
          client_name: clientName,
          company: company || null,
          email: email,
          phone: phone || null,
          signature_type: signatureType,
          signature_image: signatureImage || null,
          signature_text: signatureText || null,
          signature_font: signatureFont || 'DancingScript',
          browser,
          operating_system: os,
          device_type: device,
          ip_address: ip,
          document_version: currentVersion,
          created_by: tokenRecord.created_by,
          document_hash: documentHash,
          agreement_accepted: agreementAccepted,
          verification_id: verificationId
        })
      sigError = error
    } catch (e: any) {
      sigError = e
    }

    // Fallback if 'signature_font' column is missing in the database schema cache
    if (sigError && (sigError.message?.includes("signature_font") || sigError.message?.includes("column"))) {
      console.warn("signature_font column missing in document_signatures table, retrying insert without it")
      const { error: fallbackError } = await supabase
        .from('document_signatures')
        .insert({
          document_type: docType,
          document_id: docId,
          client_name: clientName,
          company: company || null,
          email: email,
          phone: phone || null,
          signature_type: signatureType,
          signature_image: signatureImage || null,
          signature_text: signatureText || null,
          browser,
          operating_system: os,
          device_type: device,
          ip_address: ip,
          document_version: currentVersion,
          created_by: tokenRecord.created_by,
          document_hash: documentHash,
          agreement_accepted: agreementAccepted,
          verification_id: verificationId
        })
      sigError = fallbackError
    }

    if (sigError) {
      throw new Error(`Failed to store signature: ${sigError.message}`)
    }

    // 5. Update timeline with viewed and signed events
    const timelineEntries = [
      {
        document_type: docType,
        document_id: docId,
        event: 'viewed',
        user_name: clientName,
        notes: `Client viewed the document from IP: ${ip} (${browser} on ${os})`
      },
      {
        document_type: docType,
        document_id: docId,
        event: 'signed',
        user_name: clientName,
        notes: `Client e-signed using ${signatureType === 'drawn' ? 'Drawn Signature' : 'Typed Signature'} (${browser} on ${os})`
      },
      {
        document_type: docType,
        document_id: docId,
        event: 'completed',
        user_name: 'System',
        notes: `Document workflow completed. Verification ID: ${verificationId}`
      }
    ]

    const { error: timelineError } = await supabase
      .from('document_timeline')
      .insert(timelineEntries)

    if (timelineError) {
      console.error('Failed to log to timeline:', timelineError.message)
    }

    // 6. Save current document state in `document_versions`
    const { error: verError } = await supabase
      .from('document_versions')
      .insert({
        document_type: docType,
        document_id: docId,
        version: currentVersion,
        document_data: docRecord,
        created_by: tokenRecord.created_by
      })

    if (verError) {
      console.error('Failed to backup version details:', verError.message)
    }

    // 7. Update status and lock the document
    const updatedHistory = [
      ...(docRecord.history || []),
      { date: new Date().toISOString().split('T')[0], action: `Client signed via Netgain E-Sign (${verificationId})` },
      { date: new Date().toISOString().split('T')[0], action: 'Status changed to completed' }
    ]

    const { error: updateDocError } = await supabase
      .from(tableName)
      .update({
        status: 'completed',
        is_locked: true,
        history: updatedHistory
      })
      .eq('id', docId)

    if (updateDocError) {
      throw new Error(`Failed to update document status: ${updateDocError.message}`)
    }

    // 8. Invalidate / mark the signing token as used
    await supabase
      .from('document_tokens')
      .update({ status: 'used' })
      .eq('token', token)

    return NextResponse.json({
      success: true,
      verificationId,
      signedAt: new Date().toISOString(),
      browser,
      os,
      ip
    })
  } catch (err: any) {
    console.error('[SIGN DOCUMENT API]', err)
    return NextResponse.json(
      { error: err?.message || 'E-signature processing failed' },
      { status: 500 }
    )
  }
}
