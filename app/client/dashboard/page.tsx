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
  Coins, TrendingUp, Menu, PenTool, Type
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  // Data States
  const [docs, setDocs] = useState<ClientDoc[]>([])
  const [projects, setProjects] = useState<Project[]>([])
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
      const [quosRes, sowsRes, agrsRes, invsRes, mrRes, projRes, notifRes, tokensRes, compRes, clientRes] = await Promise.all([
        supabase.from('quotations').select('*'),
        supabase.from('sows').select('*'),
        supabase.from('agreements').select('*'),
        supabase.from('invoices').select('*'),
        supabase.from('marketing_reports').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('client_notifications').select('*').or(`client_id.eq."${session.company}",client_id.eq."${session.email}"`).order('created_at', { ascending: false }),
        supabase.from('document_tokens').select('*').eq('status', 'active'),
        supabase.from('company_settings').select('*').limit(1).single(),
        session.clientId ? supabase.from('crm_clients').select('website, address, gst').eq('id', session.clientId).maybeSingle() : Promise.resolve({ data: null })
      ])
      
      if (compRes.data) {
        setCompanySettings(compRes.data)
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
      }).map((p: any) => ({
        id: p.id, docId: p.doc_id, title: p.title, client: p.client, stack: p.stack || 'Custom Stack', status: p.status || 'active', created: p.created_at, history: p.history || []
      }))

      setProjects(matchedProjects)
      
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
    try { await supabase.from(tableName).update(updates).eq('id', doc.id); await fetchClientData(true) } catch (err) { console.error(err) }
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

  const handleApproveDoc = () => {
    if (selectedDoc) {
      trackActivity(selectedDoc, 'approve')
      toast({ title: 'Document Approved', description: 'Thank you for your approval.' })
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
        { date: new Date().toISOString().split('T')[0], action: 'Status changed to completed' }
      ]

      const { error: updateDocError } = await supabase
        .from(tableName)
        .update({
          status: 'completed',
          is_locked: true,
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
        await supabase.from(tableName).update({ status: 'needs revision' }).eq('id', selectedDoc.id)
        
        await supabase.from('client_notifications').insert({
          client_id: session?.company || session?.email,
          title: `Revision Requested for ${selectedDoc.title}`,
          message: revisionNotes,
          type: 'support',
          is_read: false
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

  const handleRefresh = () => {
    if (session) fetchClientData(true)
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
    <div className="min-h-screen bg-[#070e0b] text-slate-100 flex flex-col md:flex-row font-sans relative overflow-hidden">
      {/* Mobile Sidebar overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 border-r border-[#152e23] bg-[#091510] flex flex-col shrink-0 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${sidebarCollapsed ? 'w-64 md:w-16' : 'w-64'}`}>
        <div className="p-5 flex items-center justify-between border-b border-[#152e23]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-9 w-9 rounded-xl gold-gradient flex items-center justify-center font-black text-black shadow-lg shrink-0">N</div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white tracking-wide whitespace-nowrap">NETGAIN PORTAL</p>
                <p className="text-[9px] text-[#D4AF37] tracking-widest -mt-0.5 whitespace-nowrap">SECURE CLIENT SUITE</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1 text-slate-400 hover:text-white focus:outline-none"
          >
            <X className="h-5 w-5 text-gold" />
          </button>
        </div>

        {/* Company/Rep Overview card */}
        {!sidebarCollapsed && (
          <div className="mx-4 my-4 p-3 bg-emerald-950/20 border border-[#152e23]/60 rounded-xl">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Account Company</p>
            <p className="text-xs font-semibold text-[#D4AF37] mt-0.5 truncate">{session?.company}</p>
            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400">
              <User className="h-3 w-3 text-gold" />
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
                className={`flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${active ? 'bg-gold text-black shadow-lg font-bold' : 'text-slate-400 hover:bg-[#11241c] hover:text-white'} ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </div>
                {!sidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${active ? 'bg-black text-gold' : 'bg-gold/15 text-gold border border-gold/25'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="p-3 border-t border-[#152e23] space-y-1.5 shrink-0">
          {/* Collapse Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`hidden md:flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-[#11241c] hover:text-white transition-all ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4 shrink-0 text-gold" /> : <ChevronLeft className="h-4 w-4 shrink-0 text-gold" />}
            {!sidebarCollapsed && <span>Collapse Sidebar</span>}
          </button>

          <Button 
            onClick={handleLogout} 
            variant="outline" 
            className={`w-full h-9 text-xs border-red-500/20 text-red-400 hover:bg-red-500/10 bg-transparent gap-2 ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
            title={sidebarCollapsed ? "Log Out Portal" : undefined}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!sidebarCollapsed && <span>Log Out Portal</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto min-h-0 bg-[#070e0b] relative">
        <header className="h-16 border-b border-[#152e23] bg-[#091510]/50 backdrop-blur flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 -ml-1 text-slate-400 hover:text-white md:hidden focus:outline-none"
            >
              <Menu className="h-5 w-5 text-gold" />
            </button>
            <Building2 className="h-4 w-4 text-[#D4AF37] shrink-0" />
            <span className="text-xs text-slate-400 font-semibold truncate max-w-[150px] sm:max-w-xs">{session?.company} Dashboard Suite</span>
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
                      <p className="text-[#D4AF37] font-semibold mt-0.5">{companySettings?.company?.email || 'support@netgainstudio.com'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium">Finance & Invoices</p>
                      <p className="text-[#D4AF37] font-semibold mt-0.5">{companySettings?.company?.email || 'accounts@netgainstudio.com'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium">Head Office Consultation</p>
                      <p className="text-slate-300 font-semibold mt-0.5">{companySettings?.company?.phone || '+91 (800) 555-NETGAIN'}</p>
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
              <p className="text-xs text-slate-400 mt-1">Review your business profiles, and authorized client contact configurations.</p>
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
                  <p className="text-slate-400 font-medium">Authorized Domain / Website</p>
                  <p className="text-white font-bold text-sm mt-0.5">{clientDetails?.website || session?.website || ''}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">GST registration</p>
                  <p className="text-white font-bold text-sm mt-0.5">{clientDetails?.gst || session?.gst || 'GST not provided'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-slate-400 font-medium">Billing Address</p>
                  <p className="text-white font-bold text-sm mt-0.5">{clientDetails?.address || session?.address || '—'}</p>
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
                <Button onClick={printDocument} variant="outline" size="sm" className="h-8 text-xs border-[#152e23] bg-transparent text-slate-300 gap-1.5">
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
              </div>
            </div>

            {/* Mobile helper banner */}
            <div className="lg:hidden bg-gold/10 border border-[#D4AF37]/20 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-300">
              <span className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="h-4 w-4 text-[#D4AF37] shrink-0" />
                Mobile View: If you can only see the first page, open the full document in a new tab.
              </span>
              <Button 
                onClick={() => {
                  const url = selectedDoc.token ? `/api/document-pdf?token=${selectedDoc.token}` : `/api/document-pdf?id=${selectedDoc.id}&type=${selectedDoc.type}`
                  window.open(url, '_blank')
                }} 
                variant="gold" 
                size="sm" 
                className="h-8 text-xs text-black font-semibold shrink-0"
              >
                Open Full Document
              </Button>
            </div>

            {/* Document body preview with iframe */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 bg-black border border-[#152e23] rounded-2xl overflow-hidden shadow-2xl relative h-[80vh] min-h-[600px]">
                 <iframe 
                   id="doc-viewer-iframe"
                   src={selectedDoc.token ? `/api/document-pdf?token=${selectedDoc.token}#toolbar=0` : `/api/document-pdf?id=${selectedDoc.id}&type=${selectedDoc.type}#toolbar=0`} 
                   className="w-full h-full border-0 bg-white"
                   title={selectedDoc.title}
                 />
              </div>

              {/* Sidebar Action Panel */}
              <div className="lg:col-span-1 space-y-6">
                <Card className="bg-[#121212] border-white/5 shadow-xl">
                  <CardContent className="p-5 space-y-5">
                    
                    {/* Status & Version */}
                    <div className="flex flex-col gap-2 pb-4 border-b border-white/5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400 font-medium">Status</span>
                        {getStatusBadgeStyled(selectedDoc.status)}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400 font-medium">Version</span>
                        <span className="font-mono font-bold text-slate-300">V{selectedDoc.published_version}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400 font-medium">Published</span>
                        <span className="font-semibold text-slate-300 text-xs">{formatDate(selectedDoc.published_at)}</span>
                      </div>
                    </div>

                    {/* Interactive signing controls if applicable and NOT signed */}
                    {!selectedDoc.signed_at && ['Quotation', 'Agreement', 'SOW'].includes(selectedDoc.type) && selectedDoc.status !== 'rejected' && (
                      <div className="space-y-2 pt-2">
                        {selectedDoc.type === 'Quotation' ? (
                          <Button onClick={handleApproveDoc} variant="gold" className="w-full text-xs font-semibold text-black gap-2 h-9" disabled={submittingAction}>
                            {submittingAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Approve Quotation
                          </Button>
                        ) : (
                          <Button onClick={() => setShowSignModal(true)} variant="gold" className="w-full text-xs font-semibold text-black gap-2 h-9">
                            <FileSignature className="h-3.5 w-3.5" />
                            Accept & Sign
                          </Button>
                        )}
                        
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
          {/* Cursive Google Fonts */}
          <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Dancing+Script&family=Sacramento&display=swap" rel="stylesheet" />

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

            {/* Signature Pad Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-slate-400">Signature Input</Label>
                <div className="flex bg-black border border-[#152e23] rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setSigType('draw')}
                    className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-medium transition-all ${sigType === 'draw' ? 'bg-[#D4AF37] text-black font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    <PenTool className="h-3 w-3" /> Draw
                  </button>
                  <button
                    type="button"
                    onClick={() => setSigType('type')}
                    className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-medium transition-all ${sigType === 'type' ? 'bg-[#D4AF37] text-black font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    <Type className="h-3 w-3" /> Type
                  </button>
                </div>
              </div>

              {sigType === 'draw' ? (
                /* Canvas draw pad */
                <div className="space-y-2">
                  <div className="border border-[#152e23] rounded-lg bg-black overflow-hidden relative group">
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
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-600 text-xs font-mono">
                        Draw signature using Mouse / Touch here
                      </div>
                    )}
                    {drawSaved && (
                      <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-emerald-400 text-xs font-bold pointer-events-none">
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
                        className="h-7 px-2 text-[10px] border-[#152e23] text-slate-400 hover:text-white bg-transparent"
                      >
                        Clear
                      </Button>
                      <Button
                        type="button"
                        onClick={undoCanvas}
                        variant="outline"
                        className="h-7 px-2 text-[10px] border-[#152e23] text-slate-400 hover:text-white bg-transparent"
                        disabled={drawHistory.length === 0}
                      >
                        Undo
                      </Button>
                    </div>
                    <Button
                      type="button"
                      onClick={saveDrawnSignature}
                      variant="outline"
                      className={`h-7 px-2.5 text-[10px] gap-1 font-bold ${drawSaved ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' : 'border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10'}`}
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
                        className={`py-1 px-1.5 border rounded-md text-[10px] text-center font-medium transition-all ${selectedFont === font.value ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-white' : 'border-[#152e23] text-slate-400 hover:text-slate-200'}`}
                      >
                        {font.name}
                      </button>
                    ))}
                  </div>
                  <div className="border border-[#152e23] rounded-lg p-4 bg-black h-20 flex items-center justify-center relative overflow-hidden">
                    <p
                      className="text-2xl text-center text-[#D4AF37] px-4 truncate"
                      style={{
                        fontFamily: fonts.find(f => f.value === selectedFont)?.family || 'serif'
                      }}
                    >
                      {signerName || 'Signature Preview'}
                    </p>
                    {typeSaved && (
                      <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-emerald-400 text-xs font-bold pointer-events-none">
                        <CheckCircle2 className="h-5 w-5 mb-0.5" /> Signature Saved
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={saveTypedSignature}
                      variant="outline"
                      className={`h-7 px-2.5 text-[10px] gap-1 font-bold ${typeSaved ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' : 'border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10'}`}
                    >
                      {typeSaved ? 'Saved ✔' : 'Save Signature'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

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
            <Button variant="outline" onClick={() => { setShowSignModal(false); setSignerName(''); setSigningAgreed(false); setDrawHistory([]); setDrawSaved(false); setSavedDrawData(null); setTypeSaved(false); }}>Cancel</Button>
            <Button
              variant="gold"
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
