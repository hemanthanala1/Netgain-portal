import { SupabaseClient } from '@supabase/supabase-js'
import { PdfPayload } from './pdf-template'

// Helper to format currency
const formatCurrency = (val: number) => {
  return 'INR ' + val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export async function buildPdfPayload(
  docType: string,
  doc: any,
  supabase: SupabaseClient
): Promise<PdfPayload> {
  // 1. Fetch Company settings and services
  const [cRes, svRes, sigRes] = await Promise.all([
    supabase.from('company_settings').select('*').limit(1).maybeSingle(),
    supabase.from('services').select('*').neq('status', 'archived'),
    supabase.from('document_signatures')
      .select('*')
      .eq('document_type', docType)
      .eq('document_id', doc.id)
      .maybeSingle()
  ])

  const companyDocs = cRes.data?.docs || {}
  const paymentSchedules = companyDocs.paymentSchedules || []
  const services = svRes.data || []
  const signature = sigRes.data

  // 2. Build common settings
  const companySettings = cRes.data?.company || {}
  const founderSettings = cRes.data?.founder || {}
  const bankSettings = cRes.data?.bank || {}
  const docsSettings = {
    tagline: companyDocs.tagline || 'Your Growth Partner, Powered by AI',
    quotationValidity: String(doc.validity_days || companyDocs.quotationValidity || '14'),
    paymentTermsOneTime: doc.payment_terms_one_time || companyDocs.paymentTermsOneTime || '50% advance to begin, 50% balance on final delivery',
    paymentTermsMonthly: doc.payment_terms_monthly || companyDocs.paymentTermsMonthly || 'Full monthly fee payable in advance each cycle',
    gstRate: String(doc.gst_pct || companyDocs.gstRate || '18'),
    extraTerms: doc.extra_terms || companyDocs.extraTerms || '',
    customTerms: doc.custom_terms || '',
    invoiceTerms: doc.invoice_terms || companyDocs.invoiceTerms || '',
    invoiceFooter: doc.invoice_footer || companyDocs.invoiceFooter || '',
    invoiceNotes: doc.invoice_notes || companyDocs.invoiceNotes || '',
    invoicePaymentInstructions: doc.invoice_payment_instructions || companyDocs.invoicePaymentInstructions || '',
    invoiceAdditionalText: doc.invoice_additional_text || companyDocs.invoiceAdditionalText || '',
  }

  // 3. Map signature if present
  let signatureDetails: PdfPayload['signatureDetails'] = undefined
  if (signature) {
    signatureDetails = {
      clientName: signature.client_name,
      company: signature.company,
      signatureType: signature.signature_type as any,
      signatureImage: signature.signature_image || undefined,
      signatureText: signature.signature_text || undefined,
      signatureFont: signature.signature_font || 'DancingScript',
      signedAt: new Date(signature.created_at).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      verificationId: signature.verification_id
    }
  }

  // Base payload fields
  const basePayload: Partial<PdfPayload> = {
    docType: docType as any,
    clientName: doc.contact || doc.client || 'Client',
    companyName: doc.client || undefined,
    projectTitle: doc.project_title || doc.project || doc.title || `${docType} — ${doc.client}`,
    clientInfo: {
      business: doc.business_type || doc.type || undefined,
      industry: doc.industry || undefined,
      mobile: doc.phone || undefined,
      gst: doc.gst || undefined
    },
    companySettings,
    bankSettings,
    founderSettings,
    docsSettings,
    signatureDetails
  }

  // 4. Construct payload based on document type
  switch (docType) {
    case 'Quotation': {
      const qServices = services.filter(s => (doc.service_ids || []).includes(s.id))
      const sub = qServices.reduce((a, s) => a + Number(s.quotation_price || s.price_max || s.base_price || 0), 0)
      const dAmt = Math.round(sub * (doc.discount_pct || 0) / 100)
      const aft = sub - dAmt
      const gAmt = Math.round(aft * (doc.gst_pct || 18) / 100)
      const tot = aft + gAmt

      const lines = [
        '## Why Netgain?',
        'We are a full-service digital growth agency specializing in high-converting digital experiences, data-driven marketing, and automation for modern businesses.',
        '',
        '## Service Breakdown',
        ...qServices.flatMap((s: any, i: number) => [
          `### ${i + 1}. ${s.name}`,
          `**Category:** ${s.category || 'Service'}  |  **Timeline:** ${s.timeline || 'TBD'}  |  **Model:** ${s.pricing === 'monthly' ? 'Monthly Recurring' : 'One-Time Fixed'}`,
          '',
          ...(s.deliverables?.map((d: any) => `- ${d}`) || []),
          '',
        ]),
        '## Payment Terms',
        `- One-time services: ${doc.payment_terms_one_time || docsSettings.paymentTermsOneTime}`,
        `- Monthly retainers: ${doc.payment_terms_monthly || docsSettings.paymentTermsMonthly}`,
        '- Accepted: NEFT / IMPS / UPI / Cheque',
        '',
        doc.notes ? `## Additional Notes\n${doc.notes}` : '',
        '',
        '## Validity',
        `This quotation is valid for **${doc.validity_days || 14} days** from the date of issue.`,
      ]

      return {
        ...basePayload,
        docType: 'Quotation',
        content: lines.join('\n'),
        items: qServices.map(s => ({
          serviceName: s.name,
          finalPrice: Number(s.quotation_price || s.price_max || s.base_price || 0),
          category: s.category || 'Service',
          timeline: s.timeline || 'TBD',
          pricing_model: s.pricing || 'fixed',
          deliverables: s.deliverables || []
        })),
        subtotal: sub,
        discountTotal: dAmt,
        grandTotal: tot,
        fullProjectTotal: tot,
        fullSubtotal: sub,
        paymentScheduleObj: doc.payment_schedule_id ? paymentSchedules.find((p: any) => p.id === doc.payment_schedule_id) : null,
      } as PdfPayload
    }

    case 'Invoice': {
      const qServices = services.filter(s => (doc.service_ids || []).includes(s.id))
      const sub = qServices.reduce((a, s) => a + Number(s.quotation_price || s.price_max || s.base_price || 0), 0)
      const discVal = Number(doc.discount_value) || 0
      const discType = doc.discount_type || 'percentage'
      const dAmt = discType === 'percentage' ? Math.round(sub * discVal / 100) : discVal
      const aft = Math.max(0, sub - dAmt)
      const gstPct = Number(doc.gst_pct) || 0
      const gAmt = Math.round(aft * gstPct / 100)
      const tot = aft + gAmt

      let pct = 100
      const paymentScheduleEntry = doc.payment_schedule_entry || ''
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

      const scaledItems = qServices.map(s => {
        const scaledPrice = Math.round(Number(s.quotation_price || s.price_max || s.base_price || 0) * scaleFactor)
        return {
          serviceName: paymentScheduleEntry ? `${s.name} - ${paymentScheduleEntry}` : s.name,
          finalPrice: scaledPrice,
          category: s.category || 'Service',
          pricing_model: s.pricing || 'fixed',
          deliverables: s.deliverables || []
        }
      })

      const today = new Date(doc.created || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      const dueFormatted = doc.due
        ? new Date(doc.due).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date(Date.now() + 10 * 864e5).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

      const content = [
        `## Invoice Details`,
        `**Invoice Date:** ${today}  |  **Due Date:** ${dueFormatted}`,
        `**Invoice Ref:** ${doc.doc_id}`,
        `${doc.gst ? `**Client GST:** ${doc.gst}` : ''}`,
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
        ...(doc.invoice_payment_instructions ? ['', doc.invoice_payment_instructions] : (companyDocs.invoicePaymentInstructions ? ['', companyDocs.invoicePaymentInstructions] : [])),
        ...(doc.invoice_additional_text ? ['', '## Additional Details', doc.invoice_additional_text] : (companyDocs.invoiceAdditionalText ? ['', '## Additional Details', companyDocs.invoiceAdditionalText] : [])),
        ...(doc.notes ? ['', '## Notes', doc.notes] : []),
      ].join('\n')

      return {
        ...basePayload,
        docType: 'Invoice',
        content,
        items: scaledItems,
        subtotal: scaledSub,
        discountTotal: scaledDAmt,
        grandTotal: scaledTot,
        fullProjectTotal: tot,
        fullSubtotal: sub,
        paymentScheduleObj: doc.payment_schedule_id ? paymentSchedules.find((p: any) => p.id === doc.payment_schedule_id) : null,
      } as PdfPayload
    }

    case 'SOW': {
      const content = [
        '## Project Overview',
        `**Project:** ${doc.project}`,
        `**Client:** ${doc.client}${doc.contact ? ` (Attn: ${doc.contact})` : ''}`,
        `**Timeline:** ${doc.timeline || 'To be defined in kickoff'}`,
        `**Contract Value:** ${doc.value ? formatCurrency(Number(doc.value)) : 'As per quotation'}`,
        '',
        '## Objectives',
        doc.objectives || "To deliver a high-quality solution that meets the client's business goals.",
        '',
        '## Deliverables',
        ...(doc.deliverables || '').split('\n').filter(Boolean).map((d: string) => `- ${d}`),
        '',
        doc.milestones ? `## Project Milestones\n${doc.milestones.split('\n').filter(Boolean).map((m: string, i: number) => `**Milestone ${i + 1}:** ${m}`).join('\n')}` : '',
        '',
        '## Payment Terms',
        doc.payment,
        '',
        '## Revision Policy',
        doc.revisions,
        '',
        '## Exclusions',
        ...(doc.exclusions || '').split(',').map((e: string) => `- ${e.trim()}`),
        '',
        '## Jurisdiction',
        `This agreement shall be governed by the laws of **${doc.jurisdiction || 'Hyderabad, Telangana, India'}**.`,
      ].filter(l => l !== null).join('\n')

      return {
        ...basePayload,
        docType: 'SOW',
        content,
        items: [],
        subtotal: Number(doc.value) || 0,
        discountTotal: 0,
        grandTotal: Number(doc.value) || 0,
      } as PdfPayload
    }

    case 'Agreement': {
      const content = [
        `## Agreement Details`,
        `**Agreement Type:** ${doc.type}`,
        `**Client:** ${doc.client}${doc.contact ? ` (Attn: ${doc.contact})` : ''}`,
        `**Duration:** ${doc.duration || 'As agreed'}`,
        `**Contract Value:** ${doc.value > 0 ? formatCurrency(Number(doc.value)) : 'As per schedule'}`,
        '',
        '## Scope of Services',
        ...(doc.services || '').split('\n').filter(Boolean).map((s: string) => `- ${s.trim()}`),
        '',
        '## Intellectual Property',
        doc.ip,
        '',
        '## Payment Schedule',
        '__PAYMENT_SCHEDULE__',
        '',
        '## Confidentiality',
        'Both parties agree to maintain strict confidentiality of all proprietary information, business processes, and client data shared during this engagement.',
        '',
        '## Cancellation Policy',
        doc.cancellation,
        '',
        '## Governing Law',
        `This agreement is governed by the laws of **${doc.jurisdiction || 'Hyderabad, Telangana, India'}**. Any disputes shall be resolved through arbitration in ${doc.jurisdiction || 'Hyderabad'}.`,
      ].join('\n')

      return {
        ...basePayload,
        docType: 'Agreement',
        content,
        items: [],
        subtotal: Number(doc.value) || 0,
        discountTotal: 0,
        grandTotal: Number(doc.value) || 0,
      } as PdfPayload
    }

    case 'Proposal': {
      const content = [
        '# Business Proposal',
        `**Client:** ${doc.client}`,
        `**Project Title:** ${doc.project_title}`,
        `**Est. Value:** ${doc.value ? formatCurrency(Number(doc.value)) : 'TBD'}`,
        `**Timeline:** ${doc.timeline || 'TBD'}`,
        '',
        '## Scope of Work & Deliverables',
        doc.scope || 'To be discussed.',
        '',
        '## Investment & Pricing',
        doc.pricing_details || 'Pricing details to be agreed.',
        '',
        '## Terms & Conditions',
        doc.terms || 'Standard business engagement terms.',
        '',
        '---',
        '| Netgain Studio | Client |',
        '|---|---|',
        '| Signature: _________________ | Signature: _________________ |',
        '| Date: _________________ | Date: _________________ |',
      ].join('\n')

      return {
        ...basePayload,
        docType: 'SOW', // Use SOW stylesheet mapping
        projectTitle: doc.project_title,
        content,
        items: [],
        subtotal: Number(doc.value) || 0,
        discountTotal: 0,
        grandTotal: Number(doc.value) || 0,
      } as PdfPayload
    }

    case 'Contract': {
      const content = [
        '# Standard Service Contract',
        `**Client:** ${doc.client}`,
        `**Contract Type:** ${doc.type || 'Service Contract'}`,
        `**Contract Value:** ${doc.value ? formatCurrency(Number(doc.value)) : 'As per schedule'}`,
        `**Duration:** ${doc.duration || 'TBD'}`,
        '',
        '## Deliverables',
        doc.deliverables || 'As detailed in the Scope of Work.',
        '',
        '## Payment Terms',
        doc.payment_terms || 'Standard Netgain terms apply.',
        '',
        '## Termination Clause',
        doc.termination_clause || 'Either party may terminate with 30 days written notice.',
        '',
        '## Governing Law',
        `This contract is governed by the laws of ${doc.governing_law || 'Hyderabad, Telangana, India'}.`,
        '',
        '---',
        '| Netgain Studio | Client |',
        '|---|---|',
        '| Signature: _________________ | Signature: _________________ |',
        '| Date: _________________ | Date: _________________ |',
      ].join('\n')

      return {
        ...basePayload,
        docType: 'Agreement', // Use Agreement stylesheet mapping
        projectTitle: `${doc.type || 'Contract'} — ${doc.client}`,
        content,
        items: [],
        subtotal: Number(doc.value) || 0,
        discountTotal: 0,
        grandTotal: Number(doc.value) || 0,
      } as PdfPayload
    }

    case 'PRD': {
      const content = `# Product Requirements Document (PRD)\n\n## Executive Summary\n**Product:** ${doc.title}\n**Client:** ${doc.client}\n**Tech Stack:** ${doc.stack || 'Not specified'}\n\n## Problem Statement & Objectives\nDetailed product requirements are stored in the development blueprints.\n\n## Core Features\nStandard product modules and capabilities.`
      return {
        ...basePayload,
        docType: 'PRD',
        content,
        items: [],
        subtotal: 0,
        discountTotal: 0,
        grandTotal: 0
      } as PdfPayload
    }

    case 'Marketing':
    case 'MarketingReport': {
      const content = `# Marketing Performance Report\n\n**Client:** ${doc.client}\n**Report Title:** ${doc.title}`
      return {
        ...basePayload,
        docType: 'MarketingReport',
        content,
        items: [],
        subtotal: 0,
        discountTotal: 0,
        grandTotal: 0
      } as PdfPayload
    }

    default: {
      return {
        ...basePayload,
        docType: 'Agreement',
        content: doc.content || 'Document content not specified.',
        items: [],
        subtotal: 0,
        discountTotal: 0,
        grandTotal: 0
      } as PdfPayload
    }
  }
}
