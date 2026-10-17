'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Download,
  AlertTriangle,
  RotateCcw,
  Search,
  Filter,
  Layers,
  Users,
  BarChart3,
  Database,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Info,
  Calendar,
  Eye,
  CheckCircle2,
  TrendingDown,
  TrendingUp
} from 'lucide-react'
import type {
  AggregatedMetrics,
  EfficiencyMetric,
  FunnelStage,
  ParsedAdsReportData,
  ParsedAdsRow,
  TargetRange
} from '@/lib/ads/types'
import {
  aggregateRows,
  buildFunnelStages,
  formatters,
  generateInsights,
  getEfficiencyMetric,
  getTargetClass,
  groupRowsBy,
  LEVEL_DEFS,
  parseTargetRange
} from '@/lib/ads/aggregator'
import { META_FIELDS } from '@/lib/ads/parser'

interface AdsDashboardProps {
  reportData: ParsedAdsReportData
  reportTitle?: string
  clientName?: string
  reportId?: string
  downloadUrl?: string
  isSample?: boolean
}

type DashboardView = 'overview' | 'audience' | 'table' | 'data'
type GroupLevel = 'campaign' | 'adset' | 'ad'
type HeatMetric = 'spend' | 'res' | 'cost' | 'ctr'

export function AdsDashboard({
  reportData,
  reportTitle,
  clientName,
  reportId,
  downloadUrl,
  isSample = false
}: AdsDashboardProps) {
  // Navigation & active view state
  const [activeView, setActiveView] = useState<DashboardView>('overview')

  // Global Filter State
  const [selectedRange, setSelectedRange] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all')
  const [selectedAge, setSelectedAge] = useState<string>('all')
  const [selectedGender, setSelectedGender] = useState<string>('all')

  // Target Range State
  const [targetMin, setTargetMin] = useState<string>('')
  const [targetMax, setTargetMax] = useState<string>('')

  // Table Level, Search & Sort State
  const [groupLevel, setGroupLevel] = useState<GroupLevel>(
    reportData.dim.campaign ? 'campaign' : reportData.dim.adset ? 'adset' : 'ad'
  )
  const [tableSearch, setTableSearch] = useState<string>('')
  const [sortKey, setSortKey] = useState<string>('spend')
  const [sortDir, setSortDir] = useState<number>(-1) // -1 desc, 1 asc

  // Audience Heat Metric State
  const [heatMetric, setHeatMetric] = useState<HeatMetric>('res')

  const currency = reportData.currency || '\u20B9'
  const target: TargetRange = { min: targetMin, max: targetMax }

  // Unique dimension values
  const campaigns = useMemo(() => {
    if (!reportData.dim.campaign) return []
    const s = new Set<string>()
    reportData.rows.forEach((r) => {
      if (r.campaign) s.add(r.campaign)
    })
    return Array.from(s).sort()
  }, [reportData])

  const ages = useMemo(() => {
    if (!reportData.dim.age) return []
    const s = new Set<string>()
    reportData.rows.forEach((r) => {
      if (r.age) s.add(r.age)
    })
    return Array.from(s).sort((a, b) => {
      const na = parseInt(a, 10)
      const nb = parseInt(b, 10)
      if (isNaN(na) || isNaN(nb)) return a.localeCompare(b)
      return na - nb
    })
  }, [reportData])

  const genders = useMemo(() => {
    if (!reportData.dim.gender) return []
    const s = new Set<string>()
    reportData.rows.forEach((r) => {
      if (r.gender) s.add(r.gender)
    })
    return Array.from(s).sort()
  }, [reportData])

  // Date range calculation
  const rangeBounds = useMemo(() => {
    const dl = reportData.dateList
    if (dl.length < 2 || selectedRange === 'all') return { from: '', to: '' }
    const last = dl[dl.length - 1]

    const addDays = (iso: string, n: number) => {
      const d = new Date(iso + 'T00:00:00')
      d.setDate(d.getDate() + n)
      return d.toISOString().split('T')[0]
    }

    if (selectedRange === 'custom') return { from: dateFrom, to: dateTo }
    if (['7', '14', '30', '90'].includes(selectedRange)) {
      return { from: addDays(last, -(+selectedRange - 1)), to: last }
    }
    const y = +last.slice(0, 4)
    const m = +last.slice(5, 7)
    const pad = (n: number) => String(n).padStart(2, '0')

    if (selectedRange === 'month') {
      return { from: `${y}-${pad(m)}-01`, to: last }
    }
    if (selectedRange === 'lastmonth') {
      const py = m === 1 ? y - 1 : y
      const pm = m === 1 ? 12 : m - 1
      const endDay = new Date(py, pm, 0).getDate()
      return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(endDay)}` }
    }
    return { from: '', to: '' }
  }, [selectedRange, dateFrom, dateTo, reportData.dateList])

  // Filtered rows
  const filteredRows = useMemo(() => {
    const { from, to } = rangeBounds
    return reportData.rows.filter((r) => {
      if (selectedCampaign !== 'all' && r.campaign !== selectedCampaign) return false
      if (selectedAge !== 'all' && r.age !== selectedAge) return false
      if (selectedGender !== 'all' && r.gender !== selectedGender) return false
      if (from && r.date && r.date < from) return false
      if (to && r.date && r.date > to) return false
      return true
    })
  }, [reportData.rows, selectedCampaign, selectedAge, selectedGender, rangeBounds])

  // Aggregate totals for the filtered dataset
  const filteredTotal = useMemo(() => {
    return aggregateRows(filteredRows, reportData.has)
  }, [filteredRows, reportData.has])

  // Primary efficiency metric (CPL, CPR, CPP, CPLPV, CPC)
  const eff = useMemo(() => {
    return getEfficiencyMetric(reportData.has)
  }, [reportData.has])

  // Funnel stages
  const funnelStages = useMemo(() => {
    return buildFunnelStages(filteredTotal, reportData.has)
  }, [filteredTotal, reportData.has])

  // Rule-based insights
  const insights = useMemo(() => {
    return generateInsights(
      filteredRows,
      filteredTotal,
      eff,
      reportData.dim,
      reportData.has,
      target,
      currency
    )
  }, [filteredRows, filteredTotal, eff, reportData.dim, reportData.has, target, currency])

  // Reporting period text
  const periodSubtitle = useMemo(() => {
    const ds = filteredRows.map((r) => r.date).filter(Boolean).sort()
    if (!ds.length) return `${formatters.int(filteredRows.length)} rows`
    const de = filteredRows.map((r) => r.dateEnd).filter(Boolean).sort()
    const a = ds[0]
    let b = de.length ? de[de.length - 1] : ds[ds.length - 1]
    if (b < ds[ds.length - 1]) b = ds[ds.length - 1]
    return a === b
      ? formatters.date(a)
      : `${formatters.date(a)} to ${formatters.date(b)}`
  }, [filteredRows])

  // Reset filters handler
  const handleResetFilters = () => {
    setSelectedRange('all')
    setDateFrom('')
    setDateTo('')
    setSelectedCampaign('all')
    setSelectedAge('all')
    setSelectedGender('all')
    setTargetMin('')
    setTargetMax('')
    setTableSearch('')
  }

  // Stale check
  const staleDaysAgo = useMemo(() => {
    if (isSample || !reportData.dateList.length) return 0
    const latest = reportData.rows.map((r) => r.dateEnd || r.date).filter(Boolean).sort().pop()
    if (!latest) return 0
    const diff = Math.round((Date.now() - new Date(latest + 'T00:00:00').getTime()) / 86400000)
    return diff >= 2 ? diff : 0
  }, [isSample, reportData])

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
              {reportTitle || (clientName ? `Performance Report: ${clientName}` : 'Performance Report Showcase')}
            </h1>
            {isSample ? (
              <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold px-2.5 py-0.5 text-xs">
                Sample Data
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold px-2.5 py-0.5 text-xs">
                Live Report
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs font-medium">
              Performance Showcase
            </Badge>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
            <Calendar className="h-3.5 w-3.5 text-primary" /> {periodSubtitle} • {formatters.int(filteredRows.length)} rows analyzed
          </p>
        </div>

        {/* Top actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {downloadUrl && !isSample && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-9 text-xs font-semibold"
              onClick={() => window.open(downloadUrl, '_blank')}
            >
              <Download className="h-3.5 w-3.5 text-primary" /> Download Raw File
            </Button>
          )}

          {/* Navigation View Switcher */}
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveView('overview')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                activeView === 'overview'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveView('audience')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                activeView === 'audience'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Audience
            </button>
            <button
              type="button"
              onClick={() => setActiveView('table')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                activeView === 'table'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Campaigns & Ads
            </button>
            <button
              type="button"
              onClick={() => setActiveView('data')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                activeView === 'data'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Fields
            </button>
          </div>
        </div>
      </div>

      {/* ── Banners (Sample or Stale Data) ── */}
      {isSample && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs">
          <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="flex-1 font-medium">
            You are exploring sample Meta Ads demonstration data. Drop your client Ads Manager export to view authentic metrics.
          </span>
        </div>
      )}

      {staleDaysAgo > 0 && !isSample && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-200 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <span className="flex-1 font-medium">
            The latest date in this export was {staleDaysAgo} days ago. Refresh this report with an updated export to keep figures current.
          </span>
        </div>
      )}

      {/* ── Filters Bar ── */}
      <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm">
        <CardContent className="p-3.5">
          <div className="flex flex-wrap items-end gap-3">
            {/* Time frame */}
            {reportData.dateList.length > 1 ? (
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-semibold">Time Frame</Label>
                <Select value={selectedRange} onValueChange={setSelectedRange}>
                  <SelectTrigger className="h-8 text-xs w-[140px] bg-background">
                    <SelectValue placeholder="All dates" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All dates in data</SelectItem>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="14">Last 14 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                    <SelectItem value="month">This month</SelectItem>
                    <SelectItem value="lastmonth">Last month</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground flex items-center h-8">
                Single reporting window
              </div>
            )}

            {/* Custom Date Inputs */}
            {selectedRange === 'custom' && (
              <div className="flex items-center gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground font-semibold">From</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-8 text-xs w-[125px] bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground font-semibold">To</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-8 text-xs w-[125px] bg-background"
                  />
                </div>
              </div>
            )}

            {/* Campaign Filter */}
            {campaigns.length > 0 && (
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-semibold">Campaign</Label>
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger className="h-8 text-xs max-w-[200px] bg-background truncate">
                    <SelectValue placeholder="All campaigns" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="all">All campaigns</SelectItem>
                    {campaigns.map((c) => (
                      <SelectItem key={c} value={c} className="truncate">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Age Filter */}
            {ages.length > 0 && (
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-semibold">Age</Label>
                <Select value={selectedAge} onValueChange={setSelectedAge}>
                  <SelectTrigger className="h-8 text-xs w-[110px] bg-background">
                    <SelectValue placeholder="All ages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ages</SelectItem>
                    {ages.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Gender Filter */}
            {genders.length > 0 && (
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-semibold">Gender</Label>
                <Select value={selectedGender} onValueChange={setSelectedGender}>
                  <SelectTrigger className="h-8 text-xs w-[110px] bg-background capitalize">
                    <SelectValue placeholder="All genders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All genders</SelectItem>
                    {genders.map((g) => (
                      <SelectItem key={g} value={g} className="capitalize">
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex-1" />

            {/* Target Efficiency Range */}
            {eff && (
              <div className="flex items-center gap-1.5">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground font-semibold">
                    Target {eff.label} ({currency})
                  </Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      placeholder="min"
                      value={targetMin}
                      onChange={(e) => setTargetMin(e.target.value)}
                      className="h-8 text-xs w-[70px] bg-background"
                    />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input
                      type="number"
                      placeholder="max"
                      value={targetMax}
                      onChange={(e) => setTargetMax(e.target.value)}
                      className="h-8 text-xs w-[70px] bg-background"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Reset Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Active View Rendering ── */}
      {filteredRows.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-border bg-card/40">
          <p className="text-sm font-semibold text-foreground">No rows match the selected filters</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try adjusting your date range, campaign, or audience filters.
          </p>
          <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-4 text-xs">
            Reset Filters
          </Button>
        </div>
      ) : activeView === 'overview' ? (
        <OverviewSection
          filteredTotal={filteredTotal}
          filteredRows={filteredRows}
          has={reportData.has}
          dim={reportData.dim}
          eff={eff}
          funnelStages={funnelStages}
          insights={insights}
          target={target}
          currency={currency}
        />
      ) : activeView === 'audience' ? (
        <AudienceSection
          rows={filteredRows}
          tot={filteredTotal}
          dim={reportData.dim}
          has={reportData.has}
          eff={eff}
          heatMetric={heatMetric}
          onHeatMetricChange={setHeatMetric}
          currency={currency}
        />
      ) : activeView === 'table' ? (
        <CampaignsTableSection
          rows={filteredRows}
          tot={filteredTotal}
          has={reportData.has}
          dim={reportData.dim}
          eff={eff}
          groupLevel={groupLevel}
          onGroupLevelChange={setGroupLevel}
          search={tableSearch}
          onSearchChange={setTableSearch}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={(key) => {
            if (sortKey === key) {
              setSortDir((d) => d * -1)
            } else {
              setSortKey(key)
              setSortDir(key === 'name' ? 1 : -1)
            }
          }}
          target={target}
          currency={currency}
        />
      ) : (
        <AllFieldsSection reportData={reportData} />
      )}
    </div>
  )
}

/* =========================================================================
   1. OVERVIEW VIEW COMPONENT
   ========================================================================= */

function OverviewSection({
  filteredTotal,
  filteredRows,
  has,
  dim,
  eff,
  funnelStages,
  insights,
  target,
  currency
}: {
  filteredTotal: AggregatedMetrics
  filteredRows: ParsedAdsRow[]
  has: any
  dim: any
  eff: EfficiencyMetric | null
  funnelStages: FunnelStage[]
  insights: any[]
  target: TargetRange
  currency: string
}) {
  const lvl = dim.campaign ? 'campaign' : dim.adset ? 'adset' : dim.ad ? 'ad' : null

  // Top spending campaigns / groups for horizontal bar chart
  const topGroups = useMemo(() => {
    if (!lvl || !has.spend) return []
    const gs = groupRowsBy(filteredRows, LEVEL_DEFS[lvl].key, has)
    return gs.sort((a, b) => b.spend - a.spend).slice(0, 10)
  }, [filteredRows, lvl, has])

  const maxGroupSpend = topGroups.length ? topGroups[0].spend || 1 : 1

  return (
    <div className="space-y-6">
      {/* ── Funnel Visualization ── */}
      {funnelStages.length >= 2 && (
        <Card className="border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span>Performance Conversion Funnel</span>
              <span className="text-xs font-normal text-muted-foreground">
                Impressions to {has.leads ? 'Leads' : has.results ? 'Results' : 'Conversions'}
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Visualizes audience progression and cost efficiency across each customer journey stage.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <FunnelSvg stages={funnelStages} currency={currency} />
          </CardContent>
        </Card>
      )}

      {/* ── Key Figures (KPI Grid) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {has.spend && (
          <KPICard
            label="Amount Spent"
            value={formatters.inr(filteredTotal.spend, currency)}
            sub="Total advertising budget"
          />
        )}
        {has.leads && (
          <>
            <KPICard
              label="Leads"
              value={formatters.int(filteredTotal.leads)}
              sub="Captured form leads"
            />
            <KPICard
              label="Cost Per Lead"
              value={formatters.inr2(filteredTotal.cpl, currency)}
              sub="Budget / leads"
              targetClass={getTargetClass(
                filteredTotal.cpl,
                filteredTotal.cpl,
                1,
                target
              )}
            />
          </>
        )}
        {has.showResults && (
          <>
            <KPICard
              label="Results"
              value={formatters.int(filteredTotal.results)}
              sub="Primary result events"
            />
            <KPICard
              label="Cost Per Result"
              value={formatters.inr2(filteredTotal.cpr, currency)}
              sub="Budget / results"
              targetClass={getTargetClass(
                filteredTotal.cpr,
                filteredTotal.cpr,
                1,
                target
              )}
            />
          </>
        )}
        {has.purchases && (
          <>
            <KPICard
              label="Purchases"
              value={formatters.int(filteredTotal.purchases)}
              sub="Completed purchases"
            />
            <KPICard
              label="Cost Per Purchase"
              value={formatters.inr2(filteredTotal.cpp, currency)}
              sub="Budget / purchases"
            />
          </>
        )}
        {filteredTotal.roas != null && (
          <KPICard
            label="ROAS"
            value={formatters.x(filteredTotal.roas)}
            sub="Return on ad spend"
            highlight={filteredTotal.roas >= 2}
          />
        )}
        {has.impr && (
          <KPICard
            label="Impressions"
            value={formatters.int(filteredTotal.impr)}
            sub="Total times ad displayed"
          />
        )}
        {has.reach && (
          <KPICard
            label="Reach"
            value={formatters.int(filteredTotal.reach)}
            sub="Unique people who saw ads"
          />
        )}
        {filteredTotal.freq != null && (
          <KPICard
            label="Frequency"
            value={formatters.dec(filteredTotal.freq)}
            sub={
              filteredTotal.freq > 3 ? (
                <span className="text-amber-500 font-semibold">High (&gt; 3 per person)</span>
              ) : (
                'Avg impressions/person'
              )
            }
          />
        )}
        {filteredTotal.clicks != null && (
          <KPICard
            label={has.clicksLink ? 'Link Clicks' : 'Clicks'}
            value={formatters.int(filteredTotal.clicks)}
            sub="User interactions"
          />
        )}
        {filteredTotal.ctr != null && (
          <KPICard
            label="CTR"
            value={formatters.pct(filteredTotal.ctr)}
            sub="Click-through rate"
          />
        )}
        {filteredTotal.cpc != null && (
          <KPICard
            label="CPC"
            value={formatters.inr2(filteredTotal.cpc, currency)}
            sub="Cost per click"
          />
        )}
        {filteredTotal.cpm != null && (
          <KPICard
            label="CPM"
            value={formatters.inr2(filteredTotal.cpm, currency)}
            sub="Cost per 1,000 impr"
          />
        )}
        {has.lpv && (
          <>
            <KPICard
              label="Landing Page Views"
              value={formatters.int(filteredTotal.lpv)}
              sub={
                filteredTotal.lpvRate != null
                  ? `${formatters.dec(filteredTotal.lpvRate)}% of clicks`
                  : 'Page loads'
              }
            />
            <KPICard
              label="Cost Per LPV"
              value={formatters.inr2(filteredTotal.cplpv, currency)}
              sub="Cost per page view"
            />
          </>
        )}
      </div>

      {/* ── Two Column Bottom Section: Budget Breakdown & Rule Insights ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Budget by Campaign */}
        <Card className="lg:col-span-7 border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span>Budget by {lvl ? LEVEL_DEFS[lvl].label : 'Campaign'}</span>
              <span className="text-xs font-normal text-muted-foreground">Top 10 allocations</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            {topGroups.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No groups available.</p>
            ) : (
              topGroups.map((g) => {
                const name = LEVEL_DEFS[lvl!].name(g.first)
                const share = filteredTotal.spend ? (g.spend / filteredTotal.spend) * 100 : 0
                return (
                  <div key={g.key} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground truncate max-w-[260px] sm:max-w-[340px]" title={name}>
                        {name}
                      </span>
                      <div className="flex items-center gap-2 font-mono shrink-0">
                        <span className="text-foreground font-bold">
                          {formatters.inr(g.spend, currency)}
                        </span>
                        <span className="text-muted-foreground text-[11px] w-9 text-right">
                          {Math.round(share)}%
                        </span>
                      </div>
                    </div>
                    {/* Progress track */}
                    <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, (g.spend / maxGroupSpend) * 100)}%` }}
                      />
                    </div>
                    {eff && g[eff.res] != null && (
                      <p className="text-[10px] text-muted-foreground">
                        {formatters.int(g[eff.res] as number)} {eff.resLabel.toLowerCase()}
                        {g[eff.key] != null && ` at ${formatters.inr(g[eff.key] as number, currency)} each`}
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Rule-Based Insights */}
        <Card className="lg:col-span-5 border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Sparkles className="h-4 w-4 text-amber-500" /> What the Numbers Say
            </CardTitle>
            <CardDescription className="text-xs">
              Automated heuristics derived from source spend and conversion patterns.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            {insights.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No major outliers found in the current filtered slice.
              </p>
            ) : (
              <ul className="space-y-3">
                {insights.map((ins, idx) => (
                  <li
                    key={idx}
                    className={`p-3 rounded-lg text-xs leading-relaxed border-l-4 ${
                      ins.type === 'bad'
                        ? 'border-l-red-500 bg-red-500/5 text-foreground'
                        : ins.type === 'warn'
                        ? 'border-l-amber-500 bg-amber-500/5 text-foreground'
                        : ins.type === 'good'
                        ? 'border-l-emerald-500 bg-emerald-500/5 text-foreground'
                        : 'border-l-blue-500 bg-blue-500/5 text-foreground'
                    }`}
                  >
                    <div
                      dangerouslySetInnerHTML={{ __html: ins.html }}
                      className="[&>b]:font-bold"
                    />
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px] text-muted-foreground mt-4 pt-3 border-t border-border/50">
              Groups representing under 2% to 5% of spend are excluded to avoid statistical anomalies.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* =========================================================================
   2. AUDIENCE VIEW COMPONENT
   ========================================================================= */

function AudienceSection({
  rows,
  tot,
  dim,
  has,
  eff,
  heatMetric,
  onHeatMetricChange,
  currency
}: {
  rows: ParsedAdsRow[]
  tot: AggregatedMetrics
  dim: any
  has: any
  eff: EfficiencyMetric | null
  heatMetric: HeatMetric
  onHeatMetricChange: (m: HeatMetric) => void
  currency: string
}) {
  const ageOn = dim.age
  const genOn = dim.gender

  const ages = useMemo(() => {
    if (!ageOn) return ['All ages']
    const s = new Set<string>()
    rows.forEach((r) => s.add(r.age || 'Unknown'))
    return Array.from(s).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
  }, [rows, ageOn])

  const gens = useMemo(() => {
    if (!genOn) return ['All genders']
    const s = new Set<string>()
    rows.forEach((r) => s.add(r.gender || 'Unknown'))
    return Array.from(s).sort()
  }, [rows, genOn])

  const getMetricVal = (agg: AggregatedMetrics) => {
    if (heatMetric === 'spend') return agg.spend
    if (heatMetric === 'res') return eff ? (agg[eff.res] as number) : 0
    if (heatMetric === 'cost') return eff ? (agg[eff.key] as number) : 0
    return agg.ctr
  }

  const formatMetricVal = (v: number | null) => {
    if (heatMetric === 'spend') return formatters.inr(v, currency)
    if (heatMetric === 'res') return formatters.int(v)
    if (heatMetric === 'cost') return formatters.inr(v, currency)
    return formatters.pct(v)
  }

  // Cell calculations
  const { cellMap, allVals } = useMemo(() => {
    const map = new Map<string, AggregatedMetrics>()
    const vals: number[] = []

    ages.forEach((a) => {
      gens.forEach((g) => {
        const matching = rows.filter((r) => {
          const matchAge = !ageOn || (r.age || 'Unknown') === a
          const matchGen = !genOn || (r.gender || 'Unknown') === g
          return matchAge && matchGen
        })
        if (matching.length) {
          const agg = aggregateRows(matching, has)
          map.set(`${a}|${g}`, agg)
          const v = getMetricVal(agg)
          if (v != null && v > 0) vals.push(v)
        }
      })
    })

    return { cellMap: map, allVals: vals }
  }, [rows, ages, gens, ageOn, genOn, heatMetric, has, eff])

  if (!ageOn && !genOn) {
    return (
      <Card className="border-border p-8 text-center bg-card">
        <p className="text-sm font-semibold text-foreground">No Age or Gender Breakdowns in Export</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          In Ads Manager, add Breakdown &gt; Delivery &gt; Age &amp; Gender, and export again to enable cross-demographic heatmap analysis.
        </p>
      </Card>
    )
  }

  const minVal = allVals.length ? Math.min(...allVals) : 0
  const maxVal = allVals.length ? Math.max(...allVals) : 1

  return (
    <div className="space-y-6">
      {/* Age & Gender Heatmap Card */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold">Age and Gender Breakdown</CardTitle>
            <CardDescription className="text-xs">
              Cross-demographic efficiency matrix with relative intensity shading.
            </CardDescription>
          </div>

          {/* Metric Selector Chips */}
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1 text-xs">
            {has.spend && (
              <button
                type="button"
                onClick={() => onHeatMetricChange('spend')}
                className={`px-2.5 py-1 rounded font-semibold ${
                  heatMetric === 'spend' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                Amount Spent
              </button>
            )}
            {eff && (
              <button
                type="button"
                onClick={() => onHeatMetricChange('res')}
                className={`px-2.5 py-1 rounded font-semibold ${
                  heatMetric === 'res' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {eff.resLabel}
              </button>
            )}
            {eff && (
              <button
                type="button"
                onClick={() => onHeatMetricChange('cost')}
                className={`px-2.5 py-1 rounded font-semibold ${
                  heatMetric === 'cost' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {eff.label}
              </button>
            )}
            {has.hasClicks && (
              <button
                type="button"
                onClick={() => onHeatMetricChange('ctr')}
                className={`px-2.5 py-1 rounded font-semibold ${
                  heatMetric === 'ctr' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                CTR
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/70 text-foreground font-semibold border-b border-border">
                <tr>
                  <th className="py-2.5 px-3">Age Group</th>
                  {gens.map((g) => (
                    <th key={g} className="py-2.5 px-3 text-center capitalize">
                      {g}
                    </th>
                  ))}
                  {gens.length > 1 && <th className="py-2.5 px-3 text-center">Total</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ages.map((a) => {
                  const rowMatching = rows.filter((r) => !ageOn || (r.age || 'Unknown') === a)
                  const rowAgg = aggregateRows(rowMatching, has)
                  const rowVal = getMetricVal(rowAgg)

                  return (
                    <tr key={a} className="hover:bg-muted/30">
                      <td className="py-2.5 px-3 font-semibold text-foreground whitespace-nowrap">
                        {a}
                      </td>
                      {gens.map((g) => {
                        const cellAgg = cellMap.get(`${a}|${g}`)
                        const v = cellAgg ? getMetricVal(cellAgg) : null
                        let opacity = 0
                        if (v != null && maxVal > minVal) {
                          const norm = (v - minVal) / (maxVal - minVal)
                          opacity = heatMetric === 'cost' ? 1 - norm : norm
                        }

                        return (
                          <td
                            key={g}
                            className="py-2.5 px-3 text-center transition-colors"
                            style={{
                              backgroundColor:
                                v != null && v > 0
                                  ? `rgba(16, 185, 129, ${Math.max(0.08, opacity * 0.45)})`
                                  : undefined
                            }}
                          >
                            <span className="font-semibold text-foreground font-mono">
                              {formatMetricVal(v)}
                            </span>
                            {cellAgg && heatMetric !== 'spend' && cellAgg.spend > 0 && (
                              <span className="block text-[10px] text-muted-foreground">
                                {formatters.inr(cellAgg.spend, currency)}
                              </span>
                            )}
                          </td>
                        )
                      })}
                      {gens.length > 1 && (
                        <td className="py-2.5 px-3 text-center font-bold bg-muted/40 font-mono">
                          {formatMetricVal(rowVal)}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {heatMetric === 'cost' ? 'Darker tint marks lower cost per result.' : 'Darker tint marks higher volume / rate.'}
          </p>
        </CardContent>
      </Card>

      {/* Dimension Bars: Placement & Region */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {dim.placement && (
          <DimensionBarsCard
            title="Placement & Platform"
            rows={rows}
            dimKey="placement"
            eff={eff}
            tot={tot}
            currency={currency}
          />
        )}
        {dim.region && (
          <DimensionBarsCard
            title="Geographic Region"
            rows={rows}
            dimKey="region"
            eff={eff}
            tot={tot}
            currency={currency}
          />
        )}
      </div>
    </div>
  )
}

function DimensionBarsCard({
  title,
  rows,
  dimKey,
  eff,
  tot,
  currency
}: {
  title: string
  rows: ParsedAdsRow[]
  dimKey: keyof ParsedAdsRow
  eff: EfficiencyMetric | null
  tot: AggregatedMetrics
  currency: string
}) {
  const groups = useMemo(() => {
    const gs = groupRowsBy(rows, (r) => String(r[dimKey] || 'Unknown'))
    return gs.sort((a, b) => b.spend - a.spend).slice(0, 10)
  }, [rows, dimKey])

  const maxSpend = groups.length ? groups[0].spend || 1 : 1

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-1">
        {groups.map((g) => {
          const share = tot.spend ? (g.spend / tot.spend) * 100 : 0
          return (
            <div key={g.key} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-foreground truncate max-w-[200px]" title={g.key}>
                  {g.key}
                </span>
                <span className="font-mono text-foreground font-bold">
                  {formatters.inr(g.spend, currency)}{' '}
                  <span className="text-[10px] text-muted-foreground font-normal">({Math.round(share)}%)</span>
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(g.spend / maxSpend) * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

/* =========================================================================
   3. CAMPAIGNS & ADS TABLE VIEW COMPONENT
   ========================================================================= */

function CampaignsTableSection({
  rows,
  tot,
  has,
  dim,
  eff,
  groupLevel,
  onGroupLevelChange,
  search,
  onSearchChange,
  sortKey,
  sortDir,
  onSort,
  target,
  currency
}: {
  rows: ParsedAdsRow[]
  tot: AggregatedMetrics
  has: any
  dim: any
  eff: EfficiencyMetric | null
  groupLevel: GroupLevel
  onGroupLevelChange: (lvl: GroupLevel) => void
  search: string
  onSearchChange: (s: string) => void
  sortKey: string
  sortDir: number
  onSort: (k: string) => void
  target: TargetRange
  currency: string
}) {
  const L = LEVEL_DEFS[groupLevel]

  const availableLevels: GroupLevel[] = []
  if (dim.campaign) availableLevels.push('campaign')
  if (dim.adset) availableLevels.push('adset')
  if (dim.ad) availableLevels.push('ad')

  // Grouped rows
  const groups = useMemo(() => {
    let gs = groupRowsBy(rows, L.key, has)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      gs = gs.filter((g) => {
        const name = L.name(g.first) + ' ' + L.sub(g.first)
        return name.toLowerCase().includes(q)
      })
    }

    gs.sort((a, b) => {
      if (sortKey === 'name') {
        return sortDir * L.name(a.first).localeCompare(L.name(b.first))
      }
      const x = (a as any)[sortKey]
      const y = (b as any)[sortKey]
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      return sortDir * (x - y)
    })

    return gs
  }, [rows, L, has, search, sortKey, sortDir])

  // Columns definition based on active source measures
  const cols = useMemo(() => {
    const c: { k: string; label: string; fmt: (v: any) => string }[] = []
    if (has.spend) c.push({ k: 'spend', label: 'Spent', fmt: (v) => formatters.inr(v, currency) })
    if (has.impr) c.push({ k: 'impr', label: 'Impressions', fmt: formatters.int })
    if (has.reach) c.push({ k: 'reach', label: 'Reach', fmt: formatters.int })
    if (has.reach && has.impr) c.push({ k: 'freq', label: 'Frequency', fmt: formatters.dec })
    if (has.hasClicks) c.push({ k: 'clicks', label: has.clicksLink ? 'Link Clicks' : 'Clicks', fmt: formatters.int })
    if (has.hasClicks && has.impr) c.push({ k: 'ctr', label: 'CTR', fmt: formatters.pct })
    if (has.hasClicks && has.spend) c.push({ k: 'cpc', label: 'CPC', fmt: (v) => formatters.inr2(v, currency) })
    if (has.impr && has.spend) c.push({ k: 'cpm', label: 'CPM', fmt: (v) => formatters.inr2(v, currency) })
    if (has.lpv) c.push({ k: 'lpv', label: 'LP Views', fmt: formatters.int })
    if (has.lpv && has.spend) c.push({ k: 'cplpv', label: 'Cost/LPV', fmt: (v) => formatters.inr2(v, currency) })
    if (has.leads) c.push({ k: 'leads', label: 'Leads', fmt: formatters.int })
    if (has.leads && has.spend) c.push({ k: 'cpl', label: 'Cost/Lead', fmt: (v) => formatters.inr2(v, currency) })
    if (has.showResults) c.push({ k: 'results', label: 'Results', fmt: formatters.int })
    if (has.showResults && has.spend) c.push({ k: 'cpr', label: 'Cost/Result', fmt: (v) => formatters.inr2(v, currency) })
    if (has.purchases) c.push({ k: 'purchases', label: 'Purchases', fmt: formatters.int })
    if (has.purchases && has.spend) c.push({ k: 'cpp', label: 'Cost/Purchase', fmt: (v) => formatters.inr2(v, currency) })
    if (has.revenue && has.spend) c.push({ k: 'roas', label: 'ROAS', fmt: formatters.x })
    return c
  }, [has, currency])

  const avgCost = eff ? (tot[eff.key] as number) : null

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base font-bold">Campaigns, Ad Sets and Ads Breakdown</CardTitle>
          <CardDescription className="text-xs">
            Multi-tier performance analysis with sticky header and sortable recalculated metrics.
          </CardDescription>
        </div>

        {/* Level Switcher & Search */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1 text-xs">
            {availableLevels.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => onGroupLevelChange(lvl)}
                className={`px-3 py-1 rounded font-semibold capitalize ${
                  groupLevel === lvl ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {LEVEL_DEFS[lvl].label}s
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 text-xs pl-8 w-[180px] bg-background"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs text-right border-collapse">
            <thead className="bg-muted/70 text-foreground font-semibold sticky top-0 border-b border-border">
              <tr>
                <th
                  onClick={() => onSort('name')}
                  className="py-2.5 px-3 text-left sticky left-0 bg-muted/90 backdrop-blur-sm z-10 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>{L.label}</span>
                    {sortKey === 'name' && (
                      sortDir === 1 ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                    )}
                  </div>
                </th>
                {cols.map((c) => (
                  <th
                    key={c.k}
                    onClick={() => onSort(c.k)}
                    className="py-2.5 px-3 cursor-pointer select-none hover:bg-muted whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>{c.label}</span>
                      {sortKey === c.k && (
                        sortDir === 1 ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groups.map((g) => {
                const name = L.name(g.first)
                const sub = L.sub(g.first)
                const share = tot.spend ? g.spend / tot.spend : 0

                return (
                  <tr key={g.key} className="hover:bg-muted/40 transition-colors">
                    <td className="py-2 px-3 text-left sticky left-0 bg-card z-10 max-w-[240px] truncate">
                      <span className="font-semibold text-foreground block truncate" title={name}>
                        {name}
                      </span>
                      {sub && (
                        <span className="text-[10px] text-muted-foreground block truncate" title={sub}>
                          {sub}
                        </span>
                      )}
                    </td>
                    {cols.map((c) => {
                      const val = (g as any)[c.k]
                      let highlightClass = ''
                      if (eff && c.k === eff.key) {
                        highlightClass = getTargetClass(val, avgCost, share, target)
                      }

                      return (
                        <td
                          key={c.k}
                          className={`py-2 px-3 whitespace-nowrap font-mono ${
                            highlightClass === 'good'
                              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                              : highlightClass === 'bad'
                              ? 'text-red-600 dark:text-red-400 font-bold'
                              : highlightClass === 'warn'
                              ? 'text-amber-600 dark:text-amber-400 font-bold'
                              : 'text-foreground'
                          }`}
                        >
                          {c.fmt(val)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
            {/* Totals Footer */}
            <tfoot className="bg-muted/60 font-bold border-t-2 border-border text-foreground">
              <tr>
                <td className="py-2.5 px-3 text-left sticky left-0 bg-muted/90 z-10">
                  All Shown ({formatters.int(groups.length)} {L.label.toLowerCase()}s)
                </td>
                {cols.map((c) => (
                  <td key={c.k} className="py-2.5 px-3 font-mono">
                    {c.fmt((tot as any)[c.k])}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Rate &amp; cost metrics in the footer are recalculated from overall totals to ensure mathematical accuracy.
        </p>
      </CardContent>
    </Card>
  )
}

/* =========================================================================
   4. ALL FIELDS (DATA INSPECTOR) VIEW COMPONENT
   ========================================================================= */

function AllFieldsSection({ reportData }: { reportData: ParsedAdsReportData }) {
  const groups: Record<string, typeof META_FIELDS> = {}
  META_FIELDS.forEach((f) => {
    if (!groups[f.g]) groups[f.g] = []
    groups[f.g].push(f)
  })

  let foundCount = 0

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">Standard Meta Ads Columns Ingested</CardTitle>
          <CardDescription className="text-xs">
            Full audit of Meta Ads Manager schema mapping and column detection status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/70 text-foreground font-semibold border-b border-border">
                <tr>
                  <th className="py-2.5 px-3">Field Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Header in Upload</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.entries(groups).map(([groupName, fields]) =>
                  fields.map((f, i) => {
                    const colIdx = reportData.map[f.k]
                    const isFound = colIdx != null
                    if (isFound) foundCount++

                    return (
                      <tr key={f.k} className="hover:bg-muted/20">
                        <td className="py-2 px-3 font-medium text-foreground">{f.label}</td>
                        <td className="py-2 px-3 text-muted-foreground">{i === 0 ? groupName : ''}</td>
                        <td className="py-2 px-3 font-mono text-muted-foreground">
                          {isFound ? reportData.headers[colIdx] : '—'}
                        </td>
                        <td className="py-2 px-3">
                          {isFound ? (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                              {f.derived ? 'Recalculated' : 'Ingested'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-border">
                              Not Present
                            </Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Raw Rows Preview */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">Raw Export Row Preview</CardTitle>
          <CardDescription className="text-xs">
            First {formatters.int(reportData.rawRows.length)} rows preserved from original upload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[380px] rounded-lg border border-border">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted text-foreground font-semibold sticky top-0">
                <tr>
                  {reportData.headers.map((h, i) => (
                    <th key={i} className="py-2 px-3 whitespace-nowrap border-b border-border">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-[11px]">
                {reportData.rawRows.slice(0, 50).map((r, ri) => (
                  <tr key={ri} className="hover:bg-muted/30">
                    {reportData.headers.map((_, ci) => (
                      <td key={ci} className="py-1.5 px-3 whitespace-nowrap text-muted-foreground">
                        {r[ci] != null ? String(r[ci]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* =========================================================================
   FUNNEL SVG RENDERER (Ported from artifact ribbon curve)
   ========================================================================= */

function FunnelSvg({ stages, currency }: { stages: FunnelStage[]; currency: string }) {
  const n = stages.length
  if (n < 2) return null

  const W = 1000
  const cy = 135
  const padX = 80
  const maxV = Math.log(1 + Math.max(...stages.map((s) => s.v)))
  const half = stages.map((s) => 12 + 48 * (Math.log(1 + s.v) / maxV))
  const xs = stages.map((_, i) => padX + (i * (W - 2 * padX)) / (n - 1))

  let d = `M ${xs[0]} ${cy - half[0]}`
  for (let i = 1; i < n; i++) {
    const dx = (xs[i] - xs[i - 1]) * 0.5
    d += ` C ${xs[i - 1] + dx} ${cy - half[i - 1]} ${xs[i] - dx} ${cy - half[i]} ${xs[i]} ${cy - half[i]}`
  }
  d += ` L ${xs[n - 1]} ${cy + half[n - 1]}`
  for (let i = n - 1; i > 0; i--) {
    const dx = (xs[i] - xs[i - 1]) * 0.5
    d += ` C ${xs[i] - dx} ${cy + half[i]} ${xs[i - 1] + dx} ${cy + half[i - 1]} ${xs[i - 1]} ${cy + half[i - 1]}`
  }
  d += ' Z'

  return (
    <div className="w-full">
      {/* Desktop Ribbon SVG */}
      <div className="hidden sm:block w-full">
        <svg
          viewBox="0 0 1000 270"
          className="w-full h-auto"
          role="img"
          aria-label="Conversion Funnel Ribbon"
        >
          <defs>
            <linearGradient id="funnelGrad" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#14472C" />
              <stop offset="65%" stopColor="#2F8A55" />
              <stop offset="100%" stopColor="#C79A1E" />
            </linearGradient>
          </defs>

          {/* Guidelines and Stage Labels */}
          {stages.map((s, j) => (
            <g key={j}>
              <line
                x1={xs[j]}
                y1={64}
                x2={xs[j]}
                y2={cy - half[j] - 4}
                stroke="currentColor"
                strokeOpacity={0.15}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={xs[j]}
                y={22}
                textAnchor="middle"
                className="text-[13px] fill-muted-foreground font-sans font-medium"
              >
                {s.label}
              </text>
              <text
                x={xs[j]}
                y={52}
                textAnchor="middle"
                className="text-[26px] fill-foreground font-black font-sans tracking-tight"
              >
                {formatters.compact(s.v)}
              </text>
            </g>
          ))}

          {/* Ribbon Path */}
          <path d={d} fill="url(#funnelGrad)" opacity={0.92} />

          {/* Cost and Step Conversion Rates */}
          {stages.map((s, j) => (
            <g key={`sub-${j}`}>
              {s.cost != null && (
                <text
                  x={xs[j]}
                  y={224}
                  textAnchor="middle"
                  className="text-[12px] fill-muted-foreground font-medium"
                >
                  {formatters.inr2(s.cost, currency)} {s.per}
                </text>
              )}
              {j > 0 && stages[j - 1].v > 0 && (
                <g>
                  <text
                    x={(xs[j] + xs[j - 1]) / 2}
                    y={252}
                    textAnchor="middle"
                    className="text-[15px] fill-emerald-600 dark:text-emerald-400 font-bold"
                  >
                    {formatters.pct((s.v / stages[j - 1].v) * 100)}
                  </text>
                  <text
                    x={(xs[j] + xs[j - 1]) / 2}
                    y={266}
                    textAnchor="middle"
                    className="text-[10px] fill-muted-foreground font-medium"
                  >
                    {s.verb ? `of ${stages[j - 1].label.toLowerCase()} ${s.verb}` : ''}
                  </text>
                </g>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Mobile Stacked Funnel */}
      <div className="block sm:hidden space-y-3">
        {stages.map((s, j) => {
          const rate = j > 0 && stages[j - 1].v > 0 ? (s.v / stages[j - 1].v) * 100 : null
          const maxRaw = stages[0].v || 1
          const pctWidth = Math.max(8, (s.v / maxRaw) * 100)

          return (
            <div key={j} className="space-y-1.5 p-3 rounded-lg bg-muted/30 border border-border">
              {rate != null && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
                  ↓ {formatters.pct(rate)} converted from {stages[j - 1].label.toLowerCase()}
                </p>
              )}
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-foreground">{s.label}</span>
                <span className="font-bold font-mono">{formatters.int(s.v)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-700 to-amber-500"
                  style={{ width: `${pctWidth}%` }}
                />
              </div>
              {s.cost != null && (
                <p className="text-[10px] text-muted-foreground">
                  {formatters.inr2(s.cost, currency)} {s.per}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* =========================================================================
   KPI CARD COMPONENT
   ========================================================================= */

function KPICard({
  label,
  value,
  sub,
  highlight,
  targetClass
}: {
  label: string
  value: string
  sub?: React.ReactNode
  highlight?: boolean
  targetClass?: '' | 'good' | 'warn' | 'bad'
}) {
  return (
    <Card className="border-border bg-card shadow-sm hover:shadow transition-shadow">
      <CardContent className="p-3.5">
        <p className="text-[11px] text-muted-foreground font-semibold tracking-tight">{label}</p>
        <p
          className={`text-xl sm:text-2xl font-black tracking-tight mt-1 truncate ${
            targetClass === 'good'
              ? 'text-emerald-600 dark:text-emerald-400'
              : targetClass === 'bad'
              ? 'text-red-600 dark:text-red-400'
              : targetClass === 'warn'
              ? 'text-amber-600 dark:text-amber-400'
              : highlight
              ? 'text-primary'
              : 'text-foreground'
          }`}
        >
          {value}
        </p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
      </CardContent>
    </Card>
  )
}
