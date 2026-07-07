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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { Drawer } from '@/components/ui/drawer'
import { DeleteDialog } from '@/components/ui/dialog-variants'
import { Search, Plus, Download, Pencil, Trash2, Loader2, Send, History, Globe, FileText } from 'lucide-react'
import { formatCurrency, formatDate, generateDocId, getDocStatusColor } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ShareDialog } from '@/components/ui/share-dialog'
import { PublishDialog } from '@/components/ui/publish-dialog'
import { useUser } from '@/components/user-provider'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { fetchFounderProfile } from '@/lib/founder-helper'
import { ClientAutocomplete } from '@/components/ui/client-autocomplete'
import { ServiceAutocomplete } from '@/components/ui/service-autocomplete'
import { getCachedData, setCachedData, invalidateCache } from '@/lib/data-cache'
import { LineItemsTable } from '@/components/ui/line-items-table'

type SOW = { 
  id: string; docId: string; client: string; contact: string; phone: string; email: string
  project: string; value: number; timeline: string; objectives: string; deliverables: string
  milestones: string; payment: string; exclusions: string; revisions: string; jurisdiction: string
  status: string; created: string
  history: { date: string; action: string; canDownload?: boolean }[]
  customTerms?: string
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

const mockSOWs: SOW[] = []
const STATUS_OPTS = ['draft', 'sent', 'published', 'viewed', 'needs revision', 'signed', 'completed', 'expired', 'rejected']

function compileDefaultSowTerms(companyDocs?: any) {
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

function getSowTerms(sow: SOW | any, companyDocs?: any) {
  if (sow.customTerms) return sow.customTerms
  if (sow.custom_terms) return sow.custom_terms
  return compileDefaultSowTerms(companyDocs)
}

function SOWPageContent() {
  const { user } = useUser()
  const [sows, setSows] = useState<SOW[]>([])
  const [sourceDocs, setSourceDocs] = useState<any[]>([])
  const [quotations, setQuotations] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [servicesMap, setServicesMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState<SOW | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const { toast } = useToast()
  const [generating, setGenerating] = useState(false)
  const [shareDoc, setShareDoc] = useState<{ id: string, title: string } | null>(null)
  const [historyDoc, setHistoryDoc] = useState<SOW | null>(null)
  const [publishDoc, setPublishDoc] = useState<SOW | null>(null)
  const [companyDocs, setCompanyDocs] = useState<any>(null)

  const columns = useMemo(() => [
    {
      header: 'Doc ID',
      accessor: 'docId',
      sortable: true,
      sticky: true,
      cell: (s: SOW) => (
        <div>
          <span className="font-mono text-xs text-gold font-bold">{s.docId}</span>
          {s.published ? (
            <div className="flex items-center gap-1.5 mt-1 text-[10px]">
              <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded border ${s.visibility_status === 'hidden' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`} title={s.visibility_status === 'hidden' ? 'Hidden from Client Portal' : 'Published to Client Portal'}>
                <Globe className="h-2.5 w-2.5" />
                {s.visibility_status === 'hidden' ? 'Hidden' : `V${s.published_version || 1}`}
              </span>
              {s.viewed_at && <span className="text-blue-400 font-medium border border-blue-500/20 bg-blue-500/5 px-1 py-0.5 rounded" title={`Viewed at ${formatDate(s.viewed_at)}`}>Viewed</span>}
              {s.downloaded_at && <span className="text-green-400 font-medium border border-green-500/20 bg-green-500/5 px-1 py-0.5 rounded" title={`Downloaded at ${formatDate(s.downloaded_at)}`}>DL</span>}
              {s.signed_at && <span className="text-emerald-400 font-medium border border-emerald-500/20 bg-emerald-500/5 px-1 py-0.5 rounded" title={`Signed at ${formatDate(s.signed_at)}`}>Signed</span>}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground/50 mt-1">Not Published</div>
          )}
          {s.status === 'needs revision' && (
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
      cell: (s: SOW) => (
        <div>
          <a href={`/crm?search=${encodeURIComponent(s.client)}`} className="font-medium text-xs text-slate-200 hover:text-gold transition-colors hover:underline decoration-dotted">
            {s.client}
          </a>
          <p className="text-[10px] text-muted-foreground">{s.contact}</p>
        </div>
      )
    },
    {
      header: 'Project',
      accessor: 'project',
      sortable: true,
      cell: (s: SOW) => <span className="text-xs text-muted-foreground max-w-[200px] truncate">{s.project}</span>
    },
    {
      header: 'Value',
      accessor: 'value',
      sortable: true,
      cell: (s: SOW) => <span className="font-semibold text-gold text-xs">{s.value > 0 ? formatCurrency(s.value) : '—'}</span>
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      cell: (s: SOW) => (
        <div onClick={e => e.stopPropagation()}>
          <Select value={s.status} onValueChange={v => updateStatus(s.id, v)}>
            <SelectTrigger className={`h-7 w-28 text-xs border ${getDocStatusColor(s.status)}`}><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_OPTS.map(o => <SelectItem key={o} value={o} className="text-xs capitalize">{o}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )
    },
    {
      header: 'Created',
      accessor: 'created',
      sortable: true,
      cell: (s: SOW) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(s.created)}</span>
    },
    {
      header: 'Actions',
      accessor: 'actions',
      className: 'text-right',
      cell: (s: SOW) => (
        <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
          <Button variant="ghost" size="icon" aria-label="History" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="History" onClick={() => setHistoryDoc(s)}><History className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" aria-label="Download" className="h-7 w-7" title="Download" onClick={() => handleDownload(s)} disabled={downloadingId === s.id}>
            {downloadingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Edit" className="h-7 w-7 text-blue-400 hover:text-blue-400" title="Edit" onClick={() => { setEditItem(s); resetForm(s, companyDocs); setShowCreate(true); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Publish to Client Portal" className={`h-7 w-7 ${s.published ? 'text-purple-400 hover:text-purple-300' : 'text-muted-foreground hover:text-gold'}`} title="Publish to Client Portal" onClick={() => setPublishDoc(s)}>
            <Globe className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Send to client" className="h-7 w-7 text-emerald-400 hover:text-emerald-400" title="Send to client" onClick={() => setShareDoc({ id: s.id, title: `${s.docId} - ${s.client}` })}><Send className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" aria-label="Delete" className="h-7 w-7 text-red-400 hover:text-red-400" title="Delete" onClick={() => setDeleteId(s.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )
    }
  ], [downloadingId])

  const handleBulkAction = async (action: string, selectedRows: SOW[]) => {
    if (action === 'delete') {
      if (!window.confirm(`Are you sure you want to delete ${selectedRows.length} SOWs?`)) return
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const ids = selectedRows.map(r => r.id)
          const { error } = await supabase.from('sows').delete().in('id', ids)
          if (error) {
            toast({ title: 'Error deleting SOWs', description: error.message, variant: 'destructive' })
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
      const updatedList = sows.filter(s => !idsSet.has(s.id))
      setSows(updatedList)
      setCachedData('sows', { sows: updatedList, sourceDocs, servicesMap, companyDocs })
      invalidateCache('dashboard')
      toast({ title: 'SOWs Deleted', description: `${selectedRows.length} SOWs have been deleted.` })
      setLoading(false)
    } else if (action.startsWith('status_')) {
      const newStatus = action.replace('status_', '')
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const ids = selectedRows.map(r => r.id)
          const { error } = await supabase.from('sows').update({ status: newStatus }).in('id', ids)
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
      const idsSet = new Set(selectedRows.map(s => s.id))
      const updatedList = sows.map(s => idsSet.has(s.id) ? { ...s, status: newStatus } : s)
      setSows(updatedList)
      setCachedData('sows', { sows: updatedList, sourceDocs, servicesMap, companyDocs })
      invalidateCache('dashboard')
      toast({ title: 'Status Updated', description: `${selectedRows.length} SOWs marked as ${newStatus}.` })
      setLoading(false)
    }
  }

  const [form, setForm] = useState({
    client: '', contact: '', phone: '', email: '', businessType: 'E-Commerce',
    project: '', value: '', timeline: '', startDate: '',
    objectives: '', deliverables: '', milestones: '',
    payment: '50% advance to start, balance on delivery',
    exclusions: 'Domain registration and renewal, Hosting fees, Third-party API/tool subscriptions, Ad spend',
    revisions: '2 rounds of revisions included per deliverable',
    confidentiality: 'Both parties agree to maintain strict confidentiality of all shared information.',
    jurisdiction: 'Hyderabad, Telangana, India',
    customTerms: compileDefaultSowTerms(null),
    items: [] as any[]
  })

  const searchParams = useSearchParams()

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
              email: client.email || '',
              businessType: client.type || prev.businessType
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

  function resetForm(sow?: SOW | null, docs?: any) {
    if (sow) {
      setForm({
        client: sow.client,
        contact: sow.contact,
        phone: sow.phone,
        email: '',
        businessType: '',
        project: sow.project,
        value: String(sow.value),
        timeline: sow.timeline,
        startDate: '',
        objectives: sow.objectives,
        deliverables: sow.deliverables,
        milestones: sow.milestones,
        payment: sow.payment,
        exclusions: sow.exclusions,
        revisions: sow.revisions,
        confidentiality: '',
        jurisdiction: sow.jurisdiction,
        customTerms: getSowTerms(sow, docs),
        items: sow.items || []
      })
    } else {
      setForm({
        client: '',
        contact: '',
        phone: '',
        email: '',
        businessType: 'E-Commerce',
        project: '',
        value: '',
        timeline: '',
        startDate: '',
        objectives: '',
        deliverables: '',
        milestones: '',
        payment: '50% advance to start, balance on delivery',
        exclusions: 'Domain registration and renewal, Hosting fees, Third-party API/tool subscriptions, Ad spend',
        revisions: '2 rounds of revisions included per deliverable',
        confidentiality: 'Both parties agree to maintain strict confidentiality of all shared information.',
        jurisdiction: 'Hyderabad, Telangana, India',
        customTerms: compileDefaultSowTerms(docs),
        items: [] as any[]
      })
    }
  }

  useEffect(() => {
    const cached = getCachedData<{ sows: SOW[], sourceDocs: any[], servicesMap: Record<string, any>, companyDocs?: any }>('sows')
    if (cached) {
      setSows(cached.sows)
      setSourceDocs(cached.sourceDocs)
      setServicesMap(cached.servicesMap)
      if (cached.companyDocs) {
        setCompanyDocs(cached.companyDocs)
        setForm(prev => ({ ...prev, customTerms: compileDefaultSowTerms(cached.companyDocs) }))
      }
      setLoading(false)
    }

    async function loadSOWs() {
      if (!cached) setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const [sRes, qRes, iRes, svRes, cRes] = await Promise.all([
            supabase.from('sows').select('*, sow_items(*)').order('created_at', { ascending: false }),
            supabase.from('quotations').select('*').order('created_at', { ascending: false }),
            supabase.from('invoices').select('*').order('created', { ascending: false }),
            supabase.from('services').select('id, name, deliverables').eq('status', 'active'),
            supabase.from('company_settings').select('*').limit(1).maybeSingle()
          ])

          if (sRes.error) throw sRes.error

          let mappedSvMap: Record<string, any> = {}
          if (svRes.data) {
            mappedSvMap = {}
            svRes.data.forEach((s: any) => mappedSvMap[s.id] = s)
            setServicesMap(mappedSvMap)
          }

          let docsSettings: any = null
          if (cRes.data && cRes.data.docs) {
            docsSettings = cRes.data.docs
            setCompanyDocs(docsSettings)
            setForm(prev => ({ ...prev, customTerms: compileDefaultSowTerms(docsSettings) }))
          }

          const docs: any[] = []
          const mappedQuos: any[] = []
          if (qRes.data) {
            qRes.data.forEach((q: any) => {
              const quoItem = {
                id: q.id,
                docId: q.doc_id,
                client: q.client,
                contact: q.contact || '',
                phone: q.phone || '',
                email: q.email || '',
                projectTitle: q.project_title || '',
                amount: Number(q.amount) || 0,
                serviceIds: q.service_ids || [],
                customTerms: q.custom_terms || '',
                paymentTermsOneTime: q.payment_terms_one_time,
                paymentTermsMonthly: q.payment_terms_monthly,
                extraTerms: q.extra_terms,
                adBudget: q.ad_budget,
                adBudgetPct: q.ad_budget_pct,
                adBudgetFixed: q.ad_budget_fixed,
                adBudgetOverride: q.ad_budget_override,
                adBudgetBillThrough: q.ad_budget_bill_through,
              }
              mappedQuos.push(quoItem)
              docs.push({ type: 'Quotation', id: q.id, docId: q.doc_id, client: q.client, contact: q.contact, phone: q.phone, email: q.email, project: q.project_title, value: q.amount, serviceIds: q.service_ids || [] })
            })
          }
          setQuotations(mappedQuos)

          const mappedInvs: any[] = []
          if (iRes.data) {
            iRes.data.forEach((i: any) => {
              const invItem = {
                id: i.id,
                docId: i.doc_id,
                client: i.client,
                contact: i.contact || '',
                phone: i.phone || '',
                email: i.email || '',
                amount: Number(i.amount) || 0,
                serviceIds: i.service_ids || [],
                customTerms: i.custom_terms || '',
                adBudget: i.ad_budget,
                adBudgetPct: i.ad_budget_pct,
                adBudgetFixed: i.ad_budget_fixed,
                adBudgetOverride: i.ad_budget_override,
                adBudgetBillThrough: i.ad_budget_bill_through,
                customSubtotal: i.custom_subtotal ? Number(i.custom_subtotal) : null,
              }
              mappedInvs.push(invItem)
              docs.push({ type: 'Invoice', id: i.id, docId: i.doc_id, client: i.client, contact: i.contact, phone: i.phone, email: i.email, project: `Project for ${i.client}`, value: i.amount, serviceIds: i.service_ids || [] })
            })
          }
          setInvoices(mappedInvs)
          setSourceDocs(docs)

          let mappedSows: SOW[] = []
          if (sRes.data) {
            mappedSows = sRes.data.map((s: any) => ({
              id: s.id,
              docId: s.doc_id,
              client: s.client,
              contact: s.contact || '',
              phone: s.phone || '',
              email: s.email || '',
              project: s.project,
              value: Number(s.value) || 0,
              timeline: s.timeline || '',
              objectives: s.objectives || '',
              deliverables: s.deliverables || '',
              milestones: s.milestones || '',
              payment: s.payment || '',
              exclusions: s.exclusions || '',
              revisions: s.revisions || '',
              jurisdiction: s.jurisdiction || '',
              status: s.status || 'draft',
              created: s.created,
              history: Array.isArray(s.history) ? s.history : [],
              customTerms: s.custom_terms || '',
              published: s.published || false,
              published_by: s.published_by || '',
              published_at: s.published_at || '',
              viewed_at: s.viewed_at || '',
              downloaded_at: s.downloaded_at || '',
              signed_at: s.signed_at || '',
              published_version: s.published_version || 1,
              visibility_status: s.visibility_status || 'visible',
              ip_address: s.ip_address || '',
              browser: s.browser || '',
              device: s.device || '',
              client_id: s.client_id || '',
              items: s.sow_items || []
            }))
            setSows(mappedSows)
          }

          setCachedData('sows', { sows: mappedSows, sourceDocs: docs, servicesMap: mappedSvMap, companyDocs: docsSettings })
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        }
      } else {
        setSows(mockSOWs)
        setCachedData('sows', { sows: mockSOWs, sourceDocs: [], servicesMap: {}, companyDocs: null })
      }
      setLoading(false)
    }
    loadSOWs()
  }, [])


  // Auto-fill founder details when creating new SOW
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

  function handleQuotationSelect(docId: string) {
    const q = quotations.find(quo => quo.docId === docId)
    if (!q) return

    // 1. Objectives
    const objectivesText = `To successfully implement and deliver the project for ${q.client || 'Client'} in accordance with the services requested.`

    // 2. Deliverables
    let deliverablesStr = ''
    if (q.serviceIds && q.serviceIds.length > 0) {
      q.serviceIds.forEach((id: string) => {
        const svc = servicesMap[id]
        if (svc) {
          deliverablesStr += `**${svc.name}**\n`
          if (svc.deliverables && Array.isArray(svc.deliverables)) {
            deliverablesStr += svc.deliverables.map((d: string) => `- ${d}`).join('\n') + '\n\n'
          }
        }
      })
    }

    // 3. Milestones & Payment terms
    let milestonesStr = ''
    let paymentStr = '50% advance to start, balance on delivery'
    if (q.paymentScheduleId && companyDocs?.paymentSchedules) {
      const sched = companyDocs.paymentSchedules.find((p: any) => p.id === q.paymentScheduleId)
      if (sched && sched.points) {
        milestonesStr = sched.points.map((pt: any, i: number) => `Milestone ${i+1}: ${pt.label} (${pt.pct}%)`).join('\n')
        paymentStr = sched.points.map((pt: any) => `${pt.pct}% on ${pt.label}`).join(', ')
      }
    } else {
      milestonesStr = `Kickoff (Week 1)\nDesign & Approval (Week 2-3)\nDevelopment & Integration (Week 4-7)\nLaunch & Delivery (Week 8)`
    }

    // 4. Terms and conditions
    const termsStr = q.customTerms || compileDefaultSowTerms(companyDocs)

    setForm(prev => ({
      ...prev,
      client: q.client || '',
      contact: q.contact || '',
      phone: q.phone || '',
      email: q.email || '',
      project: q.projectTitle || prev.project,
      objectives: objectivesText,
      deliverables: deliverablesStr.trim(),
      milestones: milestonesStr,
      payment: paymentStr,
      customTerms: termsStr,
    }))
    toast({ title: 'Extracted Scope from Quotation' })
  }

  function handleInvoiceSelect(docId: string) {
    const inv = invoices.find(i => i.docId === docId)
    if (!inv) return

    setForm(prev => ({
      ...prev,
      value: inv.amount ? String(inv.amount) : '',
    }))
    toast({ title: 'Extracted Pricing from Invoice' })
  }

  function buildPayload(f: typeof form | any, clientName: string, project: string, docId: string) {
    let sub = Number(f.value) || 0
    let dAmt = 0
    let tot = Number(f.value) || 0
    let pdfItems: any[] = []
    let deliverablesMarkdown = ''

    if (f.items && f.items.length > 0) {
      sub = f.items.reduce((sum: number, item: any) => sum + (Number(item.unit_price) * Number(item.quantity)), 0)
      const lineDisc = f.items.reduce((sum: number, item: any) => sum + Number(item.discount), 0)
      dAmt = lineDisc
      const lineTax = f.items.reduce((sum: number, item: any) => sum + Math.round(((Number(item.unit_price) * Number(item.quantity)) - Number(item.discount)) * (Number(item.tax) / 100)), 0)
      tot = (sub - dAmt) + lineTax

      deliverablesMarkdown = f.items.map((item: any) => `**${item.service_name}**\n${item.description || ''}`).join('\n\n')
      pdfItems = f.items.map((item: any) => ({
        serviceName: item.service_name,
        finalPrice: item.total,
        price: item.unit_price,
        quantity: item.quantity,
        category: 'Service',
        pricing_model: 'fixed',
        deliverables: item.description ? item.description.split('\n') : []
      }))
    } else {
      deliverablesMarkdown = f.deliverables ? f.deliverables.split('\n').filter(Boolean).map((d: string) => d.trim().startsWith('-') || d.trim().startsWith('•') ? d : `- ${d}`).join('\n') : ''
    }

    const contentParts = [
      '## Project Overview',
      `**Project:** ${project}`,
      f.contact ? `**Client Name:** ${f.contact}` : '',
      `**Business Name:** ${clientName}`,
      f.phone ? `**Phone:** ${f.phone}` : '',
      f.email ? `**Email:** ${f.email}` : '',
      `**Contract Value:** ${formatCurrency(tot)}`,
    ].filter(Boolean)

    if (f.objectives && f.objectives.trim()) {
      contentParts.push('## Objectives', f.objectives)
    }
    if (deliverablesMarkdown) {
      contentParts.push('## Deliverables', deliverablesMarkdown)
    }
    if (f.milestones && f.milestones.trim()) {
      contentParts.push('## Project Milestones', f.milestones.split('\n').filter(Boolean).map((m: any, i: number) => `**Milestone ${i + 1}:** ${m}`).join('\n'))
    }
    if (f.payment && f.payment.trim()) {
      contentParts.push('## Payment Terms', f.payment)
    }
    if (f.revisions && f.revisions.trim()) {
      contentParts.push('## Revision Policy', f.revisions)
    }
    if (f.exclusions && f.exclusions.trim()) {
      contentParts.push('## Exclusions', f.exclusions.split(',').map((e: any) => e.trim()).filter(Boolean).map((e: any) => `- ${e}`).join('\n'))
    }
    if (f.jurisdiction && f.jurisdiction.trim()) {
      contentParts.push('## Jurisdiction', `This agreement shall be governed by the laws of **${f.jurisdiction}**.`)
    }

    const content = contentParts.join('\n\n')
    return {
      docType: 'SOW',
      clientName: f.contact || clientName,
      projectTitle: project || `SOW — ${clientName}`,
      companyName: clientName,
      clientInfo: { mobile: f.phone },
      content,
      items: pdfItems,
      subtotal: sub,
      discountTotal: dAmt,
      grandTotal: tot,
      docsSettings: {
        customTerms: f.customTerms || getSowTerms(f, companyDocs)
      }
    }
  }

  async function downloadSowPdf(sow: SOW) {
    const cacheBuster = sow.signed_at ? new Date(sow.signed_at).getTime() : new Date().getTime()
    const res = await fetch(`/api/document-pdf?id=${sow.id}&type=SOW&v=${cacheBuster}`)
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'PDF failed') }
    const blob = await res.blob()
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `SOW_${sow.docId}_${sow.client.replace(/\s+/g, '_')}.pdf`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  async function handleDownload(sow: SOW) {
    setDownloadingId(sow.id)
    try { await downloadSowPdf(sow); toast({ title: `✅ ${sow.docId} downloaded` }) }
    catch (e: any) { toast({ title: 'Download failed', description: e.message, variant: 'destructive' }) }
    finally { setDownloadingId(null) }
  }

  async function updateStatus(id: string, status: string) {
    const targetSow = sows.find(s => s.id === id)
    if (!targetSow) return
    const newHistory = [...targetSow.history, { date: new Date().toISOString().split('T')[0], action: `Status changed to ${status}` }]
    
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('sows')
          .update({ status, history: newHistory })
          .eq('id', id)
        if (error) {
          toast({ title: 'Error updating status', description: error.message, variant: 'destructive' })
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        return
      }
    }

    const updatedList = sows.map(s => s.id === id ? { ...s, status, history: newHistory } : s)
    setSows(updatedList)
    setCachedData('sows', { sows: updatedList, sourceDocs, servicesMap, companyDocs })
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
        .from('sows')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    }

    const updatedList = sows.map(s => s.id === id ? { ...s, ...updates } : s)
    setSows(updatedList)
    setCachedData('sows', { sows: updatedList, sourceDocs, servicesMap, companyDocs })
    invalidateCache('dashboard')
  }


  async function handleDelete() {
    if (!deleteId) return
    const updatedList = sows.filter(s => s.id !== deleteId)
    setSows(updatedList)
    setCachedData('sows', { sows: updatedList, sourceDocs, servicesMap })
    invalidateCache('dashboard')
    setDeleteId(null)
    toast({ title: 'SOW deleted' })
  }


  const handleGenerate = async () => {
    if (!form.client || !form.project) {
      toast({ title: 'Client and Project name are required', variant: 'destructive' }); return
    }
    setGenerating(true)
    try {
      const docId = editItem ? editItem.docId : generateDocId('NG-SOW')
      const payload = buildPayload(form, form.client, form.project, docId)

      const res = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'PDF failed') }
      const blob = await res.blob()
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
      a.download = `SOW_${docId}_${form.client.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)

      const targetId = editItem ? editItem.id : String(Date.now())
      const targetCreated = editItem ? editItem.created : new Date().toISOString().slice(0, 10)
      const targetHistory = editItem 
        ? [...editItem.history, { date: new Date().toISOString().split('T')[0], action: 'Document updated' }] 
        : [{ date: new Date().toISOString().split('T')[0], action: 'Document generated' }]
      const targetStatus = editItem ? editItem.status : 'draft'

      const lineSubtotal = form.items && form.items.length > 0
        ? form.items.reduce((sum: number, item: any) => sum + (Number(item.unit_price) * Number(item.quantity)), 0)
        : Number(form.value) || 0
      const lineDiscount = form.items && form.items.length > 0
        ? form.items.reduce((sum: number, item: any) => sum + Number(item.discount), 0)
        : 0
      const lineTax = form.items && form.items.length > 0
        ? form.items.reduce((sum: number, item: any) => sum + Math.round(((Number(item.unit_price) * Number(item.quantity)) - Number(item.discount)) * (Number(item.tax) / 100)), 0)
        : 0
      const calculatedValue = (lineSubtotal - lineDiscount) + lineTax

      const newSOW: SOW = { 
        id: targetId, 
        docId, 
        client: form.client, 
        contact: form.contact, 
        phone: form.phone,
        email: form.email || '',
        project: form.project, 
        value: calculatedValue, 
        timeline: form.timeline, 
        objectives: form.objectives, 
        deliverables: form.deliverables, 
        milestones: form.milestones, 
        payment: form.payment, 
        exclusions: form.exclusions, 
        revisions: form.revisions, 
        jurisdiction: form.jurisdiction, 
        status: targetStatus, 
        created: targetCreated, 
        history: targetHistory,
        customTerms: form.customTerms,
        items: form.items || []
      }

      if (isSupabaseConfigured()) {
        const dbPayload = {
          id: targetId,
          doc_id: docId,
          client: form.client,
          contact: form.contact,
          phone: form.phone,
          email: form.email || '',
          project: form.project,
          value: calculatedValue,
          timeline: form.timeline,
          objectives: form.objectives,
          deliverables: form.deliverables,
          milestones: form.milestones,
          payment: form.payment,
          exclusions: form.exclusions,
          revisions: form.revisions,
          jurisdiction: form.jurisdiction,
          status: targetStatus,
          created: targetCreated,
          history: targetHistory,
          custom_terms: form.customTerms
        }

        const { error } = editItem 
          ? await supabase.from('sows').update(dbPayload).eq('id', targetId)
          : await supabase.from('sows').insert([dbPayload])

        if (error) {
          toast({ title: 'Error saving to database', description: error.message, variant: 'destructive' })
          setGenerating(false)
          return
        }

        if (editItem) {
          await supabase.from('sow_items').delete().eq('sow_id', targetId)
        }

        if (form.items && form.items.length > 0) {
          const { error: itemsErr } = await supabase.from('sow_items').insert(
            form.items.map((item, idx) => ({
              sow_id: targetId,
              service_id: item.service_id,
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
            toast({ title: 'Error saving SOW items', description: itemsErr.message, variant: 'destructive' })
          }
        }
      }

      if (editItem) {
        const updatedList = sows.map(s => s.id === editItem.id ? newSOW : s)
        setSows(updatedList)
        setCachedData('sows', { sows: updatedList, sourceDocs, servicesMap, companyDocs })
        toast({ title: '✅ SOW Updated!', description: `${docId} updated and downloaded.` })
      } else {
        const updatedList = [newSOW, ...sows]
        setSows(updatedList)
        setCachedData('sows', { sows: updatedList, sourceDocs, servicesMap, companyDocs })
        toast({ title: '✅ SOW Generated!', description: `${docId} downloaded successfully.` })
      }
      invalidateCache('dashboard')
      
      setShowCreate(false)
      setEditItem(null)
      resetForm(null, companyDocs)

    } catch (e: any) { toast({ title: 'PDF Error', description: e.message, variant: 'destructive' }) }
    finally { setGenerating(false) }
  }



  return (
    <div className="space-y-6">
      <PageHeader
        title="Scope of Work"
        description="Generate detailed scope of work documents."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Documents', href: '/documents' },
          { label: 'Scope of Work' }
        ]}
        primaryAction={{
          label: 'New SOW',
          onClick: () => { resetForm(null, companyDocs); setShowCreate(true) },
          icon: Plus,
          variant: 'gold'
        }}
      />
      <DataTable
        data={sows}
        columns={columns}
        searchPlaceholder="Search Scope of Works..."
        searchKeys={['client', 'project', 'docId']}
        exportFileName="sows"
        initialSearch={searchParams.get('search') || searchParams.get('client') || ''}
        savedFiltersKey="sow"
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
        emptyTitle="No Scope of Works found"
        emptyDescription="Create your first SOW or adjust your filters."
        emptyIcon={FileText}
        emptyAction={{ label: 'New SOW', onClick: () => { resetForm(null, companyDocs); setShowCreate(true) }, icon: Plus }}
      />

      <Drawer
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setEditItem(null); resetForm(null, companyDocs) }}
        title={editItem ? "Edit Scope of Work" : "Generate Scope of Work"}
        description="Configure client details, project name, duration, service deliverables, milestones, and exclusions."
        widthClass="max-w-2xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setEditItem(null); }}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />{editItem ? 'Saving...' : 'Generating...'}</> : (editItem ? 'Save Changes' : 'Generate SOW')}
            </Button>
          </>
        }
      >
          <div className="space-y-5 py-2">
            {!editItem && (quotations.length > 0 || invoices.length > 0) && (
              <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-4">
                <p className="text-xs font-semibold text-gold uppercase tracking-wide">Extract Details from Existing Documents</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {quotations.length > 0 && (
                    <div className="space-y-1">
                      <Label>Extract Scope from Quotation</Label>
                      <Select onValueChange={handleQuotationSelect}>
                        <SelectTrigger><SelectValue placeholder="Select quotation..." /></SelectTrigger>
                        <SelectContent>
                          {quotations.map(q => (
                            <SelectItem key={q.docId} value={q.docId}>
                              {q.docId} - {q.client}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">Fills Client Info, Project Name, Deliverables, Payment Terms, and SOW Terms.</p>
                    </div>
                  )}
                  {invoices.length > 0 && (
                    <div className="space-y-1">
                      <Label>Extract Pricing from Invoice</Label>
                      <Select onValueChange={handleInvoiceSelect}>
                        <SelectTrigger><SelectValue placeholder="Select invoice..." /></SelectTrigger>
                        <SelectContent>
                          {invoices.map(i => (
                            <SelectItem key={i.docId} value={i.docId}>
                              {i.docId} - {i.client} ({formatCurrency(i.amount)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">Fills Contract Value from the selected invoice's total payable amount.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Client & Project</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Company Name *</Label>
                  <ClientAutocomplete
                    placeholder="Client company"
                    value={form.client}
                    onChange={v => setForm({ ...form, client: v })}
                    onSelect={client => setForm({
                      ...form,
                      client: client.business || client.name,
                      contact: client.name,
                      phone: client.phone || '',
                      email: client.email || '',
                      businessType: client.type || form.businessType
                    })}
                  />
                </div>
                <div className="space-y-1"><Label>Contact Person</Label><Input placeholder="Representative" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></div>
                <div className="space-y-1"><Label>Phone</Label><Input placeholder="Client phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="space-y-1"><Label>Client Email</Label><Input type="email" placeholder="client@company.com" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Project Name *</Label><Input placeholder="e.g. E-Commerce Platform Build" value={form.project} onChange={e => setForm({ ...form, project: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label>Contract Value (₹)</Label>
                  <Input 
                    type="number" 
                    placeholder="149999" 
                    value={form.items && form.items.length > 0
                      ? form.items.reduce((sum, item) => sum + item.total, 0)
                      : form.value} 
                    onChange={e => setForm({ ...form, value: e.target.value })} 
                    readOnly={form.items && form.items.length > 0}
                    className={form.items && form.items.length > 0 ? "bg-muted/50 cursor-not-allowed font-medium text-gold" : ""}
                  />
                </div>
                <div className="space-y-1"><Label>Timeline</Label><Input placeholder="e.g. 8 Weeks from kickoff" value={form.timeline} onChange={e => setForm({ ...form, timeline: e.target.value })} /></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Scope Details</p>
              <div className="space-y-3">
                <div className="space-y-1"><Label>Objectives</Label><Textarea className="h-16 resize-none" placeholder="What will be achieved? What problems are solved?" value={form.objectives} onChange={e => setForm({ ...form, objectives: e.target.value })} /></div>
                
                {(!form.items || (form.items.length === 0 && form.deliverables)) ? (
                  <>
                    <div className="space-y-1">
                      <Label>Search & Add Service Deliverables</Label>
                      <ServiceAutocomplete
                        placeholder="Search for a service to append..."
                        onSelect={(svc) => {
                          const bulletPoints = svc.deliverables && Array.isArray(svc.deliverables)
                            ? svc.deliverables.map((d: string) => `- ${d}`).join('\n')
                            : ''
                          const entry = `**${svc.name}**\n${bulletPoints}`
                          setForm(prev => ({
                            ...prev,
                            deliverables: prev.deliverables ? `${prev.deliverables}\n\n${entry}` : entry
                          }))
                          toast({ title: `${svc.name} deliverables added` })
                        }}
                      />
                    </div>
                    <div className="space-y-1"><Label>Deliverables (one per line)</Label><Textarea className="h-24 resize-none" placeholder="Fully functional Shopify store&#10;Mobile responsive design..." value={form.deliverables} onChange={e => setForm({ ...form, deliverables: e.target.value })} /></div>
                  </>
                ) : (
                  <div className="space-y-1">
                    <LineItemsTable
                      items={form.items}
                      onChange={(items) => setForm({ ...form, items })}
                    />
                  </div>
                )}

                <div className="space-y-1"><Label>Milestones (one per line)</Label><Textarea className="h-20 resize-none" placeholder="Discovery & Kickoff (Week 1)&#10;Design Mockups (Week 2-3)&#10;Development (Week 4-7)&#10;Testing & Launch (Week 8)" value={form.milestones} onChange={e => setForm({ ...form, milestones: e.target.value })} /></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Terms & Conditions</p>
              <div className="space-y-3">
                <div className="space-y-1"><Label>Payment Terms</Label><Input value={form.payment} onChange={e => setForm({ ...form, payment: e.target.value })} /></div>
                <div className="space-y-1"><Label>Exclusions (comma-separated)</Label><Textarea className="h-14 resize-none" value={form.exclusions} onChange={e => setForm({ ...form, exclusions: e.target.value })} /></div>
                <div className="space-y-1"><Label>Revision Policy</Label><Input value={form.revisions} onChange={e => setForm({ ...form, revisions: e.target.value })} /></div>
                <div className="space-y-1"><Label>Jurisdiction</Label><Input value={form.jurisdiction} onChange={e => setForm({ ...form, jurisdiction: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label>Terms & Conditions Bottom Block (One per line)</Label>
                  <Textarea className="h-32 font-mono text-xs" placeholder="Enter each term on a new line..." value={form.customTerms} onChange={e => setForm({ ...form, customTerms: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
      </Drawer>

      {/* Delete Confirmation */}
      <DeleteDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete SOW?"
        description="This action cannot be undone. This will permanently delete the SOW reference."
        confirmLabel="Delete SOW"
        onConfirm={handleDelete}
      />

      <Dialog open={!!historyDoc} onOpenChange={(open) => !open && setHistoryDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="border-b border-white/10 pb-3">
            <DialogTitle>Document History — {historyDoc?.docId}</DialogTitle>
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
        initialEmail={shareDoc ? sows.find(s => s.id === shareDoc.id)?.email || '' : ''}
        initialSubject={shareDoc ? `Scope of Work: ${sows.find(s => s.id === shareDoc.id)?.docId} — ${sows.find(s => s.id === shareDoc.id)?.project || sows.find(s => s.id === shareDoc.id)?.client}` : ''}
        initialMessage={shareDoc ? (() => {
          const sow = sows.find(s => s.id === shareDoc.id)
          if (!sow) return ''
          return `Dear ${sow.client},\n\nPlease find attached the Scope of Work document ${sow.docId} for your project "${sow.project || 'Services'}".\n\nProject Value: ${formatCurrency(sow.value)}\nTimeline: ${sow.timeline || 'As discussed'}\n\nKindly review and revert with your confirmation.\n\nBest regards,\nNetgain Team`
        })() : ''}
        onSend={async (methods, emailDetails) => {
          if (!shareDoc) return

          const sow = sows.find(s => s.id === shareDoc.id)
          if (!sow) throw new Error('SOW not found')

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
              recipient = emailDetails?.recipient || sow.email || ''
              subject = emailDetails?.subject || `Scope of Work: ${sow.docId} — ${sow.project || sow.client}`
              message = emailDetails?.message || `Dear ${sow.client},\n\nPlease find attached the Scope of Work document ${sow.docId} for your project "${sow.project || 'Services'}".\n\nProject Value: ${formatCurrency(sow.value)}\nTimeline: ${sow.timeline || 'As discussed'}\n\nKindly review and revert with your confirmation.\n\nBest regards,\nNetgain Team`
              
              // Generate matching PDF payload on the fly
              pdfPayload = buildPayload({
                ...sow,
                value: String(sow.value),
                email: sow.email || '',
                businessType: '',
                startDate: '',
                confidentiality: 'Both parties agree to maintain strict confidentiality of all shared information.',
                customTerms: sow.customTerms || ''
              } as any, sow.client, sow.project, sow.docId)
            } else if (method === 'whatsapp' || method === 'sms') {
              recipient = sow.phone
              message = `Dear ${sow.client}, your Scope of Work ${sow.docId} for "${sow.project || 'Services'}" (${formatCurrency(sow.value)}) is ready. Please review and confirm. — Netgain Team`
            }

            if (!recipient) {
              throw new Error(`No ${method === 'email' ? 'email address' : 'phone number'} found for this client. Please edit the SOW to add contact details.`)
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
        docTitle={publishDoc?.project || publishDoc?.docId || ''}
        docId={publishDoc?.docId || ''}
        isPublished={!!publishDoc?.published}
        visibilityStatus={publishDoc?.visibility_status || 'visible'}
        currentVersion={publishDoc?.published_version || 1}
        onAction={handlePublishAction}
      />
    </div>
  )
}

export default function SOWPage() {
  return (
    <Suspense fallback={null}>
      <SOWPageContent />
    </Suspense>
  )
}
