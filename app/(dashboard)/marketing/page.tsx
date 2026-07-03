'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PromptViewer } from '@/components/ui/prompt-viewer'
import { ApprovalBadge } from '@/components/ui/approval-badge'
import { WorkflowSteps } from '@/components/ui/workflow-steps'
import { FileUpload } from '@/components/ui/file-upload'
import { VersionTimeline } from '@/components/ui/version-timeline'
import {
  Plus, BarChart3, TrendingUp, Download, Edit, Trash2, Loader2,
  Search, Sparkles, ExternalLink, Eye, FileText, Upload, Brain, Globe
} from 'lucide-react'
import { formatDate, generateDocId } from '@/lib/utils'
import { generateMarketingReportPrompt, WORKFLOW_STEPS } from '@/lib/ai-utils'
import type { MarketingIntelligenceForm } from '@/lib/ai-types'
import { useToast } from '@/hooks/use-toast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { PublishDialog } from '@/components/ui/publish-dialog'
import { useUser } from '@/components/user-provider'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { ClientAutocomplete } from '@/components/ui/client-autocomplete'
import { getCachedData, setCachedData, invalidateCache } from '@/lib/data-cache'

type MarketingReport = {
  id: string; docId: string; client: string; period: string; channels: string[]; status: string; created: string;
  history: { date: string; action: string; canDownload?: boolean }[];
  prompt?: string; approvalStatus?: string; reportDetails?: Partial<MarketingIntelligenceForm>
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
}

