'use client'

import { useState, useEffect, useCallback, Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  RefreshCw,
  ExternalLink,
  Clock,
  Video,
  ChevronRight,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Link2,
  Link2Off,
  Users,
  FileText,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable } from '@/components/ui/data-table'
import { TableSkeleton } from '@/components/ui/skeletons'
import { Checkbox } from '@/components/ui/checkbox'
import { ClientAutocomplete } from '@/components/ui/client-autocomplete'

interface Meeting {
  id: string
  cal_booking_uid?: string
  calendar_event_id?: string
  event_type: string
  client_name: string
  client_email: string
  client_phone?: string
  meeting_date: string
  meeting_time: string
  meeting_duration: number
  status: 'upcoming' | 'completed' | 'cancelled' | 'rescheduled' | 'no_show'
  meet_link?: string
  timezone?: string
  notes?: string
  created_at: string
}

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST, UTC+5:30)' },
  { value: 'America/New_York', label: 'Eastern Time (ET, UTC-5)' },
  { value: 'America/Chicago', label: 'Central Time (CT, UTC-6)' },
  { value: 'America/Denver', label: 'Mountain Time (MT, UTC-7)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT, UTC-8)' },
  { value: 'Europe/London', label: 'GMT / London (UTC+0)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET, UTC+1)' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST, UTC+4)' },
  { value: 'Asia/Singapore', label: 'Singapore Time (SGT, UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST, UTC+9)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AEST, UTC+10)' },
  { value: 'UTC', label: 'UTC (Universal Coordinated Time)' },
]

const MEETING_TYPES = [
  'Discovery Call',
  'Check-in Meeting',
  'Project Kickoff',
  'Design Review',
  'Sprint Planning',
  'Demo / Presentation',
  'Strategy Session',
  'Client Onboarding',
  'Feedback Review',
  'Billing Discussion',
  'Support Call',
  'Other',
]

