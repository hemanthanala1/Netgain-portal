import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { NbosDocument, PdfPayload } from '@/lib/pdf-template'
import path from 'path'
import fs from 'fs'

// ── Load saved company settings ──────────────────────────────────────────
const SETTINGS_PATH = path.join(process.cwd(), '.nbos-settings.json')

function loadSettings(): any {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
    }
  } catch (_) {}
  return {}
}

export async function POST(request: NextRequest) {
  try {
    const payload: PdfPayload = await request.json()

    // Merge saved company settings (settings page values override defaults)
    const saved = loadSettings()
    const company = {
      name:    saved?.company?.name    || 'Netgain Studio',
      email:   saved?.company?.email   || 'mail.netgain@gmail.com',
      phone:   saved?.company?.phone   || '9347102347 | 9392469669',
      website: saved?.company?.website || 'netgain.studio',
      gst:     saved?.company?.gst     || '',
      // Payload companySettings always wins over saved for doc-specific overrides
      ...(payload.companySettings || {}),
    }

    const enriched: PdfPayload = { ...payload, companySettings: company }

    // Render PDF buffer (pure JS, no Python)
    const buffer = await renderToBuffer(React.createElement(NbosDocument, { data: enriched }) as any)

    const docType = payload.docType || 'Document'
    const clientSlug = (payload.clientName || 'client').replace(/\s+/g, '_')
    const filename = `${docType}_${clientSlug}_${Date.now()}.pdf`

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err: any) {
    console.error('[PDF API]', err)
    return NextResponse.json(
      { error: err?.message || 'PDF generation failed' },
      { status: 500 }
    )
  }
}
