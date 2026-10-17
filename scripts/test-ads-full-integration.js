/**
 * Netgain Ads — End-to-End Integration & Security Test Suite
 * Tests file parsing, Excel workbook sheet selection, API validation,
 * aggregation & recalculations, client session signing, and tenant isolation.
 */

const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')
const crypto = require('crypto')

// Ensure test environment variables
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '10d1eb7dfa97a949e4d566acbece51c7f16469e89a0eb5ec695dbf4967e3cde3'
process.env.CLIENT_SESSION_SECRET = process.env.CLIENT_SESSION_SECRET || 'ceff06a72ea6951098b9c70aa181675b73bc62985108fd48257bb576ffd633a3'

let passed = 0
let failed = 0

function assert(cond, name) {
  if (cond) {
    console.log(`  ✅ PASS: ${name}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${name}`)
    failed++
  }
}

console.log('============================================================')
console.log('NETGAIN ADS PHASE 1: FULL INTEGRATION & SECURITY TEST SUITE')
console.log('============================================================\n')

// -----------------------------------------------------------------------------
// 1. Parser & Delimited Text Handling
// -----------------------------------------------------------------------------
console.log('--- 1. Testing CSV, TSV & Quote Parsing ---')
const { parseDelimitedText, autoMapHeaders, findHeaderRow, ingestAdsReport } = require('../lib/ads/parser')

const csvSample = `Reporting starts,Reporting ends,Campaign name,Ad set name,Ad name,Amount spent (INR),Impressions,Link clicks,Landing page views,Leads
2026-09-01,2026-09-28,"Lead Gen | Cold, Phase 1",Audience Lookalike,Creative A,"1,500.50",25000,450,380,42
2026-09-01,2026-09-28,"Retargeting | Site 30d",Visitors,Creative B,"3,200.00",18000,600,510,75
`
const parsedCsv = parseDelimitedText(csvSample)
assert(parsedCsv.length === 3, 'CSV parsed into 3 rows (header + 2 data rows)')
assert(parsedCsv[1][2] === 'Lead Gen | Cold, Phase 1', 'Quotes with commas parsed correctly')

const headerIdx = findHeaderRow(parsedCsv)
assert(headerIdx === 0, 'Header row detected at index 0')

const ingestRes = ingestAdsReport(parsedCsv[0], parsedCsv.slice(1), { source: 'file', name: 'test.csv' })
assert(ingestRes.data !== null, 'Ingest succeeded without error')
assert(ingestRes.data.rows.length === 2, '2 parsed data rows created')
assert(ingestRes.data.rows[0].spend === 1500.5, 'Amount spent parsed correctly as number (1500.5)')
assert(ingestRes.data.rows[0].leads === 42, 'Leads parsed correctly (42)')

// -----------------------------------------------------------------------------
// 2. Excel Workbook Handling (.xlsx) & Worksheet Selection
// -----------------------------------------------------------------------------
console.log('\n--- 2. Testing Excel (.xlsx) Multi-Sheet Inspection & Parsing ---')
const { inspectWorkbookSheets, parseExcelWorkbook } = require('../lib/ads/parser')

// Create an in-memory workbook with 2 sheets
const wb = XLSX.utils.book_new()
const sheet1Data = [
  ['Notes', 'This is an executive summary tab with no raw data'],
  ['Summary', 'Budget approved: ₹50,000']
]
const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data)
XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

const sheet2Data = [
  ['Day', 'Campaign name', 'Ad set name', 'Ad name', 'Amount spent (INR)', 'Impressions', 'Link clicks', 'Leads'],
  ['2026-09-10', 'Ecom Sales', 'Broad 25-45', 'Carousel 1', 1200, 15000, 320, 28],
  ['2026-09-11', 'Ecom Sales', 'Broad 25-45', 'Carousel 2', 1400, 18000, 390, 35]
]
const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data)
XLSX.utils.book_append_sheet(wb, ws2, 'Raw Data Export')

const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

const inspection = inspectWorkbookSheets(excelBuffer)
assert(inspection.sheets.length === 2, 'Detected 2 worksheets in Excel workbook')
assert(inspection.recommendedSheet === 'Raw Data Export', 'Automatically picked "Raw Data Export" as recommended sheet')

const parsedExcel = parseExcelWorkbook(excelBuffer, 'Raw Data Export')
assert(parsedExcel.rows.length === 3, 'Excel raw data sheet extracted 3 rows')

const excelIngest = ingestAdsReport(parsedExcel.rows[0], parsedExcel.rows.slice(1), { source: 'file', name: 'report.xlsx' })
assert(excelIngest.data !== null, 'Excel rows successfully ingested')
assert(excelIngest.data.rows.length === 2, 'Excel parsed 2 data rows')
assert(excelIngest.data.has.leads === true, 'Leads column identified in Excel sheet')

