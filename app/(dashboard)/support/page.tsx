'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Mail, HelpCircle, CheckCircle2, Clock, AlertTriangle, Zap,
  ChevronRight, MessageSquare, User, Search, Filter, RefreshCw,
  X, Send, Loader2, Archive, Inbox, AlertCircle, Plus, ExternalLink,
  Calendar, FileText, ClipboardList, Check, History, Download, AlignLeft, Info, Cloud
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeletons'
import { Drawer } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { formatDate, cn } from '@/lib/utils'
import { KPICard } from '@/components/ui/kpi-card'

interface SupportTicket {
  id: string
  client_id: string
  title: string
  message: string
  created_at: string
  is_read: boolean
  status?: string
  priority?: string
  assigned_to?: string
  reply?: string
  updated_at?: string
  project_id?: string
  request_type?: string
  internal_notes?: string
  attachments?: any[]
  timeline?: any[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  open:               { label: 'Open',               color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',     icon: Inbox },
  assigned:           { label: 'Assigned',           color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',         icon: User },
  in_progress:        { label: 'In Progress',        color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
  waiting_for_client: { label: 'Waiting for Client', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', icon: HelpCircle },
  waiting_for_team:   { label: 'Waiting for Team',   color: 'text-pink-400 bg-pink-500/10 border-pink-500/20',     icon: AlertCircle },
  testing:            { label: 'Testing',            color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', icon: Zap },
  resolved:           { label: 'Resolved',           color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  closed:             { label: 'Closed',             color: 'text-muted-foreground bg-slate-500/10 border-slate-500/20', icon: Archive },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low:      { label: 'Low',      color: 'text-muted-foreground bg-slate-500/10 border-slate-500/20' },
  medium:   { label: 'Medium',   color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  high:     { label: 'High',     color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  urgent:   { label: 'Urgent',   color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  critical: { label: 'Critical', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
}

function SupportListContent() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  
  // Advanced filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')

  // Selected ticket and drawer
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [activeDrawerTab, setActiveDrawerTab] = useState<'conversation' | 'internal_notes' | 'attachments' | 'timeline'>('conversation')
  const [reply, setReply] = useState('')
  const [requestClientReply, setRequestClientReply] = useState(false)
  const [internalNotesText, setInternalNotesText] = useState('')
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  // Modals for quick actions
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [isReqModalOpen, setIsReqModalOpen] = useState(false)
  const [targetProjId, setTargetProjId] = useState('')
  const [quickTitle, setQuickTitle] = useState('')
  const [quickCategory, setQuickCategory] = useState('Functional')

  const [submitting, setSubmitting] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const { toast } = useToast()

  const searchParams = useSearchParams()
  useEffect(() => {
    const q = searchParams.get('search') || searchParams.get('client')
    if (q) setSearch(q)
  }, [searchParams])

  const [staff, setStaff] = useState<any[]>([])
  const [projectsList, setProjectsList] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set())

  // Load profiles, projects and current user
  useEffect(() => {
    const initData = async () => {
      if (isSupabaseConfigured()) {
        const { data: staffData } = await supabase.from('profiles').select('id, full_name, email, role')
        setStaff(staffData || [])

        const { data: projs } = await supabase.from('projects').select('id, title, client')
        setProjectsList(projs || [])

        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUser(user)
      }
    }
    initData()
  }, [])

  // Load and subscribe to tickets
  useEffect(() => {
    loadTickets()

    if (!isSupabaseConfigured()) return
    const channel = supabase
      .channel('admin-support-tickets-channel')
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
  }, [selectedTicket])

  // Load conversational messages for selected ticket
  useEffect(() => {
    if (selectedTicket) {
      fetchTicketMessages(selectedTicket.id)
      setInternalNotesText(selectedTicket.internal_notes || '')
      setTargetProjId(selectedTicket.project_id || '')
      setQuickTitle(selectedTicket.title)

      const channel = supabase
        .channel(`admin-drawer-messages-${selectedTicket.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${selectedTicket.id}` },
          (payload) => {
            setChatMessages(prev => {
              if (prev.some(m => m.id === payload.new.id)) return prev
              return [...prev, payload.new]
            })
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [selectedTicket])

  function enrichTicket(t: any): SupportTicket {
    return {
      ...t,
      status: t.status || 'open',
      priority: t.priority || 'medium',
      attachments: t.attachments || [],
      timeline: t.timeline || []
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

  const fetchTicketMessages = async (ticketId: string) => {
    setLoadingMessages(true)
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
      if (!error && data) {
        setChatMessages(data)
      }
    } catch (err) {
      console.error('Error loading ticket messages:', err)
    } finally {
      setLoadingMessages(false)
    }
  }

  // Update Status
  async function updateStatus(id: string, status: string) {
    setUpdatingStatus(true)
    const activeStaff = staff.find(s => s.id === currentUser?.id)
    const byName = activeStaff ? activeStaff.full_name : 'Staff'

    const ticket = tickets.find(t => t.id === id)
    const updatedTimeline = [
      ...(ticket?.timeline || []),
      { event: `Status changed to ${status}`, date: new Date().toISOString(), by: byName, notes: `Updated by ${byName}` }
    ]

    if (isSupabaseConfigured()) {
      await supabase.from('client_notifications').update({ 
        status, 
        is_read: true,
        timeline: updatedTimeline,
        updated_at: new Date().toISOString()
      }).eq('id', id)
    }
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status, is_read: true, timeline: updatedTimeline } : t))
    if (selectedTicket?.id === id) setSelectedTicket(prev => prev ? { ...prev, status, timeline: updatedTimeline } : null)
    toast({ title: `Ticket marked as ${STATUS_CONFIG[status]?.label || status}` })
    setUpdatingStatus(false)
  }

  // Assign Ticket
  async function handleAssign(id: string, assignedTo: string) {
    const assigneeVal = assignedTo === 'unassigned' ? null : assignedTo
    const activeStaff = staff.find(s => s.id === currentUser?.id)
    const byName = activeStaff ? activeStaff.full_name : 'Staff'
    const assigneeName = assignedTo === 'unassigned' ? 'Unassigned' : (staff.find(s => s.id === assignedTo)?.full_name || 'Staff')

    const ticket = tickets.find(t => t.id === id)
    const updatedTimeline = [
      ...(ticket?.timeline || []),
      { event: `Assigned to ${assigneeName}`, date: new Date().toISOString(), by: byName, notes: `Assigned to ${assigneeName}` }
    ]

    const newStatus = assigneeVal ? 'assigned' : 'open'

    if (isSupabaseConfigured()) {
      await supabase.from('client_notifications').update({ 
        assigned_to: assigneeVal,
        status: newStatus,
        timeline: updatedTimeline,
        updated_at: new Date().toISOString()
      }).eq('id', id)
    }
    setTickets(prev => prev.map(t => t.id === id ? { ...t, assigned_to: assigneeVal || undefined, status: newStatus, timeline: updatedTimeline } : t))
    if (selectedTicket?.id === id) setSelectedTicket(prev => prev ? { ...prev, assigned_to: assigneeVal || undefined, status: newStatus, timeline: updatedTimeline } : null)
    toast({ title: `Assigned to ${assigneeName}` })
  }

  // Update Priority
  async function handleUpdatePriority(id: string, priority: string) {
    const activeStaff = staff.find(s => s.id === currentUser?.id)
    const byName = activeStaff ? activeStaff.full_name : 'Staff'

    const ticket = tickets.find(t => t.id === id)
    const updatedTimeline = [
      ...(ticket?.timeline || []),
      { event: `Priority updated to ${priority}`, date: new Date().toISOString(), by: byName, notes: `Priority set to ${priority}` }
    ]

    if (isSupabaseConfigured()) {
      await supabase.from('client_notifications').update({ 
        priority,
        timeline: updatedTimeline,
        updated_at: new Date().toISOString()
      }).eq('id', id)
    }
    setTickets(prev => prev.map(t => t.id === id ? { ...t, priority, timeline: updatedTimeline } : t))
    if (selectedTicket?.id === id) setSelectedTicket(prev => prev ? { ...prev, priority, timeline: updatedTimeline } : null)
    toast({ title: `Priority set to ${priority}` })
  }

  // Send Conversational Reply
  async function handleSendReply() {
    if (!selectedTicket || !reply.trim()) return
    setSubmitting(true)
    try {
      const activeStaff = staff.find(s => s.id === currentUser?.id)
      const senderName = activeStaff ? activeStaff.full_name : 'Netgain Support Team'

      const { error: msgErr } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: currentUser?.id || 'admin',
          sender_name: senderName,
          sender_role: 'team',
          message: reply.trim()
        })

      if (msgErr) throw msgErr

      const targetStatus = requestClientReply ? 'waiting_for_client' : 'in_progress'
      const updatedTimeline = [
        ...(selectedTicket.timeline || []),
        { event: 'Team reply', date: new Date().toISOString(), by: senderName, notes: reply.slice(0, 60) }
      ]

      await supabase
        .from('client_notifications')
        .update({
          reply: reply.trim(),
          status: targetStatus,
          is_read: true,
          updated_at: new Date().toISOString(),
          timeline: updatedTimeline
        })
        .eq('id', selectedTicket.id)

      setReply('')
      setRequestClientReply(false)

      const updated = { 
        ...selectedTicket, 
        reply: reply.trim(), 
        status: targetStatus, 
        timeline: updatedTimeline 
      }
      setSelectedTicket(updated)
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updated : t))

      // Push notify client
      fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'client',
          clientEmailOrCompany: selectedTicket.client_id,
          payload: {
            title: `💬 Reply on support ticket: ${selectedTicket.title}`,
            body: reply.slice(0, 80),
            url: '/client/dashboard?tab=support',
            type: 'support',
            tag: `ticket-reply-${selectedTicket.id}`
          }
        })
      }).catch(console.warn)

      toast({ title: 'Reply sent and client notified' })
    } catch (err: any) {
      toast({ title: 'Failed to send reply', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  // Save Internal Notes
  async function handleSaveInternalNotes() {
    if (!selectedTicket) return
    setSubmitting(true)
    try {
      await supabase
        .from('client_notifications')
        .update({ internal_notes: internalNotesText })
        .eq('id', selectedTicket.id)

      setSelectedTicket(prev => prev ? { ...prev, internal_notes: internalNotesText } : null)
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, internal_notes: internalNotesText } : t))
      toast({ title: 'Internal Notes Saved' })
    } catch (err: any) {
      toast({ title: 'Failed to save notes', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  // Quick Action: Convert to Task (Milestone)
  async function handleConvertTaskSubmit() {
    if (!selectedTicket || !quickTitle.trim() || !targetProjId) return
    setSubmitting(true)
    try {
      const { data: projData, error: projErr } = await supabase
        .from('projects')
        .select('*')
        .eq('id', targetProjId)
        .single()
      if (projErr) throw projErr

      let stackData: any = { type: 'Web Development', budget: 0, spent: 0, timeline: '', progress: 0, milestones: [] }
      if (projData.stack) {
        try {
          stackData = JSON.parse(projData.stack)
        } catch (e) {
          console.error(e)
        }
      }

      if (!Array.isArray(stackData.milestones)) stackData.milestones = []
      
      const newMilestone = `${quickTitle.trim()} (Ticket #${selectedTicket.id.slice(0, 8)}) ⏳`
      stackData.milestones.push(newMilestone)

      const completedCount = stackData.milestones.filter((m: string) => m.endsWith(' ✅')).length
      stackData.progress = Math.round((completedCount / stackData.milestones.length) * 100) || 0

      const { error: updateErr } = await supabase
        .from('projects')
        .update({ stack: JSON.stringify(stackData) })
        .eq('id', targetProjId)

      if (updateErr) throw updateErr

      const activeStaff = staff.find(s => s.id === currentUser?.id)
      const byName = activeStaff ? activeStaff.full_name : 'Staff'

      const updatedTimeline = [
        ...(selectedTicket.timeline || []),
        { event: 'Converted to project milestone task', date: new Date().toISOString(), by: byName, notes: `Milestone added in ${projData.title}` }
      ]

      await supabase
        .from('client_notifications')
        .update({ timeline: updatedTimeline, project_id: targetProjId })
        .eq('id', selectedTicket.id)

      await supabase.from('project_activity_timeline').insert({
        project_id: targetProjId,
        user_name: byName,
        action: 'Support Ticket Converted to Milestone',
        notes: quickTitle.trim()
      })

      const enriched = enrichTicket({ ...selectedTicket, project_id: targetProjId, timeline: updatedTimeline })
      setSelectedTicket(enriched)
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? enriched : t))

      toast({ title: 'Converted successfully', description: `Task milestone added to project: ${projData.title}` })
      setIsTaskModalOpen(false)
    } catch (err: any) {
      toast({ title: 'Conversion failed', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  // Quick Action: Convert to Requirement
  async function handleConvertRequirementSubmit() {
    if (!selectedTicket || !quickTitle.trim() || !targetProjId) return
    setSubmitting(true)
    try {
      const { error: reqErr } = await supabase
        .from('project_requirements')
        .insert({
          project_id: targetProjId,
          title: quickTitle.trim(),
          description: selectedTicket.message,
          category: quickCategory,
          priority: selectedTicket.priority || 'medium',
          status: 'pending'
        })

      if (reqErr) throw reqErr

      const activeStaff = staff.find(s => s.id === currentUser?.id)
      const byName = activeStaff ? activeStaff.full_name : 'Staff'

      const updatedTimeline = [
        ...(selectedTicket.timeline || []),
        { event: 'Converted to Project Requirement', date: new Date().toISOString(), by: byName, notes: `Requirement: ${quickTitle.trim()}` }
      ]

      await supabase
        .from('client_notifications')
        .update({ timeline: updatedTimeline, project_id: targetProjId })
        .eq('id', selectedTicket.id)

      const enriched = enrichTicket({ ...selectedTicket, project_id: targetProjId, timeline: updatedTimeline })
      setSelectedTicket(enriched)
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? enriched : t))

      toast({ title: 'Converted to Requirement', description: 'Listed under project requirements tab.' })
      setIsReqModalOpen(false)
    } catch (err: any) {
      toast({ title: 'Failed to convert', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  // Fetch all unique clients for filter dropdown
  const clientsList = useMemo(() => {
    return Array.from(new Set(tickets.map(t => t.client_id))).filter(Boolean)
  }, [tickets])

  // Filter tickets
  const filtered = useMemo(() => {
    return tickets.filter(t => {
      if (statusFilter !== 'all' && (t.status || 'open') !== statusFilter) return false
      if (priorityFilter !== 'all' && (t.priority || 'medium') !== priorityFilter) return false
      if (clientFilter !== 'all' && t.client_id !== clientFilter) return false
      if (projectFilter !== 'all' && t.project_id !== projectFilter) return false
      if (assigneeFilter !== 'all' && (t.assigned_to || 'unassigned') !== assigneeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          t.title.toLowerCase().includes(q) ||
          t.client_id.toLowerCase().includes(q) ||
          t.message.toLowerCase().includes(q) ||
          (t.request_type || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [tickets, statusFilter, priorityFilter, clientFilter, projectFilter, assigneeFilter, search])

  // Compute stats
  const stats = useMemo(() => {
    const openCount = tickets.filter(t => !['resolved', 'closed'].includes(t.status || 'open')).length
    const meCount = currentUser ? tickets.filter(t => t.assigned_to === currentUser.id).length : 0
    const waitClient = tickets.filter(t => t.status === 'waiting_for_client').length
    const waitTeam = tickets.filter(t => t.status === 'waiting_for_team' || t.status === 'open').length
    const urgentCount = tickets.filter(t => t.priority === 'urgent' || t.priority === 'critical').length
    
    // Urgent tickets > 24 hours old without action
    const overdueCount = tickets.filter(t => {
      if (t.priority !== 'urgent' && t.priority !== 'critical') return false
      if (['resolved', 'closed'].includes(t.status || 'open')) return false
      const createdTime = new Date(t.created_at).getTime()
      const elapsedHours = (Date.now() - createdTime) / (1000 * 60 * 60)
      return elapsedHours > 24
    }).length

    return {
      total: tickets.length,
      open: openCount,
      assignedToMe: meCount,
      waitingForClient: waitClient,
      waitingForTeam: waitTeam,
      urgent: urgentCount,
      overdue: overdueCount
    }
  }, [tickets, currentUser])

  // Collate all attachments (from original ticket + conversational thread)
  const collatedAttachments = useMemo(() => {
    if (!selectedTicket) return []
    const list = [...(selectedTicket.attachments || [])]
    chatMessages.forEach(msg => {
      if (msg.attachments && Array.isArray(msg.attachments)) {
        list.push(...msg.attachments)
      }
    })
    return list
  }, [selectedTicket, chatMessages])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Workspace"
        description="Redesigned ticket queue system. Perform conversation threads, convert tickets, and link project milestones."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Support Center' }
        ]}
        primaryAction={{
          label: 'Refresh Queue',
          onClick: () => loadTickets(),
          icon: RefreshCw,
          variant: 'outline'
        }}
      />

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <KPICard title="Total Open" value={stats.open} status={stats.open > 0 ? 'needs attention' : undefined} />
        <KPICard title="Assigned to Me" value={stats.assignedToMe} />
        <KPICard title="Waiting for Client" value={stats.waitingForClient} />
        <KPICard title="Waiting for Team" value={stats.waitingForTeam} />
        <KPICard title="Urgent Tickets" value={stats.urgent} />
        <KPICard title="Overdue (>24h)" value={stats.overdue} status={stats.overdue > 0 ? 'critical' : undefined} />
      </div>

      {/* Advanced Filter Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Sidebar Filters */}
        <Card className="bg-card border-border/50 p-4 space-y-4 xl:col-span-1">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" /> Workspace Filters</span>
            {(search || statusFilter !== 'all' || priorityFilter !== 'all' || clientFilter !== 'all' || projectFilter !== 'all' || assigneeFilter !== 'all') && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-[10px] hover:text-red-400 p-0" 
                onClick={() => { 
                  setSearch(''); setStatusFilter('all'); setPriorityFilter('all');
                  setClientFilter('all'); setProjectFilter('all'); setAssigneeFilter('all');
                }}
              >
                Reset All
              </Button>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <Label className="text-muted-foreground">Search Query</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-8 bg-background/50 border-border/60 text-xs"
                  placeholder="Subject, logs, client ID..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground">Ticket Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 bg-background/30 border-border/60 text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key} className="text-xs">{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground">Priority Rating</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-8 bg-background/30 border-border/60 text-xs"><SelectValue placeholder="All Priorities" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key} className="text-xs">{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground">Client ID / Company</Label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-8 bg-background/30 border-border/60 text-xs"><SelectValue placeholder="All Clients" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clientsList.map(c => (
                    <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground">Associated Project</Label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="h-8 bg-background/30 border-border/60 text-xs"><SelectValue placeholder="All Projects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projectsList.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground">Assigned Manager</Label>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="h-8 bg-background/30 border-border/60 text-xs"><SelectValue placeholder="All Assignees" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {staff.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Support Workspace card lists */}
        <div className="xl:col-span-3 space-y-3">
          {loading ? (
            <TableSkeleton rows={4} cols={4} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Mail}
              title={tickets.length === 0 ? 'No support tickets raised yet' : 'No tickets match filter parameters'}
              description={tickets.length === 0 ? 'Client support requests will automatically feed into this workspace queue.' : 'Clear search text or reset filter dropdowns.'}
            />
          ) : (
            filtered.map(ticket => {
              const status = ticket.status || 'open'
              const priority = ticket.priority || 'medium'
              const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.open
              const priorityCfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium
              const assignedStaff = staff.find(s => s.id === ticket.assigned_to)

              return (
                <Card 
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={cn(
                    'bg-card border-border/50 hover:border-border hover:shadow-md transition-all cursor-pointer group select-none relative overflow-hidden',
                    !ticket.is_read && 'border-gold/30 shadow-[0_0_15px_rgba(212,175,55,0.06)]'
                  )}
                >
                  <CardContent className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs">
                    {/* Left Border Priority Color Strip */}
                    <div className={cn('absolute left-0 top-0 bottom-0 w-1', {
                      'bg-slate-500/80': priority === 'low',
                      'bg-blue-500/80': priority === 'medium',
                      'bg-amber-500/80': priority === 'high',
                      'bg-orange-500/80': priority === 'urgent',
                      'bg-red-500': priority === 'critical',
                    })} />

                    <div className="space-y-1.5 flex-1 min-w-0 pl-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-gold/10">
                          {ticket.request_type || 'general'}
                        </span>
                        <h3 className="font-semibold text-sm text-foreground truncate max-w-md">{ticket.title}</h3>
                        {!ticket.is_read && (
                          <span className="text-[9px] font-bold text-gold px-1.5 py-0.5 rounded bg-gold/15 animate-pulse border border-gold/25">NEW</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-muted-foreground text-[11px] flex-wrap">
                        <span>Client: <strong className="text-foreground/90 font-medium">{ticket.client_id}</strong></span>
                        <span>•</span>
                        <span>Project: <strong className="text-foreground/90 font-medium">{projectsList.find(p => p.id === ticket.project_id)?.title || 'General'}</strong></span>
                        <span>•</span>
                        <span>Opened {formatDate(ticket.created_at)}</span>
                      </div>

                      <p className="text-xs text-muted-foreground/85 line-clamp-2 leading-relaxed pt-1">{ticket.message}</p>
                    </div>

                    <div className="flex md:flex-col items-center md:items-end gap-2.5 shrink-0 w-full md:w-auto justify-between border-t md:border-t-0 pt-3 md:pt-0 border-border/30 pl-2">
                      <Badge className={cn('capitalize text-[10px] px-2 py-0.5', statusCfg.color)}>
                        {statusCfg.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Assignee: <strong className="text-foreground/90">{assignedStaff ? assignedStaff.full_name : 'Unassigned'}</strong>
                      </span>
                      <Badge variant="outline" className={cn('text-[9px] border px-2 py-0.5', priorityCfg.color)}>
                        {priorityCfg.label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>

      {/* Slide-out Ticket Workspace Drawer */}
      <Drawer
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        title={selectedTicket?.title || 'Support Request detail'}
        widthClass="max-w-4xl"
      >
        {selectedTicket && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs h-full">
            {/* Drawer Body Left Column: Conversation, internal notes etc. */}
            <div className="lg:col-span-2 flex flex-col space-y-4">
              {/* Tab Header Selector */}
              <div className="flex border-b border-border/40 shrink-0">
                {[
                  { key: 'conversation', label: 'Client Conversation', icon: MessageSquare },
                  { key: 'internal_notes', label: 'Internal Staff Notes', icon: FileText },
                  { key: 'attachments', label: 'Attachments Vault', icon: Cloud },
                  { key: 'timeline', label: 'Timeline History', icon: History }
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveDrawerTab(tab.key as any)}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all -mb-px',
                      activeDrawerTab === tab.key 
                        ? 'border-gold text-primary font-bold bg-gold/5' 
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content area */}
              <div className="flex-1 min-h-[300px]">
                {activeDrawerTab === 'conversation' && (
                  <div className="space-y-4 flex flex-col h-full justify-between">
                    {/* Message Log */}
                    <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1 bg-muted/5 p-3 rounded-lg border border-border/40">
                      {/* Ticket Initial Message */}
                      <div className="flex items-start gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0 text-[10px]">
                          CL
                        </div>
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground/90">{selectedTicket.client_id}</span>
                            <span className="text-[9px] text-muted-foreground/60">{formatDate(selectedTicket.created_at)}</span>
                          </div>
                          <div className="p-3 bg-muted/20 border border-border rounded-lg rounded-tl-none whitespace-pre-wrap">
                            {selectedTicket.message}
                          </div>
                          {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {selectedTicket.attachments.map((att: any, idx: number) => (
                                <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 border border-border bg-card rounded hover:border-gold/30 text-[10px]">
                                  <FileText className="h-3 w-3 text-primary shrink-0" />
                                  <span className="truncate max-w-[100px]">{att.name}</span>
                                  <Download className="h-2.5 w-2.5 text-muted-foreground shrink-0 ml-1" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Chat replies */}
                      {loadingMessages ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                      ) : (
                        chatMessages.map(msg => {
                          const isTeam = msg.sender_role === 'team';
                          return (
                            <div key={msg.id} className={cn('flex items-start gap-2.5', isTeam ? 'flex-row-reverse' : '')}>
                              <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[10px]', 
                                isTeam ? 'bg-gold/10 text-gold border border-gold/25' : 'bg-primary/20 text-primary'
                              )}>
                                {isTeam ? 'NG' : 'CL'}
                              </div>
                              <div className={cn('space-y-1 flex-1', isTeam ? 'text-right' : '')}>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="font-semibold text-foreground/90">{msg.sender_name}</span>
                                  <span className="text-[9px] text-muted-foreground/60">{formatDate(msg.created_at)}</span>
                                </div>
                                <div className={cn(
                                  'p-3 text-left rounded-lg whitespace-pre-wrap inline-block max-w-full',
                                  isTeam 
                                    ? 'bg-primary/20 border border-gold/20 text-foreground rounded-tr-none' 
                                    : 'bg-muted/20 border border-border text-foreground rounded-tl-none'
                                )}>
                                  {msg.message}
                                </div>
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className={cn('flex flex-wrap gap-1.5 mt-1.5', isTeam ? 'justify-end' : '')}>
                                    {msg.attachments.map((att: any, idx: number) => (
                                      <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 border border-border bg-card rounded hover:border-gold/30 text-[10px]">
                                        <FileText className="h-3 w-3 text-primary shrink-0" />
                                        <span className="truncate max-w-[100px]">{att.name}</span>
                                        <Download className="h-2.5 w-2.5 text-muted-foreground shrink-0 ml-1" />
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Chat Editor Input */}
                    {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' ? (
                      <div className="space-y-2 border-t border-border/40 pt-3">
                        <Textarea
                          rows={3}
                          placeholder="Type your response to the client..."
                          value={reply}
                          onChange={e => setReply(e.target.value)}
                          className="bg-background border-border/60 text-xs focus-visible:ring-gold"
                        />
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
                            <input 
                              type="checkbox" 
                              checked={requestClientReply} 
                              onChange={e => setRequestClientReply(e.target.checked)} 
                              className="rounded border-border/60 bg-card text-gold focus:ring-gold cursor-pointer"
                            />
                            <span>Request Client Response (sets status to Awaiting Client)</span>
                          </label>
                          <Button
                            variant="gold"
                            size="sm"
                            disabled={submitting || !reply.trim()}
                            onClick={handleSendReply}
                            className="h-8 font-bold gap-1.5 text-xs"
                          >
                            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            Send Reply
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center italic text-muted-foreground py-4 bg-muted/5 rounded-lg border border-border/30">
                        This support request is marked {selectedTicket.status} and is closed for further client responses.
                      </div>
                    )}
                  </div>
                )}

                {activeDrawerTab === 'internal_notes' && (
                  <div className="space-y-3">
                    <p className="text-muted-foreground leading-normal font-medium">Internal Staff Notes are private and visible only to the Netgain team.</p>
                    <Textarea
                      rows={8}
                      placeholder="Write workspace task logs, internal priorities, or client details..."
                      value={internalNotesText}
                      onChange={e => setInternalNotesText(e.target.value)}
                      className="bg-background border-border/60 text-xs focus-visible:ring-gold"
                    />
                    <Button 
                      variant="gold" 
                      size="sm" 
                      disabled={submitting} 
                      onClick={handleSaveInternalNotes}
                      className="h-8 font-bold text-xs"
                    >
                      {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                      Save Notes
                    </Button>
                  </div>
                )}

                {activeDrawerTab === 'attachments' && (
                  <div className="space-y-3">
                    <p className="text-muted-foreground font-medium">Collation vault of files shared within this request thread.</p>
                    {collatedAttachments.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-border/60 bg-muted/5 rounded-lg italic text-muted-foreground">
                        No files or screenshots attached yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {collatedAttachments.map((file, idx) => (
                          <Card key={idx} className="bg-card border-border/50 p-3 hover:border-gold/30 hover:bg-muted/10 transition-colors">
                            <div className="flex items-center gap-2">
                              <FileText className="h-8 w-8 text-primary shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-foreground truncate">{file.name}</p>
                                <p className="text-[10px] text-muted-foreground">Uploaded via {file.provider || 'internal'}</p>
                              </div>
                            </div>
                            <div className="mt-2.5 flex justify-end">
                              <a href={file.url} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2">
                                  <Download className="h-3 w-3" /> Download
                                </Button>
                              </a>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeDrawerTab === 'timeline' && (
                  <div className="space-y-3">
                    <p className="text-muted-foreground font-medium">Complete chronological lifecycle transitions of this support ticket.</p>
                    {selectedTicket.timeline && selectedTicket.timeline.length > 0 ? (
                      <div className="space-y-3 border-l border-border/60 pl-3.5 ml-2 pt-2">
                        {selectedTicket.timeline.map((evt: any, i: number) => (
                          <div key={i} className="relative space-y-1">
                            <span className="absolute -left-[20px] top-1 h-2.5 w-2.5 rounded-full bg-gold border border-card" />
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="font-semibold text-foreground/90">{evt.event}</span>
                              <span className="text-[10px] text-muted-foreground/60 font-mono">{new Date(evt.date).toLocaleString('en-IN')}</span>
                            </div>
                            <p className="text-muted-foreground text-[11px]">{evt.notes || 'No details added'} (by {evt.by})</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 italic text-muted-foreground">No lifecycle timeline events recorded yet.</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Sidebar Right Column: Actions, Metadata etc. */}
            <div className="border-t lg:border-t-0 lg:border-l border-border/40 p-1 lg:pl-5 space-y-5">
              <div className="space-y-4">
                <h3 className="font-bold text-xs uppercase tracking-wider text-primary">Ticket Metadata</h3>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Status Queue</Label>
                    <Select value={selectedTicket.status} onValueChange={(val) => updateStatus(selectedTicket.id, val)}>
                      <SelectTrigger className="h-8 bg-background/30 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                          <SelectItem key={key} value={key} className="text-xs">{cfg.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Priority Rating</Label>
                    <Select value={selectedTicket.priority} onValueChange={(val) => handleUpdatePriority(selectedTicket.id, val)}>
                      <SelectTrigger className="h-8 bg-background/30 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                          <SelectItem key={key} value={key} className="text-xs">{cfg.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Assigned Manager</Label>
                    <Select value={selectedTicket.assigned_to || 'unassigned'} onValueChange={(val) => handleAssign(selectedTicket.id, val)}>
                      <SelectTrigger className="h-8 bg-background/30 text-xs"><SelectValue /></SelectTrigger>
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

              <div className="h-px bg-border/40" />

              <div className="space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-primary">Related Project Workspace</h3>
                {selectedTicket.project_id ? (
                  (() => {
                    const linkedProj = projectsList.find(p => p.id === selectedTicket.project_id)
                    return (
                      <Card className="bg-card/40 border-border/50 p-3 space-y-1">
                        <p className="font-semibold text-foreground">{linkedProj ? linkedProj.title : 'Project Workspace'}</p>
                        <p className="text-[10px] text-muted-foreground">ID: {selectedTicket.project_id}</p>
                      </Card>
                    )
                  })()
                ) : (
                  <div className="text-muted-foreground italic leading-normal">
                    This support request is currently not linked to any project workspace.
                  </div>
                )}
              </div>

              <div className="h-px bg-border/40" />

              <div className="space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-primary">Quick Conversions & Actions</h3>
                <div className="flex flex-col gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      if (!selectedTicket.project_id && projectsList.length > 0) setTargetProjId(projectsList[0].id)
                      setIsTaskModalOpen(true)
                    }}
                    className="h-8 text-xs justify-start gap-2 font-medium"
                  >
                    <ClipboardList className="h-3.5 w-3.5 text-amber-500" />
                    Convert to Project Task
                  </Button>

                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      if (!selectedTicket.project_id && projectsList.length > 0) setTargetProjId(projectsList[0].id)
                      setIsReqModalOpen(true)
                    }}
                    className="h-8 text-xs justify-start gap-2 font-medium"
                  >
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    Convert to Requirement
                  </Button>

                  <a 
                    href="https://cal.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full"
                  >
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 text-xs justify-start gap-2 font-medium w-full"
                    >
                      <Calendar className="h-3.5 w-3.5 text-emerald-500" />
                      Schedule Meeting
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Convert to Project Task Modal */}
      <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
        <DialogContent className="bg-card border-border/80 text-foreground text-xs max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary flex items-center gap-1.5"><ClipboardList className="h-5 w-5 text-amber-500" /> Convert Ticket to Task</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This will add the ticket as a new milestone task under the project's milestones checklist stack.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Select Target Project</Label>
              <Select value={targetProjId} onValueChange={setTargetProjId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select project workspace" /></SelectTrigger>
                <SelectContent>
                  {projectsList.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Task Title / Summary</Label>
              <Input 
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                className="h-8 bg-muted/10 border-border/60 text-xs"
                placeholder="e.g. Bug Fix: Fix broken login callback"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-3 border-t border-border/30">
            <Button variant="outline" size="sm" onClick={() => setIsTaskModalOpen(false)}>Cancel</Button>
            <Button variant="gold" size="sm" disabled={submitting || !targetProjId || !quickTitle.trim()} onClick={handleConvertTaskSubmit}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
              Create Task Milestone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Requirement Modal */}
      <Dialog open={isReqModalOpen} onOpenChange={setIsReqModalOpen}>
        <DialogContent className="bg-card border-border/80 text-foreground text-xs max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary flex items-center gap-1.5"><FileText className="h-5 w-5 text-blue-500" /> Convert to Requirement</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a structured requirement record with the description details mapping the project requirements.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Select Target Project</Label>
              <Select value={targetProjId} onValueChange={setTargetProjId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select project workspace" /></SelectTrigger>
                <SelectContent>
                  {projectsList.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Requirement Title</Label>
              <Input 
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                className="h-8 bg-muted/10 border-border/60 text-xs"
                placeholder="e.g. Functional Requirement: Auth updates"
              />
            </div>

            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={quickCategory} onValueChange={setQuickCategory}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Branding" className="text-xs">Branding & Logo</SelectItem>
                  <SelectItem value="Functional" className="text-xs">Functional Specs</SelectItem>
                  <SelectItem value="Integrations" className="text-xs">Third-party Integrations</SelectItem>
                  <SelectItem value="Assets" className="text-xs">Asset Requirements</SelectItem>
                  <SelectItem value="Other" className="text-xs">Other Specs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-3 border-t border-border/30">
            <Button variant="outline" size="sm" onClick={() => setIsReqModalOpen(false)}>Cancel</Button>
            <Button variant="gold" size="sm" disabled={submitting || !targetProjId || !quickTitle.trim()} onClick={handleConvertRequirementSubmit}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
              Create Requirement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
