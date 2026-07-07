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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { Drawer } from '@/components/ui/drawer'
import { DeleteDialog } from '@/components/ui/dialog-variants'
import { EmptyState } from '@/components/ui/empty-state'
import { Search, Plus, Download, Send, Trash2, Pencil, Loader2, FileText, History, Globe } from 'lucide-react'
import { formatCurrency, formatDate, getDocStatusColor, generateDocId } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { ShareDialog } from '@/components/ui/share-dialog'
import { PublishDialog } from '@/components/ui/publish-dialog'
import { UniversalTimeline } from '@/components/ui/version-timeline'
import { useUser } from '@/components/user-provider'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { fetchFounderProfile } from '@/lib/founder-helper'
import { ClientAutocomplete } from '@/components/ui/client-autocomplete'
import { LineItemsTable } from '@/components/ui/line-items-table'
import { getCachedData, setCachedData, invalidateCache } from '@/lib/data-cache'



const STATUS_OPTS = ['draft', 'sent', 'published', 'viewed', 'needs revision', 'approved', 'rejected', 'completed', 'signed']
const STATUS_LABELS: Record<string, string> = { 
  draft: 'Draft', 
  sent: 'Sent', 
  published: 'Published',
  viewed: 'Viewed',
  'needs revision': 'Needs Revision',
  approved: 'Approved', 
  rejected: 'Rejected', 
  completed: 'Completed',
  signed: 'Signed'
}

type Quote = {
  id: string; docId: string; client: string; contact: string; email: string; phone: string
  businessType: string; industry: string; gst: string; projectTitle: string
  serviceIds: string[]; discountPct: number; gstPct: number; notes: string
  amount: number; status: string; created: string; valid: string
  history: { date: string; action: string; canDownload?: boolean }[]
  paymentScheduleId?: string;
  validityDays?: number;
  paymentTermsOneTime?: string;
  paymentTermsMonthly?: string;
  extraTerms?: string;
  customTerms?: string;
  adBudget?: number;
  adBudgetPct?: number;
  adBudgetFixed?: number;
  adBudgetOverride?: boolean;
  adBudgetBillThrough?: boolean;
  published?: boolean;
  published_by?: string;
  published_at?: string;
  viewed_at?: string;
  downloaded_at?: string;
  signed_at?: string;
  published_version?: number;
  visibility_status?: string;
  ip_address?: string;
  browser?: string;
  device?: string;
  client_id?: string;
  customSubtotal?: number | null;
  items?: any[];
}

const INITIAL: Quote[] = []

function compileDefaultQuotationTerms(validityDays: number, ptOneTime: string, ptMonthly: string, gstPct: number, extraTerms: string) {
  const lines = [
    `Quotation valid for ${validityDays} days from issue date.`,
    `One-time services: ${ptOneTime}.`,
    `Monthly recurring services: ${ptMonthly}.`,
    'Hosting, domain, ad spend & third-party API fees billed at actuals.',
    `All prices are in Indian Rupees (INR). GST @ ${gstPct}% extra as applicable.`,
    'This quotation contains estimated pricing based on the current project scope. Final pricing will be confirmed after requirement discussions.',
    'The final Scope of Work (SOW) and Service Agreement will be shared and approved before project commencement.'
  ]
  if (extraTerms) {
    extraTerms.split('\n').map(t => t.trim()).filter(Boolean).forEach(t => lines.push(t))
  }
  return lines.join('\n')
}

function getQuotationTerms(q: Quote | any, companyDocs?: any) {
  if (q.customTerms) return q.customTerms
  if (q.custom_terms) return q.custom_terms
  
  const validityDays = q.validityDays !== undefined && q.validityDays !== null ? q.validityDays : (companyDocs?.quotationValidity ? Number(companyDocs.quotationValidity) : 14)
  const paymentTermsOneTime = q.paymentTermsOneTime || companyDocs?.paymentTermsOneTime || '50% advance to begin, 50% balance on final delivery'
  const paymentTermsMonthly = q.paymentTermsMonthly || companyDocs?.paymentTermsMonthly || 'Full monthly fee payable in advance each cycle'
  const extraTerms = q.extraTerms || companyDocs?.extraTerms || ''
  const gstPct = q.gstPct !== undefined && q.gstPct !== null ? q.gstPct : 18
  
  return compileDefaultQuotationTerms(validityDays, paymentTermsOneTime, paymentTermsMonthly, gstPct, extraTerms)
}

function blankForm(initialDocs?: any) {
  const validityDays = initialDocs?.quotationValidity ? Number(initialDocs.quotationValidity) : 14
  const paymentTermsOneTime = initialDocs?.paymentTermsOneTime || '50% advance to begin, 50% balance on final delivery'
  const paymentTermsMonthly = initialDocs?.paymentTermsMonthly || 'Full monthly fee payable in advance each cycle'
  const extraTerms = initialDocs?.extraTerms || ''
  const gstPct = 18

  return {
    projectTitle: '',
    client: '',
    contact: '',
    email: '',
    phone: '',
    businessType: 'E-Commerce',
    industry: '',
    gst: '',
    selectedIds: [] as string[],
    discountPct: 0,
    gstPct,
    notes: '',
    paymentScheduleId: '',
    validityDays,
    paymentTermsOneTime,
    paymentTermsMonthly,
    extraTerms,
    customTerms: compileDefaultQuotationTerms(validityDays, paymentTermsOneTime, paymentTermsMonthly, gstPct, extraTerms),
    adBudget: 0,
    adBudgetPct: 15,
    adBudgetFixed: 0,
    adBudgetOverride: false,
    adBudgetBillThrough: false,
    customSubtotal: null as number | null,
    items: [] as any[],
  }
}

// FormBody component - extracted outside to prevent recreation and preserve input focus
interface FormBodyProps {
  form: ReturnType<typeof blankForm>
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof blankForm>>>
  allSvcs: any[]
  selSvcs: any[]
  subtotal: number
  discAmt: number
  gstAmt: number
  grandTotal: number
  toggleSvc: (id: string) => void
  paymentSchedules: any[]
}

