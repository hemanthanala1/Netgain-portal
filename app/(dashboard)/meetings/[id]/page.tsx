'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  ArrowLeft, Calendar, Clock, Video, Mail, Phone, User, FileText, 
  Send, Sparkles, History, Save, Loader2, CheckCircle2, AlertCircle, XCircle 
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'

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

interface CommLog {
  id: string
  channel: 'email' | 'whatsapp' | 'sms'
  recipient: string
  subject?: string
  message: string
  status: 'sent' | 'delivered' | 'failed'
  provider: string
  timestamp: string
}

export default function MeetingDetailsPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const { toast } = useToast()
  
  // Loading & State
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [logs, setLogs] = useState<CommLog[]>([])
  const [loading, setLoading] = useState(true)
  const [savingNotes, setSavingNotes] = useState(false)
  const [sendingMsg, setSendingMsg] = useState(false)
  const [generatingDraft, setGeneratingDraft] = useState(false)

  // Notes state
  const [notes, setNotes] = useState('')

  // Comms Composer State
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp' | 'sms'>('email')
  const [recipient, setRecipient] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  
  // AI Tone State
  const [aiTone, setAiTone] = useState<string>('professional')

  const fetchMeetingDetails = useCallback(async () => {
    try {
      setLoading(true)
      
      // Fetch meeting
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (meetingError) throw meetingError
      if (!meetingData) {
        toast({ title: 'Meeting not found', variant: 'destructive' })
        router.push('/meetings')
        return
      }

      setMeeting(meetingData)
      setNotes(meetingData.notes || '')
      
      // Prefill recipient based on default tab
      if (activeTab === 'email') {
        setRecipient(meetingData.client_email || '')
      } else {
        setRecipient(meetingData.client_phone || '')
      }

      // Fetch communication logs
      const { data: logsData, error: logsError } = await supabase
        .from('communication_logs')
        .select('*')
        .eq('meeting_id', id)
        .order('timestamp', { ascending: false })

      if (logsError) throw logsError
      setLogs(logsData || [])

    } catch (err: any) {
      toast({
        title: 'Error loading meeting',
        description: err.message,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [id, activeTab, router, toast])

  useEffect(() => {
    fetchMeetingDetails()

    // Realtime subscription for log updates and meeting detail changes
    const logChannel = supabase
      .channel(`meeting_details_realtime_${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'communication_logs', filter: `meeting_id=eq.${id}` },
        () => {
          // Reload logs
          supabase
            .from('communication_logs')
            .select('*')
            .eq('meeting_id', id)
            .order('timestamp', { ascending: false })
            .then(({ data }) => {
              if (data) setLogs(data)
            })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'meetings', filter: `id=eq.${id}` },
        (payload) => {
          setMeeting(payload.new as Meeting)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(logChannel)
    }
  }, [id, fetchMeetingDetails])

  // Sync recipient field when tab changes
  const handleTabChange = (val: string) => {
    const tab = val as 'email' | 'whatsapp' | 'sms'
    setActiveTab(tab)
    if (!meeting) return

    if (tab === 'email') {
      setRecipient(meeting.client_email || '')
    } else {
      setRecipient(meeting.client_phone || '')
    }
  }

  const handleSaveNotes = async () => {
    if (!meeting) return
    setSavingNotes(true)
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ notes, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
      
      toast({
        title: 'Notes Saved!',
        description: 'Meeting minutes have been updated successfully.'
      })
    } catch (err: any) {
      toast({
        title: 'Failed to save notes',
        description: err.message,
        variant: 'destructive'
      })
    } finally {
      setSavingNotes(false)
    }
  }

  const handleGenerateAiDraft = async () => {
    if (!meeting) return
    setGeneratingDraft(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch('/api/meetings/draft', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          clientName: meeting.client_name,
          eventType: meeting.event_type,
          notes,
          channel: activeTab === 'email' ? 'Email' : activeTab === 'whatsapp' ? 'WhatsApp' : 'SMS',
          tone: aiTone
        })
      })

      const data = await res.json()
      if (res.ok) {
        // Parse and split subject line for email if present
        let msgBody = data.draft
        if (activeTab === 'email' && msgBody.startsWith('Subject:')) {
          const lines = msgBody.split('\n')
          const subjectLine = lines[0].replace('Subject:', '').trim()
          setSubject(subjectLine)
          msgBody = lines.slice(1).join('\n').trim()
        }
        setMessage(msgBody)
        toast({
          title: 'Draft Generated!',
          description: `AI follow-up draft is ready in the composer.`
        })
      } else {
        throw new Error(data.error || 'Failed to generate draft')
      }
    } catch (err: any) {
      toast({
        title: 'AI Drafting Failed',
        description: err.message,
        variant: 'destructive'
      })
    } finally {
      setGeneratingDraft(false)
    }
  }

  const handleSendMessage = async () => {
    if (!meeting) return
    if (!recipient) {
      toast({ title: 'Recipient contact details required', variant: 'destructive' })
      return
    }
    if (!message) {
      toast({ title: 'Message body cannot be empty', variant: 'destructive' })
      return
    }

    setSendingMsg(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch('/api/meetings/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          meetingId: id,
          channel: activeTab,
          recipient,
          message,
          subject: activeTab === 'email' ? subject || 'Meeting Follow Up' : undefined
        })
      })

      const data = await res.json()
      if (res.ok) {
        toast({
          title: '🚀 Message Sent!',
          description: `Successfully sent via ${activeTab}.`
        })
        setMessage('')
        if (activeTab === 'email') setSubject('')
        
        // Reload logs immediately
        const { data: logsData } = await supabase
          .from('communication_logs')
          .select('*')
          .eq('meeting_id', id)
          .order('timestamp', { ascending: false })
        if (logsData) setLogs(logsData)

      } else {
        throw new Error(data.error || 'Failed to send')
      }
    } catch (err: any) {
      toast({
        title: 'Send failed',
        description: err.message,
        variant: 'destructive'
      })
    } finally {
      setSendingMsg(false)
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

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts)
      return d.toLocaleString('en-US', { 
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
      })
    } catch {
      return ts
    }
  }

  if (loading || !meeting) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
        <span>Loading meeting details...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Breadcrumb / Back button */}
      <div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => router.push('/meetings')}
          className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Meetings
        </Button>
      </div>

      {/* Main Title & Status bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{meeting.client_name}</h1>
          <p className="text-gold text-xs font-semibold">{meeting.event_type}</p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(meeting.status)}
          {meeting.meet_link && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="text-indigo-400 hover:text-indigo-400 bg-indigo-500/5 border-indigo-500/20 h-9 gap-1"
            >
              <a href={meeting.meet_link} target="_blank" rel="noopener noreferrer">
                <Video className="h-4 w-4" />
                Join Google Meet
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Grid Layout: Left Details + Notes, Right Comms + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Metadata Card */}
          <Card className="bg-muted/10 border-border/60">
            <CardHeader className="py-4 border-b border-border/40">
              <CardTitle className="text-xs font-semibold text-gold uppercase tracking-wider flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Meeting & Client Info
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 text-sm">
              <div className="grid grid-cols-3 gap-1">
                <span className="text-muted-foreground text-xs">Email</span>
                <span className="col-span-2 font-medium break-all">{meeting.client_email}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-muted-foreground text-xs">Phone</span>
                <span className="col-span-2 font-medium">{meeting.client_phone || 'Not provided'}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-muted-foreground text-xs">Date</span>
                <span className="col-span-2 font-medium flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {new Date(meeting.meeting_date).toLocaleDateString('en-US', { 
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
                  })}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="text-muted-foreground text-xs">Time</span>
                <span className="col-span-2 font-medium flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {meeting.meeting_time.slice(0, 5)} (Duration: {meeting.meeting_duration} mins)
                </span>
              </div>
              {meeting.timezone && (
                <div className="grid grid-cols-3 gap-1">
                  <span className="text-muted-foreground text-xs">Timezone</span>
                  <span className="col-span-2 text-xs text-muted-foreground font-medium">{meeting.timezone}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Meeting Notes Editor */}
          <Card className="bg-muted/10 border-border/60">
            <CardHeader className="py-4 border-b border-border/40 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold text-gold uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Discussion Minutes
              </CardTitle>
              <Button 
                variant="gold" 
                size="icon" 
                onClick={handleSaveNotes} 
                disabled={savingNotes}
                className="h-7 w-7 rounded"
              >
                {savingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <p className="text-[11px] text-muted-foreground">
                Document action items, customer requests, or project scope. AI utilizes these notes to formulate drafts.
              </p>
              <Textarea
                placeholder="Type meeting minutes and action items here..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleSaveNotes}
                className="min-h-56 bg-background/40 resize-y text-sm"
              />
            </CardContent>
          </Card>

        </div>

        {/* RIGHT COLUMN (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Comms Center Card */}
          <Card className="bg-muted/5 border-border/60">
            <CardHeader className="py-4 border-b border-border/40">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-xs font-semibold text-gold uppercase tracking-wider flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Communications Hub
                </CardTitle>
                
                {/* AI Draft Controls */}
                <div className="flex items-center gap-1.5">
                  <Select value={aiTone} onValueChange={setAiTone}>
                    <SelectTrigger className="w-28 h-7 text-xs bg-background/60">
                      <SelectValue placeholder="Tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="gold"
                    size="sm"
                    onClick={handleGenerateAiDraft}
                    disabled={generatingDraft}
                    className="h-7 text-[10px] gap-1 px-2.5"
                  >
                    {generatingDraft ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 text-yellow-300 fill-yellow-300" />
                    )}
                    AI Draft
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <Tabs defaultValue="email" onValueChange={handleTabChange}>
                <TabsList className="grid grid-cols-3 h-8 w-full max-w-[300px] mb-4">
                  <TabsTrigger value="email" className="text-xs">Email</TabsTrigger>
                  <TabsTrigger value="whatsapp" className="text-xs">WhatsApp</TabsTrigger>
                  <TabsTrigger value="sms" className="text-xs">SMS</TabsTrigger>
                </TabsList>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Recipient</Label>
                    <Input
                      placeholder={activeTab === 'email' ? 'client@example.com' : '+15551234567'}
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="h-9 bg-background/30 text-sm"
                    />
                  </div>

                  {activeTab === 'email' && (
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Subject</Label>
                      <Input
                        placeholder="Quotation & Follow up - Netgain Studio"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="h-9 bg-background/30 text-sm"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Message</Label>
                    <Textarea
                      placeholder="Compose follow-up message..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="min-h-36 bg-background/30 text-sm"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleSendMessage}
                      disabled={sendingMsg || !message}
                      variant="gold"
                      size="sm"
                      className="gap-1.5 h-9"
                    >
                      {sendingMsg ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Send Dispatch
                    </Button>
                  </div>
                </div>
              </Tabs>
            </CardContent>
          </Card>

          {/* Timeline / Communication Logs History */}
          <Card className="bg-muted/10 border-border/60">
            <CardHeader className="py-4 border-b border-border/40">
              <CardTitle className="text-xs font-semibold text-gold uppercase tracking-wider flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" /> Timeline & Activity Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {logs.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No communications have been dispatched for this meeting.
                </div>
              ) : (
                <div className="relative border-l border-border/60 pl-4 space-y-5 py-2">
                  {logs.map((log) => (
                    <div key={log.id} className="relative group">
                      {/* Timeline dot */}
                      <span className="absolute -left-[21px] top-1 h-3.5 w-3.5 rounded-full bg-background border-2 border-gold flex items-center justify-center shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                      </span>
                      
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                          <span className="font-semibold text-foreground capitalize flex items-center gap-1">
                            {log.channel === 'email' ? '📧 Email' : log.channel === 'whatsapp' ? '💬 WhatsApp' : '📱 SMS'}
                            <span className="text-[10px] text-muted-foreground font-normal">via {log.provider}</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>

                        {log.subject && (
                          <p className="text-xs font-semibold text-foreground/95">
                            Subject: {log.subject}
                          </p>
                        )}

                        <p className="text-xs text-muted-foreground bg-background/20 p-2.5 rounded border border-border/40 break-words max-h-24 overflow-y-auto whitespace-pre-wrap">
                          {log.message}
                        </p>

                        <div className="flex justify-end">
                          {log.status === 'sent' || log.status === 'delivered' ? (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Sent
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">
                              <XCircle className="h-2.5 w-2.5" /> Failed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  )
}
