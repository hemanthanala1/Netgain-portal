'use client'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Download, Archive, Copy, Tag, FolderOpen, FileText, Receipt, ClipboardList, HandshakeIcon, FolderKanban, ArchiveRestore } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const allDocs = [
  { id: 'd1', docId: 'NG-QUO-2024-1123', type: 'Quotation', client: 'Urban Edge Co.', title: 'E-Commerce + SEO Package', amount: 47998, status: 'sent', date: '2024-06-04', tags: ['quotation', 'ecommerce'] },
  { id: 'd2', docId: 'NG-INV-2024-0891', type: 'Invoice', client: 'FashionHub India', title: 'Monthly Retainer Invoice', amount: 29997, status: 'paid', date: '2024-05-30', tags: ['invoice', 'paid'] },
  { id: 'd3', docId: 'NG-SOW-2024-0034', type: 'SOW', client: 'TechCore Solutions', title: 'Custom SaaS Platform Build SOW', amount: 149999, status: 'signed', date: '2024-05-28', tags: ['sow', 'development'] },
  { id: 'd4', docId: 'NG-AGR-2024-0021', type: 'Agreement', client: 'TechCore Solutions', title: 'Service Level Agreement', amount: 149999, status: 'signed', date: '2024-05-28', tags: ['agreement'] },
  { id: 'd5', docId: 'NG-QUO-2024-1098', type: 'Quotation', client: 'FashionHub India', title: 'Full Digital Marketing Bundle', amount: 29997, status: 'approved', date: '2024-05-28', tags: ['quotation', 'marketing'] },
  { id: 'd6', docId: 'NG-INV-2024-0892', type: 'Invoice', client: 'TechCore Solutions', title: 'Web Development Invoice', amount: 149999, status: 'sent', date: '2024-06-01', tags: ['invoice'] },
]

const typeIcon: Record<string, any> = {
  Quotation: FileText, Invoice: Receipt, SOW: ClipboardList, Agreement: HandshakeIcon, PRD: FolderKanban
}

const typeColors: Record<string, string> = {
  Quotation: 'text-blue-400 bg-blue-500/10', Invoice: 'text-gold bg-gold/10',
  SOW: 'text-purple-400 bg-purple-500/10', Agreement: 'text-emerald-400 bg-emerald-500/10', PRD: 'text-pink-400 bg-pink-500/10',
}

export default function VaultPage() {
  const [docs, setDocs] = useState(allDocs)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const { toast } = useToast()

  const filtered = docs.filter(d => {
    const matchSearch = d.client.toLowerCase().includes(search.toLowerCase()) || d.title.toLowerCase().includes(search.toLowerCase()) || d.docId.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || d.type === filterType
    const matchStatus = filterStatus === 'all' || d.status === filterStatus
    return matchSearch && matchType && matchStatus
  })

  const stats = { total: docs.length, quotations: docs.filter(d => d.type === 'Quotation').length, invoices: docs.filter(d => d.type === 'Invoice').length, agreements: docs.filter(d => d.type === 'Agreement' || d.type === 'SOW').length }

  const handleArchive = (id: string) => {
    setDocs(docs.map(d => d.id === id ? { ...d, status: 'archived' } : d))
    toast({ title: 'Document Archived', description: 'Moved to archive.' })
  }

  const handleUnarchive = (id: string) => {
    setDocs(docs.map(d => d.id === id ? { ...d, status: 'draft' } : d))
    toast({ title: 'Document Restored', description: 'Moved from archive to draft.' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Document Vault</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Centralized repository for all Netgain business documents.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ label: 'Total Documents', value: stats.total }, { label: 'Quotations', value: stats.quotations }, { label: 'Invoices', value: stats.invoices }, { label: 'Agreements', value: stats.agreements }].map(s => (
          <Card key={s.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold mt-1">{s.value}</p></CardContent></Card>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <Select value={filterType} onValueChange={setFilterType}><SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem>{['Quotation', 'Invoice', 'SOW', 'Agreement', 'PRD'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem>{['draft', 'sent', 'paid', 'approved', 'signed', 'archived'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(doc => {
          const Icon = typeIcon[doc.type] || FileText
          const colors = typeColors[doc.type] || 'text-muted-foreground bg-muted'
          return (
            <Card key={doc.id} className="group hover:shadow-md hover:border-gold/20 transition-all">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`rounded-lg p-2 shrink-0 ${colors}`}><Icon className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm leading-tight">{doc.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{doc.client}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">{doc.status}</Badge>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div>
                        <p className="text-xs font-mono text-gold/70">{doc.docId}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(doc.date)}</p>
                      </div>
                      <p className="font-semibold text-sm text-gold">{formatCurrency(doc.amount)}</p>
                    </div>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {doc.tags.map(t => <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">#{t}</span>)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 mt-3 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" onClick={() => toast({ title: 'Download Started', description: `${doc.docId}.pdf` })}><Download className="h-3 w-3" />Download</Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(doc.docId); toast({ title: 'Copied ID', description: doc.docId }) }}><Copy className="h-3 w-3" /></Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => doc.status === 'archived' ? handleUnarchive(doc.id) : handleArchive(doc.id)} title={doc.status === 'archived' ? 'Unarchive' : 'Archive'}>
                    {doc.status === 'archived' ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground"><FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No documents found</p></div>}
    </div>
  )
}
