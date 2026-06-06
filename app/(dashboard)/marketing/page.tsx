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
import { Plus, BarChart3, TrendingUp, TrendingDown, Target, Download, Eye, Edit, Trash2, History, Loader2 } from 'lucide-react'
import { formatDate, generateDocId } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

type MarketingReport = {
  id: string; docId: string; client: string; period: string; channels: string[]; status: string; created: string; history: { date: string; action: string; canDownload?: boolean }[]
}

const mockReports: MarketingReport[] = []
const metricSample: any[] = []

export default function MarketingPage() {
  const [reports, setReports] = useState<MarketingReport[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [historyDoc, setHistoryDoc] = useState<MarketingReport | null>(null)
  const { toast } = useToast()
  const [generating, setGenerating] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    client: '', period: '', channels: [] as string[],
    metaSpend: '', metaRevenue: '', metaLeads: '', metaImpressions: '', metaROAS: '',
    googleSpend: '', googleRevenue: '', googleClicks: '', googleConversions: '',
    seoRanking: '', seoTraffic: '', seoKeywords: '',
    summary: '', insights: '', recommendations: '', nextPlan: ''
  })

  useEffect(() => {
    async function loadReports() {
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase.from('marketing_reports').select('*').order('created_at', { ascending: false })
          if (error) {
            toast({ title: 'Error loading marketing reports', description: error.message, variant: 'destructive' })
          } else if (data) {
            const mapped = data.map((r: any) => {
              let extra = { period: 'Monthly', channels: [] as string[] }
              try {
                extra = JSON.parse(r.title)
              } catch (e) {
                extra.period = r.title
              }
              return {
                id: r.id,
                docId: r.doc_id,
                client: r.client,
                period: extra.period,
                channels: Array.isArray(extra.channels) ? extra.channels : [],
                status: r.status || 'draft',
                created: r.created,
                history: Array.isArray(r.history) ? r.history : []
              }
            })
            setReports(mapped)
          }
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        }
      } else {
        setReports(mockReports)
      }
      setLoading(false)
    }
    loadReports()
  }, [])

  const buildReportContent = (f: typeof form) => {
    const hasMetaData = f.metaSpend || f.metaRevenue
    const hasGoogleData = f.googleSpend || f.googleRevenue
    const hasSEOData = f.seoTraffic || f.seoRanking

    return `# Marketing Performance Report\n\n**Client:** ${f.client}\n**Period:** ${f.period}\n**Channels:** ${f.channels.join(', ')}\n\n## Executive Summary\n${f.summary || `Performance analysis for ${f.period}. Overall digital marketing performance shows strong ROI across selected channels.`}\n\n${hasMetaData ? `## Meta Ads (Facebook/Instagram)\n| Metric | Value |\n|--------|-------|\n| Ad Spend | ₹${Number(f.metaSpend).toLocaleString('en-IN')} |\n| Revenue Generated | ₹${Number(f.metaRevenue).toLocaleString('en-IN')} |\n| ROAS | ${f.metaROAS || ((Number(f.metaRevenue) / Number(f.metaSpend)).toFixed(2))}x |\n| Leads Generated | ${f.metaLeads} |\n| Total Impressions | ${f.metaImpressions} |\n\n` : ''}${hasGoogleData ? `## Google Ads\n| Metric | Value |\n|--------|-------|\n| Ad Spend | ₹${Number(f.googleSpend).toLocaleString('en-IN')} |\n| Revenue | ₹${Number(f.googleRevenue).toLocaleString('en-IN')} |\n| Clicks | ${f.googleClicks} |\n| Conversions | ${f.googleConversions} |\n\n` : ''}${hasSEOData ? `## SEO Performance\n| Metric | Value |\n|--------|-------|\n| Organic Traffic | ${f.seoTraffic} visitors |\n| Avg. Keyword Ranking | #${f.seoRanking} |\n| Keywords in Top 10 | ${f.seoKeywords} |\n\n` : ''}## Key Insights\n${f.insights || '1. ROAS above industry benchmark\n2. Mobile traffic driving 65% of conversions\n3. Retargeting campaigns outperforming prospecting'}\n\n## Recommendations for Next Month\n${f.recommendations || '1. Increase budget on best-performing ad sets by 20%\n2. Launch new retargeting sequence for cart abandoners\n3. Focus SEO on long-tail commercial keywords'}\n\n## Next Month Plan\n${f.nextPlan || 'Scale winning campaigns, introduce new creative variants, target lookalike audiences.'}`
  }

  const handleGenerate = async () => {
    if (!form.client || !form.period) return
    setGenerating(true)
    try {
      const docId = generateDocId('NG-MKT')
      const targetId = String(Date.now())
      const targetCreated = new Date().toISOString().slice(0, 10)
      const targetHistory = [{date: targetCreated, action: 'Marketing Report Generated', canDownload: true}]

      const content = buildReportContent(form)

      const payload = { docType: 'Marketing Report', clientName: form.client, projectTitle: `Marketing Report — ${form.period}`, content, items: [], subtotal: 0, discountTotal: 0, grandTotal: 0 }
      const res = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('PDF failed')
      const blob = await res.blob()
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `MarketingReport_${form.client}_${form.period}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a)

      if (isSupabaseConfigured()) {
        const titleJson = JSON.stringify({ period: form.period, channels: form.channels })
        const { error } = await supabase.from('marketing_reports').insert([{
          id: targetId,
          doc_id: docId,
          client: form.client,
          title: titleJson,
          status: 'draft',
          created: targetCreated,
          history: targetHistory
        }])
        if (error) {
          toast({ title: 'Error saving report to database', description: error.message, variant: 'destructive' })
          setGenerating(false)
          return
        }
      }

      setReports([{ id: targetId, docId, client: form.client, period: form.period, channels: form.channels, status: 'draft', created: targetCreated, history: targetHistory }, ...reports])
      setShowCreate(false); toast({ title: 'Report Generated!', description: `${docId} downloaded.` })
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
    finally { setGenerating(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('marketing_reports').delete().eq('id', deleteId)
        if (error) {
          toast({ title: 'Error deleting report', description: error.message, variant: 'destructive' })
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        return
      }
    }
    setReports(reports.filter(p => p.id !== deleteId))
    setDeleteId(null)
    toast({ title: 'Report Deleted' })
  }

  const handleEditSubmit = async () => {
    if (!editId) return
    const targetRep = reports.find(r => r.id === editId)
    if (!targetRep) return

    const newHistory = [...targetRep.history, {date: new Date().toISOString().slice(0, 10), action: 'Report Updated', canDownload: true}]
    const updated = { ...targetRep, client: form.client, period: form.period, channels: form.channels, history: newHistory }

    if (isSupabaseConfigured()) {
      try {
        const titleJson = JSON.stringify({ period: form.period, channels: form.channels })
        const { error } = await supabase.from('marketing_reports').update({
          client: form.client,
          title: titleJson,
          history: newHistory
        }).eq('id', editId)

        if (error) {
          toast({ title: 'Error saving report edit', description: error.message, variant: 'destructive' })
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        return
      }
    }

    setReports(reports.map(p => p.id === editId ? updated : p))
    setEditId(null)
    toast({ title: 'Report Updated' })
  }

  const handleDownload = async (p: MarketingReport) => {
    setDownloadingId(p.id)
    try {
      const formForReport = {
        client: p.client,
        period: p.period,
        channels: p.channels,
        metaSpend: '', metaRevenue: '', metaLeads: '', metaImpressions: '', metaROAS: '',
        googleSpend: '', googleRevenue: '', googleClicks: '', googleConversions: '',
        seoRanking: '', seoTraffic: '', seoKeywords: '',
        summary: 'Marketing performance report summary.',
        insights: 'Key campaign insights.',
        recommendations: 'Actionable recommendations.',
        nextPlan: 'Next month execution plan.'
      }
      const content = buildReportContent(formForReport)
      const payload = { docType: 'Marketing Report', clientName: p.client, projectTitle: `Marketing Report — ${p.period}`, content, items: [], subtotal: 0, discountTotal: 0, grandTotal: 0 }
      const res = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error('PDF failed')
      const blob = await res.blob()
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `MarketingReport_${p.client}_${p.period}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a)

      const newHistory = [...p.history, {date: new Date().toISOString().slice(0, 10), action: 'Report Downloaded', canDownload: true}]
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('marketing_reports').update({ history: newHistory }).eq('id', p.id)
        if (error) {
          toast({ title: 'Error updating report history', description: error.message, variant: 'destructive' })
        }
      }
      setReports(reports.map(doc => doc.id === p.id ? { ...doc, history: newHistory } : doc))
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
        <div><h1 className="text-2xl font-bold tracking-tight">Marketing Reports</h1><p className="text-muted-foreground text-sm mt-0.5">Generate comprehensive marketing performance reports with analysis.</p></div>
        <Button variant="gold" size="sm" onClick={() => setShowCreate(true)} className="gap-1.5"><Plus className="h-4 w-4" />New Report</Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Sample Performance Overview — FashionHub India (May 2024)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={metricSample}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v/1000}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
              <Bar yAxisId="left" dataKey="spend" fill="#6366f1" radius={[4, 4, 0, 0]} name="Ad Spend" />
              <Bar yAxisId="left" dataKey="revenue" fill="#D4AF37" radius={[4, 4, 0, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map(r => (
          <Card key={r.id} className="hover:shadow-md hover:border-gold/20 transition-all">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs text-gold/70">{r.docId}</span>
                  <h3 className="font-semibold text-sm mt-1">{r.client}</h3>
                  <p className="text-xs text-muted-foreground">Period: {r.period}</p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {r.channels.map(c => <Badge key={c} variant="info" className="text-[10px]">{c}</Badge>)}
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge variant={r.status === 'final' ? 'success' : 'outline'}>{r.status}</Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleDownload(r)} title="Download"><Download className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setHistoryDoc(r)} title="History"><History className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setForm({...form, client: r.client, period: r.period, channels: r.channels}); setEditId(r.id) }} title="Edit"><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-400" onClick={() => setDeleteId(r.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Generate Marketing Report</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1"><Label>Client *</Label><Input placeholder="Company name" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
            <div className="space-y-1"><Label>Report Period *</Label><Input placeholder="e.g. May 2024" value={form.period} onChange={e => setForm({...form, period: e.target.value})} /></div>
            <div className="col-span-2 space-y-2"><Label>Channels Covered</Label><div className="flex flex-wrap gap-3">{['Meta Ads', 'Google Ads', 'SEO', 'WhatsApp', 'Email', 'Content'].map(c => (<label key={c} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.channels.includes(c)} onChange={e => setForm({...form, channels: e.target.checked ? [...form.channels, c] : form.channels.filter(x => x !== c)})} />{c}</label>))}</div></div>

            {(form.channels.includes('Meta Ads')) && <>
              <div className="col-span-2"><p className="text-xs font-semibold text-gold mb-2">📣 Meta Ads Metrics</p></div>
              <div className="space-y-1"><Label>Ad Spend (₹)</Label><Input type="number" value={form.metaSpend} onChange={e => setForm({...form, metaSpend: e.target.value})} /></div>
              <div className="space-y-1"><Label>Revenue Generated (₹)</Label><Input type="number" value={form.metaRevenue} onChange={e => setForm({...form, metaRevenue: e.target.value})} /></div>
              <div className="space-y-1"><Label>Leads / Conversions</Label><Input type="number" value={form.metaLeads} onChange={e => setForm({...form, metaLeads: e.target.value})} /></div>
              <div className="space-y-1"><Label>Total Impressions</Label><Input type="number" value={form.metaImpressions} onChange={e => setForm({...form, metaImpressions: e.target.value})} /></div>
            </>}

            {form.channels.includes('Google Ads') && <>
              <div className="col-span-2"><p className="text-xs font-semibold text-gold mb-2">🔍 Google Ads Metrics</p></div>
              <div className="space-y-1"><Label>Ad Spend (₹)</Label><Input type="number" value={form.googleSpend} onChange={e => setForm({...form, googleSpend: e.target.value})} /></div>
              <div className="space-y-1"><Label>Revenue (₹)</Label><Input type="number" value={form.googleRevenue} onChange={e => setForm({...form, googleRevenue: e.target.value})} /></div>
            </>}

            {form.channels.includes('SEO') && <>
              <div className="col-span-2"><p className="text-xs font-semibold text-gold mb-2">📈 SEO Metrics</p></div>
              <div className="space-y-1"><Label>Organic Traffic</Label><Input type="number" placeholder="Monthly visitors" value={form.seoTraffic} onChange={e => setForm({...form, seoTraffic: e.target.value})} /></div>
              <div className="space-y-1"><Label>Avg Keyword Rank</Label><Input type="number" value={form.seoRanking} onChange={e => setForm({...form, seoRanking: e.target.value})} /></div>
            </>}

            <div className="col-span-2 space-y-1"><Label>Executive Summary</Label><Textarea className="h-16 resize-none" placeholder="Overall performance summary..." value={form.summary} onChange={e => setForm({...form, summary: e.target.value})} /></div>
            <div className="col-span-2 space-y-1"><Label>Key Insights</Label><Textarea className="h-16 resize-none" placeholder="What worked? What didn't?" value={form.insights} onChange={e => setForm({...form, insights: e.target.value})} /></div>
            <div className="col-span-2 space-y-1"><Label>Recommendations</Label><Textarea className="h-16 resize-none" placeholder="Action items for next month..." value={form.recommendations} onChange={e => setForm({...form, recommendations: e.target.value})} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button><Button variant="gold" onClick={handleGenerate} disabled={generating}>{generating ? 'Generating...' : 'Generate Report PDF'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editId} onOpenChange={(open) => !open && setEditId(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Edit Report Details</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1"><Label>Client *</Label><Input placeholder="Company name" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
            <div className="space-y-1"><Label>Report Period *</Label><Input placeholder="e.g. May 2024" value={form.period} onChange={e => setForm({...form, period: e.target.value})} /></div>
            <div className="col-span-2 space-y-2"><Label>Channels Covered</Label><div className="flex flex-wrap gap-3">{['Meta Ads', 'Google Ads', 'SEO', 'WhatsApp', 'Email', 'Content'].map(c => (<label key={c} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.channels.includes(c)} onChange={e => setForm({...form, channels: e.target.checked ? [...form.channels, c] : form.channels.filter(x => x !== c)})} />{c}</label>))}</div></div>
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
            <AlertDialogTitle>Delete Report?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the report record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>Delete Report</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
