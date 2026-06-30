/**
 * NBOS PDF Template Engine — Urban Edge Dark Theme
 * Uses @react-pdf/renderer (pure TypeScript, no Python needed)
 */
import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, Font, Image,
} from '@react-pdf/renderer'

// ── Colour palette (Urban Edge / Dark Theme) ─────────────────────────────
const C = {
  bg:        '#0A1612',
  card:      '#12241D',
  gold:      '#D4AF37',
  white:     '#F8FAFC',
  slate:     '#94A3B8',
  border:    '#1E3A2F',
  darkCard:  '#0F1F18',
  altRow:    '#122019',
}

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: { backgroundColor: C.bg, paddingTop: 110, paddingBottom: 90, paddingHorizontal: 40 },

  // Header (fixed to top)
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 100,
    backgroundColor: C.bg, paddingHorizontal: 40, paddingTop: 22,
  },
  headerLine: { position: 'absolute', bottom: 0, left: 0, right: 0, borderBottomWidth: 1, borderColor: C.gold },
  brandName: { fontFamily: 'Helvetica-Bold', fontSize: 24, color: C.gold },
  brandTag:  { fontFamily: 'Helvetica', fontSize: 9, color: C.slate, marginTop: 2 },
  docLabel:  { fontFamily: 'Helvetica-Bold', fontSize: 13, color: C.gold },
  docDate:   { fontFamily: 'Helvetica', fontSize: 8, color: C.slate, marginTop: 3 },
  docRef:    { fontFamily: 'Helvetica', fontSize: 8, color: C.slate, marginTop: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },

  // Footer (fixed to bottom)
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: C.bg, paddingHorizontal: 40, paddingBottom: 14,
  },
  footerLine: { borderTopWidth: 1, borderColor: C.gold, marginBottom: 8 },
  footerBrand: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: C.gold },
  footerText:  { fontFamily: 'Helvetica', fontSize: 7, color: C.slate, marginTop: 3 },
  footerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },

  // Body typography
  h1: { fontFamily: 'Helvetica-Bold', fontSize: 20, color: C.white, marginBottom: 4 },
  h2: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: C.gold, marginTop: 14, marginBottom: 5 },
  h3: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: C.white, marginTop: 8, marginBottom: 3 },
  body: { fontFamily: 'Helvetica', fontSize: 9, color: C.white, lineHeight: 1.5 },
  muted: { fontFamily: 'Helvetica', fontSize: 9, color: C.slate, lineHeight: 1.5 },
  gold: { fontFamily: 'Helvetica', fontSize: 9, color: C.gold, lineHeight: 1.5 },
  bullet: { fontFamily: 'Helvetica', fontSize: 9, color: C.white, lineHeight: 1.5, marginLeft: 12 },

  // Cards
  card: {
    backgroundColor: C.card, borderLeftWidth: 3, borderLeftColor: C.gold,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10, borderRadius: 2,
  },
  prepCard: {
    backgroundColor: C.card, borderLeftWidth: 3, borderLeftColor: C.gold,
    paddingHorizontal: 20, paddingVertical: 14, marginBottom: 18, borderRadius: 2,
  },

  // Two-column header row in service card
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  svcName: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: C.white, flex: 1 },
  svcPrice: { fontFamily: 'Helvetica-Bold', fontSize: 14, color: C.gold },
  svcMeta:  { fontFamily: 'Helvetica', fontSize: 8, color: C.slate, marginTop: 3 },

  // Investment table
  invCard: {
    backgroundColor: C.card, paddingHorizontal: 20, paddingVertical: 12,
    marginBottom: 20, borderRadius: 2,
  },
  invRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  invLabel: { fontFamily: 'Helvetica', fontSize: 9, color: C.slate, flex: 1 },
  invValue: { fontFamily: 'Helvetica', fontSize: 9, color: C.white },
  invDivider: { borderTopWidth: 0.5, borderColor: C.border, marginVertical: 4 },
  invTotalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: C.white, flex: 1 },
  invTotalValue: { fontFamily: 'Helvetica-Bold', fontSize: 15, color: C.gold },

  // Terms bullets
  termBullet: { fontFamily: 'Helvetica', fontSize: 8, color: C.gold, marginBottom: 3 },

  // Section separator
  sep: { borderTopWidth: 0.5, borderColor: C.border, marginVertical: 10 },

  spacer4:  { height: 4 },
  spacer8:  { height: 8 },
  spacer14: { height: 14 },
})

