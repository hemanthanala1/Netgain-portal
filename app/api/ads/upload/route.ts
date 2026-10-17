import { NextRequest, NextResponse } from 'next/server'
import { authenticateStaffRequest } from '@/lib/ads/server-guard'
import {
  findHeaderRow,
  ingestAdsReport,
  inspectWorkbookSheets,
  parseDelimitedText,
  parseExcelWorkbook
} from '@/lib/ads/parser'
import { aggregateRows } from '@/lib/ads/aggregator'
import { uploadReportFile } from '@/lib/ads/storage'
import { createReportRecord, replaceReportRecord } from '@/lib/ads/report-store'
import type { AdPlatform } from '@/lib/ads/types'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { user, errorResponse } = await authenticateStaffRequest(request, 'ads')
    if (errorResponse) return errorResponse

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const clientId = formData.get('clientId') as string | null
    const reportName = formData.get('reportName') as string | null
    const platform = ((formData.get('platform') as string | null) || 'meta') as AdPlatform
    const periodStartInput = formData.get('periodStart') as string | null
    const periodEndInput = formData.get('periodEnd') as string | null
    const requestedSheet = (formData.get('sheetName') as string | null) || undefined
    const replaceReportId = formData.get('replaceReportId') as string | null
    const publishDirectly = formData.get('publishDirectly') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'Please choose a report file to upload.' }, { status: 400 })
    }
    if (!clientId || !clientId.trim()) {
      return NextResponse.json(
        { error: 'Client selection is required. Please assign this report to an ERP client.' },
        { status: 400 }
      )
    }
    if (!reportName || !reportName.trim()) {
      return NextResponse.json(
        { error: 'Report name is required. Please specify a descriptive name.' },
        { status: 400 }
      )
    }

    const fileName = file.name || 'report'
    const ext = (fileName.split('.').pop() || '').toLowerCase()
    const allowedExts = ['csv', 'tsv', 'txt', 'xlsx', 'xls', 'xlsm']

    if (!allowedExts.includes(ext)) {
      return NextResponse.json(
        {
          error: `Unsupported file format (.${ext}). Supported formats: CSV, TSV, TXT, XLSX, XLS, XLSM.`
        },
        { status: 400 }
      )
    }

    if (file.size > 52428800) {
      return NextResponse.json(
        { error: 'File size exceeds maximum permitted limit (50MB).' },
        { status: 400 }
      )
    }

    const arrayBuf = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuf)

    let rows: (string | number)[][] = []
    let activeSheetName: string | undefined = undefined

    if (['xlsx', 'xls', 'xlsm'].includes(ext)) {
      const sheetInspect = inspectWorkbookSheets(buffer)
      activeSheetName = requestedSheet || sheetInspect.recommendedSheet
      const parsedExcel = parseExcelWorkbook(buffer, activeSheetName)
      rows = parsedExcel.rows
    } else {
      const text = buffer.toString('utf8')
      rows = parseDelimitedText(text)
    }

    if (!rows.length || rows.length < 2) {
      return NextResponse.json(
        { error: 'The uploaded file is empty or does not contain data rows.' },
        { status: 400 }
      )
    }

    const headerIdx = findHeaderRow(rows)
    const rawHeaders = rows[headerIdx].map((c) => String(c ?? ''))
    const dataRows = rows.slice(headerIdx + 1)

    const ingestResult = ingestAdsReport(rawHeaders, dataRows, {
      source: 'file',
      name: fileName,
      sheetName: activeSheetName,
      fileSize: file.size
    })

    if (ingestResult.error || !ingestResult.data) {
      return NextResponse.json(
        {
          error:
            ingestResult.error ||
            'Could not recognize standard Meta Ads columns. Please verify that headers like Campaign name, Amount spent, Impressions are present.'
        },
        { status: 400 }
      )
    }

    const parsedData = ingestResult.data
    const totalAgg = aggregateRows(parsedData.rows, parsedData.has)

    // Calculate reporting period dates
    const detectedStart = parsedData.dateList.length ? parsedData.dateList[0] : null
    const detectedEnd = parsedData.dateList.length
      ? parsedData.dateList[parsedData.dateList.length - 1]
      : null

    const finalStart = periodStartInput?.trim() || detectedStart
    const finalEnd = periodEndInput?.trim() || detectedEnd

    // Generate isolated storage path: client_id/report_timestamp_cleanname
    const safeBaseName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `${clientId.trim()}/${Date.now()}_${safeBaseName}`

    // Upload original file to private storage
    const uploadRes = await uploadReportFile(
      storagePath,
      buffer,
      file.type || 'application/octet-stream'
    )

    if (!uploadRes.success) {
      return NextResponse.json(
        { error: `Storage failure: ${uploadRes.error || 'Could not store file in private bucket.'}` },
        { status: 500 }
      )
    }

    const summaryMetrics = {
      spend: totalAgg.spend,
      impressions: totalAgg.impr,
      reach: totalAgg.reach,
      clicks: totalAgg.clicks,
      ctr: totalAgg.ctr,
      cpc: totalAgg.cpc,
      cpm: totalAgg.cpm,
      lpv: totalAgg.lpv,
      leads: totalAgg.leads,
      cpl: totalAgg.cpl,
      results: totalAgg.results,
      cpr: totalAgg.cpr,
      purchases: totalAgg.purchases,
      cpp: totalAgg.cpp,
      revenue: totalAgg.revenue,
      roas: totalAgg.roas,
      rowCount: parsedData.rows.length
    }

    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''

    let savedReport
    if (replaceReportId) {
      savedReport = await replaceReportRecord(
        replaceReportId,
        {
          client_id: clientId.trim(),
          report_name: reportName.trim(),
          platform,
          period_start: finalStart,
          period_end: finalEnd,
          status: 'active',
          published_to_client: publishDirectly,
          published_at: publishDirectly ? new Date().toISOString() : null,
          published_by: publishDirectly ? user?.email || 'admin' : null,
          file_name: fileName,
          file_size_bytes: file.size,
          file_mime_type: file.type || 'application/octet-stream',
          storage_bucket: 'ads-reports',
          storage_path: storagePath,
          currency: parsedData.currency,
          summary_metrics: summaryMetrics,
          dimensions: parsedData.dim,
          parsed_data: parsedData,
          created_by: user?.email || 'admin'
        },
        user || undefined,
        clientIp
      )
    } else {
      savedReport = await createReportRecord(
        {
          client_id: clientId.trim(),
          report_name: reportName.trim(),
          platform,
          period_start: finalStart,
          period_end: finalEnd,
          status: 'active',
          published_to_client: publishDirectly,
          published_at: publishDirectly ? new Date().toISOString() : null,
          published_by: publishDirectly ? user?.email || 'admin' : null,
          file_name: fileName,
          file_size_bytes: file.size,
          file_mime_type: file.type || 'application/octet-stream',
          storage_bucket: 'ads-reports',
          storage_path: storagePath,
          currency: parsedData.currency,
          summary_metrics: summaryMetrics,
          dimensions: parsedData.dim,
          parsed_data: parsedData,
          created_by: user?.email || 'admin'
        },
        user || undefined,
        clientIp
      )
    }

    return NextResponse.json({
      success: true,
      report: savedReport
    })
  } catch (err: any) {
    console.error('[API Ads Upload Error]', err)
    return NextResponse.json(
      { error: err?.message || 'Internal server error while uploading and saving report.' },
      { status: 500 }
    )
  }
}
