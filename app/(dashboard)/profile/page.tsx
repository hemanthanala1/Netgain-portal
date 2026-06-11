'use client'
import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Save, Upload, Eye, EyeOff, Shield, Activity, LogOut, CheckCircle2, Loader2, Camera } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { formatDateTime, getInitials } from '@/lib/utils'
import { useUser } from '@/components/user-provider'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

const recentActivity = [
  { action: 'Generated Quotation', detail: 'NG-QUO-2026-7098 for Urban Edge Co.', time: new Date().toISOString() },
  { action: 'Added Client', detail: 'FashionHub India to CRM', time: new Date(Date.now() - 3600000).toISOString() },
  { action: 'Created Invoice', detail: 'NG-INV-2024-0894 — ₹18,998', time: new Date(Date.now() - 7200000).toISOString() },
  { action: 'Updated Settings', detail: 'Company information updated', time: new Date(Date.now() - 86400000).toISOString() },
  { action: 'Generated SOW', detail: 'Custom SaaS Platform Build — TechCore', time: new Date(Date.now() - 172800000).toISOString() },
]

export default function ProfilePage() {
  const { toast } = useToast()
  const router = useRouter()
  const { user, loading, refreshUser } = useUser()
  const [saving, setSaving] = useState(false)
  const [savedProfile, setSavedProfile] = useState(false)
  const [changingPw, setChangingPw] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    designation: '',
    bio: 'Team member at Netgain Studio.',
  })

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        designation: user.role === 'Founder' ? 'Founder & CEO' : user.role || '',
        bio: 'Team member at Netgain Studio.',
      })
      setAvatarUrl(user.avatar_url || null)
    }
  }, [user])

  const [passwords, setPasswords] = useState({
    current: '',
    newPw: '',
    confirm: '',
  })

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      if (isSupabaseConfigured() && user) {
        let uploadedUrl = user.avatar_url || ''

        if (selectedFile) {
          const formData = new FormData()
          formData.append('file', selectedFile)
          formData.append('userId', user.id)

          const res = await fetch('/api/profile/avatar', {
            method: 'POST',
            body: formData
          })

          const data = await res.json()
          if (!res.ok) {
            toast({ title: 'Error uploading image', description: data.error || 'Upload failed', variant: 'destructive' })
            setSaving(false)
            return
          }

          uploadedUrl = data.publicUrl
        }

        // 1) Update auth.users user_metadata
        const { error: authError } = await supabase.auth.updateUser({
          data: {
            full_name: profile.name,
            phone: profile.phone,
            designation: profile.designation,
            avatar_url: uploadedUrl
          }
        })

        if (authError) {
          toast({ title: 'Error updating auth profile', description: authError.message, variant: 'destructive' })
          setSaving(false)
          return
        }

        // 2) Update profiles table (synced with auth)
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: profile.name,
            email: profile.email,
            settings: {
              ...(user.settings || {}),
              avatar_url: uploadedUrl,
              phone: profile.phone
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)

        if (profileError) {
          toast({ title: 'Error updating profile', description: profileError.message, variant: 'destructive' })
          setSaving(false)
          return
        }

        // 3) Update team_members for backward compatibility
        await supabase
          .from('team_members')
          .update({
            name: profile.name,
            phone: profile.phone,
          })
          .eq('email', user.email)

        // 4) If the user is a Founder, also sync with company_settings table
        if (user.role === 'Founder') {
          const { data: settingsData } = await supabase
            .from('company_settings')
            .select('founder')
            .eq('user_id', user.id)
            .maybeSingle()

          const currentFounderSettings = settingsData?.founder || {}

          await supabase
            .from('company_settings')
            .upsert({
              user_id: user.id,
              founder: {
                ...currentFounderSettings,
                name: profile.name,
                email: profile.email,
                phone: profile.phone,
                designation: profile.designation
              }
            }, { onConflict: 'user_id' })
        }

        setSelectedFile(null)
        await refreshUser()
      } else {
        await new Promise(r => setTimeout(r, 600))
      }
      setSavedProfile(true)
      setTimeout(() => setSavedProfile(false), 3000)
      toast({ title: '✅ Profile updated successfully' })
    } catch (err: any) {
      toast({ title: 'Error updating profile', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!passwords.newPw) { toast({ title: 'Enter a new password', variant: 'destructive' }); return }
    if (passwords.newPw.length < 6) { toast({ title: 'Password must be at least 6 characters', variant: 'destructive' }); return }
    if (passwords.newPw !== passwords.confirm) { toast({ title: 'Passwords do not match', variant: 'destructive' }); return }
    
    setChangingPw(true)
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.updateUser({ password: passwords.newPw })
        if (error) {
          toast({ title: 'Error updating password', description: error.message, variant: 'destructive' })
          return
        }
      } else {
        await new Promise(r => setTimeout(r, 600))
      }
      toast({ title: '✅ Password changed successfully' })
      setPasswords({ current: '', newPw: '', confirm: '' })
    } catch (err: any) {
      toast({ title: 'Error updating password', description: err.message, variant: 'destructive' })
    } finally {
      setChangingPw(false)
    }
  }

  const handleSignOut = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut()
    }
    document.cookie = 'nbos-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;'
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;'
    document.cookie = 'sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;'
    router.push('/login')
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setAvatarUrl(url)
      setSelectedFile(file)
      toast({ title: 'Image Uploaded', description: 'Your profile picture has been updated temporarily. Save profile to keep changes.' })
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your account settings and security.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-red-400 border-red-400/20 hover:bg-red-400/10 hover:text-red-400 w-full sm:w-auto"
          onClick={handleSignOut}>
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </Button>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

      {/* Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="h-20 w-20">
                {avatarUrl && <AvatarImage src={avatarUrl} />}
                <AvatarFallback className="gold-gradient text-white text-2xl font-bold">
                  {user ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-gold flex items-center justify-center shadow-lg hover:bg-gold/80 transition-colors">
                <Camera className="h-3.5 w-3.5 text-black" />
              </button>
            </div>
            <div>
              <h2 className="text-xl font-bold">{profile.name || user?.name || 'User'}</h2>
              <p className="text-muted-foreground text-sm">{profile.designation || user?.role || 'Team Member'}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className="bg-gold/10 text-gold border-gold/30 text-xs">{user?.role || 'Employee'}</Badge>
                <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-400/30">Active</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile" className="gap-1.5"><Shield className="h-3.5 w-3.5" />Profile</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><Shield className="h-3.5 w-3.5" />Security</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5"><Activity className="h-3.5 w-3.5" />Activity</TabsTrigger>
        </TabsList>

        {/* ── Profile Tab ── */}
        <TabsContent value="profile">
          <Card>
            <CardHeader><CardTitle className="text-sm">Personal Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Full Name</Label>
                  <Input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Designation / Role</Label>
                  <Input value={profile.designation} onChange={e => setProfile({ ...profile, designation: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Email Address</Label>
                  <Input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Phone Number</Label>
                  <Input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <Label>Bio</Label>
                  <Textarea className="resize-none h-20" value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} />
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Profile Photo</Label>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}><Upload className="h-3.5 w-3.5" />Upload Photo</Button>
              </div>
              <div className="flex justify-end">
                <Button variant={savedProfile ? 'secondary' : 'gold'} onClick={handleSaveProfile} disabled={saving} className="gap-2">
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
                    : savedProfile ? <><CheckCircle2 className="h-4 w-4" />Saved!</>
                    : <><Save className="h-4 w-4" />Save Profile</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Security Tab ── */}
        <TabsContent value="security">
          <Card>
            <CardHeader><CardTitle className="text-sm">Change Password</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Current Password</Label>
                <div className="relative">
                  <Input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={passwords.current} onChange={e => setPasswords({ ...passwords, current: e.target.value })} className="pr-10" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>New Password</Label>
                <div className="relative">
                  <Input type={showNewPw ? 'text' : 'password'} placeholder="Min 8 characters" value={passwords.newPw} onChange={e => setPasswords({ ...passwords, newPw: e.target.value })} className="pr-10" />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Confirm New Password</Label>
                <Input type="password" placeholder="Repeat new password" value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} />
              </div>
              <div className="flex justify-end">
                <Button variant="gold" onClick={handleChangePassword} disabled={changingPw} className="gap-2">
                  {changingPw ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Updating...</>
                  ) : (
                    <><Shield className="h-4 w-4" /> Update Password</>
                  )}
                </Button>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-semibold mb-3">Danger Zone</p>
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-400">Delete Account</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Permanently delete your account and all associated data. This cannot be undone.</p>
                  </div>
                  <Button variant="outline" size="sm" className="border-red-400/30 text-red-400 hover:bg-red-400/10 shrink-0 w-full sm:w-auto">Delete Account</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Activity Tab ── */}
        <TabsContent value="activity">
          <Card>
            <CardHeader><CardTitle className="text-sm">Recent Activity</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-0 divide-y divide-border">
                {recentActivity.map((act, i) => (
                  <div key={i} className="flex items-start gap-3 py-3">
                    <div className="h-7 w-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Activity className="h-3.5 w-3.5 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{act.action}</p>
                      <p className="text-xs text-muted-foreground">{act.detail}</p>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">{formatDateTime(act.time)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
