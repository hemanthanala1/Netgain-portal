'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { DataTable } from '@/components/ui/data-table'
import { TableSkeleton } from '@/components/ui/skeletons'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Drawer } from '@/components/ui/drawer'
import { FormInput, FormTextarea, FormSelect, FormCheckbox } from '@/components/ui/form-inputs'
import { DeleteDialog } from '@/components/ui/dialog-variants'
import { EmptyState } from '@/components/ui/empty-state'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Search, Plus, Users, TrendingUp, Phone, Mail, Building2, MoreHorizontal, Eye, Edit, Trash2, Filter, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate, getInitials, getLeadStatusColor } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

const LEAD_STATUSES = ['new', 'contacted', 'proposal_sent', 'quotation_sent', 'negotiation', 'won', 'lost', 'active']

const statusLabels: Record<string, string> = {
  new: 'New', contacted: 'Contacted', proposal_sent: 'Proposal Sent',
  quotation_sent: 'Quotation Sent', negotiation: 'Negotiation',
  won: 'Won', lost: 'Lost', active: 'Active Client',
}

import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getCachedData, setCachedData, invalidateCache } from '@/lib/data-cache'
import { usePermissions } from '@/hooks/use-permissions'
import { PermissionDeniedState } from '@/components/ui/permission-denied'


