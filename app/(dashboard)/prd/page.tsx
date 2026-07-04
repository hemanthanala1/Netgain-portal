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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PromptViewer } from '@/components/ui/prompt-viewer'
import { ApprovalBadge } from '@/components/ui/approval-badge'
import { WorkflowSteps } from '@/components/ui/workflow-steps'
import { FileUpload } from '@/components/ui/file-upload'
import { VersionTimeline } from '@/components/ui/version-timeline'
import {
  Plus, FileCode2, Download, Cpu, Layers, Database, Code, Edit, Trash2,
  History, Loader2, Search, Sparkles, ExternalLink, Eye, FileText, Shield,
  Smartphone, Globe, Key, CreditCard, Bell, Brain, Lock, Gauge
} from 'lucide-react'
import { formatDate, generateDocId } from '@/lib/utils'
import { generateBlueprintPrompt, WORKFLOW_STEPS } from '@/lib/ai-utils'
import type { BlueprintForm } from '@/lib/ai-types'
import { useToast } from '@/hooks/use-toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { ClientAutocomplete } from '@/components/ui/client-autocomplete'
import { getCachedData, setCachedData, invalidateCache } from '@/lib/data-cache'
import { useUser } from '@/components/user-provider'

type PRD = {
  id: string; docId: string; title: string; client: string; stack: string; status: string; created: string;
  history: { date: string; action: string; canDownload?: boolean; downloadUrl?: string; file_path?: string; fileName?: string; by?: string }[];
  prompt?: string; approvalStatus?: string; blueprintDetails?: BlueprintForm
}

