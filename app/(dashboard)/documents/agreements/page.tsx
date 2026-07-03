'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Search, Plus, Download, Trash2, Pencil, Loader2, HandshakeIcon, Send, History, Globe } from 'lucide-react'
import { formatCurrency, formatDate, getDocStatusColor, generateDocId } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { ShareDialog } from '@/components/ui/share-dialog'
import { PublishDialog } from '@/components/ui/publish-dialog'
import { useUser } from '@/components/user-provider'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { fetchFounderProfile } from '@/lib/founder-helper'
import { ClientAutocomplete } from '@/components/ui/client-autocomplete'
import { ServiceAutocomplete } from '@/components/ui/service-autocomplete'
import { getCachedData, setCachedData, invalidateCache } from '@/lib/data-cache'

const AGR_TYPES = ['Service Agreement', 'Retainer Agreement', 'NDA', 'Freelance Contract', 'Partnership Agreement']
const STATUS_OPTS = ['draft', 'sent', 'published', 'viewed', 'needs revision', 'signed', 'completed', 'expired', 'rejected']

type Agreement = {
  id: string; docId: string; client: string; contact: string; phone: string; email: string
  type: string; value: number; duration: string; services: string
  ip: string; cancellation: string; jurisdiction: string;
  status: string; created: string
  history: { date: string; action: string; canDownload?: boolean }[]
  customTerms?: string;
  published?: boolean
  published_by?: string
  published_at?: string
  viewed_at?: string
  downloaded_at?: string
  signed_at?: string
  published_version?: number
  visibility_status?: string
  ip_address?: string;
  browser?: string;
  device?: string;
  client_id?: string;
}

const INITIAL: Agreement[] = []

function compileDefaultAgreementTerms(companyDocs?: any) {
  const paymentTermsOneTime = companyDocs?.paymentTermsOneTime || '50% advance to begin, 50% balance on final delivery'
  const paymentTermsMonthly = companyDocs?.paymentTermsMonthly || 'Full monthly fee payable in advance each cycle'
  const extraTerms = companyDocs?.extraTerms || ''
  const gstRate = 18
  const lines = [
    `One-time services: ${paymentTermsOneTime}.`,
    `Monthly recurring services: ${paymentTermsMonthly}.`,
    'Hosting, domain, ad spend & third-party API fees billed at actuals.',
    `All prices are in Indian Rupees (INR). GST @ ${gstRate}% extra as applicable.`
  ]
  if (extraTerms) {
    extraTerms.split('\n').map((t: string) => t.trim()).filter(Boolean).forEach((t: string) => lines.push(t))
  }
  return lines.join('\n')
}

function getAgreementTerms(agr: Agreement | any, companyDocs?: any) {
  if (agr.customTerms) return agr.customTerms
  if (agr.custom_terms) return agr.custom_terms
  return compileDefaultAgreementTerms(companyDocs)
}

function blank(companyDocs?: any): Omit<Agreement, 'id' | 'docId' | 'created' | 'history'> {
  return { client: '', contact: '', phone: '', email: '', type: 'Service Agreement', value: 0, duration: '', services: '', ip: 'All intellectual property created during this engagement transfers to the Client upon receipt of final payment.', cancellation: '30 days written notice required from either party to terminate this agreement.', jurisdiction: 'Hyderabad, Telangana, India', status: 'draft', customTerms: compileDefaultAgreementTerms(companyDocs) }
}

