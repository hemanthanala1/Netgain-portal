'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Search, FileText, Download, Clock, CheckCircle2, AlertTriangle, FileCheck2,
  FolderOpen, Building2, User, Loader2, RefreshCw, LogOut, FileSignature,
  LayoutDashboard, Briefcase, Bell, HelpCircle, Send, Printer, ArrowLeft,
  Shield, History, Globe, UserCheck, Eye, X, Check, ChevronRight, Scale,
  Coins, TrendingUp
} from 'lucide-react'

// Simple Dialog mock/adapter in case custom Dialog components are missing
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ClientDoc {
  id: string
  docId: string
  type: 'Quotation' | 'Invoice' | 'SOW' | 'Agreement' | 'Marketing'
  title: string
  amount: number
  status: string
  date: string
  token: string | null
  raw: any
  published_version: number
  published_at: string
  viewed_at: string | null
  downloaded_at: string | null
  signed_at: string | null
  visibility_status: string
}

interface Project {
  id: string
  docId: string
  title: string
  client: string
  stack: string
  status: string
  created: string
  history: { date: string; action: string }[]
}

interface ClientNotification {
  id: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export default function ClientDashboardPage() {
  const [session, setSession] = useState<any>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('dashboard')
  
  // Data States
  const [docs, setDocs] = useState<ClientDoc[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [notifications, setNotifications] = useState<ClientNotification[]>([])
  
  // UI Interaction States
  const [search, setSearch] = useState('')
  const [selectedDoc, setSelectedDoc] = useState<ClientDoc | null>(null)
  const [showSignModal, setShowSignModal] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [signingAgreed, setSigningAgreed] = useState(false)
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [revisionNotes, setRevisionNotes] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)
  
  // Support Form State
  const [supportSubject, setSupportSubject] = useState('')
  const [supportMessage, setSupportMessage] = useState('')
  
  const router = useRouter()
  const { toast } = useToast()

  // ─── 1. Read session from localStorage (client-side only) ───
  useEffect(() => {
    const cached = localStorage.getItem('netgain_client_session')
    if (!cached) {
      router.push('/client/login')
      return
    }
    try {
      const sess = JSON.parse(cached)
      setSession(sess)
    } catch {
      localStorage.removeItem('netgain_client_session')
      router.push('/client/login')
    }
    setSessionReady(true)
  }, [])

  // ─── 2. Fetch Client Data ───
  const fetchClientData = useCallback(async (sess: any, isRefresh = false) => {
    if (!sess || !isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const clientEmail = (sess.email || '').toLowerCase().trim()
      const clientCompany = (sess.company || '').toLowerCase().trim()
      const clientPhone = (sess.phone || '').trim()

      const matchDoc = (d: any) => {
        if (!d) return false
        const docClient = (d.client || '').toLowerCase().trim()
        const docContact = (d.contact || '').toLowerCase().trim()
        const docEmail = (d.email || d.client_email || '').toLowerCase().trim()
        const docPhone = (d.phone || '').trim()

        return (
          (clientCompany && docClient === clientCompany) ||
          (sess.name && docClient === (sess.name || '').toLowerCase().trim()) ||
          (sess.name && docContact === (sess.name || '').toLowerCase().trim()) ||
          (clientEmail && docEmail === clientEmail) ||
          (clientPhone && docPhone && docPhone === clientPhone)
        )
      }

      // Fetch from Supabase tables
      const [quosRes, sowsRes, agrsRes, invsRes, mrRes, projRes, notifRes, tokensRes] = await Promise.all([
        supabase.from('quotations').select('*'),
        supabase.from('sows').select('*'),
        supabase.from('agreements').select('*'),
        supabase.from('invoices').select('*'),
        supabase.from('marketing_reports').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('client_notifications').select('*').or(`client_id.eq."${sess.company}",client_id.eq."${sess.email}"`).order('created_at', { ascending: false }),
        supabase.from('document_tokens').select('*').eq('status', 'active')
      ])

      // Build token lookup map
      const tokenMap = new Map<string, string>()
      if (tokensRes.data) {
        tokensRes.data.forEach((t: any) => {
          tokenMap.set(`${t.document_type}_${t.document_id}`, t.token)
        })
      }

      // Map combined docs (Only showing published and non-hidden documents)
      const combined: ClientDoc[] = []

      ;(quosRes.data || []).filter(matchDoc).filter(q => q.published && q.visibility_status !== 'hidden').forEach(q => combined.push({
        id: q.id, docId: q.doc_id, type: 'Quotation',
        title: q.project_title || 'Service Quotation',
        amount: Number(q.amount) || 0, status: q.status || 'published',
        date: q.created || q.created_at?.slice(0, 10),
        token: tokenMap.get(`Quotation_${q.id}`) || null, raw: q,
        published_version: q.published_version || 1,
        published_at: q.published_at || q.created_at,
        viewed_at: q.viewed_at, downloaded_at: q.downloaded_at, signed_at: q.signed_at,
        visibility_status: q.visibility_status || 'visible'
      }))

      ;(sowsRes.data || []).filter(matchDoc).filter(s => s.published && s.visibility_status !== 'hidden').forEach(s => combined.push({
        id: s.id, docId: s.doc_id, type: 'SOW',
        title: s.project || 'Scope of Work',
        amount: Number(s.value) || 0, status: s.status || 'published',
        date: s.created || s.created_at?.slice(0, 10),
        token: tokenMap.get(`SOW_${s.id}`) || null, raw: s,
        published_version: s.published_version || 1,
        published_at: s.published_at || s.created_at,
        viewed_at: s.viewed_at, downloaded_at: s.downloaded_at, signed_at: s.signed_at,
        visibility_status: s.visibility_status || 'visible'
      }))

      ;(agrsRes.data || []).filter(matchDoc).filter(a => a.published && a.visibility_status !== 'hidden').forEach(a => combined.push({
        id: a.id, docId: a.doc_id, type: 'Agreement',
        title: a.type || 'Service Agreement',
        amount: Number(a.value) || 0, status: a.status || 'published',
        date: a.created || a.created_at?.slice(0, 10),
        token: tokenMap.get(`Agreement_${a.id}`) || null, raw: a,
        published_version: a.published_version || 1,
        published_at: a.published_at || a.created_at,
        viewed_at: a.viewed_at, downloaded_at: a.downloaded_at, signed_at: a.signed_at,
        visibility_status: a.visibility_status || 'visible'
      }))

      ;(invsRes.data || []).filter(matchDoc).filter(i => i.published && i.visibility_status !== 'hidden').forEach(i => combined.push({
        id: i.id, docId: i.doc_id, type: 'Invoice',
        title: `Tax Invoice — ${i.doc_id}`,
        amount: Number(i.amount) || 0, status: i.status || 'published',
        date: i.created || i.created_at?.slice(0, 10),
        token: tokenMap.get(`Invoice_${i.id}`) || null, raw: i,
        published_version: i.published_version || 1,
        published_at: i.published_at || i.created_at,
        viewed_at: i.viewed_at, downloaded_at: i.downloaded_at, signed_at: i.signed_at,
        visibility_status: i.visibility_status || 'visible'
      }))

      ;(mrRes.data || []).filter(matchDoc).filter(r => r.published && r.visibility_status !== 'hidden').forEach(r => {
        let titleVal = 'Marketing Performance Report'
        try {
          const parsed = JSON.parse(r.title)
          if (parsed && parsed.period) {
            titleVal = `Marketing Report — ${parsed.period}`
          }
        } catch {}
        combined.push({
          id: r.id, docId: r.doc_id, type: 'Marketing',
          title: titleVal,
          amount: 0, status: r.status || 'published',
          date: r.created || r.created_at?.slice(0, 10),
          token: null, raw: r,
          published_version: r.published_version || 1,
          published_at: r.published_at || r.created_at,
          viewed_at: r.viewed_at, downloaded_at: r.downloaded_at, signed_at: r.signed_at,
          visibility_status: r.visibility_status || 'visible'
        })
      })

      setDocs(combined)

      // Map matching projects
      const matchedProjects: Project[] = (projRes.data || []).filter(p => {
        const docClient = (p.client || '').toLowerCase().trim()
        return docClient === clientCompany || docClient === (sess.name || '').toLowerCase().trim()
      }).map((p: any) => ({
        id: p.id,
        docId: p.doc_id,
        title: p.title,
        client: p.client,
        stack: p.stack || 'Custom Stack',
        status: p.status || 'active',
        created: p.created || p.created_at?.slice(0, 10),
        history: Array.isArray(p.history) ? p.history : []
      }))

      setProjects(matchedProjects)

      // Map notifications
      if (notifRes.data) {
        setNotifications(notifRes.data)
      }

      if (isRefresh) {
        toast({ title: 'Portal Updated', description: 'Realtime data loaded successfully.' })
      }
    } catch (e: any) {
      console.error('Portal fetch error:', e)
      toast({ title: 'Error Loading Portal', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [toast])

  // ─── 3. Fetch when session is ready ───
  useEffect(() => {
    if (sessionReady && session) {
      fetchClientData(session, false)
    }
  }, [sessionReady, session, fetchClientData])

  // ─── 4. Real-time subscriptions — auto-refresh when docs change ───
  useEffect(() => {
    if (!session || !isSupabaseConfigured()) return

    const tables = ['quotations', 'invoices', 'sows', 'agreements', 'marketing_reports', 'projects', 'client_notifications']
    const channels = tables.map(table =>
      supabase
        .channel(`client_portal_${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          fetchClientData(session, false)
        })
        .subscribe()
    )

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch))
    }
  }, [session, fetchClientData])

  // ─── 5. Track Activity (Viewed At, Downloaded At, Signed At, IP Address, Browser, Device) ───
  const trackActivity = async (doc: ClientDoc, action: 'view' | 'download' | 'sign') => {
    let ip = 'Unknown IP'
    try {
      const res = await fetch('https://api.ipify.org?format=json')
      const data = await res.json()
      ip = data.ip || 'Unknown IP'
    } catch {}

    const browser = navigator.userAgent
    const device = window.innerWidth < 768 ? 'Mobile' : 'Desktop'

    const tableMap: Record<string, string> = {
      Quotation: 'quotations',
      Invoice: 'invoices',
      SOW: 'sows',
      Agreement: 'agreements',
      Marketing: 'marketing_reports'
    }

    const tableName = tableMap[doc.type]
    if (!tableName) return

    const nowStr = new Date().toISOString()
    const updates: any = {
      ip_address: ip,
      browser: browser.slice(0, 150),
      device: device
    }

    if (action === 'view') {
      updates.viewed_at = nowStr
      if (doc.status === 'published') updates.status = 'viewed'
    } else if (action === 'download') {
      updates.downloaded_at = nowStr
    } else if (action === 'sign') {
      updates.signed_at = nowStr
      updates.status = 'completed'
    }

    try {
      const { error } = await supabase.from(tableName).update(updates).eq('id', doc.id)
      if (error) throw error

      // Log to document history log
      const histAction = action === 'view' ? 'Document viewed' : action === 'download' ? 'Document downloaded' : 'Document signed'
      const updatedHistory = [
        ...(doc.raw.history || []),
        { date: new Date().toISOString().split('T')[0], action: `${histAction} by client (${device} · ${ip})` }
      ]
      await supabase.from(tableName).update({ history: updatedHistory }).eq('id', doc.id)
      
      // Update local state smoothly
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, ...updates } : d))
    } catch (err) {
      console.error('Error tracking activity:', err)
    }
  }

  // ─── 6. Document Viewer trigger ───
  const openDoc = (doc: ClientDoc) => {
    setSelectedDoc(doc)
    trackActivity(doc, 'view')
  }

  const handleDownloadPdf = async (doc: ClientDoc) => {
    await trackActivity(doc, 'download')
    toast({ title: 'Downloading PDF', description: `${doc.docId} download started.` })
    
    // Trigger download using Next.js token-less or tokenized routes
    const url = doc.token ? `/api/document-pdf?token=${doc.token}` : `/api/document-pdf?id=${doc.id}&type=${doc.type}`
    window.open(url, '_blank')
  }

  // ─── 7. Sign flow submission ───
  const submitSignature = async () => {
    if (!signerName.trim() || !signingAgreed || !selectedDoc) {
      toast({ title: 'Missing requirements', description: 'Please fill name and accept checkbox.', variant: 'destructive' })
      return
    }
    setSubmittingAction(true)
    try {
      // 1. If active token exists, hit sign-document API, else update directly
      if (selectedDoc.token) {
        const response = await fetch('/api/sign-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: selectedDoc.token,
            fullName: signerName,
            agreed: true
          })
        })
        if (!response.ok) {
          const errData = await response.json()
          throw new Error(errData.error || 'Failed to sign document via E-Sign API')
        }
      } else {
        // Direct DB fallback signing
        await trackActivity(selectedDoc, 'sign')
      }

      toast({ title: '✅ Document Signed Successfully!', description: 'Your digital signature is captured and locked.' })
      setShowSignModal(false)
      setSelectedDoc(prev => prev ? { ...prev, status: 'completed', signed_at: new Date().toISOString() } : null)
      setSignerName('')
      setSigningAgreed(false)
    } catch (e: any) {
      toast({ title: 'Signing Failed', description: e.message, variant: 'destructive' })
    } finally {
      setSubmittingAction(false)
    }
  }

  // ─── 8. Request Changes (Revision) flow ───
  const submitRevisionRequest = async () => {
    if (!revisionNotes.trim() || !selectedDoc) return
    setSubmittingAction(true)

    const tableMap: Record<string, string> = {
      Quotation: 'quotations',
      Invoice: 'invoices',
      SOW: 'sows',
      Agreement: 'agreements',
      Marketing: 'marketing_reports'
    }
    const tableName = tableMap[selectedDoc.type]

    try {
      const updatedHistory = [
        ...(selectedDoc.raw.history || []),
        { date: new Date().toISOString().split('T')[0], action: `Client requested changes: "${revisionNotes}"` }
      ]

      const { error } = await supabase.from(tableName).update({
        status: 'needs revision',
        history: updatedHistory
      }).eq('id', selectedDoc.id)

      if (error) throw error

      toast({ title: 'Revision Requested', description: 'Your change request was sent to the Netgain team.' })
      setShowRevisionModal(false)
      setRevisionNotes('')
      setSelectedDoc(prev => prev ? { ...prev, status: 'needs revision' } : null)
    } catch (e: any) {
      toast({ title: 'Request Failed', description: e.message, variant: 'destructive' })
    } finally {
      setSubmittingAction(false)
    }
  }

  // ─── 9. Decline Document flow ───
  const handleDeclineDoc = async () => {
    if (!selectedDoc) return
    if (!window.confirm("Are you sure you want to decline this document? This will mark it as rejected.")) return
    
    setSubmittingAction(true)
    const tableMap: Record<string, string> = {
      Quotation: 'quotations',
      Invoice: 'invoices',
      SOW: 'sows',
      Agreement: 'agreements',
      Marketing: 'marketing_reports'
    }
    const tableName = tableMap[selectedDoc.type]

    try {
      const updatedHistory = [
        ...(selectedDoc.raw.history || []),
        { date: new Date().toISOString().split('T')[0], action: 'Client declined document' }
      ]

      const { error } = await supabase.from(tableName).update({
        status: 'rejected',
        history: updatedHistory
      }).eq('id', selectedDoc.id)

      if (error) throw error

      toast({ title: 'Document Declined', description: 'The document status was set to rejected.' })
      setSelectedDoc(prev => prev ? { ...prev, status: 'rejected' } : null)
    } catch (e: any) {
      toast({ title: 'Decline Action Failed', description: e.message, variant: 'destructive' })
    } finally {
      setSubmittingAction(false)
    }
  }

  // ─── 10. Send Support Ticket ───
  const handleSendSupport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supportSubject.trim() || !supportMessage.trim()) {
      toast({ title: 'Incomplete request', description: 'Subject and message are required.', variant: 'destructive' })
      return
    }

    setSubmittingAction(true)
    try {
      // Simulate ticket generation and notify the admin
      await supabase.from('client_notifications').insert({
        client_id: 'Founder',
        title: `New Support Ticket from ${session?.company || 'Client'}`,
        message: `Subject: ${supportSubject}\nMessage: ${supportMessage}\nFrom: ${session?.name} (${session?.email})`,
        is_read: false
      })

      toast({ title: 'Support Ticket Raised!', description: 'Our engineering/accounts team will review this shortly.' })
      setSupportSubject('')
      setSupportMessage('')
    } catch (e: any) {
      toast({ title: 'Ticket failed', description: e.message, variant: 'destructive' })
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('netgain_client_session')
    toast({ title: 'Logged Out', description: 'Safe travels!' })
    router.push('/client/login')
  }

  const handleRefresh = () => {
    if (session) fetchClientData(session, true)
  }

  // Sidebar link details
  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'quotations', label: 'Quotations', icon: FileText, badge: docs.filter(d => d.type === 'Quotation').length },
    { id: 'sow', label: 'Scope of Work', icon: Briefcase, badge: docs.filter(d => d.type === 'SOW').length },
    { id: 'agreements', label: 'Agreements', icon: UserCheck, badge: docs.filter(d => d.type === 'Agreement').length },
    { id: 'invoices', label: 'Invoices', icon: Coins, badge: docs.filter(d => d.type === 'Invoice').length },
    { id: 'marketing', label: 'Marketing Reports', icon: TrendingUp, badge: docs.filter(d => d.type === 'Marketing').length },
    { id: 'projects', label: 'Projects', icon: Briefcase, badge: projects.length },
    { id: 'documents', label: 'Documents Vault', icon: FolderOpen },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: notifications.filter(n => !n.is_read).length },
    { id: 'support', label: 'Support', icon: HelpCircle },
    { id: 'profile', label: 'Company Profile', icon: User }
  ]

  // Filtered documents for specific tabs
  const tabDocs = docs.filter(d => {
    if (activeTab === 'quotations') return d.type === 'Quotation'
    if (activeTab === 'sow') return d.type === 'SOW'
    if (activeTab === 'agreements') return d.type === 'Agreement'
    if (activeTab === 'invoices') return d.type === 'Invoice'
    if (activeTab === 'marketing') return d.type === 'Marketing'
    if (activeTab === 'documents') return true
    return false
  }).filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.docId.toLowerCase().includes(search.toLowerCase())
  )

  // Calculating portal summaries for the cards
  const statsSummary = {
    pendingQuotations: docs.filter(d => d.type === 'Quotation' && !['completed', 'signed', 'rejected'].includes(d.status.toLowerCase())).length,
    pendingAgreements: docs.filter(d => d.type === 'Agreement' && !['completed', 'signed', 'rejected'].includes(d.status.toLowerCase())).length,
    pendingSignatures: docs.filter(d => ['Quotation', 'Agreement', 'SOW'].includes(d.type) && !d.signed_at && d.status.toLowerCase() !== 'rejected').length,
    unpaidInvoices: docs.filter(d => d.type === 'Invoice' && d.status.toLowerCase() !== 'paid').length,
    recentReports: docs.filter(d => d.type === 'Marketing').length,
    activeProjects: projects.filter(p => p.status === 'active').length,
    latestNotifications: notifications.filter(n => !n.is_read).length,
  }

  const getStatusBadgeStyled = (status: string) => {
    const s = status.toLowerCase()
    if (s === 'completed' || s === 'signed' || s === 'paid') return <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] capitalize"><Check className="h-2.5 w-2.5 mr-1" />{status}</Badge>
    if (s === 'needs revision') return <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] capitalize"><AlertTriangle className="h-2.5 w-2.5 mr-1" />Changes Requested</Badge>
    if (s === 'rejected' || s === 'declined') return <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] capitalize"><X className="h-2.5 w-2.5 mr-1" />Declined</Badge>
    if (s === 'viewed') return <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] capitalize"><Eye className="h-2.5 w-2.5 mr-1" />Viewed</Badge>
    if (s === 'published') return <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] capitalize"><Globe className="h-2.5 w-2.5 mr-1" />New</Badge>
    return <Badge className="bg-slate-500/10 text-slate-400 border border-slate-500/20 text-[10px] capitalize">{status}</Badge>
  }

  if (!sessionReady || loading) {
    return (
      <div className="min-h-screen bg-[#070e0b] text-white flex flex-col justify-center items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-[#D4AF37]" />
        <p className="text-sm text-slate-400">{!sessionReady ? 'Verifying secure portal access...' : 'Retrieving client records...'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#070e0b] text-slate-100 flex flex-col md:flex-row font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 border-r border-[#152e23] bg-[#091510] flex flex-col shrink-0">
        <div className="p-5 flex items-center gap-2.5 border-b border-[#152e23]">
          <div className="h-9 w-9 rounded-xl gold-gradient flex items-center justify-center font-black text-black shadow-lg">N</div>
          <div>
            <p className="text-sm font-bold text-white tracking-wide">NETGAIN PORTAL</p>
            <p className="text-[9px] text-[#D4AF37] tracking-widest -mt-0.5">SECURE CLIENT SUITE</p>
          </div>
        </div>

        {/* Company/Rep Overview card */}
        <div className="mx-4 my-4 p-3 bg-emerald-950/20 border border-[#152e23]/60 rounded-xl">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Account Company</p>
          <p className="text-xs font-semibold text-[#D4AF37] mt-0.5 truncate">{session?.company}</p>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400">
            <User className="h-3 w-3 text-gold" />
            <span className="truncate">{session?.name}</span>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navigationItems.map(item => {
            const Icon = item.icon
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSearch(''); setSelectedDoc(null) }}
                className={`flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${active ? 'bg-gold text-black shadow-lg font-bold' : 'text-slate-400 hover:bg-[#11241c] hover:text-white'}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${active ? 'bg-black text-gold' : 'bg-gold/15 text-gold border border-gold/25'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-[#152e23]">
          <Button onClick={handleLogout} variant="outline" className="w-full h-9 text-xs border-red-500/20 text-red-400 hover:bg-red-500/10 bg-transparent gap-2">
            <LogOut className="h-3.5 w-3.5" />Log Out Portal
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto min-h-0 bg-[#070e0b] relative">
        <header className="h-16 border-b border-[#152e23] bg-[#091510]/50 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#D4AF37]" />
            <span className="text-xs text-slate-400 font-semibold">{session?.company} Dashboard Suite</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              className="border-[#152e23] text-slate-300 bg-[#091510] hover:bg-white/5 h-8 text-xs gap-2"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          </div>
        </header>

        {/* Dashboard View */}
        {activeTab === 'dashboard' && !selectedDoc && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Welcome, {session?.name}</h1>
                <p className="text-xs text-slate-400 mt-1">Here is a summary of your shared assets, approvals, and invoices with Netgain.</p>
              </div>
            </div>

            {/* Premium Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Pending Quotations', val: statsSummary.pendingQuotations, col: 'text-amber-400', desc: 'Awaiting signature/approval' },
                { label: 'Pending Agreements', val: statsSummary.pendingAgreements, col: 'text-purple-400', desc: 'Awaiting digital signing' },
                { label: 'Unpaid Invoices', val: statsSummary.unpaidInvoices, col: 'text-rose-400', desc: 'Awaiting payment process' },
                { label: 'Active Projects', val: statsSummary.activeProjects, col: 'text-emerald-400', desc: 'Currently in execution' }
              ].map(card => (
                <Card key={card.label} className="bg-[#091510] border-[#152e23]/80 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 bottom-0 w-1 bg-gold/40" />
                  <CardContent className="p-4">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{card.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${card.col}`}>{card.val}</p>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">{card.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Quick Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Recent Published Documents */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-white tracking-wide uppercase text-gold">Recent Shared Documents</h3>
                  <button onClick={() => setActiveTab('documents')} className="text-xs text-gold/80 hover:text-gold flex items-center gap-1">
                    View Vault <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
                <Card className="bg-[#091510] border-[#152e23]/80">
                  <CardContent className="p-0">
                    <div className="divide-y divide-[#152e23]">
                      {docs.slice(0, 5).map(doc => (
                        <div key={doc.id} onClick={() => openDoc(doc)} className="p-4 flex items-center justify-between hover:bg-[#11241c]/45 cursor-pointer transition-colors group">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gold/5 border border-gold/15 text-gold">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-white group-hover:text-gold transition-colors">{doc.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] font-mono text-slate-500">{doc.docId}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-700" />
                                <span className="text-[9px] text-slate-400 capitalize">{doc.type} · V{doc.published_version}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {getStatusBadgeStyled(doc.status)}
                            <ChevronRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-gold transition-all" />
                          </div>
                        </div>
                      ))}
                      {docs.length === 0 && (
                        <div className="p-8 text-center text-slate-500 text-xs">No documents published yet.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Side activity / updates feed */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase text-gold">Recent Activity</h3>
                <Card className="bg-[#091510] border-[#152e23]/80">
                  <CardContent className="p-4 space-y-4 max-h-[360px] overflow-y-auto">
                    {docs.flatMap(d => (d.raw.history || []).map((h: any) => ({ ...h, doc: d }))).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6).map((act, i) => (
                      <div key={i} className="flex gap-3 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-gold shrink-0 mt-1.5" />
                        <div>
                          <p className="text-slate-200 leading-snug">{act.action}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{act.doc?.docId} · {formatDate(act.date)}</p>
                        </div>
                      </div>
                    ))}
                    {docs.length === 0 && (
                      <div className="text-center text-slate-500 text-xs py-4">No recent activity logs.</div>
                    )}
                  </CardContent>
                </Card>
              </div>

            </div>
          </div>
        )}

        {/* Tab Specific Document List Pages */}
        {['quotations', 'sow', 'agreements', 'invoices', 'marketing', 'documents'].includes(activeTab) && !selectedDoc && (
          <div className="p-6 space-y-4">
            <div>
              <h1 className="text-xl font-bold capitalize text-white">{activeTab === 'documents' ? 'Document Vault' : activeTab}</h1>
              <p className="text-xs text-slate-400 mt-1">Search and manage all shared {activeTab} files.</p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by keyword, project, ID..."
                className="pl-9 bg-[#091510] border-[#152e23] text-white focus-visible:ring-[#D4AF37] h-9 text-xs"
              />
            </div>

            <Card className="bg-[#091510] border-[#152e23]/80">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#152e23] text-slate-400 uppercase tracking-wider text-[10px]">
                      <th className="text-left py-3 px-4 font-semibold">Document Number</th>
                      <th className="text-left py-3 px-4 font-semibold">Title</th>
                      <th className="text-left py-3 px-4 font-semibold">Version</th>
                      <th className="text-left py-3 px-4 font-semibold">Date Shared</th>
                      <th className="text-left py-3 px-4 font-semibold">Status</th>
                      {activeTab !== 'marketing' && <th className="text-left py-3 px-4 font-semibold">Value / Amount</th>}
                      <th className="text-right py-3 px-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabDocs.map(doc => (
                      <tr key={doc.id} className="border-b border-[#152e23]/40 hover:bg-[#11241c]/20 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-[#D4AF37]">{doc.docId}</td>
                        <td className="py-3.5 px-4 font-semibold text-white">{doc.title}</td>
                        <td className="py-3.5 px-4 text-slate-400">V{doc.published_version}</td>
                        <td className="py-3.5 px-4 text-slate-400">{formatDate(doc.date)}</td>
                        <td className="py-3.5 px-4">{getStatusBadgeStyled(doc.status)}</td>
                        {activeTab !== 'marketing' && (
                          <td className="py-3.5 px-4 font-bold text-gold">
                            {doc.amount > 0 ? formatCurrency(doc.amount) : '—'}
                          </td>
                        )}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button onClick={() => openDoc(doc)} variant="outline" size="sm" className="h-7 text-[10px] border-[#152e23] bg-transparent text-slate-300">
                              View
                            </Button>
                            <Button onClick={() => handleDownloadPdf(doc)} variant="ghost" size="icon" className="h-7 w-7 text-gold hover:bg-gold/10">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {tabDocs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p>No documents found matching your filter.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Projects View */}
        {activeTab === 'projects' && !selectedDoc && (
          <div className="p-6 space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white">Active Projects</h1>
              <p className="text-xs text-slate-400 mt-1">Track timelines, delivery checklists, and managers assigned to your executions.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projects.map(proj => {
                const stage = proj.status === 'active' ? 'Development & Integration' : 'Deployment'
                const progressVal = proj.status === 'active' ? 70 : 100
                return (
                  <Card key={proj.id} className="bg-[#091510] border-[#152e23]/80 text-white relative overflow-hidden">
                    <CardHeader className="border-b border-[#152e23]/50 pb-3 flex flex-row items-center justify-between">
                      <div>
                        <Badge className="bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/25 text-[9px] uppercase tracking-wider mb-1.5">{proj.stack}</Badge>
                        <CardTitle className="text-base font-bold text-white">{proj.title}</CardTitle>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">Project ID: {proj.docId}</p>
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">{proj.status}</Badge>
                    </CardHeader>
                    <CardContent className="p-5 space-y-5">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-400">Current Stage</span>
                          <span className="text-[#D4AF37]">{stage}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-snug">Sprint goal: Final API integrations and validation checks.</p>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                          <span>Delivery Checklist Progress</span>
                          <span>{progressVal}%</span>
                        </div>
                        <Progress value={progressVal} className="h-1.5 bg-black/40" />
                      </div>

                      <div className="border-t border-[#152e23]/50 pt-4 flex items-center justify-between text-xs">
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-slate-500">Date Initiated</p>
                          <p className="font-semibold text-slate-300 mt-0.5">{formatDate(proj.created)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] uppercase tracking-wider text-slate-500">Account Executive</p>
                          <p className="font-semibold text-[#D4AF37] mt-0.5">Netgain Team Manager</p>
                        </div>
                      </div>

                      {/* Project updates timeline */}
                      {proj.history.length > 0 && (
                        <div className="border-t border-[#152e23]/40 pt-4 space-y-3.5">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Latest Project Check-ins</p>
                          <div className="space-y-2.5">
                            {proj.history.slice(0, 3).map((hist, i) => (
                              <div key={i} className="flex gap-2.5 items-start text-[11px]">
                                <span className="text-gold font-bold shrink-0 mt-0.5">▪</span>
                                <div>
                                  <p className="text-slate-300 leading-snug">{hist.action}</p>
                                  <p className="text-[9px] text-slate-500 mt-0.5">{formatDate(hist.date)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
              {projects.length === 0 && (
                <div className="col-span-2 text-center py-16 border border-dashed border-[#152e23] bg-[#091510]/10 rounded-2xl">
                  <Briefcase className="h-8 w-8 mx-auto text-slate-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-400">No active projects linked</p>
                  <p className="text-xs text-slate-500 mt-1">Once project kick-off commences, checklists and sprints will display here.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notifications View */}
        {activeTab === 'notifications' && !selectedDoc && (
          <div className="p-6 space-y-6 max-w-3xl">
            <div>
              <h1 className="text-xl font-bold text-white">Client Notifications</h1>
              <p className="text-xs text-slate-400 mt-1">Receive live system logs, publication schedules, and signature confirmations.</p>
            </div>

            <Card className="bg-[#091510] border-[#152e23]/80">
              <CardContent className="p-0 divide-y divide-[#152e23]">
                {notifications.map(notif => (
                  <div key={notif.id} className="p-4 flex gap-4 items-start hover:bg-[#11241c]/20 transition-colors">
                    <div className={`p-2 rounded-lg mt-0.5 shrink-0 border ${notif.is_read ? 'bg-[#070e0b]/50 border-slate-700/30 text-slate-500' : 'bg-gold/10 border-gold/20 text-gold'}`}>
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className={`text-xs font-semibold ${notif.is_read ? 'text-slate-300' : 'text-white'}`}>{notif.title}</p>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed whitespace-pre-line">{notif.message}</p>
                      <p className="text-[10px] text-slate-500 mt-2 font-mono">{formatDate(notif.created_at)}</p>
                    </div>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <div className="p-12 text-center text-slate-500 text-xs">
                    No notifications received.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Support View */}
        {activeTab === 'support' && !selectedDoc && (
          <div className="p-6 space-y-6 max-w-4xl">
            <div>
              <h1 className="text-xl font-bold text-white">Customer Support Center</h1>
              <p className="text-xs text-slate-400 mt-1">Submit support tickets, report account discrepancies, or schedule a founder consultation.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="bg-[#091510] border-[#152e23]/80 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm font-bold text-gold uppercase tracking-wider">Raise Support Ticket</CardTitle>
                  <CardDescription className="text-xs text-slate-400">Describe your inquiry and our team will get back to you within 2-4 hours.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSendSupport} className="space-y-4 text-xs">
                    <div className="space-y-1">
                      <Label htmlFor="subj" className="text-slate-400">Subject / Category</Label>
                      <Input
                        id="subj"
                        placeholder="e.g. Account Billing Query, Project Milestone Revision"
                        value={supportSubject}
                        onChange={e => setSupportSubject(e.target.value)}
                        className="bg-black/20 border-[#152e23] text-white focus-visible:ring-gold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="msg" className="text-slate-400">Description of Issue</Label>
                      <Textarea
                        id="msg"
                        placeholder="Please details what you need..."
                        value={supportMessage}
                        onChange={e => setSupportMessage(e.target.value)}
                        className="bg-black/20 border-[#152e23] text-white min-h-[150px] resize-y focus-visible:ring-gold"
                      />
                    </div>
                    <Button type="submit" variant="gold" className="w-full text-xs font-semibold text-black gap-2 h-9" disabled={submittingAction}>
                      {submittingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send Ticket
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-4 text-xs">
                <Card className="bg-[#091510] border-[#152e23]/80">
                  <CardHeader><CardTitle className="text-xs font-bold text-gold uppercase tracking-wider">Direct Account Support</CardTitle></CardHeader>
                  <CardContent className="space-y-3 leading-relaxed">
                    <div>
                      <p className="text-slate-400 font-medium">Primary Email</p>
                      <p className="text-[#D4AF37] font-semibold mt-0.5">support@netgainstudio.com</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium">Finance & Invoices</p>
                      <p className="text-[#D4AF37] font-semibold mt-0.5">accounts@netgainstudio.com</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium">Head Office Consultation</p>
                      <p className="text-slate-300 font-semibold mt-0.5">+91 (800) 555-NETGAIN</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Profile View */}
        {activeTab === 'profile' && !selectedDoc && (
          <div className="p-6 space-y-6 max-w-3xl">
            <div>
              <h1 className="text-xl font-bold text-white">Company Profile</h1>
              <p className="text-xs text-slate-400 mt-1">Review your business profiles, GST records, and authorized client contact configurations.</p>
            </div>

            <Card className="bg-[#091510] border-[#152e23]/80 text-xs">
              <CardHeader className="border-b border-[#152e23]/40"><CardTitle className="text-sm font-bold text-gold uppercase tracking-wider">Netgain Business Profile</CardTitle></CardHeader>
              <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5 leading-relaxed">
                <div>
                  <p className="text-slate-400 font-medium">Business / Company Name</p>
                  <p className="text-white font-bold text-sm mt-0.5">{session?.company}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Primary Contact Representative</p>
                  <p className="text-white font-bold text-sm mt-0.5">{session?.name}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Authorized Account Email</p>
                  <p className="text-white font-bold text-sm mt-0.5">{session?.email}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Authorized Phone</p>
                  <p className="text-white font-bold text-sm mt-0.5">{session?.phone || 'Not Configured'}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Tax Registration GST Number</p>
                  <p className="text-[#D4AF37] font-semibold mt-0.5">{session?.gst || '36ABCDE1234F1ZR (Default)'}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Authorized Domain / Website</p>
                  <p className="text-slate-300 mt-0.5">{session?.website || 'https://netgainstudio.com'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Detailed Document Viewer tab/layout */}
        {selectedDoc && (
          <div className="p-6 space-y-6 max-w-5xl">
            {/* Viewer Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#152e23]">
              <div className="flex items-center gap-3">
                <Button onClick={() => setSelectedDoc(null)} variant="outline" size="sm" className="h-8 border-[#152e23] bg-transparent text-slate-300 gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
                <div>
                  <h1 className="text-lg font-bold text-white flex items-center gap-2">
                    {selectedDoc.title}
                    <Badge className="bg-gold/10 text-[#D4AF37] border border-gold/25 font-mono text-[10px]">V{selectedDoc.published_version}</Badge>
                  </h1>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">Issued: {formatDate(selectedDoc.date)} · Ref: {selectedDoc.docId}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={() => handleDownloadPdf(selectedDoc)} variant="outline" size="sm" className="h-8 text-xs border-[#152e23] bg-transparent text-slate-300 gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
                <Button onClick={() => window.print()} variant="outline" size="sm" className="h-8 text-xs border-[#152e23] bg-transparent text-slate-300 gap-1.5">
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
              </div>
            </div>

            {/* Document metadata sheet */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              {/* Main Document Body (Paper simulation) */}
              <div className="lg:col-span-3 bg-[#0a1410] border border-[#152e23] rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl relative print:bg-white print:text-black">
                <div className="absolute top-0 left-0 right-0 h-1.5 gold-gradient rounded-t-2xl" />
                
                {/* Simulated Paper Header */}
                <div className="flex justify-between items-start border-b border-[#152e23]/60 pb-5 text-xs text-slate-400">
                  <div>
                    <h3 className="text-gold font-black text-sm tracking-wide">NETGAIN DIGITAL</h3>
                    <p>Hyderabad, Telangana, India</p>
                    <p>GST: 36ABCDE1234F1ZR</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white text-[13px]">{selectedDoc.type.toUpperCase()}</p>
                    <p className="font-mono mt-0.5">{selectedDoc.docId}</p>
                    <p className="mt-0.5">Version {selectedDoc.published_version}</p>
                  </div>
                </div>

                {/* Simulated Paper Metadata */}
                <div className="grid grid-cols-2 gap-4 text-xs leading-relaxed">
                  <div>
                    <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Client Details</p>
                    <p className="font-bold text-white mt-0.5">{selectedDoc.raw.client || session.company}</p>
                    <p className="text-slate-300">{selectedDoc.raw.contact || session.name}</p>
                    <p className="text-slate-400">{selectedDoc.raw.email || selectedDoc.raw.client_email || session.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Document Details</p>
                    <p className="text-slate-300 mt-0.5">Status: <span className="font-bold text-[#D4AF37] uppercase">{selectedDoc.status}</span></p>
                    <p className="text-slate-400">Date Shared: {formatDate(selectedDoc.published_at)}</p>
                    <p className="text-slate-400">Representative: Netgain Studio Accounts</p>
                  </div>
                </div>

                {/* Interactive preview based on document types */}
                <div className="border-t border-[#152e23]/60 pt-5 text-xs leading-relaxed space-y-4">
                  {selectedDoc.type === 'Quotation' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-gold uppercase tracking-wider">Project Proposal Title: "{selectedDoc.raw.projectTitle || 'Digital Development services'}"</h4>
                      <p className="text-slate-300">{selectedDoc.raw.notes || 'Please find the services breakdown proposed for your Shopify/Meta Ads growth stack below:'}</p>
                      
                      {/* Services breakdown table */}
                      <div className="border border-[#152e23]/60 rounded-lg overflow-hidden bg-black/25">
                        <div className="grid grid-cols-3 bg-[#0e2119] p-2.5 font-bold border-b border-[#152e23] text-slate-300">
                          <span>Service Name</span>
                          <span>Pricing model</span>
                          <span className="text-right">Price</span>
                        </div>
                        <div className="p-2.5 text-slate-300 space-y-2">
                          <p>Service components are attached in the main proposal PDF. Please download for the fully detailed list.</p>
                        </div>
                      </div>
                      <div className="text-right font-bold text-sm text-[#D4AF37] border-t border-[#152e23] pt-3">
                        Total Proposed Value: {formatCurrency(selectedDoc.amount)}
                      </div>
                    </div>
                  )}

                  {selectedDoc.type === 'SOW' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-gold uppercase tracking-wider">Project Definition: "{selectedDoc.raw.project || 'Development Services'}"</h4>
                      <div>
                        <p className="text-slate-400 font-bold">Objectives</p>
                        <p className="text-slate-300 whitespace-pre-line mt-1">{selectedDoc.raw.objectives || 'Full scale development and execution.'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-bold">Key Deliverables</p>
                        <p className="text-slate-300 whitespace-pre-line mt-1">{selectedDoc.raw.deliverables || 'Attached in contract'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-bold">Milestones & Sprints</p>
                        <p className="text-slate-300 whitespace-pre-line mt-1">{selectedDoc.raw.milestones || 'As detailed in proposal'}</p>
                      </div>
                      <div className="text-right font-bold text-sm text-[#D4AF37] border-t border-[#152e23] pt-3">
                        Total Project Value: {formatCurrency(selectedDoc.amount)}
                      </div>
                    </div>
                  )}

                  {selectedDoc.type === 'Agreement' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-gold uppercase tracking-wider">Agreement Class: {selectedDoc.raw.type || 'Retainer Agreement'}</h4>
                      <div>
                        <p className="text-slate-400 font-bold">Engagement Scope</p>
                        <p className="text-slate-300 whitespace-pre-line mt-1">{selectedDoc.raw.services || 'Comprehensive marketing & growth retainers.'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-bold">Engagement Duration</p>
                        <p className="text-slate-300 mt-1">{selectedDoc.raw.duration || '6 Months'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-bold">Cancellation / Notice Terms</p>
                        <p className="text-slate-300 mt-1">{selectedDoc.raw.cancellation || '30 days written notice.'}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-bold">Jurisdiction</p>
                        <p className="text-slate-300 mt-1">{selectedDoc.raw.jurisdiction || 'Telangana, India'}</p>
                      </div>
                      <div className="text-right font-bold text-sm text-[#D4AF37] border-t border-[#152e23] pt-3">
                        Total Value: {formatCurrency(selectedDoc.amount)}
                      </div>
                    </div>
                  )}

                  {selectedDoc.type === 'Invoice' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-gold uppercase tracking-wider">Outstanding Invoice Particulars</h4>
                      <p className="text-slate-300">{selectedDoc.raw.notes || 'Tax invoice generated for payment.'}</p>
                      <div className="border border-[#152e23]/60 rounded-lg overflow-hidden bg-black/25 p-3 space-y-2 text-slate-300">
                        <div className="flex justify-between"><span>GST Applicable</span><span>{selectedDoc.raw.gst_pct || 18}%</span></div>
                        <div className="flex justify-between"><span>Payment Terms</span><span>{selectedDoc.raw.payment_schedule_entry || 'Full payment'}</span></div>
                        <div className="flex justify-between text-rose-400"><span>Due Date</span><span>{formatDate(selectedDoc.raw.due)}</span></div>
                      </div>
                      <div className="text-right font-bold text-sm text-[#D4AF37] border-t border-[#152e23] pt-3">
                        Total Amount Due: {formatCurrency(selectedDoc.amount)}
                      </div>
                    </div>
                  )}

                  {selectedDoc.type === 'Marketing' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-gold uppercase tracking-wider">Performance Audit Period: {selectedDoc.raw.period || 'June 2024'}</h4>
                      <p className="text-slate-300">Report details and AI intelligence summaries are compiled inside the performance PDF and Excel worksheets. Please click "Download" to open the interactive spreadsheets.</p>
                      <div className="flex gap-2">
                        <Button onClick={() => handleDownloadPdf(selectedDoc)} variant="gold" size="sm" className="h-8 font-semibold text-black gap-2">
                          <Download className="h-3.5 w-3.5" /> Download PDF Report
                        </Button>
                        <Button onClick={() => { toast({ title: 'Downloading Excel Worksheet' }); window.open(selectedDoc.token ? `/api/document-pdf?token=${selectedDoc.token}&format=xlsx` : `/api/document-pdf?id=${selectedDoc.id}&type=${selectedDoc.type}&format=xlsx`, '_blank') }} variant="outline" size="sm" className="h-8 border-[#152e23] bg-transparent text-slate-300 gap-1.5">
                          Download Excel
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="bg-[#091510] border border-[#152e23] p-4 rounded-xl text-[11px] text-slate-400/90 leading-relaxed mt-4 print:hidden">
                    <p className="font-bold text-white mb-1.5 flex items-center gap-1.5">
                      <Scale className="h-3.5 w-3.5 text-gold" />
                      Digital Signature Agreement
                    </p>
                    By clicking "Accept & Sign" or signing using the link, you verify that you have reviewed the details, checklists, and milestones proposed. Under the Digital Signatures Act, this represents a binding executive endorsement.
                  </div>
                </div>

                {/* Digital Signature Rendered on Document if Signed */}
                {selectedDoc.signed_at && (
                  <div className="border-t-2 border-dashed border-emerald-500/30 pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs mt-6 bg-emerald-950/5 p-4 rounded-xl border border-emerald-500/10">
                    <div>
                      <p className="text-emerald-400 font-bold flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Digitally Signed</p>
                      <p className="text-slate-400 mt-1">IP: {selectedDoc.raw.ip_address || 'Verified Portal IP'}</p>
                      <p className="text-slate-500 text-[10px]">{selectedDoc.raw.browser?.slice(0, 75)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif italic text-lg text-emerald-400 font-medium tracking-wide">/s/ {selectedDoc.raw.contact || 'Client Rep'}</p>
                      <p className="text-slate-400 mt-0.5">Signed At: {formatDate(selectedDoc.signed_at)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Side controls (Signing / Change requests) */}
              <div className="space-y-4 print:hidden">
                <Card className="bg-[#091510] border-[#152e23] text-white">
                  <CardHeader className="pb-3 border-b border-[#152e23]/50">
                    <CardTitle className="text-xs font-bold text-gold uppercase tracking-wider">Document Control Panel</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    
                    {/* Status Display */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Current Status</span>
                      {getStatusBadgeStyled(selectedDoc.status)}
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Portal Version</span>
                      <span className="font-mono font-bold text-slate-300">V{selectedDoc.published_version}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs pb-3 border-b border-[#152e23]/30">
                      <span className="text-slate-400">Date Published</span>
                      <span className="font-semibold text-slate-300">{formatDate(selectedDoc.published_at)}</span>
                    </div>

                    {/* Interactive signing controls if applicable and NOT signed */}
                    {!selectedDoc.signed_at && ['Quotation', 'Agreement', 'SOW'].includes(selectedDoc.type) && selectedDoc.status !== 'rejected' && (
                      <div className="space-y-2 pt-2">
                        <Button onClick={() => setShowSignModal(true)} variant="gold" className="w-full text-xs font-semibold text-black gap-2 h-9">
                          <FileSignature className="h-3.5 w-3.5" />
                          Accept & Sign
                        </Button>
                        <Button onClick={() => setShowRevisionModal(true)} variant="outline" className="w-full text-xs border-[#152e23] bg-transparent text-slate-300 hover:bg-white/5 h-9">
                          Request Changes
                        </Button>
                        <Button onClick={handleDeclineDoc} variant="outline" className="w-full text-xs border-rose-500/20 text-rose-400 hover:bg-rose-500/10 bg-transparent h-9">
                          Decline / Reject
                        </Button>
                      </div>
                    )}

                    {/* Invoices specific pay action if unpaid */}
                    {selectedDoc.type === 'Invoice' && selectedDoc.status !== 'paid' && (
                      <div className="pt-2">
                        <Button onClick={() => toast({ title: 'Pay Now integration coming soon!' })} variant="gold" className="w-full text-xs font-semibold text-black gap-2 h-9">
                          Pay Now (Future)
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* History Log */}
                <Card className="bg-[#091510] border-[#152e23] text-white">
                  <CardHeader className="pb-3 border-b border-[#152e23]/50">
                    <CardTitle className="text-xs font-bold text-gold uppercase tracking-wider">Document Timeline</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4 max-h-[220px] overflow-y-auto">
                    {(selectedDoc.raw.history || []).slice().reverse().map((h: any, i: number) => (
                      <div key={i} className="flex gap-2.5 text-[11px]">
                        <div className="w-1.5 h-1.5 rounded-full bg-gold/50 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-slate-300 leading-snug">{h.action}</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">{formatDate(h.date)}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* SIGNATURE MODAL */}
      <Dialog open={showSignModal} onOpenChange={setShowSignModal}>
        <DialogContent className="max-w-md bg-[#091510] border-[#152e23]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#D4AF37]">
              <FileSignature className="h-5 w-5 text-gold" />
              Digitally Sign Document
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Sign document {selectedDoc?.docId} for proposed services value.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="sign-name" className="text-slate-400">Full Signature Name</Label>
              <Input
                id="sign-name"
                placeholder="Type your name to sign"
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
                className="bg-black/20 border-[#152e23] text-white focus-visible:ring-gold"
              />
            </div>

            {signerName.trim() && (
              <div className="p-4 rounded-xl border border-[#152e23] bg-black/45 flex flex-col items-center justify-center min-h-[80px] select-none">
                <span className="text-[8px] uppercase tracking-wider text-slate-500 mb-1">Signature Handwriting Style Preview</span>
                <span className="font-serif italic text-2xl text-gold font-medium tracking-wide">/s/ {signerName}</span>
              </div>
            )}

            <label className="flex items-start gap-2.5 cursor-pointer leading-normal text-slate-400">
              <input
                type="checkbox"
                checked={signingAgreed}
                onChange={e => setSigningAgreed(e.target.checked)}
                className="rounded mt-0.5 border-[#152e23] text-gold focus:ring-gold"
              />
              <span>I confirm that I am authorized to sign on behalf of {session?.company} and accept the terms of this document.</span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowSignModal(false); setSignerName(''); setSigningAgreed(false) }}>Cancel</Button>
            <Button
              variant="gold"
              disabled={submittingAction || !signerName.trim() || !signingAgreed}
              onClick={submitSignature}
              className="gap-2"
            >
              {submittingAction && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm Signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REVISION NOTES MODAL */}
      <Dialog open={showRevisionModal} onOpenChange={setShowRevisionModal}>
        <DialogContent className="max-w-md bg-[#091510] border-[#152e23]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gold">
              <AlertTriangle className="h-5 w-5 text-gold" />
              Request Document Revision
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Detail the updates or changes required before you sign.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 text-xs">
            <Label htmlFor="rev-notes" className="text-slate-400">Change Request Details</Label>
            <Textarea
              id="rev-notes"
              placeholder="e.g. Please update scope milestones to week 4, modify setup fee from ₹15k to ₹12k..."
              value={revisionNotes}
              onChange={e => setRevisionNotes(e.target.value)}
              className="bg-black/20 border-[#152e23] text-white min-h-[120px] resize-y focus-visible:ring-gold"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRevisionModal(false); setRevisionNotes('') }}>Cancel</Button>
            <Button
              variant="gold"
              disabled={submittingAction || !revisionNotes.trim()}
              onClick={submitRevisionRequest}
              className="gap-2"
            >
              {submittingAction && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
