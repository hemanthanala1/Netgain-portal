import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import { buildPdfPayload } from '@/lib/pdf-payload-builder'
import { generatePdfBuffer } from '@/lib/pdf-generator-server'

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    let id = searchParams.get('id')
    let type = searchParams.get('type') // Quotation, SOW, Agreement, PRD, Marketing, Proposal, Contract

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
    }

    // 1. If token is provided, resolve document ID and Type
    if (token) {
      const { data: tokenRecord, error: tokenError } = await supabase
        .from('document_tokens')
        .select('*')
        .eq('token', token)
        .maybeSingle()

      if (tokenError || !tokenRecord) {
        return NextResponse.json({ error: 'Invalid or expired secure token' }, { status: 404 })
      }

      if (tokenRecord.status === 'cancelled') {
        return NextResponse.json({ error: 'This signing link has been cancelled' }, { status: 410 })
      }

      // Note: 'used' tokens are allowed here — the signed PDF must still be downloadable after signing

      if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
        return NextResponse.json({ error: 'This signing link has expired' }, { status: 410 })
      }

      id = tokenRecord.document_id
      type = tokenRecord.document_type
    }

    if (!id || !type) {
      return NextResponse.json({ error: 'Missing document parameters' }, { status: 400 })
    }

    // 2. Fetch the raw document record
    const tableName = TABLE_MAP[type]
    if (!tableName) {
      return NextResponse.json({ error: `Unsupported document type: ${type}` }, { status: 400 })
    }

    const { data: docRecord, error: docError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (docError || !docRecord) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // 3. Compile the PDF payload
    const payload = await buildPdfPayload(type, docRecord, supabase)

    // 4. Generate the PDF buffer
    const { buffer, filename } = await generatePdfBuffer(payload, supabase)

    // 5. Stream the PDF inline for iframe previewing or download
    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err: any) {
    console.error('[DOCUMENT PDF API]', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to retrieve and generate document PDF' },
      { status: 500 }
    )
  }
}
