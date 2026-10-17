import { NextRequest, NextResponse } from 'next/server'
import { authenticateStaffRequest } from '@/lib/ads/server-guard'
import {
  findHeaderRow,
  ingestAdsReport,
  inspectWorkbookSheets,
  parseDelimitedText,
  parseExcelWorkbook
} from '@/lib/ads/parser'
import { aggregateRows, getEfficiencyMetric } from '@/lib/ads/aggregator'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { user, errorResponse } = await authenticateStaffRequest(request, 'ads')
    if (errorResponse) return errorResponse

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const requestedSheet = (formData.get('sheetName') as string | null) || undefined

    if (!file) {
      return NextResponse.json({ error: 'No file provided for preview' }, { status: 400 })
    }

    const fileName = file.name || 'report'
    const ext = (fileName.split('.').pop() || '').toLowerCase()
    const allowedExts = ['csv', 'tsv', 'txt', 'xlsx', 'xls', 'xlsm']

    if (!allowedExts.includes(ext)) {
      return NextResponse.json(
        {
          error: `Unsupported file format (.${ext}). Please upload a CSV, TSV, or Excel workbook (.xlsx, .xls, .xlsm).`
        },
        { status: 400 }
      )
    }

    if (file.size > 52428800) {
      return NextResponse.json(
        { error: 'File exceeds maximum limit of 50MB. Please upload a smaller export.' },
        { status: 400 }
      )
    }

    const arrayBuf = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuf)

    let rows: (string | number)[][] = []
    let detectedSheets: { name: string; rowCount: number }[] = []
    let activeSheetName: string | undefined = undefined

    if (['xlsx', 'xls', 'xlsm'].includes(ext)) {
      const sheetInspect = inspectWorkbookSheets(buffer)
      detectedSheets = sheetInspect.sheets
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
            'Could not recognize standard Meta Ads columns. Please check that headers like Campaign name, Amount spent, Impressions are present.'
        },
        { status: 400 }
      )
    }

    const parsedData = ingestResult.data
    const totalAgg = aggregateRows(parsedData.rows, parsedData.has)
    const effMetric = getEfficiencyMetric(parsedData.has)

    // Detect period dates
    const dates = parsedData.dateList
    const periodStart = dates.length ? dates[0] : null
    const periodEnd = dates.length ? dates[dates.length - 1] : null

    return NextResponse.json({
      success: true,
      fileName,
      fileSize: file.size,
      sheets: detectedSheets,
      activeSheet: activeSheetName,
      detectedHeaders: parsedData.headers,
      mappedFieldCount: Object.keys(parsedData.map).length,
      rowCount: parsedData.rows.length,
      periodStart,
      periodEnd,
      currency: parsedData.currency,
      summary: {
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
        roas: totalAgg.roas
      },
      efficiencyMetric: effMetric,
      dimensions: parsedData.dim,
      measures: parsedData.has,
      previewRows: parsedData.rows.slice(0, 10)
    })
  } catch (err: any) {
    console.error('[API Ads Parse Preview Error]', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to inspect and preview file.' },
      { status: 500 }
    )
  }
}
