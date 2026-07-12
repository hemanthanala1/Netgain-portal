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
import { Search, Plus, Download, Send, Trash2, Pencil, Loader2, FileText, History, Globe, MoreHorizontal, Receipt, Eye } from 'lucide-react'
import { formatCurrency, formatDate, getDocStatusColor, generateDocId } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { ShareDialog } from '@/components/ui/share-dialog'
import { PublishDialog } from '@/components/ui/publish-dialog'
import { UniversalTimeline } from '@/components/ui/version-timeline'
import { DocumentPreviewModal } from '@/components/ui/document-preview-modal'
import { useUser } from '@/components/user-provider'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { fetchFounderProfile } from '@/lib/founder-helper'
import { ClientAutocomplete } from '@/components/ui/client-autocomplete'
import { getCachedData, setCachedData, invalidateCache } from '@/lib/data-cache'
import { LineItemsTable } from '@/components/ui/line-items-table'
import { TemplateSelector, type TemplateId } from '@/components/ui/template-selector'
import { LivePreviewPanel } from '@/components/ui/live-preview-panel'

const STATUS_OPTS = ['draft', 'sent', 'published', 'viewed', 'paid', 'overdue', 'completed', 'rejected']
const STATUS_LABELS: Record<string, string> = { draft: 'Draft', sent: 'Sent', published: 'Published', viewed: 'Viewed', paid: 'Paid', overdue: 'Overdue', completed: 'Completed', rejected: 'Rejected' }

type Invoice = {
  id: string; docId: string; client: string; contact: string; email: string; phone: string
  businessType: string; gst: string; serviceIds: string[]; discountType: 'percentage' | 'fixed'; discountValue: number; gstPct: number
  notes: string; amount: number; status: string; created: string; due: string
  history: { date: string; action: string; canDownload?: boolean }[]
  paymentScheduleId?: string;
  paymentScheduleEntry?: string;
  invoiceTerms?: string;
  invoicePaymentInstructions?: string;
  invoiceFooter?: string;
  invoiceAdditionalText?: string;
  customTerms?: string;
  adBudget?: number;
  adBudgetPct?: number;
  adBudgetFixed?: number;
  adBudgetOverride?: boolean;
  adBudgetBillThrough?: boolean;
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
  client_id?: string;
  customSubtotal?: number | null;
  items?: any[];
}

const INITIAL: Invoice[] = []

function compileDefaultInvoiceTerms(invoiceTerms: string, ptOneTime: string, ptMonthly: string, gstPct: number, extraTerms: string) {
  if (invoiceTerms && invoiceTerms.trim()) {
    return invoiceTerms.trim()
  }
  const lines = [
    `One-time services: ${ptOneTime}.`,
    `Monthly recurring services: ${ptMonthly}.`,
    'Hosting, domain, ad spend & third-party API fees billed at actuals.',
    `All prices are in Indian Rupees (INR). GST @ ${gstPct}% extra as applicable.`
  ]
  if (extraTerms) {
    extraTerms.split('\n').map(t => t.trim()).filter(Boolean).forEach(t => lines.push(t))
  }
  return lines.join('\n')
}

function getInvoiceTerms(inv: Invoice | any, companyDocs?: any) {
  if (inv.customTerms) return inv.customTerms
  if (inv.custom_terms) return inv.custom_terms
  
  const invoiceTerms = inv.invoiceTerms !== undefined && inv.invoiceTerms !== null ? inv.invoiceTerms : (companyDocs?.invoiceTerms || '')
  const paymentTermsOneTime = companyDocs?.paymentTermsOneTime || '50% advance to begin, 50% balance on final delivery'
  const paymentTermsMonthly = companyDocs?.paymentTermsMonthly || 'Full monthly fee payable in advance each cycle'
  const extraTerms = companyDocs?.extraTerms || ''
  const gstPct = inv.gstPct !== undefined && inv.gstPct !== null ? inv.gstPct : 18

  return compileDefaultInvoiceTerms(invoiceTerms, paymentTermsOneTime, paymentTermsMonthly, gstPct, extraTerms)
}

function blankForm(initialDocs?: any) {
  const invoiceTerms = initialDocs?.invoiceTerms || ''
  const paymentTermsOneTime = initialDocs?.paymentTermsOneTime || '50% advance to begin, 50% balance on final delivery'
  const paymentTermsMonthly = initialDocs?.paymentTermsMonthly || 'Full monthly fee payable in advance each cycle'
  const extraTerms = initialDocs?.extraTerms || ''
  const gstPct = 18

  return { 
    client: '', 
    contact: '', 
    email: '', 
    phone: '', 
    businessType: 'E-Commerce', 
    gst: '', 
    selectedIds: [] as string[], 
    discountType: 'percentage' as 'percentage'|'fixed', 
    discountValue: 0, 
    gstPct, 
    notes: initialDocs?.invoiceNotes || 'Thank you for your business!', 
    paymentScheduleId: '',
    paymentSchedulePointIndex: 'none',
    due: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
    invoiceTerms,
    invoicePaymentInstructions: initialDocs?.invoicePaymentInstructions || '',
    invoiceFooter: initialDocs?.invoiceFooter || '',
    invoiceAdditionalText: initialDocs?.invoiceAdditionalText || '',
    customTerms: compileDefaultInvoiceTerms(invoiceTerms, paymentTermsOneTime, paymentTermsMonthly, gstPct, extraTerms),
    adBudget: 0,
    adBudgetPct: 15,
    adBudgetFixed: 0,
    adBudgetOverride: false,
    adBudgetBillThrough: false,
    customSubtotal: null as number | null,
    items: [] as any[],
  }
}

