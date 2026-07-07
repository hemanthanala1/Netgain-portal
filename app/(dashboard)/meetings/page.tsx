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
import { PageHeader } from '@/components/ui/page-header'
import { DataTable } from '@/components/ui/data-table'
import { TableSkeleton } from '@/components/ui/skeletons'

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
        const { error } = await supabase.from('meetings').update({ status: 'cancelled' }).in('id', ids)
        if (error) throw error
        setMeetings(prev => prev.map(m => ids.includes(m.id) ? { ...m, status: 'cancelled' } : m))
        toast({ title: 'Meetings marked cancelled' })
      } catch (err: any) {
        toast({ title: 'Error updating meetings', description: err.message, variant: 'destructive' })
      }
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
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
