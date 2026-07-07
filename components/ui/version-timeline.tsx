'use client'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import {
  RotateCcw, Download, Plus, Edit3, CheckCircle2, XCircle,
  Upload, MessageSquare, DollarSign, FileSignature, AlertTriangle,
  Eye, Send, Archive, RefreshCw, Lock, User, Clock, ExternalLink,
  Search, SlidersHorizontal, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

// ─── Universal Timeline ──────────────────────────────────────────────────────

export type TimelineActionType =
  | 'created' | 'updated' | 'deleted' | 'approved' | 'rejected'
  | 'signed' | 'paid' | 'sent' | 'uploaded' | 'commented'
  | 'archived' | 'restored' | 'viewed' | 'downloaded' | 'assigned'
  | 'status_changed' | 'note' | 'login' | 'logout' | 'custom'

export interface TimelineEntry {
  id?: string
  action: string
  actionType?: TimelineActionType
  by?: string
  date: string
  status?: string
  comment?: string
  linkedRecord?: { label: string; href: string }
  version?: number | string
  canRestore?: boolean
  canDownload?: boolean
  meta?: Record<string, string>
  module?: string
}

interface UniversalTimelineProps {
  entries: TimelineEntry[]
  onRestore?: (entry: TimelineEntry) => void
  onDownload?: (entry: TimelineEntry) => void
  onComment?: (entry: TimelineEntry, comment: string) => void
  className?: string
  compact?: boolean
  maxItems?: number
  showBorder?: boolean
  enableFilters?: boolean
}

const ACTION_CONFIG: Record<TimelineActionType, { icon: any; color: string; bg: string }> = {
  created:        { icon: Plus,           color: 'text-emerald-400', bg: 'border-emerald-400/60 bg-emerald-500/10' },
  updated:        { icon: Edit3,          color: 'text-blue-400',    bg: 'border-blue-400/60 bg-blue-500/10' },
  deleted:        { icon: XCircle,        color: 'text-red-400',     bg: 'border-red-400/60 bg-red-500/10' },
  approved:       { icon: CheckCircle2,   color: 'text-emerald-400', bg: 'border-emerald-400/60 bg-emerald-500/10' },
  rejected:       { icon: XCircle,        color: 'text-red-400',     bg: 'border-red-400/60 bg-red-500/10' },
  signed:         { icon: FileSignature,  color: 'text-purple-400',  bg: 'border-purple-400/60 bg-purple-500/10' },
  paid:           { icon: DollarSign,     color: 'text-gold',        bg: 'border-gold/60 bg-gold/10' },
  sent:           { icon: Send,           color: 'text-blue-400',    bg: 'border-blue-400/60 bg-blue-500/10' },
  uploaded:       { icon: Upload,         color: 'text-amber-400',   bg: 'border-amber-400/60 bg-amber-500/10' },
  commented:      { icon: MessageSquare,  color: 'text-slate-300',   bg: 'border-slate-400/60 bg-slate-500/10' },
  archived:       { icon: Archive,        color: 'text-slate-400',   bg: 'border-slate-400/60 bg-slate-500/10' },
  restored:       { icon: RotateCcw,      color: 'text-teal-400',    bg: 'border-teal-400/60 bg-teal-500/10' },
  viewed:         { icon: Eye,            color: 'text-slate-400',   bg: 'border-slate-400/40 bg-slate-500/5' },
  downloaded:     { icon: Download,       color: 'text-sky-400',     bg: 'border-sky-400/60 bg-sky-500/10' },
  assigned:       { icon: User,           color: 'text-indigo-400',  bg: 'border-indigo-400/60 bg-indigo-500/10' },
  status_changed: { icon: RefreshCw,      color: 'text-amber-400',   bg: 'border-amber-400/60 bg-amber-500/10' },
  note:           { icon: MessageSquare,  color: 'text-slate-300',   bg: 'border-slate-400/40 bg-slate-500/5' },
  login:          { icon: Lock,           color: 'text-emerald-400', bg: 'border-emerald-400/60 bg-emerald-500/10' },
  logout:         { icon: Lock,           color: 'text-slate-400',   bg: 'border-slate-400/40 bg-slate-500/5' },
  custom:         { icon: Clock,          color: 'text-muted-foreground', bg: 'border-border bg-muted/20' },
}

function inferActionType(action: string): TimelineActionType {
  const a = action.toLowerCase()
  if (a.includes('creat') || a.includes('added') || a.includes('new')) return 'created'
  if (a.includes('updat') || a.includes('edit') || a.includes('modif')) return 'updated'
  if (a.includes('delet') || a.includes('remov')) return 'deleted'
  if (a.includes('approv')) return 'approved'
  if (a.includes('reject') || a.includes('declin')) return 'rejected'
  if (a.includes('sign')) return 'signed'
  if (a.includes('paid') || a.includes('payment')) return 'paid'
  if (a.includes('sent') || a.includes('send')) return 'sent'
  if (a.includes('upload')) return 'uploaded'
  if (a.includes('comment') || a.includes('note') || a.includes('messag')) return 'commented'
  if (a.includes('archiv')) return 'archived'
  if (a.includes('restor')) return 'restored'
  if (a.includes('view') || a.includes('open')) return 'viewed'
  if (a.includes('download')) return 'downloaded'
  if (a.includes('assign')) return 'assigned'
  if (a.includes('status') || a.includes('moved') || a.includes('changed')) return 'status_changed'
  if (a.includes('login') || a.includes('logged in')) return 'login'
  if (a.includes('logout') || a.includes('signed out')) return 'logout'
  return 'custom'
}

export function UniversalTimeline({
  entries,
  onRestore,
  onDownload,
  className,
  compact = false,
  maxItems,
  showBorder = true,
  enableFilters = false,
}: UniversalTimelineProps) {
  const [filterUser, setFilterUser] = useState('')
  const [filterModule, setFilterModule] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [filterActionType, setFilterActionType] = useState('')

  const uniqueUsers = useMemo(() => {
    const users = new Set<string>()
    entries.forEach(e => { if (e.by) users.add(e.by) })
    return Array.from(users)
  }, [entries])

  const uniqueModules = useMemo(() => {
    const mods = new Set<string>()
    entries.forEach(e => {
      const mod = e.module || e.meta?.module || (e.linkedRecord?.href.includes('crm') ? 'CRM' : e.linkedRecord?.href.includes('projects') ? 'Projects' : '')
      if (mod) mods.add(mod)
    })
    return Array.from(mods)
  }, [entries])

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (filterUser && e.by !== filterUser) return false
      if (filterAction && !e.action.toLowerCase().includes(filterAction.toLowerCase())) return false
      if (filterModule) {
        const mod = e.module || e.meta?.module || (e.linkedRecord?.href.includes('crm') ? 'CRM' : e.linkedRecord?.href.includes('projects') ? 'Projects' : '')
        if (mod !== filterModule) return false
      }
      if (filterDate && !e.date.includes(filterDate)) return false
      if (filterActionType) {
        const type = e.actionType || inferActionType(e.action)
        if (type !== filterActionType) return false
      }
      return true
    })
  }, [entries, filterUser, filterAction, filterModule, filterDate, filterActionType])

  const displayEntries = maxItems ? filteredEntries.slice(0, maxItems) : filteredEntries

  return (
    <div className={cn('space-y-4', className)}>
      {enableFilters && (
        <div className="flex flex-col sm:flex-row gap-2 bg-muted/20 p-3 rounded-xl border border-border/50 text-xs mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search actions..."
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-8 pr-2.5 py-1.5 focus:outline-none focus:border-gold text-xs h-8"
              aria-label="Search actions"
            />
          </div>
          {uniqueUsers.length > 0 && (
            <select
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              className="bg-background border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-gold text-xs h-8 text-muted-foreground"
              aria-label="Filter by user"
            >
              <option value="">All Users</option>
              {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          )}
          {uniqueModules.length > 0 && (
            <select
              value={filterModule}
              onChange={e => setFilterModule(e.target.value)}
              className="bg-background border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-gold text-xs h-8 text-muted-foreground"
              aria-label="Filter by module"
            >
              <option value="">All Modules</option>
              {uniqueModules.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <select
            value={filterActionType}
            onChange={e => setFilterActionType(e.target.value)}
            className="bg-background border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-gold text-xs h-8 text-muted-foreground"
            aria-label="Filter by action type"
          >
            <option value="">All Action Types</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="deleted">Deleted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="signed">Signed</option>
            <option value="paid">Paid</option>
            <option value="sent">Sent</option>
            <option value="uploaded">Uploaded</option>
            <option value="commented">Commented</option>
            <option value="assigned">Assigned</option>
            <option value="status_changed">Status Changed</option>
            <option value="note">Note</option>
          </select>
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="bg-background border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-gold text-xs h-8 text-muted-foreground"
            aria-label="Filter by date"
          />
          {(filterUser || filterModule || filterAction || filterDate || filterActionType) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilterUser(''); setFilterModule(''); setFilterAction(''); setFilterDate(''); setFilterActionType('') }}
              className="h-8 px-2 text-muted-foreground hover:text-foreground text-[10px]"
              aria-label="Clear filters"
            >
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
        </div>
      )}

      {!displayEntries.length ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No activity matches the filters</p>
        </div>
      ) : (
        <div className="space-y-0">
      {displayEntries.map((entry, i) => {
        const type = entry.actionType || inferActionType(entry.action)
        const config = ACTION_CONFIG[type] || ACTION_CONFIG.custom
        const Icon = config.icon
        const isLast = i === displayEntries.length - 1

        return (
          <div key={entry.id || i} className="relative flex gap-3 group">
            {/* Vertical line */}
            {!isLast && (
              <div className="absolute left-[14px] top-8 bottom-0 w-px bg-border/60" />
            )}

            {/* Icon dot */}
            <div className="relative z-10 mt-1 shrink-0">
              <div className={cn(
                'h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all',
                config.bg,
                i === 0 ? 'ring-2 ring-gold/20 ring-offset-1 ring-offset-background' : ''
              )}>
                <Icon className={cn('h-3 w-3', config.color)} />
              </div>
            </div>

            {/* Content */}
            <div className={cn('flex-1', compact ? 'pb-3' : 'pb-4')}>
              <div className={cn(
                'rounded-lg transition-all',
                showBorder
                  ? 'border border-transparent hover:border-border/60 hover:bg-muted/10 p-2.5 -ml-1'
                  : 'p-1'
              )}>
                {/* Top row: action + actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={cn('font-medium leading-snug', compact ? 'text-xs' : 'text-sm')}>
                      {entry.action}
                    </p>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      {entry.by && (
                        <span className={cn('text-muted-foreground/70 flex items-center gap-1', compact ? 'text-[10px]' : 'text-xs')}>
                          <User className="h-2.5 w-2.5" />
                          {entry.by}
                        </span>
                      )}
                      <span className={cn('text-muted-foreground/50', compact ? 'text-[10px]' : 'text-xs')}>
                        {formatDate(entry.date)}
                      </span>
                      {entry.version !== undefined && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                          v{entry.version}
                        </span>
                      )}
                      {entry.status && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal capitalize">
                          {entry.status}
                        </Badge>
                      )}
                    </div>

                    {/* Linked record */}
                    {entry.linkedRecord && (
                      <Link
                        href={entry.linkedRecord.href}
                        className="inline-flex items-center gap-1 mt-1 text-[10px] text-gold/70 hover:text-gold transition-colors"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                        {entry.linkedRecord.label}
                      </Link>
                    )}

                    {/* Comment */}
                    {entry.comment && (
                      <div className="mt-1.5 text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1 border-l-2 border-border italic">
                        "{entry.comment}"
                      </div>
                    )}
                  </div>

                  {/* Restore/Download buttons */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {entry.canDownload && onDownload && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-gold"
                        onClick={() => onDownload(entry)}
                        title="Download"
                        aria-label="Download this version"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                    {entry.canRestore && onRestore && i !== 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-gold"
                        onClick={() => onRestore(entry)}
                        title="Restore"
                        aria-label="Restore this version"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
        </div>
      )}
    </div>
  )
}

// ─── Backward-compatible VersionTimeline wrapper ─────────────────────────────

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
  const entries: TimelineEntry[] = versions.map(v => ({
    action: v.action,
    by: v.by,
    date: v.date,
    version: v.version,
    canRestore: v.canRestore,
    canDownload: v.canDownload,
  }))

  return (
    <UniversalTimeline
      entries={entries}
      onRestore={onRestore ? (e) => {
        const original = versions.find(v => v.version === e.version)
        if (original) onRestore(original)
      } : undefined}
      onDownload={onDownload ? (e) => {
        const original = versions.find(v => v.version === e.version)
        if (original) onDownload(original)
      } : undefined}
      className={className}
    />
  )
}
