'use client'
import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ArrowLeft, Mail, Phone, Building2, Globe, MapPin, Calendar, FileText, Receipt, MessageSquare, ClipboardList, Edit, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { getInitials, formatDate, formatCurrency, getLeadStatusColor } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { invalidateCache } from '@/lib/data-cache'

const LEAD_STATUSES = ['new', 'contacted', 'proposal_sent', 'quotation_sent', 'negotiation', 'won', 'lost', 'active']
const statusLabels: Record<string, string> = {
  new: 'New', contacted: 'Contacted', proposal_sent: 'Proposal Sent',
  quotation_sent: 'Quotation Sent', negotiation: 'Negotiation',
  won: 'Won', lost: 'Lost', active: 'Active Client',
}

const mockClient = { id: '1', name: 'Aaron Shah', business: 'Urban Edge Co.', type: 'E-Commerce', email: 'aaron@urbanedge.in', phone: '9876543210', gst: '29AABCU9603R1ZM', website: 'urbanedge.in', address: 'Andheri East, Mumbai — 400069', city: 'Mumbai', status: 'quotation_sent', revenue: 47998, joined: '2024-05-15' }

const timeline = [
  { event: 'Quotation NG-QUO-2024-1123 sent via email', date: '2024-06-04', type: 'quotation' },
  { event: 'Introductory call — 30 min. Interested in E-Commerce + SEO bundle.', date: '2024-06-01', type: 'call' },
  { event: 'Client added to CRM', date: '2024-05-15', type: 'new' },
]

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editClient, setEditClient] = useState<any | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    async function fetchClient() {
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase.from('crm_clients').select('*').eq('id', params.id).single()
          if (error) {
            toast({ title: 'Error loading client details', description: error.message, variant: 'destructive' })
          } else if (data) {
            setClient({
              id: data.id,
              name: data.name,
              business: data.business,
              type: data.type,
              email: data.email,
              phone: data.phone,
              gst: data.gst,
              website: data.website,
              address: data.address,
              city: data.city,
              status: data.status,
              revenue: Number(data.revenue) || 0,
              joined: data.created_at ? new Date(data.created_at).toISOString().slice(0, 10) : '2024-05-15'
            })
          }
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        }
      } else {
        setClient(mockClient)
      }
      setLoading(false)
    }
    fetchClient()
  }, [params.id])

  const handleEditSubmit = async () => {
    if (!editClient || !editClient.name || !editClient.email) return
    setSubmitting(true)

    if (isSupabaseConfigured()) {
      try {
        const dbData = {
          name: editClient.name,
          business: editClient.business,
          type: editClient.type,
          email: editClient.email,
          phone: editClient.phone,
          status: editClient.status,
          revenue: editClient.revenue,
          last_contact: editClient.lastContact || new Date().toISOString().slice(0, 10),
          city: editClient.city,
          gst: editClient.gst,
          address: editClient.address,
          website: editClient.website
        }
        const { error } = await supabase.from('crm_clients').update(dbData).eq('id', editClient.id)
        if (error) {
          toast({ title: 'Error updating client', description: error.message, variant: 'destructive' })
          setSubmitting(false)
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        setSubmitting(false)
        return
      }
    }

    setClient(editClient)
    invalidateCache('crm_clients')
    invalidateCache('dashboard')
    setEditClient(null)
    toast({ title: 'Client Updated', description: `${editClient.name} has been updated successfully.` })
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-6 w-6 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Client not found.</p>
        <Link href="/crm" className="mt-4 inline-block"><Button variant="outline">Back to CRM</Button></Link>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/crm"><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{client.business}</h1>
              <span className={`status-badge border text-[10px] sm:text-xs shrink-0 ${getLeadStatusColor(client.status)}`}>{client.status.replace('_', ' ')}</span>
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Rep: {client.name} · {client.city}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 self-start sm:self-auto" onClick={() => setEditClient({ ...client })}><Edit className="h-3.5 w-3.5" />Edit</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-col items-center text-center mb-4">
                <Avatar className="h-16 w-16 mb-3">
                  <AvatarFallback className="gold-gradient text-white text-xl font-bold">{getInitials(client.name)}</AvatarFallback>
                </Avatar>
                <h2 className="font-semibold">{client.name}</h2>
                <p className="text-sm text-muted-foreground">{client.type}</p>
              </div>
              <div className="space-y-2.5 text-sm">
                {[{ icon: Mail, val: client.email }, { icon: Phone, val: client.phone }, { icon: Globe, val: client.website }, { icon: MapPin, val: client.address }, { icon: Building2, val: client.gst ? `GST: ${client.gst}` : 'GST not provided' }].map(({ icon: Icon, val }) => (
                  <div key={val} className="flex items-start gap-2 text-muted-foreground">
                    <Icon className="h-4 w-4 mt-0.5 shrink-0 text-gold" />
                    <span className="text-xs leading-relaxed">{val}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold mb-3">Quick Stats</h3>
              <div className="space-y-3">
                {[{ label: 'Total Revenue', val: formatCurrency(client.revenue), color: 'text-gold' }, { label: 'Client Since', val: formatDate(client.joined), color: '' }, { label: 'Documents', val: '3 (1 Quotation, 1 SOW, 1 Agreement)', color: '' }].map(s => (
                  <div key={s.label}><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-sm font-semibold mt-0.5 ${s.color}`}>{s.val}</p></div>
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Link href="/documents/quotations" className="flex-1"><Button variant="outline" size="sm" className="w-full gap-1.5"><FileText className="h-3.5 w-3.5" />New Quote</Button></Link>
            <Link href="/documents/invoices" className="flex-1"><Button variant="outline" size="sm" className="w-full gap-1.5"><Receipt className="h-3.5 w-3.5" />New Invoice</Button></Link>
          </div>
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="timeline">
            <TabsList><TabsTrigger value="timeline">Timeline</TabsTrigger><TabsTrigger value="documents">Documents</TabsTrigger><TabsTrigger value="notes">Notes</TabsTrigger></TabsList>
            <TabsContent value="timeline" className="space-y-3 mt-4">
              {timeline.map((t, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-gold mt-1.5 shrink-0" />
                    {i < timeline.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                  </div>
                  <div className="pb-4 flex-1">
                    <p className="text-sm">{t.event}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(t.date)}</p>
                  </div>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="documents" className="mt-4">
              <Card><CardContent className="p-4 text-sm text-muted-foreground text-center py-8">No documents yet. Generate a quotation or invoice to see them here.</CardContent></Card>
            </TabsContent>
            <TabsContent value="notes" className="mt-4">
              <Card><CardContent className="p-4 text-sm text-muted-foreground text-center py-8">No notes yet. Add notes after client meetings or calls.</CardContent></Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Client Dialog */}
      <Dialog open={!!editClient} onOpenChange={(open) => !open && setEditClient(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client Details</DialogTitle>
          </DialogHeader>
          {editClient && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              <div className="space-y-1"><Label>Client Name *</Label><Input placeholder="John Doe" value={editClient.name} onChange={e => setEditClient({ ...editClient, name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Business Name</Label><Input placeholder="Company LLC" value={editClient.business} onChange={e => setEditClient({ ...editClient, business: e.target.value })} /></div>
              <div className="space-y-1"><Label>Email *</Label><Input type="email" placeholder="client@company.com" value={editClient.email} onChange={e => setEditClient({ ...editClient, email: e.target.value })} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input placeholder="+91 9876543210" value={editClient.phone} onChange={e => setEditClient({ ...editClient, phone: e.target.value })} /></div>
              <div className="space-y-1"><Label>City</Label><Input placeholder="e.g. Mumbai" value={editClient.city} onChange={e => setEditClient({ ...editClient, city: e.target.value })} /></div>
              <div className="space-y-1"><Label>Industry Type</Label>
                <Select value={editClient.type} onValueChange={v => setEditClient({ ...editClient, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['E-Commerce', 'B2B SaaS', 'Retail Chain', 'Healthcare', 'Agriculture', 'Manufacturing', 'Education'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Lead Status</Label>
                <Select value={editClient.status} onValueChange={v => setEditClient({...editClient, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>GST Number</Label><Input placeholder="Optional" value={editClient.gst || ''} onChange={e => setEditClient({...editClient, gst: e.target.value})} /></div>
              <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Address</Label><Textarea placeholder="Business address..." className="resize-none h-16" value={editClient.address || ''} onChange={e => setEditClient({...editClient, address: e.target.value})} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClient(null)} disabled={submitting}>Cancel</Button>
            <Button variant="gold" onClick={handleEditSubmit} disabled={submitting} className="gap-2">
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