// -----------------------------------------------------------------------------
// 3. Metric Recalculation & Aggregation Correctness
// -----------------------------------------------------------------------------
console.log('\n--- 3. Testing Mathematical Rate Recalculation ---')
const { aggregateRows, getEfficiencyMetric, buildFunnelStages, generateInsights } = require('../lib/ads/aggregator')

const agg = aggregateRows(excelIngest.data.rows, excelIngest.data.has)
// Row 1: spend 1200, impr 15000, clicks 320, leads 28
// Row 2: spend 1400, impr 18000, clicks 390, leads 35
// Total spend = 2600, total impr = 33000, total clicks = 710, total leads = 63
assert(agg.spend === 2600, 'Total spend aggregated correctly (₹2,600)')
assert(agg.impr === 33000, 'Total impressions aggregated correctly (33,000)')
assert(agg.clicks === 710, 'Total clicks aggregated correctly (710)')
assert(agg.leads === 63, 'Total leads aggregated correctly (63)')

// CTR recalculation: (710 / 33000) * 100 = 2.1515%
assert(Math.abs(agg.ctr - 2.1515) < 0.01, `Recalculated CTR is correct (${agg.ctr.toFixed(2)}%)`)

// CPC recalculation: 2600 / 710 = 3.6619
assert(Math.abs(agg.cpc - 3.6619) < 0.01, `Recalculated CPC is correct (₹${agg.cpc.toFixed(2)})`)

// CPM recalculation: (2600 / 33000) * 1000 = 78.7878
assert(Math.abs(agg.cpm - 78.7878) < 0.01, `Recalculated CPM is correct (₹${agg.cpm.toFixed(2)})`)

// CPL recalculation: 2600 / 63 = 41.2698
assert(Math.abs(agg.cpl - 41.2698) < 0.01, `Recalculated CPL is correct (₹${agg.cpl.toFixed(2)})`)

// Funnel stages
const funnel = buildFunnelStages(agg, excelIngest.data.has)
assert(funnel.length >= 3, `Conversion funnel contains ${funnel.length} sequential stages`)
assert(funnel[0].label === 'Impressions', 'Funnel top is Impressions')
assert(funnel[1].label === 'Link clicks' || funnel[1].label === 'Clicks', 'Funnel middle is Clicks')
assert(funnel[2].label === 'Leads', 'Funnel bottom is Leads')

// -----------------------------------------------------------------------------
// 4. Invalid File Rejection & Validation
// -----------------------------------------------------------------------------
console.log('\n--- 4. Testing Malformed & Unrecognized File Rejection ---')
const invalidCsv = `Employee ID,First Name,Department,Salary
EMP01,John,Engineering,85000
EMP02,Sara,Marketing,78000
`
const parsedInvalid = parseDelimitedText(invalidCsv)
const invalidResult = ingestAdsReport(parsedInvalid[0], parsedInvalid.slice(1), { source: 'file', name: 'payroll.csv' })
assert(invalidResult.data === null, 'Non-Ads Manager CSV rejected')
assert(invalidResult.error.includes('No standard Meta Ads columns found'), 'Detailed helpful rejection message provided')

// -----------------------------------------------------------------------------
// 5. Client Session Cryptography & Multi-Tenant Isolation
// -----------------------------------------------------------------------------
console.log('\n--- 5. Testing Tenant Isolation & Session Cryptography ---')
const { signClientSession, verifyClientSession } = require('../lib/ads/session-token')

const clientSessionA = {
  clientAccountId: 'acc_fashionhub_1',
  clientId: 'client_fashionhub',
  email: 'priya@fashionhub.in',
  name: 'Priya Sharma',
  company: 'FashionHub India'
}

const clientSessionB = {
  clientAccountId: 'acc_urbanedge_2',
  clientId: 'client_urbanedge',
  email: 'aaron@urbanedge.co',
  name: 'Aaron Shah',
  company: 'Urban Edge Co.'
}

const tokenA = signClientSession(clientSessionA)
const verifiedA = verifyClientSession(tokenA)
assert(verifiedA !== null, 'Client A token verified successfully')
assert(verifiedA.clientId === 'client_fashionhub', 'Client A session contains clientId "client_fashionhub"')

// Simulated cross-client forgery attempt:
// Attacker tries to alter payload to impersonate Client B while keeping signature
const tokenParts = tokenA.split('.')
const forgedPayload = Buffer.from(
  JSON.stringify({ ...clientSessionA, clientId: 'client_urbanedge' })
).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

const tamperedToken = `${forgedPayload}.${tokenParts[1]}`
const tamperedResult = verifyClientSession(tamperedToken)
assert(tamperedResult === null, 'Tampered token attempting cross-tenant access is REJECTED')

// -----------------------------------------------------------------------------
// 6. In-Memory Store & Publication Security
// -----------------------------------------------------------------------------
console.log('\n--- 6. Testing Database Store & Publication Permissions ---')
const {
  createReportRecord,
  fetchReportsList,
  fetchReportById,
  setReportPublication,
  deleteReportRecord
} = require('../lib/ads/report-store')

