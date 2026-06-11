'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Progress } from '@/components/ui/progress'
import { Search, Plus, Zap, Calendar, DollarSign, Users, Download, CheckCircle2, Clock, AlertTriangle, Edit, Trash2, History, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate, generateDocId } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { ClientAutocomplete } from '@/components/ui/client-autocomplete'
import { getCachedData, setCachedData, invalidateCache } from '@/lib/data-cache'



type Project = {
  id: string; title: string; client: string; type: string; budget: number; spent: number; timeline: string; status: string; progress: number; milestones: string[]; startDate: string; pm: string; history: { date: string; action: string; canDownload?: boolean }[]
}

const mockProjects: Project[] = []

const statusColors: Record<string, string> = { active: 'text-emerald-400 bg-emerald-500/10', planned: 'text-blue-400 bg-blue-500/10', completed: 'text-muted-foreground bg-muted', paused: 'text-yellow-400 bg-yellow-500/10' }

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [historyProject, setHistoryProject] = useState<Project | null>(null)
  const { toast } = useToast()
  const [generating, setGenerating] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const [form, setForm] = useState({ title: '', client: '', type: 'Web Development', budget: '', timeline: '', goals: '', services: '', risks: '', resources: '', successMetrics: '' })

  useEffect(() => {
    const cached = getCachedData<Project[]>('projects')
    if (cached) {
      setProjects(cached)
      setLoading(false)
    }

    async function loadProjects() {
      if (!cached) setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
          if (error) {
            toast({ title: 'Error loading projects', description: error.message, variant: 'destructive' })
          } else if (data) {
            const mapped = data.map((p: any) => {
              let extra = { type: 'Web Development', budget: 0, spent: 0, timeline: '', progress: 0, milestones: [] as string[], startDate: p.created, pm: 'Devon S.' }
              if (p.stack) {
                try {
                  extra = { ...extra, ...JSON.parse(p.stack) }
                } catch (e) {
                  extra.pm = p.stack
                }
              }
              return {
                id: p.id,
                title: p.title,
                client: p.client,
                type: extra.type,
                budget: Number(extra.budget) || 0,
                spent: Number(extra.spent) || 0,
                timeline: extra.timeline,
                status: p.status,
                progress: Number(extra.progress) || 0,
                milestones: Array.isArray(extra.milestones) ? extra.milestones : [],
                startDate: extra.startDate || p.created,
                pm: extra.pm,
                history: Array.isArray(p.history) ? p.history : []
              }
            })
            setProjects(mapped)
            setCachedData('projects', mapped)
          }
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        }
      } else {
        setProjects(mockProjects)
        setCachedData('projects', mockProjects)
      }
      setLoading(false)
    }
    loadProjects()
  }, [])


  const filtered = projects.filter(p => p.title.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase()))

  const handleGeneratePlan = async () => {
    if (!form.title || !form.client) return
    setGenerating(true)
    try {
      const docId = generateDocId('NG-PRJ')
      const targetId = String(Date.now())
      const targetCreated = new Date().toISOString().slice(0, 10)
      const targetHistory = [{date: targetCreated, action: 'Project plan generated', canDownload: true}]

      const content = `# Project Plan: ${form.title}\n\n**Client:** ${form.client}\n**Type:** ${form.type}\n**Budget:** ₹${Number(form.budget).toLocaleString('en-IN')}\n**Timeline:** ${form.timeline}\n\n## Project Goals\n${form.goals}\n\n## Services / Scope\n${form.services}\n\n## Project Milestones\n1. Discovery & Kickoff (Week 1)\n2. Design & Architecture (Week 1-2)\n3. Development Phase 1 (Week 2-4)\n4. Testing & QA (Week 4-5)\n5. Client Review & Revisions (Week 5-6)\n6. Launch & Handover (Week 6)\n\n## Risk Assessment\n${form.risks || 'Standard project risks — scope creep, dependency delays.'}\n\n## Resources Required\n${form.resources || 'Project Manager, Lead Developer, Designer, QA Engineer'}\n\n## Success Metrics\n${form.successMetrics || 'On-time delivery, client satisfaction score ≥ 4.5/5, zero critical bugs post-launch.'}`

      const payload = { docType: 'Project Plan', clientName: form.client, projectTitle: form.title, content, items: [], subtotal: Number(form.budget), discountTotal: 0, grandTotal: Number(form.budget) }
      const res = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('PDF failed')
      const blob = await res.blob()
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ProjectPlan_${form.title.replace(/\s+/g, '_')}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a)

      const newProj: Project = { 
        id: targetId, 
        title: form.title, 
        client: form.client, 
        type: form.type, 
        budget: Number(form.budget) || 0, 
        spent: 0, 
        timeline: form.timeline, 
        status: 'planned', 
        progress: 0, 
        milestones: ['Kickoff ⏳', 'Development ⏳', 'Launch ⏳'], 
        startDate: targetCreated, 
        pm: 'Devon S.', 
        history: targetHistory 
      }

      if (isSupabaseConfigured()) {
        const extraJson = JSON.stringify({
          type: form.type,
          budget: Number(form.budget) || 0,
          spent: 0,
          timeline: form.timeline,
          progress: 0,
          milestones: ['Kickoff ⏳', 'Development ⏳', 'Launch ⏳'],
          startDate: targetCreated,
          pm: 'Devon S.'
        })

        const { error } = await supabase.from('projects').insert([{
          id: targetId,
          doc_id: docId,
          title: form.title,
          client: form.client,
          stack: extraJson,
          status: 'planned',
          created: targetCreated,
          history: targetHistory
        }])
        if (error) {
          toast({ title: 'Error saving to database', description: error.message, variant: 'destructive' })
          setGenerating(false)
          return
        }
      }

      const updatedList = [newProj, ...projects]
      setProjects(updatedList)
      setCachedData('projects', updatedList)
      invalidateCache('dashboard')
      setShowCreate(false); toast({ title: 'Project Plan Created!', description: 'PDF downloaded to your device.' })
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
    finally { setGenerating(false) }
  }


  const handleDelete = async () => {
    if (!deleteId) return
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('projects').delete().eq('id', deleteId)
        if (error) {
          toast({ title: 'Error deleting project', description: error.message, variant: 'destructive' })
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        return
      }
    }
    const updatedList = projects.filter(p => p.id !== deleteId)
    setProjects(updatedList)
    setCachedData('projects', updatedList)
    invalidateCache('dashboard')
    setDeleteId(null)
    toast({ title: 'Project Deleted' })
  }


  const handleEditSubmit = async () => {
    if (!editId) return
    const targetProj = projects.find(p => p.id === editId)
    if (!targetProj) return

    const newHistory = [...targetProj.history, {date: new Date().toISOString().slice(0, 10), action: 'Project details updated', canDownload: true}]
    const updated: Project = { ...targetProj, title: form.title, client: form.client, type: form.type, budget: Number(form.budget) || 0, timeline: form.timeline, history: newHistory }

    if (isSupabaseConfigured()) {
      try {
        const extraJson = JSON.stringify({
          type: form.type,
          budget: Number(form.budget) || 0,
          spent: targetProj.spent,
          timeline: form.timeline,
          progress: targetProj.progress,
          milestones: targetProj.milestones,
          startDate: targetProj.startDate,
          pm: targetProj.pm
        })

        const { error } = await supabase.from('projects').update({
          title: form.title,
          client: form.client,
          stack: extraJson,
          history: newHistory
        }).eq('id', editId)

        if (error) {
          toast({ title: 'Error saving project edit', description: error.message, variant: 'destructive' })
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        return
      }
    }

    const updatedList = projects.map(p => p.id === editId ? updated : p)
    setProjects(updatedList)
    setCachedData('projects', updatedList)
    invalidateCache('dashboard')
    setEditId(null)
    toast({ title: 'Project Updated' })
  }


  const handleDownload = async (p: Project) => {
    setDownloadingId(p.id)
    try {
      const content = `# Project Plan: ${p.title}\n\n**Client:** ${p.client}\n**Type:** ${p.type}\n**Budget:** ₹${Number(p.budget).toLocaleString('en-IN')}\n**Timeline:** ${p.timeline}\n\n## Project Milestones\n${p.milestones.join('\n')}`
      const payload = { docType: 'Project Plan', clientName: p.client, projectTitle: p.title, content, items: [], subtotal: Number(p.budget), discountTotal: 0, grandTotal: Number(p.budget) }
      const res = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('PDF failed')
      const blob = await res.blob()
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ProjectPlan_${p.title.replace(/\s+/g, '_')}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a)

      const newHistory = [...p.history, {date: new Date().toISOString().slice(0, 10), action: 'Project downloaded', canDownload: true}]
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('projects').update({ history: newHistory }).eq('id', p.id)
        if (error) {
          toast({ title: 'Error updating project history', description: error.message, variant: 'destructive' })
        }
      }
      const updatedList = projects.map(proj => proj.id === p.id ? { ...proj, history: newHistory } : proj)
      setProjects(updatedList)
      setCachedData('projects', updatedList)
      toast({ title: 'Download Started', description: `Downloading ${p.title}.pdf` })

    } catch (e: any) {
      toast({ title: 'Download failed', description: e.message, variant: 'destructive' })
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight">Project Planning Engine</h1><p className="text-muted-foreground text-sm mt-0.5">Create, track, and manage all client projects.</p></div>
        <Button variant="gold" size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 w-full sm:w-auto"><Plus className="h-4 w-4" />New Project</Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ label: 'Total Projects', value: projects.length }, { label: 'Active', value: projects.filter(p => p.status === 'active').length }, { label: 'Total Budget', value: formatCurrency(projects.reduce((s, p) => s + p.budget, 0)) }, { label: 'Planned', value: projects.filter(p => p.status === 'planned').length }].map(s => (
          <Card key={s.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold mt-1">{s.value}</p></CardContent></Card>
        ))}
      </div>
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(p => (
          <Card key={p.id} className="hover:shadow-md hover:border-gold/20 transition-all">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-semibold text-sm">{p.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.client} · {p.type}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[p.status]}`}>{p.status}</span>
              </div>
              <div className="space-y-1 mb-3">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Progress</span><span className="font-semibold">{p.progress}%</span></div>
                <Progress value={p.progress} className="h-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="flex items-center gap-1 text-muted-foreground"><DollarSign className="h-3 w-3 text-gold" /><span className="font-semibold text-foreground">{formatCurrency(p.budget)}</span></div>
                <div className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" />{p.timeline}</div>
                <div className="flex items-center gap-1 text-muted-foreground"><Calendar className="h-3 w-3" />{formatDate(p.startDate)}</div>
                <div className="flex items-center gap-1 text-muted-foreground"><Users className="h-3 w-3" />PM: {p.pm}</div>
              </div>
              <div className="flex flex-wrap gap-1 mb-4">
                {p.milestones.slice(0, 3).map(m => <span key={m} className="text-[10px] bg-muted px-2 py-0.5 rounded">{m}</span>)}
              </div>
              <div className="flex gap-2 justify-end border-t border-border pt-3">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleDownload(p)} title="Download"><Download className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setHistoryProject(p)} title="History"><History className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setForm({ title: p.title, client: p.client, type: p.type, budget: String(p.budget), timeline: p.timeline, goals: '', services: '', risks: '', resources: '', successMetrics: '' }); setEditId(p.id) }} title="Edit"><Edit className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-400" onClick={() => setDeleteId(p.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create New Project + Generate Plan</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Project Title *</Label><Input placeholder="e.g. E-Commerce Platform Build Q3 2024" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
            <div className="space-y-1">
              <Label>Client *</Label>
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
            <div className="space-y-1"><Label>Project Type</Label><Select value={form.type} onValueChange={v => setForm({...form, type: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Web Development', 'Marketing', 'Software', 'Automation', 'Design', 'SEO'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Budget (₹)</Label><Input type="number" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} /></div>
            <div className="space-y-1"><Label>Timeline</Label><Input placeholder="e.g. 6 weeks, 3 months" value={form.timeline} onChange={e => setForm({...form, timeline: e.target.value})} /></div>
            <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Project Goals</Label><Textarea className="h-16 resize-none" placeholder="What does success look like for the client?" value={form.goals} onChange={e => setForm({...form, goals: e.target.value})} /></div>
            <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Services / Scope</Label><Textarea className="h-16 resize-none" placeholder="List the services and scope of work..." value={form.services} onChange={e => setForm({...form, services: e.target.value})} /></div>
            <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Key Risks</Label><Textarea className="h-12 resize-none" placeholder="Potential risks and blockers..." value={form.risks} onChange={e => setForm({...form, risks: e.target.value})} /></div>
            <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Success Metrics</Label><Textarea className="h-12 resize-none" placeholder="How will you measure success?" value={form.successMetrics} onChange={e => setForm({...form, successMetrics: e.target.value})} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button><Button variant="gold" onClick={handleGeneratePlan} disabled={generating}>{generating ? 'Generating...' : 'Create Project + Generate PDF Plan'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editId} onOpenChange={(open) => !open && setEditId(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Edit Project Details</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Project Title *</Label><Input placeholder="e.g. E-Commerce Platform Build" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
            <div className="space-y-1">
              <Label>Client *</Label>
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
            <div className="space-y-1"><Label>Project Type</Label><Select value={form.type} onValueChange={v => setForm({...form, type: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Web Development', 'Marketing', 'Software', 'Automation', 'Design', 'SEO'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Budget (₹)</Label><Input type="number" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} /></div>
            <div className="space-y-1"><Label>Timeline</Label><Input placeholder="e.g. 6 weeks, 3 months" value={form.timeline} onChange={e => setForm({...form, timeline: e.target.value})} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button><Button variant="gold" onClick={handleEditSubmit}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyProject} onOpenChange={(open) => !open && setHistoryProject(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="border-b border-white/10 pb-3">
            <DialogTitle>Project History — {historyProject?.title}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">{historyProject?.client} · Click any entry to download that version</p>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-[50vh] overflow-y-auto">
            {historyProject?.history.slice().reverse().map((h, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${(h as any).canDownload ? 'border-border hover:border-gold/30 hover:bg-gold/5 cursor-pointer group' : 'border-transparent bg-muted/20 cursor-default'}`}
                onClick={() => { if ((h as any).canDownload && historyProject) handleDownload(historyProject) }}
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
                    disabled={downloadingId === historyProject?.id}
                    onClick={(e) => { e.stopPropagation(); if (historyProject) handleDownload(historyProject) }}
                    title="Download this version"
                  >
                    {downloadingId === historyProject?.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="border-t border-white/10 pt-3">
            <Button variant="outline" size="sm" onClick={() => setHistoryProject(null)}>Close</Button>
            <Button variant="gold" size="sm" onClick={() => historyProject && handleDownload(historyProject)} disabled={downloadingId === historyProject?.id} className="gap-1.5">
              {downloadingId === historyProject?.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Download Latest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the project record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>Delete Project</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
