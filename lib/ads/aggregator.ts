/**
 * Netgain Ads — Aggregator, Recalculation & Insights Engine
 * Ported and enhanced from Meta Ads Performance Dashboard artifact.
 * 
 * STRICT MANDATE:
 * Recalculate aggregate rates and cost metrics from their underlying totals.
 * Never blindly sum percentages, CPC, CPM, CPL or other ratios.
 */

import type {
  AggregatedMetrics,
  EfficiencyMetric,
  FunnelStage,
  InsightItem,
  MeasureKey,
  ParsedAdsRow,
  ReportDimensions,
  ReportMeasures,
  TargetRange
} from './types'
import { MEASURES } from './parser'

const nf0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 })
const nf2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatters = {
  inr: (v: number | null, cur: string = '\u20B9') =>
    v == null ? '\u2013' : `${cur}${nf0.format(Math.round(v))}`,
  inr2: (v: number | null, cur: string = '\u20B9') =>
    v == null ? '\u2013' : `${cur}${nf2.format(v)}`,
  int: (v: number | null) => (v == null ? '\u2013' : nf0.format(Math.round(v))),
  pct: (v: number | null) => (v == null ? '\u2013' : `${nf2.format(v)}%`),
  dec: (v: number | null) => (v == null ? '\u2013' : nf2.format(v)),
  x: (v: number | null) => (v == null ? '\u2013' : `${nf2.format(v)}x`),
  compact: (v: number | null) => {
    if (v == null) return '\u2013'
    const a = Math.abs(v)
    if (a >= 1e9) return nf1.format(v / 1e9) + 'B'
    if (a >= 1e6) return nf1.format(v / 1e6) + 'M'
    if (a >= 1e4) return nf1.format(v / 1e3) + 'K'
    return nf0.format(Math.round(v))
  },
  date: (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso + 'T00:00:00')
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }
}

/**
 * Aggregates a list of rows, strictly recalculating all ratios and rates from totals.
 */
export function aggregateRows(
  rows: ParsedAdsRow[],
  has?: Partial<ReportMeasures>
): AggregatedMetrics {
  const a: AggregatedMetrics = {
    n: rows.length,
    spend: 0,
    impr: 0,
    reach: 0,
    clicksLink: 0,
    clicksAll: 0,
    clicksOut: 0,
    clicks: null,
    lpv: 0,
    leads: 0,
    results: 0,
    purchases: 0,
    revenue: 0,
    engagements: 0,
    video: 0,
    messages: 0,
    ctr: null,
    cpc: null,
    cpm: null,
    cpl: null,
    cpr: null,
    cpp: null,
    cplpv: null,
    lpvRate: null,
    freq: null,
    roas: null
  }

  MEASURES.forEach((k) => {
    let sum = 0
    for (let r = 0; r < rows.length; r++) {
      const v = rows[r][k]
      if (v != null) sum += v
    }
    a[k] = sum
  })

  const sp = a.spend > 0
  const cost = (count: number) => (sp && count > 0 ? a.spend / count : null)

  const clicksLink = has?.clicksLink ? a.clicksLink : 0
  const clicksOut = has?.clicksOut ? a.clicksOut : 0
  const clicksAll = has?.clicksAll ? a.clicksAll : 0
  a.clicks = has?.clicksLink
    ? clicksLink
    : has?.clicksOut
    ? clicksOut
    : has?.clicksAll
    ? clicksAll
    : null

  a.ctr = a.clicks != null && a.impr > 0 ? (a.clicks / a.impr) * 100 : null
  a.cpc = a.clicks != null ? cost(a.clicks) : null
  a.cpm = a.impr > 0 && sp ? (a.spend / a.impr) * 1000 : null
  a.cpl = a.leads > 0 ? cost(a.leads) : null
  a.cpr = a.results > 0 ? cost(a.results) : null
  a.cpp = a.purchases > 0 ? cost(a.purchases) : null
  a.cplpv = a.lpv > 0 ? cost(a.lpv) : null
  a.lpvRate = a.lpv > 0 && a.clicks && a.clicks > 0 ? (a.lpv / a.clicks) * 100 : null
  a.freq = a.reach > 0 && a.impr > 0 ? a.impr / a.reach : null
  a.roas = a.revenue > 0 && sp ? a.revenue / a.spend : null

  return a
}

export function groupRowsBy(
  rows: ParsedAdsRow[],
  keyFn: (r: ParsedAdsRow) => string,
  has?: Partial<ReportMeasures>
): (AggregatedMetrics & { key: string; first: ParsedAdsRow; rows: ParsedAdsRow[] })[] {
  const m = new Map<string, ParsedAdsRow[]>()
  rows.forEach((r) => {
    const k = keyFn(r)
    let g = m.get(k)
    if (!g) {
      g = []
      m.set(k, g)
    }
    g.push(r)
  })

  const out: (AggregatedMetrics & { key: string; first: ParsedAdsRow; rows: ParsedAdsRow[] })[] = []
  m.forEach((rs, k) => {
    const a = aggregateRows(rs, has)
    out.push({
      ...a,
      key: k,
      first: rs[0],
      rows: rs
    })
  })

  return out
}

