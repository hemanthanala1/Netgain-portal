import { NextRequest, NextResponse } from 'next/server'
import { authenticateClientRequest } from '@/lib/ads/server-guard'
import { fetchReportsList } from '@/lib/ads/report-store'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { session, errorResponse } = await authenticateClientRequest(request)
    if (errorResponse) return errorResponse
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Invalid client session' }, { status: 401 })
    }

    // Multi-tenant isolation: enforce authenticated client ID strictly derived server-side
    const reports = await fetchReportsList({
      clientId: session.clientId,
      publishedOnly: true
    })

    // Sanitize reports for client viewing: strip any internal server fields
    const clientSafeReports = reports.map((r) => ({
      id: r.id,
      report_name: r.report_name,
      platform: r.platform,
      period_start: r.period_start,
      period_end: r.period_end,
      published_at: r.published_at,
      file_name: r.file_name,
      file_size_bytes: r.file_size_bytes,
      currency: r.currency,
      summary_metrics: r.summary_metrics,
      dimensions: r.dimensions,
      created_at: r.created_at
    }))

    return NextResponse.json({
      success: true,
      reports: clientSafeReports
    })
  } catch (err: any) {
    console.error('[API Client Ads Reports GET Error]', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch client reports.' },
      { status: 500 }
    )
  }
}
