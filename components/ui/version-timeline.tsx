'use client'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import { RotateCcw, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VersionEntry {
  version: number | string
  date: string
  action: string
  by?: string
  canRestore?: boolean
  canDownload?: boolean
}

interface VersionTimelineProps {
  versions: VersionEntry[]
  onRestore?: (version: VersionEntry) => void
  onDownload?: (version: VersionEntry) => void
  className?: string
}

export function VersionTimeline({ versions, onRestore, onDownload, className }: VersionTimelineProps) {
  if (!versions.length) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <p className="text-sm">No version history</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-0', className)}>
      {versions.map((v, i) => (
        <div key={i} className="relative flex gap-3 group">
          {/* Timeline line */}
          {i < versions.length - 1 && (
            <div className="absolute left-[9px] top-6 bottom-0 w-px bg-border" />
          )}

          {/* Dot */}
          <div className="relative z-10 mt-1.5 shrink-0">
            <div className={cn(
              'h-[18px] w-[18px] rounded-full border-2 flex items-center justify-center',
              i === 0
                ? 'border-gold bg-gold/20'
                : 'border-border bg-background'
            )}>
              <div className={cn(
                'h-2 w-2 rounded-full',
                i === 0 ? 'bg-gold' : 'bg-muted-foreground/30'
              )} />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 pb-4">
            <div className="flex items-start justify-between gap-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/20 p-2 -ml-2 transition-all">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{v.action}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                    v{v.version}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground">{formatDate(v.date)}</p>
                  {v.by && <p className="text-xs text-muted-foreground/60">by {v.by}</p>}
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {v.canDownload && onDownload && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-gold" onClick={() => onDownload(v)} title="Download this version">
                    <Download className="h-3 w-3" />
                  </Button>
                )}
                {v.canRestore && onRestore && i !== 0 && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-gold" onClick={() => onRestore(v)} title="Restore this version">
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