export function getEfficiencyMetric(has: ReportMeasures): EfficiencyMetric | null {
  if (!has.spend) return null
  if (has.leads) return { key: 'cpl', res: 'leads', resLabel: 'Leads', label: 'Cost per lead' }
  if (has.results) return { key: 'cpr', res: 'results', resLabel: 'Results', label: 'Cost per result' }
  if (has.purchases) return { key: 'cpp', res: 'purchases', resLabel: 'Purchases', label: 'Cost per purchase' }
  if (has.lpv) return { key: 'cplpv', res: 'lpv', resLabel: 'Landing page views', label: 'Cost per landing page view' }
  if (has.hasClicks) return { key: 'cpc', res: 'clicks', resLabel: 'Clicks', label: 'Cost per click' }
  return null
}

export function buildFunnelStages(
  tot: AggregatedMetrics,
  has: ReportMeasures
): FunnelStage[] {
  const stages: FunnelStage[] = []
  if (has.impr && tot.impr > 0) {
    stages.push({ label: 'Impressions', v: tot.impr, cost: tot.cpm, per: 'per 1,000', verb: '' })
  }
  if (tot.clicks != null && tot.clicks > 0) {
    stages.push({
      label: has.clicksLink ? 'Link clicks' : 'Clicks',
      v: tot.clicks,
      cost: tot.cpc,
      per: 'each',
      verb: 'click'
    })
  }
  if (has.lpv && tot.lpv > 0) {
    stages.push({ label: 'Landing page views', v: tot.lpv, cost: tot.cplpv, per: 'each', verb: 'load the page' })
  }
  if (has.leads && tot.leads > 0) {
    stages.push({ label: 'Leads', v: tot.leads, cost: tot.cpl, per: 'each', verb: 'become leads' })
  } else if (has.results && tot.results > 0) {
    stages.push({ label: 'Results', v: tot.results, cost: tot.cpr, per: 'each', verb: 'convert' })
  }
  if (has.purchases && tot.purchases > 0 && !(has.leads || has.results)) {
    stages.push({ label: 'Purchases', v: tot.purchases, cost: tot.cpp, per: 'each', verb: 'purchase' })
  }
  return stages
}

export const LEVEL_DEFS = {
  campaign: {
    label: 'Campaign',
    key: (r: ParsedAdsRow) => r.campaign || '(no campaign)',
    name: (r: ParsedAdsRow) => r.campaign || '(no campaign)',
    sub: () => ''
  },
  adset: {
    label: 'Ad set',
    key: (r: ParsedAdsRow) => `${r.campaign}\u0001${r.adset}`,
    name: (r: ParsedAdsRow) => r.adset || '(no ad set)',
    sub: (r: ParsedAdsRow) => r.campaign
  },
  ad: {
    label: 'Ad',
    key: (r: ParsedAdsRow) => `${r.campaign}\u0001${r.adset}\u0001${r.ad}`,
    name: (r: ParsedAdsRow) => r.ad || '(no ad)',
    sub: (r: ParsedAdsRow) => [r.adset, r.campaign].filter(Boolean).join(' / ')
  }
}

export function parseTargetRange(target: TargetRange): { min: number | null; max: number | null } {
  const mn = parseFloat(target.min)
  const mx = parseFloat(target.max)
  return {
    min: isNaN(mn) ? null : mn,
    max: isNaN(mx) ? null : mx
  }
}

export function getTargetClass(
  v: number | null,
  avg: number | null,
  spendShare: number,
  target: TargetRange
): '' | 'good' | 'warn' | 'bad' {
  const t = parseTargetRange(target)
  if (v == null) return ''
  if (t.min != null || t.max != null) {
    if (t.max != null && v > t.max) return 'bad'
    if (t.min != null && v < t.min) return 'warn'
    return 'good'
  }
  if (avg && spendShare >= 0.01) {
    if (v <= avg * 0.85) return 'good'
    if (v >= avg * 1.25) return 'bad'
  }
  return ''
}

