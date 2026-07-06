'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useUser } from '@/components/user-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ArrowLeft, Search, Plus, Pencil, Trash2, Archive, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface BusinessType {
  id: string
  name: string
  status: string // 'active', 'archived'
  created_at: string
}

export default function BusinessTypesPage() {
  const { user } = useUser()
  const { toast } = useToast()
  const router = useRouter()
  const [types, setTypes] = useState<BusinessType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Dialog states
  const [showCreate, setShowCreate] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [editingType, setEditingType] = useState<BusinessType | null>(null)
  const [editTypeName, setEditTypeName] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const isPrivileged = user?.role === 'Founder' || user?.role === 'Admin'

  async function fetchBusinessTypes() {
    setLoading(true)
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('business_types')
          .select('*')
          .order('name', { ascending: true })
        if (error) throw error
        if (data) setTypes(data)
      } catch (err: any) {
        toast({ title: 'Error loading business types', description: err.message, variant: 'destructive' })
      }
    } else {
      // Offline mock data fallback
      setTypes([
        { id: '1', name: 'Restaurant', status: 'active', created_at: new Date().toISOString() },
        { id: '2', name: 'Hospital', status: 'active', created_at: new Date().toISOString() },
        { id: '3', name: 'School', status: 'active', created_at: new Date().toISOString() },
        { id: '4', name: 'College', status: 'active', created_at: new Date().toISOString() },
        { id: '5', name: 'Software Company', status: 'active', created_at: new Date().toISOString() },
      ])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!isPrivileged && user !== null) {
      toast({ title: 'Access Denied', description: 'Only Founders and Admins can manage business types.', variant: 'destructive' })
      router.push('/crm')
      return
    }
    fetchBusinessTypes()
  }, [user])

  const handleCreate = async () => {
    if (!newTypeName.trim()) return
    setSubmitting(true)
    const name = newTypeName.trim()

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('business_types')
          .insert([{ name, status: 'active' }])
          .select()
        if (error) {
          if (error.code === '23505') {
            toast({ title: 'Duplicate Name', description: 'A business type with this name already exists.', variant: 'destructive' })
          } else {
            toast({ title: 'Error creating business type', description: error.message, variant: 'destructive' })
          }
        } else {
          toast({ title: 'Business Type Created ✓' })
          setShowCreate(false)
          setNewTypeName('')
          await fetchBusinessTypes()
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
      }
    } else {
      const mockNew = { id: String(Date.now()), name, status: 'active', created_at: new Date().toISOString() }
      setTypes(prev => [...prev, mockNew].sort((a, b) => a.name.localeCompare(b.name)))
      setShowCreate(false)
      setNewTypeName('')
      toast({ title: 'Business Type Created (Mock) ✓' })
    }
    setSubmitting(false)
  }

  const handleEdit = async () => {
    if (!editingType || !editTypeName.trim()) return
    setSubmitting(true)
    const name = editTypeName.trim()

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('business_types')
          .update({ name })
          .eq('id', editingType.id)
        if (error) {
          if (error.code === '23505') {
            toast({ title: 'Duplicate Name', description: 'A business type with this name already exists.', variant: 'destructive' })
          } else {
            toast({ title: 'Error updating business type', description: error.message, variant: 'destructive' })
          }
        } else {
          toast({ title: 'Business Type Updated ✓' })
          setEditingType(null)
          setEditTypeName('')
          await fetchBusinessTypes()
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
      }
    } else {
      setTypes(prev => prev.map(t => t.id === editingType.id ? { ...t, name } : t).sort((a, b) => a.name.localeCompare(b.name)))
      setEditingType(null)
      setEditTypeName('')
      toast({ title: 'Business Type Updated (Mock) ✓' })
    }
    setSubmitting(false)
  }

  const handleToggleStatus = async (type: BusinessType) => {
    const newStatus = type.status === 'active' ? 'archived' : 'active'
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('business_types')
          .update({ status: newStatus })
          .eq('id', type.id)
        if (error) {
          toast({ title: 'Error changing status', description: error.message, variant: 'destructive' })
        } else {
          toast({ title: newStatus === 'active' ? 'Business Type Activated ✓' : 'Business Type Archived' })
          await fetchBusinessTypes()
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
      }
    } else {
      setTypes(prev => prev.map(t => t.id === type.id ? { ...t, status: newStatus } : t))
      toast({ title: `Business Type status updated to ${newStatus} (Mock)` })
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('business_types')
          .delete()
          .eq('id', deleteId)
        if (error) {
          toast({ title: 'Error deleting business type', description: error.message, variant: 'destructive' })
        } else {
          toast({ title: 'Business Type Deleted ✓' })
          setDeleteId(null)
          await fetchBusinessTypes()
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
      }
    } else {
      setTypes(prev => prev.filter(t => t.id !== deleteId))
      setDeleteId(null)
      toast({ title: 'Business Type Deleted (Mock) ✓' })
    }
  }

  const filtered = types.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/crm">
          <Button variant="ghost" size="icon" aria-label="Action" className="h-8 w-8 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Business Type Master</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">Manage centralized list of business types reusable across CRM clients and invoicing.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search business types..."
            className="pl-9 h-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button variant="gold" className="gold-gradient text-white border-0 gap-1.5 w-full sm:w-auto" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> New Business Type
        </Button>
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Active & Archived Categories</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-gold" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No business types found. Add a new one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-muted-foreground">
                <thead className="bg-[#091512] text-xs font-semibold uppercase text-gold border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(t => (
                    <tr key={t.id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-foreground">{t.name}</td>
                      <td className="py-3.5 px-4">
                        <Badge variant={t.status === 'active' ? 'default' : 'secondary'} className="capitalize text-[10px]">
                          {t.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-blue-400 hover:text-blue-300"
                            onClick={() => {
                              setEditingType(t)
                              setEditTypeName(t.name)
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 ${t.status === 'active' ? 'text-amber-500 hover:text-amber-400' : 'text-emerald-500 hover:text-emerald-400'}`}
                            title={t.status === 'active' ? 'Archive Type' : 'Restore Type'}
                            onClick={() => handleToggleStatus(t)}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-300"
                            onClick={() => setDeleteId(t.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Business Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Business Type Name *</Label>
              <Input
                placeholder="e.g. Software Company"
                value={newTypeName}
                onChange={e => setNewTypeName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={submitting}>Cancel</Button>
            <Button variant="gold" onClick={handleCreate} disabled={submitting || !newTypeName.trim()} className="gold-gradient text-white border-0">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingType} onOpenChange={v => !v && setEditingType(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Business Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Business Type Name *</Label>
              <Input
                placeholder="e.g. Real Estate"
                value={editTypeName}
                onChange={e => setEditTypeName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleEdit() }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingType(null)} disabled={submitting}>Cancel</Button>
            <Button variant="gold" onClick={handleEdit} disabled={submitting || !editTypeName.trim()} className="gold-gradient text-white border-0">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Business Type?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this business type? This may affect any client records currently utilizing it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/95">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
