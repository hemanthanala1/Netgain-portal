/**
 * Netgain Ads — Database Operations & Persistence Service
 * Parameterized database queries with multi-tenant isolation and audit logging.
 */

import { isLiveSupabaseAvailable, supabaseAdmin } from './server-guard'
import type {
  AdsAuditLogRecord,
  AdsReportRecord,
  ReportStatus
} from './types'
import { deleteReportFile } from './storage'

// Local in-memory store for fallback / dev environments when Supabase is not configured
const inMemoryReports: Map<string, AdsReportRecord> = new Map()
const inMemoryAuditLogs: AdsAuditLogRecord[] = []

export async function recordAdsAudit(
  action: AdsAuditLogRecord['action'],
  reportId: string | null,
  clientId: string | null,
  details: Record<string, any>,
  user?: { id?: string; email?: string },
  ipAddress?: string
): Promise<void> {
  const auditEntry: AdsAuditLogRecord = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    user_id: user?.id || null,
    user_email: user?.email || null,
    action,
    report_id: reportId,
    client_id: clientId,
    details: details || {},
    ip_address: ipAddress || null,
    created_at: new Date().toISOString()
  }

  if (isLiveSupabaseAvailable && supabaseAdmin) {
    try {
      await supabaseAdmin.from('ads_audit_logs').insert([
        {
          user_id: auditEntry.user_id,
          user_email: auditEntry.user_email,
          action: auditEntry.action,
          report_id: auditEntry.report_id,
          client_id: auditEntry.client_id,
          details: auditEntry.details,
          ip_address: auditEntry.ip_address
        }
      ])
      return
    } catch (err) {
      console.error('[Ads Store] Failed to write audit log to Supabase:', err)
    }
  }

  inMemoryAuditLogs.unshift(auditEntry)
}

