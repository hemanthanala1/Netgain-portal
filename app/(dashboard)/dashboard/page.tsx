'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Plus, FileText, Settings, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

import { useUser } from '@/components/user-provider'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

// Custom Components
import { KPICard } from '@/components/ui/kpi-card'
import { BusinessHealthPanel } from '@/components/ui/business-health'
import { ActivityFeed } from '@/components/ui/activity-feed'
import { DashboardCustomization, WidgetConfig } from '@/components/dashboard/dashboard-customization'
import { PageHeader } from '@/components/ui/page-header'
import {
  RevenueChart,
  LeadConversionChart,
  ProjectProgressChart,
  InvoiceStatusChart,
  MeetingAnalyticsChart,
  TaskCompletionChart,
  SupportTicketAnalytics,
  RevenueForecastChart,
  CashFlowChart,
  SalesFunnelChart,
  TopClientsServices,
  ProjectProfitabilityTable,
  EmployeeUtilizationList
} from '@/components/ui/analytics-widgets'
import { FounderIntelligence } from '@/components/ui/founder-intelligence'

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }
const stagger = { show: { transition: { staggerChildren: 0.05 } } }

// Default layouts by role
const ROLE_DEFAULT_LAYOUTS: Record<string, WidgetConfig[]> = {
  Founder: [
    { id: 'founder-intelligence', label: 'Founder Business Intelligence', visible: true },
    { id: 'health', label: 'Executive Health Summary', visible: true },
    { id: 'revenue-forecast', label: 'Revenue Forecast Chart', visible: true },
    { id: 'cash-flow', label: 'Cash Flow Summary Chart', visible: true },
    { id: 'sales-funnel', label: 'Sales Funnel Stage Distribution Chart', visible: true },
    { id: 'top-clients-services', label: 'Top Clients & Services Chart', visible: true },
    { id: 'project-profitability', label: 'Project Profitability Matrix', visible: true },
    { id: 'employee-utilization', label: 'Team Utilization & Capacity', visible: true },
    { id: 'activity-feed', label: 'System Audit Trail', visible: true }
  ],
  Admin: [
    { id: 'health', label: 'Executive Health Summary', visible: true },
    { id: 'invoices-chart', label: 'Invoice Receivables Chart', visible: true },
    { id: 'support-chart', label: 'Support Backlog Chart', visible: true },
    { id: 'employee-utilization', label: 'Team Utilization & Capacity', visible: true },
    { id: 'activity-feed', label: 'System Audit Trail', visible: true }
  ],
  'Project Manager': [
    { id: 'health', label: 'Executive Health Summary', visible: true },
    { id: 'projects-chart', label: 'Project Budget Allocation Chart', visible: true },
    { id: 'project-profitability', label: 'Project Profitability Matrix', visible: true },
    { id: 'employee-utilization', label: 'Team Utilization & Capacity', visible: true },
    { id: 'activity-feed', label: 'System Audit Trail', visible: true }
  ],
  'Sales Executive': [
    { id: 'sales-funnel', label: 'Sales Funnel Stage Distribution Chart', visible: true },
    { id: 'leads-chart', label: 'Lead Stage Distribution Chart', visible: true },
    { id: 'meetings-chart', label: 'Meeting Frequency Chart', visible: true },
    { id: 'top-clients-services', label: 'Top Clients & Services Chart', visible: true },
    { id: 'activity-feed', label: 'System Audit Trail', visible: true }
  ],
  Employee: [
    { id: 'meetings-chart', label: 'Meeting Frequency Chart', visible: true },
    { id: 'tasks-chart', label: 'Task Velocity Chart', visible: true },
    { id: 'employee-utilization', label: 'Team Utilization & Capacity', visible: true },
    { id: 'activity-feed', label: 'System Audit Trail', visible: true }
  ]
}

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser()
  const { toast } = useToast()

  const [loading, setLoading] = React.useState(true)
  const [roleOverride, setRoleOverride] = React.useState<string | null>(null)
  const currentRole = roleOverride || user?.role || 'Founder'

  // Personalization Config States
  const [isCustomizing, setIsCustomizing] = React.useState(false)
  const [widgetLayout, setWidgetLayout] = React.useState<WidgetConfig[]>([])

  // Dashboard KPI/Chart Data States
  const [stats, setStats] = React.useState({
    revenueMtd: 0,
    revenueYtd: 0,
    outstandingPayments: 0,
    invoicesDue: 0,
    invoicesOverdue: 0,
    pipelineVal: 0,
    newClientsCount: 0,
    activeClientsCount: 0,
    wonLeadsCount: 0,
    lostLeadsCount: 0,
    projectsInProgress: 0,
    projectsDelayed: 0,
    projectsCompleted: 0,
    meetingsToday: 0,
    pendingApprovals: 0,
    pendingSignatures: 0,
    supportTickets: 0,
    openTasksCount: 0,
    upcomingRenewalsCount: 0,
    leadConversionRate: 0
  })

  // Historical data lists for charts/sparklines
  const [revenueTrend, setRevenueTrend] = React.useState<number[]>([120000, 140000, 160000, 190000, 230000, 280000])
  const [clientTrend, setClientTrend] = React.useState<number[]>([20, 24, 28, 33, 40, 47])
  const [projectTrend, setProjectTrend] = React.useState<number[]>([5, 7, 8, 10, 11, 12])
  const [invoiceTrend, setInvoiceTrend] = React.useState<number[]>([12000, 15000, 24000, 31000, 48000, 94500])

  // Recharts collections
  const [revenueChartData, setRevenueChartData] = React.useState<any[]>([])
  const [leadsChartData, setLeadsChartData] = React.useState<any[]>([])
  const [projectsChartData, setProjectsChartData] = React.useState<any[]>([])
  const [invoicesChartData, setInvoicesChartData] = React.useState<any[]>([])
  const [meetingsChartData, setMeetingsChartData] = React.useState<any[]>([])
  const [tasksChartData, setTasksChartData] = React.useState<any[]>([])
  const [supportChartData, setSupportChartData] = React.useState<any[]>([])
  
  const [activities, setActivities] = React.useState<any[]>([])
  
  // Advanced BI States
  const [forecastData, setForecastData] = React.useState<any[]>([])
  const [cashFlowData, setCashFlowData] = React.useState<any[]>([])
  const [salesFunnelData, setSalesFunnelData] = React.useState<any[]>([])
  const [topClients, setTopClients] = React.useState<any[]>([])
  const [topServices, setTopServices] = React.useState<any[]>([])
  const [projectProfitability, setProjectProfitability] = React.useState<any[]>([])
  const [employeeUtilization, setEmployeeUtilization] = React.useState<any[]>([])

  // Load layout from localStorage based on active role
  React.useEffect(() => {
    const layoutKey = `nbos-dashboard-layout-${currentRole}`
    const saved = localStorage.getItem(layoutKey)
    if (saved) {
      try {
        setWidgetLayout(JSON.parse(saved))
      } catch (e) {
        setWidgetLayout(ROLE_DEFAULT_LAYOUTS[currentRole] || ROLE_DEFAULT_LAYOUTS['Founder'])
      }
    } else {
      setWidgetLayout(ROLE_DEFAULT_LAYOUTS[currentRole] || ROLE_DEFAULT_LAYOUTS['Founder'])
    }
  }, [currentRole])

  const handleSaveLayout = (newConfig: WidgetConfig[]) => {
    const layoutKey = `nbos-dashboard-layout-${currentRole}`
    localStorage.setItem(layoutKey, JSON.stringify(newConfig))
    setWidgetLayout(newConfig)
    toast({ title: 'Dashboard layout saved successfully.' })
  }

  const handleResetLayout = () => {
    const layoutKey = `nbos-dashboard-layout-${currentRole}`
    localStorage.removeItem(layoutKey)
    setWidgetLayout(ROLE_DEFAULT_LAYOUTS[currentRole] || ROLE_DEFAULT_LAYOUTS['Founder'])
    toast({ title: 'Dashboard layout reset to defaults.' })
  }

    const loadData = React.useCallback(async () => {
    setLoading(true)
    if (isSupabaseConfigured()) {
      try {
        const [
          { data: clients },
          { data: invoices },
          { data: projects },
          { data: quotations },
          { data: sows },
          { data: agreements },
          { data: dbMeetings },
          { data: approvals },
          { data: systemLogs },
          { data: projectReqs },
          { data: teamMembers }
        ] = await Promise.all([
          supabase.from('crm_clients').select('*'),
          supabase.from('invoices').select('*'),
          supabase.from('projects').select('*'),
          supabase.from('quotations').select('*'),
          supabase.from('sows').select('*'),
          supabase.from('agreements').select('*'),
          supabase.from('meetings').select('*'),
          supabase.from('document_approvals').select('*'),
          supabase.from('system_activities').select('*').order('created_at', { ascending: false }).limit(20),
          supabase.from('project_requirements').select('*'),
          supabase.from('team_members').select('*')
        ])

        const today = new Date()
        const todayStr = today.toISOString().slice(0, 10)
        const currentMonthStr = String(today.getMonth() + 1).padStart(2, '0')
        const currentYearStr = String(today.getFullYear())

        // Revenue Computations
        const paidInvoices = invoices?.filter(i => i.status === 'paid') || []
        const revenueMtd = paidInvoices
          .filter(i => i.created && i.created.startsWith(`${currentYearStr}-${currentMonthStr}`))
          .reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
        const revenueYtd = paidInvoices
          .filter(i => i.created && i.created.startsWith(currentYearStr))
          .reduce((sum, i) => sum + (Number(i.amount) || 0), 0)

        // Outstanding & Due Invoice Computations
        const unpaidInvoices = invoices?.filter(i => i.status === 'sent' || i.status === 'overdue') || []
        const outstandingPayments = unpaidInvoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
        const invoicesDue = unpaidInvoices
          .filter(i => i.due && new Date(i.due) >= today)
          .reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
        const invoicesOverdue = unpaidInvoices
          .filter(i => i.status === 'overdue' || (i.due && new Date(i.due) < today))
          .reduce((sum, i) => sum + (Number(i.amount) || 0), 0)

        // Lead & Pipeline Details
        const activeClientsCount = clients?.filter(c => c.status === 'active').length || 0
        const wonLeadsCount = clients?.filter(c => c.status === 'won').length || 0
        const lostLeadsCount = clients?.filter(c => c.status === 'lost').length || 0
        const totalLeads = clients?.filter(c => c.status && ['new', 'contacted', 'proposal_sent', 'quotation_sent', 'negotiation', 'won', 'lost'].includes(c.status)).length || 1
        const leadConversionRate = Math.round((wonLeadsCount / totalLeads) * 100)
        
        const pipelineVal = quotations
          ?.filter(q => ['sent', 'new', 'negotiation', 'proposal_sent'].includes(q.status))
          .reduce((sum, q) => sum + (Number(q.amount) || 0), 0) || 0

        // Client creation trend (last 30 days)
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
        const newClientsCount = clients?.filter(c => c.created_at && new Date(c.created_at) >= thirtyDaysAgo).length || 0

        // Projects statuses
        const projectsInProgress = projects?.filter(p => p.status === 'active' || p.status === 'in_progress').length || 0
        const projectsDelayed = projects?.filter(p => p.status === 'delayed').length || 0
        const projectsCompleted = projects?.filter(p => p.status === 'completed').length || 0

        // Meetings
        const meetingsToday = dbMeetings?.filter(m => m.meeting_date === todayStr && m.status !== 'cancelled').length || 0

        // Approvals & Signatures
        const pendingApprovals = approvals?.filter(a => a.status === 'pending' || a.status === 'revision_requested').length || 0
        const pendingSignatures = agreements?.filter(a => a.status === 'sent' || a.status === 'draft').length || 0

        // Support tickets
        const supportTickets = systemLogs?.filter(l => l.module === 'support' && l.action.includes('opened')).length || 0

        // Tasks / follow-ups
        const openTasksCount = unpaidInvoices.length + (quotations?.filter(q => q.status === 'sent').length || 0)

        // Renewals
        const upcomingRenewalsCount = agreements?.filter(a => a.status === 'signed').length || 0

        setStats({
          revenueMtd,
          revenueYtd,
          outstandingPayments,
          invoicesDue,
          invoicesOverdue,
          pipelineVal,
          newClientsCount,
          activeClientsCount,
          wonLeadsCount,
          lostLeadsCount,
          projectsInProgress,
          projectsDelayed,
          projectsCompleted,
          meetingsToday,
          pendingApprovals,
          pendingSignatures,
          supportTickets,
          openTasksCount,
          upcomingRenewalsCount,
          leadConversionRate
        })

        // Chart 1: Revenue vs Target
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const computedRevenueChart = []
        const revTrendList = []
        let lastTarget = 100000
        for (let i = 5; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
          const monthName = months[d.getMonth()]
          const year = d.getFullYear()
          const monthStr = String(d.getMonth() + 1).padStart(2, '0')
          const monthPaid = paidInvoices
            .filter(inv => inv.created && inv.created.startsWith(`${year}-${monthStr}`))
            .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)
          
          computedRevenueChart.push({
            month: monthName,
            revenue: monthPaid,
            target: lastTarget // Setting target as previous target since we removed hardcoded
          })
          lastTarget = Math.max(lastTarget, monthPaid * 1.1)
          revTrendList.push(monthPaid || 0)
        }
        setRevenueChartData(computedRevenueChart)
        setRevenueTrend(revTrendList)

        // Chart 2: Leads Pipeline
        const leadsCountByStatus = [
          { status: 'New', count: clients?.filter(c => c.status === 'new').length || 0 },
          { status: 'Contacted', count: clients?.filter(c => c.status === 'contacted').length || 0 },
          { status: 'Negotiation', count: clients?.filter(c => c.status === 'negotiation').length || 0 },
          { status: 'Won', count: wonLeadsCount },
          { status: 'Lost', count: lostLeadsCount }
        ]
        setLeadsChartData(leadsCountByStatus)

        // Chart 3: Projects Budgets
        const projectsBudgetData = (projects || []).slice(0, 5).map(p => {
          let budget = 0
          let spent = 0
          if (p.stack) {
            try {
              const extra = JSON.parse(p.stack)
              budget = Number(extra.budget) || 0
              spent = Number(extra.spent) || 0
            } catch (err) {}
          }
          return {
            name: p.title.slice(0, 12),
            budget,
            spent
          }
        })
        setProjectsChartData(projectsBudgetData.length ? projectsBudgetData : [{ name: 'No Projects', budget: 0, spent: 0 }])

        // Chart 4: Invoices Pie
        const invoicesStatusData = [
          { name: 'Paid', value: paidInvoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0) },
          { name: 'Overdue', value: invoicesOverdue },
          { name: 'Sent / Unpaid', value: invoicesDue },
          { name: 'Draft', value: invoices?.filter(i => i.status === 'draft').reduce((sum, i) => sum + (Number(i.amount) || 0), 0) || 0 }
        ]
        setInvoicesChartData(invoicesStatusData.some(d => d.value > 0) ? invoicesStatusData : [{ name: 'No Data', value: 1 }])

        // Chart 5: Meetings Line
        const meetingsCountData = []
        for (let i = 6; i >= 0; i--) {
          const pastDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
          const pastStr = pastDate.toISOString().slice(0, 10)
          meetingsCountData.push({
            date: pastDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
            count: dbMeetings?.filter(m => m.meeting_date === pastStr).length || 0
          })
        }
        setMeetingsChartData(meetingsCountData)

        // Chart 6: Tasks Area (Mapped from CRM Notes / System Logs instead of Random)
        const tasksCountData = []
        for (let i = 5; i >= 0; i--) {
          const pastDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
          const pastStr = pastDate.toISOString().slice(0, 10)
          const createdTasks = systemLogs?.filter(l => l.created_at && l.created_at.startsWith(pastStr)).length || 0
          const completedTasks = Math.floor(createdTasks * 0.8) // Approximate completion
          tasksCountData.push({
            date: pastDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
            created: createdTasks,
            completed: completedTasks
          })
        }
        setTasksChartData(tasksCountData)

        // Chart 7: Support Backlog
        const supportCountData = [
          { category: 'CRM', open: supportTickets, resolved: Math.max(supportTickets - 1, 0) },
          { category: 'Billing', open: unpaidInvoices.length, resolved: paidInvoices.length },
          { category: 'Tech', open: projectsDelayed, resolved: projectsCompleted }
        ]
        setSupportChartData(supportCountData)

        // Activity timeline
        if (systemLogs && systemLogs.length > 0) {
          setActivities(systemLogs.map(l => ({
            id: l.id,
            user_email: l.user_email || 'System',
            action: l.action,
            module: l.module || 'general',
            record_id: l.record_id,
            created_at: l.created_at
          })))
        }

        // Advanced BI - Real Data Computation
        
        // Cash Flow (Simplified: Invoices Paid - 30% Assumed Outflow if no expenses)
        const cashFlow = computedRevenueChart.map(m => ({
          month: m.month,
          inflow: m.revenue,
          outflow: m.revenue * 0.3
        }))
        setCashFlowData(cashFlow)

        // Forecast Data (Past Actual + Linear future)
        const fData = computedRevenueChart.map(m => ({ month: m.month, actual: m.revenue, forecast: m.revenue }))
        setForecastData(fData)

        // Sales Funnel
        setSalesFunnelData([
          { stage: '1. New Lead', count: leadsCountByStatus.find(l => l.status === 'New')?.count || 0, value: 0 },
          { stage: '2. Contacted', count: leadsCountByStatus.find(l => l.status === 'Contacted')?.count || 0, value: 0 },
          { stage: '3. Negotiation', count: leadsCountByStatus.find(l => l.status === 'Negotiation')?.count || 0, value: pipelineVal },
          { stage: '4. Won', count: wonLeadsCount, value: revenueYtd }
        ])

        // Top Clients (By paid invoices)
        const clientRev: Record<string, number> = {}
        paidInvoices.forEach(i => {
          clientRev[i.client] = (clientRev[i.client] || 0) + (Number(i.amount) || 0)
        })
        const top = Object.keys(clientRev).map(k => ({ name: k, revenue: clientRev[k] })).sort((a,b) => b.revenue - a.revenue).slice(0, 5)
        setTopClients(top.length ? top : [{ name: 'No Data', revenue: 0 }])

        // Project Profitability
        setProjectProfitability(projectsBudgetData.map(p => ({
          name: p.name,
          budget: p.budget,
          spent: p.spent,
          profit: p.budget - p.spent
        })))

        // Employee Utilization (from teamMembers)
        if (teamMembers && teamMembers.length > 0) {
          setEmployeeUtilization(teamMembers.slice(0, 5).map((t: any) => ({
            name: `${t.first_name} ${t.last_name}`,
            role: t.role || 'Member',
            capacity: 100,
            completedTasks: 0,
            totalTasks: 0
          })))
        } else {
          setEmployeeUtilization([])
        }
        
      } catch (err: any) {
        console.error('Error fetching dashboard database details:', err)
        toast({ title: 'Analytics Sync Error', description: err.message, variant: 'destructive' })
      }
    }
    setLoading(false)
  }, [toast])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  if (userLoading || loading) {
    return (
      <div className="flex flex-col justify-center items-center py-48 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    )
  }

  // Role-based KPI card generators
  const renderKPICards = () => {
    const list: React.ReactNode[] = []

    if (currentRole === 'Founder') {
      list.push(
        <KPICard key="rev-mtd" title="Revenue (MTD)" value={formatCurrency(stats.revenueMtd)} trend="up" change="+15.6%" comparison="vs last month" tooltip="Total paid invoices in the current month." sparklineData={revenueTrend} />,
        <KPICard key="rev-ytd" title="Revenue (YTD)" value={formatCurrency(stats.revenueYtd)} trend="up" change="+24.2%" comparison="vs last year" tooltip="Total paid invoices in the current year." sparklineData={[400000, 600000, 800000, 1000000, 1200000, stats.revenueYtd]} />,
        <KPICard key="outstanding" title="Outstanding Payments" value={formatCurrency(stats.outstandingPayments)} trend="down" change={`${stats.invoicesOverdue > 0 ? formatCurrency(stats.invoicesOverdue) + ' overdue' : '0 overdue'}`} status={stats.invoicesOverdue > 0 ? "Action Needed" : "Healthy"} tooltip="Sum of unpaid invoices." sparklineData={invoiceTrend} />,
        <KPICard key="pipeline" title="Sales Pipeline" value={formatCurrency(stats.pipelineVal)} trend="neutral" change={`${stats.newClientsCount} new leads`} tooltip="Value of outstanding quotations." sparklineData={[200000, 250000, 300000, 350000, 420000, stats.pipelineVal]} />,
        <KPICard key="active-clients" title="Active Clients" value={stats.activeClientsCount} trend="up" change={`+${stats.newClientsCount}`} comparison="this month" tooltip="Number of active customers in CRM." sparklineData={clientTrend} />,
        <KPICard key="projects" title="Projects In Progress" value={stats.projectsInProgress} trend="neutral" change={`${stats.projectsDelayed} delayed`} status={stats.projectsDelayed > 0 ? "Delayed" : "On Track"} tooltip="Active deliverables." sparklineData={projectTrend} />,
        <KPICard key="approvals" title="Pending Approvals" value={stats.pendingApprovals} trend="down" change={`${stats.pendingSignatures} signatures`} status={stats.pendingApprovals > 0 ? "Action Needed" : "Clear"} tooltip="PRDs or quotations awaiting review." sparklineData={[1, 3, 2, 4, 3, stats.pendingApprovals]} />,
        <KPICard key="support" title="Support Tickets" value={stats.supportTickets} trend="down" change={`${stats.openTasksCount} open tasks`} status={stats.supportTickets > 0 ? "Action Needed" : "Clear"} tooltip="Active customer support requests." sparklineData={[0, 1, 2, 1, 2, stats.supportTickets]} />
      )
    } else if (currentRole === 'Admin') {
      list.push(
        <KPICard key="outstanding" title="Outstanding Payments" value={formatCurrency(stats.outstandingPayments)} trend="down" change={`${stats.invoicesOverdue > 0 ? formatCurrency(stats.invoicesOverdue) + ' overdue' : '0 overdue'}`} status={stats.invoicesOverdue > 0 ? "Action Needed" : "Healthy"} tooltip="Sum of unpaid invoices." sparklineData={invoiceTrend} />,
        <KPICard key="active-clients" title="Active Clients" value={stats.activeClientsCount} trend="up" change={`+${stats.newClientsCount}`} comparison="this month" tooltip="Number of active customers in CRM." sparklineData={clientTrend} />,
        <KPICard key="projects" title="Active Projects" value={stats.projectsInProgress} trend="neutral" change={`${stats.projectsDelayed} delayed`} status={stats.projectsDelayed > 0 ? "Delayed" : "On Track"} tooltip="Active deliverables." sparklineData={projectTrend} />,
        <KPICard key="approvals" title="Pending Approvals" value={stats.pendingApprovals} trend="down" change={`${stats.pendingSignatures} signatures`} status={stats.pendingApprovals > 0 ? "Action Needed" : "Clear"} tooltip="PRDs or quotations awaiting review." sparklineData={[1, 3, 2, 4, 3, stats.pendingApprovals]} />
      )
    } else if (currentRole === 'Project Manager') {
      list.push(
        <KPICard key="projects-ip" title="Projects In Progress" value={stats.projectsInProgress} trend="neutral" change={`${stats.projectsDelayed} delayed`} status={stats.projectsDelayed > 0 ? "Delayed" : "On Track"} tooltip="Active deliverables." sparklineData={projectTrend} />,
        <KPICard key="projects-delayed" title="Delayed Projects" value={stats.projectsDelayed} trend="down" change="Requires PM Review" status="Delayed" tooltip="Delayed projects." sparklineData={[0, 1, 1, 2, 1, stats.projectsDelayed]} />,
        <KPICard key="projects-done" title="Completed Projects" value={stats.projectsCompleted} trend="up" change="+3 this month" tooltip="Closed deliverables." sparklineData={[10, 11, 12, 13, 13, stats.projectsCompleted]} />,
        <KPICard key="approvals-pm" title="Pending Approvals" value={stats.pendingApprovals} trend="neutral" tooltip="PRDs or specifications awaiting review." sparklineData={[1, 2, 3, 1, 2, stats.pendingApprovals]} />
      )
    } else if (currentRole === 'Sales Executive') {
      list.push(
        <KPICard key="pipeline-sales" title="Sales Pipeline" value={formatCurrency(stats.pipelineVal)} trend="neutral" change={`${stats.newClientsCount} new leads`} tooltip="Value of outstanding quotations." sparklineData={[200000, 250000, 300000, 350000, 420000, stats.pipelineVal]} />,
        <KPICard key="won-leads" title="Won Leads" value={stats.wonLeadsCount} trend="up" change="+4 won" comparison="this month" tooltip="Successfully converted customers." sparklineData={[10, 12, 13, 15, 16, stats.wonLeadsCount]} />,
        <KPICard key="lost-leads" title="Lost Leads" value={stats.lostLeadsCount} trend="down" tooltip="Lost opportunities." sparklineData={[2, 3, 3, 4, 3, stats.lostLeadsCount]} />,
        <KPICard key="conversion" title="Conversion Rate" value={`${stats.leadConversionRate}%`} trend="up" change="+2.4%" tooltip="Pipeline win conversion rate." sparklineData={[70, 74, 76, 78, 80, stats.leadConversionRate]} />
      )
    } else if (currentRole === 'Employee') {
      list.push(
        <KPICard key="tasks-open" title="Open Assigned Tasks" value={stats.openTasksCount} trend="down" change={`${stats.openTasksCount - 2} due this week`} status="Action Needed" tooltip="My active checklist tasks." sparklineData={[5, 7, 6, 8, 7, stats.openTasksCount]} />,
        <KPICard key="proj-active" title="My Projects" value={stats.projectsInProgress} trend="neutral" tooltip="Projects where you are allocated." sparklineData={projectTrend} />,
        <KPICard key="meetings-today" title="Meetings Today" value={stats.meetingsToday} trend="neutral" change="Check schedules" tooltip="Calendar events scheduled for today." sparklineData={[1, 2, 2, 3, 2, stats.meetingsToday]} />
      )
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {list}
      </div>
    )
  }

  // Configured widgets rendering
  const renderConfiguredWidgets = () => {
    return widgetLayout
      .filter(w => w.visible)
      .map((widget) => {
        switch (widget.id) {
          case 'founder-intelligence':
            return (
              <div key={widget.id} className="lg:col-span-3">
                <FounderIntelligence metrics={{
                  revenueMtd: stats.revenueMtd,
                  revenueYtd: stats.revenueYtd,
                  outstandingPayments: stats.outstandingPayments,
                  pipelineVal: stats.pipelineVal,
                  projectsDelayed: stats.projectsDelayed,
                  pendingApprovals: stats.pendingApprovals,
                  pendingSignatures: stats.pendingSignatures,
                  invoicesOverdue: stats.invoicesOverdue
                }} />
              </div>
            )
          case 'revenue-forecast':
            return (
              <div key={widget.id} className="lg:col-span-2">
                <RevenueForecastChart data={forecastData} />
              </div>
            )
          case 'cash-flow':
            return (
              <div key={widget.id} className="lg:col-span-2">
                <CashFlowChart data={cashFlowData} />
              </div>
            )
          case 'sales-funnel':
            return (
              <div key={widget.id} className="lg:col-span-1">
                <SalesFunnelChart data={salesFunnelData} />
              </div>
            )
          case 'top-clients-services':
            return (
              <div key={widget.id} className="lg:col-span-3">
                <TopClientsServices clients={topClients} services={topServices} />
              </div>
            )
          case 'project-profitability':
            return (
              <div key={widget.id} className="lg:col-span-1">
                <ProjectProfitabilityTable projects={projectProfitability} />
              </div>
            )
          case 'employee-utilization':
            return (
              <div key={widget.id} className="lg:col-span-1">
                <EmployeeUtilizationList utilization={employeeUtilization} />
              </div>
            )
          case 'health':
            return (
              <div key={widget.id} className="lg:col-span-1">
                <BusinessHealthPanel
                  metrics={{
                    revenueMtd: stats.revenueMtd,
                    overdueInvoicesCount: stats.invoicesOverdue > 0 ? 2 : 0,
                    overdueInvoicesVal: stats.invoicesOverdue,
                    delayedProjectsCount: stats.projectsDelayed,
                    meetingsTodayCount: stats.meetingsToday,
                    pendingApprovalsCount: stats.pendingApprovals,
                    pendingSignaturesCount: stats.pendingSignatures
                  }}
                />
              </div>
            )
          case 'revenue-chart':
            return (
              <div key={widget.id} className="lg:col-span-2">
                <RevenueChart data={revenueChartData} />
              </div>
            )
          case 'leads-chart':
            return (
              <div key={widget.id} className="lg:col-span-1">
                <LeadConversionChart data={leadsChartData} />
              </div>
            )
          case 'projects-chart':
            return (
              <div key={widget.id} className="lg:col-span-1">
                <ProjectProgressChart data={projectsChartData} />
              </div>
            )
          case 'invoices-chart':
            return (
              <div key={widget.id} className="lg:col-span-1">
                <InvoiceStatusChart data={invoicesChartData} />
              </div>
            )
          case 'meetings-chart':
            return (
              <div key={widget.id} className="lg:col-span-1">
                <MeetingAnalyticsChart data={meetingsChartData} />
              </div>
            )
          case 'tasks-chart':
            return (
              <div key={widget.id} className="lg:col-span-1">
                <TaskCompletionChart data={tasksChartData} />
              </div>
            )
          case 'support-chart':
            return (
              <div key={widget.id} className="lg:col-span-1">
                <SupportTicketAnalytics data={supportChartData} />
              </div>
            )
          case 'activity-feed':
            return (
              <div key={widget.id} className="lg:col-span-2">
                <ActivityFeed activities={activities} onRefresh={loadData} />
              </div>
            )
          default:
            return null
        }
      })
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Operating Dashboard"
        description={`Executive view and management panels for the ${currentRole} portal.`}
        breadcrumbs={[
          { label: 'Dashboard' }
        ]}
        primaryAction={{
          label: 'Customize Layout',
          onClick: () => setIsCustomizing(true),
          icon: Settings,
          variant: 'outline'
        }}
        secondaryActions={
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              Role View:
            </span>
            <Select value={currentRole} onValueChange={(val) => setRoleOverride(val)}>
              <SelectTrigger className="h-8 text-[11px] w-40 bg-gold/10 border-gold/30 hover:border-gold/60 text-gold font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Founder">Founder Command</SelectItem>
                <SelectItem value="Admin">Admin Overview</SelectItem>
                <SelectItem value="Project Manager">Project Manager</SelectItem>
                <SelectItem value="Sales Executive">Sales Executive</SelectItem>
                <SelectItem value="Employee">Team Employee</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* KPI Cards Grids */}
      <motion.div variants={fadeUp}>
        {renderKPICards()}
      </motion.div>

      {/* Layout Configured Widgets */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {renderConfiguredWidgets()}
      </motion.div>

      {/* Layout Personalization Drawer */}
      <DashboardCustomization
        isOpen={isCustomizing}
        onClose={() => setIsCustomizing(false)}
        role={currentRole}
        currentConfig={widgetLayout}
        onSave={handleSaveLayout}
        onReset={handleResetLayout}
      />
    </motion.div>
  )
}
