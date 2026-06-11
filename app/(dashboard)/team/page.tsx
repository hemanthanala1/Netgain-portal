'use client'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Plus, UserCog, Mail, Phone, Shield, MoreHorizontal, Edit, Trash2, Activity, Loader2 } from 'lucide-react'
import { getInitials, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const ROLES = [
  'Founder','Co-Founder','CEO','CTO','COO','CFO',
  'Project Manager','Team Lead',
  'Senior Developer','Developer','Frontend Developer','Backend Developer','Full Stack Developer',
  'UI/UX Designer','Graphic Designer',
  'Digital Marketer','SEO Specialist','Content Writer',
  'Sales Executive','Business Development Manager','Account Manager',
  'HR Manager','Admin','Operations Manager','Finance Manager',
  'Customer Support','Intern','Employee',
]

const initialRoles = [
  { id: 'role-founder', name: 'Founder', isSystem: true, permissions: ['all'] },
  { id: 'role-admin', name: 'Admin', isSystem: true, permissions: ['crm', 'projects', 'documents', 'team', 'finance', 'marketing'] },
  { id: 'role-pm', name: 'Project Manager', isSystem: true, permissions: ['crm', 'projects', 'documents'] },
  { id: 'role-sales', name: 'Sales Executive', isSystem: true, permissions: ['crm', 'marketing'] },
  { id: 'role-employee', name: 'Employee', isSystem: true, permissions: ['projects'] },
]

const MODULES = ['crm', 'projects', 'documents', 'marketing', 'team', 'finance', 'settings']

const roleColors: Record<string, string> = {
  Founder: 'bg-gold/10 text-gold border-gold/20',
  Admin: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Sales Executive': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Project Manager': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Employee: 'bg-muted text-muted-foreground border-border',
}

const mockTeam: any[] = []

const recentActivity: any[] = []

import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useEffect } from 'react'

interface Role {
  id: string
  name: string
  isSystem: boolean
  permissions: string[]
}

