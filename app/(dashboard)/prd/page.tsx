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
import { Plus, FileCode2, Download, Cpu, Layers, Database, Code, Edit, Trash2, History, Loader2 } from 'lucide-react'
import { formatDate, generateDocId } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { ClientAutocomplete } from '@/components/ui/client-autocomplete'
import { getCachedData, setCachedData, invalidateCache } from '@/lib/data-cache'



type PRD = {
  id: string; docId: string; title: string; client: string; stack: string; status: string; created: string; history: { date: string; action: string; canDownload?: boolean }[]
}

const mockPRDs: PRD[] = []

export default function PRDPage() {
  const [prds, setPrds] = useState<PRD[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [historyDoc, setHistoryDoc] = useState<PRD | null>(null)
  const { toast } = useToast()
  const [generating, setGenerating] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', client: '', productType: 'Web App', techStack: '', objectives: '', userPersonas: '', coreFeatures: '', database: '', apiEndpoints: '', uiFramework: '', timeline: '3 months', targetUsers: '' })

  useEffect(() => {
    const cached = getCachedData<PRD[]>('prds')
    if (cached) {
      setPrds(cached)
      setLoading(false)
    }

    async function loadPRDs() {
      if (!cached) setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase.from('prds').select('*').order('created_at', { ascending: false })
          if (error) {
            toast({ title: 'Error loading PRDs', description: error.message, variant: 'destructive' })
          } else if (data) {
            const mapped = data.map((p: any) => ({
              id: p.id,
              docId: p.doc_id,
              title: p.title,
              client: p.client,
              stack: p.stack || '',
              status: p.status || 'draft',
              created: p.created,
              history: Array.isArray(p.history) ? p.history : []
            }))
            setPrds(mapped)
            setCachedData('prds', mapped)
          }
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        }
      } else {
        setPrds(mockPRDs)
        setCachedData('prds', mockPRDs)
      }
      setLoading(false)
    }
    loadPRDs()
  }, [])


  const buildPrdContent = (f: typeof form) => {
    return `# Product Requirements Document (PRD)\n\n## Executive Summary\n**Product:** ${f.title}\n**Client:** ${f.client}\n**Type:** ${f.productType}\n**Tech Stack:** ${f.techStack}\n**Timeline:** ${f.timeline}\n\n## Problem Statement\n${f.objectives}\n\n## Target Users\n${f.targetUsers}\n\n## User Personas\n${f.userPersonas}\n\n## Core Features\n${f.coreFeatures}\n\n## Database Design\n${f.database || 'To be defined in technical specification phase.'}\n\n## API Endpoints\n${f.apiEndpoints || 'RESTful API architecture. Detailed endpoint mapping in technical spec.'}\n\n## UI Architecture\n**Framework:** ${f.uiFramework || f.techStack.split('+')[0] || 'To be determined'}\n\nKey screens: Dashboard, Login/Auth, Main CRUD views, Settings, Reports\n\n## Development Roadmap\n### Phase 1 — Foundation (Weeks 1-4)\n- Project setup and architecture\n- Auth system\n- Core database schema\n- Base UI components\n\n### Phase 2 — Core Features (Weeks 5-10)\n- Main feature modules\n- API integration\n- User flows\n\n### Phase 3 — Polish & Deploy (Weeks 11-12)\n- QA & testing\n- Performance optimization\n- Production deployment\n- Documentation\n\n## Success Metrics\n- Load time < 2 seconds\n- 99.9% uptime\n- Core user flows ≤ 3 clicks\n- User satisfaction score ≥ 4.5/5`
  }

  const handleGenerate = async () => {
    if (!form.title) return
    setGenerating(true)
    try {
      const docId = generateDocId('NG-PRD')
      const targetId = String(Date.now())
      const targetCreated = new Date().toISOString().slice(0, 10)
      const targetHistory = [{date: targetCreated, action: 'PRD Generated', canDownload: true}]

      const content = buildPrdContent(form)

      const payload = { docType: 'PRD', clientName: form.client, projectTitle: form.title, content, items: [], subtotal: 0, discountTotal: 0, grandTotal: 0 }
      const res = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('PDF failed')
      const blob = await res.blob()
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `PRD_${form.title.replace(/\s+/g, '_')}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a)

      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('prds').insert([{
          id: targetId,
          doc_id: docId,
          title: form.title,
          client: form.client,
          stack: form.techStack,
          status: 'draft',
          created: targetCreated,
          history: targetHistory
        }])
        if (error) {
          toast({ title: 'Error saving PRD to database', description: error.message, variant: 'destructive' })
          setGenerating(false)
          return
        }
      }

      const updatedList = [{ id: targetId, docId, title: form.title, client: form.client, stack: form.techStack, status: 'draft', created: targetCreated, history: targetHistory }, ...prds]
      setPrds(updatedList)
      setCachedData('prds', updatedList)
      invalidateCache('dashboard')
      setShowCreate(false); toast({ title: 'PRD Generated!', description: `${docId} created and downloaded.` })
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
    finally { setGenerating(false) }
  }


  const handleDelete = async () => {
    if (!deleteId) return
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('prds').delete().eq('id', deleteId)
        if (error) {
          toast({ title: 'Error deleting PRD', description: error.message, variant: 'destructive' })
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        return
      }
    }
    const updatedList = prds.filter(p => p.id !== deleteId)
    setPrds(updatedList)
    setCachedData('prds', updatedList)
    invalidateCache('dashboard')
    setDeleteId(null)
    toast({ title: 'PRD Deleted' })
  }


  const handleEditSubmit = async () => {
    if (!editId) return
    const targetPrd = prds.find(p => p.id === editId)
    if (!targetPrd) return

    const newHistory = [...targetPrd.history, {date: new Date().toISOString().slice(0, 10), action: 'PRD Updated', canDownload: true}]
    const updated = { ...targetPrd, title: form.title, client: form.client, stack: form.techStack, history: newHistory }

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('prds').update({
          title: form.title,
          client: form.client,
          stack: form.techStack,
          history: newHistory
        }).eq('id', editId)

        if (error) {
          toast({ title: 'Error saving PRD edit', description: error.message, variant: 'destructive' })
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        return
      }
    }

    const updatedList = prds.map(p => p.id === editId ? updated : p)
    setPrds(updatedList)
    setCachedData('prds', updatedList)
    invalidateCache('dashboard')
    setEditId(null)
    toast({ title: 'PRD Updated' })
  }


  const handleDownload = async (p: PRD) => {
    setDownloadingId(p.id)
    try {
      const formForPrd = {
        title: p.title,
        client: p.client,
        productType: 'Web App',
        techStack: p.stack,
        timeline: '3 months',
        objectives: 'As defined in original document generation objectives.',
        targetUsers: 'Primary target audience.',
        userPersonas: 'Core personas.',
        coreFeatures: 'Standard product modules and capabilities.',
        database: '',
        apiEndpoints: '',
        uiFramework: ''
      }
      const content = buildPrdContent(formForPrd)
      const payload = { docType: 'PRD', clientName: p.client, projectTitle: p.title, content, items: [], subtotal: 0, discountTotal: 0, grandTotal: 0 }
      const res = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('PDF failed')
      const blob = await res.blob()
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `PRD_${p.title.replace(/\s+/g, '_')}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a)

      const newHistory = [...p.history, {date: new Date().toISOString().slice(0, 10), action: 'PRD Downloaded', canDownload: true}]
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('prds').update({ history: newHistory }).eq('id', p.id)
        if (error) {
          toast({ title: 'Error updating PRD history', description: error.message, variant: 'destructive' })
        }
      }
      const updatedList = prds.map(doc => doc.id === p.id ? { ...doc, history: newHistory } : doc)
      setPrds(updatedList)
      setCachedData('prds', updatedList)
      toast({ title: 'Download Started', description: `Downloading ${p.docId}.pdf` })

    } catch (e: any) {
      toast({ title: 'Download failed', description: e.message, variant: 'destructive' })
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">PRD Engine</h1><p className="text-muted-foreground text-sm mt-0.5">Generate structured Product Requirements Documents for development projects.</p></div>
        <Button variant="gold" size="sm" onClick={() => setShowCreate(true)} className="gap-1.5"><Plus className="h-4 w-4" />New PRD</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
        {[{ icon: Layers, label: 'Executive Summary', desc: 'Product overview, goals & objectives' }, { icon: Database, label: 'DB Design & APIs', desc: 'Schema, endpoints, architecture' }, { icon: Code, label: 'UI Architecture', desc: 'Component map & user flows' }].map(f => (
          <Card key={f.label}><CardContent className="p-4 flex items-start gap-3"><div className="rounded-lg bg-gold/10 p-2"><f.icon className="h-5 w-5 text-gold" /></div><div><p className="text-sm font-semibold">{f.label}</p><p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p></div></CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {prds.map(p => (
          <Card key={p.id} className="hover:shadow-md hover:border-gold/20 transition-all">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1"><FileCode2 className="h-4 w-4 text-gold" /><span className="font-mono text-xs text-gold/70">{p.docId}</span></div>
                  <h3 className="font-semibold text-sm">{p.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.client}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Code className="h-3 w-3" />{p.stack}</span>
                    <span>{formatDate(p.created)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge variant={p.status === 'final' ? 'success' : 'outline'}>{p.status}</Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleDownload(p)} title="Download"><Download className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setHistoryDoc(p)} title="History"><History className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setForm({...form, title: p.title, client: p.client, techStack: p.stack}); setEditId(p.id) }} title="Edit"><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-400" onClick={() => setDeleteId(p.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Generate New PRD</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1"><Label>Product Name *</Label><Input placeholder="e.g. TechCore SaaS Dashboard 2.0" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
            <div className="space-y-1">
              <Label>Client</Label>
              <ClientAutocomplete
                placeholder="Company name"
                value={form.client}
                onChange={v => setForm({ ...form, client: v })}
                onSelect={client => setForm({
                  ...form,
                  client: client.business || client.name,
                  techStack: client.type ? `${client.type} Tech Stack` : form.techStack
                })}
              />
            </div>
            <div className="space-y-1"><Label>Product Type</Label><Select value={form.productType} onValueChange={v => setForm({...form, productType: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Web App', 'Mobile App', 'SaaS Platform', 'API Service', 'E-Commerce', 'Dashboard'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Tech Stack</Label><Input placeholder="e.g. Next.js + Supabase + Stripe" value={form.techStack} onChange={e => setForm({...form, techStack: e.target.value})} /></div>
            <div className="space-y-1"><Label>Timeline</Label><Input placeholder="e.g. 3 months" value={form.timeline} onChange={e => setForm({...form, timeline: e.target.value})} /></div>
            <div className="col-span-2 space-y-1"><Label>Objectives & Problem Statement</Label><Textarea className="h-20 resize-none" placeholder="What problem does this product solve? What are the goals?" value={form.objectives} onChange={e => setForm({...form, objectives: e.target.value})} /></div>
            <div className="col-span-2 space-y-1"><Label>Target Users / Personas</Label><Textarea className="h-16 resize-none" placeholder="Who will use this product? Describe primary user types." value={form.userPersonas} onChange={e => setForm({...form, userPersonas: e.target.value})} /></div>
            <div className="col-span-2 space-y-1"><Label>Core Features (one per line)</Label><Textarea className="h-20 resize-none" placeholder="User authentication&#10;Dashboard with analytics&#10;Invoice generation&#10;Client management" value={form.coreFeatures} onChange={e => setForm({...form, coreFeatures: e.target.value})} /></div>
            <div className="col-span-2 space-y-1"><Label>Key Database Tables (optional)</Label><Textarea className="h-16 resize-none" placeholder="users, clients, projects, invoices, services..." value={form.database} onChange={e => setForm({...form, database: e.target.value})} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button><Button variant="gold" onClick={handleGenerate} disabled={generating}>{generating ? 'Generating PRD...' : 'Generate PRD PDF'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editId} onOpenChange={(open) => !open && setEditId(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Edit PRD Details</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1"><Label>Product Name *</Label><Input placeholder="e.g. TechCore SaaS Dashboard 2.0" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
            <div className="space-y-1">
              <Label>Client</Label>
              <ClientAutocomplete
                placeholder="Company name"
                value={form.client}
                onChange={v => setForm({ ...form, client: v })}
                onSelect={client => setForm({
                  ...form,
                  client: client.business || client.name
                })}
              />
            </div>
            <div className="space-y-1"><Label>Tech Stack</Label><Input placeholder="e.g. Next.js + Supabase" value={form.techStack} onChange={e => setForm({...form, techStack: e.target.value})} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button><Button variant="gold" onClick={handleEditSubmit}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyDoc} onOpenChange={(open) => !open && setHistoryDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="border-b border-white/10 pb-3">
            <DialogTitle>Document History — {historyDoc?.docId}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">{historyDoc?.client} · Click any entry to download that version</p>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-[50vh] overflow-y-auto">
            {historyDoc?.history.slice().reverse().map((h, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${(h as any).canDownload ? 'border-border hover:border-gold/30 hover:bg-gold/5 cursor-pointer group' : 'border-transparent bg-muted/20 cursor-default'}`}
                onClick={() => { if ((h as any).canDownload && historyDoc) handleDownload(historyDoc) }}
              >
                <div className="flex-1 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-gold/50 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{h.action}</p>
                    <p className="text-xs text-muted-foreground">{h.date}</p>
                  </div>
                </div>
                {(h as any).canDownload && (
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

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete PRD?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the PRD record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>Delete PRD</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