// ── Types ─────────────────────────────────────────────────────────────────
export interface PdfItem {
  serviceName: string
  finalPrice: number
  quantity?: number
  timeline?: string
  category?: string
  pricing_model?: string
  deliverables?: string[]
}

export interface PdfPayload {
  docType: 'Quotation' | 'Invoice' | 'SOW' | 'Agreement' | 'PRD' | 'ProjectPlan' | 'MarketingReport'
  clientName: string
  companyName?: string
  projectTitle?: string
  clientInfo?: { business?: string; industry?: string; mobile?: string; gst?: string }
  companySettings?: { name?: string; email?: string; phone?: string; website?: string; gst?: string; address?: string }
  bankSettings?: { accountName?: string; accountNumber?: string; ifsc?: string; bank?: string; upiId?: string }
  founderSettings?: { name?: string; designation?: string; email?: string; phone?: string }
  docsSettings?: {
    tagline?: string
    quotationValidity?: string
    paymentTermsOneTime?: string
    paymentTermsMonthly?: string
    gstRate?: string
    extraTerms?: string
    invoiceTerms?: string
    invoiceNotes?: string
    invoicePaymentInstructions?: string
    invoiceFooter?: string
    invoiceAdditionalText?: string
    customTerms?: string
  }
  items?: PdfItem[]
  subtotal?: number
  adBudget?: number
  adBudgetPct?: number
  adBudgetFixed?: number
  adBudgetOverride?: boolean
  adBudgetBillThrough?: boolean
  discountTotal?: number
  grandTotal?: number
  fullProjectTotal?: number
  fullSubtotal?: number
  paymentScheduleObj?: { name: string, points: { label: string, pct: number }[] } | null
  content?: string           // Markdown-lite body text
}

// ── Helpers ───────────────────────────────────────────────────────────────
// Use 'INR' text prefix so PDFs render correctly on all systems (no ₹ glyph issues)
const INR = (n: number) =>
  'INR ' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const DOC_LABELS: Record<string, string> = {
  Quotation: 'CUSTOM QUOTATION',
  Invoice:   'TAX INVOICE',
  SOW:       'STATEMENT OF WORK',
  Agreement: 'SERVICE AGREEMENT',
  PRD:       'PRODUCT REQUIREMENTS DOCUMENT',
  ProjectPlan: 'PROJECT PLAN',
  MarketingReport: 'MARKETING REPORT',
}

// ── Header fixed component ────────────────────────────────────────────────
function Header({ docType, docRef, company, tagline }: { docType: string; docRef: string; company: PdfPayload['companySettings']; tagline: string }) {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  return (
    <View style={s.header} fixed>
      <View style={s.headerRow}>
        <View>
          <Text style={s.brandName}>{company?.name || 'NETGAIN'}</Text>
          <Text style={s.brandTag}>{tagline}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.docLabel}>{DOC_LABELS[docType] || 'DOCUMENT'}</Text>
          <Text style={s.docDate}>Date: {today}</Text>
          <Text style={s.docRef}>Ref: {docRef}</Text>
        </View>
      </View>
      <View style={s.headerLine} />
    </View>
  )
}