export default function TeamPage() {
  const [team, setTeam] = useState<any[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showRoleCreate, setShowRoleCreate] = useState(false)
  const [roleForm, setRoleForm] = useState({ name: '', permissions: [] as string[] })
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteMember, setDeleteMember] = useState<{id: string, name: string} | null>(null)
  const [editRoleId, setEditRoleId] = useState<string | null>(null)
  const [deleteRole, setDeleteRole] = useState<Role | null>(null)
  const { toast } = useToast()
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'Employee', password: '' })

  useEffect(() => {
    async function loadTeamData() {
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const { data: dbRoles, error: rolesErr } = await supabase.from('custom_roles').select('*').order('created_at', { ascending: true })
          if (rolesErr) {
            toast({ title: 'Error loading custom roles', description: rolesErr.message, variant: 'destructive' })
          } else if (dbRoles) {
            setRoles(dbRoles.map((r: any) => ({
              id: r.id,
              name: r.name,
              isSystem: r.is_system,
              permissions: r.permissions || []
            })))
          }

          // Fetch from profiles table (auth-linked users)
          const { data: profilesData, error: profilesErr } = await supabase.from('profiles').select('*').order('updated_at', { ascending: false })
          
          // Fetch from team_members table (backward compatibility)
          const { data: dbTeam, error: teamErr } = await supabase.from('team_members').select('*').order('created_at', { ascending: true })
          
          if (profilesErr) {
            console.error('Error loading profiles:', profilesErr)
          }
          if (teamErr) {
            toast({ title: 'Error loading team members', description: teamErr.message, variant: 'destructive' })
          }

          // Merge profiles and team_members, preferring profiles (auth-linked)
          const mergedTeam: any[] = []
          const seenIds = new Set()

          // Add profiles first (auth-linked users)
          if (profilesData) {
            profilesData.forEach((profile: any) => {
              seenIds.add(profile.id)
              const matchingMember = dbTeam ? dbTeam.find((m: any) => m.id === profile.id || m.email === profile.email) : null
              mergedTeam.push({
                id: profile.id,
                name: profile.full_name || profile.email?.split('@')[0] || 'Unknown',
                email: profile.email,
                phone: matchingMember?.phone || profile.settings?.phone || '',
                role: profile.role || 'Employee',
                status: matchingMember?.status || 'active',
                joined: matchingMember?.joined || profile.updated_at?.split('T')[0] || new Date().toISOString().slice(0, 10),
                projects: matchingMember?.projects || 0,
                source: 'profiles',
                avatar_url: profile.settings?.avatar_url || ''
              })
            })
          }

          // Add team_members not already in profiles
          if (dbTeam) {
            dbTeam.forEach((member: any) => {
              if (!seenIds.has(member.id)) {
                mergedTeam.push(member)
              }
            })
          }

          setTeam(mergedTeam)
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        }
      } else {
        setTeam(mockTeam)
        setRoles(initialRoles)
      }
      setLoading(false)
    }
    loadTeamData()
  }, [])

  const handleAddOrEdit = async () => {
    if (!form.name || !form.email) { toast({ title: 'Fill required fields', variant: 'destructive' }); return }
    setSubmitting(true)
    
    if (editId) {
      if (isSupabaseConfigured()) {
        try {
          const member = team.find(t => t.id === editId)
          if (member?.source === 'profiles') {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('settings')
              .eq('id', editId)
              .maybeSingle()

            const currentSettings = profileData?.settings || {}

            const { error: profileErr } = await supabase
              .from('profiles')
              .update({
                full_name: form.name,
                email: form.email,
                role: form.role,
                settings: {
                  ...currentSettings,
                  phone: form.phone
                },
                updated_at: new Date().toISOString()
              })
              .eq('id', editId)

            if (profileErr) {
              toast({ title: 'Error updating profile', description: profileErr.message, variant: 'destructive' })
              setSubmitting(false)
              return
            }

            // Sync with company_settings if the edited user is a Founder
            if (form.role === 'Founder' || member?.role === 'Founder') {
              const { data: settingsData } = await supabase
                .from('company_settings')
                .select('founder')
                .eq('user_id', editId)
                .maybeSingle()

              const currentFounderSettings = settingsData?.founder || {}

              await supabase
                .from('company_settings')
                .upsert({
                  user_id: editId,
                  founder: {
                    ...currentFounderSettings,
                    name: form.name,
                    email: form.email,
                    phone: form.phone
                  }
                }, { onConflict: 'user_id' })
            }
          }

          const { error } = await supabase.from('team_members').update({
            name: form.name,
            email: form.email,
            phone: form.phone,
            role: form.role
          }).eq('id', editId)
          if (error) {
            toast({ title: 'Error updating member', description: error.message, variant: 'destructive' })
            setSubmitting(false)
            return
          }
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
          setSubmitting(false)
          return
        }
      }
      setTeam(team.map(t => t.id === editId ? { ...t, name: form.name, email: form.email, phone: form.phone, role: form.role } : t))
      toast({ title: 'Employee Updated!', description: `${form.name}'s details have been updated.` })
    } else {
      if (isSupabaseConfigured()) {
        try {
          const res = await fetch('/api/team/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.name,
              email: form.email,
              phone: form.phone,
              role: form.role,
              password: form.password
            })
          })
          const data = await res.json()
          if (!res.ok) {
            toast({ title: 'Error adding member', description: data.error || 'Failed to create account', variant: 'destructive' })
            setSubmitting(false)
            return
          }
          setTeam([...team, data.member])
        } catch (err: any) {
          toast({ title: 'Auth Service Error', description: err.message || 'Server error', variant: 'destructive' })
          setSubmitting(false)
          return
        }
      } else {
        const newId = String(Date.now())
        const newMember = {
          id: newId,
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          status: 'active',
          joined: new Date().toISOString().slice(0, 10),
          projects: 0
        }
        setTeam([...team, newMember])
      }
      toast({ title: 'Employee Created!', description: `${form.name} can now login with their credentials.` })
    }
    
    setShowAdd(false)
    setEditId(null)
    setForm({ name: '', email: '', phone: '', role: 'Employee', password: '' })
    setSubmitting(false)
  }

  const handleDelete = async () => {
    if (!deleteMember) return
    setSubmitting(true)
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('team_members').delete().eq('id', deleteMember.id)
        if (error) {
          toast({ title: 'Error deleting member', description: error.message, variant: 'destructive' })
          setSubmitting(false)
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        setSubmitting(false)
        return
      }
    }
    setTeam(team.filter(t => t.id !== deleteMember.id))
    toast({ title: 'Employee Removed', description: `${deleteMember.name} has been removed from the team.` })
    setDeleteMember(null)
    setSubmitting(false)
  }

  const handleDeleteRole = async () => {
    if (!deleteRole) return
    setSubmitting(true)
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('custom_roles').delete().eq('id', deleteRole.id)
        if (error) {
          toast({ title: 'Error deleting role', description: error.message, variant: 'destructive' })
          setSubmitting(false)
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        setSubmitting(false)
        return
      }
    }
    setRoles(roles.filter(r => r.id !== deleteRole.id))
    toast({ title: 'Role Deleted', description: `${deleteRole.name} has been removed.` })
    setDeleteRole(null)
    setSubmitting(false)
  }

  const openEdit = (member: any) => {
    setEditId(member.id)
    setForm({ name: member.name, email: member.email, phone: member.phone || '', role: member.role, password: '' })
    setShowAdd(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight">Team Management</h1><p className="text-muted-foreground text-sm mt-0.5">Manage your team members, roles, and access levels.</p></div>
        <Button variant="gold" size="sm" onClick={() => { setEditId(null); setForm({ name: '', email: '', phone: '', role: 'Employee', password: '' }); setShowAdd(true) }} className="gap-1.5 w-full sm:w-auto"><Plus className="h-4 w-4" />Add Employee</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ label: 'Total Team', value: team.length }, { label: 'Active', value: team.filter(t => t.status === 'active').length }, { label: 'Managers', value: team.filter(t => ['Founder', 'Admin', 'Project Manager'].includes(t.role)).length }, { label: 'Staff', value: team.filter(t => ['Sales Executive', 'Employee'].includes(t.role)).length }].map(s => (
          <Card key={s.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold mt-1">{s.value}</p></CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="team">
        <TabsList className="mb-4">
          <TabsTrigger value="team">Employees</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>
        <TabsContent value="team">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {team.map(member => (
            <Card key={member.id} className="hover:shadow-md hover:border-gold/20 transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10">
                    {member.avatar_url && <AvatarImage src={member.avatar_url} />}
                    <AvatarFallback className="gold-gradient text-white text-sm font-bold">{getInitials(member.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{member.name}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${roleColors[member.role] || 'bg-muted text-muted-foreground border-border'}`}>{member.role}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" />{member.email}</span>
                      {member.phone && (
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{member.phone}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Joined {formatDate(member.joined)} · {member.projects} active projects</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(member)}><Edit className="h-3.5 w-3.5" /></Button>
                    {member.role !== 'Founder' && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteMember({id: member.id, name: member.name})}><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4"><Activity className="h-4 w-4 text-gold" /><h3 className="font-semibold text-sm">Recent Activity</h3></div>
              <div className="space-y-3">
                {recentActivity.map((a, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="h-6 w-6 rounded-full gold-gradient flex items-center justify-center shrink-0"><span className="text-[10px] font-bold text-white">{getInitials(a.user)}</span></div>
                    <div><p className="text-xs"><span className="font-medium">{a.user}</span> {a.action}</p><p className="text-[10px] text-muted-foreground">{a.time}</p></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
          </div>
        </TabsContent>
        <TabsContent value="roles" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="gold" size="sm" onClick={() => setShowRoleCreate(true)} className="gap-1.5"><Plus className="h-4 w-4" />Create Custom Role</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map(r => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold">{r.name}</h3>
                      {r.isSystem && <Badge variant="secondary" className="text-[10px] mt-1">System Role</Badge>}
                    </div>
                    {!r.isSystem && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditRoleId(r.id); setRoleForm({ name: r.name, permissions: r.permissions }); setShowRoleCreate(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteRole(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Access Levels</p>
                    <div className="flex flex-wrap gap-1">
                      {r.permissions.includes('all') ? <Badge variant="info" className="text-[10px]">Full Access</Badge> : r.permissions.map((p: string) => <Badge key={p} variant="outline" className="text-[10px] capitalize">{p}</Badge>)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? 'Edit Employee Account' : 'Create Employee Account'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {!editId && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 sm:col-span-2">
                ⚠️ Only Founders can create employee accounts. Employees cannot self-register.
              </p>
            )}
            <div className="space-y-1 sm:col-span-2"><Label>Full Name *</Label><Input placeholder="Employee full name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div className="space-y-1"><Label>Email *</Label><Input type="email" placeholder="employee@netgain.studio" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            <div className="space-y-1"><Label>Phone</Label><Input placeholder="Mobile number" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            <div className={`space-y-1 ${editId ? 'sm:col-span-2' : ''}`}><Label>Role</Label><Select value={form.role} onValueChange={v => setForm({...form, role: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLES.filter(r => r !== 'Founder').map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
            {!editId && <div className="space-y-1 sm:col-span-2"><Label>Temporary Password</Label><Input type="password" placeholder="Must be changed on first login" value={form.password} onChange={e => setForm({...form, password: e.target.value})} /></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} disabled={submitting}>Cancel</Button>
            <Button variant="gold" onClick={handleAddOrEdit} disabled={submitting} className="gap-2">
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{editId ? 'Saving...' : 'Creating...'}</>
              ) : (
                editId ? 'Save Changes' : 'Create Account'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRoleCreate} onOpenChange={v => { setShowRoleCreate(v); if (!v) { setEditRoleId(null); setRoleForm({ name: '', permissions: [] }) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editRoleId ? 'Edit Custom Role' : 'Create Custom Role'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>Role Name *</Label><Input placeholder="e.g. Content Writer" value={roleForm.name} onChange={e => setRoleForm({...roleForm, name: e.target.value})} /></div>
            <div className="space-y-2">
              <Label>Module Access</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 border border-border rounded-lg bg-muted/20">
                {MODULES.map(m => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={roleForm.permissions.includes(m)} onChange={e => setRoleForm({...roleForm, permissions: e.target.checked ? [...roleForm.permissions, m] : roleForm.permissions.filter(p => p !== m)})} className="accent-gold rounded" />
                    <span className="capitalize">{m}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRoleCreate(false); setEditRoleId(null); setRoleForm({ name: '', permissions: [] }) }} disabled={submitting}>Cancel</Button>
            <Button variant="gold" disabled={submitting} className="gap-2" onClick={async () => {
              if(!roleForm.name) return;
              setSubmitting(true);
              
              if (editRoleId) {
                if (isSupabaseConfigured()) {
                  try {
                    const { error } = await supabase.from('custom_roles').update({ name: roleForm.name, permissions: roleForm.permissions }).eq('id', editRoleId)
                    if (error) {
                      toast({ title: 'Error updating role', description: error.message, variant: 'destructive' })
                      setSubmitting(false);
                      return
                    }
                  } catch (err: any) {
                    toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
                    setSubmitting(false);
                    return
                  }
                }
                setRoles(roles.map(r => r.id === editRoleId ? { ...r, name: roleForm.name, permissions: roleForm.permissions } : r));
                toast({title: 'Role Updated'})
              } else {
                const newRoleId = `role-${Date.now()}`
                const newRole = { id: newRoleId, name: roleForm.name, is_system: false, permissions: roleForm.permissions }
                if (isSupabaseConfigured()) {
                  try {
                    const { error } = await supabase.from('custom_roles').insert([newRole])
                    if (error) {
                      toast({ title: 'Error creating role', description: error.message, variant: 'destructive' })
                      setSubmitting(false);
                      return
                    }
                  } catch (err: any) {
                    toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
                    setSubmitting(false);
                    return
                  }
                }
                setRoles([...roles, { id: newRoleId, name: roleForm.name, permissions: roleForm.permissions, isSystem: false }]);
                toast({title: 'Role Created'})
              }
              
              setShowRoleCreate(false);
              setEditRoleId(null);
              setRoleForm({name: '', permissions: []});
              setSubmitting(false);
            }}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{editRoleId ? 'Saving...' : 'Creating...'}</>
              ) : (
                editRoleId ? 'Save Changes' : 'Create Role'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteMember} onOpenChange={(open) => !open && setDeleteMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteMember?.name}</strong> from your team. They will lose access to the portal immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>Remove User</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!deleteRole} onOpenChange={(open) => !open && setDeleteRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the <strong>{deleteRole?.name}</strong> role? This action cannot be undone. Users with this role may lose access to resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDeleteRole}>Delete Role</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
