import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { generatePdfBuffer } from '@/lib/pdf-generator-server'
import { createClient } from '@supabase/supabase-js'
import { PdfPayload } from '@/lib/pdf-template'

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`
}
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

export async function POST(request: NextRequest) {
  try {
    const payload: PdfPayload = await request.json()

    const { buffer, filename } = await generatePdfBuffer(payload, supabase)

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
