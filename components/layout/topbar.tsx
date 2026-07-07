'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Moon, Sun, Bell, Plus, Settings, User, LogOut, ChevronDown, Shield, MessageSquare, X, Check, AlertCircle, Info, Menu } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { useState, useMemo, useEffect } from 'react'
import { cn, getInitials } from '@/lib/utils'
import Link from 'next/link'
import { useUser } from '@/components/user-provider'
import { GlobalSearch } from '@/components/ui/global-search'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

const breadcrumbMap: Record<string, { module: string, page: string }> = {
  '/dashboard': { module: 'Core', page: 'Dashboard' },
  '/crm': { module: 'Core', page: 'CRM' },
  '/services': { module: 'Core', page: 'Services Library' },
  '/documents/quotations': { module: 'Documents', page: 'Quotations' },
  '/documents/invoices': { module: 'Documents', page: 'Invoices' },
  '/documents/sow': { module: 'Documents', page: 'Scope of Work' },
  '/documents/agreements': { module: 'Documents', page: 'Agreements' },
  '/documents/vault': { module: 'Documents', page: 'Document Vault' },
  '/ai-hub': { module: 'AI Hub', page: 'Dashboard' },
  '/ai-hub/skills': { module: 'AI Hub', page: 'Skills Library' },
  '/ai-hub/prompts': { module: 'AI Hub', page: 'Prompt Library' },
  '/ai-hub/knowledge': { module: 'AI Hub', page: 'Knowledge Base' },
  '/ai-hub/providers': { module: 'AI Hub', page: 'AI Providers' },
  '/projects': { module: 'Intelligence', page: 'Campaign Strategy' },
  '/prd': { module: 'Intelligence', page: 'Dev Blueprint' },
  '/marketing': { module: 'Intelligence', page: 'Marketing Intelligence' },
  '/communications': { module: 'Operations', page: 'Communications' },
  '/meetings': { module: 'Operations', page: 'Meetings Hub' },
  '/team': { module: 'Management', page: 'Team Management' },
  '/settings': { module: 'Management', page: 'Settings' },
  '/profile': { module: 'Account', page: 'My Profile' },
}

const QUICK_ADD_ITEMS = [
  { label: 'New Quotation', href: '/documents/quotations' },
  { label: 'New Invoice', href: '/documents/invoices' },
  { label: 'New Client', href: '/crm' },
  { label: 'New Project', href: '/projects' },
  { label: 'New SOW', href: '/documents/sow' },
]

// Mock notifications
const INITIAL_NOTIFICATIONS = [
  { id: '1', type: 'info', title: 'New quotation approved', body: 'FashionHub India approved NG-QUO-2024-1098', time: '2 min ago', read: false },
  { id: '2', type: 'warning', title: 'Invoice overdue', body: 'Urban Edge Co. — NG-INV-2024-0893 is past due date', time: '1 hr ago', read: false },
  { id: '3', type: 'success', title: 'Payment received', body: '₹21,998 received from FashionHub India', time: '3 hr ago', read: false },
  { id: '4', type: 'info', title: 'New client added', body: 'TechCore Solutions added to CRM by Devon S.', time: '5 hr ago', read: true },
  { id: '5', type: 'info', title: 'Project milestone reached', body: 'E-Commerce Build — Design phase complete', time: 'Yesterday', read: true },
]

const notifIcon: Record<string, React.ReactNode> = {
  info:    <Info className="h-4 w-4 text-blue-400" />,
  warning: <AlertCircle className="h-4 w-4 text-yellow-400" />,
  success: <Check className="h-4 w-4 text-emerald-400" />,
}

function getGroupForNotification(n: any): 'Today' | 'Yesterday' | 'This Week' {
  if (!n.created_at) {
    if (n.time?.includes('min') || n.time?.includes('hr') || n.time?.includes('now')) return 'Today'
    if (n.time?.toLowerCase().includes('yesterday')) return 'Yesterday'
    return 'This Week'
  }
  const created = new Date(n.created_at)
  const today = new Date()
  const diffTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(created.getFullYear(), created.getMonth(), created.getDate()).getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return 'This Week'
}

function getCategoryForNotification(n: any): string {
  if (n.category) return n.category
  const title = (n.title || '').toLowerCase()
  const body = (n.body || '').toLowerCase()
  if (title.includes('quote') || body.includes('quote')) return 'Documents'
  if (title.includes('invoice') || body.includes('payment')) return 'Finance'
  if (title.includes('sow') || body.includes('agreement')) return 'Documents'
  if (title.includes('project') || title.includes('milestone')) return 'Projects'
  if (title.includes('meeting')) return 'Meetings'
  if (title.includes('client') || title.includes('crm')) return 'CRM'
  if (title.includes('ticket') || title.includes('support')) return 'Support'
  return 'System'
}

