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
  XCircle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { Plus } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

function MeetingsListContent() {
  const { toast } = useToast()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const searchParams = useSearchParams()

  const [bookingUrl, setBookingUrl] = useState<string>('')

  const [showAddModal, setShowAddModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generateMeetLink, setGenerateMeetLink] = useState(true)
  const [newMeeting, setNewMeeting] = useState({
    client_name: '',
    client_email: '',
    event_type: 'Check-in Meeting',
    meeting_date: '',
    meeting_time: '10:00',
    meeting_duration: 30,
    meet_link: '',
  })

  const handleAddMeeting = async () => {
    if (!newMeeting.client_name || !newMeeting.client_email || !newMeeting.meeting_date) {
      toast({ title: 'Missing fields', description: 'Please fill out all required fields.', variant: 'destructive' })
      return
    }
    setIsSubmitting(true)
    try {
      if (generateMeetLink) {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        const res = await fetch('/api/meetings/create', {
          method: 'POST',
          headers,
          body: JSON.stringify({ newMeeting, generateMeetLink })
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to generate meeting link')
        }
      } else {
        const { error } = await supabase.from('meetings').insert([{
          ...newMeeting,
          status: 'upcoming'
        }])
        if (error) throw error
      }
      toast({ title: 'Meeting Scheduled ✓' })
      setShowAddModal(false)
      setNewMeeting({
        client_name: '',
        client_email: '',
        event_type: 'Check-in Meeting',
        meeting_date: '',
        meeting_time: '10:00',
        meeting_duration: 30,
        meet_link: '',
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
      toast({
        title: 'Error loading meetings',
        description: err.message,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Setup realtime subscription
  useEffect(() => {
    fetchMeetings()

    const channel = supabase
      .channel('meetings_realtime_dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meetings' },
        (payload) => {
          console.log('Realtime change detected in meetings:', payload)
          fetchMeetings()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchMeetings])

  const handleSyncGoogle = async () => {
    setSyncing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch('/api/google/sync', {
        method: 'POST',
        headers
      })

      const data = await res.json()
      if (res.ok) {
        toast({
          title: '🔄 Calendar Synced!',
          description: `Successfully synchronized ${data.count} calendar events.`
        })
        fetchMeetings()
      } else {
        throw new Error(data.error || 'Sync failed')
      }
    } catch (err: any) {
      toast({
        title: 'Sync failed',
        description: err.message,
        variant: 'destructive'
      })
    } finally {
      setSyncing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">Upcoming</Badge>
      case 'completed':
        return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Completed</Badge>
      case 'cancelled':
        return <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20">Cancelled</Badge>
      case 'rescheduled':
        return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Rescheduled</Badge>
      case 'no_show':
        return <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20">No Show</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const formatTime = (timeStr: string) => {
    try {
      const [hours, minutes] = timeStr.split(':')
      const hr = parseInt(hours)
      const ampm = hr >= 12 ? 'PM' : 'AM'
      const displayHr = hr % 12 || 12
      return `${displayHr}:${minutes} ${ampm}`
    } catch {
      return timeStr
    }
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
      cell: (row: Meeting) => (
        <span className="font-medium text-gold">{row.event_type}</span>
      )
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
      header: 'Meeting Link',
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
      const confirmDelete = window.confirm(`Are you sure you want to delete ${ids.length} meetings?`)
      if (!confirmDelete) return
      try {
        const { error } = await supabase.from('meetings').delete().in('id', ids)
        if (error) throw error
        setMeetings(prev => prev.filter(m => !ids.includes(m.id)))
        toast({ title: 'Meetings deleted successfully' })
      } catch (err: any) {
        toast({ title: 'Error deleting meetings', description: err.message, variant: 'destructive' })
      }
    } else if (action === 'status_completed') {
      try {
        const { error } = await supabase.from('meetings').update({ status: 'completed' }).in('id', ids)
        if (error) throw error
        setMeetings(prev => prev.map(m => ids.includes(m.id) ? { ...m, status: 'completed' } : m))
        toast({ title: 'Meetings marked completed' })
      } catch (err: any) {
        toast({ title: 'Error updating meetings', description: err.message, variant: 'destructive' })
      }
    } else if (action === 'status_cancelled') {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        const res = await fetch('/api/meetings/cancel', {
          method: 'POST',
          headers,
          body: JSON.stringify({ ids })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to cancel meetings')

        setMeetings(prev => prev.map(m => ids.includes(m.id) ? { ...m, status: 'cancelled' } : m))
        toast({ title: 'Meetings marked cancelled and invitees notified (if applicable)' })
      } catch (err: any) {
        toast({ title: 'Error cancelling meetings', description: err.message, variant: 'destructive' })
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <PageHeader
        title="Meetings & Communications"
        description="Centralize your client meetings, sync Google Calendar appointments, and manage multi-channel follow-ups."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Meetings' }
        ]}
        primaryAction={{
          label: syncing ? 'Syncing...' : 'Sync Calendar',
          onClick: handleSyncGoogle,
          icon: RefreshCw,
          disabled: syncing || loading
        }}
        secondaryActions={
          <div className="flex items-center gap-2">
            <Button variant="default" className="bg-gold text-black hover:bg-gold/90" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Meeting
            </Button>
            {bookingUrl && (
              <Button variant="outline" asChild className="border-gold/30 text-gold hover:bg-gold/10">
                <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                  <Calendar className="mr-2 h-4 w-4" />
                  Book a Meeting
                </a>
              </Button>
            )}
          </div>
        }
      />

      {/* Summary Stat Cards */}
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
              <p className="text-xs text-muted-foreground font-medium">Completed Meetings</p>
              <h3 className="text-2xl font-bold tracking-tight text-emerald-400">
                {meetings.filter(m => m.status === 'completed').length}
              </h3>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/10 border-border/60">
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Total Meetings Synced</p>
              <h3 className="text-2xl font-bold tracking-tight text-gold">
                {meetings.length}
              </h3>
            </div>
            <div className="p-2 bg-yellow-500/10 rounded-lg text-gold">
              <RefreshCw className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

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

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto bg-[#07110e] border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gold">Schedule New Meeting</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Client Name *</Label>
              <ClientAutocomplete
                value={newMeeting.client_name}
                onChange={val => setNewMeeting({...newMeeting, client_name: val})}
                onSelect={client => setNewMeeting({...newMeeting, client_name: client.name, client_email: client.email || ''})}
                placeholder="E.g. John Doe"
                className="bg-black/50 border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Client Email *</Label>
              <Input type="email" placeholder="john@example.com" value={newMeeting.client_email} onChange={e => setNewMeeting({...newMeeting, client_email: e.target.value})} className="bg-black/50 border-border/50" />
            </div>
            <div className="space-y-2">
              <Label>Meeting Type</Label>
              <Input placeholder="E.g. Discovery Call" value={newMeeting.event_type} onChange={e => setNewMeeting({...newMeeting, event_type: e.target.value})} className="bg-black/50 border-border/50" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={newMeeting.meeting_date} onChange={e => setNewMeeting({...newMeeting, meeting_date: e.target.value})} className="bg-black/50 border-border/50" />
              </div>
              <div className="space-y-2">
                <Label>Time *</Label>
                <Input type="time" value={newMeeting.meeting_time} onChange={e => setNewMeeting({...newMeeting, meeting_time: e.target.value})} className="bg-black/50 border-border/50" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Input type="number" value={newMeeting.meeting_duration} onChange={e => setNewMeeting({...newMeeting, meeting_duration: parseInt(e.target.value) || 30})} className="bg-black/50 border-border/50" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Meeting Link</Label>
              <Input placeholder="https://meet.google.com/..." value={newMeeting.meet_link} onChange={e => setNewMeeting({...newMeeting, meet_link: e.target.value})} className="bg-black/50 border-border/50" disabled={generateMeetLink} />
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox id="generate-meet" checked={generateMeetLink} onCheckedChange={(c) => setGenerateMeetLink(!!c)} />
              <Label htmlFor="generate-meet" className="font-normal text-sm text-muted-foreground cursor-pointer">Generate Google Meet link (requires Calendar connected)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)} className="border-border/50">Cancel</Button>
            <Button onClick={handleAddMeeting} disabled={isSubmitting} className="bg-gold text-black hover:bg-gold/90">
              {isSubmitting ? 'Saving...' : 'Save Meeting'}
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
