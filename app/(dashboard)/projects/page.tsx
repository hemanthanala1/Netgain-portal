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
import { Progress } from '@/components/ui/progress'
import { PromptViewer } from '@/components/ui/prompt-viewer'
import { ApprovalBadge } from '@/components/ui/approval-badge'
import { WorkflowSteps } from '@/components/ui/workflow-steps'
import { FileUpload } from '@/components/ui/file-upload'
import { VersionTimeline } from '@/components/ui/version-timeline'
import {
  Search, Plus, Zap, Calendar, DollarSign, Users, Download, Edit, Trash2,
  History, Loader2, Sparkles, Copy, ExternalLink, Upload, Eye,
  TrendingUp, Target, Globe, Phone, Mail, MapPin, Building2, FileText
} from 'lucide-react'
import { formatCurrency, formatDate, generateDocId } from '@/lib/utils'
import { generateCampaignPrompt, copyToClipboard, downloadAsTextFile, WORKFLOW_STEPS } from '@/lib/ai-utils'
import type { CampaignStrategyForm } from '@/lib/ai-types'
import { useToast } from '@/hooks/use-toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { ClientAutocomplete } from '@/components/ui/client-autocomplete'
import { getCachedData, setCachedData, invalidateCache } from '@/lib/data-cache'

type Project = {
  id: string; title: string; client: string; type: string; budget: number; spent: number; timeline: string; status: string; progress: number; milestones: string[]; startDate: string; pm: string; history: { date: string; action: string; canDownload?: boolean }[];
  prompt?: string; approvalStatus?: string; businessDetails?: CampaignStrategyForm
}

const statusColors: Record<string, string> = {
  active: 'text-emerald-400 bg-emerald-500/10', planned: 'text-blue-400 bg-blue-500/10',
  completed: 'text-muted-foreground bg-muted', paused: 'text-yellow-400 bg-yellow-500/10'
}

