'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Search, Plus, Download, Pencil, Trash2, Loader2, Send, History } from 'lucide-react'
import { formatCurrency, formatDate, generateDocId, getDocStatusColor } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ShareDialog } from '@/components/ui/share-dialog'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

type SOW = { id: string; docId: string; client: string; contact: string; phone: string; project: string; value: number; timeline: string; objectives: string; deliverables: string; milestones: string; payment: string; exclusions: string; revisions: string; jurisdiction: string; status: string; created: string; history: { date: string; action: string; canDownload?: boolean }[] }

const mockSOWs: SOW[] = []
const STATUS_OPTS = ['draft', 'sent', 'signed', 'expired']

export default function SOWPage() {
  const [sows, setSows] = useState<SOW[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState<SOW | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const { toast } = useToast()
  const [generating, setGenerating] = useState(false)
  const [shareDoc, setShareDoc] = useState<{ id: string, title: string } | null>(null)
  const [historyDoc, setHistoryDoc] = useState<SOW | null>(null)

  const [form, setForm] = useState({
    client: '', contact: '', phone: '', email: '', businessType: 'E-Commerce',
    project: '', value: '', timeline: '', startDate: '',
    objectives: '', deliverables: '', milestones: '',
    payment: '50% advance to start, balance on delivery',
    exclusions: 'Domain registration and renewal, Hosting fees, Third-party API/tool subscriptions, Ad spend',
    revisions: '2 rounds of revisions included per deliverable',
    confidentiality: 'Both parties agree to maintain strict confidentiality of all shared information.',
    jurisdiction: 'Hyderabad, Telangana, India',
  })

  useEffect(() => {
    async function loadSOWs() {
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase.from('sows').select('*').order('created_at', { ascending: false })
          if (error) {
            toast({ title: 'Error loading SOWs', description: error.message, variant: 'destructive' })
          } else if (data) {
            const mapped = data.map((s: any) => ({
              id: s.id,
              docId: s.doc_id,
              client: s.client,
              contact: s.contact || '',
              phone: s.phone || '',
              project: s.project,
              value: Number(s.value) || 0,
              timeline: s.timeline || '',
              objectives: s.objectives || '',
              deliverables: s.deliverables || '',
              milestones: s.milestones || '',
              payment: s.payment || '',
              exclusions: s.exclusions || '',
              revisions: s.revisions || '',
              jurisdiction: s.jurisdiction || '',
              status: s.status || 'draft',
              created: s.created,
              history: Array.isArray(s.history) ? s.history : []
            }))
            setSows(mapped)
          }
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        }
      } else {
        setSows(mockSOWs)
      }
      setLoading(false)
    }
    loadSOWs()
  }, [])

  function buildPayload(f: typeof form, clientName: string, project: string, docId: string) {
    const content = [
      '## Project Overview',
      `**Project:** ${project}`,
      `**Client:** ${clientName}${f.contact ? ` (Attn: ${f.contact})` : ''}`,
      `**Timeline:** ${f.timeline || 'To be defined in kickoff'}`,
      `**Contract Value:** ${f.value ? formatCurrency(Number(f.value)) : 'As per quotation'}`,
      '',
      '## Objectives',
      f.objectives || "To deliver a high-quality solution that meets the client's business goals.",
      '',
      '## Deliverables',
      ...(f.deliverables || '').split('\n').filter(Boolean).map(d => `- ${d}`),
      '',
      f.milestones ? `## Project Milestones\n${f.milestones.split('\n').filter(Boolean).map((m, i) => `**Milestone ${i + 1}:** ${m}`).join('\n')}` : '',
      '',
      '## Payment Terms',
      f.payment,
      '',
      '## Revision Policy',
      f.revisions,
      '',
      '## Exclusions',
      ...(f.exclusions || '').split(',').map(e => `- ${e.trim()}`),
      '',
      '## Jurisdiction',
      `This agreement shall be governed by the laws of **${f.jurisdiction}**.`,
      '',
      '---',
      `| Netgain Studio | ${clientName} |`,
      `|---|---|`,
      '| Signature: _________________ | Signature: _________________ |',
      '| Date: _________________ | Date: _________________ |',
    ].filter(l => l !== null).join('\n')
    return {
      docType: 'SOW',
      clientName: f.contact || clientName,
      projectTitle: project || `SOW — ${clientName}`,
      companyName: clientName,
      clientInfo: { mobile: f.phone },
      content,
      items: [],
      subtotal: Number(f.value) || 0,
      discountTotal: 0,
      grandTotal: Number(f.value) || 0,
    }
  }

  async function downloadSowPdf(sow: SOW) {
    const payload = buildPayload({ ...sow, value: String(sow.value), email: '', businessType: '', startDate: '', confidentiality: 'Both parties agree to maintain strict confidentiality of all shared information.' }, sow.client, sow.project, sow.docId)
    const res = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'PDF failed') }
    const blob = await res.blob()
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `SOW_${sow.docId}_${sow.client.replace(/\s+/g, '_')}.pdf`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  async function handleDownload(sow: SOW) {
    setDownloadingId(sow.id)
    try { await downloadSowPdf(sow); toast({ title: `✅ ${sow.docId} downloaded` }) }
    catch (e: any) { toast({ title: 'Download failed', description: e.message, variant: 'destructive' }) }
    finally { setDownloadingId(null) }
  }

  async function updateStatus(id: string, status: string) {
    const targetSow = sows.find(s => s.id === id)
    if (!targetSow) return
    const newHistory = [...targetSow.history, { date: new Date().toISOString().split('T')[0], action: `Status changed to ${status}` }]
    
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('sows').update({ status, history: newHistory }).eq('id', id)
        if (error) {
          toast({ title: 'Error updating status', description: error.message, variant: 'destructive' })
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        return
      }
    }
    setSows(sows.map(s => s.id === id ? { ...s, status, history: newHistory } : s))
  }

  async function handleDelete() {
    if (!deleteId) return
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('sows').delete().eq('id', deleteId)
        if (error) {
          toast({ title: 'Error deleting SOW', description: error.message, variant: 'destructive' })
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        return
      }
    }
    setSows(sows.filter(s => s.id !== deleteId))
    setDeleteId(null)
    toast({ title: 'SOW deleted' })
  }

  const handleGenerate = async () => {
    if (!form.client || !form.project) {
      toast({ title: 'Client and Project name are required', variant: 'destructive' }); return
    }
    setGenerating(true)
    try {
      const docId = editItem ? editItem.docId : generateDocId('NG-SOW')
      const payload = buildPayload(form, form.client, form.project, docId)

      const res = await fetch('/api/generate-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'PDF failed') }
      const blob = await res.blob()
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
      a.download = `SOW_${docId}_${form.client.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)

      const targetId = editItem ? editItem.id : String(Date.now())
      const targetCreated = editItem ? editItem.created : new Date().toISOString().slice(0, 10)
      const targetHistory = editItem 
        ? [...editItem.history, { date: new Date().toISOString().split('T')[0], action: 'Document updated' }] 
        : [{ date: new Date().toISOString().split('T')[0], action: 'Document generated' }]
      const targetStatus = editItem ? editItem.status : 'draft'

      const newSOW: SOW = { 
        id: targetId, 
        docId, 
        client: form.client, 
        contact: form.contact, 
        phone: form.phone, 
        project: form.project, 
        value: Number(form.value) || 0, 
        timeline: form.timeline, 
        objectives: form.objectives, 
        deliverables: form.deliverables, 
        milestones: form.milestones, 
        payment: form.payment, 
        exclusions: form.exclusions, 
        revisions: form.revisions, 
        jurisdiction: form.jurisdiction, 
        status: targetStatus, 
        created: targetCreated, 
        history: targetHistory 
      }

      if (isSupabaseConfigured()) {
        const dbPayload = {
          id: targetId,
          doc_id: docId,
          client: form.client,
          contact: form.contact,
          phone: form.phone,
          project: form.project,
          value: Number(form.value) || 0,
          timeline: form.timeline,
          objectives: form.objectives,
          deliverables: form.deliverables,
          milestones: form.milestones,
          payment: form.payment,
          exclusions: form.exclusions,
          revisions: form.revisions,
          jurisdiction: form.jurisdiction,
          status: targetStatus,
          created: targetCreated,
          history: targetHistory
        }

        const { error } = editItem 
          ? await supabase.from('sows').update(dbPayload).eq('id', targetId)
          : await supabase.from('sows').insert([dbPayload])

        if (error) {
          toast({ title: 'Error saving to database', description: error.message, variant: 'destructive' })
          setGenerating(false)
          return
        }
      }

      if (editItem) {
        setSows(sows.map(s => s.id === editItem.id ? newSOW : s))
        toast({ title: '✅ SOW Updated!', description: `${docId} updated and downloaded.` })
      } else {
        setSows([newSOW, ...sows])
        toast({ title: '✅ SOW Generated!', description: `${docId} downloaded successfully.` })
      }
      
      setShowCreate(false)
      setEditItem(null)
    } catch (e: any) { toast({ title: 'PDF Error', description: e.message, variant: 'destructive' }) }
    finally { setGenerating(false) }
  }



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Scope of Work</h1><p className="text-muted-foreground text-sm mt-0.5">Generate detailed scope of work documents.</p></div>
        <Button variant="gold" size="sm" onClick={() => setShowCreate(true)} className="gap-1.5"><Plus className="h-4 w-4" />New SOW</Button>
      </div>
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">{['Doc ID', 'Client', 'Project', 'Value', 'Status', 'Created', 'Actions'].map(h => <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>{sows.filter(s => s.client.toLowerCase().includes(search.toLowerCase())).map(s => (
              <tr key={s.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="py-3 px-4 font-mono text-xs text-gold">{s.docId}</td>
                <td className="py-3 px-4"><p className="font-medium">{s.client}</p><p className="text-xs text-muted-foreground">{s.contact}</p></td>
                <td className="py-3 px-4 text-xs text-muted-foreground max-w-[200px] truncate">{s.project}</td>
                <td className="py-3 px-4 font-semibold text-gold">{s.value > 0 ? formatCurrency(s.value) : '—'}</td>
                <td className="py-3 px-4">
                  <Select value={s.status} onValueChange={v => updateStatus(s.id, v)}>
                    <SelectTrigger className={`h-7 w-28 text-xs border ${getDocStatusColor(s.status)}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_OPTS.map(o => <SelectItem key={o} value={o} className="text-xs capitalize">{o}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="py-3 px-4 text-xs text-muted-foreground">{formatDate(s.created)}</td>
                <td className="py-3 px-4">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="History" onClick={() => setHistoryDoc(s)}><History className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Download" onClick={() => handleDownload(s)} disabled={downloadingId === s.id}>
                      {downloadingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-400 hover:text-blue-400" title="Edit" onClick={() => { setEditItem(s); setForm({ client: s.client, contact: s.contact, phone: s.phone, email: '', businessType: '', project: s.project, value: String(s.value), timeline: s.timeline, startDate: '', objectives: s.objectives, deliverables: s.deliverables, milestones: s.milestones, payment: s.payment, exclusions: s.exclusions, revisions: s.revisions, confidentiality: '', jurisdiction: s.jurisdiction }); setShowCreate(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-400 hover:text-emerald-400" title="Send to client" onClick={() => setShareDoc({ id: s.id, title: `${s.docId} - ${s.client}` })}>
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-400" title="Delete" onClick={() => setDeleteId(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Generate Scope of Work</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Client & Project</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Company Name *</Label><Input placeholder="Client company" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} /></div>
                <div className="space-y-1"><Label>Contact Person</Label><Input placeholder="Representative" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></div>
                <div className="col-span-2 space-y-1"><Label>Project Name *</Label><Input placeholder="e.g. E-Commerce Platform Build" value={form.project} onChange={e => setForm({ ...form, project: e.target.value })} /></div>
                <div className="space-y-1"><Label>Contract Value (₹)</Label><Input type="number" placeholder="149999" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} /></div>
                <div className="space-y-1"><Label>Timeline</Label><Input placeholder="e.g. 8 Weeks from kickoff" value={form.timeline} onChange={e => setForm({ ...form, timeline: e.target.value })} /></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Scope Details</p>
              <div className="space-y-3">
                <div className="space-y-1"><Label>Objectives</Label><Textarea className="h-16 resize-none" placeholder="What will be achieved? What problems are solved?" value={form.objectives} onChange={e => setForm({ ...form, objectives: e.target.value })} /></div>
                <div className="space-y-1"><Label>Deliverables (one per line)</Label><Textarea className="h-24 resize-none" placeholder="Fully functional Shopify store&#10;Mobile responsive design&#10;Payment gateway integration&#10;Admin dashboard&#10;Training session" value={form.deliverables} onChange={e => setForm({ ...form, deliverables: e.target.value })} /></div>
                <div className="space-y-1"><Label>Milestones (one per line)</Label><Textarea className="h-20 resize-none" placeholder="Discovery & Kickoff (Week 1)&#10;Design Mockups (Week 2-3)&#10;Development (Week 4-7)&#10;Testing & Launch (Week 8)" value={form.milestones} onChange={e => setForm({ ...form, milestones: e.target.value })} /></div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gold mb-3 uppercase tracking-wide">Terms & Conditions</p>
              <div className="space-y-3">
                <div className="space-y-1"><Label>Payment Terms</Label><Input value={form.payment} onChange={e => setForm({ ...form, payment: e.target.value })} /></div>
                <div className="space-y-1"><Label>Exclusions (comma-separated)</Label><Textarea className="h-14 resize-none" value={form.exclusions} onChange={e => setForm({ ...form, exclusions: e.target.value })} /></div>
                <div className="space-y-1"><Label>Revision Policy</Label><Input value={form.revisions} onChange={e => setForm({ ...form, revisions: e.target.value })} /></div>
                <div className="space-y-1"><Label>Jurisdiction</Label><Input value={form.jurisdiction} onChange={e => setForm({ ...form, jurisdiction: e.target.value })} /></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditItem(null); }}>Cancel</Button>
            <Button variant="gold" onClick={handleGenerate} disabled={generating}>
              {generating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{editItem ? 'Saving...' : 'Generating...'}</> : (editItem ? 'Save Changes' : 'Generate SOW')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete SOW?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
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
