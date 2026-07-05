'use client'
import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useUser } from '@/components/user-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ArrowLeft, Mail, Phone, Building2, Globe, MapPin, Calendar, FileText, Receipt, MessageSquare, ClipboardList, Edit, Loader2, KeyRound, UserCheck, UserX, Copy, ExternalLink, ShieldCheck, MonitorSmartphone, Trash2, History } from 'lucide-react'
import Link from 'next/link'
import { getInitials, formatDate, formatCurrency, getLeadStatusColor } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { invalidateCache } from '@/lib/data-cache'

const LEAD_STATUSES = ['new', 'contacted', 'proposal_sent', 'quotation_sent', 'negotiation', 'won', 'lost', 'active']
const statusLabels: Record<string, string> = {
  new: 'New', contacted: 'Contacted', proposal_sent: 'Proposal Sent',
  quotation_sent: 'Quotation Sent', negotiation: 'Negotiation',
  won: 'Won', lost: 'Lost', active: 'Active Client',
}

const mockClient = { id: '1', name: 'Aaron Shah', business: 'Urban Edge Co.', type: 'E-Commerce', email: 'aaron@urbanedge.in', phone: '9876543210', gst: '29AABCU9603R1ZM', website: 'urbanedge.in', address: 'Andheri East, Mumbai — 400069', city: 'Mumbai', status: 'quotation_sent', revenue: 47998, joined: '2024-05-15' }

