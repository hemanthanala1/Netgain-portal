'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { DataTable } from '@/components/ui/data-table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { Drawer } from '@/components/ui/drawer'
import { DeleteDialog } from '@/components/ui/dialog-variants'
import { EmptyState } from '@/components/ui/empty-state'
import { Search, Plus, Download, Send, Trash2, Pencil, Loader2, FileText, History, Globe, MoreHorizontal, Eye, HandshakeIcon } from 'lucide-react'
import { DocumentPreviewModal } from '@/components/ui/document-preview-modal'
import { formatCurrency, formatDate, getDocStatusColor, generateDocId } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { ShareDialog } from '@/components/ui/share-dialog'
import { PublishDialog } from '@/components/ui/publish-dialog'
import { UniversalTimeline } from '@/components/ui/version-timeline'
import { useUser } from '@/components/user-provider'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { fetchFounderProfile } from '@/lib/founder-helper'
import { ClientAutocomplete } from '@/components/ui/client-autocomplete'
import { ServiceAutocomplete } from '@/components/ui/service-autocomplete'
import { getCachedData, setCachedData, invalidateCache } from '@/lib/data-cache'
import { LineItemsTable } from '@/components/ui/line-items-table'
import { TemplateSelector, type TemplateId } from '@/components/ui/template-selector'
import { LivePreviewPanel } from '@/components/ui/live-preview-panel'

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
  items?: any[];
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

function blank(companyDocs?: any): Omit<Agreement, 'id' | 'docId' | 'created' | 'history'> & { items: any[] } {
  return { client: '', contact: '', phone: '', email: '', type: 'Service Agreement', value: 0, duration: '', services: '', ip: 'All intellectual property created during this engagement transfers to the Client upon receipt of final payment.', cancellation: '30 days written notice required from either party to terminate this agreement.', jurisdiction: 'Hyderabad, Telangana, India', status: 'draft', customTerms: compileDefaultAgreementTerms(companyDocs), items: [] }
}

