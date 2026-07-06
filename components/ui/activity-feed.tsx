'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from './input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { Button } from './button'
import { 
  Users, Receipt, Zap, FileText, Calendar, Shield, MessageSquare, 
  Settings, CheckCircle2, AlertTriangle, ArrowRight, UserCheck, Filter, Search, RotateCcw
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Activity {
  id: string
  user_email: string
  action: string
  module: string
  record_id?: string
  created_at: string
}

interface ActivityFeedProps {
  activities: Activity[]
  loading?: boolean
  onRefresh?: () => void
}

export function ActivityFeed({ activities, loading = false, onRefresh }: ActivityFeedProps) {
  const [search, setSearch] = React.useState('')
  const [moduleFilter, setModuleFilter] = React.useState('all')
  const [dateFilter, setDateFilter] = React.useState('all')

  const filteredActivities = React.useMemo(() => {
    return activities.filter(act => {
      // 1. Module filter
      if (moduleFilter !== 'all' && act.module !== moduleFilter) return false

      // 2. Search filter (Action or User email)
      if (search) {
        const query = search.toLowerCase()
        const matchAction = act.action?.toLowerCase().includes(query)
        const matchUser = act.user_email?.toLowerCase().includes(query)
        if (!matchAction && !matchUser) return false
      }

      // 3. Date filter
      if (dateFilter !== 'all') {
        const dateObj = new Date(act.created_at)
        const today = new Date()
        const oneDayMs = 24 * 60 * 60 * 1000

        if (dateFilter === 'today') {
          return today.toDateString() === dateObj.toDateString()
        } else if (dateFilter === 'yesterday') {
          const yesterday = new Date(today.getTime() - oneDayMs)
          return yesterday.toDateString() === dateObj.toDateString()
        } else if (dateFilter === 'week') {
          const sevenDaysAgo = new Date(today.getTime() - 7 * oneDayMs)
          return dateObj >= sevenDaysAgo
        }
      }

      return true
    })
  }, [activities, search, moduleFilter, dateFilter])

  // Get module icon
  const getModuleIcon = (module: string) => {
    switch (module.toLowerCase()) {
      case 'crm':
        return <Users className="h-3.5 w-3.5 text-green-400" />
      case 'invoice':
      case 'invoices':
      case 'finance':
        return <Receipt className="h-3.5 w-3.5 text-gold" />
      case 'projects':
      case 'project':
      case 'prd':
        return <Zap className="h-3.5 w-3.5 text-purple-400" />
      case 'documents':
      case 'quotations':
      case 'sows':
      case 'agreements':
      case 'marketing':
        return <FileText className="h-3.5 w-3.5 text-blue-400" />
      case 'meetings':
        return <Calendar className="h-3.5 w-3.5 text-sky-400" />
      case 'team':
        return <UserCheck className="h-3.5 w-3.5 text-teal-400" />
      case 'settings':
        return <Settings className="h-3.5 w-3.5 text-muted-foreground" />
      default:
        return <Shield className="h-3.5 w-3.5 text-gold" />
    }
  }

  // Get dynamic record redirect link
  const getRecordLink = (module: string, recordId?: string) => {
    if (!recordId) return '/dashboard'
    
    switch (module.toLowerCase()) {
      case 'crm':
        return `/crm/${recordId}`
      case 'projects':
      case 'project':
        return `/projects`
      case 'quotations':
        return `/documents/quotations`
      case 'invoices':
      case 'invoice':
        return `/documents/invoices`
      case 'agreements':
        return `/documents/agreements`
      case 'sows':
      case 'sow':
        return `/documents/sow`
      case 'meetings':
        return `/meetings`
      case 'team':
        return `/team`
      default:
        return '/dashboard'
    }
  }

  const handleResetFilters = () => {
    setSearch('')
    setModuleFilter('all')
    setDateFilter('all')
  }

  return (
    <Card className="border border-border/40 bg-card/60 backdrop-blur-sm h-full flex flex-col justify-between">
      <CardHeader className="p-4 pb-3 border-b border-border/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
            System Audit Trail
          </CardTitle>
          <p className="text-[10px] text-muted-foreground">Chronological log of global operating activities.</p>
        </div>
        {onRefresh && (
          <Button variant="ghost" size="icon" onClick={onRefresh} disabled={loading} className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <RotateCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        )}
      </CardHeader>
      
      {/* Filters Bar */}
      <div className="p-4 py-3 border-b border-border/10 grid grid-cols-1 sm:grid-cols-3 gap-2 bg-black/10">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
          <Input 
            className="pl-7 h-7 text-[10px] bg-black/20 border-border/30" 
            placeholder="Search email/action..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="h-7 text-[10px] bg-black/20 border-border/30">
            <SelectValue placeholder="All Modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[10px]">All Modules</SelectItem>
            <SelectItem value="crm" className="text-[10px]">CRM Client</SelectItem>
            <SelectItem value="projects" className="text-[10px]">Projects</SelectItem>
            <SelectItem value="documents" className="text-[10px]">Documents</SelectItem>
            <SelectItem value="meetings" className="text-[10px]">Meetings</SelectItem>
            <SelectItem value="team" className="text-[10px]">Team</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="h-7 text-[10px] bg-black/20 border-border/30">
            <SelectValue placeholder="All Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[10px]">All Time</SelectItem>
            <SelectItem value="today" className="text-[10px]">Today</SelectItem>
            <SelectItem value="yesterday" className="text-[10px]">Yesterday</SelectItem>
            <SelectItem value="week" className="text-[10px]">Last 7 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <CardContent className="p-4 flex-1 overflow-y-auto max-h-[380px] space-y-4 scrollbar-thin">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RotateCcw className="h-6 w-6 animate-spin text-gold" />
            <span className="mt-2 text-xs text-muted-foreground">Streaming logs...</span>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Filter className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs font-semibold">No activities match your filters</p>
            <Button variant="link" onClick={handleResetFilters} className="text-gold text-[10px] h-auto p-0 mt-1">
              Reset all filters
            </Button>
          </div>
        ) : (
          <div className="relative border-l border-border/20 pl-3.5 space-y-5 ml-1.5 py-1">
            {filteredActivities.map((act) => {
              const link = getRecordLink(act.module, act.record_id)
              return (
                <div key={act.id} className="relative group/act-item">
                  {/* Timeline point */}
                  <span className="absolute -left-[23.5px] top-1 h-4.5 w-4.5 rounded-full bg-card border border-border/50 flex items-center justify-center shrink-0 shadow-sm transition-colors group-hover/act-item:border-gold/50">
                    {getModuleIcon(act.module)}
                  </span>
                  
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10.5px] font-bold text-foreground">{act.user_email}</span>
                      <span className="text-[9px] text-muted-foreground capitalize bg-muted px-1.5 py-0.5 rounded border border-border/30">{act.module}</span>
                    </div>
                    <p className="text-xs text-muted-foreground/90 font-medium leading-relaxed mt-0.5">{act.action}</p>
                    <div className="flex items-center justify-between gap-4 mt-2">
                      <span className="text-[9.5px] text-muted-foreground/60">{formatDate(act.created_at)}</span>
                      {act.record_id && (
                        <Link href={link} className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-gold hover:underline opacity-0 group-hover/act-item:opacity-100 transition-opacity">
                          View Record
                          <ArrowRight className="h-2.5 w-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