function MeetingsListContent() {
  const { toast } = useToast()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const searchParams = useSearchParams()
  const [bookingUrl, setBookingUrl] = useState<string>('')

  // Google connection status
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null)
  const [googleEmail, setGoogleEmail] = useState<string>('')
  const [checkingGoogle, setCheckingGoogle] = useState(true)
  const [connectingGoogle, setConnectingGoogle] = useState(false)

  // Add meeting modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generateMeetLink, setGenerateMeetLink] = useState(true)
  const [newMeeting, setNewMeeting] = useState({
    client_name: '',
    client_email: '',
    event_type: 'Discovery Call',
    meeting_date: '',
    meeting_time: '10:00',
    meeting_duration: 30,
    meet_link: '',
    notes: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
  })

  // Check Google Calendar connection status
  const checkGoogleConnection = useCallback(async () => {
    setCheckingGoogle(true)
    try {
      const { data: settingsData } = await supabase
        .from('company_settings')
        .select('comm')
        .maybeSingle()
      const comm = settingsData?.comm || {}
      const isConnected = !!comm.googleAccessToken && !!comm.googleConnectedAt
      setGoogleConnected(isConnected)
      setGoogleEmail(comm.googleEmail || '')
    } catch {
      setGoogleConnected(false)
    } finally {
      setCheckingGoogle(false)
    }
  }, [])

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      window.location.href = `/api/google/auth?token=${encodeURIComponent(token)}`
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
      setConnectingGoogle(false)
    }
  }

  const handleAddMeeting = async () => {
    if (!newMeeting.client_name || !newMeeting.client_email || !newMeeting.meeting_date) {
      toast({ title: 'Missing fields', description: 'Please fill out client name, email, and date.', variant: 'destructive' })
      return
    }
    setIsSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/meetings/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({ newMeeting, generateMeetLink: generateMeetLink && googleConnected })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to schedule meeting')

      toast({
        title: '📅 Meeting Scheduled!',
        description: data.meeting?.meet_link
          ? `Google Meet link created and meeting saved.`
          : 'Meeting saved successfully.',
      })
      setShowAddModal(false)
      setNewMeeting({
        client_name: '', client_email: '', event_type: 'Discovery Call',
        meeting_date: '', meeting_time: '10:00', meeting_duration: 30,
        meet_link: '', notes: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
      })
      fetchMeetings()
    } catch (err: any) {
      toast({ title: 'Error scheduling meeting', description: err.message, variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .order('meeting_date', { ascending: false })
        .order('meeting_time', { ascending: false })

      if (error) throw error
      setMeetings(data || [])

      const { data: settingsData } = await supabase.from('company_settings').select('settings').single()
      if (settingsData?.settings?.company?.calBookingUrl) {
        setBookingUrl(settingsData.settings.company.calBookingUrl)
      } else {
        setBookingUrl(process.env.NEXT_PUBLIC_CAL_BOOKING_URL || '')
      }
    } catch (err: any) {
      toast({ title: 'Error loading meetings', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchMeetings()
    checkGoogleConnection()

    const channel = supabase
      .channel('meetings_realtime_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, () => {
        fetchMeetings()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchMeetings, checkGoogleConnection])

  const handleSyncGoogle = async () => {
    setSyncing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/google/sync', { method: 'POST', headers })
      const data = await res.json()
      if (res.ok) {
        toast({ title: '🔄 Calendar Synced!', description: `Synchronized ${data.count} calendar events.` })
        fetchMeetings()
      } else {
        throw new Error(data.error || 'Sync failed')
      }
    } catch (err: any) {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' })
    } finally {
      setSyncing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'upcoming':    return <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">Upcoming</Badge>
      case 'completed':   return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Completed</Badge>
      case 'cancelled':   return <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20">Cancelled</Badge>
      case 'rescheduled': return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Rescheduled</Badge>
      case 'no_show':     return <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20">No Show</Badge>
      default:            return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch { return dateStr }
  }

  const formatTime = (timeStr: string) => {
    try {
      const [hours, minutes] = timeStr.split(':')
      const hr = parseInt(hours)
      return `${hr % 12 || 12}:${minutes} ${hr >= 12 ? 'PM' : 'AM'}`
    } catch { return timeStr }
  }

  const columns = useMemo(() => [
    {
      header: 'Client',
      accessor: 'client_name',
      sortable: true,
      cell: (row: Meeting) => (
        <div className="space-y-0.5">
          <p className="font-semibold text-sm text-foreground">{row.client_name}</p>
          <p className="text-[11px] text-muted-foreground">{row.client_email}</p>
        </div>
      )
    },
    {
      header: 'Meeting Type',
      accessor: 'event_type',
      sortable: true,
      cell: (row: Meeting) => <span className="font-medium text-gold">{row.event_type}</span>
    },
    {
      header: 'Date & Time',
      accessor: 'meeting_date',
      sortable: true,
      cell: (row: Meeting) => (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p className="font-medium">{formatDate(row.meeting_date)}</p>
          <p className="text-muted-foreground text-[11px]">{formatTime(row.meeting_time)} ({row.meeting_duration}m)</p>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      cell: (row: Meeting) => getStatusBadge(row.status)
    },
    {
      header: 'Meet Link',
      accessor: 'meet_link',
      cell: (row: Meeting) => row.meet_link ? (
        <Button variant="ghost" size="sm" asChild className="text-indigo-400 hover:text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/10 h-7 gap-1 text-[11px]">
          <a href={row.meet_link} target="_blank" rel="noopener noreferrer">
            <Video className="h-3 w-3" />
            <span>Join Meet</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </Button>
      ) : <span className="text-xs text-muted-foreground">—</span>
    },
    {
      header: 'Actions',
      accessor: 'id',
      cell: (row: Meeting) => (
        <Button variant="outline" size="sm" asChild className="h-7 gap-1 text-[11px] border-border/80 hover:border-gold hover:text-gold transition-colors">
          <Link href={`/meetings/${row.id}`}>
            <span>Details</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      )
    }
  ], [])

  const filterDefs = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { label: 'Upcoming', value: 'upcoming' },
        { label: 'Completed', value: 'completed' },
        { label: 'Rescheduled', value: 'rescheduled' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'No Show', value: 'no_show' }
      ]
    }
  ]

  const handleBulkAction = async (action: string, selectedRows: Meeting[]) => {
    const ids = selectedRows.map(r => r.id)
    if (action === 'delete') {
      if (!window.confirm(`Delete ${ids.length} meeting(s)?`)) return
      try {
        const { error } = await supabase.from('meetings').delete().in('id', ids)
        if (error) throw error
        setMeetings(prev => prev.filter(m => !ids.includes(m.id)))
        toast({ title: 'Meetings deleted' })
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } else if (action === 'status_completed') {
      try {
        const { error } = await supabase.from('meetings').update({ status: 'completed' }).in('id', ids)
        if (error) throw error
        setMeetings(prev => prev.map(m => ids.includes(m.id) ? { ...m, status: 'completed' } : m))
        toast({ title: 'Meetings marked completed' })
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } else if (action === 'status_cancelled') {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        const res = await fetch('/api/meetings/cancel', { method: 'POST', headers, body: JSON.stringify({ ids }) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to cancel')
        setMeetings(prev => prev.map(m => ids.includes(m.id) ? { ...m, status: 'cancelled' } : m))
        toast({ title: 'Meetings cancelled' })
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Meetings"
        description="Schedule Google Meet calls, sync Google Calendar, and manage all client meetings in one place."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Meetings' }]}
        primaryAction={{
          label: syncing ? 'Syncing...' : 'Sync Calendar',
          onClick: handleSyncGoogle,
          icon: RefreshCw,
          disabled: syncing || loading || !googleConnected,
        }}
        secondaryActions={
          <div className="flex items-center gap-2">
            <Button variant="default" className="bg-gold text-black hover:bg-gold/90" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Schedule Meeting
            </Button>
            {bookingUrl && (
              <Button variant="outline" asChild className="border-gold/30 text-gold hover:bg-gold/10">
                <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                  <Calendar className="mr-2 h-4 w-4" />
                  Booking Page
                </a>
              </Button>
            )}
          </div>
        }
      />

      {/* Google Calendar Connection Banner */}
      {!checkingGoogle && (
        googleConnected ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-400">Google Calendar Connected</p>
              <p className="text-xs text-muted-foreground">
                Meetings you schedule will automatically create Google Meet links
                {googleEmail && <> · <span className="text-foreground/70">{googleEmail}</span></>}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSyncGoogle} disabled={syncing} className="text-emerald-400 hover:text-emerald-400 hover:bg-emerald-500/10 shrink-0">
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              <span className="ml-1.5 text-xs">Sync Now</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <div className="p-1.5 rounded-lg bg-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-400">Google Calendar Not Connected</p>
              <p className="text-xs text-muted-foreground">
                Connect your Google account to auto-generate Google Meet links when scheduling meetings.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleConnectGoogle}
              disabled={connectingGoogle}
              className="bg-white text-gray-900 hover:bg-gray-100 shrink-0 gap-2 text-xs font-medium"
            >
              {connectingGoogle ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Connect Google
            </Button>
          </div>
        )
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-muted/10 border-border/60">
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Upcoming Meetings</p>
              <h3 className="text-2xl font-bold tracking-tight text-indigo-400">
                {meetings.filter(m => m.status === 'upcoming' || m.status === 'rescheduled').length}
              </h3>
            </div>
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Calendar className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted/10 border-border/60">
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Completed</p>
              <h3 className="text-2xl font-bold tracking-tight text-emerald-400">
                {meetings.filter(m => m.status === 'completed').length}
              </h3>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted/10 border-border/60">
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">With Google Meet</p>
              <h3 className="text-2xl font-bold tracking-tight text-gold">
                {meetings.filter(m => m.meet_link && m.meet_link.includes('meet.google.com')).length}
              </h3>
            </div>
            <div className="p-2 bg-yellow-500/10 rounded-lg text-gold">
              <Video className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Meetings Table */}
      <div className="space-y-4">
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : (
          <DataTable
            data={meetings}
            columns={columns}
            searchPlaceholder="Search client name, email, meeting type..."
            searchKeys={['client_name', 'client_email', 'event_type']}
            exportFileName="client_meetings"
            enableBulkSelect={true}
            bulkActions={[
              { label: 'Delete Selected', action: 'delete', variant: 'destructive', icon: Trash2 },
              { label: 'Mark Completed', action: 'status_completed', icon: CheckCircle2 },
              { label: 'Mark Cancelled', action: 'status_cancelled', icon: XCircle }
            ]}
            onBulkAction={handleBulkAction}
            filterDefs={filterDefs}
            dateKey="meeting_date"
            savedFiltersKey="meetings"
            initialSearch={searchParams.get('search') || searchParams.get('client') || ''}
          />
        )}
      </div>

      {/* Schedule Meeting Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto bg-[#07110e] border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gold flex items-center gap-2">
              <Video className="h-5 w-5" />
              Schedule Meeting
            </DialogTitle>
          </DialogHeader>

          {/* Google Meet Banner inside modal */}
          {!checkingGoogle && (
            <div className={`flex items-start gap-3 p-3 rounded-lg border text-xs ${
              googleConnected
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : 'border-amber-500/20 bg-amber-500/5'
            }`}>
              {googleConnected ? (
                <>
                  <Video className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-emerald-400 font-medium">Google Meet link will be auto-generated</p>
                    <p className="text-muted-foreground mt-0.5">A Google Calendar event + Meet link will be created and sent to the client.</p>
                  </div>
                </>
              ) : (
                <>
                  <Link2Off className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-amber-400 font-medium">Google Calendar not connected</p>
                    <p className="text-muted-foreground mt-0.5">Connect Google to auto-generate Meet links, or enter a link manually below.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleConnectGoogle} disabled={connectingGoogle} className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 shrink-0 text-[11px] h-7">
                    {connectingGoogle ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3 mr-1" />}
                    Connect
                  </Button>
                </>
              )}
            </div>
          )}

          <div className="grid gap-4 py-2">
            {/* Client Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                <Users className="h-3.5 w-3.5" />
                <span>Client Info</span>
              </div>
              <div className="space-y-3 pl-1">
                <div className="space-y-1.5">
                  <Label className="text-xs">Client Name *</Label>
                  <ClientAutocomplete
                    value={newMeeting.client_name}
                    onChange={val => setNewMeeting({ ...newMeeting, client_name: val })}
                    onSelect={client => setNewMeeting({ ...newMeeting, client_name: client.name, client_email: client.email || '' })}
                    placeholder="Search or enter client name"
                    className="bg-black/50 border-border/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Client Email *</Label>
                  <Input type="email" placeholder="client@company.com" value={newMeeting.client_email}
                    onChange={e => setNewMeeting({ ...newMeeting, client_email: e.target.value })}
                    className="bg-black/50 border-border/50 text-sm" />
                </div>
              </div>
            </div>

            {/* Meeting Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                <Calendar className="h-3.5 w-3.5" />
                <span>Meeting Details</span>
              </div>
              <div className="space-y-3 pl-1">
                <div className="space-y-1.5">
                  <Label className="text-xs">Meeting Type</Label>
                  <Select
                    value={newMeeting.event_type}
                    onValueChange={val => setNewMeeting({ ...newMeeting, event_type: val })}
                  >
                    <SelectTrigger className="bg-black/50 border-border/50 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a1a14] border-border">
                      {MEETING_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Date *</Label>
                    <Input type="date" value={newMeeting.meeting_date}
                      onChange={e => setNewMeeting({ ...newMeeting, meeting_date: e.target.value })}
                      className="bg-black/50 border-border/50 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Time *</Label>
                    <Input type="time" value={newMeeting.meeting_time}
                      onChange={e => setNewMeeting({ ...newMeeting, meeting_time: e.target.value })}
                      className="bg-black/50 border-border/50 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Duration (minutes)</Label>
                    <Select
                      value={String(newMeeting.meeting_duration)}
                      onValueChange={val => setNewMeeting({ ...newMeeting, meeting_duration: parseInt(val) })}
                    >
                      <SelectTrigger className="bg-black/50 border-border/50 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a1a14] border-border">
                        {[15, 20, 30, 45, 60, 90, 120].map(d => (
                          <SelectItem key={d} value={String(d)}>{d} minutes</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Timezone</Label>
                    <Select
                      value={newMeeting.timezone}
                      onValueChange={val => setNewMeeting({ ...newMeeting, timezone: val })}
                    >
                      <SelectTrigger className="bg-black/50 border-border/50 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a1a14] border-border max-h-[200px]">
                        {TIMEZONES.map(tz => (
                          <SelectItem key={tz.value} value={tz.value} className="text-xs">{tz.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Agenda / Notes */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                <FileText className="h-3.5 w-3.5" />
                <span>Agenda (optional)</span>
              </div>
              <div className="pl-1">
                <Textarea
                  placeholder="Meeting agenda, topics to discuss, or preparation notes..."
                  value={newMeeting.notes}
                  onChange={e => setNewMeeting({ ...newMeeting, notes: e.target.value })}
                  className="bg-black/50 border-border/50 text-sm min-h-[80px] resize-none"
                  rows={3}
                />
              </div>
            </div>

            {/* Google Meet Toggle / Manual Link */}
            <div className="space-y-3 border border-border/40 rounded-lg p-3 bg-black/20">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="generate-meet"
                  checked={generateMeetLink}
                  onCheckedChange={(c) => setGenerateMeetLink(!!c)}
                  disabled={!googleConnected}
                />
                <Label htmlFor="generate-meet" className={`font-normal text-sm cursor-pointer ${!googleConnected ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                  Auto-generate Google Meet link
                  {!googleConnected && <span className="ml-1 text-amber-500/70">(Connect Google first)</span>}
                </Label>
              </div>
              {(!generateMeetLink || !googleConnected) && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Manual Meeting Link</Label>
                  <Input
                    placeholder="https://meet.google.com/... or any video link"
                    value={newMeeting.meet_link}
                    onChange={e => setNewMeeting({ ...newMeeting, meet_link: e.target.value })}
                    className="bg-black/50 border-border/50 text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddModal(false)} className="border-border/50">
              Cancel
            </Button>
            <Button onClick={handleAddMeeting} disabled={isSubmitting} className="bg-gold text-black hover:bg-gold/90 gap-2">
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Scheduling...</>
              ) : (
                <><Video className="h-4 w-4" />Schedule Meeting</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function MeetingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><div className="h-6 w-6 rounded-full border-2 border-gold/30 border-t-gold animate-spin" /></div>}>
      <MeetingsListContent />
    </Suspense>
  )
}
