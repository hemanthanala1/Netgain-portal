/**
 * Netgain Ads — File Parser & Header Detection Service
 * Ported and enhanced from Meta Ads Performance Dashboard artifact.
 * Supports CSV, TSV, TXT, XLSX, XLS, and XLSM formats.
 */

import * as XLSX from 'xlsx'
import type {
  CustomColumnMeta,
  MeasureKey,
  ParsedAdsReportData,
  ParsedAdsRow,
  ReportDimensions,
  ReportMeasures,
  TextColumnMeta
} from './types'

export interface MetaFieldDef {
  k: string
  label: string
  g: string
  re: RegExp[]
  derived?: boolean
  text?: boolean
}

export const META_FIELDS: MetaFieldDef[] = [
  { k: 'date', label: 'Date (day or reporting starts)', g: 'Where and when', re: [/^(day|date|reporting starts?|start date|date start)$/] },
  { k: 'date_end', label: 'Reporting ends', g: 'Where and when', re: [/^(reporting ends?|end date|date stop)$/] },
  { k: 'campaign', label: 'Campaign name', g: 'Structure', re: [/^campaign( name)?$/] },
  { k: 'adset', label: 'Ad set name', g: 'Structure', re: [/^ad ?set( name)?$/] },
  { k: 'ad', label: 'Ad name', g: 'Structure', re: [/^ad( name)?$/] },
  { k: 'objective', label: 'Objective', g: 'Structure', re: [/^(campaign )?objective$/] },
  { k: 'age', label: 'Age', g: 'Audience', re: [/^age( range| group)?$/] },
  { k: 'gender', label: 'Gender', g: 'Audience', re: [/^gender$/] },
  { k: 'placement', label: 'Placement or platform', g: 'Audience', re: [/^(placement|platform|publisher platform|platform placement)$/] },
  { k: 'region', label: 'Region', g: 'Audience', re: [/^(region|state|city|country|dma region)$/] },
  { k: 'cplpv', label: 'Cost per landing page view', g: 'Results', derived: true, re: [/cost per (landing page view|lpv)/] },
  { k: 'cpl', label: 'Cost per lead', g: 'Results', derived: true, re: [/cost per (lead|website lead|on facebook lead)/, /^cpl( |$)/] },
  { k: 'cpr', label: 'Cost per result', g: 'Results', derived: true, re: [/cost per result/] },
  { k: 'cpp', label: 'Cost per purchase', g: 'Results', derived: true, re: [/cost per (purchase|website purchase)/] },
  { k: 'roas', label: 'ROAS', g: 'Results', derived: true, re: [/roas|return on ad spend/] },
  { k: 'revenue', label: 'Conversion value', g: 'Results', re: [/purchases? conversion value|purchase value|^revenue$/] },
  { k: 'spend', label: 'Amount spent', g: 'Delivery and cost', re: [/^(amount spent|spend)/, /^cost$/] },
  { k: 'impr', label: 'Impressions', g: 'Delivery and cost', re: [/^impressions?/] },
  { k: 'reach', label: 'Reach', g: 'Delivery and cost', re: [/^reach/] },
  { k: 'freq', label: 'Frequency', g: 'Delivery and cost', derived: true, re: [/^frequency/] },
  { k: 'clicksLink', label: 'Link clicks', g: 'Delivery and cost', re: [/^link clicks?$/] },
  { k: 'clicksOut', label: 'Outbound clicks', g: 'Delivery and cost', re: [/^outbound clicks?/] },
  { k: 'clicksAll', label: 'Clicks (all)', g: 'Delivery and cost', re: [/^clicks( all)?$/] },
  { k: 'ctrLink', label: 'CTR (link click-through rate)', g: 'Delivery and cost', derived: true, re: [/^ctr.*link|link click through rate/] },
  { k: 'ctrAll', label: 'CTR (all)', g: 'Delivery and cost', derived: true, re: [/^ctr/] },
  { k: 'cpcLink', label: 'CPC (cost per link click)', g: 'Delivery and cost', derived: true, re: [/^cpc.*link|cost per link click/] },
  { k: 'cpcAll', label: 'CPC (all)', g: 'Delivery and cost', derived: true, re: [/^cpc/, /^cost per click/] },
  { k: 'cpmCol', label: 'CPM (cost per 1,000 impressions)', g: 'Delivery and cost', derived: true, re: [/^cpm/, /cost per 1 ?000 impressions/] },
  { k: 'lpv', label: 'Landing page views', g: 'Results', re: [/^(website )?landing page views?$/] },
  { k: 'leads', label: 'Leads', g: 'Results', re: [/^(website |on facebook |meta )?leads?( (form|meta|all))?$/] },
  { k: 'results', label: 'Results', g: 'Results', re: [/^results$/] },
  { k: 'resultType', label: 'Result indicator', g: 'Results', text: true, re: [/^result (indicator|type)$/] },
  { k: 'purchases', label: 'Purchases', g: 'Results', re: [/^(website )?purchases?( all)?$/] },
  { k: 'engagements', label: 'Post or page engagements', g: 'Delivery and cost', re: [/^(post|page) engagements?$/] },
  { k: 'video', label: 'ThruPlays or video plays', g: 'Delivery and cost', re: [/^(thruplays?|video plays?)$/] },
  { k: 'messages', label: 'Messaging conversations started', g: 'Results', re: [/^messaging conversations started$/] }
]

