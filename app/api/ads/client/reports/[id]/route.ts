import { NextRequest, NextResponse } from 'next/server'
import { authenticateClientRequest } from '@/lib/ads/server-guard'
import { fetchReportById, recordAdsAudit } from '@/lib/ads/report-store'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { session, errorResponse } = await authenticateClientRequest(request)
    if (errorResponse) return errorResponse
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Invalid client session' }, { status: 401 })
    }

    const reportId = params.id
    if (!reportId) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
    }

    const report = await fetchReportById(reportId, true)
    if (!report || report.client_id !== session.clientId) {
      return NextResponse.json(
        { error: 'Report not found or not published to your account' },
        { status: 404 }
      )
    }

    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
    await recordAdsAudit(
      'report_viewed',
      report.id,
      report.client_id,
      { reportName: report.report_name },
      { id: session.clientId, email: session.email },
      clientIp
    )

    // Return report with parsed data for interactive dashboard rendering
    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        report_name: report.report_name,
        platform: report.platform,
        period_start: report.period_start,
        period_end: report.period_end,
        published_at: report.published_at,
        file_name: report.file_name,
        file_size_bytes: report.file_size_bytes,
        currency: report.currency,
        summary_metrics: report.summary_metrics,
        dimensions: report.dimensions,
        parsed_data: report.parsed_data,
        created_at: report.created_at
      }
    })
  } catch (err: any) {
    console.error('[API Client Ads Report Detail Error]', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch report detail' },
      { status: 500 }
    )
  }
}
