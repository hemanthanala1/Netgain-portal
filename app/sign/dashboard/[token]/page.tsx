'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Search, FileText, Download, Clock, CheckCircle2, AlertTriangle, FileCheck2, ArrowRight, FolderOpen,
  Calendar, Building2, User, Mail, ShieldAlert, Loader2, RefreshCw
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

interface ClientDoc {
  id: string
  docId: string
  type: 'Quotation' | 'Invoice' | 'SOW' | 'Agreement' | 'PRD' | 'Marketing' | 'Proposal' | 'Contract'
  title: string
  amount: number
  status: string
  date: string
  token: string | null
  raw: any
}

export default function ClientDashboard({ params }: { params: { token: string } }) {
  const currentToken = params.token
  const [loading, setLoading] = useState(true)
  const [clientInfo, setClientInfo] = useState<any>(null)
  const [docs, setDocs] = useState<ClientDoc[]>([])
  const [search, setSearch] = useState('')
  const { toast } = useToast()

  const loadDashboardData = async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    try {
      // 1. Fetch current token and document info to identify client email/company
      const { data: activeToken, error: tokenError } = await supabase
        .from('document_tokens')
        .select('*')
        .eq('token', currentToken)
        .maybeSingle()

      if (tokenError || !activeToken) {
        setLoading(false)
        return
      }

      const TABLE_MAP: Record<string, string> = {
        Quotation: 'quotations',
        Invoice: 'invoices',
        SOW: 'sows',
        Agreement: 'agreements',
        PRD: 'prds',
        Marketing: 'marketing_reports',
        Proposal: 'proposals',
        Contract: 'contracts'
      }

      const currentTable = TABLE_MAP[activeToken.document_type]
      if (!currentTable) {
        setLoading(false)
        return
      }

      const { data: currentDoc } = await supabase
        .from(currentTable)
        .select('*')
        .eq('id', activeToken.document_id)
        .maybeSingle()

      if (!currentDoc) {
        setLoading(false)
        return
      }

      const clientEmail = currentDoc.email
      const clientCompany = currentDoc.client

      setClientInfo({
        name: currentDoc.contact || 'Client',
        company: clientCompany,
        email: clientEmail,
        phone: currentDoc.phone || ''
      })

      // 2. Query ALL documents across tables matching email or company
      const [quosRes, sowsRes, agrsRes, invsRes, propsRes, contsRes] = await Promise.all([
        supabase.from('quotations').select('*').or(`client.eq."${clientCompany}",email.eq."${clientEmail}"`),
        supabase.from('sows').select('*').or(`client.eq."${clientCompany}",phone.eq."${currentDoc.phone || 'null'}"`),
        supabase.from('agreements').select('*').or(`client.eq."${clientCompany}",phone.eq."${currentDoc.phone || 'null'}"`),
        supabase.from('invoices').select('*').or(`client.eq."${clientCompany}",email.eq."${clientEmail}"`),
        supabase.from('proposals').select('*').or(`client.eq."${clientCompany}",email.eq."${clientEmail}"`),
        supabase.from('contracts').select('*').or(`client.eq."${clientCompany}",email.eq."${clientEmail}"`)
      ])

      // 3. Query all tokens to attach to pending documents
      const { data: tokens } = await supabase
        .from('document_tokens')
        .select('*')
        .eq('status', 'active')

      const tokenMap = new Map<string, string>()
      if (tokens) {
        tokens.forEach((t: any) => {
          tokenMap.set(`${t.document_type}_${t.document_id}`, t.token)
        })
      }

      const combinedDocs: ClientDoc[] = []

      // Map Quotations
      if (quosRes.data) {
        quosRes.data.forEach(q => {
          combinedDocs.push({
            id: q.id,
            docId: q.doc_id,
            type: 'Quotation',
            title: q.project_title || 'Service Quotation',
            amount: Number(q.amount) || 0,
            status: q.status || 'draft',
            date: q.created || q.created_at?.slice(0, 10),
            token: tokenMap.get(`Quotation_${q.id}`) || null,
            raw: q
          })
        })
      }

      // Map SOWs
      if (sowsRes.data) {
        sowsRes.data.forEach(s => {
          combinedDocs.push({
            id: s.id,
            docId: s.doc_id,
            type: 'SOW',
            title: s.project || 'Scope of Work',
            amount: Number(s.value) || 0,
            status: s.status || 'draft',
            date: s.created || s.created_at?.slice(0, 10),
            token: tokenMap.get(`SOW_${s.id}`) || null,
            raw: s
          })
        })
      }

      // Map Agreements
      if (agrsRes.data) {
        agrsRes.data.forEach(a => {
          combinedDocs.push({
            id: a.id,
            docId: a.doc_id,
            type: 'Agreement',
            title: a.type || 'Service Agreement',
            amount: Number(a.value) || 0,
            status: a.status || 'draft',
            date: a.created || a.created_at?.slice(0, 10),
            token: tokenMap.get(`Agreement_${a.id}`) || null,
            raw: a
          })
        })
      }

      // Map Invoices
      if (invsRes.data) {
        invsRes.data.forEach(i => {
          combinedDocs.push({
            id: i.id,
            docId: i.doc_id,
            type: 'Invoice',
            title: `Tax Invoice — ${i.doc_id}`,
            amount: Number(i.amount) || 0,
            status: i.status || 'draft',
            date: i.created || i.created_at?.slice(0, 10),
            token: tokenMap.get(`Invoice_${i.id}`) || null,
            raw: i
          })
        })
      }

      // Map Proposals
      if (propsRes.data) {
        propsRes.data.forEach(p => {
          combinedDocs.push({
            id: p.id,
            docId: p.doc_id,
            type: 'Proposal',
            title: p.project_title || 'Business Proposal',
            amount: Number(p.value) || 0,
            status: p.status || 'draft',
            date: p.created || p.created_at?.slice(0, 10),
            token: tokenMap.get(`Proposal_${p.id}`) || null,
            raw: p
          })
        })
      }

      // Map Contracts
      if (contsRes.data) {
        contsRes.data.forEach(c => {
          combinedDocs.push({
            id: c.id,
            docId: c.doc_id,
            type: 'Contract',
            title: c.type || 'Service Contract',
            amount: Number(c.value) || 0,
            status: c.status || 'draft',
            date: c.created || c.created_at?.slice(0, 10),
            token: tokenMap.get(`Contract_${c.id}`) || null,
            raw: c
          })
        })
      }

      // Filter out internal drafts and sort by date descending
      const clientRelevantDocs = combinedDocs
        .filter(d => ['sent to client', 'viewed', 'signed', 'completed', 'needs revision'].includes(d.status.toLowerCase()))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      setDocs(clientRelevantDocs)
    } catch (e: any) {
      console.error(e)
      toast({ title: 'Error', description: 'Failed to load client dashboard data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [currentToken])

  // Real-time subscriptions — auto-refresh when docs change
  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const tables = ['quotations', 'invoices', 'sows', 'agreements', 'document_tokens', 'proposals', 'contracts']
    const channels = tables.map(table =>
      supabase
        .channel(`client_portal_dashboard_${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          loadDashboardData()
        })
        .subscribe()
    )

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch))
    }
  }, [currentToken])

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase()
    if (s === 'completed' || s === 'signed') {
      return <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 gap-1"><CheckCircle2 className="h-3 w-3" /> Completed</Badge>
    }
    if (s === 'needs revision') {
      return <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 gap-1"><AlertTriangle className="h-3 w-3" /> Revision Requested</Badge>
    }
    if (s === 'viewed') {
      return <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 gap-1"><Clock className="h-3 w-3" /> Viewed</Badge>
    }
    return <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 gap-1"><Clock className="h-3 w-3" /> Pending Signature</Badge>
  }

  const filtered = docs.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.docId.toLowerCase().includes(search.toLowerCase()) ||
    d.type.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    pending: docs.filter(d => ['sent to client', 'viewed'].includes(d.status.toLowerCase())).length,
    completed: docs.filter(d => ['signed', 'completed'].includes(d.status.toLowerCase())).length,
    revisions: docs.filter(d => d.status.toLowerCase() === 'needs revision').length
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A1612] text-white flex flex-col justify-center items-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#D4AF37] mb-4" />
        <p className="text-sm text-slate-400">Loading client dashboard hub...</p>
      </div>
    )
  }

  if (!clientInfo) {
    return (
      <div className="min-h-screen bg-[#0A1612] text-white flex flex-col justify-center items-center p-4">
        <Card className="max-w-md w-full border-red-500/20 bg-[#12241D]/90 text-white">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold">Unauthorized Access</CardTitle>
            <p className="text-sm text-slate-400 font-sans">
              We could not authenticate your company or details using this token. Please contact Netgain Studio for support.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A1612] text-slate-100 pb-16 font-sans">
      {/* Header bar */}
      <div className="border-b border-[#1E3A2F] bg-[#0A1612]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gold-gradient flex items-center justify-center font-bold text-white shadow-md">N</div>
            <div>
              <p className="text-sm font-bold text-white tracking-wide">NETGAIN STUDIO</p>
              <p className="text-[9px] text-[#D4AF37]/80 tracking-widest -mt-0.5">BUSINESS OS</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <div className="hidden sm:flex items-center gap-1.5 bg-[#12241D] border border-[#1E3A2F] px-3 py-1 rounded-full text-slate-300">
              <Building2 className="h-3 w-3 text-[#D4AF37]" /> {clientInfo.company}
            </div>
            <div className="hidden sm:flex items-center gap-1.5 bg-[#12241D] border border-[#1E3A2F] px-3 py-1 rounded-full text-slate-300">
              <User className="h-3 w-3 text-[#D4AF37]" /> {clientInfo.name}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-10 space-y-8">
        {/* Welcome Block */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#1E3A2F]/60 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Client Document Hub</h1>
            <p className="text-sm text-slate-400 mt-1">Review, sign, download, and track all documents shared with {clientInfo.company}.</p>
          </div>
          <Button
            onClick={loadDashboardData}
            variant="outline"
            className="border-[#1E3A2F] text-slate-300 bg-[#12241D] hover:bg-white/5 h-9"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2" /> Refresh Hub
          </Button>
        </div>

        {/* Mini Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-[#1E3A2F] bg-[#12241D]/60 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pending Signature</p>
                <p className="text-3xl font-bold mt-1 text-[#D4AF37]">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-[#D4AF37]/20" />
            </CardContent>
          </Card>
          <Card className="border-[#1E3A2F] bg-[#12241D]/60 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Completed / Signed</p>
                <p className="text-3xl font-bold mt-1 text-emerald-400">{stats.completed}</p>
              </div>
              <FileCheck2 className="h-8 w-8 text-emerald-400/20" />
            </CardContent>
          </Card>
          <Card className="border-[#1E3A2F] bg-[#12241D]/60 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Revisions Requested</p>
                <p className="text-3xl font-bold mt-1 text-red-400">{stats.revisions}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-400/20" />
            </CardContent>
          </Card>
        </div>

        {/* Document Search / Listing */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search documents by ID, title, or type..."
              className="pl-9 bg-[#12241D]/80 border-[#1E3A2F] text-white focus-visible:ring-[#D4AF37]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(doc => {
              const isCompleted = ['signed', 'completed'].includes(doc.status.toLowerCase())
              const isRevision = doc.status.toLowerCase() === 'needs revision'
              const docTokenKey = doc.token || currentToken

              return (
                <Card key={doc.id} className="group border-[#1E3A2F] bg-[#12241D]/90 text-white hover:border-[#D4AF37]/20 transition-all flex flex-col justify-between">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="rounded-lg p-2 bg-[#D4AF37]/5 border border-[#D4AF37]/20 text-[#D4AF37]">
                        <FileText className="h-5 w-5" />
                      </div>
                      {getStatusBadge(doc.status)}
                    </div>

                    <div>
                      <h3 className="font-bold text-sm tracking-wide leading-snug line-clamp-1 group-hover:text-[#D4AF37] transition-all">
                        {doc.title}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">{doc.docId}</p>
                    </div>

                    <div className="border-t border-[#1E3A2F]/60 pt-3 flex justify-between items-center text-xs">
                      <div className="text-slate-400">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500">Date Issued</p>
                        <p className="font-semibold text-slate-300 mt-0.5">{doc.date || 'TBD'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500">Document Type</p>
                        <p className="font-semibold text-slate-300 mt-0.5">{doc.type}</p>
                      </div>
                    </div>
                  </CardContent>

                  <div className="border-t border-[#1E3A2F]/60 bg-black/20 p-4 flex gap-2">
                    {isCompleted ? (() => {
                      const cacheBuster = doc.raw?.signed_at ? new Date(doc.raw.signed_at).getTime() : new Date().getTime()
                      return (
                        <Button
                          asChild
                          className="w-full h-8 text-xs font-bold bg-[#1E3A2F] border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 gap-1.5"
                        >
                          <a href={`/api/document-pdf?token=${docTokenKey}&v=${cacheBuster}`} download>
                            <Download className="h-3 w-3" /> Download Signed
                          </a>
                        </Button>
                      )
                    })() : isRevision ? (
                      <div className="w-full text-center text-xs py-1.5 text-red-400/80 bg-red-950/20 rounded-md border border-red-500/10">
                        Awaiting team revision
                      </div>
                    ) : (
                      <>
                        <Button
                          asChild
                          className="flex-1 h-8 text-xs font-bold gold-gradient text-black hover:opacity-90 gap-1"
                        >
                          <a href={`/sign/${docTokenKey}`}>
                            Sign Document <ArrowRight className="h-3 w-3" />
                          </a>
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          className="h-8 text-xs border-[#1E3A2F] text-slate-300 bg-transparent hover:bg-white/5"
                        >
                          <a href={`/api/document-pdf?token=${docTokenKey}&v=${doc.raw?.signed_at ? new Date(doc.raw.signed_at).getTime() : new Date().getTime()}`} target="_blank" rel="noreferrer">
                            Review
                          </a>
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 border border-dashed border-[#1E3A2F] rounded-xl bg-[#12241D]/20">
              <FolderOpen className="h-10 w-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-400">No client documents found</p>
              <p className="text-xs text-slate-500 mt-1">Refine your search parameters or check back later.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
