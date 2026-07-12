'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Mail, HelpCircle, CheckCircle2, Clock, AlertTriangle, Zap,
  ChevronRight, MessageSquare, User, Search, Filter, RefreshCw,
  X, Send, Loader2, Archive, Inbox, AlertCircle
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeletons'
import { Drawer } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { UniversalTimeline } from '@/components/ui/version-timeline'
import { formatDate, cn } from '@/lib/utils'
import { KPICard } from '@/components/ui/kpi-card'

interface SupportTicket {
  id: string
  client_id: string
  title: string
  message: string
  created_at: string
  is_read: boolean
  status?: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  assigned_to?: string
  reply?: string
  updated_at?: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  open:        { label: 'Open',        color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',     icon: Inbox },
  in_progress: { label: 'In Progress', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
  resolved:    { label: 'Resolved',    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  closed:      { label: 'Closed',      color: 'text-muted-foreground bg-slate-500/10 border-slate-500/20', icon: Archive },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low:    { label: 'Low',    color: 'text-muted-foreground bg-slate-500/10 border-slate-500/20' },
  medium: { label: 'Medium', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  high:   { label: 'High',   color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  urgent: { label: 'Urgent', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
}

function SupportListContent() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [reply, setReply] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const { toast } = useToast()

  const searchParams = useSearchParams()
  useEffect(() => {
    const q = searchParams.get('search') || searchParams.get('client')
    if (q) setSearch(q)
  }, [searchParams])

  const [staff, setStaff] = useState<any[]>([])
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; ticket: SupportTicket } | null>(null)
  const [peekTicket, setPeekTicket] = useState<SupportTicket | null>(null)
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchStaff = async () => {
      if (isSupabaseConfigured()) {
        const { data } = await supabase.from('profiles').select('id, full_name, email, role')
        setStaff(data || [])
      }
    }
    fetchStaff()
  }, [])

  useEffect(() => {
    const closeMenu = () => setContextMenu(null)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

  async function handleAssign(id: string, assignedTo: string) {
    const assigneeVal = assignedTo === 'unassigned' ? null : assignedTo
    if (isSupabaseConfigured()) {
      await supabase.from('client_notifications').update({ assigned_to: assigneeVal }).eq('id', id)
    }
    setTickets(prev => prev.map(t => t.id === id ? { ...t, assigned_to: assigneeVal || undefined } : t))
    if (selectedTicket?.id === id) setSelectedTicket(prev => prev ? { ...prev, assigned_to: assigneeVal || undefined } : null)
    if (peekTicket?.id === id) setPeekTicket(prev => prev ? { ...prev, assigned_to: assigneeVal || undefined } : null)
    toast({ title: 'Assignee updated successfully' })
  }

  useEffect(() => {
    loadTickets()

    if (!isSupabaseConfigured()) return
    const channel = supabase
      .channel('admin-support-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'client_notifications', filter: 'type=eq.support' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const newTicket = payload.new as SupportTicket
            if (newTicket.client_id !== 'admin') {
              setTickets(prev => [enrichTicket(newTicket), ...prev])
              toast({ title: '🎫 New Support Ticket', description: newTicket.title })
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedTicket = payload.new as SupportTicket
            setTickets(prev => prev.map(t => t.id === updatedTicket.id ? enrichTicket(updatedTicket) : t))
            if (selectedTicket?.id === updatedTicket.id) {
              setSelectedTicket(enrichTicket(updatedTicket))
            }
          } else if (payload.eventType === 'DELETE') {
            setTickets(prev => prev.filter(t => t.id !== payload.old.id))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  function enrichTicket(t: any): SupportTicket {
    return {
      ...t,
      status: t.status || 'open',
      priority: t.priority || 'medium',
    }
  }

  async function loadTickets() {
    if (!isSupabaseConfigured()) { setLoading(false); return }
    const { data, error } = await supabase
      .from('client_notifications')
      .select('*')
      .eq('type', 'support')
      .neq('client_id', 'admin')
      .order('created_at', { ascending: false })
    if (error) {
      toast({ title: 'Failed to load tickets', description: error.message, variant: 'destructive' })
    } else if (data) {
      setTickets(data.map(enrichTicket))
    }
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    setUpdatingStatus(true)
    if (isSupabaseConfigured()) {
      await supabase.from('client_notifications').update({ status, is_read: true }).eq('id', id)
    }
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: status as any, is_read: true } : t))
    if (selectedTicket?.id === id) setSelectedTicket(prev => prev ? { ...prev, status: status as any } : null)
    toast({ title: `Ticket marked as ${STATUS_CONFIG[status]?.label || status}` })
    setUpdatingStatus(false)
  }

  async function sendReply(ticketId: string) {
    if (!reply.trim()) return
    setSubmitting(true)
    if (isSupabaseConfigured()) {
      await supabase.from('client_notifications').update({
        reply: reply.trim(),
        status: 'in_progress',
        is_read: true
      }).eq('id', ticketId)
    }
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, reply: reply.trim(), status: 'in_progress', is_read: true } : t))
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, reply: reply.trim(), status: 'in_progress' } : null)
    }
    setReply('')
    toast({ title: 'Reply sent to client' })
    setSubmitting(false)
  }

  const filtered = useMemo(() => {
    return tickets.filter(t => {
      if (statusFilter !== 'all' && (t.status || 'open') !== statusFilter) return false
      if (priorityFilter !== 'all' && (t.priority || 'medium') !== priorityFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!t.title.toLowerCase().includes(q) && !t.client_id.toLowerCase().includes(q) && !t.message.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [tickets, statusFilter, priorityFilter, search])

  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => (t.status || 'open') === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    urgent: tickets.filter(t => t.priority === 'urgent').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
  }), [tickets])

  function getTimeline(ticket: SupportTicket) {
    const entries: any[] = [{ action: 'Ticket submitted by client', actionType: 'created' as const, by: ticket.client_id, date: ticket.created_at }]
    if (ticket.is_read) entries.push({ action: 'Ticket opened by support team', actionType: 'viewed' as const, by: 'Support Team', date: ticket.updated_at || ticket.created_at })
    if (ticket.reply) entries.push({ action: 'Reply sent to client', actionType: 'sent' as const, comment: ticket.reply, by: 'Support Team', date: ticket.updated_at || ticket.created_at })
    if (ticket.status === 'resolved') entries.push({ action: 'Ticket resolved', actionType: 'approved' as const, by: 'Support Team', date: ticket.updated_at || ticket.created_at })
    if (ticket.status === 'closed') entries.push({ action: 'Ticket closed', actionType: 'archived' as const, by: 'Support Team', date: ticket.updated_at || ticket.created_at })
    return entries
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Tickets"
        description="Manage client support requests, track resolutions, and reply from a single workspace."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Support Tickets' }
        ]}
        primaryAction={{
          label: 'Refresh',
          onClick: () => loadTickets(),
          icon: RefreshCw,
          variant: 'outline'
        }}
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-4 gap-4">
        <KPICard title="Total Tickets" value={stats.total} />
        <KPICard title="Open" value={stats.open} trend={stats.open > 0 ? 'down' : undefined} status={stats.open > 0 ? 'needs attention' : undefined} change={stats.open > 0 ? stats.open : undefined} />
        <KPICard title="Urgent" value={stats.urgent} />
        <KPICard title="Resolved" value={stats.resolved} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-card rounded-xl border border-border/50">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9 bg-background/50 border-border/60 text-xs"
            placeholder="Search tickets, clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-40 text-xs border-border/60 bg-background/30">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-9 w-40 text-xs border-border/60 bg-background/30">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || statusFilter !== 'all' || priorityFilter !== 'all') && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setSearch(''); setStatusFilter('all'); setPriorityFilter('all') }}>
            <X className="h-3.5 w-3.5 mr-1" /> Reset
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} of {tickets.length} tickets</span>
      </div>

      {/* Ticket List */}
      {loading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Mail}
          title={tickets.length === 0 ? 'No support tickets' : 'No tickets match filters'}
          description={tickets.length === 0 ? 'Support requests from clients will appear here in real time.' : 'Try adjusting your filters or search query.'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(ticket => {
            const status = ticket.status || 'open'
            const priority = ticket.priority || 'medium'
            const statusCfg = STATUS_CONFIG[status]
            const priorityCfg = PRIORITY_CONFIG[priority]
            const StatusIcon = statusCfg.icon

            return (
              <Card
                key={ticket.id}
                className={cn(
                  'bg-card border-border/50 hover:border-border transition-all cursor-pointer group select-none',
                  !ticket.is_read && 'border-gold/30 shadow-[0_0_15px_rgba(212,175,55,0.07)]'
                )}
                onClick={() => setSelectedTicket(ticket)}
                onContextMenu={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  setContextMenu({ x: e.clientX, y: e.clientY, ticket })
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div onClick={e => e.stopPropagation()} className="pt-1 shrink-0">
                      <input 
                        type="checkbox" 
                        checked={selectedTicketIds.has(ticket.id)}
                        onChange={() => {
                          setSelectedTicketIds(prev => {
                            const next = new Set(prev)
                            if (next.has(ticket.id)) next.delete(ticket.id)
                            else next.add(ticket.id)
                            return next
                          })
                        }}
                        className="h-4 w-4 rounded border-border/60 bg-card text-gold focus:ring-gold cursor-pointer"
                        aria-label={`Select ticket: ${ticket.title}`}
                      />
                    </div>
                    <div className={cn('w-1 self-stretch rounded-full shrink-0', {
                      'bg-slate-500': priority === 'low',
                      'bg-blue-500': priority === 'medium',
                      'bg-amber-500': priority === 'high',
                      'bg-red-500': priority === 'urgent',
                    })} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground truncate">{ticket.title}</p>
                            {!ticket.is_read && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold font-semibold border border-gold/25">NEW</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <User className="h-3 w-3 text-muted-foreground/60" />
                            <a href={`/crm?search=${encodeURIComponent(ticket.client_id)}`} className="text-xs text-muted-foreground hover:text-gold transition-colors hover:underline decoration-dotted">{ticket.client_id}</a>
                            <span className="text-[10px] text-muted-foreground/40">·</span>
                            <span className="text-[10px] text-muted-foreground/60">{formatDate(ticket.created_at)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2">{ticket.message}</p>
                          {ticket.reply && (
                            <div className="mt-2 flex items-start gap-1.5 text-xs text-emerald-400/80">
                              <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" />
                              <span className="line-clamp-1 italic">"{ticket.reply}"</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                          <Select value={status} onValueChange={(v) => updateStatus(ticket.id, v)}>
                            <SelectTrigger className={cn('h-7 text-[10px] border px-2 py-0 w-28 bg-card', statusCfg.color)}>
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                <SelectItem key={key} value={key} className="text-xs">{cfg.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select value={ticket.assigned_to || 'unassigned'} onValueChange={(v) => handleAssign(ticket.id, v)}>
                            <SelectTrigger className="h-7 text-[10px] border border-border/60 bg-card text-muted-foreground w-28 px-2 py-0">
                              <SelectValue placeholder="Assignee" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
                              {staff.map(s => (
                                <SelectItem key={s.id} value={s.id} className="text-xs">{s.full_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Badge variant="outline" className={cn('text-[10px] border w-28 justify-center', priorityCfg.color)}>
                            {priorityCfg.label}
                          </Badge>
                        </div>
                      </div>

                      {/* Quick status actions */}
                      <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-border/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        {status !== 'in_progress' && status !== 'resolved' && status !== 'closed' && (
                          <Button size="sm" variant="outline" className="h-7 text-[10px] border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                            onClick={e => { e.stopPropagation(); updateStatus(ticket.id, 'in_progress') }}>
                            <Clock className="h-3 w-3 mr-1" /> In Progress
                          </Button>
                        )}
                        {status !== 'resolved' && status !== 'closed' && (
                          <Button size="sm" variant="outline" className="h-7 text-[10px] border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                            onClick={e => { e.stopPropagation(); updateStatus(ticket.id, 'resolved') }}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Resolve
                          </Button>
                        )}
                        {status !== 'closed' && (
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] text-muted-foreground hover:text-muted-foreground"
                            onClick={e => { e.stopPropagation(); updateStatus(ticket.id, 'closed') }}>
                            <Archive className="h-3 w-3 mr-1" /> Close
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] text-gold ml-auto"
                          onClick={e => { e.stopPropagation(); setSelectedTicket(ticket) }}>
                          View Details <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Ticket Detail Drawer */}
      <Drawer
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        title={selectedTicket?.title || 'Ticket Detail'}
        widthClass="max-w-2xl"
      >
        {selectedTicket && (
          <div className="space-y-6 p-1">
            {/* Header Meta */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn('text-xs border', STATUS_CONFIG[selectedTicket.status || 'open'].color)}>
                {STATUS_CONFIG[selectedTicket.status || 'open'].label}
              </Badge>
              <Badge variant="outline" className={cn('text-xs border', PRIORITY_CONFIG[selectedTicket.priority || 'medium'].color)}>
                {PRIORITY_CONFIG[selectedTicket.priority || 'medium'].label} Priority
              </Badge>
              <span className="text-xs text-muted-foreground ml-auto">{formatDate(selectedTicket.created_at)}</span>
            </div>

            {/* Client Info */}
            <div className="flex items-center gap-3 p-3 bg-muted/10 rounded-lg border border-border/40">
              <div className="h-9 w-9 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-bold text-sm">
                {selectedTicket.client_id[0]?.toUpperCase() || 'C'}
              </div>
              <div>
                <a href={`/crm?search=${encodeURIComponent(selectedTicket.client_id)}`} className="text-sm font-semibold hover:text-gold transition-colors hover:underline decoration-dotted">{selectedTicket.client_id}</a>
                <p className="text-xs text-muted-foreground">Client ID</p>
              </div>
            </div>

            {/* Original Message */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Original Message</Label>
              <div className="bg-black/20 p-4 rounded-lg border border-border/40 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {selectedTicket.message}
              </div>
            </div>

            {/* Existing Reply */}
            {selectedTicket.reply && (
              <div>
                <Label className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wide mb-2 block">Your Reply (Sent)</Label>
                <div className="bg-emerald-500/5 p-4 rounded-lg border border-emerald-500/20 text-sm text-muted-foreground whitespace-pre-wrap italic leading-relaxed">
                  "{selectedTicket.reply}"
                </div>
              </div>
            )}

            {/* Status Actions */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Update Status</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                  const Icon = cfg.icon
                  return (
                    <Button
                      key={key}
                      size="sm"
                      variant="outline"
                      disabled={updatingStatus || (selectedTicket.status || 'open') === key}
                      className={cn(
                        'h-8 text-xs gap-1.5',
                        (selectedTicket.status || 'open') === key && 'border-gold/40 text-gold bg-gold/5'
                      )}
                      onClick={() => updateStatus(selectedTicket.id, key)}
                    >
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Reply Box */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                {selectedTicket.reply ? 'Send Follow-Up Reply' : 'Send Reply to Client'}
              </Label>
              <Textarea
                rows={4}
                placeholder="Type your reply to the client..."
                value={reply}
                onChange={e => setReply(e.target.value)}
                className="bg-background/50 border-border/60 text-sm resize-none focus-visible:ring-gold"
              />
              <div className="flex items-center justify-end gap-2 mt-2">
                <Button
                  variant="gold"
                  size="sm"
                  disabled={submitting || !reply.trim()}
                  onClick={() => sendReply(selectedTicket.id)}
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-2" />}
                  Send Reply
                </Button>
              </div>
            </div>

            {/* Activity Timeline */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">Ticket Timeline</Label>
              <UniversalTimeline entries={getTimeline(selectedTicket)} compact enableFilters={true} />
            </div>
          </div>
        )}
      </Drawer>

      {contextMenu && (
        <div 
          className="fixed z-50 min-w-40 overflow-hidden rounded-md border border-border bg-[#040d0a] p-1 text-popover-foreground shadow-md animate-in fade-in-50 zoom-in-95"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Quick Actions</div>
          <div className="h-px bg-border my-1" />
          <button 
            onClick={() => { updateStatus(contextMenu.ticket.id, 'in_progress'); setContextMenu(null) }}
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-gold/10 hover:text-gold transition-colors text-left"
          >
            In Progress
          </button>
          <button 
            onClick={() => { updateStatus(contextMenu.ticket.id, 'resolved'); setContextMenu(null) }}
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-gold/10 hover:text-gold transition-colors text-left"
          >
            Resolve Ticket
          </button>
          <button 
            onClick={() => { updateStatus(contextMenu.ticket.id, 'closed'); setContextMenu(null) }}
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-gold/10 hover:text-gold transition-colors text-left"
          >
            Close Ticket
          </button>
          <div className="h-px bg-border my-1" />
          <button 
            onClick={() => { setPeekTicket(contextMenu.ticket); setContextMenu(null) }}
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs font-semibold text-gold outline-none hover:bg-gold/10 hover:text-gold transition-colors text-left"
          >
            👁 Peek Details
          </button>
        </div>
      )}

      {/* Peek Ticket Dialog */}
      <Dialog open={!!peekTicket} onOpenChange={(open) => !open && setPeekTicket(null)}>
        <DialogContent className="bg-[#040d0a] border-border text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-gold text-base flex items-center gap-1.5"><HelpCircle className="h-5 w-5" /> Ticket Peek</DialogTitle>
          </DialogHeader>
          {peekTicket && (
            <div className="space-y-4 py-2 text-xs">
              <div>
                <h4 className="font-bold text-sm text-foreground mb-1">{peekTicket.title}</h4>
                <p className="text-muted-foreground">From: {peekTicket.client_id}</p>
              </div>
              <div className="bg-card p-3 rounded-lg border border-border/40 max-h-36 overflow-y-auto whitespace-pre-wrap">
                {peekTicket.message}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Status</Label>
                  <Select value={peekTicket.status} onValueChange={(val) => {
                    updateStatus(peekTicket.id, val)
                    setPeekTicket(prev => prev ? { ...prev, status: val as any } : null)
                  }}>
                    <SelectTrigger className="h-8 mt-1 text-xs bg-background/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key} className="text-xs">{cfg.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Assignee</Label>
                  <Select value={peekTicket.assigned_to || 'unassigned'} onValueChange={(val) => {
                    handleAssign(peekTicket.id, val)
                    setPeekTicket(prev => prev ? { ...prev, assigned_to: val === 'unassigned' ? undefined : val } : null)
                  }}>
                    <SelectTrigger className="h-8 mt-1 text-xs bg-background/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
                      {staff.map(s => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">{s.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPeekTicket(null)}>Close</Button>
            <Button variant="gold" size="sm" onClick={() => { setSelectedTicket(peekTicket); setPeekTicket(null) }}>Open Full Drawer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Bulk Action Bar */}
      {selectedTicketIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#040d0a]/95 border border-gold/40 rounded-xl px-4 py-3 flex items-center gap-4 shadow-2xl animate-in slide-in-from-bottom-5">
          <span className="text-xs font-semibold text-gold">{selectedTicketIds.size} tickets selected</span>
          <div className="h-4 w-px bg-border/60" />
          <Button 
            size="sm" 
            variant="outline" 
            className="h-8 text-xs border-amber-500/20 text-amber-400 hover:bg-amber-500/10"
            onClick={async () => {
              const ids = Array.from(selectedTicketIds)
              if (isSupabaseConfigured()) {
                await supabase.from('client_notifications').update({ status: 'in_progress', is_read: true }).in('id', ids)
              }
              setTickets(prev => prev.map(t => ids.includes(t.id) ? { ...t, status: 'in_progress', is_read: true } : t))
              setSelectedTicketIds(new Set())
              toast({ title: 'Selected tickets marked In Progress' })
            }}
          >
            In Progress
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-8 text-xs border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
            onClick={async () => {
              const ids = Array.from(selectedTicketIds)
              if (isSupabaseConfigured()) {
                await supabase.from('client_notifications').update({ status: 'resolved', is_read: true }).in('id', ids)
              }
              setTickets(prev => prev.map(t => ids.includes(t.id) ? { ...t, status: 'resolved', is_read: true } : t))
              setSelectedTicketIds(new Set())
              toast({ title: 'Selected tickets marked Resolved' })
            }}
          >
            Resolve
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={async () => {
              const ids = Array.from(selectedTicketIds)
              if (isSupabaseConfigured()) {
                await supabase.from('client_notifications').update({ status: 'closed', is_read: true }).in('id', ids)
              }
              setTickets(prev => prev.map(t => ids.includes(t.id) ? { ...t, status: 'closed', is_read: true } : t))
              setSelectedTicketIds(new Set())
              toast({ title: 'Selected tickets marked Closed' })
            }}
          >
            Close
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={async () => {
              const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedTicketIds.size} tickets?`)
              if (!confirmDelete) return
              const ids = Array.from(selectedTicketIds)
              if (isSupabaseConfigured()) {
                await supabase.from('client_notifications').delete().in('id', ids)
              }
              setTickets(prev => prev.filter(t => !ids.includes(t.id)))
              setSelectedTicketIds(new Set())
              toast({ title: 'Selected tickets deleted successfully' })
            }}
          >
            Delete
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setSelectedTicketIds(new Set())}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}

export default function SupportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><div className="h-6 w-6 rounded-full border-2 border-gold/30 border-t-gold animate-spin" /></div>}>
      <SupportListContent />
    </Suspense>
  )
}