export async function createReportRecord(
  record: Omit<AdsReportRecord, 'id' | 'created_at' | 'updated_at'>,
  user?: { id?: string; email?: string },
  ipAddress?: string
): Promise<AdsReportRecord> {
  if (isLiveSupabaseAvailable && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('ads_reports')
      .insert([
        {
          client_id: record.client_id,
          report_name: record.report_name,
          platform: record.platform,
          period_start: record.period_start,
          period_end: record.period_end,
          status: record.status || 'active',
          published_to_client: record.published_to_client || false,
          published_at: record.published_at,
          published_by: record.published_by,
          file_name: record.file_name,
          file_size_bytes: record.file_size_bytes,
          file_mime_type: record.file_mime_type,
          storage_bucket: record.storage_bucket,
          storage_path: record.storage_path,
          currency: record.currency,
          summary_metrics: record.summary_metrics,
          dimensions: record.dimensions,
          parsed_data: record.parsed_data,
          created_by: user?.email || user?.id || 'admin'
        }
      ])
      .select('*, client:crm_clients(id, name, business, email)')
      .single()

    if (error || !data) {
      throw new Error(`Failed to insert report into database: ${error?.message || 'Unknown error'}`)
    }

    await recordAdsAudit(
      'report_uploaded',
      data.id,
      data.client_id,
      { reportName: data.report_name, fileName: data.file_name },
      user,
      ipAddress
    )

    return data as AdsReportRecord
  }

  // Fallback in-memory
  const newId = `rep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  const now = new Date().toISOString()
  const savedRecord: AdsReportRecord = {
    ...record,
    id: newId,
    created_at: now,
    updated_at: now,
    created_by: user?.email || 'admin'
  }

  inMemoryReports.set(newId, savedRecord)
  await recordAdsAudit(
    'report_uploaded',
    newId,
    record.client_id,
    { reportName: record.report_name, fileName: record.file_name },
    user,
    ipAddress
  )

  return savedRecord
}

export async function fetchReportsList(filters?: {
  clientId?: string
  status?: ReportStatus
  platform?: string
  publishedOnly?: boolean
  search?: string
}): Promise<AdsReportRecord[]> {
  if (isLiveSupabaseAvailable && supabaseAdmin) {
    let query = supabaseAdmin
      .from('ads_reports')
      .select('*, client:crm_clients(id, name, business, email)')
      .order('created_at', { ascending: false })

    if (filters?.clientId) {
      query = query.eq('client_id', filters.clientId)
    }
    if (filters?.status) {
      query = query.eq('status', filters.status)
    } else {
      // default: do not show archived unless asked
      query = query.neq('status', 'archived')
    }
    if (filters?.platform) {
      query = query.eq('platform', filters.platform)
    }
    if (filters?.publishedOnly) {
      query = query.eq('published_to_client', true)
    }
    if (filters?.search) {
      query = query.ilike('report_name', `%${filters.search}%`)
    }

    let { data, error } = await query
    if (error) {
      console.warn('[Ads Store] fetchReportsList join error, attempting simple query:', error)
      let fallbackQuery = supabaseAdmin
        .from('ads_reports')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters?.clientId) fallbackQuery = fallbackQuery.eq('client_id', filters.clientId)
      if (filters?.status) fallbackQuery = fallbackQuery.eq('status', filters.status)
      else fallbackQuery = fallbackQuery.neq('status', 'archived')
      if (filters?.platform) fallbackQuery = fallbackQuery.eq('platform', filters.platform)
      if (filters?.publishedOnly) fallbackQuery = fallbackQuery.eq('published_to_client', true)
      if (filters?.search) fallbackQuery = fallbackQuery.ilike('report_name', `%${filters.search}%`)

      const fallbackRes = await fallbackQuery
      data = fallbackRes.data
    }
    return (data || []) as AdsReportRecord[]
  }

  // In-memory fallback
  let list = Array.from(inMemoryReports.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  if (filters?.clientId) {
    list = list.filter((r) => r.client_id === filters.clientId)
  }
  if (filters?.status) {
    list = list.filter((r) => r.status === filters.status)
  } else {
    list = list.filter((r) => r.status !== 'archived')
  }
  if (filters?.platform) {
    list = list.filter((r) => r.platform === filters.platform)
  }
  if (filters?.publishedOnly) {
    list = list.filter((r) => r.published_to_client)
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    list = list.filter((r) => r.report_name.toLowerCase().includes(q))
  }

  return list
}

export async function fetchReportById(
  id: string,
  enforcePublishedOnly: boolean = false
): Promise<AdsReportRecord | null> {
  if (isLiveSupabaseAvailable && supabaseAdmin) {
    let query = supabaseAdmin
      .from('ads_reports')
      .select('*, client:crm_clients(id, name, business, email)')
      .eq('id', id)

    if (enforcePublishedOnly) {
      query = query.eq('published_to_client', true)
    }

    let { data, error } = await query.maybeSingle()
    if (error) {
      console.warn('[Ads Store] fetchReportById join error, trying simple query:', error)
      let fallback = supabaseAdmin.from('ads_reports').select('*').eq('id', id)
      if (enforcePublishedOnly) fallback = fallback.eq('published_to_client', true)
      const res = await fallback.maybeSingle()
      data = res.data
    }
    if (!data) return null
    return data as AdsReportRecord
  }

  const record = inMemoryReports.get(id)
  if (!record) return null
  if (enforcePublishedOnly && !record.published_to_client) return null
  return record
}

export async function setReportPublication(
  id: string,
  published: boolean,
  user?: { id?: string; email?: string },
  ipAddress?: string
): Promise<AdsReportRecord | null> {
  const publishedAt = published ? new Date().toISOString() : null
  const publishedBy = published ? user?.email || 'admin' : null

  if (isLiveSupabaseAvailable && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('ads_reports')
      .update({
        published_to_client: published,
        published_at: publishedAt,
        published_by: publishedBy,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*, client:crm_clients(id, name, business, email)')
      .single()

    if (error || !data) {
      throw new Error(`Failed to update publication status: ${error?.message || 'Not found'}`)
    }

    await recordAdsAudit(
      published ? 'report_published' : 'report_unpublished',
      id,
      data.client_id,
      { published },
      user,
      ipAddress
    )

    return data as AdsReportRecord
  }

  const record = inMemoryReports.get(id)
  if (!record) return null

  record.published_to_client = published
  record.published_at = publishedAt
  record.published_by = publishedBy
  record.updated_at = new Date().toISOString()
  inMemoryReports.set(id, record)

  await recordAdsAudit(
    published ? 'report_published' : 'report_unpublished',
    id,
    record.client_id,
    { published },
    user,
    ipAddress
  )

  return record
}

export async function deleteReportRecord(
  id: string,
  user?: { id?: string; email?: string },
  ipAddress?: string
): Promise<boolean> {
  const existing = await fetchReportById(id)
  if (!existing) return false

  // Delete from storage
  if (existing.storage_path) {
    await deleteReportFile(existing.storage_path)
  }

  if (isLiveSupabaseAvailable && supabaseAdmin) {
    const { error } = await supabaseAdmin.from('ads_reports').delete().eq('id', id)
    if (error) {
      throw new Error(`Failed to delete report: ${error.message}`)
    }
  } else {
    inMemoryReports.delete(id)
  }

  await recordAdsAudit(
    'report_deleted',
    id,
    existing.client_id,
    { reportName: existing.report_name, fileName: existing.file_name },
    user,
    ipAddress
  )

  return true
}

export async function replaceReportRecord(
  id: string,
  newReportData: Omit<AdsReportRecord, 'id' | 'created_at' | 'updated_at'>,
  user?: { id?: string; email?: string },
  ipAddress?: string
): Promise<AdsReportRecord> {
  const existing = await fetchReportById(id)
  if (!existing) throw new Error('Report not found to replace')

  // Remove old file from storage if path changed
  if (existing.storage_path && existing.storage_path !== newReportData.storage_path) {
    await deleteReportFile(existing.storage_path)
  }

  const now = new Date().toISOString()
  if (isLiveSupabaseAvailable && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('ads_reports')
      .update({
        report_name: newReportData.report_name,
        platform: newReportData.platform,
        period_start: newReportData.period_start,
        period_end: newReportData.period_end,
        file_name: newReportData.file_name,
        file_size_bytes: newReportData.file_size_bytes,
        file_mime_type: newReportData.file_mime_type,
        storage_bucket: newReportData.storage_bucket,
        storage_path: newReportData.storage_path,
        currency: newReportData.currency,
        summary_metrics: newReportData.summary_metrics,
        dimensions: newReportData.dimensions,
        parsed_data: newReportData.parsed_data,
        updated_at: now
      })
      .eq('id', id)
      .select('*, client:crm_clients(id, name, business, email)')
      .single()

    if (error || !data) {
      throw new Error(`Failed to replace report: ${error?.message || 'Unknown error'}`)
    }

    await recordAdsAudit(
      'report_replaced',
      id,
      existing.client_id,
      { oldFileName: existing.file_name, newFileName: newReportData.file_name },
      user,
      ipAddress
    )

    return data as AdsReportRecord
  }

  const updated: AdsReportRecord = {
    ...existing,
    ...newReportData,
    updated_at: now
  }
  inMemoryReports.set(id, updated)

  await recordAdsAudit(
    'report_replaced',
    id,
    existing.client_id,
    { oldFileName: existing.file_name, newFileName: newReportData.file_name },
    user,
    ipAddress
  )

  return updated
}
