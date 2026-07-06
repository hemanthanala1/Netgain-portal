'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KPICardProps {
  title: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
  change?: string | number
  status?: string
  comparison?: string
  tooltip?: string
  sparklineData?: number[]
  loading?: boolean
  onClick?: () => void
}

export function KPICard({
  title,
  value,
  trend = 'neutral',
  change,
  status,
  comparison,
  tooltip,
  sparklineData,
  loading = false,
  onClick
}: KPICardProps) {
  if (loading) {
    return (
      <Card className="relative overflow-hidden border border-border/50 bg-card animate-pulse">
        <CardContent className="p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-3 w-24 bg-muted rounded" />
            <div className="h-4 w-4 bg-muted rounded-full" />
          </div>
          <div className="h-7 w-32 bg-muted rounded" />
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-12 bg-muted rounded" />
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Generate SVG path for sparkline if data is provided
  const renderSparkline = () => {
    if (!sparklineData || sparklineData.length < 2) return null

    const width = 120
    const height = 36
    const padding = 2

    const max = Math.max(...sparklineData)
    const min = Math.min(...sparklineData)
    const range = max - min === 0 ? 1 : max - min

    const points = sparklineData.map((val, index) => {
      const x = padding + (index / (sparklineData.length - 1)) * (width - padding * 2)
      const y = height - padding - ((val - min) / range) * (height - padding * 2)
      return `${x},${y}`
    })

    const pathData = `M ${points.join(' L ')}`
    const isUp = trend === 'up'
    const color = isUp ? 'stroke-emerald-400' : trend === 'down' ? 'stroke-rose-400' : 'stroke-gold'
    const fillColor = isUp ? 'url(#spark-grad-up)' : trend === 'down' ? 'url(#spark-grad-down)' : 'url(#spark-grad-neutral)'

    const areaPoints = [
      `${padding},${height}`,
      ...points,
      `${width - padding},${height}`
    ]
    const areaPathData = `M ${areaPoints.join(' L ')} Z`

    return (
      <svg className="w-24 h-9 shrink-0 overflow-visible" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="spark-grad-up" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="spark-grad-down" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="spark-grad-neutral" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPathData} fill={fillColor} />
        <path d={pathData} fill="none" className={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  const isUp = trend === 'up'
  const isDown = trend === 'down'

  return (
    <Card 
      onClick={onClick}
      className={cn(
        "relative overflow-hidden border border-border/40 bg-card hover:border-border/80 transition-all duration-300",
        onClick && "cursor-pointer hover:shadow-lg active:scale-[0.99] group"
      )}
    >
      <CardContent className="p-5">
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wide">
              <span>{title}</span>
              {tooltip && (
                <div className="relative group/tooltip inline-block">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-help" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 rounded-lg bg-popover border border-border text-[10px] text-popover-foreground leading-normal shadow-md font-medium opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-200 z-50">
                    {tooltip}
                  </div>
                </div>
              )}
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground group-hover:text-gold transition-colors duration-200">{value}</p>
          </div>
          {renderSparkline()}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {change !== undefined && (
              <span className={cn(
                "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold border",
                isUp && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                isDown && "bg-rose-500/10 text-rose-400 border-rose-500/20",
                !isUp && !isDown && "bg-muted text-muted-foreground border-border"
              )}>
                {isUp && <TrendingUp className="h-3 w-3" />}
                {isDown && <TrendingDown className="h-3 w-3" />}
                {change}
              </span>
            )}
            {comparison && (
              <span className="text-xs text-muted-foreground">{comparison}</span>
            )}
          </div>

          {status && (
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border",
              status.toLowerCase().includes('need') || status.toLowerCase().includes('delayed') || status.toLowerCase().includes('overdue')
                ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                : status.toLowerCase().includes('progress') || status.toLowerCase().includes('due')
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
            )}>
              {status}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
