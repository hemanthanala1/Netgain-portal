'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
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
  Shield, History, Globe, UserCheck, Eye, X, Check, ChevronRight, ChevronLeft, Scale,
  Coins, TrendingUp, Menu, PenTool, Type, Calendar, Link2, ExternalLink
} from 'lucide-react'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
  progress?: number
  milestones?: string[]
  budget?: number
  spent?: number
  timeline?: string
  pm?: string
  currentStage?: string
  sprintGoal?: string
}

interface ClientNotification {
  id: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  type?: string
}

export default function ClientDashboardPage() {
  const [session, setSession] = useState<any>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  // Data States
  const [docs, setDocs] = useState<ClientDoc[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  // ─── PROJECT WORKSPACE CLIENT STATES ───
  const [workspaceRequirements, setWorkspaceRequirements] = useState<any[]>([])
  const [workspaceSubmissions, setWorkspaceSubmissions] = useState<any[]>([])
  const [workspaceFiles, setWorkspaceFiles] = useState<any[]>([])
  const [workspaceLinks, setWorkspaceLinks] = useState<any[]>([])
  const [workspaceReports, setWorkspaceReports] = useState<any[]>([])
  const [workspaceTimeline, setWorkspaceTimeline] = useState<any[]>([])
  const [workspaceMeetings, setWorkspaceMeetings] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  // Client Submissions Form States
  const [activeSubmittingReq, setActiveSubmittingReq] = useState<any | null>(null)
  const [clientTextResponse, setClientTextResponse] = useState('')
  const [clientLinksInput, setClientLinksInput] = useState('')
  const [clientUploadFiles, setClientUploadFiles] = useState<File[]>([])
  const [clientSubmissionNotes, setClientSubmissionNotes] = useState('')
  const [submittingRequirementState, setSubmittingRequirementState] = useState(false)

  // Client General File Upload Form States
  const [clientGeneralFile, setClientGeneralFile] = useState<File | null>(null)
  const [clientFileCategory, setClientFileCategory] = useState('Brand Logo')
  const [clientFileNotes, setClientFileNotes] = useState('')
  const [uploadingClientFile, setUploadingClientFile] = useState(false)
  const [notifications, setNotifications] = useState<ClientNotification[]>([])
  const [companySettings, setCompanySettings] = useState<any>(null)
  const [clientDetails, setClientDetails] = useState<any>(null)
  
  // UI Interaction States
  const [search, setSearch] = useState('')
  const [selectedDoc, setSelectedDoc] = useState<ClientDoc | null>(null)
  const [showSignModal, setShowSignModal] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [signingAgreed, setSigningAgreed] = useState(false)
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [revisionNotes, setRevisionNotes] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)

  // E-Signature Pad states
  const [sigType, setSigType] = useState<'draw' | 'type'>('draw')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawHistory, setDrawHistory] = useState<string[]>([])
  const [drawSaved, setDrawSaved] = useState(false)
  const [savedDrawData, setSavedDrawData] = useState<string | null>(null)
  const [selectedFont, setSelectedFont] = useState('DancingScript')
  const [typeSaved, setTypeSaved] = useState(false)

  const fonts = [
    { name: 'Dancing Script', value: 'DancingScript', family: 'Dancing Script, cursive' },
    { name: 'Alex Brush', value: 'AlexBrush', family: 'Alex Brush, cursive' },
    { name: 'Sacramento', value: 'Sacramento', family: 'Sacramento, cursive' }
  ]
  
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
  // ─── 2. If no session, redirect to login ───
  useEffect(() => {
    if (sessionReady && !session) {
      router.push('/client')
    }
  }, [session, sessionReady, router])

  // ─── 3. Global document/project fetcher logic ───
  const fetchClientData = async (isRefresh = false) => {
    if (!session) return
    if (!isRefresh) setLoading(true)
    try {
      const clientEmail = (session.email || '').toLowerCase().trim()
      const clientCompany = (session.company || '').toLowerCase().trim()

      const matchDoc = (doc: any) => {
        const dClient = (doc.client || '').toLowerCase().trim()
        const dEmail = (doc.email || doc.client_email || '').toLowerCase().trim()
        return dClient === clientCompany || dClient === (session.name || '').toLowerCase().trim() || dEmail === clientEmail
      }

      // Fetch from Supabase tables
      const [quosRes, sowsRes, agrsRes, invsRes, mrRes, projRes, notifRes, tokensRes, settingsRes, clientRes] = await Promise.all([
        supabase.from('quotations').select('*'),
        supabase.from('sows').select('*'),
        supabase.from('agreements').select('*'),
        supabase.from('invoices').select('*'),
        supabase.from('marketing_reports').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('client_notifications').select('*').or(`client_id.eq."${session.company}",client_id.eq."${session.email}"`).order('created_at', { ascending: false }),
        supabase.from('document_tokens').select('*').eq('status', 'active'),
        fetch('/api/settings').then(async res => {
          if (!res.ok) return { data: null }
          return { data: await res.json() }
        }),
        session.clientId ? supabase.from('crm_clients').select('website, address, gst').eq('id', session.clientId).maybeSingle() : Promise.resolve({ data: null })
      ])
      
      if (settingsRes && settingsRes.data) {
        setCompanySettings(settingsRes.data)
      }

      if (clientRes && clientRes.data) {
        setClientDetails(clientRes.data)
      }

      // Build token lookup map
      const tokenMap = new Map<string, string>()
      if (tokensRes.data) {
        tokensRes.data.forEach((t: any) => {
          tokenMap.set(`${t.document_type}_${t.document_id}`, t.token)
        })
      }

      const combined: ClientDoc[] = []
      ;(quosRes.data || []).filter(matchDoc).filter(q => q.published && q.visibility_status !== 'hidden').forEach(q => combined.push({
        id: q.id, docId: q.doc_id, type: 'Quotation', title: q.project_title || 'Service Quotation', amount: Number(q.amount) || 0, status: q.status || 'published', date: q.created || q.created_at?.slice(0, 10), token: tokenMap.get(`Quotation_${q.id}`) || null, raw: q, published_version: q.published_version || 1, published_at: q.published_at || q.created_at, viewed_at: q.viewed_at, downloaded_at: q.downloaded_at, signed_at: q.signed_at, visibility_status: q.visibility_status || 'visible'
      }))
      ;(sowsRes.data || []).filter(matchDoc).filter(s => s.published && s.visibility_status !== 'hidden').forEach(s => combined.push({
        id: s.id, docId: s.doc_id, type: 'SOW', title: s.project || 'Scope of Work', amount: Number(s.value) || 0, status: s.status || 'published', date: s.created || s.created_at?.slice(0, 10), token: tokenMap.get(`SOW_${s.id}`) || null, raw: s, published_version: s.published_version || 1, published_at: s.published_at || s.created_at, viewed_at: s.viewed_at, downloaded_at: s.downloaded_at, signed_at: s.signed_at, visibility_status: s.visibility_status || 'visible'
      }))
      ;(agrsRes.data || []).filter(matchDoc).filter(a => a.published && a.visibility_status !== 'hidden').forEach(a => combined.push({
        id: a.id, docId: a.doc_id, type: 'Agreement', title: a.type || 'Service Agreement', amount: Number(a.value) || 0, status: a.status || 'published', date: a.created || a.created_at?.slice(0, 10), token: tokenMap.get(`Agreement_${a.id}`) || null, raw: a, published_version: a.published_version || 1, published_at: a.published_at || a.created_at, viewed_at: a.viewed_at, downloaded_at: a.downloaded_at, signed_at: a.signed_at, visibility_status: a.visibility_status || 'visible'
      }))
      ;(invsRes.data || []).filter(matchDoc).filter(i => i.published && i.visibility_status !== 'hidden').forEach(i => combined.push({
        id: i.id, docId: i.doc_id, type: 'Invoice', title: `Tax Invoice — ${i.doc_id}`, amount: Number(i.amount) || 0, status: i.status || 'published', date: i.created || i.created_at?.slice(0, 10), token: tokenMap.get(`Invoice_${i.id}`) || null, raw: i, published_version: i.published_version || 1, published_at: i.published_at || i.created_at, viewed_at: i.viewed_at, downloaded_at: i.downloaded_at, signed_at: i.signed_at, visibility_status: i.visibility_status || 'visible'
      }))
      ;(mrRes.data || []).filter(matchDoc).filter(r => r.published && r.visibility_status !== 'hidden').forEach(r => {
        let titleVal = 'Marketing Performance Report'
        try { const parsed = JSON.parse(r.title); if (parsed && parsed.period) titleVal = `Marketing Report — ${parsed.period}` } catch {}
        combined.push({
          id: r.id, docId: r.doc_id, type: 'Marketing', title: titleVal, amount: 0, status: r.status || 'published', date: r.created || r.created_at?.slice(0, 10), token: null, raw: r, published_version: r.published_version || 1, published_at: r.published_at || r.created_at, viewed_at: r.viewed_at, downloaded_at: r.downloaded_at, signed_at: r.signed_at, visibility_status: r.visibility_status || 'visible'
        })
      })

      setDocs(combined)

      const matchedProjects: Project[] = (projRes.data || []).filter(p => {
        const docClient = (p.client || '').toLowerCase().trim()
        return docClient === clientCompany || docClient === (session.name || '').toLowerCase().trim()
      }).map((p: any) => {
        let extra: any = { type: 'Web Development', budget: 0, spent: 0, timeline: '', progress: 0, milestones: [] as string[], pm: 'Devon S.', currentStage: '', sprintGoal: '' }
        if (p.stack) { try { extra = { ...extra, ...JSON.parse(p.stack) } } catch { extra.pm = p.stack } }
        return {
          id: p.id,
          docId: p.doc_id,
          title: p.title,
          client: p.client,
          stack: p.stack || 'Custom Stack',
          status: p.status || 'active',
          created: p.created_at,
          history: Array.isArray(p.history) ? p.history : [],
          progress: Number(extra.progress) || 0,
          milestones: Array.isArray(extra.milestones) ? extra.milestones : [],
          budget: Number(extra.budget) || 0,
          spent: Number(extra.spent) || 0,
          timeline: extra.timeline,
          pm: extra.pm,
          currentStage: extra.currentStage || '',
          sprintGoal: extra.sprintGoal || ''
        }
      })

      setProjects(matchedProjects)
      
      if (matchedProjects.length > 0) {
        setSelectedProjectId(prev => prev || matchedProjects[0].id)
        
        const projIds = matchedProjects.map(p => p.id)
        const [reqs, pFiles, pLinks, pReps, pTime] = await Promise.all([
          supabase.from('project_requirements').select('*').in('project_id', projIds).order('created_at', { ascending: false }),
          supabase.from('project_files').select('*').in('project_id', projIds).order('uploaded_at', { ascending: false }),
          supabase.from('project_links').select('*').in('project_id', projIds).order('published_at', { ascending: false }),
          supabase.from('project_reports').select('*').in('project_id', projIds).order('uploaded_at', { ascending: false }),
          supabase.from('project_activity_timeline').select('*').in('project_id', projIds).order('created_at', { ascending: false })
        ])

        const reqList = reqs.data || []
        setWorkspaceRequirements(reqList)
        setWorkspaceFiles(pFiles.data || [])
        setWorkspaceLinks(pLinks.data || [])
        setWorkspaceReports(pReps.data || [])
        setWorkspaceTimeline(pTime.data || [])

        if (reqList.length > 0) {
          const reqIds = reqList.map((r: any) => r.id)
          const { data: subs } = await supabase.from('project_requirement_submissions').select('*').in('requirement_id', reqIds)
          setWorkspaceSubmissions(subs || [])
        } else {
          setWorkspaceSubmissions([])
        }
      }

      // Fetch client meetings
      const { data: meets } = await supabase.from('meetings').select('*').or(`client_email.eq."${clientEmail}",client_name.eq."${session.company}"`).order('meeting_date', { ascending: false })
      setWorkspaceMeetings(meets || [])

      if (notifRes.data) {
        setNotifications(notifRes.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) fetchClientData()
  }, [session])

  // Keep selectedDoc in sync with the latest data from docs (fixes status updates not showing immediately)
  useEffect(() => {
    if (selectedDoc) {
      const updated = docs.find(d => d.id === selectedDoc.id && d.type === selectedDoc.type)
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedDoc)) {
        setSelectedDoc(updated)
      }
    }
  }, [docs, selectedDoc])

  // ─── REAL-TIME SUBSCRIPTIONS ───
  useEffect(() => {
    if (!session || !isSupabaseConfigured()) return

    const clientCompany = (session.company || '').toLowerCase().trim()
    const refreshClientData = () => {
      fetchClientData(true)
    }

    // Subscribe to projects changes
    const projectChannel = supabase
      .channel('client-projects-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        refreshClientData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_requirements' }, () => {
        refreshClientData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_requirement_submissions' }, () => {
        refreshClientData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_files' }, () => {
        refreshClientData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_links' }, () => {
        refreshClientData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_reports' }, () => {
        refreshClientData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_activity_timeline' }, () => {
        refreshClientData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, () => {
        refreshClientData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, () => {
        refreshClientData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sows' }, () => {
        refreshClientData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agreements' }, () => {
        refreshClientData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        refreshClientData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_reports' }, () => {
        refreshClientData()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'client_notifications' }, (payload) => {
        const n = payload.new as any
        if (n.client_id === clientCompany || n.client_id === session.email) {
          setNotifications(prev => [n, ...prev])
          // Show toast for new notification
          toast({ title: n.title, description: n.message?.slice(0, 80) })
        }
      })
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(projectChannel)
    }
  }, [session])

  const trackActivity = async (doc: ClientDoc, action: 'view' | 'download' | 'sign' | 'approve') => {
    let ip = 'Unknown IP'
    try { const res = await fetch('https://api.ipify.org?format=json'); const data = await res.json(); ip = data.ip || 'Unknown IP' } catch {}
    const tableMap: Record<string, string> = { Quotation: 'quotations', Invoice: 'invoices', SOW: 'sows', Agreement: 'agreements', Marketing: 'marketing_reports' }
    const tableName = tableMap[doc.type]
    if (!tableName) return
    const nowStr = new Date().toISOString()
    const updates: any = { ip_address: ip, browser: navigator.userAgent.slice(0, 150), device: window.innerWidth < 768 ? 'Mobile' : 'Desktop' }
    if (action === 'view') { updates.viewed_at = nowStr; if (doc.status === 'published') updates.status = 'viewed' }
    else if (action === 'download') updates.downloaded_at = nowStr
    else if (action === 'sign') { updates.signed_at = nowStr; updates.status = 'signed' }
    else if (action === 'approve') { updates.signed_at = nowStr; updates.status = 'approved' }
    try { 
      await supabase.from(tableName).update(updates).eq('id', doc.id)
      
      const eventName = action === 'view' ? 'viewed' : action === 'download' ? 'downloaded' : action === 'sign' ? 'signed' : 'approved'
      const logNotes = `${doc.type} ${doc.docId} was ${eventName} by client (${updates.device}, IP: ${ip})`
      await supabase.from('document_timeline').insert({
        document_type: doc.type,
        document_id: doc.id,
        event: eventName,
        user_name: session?.name || 'Client',
        notes: logNotes
      })

      await fetchClientData(true) 
    } catch (err) { console.error(err) }
  }

  const openDoc = (doc: ClientDoc) => { setSelectedDoc(doc); trackActivity(doc, 'view') }

  const handleDeclineDoc = async () => {
    if (!selectedDoc) return
    if (!window.confirm("Are you sure?")) return
    setSubmittingAction(true)
    const tableMap: Record<string, string> = { Quotation: 'quotations', Invoice: 'invoices', SOW: 'sows', Agreement: 'agreements', Marketing: 'marketing_reports' }
    const tableName = tableMap[selectedDoc.type]
    try {
      const { error } = await supabase.from(tableName).update({ status: 'rejected' }).eq('id', selectedDoc.id)
      if (error) throw error
      toast({ title: 'Document Declined' })
      setSelectedDoc(prev => prev ? { ...prev, status: 'rejected' } : null)
    } catch (e: any) {
      toast({ title: 'Action Failed', description: e.message, variant: 'destructive' })
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleSendSupport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supportSubject.trim() || !supportMessage.trim()) return
    setSubmittingAction(true)
    try {
      const { error } = await supabase.from('client_notifications').insert({
        client_id: session?.company || session?.email,
        title: `Support: ${supportSubject}`,
        message: supportMessage,
        type: 'support',
        is_read: false
      })
      if (error) throw error
      toast({ title: 'Support Ticket Raised', description: 'We will get back to you shortly.' })
      setSupportSubject('')
      setSupportMessage('')
      await fetchClientData(true)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('netgain_client_session')
    toast({ title: 'Logged Out', description: 'Safe travels!' })
    router.push('/client/login')
  }

  const handleDownloadPdf = (doc: ClientDoc) => {
    const url = doc.token ? `/api/document-pdf?token=${doc.token}&download=1` : `/api/document-pdf?id=${doc.id}&type=${doc.type}&download=1`
    window.open(url, '_blank')
    trackActivity(doc, 'download')
  }

  const printDocument = () => {
    const iframe = document.getElementById('doc-viewer-iframe') as HTMLIFrameElement
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
      } catch (err) {
        console.error('Error printing from iframe', err)
        window.print()
      }
    } else {
      window.print()
    }
  }

  const handleApproveDoc = async () => {
    if (selectedDoc) {
      setSubmittingAction(true)
      try {
        await trackActivity(selectedDoc, 'approve')
        setSelectedDoc(prev => prev ? { ...prev, status: 'approved', signed_at: new Date().toISOString() } : null)
        toast({ title: 'Document Approved', description: 'Thank you for your approval.' })
      } catch (err: any) {
        console.error(err)
        toast({ title: 'Approval Failed', description: err.message || 'An error occurred during approval.', variant: 'destructive' })
      } finally {
        setSubmittingAction(false)
      }
    }
  }

  // Canvas drawing mouse/touch coordinates
  const getCoordinates = (e: any, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    
    // Scale coordinates based on canvas internal resolution
    const x = (clientX - rect.left) * (canvas.width / rect.width)
    const y = (clientY - rect.top) * (canvas.height / rect.height)
    
    return { x, y }
  }

  // Draw event listeners
  const startDrawing = (e: any) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = '#D4AF37'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const { x, y } = getCoordinates(e, canvas)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: any) => {
    if (!isDrawing) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x, y } = getCoordinates(e, canvas)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas) {
      setDrawHistory(prev => [...prev, canvas.toDataURL()])
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setDrawHistory([])
    setDrawSaved(false)
    setSavedDrawData(null)
  }

  const undoCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas || drawHistory.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const newHistory = drawHistory.slice(0, -1)
    setDrawHistory(newHistory)
    setDrawSaved(false)
    setSavedDrawData(null)

    if (newHistory.length > 0) {
      const img = new Image()
      img.src = newHistory[newHistory.length - 1]
      img.onload = () => {
        ctx.drawImage(img, 0, 0)
      }
    }
  }

  const saveDrawnSignature = () => {
    const canvas = canvasRef.current
    if (!canvas || drawHistory.length === 0) {
      toast({ title: 'No signature found', description: 'Please draw your signature first.', variant: 'destructive' })
      return
    }
    setSavedDrawData(canvas.toDataURL('image/png'))
    setDrawSaved(true)
    toast({ title: 'Signature Saved', description: 'Draw signature saved successfully.' })
  }

  const saveTypedSignature = () => {
    if (!signerName.trim()) {
      toast({ title: 'Text empty', description: 'Please type your name for the signature.', variant: 'destructive' })
      return
    }
    setTypeSaved(true)
    toast({ title: 'Signature Saved', description: 'Typed signature font details saved.' })
  }

  const submitSignature = async () => {
    if (!selectedDoc) return

    if (sigType === 'draw' && !drawSaved) {
      toast({ title: 'Signature Required', description: 'Please draw and click "Save Signature".', variant: 'destructive' })
      return
    }

    if (sigType === 'type' && !typeSaved) {
      toast({ title: 'Signature Required', description: 'Please type and click "Save Signature".', variant: 'destructive' })
      return
    }

    setSubmittingAction(true)
    try {
      // 1. Fetch IP Address
      let ip = '127.0.0.1'
      try { 
        const ipRes = await fetch('https://api.ipify.org?format=json')
        const ipData = await ipRes.json()
        ip = ipData.ip || '127.0.0.1' 
      } catch {}

      // 2. Browser/OS fingerprinting
      const ua = navigator.userAgent
      let browser = 'Unknown Browser'
      let os = 'Unknown OS'
      if (ua.includes('Firefox')) browser = 'Firefox'
      else if (ua.includes('Chrome') && !ua.includes('Chromium')) browser = 'Chrome'
      else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
      else if (ua.includes('Edge')) browser = 'Edge'

      if (ua.includes('Windows')) os = 'Windows'
      else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
      else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS'
      else if (ua.includes('Linux')) os = 'Linux'
      else if (ua.includes('Android')) os = 'Android'

      const device = window.innerWidth < 768 ? 'Mobile' : 'Desktop'

      // 3. Generate verification ID
      const randomBytes = Math.random().toString(36).substring(2, 10).toUpperCase()
      const verificationId = `CERT-${randomBytes.slice(0, 4)}-${randomBytes.slice(4, 8)}`

      // 4. Generate document hash
      let documentHash = ''
      try {
        const docString = JSON.stringify(selectedDoc.raw)
        const msgBuffer = new TextEncoder().encode(docString)
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        documentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      } catch (err) {
        console.error('Hash generation failed, falling back', err)
        documentHash = 'hash-fallback-' + Math.random().toString(36).substring(2, 12)
      }

      const docType = selectedDoc.type === 'SOW' ? 'SOW' : 'Agreement'
      const currentVersion = selectedDoc.published_version || 1

      // 5. Store signature details in `document_signatures`
      const { error: sigError } = await supabase
        .from('document_signatures')
        .insert({
          document_type: docType,
          document_id: selectedDoc.id,
          client_name: signerName,
          company: session?.company || null,
          email: session?.email || 'client@netgainstudio.com',
          phone: session?.phone || null,
          signature_type: sigType === 'draw' ? 'drawn' : 'typed',
          signature_image: sigType === 'draw' ? savedDrawData : null,
          signature_text: sigType === 'type' ? signerName : null,
          signature_font: sigType === 'type' ? selectedFont : 'DancingScript',
          browser,
          operating_system: os,
          device_type: device,
          ip_address: ip,
          document_version: currentVersion,
          created_by: selectedDoc.raw.published_by || 'Founder',
          document_hash: documentHash,
          agreement_accepted: signingAgreed,
          verification_id: verificationId
        })

      if (sigError) throw sigError

      // 6. Update SOW/Agreement table status to completed and lock it
      const tableMap: Record<string, string> = { Quotation: 'quotations', Invoice: 'invoices', SOW: 'sows', Agreement: 'agreements', Marketing: 'marketing_reports' }
      const tableName = tableMap[selectedDoc.type]
      const updatedHistory = [
        ...(selectedDoc.raw.history || []),
        { date: new Date().toISOString().split('T')[0], action: `Client signed via Netgain E-Sign (${verificationId})` },
        { date: new Date().toISOString().split('T')[0], action: 'Status changed to signed' }
      ]

      const { error: updateDocError } = await supabase
        .from(tableName)
        .update({
          status: 'signed',
          is_locked: true,
          signed_at: new Date().toISOString(),
          ip_address: ip,
          browser: browser,
          device: device,
          history: updatedHistory
        })
        .eq('id', selectedDoc.id)

      if (updateDocError) throw updateDocError

      // 7. Update timeline
      await supabase.from('document_timeline').insert([
        {
          document_type: docType,
          document_id: selectedDoc.id,
          event: 'viewed',
          user_name: signerName,
          notes: `Client viewed the document from IP: ${ip} (${browser} on ${os})`
        },
        {
          document_type: docType,
          document_id: selectedDoc.id,
          event: 'signed',
          user_name: signerName,
          notes: `Client e-signed using ${sigType === 'draw' ? 'Drawn Signature' : 'Typed Signature'} (${browser} on ${os})`
        },
        {
          document_type: docType,
          document_id: selectedDoc.id,
          event: 'completed',
          user_name: 'System',
          notes: `Document workflow completed. Verification ID: ${verificationId}`
        }
      ])

      toast({ title: 'Document Signed & Approved!', description: `Verification ID: ${verificationId}` })
      setShowSignModal(false)
      setSignerName('')
      setSigningAgreed(false)
      setDrawHistory([])
      setDrawSaved(false)
      setSavedDrawData(null)
      setTypeSaved(false)
      setSelectedDoc(null)
      await fetchClientData(true)
    } catch (err: any) {
      console.error(err)
      toast({ title: 'Signing Failed', description: err.message, variant: 'destructive' })
    } finally {
      setSubmittingAction(false)
    }
  }

  const submitRevisionRequest = async () => {
    if (selectedDoc && revisionNotes.trim()) {
      setSubmittingAction(true)
      try {
        const tableMap: Record<string, string> = { Quotation: 'quotations', Invoice: 'invoices', SOW: 'sows', Agreement: 'agreements', Marketing: 'marketing_reports' }
        const tableName = tableMap[selectedDoc.type]
        
        const updatedHistory = [
          ...(selectedDoc.raw.history || []),
          { 
            date: new Date().toISOString().split('T')[0], 
            action: `Client requested changes: "${revisionNotes}"` 
          }
        ]

        await supabase.from(tableName).update({ 
          status: 'needs revision',
          history: updatedHistory
        }).eq('id', selectedDoc.id)
        
        await supabase.from('client_notifications').insert({
          client_id: session?.company || session?.email,
          title: `Revision Requested for ${selectedDoc.title}`,
          message: revisionNotes,
          type: 'support',
          is_read: false
        })

        // Add timeline event in document_timeline table for Vault page activity logs
        const docType = selectedDoc.type === 'SOW' ? 'SOW' : selectedDoc.type === 'Agreement' ? 'Agreement' : 'Quotation'
        await supabase.from('document_timeline').insert({
          document_type: docType,
          document_id: selectedDoc.id,
          event: 'needs_revision',
          user_name: session?.name || 'Client',
          notes: revisionNotes
        })

        toast({ title: 'Revision Requested', description: 'Your request has been sent to our team.' })
        setShowRevisionModal(false)
        setRevisionNotes('')
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      } finally {
        setSubmittingAction(false)
        fetchClientData(true)
      }
    }
  }

  const logWorkspaceActivityClient = async (projectId: string, action: string, notes: string = '') => {
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('project_activity_timeline').insert({
        project_id: projectId,
        user_name: session?.name || 'Client',
        action,
        notes
      })
    } catch (e) {
      console.error(e)
    }
  }

  const notifyAdmin = async (projectId: string, title: string, message: string) => {
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('client_notifications').insert({
        client_id: 'admin',
        title,
        message,
        type: 'support',
        is_read: false
      })
    } catch (e) {
      console.error(e)
    }
  }

  const handleSubmitRequirement = async () => {
    if (!activeSubmittingReq) return
    setSubmittingRequirementState(true)
    try {
      const uploadedUrls: string[] = []

      if (clientUploadFiles.length > 0) {
        for (const file of clientUploadFiles) {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('projectId', selectedProjectId || '')
          formData.append('category', 'Requirements')
          formData.append('uploadedBy', session?.name || 'Client')

          const res = await fetch('/api/project-files/upload', {
            method: 'POST',
            body: formData
          })
          const data = await res.json()
          if (!res.ok || data.error) throw new Error(data.error || 'File upload failed')
          uploadedUrls.push(data.url)

          await supabase.from('project_files').insert({
            project_id: selectedProjectId || '',
            name: data.fileName || file.name,
            file_path: data.url,
            category: 'Other Documents',
            version: 1,
            visibility: 'Published to Client',
            uploaded_by: session?.name || 'Client'
          })
        }
      }

      const parsedLinks = clientLinksInput.split('\n').map(l => l.trim()).filter(l => l.length > 0)

      const { error: subError } = await supabase.from('project_requirement_submissions').insert({
        requirement_id: activeSubmittingReq.id,
        text_response: clientTextResponse,
        links: parsedLinks,
        file_paths: uploadedUrls,
        notes: clientSubmissionNotes,
        submitted_by: session?.name || 'Client'
      })

      if (subError) throw subError

      await supabase.from('project_requirements').update({
        status: 'submitted'
      }).eq('id', activeSubmittingReq.id)

      toast({ title: 'Requirement Submitted Successfully', description: activeSubmittingReq.title })
      
      setActiveSubmittingReq(null)
      setClientTextResponse('')
      setClientLinksInput('')
      setClientUploadFiles([])
      setClientSubmissionNotes('')

      fetchClientData(true)

      if (selectedProjectId) {
        const proj = projects.find(p => p.id === selectedProjectId)
        await logWorkspaceActivityClient(selectedProjectId, 'Requirement Submitted', `Submitted: ${activeSubmittingReq.title}`)
        await notifyAdmin(selectedProjectId, `Requirement Submitted - ${proj?.title || 'Project'}`, `Client has submitted details for requirement: "${activeSubmittingReq.title}"`)
      }
    } catch (e: any) {
      toast({ title: 'Submission Failed', description: e.message, variant: 'destructive' })
    } finally {
      setSubmittingRequirementState(false)
    }
  }

  const handleClientUploadFile = async () => {
    if (!clientGeneralFile || !selectedProjectId) return
    setUploadingClientFile(true)
    try {
      const formData = new FormData()
      formData.append('file', clientGeneralFile)
      formData.append('projectId', selectedProjectId)
      formData.append('category', clientFileCategory)
      formData.append('uploadedBy', session?.name || 'Client')

      const res = await fetch('/api/project-files/upload', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Upload failed')

      await supabase.from('project_files').insert({
        project_id: selectedProjectId,
        name: data.fileName || clientGeneralFile.name,
        file_path: data.url,
        category: clientFileCategory,
        version: 1,
        visibility: 'Published to Client',
        uploaded_by: session?.name || 'Client'
      })

      toast({ title: 'Asset uploaded successfully', description: clientGeneralFile.name })
      setClientGeneralFile(null)
      setClientFileNotes('')

      fetchClientData(true)

      const proj = projects.find(p => p.id === selectedProjectId)
      await logWorkspaceActivityClient(selectedProjectId, 'Client File Uploaded', `Uploaded asset: ${clientGeneralFile.name} (${clientFileCategory})`)
      await notifyAdmin(selectedProjectId, `New File Uploaded - ${proj?.title || 'Project'}`, `Client has uploaded asset "${clientGeneralFile.name}" under category "${clientFileCategory}"`)
    } catch (e: any) {
      toast({ title: 'Upload Failed', description: e.message, variant: 'destructive' })
    } finally {
      setUploadingClientFile(false)
    }
  }

  const handleRefresh = () => {
    if (session) fetchClientData(true)
  }

  // Sidebar link details
  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: Briefcase, badge: projects.length },
    { id: 'workspace-reqs', label: 'Requirements', icon: FileSignature, badge: workspaceRequirements.filter(r => r.status === 'pending' || r.status === 'needs revision').length },
    { id: 'workspace-tasks', label: 'Tasks & Progress', icon: CheckCircle2 },
    { id: 'workspace-files', label: 'Files & Documents', icon: FolderOpen },
    { id: 'workspace-reports', label: 'Reports', icon: TrendingUp },
    { id: 'quotations', label: 'Quotations', icon: FileText, badge: docs.filter(d => d.type === 'Quotation').length },
    { id: 'sow', label: 'Scope of Work', icon: Briefcase, badge: docs.filter(d => d.type === 'SOW').length },
    { id: 'agreements', label: 'Agreements', icon: UserCheck, badge: docs.filter(d => d.type === 'Agreement').length },
    { id: 'invoices', label: 'Invoices', icon: Coins, badge: docs.filter(d => d.type === 'Invoice').length },
    { id: 'meetings', label: 'Meetings', icon: Calendar },
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

  const clientSupportTickets = notifications.filter(n => n.type === 'support')

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
    if (s === 'completed' || s === 'signed' || s === 'paid') return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] capitalize"><Check className="h-2.5 w-2.5 mr-1" />{status}</Badge>
    if (s === 'needs revision') return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-[10px] capitalize"><AlertTriangle className="h-2.5 w-2.5 mr-1" />Changes Requested</Badge>
    if (s === 'rejected' || s === 'declined') return <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] capitalize"><X className="h-2.5 w-2.5 mr-1" />Declined</Badge>
    if (s === 'viewed') return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] capitalize"><Eye className="h-2.5 w-2.5 mr-1" />Viewed</Badge>
    if (s === 'published') return <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] capitalize"><Globe className="h-2.5 w-2.5 mr-1" />New</Badge>
    return <Badge className="bg-slate-500/10 text-muted-foreground border border-slate-500/20 text-[10px] capitalize">{status}</Badge>
  }

  if (!sessionReady || loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{!sessionReady ? 'Verifying secure portal access...' : 'Retrieving client records...'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row font-sans relative overflow-hidden">
      {/* Mobile Sidebar overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 border-r border-border bg-card flex flex-col shrink-0 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${sidebarCollapsed ? 'w-64 md:w-16' : 'w-64'}`}>
        <div className="p-5 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img src="/logo.png" className="h-9 w-9 rounded-xl shrink-0 object-contain shadow-sm" alt="Netgain Logo" />
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-foreground tracking-wide whitespace-nowrap">NETGAIN PORTAL</p>
                <p className="text-[9px] text-primary tracking-widest -mt-0.5 whitespace-nowrap">SECURE CLIENT SUITE</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1 text-muted-foreground hover:text-foreground focus:outline-none"
          >
            <X className="h-5 w-5 text-primary" />
          </button>
        </div>

        {/* Company/Rep Overview card */}
        {!sidebarCollapsed && (
          <div className="mx-4 my-4 p-3 bg-accent/20 border border-border/60 rounded-xl">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Account Company</p>
            <p className="text-xs font-semibold text-primary mt-0.5 truncate">{session?.company}</p>
            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
              <User className="h-3 w-3 text-primary" />
              <span className="truncate">{session?.name}</span>
            </div>
          </div>
        )}

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navigationItems.map(item => {
            const Icon = item.icon
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSearch(''); setSelectedDoc(null); setMobileMenuOpen(false) }}
                className={`flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${active ? 'bg-primary text-black shadow-lg font-bold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'} ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </div>
                {!sidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${active ? 'bg-black text-primary' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-1.5 shrink-0">
          {/* Collapse Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`hidden md:flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-all ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4 shrink-0 text-primary" /> : <ChevronLeft className="h-4 w-4 shrink-0 text-primary" />}
            {!sidebarCollapsed && <span>Collapse Sidebar</span>}
          </button>

          <Button 
            onClick={handleLogout} 
            variant="outline" 
            className={`w-full h-9 text-xs border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/10 bg-transparent gap-2 ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
            title={sidebarCollapsed ? "Log Out Portal" : undefined}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!sidebarCollapsed && <span>Log Out Portal</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto min-h-0 bg-background relative">
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 -ml-1 text-muted-foreground hover:text-foreground md:hidden focus:outline-none"
            >
              <Menu className="h-5 w-5 text-primary" />
            </button>
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground font-semibold truncate max-w-[150px] sm:max-w-xs">{session?.company} Dashboard Suite</span>
          </div>

          <div className="flex items-center gap-3">
            <span className={`hidden sm:inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-semibold border ${realtimeConnected ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-muted-foreground border-slate-500/20'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${realtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
              {realtimeConnected ? 'Live' : 'Offline'}
            </span>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              className="border-border text-foreground/90 bg-card hover:bg-white/5 h-8 text-xs gap-2"
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
                <h1 className="text-2xl font-black text-foreground tracking-tight">Welcome, {session?.name}</h1>
                <p className="text-xs text-muted-foreground mt-1">Here is a summary of your shared assets, approvals, and invoices with Netgain.</p>
              </div>
            </div>

            {/* Premium Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Pending Quotations', val: statsSummary.pendingQuotations, col: 'text-amber-600 dark:text-amber-400', desc: 'Awaiting signature/approval' },
                { label: 'Pending Agreements', val: statsSummary.pendingAgreements, col: 'text-purple-600 dark:text-purple-400', desc: 'Awaiting digital signing' },
                { label: 'Unpaid Invoices', val: statsSummary.unpaidInvoices, col: 'text-rose-600 dark:text-rose-400', desc: 'Awaiting payment process' },
                { label: 'Active Projects', val: statsSummary.activeProjects, col: 'text-emerald-600 dark:text-emerald-400', desc: 'Currently in execution' }
              ].map(card => (
                <Card key={card.label} className="bg-card border-border/80 text-foreground shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 bottom-0 w-1 bg-primary/40" />
                  <CardContent className="p-4">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{card.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${card.col}`}>{card.val}</p>
                    <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">{card.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Quick Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Recent Published Documents */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-foreground tracking-wide uppercase text-primary">Recent Shared Documents</h3>
                  <button onClick={() => setActiveTab('documents')} className="text-xs text-primary/80 hover:text-primary flex items-center gap-1">
                    View Vault <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
                <Card className="bg-card border-border/80">
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {docs.slice(0, 5).map(doc => (
                        <div key={doc.id} onClick={() => openDoc(doc)} className="p-4 flex items-center justify-between hover:bg-accent/45 cursor-pointer transition-colors group">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-primary">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{doc.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] font-mono text-muted-foreground">{doc.docId}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-700" />
                                <span className="text-[9px] text-muted-foreground capitalize">{doc.type} · V{doc.published_version}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {getStatusBadgeStyled(doc.status)}
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-all" />
                          </div>
                        </div>
                      ))}
                      {docs.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground text-xs">No documents published yet.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Side activity / updates feed */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground tracking-wide uppercase text-primary">Recent Activity</h3>
                <Card className="bg-card border-border/80">
                  <CardContent className="p-4 space-y-4 max-h-[360px] overflow-y-auto">
                    {docs.flatMap(d => (d.raw.history || []).map((h: any) => ({ ...h, doc: d }))).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6).map((act, i) => (
                      <div key={i} className="flex gap-3 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                        <div>
                          <p className="text-foreground/90 leading-snug">{act.action}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{act.doc?.docId} · {formatDate(act.date)}</p>
                        </div>
                      </div>
                    ))}
                    {docs.length === 0 && (
                      <div className="text-center text-muted-foreground text-xs py-4">No recent activity logs.</div>
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
              <h1 className="text-xl font-bold capitalize text-foreground">{activeTab === 'documents' ? 'Document Vault' : activeTab}</h1>
              <p className="text-xs text-muted-foreground mt-1">Search and manage all shared {activeTab} files.</p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by keyword, project, ID..."
                className="pl-9 bg-card border-border text-foreground focus-visible:ring-[#D4AF37] h-9 text-xs"
              />
            </div>

            <Card className="bg-card border-border/80">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground uppercase tracking-wider text-[10px]">
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
                      <tr key={doc.id} className="border-b border-border/40 hover:bg-accent/20 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-primary">{doc.docId}</td>
                        <td className="py-3.5 px-4 font-semibold text-foreground">{doc.title}</td>
                        <td className="py-3.5 px-4 text-muted-foreground">V{doc.published_version}</td>
                        <td className="py-3.5 px-4 text-muted-foreground">{formatDate(doc.date)}</td>
                        <td className="py-3.5 px-4">{getStatusBadgeStyled(doc.status)}</td>
                        {activeTab !== 'marketing' && (
                          <td className="py-3.5 px-4 font-bold text-primary">
                            {doc.amount > 0 ? formatCurrency(doc.amount) : '—'}
                          </td>
                        )}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button onClick={() => openDoc(doc)} variant="outline" size="sm" className="h-7 text-[10px] border-border bg-transparent text-foreground/90">
                              View
                            </Button>
                            <Button onClick={() => handleDownloadPdf(doc)} variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {tabDocs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-muted-foreground">
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
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-foreground">Project Workspaces</h1>
                <p className="text-xs text-muted-foreground mt-1">Track sprint milestones, progress, and managers assigned to your executions.</p>
              </div>
              {projects.length > 1 && (
                <Select value={selectedProjectId || ''} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="h-8 w-44 bg-card border-border text-xs text-foreground"><SelectValue placeholder="Select Project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projects.filter(p => selectedProjectId ? p.id === selectedProjectId : true).map(proj => {
                const stage = proj.currentStage || (proj.status === 'active' ? 'Development & Integration' : 'Deployment')
                const progressVal = proj.progress || 0
                return (
                  <Card key={proj.id} className="bg-card border-border/80 text-foreground relative overflow-hidden">
                    <CardHeader className="border-b border-border/50 pb-3 flex flex-row items-center justify-between">
                      <div>
                        <Badge className="bg-[#D4AF37]/15 text-primary border border-[#D4AF37]/25 text-[9px] uppercase tracking-wider mb-1.5">{proj.stack?.includes('{') ? 'Strategy Engine' : proj.stack}</Badge>
                        <CardTitle className="text-base font-bold text-foreground">{proj.title}</CardTitle>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Project ID: {proj.docId}</p>
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 capitalize">{proj.status}</Badge>
                    </CardHeader>
                    <CardContent className="p-5 space-y-5">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-muted-foreground">Current Stage</span>
                          <span className="text-primary">{stage}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-snug">Sprint goal: {proj.sprintGoal || 'Final API integrations and validation checks.'}</p>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                          <span>Delivery Checklist Progress</span>
                          <span>{progressVal}%</span>
                        </div>
                        <Progress value={progressVal} className="h-1.5 bg-muted/30" />
                      </div>

                      <div className="border-t border-border/50 pt-4 flex items-center justify-between text-xs">
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Date Initiated</p>
                          <p className="font-semibold text-foreground/90 mt-0.5">{formatDate(proj.created)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Account Executive</p>
                          <p className="font-semibold text-primary mt-0.5">Netgain Team Manager</p>
                        </div>
                      </div>

                      {/* Project updates timeline */}
                      {workspaceTimeline.filter(t => t.project_id === proj.id).length > 0 && (
                        <div className="border-t border-border/40 pt-4 space-y-3.5">
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Latest Project Check-ins</p>
                          <div className="space-y-2.5">
                            {workspaceTimeline.filter(t => t.project_id === proj.id).slice(0, 3).map((hist, i) => (
                              <div key={i} className="flex gap-2.5 items-start text-[11px]">
                                <span className="text-primary font-bold shrink-0 mt-0.5">▪</span>
                                <div>
                                  <p className="text-foreground/90 leading-snug">{hist.action}</p>
                                  {hist.notes && <p className="text-[9px] text-muted-foreground mt-0.5">"{hist.notes}"</p>}
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
                <div className="col-span-2 text-center py-16 border border-dashed border-border bg-card/10 rounded-2xl">
                  <Briefcase className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-semibold text-muted-foreground">No active projects linked</p>
                  <p className="text-xs text-muted-foreground mt-1">Once project kick-off commences, checklists and sprints will display here.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Workspace: Requirements Tab */}
        {activeTab === 'workspace-reqs' && !selectedDoc && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-foreground">Project Requirements</h1>
                <p className="text-xs text-muted-foreground mt-1">Provide information, logo assets, brand guidelines, and access credentials requested by Netgain Studio.</p>
              </div>
              {projects.length > 1 && (
                <Select value={selectedProjectId || ''} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="h-8 w-44 bg-card border-border text-xs text-foreground"><SelectValue placeholder="Select Project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Submission Form Overlay */}
            {activeSubmittingReq && (
              <Card className="bg-card border-border p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <h3 className="text-xs font-bold text-primary uppercase">Submit Requirement: {activeSubmittingReq.title}</h3>
                  <button onClick={() => setActiveSubmittingReq(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
                {activeSubmittingReq.description && <p className="text-xs text-foreground/90 italic">Instructions: {activeSubmittingReq.description}</p>}

                <div className="space-y-4 text-xs">
                  {activeSubmittingReq.allow_text && (
                    <div className="space-y-1">
                      <Label>Text Response / Details</Label>
                      <Textarea placeholder="Type requested information here..." value={clientTextResponse} onChange={e => setClientTextResponse(e.target.value)} className="bg-muted/10 border-border text-foreground" />
                    </div>
                  )}

                  {activeSubmittingReq.allow_link && (
                    <div className="space-y-1">
                      <Label>Submit Resource Links (one URL per line)</Label>
                      <Textarea placeholder="https://figma.com/...&#10;https://drive.google.com/..." value={clientLinksInput} onChange={e => setClientLinksInput(e.target.value)} className="h-16 bg-muted/10 border-border text-foreground" />
                    </div>
                  )}

                  {activeSubmittingReq.allow_file && (
                    <div className="space-y-1 border border-dashed border-border rounded-xl p-4 bg-muted/10">
                      <Label className="text-primary font-bold mb-1.5 block">Drag & Drop or Select Files</Label>
                      <Input 
                        type="file" 
                        onChange={e => setClientUploadFiles(e.target.files ? Array.from(e.target.files) : [])} 
                        className="bg-transparent border-none file:bg-primary file:text-black file:text-xs file:font-bold file:px-3 file:py-1 file:rounded file:border-none file:cursor-pointer"
                      />
                      {clientUploadFiles.length > 0 && (
                        <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                          <p className="font-semibold text-foreground/90">Selected files:</p>
                          {clientUploadFiles.map((f, i) => <p key={i}>• {f.name} ({(f.size/1024/1024).toFixed(2)} MB)</p>)}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label>Additional Notes for Netgain Team</Label>
                    <Input placeholder="Any extra comments..." value={clientSubmissionNotes} onChange={e => setClientSubmissionNotes(e.target.value)} className="bg-muted/10 border-border text-foreground" />
                  </div>

                  <div className="flex gap-2 justify-end border-t border-border pt-3">
                    <Button variant="outline" size="sm" onClick={() => setActiveSubmittingReq(null)}>Cancel</Button>
                    <Button variant="default" size="sm" onClick={handleSubmitRequirement} disabled={submittingRequirementState}>
                      {submittingRequirementState ? 'Submitting...' : 'Submit Information'}
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* List of Requirement Requests */}
            <div className="grid grid-cols-1 gap-4">
              {workspaceRequirements
                .filter(r => selectedProjectId ? r.project_id === selectedProjectId : true)
                .map((req: any) => {
                  const sub = workspaceSubmissions.find(s => s.requirement_id === req.id)
                  return (
                    <Card key={req.id} className="bg-card border-border/80 p-5 text-xs text-foreground/90 relative overflow-hidden">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">{req.title}</span>
                            {req.is_required && <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[9px]">Required</Badge>}
                            <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-mono ${req.priority === 'high' ? 'text-red-600 dark:text-red-400 bg-red-500/10' : 'text-muted-foreground bg-slate-500/10'}`}>{req.priority} Priority</span>
                          </div>
                          {req.description && <p className="text-muted-foreground text-xs mt-1">{req.description}</p>}
                          {req.due_date && <p className="text-[10px] text-muted-foreground font-mono mt-1"><Clock className="h-3 w-3 inline mr-1" />Due Date: {formatDate(req.due_date)}</p>}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize ${req.status === 'completed' || req.status === 'approved' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : req.status === 'needs revision' ? 'text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20' : req.status === 'submitted' ? 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20' : 'text-muted-foreground bg-slate-500/10 border border-slate-500/20'}`}>{req.status === 'needs revision' ? 'revision needed' : req.status}</span>
                          
                          {['pending', 'needs revision'].includes(req.status) && (
                            <Button variant="default" size="sm" onClick={() => setActiveSubmittingReq(req)} className="h-8 text-xs font-semibold px-4">Provide Details</Button>
                          )}
                        </div>
                      </div>

                      {sub && (sub.feedback || sub.notes) && (
                        <div className="mt-3.5 pt-3 border-t border-border/50 space-y-2 text-[11px] leading-relaxed">
                          {sub.notes && <p className="text-muted-foreground">Your Submission Notes: "{sub.notes}"</p>}
                          {sub.feedback && (
                            <div className="p-2.5 bg-red-950/15 border border-red-900/20 rounded-lg text-foreground/90">
                              <span className="font-bold text-red-600 dark:text-red-400 uppercase text-[9px] block mb-0.5">Admin Review Comment:</span>
                              "{sub.feedback}"
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  )
                })}
              
              {workspaceRequirements.filter(r => selectedProjectId ? r.project_id === selectedProjectId : true).length === 0 && (
                <div className="text-center py-12 border border-dashed border-border bg-card/10 rounded-2xl">
                  <FileCheck2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-semibold text-muted-foreground">No requirements requested</p>
                  <p className="text-xs text-muted-foreground mt-1">Excellent! Netgain Studio has not requested any outstanding assets or files at this stage.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Workspace: Tasks & Progress Tab */}
        {activeTab === 'workspace-tasks' && !selectedDoc && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-foreground">Tasks & Sprints</h1>
                <p className="text-xs text-muted-foreground mt-1">Monitor the active milestones, checklists, and execution stages of your projects.</p>
                <p className="text-[10px] text-muted-foreground mt-1">Read-only in the client portal. Admin updates sync here in real time.</p>
              </div>
              {projects.length > 1 && (
                <Select value={selectedProjectId || ''} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="h-8 w-44 bg-card border-border text-xs text-foreground"><SelectValue placeholder="Select Project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {(() => {
              const currentProj = projects.find(p => p.id === selectedProjectId)
              if (!currentProj) {
                return <div className="text-center py-8 text-muted-foreground text-xs">No active project workspace selected.</div>
              }
              const stage = currentProj.currentStage || (currentProj.status === 'active' ? 'Development & Sprints' : currentProj.status === 'completed' ? 'Completed & Deployed' : 'Planned / Backlog')
              return (
                <div className="space-y-6 max-w-4xl">
                  <Card className="bg-card border-border/80 p-5 space-y-4">
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Current Project Phase</span>
                        <h3 className="text-sm font-bold text-foreground mt-0.5">{stage}</h3>
                      </div>
                      <Badge className="bg-primary/10 text-primary border border-primary/20 text-[10px] capitalize px-2 py-0.5">{currentProj.status}</Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Workspace Checklist Progress</span>
                        <span className="font-semibold text-primary">{currentProj.progress || 0}%</span>
                      </div>
                      <Progress value={currentProj.progress || 0} className="h-2 bg-muted/30" />
                    </div>
                  </Card>

                  {/* Tasks / Milestones List */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-foreground tracking-wide uppercase text-primary">Project Milestones</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {(currentProj as any).milestones && (currentProj as any).milestones.length > 0 ? (
                        (currentProj as any).milestones.map((m: string, i: number) => {
                          const isDone = m.endsWith(' ✅')
                          const cleanText = m.replace(' ✅', '').replace(' ⏳', '')
                          return (
                            <Card key={i} className="bg-card border-border/60 p-4 flex items-center justify-between text-xs hover:border-gold/30 transition-colors">
                              <div className="flex items-center gap-3">
                                <span className={`flex h-4 w-4 items-center justify-center rounded border ${isDone ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-slate-500/50 bg-slate-500/10 text-muted-foreground'}`} aria-hidden="true">
                                  <Check className="h-3 w-3" />
                                </span>
                                <span className={`font-semibold ${isDone ? 'line-through text-muted-foreground' : 'text-foreground/90'}`}>{cleanText}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={`text-[9px] ${isDone ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-muted-foreground border border-slate-500/20'}`}>{isDone ? 'Completed' : 'Awaiting'}</Badge>
                              </div>
                            </Card>
                          )
                        })
                      ) : (
                        <div className="text-center py-8 text-muted-foreground italic">No milestones defined for this project yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Workspace: Files & Documents Tab */}
        {activeTab === 'workspace-files' && !selectedDoc && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-foreground">Files & Document Workspace</h1>
                <p className="text-xs text-muted-foreground mt-1">Review shared project documents, or upload brand guidelines, logos, and assets directly.</p>
              </div>
              {projects.length > 1 && (
                <Select value={selectedProjectId || ''} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="h-8 w-44 bg-card border-border text-xs text-foreground"><SelectValue placeholder="Select Project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedProjectId ? (
              <div className="space-y-6">
                <Card className="bg-card border-border/80 p-5 space-y-3">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Upload Brand Asset / Reference File</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-1 sm:col-span-2 border border-dashed border-border rounded-xl p-4 bg-muted/10">
                      <Label className="text-muted-foreground block mb-1.5">Select Files (Brand guidelines, design references, ZIPs, etc.)</Label>
                      <Input 
                        type="file" 
                        onChange={e => setClientGeneralFile(e.target.files ? e.target.files[0] : null)}
                        className="bg-transparent border-none file:bg-primary file:text-black file:text-xs file:font-bold file:px-3 file:py-1 file:rounded file:border-none file:cursor-pointer"
                      />
                    </div>
                    <div className="space-y-2 flex flex-col justify-between">
                      <div className="space-y-1">
                        <Label>Category</Label>
                        <Select value={clientFileCategory} onValueChange={setClientFileCategory}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Brand Logo">Brand Logo</SelectItem>
                            <SelectItem value="Brand Colors">Brand Colors</SelectItem>
                            <SelectItem value="Reference Images">Reference Images</SelectItem>
                            <SelectItem value="Business Documents">Business Documents</SelectItem>
                            <SelectItem value="Marketing Assets">Marketing Assets</SelectItem>
                            <SelectItem value="Other Documents">Other Documents</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        variant="default" 
                        className="h-8 text-xs font-bold w-full"
                        onClick={handleClientUploadFile}
                        disabled={uploadingClientFile || !clientGeneralFile}
                      >
                        {uploadingClientFile ? 'Uploading...' : 'Upload Asset'}
                      </Button>
                    </div>
                  </div>
                </Card>

                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground tracking-wide uppercase text-primary">Shared Assets & Files</h3>
                  <div className="border border-border rounded-xl overflow-hidden bg-card">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground uppercase tracking-wider text-[10px] bg-muted/10">
                            <th className="text-left py-2.5 px-4 font-semibold">Name</th>
                            <th className="text-left py-2.5 px-4 font-semibold">Category</th>
                            <th className="text-left py-2.5 px-4 font-semibold">Uploaded By</th>
                            <th className="text-left py-2.5 px-4 font-semibold">Upload Date</th>
                            <th className="text-right py-2.5 px-4 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workspaceFiles
                            .filter(file => file.project_id === selectedProjectId && file.visibility === 'Published to Client')
                            .map((file: any) => (
                              <tr key={file.id} className="border-b border-border/30 hover:bg-accent/10 text-foreground/90">
                                <td className="py-3 px-4 font-semibold text-foreground truncate max-w-[180px]">{file.name}</td>
                                <td className="py-3 px-4">{file.category}</td>
                                <td className="py-3 px-4 text-muted-foreground">{file.uploaded_by}</td>
                                <td className="py-3 px-4 text-muted-foreground">{formatDate(file.uploaded_at)}</td>
                                <td className="py-3 px-4 text-right">
                                  <a href={file.file_path} target="_blank" rel="noopener noreferrer" download>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10"><Download className="h-3.5 w-3.5" /></Button>
                                  </a>
                                </td>
                              </tr>
                            ))}

                          {workspaceLinks
                            .filter(l => l.project_id === selectedProjectId && l.visibility === 'Published to Client')
                            .map((link: any) => (
                              <tr key={link.id} className="border-b border-border/30 hover:bg-accent/10 text-foreground/90">
                                <td className="py-3 px-4 font-semibold text-foreground truncate max-w-[180px]">
                                  <p>{link.title}</p>
                                  {link.description && <p className="text-[10px] text-muted-foreground font-normal">{link.description}</p>}
                                </td>
                                <td className="py-3 px-4"><span className="text-primary font-bold">{link.category} Link</span></td>
                                <td className="py-3 px-4 text-muted-foreground">Admin Team</td>
                                <td className="py-3 px-4 text-muted-foreground">{formatDate(link.published_at)}</td>
                                <td className="py-3 px-4 text-right">
                                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10"><ExternalLink className="h-3.5 w-3.5" /></Button>
                                  </a>
                                </td>
                              </tr>
                            ))}

                          {workspaceFiles.filter(file => file.project_id === selectedProjectId && file.visibility === 'Published to Client').length === 0 &&
                           workspaceLinks.filter(l => l.project_id === selectedProjectId && l.visibility === 'Published to Client').length === 0 && (
                            <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">No shared files or resource links in this project.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No active project workspace selected.</div>
            )}
          </div>
        )}

        {/* Workspace: Reports Tab */}
        {activeTab === 'workspace-reports' && !selectedDoc && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-foreground">Performance Reports</h1>
                <p className="text-xs text-muted-foreground mt-1">Download and review performance audits, SEO checkups, and marketing reports generated for your campaigns.</p>
              </div>
              {projects.length > 1 && (
                <Select value={selectedProjectId || ''} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="h-8 w-44 bg-card border-border text-xs text-foreground"><SelectValue placeholder="Select Project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedProjectId ? (
              <div className="border border-border rounded-xl overflow-hidden bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground uppercase tracking-wider text-[10px] bg-muted/10">
                        <th className="text-left py-2.5 px-4 font-semibold">Report Title</th>
                        <th className="text-left py-2.5 px-4 font-semibold">Report Type</th>
                        <th className="text-left py-2.5 px-4 font-semibold">Version</th>
                        <th className="text-left py-2.5 px-4 font-semibold">Publication Date</th>
                        <th className="text-right py-2.5 px-4 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceReports
                        .filter(rep => rep.project_id === selectedProjectId && rep.visibility === 'Published to Client')
                        .map((rep: any) => (
                          <tr key={rep.id} className="border-b border-border/30 hover:bg-accent/10 text-foreground/90">
                            <td className="py-3.5 px-4 font-semibold text-foreground">{rep.title}</td>
                            <td className="py-3.5 px-4"><Badge className="bg-primary/10 text-primary border border-gold/20 text-[9px] capitalize">{rep.report_type}</Badge></td>
                            <td className="py-3.5 px-4 text-muted-foreground">V{rep.version}</td>
                            <td className="py-3.5 px-4 text-muted-foreground">{formatDate(rep.uploaded_at)}</td>
                            <td className="py-3.5 px-4 text-right">
                              <a href={rep.file_path} target="_blank" rel="noopener noreferrer" download>
                                <Button variant="outline" size="sm" className="h-7 text-[10px] border-border bg-transparent text-foreground/90">Download PDF</Button>
                              </a>
                            </td>
                          </tr>
                        ))}
                      {workspaceReports.filter(rep => rep.project_id === selectedProjectId && rep.visibility === 'Published to Client').length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-muted-foreground">
                            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30 text-primary" />
                            <p className="font-semibold">No performance reports published yet</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Once SEO audits or performance sprints compile, they will appear here.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No active project workspace selected.</div>
            )}
          </div>
        )}

        {/* Workspace: Meetings Tab */}
        {activeTab === 'meetings' && !selectedDoc && (
          <div className="p-6 space-y-6">
            <div>
              <h1 className="text-xl font-bold text-foreground">Consultations & Meetings</h1>
              <p className="text-xs text-muted-foreground mt-1">Review upcoming bookings, review recordings, or check details of completed milestones meetings.</p>
            </div>

            <Card className="bg-card border-border/80">
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">Book a Meeting</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                    Schedule a call with the Netgain team through Cal.com. Any booking will sync back into both the client portal and the admin meetings board.
                  </p>
                </div>
                {((companySettings?.company?.calBookingUrl || process.env.NEXT_PUBLIC_CAL_BOOKING_URL || '').trim()) ? (
                  <a
                    href={companySettings?.company?.calBookingUrl || process.env.NEXT_PUBLIC_CAL_BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    <Button variant="default" size="sm" className="h-9 font-semibold px-4 gap-1.5">
                      Book via Cal.com <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                ) : (
                  <Badge className="bg-slate-500/10 text-muted-foreground border border-slate-500/20 px-3 py-1.5">
                    Cal.com booking link not configured
                  </Badge>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4">
              {workspaceMeetings.map((meet: any) => {
                const dateStr = new Date(`${meet.meeting_date}T00:00:00`).toLocaleString('en-IN', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })
                const isUpcoming = meet.status === 'upcoming'
                return (
                  <Card key={meet.id} className="bg-card border-border/80 p-5 text-xs text-foreground/90 relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{meet.event_type || 'Consultation Meeting'}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${isUpcoming ? 'text-primary bg-primary/10' : 'text-muted-foreground bg-slate-500/10'}`}>{meet.status}</span>
                        </div>
                        <p className="text-muted-foreground font-medium">{dateStr} at {meet.meeting_time.slice(0,5)} ({meet.meeting_duration} Mins)</p>
                        {meet.notes && <p className="text-muted-foreground mt-1.5 italic font-mono">Agenda Notes: "{meet.notes}"</p>}
                      </div>

                      {isUpcoming && meet.meet_link && (
                        <a href={meet.meet_link} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <Button variant="default" size="sm" className="h-8 font-semibold px-4 gap-1.5">Join Call <ExternalLink className="h-3.5 w-3.5" /></Button>
                        </a>
                      )}
                    </div>
                  </Card>
                )
              })}
              {workspaceMeetings.length === 0 && (
                <div className="text-center py-12 border border-dashed border-border bg-card/10 rounded-2xl">
                  <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-semibold text-muted-foreground">No scheduled meetings</p>
                  <p className="text-xs text-muted-foreground mt-1">Need to schedule a sync? Contact your Netgain account executive to schedule a call.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notifications View */}
        {activeTab === 'notifications' && !selectedDoc && (
          <div className="p-6 space-y-6 max-w-3xl">
            <div>
              <h1 className="text-xl font-bold text-foreground">Client Notifications</h1>
              <p className="text-xs text-muted-foreground mt-1">Receive live system logs, publication schedules, and signature confirmations.</p>
            </div>

            <Card className="bg-card border-border/80">
              <CardContent className="p-0 divide-y divide-border">
                {notifications.map(notif => (
                  <div key={notif.id} className="p-4 flex gap-4 items-start hover:bg-accent/20 transition-colors">
                    <div className={`p-2 rounded-lg mt-0.5 shrink-0 border ${notif.is_read ? 'bg-background/50 border-slate-700/30 text-muted-foreground' : 'bg-primary/10 border-gold/20 text-primary'}`}>
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className={`text-xs font-semibold ${notif.is_read ? 'text-foreground/90' : 'text-foreground'}`}>{notif.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">{notif.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-2 font-mono">{formatDate(notif.created_at)}</p>
                    </div>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <div className="p-12 text-center text-muted-foreground text-xs">
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
              <h1 className="text-xl font-bold text-foreground">Customer Support Center</h1>
              <p className="text-xs text-muted-foreground mt-1">Submit support tickets, report account discrepancies, or schedule a founder consultation.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="bg-card border-border/80 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm font-bold text-primary uppercase tracking-wider">Raise Support Ticket</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">Describe your inquiry and our team will get back to you within 2-4 hours.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSendSupport} className="space-y-4 text-xs">
                    <div className="space-y-1">
                      <Label htmlFor="subj" className="text-muted-foreground">Subject / Category</Label>
                      <Input
                        id="subj"
                        placeholder="e.g. Account Billing Query, Project Milestone Revision"
                        value={supportSubject}
                        onChange={e => setSupportSubject(e.target.value)}
                        className="bg-muted/10 border-border text-foreground focus-visible:ring-gold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="msg" className="text-muted-foreground">Description of Issue</Label>
                      <Textarea
                        id="msg"
                        placeholder="Please details what you need..."
                        value={supportMessage}
                        onChange={e => setSupportMessage(e.target.value)}
                        className="bg-muted/10 border-border text-foreground min-h-[150px] resize-y focus-visible:ring-gold"
                      />
                    </div>
                    <Button type="submit" variant="default" className="w-full text-xs font-semibold text-black gap-2 h-9" disabled={submittingAction}>
                      {submittingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send Ticket
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-4 text-xs">
                <Card className="bg-card border-border/80">
                  <CardHeader><CardTitle className="text-xs font-bold text-primary uppercase tracking-wider">Direct Account Support</CardTitle></CardHeader>
                  <CardContent className="space-y-3 leading-relaxed">
                    <div>
                      <p className="text-muted-foreground font-medium">Primary Email</p>
                      <p className="text-primary font-semibold mt-0.5">{companySettings?.company?.email || 'support@netgainstudio.com'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium">Finance & Invoices</p>
                      <p className="text-primary font-semibold mt-0.5">{companySettings?.company?.email || 'accounts@netgainstudio.com'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium">Head Office Consultation</p>
                      <p className="text-foreground/90 font-semibold mt-0.5">{companySettings?.company?.phone || '+91 (800) 555-NETGAIN'}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border/80 text-foreground">
                  <CardHeader className="pb-2 border-b border-border/50">
                    <CardTitle className="text-xs font-bold text-primary uppercase tracking-wider">Sent Support Tickets</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4 max-h-[300px] overflow-y-auto pt-4">
                    {clientSupportTickets.map(ticket => (
                      <div key={ticket.id} className="p-2.5 rounded-lg bg-muted/10 border border-border/50 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-foreground/90 truncate max-w-[120px]">{ticket.title}</span>
                          <Badge className={`text-[8px] font-mono capitalize ${ticket.is_read ? 'bg-slate-500/10 text-muted-foreground border border-slate-500/20' : 'bg-amber-500/15 text-amber-500 border border-amber-500/25'}`}>
                            {ticket.is_read ? 'Read' : 'Open'}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-normal line-clamp-2">{ticket.message}</p>
                        <p className="text-[9px] text-muted-foreground font-mono">{formatDate(ticket.created_at)}</p>
                      </div>
                    ))}
                    {clientSupportTickets.length === 0 && (
                      <div className="text-center text-muted-foreground text-xs py-4">No support tickets raised yet.</div>
                    )}
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
              <h1 className="text-xl font-bold text-foreground">Company Profile</h1>
              <p className="text-xs text-muted-foreground mt-1">Review your business profiles, and authorized client contact configurations.</p>
            </div>

            <Card className="bg-card border-border/80 text-xs">
              <CardHeader className="border-b border-border/40"><CardTitle className="text-sm font-bold text-primary uppercase tracking-wider">Netgain Business Profile</CardTitle></CardHeader>
              <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5 leading-relaxed">
                <div>
                  <p className="text-muted-foreground font-medium">Business / Company Name</p>
                  <p className="text-foreground font-bold text-sm mt-0.5">{session?.company}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">Primary Contact Representative</p>
                  <p className="text-foreground font-bold text-sm mt-0.5">{session?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">Authorized Account Email</p>
                  <p className="text-foreground font-bold text-sm mt-0.5">{session?.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">Authorized Phone</p>
                  <p className="text-foreground font-bold text-sm mt-0.5">{session?.phone || 'Not Configured'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">Authorized Domain / Website</p>
                  <p className="text-foreground font-bold text-sm mt-0.5">{clientDetails?.website || session?.website || ''}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">GST registration</p>
                  <p className="text-foreground font-bold text-sm mt-0.5">{clientDetails?.gst || session?.gst || 'GST not provided'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground font-medium">Billing Address</p>
                  <p className="text-foreground font-bold text-sm mt-0.5">{clientDetails?.address || session?.address || '—'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Detailed Document Viewer tab/layout */}
        {selectedDoc && (
          <div className="p-6 space-y-6 max-w-5xl">
            {/* Viewer Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <Button onClick={() => setSelectedDoc(null)} variant="outline" size="sm" className="h-8 border-border bg-transparent text-foreground/90 gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
                <div>
                  <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                    {selectedDoc.title}
                    <Badge className="bg-primary/10 text-primary border border-primary/20 font-mono text-[10px]">V{selectedDoc.published_version}</Badge>
                  </h1>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Issued: {formatDate(selectedDoc.date)} · Ref: {selectedDoc.docId}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={() => handleDownloadPdf(selectedDoc)} variant="outline" size="sm" className="h-8 text-xs border-border bg-transparent text-foreground/90 gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
                <Button onClick={printDocument} variant="outline" size="sm" className="h-8 text-xs border-border bg-transparent text-foreground/90 gap-1.5">
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
              </div>
            </div>

            {/* Mobile helper banner */}
            <div className="lg:hidden bg-primary/10 border border-[#D4AF37]/20 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-foreground/90">
              <span className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="h-4 w-4 text-primary shrink-0" />
                Mobile View: If you can only see the first page, open the full document in a new tab.
              </span>
              <Button 
                onClick={() => {
                  const url = selectedDoc.token ? `/api/document-pdf?token=${selectedDoc.token}` : `/api/document-pdf?id=${selectedDoc.id}&type=${selectedDoc.type}`
                  window.open(url, '_blank')
                }} 
                variant="default" 
                size="sm" 
                className="h-8 text-xs text-black font-semibold shrink-0"
              >
                Open Full Document
              </Button>
            </div>

            {/* Document body preview with iframe */}
            <div className="flex flex-col lg:grid lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 bg-black border border-border rounded-2xl overflow-hidden shadow-2xl relative" style={{ height: 'calc(100dvh - 200px)', minHeight: '400px' }}>
                 <iframe 
                   id="doc-viewer-iframe"
                   src={selectedDoc.token ? `/api/document-pdf?token=${selectedDoc.token}#toolbar=0` : `/api/document-pdf?id=${selectedDoc.id}&type=${selectedDoc.type}#toolbar=0`} 
                   className="w-full h-full border-0 bg-white"
                   style={{ minHeight: '400px' }}
                   title={selectedDoc.title}
                   scrolling="yes"
                 />
              </div>

              {/* Sidebar Action Panel */}
              <div className="lg:col-span-1 space-y-6">
                <Card className="bg-card border-border shadow-xl">
                  <CardContent className="p-5 space-y-5">
                    
                    {/* Status & Version */}
                    <div className="flex flex-col gap-2 pb-4 border-b border-border">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground font-medium">Status</span>
                        {getStatusBadgeStyled(selectedDoc.status)}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground font-medium">Version</span>
                        <span className="font-mono font-bold text-foreground/90">V{selectedDoc.published_version}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground font-medium">Published</span>
                        <span className="font-semibold text-foreground/90 text-xs">{formatDate(selectedDoc.published_at)}</span>
                      </div>
                    </div>

                    {/* Interactive signing controls if applicable and NOT signed */}
                    {!selectedDoc.signed_at && 
                     !['completed', 'signed', 'approved', 'needs revision', 'rejected'].includes(selectedDoc.status?.toLowerCase() || '') && 
                     ['Quotation', 'Agreement', 'SOW'].includes(selectedDoc.type) && (
                      <div className="space-y-2 pt-2">
                        {selectedDoc.type === 'Quotation' ? (
                          <Button onClick={handleApproveDoc} variant="default" className="w-full text-xs font-semibold text-black gap-2 h-9" disabled={submittingAction}>
                            {submittingAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Approve Quotation
                          </Button>
                        ) : (
                          <Button onClick={() => setShowSignModal(true)} variant="default" className="w-full text-xs font-semibold text-black gap-2 h-9">
                            <FileSignature className="h-3.5 w-3.5" />
                            Accept & Sign
                          </Button>
                        )}
                        
                        <Button onClick={() => setShowRevisionModal(true)} variant="outline" className="w-full text-xs border-border bg-transparent text-foreground/90 hover:bg-white/5 h-9">
                          Request Changes
                        </Button>
                        <Button onClick={handleDeclineDoc} variant="outline" className="w-full text-xs border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 bg-transparent h-9">
                          Decline / Reject
                        </Button>
                      </div>
                    )}

                    {/* Needs revision state */}
                    {selectedDoc.status?.toLowerCase() === 'needs revision' && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center space-y-2 mt-2">
                        <AlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400 mx-auto" />
                        <p className="text-xs font-bold text-amber-600 dark:text-amber-400">Revision Requested</p>
                        <p className="text-[10px] text-muted-foreground leading-normal">
                          Your change request has been sent to the Netgain team. We will update this document shortly.
                        </p>
                      </div>
                    )}

                    {/* Approved & Signed state message */}
                    {(selectedDoc.signed_at || 
                      ['completed', 'signed', 'approved'].includes(selectedDoc.status?.toLowerCase() || '')) && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center space-y-2 mt-2">
                        <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400 mx-auto" />
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✅ Approved & Signed</p>
                        <p className="text-[10px] text-muted-foreground leading-normal">
                          This document has been digitally signed and is legally binding.
                        </p>
                        {selectedDoc.signed_at && (
                          <p className="text-[9px] text-muted-foreground">Signed on {formatDate(selectedDoc.signed_at)}</p>
                        )}
                      </div>
                    )}

                    {/* Invoices specific pay action if unpaid */}
                    {selectedDoc.type === 'Invoice' && selectedDoc.status !== 'paid' && (
                      <div className="pt-2">
                        <Button onClick={() => toast({ title: 'Pay Now integration coming soon!' })} variant="default" className="w-full text-xs font-semibold text-black gap-2 h-9">
                          Pay Now (Future)
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* History Log */}
                <Card className="bg-card border-border text-foreground">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <CardTitle className="text-xs font-bold text-primary uppercase tracking-wider">Document Timeline</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4 max-h-[220px] overflow-y-auto">
                    {(selectedDoc.raw.history || []).slice().reverse().map((h: any, i: number) => (
                      <div key={i} className="flex gap-2.5 text-[11px]">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-foreground/90 leading-snug">{h.action}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">{formatDate(h.date)}</p>
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
        <DialogContent className="max-w-md bg-card border-border">
          {/* Cursive Google Fonts */}
          <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Dancing+Script&family=Sacramento&display=swap" rel="stylesheet" />

          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <FileSignature className="h-5 w-5 text-primary" />
              Digitally Sign Document
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Sign document {selectedDoc?.docId} for proposed services value.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="sign-name" className="text-muted-foreground">Full Signature Name</Label>
              <Input
                id="sign-name"
                placeholder="Type your name to sign"
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
                className="bg-muted/10 border-border text-foreground focus-visible:ring-gold"
              />
            </div>

            {/* Signature Pad Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground">Signature Input</Label>
                <div className="flex bg-black border border-border rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setSigType('draw')}
                    className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-medium transition-all ${sigType === 'draw' ? 'bg-[#D4AF37] text-black font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <PenTool className="h-3 w-3" /> Draw
                  </button>
                  <button
                    type="button"
                    onClick={() => setSigType('type')}
                    className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-medium transition-all ${sigType === 'type' ? 'bg-[#D4AF37] text-black font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Type className="h-3 w-3" /> Type
                  </button>
                </div>
              </div>

              {sigType === 'draw' ? (
                /* Canvas draw pad */
                <div className="space-y-2">
                  <div className="border border-border rounded-lg bg-black overflow-hidden relative group">
                    <canvas
                      ref={canvasRef}
                      width={360}
                      height={140}
                      className="w-full h-[140px] cursor-crosshair block bg-black"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    {!drawSaved && drawHistory.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground text-xs font-mono">
                        Draw signature using Mouse / Touch here
                      </div>
                    )}
                    {drawSaved && (
                      <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold pointer-events-none">
                        <CheckCircle2 className="h-5 w-5 mb-1" /> Signature Locked & Saved
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        onClick={clearCanvas}
                        variant="outline"
                        className="h-7 px-2 text-[10px] border-border text-muted-foreground hover:text-foreground bg-transparent"
                      >
                        Clear
                      </Button>
                      <Button
                        type="button"
                        onClick={undoCanvas}
                        variant="outline"
                        className="h-7 px-2 text-[10px] border-border text-muted-foreground hover:text-foreground bg-transparent"
                        disabled={drawHistory.length === 0}
                      >
                        Undo
                      </Button>
                    </div>
                    <Button
                      type="button"
                      onClick={saveDrawnSignature}
                      variant="outline"
                      className={`h-7 px-2.5 text-[10px] gap-1 font-bold ${drawSaved ? 'border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5' : 'border-[#D4AF37]/30 text-primary hover:bg-[#D4AF37]/10'}`}
                    >
                      {drawSaved ? 'Saved ✔' : 'Save Signature'}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Cursive text input preview */
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-1">
                    {fonts.map(font => (
                      <button
                        key={font.value}
                        type="button"
                        onClick={() => { setSelectedFont(font.value); setTypeSaved(false); }}
                        className={`py-1 px-1.5 border rounded-md text-[10px] text-center font-medium transition-all ${selectedFont === font.value ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground/90'}`}
                      >
                        {font.name}
                      </button>
                    ))}
                  </div>
                  <div className="border border-border rounded-lg p-4 bg-black h-20 flex items-center justify-center relative overflow-hidden">
                    <p
                      className="text-2xl text-center text-primary px-4 truncate"
                      style={{
                        fontFamily: fonts.find(f => f.value === selectedFont)?.family || 'serif'
                      }}
                    >
                      {signerName || 'Signature Preview'}
                    </p>
                    {typeSaved && (
                      <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold pointer-events-none">
                        <CheckCircle2 className="h-5 w-5 mb-0.5" /> Signature Saved
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={saveTypedSignature}
                      variant="outline"
                      className={`h-7 px-2.5 text-[10px] gap-1 font-bold ${typeSaved ? 'border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5' : 'border-[#D4AF37]/30 text-primary hover:bg-[#D4AF37]/10'}`}
                    >
                      {typeSaved ? 'Saved ✔' : 'Save Signature'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer leading-normal text-muted-foreground">
              <input
                type="checkbox"
                checked={signingAgreed}
                onChange={e => setSigningAgreed(e.target.checked)}
                className="rounded mt-0.5 border-border text-primary focus:ring-gold"
              />
              <span>I confirm that I am authorized to sign on behalf of {session?.company} and accept the terms of this document.</span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowSignModal(false); setSignerName(''); setSigningAgreed(false); setDrawHistory([]); setDrawSaved(false); setSavedDrawData(null); setTypeSaved(false); }}>Cancel</Button>
            <Button
              variant="default"
              disabled={submittingAction || !signerName.trim() || !signingAgreed || (sigType === 'draw' ? !drawSaved : !typeSaved)}
              onClick={submitSignature}
              className="gap-2 text-black font-semibold"
            >
              {submittingAction && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm Signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REVISION NOTES MODAL */}
      <Dialog open={showRevisionModal} onOpenChange={setShowRevisionModal}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Request Document Revision
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Detail the updates or changes required before you sign.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 text-xs">
            <Label htmlFor="rev-notes" className="text-muted-foreground">Change Request Details</Label>
            <Textarea
              id="rev-notes"
              placeholder="e.g. Please update scope milestones to week 4, modify setup fee from ₹15k to ₹12k..."
              value={revisionNotes}
              onChange={e => setRevisionNotes(e.target.value)}
              className="bg-muted/10 border-border text-foreground min-h-[120px] resize-y focus-visible:ring-gold"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRevisionModal(false); setRevisionNotes('') }}>Cancel</Button>
            <Button
              variant="default"
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
