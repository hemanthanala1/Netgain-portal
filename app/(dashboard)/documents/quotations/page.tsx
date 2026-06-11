'use client'
import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Search, Plus, Download, Send, Trash2, Pencil, Loader2, FileText, History } from 'lucide-react'
import { formatCurrency, formatDate, getDocStatusColor, generateDocId } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { ShareDialog } from '@/components/ui/share-dialog'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { fetchFounderProfile } from '@/lib/founder-helper'
import { ClientAutocomplete } from '@/components/ui/client-autocomplete'
import { getCachedData, setCachedData, invalidateCache } from '@/lib/data-cache'



const STATUS_OPTS = ['draft', 'sent', 'approved', 'rejected']
const STATUS_LABELS: Record<string, string> = { draft: 'Draft', sent: 'Sent', approved: 'Approved', rejected: 'Rejected' }

type Quote = {
  id: string; docId: string; client: string; contact: string; email: string; phone: string
  businessType: string; industry: string; gst: string; projectTitle: string
  serviceIds: string[]; discountPct: number; gstPct: number; notes: string
  amount: number; status: string; created: string; valid: string
  history: { date: string; action: string; canDownload?: boolean }[]
}

const INITIAL: Quote[] = []

function blankForm() {
  return { projectTitle: '', client: '', contact: '', email: '', phone: '', businessType: 'E-Commerce', industry: '', gst: '', selectedIds: [] as string[], discountPct: 0, gstPct: 18, notes: '', paymentScheduleId: '' }
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

const FormBody = ({ form, setForm, allSvcs, selSvcs, subtotal, discAmt, gstAmt, grandTotal, toggleSvc, paymentSchedules }: FormBodyProps) => (
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
        <div className="space-y-1"><Label>Business Type</Label>
          <Select value={form.businessType} onValueChange={v => setForm({ ...form, businessType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{['E-Commerce','D2C Brand','B2B Company','SaaS / Software','Retail / Offline','Service Business','Healthcare','Education','Real Estate','Manufacturing'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Industry</Label><Input placeholder="e.g. Fashion, Tech, Food" value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} /></div>
        <div className="col-span-1 sm:col-span-2 space-y-1"><Label>GST Number (optional)</Label><Input placeholder="29AABCN1234D1Z1" value={form.gst} onChange={e => setForm({ ...form, gst: e.target.value })} /></div>
      </div>
    </div>
    <div>
      <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Select Services ({selSvcs.length} selected)</p>
      <div className="space-y-2">
        {allSvcs.map(svc => {
          const sel = form.selectedIds.includes(svc.id)
          const priceStr = svc.priceMin && svc.priceMax
            ? `${formatCurrency(svc.priceMin)} - ${formatCurrency(svc.priceMax)}`
            : formatCurrency(svc.price)
          return (
            <button key={svc.id} type="button" onClick={() => toggleSvc(svc.id)} className={`flex items-center justify-between w-full rounded-lg border p-3 text-left transition-all ${sel ? 'border-gold/50 bg-gold/5' : 'border-border hover:border-gold/20'}`}>
              <div className="flex items-center gap-3">
                <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${sel ? 'bg-gold border-gold' : 'border-muted-foreground'}`}>
                  {sel && <svg className="h-2.5 w-2.5 text-black" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
                </div>
                <div><p className="text-sm font-medium">{svc.name}</p><p className="text-xs text-muted-foreground">{svc.category} · {svc.timeline}</p></div>
              </div>
              <div className="text-right shrink-0 ml-4">
                <span className="text-sm font-bold text-gold">{priceStr}{svc.model === 'monthly' ? '/mo' : ''}</span>
                {(svc.priceMin && svc.priceMax) && <p className="text-[10px] text-muted-foreground">Range estimate</p>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
    {selSvcs.length > 0 && (
      <div>
        <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Pricing & Totals</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="space-y-1"><Label>Discount (%)</Label><Input type="number" min="0" max="100" value={form.discountPct} onChange={e => setForm({ ...form, discountPct: Number(e.target.value) })} /></div>
          <div className="space-y-1"><Label>GST (%)</Label><Input type="number" min="0" max="28" value={form.gstPct} onChange={e => setForm({ ...form, gstPct: Number(e.target.value) })} /></div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
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

    <div className="space-y-1">
      <Label>Additional Notes</Label>
      <Textarea className="resize-none h-16" placeholder="Special terms, conditions, custom requirements..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
    </div>
  </div>
)

export default function QuotationsPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [servicesData, setServicesData] = useState<any[]>([])
  const [paymentSchedules, setPaymentSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editQuote, setEditQuote] = useState<Quote | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const { toast } = useToast()
  const [generating, setGenerating] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [shareDoc, setShareDoc] = useState<{ id: string, title: string } | null>(null)
  const [historyDoc, setHistoryDoc] = useState<Quote | null>(null)

  const [form, setForm] = useState(blankForm())

  useEffect(() => {
    const cached = getCachedData<{ quotes: Quote[], servicesData: any[], paymentSchedules: any[] }>('quotations')
    if (cached) {
      setQuotes(cached.quotes)
      setServicesData(cached.servicesData)
      if (cached.paymentSchedules) setPaymentSchedules(cached.paymentSchedules)
      setLoading(false)
    }

    async function loadData() {
      if (!cached) setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const [qRes, sRes, cRes] = await Promise.all([
            supabase.from('quotations').select('*').order('created_at', { ascending: false }),
            supabase.from('services').select('*').neq('status', 'archived').order('created_at', { ascending: false }),
            supabase.from('company_settings').select('*').limit(1).maybeSingle()
          ])
          
          if (qRes.error) throw qRes.error
          if (sRes.error) throw sRes.error

          let schedules = []
          if (cRes.data && cRes.data.docs?.paymentSchedules) {
            schedules = cRes.data.docs.paymentSchedules
            setPaymentSchedules(schedules)
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
              paymentScheduleId: q.payment_schedule_id || ''
            }))
            setQuotes(mappedQuotes)
          }

          setCachedData('quotations', { quotes: mappedQuotes, servicesData: mappedSvcs, paymentSchedules: schedules })
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        }
      } else {
        setQuotes(INITIAL)
        setCachedData('quotations', { quotes: INITIAL, servicesData: [], paymentSchedules: [] })
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
  const subtotal = selSvcs.reduce((a, s) => a + s.price, 0)
  const discAmt  = Math.round(subtotal * form.discountPct / 100)
  const afterDisc = subtotal - discAmt
  const gstAmt   = Math.round(afterDisc * form.gstPct / 100)
  const grandTotal = afterDisc + gstAmt

  const filtered = quotes.filter(q => {
    const matchSearch = q.client.toLowerCase().includes(search.toLowerCase()) || q.docId.toLowerCase().includes(search.toLowerCase()) || q.contact.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || q.status === statusFilter
    return matchSearch && matchStatus
  })

  function openEdit(q: Quote) {
    setEditQuote(q)
    setForm({ projectTitle: q.projectTitle, client: q.client, contact: q.contact, email: q.email, phone: q.phone, businessType: q.businessType, industry: q.industry, gst: q.gst, selectedIds: q.serviceIds, discountPct: q.discountPct, gstPct: q.gstPct, notes: q.notes, paymentScheduleId: (q as any).paymentScheduleId || '' })
  }

  function toggleSvc(id: string) {
    setForm(f => ({ ...f, selectedIds: f.selectedIds.includes(id) ? f.selectedIds.filter(x => x !== id) : [...f.selectedIds, id] }))
  }

  async function buildAndDownloadPdf(data: Quote, svcIds: string[], disc: number, gst: number, title: string, docId: string, paymentScheduleId?: string) {
    const svcs = servicesData.filter(s => svcIds.includes(s.id))
    const sub   = svcs.reduce((a, s) => a + s.price, 0)
    const dAmt  = Math.round(sub * disc / 100)
    const aft   = sub - dAmt
    const gAmt  = Math.round(aft * gst / 100)
    const tot   = aft + gAmt

    const payload = {
      docType: 'Quotation',
      clientName: data.contact || data.client,
      projectTitle: title || `Quotation — ${data.client}`,
      companyName: data.client,
      clientInfo: { business: data.businessType, industry: data.industry, mobile: data.phone, gst: data.gst },
      content: buildContentBody(data, svcs),
      items: svcs.map(s => ({ serviceName: s.name, finalPrice: s.price, price: s.price, quantity: 1, category: s.category, timeline: s.timeline, pricing_model: s.model, deliverables: s.deliverables })),
      subtotal: sub,
      discountTotal: dAmt,
      grandTotal: tot,
      paymentScheduleObj: paymentScheduleId ? paymentSchedules.find(p => p.id === paymentScheduleId) : null,
      docsSettings: {
        gstRate: String(gst),
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
      const newQ: Quote = { id: String(Date.now()), docId, client: form.client, contact: form.contact, email: form.email, phone: form.phone, businessType: form.businessType, industry: form.industry, gst: form.gst, projectTitle: form.projectTitle, serviceIds: form.selectedIds, discountPct: form.discountPct, gstPct: form.gstPct, notes: form.notes, amount: grandTotal, status: 'draft', created: createdDate, valid: validDate, history: [{ date: new Date().toISOString().split('T')[0], action: 'Document generated', canDownload: true }], paymentScheduleId: form.paymentScheduleId } as any

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
            payment_schedule_id: form.paymentScheduleId
          }])
          if (error) {
            toast({ title: 'Error generating quotation', description: error.message, variant: 'destructive' })
            setGenerating(false)
            return
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
      setCachedData('quotations', { quotes: updatedQuotes, servicesData })
      invalidateCache('dashboard')
      setShowCreate(false)
      setForm(blankForm())
      toast({ title: '✅ Quotation Generated!', description: `${docId} downloaded.` })
    } catch (e: any) { toast({ title: 'PDF Error', description: e.message, variant: 'destructive' }) }
    finally { setGenerating(false) }
  }


  async function handleSaveEdit() {
    if (!editQuote) return
    setGenerating(true)
    const updatedHistory = [...editQuote.history, { date: new Date().toISOString().split('T')[0], action: 'Document updated', canDownload: true }]
    const updated = { ...editQuote, client: form.client, contact: form.contact, email: form.email, phone: form.phone, businessType: form.businessType, industry: form.industry, gst: form.gst, projectTitle: form.projectTitle, serviceIds: form.selectedIds, discountPct: form.discountPct, gstPct: form.gstPct, notes: form.notes, amount: grandTotal, history: updatedHistory, paymentScheduleId: form.paymentScheduleId } as any

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
          payment_schedule_id: form.paymentScheduleId
        }).eq('id', editQuote.id)
        if (error) {
          toast({ title: 'Error saving changes', description: error.message, variant: 'destructive' })
          setGenerating(false)
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        setGenerating(false)
        return
      }
    }

    const updatedQuotes = quotes.map(q => q.id === editQuote.id ? updated : q)
    setQuotes(updatedQuotes)
    setCachedData('quotations', { quotes: updatedQuotes, servicesData })
    invalidateCache('dashboard')
    setEditQuote(null)
    setForm(blankForm())
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


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight">Quotations</h1><p className="text-muted-foreground text-sm mt-0.5">Generate and manage client quotation proposals.</p></div>
        <Button variant="gold" size="sm" onClick={() => { setForm(blankForm()); setShowCreate(true) }} className="gap-1.5 w-full sm:w-auto"><Plus className="h-4 w-4" />New Quotation</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ l: 'Total', v: quotes.length }, { l: 'Draft', v: quotes.filter(q=>q.status==='draft').length }, { l: 'Sent', v: quotes.filter(q=>q.status==='sent').length }, { l: 'Approved', v: quotes.filter(q=>q.status==='approved').length }].map(s => (
          <Card key={s.l}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.l}</p><p className="text-2xl font-bold mt-1">{s.v}</p></CardContent></Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by client, contact, or quote ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTS.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">{['Quote ID','Client','Services','Amount','Status','Valid Until','Actions'].map(h => <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-2 opacity-30" /><p>No quotations found</p></td></tr>
              )}
              {filtered.map(q => (
                <tr key={q.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4"><span className="font-mono text-xs text-gold">{q.docId}</span></td>
                  <td className="py-3 px-4"><p className="font-medium">{q.client}</p><p className="text-xs text-muted-foreground">{q.contact}</p></td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1 flex-wrap max-w-[220px]">
                      {servicesData.filter(s => q.serviceIds.includes(s.id)).slice(0,2).map(s => <Badge key={s.id} variant="outline" className="text-[10px] whitespace-nowrap">{s.name.split('(')[0].trim().slice(0,22)}</Badge>)}
                      {q.serviceIds.length > 2 && <Badge variant="outline" className="text-[10px]">+{q.serviceIds.length-2}</Badge>}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-semibold text-gold whitespace-nowrap">{formatCurrency(q.amount)}</td>
                  <td className="py-3 px-4">
                    <Select value={q.status} onValueChange={v => updateStatus(q.id, v)}>
                      <SelectTrigger className={`h-7 w-28 text-xs border ${getDocStatusColor(q.status)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTS.map(s => <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">{formatDate(q.valid)}</td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="History" onClick={() => setHistoryDoc(q)}>
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Download PDF"
                        onClick={() => handleDownload(q)} disabled={downloadingId === q.id}>
                        {downloadingId === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-400 hover:text-blue-400" title="Edit"
                        onClick={() => openEdit(q)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-400 hover:text-emerald-400" title="Send to client" onClick={() => setShareDoc({ id: q.id, title: `${q.docId} - ${q.client}` })}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-400" title="Delete" onClick={() => setDeleteId(q.id)}>
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

      <Dialog open={showCreate} onOpenChange={v => { if (!v) { setShowCreate(false); setForm(blankForm()) } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create New Quotation</DialogTitle></DialogHeader>
          <FormBody form={form} setForm={setForm} allSvcs={servicesData} selSvcs={selSvcs} subtotal={subtotal} discAmt={discAmt} gstAmt={gstAmt} grandTotal={grandTotal} toggleSvc={toggleSvc} paymentSchedules={paymentSchedules} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setForm(blankForm()) }}>Cancel</Button>
            <Button variant="gold" onClick={handleGenerate} disabled={generating}>{generating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating...</> : 'Generate PDF'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editQuote} onOpenChange={v => { if (!v) { setEditQuote(null); setForm(blankForm()) } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Quotation {editQuote?.docId}</DialogTitle></DialogHeader>
          <FormBody form={form} setForm={setForm} allSvcs={servicesData} selSvcs={selSvcs} subtotal={subtotal} discAmt={discAmt} gstAmt={gstAmt} grandTotal={grandTotal} toggleSvc={toggleSvc} paymentSchedules={paymentSchedules} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditQuote(null); setForm(blankForm()) }} disabled={generating}>Cancel</Button>
            <Button variant="gold" onClick={handleSaveEdit} disabled={generating} className="gap-2">
              {generating ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Quotation?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
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
              <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${h.canDownload ? 'border-border hover:border-gold/30 hover:bg-gold/5 cursor-pointer group' : 'border-transparent bg-muted/20 cursor-default'}` }
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
                  <Button
                    variant="ghost" size="icon"
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
        onSend={async (methods) => {
          if (shareDoc) updateStatus(shareDoc.id, 'sent')
        }}
      />
    </div>
  )
}

function buildContentBody(q: Quote, svcs: any[]) {
  const lines = [
    '## Why Netgain?',
    'We are a full-service digital growth agency specializing in high-converting digital experiences, data-driven marketing, and automation for modern businesses.',
    '',
    '## Service Breakdown',
    ...svcs.flatMap((s: any, i: number) => [
      `### ${i+1}. ${s.name}`,
      `**Category:** ${s.category}  |  **Timeline:** ${s.timeline}  |  **Model:** ${s.model === 'monthly' ? 'Monthly Recurring' : 'One-Time Fixed'}`,
      '',
      ...(s.deliverables?.map((d: any) => `- ${d}`) || []),
      '',
    ]),
    '## Payment Terms',
    '- One-time services: 50% advance to begin, 50% on delivery',
    '- Monthly retainers: Full month fee payable in advance',
    '- Accepted: NEFT / IMPS / UPI / Cheque',
    '',
    q.notes ? `## Additional Notes\n${q.notes}` : '',
    '',
    '## Validity',
    'This quotation is valid for **14 days** from the date of issue.',
  ]
  return lines.join('\n')
}
