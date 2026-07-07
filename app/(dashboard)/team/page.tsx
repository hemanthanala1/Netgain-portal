'use client'
import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { Drawer } from '@/components/ui/drawer'
import { FormInput, FormSelect } from '@/components/ui/form-inputs'
import { DeleteDialog } from '@/components/ui/dialog-variants'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Plus, UserCog, Mail, Phone, Shield, MoreHorizontal, Edit, Trash2, Activity, Loader2 } from 'lucide-react'
import { getInitials, formatDate, cn } from '@/lib/utils'
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
  { id: 'role-admin', name: 'Admin', isSystem: true, permissions: ['crm', 'services', 'documents', 'projects', 'prd', 'marketing', 'finance', 'meetings', 'communications', 'team', 'settings'] },
  { id: 'role-pm', name: 'Project Manager', isSystem: true, permissions: ['crm', 'services', 'documents', 'projects', 'prd', 'meetings', 'communications'] },
  { id: 'role-sales', name: 'Sales Executive', isSystem: true, permissions: ['crm', 'meetings', 'communications', 'marketing'] },
  { id: 'role-employee', name: 'Employee', isSystem: true, permissions: ['projects', 'prd', 'meetings'] },
]

const MODULES = ['crm', 'services', 'documents', 'projects', 'prd', 'marketing', 'finance', 'meetings', 'communications', 'team', 'settings']

const MODULE_LABELS: Record<string, string> = {
  crm: 'CRM Hub',
  services: 'Services Library',
  documents: 'Documents Vault',
  projects: 'Projects Engine',
  prd: 'PRD Engine',
  marketing: 'Marketing Reports',
  finance: 'Finance Module',
  meetings: 'Meetings Hub',
  communications: 'Communication Center',
  team: 'Team Management',
  settings: 'Portal Settings'
}

const OPERATIONS = ['read', 'create', 'update', 'delete', 'approve', 'export', 'print', 'manage', 'share']

