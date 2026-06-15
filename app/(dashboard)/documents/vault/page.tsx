'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Download, Archive, Copy, FolderOpen, FileText, Receipt, ClipboardList, HandshakeIcon, FolderKanban, ArchiveRestore, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

interface VaultDoc {
  id: string
  docId: string
  type: 'Quotation' | 'Invoice' | 'SOW' | 'Agreement' | 'PRD' | 'Marketing'
  client: string
  title: string
  amount: number
  status: string
  date: string
  tags: string[]
  raw: any
}

const mockDocs: VaultDoc[] = [
  { id: 'd1', docId: 'NG-QUO-2024-1123', type: 'Quotation', client: 'Urban Edge Co.', title: 'E-Commerce + SEO Package', amount: 47998, status: 'sent', date: '2024-06-04', tags: ['quotation', 'ecommerce'], raw: null },
  { id: 'd2', docId: 'NG-INV-2024-0891', type: 'Invoice', client: 'FashionHub India', title: 'Monthly Retainer Invoice', amount: 29997, status: 'paid', date: '2024-05-30', tags: ['invoice', 'paid'], raw: null },
  { id: 'd3', docId: 'NG-SOW-2024-0034', type: 'SOW', client: 'TechCore Solutions', title: 'Custom SaaS Platform Build SOW', amount: 149999, status: 'signed', date: '2024-05-28', tags: ['sow', 'development'], raw: null },
  { id: 'd4', docId: 'NG-AGR-2024-0021', type: 'Agreement', client: 'TechCore Solutions', title: 'Service Level Agreement', amount: 149999, status: 'signed', date: '2024-05-28', tags: ['agreement'], raw: null },
  { id: 'd5', docId: 'NG-QUO-2024-1098', type: 'Quotation', client: 'FashionHub India', title: 'Full Digital Marketing Bundle', amount: 29997, status: 'approved', date: '2024-05-28', tags: ['quotation', 'marketing'], raw: null },
  { id: 'd6', docId: 'NG-INV-2024-0892', type: 'Invoice', client: 'TechCore Solutions', title: 'Web Development Invoice', amount: 149999, status: 'sent', date: '2024-06-01', tags: ['invoice'], raw: null },
]

const typeIcon: Record<string, any> = {
  Quotation: FileText, Invoice: Receipt, SOW: ClipboardList, Agreement: HandshakeIcon, PRD: FolderKanban, Marketing: FileText
}

const typeColors: Record<string, string> = {
  Quotation: 'text-blue-400 bg-blue-500/10', Invoice: 'text-gold bg-gold/10',
  SOW: 'text-purple-400 bg-purple-500/10', Agreement: 'text-emerald-400 bg-emerald-500/10', PRD: 'text-pink-400 bg-pink-500/10',
  Marketing: 'text-amber-400 bg-amber-500/10'
}