const FormBody = ({ form, setForm, allSvcs, selSvcs, subtotal, discAmt, gstAmt, grandTotal, toggleSvc, paymentSchedules }: FormBodyProps) => {
  const [serviceSearch, setServiceSearch] = useState('')

  return (
    <div className="space-y-6 py-2">
      <div>
        <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Project Details</p>
        <Input placeholder="Project / Quotation Title (e.g. Digital Growth Package Q3 2024)" value={form.projectTitle} onChange={e => setForm({ ...form, projectTitle: e.target.value })} />
      </div>
      <div>
        <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Client Information</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Company Name *</Label>
            <ClientAutocomplete
              placeholder="e.g. Urban Edge Co."
              value={form.client}
              onChange={v => setForm({ ...form, client: v })}
              onSelect={client => setForm({
                ...form,
                client: client.business || client.name,
                contact: client.name,
                email: client.email || '',
                phone: client.phone || '',
                businessType: client.type || form.businessType,
                industry: client.type || form.industry,
                gst: client.gst || form.gst
              })}
            />
          </div>
          <div className="space-y-1"><Label>Contact Person</Label><Input placeholder="e.g. Aaron Shah" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></div>
          <div className="space-y-1"><Label>Email</Label><Input type="email" placeholder="client@company.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1"><Label>Phone</Label><Input placeholder="10-digit number" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-1">
            <Label>Business Type</Label>
            <Input 
              value={form.businessType || ''} 
              readOnly 
              className="bg-muted/50 cursor-not-allowed opacity-80" 
              placeholder="Auto-populated from CRM"
            />
          </div>
          <div className="space-y-1"><Label>Industry</Label><Input placeholder="e.g. Fashion, Tech, Food" value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} /></div>
          <div className="col-span-1 sm:col-span-2 space-y-1"><Label>GST Number (optional)</Label><Input placeholder="29AABCN1234D1Z1" value={form.gst} onChange={e => setForm({ ...form, gst: e.target.value })} /></div>
        </div>
      </div>
      <div>
        <LineItemsTable
          variant="simple"
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
            <Label>Monthly Ad Budget (INR) *</Label>
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
            <Label>Custom Service Fee (INR)</Label>
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
            <p className="text-xs text-muted-foreground">Include the ad spend itself in the total payable quotation amount.</p>
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
        <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Pricing & Totals</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="space-y-1"><Label>Discount (%)</Label><Input type="number" min="0" max="100" value={form.discountPct} onChange={e => setForm({ ...form, discountPct: Number(e.target.value) })} /></div>
          <div className="space-y-1"><Label>GST (%)</Label><Input type="number" min="0" max="28" value={form.gstPct} onChange={e => setForm({ ...form, gstPct: Number(e.target.value) })} /></div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Subtotal</span>
            <div className="flex items-center gap-2">
              <Input 
                type="number" 
                className="w-28 h-7 text-right text-xs bg-[#0b1b15] text-gold font-bold border-gold/30" 
                value={form.customSubtotal ?? subtotal} 
                onChange={e => {
                  const val = Number(e.target.value)
                  setForm({ ...form, customSubtotal: val })
                }}
              />
            </div>
          </div>
          {discAmt > 0 && <div className="flex justify-between text-emerald-400"><span>Discount ({form.discountPct}%)</span><span>−{formatCurrency(discAmt)}</span></div>}
          {form.gstPct > 0 && <div className="flex justify-between text-muted-foreground"><span>GST ({form.gstPct}%)</span><span>+{formatCurrency(gstAmt)}</span></div>}
          <div className="flex justify-between font-bold text-gold border-t border-border pt-2 text-base"><span>Grand Total</span><span>{formatCurrency(grandTotal)}</span></div>
        </div>
      </div>
    )}
    {paymentSchedules && paymentSchedules.length > 0 && (
      <div>
        <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Payment Schedule</p>
        <Select value={form.paymentScheduleId} onValueChange={v => setForm({ ...form, paymentScheduleId: v })}>
          <SelectTrigger><SelectValue placeholder="Select a payment schedule..." /></SelectTrigger>
          <SelectContent>
            {paymentSchedules.map(ps => (
              <SelectItem key={ps.id} value={ps.id}>{ps.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {form.paymentScheduleId && paymentSchedules.find(p => p.id === form.paymentScheduleId) && (
          <div className="mt-3 space-y-2 border border-border/50 rounded-lg p-3 bg-muted/10">
            {paymentSchedules.find(p => p.id === form.paymentScheduleId).points.map((pt: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{pt.label} ({pt.pct}%)</span>
                <span className="font-medium">{formatCurrency(Math.round(grandTotal * (pt.pct / 100)))}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

    <div>
      <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Terms & Conditions (One per line)</p>
      <Textarea
        className="h-32 font-mono text-xs"
        placeholder="Enter each term on a new line..."
        value={form.customTerms}
        onChange={e => setForm({ ...form, customTerms: e.target.value })}
      />
    </div>
    <div className="space-y-1">
      <Label>Additional Notes</Label>
      <Textarea className="resize-none h-16" placeholder="Special terms, conditions, custom requirements..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
    </div>
  </div>
  )
}

function QuotationsPageContent() {
  const { user } = useUser()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [servicesData, setServicesData] = useState<any[]>([])
  const [paymentSchedules, setPaymentSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editQuote, setEditQuote] = useState<Quote | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const { toast } = useToast()

  const columns = useMemo(() => [
    {
      header: 'Quote ID',
      accessor: 'docId',
      sortable: true,
      sticky: true,
      cell: (q: Quote) => (
        <div>
          <span className="font-mono text-xs text-gold font-bold">{q.docId}</span>
          {q.published ? (
            <div className="flex items-center gap-1.5 mt-1 text-[10px]">
              <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded border ${q.visibility_status === 'hidden' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`} title={q.visibility_status === 'hidden' ? 'Hidden from Client Portal' : 'Published to Client Portal'}>
                <Globe className="h-2.5 w-2.5" />
                {q.visibility_status === 'hidden' ? 'Hidden' : `V${q.published_version || 1}`}
              </span>
              {q.viewed_at && <span className="text-blue-400 font-medium border border-blue-500/20 bg-blue-500/5 px-1 py-0.5 rounded" title={`Viewed at ${formatDate(q.viewed_at)}`}>Viewed</span>}
              {q.downloaded_at && <span className="text-green-400 font-medium border border-green-500/20 bg-green-500/5 px-1 py-0.5 rounded" title={`Downloaded at ${formatDate(q.downloaded_at)}`}>DL</span>}
              {q.signed_at && <span className="text-emerald-400 font-medium border border-emerald-500/20 bg-emerald-500/5 px-1 py-0.5 rounded" title={`Signed at ${formatDate(q.signed_at)}`}>Signed</span>}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground/50 mt-1">Not Published</div>
          )}
          {q.status === 'needs revision' && (
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
      cell: (q: Quote) => (
        <div>
          <a href={`/crm?search=${encodeURIComponent(q.client)}`} className="font-medium text-xs text-slate-200 hover:text-gold transition-colors hover:underline decoration-dotted">
            {q.client}
          </a>
          <p className="text-[10px] text-muted-foreground">{q.contact}</p>
        </div>
      )
    },
    {
      header: 'Services',
      accessor: 'serviceIds',
      cell: (q: Quote) => (
        <div className="flex gap-1 flex-wrap max-w-[220px]">
          {servicesData.filter(s => q.serviceIds?.includes(s.id)).slice(0,2).map(s => (
            <Badge key={s.id} variant="outline" className="text-[9px] whitespace-nowrap">
              {s.name.split('(')[0].trim().slice(0,22)}
            </Badge>
          ))}
          {q.serviceIds?.length > 2 && (
            <Badge variant="outline" className="text-[9px]">
              +{q.serviceIds.length-2}
            </Badge>
          )}
        </div>
      )
    },
    {
      header: 'Amount',
      accessor: 'amount',
      sortable: true,
      cell: (q: Quote) => <span className="font-semibold text-gold text-xs whitespace-nowrap">{formatCurrency(q.amount)}</span>
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      cell: (q: Quote) => (
        <div onClick={e => e.stopPropagation()}>
          <Select value={q.status} onValueChange={v => updateStatus(q.id, v)}>
            <SelectTrigger className={`h-7 w-28 text-xs border ${getDocStatusColor(q.status)}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTS.map(s => <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )
    },
    {
      header: 'Valid Until',
      accessor: 'valid',
      sortable: true,
      cell: (q: Quote) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(q.valid)}</span>
    },
    {
      header: 'Actions',
      accessor: 'actions',
      className: 'text-right',
      cell: (q: Quote) => (
        <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
          <Button variant="ghost" size="icon" aria-label="History" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="History" onClick={() => setHistoryDoc(q)}>
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Download PDF" className="h-7 w-7" title="Download PDF" onClick={() => handleDownload(q)} disabled={downloadingId === q.id}>
            {downloadingId === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Edit" className="h-7 w-7 text-blue-400 hover:text-blue-400" title="Edit" onClick={() => openEdit(q)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" aria-label="Publish to Client Portal" className={`h-7 w-7 ${q.published ? 'text-purple-400 hover:text-purple-300' : 'text-muted-foreground hover:text-gold'}`} title="Publish to Client Portal" onClick={() => setPublishDoc(q)}>
            <Globe className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Send to client" className="h-7 w-7 text-emerald-400 hover:text-emerald-400" title="Send to client" onClick={() => setShareDoc({ id: q.id, title: `${q.docId} - ${q.client}` })}><Send className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" aria-label="Delete" className="h-7 w-7 text-red-400 hover:text-red-400" title="Delete" onClick={() => setDeleteId(q.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      )
    }
  ], [servicesData, downloadingId])

  const handleBulkAction = async (action: string, selectedRows: Quote[]) => {
    if (action === 'delete') {
      if (!window.confirm(`Are you sure you want to delete ${selectedRows.length} quotations?`)) return
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const ids = selectedRows.map(r => r.id)
          const { error } = await supabase.from('quotations').delete().in('id', ids)
          if (error) {
            toast({ title: 'Error deleting quotations', description: error.message, variant: 'destructive' })
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
      const updatedList = quotes.filter(q => !idsSet.has(q.id))
      setQuotes(updatedList)
      setCachedData('quotations', { quotes: updatedList, servicesData, paymentSchedules, companyDocs })
      invalidateCache('dashboard')
      toast({ title: 'Quotations Deleted', description: `${selectedRows.length} quotations have been deleted.` })
      setLoading(false)
    } else if (action.startsWith('status_')) {
      const newStatus = action.replace('status_', '')
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const ids = selectedRows.map(r => r.id)
          const { error } = await supabase.from('quotations').update({ status: newStatus }).in('id', ids)
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
      const updatedList = quotes.map(q => idsSet.has(q.id) ? { ...q, status: newStatus } : q)
      setQuotes(updatedList)
      setCachedData('quotations', { quotes: updatedList, servicesData, paymentSchedules, companyDocs })
      invalidateCache('dashboard')
      toast({ title: 'Status Updated', description: `${selectedRows.length} quotations marked as ${STATUS_LABELS[newStatus] || newStatus}.` })
      setLoading(false)
    }
  }
  const [generating, setGenerating] = useState(false)
  const [shareDoc, setShareDoc] = useState<{ id: string, title: string } | null>(null)
  const [historyDoc, setHistoryDoc] = useState<Quote | null>(null)
  const [publishDoc, setPublishDoc] = useState<Quote | null>(null)
  const [companyDocs, setCompanyDocs] = useState<any>(null)

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
    const cached = getCachedData<{ quotes: Quote[], servicesData: any[], paymentSchedules: any[], companyDocs?: any }>('quotations')
    if (cached) {
      setQuotes(cached.quotes)
      setServicesData(cached.servicesData)
      if (cached.paymentSchedules) setPaymentSchedules(cached.paymentSchedules)
      if (cached.companyDocs) {
        setCompanyDocs(cached.companyDocs)
        setForm(blankForm(cached.companyDocs))
      }
      setLoading(false)
    }

    async function loadData() {
      if (!cached) setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const [qRes, sRes, cRes] = await Promise.all([
            supabase.from('quotations').select('*, quotation_items(*)').order('created_at', { ascending: false }),
            supabase.from('services').select('*').eq('status', 'active').order('created_at', { ascending: false }),
            supabase.from('company_settings').select('*').limit(1).maybeSingle()
          ])
          
          if (qRes.error) throw qRes.error
          if (sRes.error) throw sRes.error

          let schedules = []
          let docsSettings = null
          if (cRes.data && cRes.data.docs) {
            docsSettings = cRes.data.docs
            setCompanyDocs(docsSettings)
            setForm(blankForm(docsSettings))
            if (cRes.data.docs.paymentSchedules) {
              schedules = cRes.data.docs.paymentSchedules
              setPaymentSchedules(schedules)
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

          let mappedQuotes: Quote[] = []
          if (qRes.data) {
            mappedQuotes = qRes.data.map((q: any) => ({
              id: q.id,
              docId: q.doc_id,
              client: q.client,
              contact: q.contact || '',
              email: q.email || '',
              phone: q.phone || '',
              businessType: q.business_type || '',
              industry: q.industry || '',
              gst: q.gst || '',
              projectTitle: q.project_title || '',
              serviceIds: q.service_ids || [],
              discountPct: Number(q.discount_pct) || 0,
              gstPct: Number(q.gst_pct) || 0,
              notes: q.notes || '',
              amount: Number(q.amount) || 0,
              status: q.status || 'draft',
              created: q.created,
              valid: q.valid,
              history: Array.isArray(q.history) ? q.history : [],
              paymentScheduleId: q.payment_schedule_id || '',
              validityDays: q.validity_days,
              paymentTermsOneTime: q.payment_terms_one_time,
              paymentTermsMonthly: q.payment_terms_monthly,
              extraTerms: q.extra_terms,
              customTerms: q.custom_terms || '',
              adBudget: q.ad_budget ? Number(q.ad_budget) : 0,
              adBudgetPct: q.ad_budget_pct ? Number(q.ad_budget_pct) : 15,
              adBudgetFixed: q.ad_budget_fixed ? Number(q.ad_budget_fixed) : 0,
              adBudgetOverride: q.ad_budget_override || false,
              adBudgetBillThrough: q.ad_budget_bill_through || false,
              published: q.published || false,
              published_by: q.published_by || '',
              published_at: q.published_at || '',
              viewed_at: q.viewed_at || '',
              downloaded_at: q.downloaded_at || '',
              signed_at: q.signed_at || '',
              published_version: q.published_version || 1,
              visibility_status: q.visibility_status || 'visible',
              ip_address: q.ip_address || '',
              browser: q.browser || '',
              device: q.device || '',
              client_id: q.client_id || '',
              customSubtotal: q.custom_subtotal ? Number(q.custom_subtotal) : null,
              items: q.quotation_items || []
            }))
            setQuotes(mappedQuotes)
          }

          setCachedData('quotations', { quotes: mappedQuotes, servicesData: mappedSvcs, paymentSchedules: schedules, companyDocs: docsSettings })
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        }
      } else {
        setQuotes(INITIAL)
        setCachedData('quotations', { quotes: INITIAL, servicesData: [], paymentSchedules: [], companyDocs: null })
      }
      setLoading(false)
    }
    loadData()
  }, [])


  // Auto-fill founder details when creating new quotation
  useEffect(() => {
    if (showCreate && !editQuote) {
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

  // Derived
  const selSvcs = servicesData.filter(s => form.selectedIds.includes(s.id))
  
  // Calculate dynamic price for Paid Advertising services (catId === '3')
  const adBudgetFee = form.adBudgetOverride 
    ? (form.adBudgetFixed || 0) 
    : Math.round((form.adBudget || 0) * ((form.adBudgetPct || 15) / 100))

  const computedSub = selSvcs.reduce((sum, s) => {
    if (s.catId === '3') {
      return sum + s.price + adBudgetFee
    }
    return sum + s.price
  }, 0)

  const lineItemsSubtotal = form.items ? form.items.reduce((sum, item) => sum + (item.unit_price * (item.quantity || 1)), 0) : 0
  const lineItemsDiscount = form.items ? form.items.reduce((sum, item) => sum + item.discount, 0) : 0

  const subtotal = form.items && form.items.length > 0
    ? lineItemsSubtotal
    : (computedSub + (form.adBudgetBillThrough ? (form.adBudget || 0) : 0))

  const discAmt = form.items && form.items.length > 0
    ? lineItemsDiscount + Math.round((lineItemsSubtotal - lineItemsDiscount) * form.discountPct / 100)
    : Math.round(subtotal * form.discountPct / 100)

  const afterDisc = subtotal - discAmt
  const gstAmt = Math.round(afterDisc * form.gstPct / 100)

  const grandTotal = afterDisc + gstAmt

  const filtered = quotes.filter(q => {
    const matchSearch = q.client.toLowerCase().includes(search.toLowerCase()) || q.docId.toLowerCase().includes(search.toLowerCase()) || q.contact.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || q.status === statusFilter
    return matchSearch && matchStatus
  })

  function openEdit(q: Quote) {
    setEditQuote(q)

    const legacyItems = q.serviceIds ? q.serviceIds.map((sid, idx) => {
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
      projectTitle: q.projectTitle,
      client: q.client,
      contact: q.contact,
      email: q.email,
      phone: q.phone,
      businessType: q.businessType,
      industry: q.industry,
      gst: q.gst,
      selectedIds: q.serviceIds,
      discountPct: q.discountPct,
      gstPct: q.gstPct,
      notes: q.notes,
      paymentScheduleId: (q as any).paymentScheduleId || '',
      validityDays: q.validityDays !== undefined && q.validityDays !== null ? q.validityDays : (companyDocs?.quotationValidity ? Number(companyDocs.quotationValidity) : 14),
      paymentTermsOneTime: q.paymentTermsOneTime || companyDocs?.paymentTermsOneTime || '50% advance to begin, 50% balance on final delivery',
      paymentTermsMonthly: q.paymentTermsMonthly || companyDocs?.paymentTermsMonthly || 'Full monthly fee payable in advance each cycle',
      extraTerms: q.extraTerms || companyDocs?.extraTerms || '',
      customTerms: getQuotationTerms(q, companyDocs),
      adBudget: q.adBudget || 0,
      adBudgetPct: q.adBudgetPct || 15,
      adBudgetFixed: q.adBudgetFixed || 0,
      adBudgetOverride: q.adBudgetOverride || false,
      adBudgetBillThrough: q.adBudgetBillThrough || false,
      customSubtotal: q.customSubtotal || null,
      items: (q.items && q.items.length > 0) ? q.items : legacyItems,
    })
  }

  function toggleSvc(id: string) {
    setForm(f => ({ ...f, selectedIds: f.selectedIds.includes(id) ? f.selectedIds.filter(x => x !== id) : [...f.selectedIds, id] }))
  }

  async function buildAndDownloadPdf(data: Quote, svcIds: string[], disc: number, gst: number, title: string, docId: string, paymentScheduleId?: string) {
    const svcs = servicesData.filter(s => svcIds.includes(s.id))
    
    let sub = 0
    let dAmt = 0
    let tot = 0
    const pdfItems: any[] = []

    if (data.items && data.items.length > 0) {
      const lineItemsSubtotal = data.items.reduce((sum: number, item: any) => sum + (Number(item.unit_price) * Number(item.quantity || 1)), 0)
      const lineItemsDiscount = data.items.reduce((sum: number, item: any) => sum + Number(item.discount), 0)

      sub = lineItemsSubtotal
      dAmt = lineItemsDiscount + Math.round((lineItemsSubtotal - lineItemsDiscount) * disc / 100)
      const afterOverallDisc = sub - dAmt
      const gAmt = Math.round(afterOverallDisc * gst / 100)
      tot = afterOverallDisc + gAmt

      data.items.forEach((item: any) => {
        pdfItems.push({
          serviceName: item.service_name,
          finalPrice: item.total,
          price: item.unit_price,
          quantity: item.quantity,
          category: 'Service',
          timeline: 'As per SOW',
          pricing_model: 'fixed',
          deliverables: []
        })
      })
    } else {
      // Calculate dynamic price for Paid Advertising services (catId === '3')
      const adBudgetFee = data.adBudgetOverride 
        ? (data.adBudgetFixed || 0) 
        : Math.round((data.adBudget || 0) * ((data.adBudgetPct || 15) / 100))

      const computedSub = svcs.reduce((sum, s) => {
        if (s.catId === '3') {
          return sum + s.price + adBudgetFee
        }
        return sum + s.price
      }, 0)

      sub = computedSub + (data.adBudgetBillThrough ? (data.adBudget || 0) : 0)
      dAmt  = Math.round(sub * disc / 100)
      const aft   = sub - dAmt
      const gAmt  = Math.round(aft * gst / 100)
      tot   = aft + gAmt

      svcs.forEach(s => {
        if (s.catId === '3') {
          pdfItems.push({
            serviceName: `${s.name} - Setup Cost`,
            finalPrice: s.price,
            price: s.price,
            quantity: 1,
            category: s.category,
            timeline: s.timeline,
            pricing_model: 'fixed',
            deliverables: [`Campaign structure setup and onboarding for ${s.name}`]
          })
          pdfItems.push({
            serviceName: `${s.name} - Monthly Service Fee`,
            finalPrice: adBudgetFee,
            price: adBudgetFee,
            quantity: 1,
            category: s.category,
            timeline: s.timeline,
            pricing_model: 'monthly',
            deliverables: s.deliverables
          })
        } else {
          pdfItems.push({
            serviceName: s.name,
            finalPrice: s.price,
            price: s.price,
            quantity: 1,
            category: s.category,
            timeline: s.timeline,
            pricing_model: s.model,
            deliverables: s.deliverables
          })
        }
      })

      if (data.adBudgetBillThrough && data.adBudget && data.adBudget > 0) {
        pdfItems.push({
          serviceName: "Ad Budget (Paid Ads Spend)",
          finalPrice: data.adBudget,
          price: data.adBudget,
          quantity: 1,
          category: "Ad Spend",
          timeline: "Monthly",
          pricing_model: "monthly",
          deliverables: ["Advertising spend budget on Google/Meta networks"]
        })
      }
    }

    const payload = {
      docType: 'Quotation',
      clientName: data.contact || data.client,
      projectTitle: title || `Quotation — ${data.client}`,
      companyName: data.client,
      clientInfo: { business: data.businessType, industry: data.industry, mobile: data.phone, gst: data.gst },
      content: buildContentBody(data, svcs),
      items: pdfItems,
      subtotal: sub,
      discountTotal: dAmt,
      grandTotal: tot,
      fullProjectTotal: tot,
      fullSubtotal: sub,
      paymentScheduleObj: paymentScheduleId ? paymentSchedules.find(p => p.id === paymentScheduleId) : null,
      adBudget: data.adBudget,
      adBudgetPct: data.adBudgetPct,
      adBudgetFixed: data.adBudgetFixed,
      adBudgetOverride: data.adBudgetOverride,
      adBudgetBillThrough: data.adBudgetBillThrough,
      docsSettings: {
        gstRate: String(gst),
        quotationValidity: String(data.validityDays !== undefined && data.validityDays !== null ? data.validityDays : (companyDocs?.quotationValidity || '14')),
        paymentTermsOneTime: data.paymentTermsOneTime || companyDocs?.paymentTermsOneTime || '50% advance to begin, 50% balance on final delivery',
        paymentTermsMonthly: data.paymentTermsMonthly || companyDocs?.paymentTermsMonthly || 'Full monthly fee payable in advance each cycle',
        extraTerms: data.extraTerms || companyDocs?.extraTerms || '',
        customTerms: data.customTerms || getQuotationTerms(data, companyDocs),
      },
    }
    const res = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'PDF failed') }
    const blob = await res.blob()
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `Quotation_${docId}_${data.client.replace(/\s+/g, '_')}.pdf`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  async function handleDownload(q: Quote) {
    setDownloadingId(q.id)
    try {
      await buildAndDownloadPdf(q, q.serviceIds, q.discountPct, q.gstPct, q.projectTitle, q.docId, (q as any).paymentScheduleId)
      toast({ title: `✅ ${q.docId} downloaded` })
    } catch (e: any) { toast({ title: 'Download failed', description: e.message, variant: 'destructive' }) }
    finally { setDownloadingId(null) }
  }

  async function handleGenerate() {
    if (!form.client) { toast({ title: 'Company name required', variant: 'destructive' }); return }
    if (form.selectedIds.length === 0) { toast({ title: 'Select at least one service', variant: 'destructive' }); return }
    setGenerating(true)
    try {
      const docId = generateDocId('NG-QUO')
      const createdDate = new Date().toISOString().slice(0,10)
      const validDate = new Date(Date.now()+14*864e5).toISOString().slice(0,10)
      const newQ: Quote = { 
        id: String(Date.now()), 
        docId, 
        client: form.client, 
        contact: form.contact, 
        email: form.email, 
        phone: form.phone, 
        businessType: form.businessType, 
        industry: form.industry, 
        gst: form.gst, 
        projectTitle: form.projectTitle, 
        serviceIds: form.selectedIds, 
        discountPct: form.discountPct, 
        gstPct: form.gstPct, 
        notes: form.notes, 
        amount: grandTotal, 
        status: 'draft', 
        created: createdDate, 
        valid: validDate, 
        history: [{ date: new Date().toISOString().split('T')[0], action: 'Document generated', canDownload: true }], 
        paymentScheduleId: form.paymentScheduleId,
        validityDays: form.validityDays,
        paymentTermsOneTime: form.paymentTermsOneTime,
        paymentTermsMonthly: form.paymentTermsMonthly,
        extraTerms: form.extraTerms,
        customTerms: form.customTerms,
        adBudget: form.adBudget,
        adBudgetPct: form.adBudgetPct,
        adBudgetFixed: form.adBudgetFixed,
        adBudgetOverride: form.adBudgetOverride,
        adBudgetBillThrough: form.adBudgetBillThrough,
        customSubtotal: form.customSubtotal,
        items: form.items || [],
      } as any

      if (isSupabaseConfigured()) {
        try {
          const { error } = await supabase.from('quotations').insert([{
            id: newQ.id,
            doc_id: newQ.docId,
            client: newQ.client,
            contact: newQ.contact,
            email: newQ.email,
            phone: newQ.phone,
            business_type: newQ.businessType,
            industry: newQ.industry,
            gst: newQ.gst,
            project_title: newQ.projectTitle,
            service_ids: newQ.serviceIds,
            discount_pct: newQ.discountPct,
            gst_pct: newQ.gstPct,
            notes: newQ.notes,
            amount: newQ.amount,
            status: newQ.status,
            created: newQ.created,
            valid: newQ.valid,
            history: newQ.history,
            payment_schedule_id: form.paymentScheduleId,
            validity_days: form.validityDays,
            payment_terms_one_time: form.paymentTermsOneTime,
            payment_terms_monthly: form.paymentTermsMonthly,
            extra_terms: form.extraTerms,
            custom_terms: form.customTerms,
            ad_budget: form.adBudget,
            ad_budget_pct: form.adBudgetPct,
            ad_budget_fixed: form.adBudgetFixed,
            ad_budget_override: form.adBudgetOverride,
            ad_budget_bill_through: form.adBudgetBillThrough,
            custom_subtotal: form.customSubtotal,
          }])
          if (error) {
            toast({ title: 'Error generating quotation', description: error.message, variant: 'destructive' })
            setGenerating(false)
            return
          }

          if (form.items && form.items.length > 0) {
            const { error: itemsErr } = await supabase.from('quotation_items').insert(
              form.items.map((item, idx) => ({
                quotation_id: newQ.id,
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
              toast({ title: 'Error saving quotation items', description: itemsErr.message, variant: 'destructive' })
            }
          }
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
          setGenerating(false)
          return
        }
      }

      await buildAndDownloadPdf(newQ, form.selectedIds, form.discountPct, form.gstPct, form.projectTitle, docId, form.paymentScheduleId)
      const updatedQuotes = [newQ, ...quotes]
      setQuotes(updatedQuotes)
      setCachedData('quotations', { quotes: updatedQuotes, servicesData, paymentSchedules, companyDocs })
      invalidateCache('dashboard')
      setShowCreate(false)
      setForm(blankForm(companyDocs))
      toast({ title: '✅ Quotation Generated!', description: `${docId} downloaded.` })
    } catch (e: any) { toast({ title: 'PDF Error', description: e.message, variant: 'destructive' }) }
    finally { setGenerating(false) }
  }


  async function handleSaveEdit() {
    if (!editQuote) return
    setGenerating(true)
    const updatedHistory = [...editQuote.history, { date: new Date().toISOString().split('T')[0], action: 'Document updated', canDownload: true }]
    const updated = { 
      ...editQuote, 
      client: form.client, 
      contact: form.contact, 
      email: form.email, 
      phone: form.phone, 
      businessType: form.businessType, 
      industry: form.industry, 
      gst: form.gst, 
      projectTitle: form.projectTitle, 
      serviceIds: form.selectedIds, 
      discountPct: form.discountPct, 
      gstPct: form.gstPct, 
      notes: form.notes, 
      amount: grandTotal, 
      history: updatedHistory, 
      paymentScheduleId: form.paymentScheduleId,
      validityDays: form.validityDays,
      paymentTermsOneTime: form.paymentTermsOneTime,
      paymentTermsMonthly: form.paymentTermsMonthly,
      extraTerms: form.extraTerms,
      customTerms: form.customTerms,
      adBudget: form.adBudget,
      adBudgetPct: form.adBudgetPct,
      adBudgetFixed: form.adBudgetFixed,
      adBudgetOverride: form.adBudgetOverride,
      adBudgetBillThrough: form.adBudgetBillThrough,
      customSubtotal: form.customSubtotal,
      items: form.items || [],
    } as any

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('quotations').update({
          client: updated.client,
          contact: updated.contact,
          email: updated.email,
          phone: updated.phone,
          business_type: updated.businessType,
          industry: updated.industry,
          gst: updated.gst,
          project_title: updated.projectTitle,
          service_ids: updated.serviceIds,
          discount_pct: updated.discountPct,
          gst_pct: updated.gstPct,
          notes: updated.notes,
          amount: updated.amount,
          history: updated.history,
          payment_schedule_id: form.paymentScheduleId,
          validity_days: form.validityDays,
          payment_terms_one_time: form.paymentTermsOneTime,
          payment_terms_monthly: form.paymentTermsMonthly,
          extra_terms: form.extraTerms,
          custom_terms: form.customTerms,
          ad_budget: form.adBudget,
          ad_budget_pct: form.adBudgetPct,
          ad_budget_fixed: form.adBudgetFixed,
          ad_budget_override: form.adBudgetOverride,
          ad_budget_bill_through: form.adBudgetBillThrough,
          custom_subtotal: form.customSubtotal,
        }).eq('id', editQuote.id)
        if (error) {
          toast({ title: 'Error saving changes', description: error.message, variant: 'destructive' })
          setGenerating(false)
          return
        }

        // Delete old items and insert new ones
        await supabase.from('quotation_items').delete().eq('quotation_id', editQuote.id)
        if (form.items && form.items.length > 0) {
          const { error: itemsErr } = await supabase.from('quotation_items').insert(
            form.items.map((item, idx) => ({
              quotation_id: editQuote.id,
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
            toast({ title: 'Error saving quotation items', description: itemsErr.message, variant: 'destructive' })
          }
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        setGenerating(false)
        return
      }
    }

    const updatedQuotes = quotes.map(q => q.id === editQuote.id ? updated : q)
    setQuotes(updatedQuotes)
    setCachedData('quotations', { quotes: updatedQuotes, servicesData, paymentSchedules, companyDocs })
    invalidateCache('dashboard')
    setEditQuote(null)
    setForm(blankForm(companyDocs))
    toast({ title: '✅ Quotation updated' })
    setGenerating(false)
  }


  async function handleDelete() {
    if (!deleteId) return
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('quotations').delete().eq('id', deleteId)
        if (error) {
          toast({ title: 'Error deleting quotation', description: error.message, variant: 'destructive' })
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        return
      }
    }
    const updatedQuotes = quotes.filter(q => q.id !== deleteId)
    setQuotes(updatedQuotes)
    setCachedData('quotations', { quotes: updatedQuotes, servicesData })
    invalidateCache('dashboard')
    setDeleteId(null)
    toast({ title: 'Quotation deleted' })
  }


  async function updateStatus(id: string, status: string) {
    const match = quotes.find(q => q.id === id)
    if (!match) return
    const updatedHistory = [...match.history, { date: new Date().toISOString().split('T')[0], action: `Status changed to ${STATUS_LABELS[status]}` }]

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('quotations').update({
          status,
          history: updatedHistory
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

    const updatedQuotes = quotes.map(q => q.id === id ? { ...q, status, history: updatedHistory } : q)
    setQuotes(updatedQuotes)
    setCachedData('quotations', { quotes: updatedQuotes, servicesData })
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
        status: 'approved'
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
        .from('quotations')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    }

    const updatedQuotes = quotes.map(q => q.id === id ? { ...q, ...updates } : q)
    setQuotes(updatedQuotes)
    setCachedData('quotations', { quotes: updatedQuotes, servicesData, paymentSchedules, companyDocs })
    invalidateCache('dashboard')
  }


  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        description="Generate and manage client quotation proposals."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Documents', href: '/documents' },
          { label: 'Quotations' }
        ]}
        primaryAction={{
          label: 'New Quotation',
          onClick: () => { setForm(blankForm(companyDocs)); setShowCreate(true) },
          icon: Plus,
          variant: 'gold'
        }}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ l: 'Total', v: quotes.length }, { l: 'Draft', v: quotes.filter(q=>q.status==='draft').length }, { l: 'Sent', v: quotes.filter(q=>q.status==='sent').length }, { l: 'Approved', v: quotes.filter(q=>q.status==='approved').length }].map(s => (
          <Card key={s.l}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.l}</p><p className="text-2xl font-bold mt-1">{s.v}</p></CardContent></Card>
        ))}
      </div>

      <DataTable
        data={quotes}
        columns={columns}
        searchPlaceholder="Search quotations by client, contact, or ID..."
        searchKeys={['client', 'contact', 'docId']}
        exportFileName="quotations"
        initialSearch={searchParams.get('search') || searchParams.get('client') || ''}
        savedFiltersKey="quotations"
        enableBulkSelect={true}
        bulkActions={[
          { label: 'Delete Selected', action: 'delete', variant: 'destructive', icon: Trash2 },
          { label: 'Mark Approved', action: 'status_approved', icon: FileText },
          { label: 'Mark Signed', action: 'status_signed', icon: FileText }
        ]}
        onBulkAction={handleBulkAction}
        filterDefs={[
          {
            key: 'status',
            label: 'Status',
            options: STATUS_OPTS.map(s => ({ label: STATUS_LABELS[s], value: s }))
          }
        ]}
        emptyTitle="No quotations found"
        emptyDescription="Create your first quotation or adjust your filters."
        emptyIcon={FileText}
        emptyAction={{ label: 'New Quotation', onClick: () => { setForm(blankForm(companyDocs)); setShowCreate(true) }, icon: Plus }}
      />

      {/* Create Drawer */}
      <Drawer
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setForm(blankForm(companyDocs)) }}
        title="Create New Quotation"
        description="Configure client details, service selections, discounts, taxes, and validity terms."
        widthClass="max-w-3xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setForm(blankForm(companyDocs)) }}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Generating...</> : 'Generate PDF'}
            </Button>
          </>
        }
      >
        <FormBody form={form} setForm={setForm} allSvcs={servicesData} selSvcs={selSvcs} subtotal={subtotal} discAmt={discAmt} gstAmt={gstAmt} grandTotal={grandTotal} toggleSvc={toggleSvc} paymentSchedules={paymentSchedules} />
      </Drawer>

      {/* Edit Drawer */}
      <Drawer
        isOpen={!!editQuote}
        onClose={() => { setEditQuote(null); setForm(blankForm(companyDocs)) }}
        title={`Edit Quotation ${editQuote?.docId}`}
        description="Update service breakdown, pricing details, validity, and notes."
        widthClass="max-w-3xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => { setEditQuote(null); setForm(blankForm(companyDocs)) }} disabled={generating}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleSaveEdit} disabled={generating} className="gap-1.5">
              {generating ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
            </Button>
          </>
        }
      >
        <FormBody form={form} setForm={setForm} allSvcs={servicesData} selSvcs={selSvcs} subtotal={subtotal} discAmt={discAmt} gstAmt={gstAmt} grandTotal={grandTotal} toggleSvc={toggleSvc} paymentSchedules={paymentSchedules} />
      </Drawer>

      {/* Delete Confirmation */}
      <DeleteDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Quotation?"
        description="This action cannot be undone. This will permanently delete the quotation reference."
        confirmLabel="Delete Quotation"
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
              const revEntry = (historyDoc as any).history?.slice().reverse().find((h: any) => h.action.startsWith('Client requested changes'))
              return revEntry ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-3">
                  <p className="text-xs font-bold text-amber-400 mb-1">⚠ Client Requested Changes</p>
                  <p className="text-sm text-amber-200 leading-snug">{revEntry.action.replace('Client requested changes: ', '').replace(/^"|"$/g, '')}</p>
                  <p className="text-[10px] text-amber-400/60 mt-1">{revEntry.date}</p>
                </div>
              ) : null
            })()}
            <UniversalTimeline
              entries={historyDoc?.history.slice().reverse().map(h => ({
                action: h.action,
                by: 'System',
                date: h.date,
                canDownload: h.canDownload,
                module: 'Billing'
              })) || []}
              onDownload={() => { if (historyDoc) handleDownload(historyDoc) }}
            />
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
        initialEmail={shareDoc ? quotes.find(q => q.id === shareDoc.id)?.email || '' : ''}
        initialSubject={shareDoc ? `Quotation Proposal: ${quotes.find(q => q.id === shareDoc.id)?.projectTitle || quotes.find(q => q.id === shareDoc.id)?.docId}` : ''}
        initialMessage={shareDoc ? (() => {
          const q = quotes.find(x => x.id === shareDoc.id)
          if (!q) return ''
          return `Dear ${q.client},\n\nWe are pleased to share our quotation proposal for the project "${q.projectTitle || 'Services'}" (${q.docId}).\n\nTotal Estimated Amount: ${formatCurrency(q.amount)}\n\nYou can view and download all documents in your client vault.\n\nBest regards,\nNetgain Team`
        })() : ''}
        onSend={async (methods, emailDetails) => {
          if (!shareDoc) return
          
          const quoteObj = quotes.find(q => q.id === shareDoc.id)
          if (!quoteObj) throw new Error('Quotation not found')

          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.access_token
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          if (token) {
            headers['Authorization'] = `Bearer ${token}`
          }

          for (const method of methods) {
            let recipient = ''
            let message = ''
            let subject = ''
            let pdfPayload: any = undefined

            if (method === 'email') {
              recipient = emailDetails?.recipient || quoteObj.email
              subject = emailDetails?.subject || `Quotation Proposal: ${quoteObj.projectTitle || quoteObj.docId}`
              message = emailDetails?.message || `Dear ${quoteObj.client},\n\nWe are pleased to share our quotation proposal for the project "${quoteObj.projectTitle || 'Services'}" (${quoteObj.docId}).\n\nTotal Estimated Amount: ${formatCurrency(quoteObj.amount)}\n\nYou can view and download all documents in your client vault.\n\nBest regards,\nNetgain Team`
              
              // Generate matching PDF payload on the fly
              const svcs = servicesData.filter(s => quoteObj.serviceIds.includes(s.id))
              
              // Calculate dynamic price for Paid Advertising services (catId === '3')
              const adBudgetFee = quoteObj.adBudgetOverride 
                ? (quoteObj.adBudgetFixed || 0) 
                : Math.round((quoteObj.adBudget || 0) * ((quoteObj.adBudgetPct || 15) / 100))

              const computedSub = svcs.reduce((sum, s) => {
                if (s.catId === '3') {
                  return sum + s.price + adBudgetFee
                }
                return sum + s.price
              }, 0)

              const sub = computedSub + (quoteObj.adBudgetBillThrough ? (quoteObj.adBudget || 0) : 0)
              const dAmt = Math.round(sub * quoteObj.discountPct / 100)
              const aft = sub - dAmt
              const gAmt = Math.round(aft * quoteObj.gstPct / 100)
              const tot = aft + gAmt

              const pdfItems: any[] = []
              svcs.forEach(s => {
                if (s.catId === '3') {
                  // 1. One-time Setup Cost
                  pdfItems.push({
                    serviceName: `${s.name} - Setup Cost`,
                    finalPrice: s.price,
                    price: s.price,
                    quantity: 1,
                    category: s.category,
                    timeline: s.timeline,
                    pricing_model: 'fixed',
                    deliverables: [`Campaign structure setup and onboarding for ${s.name}`]
                  })
                  // 2. Monthly Service Fee
                  pdfItems.push({
                    serviceName: `${s.name} - Monthly Service Fee`,
                    finalPrice: adBudgetFee,
                    price: adBudgetFee,
                    quantity: 1,
                    category: s.category,
                    timeline: s.timeline,
                    pricing_model: 'monthly',
                    deliverables: s.deliverables
                  })
                } else {
                  pdfItems.push({
                    serviceName: s.name,
                    finalPrice: s.price,
                    price: s.price,
                    quantity: 1,
                    category: s.category,
                    timeline: s.timeline,
                    pricing_model: s.model,
                    deliverables: s.deliverables
                  })
                }
              })

              // If ad budget is billed through Netgain, append it as a line item
              if (quoteObj.adBudgetBillThrough && quoteObj.adBudget && quoteObj.adBudget > 0) {
                pdfItems.push({
                  serviceName: "Ad Budget (Paid Ads Spend)",
                  finalPrice: quoteObj.adBudget,
                  price: quoteObj.adBudget,
                  quantity: 1,
                  category: "Ad Spend",
                  timeline: "Monthly",
                  pricing_model: "monthly",
                  deliverables: ["Advertising spend budget on Google/Meta networks"]
                })
              }

              pdfPayload = {
                docType: 'Quotation',
                clientName: quoteObj.contact || quoteObj.client,
                projectTitle: quoteObj.projectTitle || `Quotation — ${quoteObj.client}`,
                companyName: quoteObj.client,
                clientInfo: { business: quoteObj.businessType, industry: quoteObj.industry, mobile: quoteObj.phone, gst: quoteObj.gst },
                content: buildContentBody(quoteObj, svcs),
                items: pdfItems,
                subtotal: sub,
                discountTotal: dAmt,
                grandTotal: tot,
                fullProjectTotal: tot,
                fullSubtotal: sub,
                paymentScheduleObj: quoteObj.paymentScheduleId ? paymentSchedules.find(p => p.id === quoteObj.paymentScheduleId) : null,
                adBudget: quoteObj.adBudget,
                adBudgetPct: quoteObj.adBudgetPct,
                adBudgetFixed: quoteObj.adBudgetFixed,
                adBudgetOverride: quoteObj.adBudgetOverride,
                adBudgetBillThrough: quoteObj.adBudgetBillThrough,
                docsSettings: {
                  gstRate: String(quoteObj.gstPct),
                  quotationValidity: String(quoteObj.validityDays !== undefined && quoteObj.validityDays !== null ? quoteObj.validityDays : (companyDocs?.quotationValidity || '14')),
                  paymentTermsOneTime: quoteObj.paymentTermsOneTime || companyDocs?.paymentTermsOneTime || '50% advance to begin, 50% balance on final delivery',
                  paymentTermsMonthly: quoteObj.paymentTermsMonthly || companyDocs?.paymentTermsMonthly || 'Full monthly fee payable in advance each cycle',
                  extraTerms: quoteObj.extraTerms || companyDocs?.extraTerms || '',
                  customTerms: quoteObj.customTerms || getQuotationTerms(quoteObj, companyDocs),
                },
              }
            } else if (method === 'whatsapp' || method === 'sms') {
              recipient = quoteObj.phone
              message = `Dear ${quoteObj.client}, here is your quotation ${quoteObj.docId} for "${quoteObj.projectTitle || 'Services'}" - Total: ${formatCurrency(quoteObj.amount)}. Netgain Team`
            }

            if (!recipient) {
              throw new Error(`Recipient contact details not found for ${method}`)
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
        docTitle={publishDoc?.projectTitle || publishDoc?.docId || ''}
        docId={publishDoc?.docId || ''}
        isPublished={!!publishDoc?.published}
        visibilityStatus={publishDoc?.visibility_status || 'visible'}
        currentVersion={publishDoc?.published_version || 1}
        onAction={handlePublishAction}
      />
    </div>
  )
}

function buildContentBody(q: Quote, svcs: any[]) {
  const parts = [
    '## Why Netgain?',
    'We are a full-service digital growth agency specializing in high-converting digital experiences, data-driven marketing, and automation for modern businesses.',
  ]

  if (q.items && q.items.length > 0) {
    const servicesPart = [
      '## Service Breakdown',
      ...q.items.flatMap((item: any, i: number) => [
        `### ${i+1}. ${item.service_name}`,
        item.description ? `${item.description}` : '',
        `**Quantity:** ${item.quantity}  |  **Unit Price:** INR ${item.unit_price.toLocaleString('en-IN')}  |  **Tax:** ${item.tax}%`,
        ''
      ])
    ].join('\n')
    parts.push(servicesPart)
  } else if (svcs && svcs.length > 0) {
    const servicesPart = [
      '## Service Breakdown',
      ...svcs.flatMap((s: any, i: number) => [
        `### ${i+1}. ${s.name}`,
        `**Category:** ${s.category}  |  **Timeline:** ${s.timeline}  |  **Model:** ${s.model === 'monthly' ? 'Monthly Recurring' : 'One-Time Fixed'}`,
        '',
        ...(s.deliverables?.map((d: any) => `- ${d}`) || []),
      ])
    ].join('\n')
    parts.push(servicesPart)
  }

  if (q.paymentTermsOneTime || q.paymentTermsMonthly) {
    const paymentPart = [
      '## Payment Terms',
      ...(q.paymentTermsOneTime ? [`- One-time services: ${q.paymentTermsOneTime}`] : []),
      ...(q.paymentTermsMonthly ? [`- Monthly retainers: ${q.paymentTermsMonthly}`] : []),
      '- Accepted: NEFT / IMPS / UPI / Cheque'
    ].join('\n')
    parts.push(paymentPart)
  }

  if (q.notes && q.notes.trim()) {
    parts.push(`## Additional Notes\n${q.notes}`)
  }

  if (q.validityDays !== undefined && q.validityDays !== null && String(q.validityDays).trim() !== '') {
    parts.push(`## Validity\nThis quotation is valid for **${q.validityDays} days** from the date of issue.`)
  }

  return parts.join('\n\n')
}

export default function QuotationsPage() {
  return (
    <Suspense fallback={null}>
      <QuotationsPageContent />
    </Suspense>
  )
}
