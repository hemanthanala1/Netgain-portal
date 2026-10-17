'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { PermissionDeniedState } from '@/components/ui/permission-denied'
import { AdsDashboard } from '@/components/ads/ads-dashboard'
import {
  ArrowLeft,
  Download,
  CheckCircle2,
  XCircle,
  Calendar,
  Layers,
  FileSpreadsheet,
  Loader2,
  BarChart3
} from 'lucide-react'
import type { AdsReportRecord } from '@/lib/ads/types'
import { formatters } from '@/lib/ads/aggregator'
import { supabase } from '@/lib/supabase'

export default function PerformanceReportDetailPage({ params }: { params: { id: string } }) {
  const { hasPermission } = usePermissions()
  const { toast } = useToast()

  const [report, setReport] = useState<AdsReportRecord | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<boolean>(false)

  const canRead = hasPermission('ads', 'read')
  const canManage = hasPermission('ads', 'create')

  const fetchDetail = async () => {
    try {
      setLoading(true)
      const session = (await supabase.auth.getSession()).data.session
      const headers: Record<string, string> = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      const res = await fetch(`/api/ads/reports/${params.id}`, {
        headers,
        credentials: 'include'
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch report')
      }
      setReport(data.report)
    } catch (err: any) {
      setError(err.message || 'Report not found.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (params.id) {
      fetchDetail()
    }
  }, [params.id])

  const handleTogglePublish = async () => {
    if (!report) return
    const nextStatus = !report.published_to_client
    setToggling(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      const res = await fetch(`/api/ads/reports/${report.id}`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({ published: nextStatus })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update publication')
      }

      setReport((prev) => (prev ? { ...prev, published_to_client: nextStatus } : prev))
      toast({
        title: nextStatus ? 'Published to Client' : 'Unpublished',
        description: nextStatus
          ? `${report.report_name} is now viewable by ${report.client?.name || 'the client'} in the client portal.`
          : `${report.report_name} is now hidden from the client portal.`
      })
    } catch (err: any) {
      toast({
        title: 'Action Failed',
        description: err.message || 'Could not update publication status.',
        variant: 'destructive'
      })
    } finally {
      setToggling(false)
    }
  }

  if (!canRead) {
    return <PermissionDeniedState />
  }

  if (loading) {
    return (
      <div className="p-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
        <p className="text-xs text-muted-foreground font-medium">Loading report showcase...</p>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="text-xs gap-1.5">
          <Link href="/reports?tab=performance">
            <ArrowLeft className="h-4 w-4" /> Back to Reports
          </Link>
        </Button>
        <Card className="border-border p-12 text-center bg-card">
          <FileSpreadsheet className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-bold text-foreground">Report Not Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            {error || 'This report may have been deleted or moved.'}
          </p>
          <Button asChild size="sm" className="mt-4 text-xs font-semibold">
            <Link href="/reports?tab=performance">Return to Reports</Link>
          </Button>
        </Card>
      </div>
    )
  }

  const clientName = report.client?.name || 'Unassigned Client'
  const downloadUrl = `/api/ads/reports/${report.id}/download`

  return (
    <div className="space-y-6">
      {/* ── Top Bar with Back and Publication Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild className="text-xs h-8 gap-1.5">
            <Link href="/reports?tab=performance">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Reports
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground">{clientName}</span>
            {report.client?.business && (
              <span className="text-xs text-muted-foreground">({report.client.business})</span>
            )}
            <span className="text-muted-foreground">•</span>
            {report.published_to_client ? (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1 font-semibold">
                <CheckCircle2 className="h-3 w-3" /> Published in Client Portal
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-border gap-1 font-semibold">
                <XCircle className="h-3 w-3" /> Draft (Admin Only)
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <Button
              variant={report.published_to_client ? 'outline' : 'default'}
              size="sm"
              onClick={handleTogglePublish}
              disabled={toggling}
              className="text-xs h-8 font-semibold gap-1.5"
            >
              {toggling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : report.published_to_client ? (
                <>
                  <XCircle className="h-3.5 w-3.5 text-amber-500" /> Unpublish from Client
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Publish to Client Portal
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(downloadUrl, '_blank')}
            className="text-xs h-8 font-semibold gap-1.5"
          >
            <Download className="h-3.5 w-3.5 text-primary" /> Download Raw File
          </Button>
        </div>
      </div>

      {/* ── Metadata Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-card border border-border/60 text-xs">
        <div>
          <span className="text-muted-foreground block text-[10px]">Report Period</span>
          <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            {report.period_start && report.period_end
              ? `${formatters.date(report.period_start)} to ${formatters.date(report.period_end)}`
              : 'Single Period'}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px]">Source File</span>
          <span className="font-mono text-foreground block truncate mt-0.5" title={report.file_name}>
            {report.file_name} ({(report.file_size_bytes / 1024).toFixed(1)} KB)
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px]">Platform</span>
          <span className="font-semibold text-foreground capitalize mt-0.5 block">
            {report.platform} Ads
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px]">Archived At</span>
          <span className="text-muted-foreground mt-0.5 block">
            {formatters.date(report.created_at.split('T')[0])} by {report.created_by || 'Admin'}
          </span>
        </div>
      </div>

      {/* ── Interactive Reports Showcase ── */}
      <AdsDashboard
        reportData={report.parsed_data}
        reportTitle={report.report_name}
        clientName={clientName}
        reportId={report.id}
        downloadUrl={downloadUrl}
      />
    </div>
  )
}