export const MEASURES: MeasureKey[] = [
  'spend',
  'impr',
  'reach',
  'clicksLink',
  'clicksAll',
  'clicksOut',
  'lpv',
  'leads',
  'results',
  'purchases',
  'revenue',
  'engagements',
  'video',
  'messages'
]

export function normHeader(h: any): string {
  return String(h == null ? '' : h)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function autoMapHeaders(headers: string[]): { map: Record<string, number>; used: Record<number, number> } {
  const norm = headers.map(normHeader)
  const map: Record<string, number> = {}
  const used: Record<number, number> = {}

  META_FIELDS.forEach((f) => {
    for (let i = 0; i < norm.length; i++) {
      if (used[i]) continue
      if (f.re.some((r) => r.test(norm[i]))) {
        map[f.k] = i
        used[i] = 1
        break
      }
    }
  })

  return { map, used }
}

export function parseNumber(v: any): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return isFinite(v) ? v : null
  let s = String(v).trim()
  if (s === '' || s === '-' || s === '\u2013' || s === '\u2014' || /^n\/?a$/i.test(s)) return null
  s = s.replace(/[\u20B9$\u20AC\u00A3,\s%]|INR|USD|EUR|GBP/gi, '')
  if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1, -1)
  const n = Number(s)
  return isFinite(n) ? n : null
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function toISODate(v: any): string {
  if (v == null || v === '') return ''
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return ''
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`
  }
  // Check for Excel serial date number
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const epoch = new Date(Math.round((v - 25569) * 86400 * 1000))
    if (!isNaN(epoch.getTime())) {
      return `${epoch.getFullYear()}-${pad2(epoch.getMonth() + 1)}-${pad2(epoch.getDate())}`
    }
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/)
  if (m) {
    let y = m[3]
    if (y.length === 2) y = '20' + y
    return `${y}-${pad2(+m[2])}-${pad2(+m[1])}`
  }
  const t = Date.parse(s)
  if (!isNaN(t)) {
    const d = new Date(t)
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  }
  return ''
}

export function parseDelimitedText(text: string): (string | number)[][] {
  text = String(text).replace(/^\uFEFF/, '')
  const first = text.split(/\r?\n/, 1)[0] || ''
  let delim = ','
  let best = -1
  ;['\t', ',', ';'].forEach((d) => {
    const count = first.split(d).length - 1
    if (count > best) {
      best = count
      delim = d
    }
  })

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          q = false
        }
      } else {
        cell += c
      }
    } else {
      if (c === '"') {
        q = true
      } else if (c === delim) {
        row.push(cell)
        cell = ''
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++
        row.push(cell)
        cell = ''
        rows.push(row)
        row = []
      } else {
        cell += c
      }
    }
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }

  return rows.filter((r) => r.some((c) => String(c).trim() !== ''))
}

export function findHeaderRow(rows: any[][]): number {
  let best = 0
  let bs = -1
  const lim = Math.min(rows.length, 15)
  for (let i = 0; i < lim; i++) {
    const norm = rows[i].map(normHeader)
    let score = 0
    META_FIELDS.forEach((f) => {
      if (norm.some((h) => f.re.some((r) => r.test(h)))) score++
    })
    if (score > bs) {
      bs = score
      best = i
    }
  }
  return best
}

export interface WorkbookSheetChoice {
  name: string
  rowCount: number
}

export function inspectWorkbookSheets(buffer: ArrayBuffer | Buffer): {
  sheets: WorkbookSheetChoice[]
  recommendedSheet: string
} {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheets: WorkbookSheetChoice[] = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    const ref = ws['!ref']
    let rowCount = 0
    if (ref) {
      const range = XLSX.utils.decode_range(ref)
      rowCount = range.e.r - range.s.r + 1
    }
    return { name, rowCount }
  })

  // Recommend sheet with keywords or highest row count
  const match = wb.SheetNames.find((n) => /raw|data|export|ad|campaign/i.test(n))
  const recommendedSheet = match || wb.SheetNames[0] || 'Sheet1'

  return { sheets, recommendedSheet }
}

export function parseExcelWorkbook(
  buffer: ArrayBuffer | Buffer,
  selectedSheet?: string
): { sheetName: string; rows: (string | number)[][] } {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName =
    selectedSheet && wb.SheetNames.includes(selectedSheet)
      ? selectedSheet
      : wb.SheetNames.find((n) => /raw|data|export/i.test(n)) || wb.SheetNames[0]

  if (!sheetName || !wb.Sheets[sheetName]) {
    throw new Error('No readable worksheets found in this Excel workbook.')
  }

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: ''
  }) as (string | number)[][]

  return { sheetName, rows }
}

export function ingestAdsReport(
  headers: string[],
  dataRows: any[][],
  meta: { source: 'file' | 'sample' | 'paste'; name: string; sheetName?: string; fileSize?: number }
): { data: ParsedAdsReportData | null; error: string | null } {
  headers = headers.map((h, i) => {
    const s = h == null ? '' : String(h).trim()
    return s || `Column ${i + 1}`
  })

  const { map, used } = autoMapHeaders(headers)
  const coreCols = ['spend', 'impr', 'clicksLink', 'clicksAll', 'clicksOut', 'lpv', 'leads', 'results', 'purchases', 'campaign']

  if (!coreCols.some((k) => map[k] != null)) {
    return {
      data: null,
      error:
        'No standard Meta Ads columns found. Expected headers such as Campaign name, Amount spent, Impressions, Clicks, or Results. Please verify that this is an Ads Manager export.'
    }
  }

  const has: ReportMeasures = {
    spend: map.spend != null,
    impr: map.impr != null,
    reach: map.reach != null,
    clicksLink: map.clicksLink != null,
    clicksAll: map.clicksAll != null,
    clicksOut: map.clicksOut != null,
    lpv: map.lpv != null,
    leads: map.leads != null,
    results: map.results != null,
    purchases: map.purchases != null,
    revenue: map.revenue != null || map.roas != null,
    engagements: map.engagements != null,
    video: map.video != null,
    messages: map.messages != null,
    hasClicks: map.clicksLink != null || map.clicksOut != null || map.clicksAll != null,
    showResults: false
  }

  const dim: ReportDimensions = {
    campaign: map.campaign != null,
    adset: map.adset != null,
    ad: map.ad != null,
    age: map.age != null,
    gender: map.gender != null,
    placement: map.placement != null,
    region: map.region != null,
    objective: map.objective != null,
    date: map.date != null
  }

  // Detect custom and extra text columns
  const custom: CustomColumnMeta[] = []
  const textCols: TextColumnMeta[] = []

  headers.forEach((h, i) => {
    if (used[i]) return
    let n = 0
    let tot = 0
    for (let r = 0; r < Math.min(dataRows.length, 200); r++) {
      const v = dataRows[r][i]
      if (v === '' || v == null) continue
      tot++
      if (parseNumber(v) != null) n++
    }
    if (tot && n / tot >= 0.7) {
      custom.push({
        i,
        h,
        avg: /cost|cpc|cpm|cpl|ctr|rate|roas|frequency|per |%|ratio|score/i.test(h)
      })
    } else {
      textCols.push({ i, h })
    }
  })

  const getCol = (r: any[], k: string) => (map[k] != null ? r[map[k]] : undefined)
  const toStr = (v: any) => (v == null ? '' : String(v).trim())

  const rows: ParsedAdsRow[] = []
  dataRows.forEach((r) => {
    const o: ParsedAdsRow = {
      campaign: toStr(getCol(r, 'campaign')),
      adset: toStr(getCol(r, 'adset')),
      ad: toStr(getCol(r, 'ad')),
      age: toStr(getCol(r, 'age')),
      gender: toStr(getCol(r, 'gender')),
      placement: toStr(getCol(r, 'placement')),
      region: toStr(getCol(r, 'region')),
      objective: toStr(getCol(r, 'objective')),
      date: toISODate(getCol(r, 'date')),
      dateEnd: toISODate(getCol(r, 'date_end')),
      spend: parseNumber(getCol(r, 'spend')),
      impr: parseNumber(getCol(r, 'impr')),
      reach: parseNumber(getCol(r, 'reach')),
      clicksLink: parseNumber(getCol(r, 'clicksLink')),
      clicksAll: parseNumber(getCol(r, 'clicksAll')),
      clicksOut: parseNumber(getCol(r, 'clicksOut')),
      lpv: parseNumber(getCol(r, 'lpv')),
      leads: parseNumber(getCol(r, 'leads')),
      results: parseNumber(getCol(r, 'results')),
      purchases: parseNumber(getCol(r, 'purchases')),
      revenue: parseNumber(getCol(r, 'revenue')),
      engagements: parseNumber(getCol(r, 'engagements')),
      video: parseNumber(getCol(r, 'video')),
      messages: parseNumber(getCol(r, 'messages')),
      c: custom.map((c) => parseNumber(r[c.i]))
    }

    if (dim.campaign && !o.campaign && !o.adset && !o.ad) return
    if (/^(grand )?total\b/i.test(o.campaign)) return

    // ROAS fallback to revenue calculation
    if (map.revenue == null && map.roas != null) {
      const ro = parseNumber(getCol(r, 'roas'))
      o.revenue = ro != null && o.spend != null ? ro * o.spend : null
    }

    rows.push(o)
  })

  if (!rows.length) {
    return { data: null, error: 'No data rows found underneath the header row.' }
  }

  const seenDates: Record<string, number> = {}
  rows.forEach((r) => {
    if (r.date) seenDates[r.date] = 1
  })
  const dateList = Object.keys(seenDates).sort()

  // Detect currency from spend column header or symbol
  const spHdr = map.spend != null ? headers[map.spend] : ''
  let currency = '\u20B9' // default INR
  if (/usd|\$/i.test(spHdr)) currency = '$'
  else if (/eur|\u20AC/i.test(spHdr)) currency = '\u20AC'
  else if (/gbp|\u00A3/i.test(spHdr)) currency = '\u00A3'
  else if (/inr|\u20B9/i.test(spHdr)) currency = '\u20B9'

  // Results vs Leads differentiation
  let sr = 0
  let sl = 0
  rows.forEach((r) => {
    sr += r.results || 0
    sl += r.leads || 0
  })
  has.showResults = has.results && (!has.leads || Math.abs(sr - sl) > 0.5)

  const reportData: ParsedAdsReportData = {
    headers,
    map,
    used,
    rows,
    dim,
    has,
    custom,
    textCols,
    dateList,
    rawRows: dataRows.slice(0, 1000), // preserve raw rows for inspector (capped for safety)
    currency,
    meta: {
      ...meta,
      loadedAt: Date.now()
    }
  }

  return { data: reportData, error: null }
}

export function generateSampleAdsData(): { header: string[]; rows: any[][] } {
  let seed = 20260920
  const rnd = () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const camps = [
    {
      n: 'Demo | Lead Gen | Cold Interest | Phase I',
      sets: [
        { n: 'Interest: education seekers', ads: ['Carousel: programs', 'Video: campus tour'], cpm: 96, ctr: 1.45, lpv: 0.74, cvr: 0.105, w: 1.3, f: 1.3 },
        { n: 'Lookalike 1% of leads', ads: ['Carousel: programs', 'Static: admissions open'], cpm: 112, ctr: 1.7, lpv: 0.78, cvr: 0.14, w: 1.0, f: 1.25 }
      ]
    },
    {
      n: 'Demo | Brand Awareness | Broad | Phase I',
      sets: [{ n: 'Broad 18 to 34', ads: ['Reel: student stories', 'Static: brand'], cpm: 41, ctr: 0.62, lpv: 0.6, cvr: 0.012, w: 1.1, f: 1.5 }]
    },
    {
      n: 'Demo | Website Conversions | Retargeting | Phase I',
      sets: [{ n: 'Site visitors 30 days', ads: ['Static: last few seats', 'Video: testimonial'], cpm: 158, ctr: 2.4, lpv: 0.83, cvr: 0.19, w: 0.45, f: 3.3 }]
    }
  ]

  const ages = ['18-24', '25-34', '35-44']
  const aw = [1.25, 1, 0.55]
  const ac = [1.1, 1, 0.7]
  const gens = ['female', 'male']
  const gw = [0.9, 1.1]
  const gc = [1.15, 0.9]
  const header = ['Day', 'Campaign name', 'Ad set name', 'Ad name', 'Age', 'Gender', 'Amount spent (INR)', 'Impressions', 'Reach', 'Link clicks', 'Landing page views', 'Leads']
  const rows: any[][] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let d = 28; d >= 1; d--) {
    const dt = new Date(today.getTime() - d * 86400000)
    const iso = `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`
    camps.forEach((c) => {
      c.sets.forEach((s) => {
        s.ads.forEach((ad, ai) => {
          ages.forEach((ag, gi) => {
            gens.forEach((ge, ki) => {
              const adw = ai === 1 && s.n.indexOf('Lookalike') === 0 ? 0.35 : 1
              const spend = 70 * s.w * aw[gi] * gw[ki] * adw * (0.75 + 0.5 * rnd())
              const impr = Math.round((spend / s.cpm) * 1000 * (0.9 + 0.2 * rnd()))
              const reach = Math.round(impr / (s.f * (0.92 + 0.16 * rnd())))
              const clicks = Math.round((impr * s.ctr) / 100 * (0.85 + 0.3 * rnd()))
              const lpv = Math.round(clicks * s.lpv * (0.9 + 0.2 * rnd()))
              const cvr = s.cvr * ac[gi] * gc[ki] * (adw < 1 ? 0.25 : 1)
              const leads = Math.max(0, Math.round(lpv * cvr * (0.55 + 0.9 * rnd())))
              rows.push([iso, c.n, s.n, ad, ag, ge, Math.round(spend * 100) / 100, impr, reach, clicks, lpv, leads])
            })
          })
        })
      })
    })
  }

  return { header, rows }
}
