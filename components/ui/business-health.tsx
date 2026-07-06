'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from './badge'
import { Button } from './button'
import { AlertTriangle, CheckCircle2, Info, ArrowRight, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

interface HealthInsight {
  id: string
  type: 'success' | 'warning' | 'info' | 'danger'
  title: string
  description: string
  link: string
  linkText: string
}

interface BusinessHealthPanelProps {
  metrics: {
    revenueMtd: number
    overdueInvoicesCount: number
    overdueInvoicesVal: number
    delayedProjectsCount: number
    meetingsTodayCount: number
    pendingApprovalsCount: number
    pendingSignaturesCount: number
  }
}

export function BusinessHealthPanel({ metrics }: BusinessHealthPanelProps) {
  const insights = React.useMemo(() => {
    const list: HealthInsight[] = []

    // 1. Revenue Insight
    if (metrics.revenueMtd > 200000) {
      list.push({
        id: 'rev-healthy',
        type: 'success',
        title: 'Strong Revenue Performance',
        description: `Revenue has crossed ${formatCurrency(metrics.revenueMtd)} MTD. Keep up the high velocity!`,
        link: '/finance',
        linkText: 'View Financials'
      })
    } else {
      list.push({
        id: 'rev-info',
        type: 'info',
        title: 'Revenue Run Rate',
        description: `Revenue currently sits at ${formatCurrency(metrics.revenueMtd)} MTD. Review outbound invoices to hit target.`,
        link: '/documents/invoices',
        linkText: 'Track Invoices'
      })
    }

    // 2. Overdue Invoices
    if (metrics.overdueInvoicesCount > 0) {
      list.push({
        id: 'inv-overdue',
        type: 'danger',
        title: `${metrics.overdueInvoicesCount} Overdue Invoices`,
        description: `Payments totaling ${formatCurrency(metrics.overdueInvoicesVal)} are overdue. Send automated follow-up notices.`,
        link: '/documents/invoices',
        linkText: 'Collect Dues'
      })
    }

    // 3. Delayed Projects
    if (metrics.delayedProjectsCount > 0) {
      list.push({
        id: 'proj-delayed',
        type: 'warning',
        title: `${metrics.delayedProjectsCount} Delayed Projects`,
        description: 'Milestones are lagging behind targets. Connect with Project Managers.',
        link: '/projects',
        linkText: 'Audit Status'
      })
    }

    // 4. Pending Approvals
    if (metrics.pendingApprovalsCount > 0) {
      list.push({
        id: 'approvals-pending',
        type: 'info',
        title: `${metrics.pendingApprovalsCount} Pending Internal Approvals`,
        description: 'Scope of Work or Quotations are awaiting manager review before release.',
        link: '/documents/vault',
        linkText: 'Approve Docs'
      })
    }

    // 5. Pending Signatures
    if (metrics.pendingSignaturesCount > 0) {
      list.push({
        id: 'signatures-pending',
        type: 'warning',
        title: `${metrics.pendingSignaturesCount} Agreements Awaiting Signature`,
        description: 'Sent contracts are waiting for client signatures to commence.',
        link: '/documents/agreements',
        linkText: 'Review Signatures'
      })
    }

    // 6. Meetings Today
    if (metrics.meetingsTodayCount > 0) {
      list.push({
        id: 'meetings-today',
        type: 'success',
        title: `${metrics.meetingsTodayCount} Scheduled Meetings Today`,
        description: 'Calendar events are aligned. Join calls via the Communication panel.',
        link: '/meetings',
        linkText: 'Open Calendar'
      })
    }

    return list
  }, [metrics])

  const overallStatus = React.useMemo(() => {
    const dangerCount = insights.filter(i => i.type === 'danger').length
    const warningCount = insights.filter(i => i.type === 'warning').length

    if (dangerCount > 0) return { label: 'Action Required', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' }
    if (warningCount > 0) return { label: 'Needs Attention', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
    return { label: 'Excellent Health', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
  }, [insights])

  return (
    <Card className="border border-border/40 bg-card/60 backdrop-blur-sm h-full flex flex-col justify-between">
      <CardHeader className="p-4 pb-3 border-b border-border/20 flex flex-row items-center justify-between gap-4">
        <div className="space-y-0.5">
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-4.5 w-4.5 text-gold" />
            Executive Health Command
          </CardTitle>
          <p className="text-[10px] text-muted-foreground">Automated summary of critical operational alerts.</p>
        </div>
        <Badge variant="outline" className={`text-[10px] font-semibold ${overallStatus.color}`}>
          {overallStatus.label}
        </Badge>
      </CardHeader>
      <CardContent className="p-4 flex-1 overflow-y-auto max-h-[360px] space-y-3 scrollbar-thin">
        {insights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-emerald-500/60 mb-2" />
            <p className="text-xs font-semibold">Everything looks operational</p>
            <p className="text-[10px] mt-1">No alerts or actions require attention.</p>
          </div>
        ) : (
          insights.map((ins) => (
            <div 
              key={ins.id} 
              className={`p-3 rounded-lg border flex items-start gap-3 transition-all hover:bg-muted/10 ${
                ins.type === 'danger' 
                  ? 'bg-rose-500/5 border-rose-500/10' 
                  : ins.type === 'warning'
                  ? 'bg-amber-500/5 border-amber-500/10'
                  : ins.type === 'success'
                  ? 'bg-emerald-500/5 border-emerald-500/10'
                  : 'bg-blue-500/5 border-blue-500/10'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {ins.type === 'danger' && <AlertTriangle className="h-4 w-4 text-rose-400" />}
                {ins.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-400" />}
                {ins.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                {ins.type === 'info' && <Info className="h-4 w-4 text-blue-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${
                  ins.type === 'danger' 
                    ? 'text-rose-400' 
                    : ins.type === 'warning'
                    ? 'text-amber-400'
                    : ins.type === 'success'
                    ? 'text-emerald-400'
                    : 'text-blue-400'
                }`}>{ins.title}</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{ins.description}</p>
                <div className="mt-2">
                  <Link href={ins.link} className="inline-flex items-center gap-1 text-[10px] font-bold text-gold hover:underline">
                    {ins.linkText}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
