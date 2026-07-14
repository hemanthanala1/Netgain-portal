'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn, getInitials } from '@/lib/utils'
import { useUser } from '@/components/user-provider'
import {
  LayoutDashboard, Users, Briefcase, FileText, Receipt, ClipboardList, HandshakeIcon,
  FolderOpen, Cpu, TrendingUp, MessageSquare, UserCog, Settings, ChevronLeft,
  ChevronRight, Zap, BarChart3, FileCode2, X, DollarSign, Calendar,
  Sparkles, BookOpen, Brain, LifeBuoy, PieChart
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const navItems = [
  {
    label: 'Core',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/crm', icon: Users, label: 'CRM' },
      { href: '/services', icon: Briefcase, label: 'Services Library' },
    ],
  },
  {
    label: 'Documents',
    items: [
      { href: '/documents/quotations', icon: FileText, label: 'Quotations' },
      { href: '/documents/invoices', icon: Receipt, label: 'Invoices' },
      { href: '/documents/sow', icon: ClipboardList, label: 'Scope of Work' },
      { href: '/documents/agreements', icon: HandshakeIcon, label: 'Agreements' },
      { href: '/documents/vault', icon: FolderOpen, label: 'Document Vault' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/finance', icon: DollarSign, label: 'Finance' },
      { href: '/meetings', icon: Calendar, label: 'Meetings' },
      { href: '/communications', icon: MessageSquare, label: 'Communications' },
      { href: '/support', icon: LifeBuoy, label: 'Support Tickets' },
    ],
  },
  {
    label: 'AI Hub',
    items: [
      { href: '/ai-hub', icon: Zap, label: 'AI Hub Dashboard' },
      { href: '/ai-hub/skills', icon: Sparkles, label: 'Skills Library' },
      { href: '/ai-hub/prompts', icon: BookOpen, label: 'Prompt Library' },
      { href: '/ai-hub/knowledge', icon: FolderOpen, label: 'Knowledge Base' },
      { href: '/ai-hub/providers', icon: Cpu, label: 'AI Providers' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/projects', icon: Briefcase, label: 'Project Workspace' },
      { href: '/campaign-strategy', icon: TrendingUp, label: 'Campaign Strategy' },
      { href: '/prd', icon: FileCode2, label: 'Dev Blueprint' },
      { href: '/marketing', icon: Brain, label: 'Marketing Intelligence' },
      { href: '/reports', icon: PieChart, label: 'Enterprise Reports' },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/team', icon: UserCog, label: 'Team' },
      { href: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

export function Sidebar({ onMobileCloseAction: onMobileClose }: { onMobileCloseAction?: () => void }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useUser()
  const isExpanded = !collapsed || !!onMobileClose

  const [companyName, setCompanyName] = useState('NETGAIN')
  const [companyLogo, setCompanyLogo] = useState('/logo.png')

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          if (data?.company?.name) setCompanyName(data.company.name)
          if (data?.company?.logo) setCompanyLogo(data.company.logo)
        }
      } catch (e) {}
    }
    fetchSettings()

    const handleUpdate = (e: any) => {
      if (e.detail?.name) setCompanyName(e.detail.name)
      if (e.detail?.logo !== undefined) setCompanyLogo(e.detail.logo || '/logo.png')
    }

    window.addEventListener('company-settings-updated', handleUpdate)
    return () => window.removeEventListener('company-settings-updated', handleUpdate)
  }, [])

  return (
    <motion.aside
      animate={{ width: isExpanded ? 256 : 72 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex h-full flex-col bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))] overflow-hidden shrink-0"
    >
      {/* ── Logo / Brand ── */}
      <div className="flex h-16 items-center justify-between px-4 shrink-0 border-b border-[hsl(var(--sidebar-border))]">
        <motion.div
          animate={{ opacity: isExpanded ? 1 : 0, width: isExpanded ? 'auto' : 0 }}
          transition={{ duration: 0.18 }}
          className="flex items-center gap-2.5 overflow-hidden"
        >
          <div className="relative shrink-0">
            <img
              src={companyLogo}
              className="h-8 w-8 rounded-lg object-contain"
              alt={`${companyName} Logo`}
            />
          </div>
          <div className="overflow-hidden">
            <p className="text-[13px] font-bold text-foreground whitespace-nowrap tracking-tight uppercase">{companyName}</p>
            <p className="text-[10px] text-primary whitespace-nowrap font-semibold tracking-widest -mt-0.5 uppercase">Business OS</p>
          </div>
        </motion.div>

        {/* Collapsed logo */}
        {!isExpanded && (
          <div className="absolute left-1/2 -translate-x-1/2">
            <img src={companyLogo} className="h-8 w-8 rounded-lg object-contain" alt={`${companyName} Logo`} />
          </div>
        )}

        {/* Mobile close */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="md:hidden p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5 no-scrollbar">
        {navItems.map((group) => (
          <div key={group.label}>
            {isExpanded && (
              <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/50 select-none">
                {group.label}
              </p>
            )}
            {!isExpanded && <div className="my-1 mx-auto h-px w-8 bg-border/50" />}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = item.href === '/ai-hub'
                  ? pathname === '/ai-hub'
                  : pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={!isExpanded ? item.label : undefined}
                    onClick={onMobileClose}
                  >
                    <div
                      className={cn(
                        'sidebar-item',
                        isActive ? 'active' : 'text-muted-foreground hover:text-foreground',
                        !isExpanded && 'justify-center px-0 py-2.5'
                      )}
                    >
                      <item.icon className={cn('shrink-0 transition-all', !isExpanded ? 'h-5 w-5' : 'h-4 w-4')} />
                      {isExpanded && (
                        <span className="whitespace-nowrap">{item.label}</span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer (user + collapse) ── */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-3 space-y-1 shrink-0">
        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "hidden md:flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150",
            !isExpanded && "justify-center px-0"
          )}
          title={!isExpanded ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed
            ? <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
            : <ChevronLeft className="h-4 w-4 shrink-0 text-primary" />
          }
          {isExpanded && <span>Collapse</span>}
        </button>

        {/* Profile link */}
        <Link href="/profile" onClick={onMobileClose} title={!isExpanded ? "My Profile" : undefined}>
          <div className={cn(
            "flex items-center gap-2.5 rounded-lg p-2 hover:bg-accent transition-all duration-150 cursor-pointer",
            !isExpanded && "justify-center"
          )}>
            <Avatar className="h-7 w-7 shrink-0 ring-2 ring-border">
              {user?.avatar_url && <AvatarImage src={user.avatar_url} />}
              <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                {user ? getInitials(user.name) : 'U'}
              </AvatarFallback>
            </Avatar>
            {isExpanded && (
              <div className="overflow-hidden flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground whitespace-nowrap truncate">
                  {user?.name
                    ? user.name.split(' ').map((n, i, arr) => i === arr.length - 1 ? n[0] + '.' : n).join(' ')
                    : 'User'}
                </p>
                <p className="text-[10px] text-muted-foreground whitespace-nowrap truncate">{user?.role || '...'}</p>
              </div>
            )}
          </div>
        </Link>
      </div>
    </motion.aside>
  )
}