const OPERATION_LABELS: Record<string, string> = {
  read: 'View',
  create: 'Create',
  update: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
  export: 'Export',
  print: 'Print',
  manage: 'Manage',
  share: 'Share'
}


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
  const [matrixRoleId, setMatrixRoleId] = useState<string>('')
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
            const mapped = dbRoles.map((r: any) => ({
              id: r.id,
              name: r.name,
              isSystem: r.is_system,
              permissions: r.permissions || []
            }))
            setRoles(mapped)
            if (mapped.length > 0) {
              setMatrixRoleId(mapped[0].id)
            }
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
        if (initialRoles.length > 0) {
          setMatrixRoleId(initialRoles[0].id)
        }
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

  const handleTogglePermission = async (roleId: string, mod: string, op: string) => {
    const role = roles.find(r => r.id === roleId)
    if (!role) return
    if (role.name === 'Founder') return

    const perm = `${mod}:${op}`
    let updatedPermissions = [...role.permissions]

    if (updatedPermissions.includes(perm)) {
      updatedPermissions = updatedPermissions.filter(p => p !== perm)
    } else {
      updatedPermissions.push(perm)
    }

    if (role.permissions.includes('all')) {
      updatedPermissions = []
      MODULES.forEach(m => {
        OPERATIONS.forEach(o => {
          if (m === mod && o === op) return
          updatedPermissions.push(`${m}:${o}`)
        })
      })
    }

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('custom_roles')
          .update({ permissions: updatedPermissions })
          .eq('id', roleId)

        if (error) {
          toast({ title: 'Error saving permissions', description: error.message, variant: 'destructive' })
          return
        }
      } catch (err: any) {
        toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
        return
      }
    } else {
      const storageKey = `nbos_permissions_${roleId}`
      localStorage.setItem(storageKey, JSON.stringify(updatedPermissions))
    }

    setRoles(prev => prev.map(r => r.id === roleId ? { ...r, permissions: updatedPermissions } : r))
    toast({ title: 'Permissions updated!' })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Management"
        description="Manage your team members, roles, and access levels."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Team' }
        ]}
        primaryAction={{
          label: 'Add Employee',
          onClick: () => { setEditId(null); setForm({ name: '', email: '', phone: '', role: 'Employee', password: '' }); setShowAdd(true) },
          icon: Plus,
          variant: 'gold'
        }}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ label: 'Total Team', value: team.length }, { label: 'Active', value: team.filter(t => t.status === 'active').length }, { label: 'Managers', value: team.filter(t => ['Founder', 'Admin', 'Project Manager'].includes(t.role)).length }, { label: 'Staff', value: team.filter(t => ['Sales Executive', 'Employee'].includes(t.role)).length }].map(s => (
          <Card key={s.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold mt-1">{s.value}</p></CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="team">
        <TabsList className="mb-4">
          <TabsTrigger value="team">Employees</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="matrix">Permission Matrix</TabsTrigger>
        </TabsList>
        <TabsContent value="team">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {team.length === 0 && (
            <EmptyState
              icon={UserCog}
              title="No team members found"
              description="Add your first team member to get started."
              action={{ label: 'Add Employee', onClick: () => { setEditId(null); setForm({ name: '', email: '', phone: '', role: 'Employee', password: '' }); setShowAdd(true) }, icon: Plus }}
            />
          )}
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
                    <Button variant="ghost" size="icon" aria-label="Edit" className="h-7 w-7" onClick={() => openEdit(member)}><Edit className="h-3.5 w-3.5" /></Button>
                    {member.role !== 'Founder' && <Button variant="ghost" size="icon" aria-label="Delete" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteMember({id: member.id, name: member.name})}><Trash2 className="h-3.5 w-3.5" /></Button>}
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
                    <div className="h-6 w-6 rounded-full gold-gradient flex items-center justify-center shrink-0"><span className="text-[10px] font-bold text-foreground">{getInitials(a.user)}</span></div>
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
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon" aria-label="Action"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditRoleId(r.id);
                          setRoleForm({ name: r.name, permissions: r.permissions });
                          setShowRoleCreate(true);
                        }}
                        title="Edit Role & Permissions"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      {r.name !== 'Founder' && r.name !== 'Admin' ? (
                        <Button
                          variant="ghost"
                          size="icon" aria-label="Action"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteRole(r)}
                          title="Delete Role"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon" aria-label="Action"
                          className="h-7 w-7 text-muted-foreground/30 cursor-not-allowed"
                          disabled
                          title={`${r.name} role cannot be deleted`}
                          >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
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
        {/* ── PERMISSION MATRIX TAB ── */}
        <TabsContent value="matrix" className="space-y-4">
          {(() => {
            const activeRole = roles.find(r => r.id === matrixRoleId) || roles[0]
            if (!activeRole) return <div className="text-xs text-muted-foreground italic">No roles available</div>

            const isFounder = activeRole.name === 'Founder'
            const isAdmin = activeRole.name === 'Admin'

            return (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-3 rounded-xl border border-border/40">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Interactive Permission Matrix</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Customize fine-grained CRUD and workflow actions for team roles</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground shrink-0">Configure Role:</Label>
                    <Select value={matrixRoleId || activeRole.id} onValueChange={setMatrixRoleId}>
                      <SelectTrigger className="h-8.5 w-48 text-xs border-border/60 bg-background/30 focus-visible:ring-gold text-slate-200">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map(r => (
                          <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isFounder ? (
                  <div className="p-6 border border-gold/30 rounded-xl bg-gold/5 text-gold text-xs text-center font-medium max-w-xl mx-auto space-y-2">
                    <Shield className="h-8 w-8 mx-auto mb-2" />
                    <p className="font-bold text-sm">Founder Role (System Override)</p>
                    <p className="text-muted-foreground leading-relaxed">The Founder role has absolute system-wide access to all resources, administrative capabilities, and financial configuration. These permissions are hardcoded and cannot be modified.</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border/70 bg-muted/20">
                            <th className="py-3 px-4 text-left font-bold text-slate-200 min-w-40 border-r border-border/10">Module / Resource</th>
                            {OPERATIONS.map(op => (
                              <th key={op} className="py-3 px-2 text-center font-bold text-gold uppercase tracking-wider min-w-20">
                                {OPERATION_LABELS[op]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {MODULES.map(mod => {
                            return (
                              <tr key={mod} className="hover:bg-muted/10 transition-colors">
                                <td className="py-3.5 px-4 font-semibold text-muted-foreground border-r border-border/10">
                                  {MODULE_LABELS[mod] || mod}
                                </td>
                                {OPERATIONS.map(op => {
                                  const hasPerm = activeRole.permissions.includes('all') || activeRole.permissions.includes(`${mod}:${op}`)
                                  return (
                                    <td key={op} className="py-3.5 px-2 text-center">
                                      <input 
                                        type="checkbox" 
                                        checked={hasPerm}
                                        disabled={isAdmin}
                                        onChange={() => handleTogglePermission(activeRole.id, mod, op)}
                                        className="h-4.5 w-4.5 rounded border-border/80 bg-card text-gold focus:ring-gold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                        aria-label={`Toggle ${op} permission for ${mod}`}
                                      />
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {isAdmin && (
                  <p className="text-[10px] text-muted-foreground italic text-center">
                    * The System Admin role has full module permissions enabled by default.
                  </p>
                )}
              </>
            )
          })()}
        </TabsContent>
      </Tabs>

      <Drawer
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title={editId ? 'Edit Employee Account' : 'Create Employee Account'}
        description="Configure team member name, contact details, role, and temporary password."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)} disabled={submitting}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleAddOrEdit} disabled={submitting} className="gap-2">
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{editId ? 'Saving...' : 'Creating...'}</>
              ) : (
                editId ? 'Save Changes' : 'Create Account'
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          {!editId && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              ⚠️ Only Founders can create employee accounts. Employees cannot self-register.
            </p>
          )}
          <FormInput label="Full Name" required placeholder="Employee full name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <FormInput label="Email" type="email" required placeholder="employee@netgain.studio" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <FormInput label="Phone" placeholder="Mobile number" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          <FormSelect label="Role" value={form.role} onChange={e => setForm({...form, role: e.target.value})} options={ROLES.filter(r => r !== 'Founder').map(r => ({ label: r, value: r }))} />
          {!editId && <FormInput label="Temporary Password" type="password" placeholder="Must be changed on first login" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />}
        </div>
      </Drawer>

      <Dialog open={showRoleCreate} onOpenChange={v => { setShowRoleCreate(v); if (!v) { setEditRoleId(null); setRoleForm({ name: '', permissions: [] }) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editRoleId ? (roles.find(r => r.id === editRoleId)?.isSystem ? 'Edit System Role' : 'Edit Custom Role') : 'Create Custom Role'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Role Name *</Label>
              <Input
                placeholder="e.g. Content Writer"
                value={roleForm.name}
                onChange={e => setRoleForm({...roleForm, name: e.target.value})}
                disabled={roles.find(r => r.id === editRoleId)?.isSystem}
              />
              {roles.find(r => r.id === editRoleId)?.isSystem && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  System role names cannot be renamed as they are integrated with portal logic and security policies.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Module Access</Label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gold">
                  <input
                    type="checkbox"
                    checked={roleForm.permissions.includes('all')}
                    onChange={e => {
                      if (e.target.checked) {
                        setRoleForm({ ...roleForm, permissions: ['all'] })
                      } else {
                        setRoleForm({ ...roleForm, permissions: [] })
                      }
                    }}
                    className="accent-gold rounded"
                  />
                  <span>Full Admin Access</span>
                </label>
              </div>
              
              {!roleForm.permissions.includes('all') ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 border border-border rounded-lg bg-muted/20">
                  {MODULES.map(m => (
                    <label key={m} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={roleForm.permissions.includes(m)}
                        onChange={e => setRoleForm({...roleForm, permissions: e.target.checked ? [...roleForm.permissions, m] : roleForm.permissions.filter(p => p !== m)})}
                        className="accent-gold rounded"
                      />
                      <span>{MODULE_LABELS[m] || m}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="p-3 border border-border rounded-lg bg-gold/5 text-gold text-xs text-center font-medium">
                  Full access includes access to all modules and system configuration.
                </div>
              )}
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

      {/* Delete Member Confirmation */}
      <DeleteDialog
        isOpen={!!deleteMember}
        onClose={() => setDeleteMember(null)}
        title="Remove Team Member?"
        description={`This action cannot be undone. This will permanently remove ${deleteMember?.name} from your team, and they will lose access immediately.`}
        confirmLabel="Remove User"
        onConfirm={handleDelete}
      />
      {/* Delete Role Confirmation */}
      <DeleteDialog
        isOpen={!!deleteRole}
        onClose={() => setDeleteRole(null)}
        title="Delete Role?"
        description={`This action cannot be undone. Are you sure you want to delete the ${deleteRole?.name} role? Users with this role may lose access to resources.`}
        confirmLabel="Delete Role"
        onConfirm={handleDeleteRole}
      />
    </div>
  )
}
