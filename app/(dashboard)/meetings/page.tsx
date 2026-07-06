'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Calendar, RefreshCw, ExternalLink, Clock, Video, Mail, Phone, ChevronRight, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'

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
  
  // Filtering & Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [timeFilter, setTimeFilter] = useState<string>('all') // all, today, week, future

  const searchParams = useSearchParams()
  useEffect(() => {
    const q = searchParams.get('search') || searchParams.get('client')
    if (q) setSearchQuery(q)
  }, [searchParams])

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
          // Simple reload to make sure sorting/filtering are maintained
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

  // Filter meetings logic
  const filteredMeetings = meetings.filter((meeting) => {
    // 1. Search Query Filter
    const matchesSearch = 
      meeting.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meeting.client_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meeting.event_type.toLowerCase().includes(searchQuery.toLowerCase())

    // 2. Status Filter
    const matchesStatus = statusFilter === 'all' || meeting.status === statusFilter

    // 3. Time Filter
    const todayStr = new Date().toISOString().split('T')[0]
    const meetingDate = meeting.meeting_date

    let matchesTime = true
    if (timeFilter === 'today') {
      matchesTime = meetingDate === todayStr
    } else if (timeFilter === 'week') {
      const meetingDateTime = new Date(`${meetingDate}T${meeting.meeting_time}`).getTime()
      const oneWeekFromNow = Date.now() + 7 * 24 * 3600 * 1000
      const now = Date.now() - 12 * 3600 * 1000 // include a buffer for today
      matchesTime = meetingDateTime >= now && meetingDateTime <= oneWeekFromNow
    } else if (timeFilter === 'future') {
      const meetingDateTime = new Date(`${meetingDate}T${meeting.meeting_time}`).getTime()
      matchesTime = meetingDateTime >= Date.now()
    }

    return matchesSearch && matchesStatus && matchesTime
  })

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

  // Format date helper
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  // Format time helper (HH:MM:SS to HH:MM AM/PM)
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

      {/* Filters & Control bar */}
      <Card className="bg-muted/10 border-border/60">
        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by client name, email, or meeting topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/50"
            />
          </div>
          
          <div className="flex w-full md:w-auto items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] bg-background/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rescheduled">Rescheduled</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
              </SelectContent>
            </Select>

            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-[140px] bg-background/50">
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Next 7 Days</SelectItem>
                <SelectItem value="future">Upcoming Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Meetings List/Table card */}
      <Card className="bg-muted/5 border-border/60">
        <CardHeader className="py-4 border-b border-border/40">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>Synced Appointment Slots ({filteredMeetings.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading meetings...</span>
            </div>
          ) : filteredMeetings.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Calendar}
                title="No meetings found"
                description="Try adjusting your filters or sync Google Calendar to pull your slots."
                action={{
                  label: "Sync Calendar",
                  onClick: handleSyncGoogle,
                  icon: RefreshCw
                }}
              />
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filteredMeetings.map((meeting) => (
                <div 
                  key={meeting.id} 
                  className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 gap-4 hover:bg-muted/10 transition-colors group"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate max-w-[250px] text-foreground">
                        {meeting.client_name}
                      </span>
                      {getStatusBadge(meeting.status)}
                    </div>
                    
                    <div className="flex items-center gap-1 text-[11px] font-medium text-gold">
                      <span>{meeting.event_type}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(meeting.meeting_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(meeting.meeting_time)} ({meeting.meeting_duration}m)
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground/80 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {meeting.client_email}
                      </span>
                      {meeting.client_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {meeting.client_phone}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-between md:justify-end">
                    {meeting.meet_link ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="text-indigo-400 hover:text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/10 h-8 gap-1"
                      >
                        <a href={meeting.meet_link} target="_blank" rel="noopener noreferrer">
                          <Video className="h-3.5 w-3.5" />
                          <span>Join Meet</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    ) : (
                      <div className="h-8" />
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-8 gap-1 text-xs border-border/80 group-hover:border-gold group-hover:text-gold transition-colors"
                    >
                      <Link href={`/meetings/${meeting.id}`}>
                        <span>Details</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