function InvoicesPageContent() {
  const { user } = useUser()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [servicesData, setServicesData] = useState<any[]>([])
  const [paymentSchedules, setPaymentSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<Invoice | null>(null)
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [templateId, setTemplateId] = useState<TemplateId>('modern')
  const [showPreviewPanel, setShowPreviewPanel] = useState(false)
  const { toast } = useToast()

  const columns = useMemo(() => [
    {
      header: 'Invoice ID',
      accessor: 'docId',
      sortable: true,
      sticky: true,
      cell: (inv: Invoice) => (
        <div>
          <span className="font-mono text-xs text-gold font-bold">{inv.docId}</span>
          {inv.published ? (
            <div className="flex items-center gap-1.5 mt-1 text-[10px]">
              <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded border ${inv.visibility_status === 'hidden' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`} title={inv.visibility_status === 'hidden' ? 'Hidden from Client Portal' : 'Published to Client Portal'}>
                <Globe className="h-2.5 w-2.5" />
                {inv.visibility_status === 'hidden' ? 'Hidden' : `V${inv.published_version || 1}`}
              </span>
              {inv.viewed_at && <span className="text-blue-400 font-medium border border-blue-500/20 bg-blue-500/5 px-1 py-0.5 rounded" title={`Viewed at ${formatDate(inv.viewed_at)}`}>Viewed</span>}
              {inv.downloaded_at && <span className="text-green-400 font-medium border border-green-500/20 bg-green-500/5 px-1 py-0.5 rounded" title={`Downloaded at ${formatDate(inv.downloaded_at)}`}>DL</span>}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground/50 mt-1">Not Published</div>
          )}
        </div>
      )
    },
    {
      header: 'Client',
      accessor: 'client',
      sortable: true,
      cell: (inv: Invoice) => (
        <div>
          <a href={`/crm?search=${encodeURIComponent(inv.client)}`} className="font-medium text-xs text-foreground hover:text-gold transition-colors hover:underline decoration-dotted">
            {inv.client}
          </a>
          <p className="text-[10px] text-muted-foreground">{inv.contact}</p>
        </div>
      )
    },
    {
      header: 'Services',
      accessor: 'serviceIds',
      cell: (inv: Invoice) => (
        <div className="flex gap-1 flex-wrap max-w-[180px]">
          {servicesData.filter(s => inv.serviceIds?.includes(s.id)).slice(0,2).map(s => (
            <Badge key={s.id} variant="outline" className="text-[9px]">
              {s.name.slice(0,18)}
            </Badge>
          ))}
          {inv.serviceIds?.length > 2 && (
            <Badge variant="outline" className="text-[9px]">
              +{inv.serviceIds.length-2}
            </Badge>
          )}
        </div>
      )
    },
    {
      header: 'Amount',
      accessor: 'amount',
      sortable: true,
      cell: (inv: Invoice) => <span className="font-semibold text-gold text-xs whitespace-nowrap">{formatCurrency(inv.amount)}</span>
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      cell: (inv: Invoice) => (
        <div onClick={e => e.stopPropagation()}>
          <Select value={inv.status} onValueChange={v => updateStatus(inv.id, v)}>
            <SelectTrigger className={`h-7 w-28 text-xs border ${getDocStatusColor(inv.status)}`}><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_OPTS.map(s => <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )
    },
    {
      header: 'Due Date',
      accessor: 'due',
      sortable: true,
      cell: (inv: Invoice) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(inv.due)}</span>
    },
    {
      header: 'Actions',
      accessor: 'actions',
      className: 'text-right',
      cell: (inv: Invoice) => (
        <div className="flex justify-end" onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border-border">
              <DropdownMenuItem onClick={() => setHistoryDoc(inv)} className="cursor-pointer gap-2">
                <History className="h-4 w-4" /> History
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePreview(inv)} className="cursor-pointer gap-2 text-blue-400 focus:text-blue-400">
                <Eye className="h-4 w-4" /> Preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownload(inv)} disabled={downloadingId === inv.id} className="cursor-pointer gap-2">
                {downloadingId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEdit(inv)} className="cursor-pointer gap-2 text-blue-400 focus:text-blue-400">
                <Pencil className="h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPublishDoc(inv)} className={`cursor-pointer gap-2 ${inv.published ? 'text-purple-400 focus:text-purple-400' : ''}`}>
                <Globe className="h-4 w-4" /> Publish to Client Portal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShareDoc({ id: inv.id, title: `${inv.docId} - ${inv.client}` })} className="cursor-pointer gap-2 text-emerald-400 focus:text-emerald-400">
                <Send className="h-4 w-4" /> Send to client
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeleteId(inv.id)} className="cursor-pointer gap-2 text-red-400 focus:text-red-400 focus:bg-red-400/10">
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    }
  ], [servicesData, downloadingId])

  const handleBulkAction = async (action: string, selectedRows: Invoice[]) => {
    if (action === 'delete') {
      if (!window.confirm(`Are you sure you want to delete ${selectedRows.length} invoices?`)) return
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const ids = selectedRows.map(r => r.id)
          const { error } = await supabase.from('invoices').delete().in('id', ids)
          if (error) {
            toast({ title: 'Error deleting invoices', description: error.message, variant: 'destructive' })
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
      const updatedList = invoices.filter(i => !idsSet.has(i.id))
      setInvoices(updatedList)
      setCachedData('invoices', { invoices: updatedList, servicesData, paymentSchedules, companyDocs })
      invalidateCache('dashboard')
      toast({ title: 'Invoices Deleted', description: `${selectedRows.length} invoices have been deleted.` })
      setLoading(false)
    } else if (action.startsWith('status_')) {
      const newStatus = action.replace('status_', '')
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const ids = selectedRows.map(r => r.id)
          const { error } = await supabase.from('invoices').update({ status: newStatus }).in('id', ids)
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
      const idsSet = new Set(selectedRows.map(r => r.id))
      const updatedList = invoices.map(i => idsSet.has(i.id) ? { ...i, status: newStatus } : i)
      setInvoices(updatedList)
      setCachedData('invoices', { invoices: updatedList, servicesData, paymentSchedules, companyDocs })
      invalidateCache('dashboard')
      toast({ title: 'Status Updated', description: `${selectedRows.length} invoices marked as ${STATUS_LABELS[newStatus] || newStatus}.` })
      setLoading(false)
    }
  }
  const [generating, setGenerating] = useState(false)
  const [shareDoc, setShareDoc] = useState<{ id: string, title: string } | null>(null)
  const [historyDoc, setHistoryDoc] = useState<Invoice | null>(null)
  const [publishDoc, setPublishDoc] = useState<Invoice | null>(null)
  const [companyDocs, setCompanyDocs] = useState<any>(null)

  useEffect(() => {
    if (companyDocs?.defaultTemplateId) {
      setTemplateId(companyDocs.defaultTemplateId)
    }
  }, [companyDocs])
  const [businessTypes, setBusinessTypes] = useState<string[]>([
    'E-Commerce', 'D2C Brand', 'B2B Company', 'SaaS / Software', 'Service Business', 'Other'
  ])
  const [showManageBusinessTypes, setShowManageBusinessTypes] = useState(false)
  const [newBusinessTypeName, setNewBusinessTypeName] = useState('')
  const [editingBusinessTypeIndex, setEditingBusinessTypeIndex] = useState<number | null>(null)
  const [editingBusinessTypeName, setEditingBusinessTypeName] = useState('')

  const saveBusinessTypes = async (updatedTypes: string[]) => {
    setBusinessTypes(updatedTypes)
    if (isSupabaseConfigured()) {
      try {
        const { data: exist } = await supabase.from('company_settings').select('id, docs').limit(1).maybeSingle()
        if (exist) {
          const updatedDocs = { ...exist.docs, businessTypes: updatedTypes }
          await supabase.from('company_settings').update({ docs: updatedDocs }).eq('id', exist.id)
        } else {
          await supabase.from('company_settings').insert([{ docs: { businessTypes: updatedTypes } }])
        }
      } catch (err) {
        console.error('Failed to save business types to db:', err)
      }
    }
  }

  const handleAddBusinessType = () => {
    if (!newBusinessTypeName.trim()) return
    if (businessTypes.includes(newBusinessTypeName.trim())) {
      toast({ title: 'Business type already exists', variant: 'destructive' })
      return
    }
    const updated = [...businessTypes, newBusinessTypeName.trim()]
    saveBusinessTypes(updated)
    setNewBusinessTypeName('')
    toast({ title: 'Business Type Added' })
  }

  const handleEditBusinessType = (index: number) => {
    if (!editingBusinessTypeName.trim()) return
    if (businessTypes.includes(editingBusinessTypeName.trim()) && businessTypes[index] !== editingBusinessTypeName.trim()) {
      toast({ title: 'Business type already exists', variant: 'destructive' })
      return
    }
    const updated = [...businessTypes]
    updated[index] = editingBusinessTypeName.trim()
    saveBusinessTypes(updated)
    setEditingBusinessTypeIndex(null)
    setEditingBusinessTypeName('')
    toast({ title: 'Business Type Updated' })
  }

  const handleDeleteBusinessType = (typeToDelete: string) => {
    const updated = businessTypes.filter(t => t !== typeToDelete)
    saveBusinessTypes(updated)
    toast({ title: 'Business Type Deleted' })
  }

  const [serviceSearch, setServiceSearch] = useState('')

  const [form, setForm] = useState(() => blankForm())

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
              businessType: client.type || prev.businessType,
              gst: client.gst || prev.gst
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
    const cached = getCachedData<{ invoices: Invoice[], servicesData: any[], paymentSchedules?: any[], companyDocs?: any }>('invoices')
    if (cached) {
      setInvoices(cached.invoices)
      setServicesData(cached.servicesData)
      if (cached.paymentSchedules) setPaymentSchedules(cached.paymentSchedules)
      if (cached.companyDocs) {
        setCompanyDocs(cached.companyDocs)
        setForm(blankForm(cached.companyDocs))
        if (cached.companyDocs.businessTypes && Array.isArray(cached.companyDocs.businessTypes)) {
          setBusinessTypes(cached.companyDocs.businessTypes)
        }
      }
      setLoading(false)
    }

    async function loadData() {
      if (!cached) setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const [invRes, sRes, cRes] = await Promise.all([
            supabase.from('invoices').select('*, invoice_items(*)').order('created', { ascending: false }),
            supabase.from('services').select('*').eq('status', 'active').order('created_at', { ascending: false }),
            supabase.from('company_settings').select('*').limit(1).maybeSingle()
          ])

          if (invRes.error) throw invRes.error
          if (sRes.error) throw sRes.error

          let schedules = []
          let docsSettings = null
          if (cRes.data && cRes.data.docs) {
            docsSettings = cRes.data.docs
            setCompanyDocs(docsSettings)
            setForm(blankForm(docsSettings))
            if (docsSettings.paymentSchedules) {
              schedules = docsSettings.paymentSchedules
              setPaymentSchedules(schedules)
            }
            if (docsSettings.businessTypes && Array.isArray(docsSettings.businessTypes)) {
              setBusinessTypes(docsSettings.businessTypes)
            }
          }

          let mappedSvcs: any[] = []
          if (sRes.data) {
            mappedSvcs = sRes.data.map((s: any) => ({
              id: s.id,
              name: s.name,
              price: Number(s.quotation_price || s.price_max || s.base_price || 0),
              priceMin: s.price_min ? Number(s.price_min) : undefined,
              priceMax: s.price_max ? Number(s.price_max) : undefined,
              timeline: s.timeline || 'TBD',
              category: 'Service',
              catId: s.cat_id,
              model: s.pricing || 'fixed',
              deliverables: s.deliverables || []
            }))
            setServicesData(mappedSvcs)
          }

          let mappedInvoices: Invoice[] = []
          if (invRes.data) {
            mappedInvoices = invRes.data.map((i: any) => ({
              id: i.id,
              docId: i.doc_id,
              client: i.client,
              contact: i.contact || '',
              email: i.email || '',
              phone: i.phone || '',
              businessType: i.business_type || '',
              gst: i.gst || '',
              serviceIds: i.service_ids || [],
              discountType: i.discount_type || 'percentage',
              discountValue: Number(i.discount_value) || 0,
              gstPct: Number(i.gst_pct) || 0,
              notes: i.notes || '',
              amount: Number(i.amount) || 0,
              status: i.status || 'draft',
              created: i.created,
              due: i.due,
              history: Array.isArray(i.history) ? i.history : [],
              paymentScheduleId: i.payment_schedule_id || '',
              paymentScheduleEntry: i.payment_schedule_entry || '',
              invoiceTerms: i.invoice_terms,
              invoicePaymentInstructions: i.invoice_payment_instructions,
              invoiceFooter: i.invoice_footer,
              invoiceAdditionalText: i.invoice_additional_text,
              customTerms: i.custom_terms || '',
              adBudget: i.ad_budget ? Number(i.ad_budget) : 0,
              adBudgetPct: i.ad_budget_pct ? Number(i.ad_budget_pct) : 15,
              adBudgetFixed: i.ad_budget_fixed ? Number(i.ad_budget_fixed) : 0,
              adBudgetOverride: i.ad_budget_override || false,
              adBudgetBillThrough: i.ad_budget_bill_through || false,
              published: i.published || false,
              published_by: i.published_by || '',
              published_at: i.published_at || '',
              viewed_at: i.viewed_at || '',
              downloaded_at: i.downloaded_at || '',
              signed_at: i.signed_at || '',
              published_version: i.published_version || 1,
              visibility_status: i.visibility_status || 'visible',
              ip_address: i.ip_address || '',
              browser: i.browser || '',
              device: i.device || '',
              client_id: i.client_id || '',
              customSubtotal: i.custom_subtotal ? Number(i.custom_subtotal) : null,
              items: i.invoice_items || []
            }))
            setInvoices(mappedInvoices)
          }

          setCachedData('invoices', { invoices: mappedInvoices, servicesData: mappedSvcs, paymentSchedules: schedules, companyDocs: docsSettings })
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        }
      } else {
        setInvoices(INITIAL)
        setCachedData('invoices', { invoices: INITIAL, servicesData: [], paymentSchedules: [], companyDocs: null })
      }
      setLoading(false)
    }
    loadData()
  }, [])


  // Auto-fill founder details when creating new invoice
  useEffect(() => {
    if (showCreate && !editInvoice) {
      fetchFounderProfile().then(founder => {
        if (founder) {
          setForm(prev => ({
            ...prev,
            contact: founder.name,
            email: founder.email,
            phone: founder.phone
          }))
        }
      })
    }
  }, [showCreate])

  const selSvcs = servicesData.filter(s => form.selectedIds.includes(s.id))
  
  // Calculate dynamic price for Paid Advertising services (catId === '3')
  const adBudgetFee = form.adBudgetOverride 
    ? (form.adBudgetFixed || 0) 
    : Math.round((form.adBudget || 0) * ((form.adBudgetPct || 15) / 100))

  const totalMinPrice = selSvcs.reduce((sum, s) => {
    const base = s.priceMin !== undefined ? s.priceMin : s.price
    if (s.catId === '3') return sum + base + adBudgetFee
    return sum + base
  }, 0)
  const totalMaxPrice = selSvcs.reduce((sum, s) => {
    const base = s.priceMax !== undefined ? s.priceMax : s.price
    if (s.catId === '3') return sum + base + adBudgetFee
    return sum + base
  }, 0)
  const hasRange = totalMaxPrice > totalMinPrice

  const computedSubStandard = selSvcs.reduce((sum, s) => {
    if (s.catId === '3') {
      return sum + s.price + adBudgetFee
    }
    return sum + s.price
  }, 0)

  const computedSub = form.customSubtotal !== undefined && form.customSubtotal !== null
    ? form.customSubtotal
    : computedSubStandard

  const handleCustomSubtotalChange = (val: number) => {
    let newItems = form.items || []
    if (newItems.length > 0 && hasRange && totalMaxPrice > totalMinPrice) {
      const ratio = (val - totalMinPrice) / (totalMaxPrice - totalMinPrice)
      newItems = newItems.map((item: any) => {
        const svc = servicesData.find(s => s.id === item.service_id)
        if (svc) {
          const minP = svc.priceMin !== undefined ? svc.priceMin : svc.price
          const maxP = svc.priceMax !== undefined ? svc.priceMax : svc.price
          const range = maxP - minP
          const scaledPrice = Math.round(minP + ratio * range)
          return { ...item, unit_price: scaledPrice, total: scaledPrice * (item.quantity || 1) }
        }
        return item
      })
    }
    setForm({ ...form, customSubtotal: val, items: newItems })
  }

  const lineItemsSubtotal = form.items ? form.items.reduce((sum, item) => sum + (item.unit_price * (item.quantity || 1)), 0) : 0
  const lineItemsDiscount = form.items ? form.items.reduce((sum, item) => sum + item.discount, 0) : 0

  const subtotal = form.items && form.items.length > 0
    ? (form.customSubtotal !== null && form.customSubtotal !== undefined ? form.customSubtotal : lineItemsSubtotal) + (form.adBudgetBillThrough ? (form.adBudget || 0) : 0)
    : (computedSub + (form.adBudgetBillThrough ? (form.adBudget || 0) : 0))

  const discAmt = form.items && form.items.length > 0
    ? lineItemsDiscount + (form.discountType === 'percentage'
        ? Math.round((lineItemsSubtotal - lineItemsDiscount) * form.discountValue / 100)
        : form.discountValue)
    : (form.discountType === 'percentage'
        ? Math.round(subtotal * form.discountValue / 100)
        : form.discountValue)

  const afterDisc = Math.max(0, subtotal - discAmt)
  const gstAmt = Math.round(afterDisc * form.gstPct / 100)

  const grandTotal = afterDisc + gstAmt

  const selectedSchedule = form.paymentScheduleId ? paymentSchedules.find(p => p.id === form.paymentScheduleId) : null
  const selectedMilestoneIndex = form.paymentSchedulePointIndex !== 'none' ? Number(form.paymentSchedulePointIndex) : -1
  const selectedMilestone = (selectedSchedule && selectedMilestoneIndex >= 0) ? selectedSchedule.points[selectedMilestoneIndex] : null
  const invoiceAmount = selectedMilestone ? Math.round(grandTotal * (selectedMilestone.pct / 100)) : grandTotal

  const filtered = invoices.filter(inv => {
    const matchSearch = inv.client.toLowerCase().includes(search.toLowerCase()) || inv.docId.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter
    return matchSearch && matchStatus
  })

  function openEdit(inv: Invoice) {
    setEditInvoice(inv)
    const schedule = paymentSchedules.find(p => p.id === inv.paymentScheduleId)
    let pointIdx = 'none'
    if (schedule && inv.paymentScheduleEntry) {
      const idx = schedule.points.findIndex((pt: any) => `${pt.label} (${pt.pct}%)` === inv.paymentScheduleEntry)
      if (idx !== -1) {
        pointIdx = String(idx)
      }
    }

    const legacyItems = inv.serviceIds ? inv.serviceIds.map((sid, idx) => {
      const svc = servicesData.find(s => s.id === sid)
      return {
        id: Math.random().toString(36).substring(2, 9),
        service_id: sid,
        service_name: svc ? svc.name : 'Unknown Service',
        description: '',
        quantity: 1,
        unit_price: svc ? svc.price : 0,
        discount: 0,
        tax: 0,
        total: svc ? svc.price : 0,
        sort_order: idx
      }
    }) : []

    setForm({ 
      client: inv.client, 
      contact: inv.contact, 
      email: inv.email, 
      phone: inv.phone, 
      businessType: inv.businessType, 
      gst: inv.gst, 
      selectedIds: inv.serviceIds, 
      discountType: inv.discountType, 
      discountValue: inv.discountValue, 
      gstPct: inv.gstPct, 
      notes: inv.notes, 
      paymentScheduleId: inv.paymentScheduleId || '',
      paymentSchedulePointIndex: pointIdx,
      due: inv.due ? inv.due.slice(0, 10) : new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
      invoiceTerms: inv.invoiceTerms !== undefined && inv.invoiceTerms !== null ? inv.invoiceTerms : (companyDocs?.invoiceTerms || ''),
      invoicePaymentInstructions: inv.invoicePaymentInstructions !== undefined && inv.invoicePaymentInstructions !== null ? inv.invoicePaymentInstructions : (companyDocs?.invoicePaymentInstructions || ''),
      invoiceFooter: inv.invoiceFooter !== undefined && inv.invoiceFooter !== null ? inv.invoiceFooter : (companyDocs?.invoiceFooter || ''),
      invoiceAdditionalText: inv.invoiceAdditionalText !== undefined && inv.invoiceAdditionalText !== null ? inv.invoiceAdditionalText : (companyDocs?.invoiceAdditionalText || ''),
      customTerms: getInvoiceTerms(inv, companyDocs),
      adBudget: inv.adBudget || 0,
      adBudgetPct: inv.adBudgetPct || 15,
      adBudgetFixed: inv.adBudgetFixed || 0,
      adBudgetOverride: inv.adBudgetOverride || false,
      adBudgetBillThrough: inv.adBudgetBillThrough || false,
      customSubtotal: inv.customSubtotal || null,
      items: (inv.items && inv.items.length > 0) ? inv.items : legacyItems,
    })
  }

  function toggleSvc(id: string) {
    setForm(f => ({ 
      ...f, 
      selectedIds: f.selectedIds.includes(id) ? f.selectedIds.filter(x => x !== id) : [...f.selectedIds, id],
      customSubtotal: null
    }))
  }

  async function buildAndDownloadPdf(
    inv: Invoice, 
    svcIds: string[], 
    discType: 'percentage'|'fixed', 
    discVal: number, 
    gst: number, 
    docId: string, 
    paymentScheduleId?: string,
    paymentScheduleEntry?: string,
    dueDate?: string,
    isPreview: boolean = false
  ) {
    const svcs = servicesData.filter(s => svcIds.includes(s.id))
    
    let baseSub = 0
    let dAmt = 0
    let tot = 0
    const scaledItems: any[] = []

    let pct = 100
    if (paymentScheduleEntry) {
      const match = paymentScheduleEntry.match(/\((\d+)%\)/)
      if (match) {
        pct = Number(match[1])
      }
    }
    const scaleFactor = pct / 100

    if (inv.items && inv.items.length > 0) {
      const lineItemsSubtotal = inv.items.reduce((sum: number, item: any) => sum + (Number(item.unit_price) * Number(item.quantity || 1)), 0)
      const lineItemsDiscount = inv.items.reduce((sum: number, item: any) => sum + Number(item.discount), 0)

      baseSub = lineItemsSubtotal
      dAmt = lineItemsDiscount + (discType === 'percentage' ? Math.round((lineItemsSubtotal - lineItemsDiscount) * discVal / 100) : discVal)
      const aft = Math.max(0, baseSub - dAmt)
      const gAmt = Math.round(aft * inv.gstPct / 100)
      tot = aft + gAmt

      inv.items.forEach((item: any) => {
        const scaledPrice = Math.round(Number(item.unit_price) * scaleFactor)
        const scaledFinalPrice = Math.round(Number(item.total) * scaleFactor)
        scaledItems.push({
          serviceName: paymentScheduleEntry ? `${item.service_name} - ${paymentScheduleEntry}` : item.service_name,
          finalPrice: scaledFinalPrice,
          price: scaledPrice,
          quantity: item.quantity,
          category: 'Service',
          pricing_model: 'fixed',
          deliverables: item.description ? item.description.split('\n').filter((d: string) => d.trim().length > 0) : [],
            tax: Math.round(Number(item.tax || 0) * scaleFactor)
        })
      })
    } else {
      // Calculate dynamic price for Paid Advertising services (catId === '3')
      const adBudgetFee = inv.adBudgetOverride 
        ? (inv.adBudgetFixed || 0) 
        : Math.round((inv.adBudget || 0) * ((inv.adBudgetPct || 15) / 100))

      const totalMinPrice = svcs.reduce((sum, s) => {
        const base = s.priceMin !== undefined ? s.priceMin : s.price
        if (s.catId === '3') return sum + base + adBudgetFee
        return sum + base
      }, 0)
      const totalMaxPrice = svcs.reduce((sum, s) => {
        const base = s.priceMax !== undefined ? s.priceMax : s.price
        if (s.catId === '3') return sum + base + adBudgetFee
        return sum + base
      }, 0)
      const hasRange = totalMaxPrice > totalMinPrice

      const adjustedSvcs = svcs.map(s => {
        let adjPrice = s.price
        if (hasRange && inv.customSubtotal !== undefined && inv.customSubtotal !== null) {
          const minP = s.priceMin !== undefined ? s.priceMin : s.price
          const maxP = s.priceMax !== undefined ? s.priceMax : s.price
          const range = maxP - minP
          if (totalMaxPrice > totalMinPrice) {
            const ratio = (inv.customSubtotal - totalMinPrice) / (totalMaxPrice - totalMinPrice)
            adjPrice = Math.round(minP + ratio * range)
          }
        }
        return { ...s, price: adjPrice }
      })

      const computedSub = inv.customSubtotal !== undefined && inv.customSubtotal !== null
        ? inv.customSubtotal
        : adjustedSvcs.reduce((sum, s) => {
            if (s.catId === '3') {
              return sum + s.price + adBudgetFee
            }
            return sum + s.price
          }, 0)

      baseSub = computedSub + (inv.adBudgetBillThrough ? (inv.adBudget || 0) : 0)
      dAmt = discType === 'percentage' ? Math.round(baseSub * discVal / 100) : discVal
      const aft = Math.max(0, baseSub - dAmt)
      const gAmt = Math.round(aft * inv.gstPct / 100)
      tot = aft + gAmt

      adjustedSvcs.forEach(s => {
        if (s.catId === '3') {
          // 1. One-time Setup Cost
          const scaledSetup = Math.round(s.price * scaleFactor)
          scaledItems.push({
            serviceName: paymentScheduleEntry ? `${s.name} - Setup Cost - ${paymentScheduleEntry}` : `${s.name} - Setup Cost`,
            finalPrice: scaledSetup,
            price: scaledSetup,
            quantity: 1,
            category: s.category,
            pricing_model: 'fixed',
            deliverables: [`Campaign structure setup and onboarding for ${s.name}`],
              tax: Math.round(scaledSetup * inv.gstPct / 100)
          })
          // 2. Monthly Service Fee
          const scaledFee = Math.round(adBudgetFee * scaleFactor)
          scaledItems.push({
            serviceName: paymentScheduleEntry ? `${s.name} - Monthly Service Fee - ${paymentScheduleEntry}` : `${s.name} - Monthly Service Fee`,
            finalPrice: scaledFee,
            price: scaledFee,
            quantity: 1,
            category: s.category,
            pricing_model: 'monthly',
              deliverables: s.deliverables,
              tax: Math.round(scaledFee * inv.gstPct / 100)
          })
        } else {
          const scaledPrice = Math.round(s.price * scaleFactor)
          let customName = s.name
          if (paymentScheduleEntry) {
            customName = `${s.name} - ${paymentScheduleEntry}`
          }
          scaledItems.push({
            serviceName: customName,
            finalPrice: scaledPrice,
            price: scaledPrice,
            quantity: 1,
            category: s.category,
            pricing_model: s.model,
              deliverables: s.deliverables,
              tax: Math.round(scaledPrice * inv.gstPct / 100)
          })
        }
      })

      // If ad budget is billed through Netgain, append it as a line item in PDF
      if (inv.adBudgetBillThrough && inv.adBudget && inv.adBudget > 0) {
        const scaledBudget = Math.round(inv.adBudget * scaleFactor)
        scaledItems.push({
          serviceName: paymentScheduleEntry ? `Ad Budget (Paid Ads Spend) - ${paymentScheduleEntry}` : "Ad Budget (Paid Ads Spend)",
          finalPrice: scaledBudget,
          price: scaledBudget,
          quantity: 1,
          category: "Ad Spend",
          pricing_model: "monthly",
          deliverables: ["Advertising spend budget on Google/Meta networks"]
        })
      }
    }

    const scaledSub = Math.round(baseSub * scaleFactor)
    const scaledDAmt = Math.round(dAmt * scaleFactor)
    const scaledAft = Math.max(0, scaledSub - scaledDAmt)
    const scaledGAmt = Math.round(scaledAft * inv.gstPct / 100)
    const scaledTot = scaledAft + scaledGAmt

    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    const dueFormatted = dueDate
      ? new Date(dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date(Date.now() + 10 * 864e5).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

    const payload = {
      docType: 'Invoice',
      templateId,
      clientName: inv.contact || inv.client,
      projectTitle: `Invoice - ${docId}`,
      companyName: inv.client,
      clientInfo: { business: inv.businessType, mobile: inv.phone, gst: inv.gst },
      content: [
        `## Invoice Details`,
        `**Invoice Date:** ${today}  |  **Due Date:** ${dueFormatted}`,
        `**Invoice Ref:** ${docId}`,
        `${inv.gst ? `**Client GST:** ${inv.gst}` : ''}`,
        '',
        '## Services',
        ...scaledItems.flatMap((s: any, i: number) => [
          `### ${i + 1}. ${s.serviceName}`,
          `Category: ${s.category}  |  ${s.pricing_model === 'monthly' ? 'Monthly Recurring' : 'One-Time'}`,
          ...(s.deliverables?.map((d: any) => `- ${d}`) || []),
          '',
        ]),
        '## Payment Details',
        '__BANK_DETAILS__',
        ...(inv.invoicePaymentInstructions ? ['', inv.invoicePaymentInstructions] : (companyDocs?.invoicePaymentInstructions ? ['', companyDocs.invoicePaymentInstructions] : [])),
        ...(inv.invoiceAdditionalText ? ['', '## Additional Details', inv.invoiceAdditionalText] : (companyDocs?.invoiceAdditionalText ? ['', '## Additional Details', companyDocs.invoiceAdditionalText] : [])),
        ...(inv.notes ? ['', '## Notes', inv.notes] : []),
      ].join('\n'),
      items: scaledItems,
      subtotal: scaledSub,
      discountTotal: scaledDAmt,
      grandTotal: scaledTot,
      fullProjectTotal: tot,
      fullSubtotal: baseSub,
      paymentScheduleId,
      paymentScheduleObj: paymentScheduleId ? paymentSchedules.find(p => p.id === paymentScheduleId) : null,
      adBudget: inv.adBudget,
      adBudgetPct: inv.adBudgetPct,
      adBudgetFixed: inv.adBudgetFixed,
      adBudgetOverride: inv.adBudgetOverride,
      adBudgetBillThrough: inv.adBudgetBillThrough,
      docsSettings: {
        gstRate: String(gst),
        invoiceTerms: inv.invoiceTerms !== undefined && inv.invoiceTerms !== null ? inv.invoiceTerms : (companyDocs?.invoiceTerms || ''),
        invoiceFooter: inv.invoiceFooter !== undefined && inv.invoiceFooter !== null ? inv.invoiceFooter : (companyDocs?.invoiceFooter || ''),
        customTerms: inv.customTerms || getInvoiceTerms(inv, companyDocs),
      },
    }

    const res = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'PDF failed') }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    if (isPreview) return url
    const a = document.createElement('a'); a.href = url
    a.download = `Invoice_${docId}_${inv.client.replace(/\s+/g, '_')}.pdf`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return url
  }

  async function handlePreview(inv: Invoice) {
    setPreviewDoc(inv)
    setPreviewLoading(true)
    setPreviewBlobUrl(null)
    try {
      const url = await buildAndDownloadPdf(inv, inv.serviceIds, inv.discountType, inv.discountValue, inv.gstPct, inv.docId, inv.paymentScheduleId, inv.paymentScheduleEntry, inv.due, true)
      if (url) setPreviewBlobUrl(url as string)
    } catch (e: any) {
      toast({ title: 'Preview failed', description: e.message, variant: 'destructive' })
      setPreviewDoc(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleDownload(inv: Invoice) {
    setDownloadingId(inv.id)
    try {
      await buildAndDownloadPdf(inv, inv.serviceIds, inv.discountType, inv.discountValue, inv.gstPct, inv.docId, inv.paymentScheduleId, inv.paymentScheduleEntry, inv.due)
      toast({ title: `✅ ${inv.docId} downloaded` })
    } catch (e: any) { toast({ title: 'Download failed', description: e.message, variant: 'destructive' }) }
    finally { setDownloadingId(null) }
  }

  async function handleGenerate() {
    if (!form.client) { toast({ title: 'Company name required', variant: 'destructive' }); return }
    if (form.selectedIds.length === 0) { toast({ title: 'Select at least one service', variant: 'destructive' }); return }
    setGenerating(true)
    try {
      const docId = generateDocId('NG-INV')
      const targetId = String(Date.now())
      const targetCreated = new Date().toISOString().slice(0,10)
      const targetDue = form.due || new Date(Date.now()+10*864e5).toISOString().slice(0,10)
      const targetHistory = [{ date: new Date().toISOString().split('T')[0], action: 'Document generated', canDownload: true }]

      const selectedSchedule = form.paymentScheduleId ? paymentSchedules.find(p => p.id === form.paymentScheduleId) : null
      const selectedMilestoneIndex = form.paymentSchedulePointIndex !== 'none' ? Number(form.paymentSchedulePointIndex) : -1
      const selectedMilestone = (selectedSchedule && selectedMilestoneIndex >= 0) ? selectedSchedule.points[selectedMilestoneIndex] : null
      const finalAmount = selectedMilestone ? Math.round(grandTotal * (selectedMilestone.pct / 100)) : grandTotal
      const milestoneText = selectedMilestone ? `${selectedMilestone.label} (${selectedMilestone.pct}%)` : ''

      const newInv: Invoice = { 
        id: targetId, 
        docId, 
        client: form.client, 
        contact: form.contact, 
        email: form.email, 
        phone: form.phone, 
        businessType: form.businessType, 
        gst: form.gst, 
        serviceIds: form.selectedIds, 
        discountType: form.discountType, 
        discountValue: form.discountValue, 
        gstPct: form.gstPct, 
        notes: form.notes, 
        amount: finalAmount, 
        status: 'draft', 
        created: targetCreated, 
        due: targetDue, 
        history: targetHistory,
        paymentScheduleId: form.paymentScheduleId,
        paymentScheduleEntry: milestoneText,
        invoiceTerms: form.invoiceTerms,
        invoicePaymentInstructions: form.invoicePaymentInstructions,
        invoiceFooter: form.invoiceFooter,
        invoiceAdditionalText: form.invoiceAdditionalText,
        customTerms: form.customTerms,
        adBudget: form.adBudget,
        adBudgetPct: form.adBudgetPct,
        adBudgetFixed: form.adBudgetFixed,
        adBudgetOverride: form.adBudgetOverride,
        adBudgetBillThrough: form.adBudgetBillThrough,
        customSubtotal: form.customSubtotal,
        items: form.items || [],
      }

      await buildAndDownloadPdf(newInv, form.selectedIds, form.discountType, form.discountValue, form.gstPct, docId, form.paymentScheduleId, milestoneText, targetDue)

      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('invoices').insert([{
          id: targetId,
          doc_id: docId,
          client: form.client,
          contact: form.contact,
          email: form.email,
          phone: form.phone,
          business_type: form.businessType,
          gst: form.gst,
          service_ids: form.selectedIds,
          discount_type: form.discountType,
          discount_value: form.discountValue,
          gst_pct: form.gstPct,
          notes: form.notes,
          amount: finalAmount,
          status: 'draft',
          created: targetCreated,
          due: targetDue,
          history: targetHistory,
          payment_schedule_id: form.paymentScheduleId,
          payment_schedule_entry: milestoneText,
          invoice_terms: form.invoiceTerms,
          invoice_payment_instructions: form.invoicePaymentInstructions,
          invoice_footer: form.invoiceFooter,
          invoice_additional_text: form.invoiceAdditionalText,
          custom_terms: form.customTerms,
          ad_budget: form.adBudget,
          ad_budget_pct: form.adBudgetPct,
          ad_budget_fixed: form.adBudgetFixed,
          ad_budget_override: form.adBudgetOverride,
          ad_budget_bill_through: form.adBudgetBillThrough,
          custom_subtotal: form.customSubtotal,
        }])
        if (error) {
          toast({ title: 'Error saving to database', description: error.message, variant: 'destructive' })
          setGenerating(false)
          return
        }

        if (form.items && form.items.length > 0) {
          const { error: itemsErr } = await supabase.from('invoice_items').insert(
            form.items.map((item, idx) => ({
              invoice_id: targetId,
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
            toast({ title: 'Error saving invoice items', description: itemsErr.message, variant: 'destructive' })
          }
        }
      }

      const updatedInvoices = [newInv, ...invoices]
      setInvoices(updatedInvoices)
      setCachedData('invoices', { invoices: updatedInvoices, servicesData, paymentSchedules, companyDocs })
      invalidateCache('dashboard')
      setShowCreate(false); setForm(blankForm(companyDocs))
      toast({ title: '✅ Invoice Created!', description: `${docId} downloaded.` })
    } catch (e: any) { toast({ title: 'PDF Error', description: e.message, variant: 'destructive' }) }
    finally { setGenerating(false) }
  }


  async function handleSaveEdit() {
    if (!editInvoice) return
    setGenerating(true)
    const targetHistory = [...editInvoice.history, { date: new Date().toISOString().split('T')[0], action: 'Document updated', canDownload: true }]

    const selectedSchedule = form.paymentScheduleId ? paymentSchedules.find(p => p.id === form.paymentScheduleId) : null
    const selectedMilestoneIndex = form.paymentSchedulePointIndex !== 'none' ? Number(form.paymentSchedulePointIndex) : -1
    const selectedMilestone = (selectedSchedule && selectedMilestoneIndex >= 0) ? selectedSchedule.points[selectedMilestoneIndex] : null
    const finalAmount = selectedMilestone ? Math.round(grandTotal * (selectedMilestone.pct / 100)) : grandTotal
    const milestoneText = selectedMilestone ? `${selectedMilestone.label} (${selectedMilestone.pct}%)` : ''
    const targetDue = form.due || new Date(Date.now()+10*864e5).toISOString().slice(0,10)

    const updated: Invoice = { 
      ...editInvoice, 
      client: form.client, 
      contact: form.contact, 
      email: form.email, 
      phone: form.phone, 
      businessType: form.businessType, 
      gst: form.gst, 
      serviceIds: form.selectedIds, 
      discountType: form.discountType, 
      discountValue: form.discountValue, 
      gstPct: form.gstPct,
      notes: form.notes,
      amount: finalAmount,
      history: targetHistory,
      paymentScheduleId: form.paymentScheduleId,
      paymentScheduleEntry: milestoneText,
      due: targetDue,
      invoiceTerms: form.invoiceTerms,
      invoicePaymentInstructions: form.invoicePaymentInstructions,
      invoiceFooter: form.invoiceFooter,
      invoiceAdditionalText: form.invoiceAdditionalText,
      customTerms: form.customTerms,
      adBudget: form.adBudget,
      adBudgetPct: form.adBudgetPct,
      adBudgetFixed: form.adBudgetFixed,
      adBudgetOverride: form.adBudgetOverride,
      adBudgetBillThrough: form.adBudgetBillThrough,
      customSubtotal: form.customSubtotal,
      items: form.items || [],
    }

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('invoices').update({
          client: form.client,
          contact: form.contact,
          email: form.email,
          phone: form.phone,
          business_type: form.businessType,
          gst: form.gst,
          service_ids: form.selectedIds,
          discount_type: form.discountType,
          discount_value: form.discountValue,
          gst_pct: form.gstPct,
          notes: form.notes,
          amount: finalAmount,
          history: targetHistory,
          payment_schedule_id: form.paymentScheduleId,
          payment_schedule_entry: milestoneText,
          due: targetDue,
          invoice_terms: form.invoiceTerms,
          invoice_payment_instructions: form.invoicePaymentInstructions,
          invoice_footer: form.invoiceFooter,
          invoice_additional_text: form.invoiceAdditionalText,
          custom_terms: form.customTerms,
          ad_budget: form.adBudget,
          ad_budget_pct: form.adBudgetPct,
          ad_budget_fixed: form.adBudgetFixed,
          ad_budget_override: form.adBudgetOverride,
          ad_budget_bill_through: form.adBudgetBillThrough,
          custom_subtotal: form.customSubtotal,
        }).eq('id', editInvoice.id)

        if (error) {
          toast({ title: 'Error saving edit to database', description: error.message, variant: 'destructive' })
          setGenerating(false)
          return
        }

        // Delete old items and insert new ones
        await supabase.from('invoice_items').delete().eq('invoice_id', editInvoice.id)
        if (form.items && form.items.length > 0) {
          const { error: itemsErr } = await supabase.from('invoice_items').insert(
            form.items.map((item, idx) => ({
              invoice_id: editInvoice.id,
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
            toast({ title: 'Error saving invoice items', description: itemsErr.message, variant: 'destructive' })
          }
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        setGenerating(false)
        return
      }
    }

    const updatedInvoices = invoices.map(i => i.id === editInvoice.id ? updated : i)
    setInvoices(updatedInvoices)
    setCachedData('invoices', { invoices: updatedInvoices, servicesData, paymentSchedules, companyDocs })
    invalidateCache('dashboard')
    setEditInvoice(null); setForm(blankForm(companyDocs))
    toast({ title: '✅ Invoice updated' })
    setGenerating(false)
  }


  async function handleDelete() {
    if (!deleteId) return
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('invoices').delete().eq('id', deleteId)
        if (error) {
          toast({ title: 'Error deleting invoice', description: error.message, variant: 'destructive' })
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        return
      }
    }
    const updatedInvoices = invoices.filter(i => i.id !== deleteId)
    setInvoices(updatedInvoices)
    setCachedData('invoices', { invoices: updatedInvoices, servicesData })
    invalidateCache('dashboard')
    setDeleteId(null)
    toast({ title: 'Invoice deleted' })
  }


  async function updateStatus(id: string, status: string) {
    const targetInv = invoices.find(i => i.id === id)
    if (!targetInv) return
    const targetHistory = [...targetInv.history, { date: new Date().toISOString().split('T')[0], action: `Status changed to ${STATUS_LABELS[status]}` }]

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('invoices').update({
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

    const updatedInvoices = invoices.map(i => i.id === id ? { ...i, status, history: targetHistory } : i)
    setInvoices(updatedInvoices)
    setCachedData('invoices', { invoices: updatedInvoices, servicesData, paymentSchedules, companyDocs })
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
        status: 'sent'
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
        .from('invoices')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    }

    const updatedInvoices = invoices.map(i => i.id === id ? { ...i, ...updates } : i)
    setInvoices(updatedInvoices)
    setCachedData('invoices', { invoices: updatedInvoices, servicesData, paymentSchedules, companyDocs })
    invalidateCache('dashboard')
  }




  const totals = { total: invoices.reduce((a, i) => a + i.amount, 0), paid: invoices.filter(i => i.status === 'paid').reduce((a, i) => a + i.amount, 0), pending: invoices.filter(i => i.status !== 'paid').reduce((a, i) => a + i.amount, 0), overdue: invoices.filter(i => i.status === 'overdue').reduce((a, i) => a + i.amount, 0) }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Create and manage tax invoices for clients."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Documents', href: '/documents' },
          { label: 'Invoices' }
        ]}
        primaryAction={{
          label: 'New Invoice',
          onClick: () => { setForm(blankForm(companyDocs)); setShowCreate(true) },
          icon: Plus,
          variant: 'gold'
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ l: 'Total Billed', v: formatCurrency(totals.total) }, { l: 'Paid', v: formatCurrency(totals.paid), c: 'text-emerald-400' }, { l: 'Pending', v: formatCurrency(totals.pending) }, { l: 'Overdue', v: formatCurrency(totals.overdue), c: 'text-red-400' }].map(s => (
          <Card key={s.l}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.l}</p><p className={`text-lg font-bold mt-1 ${s.c || ''}`}>{s.v}</p></CardContent></Card>
        ))}
      </div>

      <DataTable
        data={invoices}
        columns={columns}
        searchPlaceholder="Search invoices by client or ID..."
        searchKeys={['client', 'docId']}
        exportFileName="invoices"
        initialSearch={searchParams.get('search') || searchParams.get('client') || ''}
        savedFiltersKey="invoices"
        enableBulkSelect={true}
        bulkActions={[
          { label: 'Delete Selected', action: 'delete', variant: 'destructive', icon: Trash2 },
          { label: 'Mark Paid', action: 'status_paid', icon: Receipt },
          { label: 'Mark Overdue', action: 'status_overdue', icon: Receipt }
        ]}
        onBulkAction={handleBulkAction}
        filterDefs={[
          {
            key: 'status',
            label: 'Status',
            options: STATUS_OPTS.map(s => ({ label: STATUS_LABELS[s], value: s }))
          }
        ]}
        emptyTitle="No invoices found"
        emptyDescription="Create your first invoice or adjust your filters."
        emptyIcon={Receipt}
        emptyAction={{ label: 'New Invoice', onClick: () => { setForm(blankForm(companyDocs)); setShowCreate(true) }, icon: Plus }}
      />

      <Drawer
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setServiceSearch(''); setForm(blankForm(companyDocs)); setShowPreviewPanel(false) }}
        title="Create New Invoice"
        description="Choose a template, configure billing details, items, discounts, GST, and payment schedule."
        widthClass="max-w-7xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowPreviewPanel(v => !v)} className="gap-1.5 mr-auto">
              <Eye className="h-3.5 w-3.5" />
              {showPreviewPanel ? 'Hide Preview' : 'Show Preview'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setForm(blankForm(companyDocs)) }}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleGenerate} disabled={generating || (form.items?.length ?? 0) === 0}>
              {generating ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Generating...</> : `Generate Invoice${invoiceAmount > 0 ? ` (${formatCurrency(invoiceAmount)})` : ''}`}
            </Button>
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
                  const previewPayload = {
                    docType: 'Invoice' as const,
                    templateId: id,
                    clientName: form.contact || form.client || 'Preview Client',
                    projectTitle: 'Invoice Preview',
                    companyName: form.client || 'Preview Company',
                    clientInfo: { business: form.businessType },
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
          <div className="space-y-6 py-2">
            <div>
              <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Client Information</p>
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
                      email: client.email || '',
                      phone: client.phone || '',
                      businessType: client.type || form.businessType,
                      gst: client.gst || form.gst
                    })}
                  />
                </div>
                <div className="space-y-1"><Label>Contact Person</Label><Input placeholder="Representative" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></div>
                <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label>Business Type</Label>
                  <Input 
                    value={form.businessType || ''} 
                    readOnly 
                    className="bg-muted/50 cursor-not-allowed opacity-80" 
                    placeholder="Auto-populated from CRM"
                  />
                </div>
                <div className="space-y-1"><Label>GST Number</Label><Input placeholder="Optional" value={form.gst} onChange={e => setForm({ ...form, gst: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label>Due Date *</Label>
                  <Input type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} />
                </div>
              </div>
            </div>
            <div>
              <LineItemsTable variant="full"
                items={form.items || []}
                onChange={(items) => {
                  setForm({
                    ...form,
                    items,
                    selectedIds: items.map(i => i.service_id).filter(Boolean) as string[]
                  })
                }}
              />
            </div>

            {selSvcs.some(s => s.catId === '3') && (
              <div className="border border-gold/30 rounded-lg p-4 bg-gold/5 space-y-4">
                <p className="text-xs font-semibold text-gold uppercase tracking-wide flex items-center gap-1.5">
                  💰 Paid Advertising Settings
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Monthly Ad Budget (₹) *</Label>
                    <Input 
                      type="number" 
                      placeholder="e.g. 100000" 
                      value={form.adBudget || ''} 
                      onChange={e => {
                        const val = Number(e.target.value);
                        setForm({ ...form, adBudget: val });
                      }} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Service Fee Model</Label>
                    <div className="flex gap-1 bg-muted/40 p-1 rounded-md border border-border">
                      {[10, 15, 20].map(pct => (
                        <Button 
                          key={pct} 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setForm({ ...form, adBudgetOverride: false, adBudgetPct: pct })} 
                          className={`flex-1 h-7 text-xs ${(!form.adBudgetOverride && form.adBudgetPct === pct) ? 'bg-background shadow-sm text-gold' : 'text-muted-foreground'}`}
                        >
                          {pct}%
                        </Button>
                      ))}
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setForm({ ...form, adBudgetOverride: true })} 
                        className={`flex-1 h-7 text-xs ${form.adBudgetOverride ? 'bg-background shadow-sm text-gold' : 'text-muted-foreground'}`}
                      >
                        Custom Fee
                      </Button>
                    </div>
                  </div>
                </div>

                {form.adBudgetOverride ? (
                  <div className="space-y-1 max-w-sm">
                    <Label>Custom Service Fee (₹)</Label>
                    <Input 
                      type="number" 
                      placeholder="e.g. 15000" 
                      value={form.adBudgetFixed || ''} 
                      onChange={e => setForm({ ...form, adBudgetFixed: Number(e.target.value) })} 
                    />
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Calculated Service Fee: <span className="font-semibold text-gold">{formatCurrency(Math.round((form.adBudget || 0) * ((form.adBudgetPct || 15) / 100)))}</span> ({form.adBudgetPct}% of {formatCurrency(form.adBudget || 0)})
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border/50 pt-3">
                  <div>
                    <Label className="text-sm font-medium">Bill Ad Budget through Netgain</Label>
                    <p className="text-xs text-muted-foreground">Include the ad spend itself in the total payable invoice amount.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, adBudgetBillThrough: !form.adBudgetBillThrough })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${form.adBudgetBillThrough ? 'bg-gold' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${form.adBudgetBillThrough ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            )}
            {(form.items?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Pricing</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="col-span-1 sm:col-span-2 space-y-1">
                    <Label>Discount Type</Label>
                    <div className="flex bg-muted/30 p-1 rounded-md border border-border">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, discountType: 'percentage' })} className={`flex-1 h-7 text-xs ${form.discountType === 'percentage' ? 'bg-background shadow-sm text-gold' : 'text-muted-foreground'}`}>Percentage (%)</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, discountType: 'fixed' })} className={`flex-1 h-7 text-xs ${form.discountType === 'fixed' ? 'bg-background shadow-sm text-gold' : 'text-muted-foreground'}`}>Fixed (₹)</Button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="space-y-1"><Label>{form.discountType === 'percentage' ? 'Discount (%)' : 'Discount Amount'}</Label><Input type="number" min="0" max={form.discountType === 'percentage' ? "100" : undefined} value={form.discountValue || ''} placeholder="0" onChange={e => setForm({ ...form, discountValue: Number(e.target.value) })} /></div>
                  <div className="space-y-1"><Label>GST (%)</Label><Input type="number" min="0" max="28" value={form.gstPct || ''} placeholder="0" onChange={e => setForm({ ...form, gstPct: Number(e.target.value) })} /></div>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Base Subtotal</span>
                      {hasRange ? (
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            className="w-28 h-7 text-right text-xs bg-muted/30 text-gold font-bold border-gold/30" 
                            min={totalMinPrice} 
                            max={totalMaxPrice} 
                            value={form.customSubtotal ?? computedSubStandard} 
                            onChange={e => {
                              const val = Number(e.target.value)
                              handleCustomSubtotalChange(val)
                            }}
                          />
                          <span className="text-xs text-muted-foreground">
                            (Range: {formatCurrency(totalMinPrice)} - {formatCurrency(totalMaxPrice)})
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            className="w-28 h-7 text-right text-xs bg-muted/30 text-gold font-bold border-gold/30" 
                            value={form.customSubtotal ?? computedSubStandard} 
                            onChange={e => {
                              const val = Number(e.target.value)
                              handleCustomSubtotalChange(val)
                            }}
                          />
                        </div>
                      )}
                    </div>
                    {hasRange && (
                      <div className="pt-1">
                        <input 
                          type="range" 
                          min={totalMinPrice} 
                          max={totalMaxPrice} 
                          value={form.customSubtotal ?? computedSubStandard} 
                          onChange={e => handleCustomSubtotalChange(Number(e.target.value))}
                          className="w-full accent-gold bg-muted/30" 
                        />
                      </div>
                    )}
                    {form.adBudgetBillThrough && (form.adBudget || 0) > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Ad Spend (Bill-through)</span>
                        <span>{formatCurrency(form.adBudget)}</span>
                      </div>
                    )}
                    {form.adBudgetBillThrough && (form.adBudget || 0) > 0 && (
                      <div className="flex justify-between font-semibold border-t border-border/50 pt-1">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                    )}
                  </div>
                  {discAmt > 0 && <div className="flex justify-between text-emerald-400"><span>Discount</span><span>−{formatCurrency(discAmt)}</span></div>}
                  {form.gstPct > 0 && <div className="flex justify-between text-muted-foreground"><span>GST ({form.gstPct}%)</span><span>+{formatCurrency(gstAmt)}</span></div>}
                  <div className="flex justify-between font-bold text-gold border-t border-border pt-2 text-base">
                    <span>Total Payable</span>
                    <div className="text-right">
                      <span>{formatCurrency(invoiceAmount)}</span>
                      {selectedMilestone && (
                        <p className="text-[10px] text-muted-foreground font-normal">
                          ({selectedMilestone.label} - {selectedMilestone.pct}% of {formatCurrency(grandTotal)} project total)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {paymentSchedules && paymentSchedules.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Payment Schedule</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Schedule Type</Label>
                    <Select value={form.paymentScheduleId} onValueChange={v => setForm({ ...form, paymentScheduleId: v, paymentSchedulePointIndex: 'none' })}>
                      <SelectTrigger><SelectValue placeholder="Select a payment schedule..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (Full Payment)</SelectItem>
                        {paymentSchedules.map(ps => (
                          <SelectItem key={ps.id} value={ps.id}>{ps.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {form.paymentScheduleId && form.paymentScheduleId !== 'none' && paymentSchedules.find(p => p.id === form.paymentScheduleId) && (
                    <div className="space-y-1">
                      <Label className="text-xs">Milestone / Installment *</Label>
                      <Select value={form.paymentSchedulePointIndex} onValueChange={v => setForm({ ...form, paymentSchedulePointIndex: v })}>
                        <SelectTrigger><SelectValue placeholder="Select milestone..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Full Amount (100%)</SelectItem>
                          {paymentSchedules.find(p => p.id === form.paymentScheduleId).points.map((pt: any, i: number) => (
                            <SelectItem key={i} value={String(i)}>{pt.label} ({pt.pct}%)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {form.paymentScheduleId && form.paymentScheduleId !== 'none' && paymentSchedules.find(p => p.id === form.paymentScheduleId) && (
                  <div className="mt-3 space-y-2 border border-border/50 rounded-lg p-3 bg-muted/10">
                    {paymentSchedules.find(p => p.id === form.paymentScheduleId).points.map((pt: any, i: number) => {
                      const isSelected = form.paymentSchedulePointIndex === String(i)
                      return (
                        <div key={i} className={`flex justify-between text-sm py-0.5 px-1.5 rounded transition-colors ${isSelected ? 'bg-gold/10 text-gold font-medium' : 'text-muted-foreground'}`}>
                          <span>{pt.label} ({pt.pct}%)</span>
                          <span>{formatCurrency(Math.round(grandTotal * (pt.pct / 100)))}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Terms & Conditions Overrides</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/10 p-3 rounded-lg border border-border/50">
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <Label>Payment Instructions</Label>
                  <Textarea className="resize-none h-16" placeholder="Account Name, Bank, IFSC, UPI ID..." value={form.invoicePaymentInstructions} onChange={e => setForm({ ...form, invoicePaymentInstructions: e.target.value })} />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <Label>Terms & Conditions (One per line)</Label>
                  <Textarea className="h-32 font-mono text-xs" placeholder="Enter each term on a new line..." value={form.customTerms} onChange={e => setForm({ ...form, customTerms: e.target.value })} />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <Label>Footer Text</Label>
                  <Textarea className="resize-none h-16" placeholder="Company contact details, GST, Address..." value={form.invoiceFooter} onChange={e => setForm({ ...form, invoiceFooter: e.target.value })} />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <Label>Additional Text</Label>
                  <Textarea className="resize-none h-16" placeholder="Any extra information..." value={form.invoiceAdditionalText} onChange={e => setForm({ ...form, invoiceAdditionalText: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="space-y-1"><Label>Notes</Label><Textarea className="resize-none h-16" placeholder="Payment instructions, custom notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          </div>
          {/* Right: Live Preview */}
          {showPreviewPanel && (
            <div className="hidden lg:block h-full min-h-[600px]">
              <LivePreviewPanel
                payload={form.client ? {
                  docType: 'Invoice',
                  templateId,
                  clientName: form.contact || form.client,
                  projectTitle: `Invoice - ${(form as any).docId || 'Preview'}`,
                  companyName: form.client,
                  clientInfo: { business: form.businessType, mobile: form.phone, gst: form.gst },
                } : null}
                visible
              />
            </div>
          )}
        </div>
      </Drawer>

      <Drawer
        isOpen={!!editInvoice}
        onClose={() => { setEditInvoice(null); setServiceSearch(''); setForm(blankForm(companyDocs)) }}
        title={`Edit Invoice - ${editInvoice?.docId}`}
        description="Modify billing details, items, discounts, GST, and payment schedule."
        widthClass="max-w-3xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => { setEditInvoice(null); setForm(blankForm(companyDocs)) }} disabled={generating}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleSaveEdit} disabled={generating} className="gap-2">
              {generating ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
            </Button>
          </>
        }
      >
          <div className="space-y-6 py-2">
            <div>
              <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Client Information</p>
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
                      email: client.email || '',
                      phone: client.phone || '',
                      businessType: client.type || form.businessType,
                      gst: client.gst || form.gst
                    })}
                  />
                </div>
                <div className="space-y-1"><Label>Contact Person</Label><Input placeholder="Representative" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></div>
                <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label>Business Type</Label>
                  <Input 
                    value={form.businessType || ''} 
                    readOnly 
                    className="bg-muted/50 cursor-not-allowed opacity-80" 
                    placeholder="Auto-populated from CRM"
                  />
                </div>
                <div className="space-y-1"><Label>GST Number</Label><Input placeholder="Optional" value={form.gst} onChange={e => setForm({ ...form, gst: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label>Due Date *</Label>
                  <Input type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} />
                </div>
              </div>
            </div>
            <div>
              <LineItemsTable variant="full"
                items={form.items || []}
                onChange={(items) => {
                  setForm({
                    ...form,
                    items,
                    selectedIds: items.map(i => i.service_id).filter(Boolean) as string[]
                  })
                }}
              />
            </div>

            {selSvcs.some(s => s.catId === '3') && (
              <div className="border border-gold/30 rounded-lg p-4 bg-gold/5 space-y-4">
                <p className="text-xs font-semibold text-gold uppercase tracking-wide flex items-center gap-1.5">
                  💰 Paid Advertising Settings
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Monthly Ad Budget (₹) *</Label>
                    <Input 
                      type="number" 
                      placeholder="e.g. 100000" 
                      value={form.adBudget || ''} 
                      onChange={e => {
                        const val = Number(e.target.value);
                        setForm({ ...form, adBudget: val });
                      }} 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Service Fee Model</Label>
                    <div className="flex gap-1 bg-muted/40 p-1 rounded-md border border-border">
                      {[10, 15, 20].map(pct => (
                        <Button 
                          key={pct} 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setForm({ ...form, adBudgetOverride: false, adBudgetPct: pct })} 
                          className={`flex-1 h-7 text-xs ${(!form.adBudgetOverride && form.adBudgetPct === pct) ? 'bg-background shadow-sm text-gold' : 'text-muted-foreground'}`}
                        >
                          {pct}%
                        </Button>
                      ))}
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setForm({ ...form, adBudgetOverride: true })} 
                        className={`flex-1 h-7 text-xs ${form.adBudgetOverride ? 'bg-background shadow-sm text-gold' : 'text-muted-foreground'}`}
                      >
                        Custom Fee
                      </Button>
                    </div>
                  </div>
                </div>

                {form.adBudgetOverride ? (
                  <div className="space-y-1 max-w-sm">
                    <Label>Custom Service Fee (₹)</Label>
                    <Input 
                      type="number" 
                      placeholder="e.g. 15000" 
                      value={form.adBudgetFixed || ''} 
                      onChange={e => setForm({ ...form, adBudgetFixed: Number(e.target.value) })} 
                    />
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Calculated Service Fee: <span className="font-semibold text-gold">{formatCurrency(Math.round((form.adBudget || 0) * ((form.adBudgetPct || 15) / 100)))}</span> ({form.adBudgetPct}% of {formatCurrency(form.adBudget || 0)})
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border/50 pt-3">
                  <div>
                    <Label className="text-sm font-medium">Bill Ad Budget through Netgain</Label>
                    <p className="text-xs text-muted-foreground">Include the ad spend itself in the total payable invoice amount.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, adBudgetBillThrough: !form.adBudgetBillThrough })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${form.adBudgetBillThrough ? 'bg-gold' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${form.adBudgetBillThrough ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            )}
            {(form.items?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Pricing</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="col-span-1 sm:col-span-2 space-y-1">
                    <Label>Discount Type</Label>
                    <div className="flex bg-muted/30 p-1 rounded-md border border-border">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, discountType: 'percentage' })} className={`flex-1 h-7 text-xs ${form.discountType === 'percentage' ? 'bg-background shadow-sm text-gold' : 'text-muted-foreground'}`}>Percentage (%)</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, discountType: 'fixed' })} className={`flex-1 h-7 text-xs ${form.discountType === 'fixed' ? 'bg-background shadow-sm text-gold' : 'text-muted-foreground'}`}>Fixed (₹)</Button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="space-y-1"><Label>{form.discountType === 'percentage' ? 'Discount (%)' : 'Discount Amount'}</Label><Input type="number" min="0" max={form.discountType === 'percentage' ? "100" : undefined} value={form.discountValue || ''} placeholder="0" onChange={e => setForm({ ...form, discountValue: Number(e.target.value) })} /></div>
                  <div className="space-y-1"><Label>GST (%)</Label><Input type="number" min="0" max="28" value={form.gstPct || ''} placeholder="0" onChange={e => setForm({ ...form, gstPct: Number(e.target.value) })} /></div>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Base Subtotal</span>
                      {hasRange ? (
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            className="w-28 h-7 text-right text-xs bg-muted/30 text-gold font-bold border-gold/30" 
                            min={totalMinPrice} 
                            max={totalMaxPrice} 
                            value={form.customSubtotal ?? computedSubStandard} 
                            onChange={e => {
                              const val = Number(e.target.value)
                              handleCustomSubtotalChange(val)
                            }}
                          />
                          <span className="text-xs text-muted-foreground">
                            (Range: {formatCurrency(totalMinPrice)} - {formatCurrency(totalMaxPrice)})
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            className="w-28 h-7 text-right text-xs bg-muted/30 text-gold font-bold border-gold/30" 
                            value={form.customSubtotal ?? computedSubStandard} 
                            onChange={e => {
                              const val = Number(e.target.value)
                              handleCustomSubtotalChange(val)
                            }}
                          />
                        </div>
                      )}
                    </div>
                    {hasRange && (
                      <div className="pt-1">
                        <input 
                          type="range" 
                          min={totalMinPrice} 
                          max={totalMaxPrice} 
                          value={form.customSubtotal ?? computedSubStandard} 
                          onChange={e => handleCustomSubtotalChange(Number(e.target.value))}
                          className="w-full accent-gold bg-muted/30" 
                        />
                      </div>
                    )}
                    {form.adBudgetBillThrough && (form.adBudget || 0) > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Ad Spend (Bill-through)</span>
                        <span>{formatCurrency(form.adBudget)}</span>
                      </div>
                    )}
                    {form.adBudgetBillThrough && (form.adBudget || 0) > 0 && (
                      <div className="flex justify-between font-semibold border-t border-border/50 pt-1">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                    )}
                  </div>
                  {discAmt > 0 && <div className="flex justify-between text-emerald-400"><span>Discount</span><span>−{formatCurrency(discAmt)}</span></div>}
                  {form.gstPct > 0 && <div className="flex justify-between text-muted-foreground"><span>GST ({form.gstPct}%)</span><span>+{formatCurrency(gstAmt)}</span></div>}
                  <div className="flex justify-between font-bold text-gold border-t border-border pt-2 text-base">
                    <span>Total Payable</span>
                    <div className="text-right">
                      <span>{formatCurrency(invoiceAmount)}</span>
                      {selectedMilestone && (
                        <p className="text-[10px] text-muted-foreground font-normal">
                          ({selectedMilestone.label} - {selectedMilestone.pct}% of {formatCurrency(grandTotal)} project total)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {paymentSchedules && paymentSchedules.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Payment Schedule</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Schedule Type</Label>
                    <Select value={form.paymentScheduleId} onValueChange={v => setForm({ ...form, paymentScheduleId: v, paymentSchedulePointIndex: 'none' })}>
                      <SelectTrigger><SelectValue placeholder="Select a payment schedule..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (Full Payment)</SelectItem>
                        {paymentSchedules.map(ps => (
                          <SelectItem key={ps.id} value={ps.id}>{ps.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {form.paymentScheduleId && form.paymentScheduleId !== 'none' && paymentSchedules.find(p => p.id === form.paymentScheduleId) && (
                    <div className="space-y-1">
                      <Label className="text-xs">Milestone / Installment *</Label>
                      <Select value={form.paymentSchedulePointIndex} onValueChange={v => setForm({ ...form, paymentSchedulePointIndex: v })}>
                        <SelectTrigger><SelectValue placeholder="Select milestone..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Full Amount (100%)</SelectItem>
                          {paymentSchedules.find(p => p.id === form.paymentScheduleId).points.map((pt: any, i: number) => (
                            <SelectItem key={i} value={String(i)}>{pt.label} ({pt.pct}%)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {form.paymentScheduleId && form.paymentScheduleId !== 'none' && paymentSchedules.find(p => p.id === form.paymentScheduleId) && (
                  <div className="mt-3 space-y-2 border border-border/50 rounded-lg p-3 bg-muted/10">
                    {paymentSchedules.find(p => p.id === form.paymentScheduleId).points.map((pt: any, i: number) => {
                      const isSelected = form.paymentSchedulePointIndex === String(i)
                      return (
                        <div key={i} className={`flex justify-between text-sm py-0.5 px-1.5 rounded transition-colors ${isSelected ? 'bg-gold/10 text-gold font-medium' : 'text-muted-foreground'}`}>
                          <span>{pt.label} ({pt.pct}%)</span>
                          <span>{formatCurrency(Math.round(grandTotal * (pt.pct / 100)))}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Terms & Conditions Overrides</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/10 p-3 rounded-lg border border-border/50">
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <Label>Payment Instructions</Label>
                  <Textarea className="resize-none h-16" placeholder="Account Name, Bank, IFSC, UPI ID..." value={form.invoicePaymentInstructions} onChange={e => setForm({ ...form, invoicePaymentInstructions: e.target.value })} />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <Label>Terms & Conditions (One per line)</Label>
                  <Textarea className="h-32 font-mono text-xs" placeholder="Enter each term on a new line..." value={form.customTerms} onChange={e => setForm({ ...form, customTerms: e.target.value })} />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <Label>Footer Text</Label>
                  <Textarea className="resize-none h-16" placeholder="Company contact details, GST, Address..." value={form.invoiceFooter} onChange={e => setForm({ ...form, invoiceFooter: e.target.value })} />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <Label>Additional Text</Label>
                  <Textarea className="resize-none h-16" placeholder="Any extra information..." value={form.invoiceAdditionalText} onChange={e => setForm({ ...form, invoiceAdditionalText: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="space-y-1"><Label>Notes</Label><Textarea className="resize-none h-16" placeholder="Payment instructions, custom notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
      </Drawer>

      {/* Delete Confirmation */}
      <DeleteDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Invoice?"
        description="This action cannot be undone. This will permanently delete the invoice reference."
        confirmLabel="Delete Invoice"
        onConfirm={handleDelete}
      />

      {/* Manage Business Types Dialog */}
      <Dialog open={showManageBusinessTypes} onOpenChange={setShowManageBusinessTypes}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Business Types</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input 
                placeholder="New Business Type (e.g. Agency)" 
                value={newBusinessTypeName} 
                onChange={e => setNewBusinessTypeName(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleAddBusinessType()}
              />
              <Button variant="gold" onClick={handleAddBusinessType} className="gap-1">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            <div className="border border-border rounded-lg max-h-[250px] overflow-y-auto divide-y divide-border">
              {businessTypes.map((type, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 hover:bg-muted/10">
                  {editingBusinessTypeIndex === idx ? (
                    <div className="flex items-center gap-2 w-full pr-2">
                      <Input 
                        value={editingBusinessTypeName} 
                        onChange={e => setEditingBusinessTypeName(e.target.value)}
                        className="h-8 py-1"
                        onKeyDown={e => e.key === 'Enter' && handleEditBusinessType(idx)}
                      />
                      <Button size="sm" className="h-8 px-2" onClick={() => handleEditBusinessType(idx)}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditingBusinessTypeIndex(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium">{type}</span>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditingBusinessTypeIndex(idx)
                            setEditingBusinessTypeName(type)
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-red-400 hover:text-red-400"
                          onClick={() => handleDeleteBusinessType(type)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowManageBusinessTypes(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyDoc} onOpenChange={(open) => !open && setHistoryDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="border-b border-white/10 pb-3">
            <DialogTitle>Document History - {historyDoc?.docId}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">{historyDoc?.client} · Click any entry to download that version</p>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-[50vh] overflow-y-auto">
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
        initialEmail={shareDoc ? invoices.find(i => i.id === shareDoc.id)?.email || '' : ''}
        initialSubject={shareDoc ? `Invoice: ${invoices.find(i => i.id === shareDoc.id)?.docId} - ${invoices.find(i => i.id === shareDoc.id)?.client}` : ''}
        initialMessage={shareDoc ? (() => {
          const inv = invoices.find(i => i.id === shareDoc.id)
          if (!inv) return ''
          return `Dear ${inv.client},\n\nPlease find your invoice ${inv.docId} for the amount of ${formatCurrency(inv.amount)}.\n\nDue Date: ${formatDate(inv.due)}\n\nKindly process payment at your earliest convenience.\n\nBest regards,\nNetgain Team`
        })() : ''}
        onSend={async (methods, emailDetails) => {
          if (!shareDoc) return

          const inv = invoices.find(i => i.id === shareDoc.id)
          if (!inv) throw new Error('Invoice not found')

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
              recipient = emailDetails?.recipient || inv.email
              subject = emailDetails?.subject || `Invoice: ${inv.docId} - ${inv.client}`
              message = emailDetails?.message || `Dear ${inv.client},\n\nPlease find your invoice ${inv.docId} for the amount of ${formatCurrency(inv.amount)}.\n\nDue Date: ${formatDate(inv.due)}\n\nKindly process payment at your earliest convenience.\n\nBest regards,\nNetgain Team`
              
              // Generate matching PDF payload on the fly
              const svcs = servicesData.filter(s => inv.serviceIds.includes(s.id))
              
              // Calculate dynamic price for Paid Advertising services (catId === '3')
              const adBudgetFee = inv.adBudgetOverride 
                ? (inv.adBudgetFixed || 0) 
                : Math.round((inv.adBudget || 0) * ((inv.adBudgetPct || 15) / 100))

              const computedSub = svcs.reduce((sum, s) => {
                if (s.catId === '3') {
                  return sum + s.price + adBudgetFee
                }
                return sum + s.price
              }, 0)

              const baseSub = computedSub + (inv.adBudgetBillThrough ? (inv.adBudget || 0) : 0)
              const dAmt = inv.discountType === 'percentage' ? Math.round(baseSub * inv.discountValue / 100) : inv.discountValue
              const aft = Math.max(0, baseSub - dAmt)
              const gAmt = Math.round(aft * inv.gstPct / 100)
              const tot = aft + gAmt

              let pct = 100
              if (inv.paymentScheduleEntry) {
                const match = inv.paymentScheduleEntry.match(/\((\d+)%\)/)
                if (match) {
                  pct = Number(match[1])
                }
              }
              const scaleFactor = pct / 100
              const scaledSub = Math.round(baseSub * scaleFactor)
              const scaledDAmt = Math.round(dAmt * scaleFactor)
              const scaledAft = Math.max(0, scaledSub - scaledDAmt)
              const scaledGAmt = Math.round(scaledAft * inv.gstPct / 100)
              const scaledTot = scaledAft + scaledGAmt

              const scaledItems: any[] = []
              svcs.forEach(s => {
                if (s.catId === '3') {
                  // 1. One-time Setup Cost
                  const scaledSetup = Math.round(s.price * scaleFactor)
                  scaledItems.push({
                    serviceName: inv.paymentScheduleEntry ? `${s.name} - Setup Cost - ${inv.paymentScheduleEntry}` : `${s.name} - Setup Cost`,
                    finalPrice: scaledSetup,
                    price: scaledSetup,
                    quantity: 1,
                    category: s.category,
                    pricing_model: 'fixed',
                    deliverables: [`Campaign structure setup and onboarding for ${s.name}`],
              tax: Math.round(scaledSetup * inv.gstPct / 100)
                  })
                  // 2. Monthly Service Fee
                  const scaledFee = Math.round(adBudgetFee * scaleFactor)
                  scaledItems.push({
                    serviceName: inv.paymentScheduleEntry ? `${s.name} - Monthly Service Fee - ${inv.paymentScheduleEntry}` : `${s.name} - Monthly Service Fee`,
                    finalPrice: scaledFee,
                    price: scaledFee,
                    quantity: 1,
                    category: s.category,
                    pricing_model: 'monthly',
              deliverables: s.deliverables,
              tax: Math.round(scaledFee * inv.gstPct / 100)
                  })
                } else {
                  const scaledPrice = Math.round(s.price * scaleFactor)
                  let customName = s.name
                  if (inv.paymentScheduleEntry) {
                    customName = `${s.name} - ${inv.paymentScheduleEntry}`
                  }
                  scaledItems.push({
                    serviceName: customName,
                    finalPrice: scaledPrice,
                    price: scaledPrice,
                    quantity: 1,
                    category: s.category,
                    pricing_model: s.model,
              deliverables: s.deliverables,
              tax: Math.round(scaledPrice * inv.gstPct / 100)
                  })
                }
              })

              // Append ad budget to items list if billed through
              if (inv.adBudgetBillThrough && inv.adBudget && inv.adBudget > 0) {
                const scaledBudget = Math.round(inv.adBudget * scaleFactor)
                scaledItems.push({
                  serviceName: inv.paymentScheduleEntry ? `Ad Budget (Paid Ads Spend) - ${inv.paymentScheduleEntry}` : "Ad Budget (Paid Ads Spend)",
                  finalPrice: scaledBudget,
                  price: scaledBudget,
                  quantity: 1,
                  category: "Ad Spend",
                  pricing_model: "monthly",
                  deliverables: ["Advertising spend budget on Google/Meta networks"]
                })
              }

              const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
              const dueFormatted = inv.due
                ? new Date(inv.due).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                : new Date(Date.now() + 10 * 864e5).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

              pdfPayload = {
                docType: 'Invoice',
                clientName: inv.contact || inv.client,
                projectTitle: `Invoice - ${inv.docId}`,
                companyName: inv.client,
                clientInfo: { business: inv.businessType, mobile: inv.phone, gst: inv.gst },
                content: [
                  `## Invoice Details`,
                  `**Invoice Date:** ${todayStr}  |  **Due Date:** ${dueFormatted}`,
                  `**Invoice Ref:** ${inv.docId}`,
                  `${inv.gst ? `**Client GST:** ${inv.gst}` : ''}`,
                  '',
                  '## Services',
                  ...scaledItems.flatMap((s: any, i: number) => [
                    `### ${i + 1}. ${s.serviceName}`,
                    `Category: ${s.category}  |  ${s.pricing_model === 'monthly' ? 'Monthly Recurring' : 'One-Time'}`,
                    ...(s.deliverables?.map((d: any) => `- ${d}`) || []),
                    '',
                  ]),
                  '## Payment Details',
                  '__BANK_DETAILS__',
                  ...(inv.invoicePaymentInstructions ? ['', inv.invoicePaymentInstructions] : (companyDocs?.invoicePaymentInstructions ? ['', companyDocs.invoicePaymentInstructions] : [])),
                  ...(inv.invoiceAdditionalText ? ['', '## Additional Details', inv.invoiceAdditionalText] : (companyDocs?.invoiceAdditionalText ? ['', '## Additional Details', companyDocs.invoiceAdditionalText] : [])),
                  ...(inv.notes ? ['', '## Notes', inv.notes] : []),
                ].join('\n'),
                items: scaledItems,
                subtotal: scaledSub,
                discountTotal: scaledDAmt,
                grandTotal: scaledTot,
                fullProjectTotal: tot,
                fullSubtotal: baseSub,
                paymentScheduleObj: inv.paymentScheduleId ? paymentSchedules.find(p => p.id === inv.paymentScheduleId) : null,
                adBudget: inv.adBudget,
                adBudgetPct: inv.adBudgetPct,
                adBudgetFixed: inv.adBudgetFixed,
                adBudgetOverride: inv.adBudgetOverride,
                adBudgetBillThrough: inv.adBudgetBillThrough,
                docsSettings: {
                  gstRate: String(inv.gstPct),
                  invoiceTerms: inv.invoiceTerms !== undefined && inv.invoiceTerms !== null ? inv.invoiceTerms : (companyDocs?.invoiceTerms || ''),
                  invoiceFooter: inv.invoiceFooter !== undefined && inv.invoiceFooter !== null ? inv.invoiceFooter : (companyDocs?.invoiceFooter || ''),
                  customTerms: inv.customTerms || getInvoiceTerms(inv, companyDocs),
                },
              }
            } else if (method === 'whatsapp' || method === 'sms') {
              recipient = inv.phone
              message = `Dear ${inv.client}, your invoice ${inv.docId} for ${formatCurrency(inv.amount)} is due on ${formatDate(inv.due)}. Please process payment at your earliest convenience. - Netgain Team`
            }

            if (!recipient) {
              throw new Error(`No ${method === 'email' ? 'email address' : 'phone number'} found for this client. Please edit the invoice to add contact details.`)
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
        docTitle={publishDoc?.docId || ''}
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
        title={`Invoice - ${previewDoc?.client || ''}`}
        subTitle={previewDoc?.docId || ''}
        blobUrl={previewBlobUrl}
        loading={previewLoading}
      />
    </div>
  )
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={null}>
      <InvoicesPageContent />
    </Suspense>
  )
}