export function generateInsights(
  rows: ParsedAdsRow[],
  tot: AggregatedMetrics,
  E: EfficiencyMetric | null,
  dim: ReportDimensions,
  has: ReportMeasures,
  target: TargetRange,
  currency: string = '\u20B9'
): InsightItem[] {
  const out: InsightItem[] = []
  if (!E || !tot.spend) return out

  const lvl = dim.campaign ? 'campaign' : dim.adset ? 'adset' : dim.ad ? 'ad' : null
  const k = E.key
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

  if (lvl) {
    const cg = groupRowsBy(rows, LEVEL_DEFS[lvl].key, has)
    const valid = cg
      .filter((c) => c.spend >= tot.spend * 0.05 && (c[E.res] as number) > 0 && c[k] != null)
      .sort((a, b) => ((a[k] as number) || 0) - ((b[k] as number) || 0))

    if (valid.length >= 2) {
      const b = valid[0]
      const w = valid[valid.length - 1]
      const bCost = b[k] as number
      const wCost = w[k] as number
      if (wCost > bCost * 1.2) {
        out.push({
          type: '',
          html: `<b>${LEVEL_DEFS[lvl].name(b.first)}</b> is your cheapest source of ${E.resLabel.toLowerCase()} at ${formatters.inr(bCost, currency)} each. <b>${LEVEL_DEFS[lvl].name(w.first)}</b> costs ${formatters.inr(wCost, currency)} (${nf1.format(wCost / bCost)}x as much) and took ${nf0.format((w.spend / tot.spend) * 100)}% of spend.`
        })
      }
    }

    const t = parseTargetRange(target)
    if (t.max != null || t.min != null) {
      const above = cg.filter(
        (c) => t.max != null && c[k] != null && (c[k] as number) > t.max && c.spend >= tot.spend * 0.02
      )
      const below = cg.filter(
        (c) => t.min != null && c[k] != null && (c[k] as number) < t.min && c.spend >= tot.spend * 0.02
      )

      if (above.length) {
        out.push({
          type: 'bad',
          html: `${plural(above.length, LEVEL_DEFS[lvl].label.toLowerCase())} above your ${formatters.inr(t.max, currency)} ceiling: ${above
            .slice(0, 3)
            .map((c) => `<b>${LEVEL_DEFS[lvl].name(c.first)}</b> (${formatters.inr(c[k] as number, currency)})`)
            .join(', ')}.`
        })
      }
      if (below.length) {
        out.push({
          type: 'warn',
          html: `${plural(below.length, LEVEL_DEFS[lvl].label.toLowerCase())} below your ${formatters.inr(t.min, currency)} floor, worth checking lead quality: ${below
            .slice(0, 3)
            .map((c) => `<b>${LEVEL_DEFS[lvl].name(c.first)}</b> (${formatters.inr(c[k] as number, currency)})`)
            .join(', ')}.`
        })
      }
    }
  }

  // Dead spend
  if (E.res !== 'clicks') {
    const dl = dim.ad ? 'ad' : dim.adset ? 'adset' : dim.campaign ? 'campaign' : null
    if (dl) {
      const dg = groupRowsBy(rows, LEVEL_DEFS[dl].key, has)
      const dead = dg
        .filter((g) => g.spend >= tot.spend * 0.02 && !((g[E.res] as number) > 0))
        .sort((a, b) => b.spend - a.spend)

      if (dead.length) {
        const ds = dead.reduce((s, g) => s + g.spend, 0)
        out.push({
          type: 'bad',
          html: `${formatters.inr(ds, currency)} (${nf0.format((ds / tot.spend) * 100)}% of spend) went to ${plural(
            dead.length,
            LEVEL_DEFS[dl].label.toLowerCase()
          )} with no ${E.resLabel.toLowerCase()}: ${dead
            .slice(0, 3)
            .map((g) => `<b>${LEVEL_DEFS[dl].name(g.first)}</b>`)
            .join(', ')}${dead.length > 3 ? ` and ${dead.length - 3} more` : ''}.`
        })
      }
    }
  }

  // High ad fatigue frequency
  if (has.reach && has.impr) {
    const fl = dim.adset ? 'adset' : dim.campaign ? 'campaign' : null
    if (fl) {
      const fg = groupRowsBy(rows, LEVEL_DEFS[fl].key, has)
        .filter((g) => g.freq != null && g.freq > 3 && g.spend >= tot.spend * 0.03)
        .sort((a, b) => (b.freq || 0) - (a.freq || 0))

      if (fg.length) {
        out.push({
          type: 'bad',
          html: `High frequency in ${fg
            .slice(0, 3)
            .map((g) => `<b>${LEVEL_DEFS[fl].name(g.first)}</b> (${nf1.format(g.freq!)})`)
            .join(', ')}. People are seeing the same ads more than 3 times, so refresh the creative or widen the audience.`
        })
      }
    }
  }

  // Age group efficiency
  if (dim.age) {
    const ag = groupRowsBy(rows, (r) => r.age || 'Unknown', has)
      .filter((g) => g.spend >= tot.spend * 0.08 && (g[E.res] as number) > 0 && g[k] != null)
      .sort((a, b) => ((a[k] as number) || 0) - ((b[k] as number) || 0))

    if (ag.length >= 2) {
      const ab = ag[0]
      const aw = ag[ag.length - 1]
      const abCost = ab[k] as number
      const awCost = aw[k] as number
      if (awCost > abCost * 1.25) {
        out.push({
          type: '',
          html: `Ages <b>${ab.key}</b> give the cheapest ${E.resLabel.toLowerCase()} at ${formatters.inr(abCost, currency)}. Ages <b>${aw.key}</b> cost ${formatters.inr(awCost, currency)} and hold ${nf0.format((aw.spend / tot.spend) * 100)}% of spend.`
        })
      }
    }
  }

  return out.slice(0, 6)
}