// ── Footer fixed component ─────────────────────────────────────────────────
function Footer({ company, tagline, docType, invoiceFooter }: { company: PdfPayload['companySettings']; tagline: string; docType?: string; invoiceFooter?: string }) {
  const isCustomInvoiceFooter = docType === 'Invoice' && invoiceFooter && invoiceFooter.trim()
  return (
    <View style={s.footer} fixed>
      <View style={s.footerLine} />
      <View style={s.footerRow}>
        <View style={{ flex: 1 }}>
          {isCustomInvoiceFooter ? (
            <Text style={s.footerText}>{invoiceFooter}</Text>
          ) : (
            <>
              <Text style={s.footerBrand}>{company?.name || 'NETGAIN'}</Text>
              {company?.phone && <Text style={s.footerText}>Phone / WhatsApp: {company.phone}</Text>}
              {(company?.email || company?.website) && (
                <Text style={s.footerText}>
                  {company.email || ''}{company.email && company.website ? '   | ' : ''}{company.website || ''}
                </Text>
              )}
            </>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
          <Text style={s.footerText}>{tagline}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} style={s.footerText} />
        </View>
      </View>
    </View>
  )
}

// ── Render markdown-lite content ──────────────────────────────────────────
function RenderContent({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        const t = line.trim()
        if (!t) return <View key={i} style={s.spacer4} />
        if (t.startsWith('## ')) return <Text key={i} style={s.h2}>{t.slice(3)}</Text>
        if (t.startsWith('### ')) return <Text key={i} style={s.h3}>{t.slice(4)}</Text>
        if (t.startsWith('# ')) return <Text key={i} style={{ ...s.h1, fontSize: 14 }}>{t.slice(2)}</Text>
        if (t.startsWith('- ') || t.startsWith('• ')) {
          return <Text key={i} style={s.bullet}>{'  • '}{t.slice(2)}</Text>
        }
        if (t.startsWith('---')) return <View key={i} style={s.sep} />
        // Inline bold stripping for display
        const clean = t.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
        return <Text key={i} style={s.muted}>{clean}</Text>
      })}
    </>
  )
}