export default function VaultPage() {
  const [docs, setDocs] = useState<VaultDoc[]>([])
  const [services, setServices] = useState<any[]>([])
  const [paymentSchedules, setPaymentSchedules] = useState<any[]>([])
  const [companyDocs, setCompanyDocs] = useState<any>(null)
  
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const { toast } = useToast()

  const getTableNameForDocType = (type: string) => {
    switch (type) {
      case 'Quotation': return 'quotations'
      case 'Invoice': return 'invoices'
      case 'SOW': return 'sows'
      case 'Agreement': return 'agreements'
      case 'PRD': return 'prds'
      case 'Marketing': return 'marketing_reports'
      default: return ''
    }
  }

  const fetchDocuments = async () => {
    if (!isSupabaseConfigured()) {
      setDocs(mockDocs)
      setLoading(false)
      return
    }
    try {
      const [
        quosRes,
        invsRes,
        sowsRes,
        agrsRes,
        prdsRes,
        mrktsRes,
        svRes,
        cRes
      ] = await Promise.all([
        supabase.from('quotations').select('*'),
        supabase.from('invoices').select('*'),
        supabase.from('sows').select('*'),
        supabase.from('agreements').select('*'),
        supabase.from('prds').select('*'),
        supabase.from('marketing_reports').select('*'),
        supabase.from('services').select('*').neq('status', 'archived').order('created_at', { ascending: false }),
        supabase.from('company_settings').select('*').limit(1).maybeSingle()
      ])

      // Store configuration values
      if (svRes.data) {
        setServices(svRes.data.map((s: any) => ({
          id: s.id,
          name: s.name,
          price: Number(s.quotation_price || s.price_max || s.base_price || 0),
          priceMin: s.price_min ? Number(s.price_min) : undefined,
          priceMax: s.price_max ? Number(s.price_max) : undefined,
          timeline: s.timeline || 'TBD',
          category: 'Service',
          model: s.pricing || 'fixed',
          deliverables: s.deliverables || []
        })))
      }
      if (cRes.data && cRes.data.docs) {
        setCompanyDocs(cRes.data.docs)
        if (cRes.data.docs.paymentSchedules) {
          setPaymentSchedules(cRes.data.docs.paymentSchedules)
        }
      }

      const mappedQuos = (quosRes.data || []).map((q: any) => ({
        id: q.id,
        docId: q.doc_id,
        type: 'Quotation' as const,
        client: q.client,
        title: q.project_title || 'Quotation',
        amount: Number(q.amount) || 0,
        status: q.status || 'draft',
        date: q.created || q.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        tags: ['quotation'],
        raw: q
      }))

      const mappedInvs = (invsRes.data || []).map((i: any) => ({
        id: i.id,
        docId: i.doc_id,
        type: 'Invoice' as const,
        client: i.client,
        title: 'Invoice',
        amount: Number(i.amount) || 0,
        status: i.status || 'draft',
        date: i.created || i.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        tags: ['invoice', i.status || 'draft'],
        raw: i
      }))

      const mappedSows = (sowsRes.data || []).map((s: any) => ({
        id: s.id,
        docId: s.doc_id,
        type: 'SOW' as const,
        client: s.client,
        title: s.project || 'Scope of Work',
        amount: Number(s.value) || 0,
        status: s.status || 'draft',
        date: s.created || s.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        tags: ['sow'],
        raw: s
      }))

      const mappedAgrs = (agrsRes.data || []).map((a: any) => ({
        id: a.id,
        docId: a.doc_id,
        type: 'Agreement' as const,
        client: a.client,
        title: a.type || 'Agreement',
        amount: Number(a.value) || 0,
        status: a.status || 'draft',
        date: a.created || a.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        tags: ['agreement'],
        raw: a
      }))

      const mappedPrds = (prdsRes.data || []).map((p: any) => ({
        id: p.id,
        docId: p.doc_id,
        type: 'PRD' as const,
        client: p.client,
        title: p.title || 'Product Requirement Document',
        amount: 0,
        status: p.status || 'draft',
        date: p.created || p.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        tags: ['prd', p.stack || ''].filter(Boolean),
        raw: p
      }))

      const mappedMrkts = (mrktsRes.data || []).map((m: any) => {
        let extra = { period: 'Monthly', channels: [] as string[] }
        try {
          extra = JSON.parse(m.title)
        } catch (e) {
          extra.period = m.title || 'Report'
        }
        return {
          id: m.id,
          docId: m.doc_id,
          type: 'Marketing' as const,
          client: m.client,
          title: `Marketing Report — ${extra.period}`,
          amount: 0,
          status: m.status || 'draft',
          date: m.created || m.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          tags: ['marketing', ...extra.channels],
          raw: m
        }
      })

      const combined = [
        ...mappedQuos,
        ...mappedInvs,
        ...mappedSows,
        ...mappedAgrs,
        ...mappedPrds,
        ...mappedMrkts
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      setDocs(combined)
    } catch (err: any) {
      console.error('Error fetching vault documents:', err)
      toast({ title: 'Error loading documents', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()

    let activeChannels: any[] = []
    if (isSupabaseConfigured()) {
      const tables = ['quotations', 'invoices', 'sows', 'agreements', 'prds', 'marketing_reports']
      activeChannels = tables.map(table => {
        return supabase
          .channel(`vault_${table}_realtime`)
          .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
            fetchDocuments()
          })
          .subscribe()
      })
    }

    return () => {
      if (isSupabaseConfigured()) {
        activeChannels.forEach(ch => supabase.removeChannel(ch))
      }
    }
  }, [])

  const generateAndSavePdf = async (payload: any, filenamePrefix: string) => {
    const res = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      throw new Error(e.error || 'PDF generation failed')
    }
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${filenamePrefix.replace(/\s+/g, '_')}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const downloadQuotation = async (doc: VaultDoc) => {
    const raw = doc.raw || {
      client: doc.client,
      project_title: doc.title,
      amount: doc.amount,
      status: doc.status,
      created: doc.date,
      doc_id: doc.docId
    }
    
    const svcs = services.filter(s => (raw.service_ids || []).includes(s.id))
    const sub = svcs.reduce((a, s) => a + s.price, 0)
    const dAmt = Math.round(sub * (raw.discount_pct || 0) / 100)
    const aft = sub - dAmt
    const gAmt = Math.round(aft * (raw.gst_pct || 18) / 100)
    const tot = aft + gAmt

    const buildQuoteContent = (q: any, svList: any[]) => {
      const lines = [
        '## Why Netgain?',
        'We are a full-service digital growth agency specializing in high-converting digital experiences, data-driven marketing, and automation for modern businesses.',
        '',
        '## Service Breakdown',
        ...svList.flatMap((s: any, i: number) => [
          `### ${i+1}. ${s.name}`,
          `**Category:** ${s.category}  |  **Timeline:** ${s.timeline}  |  **Model:** ${s.model === 'monthly' ? 'Monthly Recurring' : 'One-Time Fixed'}`,
          '',
          ...(s.deliverables?.map((d: any) => `- ${d}`) || []),
          '',
        ]),
        '## Payment Terms',
        `- One-time services: ${q.payment_terms_one_time || '50% advance to begin, 50% balance on final delivery'}`,
        `- Monthly retainers: ${q.payment_terms_monthly || 'Full monthly fee payable in advance each cycle'}`,
        '- Accepted: NEFT / IMPS / UPI / Cheque',
        '',
        q.notes ? `## Additional Notes\n${q.notes}` : '',
        '',
        '## Validity',
        `This quotation is valid for **${q.validity_days !== undefined && q.validity_days !== null ? q.validity_days : 14} days** from the date of issue.`,
      ]
      return lines.join('\n')
    }

    const payload = {
      docType: 'Quotation' as const,
      clientName: raw.contact || raw.client,
      projectTitle: raw.project_title || `Quotation — ${raw.client}`,
      companyName: raw.client,
      clientInfo: { business: raw.business_type, industry: raw.industry, mobile: raw.phone, gst: raw.gst },
      content: buildQuoteContent(raw, svcs),
      items: svcs.map(s => ({
        serviceName: s.name,
        finalPrice: s.price,
        price: s.price,
        quantity: 1,
        category: s.category,
        timeline: s.timeline,
        pricing_model: s.model,
        deliverables: s.deliverables
      })),
      subtotal: sub,
      discountTotal: dAmt,
      grandTotal: tot,
      fullProjectTotal: tot,
      fullSubtotal: sub,
      paymentScheduleObj: raw.payment_schedule_id ? paymentSchedules.find(p => p.id === raw.payment_schedule_id) : null,
      docsSettings: {
        gstRate: String(raw.gst_pct || 18),
        quotationValidity: String(raw.validity_days !== undefined && raw.validity_days !== null ? raw.validity_days : (companyDocs?.quotationValidity || '14')),
        paymentTermsOneTime: raw.payment_terms_one_time || companyDocs?.paymentTermsOneTime || '50% advance to begin, 50% balance on final delivery',
        paymentTermsMonthly: raw.payment_terms_monthly || companyDocs?.paymentTermsMonthly || 'Full monthly fee payable in advance each cycle',
        extraTerms: raw.extra_terms || companyDocs?.extraTerms || '',
        customTerms: raw.custom_terms || '',
      },
    }

    await generateAndSavePdf(payload, `Quotation_${raw.doc_id || doc.docId}_${raw.client}`)
  }

  const downloadInvoice = async (doc: VaultDoc) => {
    const raw = doc.raw || {
      client: doc.client,
      amount: doc.amount,
      status: doc.status,
      created: doc.date,
      doc_id: doc.docId
    }

    const svcIds = raw.service_ids || []
    const svcs = services.filter(s => svcIds.includes(s.id))
    const sub = svcs.reduce((a, s) => a + s.price, 0)
    
    const discVal = Number(raw.discount_value) || 0
    const discType = raw.discount_type || 'percentage'
    const dAmt = discType === 'percentage' ? Math.round(sub * discVal / 100) : discVal
    const aft = Math.max(0, sub - dAmt)
    const gstPct = Number(raw.gst_pct) || 0
    const gAmt = Math.round(aft * gstPct / 100)
    const tot = aft + gAmt

    let pct = 100
    const paymentScheduleEntry = raw.payment_schedule_entry || ''
    if (paymentScheduleEntry) {
      const match = paymentScheduleEntry.match(/\((\d+)%\)/)
      if (match) {
        pct = Number(match[1])
      }
    }
    const scaleFactor = pct / 100
    const scaledSub = Math.round(sub * scaleFactor)
    const scaledDAmt = Math.round(dAmt * scaleFactor)
    const scaledAft = Math.max(0, scaledSub - scaledDAmt)
    const scaledGAmt = Math.round(scaledAft * gstPct / 100)
    const scaledTot = scaledAft + scaledGAmt

    const scaledItems = svcs.map(s => {
      const scaledPrice = Math.round(s.price * scaleFactor)
      let customName = s.name
      if (paymentScheduleEntry) {
        customName = `${s.name} - ${paymentScheduleEntry}`
      }
      return { 
        serviceName: customName, 
        finalPrice: scaledPrice, 
        price: scaledPrice, 
        quantity: 1, 
        category: s.category, 
        pricing_model: s.model, 
        deliverables: s.deliverables 
      }
    })

    const today = new Date(raw.created || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    const dueFormatted = raw.due
      ? new Date(raw.due).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date(Date.now() + 10 * 864e5).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

    const payload = {
      docType: 'Invoice' as const,
      clientName: raw.contact || raw.client,
      projectTitle: `Invoice — ${raw.doc_id || doc.docId}`,
      companyName: raw.client,
      clientInfo: { business: raw.business_type, mobile: raw.phone, gst: raw.gst },
      content: [
        `## Invoice Details`,
        `**Invoice Date:** ${today}  |  **Due Date:** ${dueFormatted}`,
        `**Invoice Ref:** ${raw.doc_id || doc.docId}`,
        `${raw.gst ? `**Client GST:** ${raw.gst}` : ''}`,
        '',
        '## Services Rendered',
        ...scaledItems.flatMap((s: any, i: number) => [
          `### ${i + 1}. ${s.serviceName}`,
          `Category: ${s.category}  |  ${s.pricing_model === 'monthly' ? 'Monthly Recurring' : 'One-Time'}`,
          ...(s.deliverables?.map((d: any) => `- ${d}`) || []),
          '',
        ]),
        '## Payment Details',
        '__BANK_DETAILS__',
        ...(raw.invoice_payment_instructions ? ['', raw.invoice_payment_instructions] : (companyDocs?.invoicePaymentInstructions ? ['', companyDocs.invoicePaymentInstructions] : [])),
        ...(raw.invoice_additional_text ? ['', '## Additional Details', raw.invoice_additional_text] : (companyDocs?.invoiceAdditionalText ? ['', '## Additional Details', companyDocs.invoiceAdditionalText] : [])),
        ...(raw.notes ? ['', '## Notes', raw.notes] : []),
      ].join('\n'),
      items: scaledItems,
      subtotal: scaledSub,
      discountTotal: scaledDAmt,
      grandTotal: scaledTot,
      fullProjectTotal: tot,
      fullSubtotal: sub,
      paymentScheduleObj: raw.payment_schedule_id ? paymentSchedules.find(p => p.id === raw.payment_schedule_id) : null,
      docsSettings: {
        gstRate: String(gstPct),
        invoiceTerms: raw.invoice_terms !== undefined && raw.invoice_terms !== null ? raw.invoice_terms : (companyDocs?.invoiceTerms || ''),
        invoiceFooter: raw.invoice_footer !== undefined && raw.invoice_footer !== null ? raw.invoice_footer : (companyDocs?.invoiceFooter || ''),
        customTerms: raw.custom_terms || '',
      },
    }

    await generateAndSavePdf(payload, `Invoice_${raw.doc_id || doc.docId}_${raw.client}`)
  }

  const downloadSow = async (doc: VaultDoc) => {
    const raw = doc.raw || {
      client: doc.client,
      project: doc.title,
      value: doc.amount,
      status: doc.status,
      created: doc.date,
      doc_id: doc.docId
    }

    const clientName = raw.client
    const project = raw.project

    const content = [
      '## Project Overview',
      `**Project:** ${project}`,
      `**Client:** ${clientName}${raw.contact ? ` (Attn: ${raw.contact})` : ''}`,
      `**Timeline:** ${raw.timeline || 'To be defined in kickoff'}`,
      `**Contract Value:** ${raw.value ? formatCurrency(Number(raw.value)) : 'As per quotation'}`,
      '',
      '## Objectives',
      raw.objectives || "To deliver a high-quality solution that meets the client's business goals.",
      '',
      '## Deliverables',
      ...(raw.deliverables || '').split('\n').filter(Boolean).map((d: string) => `- ${d}`),
      '',
      raw.milestones ? `## Project Milestones\n${raw.milestones.split('\n').filter(Boolean).map((m: string, i: number) => `**Milestone ${i + 1}:** ${m}`).join('\n')}` : '',
      '',
      '## Payment Terms',
      raw.payment,
      '',
      '## Revision Policy',
      raw.revisions,
      '',
      '## Exclusions',
      ...(raw.exclusions || '').split(',').map((e: string) => `- ${e.trim()}`),
      '',
      '## Jurisdiction',
      `This agreement shall be governed by the laws of **${raw.jurisdiction}**.`,
      '',
      '---',
      `| __COMPANY_NAME__ | ${clientName} |`,
      `|---|---|`,
      '| Signature: _________________ | Signature: _________________ |',
      '| Date: _________________ | Date: _________________ |',
    ].filter(l => l !== null).join('\n')

    const payload = {
      docType: 'SOW' as const,
      clientName: raw.contact || clientName,
      projectTitle: project || `SOW — ${clientName}`,
      companyName: clientName,
      clientInfo: { mobile: raw.phone },
      content,
      items: [],
      subtotal: Number(raw.value) || 0,
      discountTotal: 0,
      grandTotal: Number(raw.value) || 0,
      docsSettings: {
        customTerms: raw.custom_terms || '',
      },
    }

    await generateAndSavePdf(payload, `SOW_${raw.doc_id || doc.docId}_${raw.client}`)
  }

  const downloadAgreement = async (doc: VaultDoc) => {
    const raw = doc.raw || {
      client: doc.client,
      type: doc.title,
      value: doc.amount,
      status: doc.status,
      created: doc.date,
      doc_id: doc.docId
    }

    const content = [
      `## Agreement Details`,
      `**Agreement Type:** ${raw.type}`,
      `**Client:** ${raw.client}${raw.contact ? ` (Attn: ${raw.contact})` : ''}`,
      `**Duration:** ${raw.duration || 'As agreed'}`,
      `**Contract Value:** ${raw.value > 0 ? formatCurrency(raw.value) : 'As per schedule'}`,
      '',
      '## Scope of Services',
      ...(raw.services || '').split('\n').filter(Boolean).map((s: string) => `- ${s.trim()}`),
      '',
      '## Intellectual Property',
      raw.ip,
      '',
      '## Payment Schedule',
      '__PAYMENT_SCHEDULE__',
      '',
      '## Confidentiality',
      'Both parties agree to maintain strict confidentiality of all proprietary information, business processes, and client data shared during this engagement.',
      '',
      '## Cancellation Policy',
      raw.cancellation,
      '',
      '## Governing Law',
      `This agreement is governed by the laws of **${raw.jurisdiction}**. Any disputes shall be resolved through arbitration in ${raw.jurisdiction}.`,
      '',
      '---',
      '',
      '**SIGNATURES**',
      '',
      `| __COMPANY_NAME__ | ${raw.client} |`,
      `|---|---|`,
      '| Signature: _________________ | Signature: _________________ |',
      '| Name: __FOUNDER_NAME__ | Name: _________________ |',
      '| Date: _________________ | Date: _________________ |',
    ].join('\n')

    const payload = {
      docType: 'Agreement' as const,
      clientName: raw.contact || raw.client,
      projectTitle: `${raw.type} — ${raw.client}`,
      companyName: raw.client,
      clientInfo: { business: raw.type, mobile: raw.phone },
      content,
      items: [],
      subtotal: raw.value,
      discountTotal: 0,
      grandTotal: raw.value,
      docsSettings: {
        customTerms: raw.custom_terms || '',
      },
    }

    await generateAndSavePdf(payload, `Agreement_${raw.doc_id || doc.docId}_${raw.client}`)
  }

  const downloadPrd = async (doc: VaultDoc) => {
    const raw = doc.raw || {
      title: doc.title,
      client: doc.client,
      stack: doc.tags.join(' + '),
      doc_id: doc.docId
    }

    const formForPrd = {
      title: raw.title,
      client: raw.client,
      productType: 'Web App',
      techStack: raw.stack || '',
      timeline: '3 months',
      objectives: 'As defined in original document generation objectives.',
      targetUsers: 'Primary target audience.',
      userPersonas: 'Core personas.',
      coreFeatures: 'Standard product modules and capabilities.',
      database: '',
      apiEndpoints: '',
      uiFramework: ''
    }
    
    const buildPrdContent = (f: any) => {
      return `# Product Requirements Document (PRD)\n\n## Executive Summary\n**Product:** ${f.title}\n**Client:** ${f.client}\n**Type:** ${f.productType}\n**Tech Stack:** ${f.techStack}\n**Timeline:** ${f.timeline}\n\n## Problem Statement\n${f.objectives}\n\n## Target Users\n${f.targetUsers}\n\n## User Personas\n${f.userPersonas}\n\n## Core Features\n${f.coreFeatures}\n\n## Database Design\n${f.database || 'To be defined in technical specification phase.'}\n\n## API Endpoints\n${f.apiEndpoints || 'RESTful API architecture. Detailed endpoint mapping in technical spec.'}\n\n## UI Architecture\n**Framework:** ${f.uiFramework || f.techStack.split('+')[0] || 'To be determined'}\n\nKey screens: Dashboard, Login/Auth, Main CRUD views, Settings, Reports\n\n## Development Roadmap\n### Phase 1 — Foundation (Weeks 1-4)\n- Project setup and architecture\n- Auth system\n- Core database schema\n- Base UI components\n\n### Phase 2 — Core Features (Weeks 5-10)\n- Main feature modules\n- API integration\n- User flows\n\n### Phase 3 — Polish & Deploy (Weeks 11-12)\n- QA & testing\n- Performance optimization\n- Production deployment\n- Documentation\n\n## Success Metrics\n- Load time < 2 seconds\n- 99.9% uptime\n- Core user flows ≤ 3 clicks\n- User satisfaction score ≥ 4.5/5`
    }
    
    const content = buildPrdContent(formForPrd)
    const payload = { docType: 'PRD' as const, clientName: raw.client, projectTitle: raw.title, content, items: [], subtotal: 0, discountTotal: 0, grandTotal: 0 }
    
    await generateAndSavePdf(payload, `PRD_${raw.title}`)
  }

  const downloadMarketing = async (doc: VaultDoc) => {
    const raw = doc.raw || {
      client: doc.client,
      title: doc.title,
      doc_id: doc.docId
    }

    let extra = { period: 'Monthly', channels: [] as string[] }
    try {
      extra = JSON.parse(raw.title)
    } catch (e) {
      extra.period = raw.title || ''
    }

    const formForReport = {
      client: raw.client,
      period: extra.period,
      channels: extra.channels || [],
      metaSpend: '', metaRevenue: '', metaLeads: '', metaImpressions: '', metaROAS: '',
      googleSpend: '', googleRevenue: '', googleClicks: '', googleConversions: '',
      seoRanking: '', seoTraffic: '', seoKeywords: '',
      summary: 'Marketing performance report summary.',
      insights: 'Key campaign insights.',
      recommendations: 'Actionable recommendations.',
      nextPlan: 'Next month execution plan.'
    }

    const buildReportContent = (f: any) => {
      const hasMetaData = f.metaSpend || f.metaRevenue
      const hasGoogleData = f.googleSpend || f.googleRevenue
      const hasSEOData = f.seoTraffic || f.seoRanking

      return `# Marketing Performance Report\n\n**Client:** ${f.client}\n**Period:** ${f.period}\n**Channels:** ${f.channels.join(', ')}\n\n## Executive Summary\n${f.summary || `Performance analysis for ${f.period}. Overall digital marketing performance shows strong ROI across selected channels.`}\n\n${hasMetaData ? `## Meta Ads (Facebook/Instagram)\n| Metric | Value |\n|--------|-------|\n| Ad Spend | ₹${Number(f.metaSpend).toLocaleString('en-IN')} |\n| Revenue Generated | ₹${Number(f.metaRevenue).toLocaleString('en-IN')} |\n| ROAS | ${f.metaROAS || ((Number(f.metaRevenue) / Number(f.metaSpend)).toFixed(2))}x |\n| Leads Generated | ${f.metaLeads} |\n| Total Impressions | ${f.metaImpressions} |\n\n` : ''}${hasGoogleData ? `## Google Ads\n| Metric | Value |\n|--------|-------|\n| Ad Spend | ₹${Number(f.googleSpend).toLocaleString('en-IN')} |\n| Revenue | ₹${Number(f.googleRevenue).toLocaleString('en-IN')} |\n| Clicks | ${f.googleClicks} |\n| Conversions | ${f.googleConversions} |\n\n` : ''}${hasSEOData ? `## SEO Performance\n| Metric | Value |\n|--------|-------|\n| Organic Traffic | ${f.seoTraffic} visitors |\n| Avg. Keyword Ranking | #${f.seoRanking} |\n| Keywords in Top 10 | ${f.seoKeywords} |\n\n` : ''}## Key Insights\n${f.insights || '1. ROAS above industry benchmark\n2. Mobile traffic driving 65% of conversions\n3. Retargeting campaigns outperforming prospecting'}\n\n## Recommendations for Next Month\n${f.recommendations || '1. Increase budget on best-performing ad sets by 20%\n2. Launch new retargeting sequence for cart abandoners\n3. Focus SEO on long-tail commercial keywords'}\n\n## Next Month Plan\n${f.nextPlan || 'Scale winning campaigns, introduce new creative variants, target lookalike audiences.'}`
    }

    const content = buildReportContent(formForReport)
    const payload = { docType: 'MarketingReport' as const, clientName: raw.client, projectTitle: `Marketing Report — ${extra.period}`, content, items: [], subtotal: 0, discountTotal: 0, grandTotal: 0 }
    
    await generateAndSavePdf(payload, `MarketingReport_${raw.client}_${extra.period}`)
  }

  const handleDownload = async (doc: VaultDoc) => {
    setDownloadingId(doc.id)
    try {
      toast({ title: 'Download Started', description: `Generating PDF for ${doc.docId}...` })
      if (doc.type === 'Quotation') {
        await downloadQuotation(doc)
      } else if (doc.type === 'Invoice') {
        await downloadInvoice(doc)
      } else if (doc.type === 'SOW') {
        await downloadSow(doc)
      } else if (doc.type === 'Agreement') {
        await downloadAgreement(doc)
      } else if (doc.type === 'PRD') {
        await downloadPrd(doc)
      } else if (doc.type === 'Marketing') {
        await downloadMarketing(doc)
      } else {
        throw new Error('Unsupported document type')
      }
      toast({ title: '✅ Download Completed', description: `${doc.docId}.pdf downloaded.` })
    } catch (e: any) {
      console.error(e)
      toast({ title: 'Download Failed', description: e.message || 'Failed to download PDF', variant: 'destructive' })
    } finally {
      setDownloadingId(null)
    }
  }

  const handleArchive = async (doc: VaultDoc) => {
    const newStatus = 'archived'
    if (isSupabaseConfigured()) {
      try {
        const table = getTableNameForDocType(doc.type)
        const { error } = await supabase.from(table).update({ status: newStatus }).eq('id', doc.id)
        if (error) throw error
      } catch (err: any) {
        toast({ title: 'Error archiving document', description: err.message, variant: 'destructive' })
        return
      }
    }
    setDocs(docs.map(d => d.id === doc.id ? { ...d, status: newStatus } : d))
    toast({ title: 'Document Archived', description: 'Moved to archive.' })
  }

  const handleUnarchive = async (doc: VaultDoc) => {
    const newStatus = 'draft'
    if (isSupabaseConfigured()) {
      try {
        const table = getTableNameForDocType(doc.type)
        const { error } = await supabase.from(table).update({ status: newStatus }).eq('id', doc.id)
        if (error) throw error
      } catch (err: any) {
        toast({ title: 'Error restoring document', description: err.message, variant: 'destructive' })
        return
      }
    }
    setDocs(docs.map(d => d.id === doc.id ? { ...d, status: newStatus } : d))
    toast({ title: 'Document Restored', description: 'Moved from archive to draft.' })
  }

  const filtered = docs.filter(d => {
    const matchSearch = d.client.toLowerCase().includes(search.toLowerCase()) || d.title.toLowerCase().includes(search.toLowerCase()) || d.docId.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || d.type === filterType
    const matchStatus = filterStatus === 'all' || d.status === filterStatus
    return matchSearch && matchType && matchStatus
  })

  const stats = { 
    total: docs.length, 
    quotations: docs.filter(d => d.type === 'Quotation').length, 
    invoices: docs.filter(d => d.type === 'Invoice').length, 
    agreements: docs.filter(d => d.type === 'Agreement' || d.type === 'SOW').length 
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Document Vault</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Centralized repository for all Netgain business documents.</p>
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center py-24 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <p className="text-sm text-muted-foreground">Synchronizing files in real-time...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[{ label: 'Total Documents', value: stats.total }, { label: 'Quotations', value: stats.quotations }, { label: 'Invoices', value: stats.invoices }, { label: 'Agreements', value: stats.agreements }].map(s => (
              <Card key={s.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold mt-1">{s.value}</p></CardContent></Card>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {['Quotation', 'Invoice', 'SOW', 'Agreement', 'PRD', 'Marketing'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {['draft', 'sent', 'paid', 'approved', 'signed', 'archived'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(doc => {
              const Icon = typeIcon[doc.type] || FileText
              const colors = typeColors[doc.type] || 'text-muted-foreground bg-muted'
              return (
                <Card key={doc.id} className="group hover:shadow-md hover:border-gold/20 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-lg p-2 shrink-0 ${colors}`}><Icon className="h-5 w-5" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm leading-tight truncate">{doc.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.client}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0 capitalize">{doc.status}</Badge>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div>
                            <p className="text-xs font-mono text-gold/70">{doc.docId}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(doc.date)}</p>
                          </div>
                          <p className="font-semibold text-sm text-gold">
                            {doc.amount > 0 ? formatCurrency(doc.amount) : '—'}
                          </p>
                        </div>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {doc.tags.map(t => <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">#{t}</span>)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 mt-3 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs gap-1 flex-1" 
                        onClick={() => handleDownload(doc)}
                        disabled={downloadingId === doc.id}
                      >
                        {downloadingId === doc.id ? (
                          <Loader2 className="h-3 w-3 animate-spin text-gold" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        {downloadingId === doc.id ? 'Downloading...' : 'Download'}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7" 
                        onClick={() => { navigator.clipboard.writeText(doc.docId); toast({ title: 'Copied ID', description: doc.docId }) }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7" 
                        onClick={() => doc.status === 'archived' ? handleUnarchive(doc) : handleArchive(doc)} 
                        title={doc.status === 'archived' ? 'Unarchive' : 'Archive'}
                      >
                        {doc.status === 'archived' ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No documents found</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
