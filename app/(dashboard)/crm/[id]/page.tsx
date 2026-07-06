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
import { ArrowLeft, Mail, Phone, Building2, Globe, MapPin, Calendar, FileText, Receipt, MessageSquare, ClipboardList, Edit, Loader2, KeyRound, UserCheck, UserX, Copy, ExternalLink, ShieldCheck, MonitorSmartphone, Trash2, History, Briefcase, LifeBuoy, FolderOpen, Activity, Paperclip, CheckCircle2, AlertCircle, Download, Printer, RotateCcw, Zap, Search, Plus, ChevronDown, Clock, Lock, Unlock, Send } from 'lucide-react'
import Link from 'next/link'
import { getInitials, formatDate, formatCurrency, getLeadStatusColor } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { invalidateCache } from '@/lib/data-cache'
import { ShareDialog } from '@/components/ui/share-dialog'
import { PublishDialog } from '@/components/ui/publish-dialog'
import { UniversalTimeline } from '@/components/ui/version-timeline'

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

  // New tab state variables
  const [clientProjects, setClientProjects] = useState<any[]>([])
  const [clientRequirements, setClientRequirements] = useState<any[]>([])
  const [clientFiles, setClientFiles] = useState<any[]>([])
  const [clientSupport, setClientSupport] = useState<any[]>([])
  const [docTimeline, setDocTimeline] = useState<any[]>([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)
  const [shareDoc, setShareDoc] = useState<{ id: string, title: string } | null>(null)

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
    if (!clientInfo) return
    try {
      const [quotes, invs, sws, agrs, projs, meets, support] = await Promise.all([
        isSupabaseConfigured() ? supabase.from('quotations').select('*') : Promise.resolve({ data: [] }),
        isSupabaseConfigured() ? supabase.from('invoices').select('*') : Promise.resolve({ data: [] }),
        isSupabaseConfigured() ? supabase.from('sows').select('*') : Promise.resolve({ data: [] }),
        isSupabaseConfigured() ? supabase.from('agreements').select('*') : Promise.resolve({ data: [] }),
        isSupabaseConfigured() ? supabase.from('projects').select('*') : Promise.resolve({ data: [] }),
        isSupabaseConfigured() && clientInfo.email ? supabase.from('meetings').select('*').eq('client_email', clientInfo.email).order('meeting_date', { ascending: false }) : Promise.resolve({ data: [] }),
        isSupabaseConfigured() ? supabase.from('client_notifications').select('*').or(`client_id.eq."${clientInfo.business}",client_id.eq."${clientInfo.email}",client_id.eq."${clientInfo.id}"`).order('created_at', { ascending: false }) : Promise.resolve({ data: [] })
      ])

      const filteredQuotes = quotes.data?.filter((q: any) => q.client === clientInfo.name || q.client === clientInfo.business) || []
      const filteredInvs = invs.data?.filter((i: any) => i.client === clientInfo.name || i.client === clientInfo.business) || []
      const filteredSws = sws.data?.filter((s: any) => s.client === clientInfo.name || s.client === clientInfo.business || s.project?.includes(clientInfo.business)) || []
      const filteredAgrs = agrs.data?.filter((a: any) => a.client === clientInfo.name || a.client === clientInfo.business) || []

      const allDocs: any[] = [
        ...filteredQuotes.map((q: any) => ({ ...q, type: 'Quotation', date: q.created || q.created_at?.slice(0, 10) })),
        ...filteredInvs.map((i: any) => ({ ...i, type: 'Invoice', date: i.created || i.created_at?.slice(0, 10) })),
        ...filteredSws.map((s: any) => ({ ...s, type: 'SOW', amount: s.value, date: s.created || s.created_at?.slice(0, 10) })),
        ...filteredAgrs.map((a: any) => ({ ...a, type: 'Agreement', amount: a.value, date: a.created || a.created_at?.slice(0, 10) }))
      ]
      setDocuments(allDocs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))

      if (meets.data) setMeetings(meets.data)
      if (support.data) setClientSupport(support.data)

      const filteredProjs = projs.data?.filter((p: any) => p.client?.toLowerCase().trim() === clientInfo.business?.toLowerCase().trim() || p.client?.toLowerCase().trim() === clientInfo.name?.toLowerCase().trim()) || []
      const mappedProjs = filteredProjs.map((p: any) => {
        let extra: any = { type: 'Web Development', budget: 0, spent: 0, timeline: '', progress: 0, milestones: [] as string[], startDate: p.created, pm: 'Strategy Team', currentStage: '', sprintGoal: '', prompt: '', approvalStatus: 'draft', businessDetails: undefined }
        if (p.stack) { try { extra = { ...extra, ...JSON.parse(p.stack) } } catch { extra.pm = p.stack } }
        return {
          id: p.id, title: p.title, client: p.client, type: extra.type, budget: Number(extra.budget) || 0, spent: Number(extra.spent) || 0, timeline: extra.timeline, status: p.status, progress: Number(extra.progress) || 0, milestones: Array.isArray(extra.milestones) ? extra.milestones : [], startDate: extra.startDate || p.created, pm: extra.pm, currentStage: extra.currentStage || '', sprintGoal: extra.sprintGoal || '', history: Array.isArray(p.history) ? p.history : [], prompt: extra.prompt || '', approvalStatus: extra.approvalStatus || 'draft', businessDetails: extra.businessDetails || undefined
        }
      })
      setClientProjects(mappedProjs)

      if (filteredProjs.length > 0) {
        const projIds = filteredProjs.map((p: any) => p.id)
        const [reqs, files] = await Promise.all([
          isSupabaseConfigured() ? supabase.from('project_requirements').select('*').in('project_id', projIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
          isSupabaseConfigured() ? supabase.from('project_files').select('*').in('project_id', projIds).order('uploaded_at', { ascending: false }) : Promise.resolve({ data: [] })
        ])
        if (reqs.data) setClientRequirements(reqs.data)
        if (files.data) setClientFiles(files.data)
      } else {
        setClientRequirements([])
        setClientFiles([])
      }
    } catch (err) {
      console.error('Error fetching documents/meetings/projects:', err)
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

      const tables = ['quotations', 'invoices', 'sows', 'agreements', 'projects', 'project_requirements', 'project_files', 'client_notifications']
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
    setDocTimeline([])
    setLoadingTimeline(true)

    if (isSupabaseConfigured()) {
      try {
        const resVersions = await fetch('/api/document-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_versions', id: doc.id, type: doc.type })
        })
        if (resVersions.ok) {
          const data = await resVersions.json()
          if (data && data.versions) {
            setVersions(data.versions)
          }
        }

        const resTimeline = await fetch('/api/document-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_timeline', id: doc.id, type: doc.type })
        })
        if (resTimeline.ok) {
          const data = await resTimeline.json()
          if (data && data.timeline) {
            setDocTimeline(data.timeline)
          }
        }
      } catch (err) {
        console.error('Error fetching document preview details:', err)
      }
    } else {
      setVersions([
        { version: 1, created_at: new Date().toISOString(), created_by: 'Staff Member', action: 'Created initial draft' }
      ])
      setDocTimeline([
        { action: 'Document Created', date: new Date().toISOString(), user_name: 'Staff Member' }
      ])
    }
    setLoadingVersions(false)
    setLoadingTimeline(false)
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
          <Link href="/crm"><Button variant="ghost" size="icon" aria-label="Action" className="h-8 w-8 shrink-0"><ArrowLeft className="h-4 w-4" /></Button></Link>
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

          {/* Related Records Links */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5 text-gold"><ExternalLink className="h-4 w-4" /> Related Records</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Link href={`/projects?client=${encodeURIComponent(client.business || client.name)}`} className="flex items-center gap-1.5 p-2 rounded-lg bg-[#0a1612]/30 hover:bg-gold/10 hover:text-gold border border-border/40 transition-colors">
                  <Briefcase className="h-3.5 w-3.5 text-gold" />
                  <span>Projects</span>
                </Link>
                <Link href={`/documents/invoices?client=${encodeURIComponent(client.business || client.name)}`} className="flex items-center gap-1.5 p-2 rounded-lg bg-[#0a1612]/30 hover:bg-gold/10 hover:text-gold border border-border/40 transition-colors">
                  <Receipt className="h-3.5 w-3.5 text-gold" />
                  <span>Invoices</span>
                </Link>
                <Link href={`/meetings?client=${encodeURIComponent(client.name)}`} className="flex items-center gap-1.5 p-2 rounded-lg bg-[#0a1612]/30 hover:bg-gold/10 hover:text-gold border border-border/40 transition-colors">
                  <Calendar className="h-3.5 w-3.5 text-gold" />
                  <span>Meetings</span>
                </Link>
                <Link href={`/support?client=${encodeURIComponent(client.business || client.name)}`} className="flex items-center gap-1.5 p-2 rounded-lg bg-[#0a1612]/30 hover:bg-gold/10 hover:text-gold border border-border/40 transition-colors">
                  <LifeBuoy className="h-3.5 w-3.5 text-gold" />
                  <span>Support</span>
                </Link>
                <Link href={`/documents/vault?client=${encodeURIComponent(client.business || client.name)}`} className="flex items-center gap-1.5 p-2 rounded-lg bg-[#0a1612]/30 hover:bg-gold/10 hover:text-gold border border-border/40 transition-colors col-span-2 justify-center">
                  <FolderOpen className="h-3.5 w-3.5 text-gold" />
                  <span>Files & Documents (Vault)</span>
                </Link>
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
                      <Button size="icon" aria-label="Action" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => {
                        navigator.clipboard.writeText(portalUrl)
                        toast({ title: 'Link Copied!', description: 'Portal login URL copied to clipboard.' })
                      }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Link href="/client/login" target="_blank">
                        <Button size="icon" aria-label="Action" variant="ghost" className="h-8 w-8 shrink-0">
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
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="flex flex-wrap gap-1 bg-muted/40 p-1 mb-6 h-auto w-full justify-start border border-border/40 rounded-xl">
              <TabsTrigger value="overview" className="text-xs py-1.5 px-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-gold">Overview</TabsTrigger>
              <TabsTrigger value="documents" className="text-xs py-1.5 px-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-gold">Documents</TabsTrigger>
              <TabsTrigger value="projects" className="text-xs py-1.5 px-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-gold">Projects</TabsTrigger>
              <TabsTrigger value="meetings" className="text-xs py-1.5 px-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-gold">Meetings</TabsTrigger>
              <TabsTrigger value="invoices" className="text-xs py-1.5 px-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-gold">Invoices</TabsTrigger>
              <TabsTrigger value="quotations" className="text-xs py-1.5 px-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-gold">Quotations</TabsTrigger>
              <TabsTrigger value="agreements" className="text-xs py-1.5 px-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-gold">Agreements</TabsTrigger>
              <TabsTrigger value="files" className="text-xs py-1.5 px-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-gold">Files</TabsTrigger>
              <TabsTrigger value="notes" className="text-xs py-1.5 px-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-gold">Notes</TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs py-1.5 px-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-gold">Activity</TabsTrigger>
              <TabsTrigger value="support" className="text-xs py-1.5 px-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-gold">Support</TabsTrigger>
              <TabsTrigger value="requirements" className="text-xs py-1.5 px-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-gold">Requirements</TabsTrigger>
            </TabsList>

            {/* 1. Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-gold flex items-center gap-1.5"><MapPin className="h-4 w-4" />Address</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    {client.address ? (
                      <div className="space-y-2">
                        <p className="text-muted-foreground whitespace-pre-wrap">{client.address}</p>
                        {client.city && <p className="text-muted-foreground"><span className="font-medium text-foreground">City:</span> {client.city}</p>}
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic">No address provided.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gold">Tax & Financial Settings</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">GSTIN Status</span>
                    <span className="font-mono font-medium">{client.gst || 'Not Registered'}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions Panel */}
              <Card className="border border-gold/20 bg-gold/[0.02]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gold flex items-center gap-1.5"><Zap className="h-4 w-4 text-gold" />Quick Document & Project Generators</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-4">Instantly generate client paperwork pre-filled with company details, active contacts, and TAX settings.</p>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" className="min-w-[160px] flex-1 sm:flex-initial border-gold/30 hover:border-gold hover:bg-gold/10 text-xs h-9 justify-start gap-1.5 text-left" onClick={() => window.location.href = `/documents/quotations?clientId=${client.id}&autoOpen=true`}>
                      <Plus className="h-3.5 w-3.5" />New Quotation
                    </Button>
                    <Button variant="outline" className="min-w-[160px] flex-1 sm:flex-initial border-gold/30 hover:border-gold hover:bg-gold/10 text-xs h-9 justify-start gap-1.5 text-left" onClick={() => window.location.href = `/documents/invoices?clientId=${client.id}&autoOpen=true`}>
                      <Plus className="h-3.5 w-3.5" />New Invoice
                    </Button>
                    <Button variant="outline" className="min-w-[160px] flex-1 sm:flex-initial border-gold/30 hover:border-gold hover:bg-gold/10 text-xs h-9 justify-start gap-1.5 text-left" onClick={() => window.location.href = `/documents/sow?clientId=${client.id}&autoOpen=true`}>
                      <Plus className="h-3.5 w-3.5" />New SOW
                    </Button>
                    <Button variant="outline" className="min-w-[160px] flex-1 sm:flex-initial border-gold/30 hover:border-gold hover:bg-gold/10 text-xs h-9 justify-start gap-1.5 text-left" onClick={() => window.location.href = `/documents/agreements?clientId=${client.id}&autoOpen=true`}>
                      <Plus className="h-3.5 w-3.5" />New Agreement
                    </Button>
                    <Button variant="outline" className="min-w-[160px] flex-1 sm:flex-initial border-gold/30 hover:border-gold hover:bg-gold/10 text-xs h-9 justify-start gap-1.5 text-left" onClick={() => window.location.href = `/projects?clientId=${client.id}&autoOpen=true`}>
                      <Plus className="h-3.5 w-3.5" />New Project
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 2. Documents Tab */}
            <TabsContent value="documents">
              {documents.length === 0 ? (
                <Card><CardContent className="p-4 text-sm text-muted-foreground text-center py-8">No documents generated yet.</CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {documents.map((d, i) => (
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
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 3. Projects Tab */}
            <TabsContent value="projects">
              {clientProjects.length === 0 ? (
                <Card><CardContent className="p-4 text-sm text-muted-foreground text-center py-8">No active projects found for this client.</CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {clientProjects.map((p) => (
                    <Card key={p.id} className="hover:border-gold/30 transition-colors">
                      <CardContent className="p-5 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-base text-foreground">{p.title}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">PM: {p.pm || 'Unassigned'} · Tech: {p.stack || 'General'}</p>
                          </div>
                          <Badge className="capitalize">{p.status}</Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Project Progress</span>
                            <span>{p.progress || 0}%</span>
                          </div>
                          <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                            <div className="bg-gold h-full rounded-full transition-all" style={{ width: `${p.progress || 0}%` }} />
                          </div>
                        </div>
                        <div className="flex justify-between text-xs border-t border-border/40 pt-3">
                          <div>
                            <span className="text-muted-foreground block">Total Budget</span>
                            <span className="font-semibold text-gold">{formatCurrency(p.budget)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Spent Budget</span>
                            <span className="font-semibold text-muted-foreground">{formatCurrency(p.spent)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Timeline</span>
                            <span className="font-medium text-foreground">{p.timeline}</span>
                          </div>
                          <Button variant="outline" size="sm" className="h-8 text-xs self-center" onClick={() => window.location.href = `/projects?projectId=${p.id}`}>
                            Workspace <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 4. Meetings Tab */}
            <TabsContent value="meetings">
              {meetings.length === 0 ? (
                <Card><CardContent className="p-4 text-sm text-muted-foreground text-center py-8">No meetings scheduled.</CardContent></Card>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground uppercase">
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Time</th>
                        <th className="py-2 px-3">Topic / Event</th>
                        <th className="py-2 px-3">Duration</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meetings.map((m, idx) => (
                        <tr key={m.id || idx} className="border-b border-border/50 hover:bg-muted/10">
                          <td className="py-3 px-3 font-medium">{m.meeting_date}</td>
                          <td className="py-3 px-3 font-mono text-xs">{m.meeting_time || 'N/A'}</td>
                          <td className="py-3 px-3">
                            <p className="font-semibold">{m.event_type || 'General Sync'}</p>
                            {m.notes && <p className="text-xs text-muted-foreground mt-0.5">{m.notes}</p>}
                          </td>
                          <td className="py-3 px-3 text-xs text-muted-foreground">{m.duration || '30 mins'}</td>
                          <td className="py-3 px-3">
                            <Badge variant="outline" className="capitalize text-[10px]">{m.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* 5. Invoices Tab */}
            <TabsContent value="invoices">
              {documents.filter(d => d.type === 'Invoice').length === 0 ? (
                <Card><CardContent className="p-4 text-sm text-muted-foreground text-center py-8">No invoices found for this client.</CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {documents.filter(d => d.type === 'Invoice').map((d, i) => (
                    <Card key={d.id || i} className="hover:border-gold/30 transition-colors">
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gold/10 text-gold rounded-lg shrink-0"><Receipt className="h-5 w-5" /></div>
                          <div><h4 className="font-semibold text-sm">{d.doc_id}</h4><p className="text-xs text-muted-foreground">Due: {d.due || 'N/A'} · Created: {formatDate(d.date)}</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gold">{formatCurrency(d.amount)}</span>
                          <Badge variant={d.status === 'paid' ? 'default' : 'secondary'} className="capitalize text-[10px]">{d.status}</Badge>
                          <Button variant="ghost" size="sm" className="h-8" onClick={() => handlePreviewDoc(d)}>View</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 6. Quotations Tab */}
            <TabsContent value="quotations">
              {documents.filter(d => d.type === 'Quotation').length === 0 ? (
                <Card><CardContent className="p-4 text-sm text-muted-foreground text-center py-8">No quotations found for this client.</CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {documents.filter(d => d.type === 'Quotation').map((d, i) => (
                    <Card key={d.id || i} className="hover:border-gold/30 transition-colors">
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gold/10 text-gold rounded-lg shrink-0"><FileText className="h-5 w-5" /></div>
                          <div><h4 className="font-semibold text-sm">{d.doc_id}</h4><p className="text-xs text-muted-foreground">Validity: {d.valid || d.validityDays || '14'} Days · Created: {formatDate(d.date)}</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gold">{formatCurrency(d.amount)}</span>
                          <Badge variant={d.status === 'approved' || d.status === 'signed' ? 'default' : 'secondary'} className="capitalize text-[10px]">{d.status}</Badge>
                          <Button variant="ghost" size="sm" className="h-8" onClick={() => handlePreviewDoc(d)}>View</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 7. Agreements Tab */}
            <TabsContent value="agreements">
              {documents.filter(d => d.type === 'Agreement' || d.type === 'SOW').length === 0 ? (
                <Card><CardContent className="p-4 text-sm text-muted-foreground text-center py-8">No agreements or SOWs generated yet.</CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {documents.filter(d => d.type === 'Agreement' || d.type === 'SOW').map((d, i) => (
                    <Card key={d.id || i} className="hover:border-gold/30 transition-colors">
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gold/10 text-gold rounded-lg shrink-0"><ClipboardList className="h-5 w-5" /></div>
                          <div><h4 className="font-semibold text-sm">{d.doc_id}</h4><p className="text-xs text-muted-foreground">{d.type} · Created: {formatDate(d.date)}</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gold">{formatCurrency(d.amount)}</span>
                          <Badge variant={d.status === 'signed' ? 'default' : 'secondary'} className="capitalize text-[10px]">{d.status}</Badge>
                          <Button variant="ghost" size="sm" className="h-8" onClick={() => handlePreviewDoc(d)}>View</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 8. Files Tab */}
            <TabsContent value="files">
              {clientFiles.length === 0 ? (
                <Card><CardContent className="p-4 text-sm text-muted-foreground text-center py-8">No uploaded files for this client.</CardContent></Card>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground font-semibold uppercase">
                        <th className="py-2 px-3">File Name</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3">Version</th>
                        <th className="py-2 px-3">Uploaded</th>
                        <th className="py-2 px-3">Visibility</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientFiles.map((file, idx) => (
                        <tr key={file.id || idx} className="border-b border-border/40 hover:bg-muted/10 text-xs">
                          <td className="py-3 px-3 font-semibold text-foreground flex items-center gap-2"><Paperclip className="h-3.5 w-3.5 text-gold shrink-0" />{file.file_name}</td>
                          <td className="py-3 px-3 text-muted-foreground">{file.category}</td>
                          <td className="py-3 px-3 font-mono">v{file.version || '1'}</td>
                          <td className="py-3 px-3 text-muted-foreground">{formatDate(file.uploaded_at)}</td>
                          <td className="py-3 px-3"><Badge variant="outline" className="text-[9px]">{file.visibility}</Badge></td>
                          <td className="py-3 px-3 text-right">
                            {file.file_path && (
                              <a href={file.file_path} target="_blank" rel="noreferrer">
                                <Button variant="ghost" size="icon" aria-label="Download" className="h-6 w-6"><Download className="h-3 w-3" /></Button>
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* 9. Notes Tab */}
            <TabsContent value="notes" className="space-y-4">
              <div className="space-y-3">
                <Textarea placeholder="Type a new client note here..." value={newNote} onChange={e => setNewNote(e.target.value)} className="min-h-[100px] resize-none" />
                <Button variant="gold" onClick={handleAddNote} disabled={submitting || !newNote.trim()}>Add Note</Button>
              </div>
              <div className="space-y-3 mt-6">
                <h4 className="text-sm font-semibold text-gold">Previous Notes</h4>
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
                              <Button variant="ghost" size="icon" aria-label="View Edit History" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => fetchNoteHistory(n.id)} title="View Edit History">
                                <History className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" aria-label="Action" className="h-6 w-6 text-blue-400 hover:text-blue-300" onClick={() => { setEditingNoteId(n.id); setEditNoteContent(n.content) }}>
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" aria-label="Action" className="h-6 w-6 text-red-400 hover:text-red-300" onClick={() => setDeletingNoteId(n.id)}>
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

            {/* 10. Activity Tab */}
            <TabsContent value="timeline" className="space-y-3">
              <Card className="mb-4">
                <CardContent className="p-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gold flex items-center gap-1.5"><Activity className="h-4 w-4" />Log Activity Log</h4>
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

              <div className="mt-6">
                <UniversalTimeline
                  enableFilters={true}
                  entries={getTimelineItems().map(t => {
                    let actionType: any = 'custom'
                    if (t.type === 'new') actionType = 'created'
                    else if (t.type === 'email') actionType = 'sent'
                    else if (t.type === 'note') actionType = 'note'
                    else if (['quotation', 'invoice', 'sow', 'agreement'].includes(t.type)) actionType = 'created'

                    let linkedRecord = undefined
                    if (['quotation', 'invoice', 'sow', 'agreement'].includes(t.type)) {
                      const typePath = t.type === 'sow' ? 'sow' : t.type === 'invoice' ? 'invoices' : t.type === 'quotation' ? 'quotations' : 'agreements'
                      linkedRecord = { label: `View Document`, href: `/documents/${typePath}` }
                    } else if (t.type === 'meeting') {
                      linkedRecord = { label: `View Meetings`, href: `/meetings` }
                    }

                    return {
                      action: t.event,
                      actionType,
                      date: t.date,
                      by: t.type === 'note' ? 'Staff Member' : undefined,
                      linkedRecord,
                      module: 'CRM'
                    }
                  })}
                />
              </div>
            </TabsContent>

            {/* 11. Support Tab */}
            <TabsContent value="support">
              {clientSupport.length === 0 ? (
                <Card><CardContent className="p-4 text-sm text-muted-foreground text-center py-8">No support tickets reported.</CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {clientSupport.map((ticket, i) => (
                    <Card key={ticket.id || i} className="hover:border-gold/30 transition-colors">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5"><LifeBuoy className="h-4 w-4 text-gold" />{ticket.title}</h4>
                          <span className="text-[10px] text-muted-foreground">{formatDate(ticket.created_at)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{ticket.message}</p>
                        <div className="flex justify-between items-center text-[10px] pt-1">
                          <span className="text-muted-foreground">Type: <span className="font-semibold text-gold capitalize">{ticket.type}</span></span>
                          <Badge variant={ticket.read ? 'outline' : 'default'} className="text-[9px]">{ticket.read ? 'Read' : 'Unread'}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 12. Requirements Tab */}
            <TabsContent value="requirements">
              {clientRequirements.length === 0 ? (
                <Card><CardContent className="p-4 text-sm text-muted-foreground text-center py-8">No requirements logged for this client's active projects.</CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {clientRequirements.map((req, i) => (
                    <Card key={req.id || i} className="hover:border-gold/30 transition-colors">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-sm text-foreground">{req.title}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">Category: {req.category} · Priority: <span className="capitalize font-medium">{req.priority}</span></p>
                          </div>
                          <Badge variant={req.status === 'completed' || req.status === 'approved' ? 'default' : 'secondary'} className="capitalize text-[10px]">{req.status}</Badge>
                        </div>
                        {req.description && <p className="text-xs text-muted-foreground">{req.description}</p>}
                        <div className="flex justify-between items-center text-[10px] border-t border-border/30 pt-2 text-muted-foreground">
                          <span>Due: {req.due_date ? formatDate(req.due_date) : 'N/A'}</span>
                          {req.is_required && <span className="text-red-400 font-semibold uppercase tracking-wide text-[8px] border border-red-500/20 bg-red-500/5 px-1.5 py-0.5 rounded">Required</span>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
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


      {/* Document Preview Drawer */}
      <Dialog open={!!previewDoc} onOpenChange={v => !v && setPreviewDoc(null)}>
        <DialogContent className="fixed right-0 top-0 left-auto top-auto translate-x-0 translate-y-0 h-screen w-full max-w-5xl p-0 flex flex-col md:flex-row overflow-hidden bg-background border-l border-border shadow-2xl rounded-l-2xl animate-in slide-in-from-right duration-300 !left-auto !top-auto !translate-x-0 !translate-y-0 !right-0 !top-0 h-screen w-[95vw] max-w-5xl">
          {previewDoc && (() => {
            const isLocked = previewDoc.is_locked || previewDoc.status === 'signed' || previewDoc.status === 'completed' || previewDoc.status === 'paid';
            const isSigned = previewDoc.status === 'signed' || previewDoc.signed_at;

            return (
              <>
                {/* Left Side: PDF IFrame Preview */}
                <div className="flex-1 h-full bg-black/40 border-r border-border relative font-sans">
                  <iframe
                    id="preview-doc-iframe"
                    src={`/api/document-pdf?id=${previewDoc.id}&type=${previewDoc.type}`}
                    className="w-full h-full border-0 rounded-l-2xl"
                    title={`Preview of ${previewDoc.doc_id}`}
                  />
                </div>

                {/* Right Side: Document Details, Audit Logs & Actions */}
                <div className="w-full md:w-[380px] h-full p-6 flex flex-col justify-between overflow-y-auto shrink-0 bg-background/95 space-y-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-gold">{previewDoc.doc_id}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{previewDoc.type}</p>
                    </div>

                    {/* Lock Status & Signature Badge */}
                    <div className="space-y-2 border-y border-border/40 py-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Lock Status:</span>
                        <Badge variant={isLocked ? "default" : "outline"} className={`flex items-center gap-1 text-[10px] ${isLocked ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
                          {isLocked ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                          {isLocked ? 'Locked (Read-Only)' : 'Unlocked'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Sign Status:</span>
                        <Badge variant={isSigned ? "default" : "outline"} className={`flex items-center gap-1 text-[10px] ${isSigned ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                          <ShieldCheck className="h-2.5 w-2.5" />
                          {isSigned ? 'Signed' : 'Awaiting Signatures'}
                        </Badge>
                      </div>
                    </div>

                    {/* Metadata Card */}
                    <div className="space-y-2 bg-muted/20 p-4 rounded-xl border border-border/30 text-xs">
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
                        <Badge variant={previewDoc.status === 'paid' || previewDoc.status === 'signed' || previewDoc.status === 'won' ? 'default' : 'secondary'} className="capitalize text-[9px] h-5">
                          {previewDoc.status}
                        </Badge>
                      </div>
                    </div>

                    {/* Quick Operations Actions */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gold">Actions</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={`/api/document-pdf?id=${previewDoc.id}&type=${previewDoc.type}`}
                          download={`Document_${previewDoc.doc_id}.pdf`}
                          className="w-full col-span-2"
                        >
                          <Button variant="gold" className="w-full gap-1.5 gold-gradient text-white border-0 text-xs h-8">
                            <Download className="h-3.5 w-3.5" /> Download PDF
                          </Button>
                        </a>
                        <Button
                          variant="outline"
                          onClick={() => {
                            const iframe = document.getElementById('preview-doc-iframe') as HTMLIFrameElement
                            if (iframe && iframe.contentWindow) {
                              iframe.contentWindow.focus()
                              iframe.contentWindow.print()
                            }
                          }}
                          className="w-full text-xs h-8 gap-1.5"
                        >
                          <Printer className="h-3.5 w-3.5" /> Print
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShareDoc({ id: previewDoc.id, title: `${previewDoc.doc_id} - ${client?.business || client?.name}` })}
                          className="w-full text-xs h-8 gap-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/5"
                        >
                          <Send className="h-3.5 w-3.5" /> Send Document
                        </Button>
                      </div>
                    </div>

                    {/* Version History */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gold">Version History</h4>
                      {loadingVersions ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                          <Loader2 className="h-3 w-3 animate-spin text-gold" /> Loading versions...
                        </div>
                      ) : versions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No other versions recorded.</p>
                      ) : (
                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                          {versions.map((v, i) => (
                            <div key={v.id || i} className="text-xs border border-border/40 rounded p-2 space-y-0.5 bg-muted/10">
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

                    {/* Audit Timeline / Log */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gold">Audit Timeline</h4>
                      {loadingTimeline ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                          <Loader2 className="h-3 w-3 animate-spin text-gold" /> Loading audit logs...
                        </div>
                      ) : docTimeline.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No logs recorded.</p>
                      ) : (
                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                          {docTimeline.map((item: any, idx: number) => (
                            <div key={idx} className="text-xs border border-border/30 rounded p-2 bg-muted/5 space-y-0.5">
                              <div className="flex justify-between font-medium text-foreground">
                                <span>{item.action}</span>
                                <span className="text-muted-foreground text-[9px]">{formatDate(item.date)}</span>
                              </div>
                              {item.user_name && <p className="text-[9px] text-muted-foreground/75">by {item.user_name}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/40 flex gap-2">
                    <a
                      href={previewDoc.type === 'Quotation' ? `/documents/quotations` : previewDoc.type === 'Invoice' ? `/documents/invoices` : previewDoc.type === 'SOW' ? `/documents/sow` : `/documents/agreements`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button variant="outline" className="w-full text-xs h-9 gap-1">
                        Open original <ExternalLink className="h-3 w-3" />
                      </Button>
                    </a>
                    <Button variant="ghost" onClick={() => setPreviewDoc(null)} className="flex-1 text-xs h-9">
                      Close Drawer
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {shareDoc && previewDoc && (
        <ShareDialog
          open={!!shareDoc}
          onOpenChange={(open) => !open && setShareDoc(null)}
          title={shareDoc.title}
          initialEmail={client?.email || ''}
          initialSubject={`Document Shared: ${shareDoc.title}`}
          initialMessage={`Dear Client,\n\nPlease find the document ${shareDoc.title} attached for your review and action.\n\nRegards,\nNetgain Team`}
          onSend={async (methods, emailDetails) => {
            if (isSupabaseConfigured()) {
              const res = await fetch('/api/document-actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'send',
                  id: shareDoc.id,
                  type: previewDoc.type,
                  methods,
                  emailDetails
                })
              })
              if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to send')
              }
              await fetchDocumentsAndMeetings(client)
            }
          }}
        />
      )}

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