const safeTimestamp = (dateStr: string | null | undefined) => {
  if (!dateStr) return 0
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editClient, setEditClient] = useState<any | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const { user } = useUser()

  // Portal account state
  const [portalAccount, setPortalAccount] = useState<any>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [showCreatePortal, setShowCreatePortal] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [portalPassword, setPortalPassword] = useState('')
  const [portalAction, setPortalAction] = useState(false)

  const [notes, setNotes] = useState<any[]>([])
  const [newNote, setNewNote] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editNoteContent, setEditNoteContent] = useState('')
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<any>(null)
  const [versions, setVersions] = useState<any[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [activities, setActivities] = useState<any[]>([])
  const [newActivityDescription, setNewActivityDescription] = useState('')
  const [newActivityType, setNewActivityType] = useState('call')
  const [documents, setDocuments] = useState<any[]>([])
  const [meetings, setMeetings] = useState<any[]>([])
  const [historyNoteId, setHistoryNoteId] = useState<string | null>(null)
  const [noteHistory, setNoteHistory] = useState<any[]>([])
  const [loadingNoteHistory, setLoadingNoteHistory] = useState(false)

  const fetchNoteHistory = async (noteId: string) => {
    setHistoryNoteId(noteId)
    setLoadingNoteHistory(true)
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('crm_notes_history')
          .select('*')
          .eq('note_id', noteId)
          .order('edited_at', { ascending: false })
        if (data) setNoteHistory(data)
      } catch (err) {
        console.error('Error fetching note history:', err)
      }
    } else {
      setNoteHistory([
        { id: 'h1', note_id: noteId, content_before: 'Met with client to discuss roadmap.', content_after: 'Met with client to discuss roadmap and finalized milestones.', edited_by: 'Staff Member', edited_at: new Date().toISOString() }
      ])
    }
    setLoadingNoteHistory(false)
  }

  const isPrivileged = user?.role === 'Founder' || user?.role === 'Admin'

  async function fetchPortalAccount(clientId: string) {
    if (!isSupabaseConfigured()) return
    setPortalLoading(true)
    try {
      const { data } = await supabase
        .from('client_accounts')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()
      setPortalAccount(data || null)
    } catch (err) {
      console.error('Error fetching portal account:', err)
    } finally {
      setPortalLoading(false)
    }
  }

  async function handleCreatePortalAccount() {
    if (!client) return
    const pwd = portalPassword.trim() || 'Welcome123!'
    setPortalAction(true)
    try {
      const accountId = `pa_${Date.now()}`
      const { error } = await supabase.from('client_accounts').insert([{
        id: accountId,
        client_id: params.id,
        email: client.email,
        password: pwd,
        status: 'active'
      }])
      if (error) {
        toast({ title: 'Error creating portal account', description: error.message, variant: 'destructive' })
      } else {
        toast({ title: 'Portal Account Created ✓', description: `Client can now log in at /client/login with their email and the password you set.` })
        setShowCreatePortal(false)
        setPortalPassword('')
        await fetchPortalAccount(params.id)
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setPortalAction(false)
    }
  }

  async function handleResetPassword() {
    if (!portalAccount) return
    const pwd = portalPassword.trim() || 'Welcome123!'
    setPortalAction(true)
    try {
      const { error } = await supabase
        .from('client_accounts')
        .update({ password: pwd })
        .eq('id', portalAccount.id)
      if (error) {
        toast({ title: 'Error resetting password', description: error.message, variant: 'destructive' })
      } else {
        toast({ title: 'Password Reset ✓', description: 'New password has been saved.' })
        setShowResetPassword(false)
        setPortalPassword('')
        await fetchPortalAccount(params.id)
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setPortalAction(false)
    }
  }

  async function handleToggleStatus() {
    if (!portalAccount) return
    const newStatus = portalAccount.status === 'active' ? 'inactive' : 'active'
    setPortalAction(true)
    try {
      const { error } = await supabase
        .from('client_accounts')
        .update({ status: newStatus })
        .eq('id', portalAccount.id)
      if (error) {
        toast({ title: 'Error updating status', description: error.message, variant: 'destructive' })
      } else {
        toast({ title: newStatus === 'active' ? 'Account Activated ✓' : 'Account Deactivated', description: `Portal access has been ${newStatus === 'active' ? 'restored' : 'suspended'}.` })
        await fetchPortalAccount(params.id)
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setPortalAction(false)
    }
  }

  async function fetchDocumentsAndMeetings(clientInfo: any) {
    if (!isSupabaseConfigured() || !clientInfo) return
    try {
      const { data: quotes } = await supabase.from('quotations').select('*')
      const filteredQuotes = quotes?.filter(q => q.client === clientInfo.name || q.client === clientInfo.business) || []
      const { data: invs } = await supabase.from('invoices').select('*')
      const filteredInvs = invs?.filter(i => i.client === clientInfo.name || i.client === clientInfo.business) || []
      const { data: sws } = await supabase.from('sows').select('*')
      const filteredSws = sws?.filter(s => s.client === clientInfo.name || s.client === clientInfo.business || s.project?.includes(clientInfo.business)) || []
      const { data: agrs } = await supabase.from('agreements').select('*')
      const filteredAgrs = agrs?.filter(a => a.client === clientInfo.name || a.client === clientInfo.business) || []

      const allDocs: any[] = [
        ...filteredQuotes.map(q => ({ id: q.id, doc_id: q.doc_id, type: 'Quotation', amount: q.amount, status: q.status, date: q.created || q.created_at?.slice(0, 10) })),
        ...filteredInvs.map(i => ({ id: i.id, doc_id: i.doc_id, type: 'Invoice', amount: i.amount, status: i.status, date: i.created || i.created_at?.slice(0, 10) })),
        ...filteredSws.map(s => ({ id: s.id, doc_id: s.doc_id, type: 'SOW', amount: s.value, status: s.status, date: s.created || s.created_at?.slice(0, 10) })),
        ...filteredAgrs.map(a => ({ id: a.id, doc_id: a.doc_id, type: 'Agreement', amount: a.value, status: a.status, date: a.created || a.created_at?.slice(0, 10) }))
      ]
      setDocuments(allDocs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))

      if (clientInfo.email) {
        const { data: meets } = await supabase
          .from('meetings').select('*')
          .eq('client_email', clientInfo.email)
          .order('meeting_date', { ascending: false })
        if (meets) setMeetings(meets)
      }
    } catch (err) {
      console.error('Error fetching documents/meetings:', err)
    }
  }

  const [businessTypes, setBusinessTypes] = useState<string[]>([
    'Restaurant', 'Hospital', 'School', 'College', 'Software Company',
    'Construction', 'Real Estate', 'Manufacturing', 'Retail', 'Ecommerce',
    'Healthcare', 'Education', 'Other'
  ])

  useEffect(() => {
    async function fetchClient() {
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase.from('crm_clients').select('*').eq('id', params.id).single()
          if (error) {
            toast({ title: 'Error loading client details', description: error.message, variant: 'destructive' })
          } else if (data) {
            setClient({
              id: data.id, name: data.name, business: data.business, type: data.type,
              email: data.email, phone: data.phone, gst: data.gst, website: data.website,
              address: data.address, city: data.city, status: data.status,
              revenue: Number(data.revenue) || 0,
              joined: data.created_at ? new Date(data.created_at).toISOString().slice(0, 10) : '2024-05-15',
              pan: data.pan || ''
            })
          }

          // Fetch active Business Types
          const { data: bData } = await supabase.from('business_types').select('name').eq('status', 'active').order('name', { ascending: true })
          if (bData && bData.length > 0) {
            setBusinessTypes(bData.map((b: any) => b.name))
          }
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        }
      } else {
        setClient(mockClient)
      }
      setLoading(false)
    }
    fetchClient()
  }, [params.id])

  useEffect(() => {
    if (!client) return
    fetchPortalAccount(client.id)
    let active = true

    async function fetchAllData() {
      if (isSupabaseConfigured()) {
        const { data: nData } = await supabase.from('crm_notes').select('*').eq('client_id', params.id).neq('is_deleted', true).order('created_at', { ascending: false })
        if (active && nData) setNotes(nData)
        const { data: aData } = await supabase.from('crm_activities').select('*').eq('client_id', params.id).order('created_at', { ascending: false })
        if (active && aData) setActivities(aData)
        await fetchDocumentsAndMeetings(client)
      } else {
        setNotes([{ id: 'n1', content: 'Met with client to review the service roadmap.', author: 'Staff Member', created_at: '2024-06-05T11:00:00Z' }])
        setActivities([{ id: 'a1', type: 'call', description: 'Log introductory call.', activity_date: '2024-06-01', created_at: '2024-06-01T14:00:00Z' }])
        setDocuments([{ id: 'd1', doc_id: 'NG-QUO-2024-1123', type: 'Quotation', amount: 47998, status: 'sent', date: '2024-06-04' }])
      }
    }

    fetchAllData()

    let notesChannel: any = null
    let activitiesChannel: any = null
    let meetingsChannel: any = null
    let docsChannels: any[] = []

    if (isSupabaseConfigured()) {
      notesChannel = supabase.channel(`crm_notes_${params.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_notes', filter: `client_id=eq.${params.id}` }, (payload: any) => {
          if (!active) return
          const { eventType, new: newRec, old: oldRec } = payload
          if (eventType === 'INSERT') setNotes(prev => [newRec, ...prev])
          else if (eventType === 'UPDATE') {
            if (newRec.is_deleted) {
              setNotes(prev => prev.filter(n => n.id !== newRec.id))
            } else {
              setNotes(prev => prev.map(n => n.id === newRec.id ? newRec : n))
            }
          }
          else if (eventType === 'DELETE') setNotes(prev => prev.filter(n => n.id !== oldRec.id))
        }).subscribe()

      activitiesChannel = supabase.channel(`crm_activities_${params.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_activities', filter: `client_id=eq.${params.id}` }, (payload: any) => {
          if (!active) return
          const { eventType, new: newRec, old: oldRec } = payload
          if (eventType === 'INSERT') setActivities(prev => [newRec, ...prev])
          else if (eventType === 'UPDATE') setActivities(prev => prev.map(a => a.id === newRec.id ? newRec : a))
          else if (eventType === 'DELETE') setActivities(prev => prev.filter(a => a.id !== oldRec.id))
        }).subscribe()

      if (client.email) {
        meetingsChannel = supabase.channel(`crm_meetings_${params.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `client_email=eq.${client.email}` }, () => { if (active) fetchDocumentsAndMeetings(client) })
          .subscribe()
      }

      const tables = ['quotations', 'invoices', 'sows', 'agreements']
      tables.forEach(table => {
        const channel = supabase.channel(`crm_docs_${table}_${params.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table }, () => { if (active) fetchDocumentsAndMeetings(client) })
          .subscribe()
        docsChannels.push(channel)
      })
    }

    return () => {
      active = false
      if (notesChannel) supabase.removeChannel(notesChannel)
      if (activitiesChannel) supabase.removeChannel(activitiesChannel)
      if (meetingsChannel) supabase.removeChannel(meetingsChannel)
      docsChannels.forEach(ch => supabase.removeChannel(ch))
    }
  }, [client, params.id])

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setSubmitting(true)
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('crm_notes').insert([{ client_id: params.id, content: newNote.trim(), author: 'Staff Member' }])
        if (error) { toast({ title: 'Error adding note', description: error.message, variant: 'destructive' }) }
        else {
          setNewNote('')
          toast({ title: 'Note Added' })
          await supabase.from('crm_activities').insert([{ client_id: params.id, type: 'note', description: `Added a note: "${newNote.trim().substring(0, 60)}${newNote.trim().length > 60 ? '...' : ''}"` }])
        }
      } catch (err: any) { toast({ title: 'Database Error', description: err.message, variant: 'destructive' }) }
    } else {
      setNotes(prev => [{ id: Math.random().toString(), client_id: params.id, content: newNote.trim(), author: 'Staff Member', created_at: new Date().toISOString() }, ...prev])
      setNewNote('')
    }
    setSubmitting(false)
  }

  const handleEditNote = async () => {
    if (!editingNoteId || !editNoteContent.trim()) return
    setSubmitting(true)
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('crm_notes')
          .update({ content: editNoteContent.trim(), last_modified: new Date().toISOString() })
          .eq('id', editingNoteId)
        if (error) {
          toast({ title: 'Error updating note', description: error.message, variant: 'destructive' })
        } else {
          toast({ title: 'Note Updated ✓' })
          setNotes(prev => prev.map(n => n.id === editingNoteId ? { ...n, content: editNoteContent.trim(), last_modified: new Date().toISOString() } : n))
          setEditingNoteId(null)
          setEditNoteContent('')
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
      }
    } else {
      setNotes(prev => prev.map(n => n.id === editingNoteId ? { ...n, content: editNoteContent.trim(), last_modified: new Date().toISOString() } : n))
      setEditingNoteId(null)
      setEditNoteContent('')
      toast({ title: 'Note Updated (Mock) ✓' })
    }
    setSubmitting(false)
  }

  const handleDeleteNote = async () => {
    if (!deletingNoteId) return
    setSubmitting(true)
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('crm_notes')
          .update({ is_deleted: true })
          .eq('id', deletingNoteId)
        if (error) {
          toast({ title: 'Error deleting note', description: error.message, variant: 'destructive' })
        } else {
          toast({ title: 'Note Deleted ✓' })
          setNotes(prev => prev.filter(n => n.id !== deletingNoteId))
          setDeletingNoteId(null)
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
      }
    } else {
      setNotes(prev => prev.filter(n => n.id !== deletingNoteId))
      setDeletingNoteId(null)
      toast({ title: 'Note Deleted (Mock) ✓' })
    }
    setSubmitting(false)
  }

  const handlePreviewDoc = async (doc: any) => {
    setPreviewDoc(doc)
    setVersions([])
    setLoadingVersions(true)
    if (isSupabaseConfigured()) {
      try {
        const res = await fetch('/api/document-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_versions', id: doc.id, type: doc.type })
        })
        if (res.ok) {
          const data = await res.json()
          if (data && data.versions) {
            setVersions(data.versions)
          }
        }
      } catch (err) {
        console.error('Error fetching versions:', err)
      }
    } else {
      setVersions([
        { version: 1, created_at: new Date().toISOString(), created_by: 'Staff Member', action: 'Created initial draft' }
      ])
    }
    setLoadingVersions(false)
  }

  const handleAddActivity = async () => {
    if (!newActivityDescription.trim()) return
    setSubmitting(true)
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('crm_activities').insert([{ client_id: params.id, type: newActivityType, description: newActivityDescription.trim() }])
        if (error) { toast({ title: 'Error logging activity', description: error.message, variant: 'destructive' }) }
        else { setNewActivityDescription(''); toast({ title: 'Activity Logged' }) }
      } catch (err: any) { toast({ title: 'Database Error', description: err.message, variant: 'destructive' }) }
    } else {
      setActivities(prev => [{ id: Math.random().toString(), client_id: params.id, type: newActivityType, description: newActivityDescription.trim(), created_at: new Date().toISOString() }, ...prev])
      setNewActivityDescription('')
    }
    setSubmitting(false)
  }

  const handleEditSubmit = async () => {
    if (!editClient || !editClient.name || !editClient.email) return
    setSubmitting(true)
    if (isSupabaseConfigured()) {
      try {
        const dbData = {
          name: editClient.name,
          business: editClient.business,
          type: editClient.type,
          email: editClient.email,
          phone: editClient.phone,
          status: editClient.status,
          revenue: editClient.revenue,
          last_contact: editClient.lastContact || new Date().toISOString().slice(0, 10),
          city: editClient.city,
          gst: editClient.gst,
          address: editClient.address,
          website: editClient.website,
          pan: editClient.pan
        }
        const { error } = await supabase.from('crm_clients').update(dbData).eq('id', editClient.id)
        if (error) { toast({ title: 'Error updating client', description: error.message, variant: 'destructive' }); setSubmitting(false); return }
      } catch (err: any) { toast({ title: 'Database Error', description: err.message, variant: 'destructive' }); setSubmitting(false); return }
    }
    setClient(editClient)
    invalidateCache('crm_clients')
    invalidateCache('dashboard')
    setEditClient(null)
    toast({ title: 'Client Updated', description: `${editClient.name} has been updated successfully.` })
    setSubmitting(false)
  }

  const getTimelineItems = () => {
    const items: any[] = []
    activities.forEach(a => { items.push({ event: a.description, date: a.activity_date || (a.created_at ? a.created_at.slice(0, 10) : ''), type: a.type, timestamp: safeTimestamp(a.created_at || a.activity_date) }) })
    meetings.forEach(m => { items.push({ event: `Scheduled meeting: ${m.event_type} (${m.status})`, date: m.meeting_date, type: 'meeting', timestamp: safeTimestamp(`${m.meeting_date}T${m.meeting_time || '00:00:00'}`) }) })
    documents.forEach(d => { items.push({ event: `${d.type} ${d.doc_id} created (${d.status}) - ${formatCurrency(d.amount)}`, date: d.date, type: d.type.toLowerCase(), timestamp: safeTimestamp(d.date) }) })
    if (client) { items.push({ event: 'Client added to CRM', date: client.joined || (client.created_at ? client.created_at.slice(0, 10) : ''), type: 'new', timestamp: safeTimestamp(client.joined || client.created_at) }) }
    return items.sort((a, b) => b.timestamp - a.timestamp)
  }

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="h-3 w-3 text-gold" />
      case 'email': return <Mail className="h-3 w-3 text-gold" />
      case 'meeting': return <Calendar className="h-3 w-3 text-gold" />
      case 'task': return <ClipboardList className="h-3 w-3 text-gold" />
      case 'note': return <MessageSquare className="h-3 w-3 text-gold" />
      case 'quotation': case 'invoice': case 'sow': case 'agreement': return <FileText className="h-3 w-3 text-gold" />
      default: return <Building2 className="h-3 w-3 text-gold" />
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="h-6 w-6 rounded-full border-2 border-gold/30 border-t-gold animate-spin" /></div>
  if (!client) return <div className="text-center py-12"><p className="text-muted-foreground">Client not found.</p><Link href="/crm" className="mt-4 inline-block"><Button variant="outline">Back to CRM</Button></Link></div>

  const numQuotes = documents.filter(d => d.type === 'Quotation').length
  const numSows = documents.filter(d => d.type === 'SOW').length
  const numInvoices = documents.filter(d => d.type === 'Invoice').length
  const numAgreements = documents.filter(d => d.type === 'Agreement').length
  const docBreakdown = [numQuotes && `${numQuotes} Quotation${numQuotes > 1 ? 's' : ''}`, numSows && `${numSows} SOW${numSows > 1 ? 's' : ''}`, numInvoices && `${numInvoices} Invoice${numInvoices > 1 ? 's' : ''}`, numAgreements && `${numAgreements} Agreement${numAgreements > 1 ? 's' : ''}`].filter(Boolean).join(', ')

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/client/login` : '/client/login'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/crm"><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{client.business}</h1>
              <span className={`status-badge border text-[10px] sm:text-xs shrink-0 ${getLeadStatusColor(client.status)}`}>{client.status.replace('_', ' ')}</span>
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Rep: {client.name} · {client.city}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <Button variant="outline" size="sm" onClick={() => setEditClient({ ...client })} className="gap-1.5"><Edit className="h-3.5 w-3.5" />Edit Details</Button>
          <Select onValueChange={(val) => {
            if (val === 'quotation') window.location.href = `/documents/quotations?clientId=${client.id}&autoOpen=true`
            if (val === 'invoice') window.location.href = `/documents/invoices?clientId=${client.id}&autoOpen=true`
            if (val === 'sow') window.location.href = `/documents/sow?clientId=${client.id}&autoOpen=true`
            if (val === 'agreement') window.location.href = `/documents/agreements?clientId=${client.id}&autoOpen=true`
          }}>
            <SelectTrigger className="w-36 h-8 bg-gold text-slate-900 border-none font-semibold hover:bg-gold/90 transition-colors text-xs py-1">
              <SelectValue placeholder="Quick Create" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quotation" className="text-xs">New Quotation</SelectItem>
              <SelectItem value="invoice" className="text-xs">New Invoice</SelectItem>
              <SelectItem value="sow" className="text-xs">New SOW</SelectItem>
              <SelectItem value="agreement" className="text-xs">New Agreement</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          {/* Contact Card */}
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-col items-center text-center mb-4">
                <Avatar className="h-16 w-16 mb-3">
                  <AvatarFallback className="gold-gradient text-white text-xl font-bold">{getInitials(client.name)}</AvatarFallback>
                </Avatar>
                <h2 className="font-semibold">{client.name}</h2>
                <p className="text-sm text-muted-foreground">{client.type}</p>
              </div>
              <div className="space-y-2.5 text-sm">
                {[{ icon: Mail, val: client.email }, { icon: Phone, val: client.phone }, { icon: Globe, val: client.website }, { icon: MapPin, val: client.address }, { icon: Building2, val: client.gst ? `GST: ${client.gst}` : 'GST not provided' }].map(({ icon: Icon, val }) => (
                  <div key={val} className="flex items-start gap-2 text-muted-foreground">
                    <Icon className="h-4 w-4 mt-0.5 shrink-0 text-gold" />
                    <span className="text-xs leading-relaxed">{val}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold mb-3">Quick Stats</h3>
              <div className="space-y-3">
                {[{ label: 'Total Revenue', val: formatCurrency(client.revenue), color: 'text-gold' }, { label: 'Client Since', val: formatDate(client.joined), color: '' }, { label: 'Documents', val: `${documents.length} (${docBreakdown || 'None'})`, color: '' }].map(s => (
                  <div key={s.label}><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-sm font-semibold mt-0.5 ${s.color}`}>{s.val}</p></div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Portal Access Card — Founder & Admin only */}
          {isPrivileged && (
            <Card className="border-[#1E3A2F]/60">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MonitorSmartphone className="h-4 w-4 text-gold" />
                  Client Portal Access
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-3">
                {portalLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Checking account...</div>
                ) : portalAccount ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs font-medium text-emerald-500">Portal Account Active</span>
                      </div>
                      <Badge variant={portalAccount.status === 'active' ? 'default' : 'secondary'} className="text-[10px] capitalize">
                        {portalAccount.status}
                      </Badge>
                    </div>

                    <div className="bg-muted/40 rounded-lg p-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Login Email</span>
                        <span className="font-mono font-medium truncate max-w-[140px]">{portalAccount.email}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Created</span>
                        <span>{formatDate(portalAccount.created_at)}</span>
                      </div>
                    </div>

                    {/* Portal Link */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted/40 rounded-lg px-3 py-2 text-xs font-mono truncate text-muted-foreground">
                        /client/login
                      </div>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => {
                        navigator.clipboard.writeText(portalUrl)
                        toast({ title: 'Link Copied!', description: 'Portal login URL copied to clipboard.' })
                      }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Link href="/client/login" target="_blank">
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 pt-1">
                      <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={() => { setPortalPassword(''); setShowResetPassword(true) }} disabled={portalAction}>
                        <KeyRound className="h-3.5 w-3.5" />Reset Password
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className={`w-full gap-2 text-xs ${portalAccount.status === 'active' ? 'text-destructive border-destructive/30 hover:bg-destructive/10' : 'text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10'}`}
                        onClick={handleToggleStatus} disabled={portalAction}
                      >
                        {portalAccount.status === 'active'
                          ? <><UserX className="h-3.5 w-3.5" />Deactivate Access</>
                          : <><UserCheck className="h-3.5 w-3.5" />Reactivate Access</>
                        }
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      No portal account yet. Create one so this client can log in to view & sign their documents.
                    </p>
                    <Button variant="gold" size="sm" className="w-full gold-gradient text-white border-0 gap-2" onClick={() => { setPortalPassword(''); setShowCreatePortal(true) }}>
                      <UserCheck className="h-3.5 w-3.5" />Create Portal Account
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}


        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="timeline">
            <TabsList><TabsTrigger value="timeline">Timeline</TabsTrigger><TabsTrigger value="documents">Documents</TabsTrigger><TabsTrigger value="notes">Notes</TabsTrigger></TabsList>

            <TabsContent value="timeline" className="space-y-3 mt-4">
              <Card className="mb-4">
                <CardContent className="p-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Log Activity</h4>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Select value={newActivityType} onValueChange={setNewActivityType}>
                      <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="call">Call</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="task">Task</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex-1 flex gap-2">
                      <Input placeholder="Log what happened (e.g. Discussed website wireframes...)" value={newActivityDescription} onChange={e => setNewActivityDescription(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddActivity() }} />
                      <Button variant="gold" onClick={handleAddActivity} disabled={submitting}>Log</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="mt-6 space-y-1">
                {getTimelineItems().length === 0 ? (
                  <Card><CardContent className="p-4 text-sm text-muted-foreground text-center py-8">No activities recorded yet.</CardContent></Card>
                ) : (
                  getTimelineItems().map((t, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="h-7 w-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">{getTimelineIcon(t.type)}</div>
                        {i < getTimelineItems().length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                      </div>
                      <div className="pb-6 flex-1 pt-1">
                        <p className="text-sm font-medium">{t.event}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(t.date)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              {documents.length === 0 ? (
                <Card><CardContent className="p-4 text-sm text-muted-foreground text-center py-8">No documents yet. Generate a quotation or invoice to see them here.</CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {documents.map((d, i) => {
                    const docLink = d.type === 'Quotation' ? '/documents/quotations' : d.type === 'Invoice' ? '/documents/invoices' : d.type === 'SOW' ? '/documents/sow' : '/documents/agreements'
                    return (
                      <Card key={d.id || i} className="hover:border-gold/30 transition-colors">
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gold/10 text-gold rounded-lg shrink-0"><FileText className="h-5 w-5" /></div>
                            <div><h4 className="font-semibold text-sm">{d.doc_id}</h4><p className="text-xs text-muted-foreground">{d.type} · {formatDate(d.date)}</p></div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gold">{formatCurrency(d.amount)}</span>
                            <Badge variant={d.status === 'paid' || d.status === 'signed' || d.status === 'won' ? 'default' : 'secondary'} className="capitalize text-[10px]">{d.status}</Badge>
                            <Button variant="ghost" size="sm" className="h-8" onClick={() => handlePreviewDoc(d)}>View</Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-4">
              <div className="space-y-3">
                <Textarea placeholder="Type a new client note here..." value={newNote} onChange={e => setNewNote(e.target.value)} className="min-h-[100px] resize-none" />
                <Button variant="gold" onClick={handleAddNote} disabled={submitting || !newNote.trim()}>Add Note</Button>
              </div>
              <div className="space-y-3 mt-6">
                <h4 className="text-sm font-semibold">Previous Notes</h4>
                {notes.length === 0 ? (
                  <Card><CardContent className="p-4 text-sm text-muted-foreground text-center py-8">No notes yet.</CardContent></Card>
                ) : (
                  <div className="space-y-3">
                    {notes.map((n, i) => (
                      <Card key={n.id || i}>
                        <CardContent className="p-4 space-y-1">
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <div className="flex flex-col sm:flex-row sm:gap-2">
                              <span>Added by {n.author}</span>
                              <span className="hidden sm:inline">·</span>
                              <span>{formatDate(n.created_at)}</span>
                              {n.last_modified && n.last_modified !== n.created_at && (
                                <span className="text-muted-foreground/75 italic">
                                  (Edited: {formatDate(n.last_modified)})
                                </span>
                              )}
                            </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                  onClick={() => fetchNoteHistory(n.id)}
                                  title="View Edit History"
                                >
                                  <History className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 text-blue-400 hover:text-blue-300"
                                  onClick={() => {
                                    setEditingNoteId(n.id)
                                    setEditNoteContent(n.content)
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 text-red-400 hover:text-red-300"
                                  onClick={() => setDeletingNoteId(n.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed mt-1 text-foreground/90">{n.content}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Note Dialog */}
      <Dialog open={!!editingNoteId} onOpenChange={v => !v && setEditingNoteId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea 
              placeholder="Edit your note..." 
              value={editNoteContent} 
              onChange={e => setEditNoteContent(e.target.value)} 
              className="min-h-[120px] resize-none" 
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingNoteId(null)} disabled={submitting}>Cancel</Button>
            <Button variant="gold" onClick={handleEditNote} disabled={submitting || !editNoteContent.trim()} className="gold-gradient text-white border-0">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Note Alert Dialog */}
      <Dialog open={!!deletingNoteId} onOpenChange={v => !v && setDeletingNoteId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Note?</DialogTitle>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete this note? This action can be undone by restoring it in the database.</p>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDeletingNoteId(null)} disabled={submitting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteNote} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note History Dialog */}
      <Dialog open={!!historyNoteId} onOpenChange={v => !v && setHistoryNoteId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Note Edit History</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {loadingNoteHistory ? (
              <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
            ) : noteHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No edits recorded for this note yet.</p>
            ) : (
              <div className="space-y-4">
                {noteHistory.map((h) => (
                  <div key={h.id} className="border border-border/50 rounded-lg p-3 space-y-2 bg-muted/10 text-xs">
                    <div className="flex justify-between text-muted-foreground mb-1">
                      <span className="font-medium text-gold">Edited by {h.edited_by || 'Staff Member'}</span>
                      <span>{formatDate(h.edited_at)}</span>
                    </div>
                    {h.content_before && (
                      <div className="space-y-0.5">
                        <span className="font-semibold text-red-400">Before:</span>
                        <p className="text-muted-foreground line-through whitespace-pre-wrap">{h.content_before}</p>
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <span className="font-semibold text-emerald-400">After:</span>
                      <p className="text-foreground whitespace-pre-wrap">{h.content_after}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryNoteId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Document Preview Modal */}
      <Dialog open={!!previewDoc} onOpenChange={v => !v && setPreviewDoc(null)}>
        <DialogContent className="max-w-6xl w-[95vw] h-[85vh] p-0 flex flex-col md:flex-row overflow-hidden bg-[#050e0c] border-[#1E3A2F]/30">
          {previewDoc && (
            <>
              {/* Left Side: PDF IFrame Preview */}
              <div className="flex-1 h-full bg-[#030807] border-r border-[#1E3A2F]/20 relative">
                <iframe
                  src={`/api/document-pdf?id=${previewDoc.id}&type=${previewDoc.type}`}
                  className="w-full h-full border-0 rounded-l-lg"
                  title={`Preview of ${previewDoc.doc_id}`}
                />
              </div>

              {/* Right Side: Document Details & Version History */}
              <div className="w-full md:w-80 h-full p-6 flex flex-col justify-between overflow-y-auto shrink-0 space-y-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gold">{previewDoc.doc_id}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{previewDoc.type}</p>
                  </div>

                  <div className="space-y-3 bg-muted/20 p-4 rounded-lg border border-[#1E3A2F]/10 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-semibold text-gold">{formatCurrency(previewDoc.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date:</span>
                      <span>{formatDate(previewDoc.date)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant={previewDoc.status === 'paid' || previewDoc.status === 'signed' || previewDoc.status === 'won' ? 'default' : 'secondary'} className="capitalize text-[10px]">
                        {previewDoc.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <a
                      href={`/api/document-pdf?id=${previewDoc.id}&type=${previewDoc.type}`}
                      download={`Document_${previewDoc.doc_id}.pdf`}
                      className="w-full"
                    >
                      <Button variant="gold" className="w-full gap-1.5 gold-gradient text-white border-0">
                        Download PDF
                      </Button>
                    </a>
                    <a
                      href={previewDoc.type === 'Quotation' ? `/documents/quotations` : previewDoc.type === 'Invoice' ? `/documents/invoices` : previewDoc.type === 'SOW' ? `/documents/sow` : `/documents/agreements`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full"
                    >
                      <Button variant="outline" className="w-full gap-1.5">
                        Open original page
                      </Button>
                    </a>
                  </div>

                  {/* Version History */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gold">Version History</h4>
                    {loadingVersions ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                        <Loader2 className="h-3 w-3 animate-spin text-gold" /> Loading versions...
                      </div>
                    ) : versions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No other versions recorded.</p>
                    ) : (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                        {versions.map((v, i) => (
                          <div key={v.id || i} className="text-xs border border-[#1E3A2F]/10 rounded p-2 space-y-0.5 bg-[#081713]/40">
                            <div className="flex justify-between font-medium text-foreground">
                              <span>Version {v.version}</span>
                              <span className="text-muted-foreground text-[10px]">{formatDate(v.created_at)}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">Saved by {v.created_by || 'System'}</p>
                            {v.document_data?.history && v.document_data.history.length > 0 && (
                              <p className="text-[10px] text-gold/80 italic mt-0.5">
                                "{v.document_data.history[v.document_data.history.length - 1]?.action}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Button variant="ghost" onClick={() => setPreviewDoc(null)} className="w-full">
                  Close Preview
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={!!editClient} onOpenChange={(open) => !open && setEditClient(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Client Details</DialogTitle></DialogHeader>
          {editClient && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              <div className="space-y-1"><Label>Client Name *</Label><Input placeholder="John Doe" value={editClient.name} onChange={e => setEditClient({ ...editClient, name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Business Name</Label><Input placeholder="Company LLC" value={editClient.business} onChange={e => setEditClient({ ...editClient, business: e.target.value })} /></div>
              <div className="space-y-1"><Label>Email *</Label><Input type="email" value={editClient.email} onChange={e => setEditClient({ ...editClient, email: e.target.value })} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input placeholder="+91 9876543210" value={editClient.phone} onChange={e => setEditClient({ ...editClient, phone: e.target.value })} /></div>
              <div className="space-y-1"><Label>City</Label><Input placeholder="e.g. Mumbai" value={editClient.city} onChange={e => setEditClient({ ...editClient, city: e.target.value })} /></div>
              <div className="space-y-1"><Label>Business Type *</Label>
                <Select value={editClient.type} onValueChange={v => setEditClient({ ...editClient, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{businessTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Lead Status</Label>
                <Select value={editClient.status} onValueChange={v => setEditClient({ ...editClient, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>GST Number</Label><Input placeholder="Optional" value={editClient.gst || ''} onChange={e => setEditClient({ ...editClient, gst: e.target.value })} /></div>
              <div className="space-y-1 sm:col-span-2"><Label>Website</Label><Input placeholder="https://example.com" value={editClient.website || ''} onChange={e => setEditClient({ ...editClient, website: e.target.value })} /></div>
              <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Address</Label><Textarea placeholder="Business address..." className="resize-none h-16" value={editClient.address || ''} onChange={e => setEditClient({ ...editClient, address: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClient(null)} disabled={submitting}>Cancel</Button>
            <Button variant="gold" onClick={handleEditSubmit} disabled={submitting} className="gold-gradient text-white border-0 gap-2">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Portal Account Dialog */}
      <Dialog open={showCreatePortal} onOpenChange={setShowCreatePortal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MonitorSmartphone className="h-5 w-5 text-gold" />Create Client Portal Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
              <p className="text-muted-foreground">Login Email (auto-filled from CRM)</p>
              <p className="font-mono font-semibold">{client.email}</p>
            </div>
            <div className="space-y-1">
              <Label>Portal Password</Label>
              <Input
                type="password"
                placeholder="Leave blank for default: Welcome123!"
                value={portalPassword}
                onChange={e => setPortalPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">If left blank, password will be set to <code className="bg-muted px-1 rounded">Welcome123!</code></p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-400">
              <p className="font-semibold mb-1">What happens next:</p>
              <p>The client will be able to log in at <strong>/client/login</strong> using their email and this password. They'll see all their documents, pending signatures, and completed files.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePortal(false)} disabled={portalAction}>Cancel</Button>
            <Button variant="gold" onClick={handleCreatePortalAccount} disabled={portalAction} className="gold-gradient text-white border-0 gap-2">
              {portalAction ? <><Loader2 className="h-4 w-4 animate-spin" />Creating...</> : <><UserCheck className="h-4 w-4" />Create Account</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetPassword} onOpenChange={setShowResetPassword}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-gold" />Reset Portal Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
              <p className="text-muted-foreground">Account</p>
              <p className="font-mono font-semibold">{portalAccount?.email}</p>
            </div>
            <div className="space-y-1">
              <Label>New Password</Label>
              <Input
                type="password"
                placeholder="Leave blank for default: Welcome123!"
                value={portalPassword}
                onChange={e => setPortalPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">If left blank, password will be reset to <code className="bg-muted px-1 rounded">Welcome123!</code></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetPassword(false)} disabled={portalAction}>Cancel</Button>
            <Button variant="gold" onClick={handleResetPassword} disabled={portalAction} className="gold-gradient text-white border-0 gap-2">
              {portalAction ? <><Loader2 className="h-4 w-4 animate-spin" />Resetting...</> : <><KeyRound className="h-4 w-4" />Reset Password</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
