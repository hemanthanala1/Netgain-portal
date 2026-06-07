'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn, getInitials } from '@/lib/utils'
import { useUser } from '@/components/user-provider'
import {
  LayoutDashboard, Users, Briefcase, FileText, Receipt, ClipboardList, HandshakeIcon,
  FolderOpen, Cpu, TrendingUp, MessageSquare, UserCog, Settings, ChevronLeft,
  ChevronRight, Zap, BarChart3, FileCode2, X, DollarSign
} from 'lucide-react'
import { useState } from 'react'

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
    label: 'Intelligence',
    items: [
      { href: '/projects', icon: Zap, label: 'Projects' },
      { href: '/prd', icon: FileCode2, label: 'PRD Engine' },
      { href: '/marketing', icon: BarChart3, label: 'Marketing Reports' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/finance', icon: DollarSign, label: 'Finance' },
      { href: '/communications', icon: MessageSquare, label: 'Communications' },
      { href: '/team', icon: UserCog, label: 'Team' },
      { href: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

export function Sidebar({ onMobileClose }: { onMobileClose?: () => void }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useUser()

  return (
    <motion.aside
      animate={{ width: collapsed && !onMobileClose ? 64 : 240 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative flex h-screen flex-col border-r border-border bg-[hsl(var(--sidebar-bg))] overflow-hidden"
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-white/5 px-4 shrink-0">
        <motion.div
          animate={{ opacity: collapsed && !onMobileClose ? 0 : 1, width: collapsed && !onMobileClose ? 0 : 'auto' }}
          className="flex items-center gap-2 overflow-hidden"
        >
          <div className="h-7 w-7 rounded-lg gold-gradient flex items-center justify-center shrink-0">
            <span className="text-xs font-black text-white">N</span>
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white whitespace-nowrap">NETGAIN</p>
            <p className="text-[10px] text-gold/70 whitespace-nowrap -mt-0.5">BUSINESS OS</p>
          </div>
        </motion.div>
        {collapsed && !onMobileClose && (
          <div className="h-7 w-7 rounded-lg gold-gradient flex items-center justify-center shrink-0">
            <span className="text-xs font-black text-white">N</span>
          </div>
        )}
        {onMobileClose && (
          <button onClick={onMobileClose} className="md:hidden text-white/50 hover:text-white p-1">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {navItems.map((group) => (
          <div key={group.label}>
            {(!collapsed || onMobileClose) && (
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link key={item.href} href={item.href} title={collapsed && !onMobileClose ? item.label : undefined} onClick={onMobileClose}>
                    <div
                      className={cn(
                        'sidebar-item',
                        isActive ? 'active' : 'text-white/50 hover:text-white/90',
                        collapsed && !onMobileClose && 'justify-center px-0 py-2.5'
                      )}
                    >
                      <item.icon className={cn('shrink-0', collapsed && !onMobileClose ? 'h-5 w-5' : 'h-4 w-4')} />
                      {(!collapsed || onMobileClose) && (
                        <span className="whitespace-nowrap text-sm">{item.label}</span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      {/* User Footer */}
      {!collapsed && (
        <div className="border-t border-white/5 p-3">
          <Link href="/profile" onClick={onMobileClose}>
            <div className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/5 transition-colors cursor-pointer">
              <div className="h-7 w-7 rounded-full gold-gradient flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-white">
                  {user ? getInitials(user.name) : 'DS'}
                </span>
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white whitespace-nowrap">
                  {user?.name ? (user.name.split(' ').map((n, i, arr) => i === arr.length - 1 ? n[0] + '.' : n).join(' ')) : 'User'}
                </p>
                <p className="text-[10px] text-white/40 whitespace-nowrap">{user?.role || 'Loading...'}</p>
              </div>
            </div>
          </Link>
        </div>
      )}
    </motion.aside>
  )
}
