'use client'

import { useRef, useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import {
  Search, Plus, Upload, Edit, Trash2, Clock, IndianRupee,
  List, Grid, Loader2, FileText, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

// ΓöÇΓöÇ Categories ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const DEFAULT_CATEGORIES = [
  { id: '1', name: 'Web Development',   icon: '🌐' },
  { id: '2', name: 'Digital Marketing', icon: '📢' },
  { id: '3', name: 'Paid Advertising',  icon: '💰' },
  { id: '4', name: 'SEO & GEO',         icon: '🔍' },
  { id: '5', name: 'Automation',        icon: '⚡' },
  { id: '6', name: 'Brand Design',      icon: '🎨' },
  { id: '7', name: 'Content Creation',  icon: '✍️' },
  { id: '8', name: 'CRM & Analytics',   icon: '📊' },
]

export interface Service {
  id: string
  catId: string
  name: string
  pricing: string
  basePrice: number
  priceMin?: number
  priceMax?: number
  quotationPrice?: number
  timeline: string
  status: string
  deliverables: string[]
  exclusions: string[]
}

const INITIAL_SERVICES: Service[] = []

function blankSvc(): Omit<Service, 'id'> {
  return { catId: '1', name: '', pricing: 'fixed', basePrice: 0, priceMin: 0, priceMax: 0, quotationPrice: 0, timeline: '', status: 'active', deliverables: [], exclusions: [] }
}

// ── Service type ─────────────────────────────────────────────────────────────────────────────
type ExtractedService = {
  name: string
  pricing: string
  basePrice: number
  priceMin?: number
  priceMax?: number
  quotationPrice?: number
  catId: string
  timeline: string
  deliverables: string[]
  exclusions: string[]
  status: string
}

// ── Component ──────────────────────────────────────────────────────────────────────────────────
export default function ServicesPage() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [svcs, setSvcs] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('all')
  const [gridView, setGridView] = useState(false)
  const [categories, setCategories] = useState<{id: string, name: string, icon: string}[]>(DEFAULT_CATEGORIES)

  // Dialogs
  const [showAdd, setShowAdd]         = useState(false)
  const [editItem, setEditItem]       = useState<Service | null>(null)
  const [deleteId, setDeleteId]       = useState<string | null>(null)
  const [showUpload, setShowUpload]   = useState(false)
  const [showManageCats, setShowManageCats] = useState(false)
  const [catDrafts, setCatDrafts]     = useState<{id: string, name: string, icon: string}[]>([])

  // Form state
  const [form, setForm] = useState<Omit<Service, 'id'>>(blankSvc())

  // Upload state
  const [uploadFile, setUploadFile]   = useState<File | null>(null)
  const [uploading, setUploading]     = useState(false)
  const [extracted, setExtracted]     = useState<ExtractedService[]>([])
  const [extractWarning, setExtractWarning] = useState<string | null>(null)
  const [selectedExtracted, setSelectedExtracted] = useState<number[]>([])
  const [pendingImport, setPendingImport] = useState<ExtractedService[] | null>(null)
  const [duplicateConflicts, setDuplicateConflicts] = useState<ExtractedService[]>([])
  const [duplicateAction, setDuplicateAction] = useState<'keep' | 'merge' | 'ignore'>('keep')
  const [submitting, setSubmitting]   = useState(false)
  const [deleting, setDeleting]       = useState(false)

  // Filter
  const filtered = svcs.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = selectedCat === 'all' || s.catId === selectedCat
    return matchSearch && matchCat
  })

  useEffect(() => {
    async function loadServices() {
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase
            .from('services')
            .select('*')
            .order('created_at', { ascending: false })
          if (error) {
            toast({ title: 'Error loading services', description: error.message, variant: 'destructive' })
          } else if (data) {
            const mapped: Service[] = data.map((s: any) => ({
              id: s.id,
              catId: s.cat_id,
              name: s.name,
              pricing: s.pricing,
              basePrice: Number(s.base_price) || 0,
              priceMin: s.price_min !== null ? Number(s.price_min) : undefined,
              priceMax: s.price_max !== null ? Number(s.price_max) : undefined,
              quotationPrice: s.quotation_price !== null ? Number(s.quotation_price) : undefined,
              timeline: s.timeline || '',
              status: s.status || 'active',
              deliverables: s.deliverables || [],
              exclusions: s.exclusions || [],
            }))
            setSvcs(mapped)
          }
          
          // Load Categories
          const { data: cData } = await supabase.from('company_settings').select('docs').limit(1).maybeSingle()
          if (cData && cData.docs && cData.docs.serviceCategories && Array.isArray(cData.docs.serviceCategories)) {
            setCategories(cData.docs.serviceCategories)
          }
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        }
      } else {
        setSvcs(INITIAL_SERVICES)
        setCategories(DEFAULT_CATEGORIES)
      }
      setLoading(false)
    }
    loadServices()
  }, [])

  async function handleSaveCategories() {
    setSubmitting(true)
    try {
      if (isSupabaseConfigured()) {
        const { data: exist } = await supabase.from('company_settings').select('id, docs').limit(1).maybeSingle()
        if (exist) {
          const updatedDocs = { ...(exist.docs || {}), serviceCategories: catDrafts }
          await supabase.from('company_settings').update({ docs: updatedDocs }).eq('id', exist.id)
        } else {
          // Typically there is a row, but if not we shouldn't insert without user_id context, so just skip
          toast({ title: 'Company settings row not found', variant: 'destructive' })
        }
      }
      setCategories(catDrafts)
      setShowManageCats(false)
      toast({ title: '✅ Categories updated' })
    } catch (e: any) {
      toast({ title: 'Database Error', description: e.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Add / Edit ────────────────────────────────────────────────────────────────────────────
  function openAdd() {
    setForm(blankSvc())
    setShowAdd(true)
  }

  function openEdit(svc: Service) {
    setEditItem(svc)
    setForm({ catId: svc.catId, name: svc.name, pricing: svc.pricing, basePrice: svc.basePrice, priceMin: svc.priceMin, priceMax: svc.priceMax, quotationPrice: svc.quotationPrice, timeline: svc.timeline, status: svc.status, deliverables: svc.deliverables, exclusions: svc.exclusions })
  }

  async function handleSave() {
    if (!form.name.trim()) { toast({ title: 'Service name is required', variant: 'destructive' }); return }
    setSubmitting(true)
    try {
      if (editItem) {
        if (isSupabaseConfigured()) {
          const { error } = await supabase.from('services').update({
            cat_id: form.catId,
            name: form.name,
            pricing: form.pricing,
            base_price: form.basePrice,
            price_min: form.priceMin || null,
            price_max: form.priceMax || null,
            quotation_price: form.quotationPrice || null,
            timeline: form.timeline,
            status: form.status,
            deliverables: form.deliverables,
            exclusions: form.exclusions
          }).eq('id', editItem.id)
          if (error) {
            toast({ title: 'Error saving changes', description: error.message, variant: 'destructive' })
            return
          }
        }
        setSvcs(svcs.map(s => s.id === editItem.id ? { ...editItem, ...form } : s))
        setEditItem(null)
        toast({ title: '✅ Service updated' })
      } else {
        const newId = String(Date.now())
        if (isSupabaseConfigured()) {
          const { error } = await supabase.from('services').insert([{
            id: newId,
            cat_id: form.catId,
            name: form.name,
            pricing: form.pricing,
            base_price: form.basePrice,
            price_min: form.priceMin || null,
            price_max: form.priceMax || null,
            quotation_price: form.quotationPrice || null,
            timeline: form.timeline,
            status: form.status,
            deliverables: form.deliverables,
            exclusions: form.exclusions
          }])
          if (error) {
            toast({ title: 'Error adding service', description: error.message, variant: 'destructive' })
            return
          }
        }
        setSvcs([{ id: newId, ...form }, ...svcs])
        setShowAdd(false)
        toast({ title: '✅ Service added' })
      }
      setForm(blankSvc())
    } catch (err: any) {
      toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('services').delete().eq('id', deleteId)
        if (error) {
          toast({ title: 'Error deleting service', description: error.message, variant: 'destructive' })
          return
        }
      }
      setSvcs(svcs.filter(s => s.id !== deleteId))
      setDeleteId(null)
      toast({ title: 'Service deleted' })
    } catch (err: any) {
      toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  // ── PDF Upload & Extract ─────────────────────────────────────────────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf' && !f.name.endsWith('.pdf')) {
      toast({ title: 'Please upload a PDF file', variant: 'destructive' }); return
    }
    setUploadFile(f)
    setExtracted([])
    setSelectedExtracted([])
  }

  async function handleExtract() {
    if (!uploadFile) return
    setUploading(true)
    setExtractWarning(null)
    try {
      // Send PDF to server-side API (uses pdf-parse for reliable text extraction)
      const fd = new FormData()
      fd.append('file', uploadFile)

      const res = await fetch('/api/extract-pdf-services', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Server error during extraction')
      }

      const found: ExtractedService[] = data.services || []

      if (data.warning) setExtractWarning(data.warning)

      if (found.length === 0) {
        setExtractWarning(
          data.warning ||
          `No services could be detected. The PDF contained ${data.charCount || 0} characters across ${data.pageCount || '?'} page(s). ` +
          'Try a text-based PDF (not a scanned image). You can still add services manually.'
        )
        toast({
          title: 'No services detected',
          description: 'Check the warning below for details.',
          variant: 'destructive',
        })
      } else {
        setExtracted(found)
        setSelectedExtracted(found.map((_, i) => i))
        toast({
          title: `✅ Found ${found.length} service${found.length > 1 ? 's' : ''}`,
          description: `Extracted from ${data.pageCount} page(s). Review and select which to import.`,
        })
      }
    } catch (err: any) {
      toast({
        title: 'Extraction failed',
        description: err.message || 'Could not read the PDF. Try a different file.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  function handleImport() {
    const toImport = selectedExtracted.map(i => extracted[i]).filter(Boolean) as ExtractedService[]
    
    // Detect duplicates
    const conflicts = toImport.filter(s => 
      svcs.some(existing => existing.name.toLowerCase() === s.name.toLowerCase())
    )

    if (conflicts.length > 0) {
      setDuplicateConflicts(conflicts)
      setPendingImport(toImport)
      return
    }

    executeImport(toImport)
  }

  async function executeImport(toImport: ExtractedService[], action: 'keep' | 'merge' | 'ignore' = 'keep') {
    setSubmitting(true)
    try {
      let currentSvcs = [...svcs]
      const addedSvcs: Service[] = []

      for (const s of toImport) {
        const existingIdx = currentSvcs.findIndex(existing => existing.name.toLowerCase() === s.name.toLowerCase())
        
        if (existingIdx !== -1) {
          if (action === 'ignore') continue
          if (action === 'merge') {
            // Overwrite existing
            const existing = currentSvcs[existingIdx];
            const updatedForm = {
              pricing: s.pricing || 'fixed',
              basePrice: s.basePrice || 0,
              priceMin: s.priceMin,
              priceMax: s.priceMax,
              quotationPrice: s.quotationPrice,
              timeline: s.timeline || '',
              deliverables: s.deliverables || [],
              catId: s.catId || existing.catId,
            }

            if (isSupabaseConfigured()) {
              const { error } = await supabase.from('services').update({
                pricing: updatedForm.pricing,
                base_price: updatedForm.basePrice,
                price_min: updatedForm.priceMin || null,
                price_max: updatedForm.priceMax || null,
                quotation_price: updatedForm.quotationPrice || null,
                timeline: updatedForm.timeline,
                deliverables: updatedForm.deliverables,
                cat_id: updatedForm.catId,
              }).eq('id', existing.id)
              if (error) {
                toast({ title: 'Error merging service', description: error.message, variant: 'destructive' })
                continue
              }
            }

            currentSvcs[existingIdx] = {
              ...existing,
              ...updatedForm,
            }
            continue
          }
          // If 'keep', fall through to add as new
        }

        const newId = String(Date.now() + Math.random())
        const newSvc: Service = {
          id: newId,
          catId: s.catId || '1',
          name: s.name || 'Unnamed Service',
          pricing: s.pricing || 'fixed',
          basePrice: s.basePrice || 0,
          priceMin: s.priceMin,
          priceMax: s.priceMax,
          quotationPrice: s.quotationPrice,
          timeline: s.timeline || '',
          status: 'draft',
          deliverables: s.deliverables || [],
          exclusions: s.exclusions || [],
        }

        if (isSupabaseConfigured()) {
          const { error } = await supabase.from('services').insert([{
            id: newSvc.id,
            cat_id: newSvc.catId,
            name: newSvc.name,
            pricing: newSvc.pricing,
            base_price: newSvc.basePrice,
            price_min: newSvc.priceMin || null,
            price_max: newSvc.priceMax || null,
            quotation_price: newSvc.quotationPrice || null,
            timeline: newSvc.timeline,
            status: newSvc.status,
            deliverables: newSvc.deliverables,
            exclusions: newSvc.exclusions
          }])
          if (error) {
            toast({ title: 'Error importing service', description: error.message, variant: 'destructive' })
            continue
          }
        }

        addedSvcs.push(newSvc)
      }

      setSvcs([...addedSvcs, ...currentSvcs])
      setShowUpload(false)
      setUploadFile(null)
      setExtracted([])
      setExtractWarning(null)
      setSelectedExtracted([])
      setPendingImport(null)
      setDuplicateConflicts([])
      toast({ title: `✅ Imported ${toImport.length} service${toImport.length > 1 ? 's' : ''}`, description: 'Review and update deliverables/prices as needed.' })
    } catch (err: any) {
      toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Services Library</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Centralized pricing, deliverables, and service data — single source of truth.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href="/api/generate-sample-services" target="_blank" rel="noopener noreferrer">
              <FileText className="h-4 w-4" /> Download Sample
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowUpload(true)} className="gap-1.5">
            <Upload className="h-4 w-4" /> Upload PDF
          </Button>
          <Button variant="gold" size="sm" onClick={openAdd} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Service
          </Button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { l: 'Total Services', v: svcs.length },
          { l: 'Active',         v: svcs.filter(s => s.status === 'active').length },
          { l: 'One-Time',       v: svcs.filter(s => s.pricing === 'fixed').length },
          { l: 'Monthly',        v: svcs.filter(s => s.pricing === 'monthly').length },
        ].map(s => (
          <div key={s.l} className="rounded-xl border border-border bg-muted/20 p-3 text-center">
            <p className="text-2xl font-bold">{s.v}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>

      {/* ── Category Pills ── */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => setSelectedCat('all')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${selectedCat === 'all' ? 'border-gold/50 bg-gold/10 text-gold' : 'border-border hover:border-gold/30 text-muted-foreground'}`}
        >
          📁 All ({svcs.length})
        </button>
        {categories.map(cat => {
          const cnt = svcs.filter(s => s.catId === cat.id).length
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${selectedCat === cat.id ? 'border-gold/50 bg-gold/10 text-gold' : 'border-border hover:border-gold/30 text-muted-foreground'}`}
            >
              {cat.icon} {cat.name} ({cnt})
            </button>
          )
        })}
        <Button variant="ghost" size="sm" onClick={() => { setCatDrafts([...categories]); setShowManageCats(true); }} className="h-7 text-xs text-muted-foreground ml-2">
          <Edit className="h-3 w-3 mr-1" /> Manage Categories
        </Button>
      </div>

      {/* ── Search + View Toggle ── */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="icon" onClick={() => setGridView(!gridView)}>
          {gridView ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
        </Button>
      </div>

      {/* ── Service Cards ── */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <span className="ml-2 text-sm text-muted-foreground">Loading services...</span>
        </div>
      ) : (
        <div className={gridView ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
          {filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>No services found</p>
            </div>
          )}
          {filtered.map(svc => (
            <Card key={svc.id} className="group hover:shadow-md transition-all hover:border-gold/20">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Name + status */}
                    <div className="flex items-start gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm leading-tight flex-1">{svc.name}</h3>
                      <Badge className={`text-[10px] shrink-0 ${svc.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                        {svc.status}
                      </Badge>
                    </div>

                    {/* Price + payment type */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-sm font-bold text-gold flex items-center gap-1">
                        <IndianRupee className="h-3.5 w-3.5" />
                        {formatCurrency(svc.basePrice)}{svc.pricing === 'monthly' ? '/mo' : ''}
                      </span>
                      <Badge className={`text-[10px] font-medium ${svc.pricing === 'monthly' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                        {svc.pricing === 'monthly' ? '🔄 Monthly Recurring' : '💳 One-Time Payment'}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />{svc.timeline || '—'}
                      </span>
                    </div>

                    {/* Deliverables preview */}
                    {!gridView && svc.deliverables.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {svc.deliverables.slice(0, 4).map(d => (
                          <span key={d} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{d}</span>
                        ))}
                        {svc.deliverables.length > 4 && (
                          <span className="text-[10px] text-muted-foreground">+{svc.deliverables.length - 4} more</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action buttons — always visible */}
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-blue-400 hover:text-blue-400 hover:bg-blue-400/10"
                      title="Edit service"
                      onClick={() => openEdit(svc)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-400 hover:bg-red-400/10"
                      title="Delete service"
                      onClick={() => setDeleteId(svc.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Add Service Dialog ── */}
      <Dialog open={showAdd} onOpenChange={v => { if (!submitting) { setShowAdd(v); if (!v) setForm(blankSvc()) } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add New Service</DialogTitle></DialogHeader>
          
    <div className="grid grid-cols-2 gap-4 py-2">
      <div className="col-span-2 space-y-1">
        <Label>Service Name *</Label>
        <Input placeholder="e.g. E-Commerce Website (Shopify)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} disabled={submitting} />
      </div>
      <div className="space-y-1">
        <Label>Category</Label>
        <Select value={form.catId} onValueChange={v => setForm({ ...form, catId: v })} disabled={submitting}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Pricing Model</Label>
        <Select value={form.pricing} onValueChange={v => setForm({ ...form, pricing: v })} disabled={submitting}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Fixed — One-Time Payment</SelectItem>
            <SelectItem value="monthly">Monthly Recurring</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Base/Default Price (INR)</Label>
        <Input type="number" placeholder="39999" value={form.basePrice || ''} onChange={e => setForm({ ...form, basePrice: Number(e.target.value) })} disabled={submitting} />
      </div>
      <div className="space-y-1">
        <Label>Quotation Max Price (INR)</Label>
        <Input type="number" placeholder="45000" value={form.quotationPrice || ''} onChange={e => setForm({ ...form, quotationPrice: Number(e.target.value) })} disabled={submitting} />
      </div>
      <div className="space-y-1">
        <Label>Price Range Min (optional)</Label>
        <Input type="number" placeholder="25000" value={form.priceMin || ''} onChange={e => setForm({ ...form, priceMin: Number(e.target.value) })} disabled={submitting} />
      </div>
      <div className="space-y-1">
        <Label>Price Range Max (optional)</Label>
        <Input type="number" placeholder="50000" value={form.priceMax || ''} onChange={e => setForm({ ...form, priceMax: Number(e.target.value) })} disabled={submitting} />
      </div>
      <div className="col-span-2 space-y-1">
        <Label>Timeline</Label>
        <Input placeholder="15-20 days / Ongoing" value={form.timeline} onChange={e => setForm({ ...form, timeline: e.target.value })} disabled={submitting} />
      </div>
      <div className="space-y-1">
        <Label>Status</Label>
        <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })} disabled={submitting}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 space-y-1">
        <Label>Deliverables (one per line)</Label>
        <Textarea
          className="h-24 resize-none"
          placeholder={"Figma Design\nFull Development\nMobile Responsive\nPayment Gateway"}
          value={form.deliverables.join('\n')}
          onChange={e => setForm({ ...form, deliverables: e.target.value.split('\n').filter(Boolean) })}
          disabled={submitting}
        />
      </div>
      <div className="col-span-2 space-y-1">
        <Label>Exclusions (one per line)</Label>
        <Textarea
          className="h-16 resize-none"
          placeholder={"Domain registration\nHosting fees\nThird-party subscriptions"}
          value={form.exclusions.join('\n')}
          onChange={e => setForm({ ...form, exclusions: e.target.value.split('\n').filter(Boolean) })}
          disabled={submitting}
        />
      </div>
    </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setForm(blankSvc()) }} disabled={submitting}>Cancel</Button>
            <Button variant="gold" onClick={handleSave} disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : 'Save Service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Service Dialog ── */}
      <Dialog open={!!editItem} onOpenChange={v => { if (!v && !submitting) { setEditItem(null); setForm(blankSvc()) } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Service — {editItem?.name}</DialogTitle></DialogHeader>
          
    <div className="grid grid-cols-2 gap-4 py-2">
      <div className="col-span-2 space-y-1">
        <Label>Service Name *</Label>
        <Input placeholder="e.g. E-Commerce Website (Shopify)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} disabled={submitting} />
      </div>
      <div className="space-y-1">
        <Label>Category</Label>
        <Select value={form.catId} onValueChange={v => setForm({ ...form, catId: v })} disabled={submitting}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Pricing Model</Label>
        <Select value={form.pricing} onValueChange={v => setForm({ ...form, pricing: v })} disabled={submitting}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Fixed — One-Time Payment</SelectItem>
            <SelectItem value="monthly">Monthly Recurring</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Base/Default Price (INR)</Label>
        <Input type="number" placeholder="39999" value={form.basePrice || ''} onChange={e => setForm({ ...form, basePrice: Number(e.target.value) })} disabled={submitting} />
      </div>
      <div className="space-y-1">
        <Label>Quotation Max Price (INR)</Label>
        <Input type="number" placeholder="45000" value={form.quotationPrice || ''} onChange={e => setForm({ ...form, quotationPrice: Number(e.target.value) })} disabled={submitting} />
      </div>
      <div className="space-y-1">
        <Label>Price Range Min (optional)</Label>
        <Input type="number" placeholder="25000" value={form.priceMin || ''} onChange={e => setForm({ ...form, priceMin: Number(e.target.value) })} disabled={submitting} />
      </div>
      <div className="space-y-1">
        <Label>Price Range Max (optional)</Label>
        <Input type="number" placeholder="50000" value={form.priceMax || ''} onChange={e => setForm({ ...form, priceMax: Number(e.target.value) })} disabled={submitting} />
      </div>
      <div className="col-span-2 space-y-1">
        <Label>Timeline</Label>
        <Input placeholder="15-20 days / Ongoing" value={form.timeline} onChange={e => setForm({ ...form, timeline: e.target.value })} disabled={submitting} />
      </div>
      <div className="space-y-1">
        <Label>Status</Label>
        <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })} disabled={submitting}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 space-y-1">
        <Label>Deliverables (one per line)</Label>
        <Textarea
          className="h-24 resize-none"
          placeholder={"Figma Design\nFull Development\nMobile Responsive\nPayment Gateway"}
          value={form.deliverables.join('\n')}
          onChange={e => setForm({ ...form, deliverables: e.target.value.split('\n').filter(Boolean) })}
          disabled={submitting}
        />
      </div>
      <div className="col-span-2 space-y-1">
        <Label>Exclusions (one per line)</Label>
        <Textarea
          className="h-16 resize-none"
          placeholder={"Domain registration\nHosting fees\nThird-party subscriptions"}
          value={form.exclusions.join('\n')}
          onChange={e => setForm({ ...form, exclusions: e.target.value.split('\n').filter(Boolean) })}
          disabled={submitting}
        />
      </div>
    </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditItem(null); setForm(blankSvc()) }} disabled={submitting}>Cancel</Button>
            <Button variant="gold" onClick={handleSave} disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Save Changes</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v && !deleting) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{svcs.find(s => s.id === deleteId)?.name}" from the library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleting}>
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting...</> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── PDF Upload Dialog ── */}
      <Dialog open={showUpload} onOpenChange={v => { setShowUpload(v); if (!v) { setUploadFile(null); setExtracted([]); setExtractWarning(null); setSelectedExtracted([]) } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Pricing PDF</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${uploadFile ? 'border-gold/50 bg-gold/5' : 'border-border hover:border-gold/30 hover:bg-muted/30'}`}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadFile ? (
                <>
                  <FileText className="h-8 w-8 mx-auto text-gold mb-2" />
                  <p className="text-sm font-semibold text-gold">{uploadFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(uploadFile.size / 1024).toFixed(0)} KB — Click to change</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm font-semibold">Drop your pricing PDF here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse — PDF up to 10MB</p>
                  <Button variant="outline" size="sm" className="mt-4 pointer-events-none">Browse File</Button>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                ℹ️ The system extracts service names and prices from text-based PDFs. Image-only or scanned PDFs cannot be parsed.
              </p>
              <a href="/api/generate-sample-services" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-gold hover:underline flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Download Sample Format
              </a>
            </div>

            {/* Warning: no services found */}
            {extractWarning && extracted.length === 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-300 leading-relaxed">{extractWarning}</p>
              </div>
            )}

            {/* Extract button */}
            {uploadFile && extracted.length === 0 && (
              <Button variant="gold" className="w-full gap-2" onClick={handleExtract} disabled={uploading}>
                {uploading ? <><Loader2 className="h-4 w-4 animate-spin" />Analysing PDF...</> : 'Extract Services from PDF'}
              </Button>
            )}

            {/* Extracted results */}
            {extracted.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{extracted.length} services detected</p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedExtracted(extracted.map((_, i) => i))}>Select All</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedExtracted([])}>Deselect All</Button>
                  </div>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {extracted.map((svc, i) => {
                    const sel = selectedExtracted.includes(i)
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedExtracted(sel ? selectedExtracted.filter(x => x !== i) : [...selectedExtracted, i])}
                        className={`w-full text-left flex items-start gap-3 rounded-lg border p-3 transition-all ${sel ? 'border-gold/50 bg-gold/5' : 'border-border hover:border-gold/20'}`}
                      >
                        {sel
                          ? <CheckCircle2 className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                          : <XCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight">{svc.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-gold font-semibold">
                              {svc.basePrice ? formatCurrency(svc.basePrice) : 'Price TBD'}
                              {svc.pricing === 'monthly' ? '/mo' : ''}
                            </span>
                            <Badge className={`text-[10px] ${svc.pricing === 'monthly' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                              {svc.pricing === 'monthly' ? '🔄 Monthly' : '💳 One-Time'}
                            </Badge>
                            {categories.find(c => c.id === svc.catId) && (
                              <span className="text-[10px] text-muted-foreground">{categories.find(c => c.id === svc.catId)?.icon} {categories.find(c => c.id === svc.catId)?.name}</span>
                            )}
                          </div>
                          {svc.deliverables && svc.deliverables.length > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-1">{svc.deliverables.slice(0, 3).join(' · ')}{svc.deliverables.length > 3 ? ` +${svc.deliverables.length - 3} more` : ''}</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedExtracted.length} of {extracted.length} selected. Imported services will be in "draft" status — review and activate as needed.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUpload(false); setUploadFile(null); setExtracted([]); setSelectedExtracted([]) }} disabled={uploading || submitting}>Cancel</Button>
            {extracted.length > 0
              ? <Button variant="gold" onClick={handleImport} disabled={selectedExtracted.length === 0 || submitting}>
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importing...</> : `Import ${selectedExtracted.length} Service${selectedExtracted.length !== 1 ? 's' : ''}`}
                </Button>
              : <Button variant="gold" onClick={handleExtract} disabled={!uploadFile || uploading}>
                  {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Extracting...</> : 'Extract & Import'}
                </Button>
            }
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Resolution Modal */}
      <Dialog open={duplicateConflicts.length > 0} onOpenChange={(o) => { if(!o) { setDuplicateConflicts([]); setPendingImport(null); } }}>
        <DialogContent className="max-w-md bg-[#121212] border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              Duplicate Services Detected
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              {duplicateConflicts.length} service(s) you are trying to import already exist in your library. How would you like to handle them?
            </p>
            <div className="max-h-32 overflow-y-auto border border-border rounded-md p-2 space-y-1">
              {duplicateConflicts.map((c, idx) => (
                <div key={idx} className="text-xs text-foreground px-2 py-1 bg-muted/20 rounded">
                  {c.name}
                </div>
              ))}
            </div>
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3 cursor-pointer p-2 border border-border rounded-lg hover:bg-muted/10 transition-colors">
                <input type="radio" name="dupAction" checked={duplicateAction === 'keep'} onChange={() => setDuplicateAction('keep')} className="accent-gold" />
                <div>
                  <p className="text-sm font-medium">Keep Both</p>
                  <p className="text-xs text-muted-foreground">Import as new services alongside existing ones.</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-2 border border-border rounded-lg hover:bg-muted/10 transition-colors">
                <input type="radio" name="dupAction" checked={duplicateAction === 'merge'} onChange={() => setDuplicateAction('merge')} className="accent-gold" />
                <div>
                  <p className="text-sm font-medium">Merge (Overwrite)</p>
                  <p className="text-xs text-muted-foreground">Update existing services with new pricing and deliverables.</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-2 border border-border rounded-lg hover:bg-muted/10 transition-colors">
                <input type="radio" name="dupAction" checked={duplicateAction === 'ignore'} onChange={() => setDuplicateAction('ignore')} className="accent-gold" />
                <div>
                  <p className="text-sm font-medium">Ignore Duplicates</p>
                  <p className="text-xs text-muted-foreground">Skip these and only import completely new services.</p>
                </div>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDuplicateConflicts([]); setPendingImport(null); }} disabled={submitting}>Cancel</Button>
            <Button variant="gold" onClick={() => executeImport(pendingImport!, duplicateAction)} disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importing...</> : 'Confirm & Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manage Categories Dialog ── */}
      <Dialog open={showManageCats} onOpenChange={v => { if (!v && !submitting) setShowManageCats(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Manage Service Categories</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3 max-h-[60vh] overflow-y-auto">
            {catDrafts.map((cat, idx) => (
              <div key={cat.id} className="flex gap-2 items-center border border-border p-2 rounded bg-muted/10">
                <Input className="w-16 h-8 text-center" value={cat.icon} onChange={e => {
                  const n = [...catDrafts]; n[idx].icon = e.target.value; setCatDrafts(n)
                }} placeholder="Icon" />
                <Input className="flex-1 h-8" value={cat.name} onChange={e => {
                  const n = [...catDrafts]; n[idx].name = e.target.value; setCatDrafts(n)
                }} placeholder="Category Name" />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-400 shrink-0" onClick={() => {
                  const n = [...catDrafts]; n.splice(idx, 1); setCatDrafts(n)
                }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => {
              setCatDrafts([...catDrafts, { id: String(Date.now()), name: 'New Category', icon: '📁' }])
            }}><Plus className="h-4 w-4 mr-2" /> Add Category</Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManageCats(false)} disabled={submitting}>Cancel</Button>
            <Button variant="gold" onClick={handleSaveCategories} disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : 'Save Categories'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
