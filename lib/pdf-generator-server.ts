import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { NbosDocument, PdfPayload } from './pdf-template'
import { SupabaseClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'

const SETTINGS_PATH = path.join(process.cwd(), '.nbos-settings.json')

function loadSettings(): any {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
    }
  } catch (_) {}
  return {}
}

export async function generatePdfBuffer(payload: PdfPayload, supabase: SupabaseClient | null) {
  // Load all saved settings sections
  let saved = loadSettings()

  if (supabase) {
    try {
      const { data } = await supabase.from('company_settings').select('*').limit(1).maybeSingle()
      if (data) {
        saved = {
          company: data.company || saved.company,
          founder: data.founder || saved.founder,
          bank: data.bank || saved.bank,
          comm: data.comm || saved.comm,
          ai: data.ai || saved.ai,
          docs: data.docs || saved.docs,
        }
      }
    } catch (e) {
      console.error('Failed to load settings from DB for PDF', e)
    }
  }

  // Company info for header / footer
  const company = {
    ...(saved?.company || {}),
    name:    saved?.company?.name    || 'Netgain Studio',
    email:   saved?.company?.email   || 'mail.netgain@gmail.com',
    phone:   saved?.company?.phone   || '9347102347 | 9392469669',
    website: saved?.company?.website || 'netgain.studio',
    gst:     saved?.company?.gst     || '',
    address: saved?.company?.address || 'Hyderabad, Telangana, India',
    signature: saved?.founder?.signature || saved?.company?.signature || '',
    stamp:   saved?.company?.stamp   || '',
    // Payload companySettings always wins over saved for doc-specific overrides
    ...(payload.companySettings || {}),
  }

  // Bank details for invoice content
  const bank = {
    accountName:   saved?.bank?.accountName   || company.name,
    accountNumber: saved?.bank?.accountNumber || '',
    ifsc:          saved?.bank?.ifsc          || '',
    bank:          saved?.bank?.bank          || '',
    upiId:         saved?.bank?.upiId         || '',
  }

  // Founder info
  const founder = {
    name:        saved?.founder?.name        || '',
    designation: saved?.founder?.designation || 'Founder & CEO',
    email:       saved?.founder?.email       || company.email,
    phone:       saved?.founder?.phone       || '',
  }

  // Document settings (Terms, Payment terms, Tagline)
  const docs = {
    tagline:             saved?.docs?.tagline             || 'Your Growth Partner, Powered by AI',
    quotationValidity:   saved?.docs?.quotationValidity   || '14',
    paymentTermsOneTime: saved?.docs?.paymentTermsOneTime || '50% advance to begin, 50% balance on final delivery',
    paymentTermsMonthly: saved?.docs?.paymentTermsMonthly || 'Full monthly fee payable in advance each cycle',
    gstRate:             saved?.docs?.gstRate             || '18',
    extraTerms:          saved?.docs?.extraTerms          || '',
    paymentSchedule:     saved?.docs?.paymentSchedule     || '- 50% advance payment to commence work\n- Remaining balance due upon project completion / monthly for retainers\n- All amounts are exclusive of applicable GST',
    invoiceTerms:        saved?.docs?.invoiceTerms        || '',
    invoiceNotes:        saved?.docs?.invoiceNotes        || '',
    invoicePaymentInstructions: saved?.docs?.invoicePaymentInstructions || '',
    invoiceFooter:       saved?.docs?.invoiceFooter       || '',
    invoiceAdditionalText: saved?.docs?.invoiceAdditionalText || '',
    ...(payload.docsSettings || {}),
  }

  const enriched: PdfPayload = {
    ...payload,
    companySettings: company,
    bankSettings: bank,
    founderSettings: founder,
    docsSettings: docs,
  }

  // Replace __BANK_DETAILS__ token in content with actual saved bank settings
  if (enriched.content && enriched.content.includes('__BANK_DETAILS__')) {
    const bankLines: string[] = []
    if (bank.accountName)   bankLines.push(`- **Account Name:** ${bank.accountName}`)
    if (bank.accountNumber) bankLines.push(`- **Account No:** ${bank.accountNumber}`)
    if (bank.bank)          bankLines.push(`- **Bank:** ${bank.bank}`)
    if (bank.ifsc)          bankLines.push(`- **IFSC:** ${bank.ifsc}`)
    if (bank.upiId) {
      bankLines.push(`- **UPI:** ${bank.upiId}`);
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${bank.upiId}&pn=${encodeURIComponent(company.name)}`)}`;
      bankLines.push(`__QR_CODE__${qrSrc}__`);
    }
    if (bankLines.length === 0) bankLines.push('- Bank details not configured. Please update in Settings.')
    if (enriched.content) {
      if (Array.isArray(enriched.content)) enriched.content = enriched.content.join('\n')
      enriched.content = enriched.content.replace('__BANK_DETAILS__', bankLines.join('\n'))
    }
  }

  // Replace __PAYMENT_SCHEDULE__ token in content
  if (enriched.content) {
    if (Array.isArray(enriched.content)) enriched.content = enriched.content.join('\n')
    if (enriched.content.includes('__PAYMENT_SCHEDULE__')) {
      enriched.content = enriched.content.replace('__PAYMENT_SCHEDULE__', docs.paymentSchedule)
    }
  }

  // Replace __COMPANY_NAME__ and __FOUNDER_NAME__ tokens
  if (enriched.content) {
    if (Array.isArray(enriched.content)) enriched.content = enriched.content.join('\n')
    enriched.content = enriched.content
      .replace(/__COMPANY_NAME__/g, company.name)
      .replace(/__FOUNDER_NAME__/g, founder.name || 'Authorised Signatory')
  }

  // Render PDF buffer (pure JS, no Python)
  const buffer = await renderToBuffer(React.createElement(NbosDocument, { payload: enriched as PdfPayload }) as any)

  const docType = payload.docType || 'Document'
  const clientSlug = (payload.clientName || 'client').replace(/\s+/g, '_')
  const filename = `${docType}_${clientSlug}_${Date.now()}.pdf`

  return { buffer, filename }
}
