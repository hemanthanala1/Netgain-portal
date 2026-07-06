import React, { useState } from 'react'
import { Plus, Users, FileText, Zap, Receipt, ClipboardList, HandshakeIcon, Calendar } from 'lucide-react'
import { Button } from './button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './dropdown-menu'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export function QuickActionButton() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const items = [
    { label: 'Create Client', icon: Users, href: '/crm?autoOpen=true' },
    { label: 'Create Quotation', icon: FileText, href: '/documents/quotations?autoOpen=true' },
    { label: 'Create Invoice', icon: Receipt, href: '/documents/invoices?autoOpen=true' },
    { label: 'Create SOW', icon: ClipboardList, href: '/documents/sow?autoOpen=true' },
    { label: 'Create Agreement', icon: HandshakeIcon, href: '/documents/agreements?autoOpen=true' },
    { label: 'Create Project', icon: Zap, href: '/projects?autoOpen=true' },
    { label: 'Create Meeting', icon: Calendar, href: '/meetings?autoOpen=true' },
  ]

  const handleNavigate = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 hidden sm:block">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full bg-gold hover:bg-gold/90 text-slate-950 shadow-lg transition-transform duration-200 border border-gold/30 hover:scale-105 active:scale-95",
              open && "rotate-45"
            )}
            title="Quick Action"
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 border-border/80 bg-[#07110E] p-1.5 shadow-2xl rounded-xl mb-2" sideOffset={10}>
          <DropdownMenuLabel className="text-[10px] uppercase font-bold text-gold tracking-wider px-2 py-1.5">
            Quick Actions
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border/40" />
          <div className="space-y-0.5">
            {items.map(item => {
              const Icon = item.icon
              return (
                <DropdownMenuItem
                  key={item.label}
                  onClick={() => handleNavigate(item.href)}
                  className="flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg cursor-pointer text-slate-200 hover:text-white hover:bg-gold/10 focus:bg-gold/10"
                >
                  <Icon className="h-4 w-4 text-gold" />
                  {item.label}
                </DropdownMenuItem>
              )
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
