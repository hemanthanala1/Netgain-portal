import { NextRequest, NextResponse } from 'next/server'
import { authenticateStaffRequest } from '@/lib/ads/server-guard'
import {
  deleteReportRecord,
  fetchReportById,
  setReportPublication
} from '@/lib/ads/report-store'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, errorResponse } = await authenticateStaffRequest(request, 'ads')
    if (errorResponse) return errorResponse

    const reportId = params.id
    if (!reportId) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
    }

    const report = await fetchReportById(reportId)
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      report
    })
  } catch (err: any) {
    console.error('[API Ads Report Detail Error]', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch report details' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, errorResponse } = await authenticateStaffRequest(request, 'ads')
    if (errorResponse) return errorResponse

    const reportId = params.id
    if (!reportId) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''

    if (typeof body.published === 'boolean') {
      const updated = await setReportPublication(
        reportId,
        body.published,
        user || undefined,
        clientIp
      )
      if (!updated) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 })
      }
      return NextResponse.json({ success: true, report: updated })
    }

    return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 })
  } catch (err: any) {
    console.error('[API Ads Report PATCH Error]', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to update report' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, errorResponse } = await authenticateStaffRequest(request, 'ads')
    if (errorResponse) return errorResponse

    const reportId = params.id
    if (!reportId) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
    }

    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
    const ok = await deleteReportRecord(reportId, user || undefined, clientIp)

    if (!ok) {
      return NextResponse.json({ error: 'Report not found or already deleted' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Report deleted successfully' })
  } catch (err: any) {
    console.error('[API Ads Report DELETE Error]', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to delete report' },
      { status: 500 }
    )
  }
}