export default function MarketingIntelligencePage() {
  const { user } = useUser()
  const [reports, setReports] = useState<MarketingReport[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [detailReport, setDetailReport] = useState<MarketingReport | null>(null)
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [currentStep, setCurrentStep] = useState(0)
  const { toast } = useToast()
  const [generating, setGenerating] = useState(false)
  const [uploadedDataFiles, setUploadedDataFiles] = useState<File[]>([])
  const [publishDoc, setPublishDoc] = useState<MarketingReport | null>(null)

  const emptyForm: MarketingIntelligenceForm = {
    client: '', period: '', channels: [], uploadedFiles: [],
    metaSpend: '', metaRevenue: '', metaLeads: '', metaImpressions: '', metaROAS: '',
    googleSpend: '', googleRevenue: '', googleClicks: '', googleConversions: '',
    seoRanking: '', seoTraffic: '', seoKeywords: '',
    summary: '', insights: '', recommendations: '', nextPlan: ''
  }
  const [form, setForm] = useState<MarketingIntelligenceForm>(emptyForm)

  useEffect(() => {
    const cached = getCachedData<MarketingReport[]>('marketing_reports')
    if (cached) { setReports(cached); setLoading(false) }
    async function load() {
      if (!cached) setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase.from('marketing_reports').select('*').order('created_at', { ascending: false })
          if (!error && data) {
            const mapped = data.map((r: any) => {
              let extra: any = { period: 'Monthly', channels: [] }
              try { extra = JSON.parse(r.title) } catch { extra.period = r.title }
              return {
                id: r.id, docId: r.doc_id, client: r.client, period: extra.period,
                channels: Array.isArray(extra.channels) ? extra.channels : [], status: r.status || 'draft',
                created: r.created, history: Array.isArray(r.history) ? r.history : [],
                prompt: extra.prompt || '', approvalStatus: extra.approvalStatus || 'draft',
                reportDetails: extra.reportDetails || undefined,
                published: r.published || false,
                published_by: r.published_by || '',
                published_at: r.published_at || '',
                viewed_at: r.viewed_at || '',
                downloaded_at: r.downloaded_at || '',
                signed_at: r.signed_at || '',
                published_version: r.published_version || 1,
                visibility_status: r.visibility_status || 'visible',
                ip_address: r.ip_address || '',
                browser: r.browser || '',
                device: r.device || '',
                client_id: r.client_id || '',
              }
            })
            setReports(mapped); setCachedData('marketing_reports', mapped)
          }
        } catch (err: any) { toast({ title: 'Database Error', description: err.message, variant: 'destructive' }) }
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = reports.filter(r => r.client.toLowerCase().includes(search.toLowerCase()) || r.period.toLowerCase().includes(search.toLowerCase()))

  const handleGeneratePrompt = () => {
    const prompt = generateMarketingReportPrompt({
      ...form,
      uploadedFiles: uploadedDataFiles.map(f => ({ name: f.name, type: f.type, size: f.size }))
    })
    setGeneratedPrompt(prompt)
    setCurrentStep(2)
    toast({ title: 'Prompt Generated!' })
  }

  const handleCreate = async () => {
    if (!form.client || !form.period) return
    setGenerating(true)
    try {
      const docId = generateDocId('NG-MIE')
      const targetId = String(Date.now())
      const targetCreated = new Date().toISOString().slice(0, 10)
      const targetHistory = [{ date: targetCreated, action: 'Marketing report created', canDownload: true }]
      const prompt = generatedPrompt || generateMarketingReportPrompt(form)

      const titleJson = JSON.stringify({ period: form.period, channels: form.channels, prompt, approvalStatus: 'draft', reportDetails: form })

      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('marketing_reports').insert([{
          id: targetId, doc_id: docId, client: form.client,
          title: titleJson, status: 'draft', created: targetCreated, history: targetHistory
        }])
        if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return }
      }

      const newReport: MarketingReport = { id: targetId, docId, client: form.client, period: form.period, channels: form.channels, status: 'draft', created: targetCreated, history: targetHistory, prompt, approvalStatus: 'draft', reportDetails: form }
      const updatedList = [newReport, ...reports]
      setReports(updatedList); setCachedData('marketing_reports', updatedList); invalidateCache('dashboard')
      setShowCreate(false); setGeneratedPrompt(''); setForm(emptyForm); setCurrentStep(0); setUploadedDataFiles([])
      toast({ title: 'Report Created!', description: `${docId} saved.` })
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
    finally { setGenerating(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    if (isSupabaseConfigured()) { await supabase.from('marketing_reports').delete().eq('id', deleteId) }
    const updatedList = reports.filter(r => r.id !== deleteId)
    setReports(updatedList); setCachedData('marketing_reports', updatedList); invalidateCache('dashboard')
    setDeleteId(null); toast({ title: 'Report Deleted' })
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
        status: 'draft'
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
        .from('marketing_reports')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    }

    const updatedList = reports.map(r => r.id === id ? { ...r, ...updates } : r)
    setReports(updatedList)
    setCachedData('marketing_reports', updatedList)
    invalidateCache('dashboard')
  }

  const openDetail = (r: MarketingReport) => {
    setDetailReport(r)
    if (r.reportDetails) setForm(r.reportDetails as MarketingIntelligenceForm)
    setGeneratedPrompt(r.prompt || '')
    setActiveTab('overview')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-cyan-400" />
            <h1 className="text-2xl font-bold tracking-tight">Marketing Intelligence Engine</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">Analyze marketing data and generate AI-powered performance reports</p>
        </div>
        <Button variant="gold" size="sm" onClick={() => { setForm(emptyForm); setGeneratedPrompt(''); setCurrentStep(1); setShowCreate(true) }} className="gap-1.5 w-full sm:w-auto">
          <Plus className="h-4 w-4" />New Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Reports', value: reports.length, icon: BarChart3, color: 'text-cyan-400' },
          { label: 'This Month', value: reports.filter(r => r.created >= new Date().toISOString().slice(0, 7)).length, icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Draft', value: reports.filter(r => r.status === 'draft').length, icon: FileText, color: 'text-amber-400' },
          { label: 'Approved', value: reports.filter(r => r.approvalStatus === 'approved').length, icon: Download, color: 'text-violet-400' },
        ].map(s => (
          <Card key={s.label} className="ai-card ai-card-glow"><CardContent className="p-4">
            <s.icon className={`h-4 w-4 ${s.color} mb-2`} />
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search reports..." value={search} onChange={e => setSearch(e.target.value)} /></div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(r => (
          <Card key={r.id} className="ai-card ai-card-glow cursor-pointer" onClick={() => openDetail(r)}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs text-cyan-400/70">{r.docId}</span>
                  {r.published ? (
                    <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                      <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded border ${r.visibility_status === 'hidden' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`} title={r.visibility_status === 'hidden' ? 'Hidden from Client Portal' : 'Published to Client Portal'}>
                        <Globe className="h-2.5 w-2.5" />
                        {r.visibility_status === 'hidden' ? 'Hidden' : `V${r.published_version || 1}`}
                      </span>
                      {r.viewed_at && <span className="text-blue-400 font-medium border border-blue-500/20 bg-blue-500/5 px-1 py-0.5 rounded" title={`Viewed at ${formatDate(r.viewed_at)}`}>Viewed</span>}
                      {r.downloaded_at && <span className="text-green-400 font-medium border border-green-500/20 bg-green-500/5 px-1 py-0.5 rounded" title={`Downloaded at ${formatDate(r.downloaded_at)}`}>DL</span>}
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground/50 mt-1">Not Published</div>
                  )}
                  <h3 className="font-semibold text-sm mt-1">{r.client}</h3>
                  <p className="text-xs text-muted-foreground">Period: {r.period}</p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {r.channels.map(c => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <ApprovalBadge status={r.approvalStatus || 'draft'} />
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openDetail(r)}><Eye className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className={`h-7 w-7 ${r.published ? 'text-purple-400 hover:text-purple-300' : 'text-muted-foreground hover:text-gold'}`} title="Publish to Client Portal" onClick={() => setPublishDoc(r)}>
                      <Globe className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { if (r.reportDetails) setForm(r.reportDetails as MarketingIntelligenceForm); else setForm({...emptyForm, client: r.client, period: r.period, channels: r.channels}); setEditId(r.id) }}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-400" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
            <DialogTitle>New Marketing Intelligence Report</DialogTitle>
            <div className="mt-3"><WorkflowSteps steps={WORKFLOW_STEPS} currentStep={currentStep} /></div>
          </DialogHeader>
          <Tabs defaultValue="data" className="mt-2">
            <TabsList className="w-full"><TabsTrigger value="data" className="flex-1">Upload Data</TabsTrigger><TabsTrigger value="metrics" className="flex-1">Metrics</TabsTrigger><TabsTrigger value="prompt" className="flex-1">AI Prompt</TabsTrigger></TabsList>

            <TabsContent value="data" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Client *</Label>
                  <ClientAutocomplete placeholder="Company name" value={form.client} onChange={v => setForm({...form, client: v})} onSelect={client => setForm({...form, client: client.business || client.name})} />
                </div>
                <div className="space-y-1"><Label>Report Period *</Label><Input placeholder="e.g. June 2024" value={form.period} onChange={e => setForm({...form, period: e.target.value})} /></div>
              </div>

              <div className="space-y-2">
                <Label>Channels Covered</Label>
                <div className="flex flex-wrap gap-3">
                  {['Meta Ads', 'Google Ads', 'SEO', 'WhatsApp', 'Email', 'Content', 'YouTube', 'LinkedIn'].map(c => (
                    <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.channels.includes(c)} onChange={e => setForm({...form, channels: e.target.checked ? [...form.channels, c] : form.channels.filter(x => x !== c)})} className="rounded" />{c}
                    </label>
                  ))}
                </div>
              </div>

              <FileUpload
                accept=".csv,.xlsx,.xls,.pdf,.json"
                multiple
                label="Upload Marketing Data"
                description="Meta CSV, Google Ads CSV, GA4 exports, Search Console, Excel, PDF reports"
                onFilesSelected={files => setUploadedDataFiles(files)}
              />
            </TabsContent>

            <TabsContent value="metrics" className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {form.channels.includes('Meta Ads') && <>
                  <div className="col-span-1 sm:col-span-2"><p className="text-xs font-semibold text-pink-400 mb-2">📣 Meta Ads Metrics</p></div>
                  <div className="space-y-1"><Label>Ad Spend (₹)</Label><Input type="number" value={form.metaSpend} onChange={e => setForm({...form, metaSpend: e.target.value})} /></div>
                  <div className="space-y-1"><Label>Revenue (₹)</Label><Input type="number" value={form.metaRevenue} onChange={e => setForm({...form, metaRevenue: e.target.value})} /></div>
                  <div className="space-y-1"><Label>Leads</Label><Input type="number" value={form.metaLeads} onChange={e => setForm({...form, metaLeads: e.target.value})} /></div>
                  <div className="space-y-1"><Label>Impressions</Label><Input type="number" value={form.metaImpressions} onChange={e => setForm({...form, metaImpressions: e.target.value})} /></div>
                </>}
                {form.channels.includes('Google Ads') && <>
                  <div className="col-span-1 sm:col-span-2"><p className="text-xs font-semibold text-blue-400 mb-2">🔍 Google Ads Metrics</p></div>
                  <div className="space-y-1"><Label>Ad Spend (₹)</Label><Input type="number" value={form.googleSpend} onChange={e => setForm({...form, googleSpend: e.target.value})} /></div>
                  <div className="space-y-1"><Label>Revenue (₹)</Label><Input type="number" value={form.googleRevenue} onChange={e => setForm({...form, googleRevenue: e.target.value})} /></div>
                  <div className="space-y-1"><Label>Clicks</Label><Input type="number" value={form.googleClicks} onChange={e => setForm({...form, googleClicks: e.target.value})} /></div>
                  <div className="space-y-1"><Label>Conversions</Label><Input type="number" value={form.googleConversions} onChange={e => setForm({...form, googleConversions: e.target.value})} /></div>
                </>}
                {form.channels.includes('SEO') && <>
                  <div className="col-span-1 sm:col-span-2"><p className="text-xs font-semibold text-green-400 mb-2">📈 SEO Metrics</p></div>
                  <div className="space-y-1"><Label>Organic Traffic</Label><Input type="number" value={form.seoTraffic} onChange={e => setForm({...form, seoTraffic: e.target.value})} /></div>
                  <div className="space-y-1"><Label>Avg Keyword Rank</Label><Input type="number" value={form.seoRanking} onChange={e => setForm({...form, seoRanking: e.target.value})} /></div>
                </>}
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Executive Summary</Label><Textarea className="h-16 resize-none" placeholder="Overall performance summary..." value={form.summary} onChange={e => setForm({...form, summary: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Key Insights</Label><Textarea className="h-16 resize-none" placeholder="What worked? What didn't?" value={form.insights} onChange={e => setForm({...form, insights: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Recommendations</Label><Textarea className="h-16 resize-none" placeholder="Action items..." value={form.recommendations} onChange={e => setForm({...form, recommendations: e.target.value})} /></div>
              </div>
              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border">
                <Button variant="gold" className="gap-1.5" onClick={handleGeneratePrompt} disabled={!form.client || !form.period}><Sparkles className="h-4 w-4" />Generate Prompt</Button>
                <Button variant="outline" size="sm" className="gap-1.5" asChild><a href="/ai-hub/skills" target="_blank"><Download className="h-3.5 w-3.5" />Download Report.skill</a></Button>
              </div>
            </TabsContent>

            <TabsContent value="prompt" className="mt-4">
              <PromptViewer prompt={generatedPrompt} title="Marketing Intelligence Prompt" downloadFilename={`Marketing_Prompt_${form.client.replace(/\s+/g, '_')}_${form.period}.txt`} />
              {generatedPrompt && (
                <div className="mt-4 flex items-center gap-3">
                  <Button variant="outline" size="sm" className="gap-1.5" asChild><a href="/ai-hub/skills" target="_blank"><Download className="h-3.5 w-3.5" />Download Marketing Report.skill</a></Button>
                  <Button variant="outline" size="sm" className="gap-1.5" asChild><a href="https://claude.ai" target="_blank" rel="noopener"><ExternalLink className="h-3.5 w-3.5" />Open Claude</a></Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="gold" onClick={handleCreate} disabled={generating || !form.client || !form.period}>
              {generating ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Creating...</> : 'Save Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DETAIL DIALOG */}
      <Dialog open={!!detailReport} onOpenChange={open => { if (!open) { setDetailReport(null); setGeneratedPrompt('') } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-cyan-400" />{detailReport?.client} — {detailReport?.period}</DialogTitle>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-xs text-cyan-400/70">{detailReport?.docId}</span>
              <ApprovalBadge status={detailReport?.approvalStatus || 'draft'} />
            </div>
          </DialogHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-4 sm:grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="prompt">Prompt</TabsTrigger>
              <TabsTrigger value="documents">Docs</TabsTrigger>
              <TabsTrigger value="approval">Approval</TabsTrigger>
              <TabsTrigger value="activity" className="hidden sm:block">Activity</TabsTrigger>
              <TabsTrigger value="versions" className="hidden sm:block">Versions</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Client</p><p className="text-sm font-bold">{detailReport?.client}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Period</p><p className="text-sm font-bold">{detailReport?.period}</p></CardContent></Card>
              </div>
              <div className="flex gap-1 flex-wrap">{detailReport?.channels.map(c => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}</div>
              <WorkflowSteps steps={WORKFLOW_STEPS} currentStep={detailReport?.prompt ? 3 : 1} />
            </TabsContent>
            <TabsContent value="prompt" className="mt-4">
              <PromptViewer prompt={detailReport?.prompt || generatedPrompt} title="Marketing Intelligence Prompt" downloadFilename={`Marketing_${detailReport?.client?.replace(/\s+/g, '_')}.txt`} />
              {!detailReport?.prompt && !generatedPrompt && detailReport?.reportDetails && (
                <Button variant="gold" className="gap-1.5 mt-4" onClick={() => { const prompt = generateMarketingReportPrompt(detailReport.reportDetails as MarketingIntelligenceForm); setGeneratedPrompt(prompt) }}>
                  <Sparkles className="h-4 w-4" />Generate Prompt
                </Button>
              )}
            </TabsContent>
            <TabsContent value="documents" className="mt-4">
              <div className="space-y-4">
                <FileUpload accept=".pdf,.xlsx,.xls,.doc,.docx" multiple label="Upload Generated Reports" description="Upload Excel and PDF reports generated by Claude" onFilesSelected={files => { if (files.length > 0) toast({ title: 'Files Uploaded', description: `${files.length} file(s) attached.` }) }} />
              </div>
            </TabsContent>
            <TabsContent value="approval" className="mt-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border">
                <div><p className="text-sm font-semibold">Approval Status</p></div>
                <ApprovalBadge status={detailReport?.approvalStatus || 'draft'} size="md" />
              </div>
            </TabsContent>
            <TabsContent value="activity" className="mt-4">
              <VersionTimeline versions={(detailReport?.history || []).map((h, i) => ({ version: i + 1, date: h.date, action: h.action, canDownload: h.canDownload }))} />
            </TabsContent>
            <TabsContent value="versions" className="mt-4">
              <VersionTimeline versions={(detailReport?.history || []).filter(h => h.canDownload).map((h, i) => ({ version: i + 1, date: h.date, action: h.action, canDownload: true, canRestore: true }))} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editId} onOpenChange={open => !open && setEditId(null)}>
        <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Edit Report</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1"><Label>Client *</Label><ClientAutocomplete placeholder="Company name" value={form.client} onChange={v => setForm({...form, client: v})} onSelect={client => setForm({...form, client: client.business || client.name})} /></div>
            <div className="space-y-1"><Label>Period *</Label><Input value={form.period} onChange={e => setForm({...form, period: e.target.value})} /></div>
            <div className="col-span-1 sm:col-span-2 space-y-2"><Label>Channels</Label><div className="flex flex-wrap gap-3">{['Meta Ads', 'Google Ads', 'SEO', 'WhatsApp', 'Email', 'Content'].map(c => (<label key={c} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.channels.includes(c)} onChange={e => setForm({...form, channels: e.target.checked ? [...form.channels, c] : form.channels.filter(x => x !== c)})} />{c}</label>))}</div></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button><Button variant="gold" onClick={async () => {
            if (!editId) return
            const target = reports.find(r => r.id === editId)
            if (!target) return
            const newHistory = [...target.history, { date: new Date().toISOString().slice(0, 10), action: 'Report Updated', canDownload: true }]
            const updated = { ...target, client: form.client, period: form.period, channels: form.channels, history: newHistory, reportDetails: form }
            if (isSupabaseConfigured()) {
              const titleJson = JSON.stringify({ period: form.period, channels: form.channels, prompt: target.prompt, approvalStatus: target.approvalStatus, reportDetails: form })
              await supabase.from('marketing_reports').update({ client: form.client, title: titleJson, history: newHistory }).eq('id', editId)
            }
            const updatedList = reports.map(r => r.id === editId ? updated : r)
            setReports(updatedList); setCachedData('marketing_reports', updatedList); invalidateCache('dashboard')
            setEditId(null); toast({ title: 'Report Updated' })
          }}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Report?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <PublishDialog
        open={!!publishDoc}
        onOpenChange={(open) => !open && setPublishDoc(null)}
        docTitle={publishDoc?.client ? `Marketing Report — ${publishDoc?.client}` : publishDoc?.docId || ''}
        docId={publishDoc?.docId || ''}
        isPublished={!!publishDoc?.published}
        visibilityStatus={publishDoc?.visibility_status || 'visible'}
        currentVersion={publishDoc?.published_version || 1}
        onAction={handlePublishAction}
      />
    </div>
  )
}
