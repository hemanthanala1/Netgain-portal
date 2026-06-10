'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Users, FileText, Receipt, IndianRupee, TrendingUp, Clock, CheckCircle2,
  AlertCircle, ArrowUpRight, Plus, Zap, BarChart3, Loader2
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getCachedData, setCachedData } from '@/lib/data-cache'


const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }
const stagger = { show: { transition: { staggerChildren: 0.07 } } }

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalClients: 0,
    revenueMtd: 0,
    activeProjects: 0,
    pendingInvoicesVal: 0,
    clientTrend: '',
    revenueTrend: '',
    projectTrend: '',
    invoiceTrend: '',
  })
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([])
  const [topServices, setTopServices] = useState<any[]>([])

  useEffect(() => {
    const cached = getCachedData<any>('dashboard')
    if (cached) {
      setStats(cached.stats)
      setRevenueData(cached.revenueData)
      setRecentActivities(cached.recentActivities)
      setUpcomingTasks(cached.upcomingTasks)
      setTopServices(cached.topServices)
      setLoading(false)
    }

    async function loadDashboardData() {
      if (!cached) {
        setLoading(true)
      }
      if (isSupabaseConfigured()) {
        try {
          const [
            { data: clients },
            { data: invoices },
            { data: projects },
            { data: quotations },
            { data: sows },
            { data: agreements },
            { data: dbServices }
          ] = await Promise.all([
            supabase.from('crm_clients').select('id, name, created_at'),
            supabase.from('invoices').select('id, amount, status, created, due, service_ids, client'),
            supabase.from('projects').select('id, title, status, created_at, stack'),
            supabase.from('quotations').select('id, doc_id, client, created, amount, status'),
            supabase.from('sows').select('id, doc_id, client, created, status'),
            supabase.from('agreements').select('id, doc_id, client, created, status'),
            supabase.from('services').select('id, name, base_price')
          ])

          // 1. Client Metrics
          const totalClients = clients?.length || 0
          
          // 2. Active Projects
          const activeProjects = projects?.filter(p => p.status === 'active').length || 0

          // 3. Pending Invoices
          const pendingInvoices = invoices?.filter(i => i.status === 'sent' || i.status === 'overdue') || []
          const pendingInvoicesVal = pendingInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)

          // 4. Revenue MTD (Paid Invoices in the current month)
          const today = new Date()
          const currentMonthStr = String(today.getMonth() + 1).padStart(2, '0')
          const currentYearStr = String(today.getFullYear())
          const mtdInvoices = invoices?.filter(i => i.status === 'paid' && i.created && i.created.startsWith(`${currentYearStr}-${currentMonthStr}`)) || []
          const revenueMtd = mtdInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)

          const newStats = {
            totalClients,
            revenueMtd,
            activeProjects,
            pendingInvoicesVal,
            clientTrend: totalClients > 0 ? `+${Math.min(totalClients, 3)}` : '0',
            revenueTrend: revenueMtd > 0 ? '+10%' : '0%',
            projectTrend: activeProjects > 0 ? `+${activeProjects}` : '0',
            invoiceTrend: pendingInvoices.length > 0 ? `${pendingInvoices.length} due` : 'Healthy',
          }

          // 5. Chart Data (Revenue vs Target)
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const chartDataList = []
          const baseTargets = [100000, 150000, 160000, 200000, 250000, 280000]
          for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
            const monthName = months[d.getMonth()]
            const year = d.getFullYear()
            const monthStr = String(d.getMonth() + 1).padStart(2, '0')
            
            const monthPaidInvoices = invoices?.filter(i => i.status === 'paid' && i.created && i.created.startsWith(`${year}-${monthStr}`)) || []
            const monthRevSum = monthPaidInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)
            
            const targetVal = baseTargets[5 - i] || 200000
            chartDataList.push({
              month: monthName,
              revenue: monthRevSum,
              target: targetVal
            })
          }

          // 6. Recent Activity list aggregation
          const activityList: any[] = []
          if (invoices) {
            invoices.forEach(inv => {
              activityList.push({
                action: `Invoice #${inv.id} ${inv.status === 'paid' ? 'marked paid' : 'created'}`,
                time: inv.created || '',
                type: 'invoice',
                status: inv.status,
                rawDate: new Date(inv.created || '')
              })
            })
          }
          if (quotations) {
            quotations.forEach(q => {
              activityList.push({
                action: `Quotation ${q.doc_id} for ${q.client} ${q.status === 'approved' ? 'approved' : 'sent'}`,
                time: q.created || '',
                type: 'quotation',
                status: q.status,
                rawDate: new Date(q.created || '')
              })
            })
          }
          if (projects) {
            projects.forEach(p => {
              activityList.push({
                action: `Project "${p.title}" status changed to ${p.status}`,
                time: p.created_at ? p.created_at.slice(0, 10) : '',
                type: 'project',
                status: p.status,
                rawDate: new Date(p.created_at || '')
              })
            })
          }
          if (agreements) {
            agreements.forEach(a => {
              activityList.push({
                action: `Agreement ${a.doc_id} for ${a.client} ${a.status === 'signed' ? 'signed' : 'created'}`,
                time: a.created || '',
                type: 'agreement',
                status: a.status,
                rawDate: new Date(a.created || '')
              })
            })
          }

          const sortedActivities = activityList
            .filter(act => !isNaN(act.rawDate.getTime()))
            .sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime())
            .slice(0, 5)
            .map(act => ({
              action: act.action,
              time: act.time ? formatDate(act.time) : 'Recent',
              type: act.type,
              status: act.status
            }))

          // 7. Upcoming Follow-ups / Tasks
          const tasksList: any[] = []
          if (invoices) {
            invoices.filter(i => i.status === 'overdue').forEach(i => {
              tasksList.push({
                task: `Follow up on overdue invoice ${i.id} for ${i.client}`,
                due: 'Today',
                priority: 'high'
              })
            })
          }
          if (quotations) {
            quotations.filter(q => q.status === 'sent').forEach(q => {
              tasksList.push({
                task: `Follow up with ${q.client} on quotation ${q.doc_id}`,
                due: 'Tomorrow',
                priority: 'medium'
              })
            })
          }
          if (tasksList.length === 0) {
            tasksList.push({ task: 'No immediate follow-ups required', due: '—', priority: 'low' })
          }

          // 8. Top Services by revenue
          const serviceUsage: Record<string, { count: number, revenue: number }> = {}
          if (invoices) {
            invoices.forEach(inv => {
              if (Array.isArray(inv.service_ids)) {
                inv.service_ids.forEach((sid: string) => {
                  const dbSvc = dbServices?.find(s => s.id === sid)
                  if (dbSvc) {
                    if (!serviceUsage[dbSvc.name]) {
                      serviceUsage[dbSvc.name] = { count: 0, revenue: 0 }
                    }
                    serviceUsage[dbSvc.name].count += 1
                    serviceUsage[dbSvc.name].revenue += Number(dbSvc.base_price) || 0
                  }
                })
              }
            })
          }
          const computedTopServices = Object.entries(serviceUsage)
            .map(([name, val]) => ({ name, revenue: val.revenue, count: val.count }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 4)

          const fetchedData = {
            stats: newStats,
            revenueData: chartDataList,
            recentActivities: sortedActivities,
            upcomingTasks: tasksList,
            topServices: computedTopServices
          }

          setStats(fetchedData.stats)
          setRevenueData(fetchedData.revenueData)
          setRecentActivities(fetchedData.recentActivities)
          setUpcomingTasks(fetchedData.upcomingTasks)
          setTopServices(fetchedData.topServices)
          setCachedData('dashboard', fetchedData)

        } catch (err: any) {
          console.error('Error fetching dashboard stats:', err)
        }
      } else {
        const demoData = {
          stats: {
            totalClients: 47,
            revenueMtd: 289000,
            activeProjects: 12,
            pendingInvoicesVal: 94500,
            clientTrend: '+6.4%',
            revenueTrend: '+15.6%',
            projectTrend: '+2',
            invoiceTrend: 'Action Needed',
          },
          revenueData: [
            { month: 'Jan', revenue: 125000, target: 100000 },
            { month: 'Feb', revenue: 189000, target: 150000 },
            { month: 'Mar', revenue: 142000, target: 160000 },
            { month: 'Apr', revenue: 267000, target: 200000 },
            { month: 'May', revenue: 312000, target: 250000 },
            { month: 'Jun', revenue: 289000, target: 280000 },
          ],
          recentActivities: [
            { action: 'Quotation sent to Urban Edge Co.', time: '2 hours ago', type: 'quotation', status: 'sent' },
            { action: 'Invoice #INV-2024-0891 marked paid', time: '4 hours ago', type: 'invoice', status: 'paid' },
            { action: 'New client: Apex Retail added to CRM', time: '6 hours ago', type: 'client', status: 'new' },
            { action: 'Project "Shopify Migration" kicked off', time: '1 day ago', type: 'project', status: 'active' },
            { action: 'Agreement signed by TechCore Solutions', time: '2 days ago', type: 'agreement', status: 'signed' },
          ],
          upcomingTasks: [
            { task: 'Follow up with Urban Edge on quotation', due: 'Today', priority: 'high' },
            { task: 'Send invoice to Apex Retail', due: 'Tomorrow', priority: 'medium' },
            { task: 'Project review call — TechCore', due: '08 Jun', priority: 'medium' },
            { task: 'Renew SLA with FashionHub', due: '12 Jun', priority: 'low' },
          ],
          topServices: [
            { name: 'Website Development', revenue: 145000, count: 8 },
            { name: 'SEO & GEO', revenue: 98000, count: 12 },
            { name: 'Paid Ads (Meta)', revenue: 76000, count: 6 },
            { name: 'WhatsApp Automation', revenue: 54000, count: 9 },
          ]
        }
        setStats(demoData.stats)
        setRevenueData(demoData.revenueData)
        setRecentActivities(demoData.recentActivities)
        setUpcomingTasks(demoData.upcomingTasks)
        setTopServices(demoData.topServices)
        setCachedData('dashboard', demoData)
      }
      setLoading(false)
    }
    loadDashboardData()
  }, [])


  const kpiCards = [
    { label: 'Total Clients', value: stats.totalClients.toString(), sub: stats.clientTrend ? stats.clientTrend + ' this month' : 'No new clients', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10', trend: stats.clientTrend || '0%' },
    { label: 'Revenue (MTD)', value: formatCurrency(stats.revenueMtd), sub: 'vs target', icon: IndianRupee, color: 'text-gold', bg: 'bg-gold/10', trend: stats.revenueTrend || '0%' },
    { label: 'Active Projects', value: stats.activeProjects.toString(), sub: 'In progress', icon: Zap, color: 'text-purple-400', bg: 'bg-purple-500/10', trend: stats.projectTrend || '0' },
    { label: 'Pending Invoices', value: formatCurrency(stats.pendingInvoicesVal), sub: 'Due payment', icon: Receipt, color: 'text-orange-400', bg: 'bg-orange-500/10', trend: stats.invoiceTrend || 'Action Needed' },
  ]

  if (loading) {
    return (
      <div className="flex justify-center items-center py-40">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
        <span className="ml-2 text-sm text-muted-foreground">Loading dashboard...</span>
      </div>
    )
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operating Dashboard 👋</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Here's what's happening at Netgain today.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/crm"><Button variant="outline" size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />New Client</Button></Link>
          <Link href="/documents/quotations"><Button variant="gold" size="sm" className="gap-1.5"><FileText className="h-3.5 w-3.5" />New Quotation</Button></Link>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className="relative overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                  <p className="text-2xl font-bold mt-1 tracking-tight">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
                </div>
                <div className={`rounded-lg p-2.5 ${kpi.bg}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-400" />
                <span className="text-xs text-green-400 font-medium">{kpi.trend}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <motion.div variants={fadeUp} className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Revenue vs Target</CardTitle>
                <Badge variant="gold" className="text-[10px]">This Year</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {revenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} className="text-muted-foreground" />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                    <Area type="monotone" dataKey="target" stroke="#94A3B8" strokeDasharray="4 4" strokeWidth={1.5} fill="none" />
                    <Area type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={2} fill="url(#goldGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[220px] text-muted-foreground text-xs">
                  No revenue data available
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Services */}
        <motion.div variants={fadeUp}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Top Services by Revenue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {topServices.length > 0 ? (
                topServices.map((svc) => (
                  <div key={svc.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{svc.name}</span>
                      <span className="text-muted-foreground">{formatCurrency(svc.revenue)}</span>
                    </div>
                    <Progress value={svc.revenue > 0 ? Math.min((svc.revenue / 145000) * 100, 100) : 0} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{svc.count} client{svc.count !== 1 ? 's' : ''}</p>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center py-10 text-muted-foreground text-xs">
                  No service revenue details found
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <motion.div variants={fadeUp}>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentActivities.length > 0 ? (
                recentActivities.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                    <div className="mt-0.5 h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {a.type === 'invoice' && <Receipt className="h-3 w-3 text-gold" />}
                      {a.type === 'quotation' && <FileText className="h-3 w-3 text-blue-400" />}
                      {a.type === 'client' && <Users className="h-3 w-3 text-green-400" />}
                      {a.type === 'project' && <Zap className="h-3 w-3 text-purple-400" />}
                      {a.type === 'agreement' && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-tight">{a.action}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{a.time}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{a.status}</Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  No recent activities recorded
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Upcoming Tasks */}
        <motion.div variants={fadeUp}>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Upcoming Follow-ups</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingTasks.length > 0 ? (
                upcomingTasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${t.priority === 'high' ? 'bg-red-400' : t.priority === 'medium' ? 'bg-yellow-400' : 'bg-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-tight">{t.task}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Due: {t.due}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {t.priority === 'high' && <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                      <Clock className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  No upcoming follow-ups
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