// ── Main Document Component ───────────────────────────────────────────────
export function NbosDocument({ data }: { data: PdfPayload }) {
  const docRef = `NG-${Math.floor(Date.now() / 1000) % 1000000}`
  const co = data.companySettings || {}
  const ci = data.clientInfo || {}
  const docs = data.docsSettings || {}
  const items = data.items || []
  const isFinancial = ['Quotation', 'Invoice', 'Agreement', 'SOW'].includes(data.docType)

  const tagline = docs.tagline || 'Your Growth Partner, Powered by AI'
  const validityDays = docs.quotationValidity || '14'
  const ptOneTime = docs.paymentTermsOneTime || '50% advance to begin, 50% balance on final delivery'
  const ptMonthly = docs.paymentTermsMonthly || 'Full monthly fee payable in advance each cycle'
  const gstRate = docs.gstRate || '18'
  const gstAmount = Math.max(0, Math.round((data.grandTotal ?? 0) - ((data.subtotal ?? 0) - (data.discountTotal ?? 0))))
  const extraTerms = docs.extraTerms
    ? docs.extraTerms.split('\n').map(t => t.trim()).filter(Boolean)
    : []

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Header docType={data.docType} docRef={docRef} company={co} tagline={tagline} />
        <Footer company={co} tagline={tagline} docType={data.docType} invoiceFooter={docs.invoiceFooter} />

        {/* ── Project Title ── */}
        <View style={s.spacer8} />
        <Text style={s.h1}>{data.projectTitle || `${DOC_LABELS[data.docType]}`}</Text>
        <View style={s.spacer8} />

        {/* ── PREPARED FOR card ── */}
        <View style={s.prepCard}>
          <Text style={[s.gold, { fontFamily: 'Helvetica-Bold', fontSize: 8, marginBottom: 4 }]}>PREPARED FOR</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 16, color: C.white, marginBottom: 2 }}>
            {data.clientName || 'Client'}
          </Text>
          {data.companyName && data.companyName !== data.clientName && (
            <Text style={s.muted}>{data.companyName}</Text>
          )}
          {(ci.business || ci.industry || ci.mobile) && (
            <View style={{ marginTop: 6 }}>
              {ci.business && <Text style={s.muted}><Text style={s.gold}>BUSINESS  </Text>{ci.business}</Text>}
              {ci.industry && <Text style={s.muted}><Text style={s.gold}>INDUSTRY  </Text>{ci.industry}</Text>}
              {ci.mobile   && <Text style={s.muted}><Text style={s.gold}>MOBILE  </Text>{ci.mobile}</Text>}
            </View>
          )}
        </View>

        {/* ── Service Cards ── */}
        {items.length > 0 && isFinancial && (
          <>
            <Text style={s.h2}>RECOMMENDED SERVICES & DELIVERABLES</Text>
            <View style={s.spacer4} />
            {items.map((item, idx) => (
              <View key={idx} style={s.card} wrap={false}>
                {/* Service name + price */}
                <View style={s.cardHeaderRow}>
                  <Text style={s.svcName}>{(idx + 1).toString().padStart(2, '0')}. {item.serviceName}</Text>
                  <Text style={s.svcPrice}>
                    {INR(item.finalPrice)}{item.pricing_model === 'monthly' ? ' / month' : ''}
                  </Text>
                </View>

                {/* Category · Timeline */}
                <Text style={s.svcMeta}>
                  {item.category || 'SERVICE'}{item.timeline ? `  ·  Timeline: ${item.timeline}` : ''}
                </Text>

                {/* ── Payment type badge ── */}
                <View style={{
                  marginTop: 7,
                  backgroundColor: item.pricing_model === 'monthly' ? '#1a2e1a' : '#1a2200',
                  borderLeftWidth: 3,
                  borderLeftColor: item.pricing_model === 'monthly' ? '#F59E0B' : '#22c55e',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 2,
                }}>
                  <Text style={{
                    fontFamily: 'Helvetica-Bold',
                    fontSize: 8,
                    color: item.pricing_model === 'monthly' ? '#F59E0B' : '#22c55e',
                  }}>
                    {item.pricing_model === 'monthly'
                      ? 'MONTHLY RECURRING PAYMENT'
                      : 'ONE-TIME PAYMENT'}
                  </Text>
                  <Text style={{ fontFamily: 'Helvetica', fontSize: 7.5, color: C.slate, marginTop: 2 }}>
                    {item.pricing_model === 'monthly'
                      ? `Full monthly fee of ${INR(item.finalPrice)} payable in advance at the start of each billing cycle.`
                      : `50% advance (${INR(Math.round(item.finalPrice * 0.5))}) to begin work  ·  50% balance (${INR(Math.round(item.finalPrice * 0.5))}) on final delivery.`}
                  </Text>
                </View>

                {/* Deliverables */}
                {item.deliverables && item.deliverables.length > 0 && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.gold, marginBottom: 4 }}>
                      WHAT'S INCLUDED:
                    </Text>
                    {item.deliverables.map((d, di) => (
                      <Text key={di} style={[s.body, { fontSize: 8, marginBottom: 2 }]}>{'  • '}{d}</Text>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        {/* ── Ad Budget Details ── */}
        {data.adBudget && data.adBudget > 0 && (
          <View style={{ marginBottom: 12 }} wrap={false}>
            <Text style={s.h2}>ADVERTISING BUDGET DETAILS</Text>
            <View style={s.card}>
              <View style={s.cardHeaderRow}>
                <Text style={s.svcName}>Google / Meta Ads Campaign Budget</Text>
                <Text style={s.svcPrice}>{INR(data.adBudget)} / month</Text>
              </View>
              <Text style={s.svcMeta}>
                Billing Mode: {data.adBudgetBillThrough ? 'Billed via Netgain (included in Invoice Total)' : 'Paid directly to platforms by Client'}
              </Text>
              {!data.adBudgetBillThrough && (
                <Text style={{ fontFamily: 'Helvetica', fontSize: 7.5, color: C.slate, marginTop: 4 }}>
                  * Note: This ad budget is managed by Netgain but paid directly to Google/Meta by the client. It is not included in the payment totals below.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ── Rich Content Body ── */}
        {data.content && data.content.trim() && (
          <>
            <View style={s.spacer8} />
            <RenderContent text={data.content} />
          </>
        )}

        {/* ── Investment Summary & Payment QR Code ── */}
        {isFinancial && (data.grandTotal ?? 0) > 0 && (
          <>
            <Text style={s.h2}>INVESTMENT SUMMARY</Text>
            {data.docType === 'Invoice' && data.bankSettings?.upiId ? (
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                {/* Investment Card (Left) */}
                <View style={[s.invCard, { flex: 1, marginBottom: 0 }]}>
                  {(data.subtotal ?? 0) > 0 && (
                    <View style={s.invRow}>
                      <Text style={s.invLabel}>Subtotal charges</Text>
                      <Text style={s.invValue}>{INR(data.subtotal!)}</Text>
                    </View>
                  )}
                  {(data.discountTotal ?? 0) > 0 && (
                    <View style={s.invRow}>
                      <Text style={s.invLabel}>Calculated discount</Text>
                      <Text style={[s.invValue, { color: '#34d399' }]}>−{INR(data.discountTotal!)}</Text>
                    </View>
                  )}
                  {gstAmount > 0 && (
                    <View style={s.invRow}>
                      <Text style={s.invLabel}>GST ({gstRate}%)</Text>
                      <Text style={s.invValue}>+{INR(gstAmount)}</Text>
                    </View>
                  )}
                  <View style={s.invDivider} />
                  <View style={s.invRow}>
                    <Text style={s.invTotalLabel}>Total (payable now)</Text>
                    <Text style={s.invTotalValue}>{INR(data.grandTotal!)}</Text>
                  </View>
                </View>

                {/* UPI QR Code (Right) */}
                <View style={{
                  backgroundColor: C.card,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 2,
                  width: 160,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {(() => {
                    const upiId = data.bankSettings?.upiId || ''
                    const recipientName = data.bankSettings?.accountName || co.name || 'Netgain Studio'
                    const amount = data.grandTotal!
                    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(recipientName)}&am=${amount}&cu=INR`
                    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUri)}`
                    return (
                      <>
                        <Image src={qrCodeUrl} style={{ width: 80, height: 80, marginBottom: 6 }} />
                        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: C.gold }}>SCAN & PAY VIA UPI</Text>
                        <Text style={{ fontFamily: 'Helvetica', fontSize: 6, color: C.slate, marginTop: 2 }}>{upiId}</Text>
                      </>
                    )
                  })()}
                </View>
              </View>
            ) : (
              <View style={s.invCard}>
                {(data.subtotal ?? 0) > 0 && (
                  <View style={s.invRow}>
                    <Text style={s.invLabel}>Subtotal charges</Text>
                    <Text style={s.invValue}>{INR(data.subtotal!)}</Text>
                  </View>
                )}
                {(data.discountTotal ?? 0) > 0 && (
                  <View style={s.invRow}>
                    <Text style={s.invLabel}>Calculated discount</Text>
                    <Text style={[s.invValue, { color: '#34d399' }]}>−{INR(data.discountTotal!)}</Text>
                  </View>
                )}
                {gstAmount > 0 && (
                  <View style={s.invRow}>
                    <Text style={s.invLabel}>GST ({gstRate}%)</Text>
                    <Text style={s.invValue}>+{INR(gstAmount)}</Text>
                  </View>
                )}
                <View style={s.invDivider} />
                <View style={s.invRow}>
                  <Text style={s.invTotalLabel}>Total (payable now)</Text>
                  <Text style={s.invTotalValue}>{INR(data.grandTotal!)}</Text>
                </View>
              </View>
            )}

            {/* Payment schedule breakdown */}
            {items.length > 0 && ['Quotation', 'Invoice'].includes(data.docType) && (() => {
              const oneTime = items.filter(i => i.pricing_model !== 'monthly')
              const monthly = items.filter(i => i.pricing_model === 'monthly')
              const oneTimeSub = oneTime.reduce((a, i) => a + i.finalPrice, 0)
              const monthlyTotal = monthly.reduce((a, i) => a + i.finalPrice, 0)
              if (oneTime.length === 0 && monthly.length === 0) return null

              return (
                <View style={{ marginTop: 10, marginBottom: 4 }}>
                  <Text style={[s.h2, { marginTop: 6 }]}>PAYMENT SCHEDULE</Text>
                  <View style={s.invCard}>
                    {data.paymentScheduleObj ? (
                      <View>
                        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: '#22c55e', marginBottom: 6 }}>{data.paymentScheduleObj.name.toUpperCase()}</Text>
                        {data.paymentScheduleObj.points.map((pt, i) => (
                          <View key={i} style={s.invRow}>
                            <Text style={s.invLabel}>{pt.label} ({pt.pct}%)</Text>
                            <Text style={i === 0 ? [s.invValue, { color: '#22c55e' }] : s.invValue}>INR {Math.round((data.fullProjectTotal ?? data.grandTotal!) * (pt.pct / 100)).toLocaleString('en-IN')}</Text>
                          </View>
                        ))}
                        {monthly.length > 0 && <View style={s.invDivider} />}
                      </View>
                    ) : oneTime.length > 0 ? (
                      <View>
                        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: '#22c55e', marginBottom: 6 }}>ONE-TIME SERVICES</Text>
                        <View style={s.invRow}>
                          <Text style={s.invLabel}>Advance to begin (50%)</Text>
                          <Text style={[s.invValue, { color: '#22c55e' }]}>INR {Math.round(oneTimeSub * 0.5).toLocaleString('en-IN')}</Text>
                        </View>
                        <View style={s.invRow}>
                          <Text style={s.invLabel}>Balance on delivery (50%)</Text>
                          <Text style={s.invValue}>INR {Math.round(oneTimeSub * 0.5).toLocaleString('en-IN')}</Text>
                        </View>
                        {monthly.length > 0 && <View style={s.invDivider} />}
                      </View>
                    ) : null}
                    {monthly.length > 0 && (
                      <View style={{ marginTop: oneTime.length > 0 || data.paymentScheduleObj ? 4 : 0 }}>
                        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: '#F59E0B', marginBottom: 6 }}>MONTHLY RECURRING SERVICES</Text>
                        <View style={s.invRow}>
                          <Text style={s.invLabel}>Due every month (in advance)</Text>
                          <Text style={[s.invValue, { color: '#F59E0B' }]}>INR {monthlyTotal.toLocaleString('en-IN')}/month</Text>
                        </View>
                        <Text style={[s.muted, { fontSize: 7.5, marginTop: 3 }]}>Billed on the 1st of each month. First payment due before campaign commencement.</Text>
                      </View>
                    )}
                  </View>
                </View>
              )
            })()}

            {/* Terms & Conditions — driven by docsSettings */}
            <Text style={s.h2}>TERMS & CONDITIONS</Text>
            {docs.customTerms && docs.customTerms.trim() ? (
              docs.customTerms.split('\n').map(t => t.trim()).filter(Boolean).map((t, i) => (
                <Text key={i} style={s.termBullet}>{'• '}{t}</Text>
              ))
            ) : (data.docType === 'Invoice' && docs.invoiceTerms && docs.invoiceTerms.trim()) ? (
              docs.invoiceTerms.split('\n').map(t => t.trim()).filter(Boolean).map((t, i) => (
                <Text key={i} style={s.termBullet}>{'• '}{t}</Text>
              ))
            ) : (
              [
                ...(data.docType === 'Quotation' ? [`Quotation valid for ${validityDays} days from issue date.`] : []),
                `One-time services: ${ptOneTime}.`,
                `Monthly recurring services: ${ptMonthly}.`,
                'Hosting, domain, ad spend & third-party API fees billed at actuals.',
                `All prices are in Indian Rupees (INR). GST @ ${gstRate}% extra as applicable.`,
                ...(data.docType === 'Quotation' ? [
                  'This quotation contains estimated pricing based on the current project scope. Final pricing will be confirmed after requirement discussions.',
                  'The final Scope of Work (SOW) and Service Agreement will be shared and approved before project commencement.'
                ] : []),
                ...extraTerms,
              ].map((t, i) => (
                <Text key={i} style={s.termBullet}>{'• '}{t}</Text>
              ))
            )}
          </>
        )}
      </Page>
    </Document>
  )
}
