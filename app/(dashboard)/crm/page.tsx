'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Search, Plus, Users, TrendingUp, Phone, Mail, Building2, MoreHorizontal, Eye, Edit, Trash2, Filter, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate, getInitials, getLeadStatusColor } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

const LEAD_STATUSES = ['new', 'contacted', 'proposal_sent', 'quotation_sent', 'negotiation', 'won', 'lost', 'active']

const mockClients: any[] = []

const statusLabels: Record<string, string> = {
  new: 'New', contacted: 'Contacted', proposal_sent: 'Proposal Sent',
  quotation_sent: 'Quotation Sent', negotiation: 'Negotiation',
  won: 'Won', lost: 'Lost', active: 'Active Client',
}

import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useEffect } from 'react'
import { getCachedData, setCachedData, invalidateCache } from '@/lib/data-cache'


export default function CRMPage() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editClient, setEditClient] = useState<any | null>(null)
  const [deleteClient, setDeleteClient] = useState<{id: string, name: string} | null>(null)
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const { toast } = useToast()

  const [businessTypes, setBusinessTypes] = useState<string[]>([
    'Restaurant', 'Hospital', 'School', 'College', 'Software Company',
    'Construction', 'Real Estate', 'Manufacturing', 'Retail', 'Ecommerce',
    'Healthcare', 'Education', 'Other'
  ])
  const [portalAccounts, setPortalAccounts] = useState<Set<string>>(new Set())

  const [newClient, setNewClient] = useState({
    name: '', business: '', type: 'Ecommerce', email: '', phone: '',
    status: 'new', gst: '', address: '', website: '', city: '',
    createAccount: false, clientPassword: '',
    pan: ''
  })

  useEffect(() => {
    const cached = getCachedData<any[]>('crm_clients')
    if (cached) {
      setClients(cached)
      setLoading(false)
    }

    async function fetchClients() {
      if (!cached) setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase.from('crm_clients').select('*').order('created_at', { ascending: false })
          if (error) {
            toast({ title: 'Error fetching clients', description: error.message, variant: 'destructive' })
          } else if (data) {
            const mapped = data.map((c: any) => ({
              id: c.id,
              name: c.name,
              business: c.business,
              type: c.type,
              email: c.email,
              phone: c.phone,
              status: c.status,
              revenue: Number(c.revenue) || 0,
              lastContact: c.last_contact,
              city: c.city,
              gst: c.gst,
              address: c.address,
              website: c.website,
              pan: c.pan || ''
            }))
            setClients(mapped)
            setCachedData('crm_clients', mapped)
          }

          // Fetch Client Portal Accounts
          const { data: accounts } = await supabase.from('client_accounts').select('client_id')
          if (accounts) {
            setPortalAccounts(new Set(accounts.map((a: any) => a.client_id)))
          }

          // Fetch Business Types
          const { data: bData } = await supabase.from('business_types').select('name').eq('status', 'active').order('name', { ascending: true })
          if (bData && bData.length > 0) {
            setBusinessTypes(bData.map((b: any) => b.name))
          }
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        }
      } else {
        setClients(mockClients)
        setCachedData('crm_clients', mockClients)
      }
      setLoading(false)
    }
    fetchClients()
  }, [])

  const handleAdd = async () => {
    if (!newClient.name || !newClient.email) return
    setSubmitting(true)
    const id = String(Date.now())
    const lastContactDate = new Date().toISOString().slice(0, 10)
    const clientData = {
      id,
      name: newClient.name,
      business: newClient.business,
      type: newClient.type,
      email: newClient.email,
      phone: newClient.phone,
      status: newClient.status,
      revenue: 0,
      last_contact: lastContactDate,
      city: newClient.city,
      gst: newClient.gst,
      address: newClient.address,
      website: newClient.website,
      pan: newClient.pan
    }

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('crm_clients').insert([clientData])
        if (error) {
          toast({ title: 'Error adding client', description: error.message, variant: 'destructive' })
          setSubmitting(false)
          return
        }

        // Add client account if option is checked
        if (newClient.createAccount) {
          const accountData = {
            id,
            client_id: id,
            email: newClient.email,
            password: newClient.clientPassword || 'Welcome123!',
            status: 'active'
          }
          const { error: accError } = await supabase.from('client_accounts').insert([accountData])
          if (accError) {
            toast({ title: 'Warning', description: `Client added, but portal account creation failed: ${accError.message}`, variant: 'destructive' })
          } else {
            toast({ title: 'Portal Account Created', description: `Account password set to "${accountData.password}"` })
            setPortalAccounts(prev => new Set([...Array.from(prev), id]))
          }
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        setSubmitting(false)
        return
      }
    }

    const localClient = {
      ...newClient,
      id,
      revenue: 0,
      lastContact: lastContactDate
    }
    const updatedList = [localClient, ...clients]
    setClients(updatedList)
    setCachedData('crm_clients', updatedList)
    invalidateCache('dashboard')
    setShowAdd(false)
    setNewClient({ name: '', business: '', type: 'Ecommerce', email: '', phone: '', status: 'new', gst: '', address: '', website: '', city: '', createAccount: false, clientPassword: '', pan: '' })
    toast({ title: 'Client Added', description: `${newClient.name} has been added successfully.` })
    setSubmitting(false)
  }


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
          website: editClient.website,
          pan: editClient.pan
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

    const updatedList = clients.map(c => c.id === editClient.id ? { ...c, ...editClient } : c)
    setClients(updatedList)
    setCachedData('crm_clients', updatedList)
    invalidateCache('dashboard')
    setEditClient(null)
    toast({ title: 'Client Updated', description: `${editClient.name} has been updated successfully.` })
    setSubmitting(false)
  }


  const handleDelete = async () => {
    if (!deleteClient) return
    setSubmitting(true)

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('crm_clients').delete().eq('id', deleteClient.id)
        if (error) {
          toast({ title: 'Error deleting client', description: error.message, variant: 'destructive' })
          setSubmitting(false)
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        setSubmitting(false)
        return
      }
    }

    const updatedList = clients.filter(c => c.id !== deleteClient.id)
    setClients(updatedList)
    setCachedData('crm_clients', updatedList)
    invalidateCache('dashboard')
    toast({ title: 'Client Removed', description: `${deleteClient.name} has been removed from the CRM.` })
    setDeleteClient(null)
    setSubmitting(false)
  }


  const filtered = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                          (c.business && c.business.toLowerCase().includes(search.toLowerCase())) ||
                          (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: clients.length,
    active: clients.filter(c => c.status === 'active').length,
    won: clients.filter(c => c.status === 'won').length,
    totalRevenue: clients.reduce((s, c) => s + (Number(c.revenue) || 0), 0),
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Client Relationship Manager</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage leads, clients, and relationship pipeline.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link href="/crm/business-types">
            <Button variant="outline" size="sm" className="gap-1.5">
              Manage Business Types
            </Button>
          </Link>
          <Button variant="gold" size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Client
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Clients', value: stats.total, icon: Users, color: 'text-blue-400' },
          { label: 'Active Clients', value: stats.active, icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Deals Won', value: stats.won, icon: TrendingUp, color: 'text-gold' },
          { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: 'text-purple-400' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters & Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Client Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Business</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Contact</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Revenue</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <tr key={client.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="gold-gradient text-white text-xs font-bold">
                          {getInitials(client.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm">{client.name}</p>
                          {portalAccounts.has(client.id) && (
                            <Badge className="bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 text-[9px] px-1 py-0.25 font-bold font-mono">
                              Portal Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{client.city}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <p className="text-sm">{client.business}</p>
                    <p className="text-xs text-muted-foreground">{client.type}</p>
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    <div className="space-y-0.5">
                      <p className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" />{client.email}</p>
                      <p className="text-xs flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{client.phone}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`status-badge border ${getLeadStatusColor(client.status)}`}>
                      {statusLabels[client.status]}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right hidden sm:table-cell">
                    <span className="font-semibold text-sm">{client.revenue > 0 ? formatCurrency(client.revenue) : '—'}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/crm/${client.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditClient(client)}><Edit className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-400" onClick={() => setDeleteClient({id: client.id, name: client.name})}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No clients found</p>
            </div>
          )}
        </div>
      </Card>

      {/* Add Client Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1"><Label>Client Name *</Label><Input placeholder="John Doe" value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Business Name</Label><Input placeholder="Company LLC" value={newClient.business} onChange={e => setNewClient({ ...newClient, business: e.target.value })} /></div>
            <div className="space-y-1"><Label>Email *</Label><Input type="email" placeholder="client@company.com" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} /></div>
            <div className="space-y-1"><Label>Phone</Label><Input placeholder="+91 9876543210" value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })} /></div>
            <div className="space-y-1"><Label>City</Label><Input placeholder="e.g. Mumbai" value={newClient.city} onChange={e => setNewClient({ ...newClient, city: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Business Type *</Label>
              <Select value={newClient.type} onValueChange={v => setNewClient({ ...newClient, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {businessTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Lead Status</Label>
              <Select value={newClient.status} onValueChange={v => setNewClient({...newClient, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>GST Number</Label><Input placeholder="Optional" value={newClient.gst} onChange={e => setNewClient({...newClient, gst: e.target.value})} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Website</Label><Input placeholder="https://example.com" value={newClient.website} onChange={e => setNewClient({...newClient, website: e.target.value})} /></div>
            <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Address</Label><Textarea placeholder="Business address..." className="resize-none h-16" value={newClient.address} onChange={e => setNewClient({...newClient, address: e.target.value})} /></div>
            
            <div className="col-span-1 sm:col-span-2 border-t border-[#1E3A2F]/20 pt-4 mt-2 space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="createAccount"
                  checked={newClient.createAccount}
                  onCheckedChange={(checked) => setNewClient({ ...newClient, createAccount: !!checked })}
                />
                <Label htmlFor="createAccount" className="cursor-pointer text-xs font-bold text-slate-300">
                  Enable Client Portal Account (Login using email)
                </Label>
              </div>
              
              {newClient.createAccount && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400">Portal Password</Label>
                    <Input
                      type="password"
                      placeholder="Welcome123! (or custom)"
                      value={newClient.clientPassword}
                      onChange={e => setNewClient({ ...newClient, clientPassword: e.target.value })}
                    />
                    <p className="text-[10px] text-slate-500 font-sans">Defaults to "Welcome123!" if blank</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} disabled={submitting}>Cancel</Button>
            <Button variant="gold" onClick={handleAdd} disabled={submitting} className="gap-2">
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Adding...</>
              ) : (
                'Add Client'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={!!editClient} onOpenChange={(open) => !open && setEditClient(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          {editClient && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              <div className="space-y-1"><Label>Client Name *</Label><Input placeholder="John Doe" value={editClient.name} onChange={e => setEditClient({ ...editClient, name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Business Name</Label><Input placeholder="Company LLC" value={editClient.business} onChange={e => setEditClient({ ...editClient, business: e.target.value })} /></div>
              <div className="space-y-1"><Label>Email *</Label><Input type="email" placeholder="client@company.com" value={editClient.email} onChange={e => setEditClient({ ...editClient, email: e.target.value })} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input placeholder="+91 9876543210" value={editClient.phone} onChange={e => setEditClient({ ...editClient, phone: e.target.value })} /></div>
              <div className="space-y-1"><Label>City</Label><Input placeholder="e.g. Mumbai" value={editClient.city} onChange={e => setEditClient({ ...editClient, city: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>Business Type *</Label>
                <Select value={editClient.type} onValueChange={v => setEditClient({ ...editClient, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {businessTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
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
              <div className="space-y-1 sm:col-span-2"><Label>Website</Label><Input placeholder="https://example.com" value={editClient.website || ''} onChange={e => setEditClient({...editClient, website: e.target.value})} /></div>
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
 
      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteClient} onOpenChange={(open) => !open && setDeleteClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete <strong>{deleteClient?.name}</strong> and remove their data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>Delete Client</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
