/**
 * Netgain Ads — Core TypeScript Type Definitions
 * Phase 1: Admin Report Upload and Dashboard Integration
 */

export type AdPlatform = 'meta' | 'google'

export type ReportStatus = 'active' | 'archived' | 'replaced'

export type AssignmentStatus = 'active' | 'ended'

export type AssignmentAction = 'assigned' | 'reassigned' | 'unassigned' | 'permissions_updated'

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'spam'

/**
 * Standard Meta Ads measure keys
 */
export type MeasureKey =
  | 'spend'
  | 'impr'
  | 'reach'
  | 'clicksLink'
  | 'clicksAll'
  | 'clicksOut'
  | 'lpv'
  | 'leads'
  | 'results'
  | 'purchases'
  | 'revenue'
  | 'engagements'
  | 'video'
  | 'messages'

/**
 * Parsed individual row of an ads report
 */
export interface ParsedAdsRow {
  campaign: string
  adset: string
  ad: string
  age: string
  gender: string
  placement: string
  region: string
  objective: string
  date: string
  dateEnd: string
  spend: number | null
  impr: number | null
  reach: number | null
  clicksLink: number | null
  clicksAll: number | null
  clicksOut: number | null
  lpv: number | null
  leads: number | null
  results: number | null
  purchases: number | null
  revenue: number | null
  engagements: number | null
  video: number | null
  messages: number | null
  c: (number | null)[] // Custom numeric columns
}

/**
 * Dimension availability flags
 */
export interface ReportDimensions {
  campaign: boolean
  adset: boolean
  ad: boolean
  age: boolean
  gender: boolean
  placement: boolean
  region: boolean
  objective: boolean
  date: boolean
}

/**
 * Measure availability flags
 */
export type ReportMeasures = Record<MeasureKey, boolean> & {
  revenue: boolean
  hasClicks: boolean
  showResults: boolean
}

/**
 * Custom numeric or text column descriptor
 */
export interface CustomColumnMeta {
  i: number
  h: string
  avg: boolean
}

export interface TextColumnMeta {
  i: number
  h: string
}

/**
 * Fully parsed report data structure stored in DB and used by Dashboard
 */
export interface ParsedAdsReportData {
  headers: string[]
  map: Record<string, number>
  used: Record<number, number>
  rows: ParsedAdsRow[]
  dim: ReportDimensions
  has: ReportMeasures
  custom: CustomColumnMeta[]
  textCols: TextColumnMeta[]
  dateList: string[]
  rawRows: (string | number | null)[][]
  currency: string
  isSample?: boolean
  meta: {
    source: 'file' | 'sample' | 'paste'
    name: string
    sheetName?: string
    loadedAt: number
    fileSize?: number
  }
}

/**
 * Aggregated summary metrics for any slice or total
 */
export interface AggregatedMetrics {
  n: number
  spend: number
  impr: number
  reach: number
  clicksLink: number
  clicksAll: number
  clicksOut: number
  clicks: number | null
  lpv: number
  leads: number
  results: number
  purchases: number
  revenue: number
  engagements: number
  video: number
  messages: number
  ctr: number | null
  cpc: number | null
  cpm: number | null
  cpl: number | null
  cpr: number | null
  cpp: number | null
  cplpv: number | null
  lpvRate: number | null
  freq: number | null
  roas: number | null
  key?: string
  first?: ParsedAdsRow
  rows?: ParsedAdsRow[]
}

/**
 * Funnel stage definition
 */
export interface FunnelStage {
  label: string
  v: number
  cost: number | null
  per: string
  verb: string
}

/**
 * Rule-based insight item
 */
export interface InsightItem {
  type: '' | 'good' | 'bad' | 'warn'
  html: string
}

/**
 * Efficiency metric indicator
 */
export interface EfficiencyMetric {
  key: 'cpl' | 'cpr' | 'cpp' | 'cplpv' | 'cpc'
  res: 'leads' | 'results' | 'purchases' | 'lpv' | 'clicks'
  resLabel: string
  label: string
}

/**
 * Persistent Ads Report record in PostgreSQL database
 */
export interface AdsReportRecord {
  id: string
  client_id: string
  report_name: string
  platform: AdPlatform
  period_start: string | null
  period_end: string | null
  status: ReportStatus
  published_to_client: boolean
  published_at: string | null
  published_by: string | null
  file_name: string
  file_size_bytes: number
  file_mime_type: string
  storage_bucket: string
  storage_path: string
  currency: string
  summary_metrics: Record<string, any>
  dimensions: ReportDimensions
  parsed_data: ParsedAdsReportData
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined relation for display
  client?: {
    id: string
    name: string
    business?: string
    email?: string
  }
}

/**
 * Audit log entry for Netgain Ads module
 */
export interface AdsAuditLogRecord {
  id: string
  user_id: string | null
  user_email: string | null
  action:
    | 'report_uploaded'
    | 'report_published'
    | 'report_unpublished'
    | 'report_replaced'
    | 'report_deleted'
    | 'report_viewed'
    | 'report_downloaded'
  report_id: string | null
  client_id: string | null
  details: Record<string, any>
  ip_address: string | null
  created_at: string
}

/**
 * Target range configuration for cost metrics
 */
export interface TargetRange {
  min: string
  max: string
}

/**
 * Decoded & Verified Client Session Payload
 */
export interface VerifiedClientSession {
  clientAccountId: string
  clientId: string
  email: string
  name?: string
  company?: string
  issuedAt: number
  exp: number
}

/**
 * Authenticated Staff Session
 */
export interface AuthenticatedStaff {
  id: string
  email: string
  role: string
  permissions: string[]
}
