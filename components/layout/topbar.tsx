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
import { useState } from 'react'
import { cn, getInitials } from '@/lib/utils'
import Link from 'next/link'
import { useUser } from '@/components/user-provider'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { useEffect } from 'react'

const breadcrumbMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/crm': 'CRM',
  '/services': 'Services Library',
  '/documents/quotations': 'Quotations',
  '/documents/invoices': 'Invoices',
  '/documents/sow': 'Scope of Work',
  '/documents/agreements': 'Agreements',
  '/documents/vault': 'Document Vault',
  '/ai-hub': 'AI Hub Dashboard',
  '/ai-hub/skills': 'Skills Library',
  '/ai-hub/prompts': 'Prompt Library',
  '/ai-hub/knowledge': 'Knowledge Base',
  '/ai-hub/providers': 'AI Providers',
  '/projects': 'Campaign Strategy',
  '/prd': 'Dev Blueprint',
  '/marketing': 'Marketing Intelligence',
  '/communications': 'Communications',
  '/meetings': 'Meetings Hub',
  '/team': 'Team Management',
  '/settings': 'Settings',
  '/profile': 'My Profile',
}

const QUICK_ADD_ITEMS = [
  { label: 'New Quotation', href: '/documents/quotations' },
  { label: 'New Invoice', href: '/documents/invoices' },
  { label: 'New Client', href: '/crm' },
  { label: 'New Project', href: '/projects' },
  { label: 'New SOW', href: '/documents/sow' },
]

// Mock notifications — replace with Supabase real-time when backend is connected
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

export function TopBar({ onMenuClickAction: onMenuClick }: { onMenuClickAction?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const title = breadcrumbMap[pathname] || 'NBOS'
  const [notifs, setNotifs] = useState<any[]>([])
  const unreadCount = notifs.filter(n => !n.read).length
  const { user } = useUser()
  const { toast } = useToast()

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setNotifs(INITIAL_NOTIFICATIONS)
      return
    }
    
    // Fetch initial
    const fetchNotifs = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) {
        console.error('Error fetching notifications:', error)
        return
      }
      if (data) setNotifs(data)
    }
    fetchNotifs()

    // Realtime subscription
    const channelId = `notifications_realtime_${Math.random().toString(36).substring(2, 11)}`
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newNotif = payload.new
          // Set relative time or handle it
          if (!newNotif.time) newNotif.time = 'Just now'
          setNotifs(prev => [newNotif, ...prev].slice(0, 20))
          toast({ title: newNotif.title, description: newNotif.body })
        } else if (payload.eventType === 'UPDATE') {
          setNotifs(prev => prev.map(n => n.id === payload.new.id ? payload.new : n))
        } else if (payload.eventType === 'DELETE') {
          setNotifs(prev => prev.filter(n => n.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [toast])

  const markAllRead = async () => {
    setNotifs(notifs.map(n => ({ ...n, read: true })))
    if (isSupabaseConfigured()) {
      await supabase.from('notifications').update({ read: true }).neq('read', true)
    }
  }

  const markRead = async (id: string) => {
    setNotifs(notifs.map(n => n.id === id ? { ...n, read: true } : n))
    if (isSupabaseConfigured()) {
      await supabase.from('notifications').update({ read: true }).eq('id', id)
    }
  }

  const dismiss = async (id: string) => {
    setNotifs(notifs.filter(n => n.id !== id))
    if (isSupabaseConfigured()) {
      await supabase.from('notifications').delete().eq('id', id)
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

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 shrink-0 -ml-2" onClick={onMenuClick}>
            <Menu className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-base font-semibold text-foreground">{title}</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">Netgain Business Operating System</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <Button
          variant="ghost" size="icon" className="h-8 w-8"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* ── Notifications Popover ── */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <Badge
                  className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 flex items-center justify-center text-[9px] bg-gold text-black border-0"
                >
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[calc(100vw-32px)] max-w-md sm:w-96 p-0 border-border" sideOffset={6}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <p className="text-sm font-semibold">Notifications</p>
                {unreadCount > 0 && (
                  <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
                )}
              </div>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-gold hover:text-gold" onClick={markAllRead}>
                  Mark all read
                </Button>
              )}
            </div>

            {/* Notification list */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-border">
              {notifs.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground">
                  <Bell className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : notifs.map(n => (
                <div
                  key={n.id}
                  className={cn('flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer', !n.read && 'bg-gold/3')}
                  onClick={() => markRead(n.id)}
                >
                  <div className="mt-0.5 shrink-0">{notifIcon[n.type]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('text-xs font-medium leading-tight', !n.read ? 'text-foreground' : 'text-muted-foreground')}>
                        {n.title}
                      </p>
                      <button onClick={e => { e.stopPropagation(); dismiss(n.id) }}
                        className="text-muted-foreground hover:text-foreground shrink-0">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{n.time}</p>
                  </div>
                  {!n.read && <div className="h-1.5 w-1.5 rounded-full bg-gold shrink-0 mt-1.5" />}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-4 py-2.5">
              <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground">
                View all notifications
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* ── Quick Add Dropdown ── */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="gold" className="h-8 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 border-border" sideOffset={6}>
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Quick Create</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {QUICK_ADD_ITEMS.map(item => (
              <DropdownMenuItem key={item.label} asChild>
                <Link href={item.href} className="cursor-pointer">{item.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* ── Profile / Account Dropdown ── */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 rounded-lg hover:bg-muted/50 pl-1 pr-2 py-1 transition-colors">
              <Avatar className="h-7 w-7">
                {user?.avatar_url && <AvatarImage src={user.avatar_url} />}
                <AvatarFallback className="gold-gradient text-white text-[10px] font-bold">
                  {user ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 border-border" sideOffset={6}>
            {/* Profile header */}
            <div className="px-3 py-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9">
                  {user?.avatar_url && <AvatarImage src={user.avatar_url} />}
                  <AvatarFallback className="gold-gradient text-white text-sm font-bold">
                    {user ? getInitials(user.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">{user?.name || 'Not Authenticated'}</p>
                  <p className="text-xs text-muted-foreground">{user?.role === 'Founder' ? 'Founder & CEO' : user?.role || 'User'}</p>
                  <Badge className="mt-1 h-4 text-[9px] bg-gold/10 text-gold border-gold/30 px-1.5">{user?.role || 'No Role'}</Badge>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer gap-2">
                <User className="h-4 w-4" /> My Profile & Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer gap-2">
                <Settings className="h-4 w-4" /> Company Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/communications" className="cursor-pointer gap-2">
                <MessageSquare className="h-4 w-4" /> Communications
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/team" className="cursor-pointer gap-2">
                <Shield className="h-4 w-4" /> Manage Team
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-red-400 focus:text-red-400 focus:bg-red-400/10 cursor-pointer"
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
