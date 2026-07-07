'use client'

import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from './button'
import { Badge } from './badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { Maximize2, Minimize2, Download, RefreshCw, AlertTriangle, FileBarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Resizable } from 're-resizable'

interface ChartContainerProps {
  title: string
  description?: string
  loading?: boolean
  error?: string | null
  isEmpty?: boolean
  emptyMessage?: string
  onRetry?: () => void
  onExport?: () => void
  onDateRangeChange?: (range: string) => void
  dateRangeValue?: string
  filterOptions?: { label: string; value: string }[]
  filterValue?: string
  onFilterChange?: (val: string) => void
  children: React.ReactNode
}

export function ChartContainer({
  title,
  description,
  loading = false,
  error = null,
  isEmpty = false,
  emptyMessage = 'No analytical data available for the selected range.',
  onRetry,
  onExport,
  onDateRangeChange,
  dateRangeValue = '6m',
  filterOptions,
  filterValue,
  onFilterChange,
  children
}: ChartContainerProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false)

  const handleFullscreenToggle = () => {
    setIsFullscreen(!isFullscreen)
  }

  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsFullscreen(false)
    }
  }

  React.useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleEsc)
    } else {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleEsc)
    }
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleEsc)
    }
  }, [isFullscreen])

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-[260px] w-full bg-black/5 rounded-lg border border-border/20">
          <RefreshCw className="h-7 w-7 animate-spin text-gold" />
          <span className="mt-2 text-xs text-muted-foreground">Generating metrics...</span>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center text-center h-[260px] p-6 bg-rose-500/5 border border-rose-500/20 rounded-lg w-full">
          <AlertTriangle className="h-7 w-7 text-rose-400 mb-2 animate-bounce" />
          <p className="text-xs font-semibold text-rose-400">Failed to render chart data</p>
          <p className="text-[10px] text-muted-foreground mt-1 max-w-xs">{error}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="mt-4 gap-1 h-7 text-[10px]">
              <RefreshCw className="h-3 w-3" /> Retry Load
            </Button>
          )}
        </div>
      )
    }

    if (isEmpty) {
      return (
        <div className="flex flex-col items-center justify-center text-center h-[260px] p-6 border border-border/20 bg-muted/10 rounded-lg w-full">
          <FileBarChart2 className="h-8 w-8 text-muted-foreground/35 mb-2" />
          <p className="text-xs font-medium text-muted-foreground">{emptyMessage}</p>
        </div>
      )
    }

    return (
      <div className={cn("w-full transition-all duration-300", isFullscreen ? "h-[75vh]" : "h-[240px]")}>
        {children}
      </div>
    )
  }

  const containerContent = (
    <Resizable
      minWidth={200}
      minHeight={200}
      className="z-10 bg-card/60 rounded-xl"
      enable={{ top: true, right: true, bottom: true, left: true, topRight: true, bottomRight: true, bottomLeft: true, topLeft: true }}
    >
      <Card className={cn(
        "w-full h-full border border-border/40 bg-transparent backdrop-blur-sm shadow-sm transition-all duration-300 overflow-auto",
        isFullscreen && "fixed inset-0 z-[9999] w-screen h-screen rounded-none bg-background/95 p-6 flex flex-col justify-between overflow-y-auto"
      )}>
      <CardHeader className={cn("p-4 pb-2 border-b border-border/20", isFullscreen && "px-0 pt-0")}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
              {title}
              {isFullscreen && <Badge variant="gold" className="text-[9px]">Fullscreen View</Badge>}
            </CardTitle>
            {description && <CardDescription className="text-[11px]">{description}</CardDescription>}
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {/* Custom Filter Select */}
            {filterOptions && onFilterChange && (
              <Select value={filterValue} onValueChange={onFilterChange}>
                <SelectTrigger className="h-7 text-[10px] w-28 bg-black/20 border-border/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-[10px]">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Date Range Select */}
            {onDateRangeChange && (
              <Select value={dateRangeValue} onValueChange={onDateRangeChange}>
                <SelectTrigger className="h-7 text-[10px] w-24 bg-black/20 border-border/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3m" className="text-[10px]">Last 3 Months</SelectItem>
                  <SelectItem value="6m" className="text-[10px]">Last 6 Months</SelectItem>
                  <SelectItem value="12m" className="text-[10px]">Last 12 Months</SelectItem>
                  <SelectItem value="ytd" className="text-[10px]">YTD</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Action Buttons */}
            {onExport && !isEmpty && !error && !loading && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onExport} 
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Export Data as CSV"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleFullscreenToggle} 
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("p-4 pt-4 flex-1 flex items-center justify-center", isFullscreen && "px-0 py-6 overflow-hidden")}>
        {renderContent()}
      </CardContent>
      </Card>
    </Resizable>
  )

  return containerContent
}
