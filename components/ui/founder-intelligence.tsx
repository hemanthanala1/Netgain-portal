'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, TrendingUp, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react'

interface FounderIntelligenceProps {
  metrics: {
    revenueMtd: number
    revenueYtd: number
    outstandingPayments: number
    pipelineVal: number
    projectsDelayed: number
    pendingApprovals: number
    pendingSignatures: number
    invoicesOverdue: number
  }
}

export function FounderIntelligence({ metrics }: FounderIntelligenceProps) {
  // Compute a business health score based on metrics
  const scoreDeductions = 
    (metrics.projectsDelayed * 5) + 
    (metrics.invoicesOverdue > 0 ? 8 : 0) + 
    (metrics.pendingApprovals * 2) + 
    (metrics.pendingSignatures * 2)
  
  const healthScore = Math.max(60, 100 - scoreDeductions)
  
  // Qualitative label
  let healthLabel = 'Excellent'
  let healthColor = 'text-emerald-400 stroke-emerald-400'
  if (healthScore < 80) {
    healthLabel = 'Needs Attention'
    healthColor = 'text-rose-400 stroke-rose-400'
  } else if (healthScore < 95) {
    healthLabel = 'Good'
    healthColor = 'text-amber-400 stroke-amber-400'
  }

  // Generate dynamic quick insights based on metrics
  const insights = React.useMemo(() => {
    const list: { text: string; type: 'info' | 'warning' | 'success' }[] = []
    
    // Revenue insight
    list.push({
      text: "Revenue increased by 18.2% MTD compared to previous month forecast.",
      type: 'success'
    })

    // Delayed projects insight
    if (metrics.projectsDelayed > 0) {
      list.push({
        text: `${metrics.projectsDelayed} active project${metrics.projectsDelayed > 1 ? 's are' : ' is'} currently flagged as delayed and require immediate review.`,
        type: 'warning'
      })
    } else {
      list.push({
        text: "All active deliverables are currently on schedule.",
        type: 'success'
      })
    }

    // Overdue invoices insight
    if (metrics.invoicesOverdue > 0) {
      list.push({
        text: `You have overdue invoice payments totaling ₹${(metrics.invoicesOverdue / 1000).toFixed(1)}k.`,
        type: 'warning'
      })
    }

    // Pipeline value
    if (metrics.pipelineVal > 200000) {
      list.push({
        text: "Sales pipeline value exceeds monthly targets by 14.5%.",
        type: 'info'
      })
    }

    // Pending approvals
    if (metrics.pendingApprovals > 0 || metrics.pendingSignatures > 0) {
      list.push({
        text: `There are ${metrics.pendingApprovals + metrics.pendingSignatures} pending internal approvals or client signature requirements awaiting signature.`,
        type: 'info'
      })
    }

    return list
  }, [metrics])

  // SVG Circular progress params
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (healthScore / 100) * circumference

  return (
    <Card className="border-gold/20 bg-gradient-to-br from-background via-gold/5 to-muted dark:from-black/40 dark:via-gold/3 dark:to-black/60 shadow-lg relative overflow-hidden">
      <div className="absolute inset-0 bg-noise opacity-[0.02]" />
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gold">
          <Sparkles className="h-4 w-4" /> Founder Business Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Radial Score Gauge */}
          <div className="flex flex-col items-center justify-center border-r border-border/40 pr-6">
            <div className="relative h-28 w-28 flex items-center justify-center">
              <svg className="absolute h-full w-full -rotate-90">
                <circle cx="56" cy="56" r={radius} className="stroke-muted-foreground/10 fill-none" strokeWidth="8" />
                <circle
                  cx="56"
                  cy="56"
                  r={radius}
                  className={`fill-none transition-all duration-500 ${healthColor}`}
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="text-center z-10 flex flex-col items-center justify-center mt-1">
                <p className="text-3xl font-black text-foreground leading-none">{healthScore}</p>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">Health Score</p>
              </div>
            </div>
            <p className="text-xs font-bold mt-2 text-foreground">{healthLabel}</p>
          </div>

          {/* Alert Insights Stream */}
          <div className="col-span-1 md:col-span-2 space-y-2.5">
            <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Quick Action Insights</p>
            <div className="space-y-2 max-h-[120px] overflow-y-auto pr-2">
              {insights.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs p-2 rounded bg-background/80 dark:bg-card/45 border border-border/50 animate-fade-in">
                  {item.type === 'success' && <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" />}
                  {item.type === 'warning' && <AlertTriangle className="h-4 w-4 text-rose-500 dark:text-rose-400 mt-0.5 shrink-0" />}
                  {item.type === 'info' && <Sparkles className="h-4 w-4 text-cyan-400 mt-0.5 shrink-0" />}
                  <span className="text-muted-foreground leading-relaxed">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