function AgreementsPageContent() {
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
  const [previewDoc, setPreviewDoc] = useState<Agreement | null>(null)
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [templateId, setTemplateId] = useState<TemplateId>('modern')
  const [showPreviewPanel, setShowPreviewPanel] = useState(false)
  
  const [shareDoc, setShareDoc] = useState<{ id: string, title: string } | null>(null)
  const [historyDoc, setHistoryDoc] = useState<Agreement | null>(null)
  const [publishDoc, setPublishDoc] = useState<Agreement | null>(null)
  const [companyDocs, setCompanyDocs] = useState<any>(null)

  useEffect(() => {
    if (companyDocs?.defaultTemplateId) {
      setTemplateId(companyDocs.defaultTemplateId)
    }
  }, [companyDocs])
  const [form, setForm] = useState<ReturnType<typeof blank>>(blank())

  const searchParams = useSearchParams()

  const columns = useMemo(() => [
    {
      header: 'Doc ID',
      accessor: 'docId',
      sortable: true,
      sticky: true,
      cell: (a: Agreement) => (
        <div>
          <span className="font-mono text-xs text-gold font-bold">{a.docId}</span>
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
          {a.status === 'needs revision' && (
            <div className="mt-1.5 text-[10px] bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 text-amber-400 font-semibold flex items-center gap-1">
              ⚠ Client requested changes
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Client',
      accessor: 'client',
      sortable: true,
      cell: (a: Agreement) => (
        <div>
          <a href={`/crm?search=${encodeURIComponent(a.client)}`} className="font-medium text-xs text-foreground hover:text-gold transition-colors hover:underline decoration-dotted">
            {a.client}
          </a>
          <p className="text-[10px] text-muted-foreground">{a.contact}</p>
        </div>
      )
    },
    {
      header: 'Type',
      accessor: 'type',
      sortable: true,
      cell: (a: Agreement) => <span className="text-xs text-muted-foreground max-w-[200px] truncate">{a.type}</span>
    },
    {
      header: 'Value',
      accessor: 'value',
      sortable: true,
      cell: (a: Agreement) => <span className="font-semibold text-gold text-xs">{a.value > 0 ? formatCurrency(a.value) : '-'}</span>
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      cell: (a: Agreement) => (
        <div onClick={e => e.stopPropagation()}>
          <Select value={a.status} onValueChange={v => updateStatus(a.id, v)}>
            <SelectTrigger className={`h-7 w-28 text-xs border ${getDocStatusColor(a.status)}`}><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_OPTS.map(o => <SelectItem key={o} value={o} className="text-xs capitalize">{o}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )
    },
    {
      header: 'Created',
      accessor: 'created',
      sortable: true,
      cell: (a: Agreement) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(a.created)}</span>
    },
    {
      header: 'Actions',
      accessor: 'actions',
      className: 'text-right',
      cell: (a: Agreement) => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border-border">
              <DropdownMenuItem onClick={() => setHistoryDoc(a)} className="cursor-pointer gap-2">
                <History className="h-4 w-4" /> History
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePreview(a)} className="cursor-pointer gap-2 text-blue-400 focus:text-blue-400">
                <Eye className="h-4 w-4" /> Preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownload(a)} disabled={downloadingId === a.id} className="cursor-pointer gap-2">
                {downloadingId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setEditItem(a); resetForm(a, companyDocs); setShowCreate(true); }} className="cursor-pointer gap-2 text-blue-400 focus:text-blue-400">
                <Pencil className="h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPublishDoc(a)} className={`cursor-pointer gap-2 ${a.published ? 'text-purple-400 focus:text-purple-400' : ''}`}>
                <Globe className="h-4 w-4" /> Publish to Client Portal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShareDoc({ id: a.id, title: `${a.docId} - ${a.client}` })} className="cursor-pointer gap-2 text-emerald-400 focus:text-emerald-400">
                <Send className="h-4 w-4" /> Send to client
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeleteId(a.id)} className="cursor-pointer gap-2 text-red-400 focus:text-red-400 focus:bg-red-400/10">
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    }
  ], [downloadingId, companyDocs])

  const handleBulkAction = async (action: string, selectedRows: Agreement[]) => {
    if (action === 'delete') {
      if (!window.confirm(`Are you sure you want to delete ${selectedRows.length} agreements?`)) return
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const ids = selectedRows.map(r => r.id)
          const { error } = await supabase.from('agreements').delete().in('id', ids)
          if (error) {
            toast({ title: 'Error deleting agreements', description: error.message, variant: 'destructive' })
            setLoading(false)
            return
          }
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
          setLoading(false)
          return
        }
      }
      const idsSet = new Set(selectedRows.map(r => r.id))
      const updatedList = agreements.filter(a => !idsSet.has(a.id))
      setAgreements(updatedList)
      setCachedData('agreements', { agreements: updatedList, sourceDocs, servicesMap, companyDocs })
      invalidateCache('dashboard')
      toast({ title: 'Agreements Deleted', description: `${selectedRows.length} agreements have been deleted.` })
      setLoading(false)
    } else if (action.startsWith('status_')) {
      const newStatus = action.replace('status_', '')
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const ids = selectedRows.map(r => r.id)
          const { error } = await supabase.from('agreements').update({ status: newStatus }).in('id', ids)
          if (error) {
            toast({ title: 'Error updating status', description: error.message, variant: 'destructive' })
            setLoading(false)
            return
          }
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
          setLoading(false)
          return
        }
      }
      const idsSet = new Set(selectedRows.map(a => a.id))
      const updatedList = agreements.map(a => idsSet.has(a.id) ? { ...a, status: newStatus } : a)
      setAgreements(updatedList)
      setCachedData('agreements', { agreements: updatedList, sourceDocs, servicesMap, companyDocs })
      invalidateCache('dashboard')
      toast({ title: 'Status Updated', description: `${selectedRows.length} agreements marked as ${newStatus}.` })
      setLoading(false)
    }
  }

  useEffect(() => {
    const clientId = searchParams.get('clientId') || searchParams.get('prefill_client_id')
    const autoOpen = searchParams.get('autoOpen') || searchParams.get('prefill')

    if (clientId && autoOpen === 'true') {
      const fetchClient = async () => {
        if (isSupabaseConfigured()) {
          const { data: client, error } = await supabase
            .from('crm_clients')
            .select('*')
            .eq('id', clientId)
            .maybeSingle()
          if (client) {
            setForm(prev => ({
              ...prev,
              client: client.business || client.name,
              contact: client.name,
              phone: client.phone || '',
              email: client.email || ''
            }))
            setShowCreate(true)
            const newUrl = window.location.pathname
            window.history.replaceState({}, '', newUrl)
          }
        }
      }
      fetchClient()
    }
  }, [searchParams])

  useEffect(() => {
    const q = searchParams.get('search') || searchParams.get('client')
    if (q) setSearch(q)
  }, [searchParams])

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
        customTerms: getAgreementTerms(agr, docs),
        items: agr.items || []
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
        customTerms: compileDefaultAgreementTerms(docs),
        items: [] as any[]
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
            supabase.from('agreements').select('*, agreement_items(*)').order('created_at', { ascending: false }),
            supabase.from('quotations').select('*').order('created_at', { ascending: false }),
            supabase.from('invoices').select('*').order('created', { ascending: false }),
            supabase.from('services').select('id, name, deliverables').eq('status', 'active'),
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
              items: a.agreement_items || []
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

  function buildContent(f: typeof form | any, client: string, calculatedValue: number, servicesStr: string) {
    const parts = [
      `## Agreement Details`,
      `**Agreement Type:** ${f.type}`,
      `**Client Name:** ${f.contact || '-'}`,
      `**Business Name:** ${client}`,
      f.phone ? `**Phone:** ${f.phone}` : '',
      f.email ? `**Email:** ${f.email}` : '',
      `**Contract Value:** ${calculatedValue > 0 ? formatCurrency(calculatedValue) : '-'}`,
      f.duration ? `**Duration:** ${f.duration}` : '',
    ].filter(Boolean)

    if (servicesStr && servicesStr.trim()) {
      const cleanSvc = servicesStr.split('\n').filter(Boolean).map(s => s.trim().startsWith('-') || s.trim().startsWith('•') ? s : `- ${s.trim()}`).join('\n')
      parts.push('## Scope of Services', cleanSvc)
    }

    if (f.ip && f.ip.trim()) {
      parts.push('## Intellectual Property', f.ip)
    }

    parts.push('## Payment Schedule', '__PAYMENT_SCHEDULE__')

    parts.push(
      '## Confidentiality',
      'Both parties agree to maintain strict confidentiality of all proprietary information, business processes, and client data shared during this engagement.'
    )

    if (f.cancellation && f.cancellation.trim()) {
      parts.push('## Cancellation Policy', f.cancellation)
    }

    if (f.jurisdiction && f.jurisdiction.trim()) {
      parts.push(
        '## Governing Law',
        `This agreement is governed by the laws of **${f.jurisdiction}**. Any disputes shall be resolved through arbitration in ${f.jurisdiction}.`
      )
    }

    return parts.join('\n\n')
  }

  async function downloadPdf(agr: Agreement, forceClientSide = false, isPreview = false) {
    if ((agr.status === 'signed' || agr.status === 'completed' || agr.signed_at) && !forceClientSide) {
      const cacheBuster = agr.signed_at ? new Date(agr.signed_at).getTime() : new Date().getTime()
      const res = await fetch(`/api/document-pdf?id=${agr.id}&type=Agreement&v=${cacheBuster}`)
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'PDF failed') }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (isPreview) return url
      const a = document.createElement('a'); a.href = url
      a.download = `Agreement_${agr.docId}_${agr.client.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      return url
    }

    let sub = Number(agr.value) || 0
    let dAmt = 0
    let tot = Number(agr.value) || 0
    let pdfItems: any[] = []
    let servicesStr = agr.services || ''

    if (agr.items && agr.items.length > 0) {
      sub = agr.items.reduce((sum: number, item: any) => sum + (Number(item.unit_price) * Number(item.quantity)), 0)
      const lineDisc = agr.items.reduce((sum: number, item: any) => sum + Number(item.discount), 0)
      dAmt = lineDisc
      const lineTax = agr.items.reduce((sum: number, item: any) => sum + Math.round((((Number(item.unit_price) * Number(item.quantity)) - Number(item.discount)) * (Number(item.tax) / 100)) * 100) / 100, 0)
      tot = (sub - dAmt) + lineTax

      servicesStr = agr.items.map((item: any) => `**${item.service_name}**\n${item.description || ''}`).join('\n\n')
      pdfItems = agr.items.map((item: any) => ({
        serviceName: item.service_name,
        finalPrice: item.total,
        price: item.unit_price,
        quantity: item.quantity,
        category: 'Service',
        pricing_model: 'fixed',
        deliverables: item.description ? item.description.split('\n') : []
      }))
    }

    const payload = {
      docType: 'Agreement',
      templateId,
      clientName: agr.contact || agr.client,
      projectTitle: `${agr.type} - ${agr.client}`,
      companyName: agr.client,
      clientInfo: { business: agr.type, mobile: agr.phone },
      content: buildContent({ ...agr, value: tot }, agr.client, tot, servicesStr),
      items: pdfItems,
      subtotal: sub,
      discountTotal: dAmt,
      grandTotal: tot,
      docsSettings: {
        customTerms: agr.customTerms || getAgreementTerms(agr, companyDocs)
      }
    }
    const res = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'PDF failed') }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    if (isPreview) return url
    const a = document.createElement('a'); a.href = url
    a.download = `Agreement_${agr.docId}_${agr.client.replace(/\s+/g, '_')}.pdf`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return url
  }

  async function handlePreview(agr: Agreement) {
    setPreviewDoc(agr)
    setPreviewLoading(true)
    setPreviewBlobUrl(null)
    try {
      const url = await downloadPdf(agr, false, true)
      if (url) setPreviewBlobUrl(url as string)
    } catch (e: any) {
      toast({ title: 'Preview failed', description: e.message, variant: 'destructive' })
      setPreviewDoc(null)
    } finally {
      setPreviewLoading(false)
    }
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

      const lineSubtotal = form.items && form.items.length > 0
        ? form.items.reduce((sum: number, item: any) => sum + (Number(item.unit_price) * Number(item.quantity)), 0)
        : Number(form.value) || 0
      const lineDiscount = form.items && form.items.length > 0
        ? form.items.reduce((sum: number, item: any) => sum + Number(item.discount), 0)
        : 0
      const lineTax = form.items && form.items.length > 0
        ? form.items.reduce((sum: number, item: any) => sum + Math.round((((Number(item.unit_price) * Number(item.quantity)) - Number(item.discount)) * (Number(item.tax) / 100)) * 100) / 100, 0)
        : 0
      const calculatedValue = (lineSubtotal - lineDiscount) + lineTax

      const newAgr: Agreement = { 
        id: targetId, 
        docId, 
        ...form, 
        value: calculatedValue, 
        created: targetCreated, 
        history: targetHistory,
        items: form.items || []
      }

      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('agreements').insert([{
          id: targetId,
          doc_id: docId,
          client: form.client,
          contact: form.contact,
          phone: form.phone,
          email: (form as any).email || '',
          type: form.type,
          value: calculatedValue,
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

        if (form.items && form.items.length > 0) {
          const { error: itemsErr } = await supabase.from('agreement_items').insert(
            form.items.map((item, idx) => ({
              agreement_id: targetId,
              service_id: item.service_id || null,
              service_name: item.service_name,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount: item.discount,
              tax: item.tax,
              total: item.total,
              sort_order: idx
            }))
          )
          if (itemsErr) {
            toast({ title: 'Error saving agreement items', description: itemsErr.message, variant: 'destructive' })
          }
        }
      }

      const updatedList = [newAgr, ...agreements]
      setAgreements(updatedList)
      setCachedData('agreements', { agreements: updatedList, sourceDocs, servicesMap, companyDocs })
      invalidateCache('dashboard')
      setShowCreate(false); resetForm(null, companyDocs)
      toast({ title: '✅ Agreement Generated!', description: `${docId} saved. Use Actions → Download to get the PDF.` })
    } catch (e: any) { toast({ title: 'PDF Error', description: e.message, variant: 'destructive' }) }
    finally { setGenerating(false) }
  }


  async function handleSaveEdit() {
    if (!editItem) return
    const targetHistory = [...editItem.history, { date: new Date().toISOString().split('T')[0], action: 'Document updated' }]
    
    const lineSubtotal = form.items && form.items.length > 0
      ? form.items.reduce((sum: number, item: any) => sum + (Number(item.unit_price) * Number(item.quantity)), 0)
      : Number(form.value) || 0
    const lineDiscount = form.items && form.items.length > 0
      ? form.items.reduce((sum: number, item: any) => sum + Number(item.discount), 0)
      : 0
    const lineTax = form.items && form.items.length > 0
      ? form.items.reduce((sum: number, item: any) => sum + Math.round((((Number(item.unit_price) * Number(item.quantity)) - Number(item.discount)) * (Number(item.tax) / 100)) * 100) / 100, 0)
      : 0
    const calculatedValue = (lineSubtotal - lineDiscount) + lineTax

    const updated: Agreement = { 
      ...editItem, 
      ...form, 
      value: calculatedValue, 
      history: targetHistory,
      items: form.items || []
    }

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('agreements').update({
          client: form.client,
          contact: form.contact,
          phone: form.phone,
          email: (form as any).email || '',
          type: form.type,
          value: calculatedValue,
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

        // Delete old items and insert new ones
        await supabase.from('agreement_items').delete().eq('agreement_id', editItem.id)
        if (form.items && form.items.length > 0) {
          const { error: itemsErr } = await supabase.from('agreement_items').insert(
            form.items.map((item, idx) => ({
              agreement_id: editItem.id,
              service_id: item.service_id || null,
              service_name: item.service_name,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount: item.discount,
              tax: item.tax,
              total: item.total,
              sort_order: idx
            }))
          )
          if (itemsErr) {
            toast({ title: 'Error saving agreement items', description: itemsErr.message, variant: 'destructive' })
          }
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
      <PageHeader
        title="Client Agreements"
        description="Generate legally structured client agreements."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Documents', href: '/documents' },
          { label: 'Client Agreements' }
        ]}
        primaryAction={{
          label: 'New Agreement',
          onClick: () => { resetForm(null, companyDocs); setShowCreate(true) },
          icon: Plus,
          variant: 'gold'
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ l: 'Total', v: agreements.length }, { l: 'Signed', v: agreements.filter(a => a.status === 'signed').length }, { l: 'Draft', v: agreements.filter(a => a.status === 'draft').length }, { l: 'Sent', v: agreements.filter(a => a.status === 'sent').length }].map(s => (
          <Card key={s.l}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.l}</p><p className="text-2xl font-bold mt-1">{s.v}</p></CardContent></Card>
        ))}
      </div>

      <DataTable
        data={agreements}
        columns={columns}
        searchPlaceholder="Search Client Agreements..."
        searchKeys={['client', 'type', 'docId']}
        exportFileName="agreements"
        initialSearch={searchParams.get('search') || searchParams.get('client') || ''}
        savedFiltersKey="agreement"
        enableBulkSelect={true}
        bulkActions={[
          { label: 'Delete Selected', action: 'delete', variant: 'destructive', icon: Trash2 },
          { label: 'Mark Sent', action: 'status_sent', icon: FileText },
          { label: 'Mark Signed', action: 'status_signed', icon: FileText }
        ]}
        onBulkAction={handleBulkAction}
        filterDefs={[
          {
            key: 'status',
            label: 'Status',
            options: STATUS_OPTS.map(s => ({ label: s.toUpperCase(), value: s }))
          }
        ]}
        emptyTitle="No agreements found"
        emptyDescription="Create your first client agreement or adjust your filters."
        emptyIcon={HandshakeIcon}
        emptyAction={{ label: 'New Agreement', onClick: () => { resetForm(null, companyDocs); setShowCreate(true) }, icon: Plus }}
      />

      <Drawer
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setForm(blank()); setShowPreviewPanel(false); }}
        title="Generate Client Agreement"
        description="Choose a template, configure client details, agreement type, duration, services covered, and legal clauses."
        widthClass="max-w-7xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowPreviewPanel(v => !v)} className="gap-1.5 mr-auto">
              <Eye className="h-3.5 w-3.5" />
              {showPreviewPanel ? 'Hide Preview' : 'Show Preview'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setForm(blank()) }}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleGenerate} disabled={generating}>{generating ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Generating...</> : 'Generate Agreement PDF'}</Button>
          </>
        }
      >
        <div className={showPreviewPanel ? 'grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 h-full' : ''}>
          {/* Left: Form */}
          <div className="overflow-auto">
            {/* Template Selector */}
            <div className="mb-5 pb-5 border-b border-border">
              <p className="text-xs font-bold uppercase tracking-wider text-gold mb-3">Document Template</p>
              <TemplateSelector
                value={templateId}
                onChange={setTemplateId}
                onPreview={async (id) => {
                  let sub = Number(form.value) || 0
                  let tot = Number(form.value) || 0
                  let servicesStr = form.services || ''
                  if (form.items && form.items.length > 0) {
                    sub = form.items.reduce((sum: number, item: any) => sum + (Number(item.unit_price) * Number(item.quantity)), 0)
                    const lineDisc = form.items.reduce((sum: number, item: any) => sum + Number(item.discount), 0)
                    const lineTax = form.items.reduce((sum: number, item: any) => sum + Math.round((((Number(item.unit_price) * Number(item.quantity)) - Number(item.discount)) * (Number(item.tax) / 100)) * 100) / 100, 0)
                    tot = (sub - lineDisc) + lineTax
                    servicesStr = form.items.map((i: any) => i.service_name).join(', ')
                  }

                  const previewPayload = {
                    docType: 'Agreement' as const,
                    templateId: id,
                    clientName: form.contact || form.client || 'Preview Client',
                    projectTitle: 'Agreement Preview',
                    companyName: form.client || 'Preview Company',
                    clientInfo: { business: form.type },
                    content: buildContent({ ...form, value: tot }, form.client, tot, servicesStr),
                  }
                  setPreviewDoc({ ...form, docId: 'PREVIEW', id: 'preview' } as any)
                  setPreviewLoading(true)
                  setPreviewBlobUrl(null)
                  try {
                    const res = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(previewPayload) })
                    if (res.ok) {
                      const blob = await res.blob()
                      setPreviewBlobUrl(URL.createObjectURL(blob))
                    }
                  } catch {}
                  finally { setPreviewLoading(false) }
                }}
              />
            </div>
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
                <div className="space-y-1">
                  <Label>Contract Value (₹)</Label>
                  <Input 
                    type="number" 
                    placeholder="149999" 
                    value={form.items && form.items.length > 0
                      ? form.items.reduce((sum, item) => sum + item.total, 0)
                      : form.value || ''} 
                    onChange={e => setForm({ ...form, value: Number(e.target.value) })} 
                    readOnly={form.items && form.items.length > 0}
                    className={form.items && form.items.length > 0 ? "bg-muted/50 cursor-not-allowed font-medium text-gold" : ""}
                  />
                </div>
                <div className="space-y-1"><Label>Duration</Label><Input placeholder="e.g. 6 months, 12 months" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} /></div>
                <div className="space-y-1"><Label>Phone</Label><Input placeholder="Client phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="space-y-1"><Label>Client Email</Label><Input type="email" placeholder="client@company.com" value={(form as any).email || ''} onChange={e => setForm({ ...form, email: e.target.value } as any)} /></div>
                
                {(!form.items || (form.items.length === 0 && form.services)) ? (
                  <>
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
                  </>
                ) : (
                  <div className="col-span-1 sm:col-span-2 space-y-1">
                    <LineItemsTable
                      items={form.items}
                      onChange={(items) => setForm({ ...form, items })}
                    />
                  </div>
                )}
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
          </div>
          {/* Right: Live Preview */}
          {showPreviewPanel && (
            <div className="hidden lg:block h-full min-h-[600px]">
              <LivePreviewPanel
                payload={form.client ? (() => {
                  let sub = Number(form.value) || 0
                  let tot = Number(form.value) || 0
                  let servicesStr = form.services || ''
                  if (form.items && form.items.length > 0) {
                    sub = form.items.reduce((sum: number, item: any) => sum + (Number(item.unit_price) * Number(item.quantity)), 0)
                    const lineDisc = form.items.reduce((sum: number, item: any) => sum + Number(item.discount), 0)
                    const lineTax = form.items.reduce((sum: number, item: any) => sum + Math.round((((Number(item.unit_price) * Number(item.quantity)) - Number(item.discount)) * (Number(item.tax) / 100)) * 100) / 100, 0)
                    tot = (sub - lineDisc) + lineTax
                    servicesStr = form.items.map((i: any) => i.service_name).join(', ')
                  }
                  return {
                    docType: 'Agreement',
                    templateId,
                    clientName: form.contact || form.client,
                    projectTitle: `${form.type} - ${form.client}`,
                    companyName: form.client,
                    clientInfo: { business: form.type, mobile: form.phone },
                    content: buildContent({ ...form, value: tot }, form.client, tot, servicesStr),
                  }
                })() : null}
                visible
              />
            </div>
          )}
        </div>
      </Drawer>

      <Drawer
        isOpen={!!editItem}
        onClose={() => { setEditItem(null); setForm(blank()) }}
        title={`Edit Agreement - ${editItem?.docId}`}
        description="Modify client details, agreement type, duration, services covered, and legal clauses."
        widthClass="max-w-2xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => { setEditItem(null); setForm(blank()) }}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleSaveEdit}>Save Changes</Button>
          </>
        }
      >
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
                <div className="space-y-1">
                  <Label>Contract Value (₹)</Label>
                  <Input 
                    type="number" 
                    placeholder="149999" 
                    value={form.items && form.items.length > 0
                      ? form.items.reduce((sum, item) => sum + item.total, 0)
                      : form.value || ''} 
                    onChange={e => setForm({ ...form, value: Number(e.target.value) })} 
                    readOnly={form.items && form.items.length > 0}
                    className={form.items && form.items.length > 0 ? "bg-muted/50 cursor-not-allowed font-medium text-gold" : ""}
                  />
                </div>
                <div className="space-y-1"><Label>Duration</Label><Input placeholder="e.g. 6 months, 12 months" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} /></div>
                <div className="space-y-1"><Label>Phone</Label><Input placeholder="Client phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="space-y-1"><Label>Client Email</Label><Input type="email" placeholder="client@company.com" value={(form as any).email || ''} onChange={e => setForm({ ...form, email: e.target.value } as any)} /></div>
                
                {(!form.items || (form.items.length === 0 && form.services)) ? (
                  <>
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
                  </>
                ) : (
                  <div className="col-span-1 sm:col-span-2 space-y-1">
                    <LineItemsTable
                      items={form.items}
                      onChange={(items) => setForm({ ...form, items })}
                    />
                  </div>
                )}
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
      </Drawer>

      {/* Delete Confirmation */}
      <DeleteDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Agreement?"
        description="This action cannot be undone. This will permanently delete the agreement reference."
        confirmLabel="Delete Agreement"
        onConfirm={handleDelete}
      />

      <Dialog open={!!historyDoc} onOpenChange={(open) => !open && setHistoryDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="border-b border-white/10 pb-3">
            <DialogTitle>Document History - {historyDoc?.docId}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">{historyDoc?.client} · Click any entry to download that version</p>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-[50vh] overflow-y-auto">
            {/* Show revision notes prominently if status is needs revision */}
            {historyDoc?.status === 'needs revision' && (() => {
              const revEntry = historyDoc.history.slice().reverse().find(h => h.action.startsWith('Client requested changes'))
              return revEntry ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-3">
                  <p className="text-xs font-bold text-amber-400 mb-1">⚠ Client Requested Changes</p>
                  <p className="text-sm text-amber-200 leading-snug">{revEntry.action.replace('Client requested changes: ', '').replace(/^"|"$/g, '')}</p>
                  <p className="text-[10px] text-amber-400/60 mt-1">{revEntry.date}</p>
                </div>
              ) : null
            })()}
            {historyDoc?.history.slice().reverse().map((h, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-gold/30 hover:bg-gold/5 cursor-pointer group transition-all"
                onClick={() => { if (historyDoc) handleDownload(historyDoc) }}
              >
                <div className="flex-1 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-gold/50 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{h.action}</p>
                    <p className="text-xs text-muted-foreground">{h.date}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" aria-label="Action"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-gold hover:text-gold hover:bg-gold/10"
                  disabled={downloadingId === historyDoc?.id}
                  onClick={(e) => { e.stopPropagation(); if (historyDoc) handleDownload(historyDoc) }}
                  title="Download document version"
                >
                  {downloadingId === historyDoc?.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                </Button>
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
        initialSubject={shareDoc ? `${agreements.find(a => a.id === shareDoc.id)?.type}: ${agreements.find(a => a.id === shareDoc.id)?.docId} - ${agreements.find(a => a.id === shareDoc.id)?.client}` : ''}
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
              subject = emailDetails?.subject || `${agr.type}: ${agr.docId} - ${agr.client}`
              message = emailDetails?.message || `Dear ${agr.client},\n\nPlease find attached the ${agr.type} document ${agr.docId}.\n\nContract Value: ${formatCurrency(agr.value)}\nDuration: ${agr.duration || 'As agreed'}\n\nKindly review, sign, and return at your earliest convenience.\n\nBest regards,\nNetgain Team`
              
              let calculatedValue = agr.value
              let servicesStr = agr.services || ''
              let pdfItems: any[] = []
              let sub = agr.value
              let dAmt = 0

              if (agr.items && agr.items.length > 0) {
                sub = agr.items.reduce((sum: number, item: any) => sum + (Number(item.unit_price) * Number(item.quantity)), 0)
                dAmt = agr.items.reduce((sum: number, item: any) => sum + Number(item.discount), 0)
                const lineTax = agr.items.reduce((sum: number, item: any) => sum + Math.round((((Number(item.unit_price) * Number(item.quantity)) - Number(item.discount)) * (Number(item.tax) / 100)) * 100) / 100, 0)
                calculatedValue = (sub - dAmt) + lineTax
                servicesStr = agr.items.map((item: any) => `**${item.service_name}**\n${item.description || ''}`).join('\n\n')
                pdfItems = agr.items.map((item: any) => ({
                  serviceName: item.service_name,
                  finalPrice: item.total,
                  price: item.unit_price,
                  quantity: item.quantity,
                  category: 'Service',
                  pricing_model: 'fixed',
                  deliverables: item.description ? item.description.split('\n') : []
                }))
              }

              // Generate matching PDF payload on the fly
              pdfPayload = {
                docType: 'Agreement',
                clientName: agr.contact || agr.client,
                projectTitle: `${agr.type} - ${agr.client}`,
                companyName: agr.client,
                clientInfo: { business: agr.type, mobile: agr.phone },
                content: buildContent({ ...agr, value: calculatedValue }, agr.client, calculatedValue, servicesStr),
                items: pdfItems,
                subtotal: sub,
                discountTotal: dAmt,
                grandTotal: calculatedValue,
                docsSettings: {
                  customTerms: agr.customTerms || getAgreementTerms(agr, companyDocs)
                }
              }
            } else if (method === 'whatsapp' || method === 'sms') {
              recipient = agr.phone
              message = `Dear ${agr.client}, your ${agr.type} ${agr.docId} (${formatCurrency(agr.value)}) is ready for review and signature. - Netgain Team`
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
      {/* Document Preview Modal */}
      <DocumentPreviewModal 
        isOpen={!!previewDoc}
        onClose={() => { setPreviewDoc(null); setPreviewBlobUrl(null); }}
        onDownload={() => { if (previewDoc) handleDownload(previewDoc) }}
        title={`Agreement - ${previewDoc?.client || ''}`}
        subTitle={previewDoc?.docId || ''}
        blobUrl={previewBlobUrl}
        loading={previewLoading}
      />
    </div>
  )
}

export default function AgreementsPage() {
  return (
    <Suspense fallback={null}>
      <AgreementsPageContent />
    </Suspense>
  )
}
