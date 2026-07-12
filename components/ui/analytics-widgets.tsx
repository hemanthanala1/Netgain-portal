'use client'

import * as React from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts'
import { ChartContainer } from './chart-container'
import { formatCurrency } from '@/lib/utils'
import { Resizable } from 're-resizable'

// Helpers
const exportToCSV = (filename: string, headers: string[], rows: any[][]) => {
  const content = [
    headers.join(','),
    ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
  ].join('\n')
  
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 1. Revenue vs Target Area Chart
interface RevenueChartProps {
  data: { month: string; revenue: number; target: number }[]
  loading?: boolean
}

export function RevenueChart({ data, loading = false }: RevenueChartProps) {
  const handleExport = () => {
    exportToCSV(
      'revenue_vs_target',
      ['Month', 'Revenue (₹)', 'Target (₹)'],
      data.map(d => [d.month, d.revenue, d.target])
    )
  }

  return (
    <ChartContainer
      title="Revenue Performance"
      description="Comparing monthly realized revenue against performance targets."
      loading={loading}
      isEmpty={!data || data.length === 0}
      onExport={handleExport}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
          <Tooltip 
            formatter={(v: number) => formatCurrency(v)} 
            contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 11 }} 
          />
          <Area type="monotone" name="Target" dataKey="target" stroke="#94A3B8" strokeDasharray="4 4" strokeWidth={1.5} fill="none" />
          <Area type="monotone" name="Revenue" dataKey="revenue" stroke="#D4AF37" strokeWidth={2} fill="url(#goldGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

// 2. Lead Conversion Bar Chart
interface LeadConversionChartProps {
  data: { status: string; count: number }[]
  loading?: boolean
}

export function LeadConversionChart({ data, loading = false }: LeadConversionChartProps) {
  const handleExport = () => {
    exportToCSV(
      'lead_pipeline_conversion',
      ['Status', 'Count'],
      data.map(d => [d.status, d.count])
    )
  }

  return (
    <ChartContainer
      title="Lead Stage Distribution"
      description="Volume of active sales opportunities across crm pipeline stages."
      loading={loading}
      isEmpty={!data || data.length === 0}
      onExport={handleExport}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis dataKey="status" type="category" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={80} />
          <Tooltip 
            contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 11 }} 
          />
          <Bar dataKey="count" name="Opportunities" fill="#D4AF37" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.status === 'Won' ? '#10b981' : entry.status === 'Lost' ? '#f43f5e' : '#D4AF37'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

// 3. Project Progress Status Chart
interface ProjectProgressChartProps {
  data: { name: string; budget: number; spent: number }[]
  loading?: boolean
}

export function ProjectProgressChart({ data, loading = false }: ProjectProgressChartProps) {
  const handleExport = () => {
    exportToCSV(
      'project_budget_spent',
      ['Project Name', 'Total Budget (₹)', 'Amount Spent (₹)'],
      data.map(d => [d.name, d.budget, d.spent])
    )
  }

  return (
    <ChartContainer
      title="Project Budget Allocation"
      description="Comparing allocated project budget against logged spent balances."
      loading={loading}
      isEmpty={!data || data.length === 0}
      onExport={handleExport}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
          <Tooltip 
            formatter={(v: number) => formatCurrency(v)} 
            contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 11 }} 
          />
          <Bar dataKey="budget" name="Total Budget" fill="#1e293b" stroke="hsl(var(--border))" strokeWidth={1} radius={[4, 4, 0, 0]} />
          <Bar dataKey="spent" name="Spent Amount" fill="#a78bfa" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

// 4. Invoice Status Pie Chart
interface InvoiceStatusChartProps {
  data: { name: string; value: number }[]
  loading?: boolean
}

export function InvoiceStatusChart({ data, loading = false }: InvoiceStatusChartProps) {
  const handleExport = () => {
    exportToCSV(
      'invoice_status_distribution',
      ['Invoice Status', 'Value Amount (₹)'],
      data.map(d => [d.name, d.value])
    )
  }

  const PIE_COLORS = {
    'Paid': '#10b981',
    'Overdue': '#f43f5e',
    'Sent / Unpaid': '#fbbf24',
    'Draft': '#94a3b8'
  }

  return (
    <ChartContainer
      title="Invoice Receivables"
      description="Outstanding dues grouped by status."
      loading={loading}
      isEmpty={!data || data.length === 0}
      onExport={handleExport}
    >
      <div className="flex flex-col sm:flex-row items-center justify-around w-full gap-4">
        <div className="w-[150px] h-[150px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={(PIE_COLORS as any)[entry.name] || '#D4AF37'} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(v: number) => formatCurrency(v)} 
                contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 11 }} 
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2 text-xs w-full max-w-[160px] pr-4 sm:pr-0">
          {data.map((d, i) => (
            <div key={i} className="flex items-center justify-between gap-2 border-b border-border/10 pb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: (PIE_COLORS as any)[d.name] || '#D4AF37' }} />
                <span className="truncate text-muted-foreground font-medium text-[10px]">{d.name}</span>
              </div>
              <span className="font-semibold text-foreground text-[10px]">{formatCurrency(d.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartContainer>
  )
}

// 5. Meeting Analytics Line Chart
interface MeetingAnalyticsChartProps {
  data: { date: string; count: number }[]
  loading?: boolean
}

export function MeetingAnalyticsChart({ data, loading = false }: MeetingAnalyticsChartProps) {
  const handleExport = () => {
    exportToCSV(
      'meeting_trends',
      ['Date', 'Meetings Scheduled'],
      data.map(d => [d.date, d.count])
    )
  }

  return (
    <ChartContainer
      title="Meeting Frequency"
      description="Tracking calendar meetings booked over selected days."
      loading={loading}
      isEmpty={!data || data.length === 0}
      onExport={handleExport}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
          <Tooltip 
            contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 11 }} 
          />
          <Line type="monotone" dataKey="count" name="Meetings" stroke="#60a5fa" strokeWidth={2.5} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

// 6. Task Completion Area Chart
interface TaskCompletionChartProps {
  data: { date: string; completed: number; created: number }[]
  loading?: boolean
}

export function TaskCompletionChart({ data, loading = false }: TaskCompletionChartProps) {
  const handleExport = () => {
    exportToCSV(
      'task_completion_rates',
      ['Date', 'Created Tasks', 'Completed Tasks'],
      data.map(d => [d.date, d.created, d.completed])
    )
  }

  return (
    <ChartContainer
      title="Task Velocity"
      description="Comparing newly created tasks vs completed tasks timeline."
      loading={loading}
      isEmpty={!data || data.length === 0}
      onExport={handleExport}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="taskCompleteGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
          <Tooltip 
            contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 11 }} 
          />
          <Area type="monotone" name="Created" dataKey="created" stroke="#fbbf24" strokeWidth={1.5} fill="none" />
          <Area type="monotone" name="Completed" dataKey="completed" stroke="#10b981" strokeWidth={2} fill="url(#taskCompleteGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

// 7. Support Ticket Analytics Bar Chart
interface SupportTicketAnalyticsProps {
  data: { category: string; open: number; resolved: number }[]
  loading?: boolean
}

export function SupportTicketAnalytics({ data, loading = false }: SupportTicketAnalyticsProps) {
  const handleExport = () => {
    exportToCSV(
      'support_ticket_analytics',
      ['Category / Client', 'Open Tickets', 'Resolved Tickets'],
      data.map(d => [d.category, d.open, d.resolved])
    )
  }

  return (
    <ChartContainer
      title="Support Backlog"
      description="Logged client support requests grouped by resolution status."
      loading={loading}
      isEmpty={!data || data.length === 0}
      onExport={handleExport}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis dataKey="category" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
          <Tooltip 
            contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 11 }} 
          />
          <Bar dataKey="open" name="Active / Open" fill="#f87171" radius={[4, 4, 0, 0]} />
          <Bar dataKey="resolved" name="Resolved" fill="#34d399" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

// 8. Revenue Forecast Chart
interface RevenueForecastChartProps {
  data: { month: string; actual: number; forecast: number }[]
  loading?: boolean
}

export function RevenueForecastChart({ data, loading = false }: RevenueForecastChartProps) {
  const handleExport = () => {
    exportToCSV(
      'revenue_forecast',
      ['Month', 'Actual Revenue (₹)', 'Forecast Revenue (₹)'],
      data.map(d => [d.month, d.actual || '', d.forecast])
    )
  }

  return (
    <ChartContainer
      title="Revenue Forecast"
      description="Historical realized revenue alongside predictive forward-looking forecasts."
      loading={loading}
      isEmpty={!data || data.length === 0}
      onExport={handleExport}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
          <Tooltip 
            formatter={(v: number) => formatCurrency(v)} 
            contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 11 }} 
          />
          <Area type="monotone" name="Actual Revenue" dataKey="actual" stroke="#D4AF37" strokeWidth={2.5} fill="none" />
          <Area type="monotone" name="Forecast Model" dataKey="forecast" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="4 4" fill="url(#forecastGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

// 9. Cash Flow Chart
interface CashFlowChartProps {
  data: { month: string; inflow: number; outflow: number }[]
  loading?: boolean
}

export function CashFlowChart({ data, loading = false }: CashFlowChartProps) {
  const handleExport = () => {
    exportToCSV(
      'cash_flow_summary',
      ['Month', 'Cash Inflow (₹)', 'Cash Outflow (₹)'],
      data.map(d => [d.month, d.inflow, d.outflow])
    )
  }

  return (
    <ChartContainer
      title="Cash Flow Summary"
      description="Comparing monthly realized inflows vs operational expenditures."
      loading={loading}
      isEmpty={!data || data.length === 0}
      onExport={handleExport}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
          <Tooltip 
            formatter={(v: number) => formatCurrency(v)} 
            contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 11 }} 
          />
          <Bar dataKey="inflow" name="Cash Inflow" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="outflow" name="Cash Outflow" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

// 10. Sales Funnel Chart
interface SalesFunnelChartProps {
  data: { stage: string; count: number; value: number }[]
  loading?: boolean
}

export function SalesFunnelChart({ data, loading = false }: SalesFunnelChartProps) {
  const handleExport = () => {
    exportToCSV(
      'sales_funnel_stages',
      ['Stage', 'Leads Count', 'Potential Value (₹)'],
      data.map(d => [d.stage, d.count, d.value])
    )
  }

  return (
    <ChartContainer
      title="Sales Funnel Pipeline"
      description="Distribution of prospective deals across pipeline lifecycle stages."
      loading={loading}
      isEmpty={!data || data.length === 0}
      onExport={handleExport}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis dataKey="stage" type="category" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={95} />
          <Tooltip 
            formatter={(v: any, name: string) => name === 'value' ? formatCurrency(v) : `${v} leads`}
            contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 11 }} 
          />
          <Bar dataKey="count" name="Leads Volume" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

// 11. Top Clients & Services
interface TopClientsServicesProps {
  clients: { name: string; revenue: number }[]
  services: { name: string; salesCount: number; revenue: number }[]
  loading?: boolean
}

export function TopClientsServices({ clients, services, loading = false }: TopClientsServicesProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ChartContainer title="Top Clients by Revenue" description="Key accounts bringing in the highest billing volume." loading={loading} isEmpty={clients.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={clients} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={100} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>

      <ChartContainer title="Top Performing Services" description="Most popular services and packages sold by total volume." loading={loading} isEmpty={services.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={services}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Bar dataKey="revenue" fill="#D4AF37" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  )
}

// 12. Project Profitability Matrix
import { Badge } from './badge'
import { Card, CardHeader, CardTitle } from './card'

interface ProjectProfitabilityProps {
  projects: { name: string; budget: number; spent: number; profit: number }[]
}

export function ProjectProfitabilityTable({ projects }: ProjectProfitabilityProps) {
  return (
    <Resizable
      minWidth={200}
      minHeight={200}
      className="z-10 bg-card rounded-xl"
      enable={{ top: true, right: true, bottom: true, left: true, topRight: true, bottomRight: true, bottomLeft: true, topLeft: true }}
    >
      <Card className="w-full h-full border-border bg-transparent overflow-auto">
        <CardHeader className="py-3.5 px-4 border-b border-border/60">
        <CardTitle className="text-xs font-semibold text-gold">Project Profitability Matrix</CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-muted/15 border-b border-border/80 text-muted-foreground font-semibold">
              <th className="py-2.5 px-4">Project</th>
              <th className="py-2.5 px-3 text-right">Budget</th>
              <th className="py-2.5 px-3 text-right">Spent</th>
              <th className="py-2.5 px-4 text-right">Margin %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {projects.map((p, idx) => {
              const margin = ((p.profit / p.budget) * 100).toFixed(0)
              const isProfit = p.profit >= 0
              return (
                <tr key={idx} className="hover:bg-muted/5 transition-colors">
                  <td className="py-3 px-4 font-medium text-foreground">{p.name}</td>
                  <td className="py-3 px-3 text-right text-muted-foreground">{formatCurrency(p.budget)}</td>
                  <td className="py-3 px-3 text-right text-muted-foreground">{formatCurrency(p.spent)}</td>
                  <td className="py-3 px-4 text-right">
                    <Badge variant={isProfit ? "success" : "secondary"} className="text-[10px]">
                      {margin}%
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      </Card>
    </Resizable>
  )
}

// 13. Employee Utilization List
interface EmployeeUtilizationProps {
  utilization: { name: string; role: string; capacity: number; completedTasks: number; totalTasks: number }[]
}

export function EmployeeUtilizationList({ utilization }: EmployeeUtilizationProps) {
  return (
    <Resizable
      minWidth={200}
      minHeight={200}
      className="z-10 bg-card rounded-xl"
      enable={{ top: true, right: true, bottom: true, left: true, topRight: true, bottomRight: true, bottomLeft: true, topLeft: true }}
    >
      <Card className="w-full h-full border-border bg-transparent overflow-auto">
        <CardHeader className="py-3.5 px-4 border-b border-border/60">
        <CardTitle className="text-xs font-semibold text-gold">Team Utilization & Bandwidth</CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-muted/15 border-b border-border/80 text-muted-foreground font-semibold">
              <th className="py-2.5 px-4">Employee</th>
              <th className="py-2.5 px-3">Role</th>
              <th className="py-2.5 px-3 text-center">Open Tasks</th>
              <th className="py-2.5 px-4 text-right">Utilization</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {utilization.map((e, idx) => (
              <tr key={idx} className="hover:bg-muted/5 transition-colors">
                <td className="py-3 px-4 font-medium text-foreground">{e.name}</td>
                <td className="py-3 px-3 text-muted-foreground">{e.role}</td>
                <td className="py-3 px-3 text-center text-muted-foreground">{e.totalTasks - e.completedTasks} open</td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="font-semibold text-foreground">{e.capacity}%</span>
                    <div className="w-12 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                      <div className="h-full bg-gold rounded-full" style={{ width: `${e.capacity}%` }} />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </Card>
    </Resizable>
  )
}