export default function CampaignStrategyPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [detailProject, setDetailProject] = useState<Project | null>(null)
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [currentStep, setCurrentStep] = useState(0)
  const { toast } = useToast()
  const [generating, setGenerating] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const emptyForm: CampaignStrategyForm = {
    businessName: '', businessCategory: 'Digital Marketing', website: '', phone: '', email: '',
    location: '', businessDescription: '', products: '', services: '', offers: '',
    competitors: '', currentMarketing: '', monthlyBudget: '', platformBudget: '',
    targetAudience: '', businessGoals: '', timeline: '', notes: ''
  }
  const [form, setForm] = useState<CampaignStrategyForm>(emptyForm)

  useEffect(() => {
    const cached = getCachedData<Project[]>('projects')
    if (cached) { setProjects(cached); setLoading(false) }
    async function loadProjects() {
      if (!cached) setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
          if (!error && data) {
            const mapped = data.map((p: any) => {
              let extra: any = { type: 'Web Development', budget: 0, spent: 0, timeline: '', progress: 0, milestones: [] as string[], startDate: p.created, pm: 'Devon S.', prompt: '', approvalStatus: 'draft', businessDetails: undefined }
              if (p.stack) { try { extra = { ...extra, ...JSON.parse(p.stack) } } catch { extra.pm = p.stack } }
              return { id: p.id, title: p.title, client: p.client, type: extra.type, budget: Number(extra.budget) || 0, spent: Number(extra.spent) || 0, timeline: extra.timeline, status: p.status, progress: Number(extra.progress) || 0, milestones: Array.isArray(extra.milestones) ? extra.milestones : [], startDate: extra.startDate || p.created, pm: extra.pm, history: Array.isArray(p.history) ? p.history : [], prompt: extra.prompt || '', approvalStatus: extra.approvalStatus || 'draft', businessDetails: extra.businessDetails || undefined }
            })
            setProjects(mapped); setCachedData('projects', mapped)
          }
        } catch (err: any) { toast({ title: 'Database Error', description: err.message, variant: 'destructive' }) }
      }
      setLoading(false)
    }
    loadProjects()
  }, [])

  const filtered = projects.filter(p => p.title.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase()))

  const handleGeneratePrompt = () => {
    const prompt = generateCampaignPrompt(form)
    setGeneratedPrompt(prompt)
    setCurrentStep(2)
    toast({ title: 'Prompt Generated!', description: 'Copy it or download to use with Claude.' })
  }

  const handleCreateProject = async () => {
    if (!form.businessName) return
    setGenerating(true)
    try {
      const docId = generateDocId('NG-CSE')
      const targetId = String(Date.now())
      const targetCreated = new Date().toISOString().slice(0, 10)
      const targetHistory = [{ date: targetCreated, action: 'Campaign strategy created', canDownload: true }]
      const prompt = generatedPrompt || generateCampaignPrompt(form)

      const newProj: Project = {
        id: targetId, title: form.businessName, client: form.businessName, type: form.businessCategory,
        budget: Number(form.monthlyBudget) || 0, spent: 0, timeline: form.timeline, status: 'planned',
        progress: 0, milestones: ['Research ⏳', 'Strategy ⏳', 'Execution ⏳'],
        startDate: targetCreated, pm: 'Strategy Team', history: targetHistory,
        prompt, approvalStatus: 'draft', businessDetails: form
      }

      if (isSupabaseConfigured()) {
        const extraJson = JSON.stringify({
          type: form.businessCategory, budget: Number(form.monthlyBudget) || 0, spent: 0,
          timeline: form.timeline, progress: 0, milestones: ['Research ⏳', 'Strategy ⏳', 'Execution ⏳'],
          startDate: targetCreated, pm: 'Strategy Team', prompt, approvalStatus: 'draft', businessDetails: form
        })
        const { error } = await supabase.from('projects').insert([{
          id: targetId, doc_id: docId, title: form.businessName, client: form.businessName,
          stack: extraJson, status: 'planned', created: targetCreated, history: targetHistory
        }])
        if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return }
      }

      const updatedList = [newProj, ...projects]
      setProjects(updatedList); setCachedData('projects', updatedList); invalidateCache('dashboard')
      setShowCreate(false); setGeneratedPrompt(''); setForm(emptyForm); setCurrentStep(0)
      toast({ title: 'Campaign Strategy Created!', description: 'View it to generate the AI prompt.' })
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
    finally { setGenerating(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    if (isSupabaseConfigured()) { await supabase.from('projects').delete().eq('id', deleteId) }
    const updatedList = projects.filter(p => p.id !== deleteId)
    setProjects(updatedList); setCachedData('projects', updatedList); invalidateCache('dashboard')
    setDeleteId(null); toast({ title: 'Strategy Deleted' })
  }

  const openDetail = (p: Project) => {
    setDetailProject(p)
    if (p.businessDetails) setForm(p.businessDetails)
    setGeneratedPrompt(p.prompt || '')
    setActiveTab('overview')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gold" />
            <h1 className="text-2xl font-bold tracking-tight">Campaign Strategy Engine</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">Create complete marketing strategies with AI-powered prompt generation</p>
        </div>
        <Button variant="gold" size="sm" onClick={() => { setForm(emptyForm); setGeneratedPrompt(''); setCurrentStep(1); setShowCreate(true) }} className="gap-1.5 w-full sm:w-auto">
          <Plus className="h-4 w-4" />New Strategy
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Strategies', value: projects.length },
          { label: 'Active', value: projects.filter(p => p.status === 'active').length },
          { label: 'Total Budget', value: formatCurrency(projects.reduce((s, p) => s + p.budget, 0)) },
          { label: 'Planned', value: projects.filter(p => p.status === 'planned').length },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold mt-1">{s.value}</p></CardContent></Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search strategies..." value={search} onChange={e => setSearch(e.target.value)} /></div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(p => (
          <Card key={p.id} className="ai-card ai-card-glow hover:shadow-md transition-all cursor-pointer" onClick={() => openDetail(p)}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-semibold text-sm">{p.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.client} · {p.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <ApprovalBadge status={p.approvalStatus || 'draft'} />
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[p.status]}`}>{p.status}</span>
                </div>
              </div>
              <div className="space-y-1 mb-3">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Progress</span><span className="font-semibold">{p.progress}%</span></div>
                <Progress value={p.progress} className="h-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="flex items-center gap-1 text-muted-foreground"><DollarSign className="h-3 w-3 text-gold" /><span className="font-semibold text-foreground">{formatCurrency(p.budget)}</span></div>
                <div className="flex items-center gap-1 text-muted-foreground"><Calendar className="h-3 w-3" />{p.timeline || 'Not set'}</div>
              </div>
              <div className="flex gap-2 justify-end border-t border-border pt-3" onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openDetail(p)} title="View Details"><Eye className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setForm(p.businessDetails || emptyForm); setEditId(p.id) }} title="Edit"><Edit className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-400" onClick={() => setDeleteId(p.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── CREATE DIALOG ──────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Campaign Strategy</DialogTitle>
            <div className="mt-3"><WorkflowSteps steps={WORKFLOW_STEPS} currentStep={currentStep} /></div>
          </DialogHeader>

          <Tabs defaultValue="details" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">Business Details</TabsTrigger>
              <TabsTrigger value="prompt" className="flex-1">AI Prompt</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Business Name *</Label><Input placeholder="e.g. FashionHub India" value={form.businessName} onChange={e => setForm({...form, businessName: e.target.value})} /></div>
                <div className="space-y-1"><Label>Business Category</Label><Select value={form.businessCategory} onValueChange={v => setForm({...form, businessCategory: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Digital Marketing', 'E-Commerce', 'SaaS', 'Real Estate', 'Healthcare', 'Education', 'F&B', 'Fashion', 'Technology', 'Professional Services', 'Other'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Website</Label><Input placeholder="https://example.com" value={form.website} onChange={e => setForm({...form, website: e.target.value})} /></div>
                <div className="space-y-1"><Label>Phone</Label><Input placeholder="+91 ..." value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
                <div className="space-y-1"><Label>Email</Label><Input placeholder="contact@business.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Location</Label><Input placeholder="City, State" value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Business Description</Label><Textarea className="h-20 resize-none" placeholder="What does the business do? What's the value proposition?" value={form.businessDescription} onChange={e => setForm({...form, businessDescription: e.target.value})} /></div>
                <div className="space-y-1"><Label>Products</Label><Textarea className="h-16 resize-none" placeholder="Key products..." value={form.products} onChange={e => setForm({...form, products: e.target.value})} /></div>
                <div className="space-y-1"><Label>Services</Label><Textarea className="h-16 resize-none" placeholder="Key services..." value={form.services} onChange={e => setForm({...form, services: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Current Offers / Promotions</Label><Input placeholder="Any active offers..." value={form.offers} onChange={e => setForm({...form, offers: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Competitors</Label><Textarea className="h-16 resize-none" placeholder="List key competitors..." value={form.competitors} onChange={e => setForm({...form, competitors: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Current Marketing Activities</Label><Textarea className="h-16 resize-none" placeholder="What marketing is currently being done?" value={form.currentMarketing} onChange={e => setForm({...form, currentMarketing: e.target.value})} /></div>
                <div className="space-y-1"><Label>Monthly Budget (₹)</Label><Input type="number" value={form.monthlyBudget} onChange={e => setForm({...form, monthlyBudget: e.target.value})} /></div>
                <div className="space-y-1"><Label>Platform Budget Allocation</Label><Input placeholder="e.g. Meta: 50%, Google: 30%, SEO: 20%" value={form.platformBudget} onChange={e => setForm({...form, platformBudget: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Target Audience</Label><Textarea className="h-16 resize-none" placeholder="Demographics, interests, behaviors..." value={form.targetAudience} onChange={e => setForm({...form, targetAudience: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Business Goals</Label><Textarea className="h-16 resize-none" placeholder="What are the key business goals?" value={form.businessGoals} onChange={e => setForm({...form, businessGoals: e.target.value})} /></div>
                <div className="space-y-1"><Label>Timeline</Label><Input placeholder="e.g. 3 months, 6 months" value={form.timeline} onChange={e => setForm({...form, timeline: e.target.value})} /></div>
                <div className="space-y-1"><Label>Additional Notes</Label><Textarea className="h-12 resize-none" placeholder="Anything else..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              </div>

              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border">
                <Button variant="gold" className="gap-1.5" onClick={handleGeneratePrompt} disabled={!form.businessName}>
                  <Sparkles className="h-4 w-4" />Generate Prompt
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href="/ai-hub/skills" target="_blank"><Download className="h-3.5 w-3.5" />Download Skill</a>
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="prompt" className="mt-4">
              <PromptViewer
                prompt={generatedPrompt}
                title="Campaign Strategy Prompt"
                downloadFilename={`Campaign_Prompt_${form.businessName.replace(/\s+/g, '_')}.txt`}
              />
              {generatedPrompt && (
                <div className="mt-4 flex items-center gap-3">
                  <Button variant="outline" size="sm" className="gap-1.5" asChild>
                    <a href="/ai-hub/skills" target="_blank"><Download className="h-3.5 w-3.5" />Download Marketing Strategy.skill</a>
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" asChild>
                    <a href="https://claude.ai" target="_blank" rel="noopener"><ExternalLink className="h-3.5 w-3.5" />Open Claude</a>
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="gold" onClick={handleCreateProject} disabled={generating || !form.businessName}>
              {generating ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Creating...</> : 'Save Strategy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DETAIL DIALOG ──────────────────────────────────────────────── */}
      <Dialog open={!!detailProject} onOpenChange={open => { if (!open) { setDetailProject(null); setGeneratedPrompt('') } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-gold" />
              {detailProject?.title}
            </DialogTitle>
            <div className="flex items-center gap-2 mt-1">
              <ApprovalBadge status={detailProject?.approvalStatus || 'draft'} />
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[detailProject?.status || 'planned']}`}>{detailProject?.status}</span>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-4 sm:grid-cols-7">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="prompt">Prompt</TabsTrigger>
              <TabsTrigger value="documents">Docs</TabsTrigger>
              <TabsTrigger value="approval" className="hidden sm:block">Approval</TabsTrigger>
              <TabsTrigger value="activity" className="hidden sm:block">Activity</TabsTrigger>
              <TabsTrigger value="versions" className="hidden sm:block">Versions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Budget</p><p className="text-sm font-bold">{formatCurrency(detailProject?.budget || 0)}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Timeline</p><p className="text-sm font-bold">{detailProject?.timeline || 'N/A'}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Progress</p><p className="text-sm font-bold">{detailProject?.progress}%</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Type</p><p className="text-sm font-bold">{detailProject?.type}</p></CardContent></Card>
              </div>
              <WorkflowSteps steps={WORKFLOW_STEPS} currentStep={detailProject?.prompt ? 3 : 1} />
            </TabsContent>

            <TabsContent value="details" className="mt-4">
              {detailProject?.businessDetails ? (
                <div className="space-y-3 text-sm">
                  {Object.entries(detailProject.businessDetails).filter(([, v]) => v).map(([key, value]) => (
                    <div key={key} className="flex gap-3 py-2 border-b border-border last:border-0">
                      <span className="text-xs text-muted-foreground w-32 shrink-0 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="text-xs">{String(value)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground py-8 text-center">No business details stored for this strategy.</p>}
            </TabsContent>

            <TabsContent value="prompt" className="mt-4">
              <PromptViewer
                prompt={detailProject?.prompt || generatedPrompt}
                title="Campaign Strategy Prompt"
                downloadFilename={`Campaign_Prompt_${detailProject?.title?.replace(/\s+/g, '_')}.txt`}
              />
              {!detailProject?.prompt && !generatedPrompt && detailProject?.businessDetails && (
                <Button variant="gold" className="gap-1.5 mt-4" onClick={() => {
                  const prompt = generateCampaignPrompt(detailProject.businessDetails!)
                  setGeneratedPrompt(prompt)
                }}>
                  <Sparkles className="h-4 w-4" />Generate Prompt from Details
                </Button>
              )}
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <div className="text-center py-8">
                <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">Upload generated strategy documents</p>
                <FileUpload
                  accept=".pdf,.doc,.docx,.xlsx"
                  label="Upload Generated Document"
                  description="Upload the strategy PDF generated by Claude"
                  onFilesSelected={files => {
                    if (files.length > 0) toast({ title: 'Document Uploaded', description: `${files[0].name} attached to this strategy.` })
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="approval" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl border border-border">
                  <div><p className="text-sm font-semibold">Approval Status</p><p className="text-xs text-muted-foreground mt-0.5">Current status of this strategy</p></div>
                  <ApprovalBadge status={detailProject?.approvalStatus || 'draft'} size="md" />
                </div>
                <div className="text-xs text-muted-foreground text-center py-4">Approval workflow will be enhanced with API integration.</div>
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <VersionTimeline
                versions={(detailProject?.history || []).map((h, i) => ({ version: i + 1, date: h.date, action: h.action, canDownload: h.canDownload }))}
              />
            </TabsContent>

            <TabsContent value="versions" className="mt-4">
              <VersionTimeline
                versions={(detailProject?.history || []).filter(h => h.canDownload).map((h, i) => ({ version: i + 1, date: h.date, action: h.action, canDownload: true, canRestore: true }))}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editId} onOpenChange={open => !open && setEditId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Strategy Details</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Business Name *</Label><Input value={form.businessName} onChange={e => setForm({...form, businessName: e.target.value})} /></div>
            <div className="space-y-1"><Label>Category</Label><Select value={form.businessCategory} onValueChange={v => setForm({...form, businessCategory: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Digital Marketing', 'E-Commerce', 'SaaS', 'Real Estate', 'Healthcare', 'Education', 'F&B', 'Fashion', 'Technology', 'Professional Services', 'Other'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Monthly Budget (₹)</Label><Input type="number" value={form.monthlyBudget} onChange={e => setForm({...form, monthlyBudget: e.target.value})} /></div>
            <div className="space-y-1"><Label>Timeline</Label><Input value={form.timeline} onChange={e => setForm({...form, timeline: e.target.value})} /></div>
            <div className="space-y-1"><Label>Website</Label><Input value={form.website} onChange={e => setForm({...form, website: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
            <Button variant="gold" onClick={async () => {
              if (!editId) return
              const target = projects.find(p => p.id === editId)
              if (!target) return
              const newHistory = [...target.history, { date: new Date().toISOString().slice(0, 10), action: 'Strategy details updated', canDownload: true }]
              const updated = { ...target, title: form.businessName, client: form.businessName, type: form.businessCategory, budget: Number(form.monthlyBudget) || 0, timeline: form.timeline, history: newHistory, businessDetails: form }
              if (isSupabaseConfigured()) {
                const extraJson = JSON.stringify({ type: form.businessCategory, budget: Number(form.monthlyBudget) || 0, spent: target.spent, timeline: form.timeline, progress: target.progress, milestones: target.milestones, startDate: target.startDate, pm: target.pm, prompt: target.prompt, approvalStatus: target.approvalStatus, businessDetails: form })
                await supabase.from('projects').update({ title: form.businessName, client: form.businessName, stack: extraJson, history: newHistory }).eq('id', editId)
              }
              const updatedList = projects.map(p => p.id === editId ? updated : p)
              setProjects(updatedList); setCachedData('projects', updatedList); invalidateCache('dashboard')
              setEditId(null); toast({ title: 'Strategy Updated' })
            }}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Strategy?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
