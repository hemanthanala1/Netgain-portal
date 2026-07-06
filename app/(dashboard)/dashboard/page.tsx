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
          { data: projectReqs }
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
          supabase.from('project_requirements').select('*')
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
        const baseTargets = [120000, 150000, 160000, 200000, 240000, 280000]
        const revTrendList = []
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
            target: baseTargets[5 - i] || 250000
          })
          revTrendList.push(monthPaid || 10000)
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
          let budget = 150000
          let spent = 45000
          if (p.stack) {
            try {
              const extra = JSON.parse(p.stack)
              budget = Number(extra.budget) || 150000
              spent = Number(extra.spent) || 45000
            } catch (err) {}
          }
          return {
            name: p.title.slice(0, 12),
            budget,
            spent
          }
        })
        setProjectsChartData(projectsBudgetData)

        // Chart 4: Invoices Pie
        const invoicesStatusData = [
          { name: 'Paid', value: paidInvoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0) },
          { name: 'Overdue', value: invoicesOverdue },
          { name: 'Sent / Unpaid', value: invoicesDue },
          { name: 'Draft', value: invoices?.filter(i => i.status === 'draft').reduce((sum, i) => sum + (Number(i.amount) || 0), 0) || 0 }
        ]
        setInvoicesChartData(invoicesStatusData)

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

        // Chart 6: Tasks Area
        const tasksCountData = []
        for (let i = 5; i >= 0; i--) {
          const pastDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
          const pastStr = pastDate.toISOString().slice(0, 10)
          tasksCountData.push({
            date: pastDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
            created: Math.floor(Math.random() * 4) + 1,
            completed: Math.floor(Math.random() * 3) + 1
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

      } catch (err: any) {
        console.error('Error fetching dashboard database details:', err)
        toast({ title: 'Analytics Sync Error', description: err.message, variant: 'destructive' })
      }
    } else {
      // Mock Fallback Data
      setStats({
        revenueMtd: 289000,
        revenueYtd: 1475000,
        outstandingPayments: 94500,
        invoicesDue: 64500,
        invoicesOverdue: 30000,
        pipelineVal: 485000,
        newClientsCount: 6,
        activeClientsCount: 12,
        wonLeadsCount: 18,
        lostLeadsCount: 4,
        projectsInProgress: 8,
        projectsDelayed: 2,
        projectsCompleted: 14,
        meetingsToday: 3,
        pendingApprovals: 3,
        pendingSignatures: 4,
        supportTickets: 2,
        openTasksCount: 7,
        upcomingRenewalsCount: 2,
        leadConversionRate: 81
      })

      setRevenueChartData([
        { month: 'Jan', revenue: 120000, target: 100000 },
        { month: 'Feb', revenue: 189000, target: 150000 },
        { month: 'Mar', revenue: 160000, target: 160000 },
        { month: 'Apr', revenue: 267000, target: 200000 },
        { month: 'May', revenue: 312000, target: 240000 },
        { month: 'Jun', revenue: 289000, target: 280000 }
      ])

      setLeadsChartData([
        { status: 'New', count: 5 },
        { status: 'Contacted', count: 8 },
        { status: 'Negotiation', count: 4 },
        { status: 'Won', count: 18 },
        { status: 'Lost', count: 4 }
      ])

      setProjectsChartData([
        { name: 'Apex Store', budget: 180000, spent: 145000 },
        { name: 'Urban Edge', budget: 120000, spent: 85000 },
        { name: 'TechCore App', budget: 240000, spent: 110000 },
        { name: 'FashionHub', budget: 95000, spent: 95000 },
        { name: 'SLA Support', budget: 150000, spent: 30000 }
      ])

      setInvoicesChartData([
        { name: 'Paid', value: 1475000 },
        { name: 'Overdue', value: 30000 },
        { name: 'Sent / Unpaid', value: 64500 },
        { name: 'Draft', value: 12000 }
      ])

      setMeetingsChartData([
        { date: '1 Jul', count: 2 },
        { date: '2 Jul', count: 4 },
        { date: '3 Jul', count: 3 },
        { date: '4 Jul', count: 1 },
        { date: '5 Jul', count: 2 },
        { date: '6 Jul', count: 3 }
      ])

      setTasksChartData([
        { date: '1 Jul', created: 3, completed: 2 },
        { date: '2 Jul', created: 4, completed: 3 },
        { date: '3 Jul', created: 2, completed: 3 },
        { date: '4 Jul', created: 5, completed: 2 },
        { date: '5 Jul', created: 3, completed: 4 },
        { date: '6 Jul', created: 4, completed: 4 }
      ])

      setSupportChartData([
        { category: 'Billing', open: 1, resolved: 12 },
        { category: 'CRM Portal', open: 2, resolved: 8 },
        { category: 'System Integration', open: 0, resolved: 5 }
      ])

      setActivities([
        { id: '1', user_email: 'founder@netgain.studio', action: 'Approved PRD for TechCore Mobile App', module: 'prd', created_at: new Date(Date.now() - 3600000).toISOString() },
        { id: '2', user_email: 'finance@netgain.studio', action: 'Marked invoice #INV-2026-004 paid by Apex Retail', module: 'invoice', created_at: new Date(Date.now() - 7200000).toISOString() },
        { id: '3', user_email: 'pm@netgain.studio', action: 'Scheduled kickoff meeting with Urban Edge Co.', module: 'meetings', created_at: new Date(Date.now() - 14400000).toISOString() },
        { id: '4', user_email: 'sales@netgain.studio', action: 'Generated Agreement draft for TechCore Solutions', module: 'documents', created_at: new Date(Date.now() - 28800000).toISOString() },
        { id: '5', user_email: 'founder@netgain.studio', action: 'Created new client Aaron Shah (Urban Edge Co.)', module: 'crm', created_at: new Date(Date.now() - 86400000).toISOString() }
      ])
    }

    // Populate advanced BI state values
    setForecastData([
      { month: 'Mar', actual: 160000, forecast: 160000 },
      { month: 'Apr', actual: 267000, forecast: 250000 },
      { month: 'May', actual: 312000, forecast: 300000 },
      { month: 'Jun', actual: 289000, forecast: 280000 },
      { month: 'Jul', actual: 295000, forecast: 300000 },
      { month: 'Aug', actual: 0, forecast: 320000 },
      { month: 'Sep', actual: 0, forecast: 340000 }
    ])

    setCashFlowData([
      { month: 'Jan', inflow: 120000, outflow: 75000 },
      { month: 'Feb', inflow: 189000, outflow: 95000 },
      { month: 'Mar', inflow: 160000, outflow: 110000 },
      { month: 'Apr', inflow: 267000, outflow: 140000 },
      { month: 'May', inflow: 312000, outflow: 150000 },
      { month: 'Jun', inflow: 289000, outflow: 135000 }
    ])

    setSalesFunnelData([
      { stage: '1. New Lead', count: 12, value: 240000 },
      { stage: '2. Contacted', count: 8, value: 160000 },
      { stage: '3. Proposal Sent', count: 5, value: 150000 },
      { stage: '4. Negotiation', count: 3, value: 90000 },
      { stage: '5. Won', count: 18, value: 485000 }
    ])

    setTopClients([
      { name: 'Apex Retail', revenue: 450000 },
      { name: 'Urban Edge Co.', revenue: 320000 },
      { name: 'TechCore Sol', revenue: 280000 },
      { name: 'FashionHub', revenue: 195000 },
      { name: 'Global Tech', revenue: 150000 }
    ])

    setTopServices([
      { name: 'Custom Dev', salesCount: 8, revenue: 480000 },
      { name: 'SEO & Growth', salesCount: 14, revenue: 210000 },
      { name: 'Automation', salesCount: 5, revenue: 150000 },
      { name: 'Brand Design', salesCount: 6, revenue: 90000 }
    ])

    setProjectProfitability([
      { name: 'Apex Storefront', budget: 180000, spent: 125000, profit: 55000 },
      { name: 'TechCore App', budget: 240000, spent: 170000, profit: 70000 },
      { name: 'Urban Edge UI', budget: 120000, spent: 85000, profit: 35000 },
      { name: 'SLA Dashboard', budget: 150000, spent: 90000, profit: 60000 }
    ])

    setEmployeeUtilization([
      { name: 'Devon Shah', role: 'Founder & CEO', capacity: 95, completedTasks: 18, totalTasks: 20 },
      { name: 'Aaron Shah', role: 'Lead PM', capacity: 85, completedTasks: 14, totalTasks: 17 },
      { name: 'Sarah Patel', role: 'Sales Exec', capacity: 70, completedTasks: 9, totalTasks: 12 },
      { name: 'Kabir Mehta', role: 'Full Stack Dev', capacity: 90, completedTasks: 22, totalTasks: 25 },
      { name: 'Pooja Sen', role: 'UI/UX Designer', capacity: 80, completedTasks: 15, totalTasks: 19 }
    ])

    setLoading(false)
  }, [toast])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  if (userLoading || loading) {
    return (
      <div className="flex flex-col justify-center items-center py-48 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
        <span className="text-xs text-muted-foreground font-semibold">Streaming command center data...</span>
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
              <SelectTrigger className="h-8 text-[11px] w-40 bg-black/30 border-gold/30 hover:border-gold/60 text-gold font-bold">
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