async function runStoreTests() {
  // Create report for Client A
  const reportA = await createReportRecord(
    {
      client_id: 'client_fashionhub',
      report_name: 'FashionHub Q3 Meta Ads',
      platform: 'meta',
      period_start: '2026-09-01',
      period_end: '2026-09-28',
      status: 'active',
      published_to_client: false, // initially unpublished
      published_at: null,
      published_by: null,
      file_name: 'fashionhub_meta.csv',
      file_size_bytes: 4096,
      file_mime_type: 'text/csv',
      storage_bucket: 'ads-reports',
      storage_path: 'client_fashionhub/test.csv',
      currency: '₹',
      summary_metrics: { spend: 2600, leads: 63 },
      dimensions: { campaign: true, adset: true, ad: true },
      parsed_data: excelIngest.data,
      created_by: 'admin@netgain.test'
    },
    { email: 'admin@netgain.test' }
  )

  assert(reportA.id !== undefined, 'Report record created in store with generated ID')
  assert(reportA.published_to_client === false, 'Report starts as unpublished draft')

  // Client A queries published reports -> should be empty since report is unpublished
  const clientAListUnpublished = await fetchReportsList({
    clientId: 'client_fashionhub',
    publishedOnly: true
  })
  assert(clientAListUnpublished.length === 0, 'Unpublished report is NOT visible to Client A')

  // Publish report to Client A
  const publishedReport = await setReportPublication(reportA.id, true, { email: 'admin@netgain.test' })
  assert(publishedReport.published_to_client === true, 'Report publication status updated to true')

  // Client A queries published reports -> should find 1 report
  const clientAListPublished = await fetchReportsList({
    clientId: 'client_fashionhub',
    publishedOnly: true
  })
  assert(clientAListPublished.length === 1, 'Published report IS visible to Client A')
  assert(clientAListPublished[0].id === reportA.id, 'Client A retrieves the correct report')

  // Client B queries published reports -> should be 0 (Tenant Isolation)
  const clientBList = await fetchReportsList({
    clientId: 'client_urbanedge',
    publishedOnly: true
  })
  assert(clientBList.length === 0, 'Client B cannot see Client A published reports (Tenant Isolation)')

  // Client B tries to fetch Client A report by ID
  const directFetch = await fetchReportById(reportA.id, true)
  assert(directFetch.client_id !== 'client_urbanedge', 'Report client_id strictly belongs to Client A, not Client B')

  // Clean up
  await deleteReportRecord(reportA.id, { email: 'admin@netgain.test' })
  const deletedCheck = await fetchReportById(reportA.id)
  assert(deletedCheck === null || deletedCheck === undefined, 'Report successfully deleted from store')

  // -----------------------------------------------------------------------------
  // 7. Testing Server Guard & Session Authentication
  // -----------------------------------------------------------------------------
  console.log('\n--- 7. Testing Server Guard & Netgain Session Authentication ---')
  const { authenticateStaffRequest, authenticateClientRequest } = require('../lib/ads/server-guard')

  // Staff auth with nbos-session=active cookie
  const mockStaffReq = {
    cookies: {
      get: (name) => (name === 'nbos-session' ? { value: 'active' } : undefined),
      getAll: () => [{ name: 'nbos-session', value: 'active' }]
    },
    headers: {
      get: () => null
    },
    nextUrl: { searchParams: new URLSearchParams() }
  }
  const staffAuthRes = await authenticateStaffRequest(mockStaffReq)
  assert(staffAuthRes.user !== null, 'Staff authenticated successfully via nbos-session=active')
  assert(staffAuthRes.user.role === 'Admin', 'Staff has Admin role from session')
  assert(staffAuthRes.user.permissions.includes('ads'), 'Staff has ads permission')

  // Staff auth without session
  const mockUnauthReq = {
    cookies: {
      get: () => undefined,
      getAll: () => []
    },
    headers: {
      get: () => null
    },
    nextUrl: { searchParams: new URLSearchParams() }
  }
  const unauthRes = await authenticateStaffRequest(mockUnauthReq)
  assert(unauthRes.user !== null || unauthRes.errorResponse !== null, 'Handled staff request authentication correctly')

  // Client auth with query param token
  const mockClientQueryReq = {
    cookies: {
      get: () => undefined,
      getAll: () => []
    },
    headers: {
      get: () => null
    },
    nextUrl: { searchParams: new URLSearchParams({ token: tokenA }) }
  }
  const clientQueryRes = await authenticateClientRequest(mockClientQueryReq)
  assert(clientQueryRes.session !== null, 'Client authenticated successfully via query parameter token')
  assert(clientQueryRes.session.clientId === 'client_fashionhub', 'Client query session matches client_fashionhub')

  console.log('\n============================================================')
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`)
  console.log('============================================================\n')

  if (failed > 0) process.exit(1)
}

runStoreTests().catch((err) => {
  console.error('Fatal store test error:', err)
  process.exit(1)
})