export default function BlueprintEnginePage() {
  const { user } = useUser()
  const [prds, setPrds] = useState<PRD[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [detailPrd, setDetailPrd] = useState<PRD | null>(null)
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [currentStep, setCurrentStep] = useState(0)
  const { toast } = useToast()
  const [generating, setGenerating] = useState(false)
  const [projectTypes, setProjectTypes] = useState<string[]>(['Web App', 'Mobile App', 'SaaS Platform', 'API Service', 'E-Commerce', 'Dashboard', 'CRM', 'ERP'])
  const [platforms, setPlatforms] = useState<string[]>(['Web', 'iOS', 'Android', 'Cross-Platform', 'Desktop', 'API Only'])
  const [showManageTypes, setShowManageTypes] = useState(false)
  const [showManagePlatforms, setShowManagePlatforms] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [newPlatformName, setNewPlatformName] = useState('')

  const emptyForm: BlueprintForm = {
    productName: '', projectType: 'Web App', targetUsers: '', objectives: '', features: '',
    modules: '', userRoles: '', platform: 'Web', timeline: '', budget: '', integrations: '',
    authentication: '', payments: '', notifications: '', aiFeatures: '', security: '',
    performance: '', techStack: '', database: '', apis: ''
  }
  const [form, setForm] = useState<BlueprintForm>(emptyForm)

  useEffect(() => {
    const cached = getCachedData<PRD[]>('prds')
    if (cached) { setPrds(cached); setLoading(false) }
    async function load() {
      if (!cached) setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase.from('prds').select('*').order('created_at', { ascending: false })
          if (!error && data) {
            const mapped = data.map((p: any) => {
              let extra: any = {}
              try { if (p.stack && p.stack.startsWith('{')) extra = JSON.parse(p.stack) } catch {}
              return {
                id: p.id, docId: p.doc_id, title: p.title, client: p.client,
                stack: extra.techStack || p.stack || '', status: p.status || 'draft', created: p.created,
                history: Array.isArray(p.history) ? p.history : [],
                prompt: extra.prompt || '', approvalStatus: extra.approvalStatus || 'draft',
                blueprintDetails: extra.blueprintDetails || undefined
              }
            })
            setPrds(mapped); setCachedData('prds', mapped)
          }

          // Fetch custom project types and platforms
          const { data: settings } = await supabase.from('company_settings').select('docs').limit(1).maybeSingle()
          if (settings?.docs?.prdProjectTypes) {
            setProjectTypes(settings.docs.prdProjectTypes)
          }
          if (settings?.docs?.prdPlatforms) {
            setPlatforms(settings.docs.prdPlatforms)
          }
        } catch (err: any) { toast({ title: 'Database Error', description: err.message, variant: 'destructive' }) }
      }
      setLoading(false)
    }
    load()
  }, [])

  const saveProjectTypes = async (updatedTypes: string[]) => {
    setProjectTypes(updatedTypes)
    if (isSupabaseConfigured()) {
      try {
        const { data: exist } = await supabase.from('company_settings').select('id, docs').limit(1).maybeSingle()
        if (exist) {
          const updatedDocs = { ...exist.docs, prdProjectTypes: updatedTypes }
          await supabase.from('company_settings').update({ docs: updatedDocs }).eq('id', exist.id)
        } else {
          await supabase.from('company_settings').insert([{ docs: { prdProjectTypes: updatedTypes } }])
        }
      } catch (err) {
        console.error('Failed to save project types to db:', err)
      }
    }
  }

  const handleAddProjectType = () => {
    if (!newTypeName.trim()) return
    if (projectTypes.includes(newTypeName.trim())) {
      toast({ title: 'Project type already exists', variant: 'destructive' })
      return
    }
    const updated = [...projectTypes, newTypeName.trim()]
    saveProjectTypes(updated)
    setNewTypeName('')
    toast({ title: 'Project Type Added' })
  }

  const handleDeleteProjectType = (typeToDelete: string) => {
    if (typeToDelete === 'Web App') {
      toast({ title: 'Cannot delete default "Web App" type', variant: 'destructive' })
      return
    }
    const updated = projectTypes.filter(t => t !== typeToDelete)
    saveProjectTypes(updated)
    toast({ title: 'Project Type Deleted' })
  }

  const savePlatforms = async (updatedPlatforms: string[]) => {
    setPlatforms(updatedPlatforms)
    if (isSupabaseConfigured()) {
      try {
        const { data: exist } = await supabase.from('company_settings').select('id, docs').limit(1).maybeSingle()
        if (exist) {
          const updatedDocs = { ...exist.docs, prdPlatforms: updatedPlatforms }
          await supabase.from('company_settings').update({ docs: updatedDocs }).eq('id', exist.id)
        } else {
          await supabase.from('company_settings').insert([{ docs: { prdPlatforms: updatedPlatforms } }])
        }
      } catch (err) {
        console.error('Failed to save platforms to db:', err)
      }
    }
  }

  const handleAddPlatform = () => {
    if (!newPlatformName.trim()) return
    if (platforms.includes(newPlatformName.trim())) {
      toast({ title: 'Platform already exists', variant: 'destructive' })
      return
    }
    const updated = [...platforms, newPlatformName.trim()]
    savePlatforms(updated)
    setNewPlatformName('')
    toast({ title: 'Platform Added' })
  }

  const handleDeletePlatform = (platformToDelete: string) => {
    if (platformToDelete === 'Web') {
      toast({ title: 'Cannot delete default "Web" platform', variant: 'destructive' })
      return
    }
    const updated = platforms.filter(p => p !== platformToDelete)
    savePlatforms(updated)
    toast({ title: 'Platform Deleted' })
  }

  const filtered = prds.filter(p => p.title.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase()))

  const handleGeneratePrompt = () => {
    const prompt = generateBlueprintPrompt(form)
    setGeneratedPrompt(prompt)
    setCurrentStep(2)
    toast({ title: 'Prompt Generated!' })
  }

  const handleCreate = async () => {
    if (!form.productName) return
    setGenerating(true)
    try {
      const docId = generateDocId('NG-DBE')
      const targetId = String(Date.now())
      const targetCreated = new Date().toISOString().slice(0, 10)
      const targetHistory = [{ date: targetCreated, action: 'Blueprint created', canDownload: true }]
      const prompt = generatedPrompt || generateBlueprintPrompt(form)

      const extraJson = JSON.stringify({ techStack: form.techStack, prompt, approvalStatus: 'draft', blueprintDetails: form })

      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('prds').insert([{
          id: targetId, doc_id: docId, title: form.productName, client: form.targetUsers || 'Internal',
          stack: extraJson, status: 'draft', created: targetCreated, history: targetHistory
        }])
        if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return }
      }

      const newPrd: PRD = { id: targetId, docId, title: form.productName, client: form.targetUsers || 'Internal', stack: form.techStack, status: 'draft', created: targetCreated, history: targetHistory, prompt, approvalStatus: 'draft', blueprintDetails: form }
      const updatedList = [newPrd, ...prds]
      setPrds(updatedList); setCachedData('prds', updatedList); invalidateCache('dashboard')
      setShowCreate(false); setGeneratedPrompt(''); setForm(emptyForm); setCurrentStep(0)
      toast({ title: 'Blueprint Created!', description: `${docId} saved.` })
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
    finally { setGenerating(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    if (isSupabaseConfigured()) { await supabase.from('prds').delete().eq('id', deleteId) }
    const updatedList = prds.filter(p => p.id !== deleteId)
    setPrds(updatedList); setCachedData('prds', updatedList); invalidateCache('dashboard')
    setDeleteId(null); toast({ title: 'Blueprint Deleted' })
  }

  const handleUploadDocumentFile = async (files: File[]) => {
    if (!detailPrd || files.length === 0) return
    const file = files[0]
    toast({ title: 'Uploading file...', description: file.name })
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', detailPrd.id)
      formData.append('category', 'PRD')
      formData.append('uploadedBy', user?.email || 'Founder/Admin')

      const res = await fetch('/api/project-files/upload', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Upload failed')

      // Save to Supabase by appending to history
      const newHistoryEntry = {
        date: new Date().toISOString().slice(0, 10),
        action: `PRD Uploaded: ${file.name}`,
        canDownload: true,
        downloadUrl: data.url,
        fileName: file.name,
        by: user?.email || 'Founder/Admin'
      }
      
      const updatedHistory = [...(detailPrd.history || []), newHistoryEntry]
      
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('prds')
          .update({ history: updatedHistory })
          .eq('id', detailPrd.id)
        if (error) throw error
      }

      // Update local state
      const updatedPrd = { ...detailPrd, history: updatedHistory }
      setDetailPrd(updatedPrd)
      
      const updatedList = prds.map(p => p.id === detailPrd.id ? updatedPrd : p)
      setPrds(updatedList)
      setCachedData('prds', updatedList)

      toast({ title: 'Success', description: 'PRD document uploaded and saved successfully!' })
    } catch (e: any) {
      toast({ title: 'Upload Failed', description: e.message, variant: 'destructive' })
    }
  }

  const openDetail = (p: PRD) => {
    setDetailPrd(p)
    if (p.blueprintDetails) setForm(p.blueprintDetails)
    setGeneratedPrompt(p.prompt || '')
    setActiveTab('overview')
  }

  const featureIcons = [
    { icon: Layers, label: 'Architecture', desc: 'System design & component structure' },
    { icon: Database, label: 'Database', desc: 'Schema, relationships & data models' },
    { icon: Code, label: 'APIs & Logic', desc: 'Endpoints, business logic & integrations' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-violet-400" />
            <h1 className="text-2xl font-bold tracking-tight">Development Blueprint Engine</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">Generate comprehensive Product Requirement Documents with AI-powered prompts</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => setShowManageTypes(true)} className="gap-1.5 flex-1 sm:flex-initial">
            Manage Project Types
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowManagePlatforms(true)} className="gap-1.5 flex-1 sm:flex-initial">
            Manage Platforms
          </Button>
          <Button variant="gold" size="sm" onClick={() => { setForm(emptyForm); setGeneratedPrompt(''); setCurrentStep(1); setShowCreate(true) }} className="gap-1.5 flex-1 sm:flex-initial">
            <Plus className="h-4 w-4" />New Blueprint
          </Button>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {featureIcons.map(f => (
          <Card key={f.label} className="ai-card ai-card-glow"><CardContent className="p-4 flex items-start gap-3"><div className="rounded-lg bg-violet-500/10 p-2"><f.icon className="h-5 w-5 text-violet-400" /></div><div><p className="text-sm font-semibold">{f.label}</p><p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p></div></CardContent></Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search blueprints..." value={search} onChange={e => setSearch(e.target.value)} /></div>

      {/* PRD Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(p => (
          <Card key={p.id} className="ai-card ai-card-glow cursor-pointer" onClick={() => openDetail(p)}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1"><FileCode2 className="h-4 w-4 text-violet-400" /><span className="font-mono text-xs text-violet-400/70">{p.docId}</span></div>
                  <h3 className="font-semibold text-sm">{p.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.client}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {p.stack && <span className="flex items-center gap-1"><Code className="h-3 w-3" />{p.stack}</span>}
                    <span>{formatDate(p.created)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <ApprovalBadge status={p.approvalStatus || 'draft'} />
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openDetail(p)}><Eye className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { if (p.blueprintDetails) setForm(p.blueprintDetails); else setForm({...emptyForm, productName: p.title, techStack: p.stack}); setEditId(p.id) }}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-400" onClick={() => setDeleteId(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CREATE DIALOG */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Development Blueprint</DialogTitle>
            <div className="mt-3"><WorkflowSteps steps={WORKFLOW_STEPS} currentStep={currentStep} /></div>
          </DialogHeader>
          <Tabs defaultValue="requirements" className="mt-2">
            <TabsList className="w-full"><TabsTrigger value="requirements" className="flex-1">Requirements</TabsTrigger><TabsTrigger value="technical" className="flex-1">Technical</TabsTrigger><TabsTrigger value="prompt" className="flex-1">AI Prompt</TabsTrigger></TabsList>

            <TabsContent value="requirements" className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Product Name *</Label><Input placeholder="e.g. TechCore SaaS Dashboard 2.0" value={form.productName} onChange={e => setForm({...form, productName: e.target.value})} /></div>
                <div className="space-y-1"><Label>Project Type</Label><Select value={form.projectType} onValueChange={v => setForm({...form, projectType: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{projectTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Platform</Label><Select value={form.platform} onValueChange={v => setForm({...form, platform: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{platforms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Timeline</Label><Input placeholder="e.g. 3 months" value={form.timeline} onChange={e => setForm({...form, timeline: e.target.value})} /></div>
                <div className="space-y-1"><Label>Budget (₹)</Label><Input type="number" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Target Users</Label><Textarea className="h-16 resize-none" placeholder="Who will use this product?" value={form.targetUsers} onChange={e => setForm({...form, targetUsers: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Objectives & Problem Statement</Label><Textarea className="h-20 resize-none" placeholder="What problem does this solve?" value={form.objectives} onChange={e => setForm({...form, objectives: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Core Features (one per line)</Label><Textarea className="h-20 resize-none" placeholder="User authentication&#10;Dashboard&#10;Reports" value={form.features} onChange={e => setForm({...form, features: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Modules</Label><Textarea className="h-16 resize-none" placeholder="List the main modules..." value={form.modules} onChange={e => setForm({...form, modules: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>User Roles & Permissions</Label><Textarea className="h-16 resize-none" placeholder="Admin, Manager, User..." value={form.userRoles} onChange={e => setForm({...form, userRoles: e.target.value})} /></div>
              </div>
            </TabsContent>

            <TabsContent value="technical" className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Tech Stack</Label><Input placeholder="e.g. Next.js + Supabase + Stripe" value={form.techStack} onChange={e => setForm({...form, techStack: e.target.value})} /></div>
                <div className="space-y-1"><Label>Database</Label><Input placeholder="PostgreSQL, MongoDB..." value={form.database} onChange={e => setForm({...form, database: e.target.value})} /></div>
                <div className="space-y-1"><Label>APIs</Label><Input placeholder="REST, GraphQL..." value={form.apis} onChange={e => setForm({...form, apis: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Integrations</Label><Textarea className="h-12 resize-none" placeholder="Payment gateways, email services..." value={form.integrations} onChange={e => setForm({...form, integrations: e.target.value})} /></div>
                <div className="space-y-1"><Label>Authentication</Label><Input placeholder="OAuth, JWT, Magic Link..." value={form.authentication} onChange={e => setForm({...form, authentication: e.target.value})} /></div>
                <div className="space-y-1"><Label>Payments</Label><Input placeholder="Stripe, Razorpay..." value={form.payments} onChange={e => setForm({...form, payments: e.target.value})} /></div>
                <div className="space-y-1"><Label>Notifications</Label><Input placeholder="Email, Push, SMS..." value={form.notifications} onChange={e => setForm({...form, notifications: e.target.value})} /></div>
                <div className="space-y-1"><Label>AI Features</Label><Input placeholder="Chatbot, Auto-generation..." value={form.aiFeatures} onChange={e => setForm({...form, aiFeatures: e.target.value})} /></div>
                <div className="space-y-1"><Label>Security Requirements</Label><Input placeholder="2FA, encryption, RBAC..." value={form.security} onChange={e => setForm({...form, security: e.target.value})} /></div>
                <div className="space-y-1"><Label>Performance Requirements</Label><Input placeholder="Load time, concurrent users..." value={form.performance} onChange={e => setForm({...form, performance: e.target.value})} /></div>
              </div>
              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border">
                <Button variant="gold" className="gap-1.5" onClick={handleGeneratePrompt} disabled={!form.productName}><Sparkles className="h-4 w-4" />Generate Prompt</Button>
                <Button variant="outline" size="sm" className="gap-1.5" asChild><a href="/ai-hub/skills" target="_blank"><Download className="h-3.5 w-3.5" />Download PRD.skill</a></Button>
              </div>
            </TabsContent>

            <TabsContent value="prompt" className="mt-4">
              <PromptViewer prompt={generatedPrompt} title="Development Blueprint Prompt" downloadFilename={`Blueprint_Prompt_${form.productName.replace(/\s+/g, '_')}.txt`} />
              {generatedPrompt && (
                <div className="mt-4 flex items-center gap-3">
                  <Button variant="outline" size="sm" className="gap-1.5" asChild><a href="/ai-hub/skills" target="_blank"><Download className="h-3.5 w-3.5" />Download PRD.skill</a></Button>
                  <Button variant="outline" size="sm" className="gap-1.5" asChild><a href="https://claude.ai" target="_blank" rel="noopener"><ExternalLink className="h-3.5 w-3.5" />Open Claude</a></Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="gold" onClick={handleCreate} disabled={generating || !form.productName}>
              {generating ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Creating...</> : 'Save Blueprint'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DETAIL DIALOG */}
      <Dialog open={!!detailPrd} onOpenChange={open => { if (!open) { setDetailPrd(null); setGeneratedPrompt('') } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileCode2 className="h-5 w-5 text-violet-400" />{detailPrd?.title}</DialogTitle>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-xs text-violet-400/70">{detailPrd?.docId}</span>
              <ApprovalBadge status={detailPrd?.approvalStatus || 'draft'} />
            </div>
          </DialogHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-4 sm:grid-cols-7">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="requirements">Reqs</TabsTrigger>
              <TabsTrigger value="prompt">Prompt</TabsTrigger>
              <TabsTrigger value="documents">Docs</TabsTrigger>
              <TabsTrigger value="approval" className="hidden sm:block">Approval</TabsTrigger>
              <TabsTrigger value="activity" className="hidden sm:block">Activity</TabsTrigger>
              <TabsTrigger value="versions" className="hidden sm:block">Versions</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Type</p><p className="text-sm font-bold">{detailPrd?.blueprintDetails?.projectType || 'Web App'}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Stack</p><p className="text-sm font-bold truncate">{detailPrd?.stack || 'N/A'}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Timeline</p><p className="text-sm font-bold">{detailPrd?.blueprintDetails?.timeline || 'N/A'}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Platform</p><p className="text-sm font-bold">{detailPrd?.blueprintDetails?.platform || 'Web'}</p></CardContent></Card>
              </div>
              <WorkflowSteps steps={WORKFLOW_STEPS} currentStep={detailPrd?.prompt ? 3 : 1} />
            </TabsContent>
            <TabsContent value="requirements" className="mt-4">
              {detailPrd?.blueprintDetails ? (
                <div className="space-y-3 text-sm">
                  {Object.entries(detailPrd.blueprintDetails).filter(([, v]) => v).map(([key, value]) => (
                    <div key={key} className="flex gap-3 py-2 border-b border-border last:border-0">
                      <span className="text-xs text-muted-foreground w-32 shrink-0 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="text-xs whitespace-pre-wrap">{String(value)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground py-8 text-center">No detailed requirements stored.</p>}
            </TabsContent>
            <TabsContent value="prompt" className="mt-4">
              <PromptViewer prompt={detailPrd?.prompt || generatedPrompt} title="Blueprint Prompt" downloadFilename={`Blueprint_${detailPrd?.title?.replace(/\s+/g, '_')}.txt`} />
              {!detailPrd?.prompt && !generatedPrompt && detailPrd?.blueprintDetails && (
                <Button variant="gold" className="gap-1.5 mt-4" onClick={() => { const prompt = generateBlueprintPrompt(detailPrd.blueprintDetails!); setGeneratedPrompt(prompt) }}>
                  <Sparkles className="h-4 w-4" />Generate Prompt from Requirements
                </Button>
              )}
            </TabsContent>
            <TabsContent value="documents" className="mt-4 space-y-4">
              <FileUpload 
                accept=".pdf,.doc,.docx" 
                multiple={false} 
                label="Upload Generated PRD" 
                description="Upload the PRD PDF or Document generated by Claude" 
                onFilesSelected={handleUploadDocumentFile} 
              />
              <div className="space-y-2 mt-4">
                <h4 className="text-xs font-bold text-gold uppercase">Uploaded Documents</h4>
                {detailPrd?.history && detailPrd.history.filter(h => h.canDownload).length > 0 ? (
                  <div className="border border-[#152e23] rounded-lg divide-y divide-[#152e23] bg-[#091510]/50">
                    {detailPrd.history.filter(h => h.canDownload).map((h: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 text-xs text-slate-300">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gold" />
                          <div>
                            <p className="font-semibold text-slate-200">{h.fileName || `PRD v${idx + 1}`}</p>
                            <p className="text-[10px] text-muted-foreground">{formatDate(h.date)} {h.by ? `by ${h.by}` : ''}</p>
                          </div>
                        </div>
                        <a href={h.downloadUrl || h.file_path} target="_blank" rel="noopener noreferrer" download>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-gold"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">No documents uploaded yet.</p>
                )}
              </div>
            </TabsContent>
            <TabsContent value="approval" className="mt-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border">
                <div><p className="text-sm font-semibold">Approval Status</p><p className="text-xs text-muted-foreground mt-0.5">Current review status</p></div>
                <ApprovalBadge status={detailPrd?.approvalStatus || 'draft'} size="md" />
              </div>
            </TabsContent>
            <TabsContent value="activity" className="mt-4">
              <VersionTimeline 
                versions={(detailPrd?.history || []).map((h, i) => ({ 
                  version: i + 1, 
                  date: h.date, 
                  action: h.action, 
                  canDownload: h.canDownload,
                  downloadUrl: h.downloadUrl || h.file_path
                }))}
                onDownload={(v: any) => {
                  if (v.downloadUrl) {
                    window.open(v.downloadUrl, '_blank')
                  } else {
                    toast({ title: 'No download URL available' })
                  }
                }}
              />
            </TabsContent>
            <TabsContent value="versions" className="mt-4">
              <VersionTimeline 
                versions={(detailPrd?.history || []).filter(h => h.canDownload).map((h, i) => ({ 
                  version: i + 1, 
                  date: h.date, 
                  action: h.action, 
                  canDownload: true, 
                  canRestore: false,
                  downloadUrl: h.downloadUrl || h.file_path
                }))}
                onDownload={(v: any) => {
                  if (v.downloadUrl) {
                    window.open(v.downloadUrl, '_blank')
                  } else {
                    toast({ title: 'No download URL available' })
                  }
                }}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editId} onOpenChange={open => !open && setEditId(null)}>
        <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Edit Blueprint</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Product Name *</Label><Input value={form.productName} onChange={e => setForm({...form, productName: e.target.value})} /></div>
            <div className="space-y-1"><Label>Tech Stack</Label><Input value={form.techStack} onChange={e => setForm({...form, techStack: e.target.value})} /></div>
            <div className="space-y-1"><Label>Timeline</Label><Input value={form.timeline} onChange={e => setForm({...form, timeline: e.target.value})} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button><Button variant="gold" onClick={async () => {
            if (!editId) return
            const target = prds.find(p => p.id === editId)
            if (!target) return
            const newHistory = [...target.history, { date: new Date().toISOString().slice(0, 10), action: 'Blueprint Updated', canDownload: true }]
            const updated = { ...target, title: form.productName, stack: form.techStack, history: newHistory, blueprintDetails: form }
            if (isSupabaseConfigured()) {
              const extraJson = JSON.stringify({ techStack: form.techStack, prompt: target.prompt, approvalStatus: target.approvalStatus, blueprintDetails: form })
              await supabase.from('prds').update({ title: form.productName, stack: extraJson, history: newHistory }).eq('id', editId)
            }
            const updatedList = prds.map(p => p.id === editId ? updated : p)
            setPrds(updatedList); setCachedData('prds', updatedList); invalidateCache('dashboard')
            setEditId(null); toast({ title: 'Blueprint Updated' })
          }}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Blueprint?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      {/* Manage Project Types Dialog */}
      <Dialog open={showManageTypes} onOpenChange={setShowManageTypes}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Project Types</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                placeholder="New Project Type"
                value={newTypeName}
                onChange={e => setNewTypeName(e.target.value)}
              />
              <Button variant="gold" size="sm" onClick={handleAddProjectType}>
                Add
              </Button>
            </div>
            <div className="border rounded-lg border-border p-3 max-h-[250px] overflow-y-auto space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Existing Types</p>
              {projectTypes.map(type => (
                <div key={type} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                  <span className="text-sm">{type}</span>
                  {type !== 'Web App' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:text-red-400"
                      onClick={() => handleDeleteProjectType(type)}
                      title="Delete Project Type"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManageTypes(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Platforms Dialog */}
      <Dialog open={showManagePlatforms} onOpenChange={setShowManagePlatforms}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Platforms</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                placeholder="New Platform"
                value={newPlatformName}
                onChange={e => setNewPlatformName(e.target.value)}
              />
              <Button variant="gold" size="sm" onClick={handleAddPlatform}>
                Add
              </Button>
            </div>
            <div className="border rounded-lg border-border p-3 max-h-[250px] overflow-y-auto space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Existing Platforms</p>
              {platforms.map(platform => (
                <div key={platform} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                  <span className="text-sm">{platform}</span>
                  {platform !== 'Web' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:text-red-400"
                      onClick={() => handleDeletePlatform(platform)}
                      title="Delete Platform"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManagePlatforms(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
