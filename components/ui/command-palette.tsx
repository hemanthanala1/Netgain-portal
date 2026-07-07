import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Dialog, DialogContent } from './dialog'
import { Input } from './input'
import { 
  Search, FileText, FolderKanban, Users, Calendar, Settings, 
  PlusCircle, Sparkles, HelpCircle, Briefcase, Zap, X, ShieldAlert 
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchItem {
  id: string
  title: string
  subtitle: string
  category: 'Clients' | 'Projects' | 'Documents' | 'Meetings' | 'Services' | 'Actions'
  link: string
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<SearchItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Quick actions always available
  const quickActions: SearchItem[] = [
    { id: 'act-1', title: 'Create Client', subtitle: 'Add a new client to the CRM', category: 'Actions', link: '/crm?autoOpen=true' },
    { id: 'act-2', title: 'Create Quotation', subtitle: 'Generate a new client quotation', category: 'Actions', link: '/documents/quotations?autoOpen=true' },
    { id: 'act-3', title: 'Create Invoice', subtitle: 'Generate a tax invoice', category: 'Actions', link: '/documents/invoices?autoOpen=true' },
    { id: 'act-4', title: 'Create SOW', subtitle: 'Draft a new Scope of Work document', category: 'Actions', link: '/documents/sow?autoOpen=true' },
    { id: 'act-5', title: 'Create Agreement', subtitle: 'Draft a service agreement or contract', category: 'Actions', link: '/documents/agreements?autoOpen=true' },
    { id: 'act-6', title: 'Create Project', subtitle: 'Initialize a project strategy workspace', category: 'Actions', link: '/projects?autoOpen=true' },
    { id: 'act-7', title: 'Create Meeting', subtitle: 'Schedule calendar event or appointment', category: 'Actions', link: '/meetings?autoOpen=true' },
    { id: 'act-8', title: 'Open Dashboard', subtitle: 'View system health & core metrics', category: 'Actions', link: '/dashboard' },
  ]

  // Listen to keyboard shortcut (CTRL/CMD + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Load and index searchable data
  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelectedIndex(0)

    async function loadSearchData() {
      setLoading(true)
      const searchItems: SearchItem[] = [...quickActions]

      if (isSupabaseConfigured()) {
        try {
          const [clients, projects, meetings, services, quotations, invoices, sows, agreements] = await Promise.all([
            supabase.from('crm_clients').select('id, name, business'),
            supabase.from('projects').select('id, title, client'),
            supabase.from('meetings').select('id, client_name, event_type'),
            supabase.from('services').select('id, name').eq('status', 'active'),
            supabase.from('quotations').select('id, doc_id, client'),
            supabase.from('invoices').select('id, doc_id, client'),
            supabase.from('sows').select('id, doc_id, client'),
            supabase.from('agreements').select('id, doc_id, client'),
          ])

          if (clients.data) {
            clients.data.forEach(c => searchItems.push({
              id: `c-${c.id}`, title: c.business || c.name, subtitle: `Client Contact: ${c.name}`, category: 'Clients', link: `/crm/${c.id}`
            }))
          }
          if (projects.data) {
            projects.data.forEach(p => searchItems.push({
              id: `p-${p.id}`, title: p.title, subtitle: `Project — Client: ${p.client}`, category: 'Projects', link: `/projects?projectId=${p.id}`
            }))
          }
          if (meetings.data) {
            meetings.data.forEach(m => searchItems.push({
              id: `m-${m.id}`, title: `${m.event_type || 'Meeting'} with ${m.client_name}`, subtitle: 'Calendar Appointment', category: 'Meetings', link: `/meetings`
            }))
          }
          if (services.data) {
            services.data.forEach(s => searchItems.push({
              id: `s-${s.id}`, title: s.name, subtitle: 'Services Catalog', category: 'Services', link: `/services`
            }))
          }

          const addDoc = (arr: any[] | null, type: string, path: string) => {
            if (arr) {
              arr.forEach(d => searchItems.push({
                id: `${type}-${d.id}`, title: d.doc_id || `${type} Document`, subtitle: `Document — Client: ${d.client}`, category: 'Documents', link: path
              }))
            }
          }
          addDoc(quotations.data, 'Quotation', '/documents/quotations')
          addDoc(invoices.data, 'Invoice', '/documents/invoices')
          addDoc(sows.data, 'SOW', '/documents/sow')
          addDoc(agreements.data, 'Agreement', '/documents/agreements')

        } catch (err) {
          console.error('Error loading search index:', err)
        }
      }
      setItems(searchItems)
      setLoading(false)
    }

    loadSearchData()
  }, [open])

  // Filter items based on query
  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 10) // Show default actions + first items
    const q = query.toLowerCase().trim()
    return items.filter(item => 
      item.title.toLowerCase().includes(q) || 
      item.subtitle.toLowerCase().includes(q) || 
      item.category.toLowerCase().includes(q)
    ).slice(0, 10)
  }, [items, query])

  // Handle select / action trigger
  const handleSelect = (item: SearchItem) => {
    setOpen(false)
    router.push(item.link)
  }

  // Key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % filtered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const categoryIcons: Record<string, any> = {
    Clients: Users,
    Projects: FolderKanban,
    Documents: FileText,
    Meetings: Calendar,
    Services: Briefcase,
    Actions: Zap
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl p-0 border-border bg-popover text-popover-foreground overflow-hidden shadow-2xl rounded-2xl">
        <div className="relative border-b border-border/40">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            className="w-full pl-12 pr-10 py-4 h-12 border-0 bg-transparent text-sm focus-visible:ring-0 text-foreground"
            placeholder="Search anything or run action... (e.g. 'Won', 'Redesign', 'Create Quote')"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-[360px] overflow-y-auto p-2 divide-y divide-border/20">
          {loading && (
            <div className="text-center py-6 text-xs text-muted-foreground">
              Pre-caching client and project files...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-xs">
              <ShieldAlert className="h-8 w-8 text-gold/30 mb-2" />
              No results matching "{query}"
            </div>
          )}

          {!loading && filtered.map((item: SearchItem, idx: number) => {
            const Icon = categoryIcons[item.category] || HelpCircle
            const isSelected = idx === selectedIndex
            return (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 select-none",
                  isSelected ? "bg-gold/10 text-foreground border-l-2 border-gold font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted/10 border-l-2 border-transparent"
                )}
              >
                <div className={cn("p-1.5 rounded-lg shrink-0", isSelected ? "bg-gold text-foreground" : "bg-muted/30 text-gold")}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold leading-tight truncate">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
                </div>
                <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border font-mono", isSelected ? "border-gold/30 text-gold bg-gold/5" : "border-border text-muted-foreground")}>
                  {item.category}
                </span>
              </div>
            )
          })}
        </div>

        {/* Footer shortcuts helper */}
        <div className="bg-muted/40 px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/30">
          <div className="flex items-center gap-2">
            <span>Navigation:</span>
            <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border">↑↓</kbd> to select
            <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border">Enter</kbd> to open
          </div>
          <div>
            Press <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border">ESC</kbd> to close
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
