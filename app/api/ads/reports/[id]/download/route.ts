import { NextRequest, NextResponse } from 'next/server'
import { authenticateClientRequest, authenticateStaffRequest } from '@/lib/ads/server-guard'
import { fetchReportById, recordAdsAudit } from '@/lib/ads/report-store'
import { getReportFileBuffer } from '@/lib/ads/storage'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reportId = params.id
    if (!reportId) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
    }

    const report = await fetchReportById(reportId)
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    let isAuthorized = false
    let downloaderInfo = { id: '', email: '' }

    // 1. Check if request is from Staff
    const { user: staffUser } = await authenticateStaffRequest(request, 'ads')
    if (staffUser) {
      isAuthorized = true
      downloaderInfo = { id: staffUser.id, email: staffUser.email }
    } else {
      // 2. Check if request is from Client
      const { session: clientSession } = await authenticateClientRequest(request)
      if (
        clientSession &&
        clientSession.clientId === report.client_id &&
        report.published_to_client === true
      ) {
        isAuthorized = true
        downloaderInfo = { id: clientSession.clientId, email: clientSession.email }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have permission to download this report.' },
        { status: 403 }
      )
    }

    // Retrieve file buffer from private storage
    const { buffer, error: storageErr } = await getReportFileBuffer(report.storage_path)
    if (storageErr || !buffer) {
      return NextResponse.json(
        { error: 'Could not retrieve file from private storage archive.' },
        { status: 404 }
      )
    }

    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
    await recordAdsAudit(
      'report_downloaded',
      report.id,
      report.client_id,
      { fileName: report.file_name, sizeBytes: buffer.length },
      downloaderInfo,
      clientIp
    )

    // Stream file as binary attachment
    const headers = new Headers()
    headers.set('Content-Type', report.file_mime_type || 'application/octet-stream')
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(report.file_name)}"`)
    headers.set('Content-Length', buffer.length.toString())
    headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate')

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers
    })
  } catch (err: any) {
    console.error('[API Ads Report Download Error]', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to download report' },
      { status: 500 }
    )
  }
}