function CRMPageContent() {
  const { hasPermission } = usePermissions()
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
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const autoOpen = searchParams.get('autoOpen')
    if (autoOpen === 'true') {
      setShowAdd(true)
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
  }, [searchParams])

  const columns = useMemo(() => [
    {
      header: 'Client',
      accessor: 'name',
      sortable: true,
      sticky: true,
      cell: (client: any) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="gold-gradient text-white text-xs font-bold">
              {getInitials(client.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-sm text-foreground">{client.name}</span>
              {portalAccounts.has(client.id) && (
                <Badge className="bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 text-[9px] px-1 py-0.25 font-bold font-mono">
                  Portal Active
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{client.city}</p>
          </div>
        </div>
      )
    },
    {
      header: 'Business',
      accessor: 'business',
      sortable: true,
      cell: (client: any) => (
        <div>
          <p className="text-sm font-medium text-foreground">{client.business}</p>
          <p className="text-xs text-muted-foreground">{client.type}</p>
        </div>
      )
    },
    {
      header: 'Contact',
      accessor: 'email',
      cell: (client: any) => (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p className="flex items-center gap-1"><Mail className="h-3 w-3 text-gold/80" />{client.email}</p>
          <p className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{client.phone}</p>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      cell: (client: any) => (
        <span className={`status-badge border ${getLeadStatusColor(client.status)}`}>
          {statusLabels[client.status]}
        </span>
      )
    },
    {
      header: 'Revenue',
      accessor: 'revenue',
      sortable: true,
      className: 'text-right',
      cell: (client: any) => (
        <span className="font-semibold text-sm text-gold">
          {client.revenue > 0 ? formatCurrency(client.revenue) : '—'}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: 'actions',
      className: 'text-right',
      cell: (client: any) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Link href={`/crm/${client.id}`}>
            <Button variant="ghost" size="icon" aria-label="View" className="h-7 w-7 hover:text-gold"><Eye className="h-3.5 w-3.5" /></Button>
          </Link>
          {hasPermission('crm', 'update') && (
            <Button variant="ghost" size="icon" aria-label="Edit" className="h-7 w-7 hover:text-gold" onClick={() => setEditClient(client)}><Edit className="h-3.5 w-3.5" /></Button>
          )}
          {hasPermission('crm', 'delete') && (
            <Button variant="ghost" size="icon" aria-label="Delete" className="h-7 w-7 text-red-400 hover:text-red-400" onClick={() => setDeleteClient({id: client.id, name: client.name})}><Trash2 className="h-3.5 w-3.5" /></Button>
          )}
        </div>
      )
    }
  ], [portalAccounts, hasPermission])

  useEffect(() => {
    const cached = getCachedData<any[]>('crm_clients')
    if (cached) {
      setClients(cached)
      setLoading(false)
    }

    async function fetchClients() {
      if (!isSupabaseConfigured()) {
        setClients([])
        setLoading(false)
        return
      }
      
      if (!cached) setLoading(true)

      try {
        const [clientsRes, invoicesRes] = await Promise.all([
          supabase.from('crm_clients').select('*').order('created_at', { ascending: false }),
          supabase.from('invoices').select('client, amount, status').in('status', ['paid', 'completed'])
        ])

        const { data, error } = clientsRes
        const { data: invoicesData } = invoicesRes

        if (error) {
          toast({ title: 'Error fetching clients', description: error.message, variant: 'destructive' })
        } else if (data) {
            const mapped = data.map((c: any) => {
              const clientInvoices = invoicesData?.filter(i => 
                i.client?.toLowerCase().trim() === c.name?.toLowerCase().trim() || 
                i.client?.toLowerCase().trim() === c.business?.toLowerCase().trim()
              ) || []
              const realRevenue = clientInvoices.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)

              return {
                id: c.id,
                name: c.name,
                business: c.business,
                type: c.type,
                email: c.email,
                phone: c.phone,
                status: c.status,
                revenue: realRevenue,
                lastContact: c.last_contact,
                city: c.city,
                gst: c.gst,
                address: c.address,
                website: c.website,
                pan: c.pan || ''
              }
            })
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
    setDeleteClient(null)
    toast({ title: 'Client Deleted', description: `${deleteClient.name} has been removed.` })
    setSubmitting(false)
  }


  const handleBulkAction = async (action: string, selectedRows: any[]) => {
    if (action === 'delete') {
      if (!window.confirm(`Are you sure you want to delete ${selectedRows.length} clients?`)) return
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const ids = selectedRows.map(r => r.id)
          const { error } = await supabase.from('crm_clients').delete().in('id', ids)
          if (error) {
            toast({ title: 'Error deleting clients', description: error.message, variant: 'destructive' })
            setLoading(false)
            return
          }
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
          setLoading(false)
          return
        }
      }
      const idsSet = new Set(selectedRows.map(r => r.id))
      const updatedList = clients.filter(c => !idsSet.has(c.id))
      setClients(updatedList)
      setCachedData('crm_clients', updatedList)
      invalidateCache('dashboard')
      toast({ title: 'Clients Deleted', description: `${selectedRows.length} clients have been removed.` })
      setLoading(false)
    } else if (action.startsWith('status_')) {
      const newStatus = action.replace('status_', '')
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const ids = selectedRows.map(r => r.id)
          const { error } = await supabase.from('crm_clients').update({ status: newStatus }).in('id', ids)
          if (error) {
            toast({ title: 'Error updating status', description: error.message, variant: 'destructive' })
            setLoading(false)
            return
          }
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
          setLoading(false)
          return
        }
      }
      const idsSet = new Set(selectedRows.map(r => r.id))
      const updatedList = clients.map(c => idsSet.has(c.id) ? { ...c, status: newStatus } : c)
      setClients(updatedList)
      setCachedData('crm_clients', updatedList)
      invalidateCache('dashboard')
      toast({ title: 'Status Updated', description: `${selectedRows.length} clients marked as ${statusLabels[newStatus] || newStatus}.` })
      setLoading(false)
    }
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

  if (!hasPermission('crm', 'read')) {
    return <PermissionDeniedState />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Relationship Manager"
        description="Manage leads, clients, and relationship pipeline."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'CRM' }
        ]}
        primaryAction={hasPermission('crm', 'create') ? {
          label: 'Add Client',
          onClick: () => setShowAdd(true),
          icon: Plus,
          variant: 'gold'
        } : undefined}
        secondaryActions={
          <Link href="/crm/business-types">
            <Button variant="outline" size="sm">
              Manage Business Types
            </Button>
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-4 gap-4">
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
      {/* Client List Table */}
      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients found"
          description="Get started by creating your first client in the CRM pipeline."
          action={{
            label: "Add Client",
            onClick: () => setShowAdd(true),
            icon: Plus
          }}
        />
      ) : (
        <DataTable
          data={clients}
          columns={columns}
          searchPlaceholder="Search clients by name, business, email, city..."
          searchKeys={['name', 'business', 'email', 'city']}
          exportFileName="crm_clients"
          onRowClick={row => router.push(`/crm/${row.id}`)}
          initialSearch={searchParams.get('search') || searchParams.get('client') || ''}
          savedFiltersKey="crm_clients"
          enableBulkSelect={true}
          bulkActions={[
            ...(hasPermission('crm', 'delete') ? [{ label: 'Delete Selected', action: 'delete', variant: 'destructive' as const, icon: Trash2 }] : []),
            ...(hasPermission('crm', 'update') ? [
              { label: 'Mark Won', action: 'status_won', icon: TrendingUp },
              { label: 'Mark Active', action: 'status_active', icon: TrendingUp }
            ] : [])
          ]}
          onBulkAction={handleBulkAction}
          filterDefs={[
            {
              key: 'status',
              label: 'Lead Status',
              options: LEAD_STATUSES.map(s => ({ label: statusLabels[s], value: s }))
            }
          ]}
        />
      )}

      {/* Add Client Drawer */}
      <Drawer
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add New Client"
        description="Enter the client profile details to add them to the CRM pipeline."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)} disabled={submitting}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleAdd} disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add Client
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormInput label="Client Name" required placeholder="John Doe" value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} />
          <FormInput label="Business Name" placeholder="Company LLC" value={newClient.business} onChange={e => setNewClient({ ...newClient, business: e.target.value })} />
          <FormInput label="Email" type="email" required placeholder="client@company.com" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} />
          <FormInput label="Phone" placeholder="+91 9876543210" value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })} />
          <FormInput label="City" placeholder="e.g. Mumbai" value={newClient.city} onChange={e => setNewClient({ ...newClient, city: e.target.value })} />
          <FormSelect label="Business Type" required value={newClient.type} onChange={e => setNewClient({ ...newClient, type: e.target.value })} options={businessTypes.map(t => ({ label: t, value: t }))} />
          <FormSelect label="Lead Status" value={newClient.status} onChange={e => setNewClient({ ...newClient, status: e.target.value })} options={LEAD_STATUSES.map(s => ({ label: statusLabels[s], value: s }))} />
          <FormInput label="GST Number" placeholder="Optional" value={newClient.gst} onChange={e => setNewClient({ ...newClient, gst: e.target.value })} />
          <FormInput label="Website" placeholder="https://example.com" value={newClient.website} onChange={e => setNewClient({ ...newClient, website: e.target.value })} />
          <FormTextarea label="Address" placeholder="Business address..." className="h-20" value={newClient.address} onChange={e => setNewClient({ ...newClient, address: e.target.value })} />
          
          <div className="border-t border-border pt-4 mt-2 space-y-3">
            <FormCheckbox
              label="Enable Client Portal Account"
              description="Allows the client to log in using their email address"
              checked={newClient.createAccount}
              onChange={e => setNewClient({ ...newClient, createAccount: e.target.checked })}
            />
            {newClient.createAccount && (
              <FormInput
                label="Portal Password"
                type="password"
                placeholder="Welcome123! (or custom)"
                value={newClient.clientPassword}
                onChange={e => setNewClient({ ...newClient, clientPassword: e.target.value })}
                helperText="Defaults to 'Welcome123!' if left blank"
              />
            )}
          </div>
        </div>
      </Drawer>

      {/* Edit Client Drawer */}
      <Drawer
        isOpen={!!editClient}
        onClose={() => setEditClient(null)}
        title="Edit Client"
        description="Modify client settings, status, and profile information."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditClient(null)} disabled={submitting}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleEditSubmit} disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </>
        }
      >
        {editClient && (
          <div className="space-y-4">
            <FormInput label="Client Name" required placeholder="John Doe" value={editClient.name} onChange={e => setEditClient({ ...editClient, name: e.target.value })} />
            <FormInput label="Business Name" placeholder="Company LLC" value={editClient.business} onChange={e => setEditClient({ ...editClient, business: e.target.value })} />
            <FormInput label="Email" type="email" required placeholder="client@company.com" value={editClient.email} onChange={e => setEditClient({ ...editClient, email: e.target.value })} />
            <FormInput label="Phone" placeholder="+91 9876543210" value={editClient.phone} onChange={e => setEditClient({ ...editClient, phone: e.target.value })} />
            <FormInput label="City" placeholder="e.g. Mumbai" value={editClient.city} onChange={e => setEditClient({ ...editClient, city: e.target.value })} />
            <FormSelect label="Business Type" required value={editClient.type} onChange={e => setEditClient({ ...editClient, type: e.target.value })} options={businessTypes.map(t => ({ label: t, value: t }))} />
            <FormSelect label="Lead Status" value={editClient.status} onChange={e => setEditClient({ ...editClient, status: e.target.value })} options={LEAD_STATUSES.map(s => ({ label: statusLabels[s], value: s }))} />
            <FormInput label="GST Number" placeholder="Optional" value={editClient.gst || ''} onChange={e => setEditClient({ ...editClient, gst: e.target.value })} />
            <FormInput label="Website" placeholder="https://example.com" value={editClient.website || ''} onChange={e => setEditClient({ ...editClient, website: e.target.value })} />
            <FormTextarea label="Address" placeholder="Business address..." className="h-20" value={editClient.address || ''} onChange={e => setEditClient({ ...editClient, address: e.target.value })} />
          </div>
        )}
      </Drawer>

      {/* Delete Confirmation */}
      <DeleteDialog
        isOpen={!!deleteClient}
        onClose={() => setDeleteClient(null)}
        title="Delete Client"
        description={`This action cannot be undone. This will permanently delete ${deleteClient?.name} and remove their records.`}
        confirmLabel="Delete Client"
        onConfirm={handleDelete}
        loading={submitting}
      />
    </div>
  )
}

export default function CRMPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} cols={5} />}>
      <CRMPageContent />
    </Suspense>
  )
}
