import { NextRequest, NextResponse } from 'next/server'
import { authenticateStaffRequest } from '@/lib/ads/server-guard'
import { fetchReportsList } from '@/lib/ads/report-store'
import type { ReportStatus } from '@/lib/ads/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { user, errorResponse } = await authenticateStaffRequest(request, 'ads')
    if (errorResponse) return errorResponse

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId') || undefined
    const status = (searchParams.get('status') as ReportStatus) || undefined
    const platform = searchParams.get('platform') || undefined
    const search = searchParams.get('search') || undefined

    const reports = await fetchReportsList({
      clientId,
      status,
      platform,
      search
    })

    return NextResponse.json({
      success: true,
      reports
    })
  } catch (err: any) {
    console.error('[API Ads Reports GET Error]', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch reports list.' },
      { status: 500 }
    )
  }
}