function getLinkForNotification(n: any): string {
  if (n.link) return n.link
  const category = getCategoryForNotification(n)
  const map: Record<string, string> = {
    Documents: '/documents/vault',
    Finance: '/documents/invoices',
    Projects: '/projects',
    Meetings: '/meetings',
    CRM: '/crm',
    Support: '/support'
  }
  return map[category] || '/dashboard'
}

export function TopBar({ onMenuClickAction: onMenuClick }: { onMenuClickAction?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const breadcrumb = breadcrumbMap[pathname] || { module: 'Netgain', page: 'Business OS' }
  const [notifs, setNotifs] = useState<any[]>([])
  const [filterCategory, setFilterCategory] = useState('All')
  const unreadCount = notifs.filter(n => !n.read).length
  const { user } = useUser()
  const { toast } = useToast()

  const filteredNotifs = useMemo(() => {
    return notifs.filter((n: any) => {
      if (filterCategory === 'All') return true
      return getCategoryForNotification(n).toLowerCase() === filterCategory.toLowerCase()
    })
  }, [notifs, filterCategory])

  const groupedNotifs = useMemo(() => {
    const groups: Record<'Today' | 'Yesterday' | 'This Week', any[]> = { Today: [], Yesterday: [], 'This Week': [] }
    filteredNotifs.forEach((n: any) => {
      groups[getGroupForNotification(n)].push(n)
    })
    return groups
  }, [filteredNotifs])

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setNotifs(INITIAL_NOTIFICATIONS)
      return
    }
    const fetchNotifs = async () => {
      const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(20)
      if (data) setNotifs(data)
    }
    fetchNotifs()
    const channelId = `notifs_${Math.random().toString(36).substring(2, 9)}`
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newNotif = payload.new
          if (!newNotif.time) newNotif.time = 'Just now'
          setNotifs(prev => [newNotif, ...prev].slice(0, 20))
          toast({ title: newNotif.title, description: newNotif.body })
        } else if (payload.eventType === 'UPDATE') {
          setNotifs(prev => prev.map(n => n.id === payload.new.id ? payload.new : n))
        } else if (payload.eventType === 'DELETE') {
          setNotifs(prev => prev.filter(n => n.id !== payload.old.id))
        }
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [toast])

  const markAllRead = async () => {
    setNotifs(notifs.map(n => ({ ...n, read: true })))
    if (isSupabaseConfigured()) await supabase.from('notifications').update({ read: true }).neq('read', true)
  }
  const markRead = async (id: string) => {
    setNotifs(notifs.map(n => n.id === id ? { ...n, read: true } : n))
    if (isSupabaseConfigured()) await supabase.from('notifications').update({ read: true }).eq('id', id)
  }
  const dismiss = async (id: string) => {
    setNotifs(notifs.filter(n => n.id !== id))
    if (isSupabaseConfigured()) await supabase.from('notifications').delete().eq('id', id)
  }

  const handleSignOut = async () => {
    if (isSupabaseConfigured()) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        await supabase.from('system_activities').insert({ user_name: session.user.email, action: 'User signed out', module: 'auth' })
      }
      await supabase.auth.signOut()
    }
    document.cookie = 'nbos-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;'
    router.push('/login')
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-6 sticky top-0 z-30 transition-colors">
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 shrink-0 -ml-2 rounded-lg" onClick={onMenuClick}>
            <Menu className="h-4 w-4" />
          </Button>
        )}
        <div className="hidden sm:flex items-center gap-2 text-sm">
          <span className="text-muted-foreground font-medium">{breadcrumb.module}</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground font-semibold tracking-tight">{breadcrumb.page}</span>
        </div>
        <div className="sm:hidden">
          <h1 className="text-sm font-semibold text-foreground tracking-tight">{breadcrumb.page}</h1>
        </div>
      </div>

      {/* Global search bar */}
      <div className="flex-1 max-w-md mx-8 hidden md:block">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-border/60 bg-transparent text-muted-foreground shadow-none hover:bg-accent/50" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          <Sun className="h-[18px] w-[18px] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[18px] w-[18px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* ── Notifications ── */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-10 w-10 relative rounded-full border-border/60 bg-transparent text-muted-foreground shadow-none hover:bg-accent/50">
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[calc(100vw-32px)] max-w-sm sm:w-96 p-0 border-border bg-popover rounded-xl shadow-lg" sideOffset={8}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20">
              <div>
                <p className="text-sm font-semibold">Notifications</p>
                {unreadCount > 0 && <p className="text-xs text-muted-foreground">{unreadCount} unread</p>}
              </div>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 rounded" onClick={markAllRead}>
                  Mark all read
                </Button>
              )}
            </div>

            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/50 bg-background overflow-x-auto no-scrollbar">
              {['All', 'CRM', 'Projects', 'Documents', 'Meetings', 'Finance', 'Support', 'System'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={cn(
                    "text-[11px] font-medium px-2.5 py-1 rounded-full transition-all shrink-0 border",
                    filterCategory === cat
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-muted-foreground border-border/60 hover:border-border hover:text-foreground"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40">
              {filteredNotifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="h-8 w-8 mb-3 opacity-20" />
                  <p className="text-sm font-medium">All caught up</p>
                  <p className="text-xs opacity-70">No notifications in {filterCategory}</p>
                </div>
              ) : (
                (['Today', 'Yesterday', 'This Week'] as const).map(group => {
                  const list = groupedNotifs[group]
                  if (list.length === 0) return null
                  return (
                    <div key={group} className="py-1">
                      <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest px-4 py-2">{group}</p>
                      {list.map((n: any) => (
                        <div
                          key={n.id}
                          className={cn('group flex items-start gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer', !n.read && 'bg-primary/5')}
                          onClick={() => { markRead(n.id); router.push(getLinkForNotification(n)) }}
                        >
                          <div className="mt-0.5 shrink-0 bg-background p-1.5 rounded-md border border-border shadow-sm">
                            {notifIcon[n.type] || notifIcon.info}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={cn('text-[13px] font-medium leading-tight', !n.read ? 'text-foreground' : 'text-muted-foreground')}>
                                {n.title}
                              </p>
                              <button onClick={e => { e.stopPropagation(); dismiss(n.id) }} className="text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-foreground shrink-0 transition-colors">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2">{n.body}</p>
                            {n.time && <p className="text-[10px] font-medium text-muted-foreground/60 mt-1.5">{n.time}</p>}
                          </div>
                          {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                        </div>
                      ))}
                    </div>
                  )
                })
              )}
            </div>

            <div className="border-t border-border/60 p-2 bg-muted/10">
              <Button variant="ghost" size="sm" className="w-full h-8 text-xs font-medium text-muted-foreground">
                View all activity
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* ── Quick Add Removed ── */}

        {/* ── Profile ── */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 rounded-full hover:bg-accent/50 p-1 pr-3 transition-colors ml-1 focus-ring border border-transparent hover:border-border/60">
              <Avatar className="h-10 w-10 ring-1 ring-border shadow-sm">
                {user?.avatar_url && <AvatarImage src={user.avatar_url} />}
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {user ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden lg:flex flex-col items-start text-left mr-1">
                <span className="text-sm font-semibold leading-tight text-foreground">{user?.name || 'User'}</span>
                <span className="text-[10px] text-muted-foreground">{user?.email || 'email@example.com'}</span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-xl shadow-lg border-border p-1" sideOffset={8}>
            <div className="px-2 py-2.5 mb-1 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 ring-1 ring-border shadow-sm">
                  {user?.avatar_url && <AvatarImage src={user.avatar_url} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                    {user ? getInitials(user.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate leading-tight">{user?.name || 'Not Authenticated'}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email || ''}</p>
                  <div className="inline-flex mt-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wider uppercase bg-primary/10 text-primary">
                    {user?.role || 'No Role'}
                  </div>
                </div>
              </div>
            </div>

            <DropdownMenuItem asChild className="rounded-md gap-2.5 cursor-pointer py-2 text-[13px]">
              <Link href="/profile"><User className="h-4 w-4 text-muted-foreground" /> My Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="rounded-md gap-2.5 cursor-pointer py-2 text-[13px]">
              <Link href="/settings"><Settings className="h-4 w-4 text-muted-foreground" /> Workspace Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="rounded-md gap-2.5 cursor-pointer py-2 text-[13px]">
              <Link href="/team"><Shield className="h-4 w-4 text-muted-foreground" /> Manage Team</Link>
            </DropdownMenuItem>
            
            <div className="h-px bg-border my-1 mx-1" />
            
            <DropdownMenuItem
              className="rounded-md gap-2.5 cursor-pointer py-2 text-[13px] text-destructive focus:text-destructive focus:bg-destructive/10"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
