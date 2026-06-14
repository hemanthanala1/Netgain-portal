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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Search, Plus, Download, Trash2, Pencil, Loader2, Receipt, Send, History } from 'lucide-react'
import { formatCurrency, formatDate, getDocStatusColor, generateDocId } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { ShareDialog } from '@/components/ui/share-dialog'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { fetchFounderProfile } from '@/lib/founder-helper'
import { ClientAutocomplete } from '@/components/ui/client-autocomplete'
import { getCachedData, setCachedData, invalidateCache } from '@/lib/data-cache'



const STATUS_OPTS = ['draft', 'sent', 'paid', 'overdue']
const STATUS_LABELS: Record<string, string> = { draft: 'Draft', sent: 'Sent', paid: 'Paid', overdue: 'Overdue' }

type Invoice = {
  id: string; docId: string; client: string; contact: string; email: string; phone: string
  businessType: string; gst: string; serviceIds: string[]; discountType: 'percentage' | 'fixed'; discountValue: number; gstPct: number
  notes: string; amount: number; status: string; created: string; due: string
  history: { date: string; action: string; canDownload?: boolean }[]
  paymentScheduleId?: string;
  paymentScheduleEntry?: string;
}

const INITIAL: Invoice[] = []

function blankForm(initialDocs?: any) {
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
    gstPct: 18, 
    notes: initialDocs?.invoiceNotes || 'Thank you for your business!', 
    paymentScheduleId: '',
    paymentSchedulePointIndex: 'none',
    due: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10)
  }
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [servicesData, setServicesData] = useState<any[]>([])
  const [paymentSchedules, setPaymentSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const { toast } = useToast()
  const [generating, setGenerating] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [shareDoc, setShareDoc] = useState<{ id: string, title: string } | null>(null)
  const [historyDoc, setHistoryDoc] = useState<Invoice | null>(null)
  const [companyDocs, setCompanyDocs] = useState<any>(null)

  const [form, setForm] = useState(() => blankForm())

  useEffect(() => {
    const cached = getCachedData<{ invoices: Invoice[], servicesData: any[], paymentSchedules?: any[] }>('invoices')
    if (cached) {
      setInvoices(cached.invoices)
      setServicesData(cached.servicesData)
      if (cached.paymentSchedules) setPaymentSchedules(cached.paymentSchedules)
      setLoading(false)
    }

    async function loadData() {
      if (!cached) setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const [invRes, sRes, cRes] = await Promise.all([
            supabase.from('invoices').select('*').order('created', { ascending: false }),
            supabase.from('services').select('*').neq('status', 'archived').order('created_at', { ascending: false }),
            supabase.from('company_settings').select('*').limit(1).maybeSingle()
          ])

          if (invRes.error) throw invRes.error
          if (sRes.error) throw sRes.error

          let schedules = []
          if (cRes.data && cRes.data.docs) {
            setCompanyDocs(cRes.data.docs)
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
              paymentScheduleEntry: i.payment_schedule_entry || ''
            }))
            setInvoices(mappedInvoices)
          }

          setCachedData('invoices', { invoices: mappedInvoices, servicesData: mappedSvcs, paymentSchedules: schedules })
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        }
      } else {
        setInvoices(INITIAL)
        setCachedData('invoices', { invoices: INITIAL, servicesData: [], paymentSchedules: [] })
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
  const subtotal = selSvcs.reduce((a, s) => a + s.price, 0)
  const discAmt = form.discountType === 'percentage' 
    ? Math.round(subtotal * form.discountValue / 100) 
    : form.discountValue
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
      due: inv.due ? inv.due.slice(0, 10) : new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10)
    })
  }

  function toggleSvc(id: string) {
    setForm(f => ({ ...f, selectedIds: f.selectedIds.includes(id) ? f.selectedIds.filter(x => x !== id) : [...f.selectedIds, id] }))
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
    dueDate?: string
  ) {
    const svcs = servicesData.filter(s => svcIds.includes(s.id))
    const sub = svcs.reduce((a, s) => a + s.price, 0)
    const dAmt = discType === 'percentage' ? Math.round(sub * discVal / 100) : discVal
    const aft = Math.max(0, sub - dAmt)
    const gAmt = Math.round(aft * gst / 100)
    const tot = aft + gAmt

    let pct = 100
    if (paymentScheduleEntry) {
      const match = paymentScheduleEntry.match(/\((\d+)%\)/)
      if (match) {
        pct = Number(match[1])
      }
    }
    const scaleFactor = pct / 100
    const scaledSub = Math.round(sub * scaleFactor)
    const scaledDAmt = Math.round(dAmt * scaleFactor)
    const scaledAft = Math.max(0, scaledSub - scaledDAmt)
    const scaledGAmt = Math.round(scaledAft * gst / 100)
    const scaledTot = scaledAft + scaledGAmt

    const scaledItems = svcs.map(s => {
      const scaledPrice = Math.round(s.price * scaleFactor)
      let customName = s.name
      if (paymentScheduleEntry) {
        customName = `${s.name} - ${paymentScheduleEntry}`
      }
      return { 
        serviceName: customName, 
        finalPrice: scaledPrice, 
        price: scaledPrice, 
        quantity: 1, 
        category: s.category, 
        pricing_model: s.model, 
        deliverables: s.deliverables 
      }
    })

    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    const dueFormatted = dueDate
      ? new Date(dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date(Date.now() + 10 * 864e5).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

    const payload = {
      docType: 'Invoice',
      clientName: inv.contact || inv.client,
      projectTitle: `Invoice — ${docId}`,
      companyName: inv.client,
      clientInfo: { business: inv.businessType, mobile: inv.phone, gst: inv.gst },
      content: [
        `## Invoice Details`,
        `**Invoice Date:** ${today}  |  **Due Date:** ${dueFormatted}`,
        `**Invoice Ref:** ${docId}`,
        `${inv.gst ? `**Client GST:** ${inv.gst}` : ''}`,
        '',
        '## Services Rendered',
        ...scaledItems.flatMap((s: any, i: number) => [
          `### ${i + 1}. ${s.serviceName}`,
          `Category: ${s.category}  |  ${s.pricing_model === 'monthly' ? 'Monthly Recurring' : 'One-Time'}`,
          ...(s.deliverables?.map((d: any) => `- ${d}`) || []),
          '',
        ]),
        '## Payment Details',
        '__BANK_DETAILS__',
        ...(companyDocs?.invoicePaymentInstructions ? ['', companyDocs.invoicePaymentInstructions] : []),
        ...(companyDocs?.invoiceAdditionalText ? ['', '## Additional Details', companyDocs.invoiceAdditionalText] : []),
        ...(inv.notes ? ['', '## Notes', inv.notes] : []),
      ].join('\n'),
      items: scaledItems,
      subtotal: scaledSub,
      discountTotal: scaledDAmt,
      grandTotal: scaledTot,
      fullProjectTotal: tot,
      fullSubtotal: sub,
      paymentScheduleObj: paymentScheduleId ? paymentSchedules.find(p => p.id === paymentScheduleId) : null,
      docsSettings: {
        gstRate: String(gst),
        invoiceTerms: companyDocs?.invoiceTerms || '',
        invoiceFooter: companyDocs?.invoiceFooter || '',
      },
    }

    const res = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'PDF failed') }
    const blob = await res.blob()
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `Invoice_${docId}_${inv.client.replace(/\s+/g, '_')}.pdf`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
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
        paymentScheduleEntry: milestoneText
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
          payment_schedule_entry: milestoneText
        }])
        if (error) {
          toast({ title: 'Error saving to database', description: error.message, variant: 'destructive' })
          setGenerating(false)
          return
        }
      }

      const updatedInvoices = [newInv, ...invoices]
      setInvoices(updatedInvoices)
      setCachedData('invoices', { invoices: updatedInvoices, servicesData, paymentSchedules })
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
      due: targetDue
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
          due: targetDue
        }).eq('id', editInvoice.id)

        if (error) {
          toast({ title: 'Error saving edit to database', description: error.message, variant: 'destructive' })
          setGenerating(false)
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        setGenerating(false)
        return
      }
    }

    const updatedInvoices = invoices.map(i => i.id === editInvoice.id ? updated : i)
    setInvoices(updatedInvoices)
    setCachedData('invoices', { invoices: updatedInvoices, servicesData, paymentSchedules })
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
    setCachedData('invoices', { invoices: updatedInvoices, servicesData })
    invalidateCache('dashboard')
  }




  const totals = { total: invoices.reduce((a, i) => a + i.amount, 0), paid: invoices.filter(i => i.status === 'paid').reduce((a, i) => a + i.amount, 0), pending: invoices.filter(i => i.status !== 'paid').reduce((a, i) => a + i.amount, 0), overdue: invoices.filter(i => i.status === 'overdue').reduce((a, i) => a + i.amount, 0) }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight">Invoices</h1><p className="text-muted-foreground text-sm mt-0.5">Create and manage tax invoices for clients.</p></div>
        <Button variant="gold" size="sm" onClick={() => { setForm(blankForm()); setShowCreate(true) }} className="gap-1.5 w-full sm:w-auto"><Plus className="h-4 w-4" />New Invoice</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ l: 'Total Billed', v: formatCurrency(totals.total) }, { l: 'Paid', v: formatCurrency(totals.paid), c: 'text-emerald-400' }, { l: 'Pending', v: formatCurrency(totals.pending) }, { l: 'Overdue', v: formatCurrency(totals.overdue), c: 'text-red-400' }].map(s => (
          <Card key={s.l}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.l}</p><p className={`text-lg font-bold mt-1 ${s.c || ''}`}>{s.v}</p></CardContent></Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Status</SelectItem>{STATUS_OPTS.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">{['Invoice ID','Client','Services','Amount','Status','Due Date','Actions'].map(h => <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground"><Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" /><p>No invoices found</p></td></tr>}
              {filtered.map(inv => (
                <tr key={inv.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4"><span className="font-mono text-xs text-gold">{inv.docId}</span></td>
                  <td className="py-3 px-4"><p className="font-medium">{inv.client}</p><p className="text-xs text-muted-foreground">{inv.contact}</p></td>
                  <td className="py-3 px-4"><div className="flex gap-1 flex-wrap max-w-[180px]">{servicesData.filter(s => inv.serviceIds.includes(s.id)).slice(0,2).map(s => <Badge key={s.id} variant="outline" className="text-[10px]">{s.name.slice(0,18)}</Badge>)}{inv.serviceIds.length > 2 && <Badge variant="outline" className="text-[10px]">+{inv.serviceIds.length-2}</Badge>}</div></td>
                  <td className="py-3 px-4 font-semibold text-gold whitespace-nowrap">{formatCurrency(inv.amount)}</td>
                  <td className="py-3 px-4">
                    <Select value={inv.status} onValueChange={v => updateStatus(inv.id, v)}>
                      <SelectTrigger className={`h-7 w-28 text-xs border ${getDocStatusColor(inv.status)}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_OPTS.map(s => <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">{formatDate(inv.due)}</td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="History" onClick={() => setHistoryDoc(inv)}><History className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Download" onClick={() => handleDownload(inv)} disabled={downloadingId === inv.id}>
                        {downloadingId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-400 hover:text-blue-400" title="Edit" onClick={() => openEdit(inv)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-400 hover:text-emerald-400" title="Send to client" onClick={() => setShareDoc({ id: inv.id, title: `${inv.docId} - ${inv.client}` })}><Send className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-400" title="Delete" onClick={() => setDeleteId(inv.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={showCreate} onOpenChange={v => { setShowCreate(v); if (!v) setForm(blankForm(companyDocs)) }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create New Invoice</DialogTitle></DialogHeader>
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
                <div className="space-y-1"><Label>Business Type</Label>
                  <Select value={form.businessType} onValueChange={v => setForm({ ...form, businessType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{['E-Commerce','D2C Brand','B2B Company','SaaS / Software','Service Business'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>GST Number</Label><Input placeholder="Optional" value={form.gst} onChange={e => setForm({ ...form, gst: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label>Due Date *</Label>
                  <Input type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Services ({selSvcs.length} selected)</p>
              <div className="space-y-2">
                {servicesData.map(svc => {
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
                        <div><p className="text-sm font-medium">{svc.name}</p><p className="text-xs text-muted-foreground">{svc.category}</p></div>
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
                <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Pricing</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="col-span-1 sm:col-span-2 space-y-1">
                    <Label>Discount Type</Label>
                    <div className="flex bg-muted/30 p-1 rounded-md border border-border">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, discountType: 'percentage' })} className={`flex-1 h-7 text-xs ${form.discountType === 'percentage' ? 'bg-background shadow-sm text-gold' : 'text-muted-foreground'}`}>Percentage (%)</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, discountType: 'fixed' })} className={`flex-1 h-7 text-xs ${form.discountType === 'fixed' ? 'bg-background shadow-sm text-gold' : 'text-muted-foreground'}`}>Fixed (INR)</Button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="space-y-1"><Label>{form.discountType === 'percentage' ? 'Discount (%)' : 'Discount Amount'}</Label><Input type="number" min="0" max={form.discountType === 'percentage' ? "100" : undefined} value={form.discountValue} onChange={e => setForm({ ...form, discountValue: Number(e.target.value) })} /></div>
                  <div className="space-y-1"><Label>GST (%)</Label><Input type="number" min="0" max="28" value={form.gstPct} onChange={e => setForm({ ...form, gstPct: Number(e.target.value) })} /></div>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
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
            <div className="space-y-1"><Label>Notes</Label><Textarea className="resize-none h-16" placeholder="Payment instructions, custom notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setForm(blankForm(companyDocs)) }}>Cancel</Button>
            <Button variant="gold" onClick={handleGenerate} disabled={generating || selSvcs.length === 0}>
              {generating ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />Generating...</> : `Generate Invoice${invoiceAmount > 0 ? ` (${formatCurrency(invoiceAmount)})` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editInvoice} onOpenChange={v => { if (!v) { setEditInvoice(null); setForm(blankForm(companyDocs)) } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Invoice — {editInvoice?.docId}</DialogTitle></DialogHeader>
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
                <div className="space-y-1"><Label>Business Type</Label>
                  <Select value={form.businessType} onValueChange={v => setForm({ ...form, businessType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{['E-Commerce','D2C Brand','B2B Company','SaaS / Software','Service Business'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>GST Number</Label><Input placeholder="Optional" value={form.gst} onChange={e => setForm({ ...form, gst: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label>Due Date *</Label>
                  <Input type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Services ({selSvcs.length} selected)</p>
              <div className="space-y-2">
                {servicesData.map(svc => {
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
                        <div><p className="text-sm font-medium">{svc.name}</p><p className="text-xs text-muted-foreground">{svc.category}</p></div>
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
                <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Pricing</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="col-span-1 sm:col-span-2 space-y-1">
                    <Label>Discount Type</Label>
                    <div className="flex bg-muted/30 p-1 rounded-md border border-border">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, discountType: 'percentage' })} className={`flex-1 h-7 text-xs ${form.discountType === 'percentage' ? 'bg-background shadow-sm text-gold' : 'text-muted-foreground'}`}>Percentage (%)</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, discountType: 'fixed' })} className={`flex-1 h-7 text-xs ${form.discountType === 'fixed' ? 'bg-background shadow-sm text-gold' : 'text-muted-foreground'}`}>Fixed (INR)</Button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="space-y-1"><Label>{form.discountType === 'percentage' ? 'Discount (%)' : 'Discount Amount'}</Label><Input type="number" min="0" max={form.discountType === 'percentage' ? "100" : undefined} value={form.discountValue} onChange={e => setForm({ ...form, discountValue: Number(e.target.value) })} /></div>
                  <div className="space-y-1"><Label>GST (%)</Label><Input type="number" min="0" max="28" value={form.gstPct} onChange={e => setForm({ ...form, gstPct: Number(e.target.value) })} /></div>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
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
            <div className="space-y-1"><Label>Notes</Label><Textarea className="resize-none h-16" placeholder="Payment instructions, custom notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditInvoice(null); setForm(blankForm(companyDocs)) }} disabled={generating}>Cancel</Button>
            <Button variant="gold" onClick={handleSaveEdit} disabled={generating} className="gap-2">
              {generating ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
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