export default function AgreementsPage() {
  const { user } = useUser()
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [sourceDocs, setSourceDocs] = useState<any[]>([])
  const [servicesMap, setServicesMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState<Agreement | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { toast } = useToast()
  const [generating, setGenerating] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [shareDoc, setShareDoc] = useState<{ id: string, title: string } | null>(null)
  const [historyDoc, setHistoryDoc] = useState<Agreement | null>(null)
  const [publishDoc, setPublishDoc] = useState<Agreement | null>(null)
  const [companyDocs, setCompanyDocs] = useState<any>(null)
  const [form, setForm] = useState<ReturnType<typeof blank>>(blank())

  function resetForm(agr?: Agreement | null, docs?: any) {
    if (agr) {
      setForm({
        client: agr.client,
        contact: agr.contact,
        phone: agr.phone,
        email: agr.email || '',
        type: agr.type,
        value: agr.value,
        duration: agr.duration,
        services: agr.services,
        ip: agr.ip,
        cancellation: agr.cancellation,
        jurisdiction: agr.jurisdiction,
        status: agr.status,
        customTerms: getAgreementTerms(agr, docs)
      } as any)
    } else {
      setForm({
        client: '',
        contact: '',
        phone: '',
        email: '',
        type: 'Service Agreement',
        value: 0,
        duration: '',
        services: '',
        ip: 'All intellectual property created during this engagement transfers to the Client upon receipt of final payment.',
        cancellation: '30 days written notice required from either party to terminate this agreement.',
        jurisdiction: 'Hyderabad, Telangana, India',
        status: 'draft',
        customTerms: compileDefaultAgreementTerms(docs)
      } as any)
    }
  }

  useEffect(() => {
    const cached = getCachedData<{ agreements: Agreement[], sourceDocs: any[], servicesMap: Record<string, any>, companyDocs?: any }>('agreements')
    if (cached) {
      setAgreements(cached.agreements)
      setSourceDocs(cached.sourceDocs)
      setServicesMap(cached.servicesMap)
      if (cached.companyDocs) {
        setCompanyDocs(cached.companyDocs)
        setForm(blank(cached.companyDocs))
      }
      setLoading(false)
    }

    async function loadAgreements() {
      if (!cached) setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const [aRes, qRes, iRes, svRes, cRes] = await Promise.all([
            supabase.from('agreements').select('*').order('created_at', { ascending: false }),
            supabase.from('quotations').select('*').order('created_at', { ascending: false }),
            supabase.from('invoices').select('*').order('created', { ascending: false }),
            supabase.from('services').select('id, name, deliverables'),
            supabase.from('company_settings').select('*').limit(1).maybeSingle()
          ])

          if (aRes.error) throw aRes.error

          let mappedSvMap: Record<string, any> = {}
          if (svRes.data) {
            mappedSvMap = {}
            svRes.data.forEach((s: any) => mappedSvMap[s.id] = s)
            setServicesMap(mappedSvMap)
          }

          let docsSettings = null
          if (cRes.data && cRes.data.docs) {
            docsSettings = cRes.data.docs
            setCompanyDocs(docsSettings)
            setForm(blank(docsSettings))
          }

          const docs: any[] = []
          if (qRes.data) {
            qRes.data.forEach((q: any) => docs.push({ type: 'Quotation', id: q.id, docId: q.doc_id, client: q.client, contact: q.contact, phone: q.phone, email: q.email, project: q.project_title, value: q.amount, serviceIds: q.service_ids || [] }))
          }
          if (iRes.data) {
            iRes.data.forEach((i: any) => docs.push({ type: 'Invoice', id: i.id, docId: i.doc_id, client: i.client, contact: i.contact, phone: i.phone, email: i.email, project: `Project for ${i.client}`, value: i.amount, serviceIds: i.service_ids || [] }))
          }
          setSourceDocs(docs)

          let mappedAgreements: Agreement[] = []
          if (aRes.data) {
            mappedAgreements = aRes.data.map((a: any) => ({
              id: a.id,
              docId: a.doc_id,
              client: a.client,
              contact: a.contact || '',
              phone: a.phone || '',
              email: a.email || '',
              type: a.type || '',
              value: Number(a.value) || 0,
              duration: a.duration || '',
              services: a.services || '',
              ip: a.ip || '',
              cancellation: a.cancellation || '',
              jurisdiction: a.jurisdiction || '',
              status: a.status || 'draft',
              history: Array.isArray(a.history) ? a.history : [],
              customTerms: a.custom_terms || '',
              created: a.created || a.created_at || '',
              published: a.published || false,
              published_by: a.published_by || '',
              published_at: a.published_at || '',
              viewed_at: a.viewed_at || '',
              downloaded_at: a.downloaded_at || '',
              signed_at: a.signed_at || '',
              published_version: a.published_version || 1,
              visibility_status: a.visibility_status || 'visible',
              ip_address: a.ip_address || '',
              browser: a.browser || '',
              device: a.device || '',
              client_id: a.client_id || '',
            }))
            setAgreements(mappedAgreements)
          }

          setCachedData('agreements', { agreements: mappedAgreements, sourceDocs: docs, servicesMap: mappedSvMap, companyDocs: docsSettings })
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        }
      } else {
        setAgreements(INITIAL)
        setCachedData('agreements', { agreements: INITIAL, sourceDocs: [], servicesMap: {}, companyDocs: null })
      }
      setLoading(false)
    }
    loadAgreements()
  }, [])


  // Auto-fill founder details when creating new agreement
  useEffect(() => {
    if (showCreate && !editItem && !form.contact) {
      fetchFounderProfile().then(founder => {
        if (founder) {
          setForm(prev => ({
            ...prev,
            contact: prev.contact || founder.name,
            phone: prev.phone || founder.phone
          }))
        }
      })
    }
  }, [showCreate, editItem, form.contact])

  function handleSourceDocSelect(docId: string) {
    const doc = sourceDocs.find(d => d.docId === docId)
    if (!doc) return
    
    // Build services list
    let servicesStr = ''
    if (doc.serviceIds && doc.serviceIds.length > 0) {
      doc.serviceIds.forEach((id: string) => {
        const svc = servicesMap[id]
        if (svc) {
          servicesStr += `${svc.name}\n`
        }
      })
    }

    setForm(prev => ({
      ...prev,
      client: doc.client || '',
      contact: doc.contact || '',
      phone: doc.phone || '',
      email: doc.email || '',
      value: doc.value ? Number(doc.value) : prev.value,
      services: servicesStr.trim() || prev.services
    }))
  }

  function buildContent(f: typeof form, client: string) {
    return [
      `## Agreement Details`,
      `**Agreement Type:** ${f.type}`,
      `**Client:** ${client}${f.contact ? ` (Attn: ${f.contact})` : ''}`,
      `**Duration:** ${f.duration || 'As agreed'}`,
      `**Contract Value:** ${f.value > 0 ? formatCurrency(f.value) : 'As per schedule'}`,
      '',
      '## Scope of Services',
      ...(f.services || '').split('\n').filter(Boolean).map(s => `- ${s.trim()}`),
      '',
      '## Intellectual Property',
      f.ip,
      '',
      '## Payment Schedule',
      '__PAYMENT_SCHEDULE__',
      '',
      '## Confidentiality',
      'Both parties agree to maintain strict confidentiality of all proprietary information, business processes, and client data shared during this engagement.',
      '',
      '## Cancellation Policy',
      f.cancellation,
      '',
      '## Governing Law',
      `This agreement is governed by the laws of **${f.jurisdiction}**. Any disputes shall be resolved through arbitration in ${f.jurisdiction}.`,
      '',
      '---',
      '',
      '**SIGNATURES**',
      '',
      `| __COMPANY_NAME__ | ${client} |`,
      `|---|---|`,
      '| Signature: _________________ | Signature: _________________ |',
      '| Name: __FOUNDER_NAME__ | Name: _________________ |',
      '| Date: _________________ | Date: _________________ |',
    ].join('\n')
  }

  async function downloadPdf(agr: Agreement) {
    const payload = {
      docType: 'Agreement',
      clientName: agr.contact || agr.client,
      projectTitle: `${agr.type} — ${agr.client}`,
      companyName: agr.client,
      clientInfo: { business: agr.type, mobile: agr.phone },
      content: buildContent({ ...agr, value: agr.value }, agr.client),
      items: [],
      subtotal: agr.value,
      discountTotal: 0,
      grandTotal: agr.value,
      docsSettings: {
        customTerms: agr.customTerms || getAgreementTerms(agr, companyDocs)
      }
    }
    const res = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'PDF failed') }
    const blob = await res.blob()
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `Agreement_${agr.docId}_${agr.client.replace(/\s+/g, '_')}.pdf`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  async function handleDownload(agr: Agreement) {
    setDownloadingId(agr.id)
    try { await downloadPdf(agr); toast({ title: `✅ ${agr.docId} downloaded` }) }
    catch (e: any) { toast({ title: 'Download failed', description: e.message, variant: 'destructive' }) }
    finally { setDownloadingId(null) }
  }

  async function handleGenerate() {
    if (!form.client) { toast({ title: 'Client name required', variant: 'destructive' }); return }
    setGenerating(true)
    try {
      const docId = generateDocId('NG-AGR')
      const targetId = String(Date.now())
      const targetCreated = new Date().toISOString().slice(0, 10)
      const targetHistory = [{ date: new Date().toISOString().split('T')[0], action: 'Document generated' }]
      const newAgr: Agreement = { id: targetId, docId, ...form, created: targetCreated, history: targetHistory }

      await downloadPdf(newAgr)

      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('agreements').insert([{
          id: targetId,
          doc_id: docId,
          client: form.client,
          contact: form.contact,
          phone: form.phone,
          email: (form as any).email || '',
          type: form.type,
          value: form.value,
          duration: form.duration,
          services: form.services,
          ip: form.ip,
          cancellation: form.cancellation,
          jurisdiction: form.jurisdiction,
          status: form.status,
          created: targetCreated,
          history: targetHistory,
          custom_terms: form.customTerms
        }])
        if (error) {
          toast({ title: 'Error saving to database', description: error.message, variant: 'destructive' })
          setGenerating(false)
          return
        }
      }

      const updatedList = [newAgr, ...agreements]
      setAgreements(updatedList)
      setCachedData('agreements', { agreements: updatedList, sourceDocs, servicesMap, companyDocs })
      invalidateCache('dashboard')
      setShowCreate(false); resetForm(null, companyDocs)
      toast({ title: '✅ Agreement Generated!', description: `${docId} downloaded.` })
    } catch (e: any) { toast({ title: 'PDF Error', description: e.message, variant: 'destructive' }) }
    finally { setGenerating(false) }
  }


  async function handleSaveEdit() {
    if (!editItem) return
    const targetHistory = [...editItem.history, { date: new Date().toISOString().split('T')[0], action: 'Document updated' }]
    const updated: Agreement = { ...editItem, ...form, history: targetHistory }

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('agreements').update({
          client: form.client,
          contact: form.contact,
          phone: form.phone,
          email: (form as any).email || '',
          type: form.type,
          value: form.value,
          duration: form.duration,
          services: form.services,
          ip: form.ip,
          cancellation: form.cancellation,
          jurisdiction: form.jurisdiction,
          status: form.status,
          history: targetHistory,
          custom_terms: form.customTerms
        }).eq('id', editItem.id)

        if (error) {
          toast({ title: 'Error saving edit to database', description: error.message, variant: 'destructive' })
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        return
      }
    }

    const updatedList = agreements.map(a => a.id === editItem.id ? updated : a)
    setAgreements(updatedList)
    setCachedData('agreements', { agreements: updatedList, sourceDocs, servicesMap, companyDocs })
    invalidateCache('dashboard')
    setEditItem(null); resetForm(null, companyDocs)
    toast({ title: '✅ Agreement updated' })
  }


  async function handleDelete() {
    if (!deleteId) return
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('agreements').delete().eq('id', deleteId)
        if (error) {
          toast({ title: 'Error deleting agreement', description: error.message, variant: 'destructive' })
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        return
      }
    }
    const updatedList = agreements.filter(a => a.id !== deleteId)
    setAgreements(updatedList)
    setCachedData('agreements', { agreements: updatedList, sourceDocs, servicesMap })
    invalidateCache('dashboard')
    setDeleteId(null)
    toast({ title: 'Agreement deleted' })
  }


  async function updateStatus(id: string, status: string) {
    const targetAgr = agreements.find(a => a.id === id)
    if (!targetAgr) return
    const targetHistory = [...targetAgr.history, { date: new Date().toISOString().split('T')[0], action: `Status changed to ${status}` }]

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('agreements').update({
          status,
          history: targetHistory
        }).eq('id', id)
        if (error) {
          toast({ title: 'Error updating status', description: error.message, variant: 'destructive' })
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        return
      }
    }

    const updatedList = agreements.map(a => a.id === id ? { ...a, status, history: targetHistory } : a)
    setAgreements(updatedList)
    setCachedData('agreements', { agreements: updatedList, sourceDocs, servicesMap, companyDocs })
    invalidateCache('dashboard')
  }

  async function handlePublishAction(action: 'publish' | 'unpublish' | 'hide' | 'republish' | 'replace' | 'show') {
    if (!publishDoc) return
    const id = publishDoc.id
    
    if (user?.role === 'Employee') {
      throw new Error("Permission Denied: Employees cannot publish documents. Please request publication from a Founder or Admin.")
    }

    let updates: any = {}
    let logMessage = ''
    const nextVer = (publishDoc.published_version || 1) + 1

    if (action === 'publish') {
      updates = {
        published: true,
        published_by: user?.email || 'Founder/Admin',
        published_at: new Date().toISOString(),
        visibility_status: 'visible',
        status: 'published',
        published_version: 1
      }
      logMessage = 'Document published to Client Portal'
    } else if (action === 'unpublish') {
      updates = {
        published: false,
        published_by: null,
        published_at: null,
        status: 'signed'
      }
      logMessage = 'Document unpublished from Client Portal'
    } else if (action === 'hide') {
      updates = {
        visibility_status: 'hidden'
      }
      logMessage = 'Document hidden from Client Portal'
    } else if (action === 'show') {
      updates = {
        visibility_status: 'visible'
      }
      logMessage = 'Document made visible in Client Portal'
    } else if (action === 'republish') {
      updates = {
        published: true,
        published_by: user?.email || 'Founder/Admin',
        published_at: new Date().toISOString(),
        visibility_status: 'visible',
        published_version: nextVer,
        status: 'published'
      }
      logMessage = `Document republished (Version ${nextVer})`
    } else if (action === 'replace') {
      updates = {
        published: true,
        published_by: user?.email || 'Founder/Admin',
        published_at: new Date().toISOString(),
        visibility_status: 'visible',
        status: 'published'
      }
      logMessage = 'Document replaced with updated version'
    }

    const updatedHistory = [
      ...(publishDoc.history || []),
      { date: new Date().toISOString().split('T')[0], action: logMessage }
    ]
    updates.history = updatedHistory

    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('agreements')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    }

    const updatedList = agreements.map(a => a.id === id ? { ...a, ...updates } : a)
    setAgreements(updatedList)
    setCachedData('agreements', { agreements: updatedList, sourceDocs, servicesMap, companyDocs })
    invalidateCache('dashboard')
  }


  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight">Client Agreements</h1><p className="text-muted-foreground text-sm mt-0.5">Generate legally structured client agreements.</p></div>
        <Button variant="gold" size="sm" onClick={() => { resetForm(null, companyDocs); setShowCreate(true) }} className="gap-1.5 w-full sm:w-auto"><Plus className="h-4 w-4" />New Agreement</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ l: 'Total', v: agreements.length }, { l: 'Signed', v: agreements.filter(a => a.status === 'signed').length }, { l: 'Draft', v: agreements.filter(a => a.status === 'draft').length }, { l: 'Sent', v: agreements.filter(a => a.status === 'sent').length }].map(s => (
          <Card key={s.l}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.l}</p><p className="text-2xl font-bold mt-1">{s.v}</p></CardContent></Card>
        ))}
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search agreements..." value={search} onChange={e => setSearch(e.target.value)} /></div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">{['Doc ID','Client','Type','Value','Status','Date','Actions'].map(h => <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {agreements.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground"><HandshakeIcon className="h-8 w-8 mx-auto mb-2 opacity-30" /><p>No agreements yet</p></td></tr>}
              {agreements.filter(a => a.client.toLowerCase().includes(search.toLowerCase())).map(a => (
                <tr key={a.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs text-gold">{a.docId}</span>
                    {a.published ? (
                      <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                        <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded border ${a.visibility_status === 'hidden' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`} title={a.visibility_status === 'hidden' ? 'Hidden from Client Portal' : 'Published to Client Portal'}>
                          <Globe className="h-2.5 w-2.5" />
                          {a.visibility_status === 'hidden' ? 'Hidden' : `V${a.published_version || 1}`}
                        </span>
                        {a.viewed_at && <span className="text-blue-400 font-medium border border-blue-500/20 bg-blue-500/5 px-1 py-0.5 rounded" title={`Viewed at ${formatDate(a.viewed_at)}`}>Viewed</span>}
                        {a.downloaded_at && <span className="text-green-400 font-medium border border-green-500/20 bg-green-500/5 px-1 py-0.5 rounded" title={`Downloaded at ${formatDate(a.downloaded_at)}`}>DL</span>}
                        {a.signed_at && <span className="text-emerald-400 font-medium border border-emerald-500/20 bg-emerald-500/5 px-1 py-0.5 rounded" title={`Signed at ${formatDate(a.signed_at)}`}>Signed</span>}
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted-foreground/50 mt-1">Not Published</div>
                    )}
                  </td>
                  <td className="py-3 px-4"><p className="font-medium">{a.client}</p><p className="text-xs text-muted-foreground">{a.contact}</p></td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{a.type}</td>
                  <td className="py-3 px-4 font-semibold text-gold">{a.value > 0 ? formatCurrency(a.value) : '—'}</td>
                  <td className="py-3 px-4">
                    <Select value={a.status} onValueChange={v => updateStatus(a.id, v)}>
                      <SelectTrigger className={`h-7 w-28 text-xs border ${getDocStatusColor(a.status)}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_OPTS.map(s => <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{formatDate(a.created)}</td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="History" onClick={() => setHistoryDoc(a)}><History className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Download" onClick={() => handleDownload(a)} disabled={downloadingId === a.id}>
                        {downloadingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-400 hover:text-blue-400" title="Edit" onClick={() => { setEditItem(a); resetForm(a, companyDocs) }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className={`h-7 w-7 ${a.published ? 'text-purple-400 hover:text-purple-300' : 'text-muted-foreground hover:text-gold'}`} title="Publish to Client Portal" onClick={() => setPublishDoc(a)}>
                        <Globe className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-400 hover:text-emerald-400" title="Send to client" onClick={() => setShareDoc({ id: a.id, title: `${a.docId} - ${a.client}` })}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-400" title="Delete" onClick={() => setDeleteId(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={showCreate} onOpenChange={v => { setShowCreate(v); if (!v) setForm(blank()) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Generate Client Agreement</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            {!editItem && sourceDocs.length > 0 && (
              <div className="bg-muted/30 p-4 rounded-lg border border-border">
                <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Convert from Document</p>
                <div className="space-y-1">
                  <Label>Source Quotation or Invoice</Label>
                  <Select onValueChange={handleSourceDocSelect}>
                    <SelectTrigger><SelectValue placeholder="Select a document to auto-fill details..." /></SelectTrigger>
                    <SelectContent>
                      {sourceDocs.map(d => (
                        <SelectItem key={d.docId} value={d.docId}>
                          {d.docId} - {d.client} ({d.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Automatically fills client details, contract value, and services covered.</p>
                </div>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Agreement Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Client Company *</Label>
                  <ClientAutocomplete
                    placeholder="Company name"
                    value={form.client}
                    onChange={v => setForm({ ...form, client: v })}
                    onSelect={client => setForm({
                      ...form,
                      client: client.business || client.name,
                      contact: client.name,
                      phone: client.phone || ''
                    })}
                  />
                </div>
                <div className="space-y-1"><Label>Contact Person</Label><Input placeholder="Representative name" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></div>
                <div className="space-y-1"><Label>Agreement Type</Label>
                  <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AGR_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Contract Value (₹)</Label><Input type="number" placeholder="149999" value={form.value || ''} onChange={e => setForm({ ...form, value: Number(e.target.value) })} /></div>
                <div className="space-y-1"><Label>Duration</Label><Input placeholder="e.g. 6 months, 12 months" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} /></div>
                <div className="space-y-1"><Label>Phone</Label><Input placeholder="Client phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="space-y-1"><Label>Client Email</Label><Input type="email" placeholder="client@company.com" value={(form as any).email || ''} onChange={e => setForm({ ...form, email: e.target.value } as any)} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <Label>Search & Add Service to Scope</Label>
                  <ServiceAutocomplete
                    placeholder="Search for a service to add to scope..."
                    onSelect={(svc) => {
                      setForm(prev => ({
                        ...prev,
                        services: prev.services ? `${prev.services}\n${svc.name}` : svc.name
                      }))
                      toast({ title: `${svc.name} added to scope` })
                    }}
                  />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Services Covered (one per line)</Label><Textarea className="h-20 resize-none" placeholder="CRM Setup & Automation&#10;Social Media Management&#10;Meta Ads Management" value={form.services} onChange={e => setForm({ ...form, services: e.target.value })} /></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Legal Clauses</p>
              <div className="space-y-3">
                <div className="space-y-1"><Label>IP Ownership</Label><Textarea className="h-14 resize-none" value={form.ip} onChange={e => setForm({ ...form, ip: e.target.value })} /></div>
                <div className="space-y-1"><Label>Cancellation Policy</Label><Textarea className="h-14 resize-none" value={form.cancellation} onChange={e => setForm({ ...form, cancellation: e.target.value })} /></div>
                <div className="space-y-1"><Label>Jurisdiction</Label><Input value={form.jurisdiction} onChange={e => setForm({ ...form, jurisdiction: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label>Terms & Conditions Bottom Block (One per line)</Label>
                  <Textarea className="h-28 font-mono text-xs" placeholder="Enter each term on a new line..." value={form.customTerms} onChange={e => setForm({ ...form, customTerms: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setForm(blank()) }}>Cancel</Button>
            <Button variant="gold" onClick={handleGenerate} disabled={generating}>{generating ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />Generating...</> : 'Generate Agreement PDF'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={v => { if (!v) { setEditItem(null); setForm(blank()) } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Agreement — {editItem?.docId}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Agreement Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Client Company *</Label>
                  <ClientAutocomplete
                    placeholder="Company name"
                    value={form.client}
                    onChange={v => setForm({ ...form, client: v })}
                    onSelect={client => setForm({
                      ...form,
                      client: client.business || client.name,
                      contact: client.name,
                      phone: client.phone || ''
                    })}
                  />
                </div>
                <div className="space-y-1"><Label>Contact Person</Label><Input placeholder="Representative name" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></div>
                <div className="space-y-1"><Label>Agreement Type</Label>
                  <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AGR_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Contract Value (₹)</Label><Input type="number" placeholder="149999" value={form.value || ''} onChange={e => setForm({ ...form, value: Number(e.target.value) })} /></div>
                <div className="space-y-1"><Label>Duration</Label><Input placeholder="e.g. 6 months, 12 months" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} /></div>
                <div className="space-y-1"><Label>Phone</Label><Input placeholder="Client phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="space-y-1"><Label>Client Email</Label><Input type="email" placeholder="client@company.com" value={(form as any).email || ''} onChange={e => setForm({ ...form, email: e.target.value } as any)} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <Label>Search & Add Service to Scope</Label>
                  <ServiceAutocomplete
                    placeholder="Search for a service to add to scope..."
                    onSelect={(svc) => {
                      setForm(prev => ({
                        ...prev,
                        services: prev.services ? `${prev.services}\n${svc.name}` : svc.name
                      }))
                      toast({ title: `${svc.name} added to scope` })
                    }}
                  />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Services Covered (one per line)</Label><Textarea className="h-20 resize-none" placeholder="CRM Setup & Automation&#10;Social Media Management&#10;Meta Ads Management" value={form.services} onChange={e => setForm({ ...form, services: e.target.value })} /></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Legal Clauses</p>
              <div className="space-y-3">
                <div className="space-y-1"><Label>IP Ownership</Label><Textarea className="h-14 resize-none" value={form.ip} onChange={e => setForm({ ...form, ip: e.target.value })} /></div>
                <div className="space-y-1"><Label>Cancellation Policy</Label><Textarea className="h-14 resize-none" value={form.cancellation} onChange={e => setForm({ ...form, cancellation: e.target.value })} /></div>
                <div className="space-y-1"><Label>Jurisdiction</Label><Input value={form.jurisdiction} onChange={e => setForm({ ...form, jurisdiction: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label>Terms & Conditions Bottom Block (One per line)</Label>
                  <Textarea className="h-28 font-mono text-xs" placeholder="Enter each term on a new line..." value={form.customTerms} onChange={e => setForm({ ...form, customTerms: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditItem(null); setForm(blank()) }}>Cancel</Button>
            <Button variant="gold" onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Agreement?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!historyDoc} onOpenChange={(open) => !open && setHistoryDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="border-b border-white/10 pb-3">
            <DialogTitle>Document History — {historyDoc?.docId}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">{historyDoc?.client} · Click any entry to download that version</p>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-[50vh] overflow-y-auto">
            {historyDoc?.history.slice().reverse().map((h, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${h.canDownload ? 'border-border hover:border-gold/30 hover:bg-gold/5 cursor-pointer group' : 'border-transparent bg-muted/20 cursor-default'}`}
                onClick={() => { if (h.canDownload && historyDoc) handleDownload(historyDoc) }}
              >
                <div className="flex-1 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-gold/50 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{h.action}</p>
                    <p className="text-xs text-muted-foreground">{h.date}</p>
                  </div>
                </div>
                {h.canDownload && (
                  <Button variant="ghost" size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-gold hover:text-gold hover:bg-gold/10"
                    disabled={downloadingId === historyDoc?.id}
                    onClick={(e) => { e.stopPropagation(); if (historyDoc) handleDownload(historyDoc) }}
                    title="Download this version"
                  >
                    {downloadingId === historyDoc?.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="border-t border-white/10 pt-3">
            <Button variant="outline" size="sm" onClick={() => setHistoryDoc(null)}>Close</Button>
            <Button variant="gold" size="sm" onClick={() => historyDoc && handleDownload(historyDoc)} disabled={downloadingId === historyDoc?.id} className="gap-1.5">
              {downloadingId === historyDoc?.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Download Latest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShareDialog
        open={!!shareDoc}
        onOpenChange={(open) => !open && setShareDoc(null)}
        title={shareDoc?.title || ''}
        initialEmail={shareDoc ? agreements.find(a => a.id === shareDoc.id)?.email || '' : ''}
        initialSubject={shareDoc ? `${agreements.find(a => a.id === shareDoc.id)?.type}: ${agreements.find(a => a.id === shareDoc.id)?.docId} — ${agreements.find(a => a.id === shareDoc.id)?.client}` : ''}
        initialMessage={shareDoc ? (() => {
          const agr = agreements.find(a => a.id === shareDoc.id)
          if (!agr) return ''
          return `Dear ${agr.client},\n\nPlease find attached the ${agr.type} document ${agr.docId}.\n\nContract Value: ${formatCurrency(agr.value)}\nDuration: ${agr.duration || 'As agreed'}\n\nKindly review, sign, and return at your earliest convenience.\n\nBest regards,\nNetgain Team`
        })() : ''}
        onSend={async (methods, emailDetails) => {
          if (!shareDoc) return

          const agr = agreements.find(a => a.id === shareDoc.id)
          if (!agr) throw new Error('Agreement not found')

          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.access_token
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          if (token) headers['Authorization'] = `Bearer ${token}`

          for (const method of methods) {
            let recipient = ''
            let message = ''
            let subject = ''
            let pdfPayload: any = undefined

            if (method === 'email') {
              recipient = emailDetails?.recipient || agr.email || ''
              subject = emailDetails?.subject || `${agr.type}: ${agr.docId} — ${agr.client}`
              message = emailDetails?.message || `Dear ${agr.client},\n\nPlease find attached the ${agr.type} document ${agr.docId}.\n\nContract Value: ${formatCurrency(agr.value)}\nDuration: ${agr.duration || 'As agreed'}\n\nKindly review, sign, and return at your earliest convenience.\n\nBest regards,\nNetgain Team`
              
              // Generate matching PDF payload on the fly
              pdfPayload = {
                docType: 'Agreement',
                clientName: agr.contact || agr.client,
                projectTitle: `${agr.type} — ${agr.client}`,
                companyName: agr.client,
                clientInfo: { business: agr.type, mobile: agr.phone },
                content: buildContent({ ...agr, value: agr.value }, agr.client),
                items: [],
                subtotal: agr.value,
                discountTotal: 0,
                grandTotal: agr.value,
                docsSettings: {
                  customTerms: agr.customTerms || getAgreementTerms(agr, companyDocs)
                }
              }
            } else if (method === 'whatsapp' || method === 'sms') {
              recipient = agr.phone
              message = `Dear ${agr.client}, your ${agr.type} ${agr.docId} (${formatCurrency(agr.value)}) is ready for review and signature. — Netgain Team`
            }

            if (!recipient) {
              throw new Error(`No ${method === 'email' ? 'email address' : 'phone number'} found for this client. Please edit the agreement to add contact details.`)
            }

            const res = await fetch('/api/meetings/send', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                channel: method,
                recipient,
                message,
                subject: method === 'email' ? subject : undefined,
                pdfPayload
              })
            })

            if (!res.ok) {
              const err = await res.json()
              throw new Error(err.error || `Failed to send via ${method}`)
            }
          }

          updateStatus(shareDoc.id, 'sent')
        }}
      />

      <PublishDialog
        open={!!publishDoc}
        onOpenChange={(open) => !open && setPublishDoc(null)}
        docTitle={publishDoc?.type || publishDoc?.docId || ''}
        docId={publishDoc?.docId || ''}
        isPublished={!!publishDoc?.published}
        visibilityStatus={publishDoc?.visibility_status || 'visible'}
        currentVersion={publishDoc?.published_version || 1}
        onAction={handlePublishAction}
      />
    </div>
  )
}
