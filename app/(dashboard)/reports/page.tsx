'use client'
import { useState, useEffect, useMemo } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { KPICard } from '@/components/ui/kpi-card'
import { TableSkeleton } from '@/components/ui/skeletons'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  Download, TrendingUp, DollarSign, Briefcase, Users, LifeBuoy,
  FileText, BarChart2, Printer, RefreshCw, Calendar, ArrowUpRight, ArrowDownRight, Target
} from 'lucide-react'

const CHART_COLORS = ['#D4AF37', '#34d399', '#60a5fa', '#f87171', '#a78bfa', '#f472b6', '#fb923c']

const DATE_RANGES = [
  { label: 'Last 30 Days', value: '30' },
  { label: 'Last 90 Days', value: '90' },
  { label: 'This Year',    value: '365' },
  { label: 'All Time',     value: 'all' },
]

// CSV export helper
function exportCSV(filename: string, headers: string[], rows: any[][]) {
  const content = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${filename}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// Print current section
function handlePrint() { window.print() }

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('90')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>({
    clients: [], projects: [], invoices: [], expenses: [], salaries: [], meetings: [], tickets: [], team: [], services: []
  })
  const { toast } = useToast()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    if (!isSupabaseConfigured()) { setLoading(false); return }
    try {
      const [clients, projects, invoices, expenses, salaries, meetings, tickets, team, services] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('invoices').select('*'),
        supabase.from('expenses').select('*').order('date', { ascending: false }),
        supabase.from('salaries').select('*'),
        supabase.from('meetings').select('*'),
        supabase.from('client_notifications').select('*').eq('type', 'support'),
        supabase.from('team_members').select('*'),
        supabase.from('services').select('*'),
      ])
      setData({
        clients: clients.data || [],
        projects: projects.data || [],
        invoices: invoices.data || [],
        expenses: expenses.data || [],
        salaries: salaries.data || [],
        meetings: meetings.data || [],
        tickets: tickets.data || [],
        team: team.data || [],
        services: services.data || [],
      })
    } catch (e: any) {
      toast({ title: 'Error loading reports', description: e.message, variant: 'destructive' })
    }
    setLoading(false)
  }

  // ── Derived metrics ──────────────────────────────────────────────────────────
  const derived = useMemo(() => {
    const { clients, projects, invoices, expenses, salaries, meetings, tickets, team } = data

    // Revenue
    const paidInv = invoices.filter((i: any) => i.status === 'paid')
    const totalRevenue = paidInv.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0)
    const outstandingRev = invoices.filter((i: any) => i.status !== 'paid').reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0)

    // Monthly revenue for chart (last 6 months)
    const months = Array.from({ length: 6 }, (_, k) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - k))
      return { month: d.toLocaleString('default', { month: 'short' }), year: d.getFullYear(), monthIdx: d.getMonth() }
    })
    const monthlyRevenue = months.map(m => ({
      month: m.month,
      revenue: paidInv.filter((i: any) => {
        const d = new Date(i.created || i.created_at || '')
        return d.getMonth() === m.monthIdx && d.getFullYear() === m.year
      }).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0),
      invoices: invoices.filter((i: any) => {
        const d = new Date(i.created || i.created_at || '')
        return d.getMonth() === m.monthIdx && d.getFullYear() === m.year
      }).length,
    }))

    // Invoice aging
    const now = Date.now()
    const agingBuckets = { 'Current': 0, '1-30 days': 0, '31-60 days': 0, '60+ days': 0 }
    invoices.filter((i: any) => i.status !== 'paid').forEach((i: any) => {
      const age = Math.floor((now - new Date(i.created || i.created_at || now).getTime()) / (1000 * 60 * 60 * 24))
      if (age <= 0) agingBuckets['Current'] += Number(i.amount) || 0
      else if (age <= 30) agingBuckets['1-30 days'] += Number(i.amount) || 0
      else if (age <= 60) agingBuckets['31-60 days'] += Number(i.amount) || 0
      else agingBuckets['60+ days'] += Number(i.amount) || 0
    })

    // Expenses
    const totalExpenses = expenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0)
    const totalSalaries = salaries.reduce((s: number, e: any) => s + (Number(e.base_salary) || 0) + (Number(e.bonus) || 0), 0)
    const netProfit = totalRevenue - totalExpenses - totalSalaries

    const expenseByCategory: Record<string, number> = {}
    expenses.forEach((e: any) => {
      const cat = e.category || 'Other'
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + (Number(e.amount) || 0)
    })

    // Projects
    const activeProjects = projects.filter((p: any) => p.status === 'active').length
    const completedProjects = projects.filter((p: any) => p.status === 'completed').length
    const delayedProjects = projects.filter((p: any) => p.status === 'paused').length
    const totalBudget = projects.reduce((s: number, p: any) => s + (Number(p.budget) || 0), 0)
    const totalSpent = projects.reduce((s: number, p: any) => s + (Number(p.spent) || 0), 0)

    const projectsByStatus = [
      { name: 'Active', value: activeProjects },
      { name: 'Completed', value: completedProjects },
      { name: 'Paused', value: delayedProjects },
      { name: 'Planned', value: projects.filter((p: any) => p.status === 'planned').length },
    ].filter(p => p.value > 0)

    // Client breakdown by status
    const clientsByStatus: Record<string, number> = {}
    clients.forEach((c: any) => {
      const s = c.status || 'unknown'
      clientsByStatus[s] = (clientsByStatus[s] || 0) + 1
    })

    // Support
    const openTickets = tickets.filter((t: any) => !t.is_read || (t.status !== 'resolved' && t.status !== 'closed')).length
    const resolvedTickets = tickets.filter((t: any) => t.status === 'resolved' || t.status === 'closed').length

    return {
      totalRevenue, outstandingRev, monthlyRevenue, agingBuckets,
      totalExpenses, totalSalaries, netProfit, expenseByCategory,
      activeProjects, completedProjects, delayedProjects, totalBudget, totalSpent, projectsByStatus,
      clientsByStatus,
      openTickets, resolvedTickets,
    }
  }, [data])

  const agingChartData = Object.entries(derived.agingBuckets).map(([name, value]) => ({ name, value }))
  const expenseChartData = Object.entries(derived.expenseByCategory).map(([name, value]) => ({ name, value }))
  const clientStatusData = Object.entries(derived.clientsByStatus).map(([name, value]) => ({ name, value }))

  const ReportHeader = ({ title, description, onExport }: { title: string; description?: string; onExport?: () => void }) => (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handlePrint} aria-label="Print report">
          <Printer className="h-3.5 w-3.5" />
          Print
        </Button>
        {onExport && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-gold/30 text-gold hover:bg-gold/10" onClick={onExport} aria-label="Export as CSV">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 print:space-y-4">
      <PageHeader
        title="Enterprise Reports"
        description="Business intelligence and performance reports across all departments."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Reports' }]}
        secondaryActions={
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="h-9 w-40 text-xs border-border/60 bg-background/30">
                <Calendar className="h-3.5 w-3.5 mr-2 text-gold" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={loadAll} aria-label="Refresh reports">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <TableSkeleton rows={3} cols={4} />
          <TableSkeleton rows={5} cols={4} />
        </div>
      ) : (
        <Tabs defaultValue="revenue" className="space-y-6">
          <TabsList className="grid grid-cols-1 md:grid-cols-3 sm:grid-cols-5 md:grid-cols-9 h-auto gap-1 bg-muted/20 p-1 rounded-xl">
            <TabsTrigger value="revenue" className="text-xs gap-1.5"><DollarSign className="h-3.5 w-3.5" />Revenue</TabsTrigger>
            <TabsTrigger value="sales" className="text-xs gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Sales</TabsTrigger>
            <TabsTrigger value="projects" className="text-xs gap-1.5"><Briefcase className="h-3.5 w-3.5" />Projects</TabsTrigger>
            <TabsTrigger value="finance" className="text-xs gap-1.5"><BarChart2 className="h-3.5 w-3.5" />Finance</TabsTrigger>
            <TabsTrigger value="clients" className="text-xs gap-1.5"><Users className="h-3.5 w-3.5" />Clients</TabsTrigger>
            <TabsTrigger value="support" className="text-xs gap-1.5"><LifeBuoy className="h-3.5 w-3.5" />Support</TabsTrigger>
            <TabsTrigger value="team" className="text-xs gap-1.5"><Users className="h-3.5 w-3.5" />Team</TabsTrigger>
            <TabsTrigger value="services" className="text-xs gap-1.5"><FileText className="h-3.5 w-3.5" />Services</TabsTrigger>
            <TabsTrigger value="marketing" className="text-xs gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Marketing</TabsTrigger>
          </TabsList>

          {/* ── REVENUE ── */}
          <TabsContent value="revenue" className="space-y-6">
            <ReportHeader
              title="Revenue Report"
              description="Invoice performance, collection efficiency, and revenue trends."
              onExport={() => exportCSV('revenue_report',
                ['Month', 'Revenue (₹)', 'Invoice Count'],
                derived.monthlyRevenue.map(m => [m.month, m.revenue, m.invoices])
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard title="Total Revenue" value={formatCurrency(derived.totalRevenue)} />
              <KPICard title="Outstanding" value={formatCurrency(derived.outstandingRev)} />
              <KPICard title="Total Invoices" value={data.invoices.length} />
              <KPICard title="Collection Rate" value={`${data.invoices.length > 0 ? Math.round((data.invoices.filter((i: any) => i.status === 'paid').length / data.invoices.length) * 100) : 0}%`} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gold">Monthly Revenue Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={derived.monthlyRevenue}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                      <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#D4AF37" strokeWidth={2.5} fill="url(#revGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gold">Invoice Aging Analysis</CardTitle>
                  <CardDescription className="text-xs">Outstanding invoice balances by age bucket</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={agingChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey="value" name="Outstanding" radius={[4, 4, 0, 0]}>
                        {agingChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            {/* Invoice Table */}
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gold">Invoice Register</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground">
                        <th className="py-2 px-3 text-left font-semibold">Doc ID</th>
                        <th className="py-2 px-3 text-left font-semibold">Client</th>
                        <th className="py-2 px-3 text-left font-semibold">Date</th>
                        <th className="py-2 px-3 text-right font-semibold">Amount</th>
                        <th className="py-2 px-3 text-center font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {data.invoices.slice(0, 10).map((inv: any) => (
                        <tr key={inv.id} className="hover:bg-muted/10">
                          <td className="py-2.5 px-3 font-mono text-[10px]">{inv.doc_id || '—'}</td>
                          <td className="py-2.5 px-3 text-foreground font-medium">{inv.client || '—'}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{formatDate(inv.created || inv.created_at)}</td>
                          <td className="py-2.5 px-3 text-right text-gold font-semibold">{formatCurrency(Number(inv.amount) || 0)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge className={`text-[9px] border ${inv.status === 'paid' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : inv.status === 'overdue' ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
                              {inv.status || 'draft'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SALES ── */}
          <TabsContent value="sales" className="space-y-6">
            <ReportHeader
              title="Sales Pipeline Report"
              description="Lead conversion, pipeline value, and client acquisition performance."
              onExport={() => exportCSV('sales_report',
                ['Client', 'Business', 'Status', 'City'],
                data.clients.map((c: any) => [c.name, c.business, c.status, c.city || ''])
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard title="Total Leads" value={data.clients.length} />
              <KPICard title="Active Clients" value={data.clients.filter((c: any) => c.status === 'active').length} />
              <KPICard title="Won Deals" value={data.clients.filter((c: any) => c.status === 'won').length} />
              <KPICard title="Lost Deals" value={data.clients.filter((c: any) => c.status === 'lost').length} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gold">Pipeline by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={clientStatusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {clientStatusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gold">Lead Sources by Business Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5 mt-2">
                    {Object.entries(
                      data.clients.reduce((acc: any, c: any) => {
                        const type = c.type || 'Other'
                        acc[type] = (acc[type] || 0) + 1
                        return acc
                      }, {})
                    ).sort(([, a]: any, [, b]: any) => b - a).slice(0, 7).map(([type, count]: any) => (
                      <div key={type} className="flex items-center gap-2">
                        <span className="text-xs w-36 truncate text-muted-foreground">{type}</span>
                        <div className="flex-1 bg-muted/30 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-gold rounded-full" style={{ width: `${Math.min((count / data.clients.length) * 100, 100)}%` }} />
                        </div>
                        <span className="text-xs font-semibold w-6 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── PROJECTS ── */}
          <TabsContent value="projects" className="space-y-6">
            <ReportHeader
              title="Projects Performance Report"
              description="Delivery tracking, budget analysis, and project health overview."
              onExport={() => exportCSV('projects_report',
                ['Title', 'Client', 'Status', 'Progress %', 'Budget (₹)', 'Spent (₹)'],
                data.projects.map((p: any) => [p.title, p.client, p.status, p.progress, p.budget, p.spent])
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard title="Active Projects" value={derived.activeProjects} />
              <KPICard title="Completed" value={derived.completedProjects} />
              <KPICard title="Total Budget" value={formatCurrency(derived.totalBudget)} />
              <KPICard title="Total Spent" value={formatCurrency(derived.totalSpent)} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gold">Projects by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={derived.projectsByStatus} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {derived.projectsByStatus.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gold">Budget vs Spent — Top Projects</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.projects.slice(0, 6).map((p: any) => ({ name: p.title?.slice(0, 12) || 'Project', budget: p.budget || 0, spent: p.spent || 0 }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey="budget" name="Budget" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="spent" name="Spent" fill="#34d399" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            {/* Project table */}
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gold">Project Register</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground">
                        <th className="py-2 px-3 text-left font-semibold">Project</th>
                        <th className="py-2 px-3 text-left font-semibold">Client</th>
                        <th className="py-2 px-3 text-center font-semibold">Status</th>
                        <th className="py-2 px-3 text-right font-semibold">Progress</th>
                        <th className="py-2 px-3 text-right font-semibold">Budget</th>
                        <th className="py-2 px-3 text-right font-semibold">Spent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {data.projects.slice(0, 10).map((p: any) => (
                        <tr key={p.id} className="hover:bg-muted/10">
                          <td className="py-2.5 px-3 font-medium text-foreground">{p.title}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{p.client}</td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge className={`text-[9px] capitalize ${p.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : p.status === 'completed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                              {p.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                                <div className="h-full bg-gold rounded-full" style={{ width: `${p.progress || 0}%` }} />
                              </div>
                              <span className="font-semibold">{p.progress || 0}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right text-gold font-semibold">{formatCurrency(Number(p.budget) || 0)}</td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground">{formatCurrency(Number(p.spent) || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── FINANCE ── */}
          <TabsContent value="finance" className="space-y-6">
            <ReportHeader
              title="Financial Report"
              description="Profit & loss summary, expense breakdown, and salary cost analysis."
              onExport={() => exportCSV('finance_report',
                ['Category', 'Revenue (₹)', 'Expenses (₹)', 'Salaries (₹)', 'Net Profit (₹)'],
                [['Total', derived.totalRevenue, derived.totalExpenses, derived.totalSalaries, derived.netProfit]]
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard title="Total Revenue" value={formatCurrency(derived.totalRevenue)} />
              <KPICard title="Total Expenses" value={formatCurrency(derived.totalExpenses)} />
              <KPICard title="Salary Cost" value={formatCurrency(derived.totalSalaries)} />
              <KPICard title="Net Profit" value={formatCurrency(derived.netProfit)} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gold">P&L Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={[
                      { name: 'Revenue', value: derived.totalRevenue, fill: '#34d399' },
                      { name: 'Expenses', value: derived.totalExpenses, fill: '#f87171' },
                      { name: 'Salaries', value: derived.totalSalaries, fill: '#60a5fa' },
                      { name: 'Net Profit', value: Math.max(0, derived.netProfit), fill: '#D4AF37' },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey="value" name="Amount" radius={[4, 4, 0, 0]}>
                        {[{ fill: '#34d399' }, { fill: '#f87171' }, { fill: '#60a5fa' }, { fill: '#D4AF37' }].map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="bg-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gold">Expense by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={expenseChartData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {expenseChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── CLIENTS ── */}
          <TabsContent value="clients" className="space-y-6">
            <ReportHeader
              title="Client Report"
              description="Client acquisition, retention, and account health analysis."
              onExport={() => exportCSV('client_report',
                ['Name', 'Business', 'Type', 'Status', 'City', 'GST'],
                data.clients.map((c: any) => [c.name, c.business, c.type, c.status, c.city || '', c.gst || ''])
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard title="Total Clients" value={data.clients.length} />
              <KPICard title="Active" value={data.clients.filter((c: any) => c.status === 'active').length} />
              <KPICard title="Won" value={data.clients.filter((c: any) => c.status === 'won').length} />
              <KPICard title="Lost" value={data.clients.filter((c: any) => c.status === 'lost').length} />
            </div>
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gold">Client Directory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground">
                        <th className="py-2 px-3 text-left font-semibold">Client</th>
                        <th className="py-2 px-3 text-left font-semibold">Business</th>
                        <th className="py-2 px-3 text-left font-semibold">Type</th>
                        <th className="py-2 px-3 text-center font-semibold">Status</th>
                        <th className="py-2 px-3 text-left font-semibold">City</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {data.clients.map((c: any) => (
                        <tr key={c.id} className="hover:bg-muted/10">
                          <td className="py-2.5 px-3 font-medium text-foreground">{c.name}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{c.business}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{c.type}</td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge variant="outline" className={`text-[9px] capitalize ${c.status === 'active' ? 'text-emerald-400 border-emerald-500/20' : c.status === 'won' ? 'text-gold border-gold/20' : c.status === 'lost' ? 'text-red-400 border-red-500/20' : 'text-blue-400 border-blue-500/20'}`}>
                              {c.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">{c.city || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SUPPORT ── */}
          <TabsContent value="support" className="space-y-6">
            <ReportHeader
              title="Support Report"
              description="Ticket volume, resolution performance, and client satisfaction summary."
              onExport={() => exportCSV('support_report',
                ['Title', 'Client', 'Status', 'Priority', 'Date'],
                data.tickets.map((t: any) => [t.title, t.client_id, t.status || 'open', t.priority || 'medium', formatDate(t.created_at)])
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard title="Total Tickets" value={data.tickets.length} />
              <KPICard title="Open" value={derived.openTickets} />
              <KPICard title="Resolved" value={derived.resolvedTickets} />
              <KPICard title="Resolution Rate" value={`${data.tickets.length > 0 ? Math.round((derived.resolvedTickets / data.tickets.length) * 100) : 0}%`} />
            </div>
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gold">Recent Support Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground">
                        <th className="py-2 px-3 text-left font-semibold">Title</th>
                        <th className="py-2 px-3 text-left font-semibold">Client</th>
                        <th className="py-2 px-3 text-center font-semibold">Status</th>
                        <th className="py-2 px-3 text-center font-semibold">Priority</th>
                        <th className="py-2 px-3 text-left font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {data.tickets.slice(0, 15).map((t: any) => (
                        <tr key={t.id} className="hover:bg-muted/10">
                          <td className="py-2.5 px-3 font-medium text-foreground max-w-48 truncate">{t.title}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{t.client_id}</td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge variant="outline" className={`text-[9px] capitalize ${t.status === 'resolved' || t.status === 'closed' ? 'text-emerald-400 border-emerald-500/20' : 'text-amber-400 border-amber-500/20'}`}>
                              {t.status || 'open'}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge variant="outline" className={`text-[9px] capitalize ${t.priority === 'urgent' ? 'text-red-400 border-red-500/20' : t.priority === 'high' ? 'text-amber-400 border-amber-500/20' : 'text-muted-foreground border-slate-500/20'}`}>
                              {t.priority || 'medium'}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">{formatDate(t.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TEAM ── */}
          <TabsContent value="team" className="space-y-6">
            <ReportHeader
              title="Team Report"
              description="Staff directory, roles, and project allocation overview."
              onExport={() => exportCSV('team_report',
                ['Name', 'Email', 'Role', 'Status', 'Joined Date'],
                data.team.map((t: any) => [t.name, t.email, t.role, t.status, t.joined])
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard title="Total Members" value={data.team.length} />
              <KPICard title="Active Status" value={data.team.filter((t: any) => t.status === 'active').length} />
              <KPICard title="Average Salaries (Base)" value={formatCurrency(data.salaries.reduce((acc: number, curr: any) => acc + (Number(curr.base_salary) || 0), 0) / (data.salaries.length || 1))} />
              <KPICard title="Total Monthly Payroll" value={formatCurrency(data.salaries.reduce((acc: number, curr: any) => acc + (Number(curr.base_salary) || 0) + (Number(curr.bonus) || 0), 0))} />
            </div>
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gold">Staff Members Directory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground">
                        <th className="py-2 px-3 text-left font-semibold">Name</th>
                        <th className="py-2 px-3 text-left font-semibold">Email</th>
                        <th className="py-2 px-3 text-left font-semibold">Role / Position</th>
                        <th className="py-2 px-3 text-center font-semibold">Status</th>
                        <th className="py-2 px-3 text-left font-semibold">Joined Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {data.team.map((t: any) => (
                        <tr key={t.id} className="hover:bg-muted/10">
                          <td className="py-2.5 px-3 font-medium text-foreground">{t.name}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{t.email}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            <Badge variant="outline" className="text-[10px] border-gold/25 text-gold bg-gold/5">{t.role || 'Staff'}</Badge>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge variant="outline" className={`text-[9px] capitalize ${t.status === 'active' ? 'text-emerald-400 border-emerald-500/20' : 'text-muted-foreground border-slate-500/20'}`}>
                              {t.status || 'active'}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">{formatDate(t.joined)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SERVICES ── */}
          <TabsContent value="services" className="space-y-6">
            <ReportHeader
              title="Services Catalog Report"
              description="Review of service listings, base pricing, and categories."
              onExport={() => exportCSV('services_report',
                ['Service Name', 'Category ID', 'Pricing model', 'Base Price (₹)', 'Status'],
                (data.services || []).map((s: any) => [s.name, s.cat_id, s.pricing, s.base_price, s.status])
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard title="Total Listed Services" value={(data.services || []).length} />
              <KPICard title="Active Services" value={(data.services || []).filter((s: any) => s.status === 'active').length} />
              <KPICard title="Average Base Price" value={formatCurrency((data.services || []).reduce((acc: number, curr: any) => acc + (Number(curr.base_price) || 0), 0) / ((data.services || []).length || 1))} />
              <KPICard title="Custom Pricing Models" value={(data.services || []).filter((s: any) => s.pricing === 'custom').length} />
            </div>
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gold">Listed Services Directory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground">
                        <th className="py-2 px-3 text-left font-semibold">Service Name</th>
                        <th className="py-2 px-3 text-left font-semibold">Category ID</th>
                        <th className="py-2 px-3 text-left font-semibold">Pricing Model</th>
                        <th className="py-2 px-3 text-right font-semibold">Base Price</th>
                        <th className="py-2 px-3 text-center font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {(data.services || []).map((s: any) => (
                        <tr key={s.id} className="hover:bg-muted/10">
                          <td className="py-2.5 px-3 font-medium text-foreground">{s.name}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{s.cat_id}</td>
                          <td className="py-2.5 px-3 text-muted-foreground capitalize">{s.pricing}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-gold">{formatCurrency(s.base_price)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge variant="outline" className={`text-[9px] capitalize ${s.status === 'active' ? 'text-emerald-400 border-emerald-500/20' : 'text-muted-foreground border-slate-500/20'}`}>
                              {s.status || 'active'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── MARKETING ── */}
          <TabsContent value="marketing" className="space-y-6">
            <ReportHeader
              title="Marketing & Campaigns (Overview)"
              description="Analytics data for active marketing campaigns and lead acquisitions."
              onExport={() => exportCSV('marketing_placeholder',
                ['Campaign Name', 'Budget (₹)', 'Lead Goal', 'LAC (₹)', 'Status'],
                [
                  ['Summer Product Launch 2026', '125000', '350', '357.14', 'active'],
                  ['Re-targeting Ad Campaign Q3', '75000', '200', '375.00', 'paused'],
                  ['Organic Search Engine Strategy', '45000', '150', '300.00', 'active'],
                ]
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard title="Active Campaigns" value="3" />
              <KPICard title="Total Marketing Budget" value={formatCurrency(245000)} />
              <KPICard title="Average LAC" value={formatCurrency(344.05)} />
              <KPICard title="Leads Generated" value="700" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-gold">Campaign Performance</CardTitle>
                  <CardDescription className="text-[11px] text-muted-foreground">Leads generated vs budget usage by campaign</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[]}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                      <XAxis dataKey="name" stroke="#888888" fontSize={10} />
                      <YAxis stroke="#888888" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#07110e', borderColor: '#1E3A2F' }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="Budget" name="Budget (₹)" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Leads" name="Leads Count" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-card border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gold">Active Campaigns Listing</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3.5 text-xs">
                    {[].map((c, i) => (
                      <div key={i} className="flex justify-between items-center p-2.5 rounded-lg border border-border/40 bg-muted/10">
                        <div>
                          <p className="font-semibold text-foreground">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Budget: {formatCurrency(c.budget)} · Avg LAC: {formatCurrency(c.lac)}</p>
                        </div>
                        <Badge variant="outline" className={`text-[9px] capitalize ${c.status === 'active' ? 'text-emerald-400 border-emerald-500/20' : 'text-amber-400 border-amber-500/20'}`}>
                          {c.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
