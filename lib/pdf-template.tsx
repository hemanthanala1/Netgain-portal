import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, Font, Image,
} from '@react-pdf/renderer'

// Register cursive fonts for client e-signatures
Font.register({
  family: 'DancingScript',
  src: 'https://fonts.gstatic.com/s/dancingscript/v29/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSo3Sup5hNP6pg.ttf'
})
Font.register({
  family: 'AlexBrush',
  src: 'https://fonts.gstatic.com/s/alexbrush/v23/SZc83FzrJKuqFbwMKk6EhUXz6BlNiCY.ttf'
})

// Types
export interface PdfItem {
  serviceName: string
  finalPrice: number
  quantity?: number
  timeline?: string
  category?: string
  pricing_model?: string
  deliverables?: string[]
    tax?: number
}

export interface PdfPayload {
  docType: 'Quotation' | 'Invoice' | 'SOW' | 'Agreement' | 'PRD' | 'ProjectPlan' | 'MarketingReport'
  templateId?: 'modern' | 'corporate' | 'minimal' | 'elegant'
  clientName: string
  companyName?: string
  projectTitle?: string
  clientInfo?: { business?: string; industry?: string; mobile?: string; gst?: string }
  companySettings?: { name?: string; email?: string; phone?: string; website?: string; gst?: string; address?: string; panNumber?: string; logo?: string; primaryColor?: string; secondaryColor?: string; accentColor?: string; signature?: string }
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
  paymentScheduleId?: string
  paymentScheduleObj?: { name: string, points: { label: string, pct: number }[] } | null
  content?: string | string[]
  signatureDetails?: {
    clientName: string
    company?: string
    signatureType: 'drawn' | 'typed'
    signatureImage?: string
    signatureText?: string
    signatureFont?: string
    signedAt: string
    verificationId: string
  }
  paidAt?: string | null
}

// Formatters
const formatCurrency = (val?: number) => {
  if (val === undefined || isNaN(val)) return 'INR 0.00'
  return `INR ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)}`
}
const stripHtml = (html?: string) => html ? html.replace(/<[^>]*>?/gm, '') : ''

const MarkdownRenderer = ({ content, style }: { content?: string | string[], style?: any }) => {
  if (!content) return null;
  const contentStr = Array.isArray(content) ? content.join('\n') : content;
  const lines = contentStr.split('\n');
  return (
    <View style={{ flexDirection: 'column' }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <View key={i} style={{ height: 6 }} />;
        
        let textStyle = { ...style, marginBottom: 4 };
        let textLine = line;
        
        if (textLine.startsWith('### ')) {
          textStyle = { ...textStyle, fontSize: (style?.fontSize || 10) + 1, fontWeight: 'bold', marginTop: 4 };
          textLine = textLine.replace('### ', '');
        } else if (textLine.startsWith('## ')) {
          textStyle = { ...textStyle, fontSize: (style?.fontSize || 10) + 2, fontWeight: 'bold', marginTop: 6 };
          textLine = textLine.replace('## ', '');
        } else if (textLine.startsWith('# ')) {
          textStyle = { ...textStyle, fontSize: (style?.fontSize || 10) + 4, fontWeight: 'bold', marginTop: 8 };
          textLine = textLine.replace('# ', '');
        }

        if (textLine.startsWith('__QR_CODE__')) {
          const qrUrl = textLine.replace('__QR_CODE__', '').replace('__', '');
          return (
            <View key={i} style={{ marginTop: 10, marginBottom: 10 }}>
              <Image src={qrUrl} style={{ width: 100, height: 100 }} />
            </View>
          );
        }

        let isList = false;
        if (textLine.startsWith('- ')) {
          isList = true;
          // Safe bullet render
        }
        
        const parts = textLine.split(/(\*\*.*?\*\*)/g);
        
        return (
          <Text key={i} style={[textStyle, isList ? { marginLeft: 12 } : {}]}>
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <Text key={j} style={{ fontWeight: 'bold' }}>{part.slice(2, -2)}</Text>
              }
              return part;
            })}
          </Text>
        );
      })}
    </View>
  )
}
const getDocDate = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

// PAID Stamp Overlay — rendered over invoice pages when paid
function PaidStamp({ paidAt }: { paidAt: string }) {
  return (
    <View style={{
      position: 'absolute',
      top: 100,
      right: 40,
      width: 110,
      height: 110,
      borderRadius: 55,
      borderWidth: 4,
      borderColor: '#DC2626',
      backgroundColor: 'rgba(220,38,38,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
      transform: 'rotate(-12deg)',
    }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#DC2626', letterSpacing: 2, textTransform: 'uppercase' }}>PAID</Text>
      <Text style={{ fontSize: 6, color: '#DC2626', marginTop: 2, textAlign: 'center', lineHeight: 1.3, fontWeight: 'bold' }}>{paidAt}</Text>
    </View>
  )
}

// Default Fallback Colors
const fallbackTheme = {
  primary: '#0F172A',
  secondary: '#64748B',
  accent: '#3B82F6'
}

// Base Layout Switcher
export function NbosDocument({ payload }: { payload: PdfPayload }) {
  const tid = payload.templateId || 'modern'
  
  if (tid === 'corporate') return <CorporateTemplate payload={payload} />
  if (tid === 'minimal') return <MinimalTemplate payload={payload} />
  if (tid === 'elegant') return <LuxuryTemplate payload={payload} />
  
  return <ModernTemplate payload={payload} />
}

// -----------------------------------------------------------------------------
// TEMPLATE 1: MODERN PROFESSIONAL (Stripe / Linear inspired)
// -----------------------------------------------------------------------------
const modernStyles = (primary: string, secondary: string, accent: string) => StyleSheet.create({
  page: { backgroundColor: '#FFFFFF', paddingTop: 40, paddingLeft: 40, paddingRight: 40, paddingBottom: 100, fontFamily: 'Helvetica', color: '#1E293B' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 },
  logo: { width: 100, maxHeight: 40, objectFit: 'contain' },
  companyInfo: { alignItems: 'flex-end', fontSize: 9, color: secondary, lineHeight: 1.4 },
  companyName: { fontSize: 16, fontWeight: 'bold', color: primary, marginBottom: 4 },
  titleBlock: { backgroundColor: '#F8FAFC', padding: 20, borderRadius: 8, marginBottom: 30, borderLeftWidth: 4, borderLeftColor: accent },
  docTitle: { fontSize: 24, fontWeight: 'bold', color: primary, marginBottom: 4 },
  docMeta: { fontSize: 10, color: secondary },
  grid2: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  infoCard: { width: '48%' },
  infoLabel: { fontSize: 8, textTransform: 'uppercase', color: secondary, marginBottom: 4, letterSpacing: 1 },
  infoText: { fontSize: 10, lineHeight: 1.4, color: primary },
  infoTextBold: { fontSize: 11, fontWeight: 'bold', color: primary },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: primary, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 6 },
  table: { width: '100%', marginBottom: 30 },
  thRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', paddingVertical: 8, paddingHorizontal: 10, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  th: { fontSize: 9, fontWeight: 'bold', color: secondary, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tdText: { fontSize: 9, color: '#334155' },
  tdTitle: { fontSize: 10, fontWeight: 'bold', color: primary, marginBottom: 4 },
  col1: { width: '50%' }, col2: { width: '15%', textAlign: 'center' }, col3: { width: '15%', textAlign: 'right' }, col4: { width: '20%', textAlign: 'right' },
  totalsBox: { width: '40%', alignSelf: 'flex-end', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 6, marginBottom: 30 },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totLabel: { fontSize: 9, color: secondary },
  totVal: { fontSize: 9, color: primary },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  grandLabel: { fontSize: 11, fontWeight: 'bold', color: primary },
  grandVal: { fontSize: 11, fontWeight: 'bold', color: accent },
  notesBox: { marginBottom: 30, fontSize: 9, color: secondary, lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10 },
  footerText: { fontSize: 8, color: secondary },
  signatureBox: { width: 160, marginTop: 40, borderTopWidth: 1, borderTopColor: '#CBD5E1', paddingTop: 8 },
  signatureImg: { width: 120, height: 40, objectFit: 'contain', marginBottom: 4 }
})

function ModernTemplate({ payload }: { payload: PdfPayload }) {
  const p = payload.companySettings?.primaryColor || fallbackTheme.primary
  const s = payload.companySettings?.secondaryColor || fallbackTheme.secondary
  const a = payload.companySettings?.accentColor || fallbackTheme.accent
  const st = modernStyles(p, s, a)

  return (
    <Document>
      <Page size="A4" style={st.page}>
        {/* Header */}
        <View style={st.header}>
          {payload.companySettings?.logo ? (
            <Image src={payload.companySettings.logo} style={st.logo} />
          ) : (
            <Text style={st.companyName}>{payload.companySettings?.name || 'Netgain Studio'}</Text>
          )}
          <View style={st.companyInfo}>
            {(!payload.companySettings?.logo) && <Text style={{ marginBottom: 4 }}>{payload.docsSettings?.tagline}</Text>}
            <Text>{payload.companySettings?.email}</Text>
            <Text>{payload.companySettings?.phone}</Text>
            <Text>{payload.companySettings?.website}</Text>
            {payload.companySettings?.gst && <Text>GST: {payload.companySettings.gst}</Text>}
            {payload.companySettings?.panNumber && <Text>PAN: {payload.companySettings.panNumber}</Text>}
          </View>
        </View>

        {/* Title */}
        <View style={st.titleBlock}>
          <Text style={st.docTitle}>{payload.projectTitle || payload.docType}</Text>
          <Text style={st.docMeta}>Date: {getDocDate()} - Document Reference: {payload.clientName.replace(/\s+/g, '-').toUpperCase()}-{new Date().getFullYear()}</Text>
        </View>

        {/* Info Grid */}
        <View style={st.grid2}>
          <View style={st.infoCard}>
            <Text style={st.infoLabel}>Prepared For</Text>
            <Text style={st.infoTextBold}>{payload.clientName}</Text>
            <Text style={st.infoText}>{payload.companyName}</Text>
            {payload.clientInfo?.mobile && <Text style={st.infoText}>{payload.clientInfo.mobile}</Text>}
            {payload.clientInfo?.gst && <Text style={st.infoText}>GST: {payload.clientInfo.gst}</Text>}
          </View>
          <View style={st.infoCard}>
            <Text style={st.infoLabel}>Prepared By</Text>
            <Text style={st.infoTextBold}>{payload.founderSettings?.name || 'Account Executive'}</Text>
            <Text style={st.infoText}>{payload.founderSettings?.designation || 'Netgain Studio'}</Text>
            <Text style={st.infoText}>{payload.founderSettings?.email || payload.companySettings?.email}</Text>
          </View>
        </View>

        {/* Content (SOW/Agreements text or Line Items) */}
        {payload.content && (
          <View style={{ marginBottom: 30 }}>
            <Text style={st.sectionTitle}>Agreement Details</Text>
            <MarkdownRenderer content={payload.content} style={{ fontSize: 10, lineHeight: 1.5, color: '#334155' }} />
          </View>
        )}

        {/* Line Items */}
        {payload.items && payload.items.length > 0 && (
          <View>
            <Text style={st.sectionTitle}>Investment Breakdown</Text>
            <View style={st.table}>
              <View style={st.thRow}>
                <Text style={[st.th, st.col1]}>Service / Description</Text>
                <Text style={[st.th, st.col2]}>Price</Text>
                <Text style={[st.th, st.col3]}>Qty</Text>
                <Text style={[st.th, st.col4]}>Total</Text>
              </View>
              {payload.items.map((item, idx) => (
                <View key={idx} style={st.tr}>
                    <View style={st.col1}>
                      <Text style={st.tdTitle}>{item.serviceName}</Text>
                      {item.deliverables && item.deliverables.length > 0 && item.deliverables.map((d, i) => (
                        <Text key={i} style={st.tdText}>- {d}</Text>
                      ))}
                      
                    </View>
                  <Text style={[st.tdText, st.col2]}>{formatCurrency(item.finalPrice)}</Text>
                  <Text style={[st.tdText, st.col3]}>{item.quantity || 1}</Text>
                  <Text style={[st.tdText, st.col4]}>{formatCurrency((item.finalPrice) * (item.quantity || 1))}</Text>
                </View>
              ))}
            </View>

            {/* Totals */}
            <View style={st.totalsBox}>
              <View style={st.totRow}>
                <Text style={st.totLabel}>Subtotal</Text>
                <Text style={st.totVal}>{formatCurrency(payload.subtotal)}</Text>
              </View>
              {(payload.discountTotal || 0) > 0 && (
                <View style={st.totRow}>
                  <Text style={st.totLabel}>Discount</Text>
                  <Text style={[st.totVal, { color: '#EF4444' }]}>-{formatCurrency(payload.discountTotal)}</Text>
                </View>
              )}
              {payload.docsSettings?.gstRate && (
                <View style={st.totRow}>
                  <Text style={st.totLabel}>GST ({payload.docsSettings.gstRate}%)</Text>
                  <Text style={st.totVal}>{formatCurrency((payload.grandTotal || 0) - (payload.subtotal || 0) + (payload.discountTotal || 0))}</Text>
                </View>
              )}
              <View style={st.grandRow}>
                <Text style={st.grandLabel}>Grand Total</Text>
                <Text style={st.grandVal}>{formatCurrency(payload.grandTotal)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Payment & Bank Details */}
        <View style={st.grid2}>
          {payload.bankSettings?.accountNumber && (
            <View style={st.infoCard}>
              <Text style={st.sectionTitle}>Banking Details</Text>
              <Text style={st.infoTextBold}>{payload.bankSettings.bank}</Text>
              <Text style={st.infoText}>A/c Name: {payload.bankSettings.accountName}</Text>
              <Text style={st.infoText}>A/c No: {payload.bankSettings.accountNumber}</Text>
              <Text style={st.infoText}>IFSC: {payload.bankSettings.ifsc}</Text>
              {payload.bankSettings.upiId && <Text style={st.infoText}>UPI: {payload.bankSettings.upiId}</Text>}
            </View>
          )}
          {payload.paymentScheduleObj && (
            <View style={st.infoCard}>
              <Text style={st.sectionTitle}>Payment Schedule</Text>
              {payload.paymentScheduleObj.points.map((pt, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={st.infoText}>{pt.label}</Text>
                  <Text style={st.infoTextBold}>{formatCurrency(((payload.fullProjectTotal || payload.grandTotal || 0) * pt.pct) / 100)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Terms */}
        <View style={st.notesBox}>
          <Text style={st.sectionTitle}>Terms & Conditions</Text>
          {payload.docsSettings?.customTerms ? (
             payload.docsSettings.customTerms.split('\n').map((t, i) => <Text key={i} style={{ marginBottom: 4 }}>- {t}</Text>)
          ) : (
             <Text>As per standard Netgain Studio terms of service.</Text>
          )}
        </View>

        {/* Signatures */}
        {payload.signatureDetails && (
          <View style={st.grid2}>
             <View style={st.signatureBox}>
               {payload.companySettings?.signature ? (
                 <Image src={payload.companySettings.signature} style={st.signatureImg} />
               ) : (
                 <Text style={{ fontFamily: 'DancingScript', fontSize: 24, color: p, marginBottom: 10 }}>{payload.founderSettings?.name}</Text>
               )}
               <Text style={st.infoTextBold}>{payload.founderSettings?.name}</Text>
               <Text style={st.infoText}>Authorized Signatory</Text>
             </View>
             <View style={st.signatureBox}>
               {payload.signatureDetails.signatureImage ? (
                 <Image src={payload.signatureDetails.signatureImage} style={st.signatureImg} />
               ) : (
                 <Text style={{ fontFamily: 'DancingScript', fontSize: 24, color: p, marginBottom: 10 }}>{payload.signatureDetails.signatureText}</Text>
               )}
               <Text style={st.infoTextBold}>{payload.signatureDetails.clientName}</Text>
               <Text style={st.infoText}>Verified: {payload.signatureDetails.signedAt}</Text>
               <Text style={[st.infoText, { fontSize: 6 }]}>ID: {payload.signatureDetails.verificationId}</Text>
             </View>
          </View>
        )}

        {/* Footer */}
        <View style={st.footer} fixed>
          <Text style={st.footerText}>{payload.companySettings?.name} - {payload.companySettings?.website}</Text>
          <Text style={st.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
        {payload.paidAt && <PaidStamp paidAt={payload.paidAt} />}
      </Page>
    </Document>
  )
}

// -----------------------------------------------------------------------------
// TEMPLATE 2: CORPORATE EXECUTIVE (Deloitte / EY style)
// -----------------------------------------------------------------------------
const corpStyles = (primary: string, secondary: string, accent: string) => StyleSheet.create({
  page: { backgroundColor: '#FFFFFF', paddingTop: 40, paddingLeft: 40, paddingRight: 40, paddingBottom: 100, fontFamily: 'Helvetica', color: '#333333' },
  headerStrip: { height: 12, backgroundColor: primary, position: 'absolute', top: 0, left: 0, right: 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, borderBottomWidth: 2, borderBottomColor: primary, paddingBottom: 20, marginBottom: 30 },
  logo: { width: 120, maxHeight: 45, objectFit: 'contain' },
  docType: { fontSize: 28, fontWeight: 'bold', color: primary, textTransform: 'uppercase', letterSpacing: 2 },
  grid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  box: { padding: 15, borderLeftWidth: 3, borderLeftColor: primary, backgroundColor: '#F9FAFB', width: '48%' },
  boxTitle: { fontSize: 9, fontWeight: 'bold', color: secondary, textTransform: 'uppercase', marginBottom: 6 },
  text: { fontSize: 10, lineHeight: 1.4 },
  textBold: { fontSize: 10, fontWeight: 'bold' },
  table: { width: '100%', marginBottom: 30, borderWidth: 1, borderColor: '#E5E7EB' },
  thRow: { flexDirection: 'row', backgroundColor: primary },
  th: { fontSize: 9, fontWeight: 'bold', color: '#FFFFFF', padding: 8 },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  td: { padding: 8, fontSize: 9 },
  col1: { width: '55%' }, col2: { width: '15%', textAlign: 'center' }, col3: { width: '30%', textAlign: 'right' },
  totalsWrapper: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 30 },
  totalsBox: { width: '50%', borderWidth: 1, borderColor: '#E5E7EB' },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  totLabel: { fontSize: 10, fontWeight: 'bold' },
  totVal: { fontSize: 10 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: secondary, paddingTop: 10 },
  footerText: { fontSize: 8, color: secondary },
  confidential: { position: 'absolute', bottom: 15, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 2 }
})

function CorporateTemplate({ payload }: { payload: PdfPayload }) {
  const p = payload.companySettings?.primaryColor || '#1E3A8A'
  const s = payload.companySettings?.secondaryColor || '#4B5563'
  const a = payload.companySettings?.accentColor || '#2563EB'
  const st = corpStyles(p, s, a)

  return (
    <Document>
      <Page size="A4" style={st.page}>
        <View style={st.headerStrip} fixed />
        
        <View style={st.header}>
          {payload.companySettings?.logo ? (
            <Image src={payload.companySettings.logo} style={st.logo} />
          ) : (
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: p }}>{payload.companySettings?.name}</Text>
          )}
          <Text style={st.docType}>{payload.docType}</Text>
        </View>

        <View style={st.grid}>
          <View style={st.box}>
            <Text style={st.boxTitle}>Client Information</Text>
            <Text style={st.textBold}>{payload.clientName}</Text>
            <Text style={st.text}>{payload.companyName}</Text>
            <Text style={st.text}>Date: {getDocDate()}</Text>
          </View>
          <View style={st.box}>
            <Text style={st.boxTitle}>Corporate Details</Text>
            <Text style={st.textBold}>{payload.companySettings?.name}</Text>
            <Text style={st.text}>{payload.companySettings?.email}</Text>
            <Text style={st.text}>{payload.companySettings?.website}</Text>
            {payload.companySettings?.gst && <Text style={st.text}>GST: {payload.companySettings.gst}</Text>}
          </View>
        </View>

        {payload.content && (
          <View style={{ marginBottom: 30 }}>
            <Text style={[st.boxTitle, { color: p, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 4, marginBottom: 8 }]}>Scope / Terms</Text>
            <MarkdownRenderer content={payload.content} style={{ fontSize: 10, lineHeight: 1.5 }} />
          </View>
        )}

        {payload.items && payload.items.length > 0 && (
          <View style={st.table}>
            <View style={st.thRow}>
              <Text style={[st.th, st.col1]}>Description</Text>
              <Text style={[st.th, st.col2]}>Qty</Text>
              <Text style={[st.th, st.col3]}>Total Amount</Text>
            </View>
            {payload.items.map((item, idx) => (
              <View key={idx} style={st.tr}>
                  <View style={[st.td, st.col1]}>
                    <Text style={st.textBold}>{item.serviceName}</Text>
                    {item.deliverables && item.deliverables.length > 0 && item.deliverables.map((d, i) => <Text key={i} style={st.text}>- {d}</Text>)}
                    
                  </View>
                <Text style={[st.td, st.col2]}>{item.quantity || 1}</Text>
                <Text style={[st.td, st.col3]}>{formatCurrency((item.finalPrice) * (item.quantity || 1))}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={st.totalsWrapper}>
          <View style={st.totalsBox}>
            <View style={[st.totRow, { borderTopWidth: 0 }]}><Text style={st.totLabel}>Subtotal</Text><Text style={st.totVal}>{formatCurrency(payload.subtotal)}</Text></View>
            {(payload.discountTotal || 0) > 0 && <View style={st.totRow}><Text style={st.totLabel}>Discount</Text><Text style={st.totVal}>-{formatCurrency(payload.discountTotal)}</Text></View>}
            {payload.docsSettings?.gstRate && <View style={st.totRow}><Text style={st.totLabel}>Taxes ({payload.docsSettings.gstRate}%)</Text><Text style={st.totVal}>{formatCurrency((payload.grandTotal || 0) - (payload.subtotal || 0) + (payload.discountTotal || 0))}</Text></View>}
            <View style={[st.totRow, { backgroundColor: '#F9FAFB' }]}><Text style={st.totLabel}>Grand Total</Text><Text style={[st.totVal, { fontWeight: 'bold' }]}>{formatCurrency(payload.grandTotal)}</Text></View>
          </View>
        </View>

        {payload.signatureDetails && (
          <View style={{ marginTop: 20 }}>
            <Text style={[st.boxTitle, { color: p }]}>Execution</Text>
            <View style={{ flexDirection: 'row', gap: 60, marginTop: 10 }}>
              <View>
                 {payload.signatureDetails.signatureImage ? (
                   <Image src={payload.signatureDetails.signatureImage} style={{ width: 120, height: 40, objectFit: 'contain', marginBottom: 5 }} />
                 ) : (
                   <Text style={{ fontFamily: 'DancingScript', fontSize: 18, color: '#333333', marginBottom: 5 }}>{payload.signatureDetails.signatureText}</Text>
                 )}
                 <Text style={st.textBold}>{payload.signatureDetails.clientName}</Text>
                 <Text style={st.text}>Signed: {payload.signatureDetails.signedAt}</Text>
                 <Text style={[st.text, { fontSize: 6 }]}>ID: {payload.signatureDetails.verificationId}</Text>
              </View>
              <View>
                 {payload.companySettings?.signature ? (
                   <Image src={payload.companySettings.signature} style={{ width: 120, height: 40, objectFit: 'contain', marginBottom: 5 }} />
                 ) : (
                   <Text style={{ fontFamily: 'DancingScript', fontSize: 18, color: '#333333', marginBottom: 5 }}>{payload.founderSettings?.name}</Text>
                 )}
                 <Text style={st.textBold}>{payload.founderSettings?.name}</Text>
                 <Text style={st.text}>Authorized Representative</Text>
              </View>
            </View>
          </View>
        )}

        <View style={st.footer} fixed>
          <Text style={st.footerText}>{payload.companySettings?.name} - Confidential</Text>
          <Text style={st.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
        <Text style={st.confidential} fixed>Strictly Confidential & Proprietary</Text>
        {payload.paidAt && <PaidStamp paidAt={payload.paidAt} />}
      </Page>
    </Document>
  )
}

// -----------------------------------------------------------------------------
// TEMPLATE 3: MINIMAL CLEAN (Apple / Notion style)
// -----------------------------------------------------------------------------
const minStyles = StyleSheet.create({
  page: { backgroundColor: '#FFFFFF', paddingTop: 50, paddingLeft: 50, paddingRight: 50, paddingBottom: 110, fontFamily: 'Helvetica', color: '#111827' },
  header: { marginBottom: 50 },
  logo: { width: 60, maxHeight: 30, objectFit: 'contain', marginBottom: 20 },
  docTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  metaRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 20, marginBottom: 30 },
  metaBlock: { marginRight: 60 },
  label: { fontSize: 8, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  value: { fontSize: 10, lineHeight: 1.5 },
  table: { width: '100%', marginBottom: 40 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 12 },
  col1: { width: '70%' }, col2: { width: '30%', textAlign: 'right' },
  title: { fontSize: 10, fontWeight: 'bold' },
  desc: { fontSize: 9, color: '#6B7280', marginTop: 4 },
  totals: { alignSelf: 'flex-end', width: '40%', borderTopWidth: 2, borderTopColor: '#111827', paddingTop: 12 },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  footer: { position: 'absolute', bottom: 40, left: 50, right: 50, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: '#9CA3AF' }
})

function MinimalTemplate({ payload }: { payload: PdfPayload }) {
  return (
    <Document>
      <Page size="A4" style={minStyles.page}>
        <View style={minStyles.header}>
          {payload.companySettings?.logo && <Image src={payload.companySettings.logo} style={minStyles.logo} />}
          <Text style={minStyles.docTitle}>{payload.docType}</Text>
        </View>

        <View style={minStyles.metaRow}>
          <View style={minStyles.metaBlock}>
            <Text style={minStyles.label}>To</Text>
            <Text style={minStyles.value}>{payload.clientName}</Text>
            <Text style={minStyles.value}>{payload.companyName}</Text>
          </View>
          <View style={minStyles.metaBlock}>
            <Text style={minStyles.label}>From</Text>
            <Text style={minStyles.value}>{payload.companySettings?.name}</Text>
            <Text style={minStyles.value}>{payload.companySettings?.email}</Text>
          </View>
          <View style={minStyles.metaBlock}>
            <Text style={minStyles.label}>Date</Text>
            <Text style={minStyles.value}>{getDocDate()}</Text>
          </View>
        </View>

        {payload.content && (
          <View style={{ marginBottom: 40 }}>
            <MarkdownRenderer content={payload.content} style={{ fontSize: 10, lineHeight: 1.6 }} />
          </View>
        )}

        {payload.items && payload.items.length > 0 && (
          <View style={minStyles.table}>
            <View style={[minStyles.tr, { borderBottomWidth: 2, borderBottomColor: '#111827' }]}>
              <Text style={[minStyles.label, minStyles.col1]}>Description</Text>
              <Text style={[minStyles.label, minStyles.col2]}>Amount</Text>
            </View>
            {payload.items.map((item, idx) => (
              <View key={idx} style={minStyles.tr}>
                  <View style={minStyles.col1}>
                    <Text style={minStyles.title}>{item.serviceName}</Text>
                    {item.deliverables && item.deliverables.length > 0 && <Text style={minStyles.desc}>{item.deliverables.join(' - ')}</Text>}
                    
                  </View>
                <Text style={[minStyles.value, minStyles.col2]}>{formatCurrency((item.finalPrice) * (item.quantity || 1))}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={minStyles.totals}>
           <View style={minStyles.totRow}><Text style={minStyles.label}>Subtotal</Text><Text style={minStyles.value}>{formatCurrency(payload.subtotal)}</Text></View>
           {payload.docsSettings?.gstRate && <View style={minStyles.totRow}><Text style={minStyles.label}>Tax</Text><Text style={minStyles.value}>{formatCurrency((payload.grandTotal || 0) - (payload.subtotal || 0) + (payload.discountTotal || 0))}</Text></View>}
           <View style={[minStyles.totRow, { marginTop: 10 }]}><Text style={[minStyles.label, { color: '#111827', fontWeight: 'bold' }]}>Total</Text><Text style={[minStyles.value, { fontWeight: 'bold', fontSize: 12 }]}>{formatCurrency(payload.grandTotal)}</Text></View>
        </View>

        {payload.signatureDetails && (
          <View style={{ marginTop: 30 }}>
            <Text style={[minStyles.label, { color: '#111827', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 4, marginBottom: 10 }]}>Execution</Text>
            <View style={{ flexDirection: 'row', gap: 60, marginTop: 10 }}>
              <View>
                 {payload.signatureDetails.signatureImage ? (
                   <Image src={payload.signatureDetails.signatureImage} style={{ width: 120, height: 40, objectFit: 'contain', marginBottom: 5 }} />
                 ) : (
                   <Text style={{ fontFamily: 'DancingScript', fontSize: 18, color: '#111827', marginBottom: 5 }}>{payload.signatureDetails.signatureText}</Text>
                 )}
                 <Text style={minStyles.title}>{payload.signatureDetails.clientName}</Text>
                 <Text style={minStyles.desc}>Signed: {payload.signatureDetails.signedAt}</Text>
                 <Text style={[minStyles.desc, { fontSize: 6 }]}>ID: {payload.signatureDetails.verificationId}</Text>
              </View>
              <View>
                 {payload.companySettings?.signature ? (
                   <Image src={payload.companySettings.signature} style={{ width: 120, height: 40, objectFit: 'contain', marginBottom: 5 }} />
                 ) : (
                   <Text style={{ fontFamily: 'DancingScript', fontSize: 18, color: '#111827', marginBottom: 5 }}>{payload.founderSettings?.name}</Text>
                 )}
                 <Text style={minStyles.title}>{payload.founderSettings?.name}</Text>
                 <Text style={minStyles.desc}>Authorized Representative</Text>
              </View>
            </View>
          </View>
        )}

        <View style={minStyles.footer} fixed>
          <Text style={minStyles.footerText}>{payload.companySettings?.name}</Text>
          <Text style={minStyles.footerText} render={({ pageNumber }) => `${pageNumber}`} />
        </View>
        {payload.paidAt && <PaidStamp paidAt={payload.paidAt} />}
      </Page>
    </Document>
  )
}

// -----------------------------------------------------------------------------
// TEMPLATE 4: LUXURY ELEGANT (Premium Agency style)
// -----------------------------------------------------------------------------
const luxStyles = (gold: string, charcoal: string) => StyleSheet.create({
  page: { backgroundColor: '#FAFAFA', paddingTop: 50, paddingLeft: 50, paddingRight: 50, paddingBottom: 110, fontFamily: 'Times-Roman', color: charcoal },
  borderWrap: { position: 'absolute', top: 20, left: 20, right: 20, bottom: 20, borderWidth: 1, borderColor: gold },
  header: { alignItems: 'center', marginBottom: 40, borderBottomWidth: 1, borderBottomColor: gold, paddingBottom: 30 },
  logo: { width: 140, maxHeight: 60, objectFit: 'contain', marginBottom: 15 },
  docType: { fontSize: 20, color: gold, letterSpacing: 4, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40, paddingHorizontal: 20 },
  titleText: { fontSize: 10, color: gold, fontStyle: 'italic', marginBottom: 5 },
  valText: { fontSize: 11, lineHeight: 1.6 },
  table: { paddingHorizontal: 20, marginBottom: 40 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB', paddingVertical: 10 },
  col1: { width: '80%' }, col2: { width: '20%', textAlign: 'right' },
  service: { fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  desc: { fontSize: 10, color: '#6B7280', fontStyle: 'italic' },
  totals: { alignItems: 'flex-end', paddingHorizontal: 20 },
  totRow: { flexDirection: 'row', width: 200, justifyContent: 'space-between', marginBottom: 6 },
  totLabel: { fontSize: 10, color: '#6B7280' },
  totVal: { fontSize: 11 },
  footer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  footerText: { fontSize: 9, color: '#9CA3AF', fontStyle: 'italic' }
})

function LuxuryTemplate({ payload }: { payload: PdfPayload }) {
  const gold = payload.companySettings?.primaryColor || '#D4AF37'
  const char = payload.companySettings?.secondaryColor || '#1F2937'
  const st = luxStyles(gold, char)

  return (
    <Document>
      <Page size="A4" style={st.page}>
        <View style={st.borderWrap} fixed />
        
        <View style={st.header}>
          {payload.companySettings?.logo ? (
            <Image src={payload.companySettings.logo} style={st.logo} />
          ) : (
            <Text style={{ fontSize: 24, color: char, marginBottom: 10 }}>{payload.companySettings?.name}</Text>
          )}
          <Text style={st.docType}>{payload.docType}</Text>
        </View>

        <View style={st.grid}>
           <View>
             <Text style={st.titleText}>Prepared For</Text>
             <Text style={st.valText}>{payload.clientName}</Text>
             <Text style={st.valText}>{payload.companyName}</Text>
           </View>
           <View style={{ alignItems: 'flex-end' }}>
             <Text style={st.titleText}>Date</Text>
             <Text style={st.valText}>{getDocDate()}</Text>
             <Text style={st.titleText}>Amount</Text>
             <Text style={st.valText}>{formatCurrency(payload.grandTotal)}</Text>
           </View>
        </View>

        {payload.content && (
          <View style={{ paddingHorizontal: 20, marginBottom: 40 }}>
            <MarkdownRenderer content={payload.content} style={{ fontSize: 11, lineHeight: 1.8, textAlign: 'justify' }} />
          </View>
        )}

        {payload.items && payload.items.length > 0 && (
          <View style={st.table}>
            {payload.items.map((item, idx) => (
              <View key={idx} style={st.tr}>
                  <View style={st.col1}>
                    <Text style={st.service}>{item.serviceName}</Text>
                    {item.deliverables && item.deliverables.length > 0 && <Text style={st.desc}>{item.deliverables.join(', ')}</Text>}
                    
                  </View>
                <Text style={[st.valText, st.col2]}>{formatCurrency((item.finalPrice) * (item.quantity || 1))}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={st.totals}>
          <View style={st.totRow}><Text style={st.totLabel}>Subtotal</Text><Text style={st.totVal}>{formatCurrency(payload.subtotal)}</Text></View>
          <View style={st.totRow}><Text style={st.totLabel}>Taxes</Text><Text style={st.totVal}>{formatCurrency((payload.grandTotal || 0) - (payload.subtotal || 0) + (payload.discountTotal || 0))}</Text></View>
          <View style={[st.totRow, { borderTopWidth: 1, borderTopColor: gold, paddingTop: 6, marginTop: 4 }]}><Text style={[st.totLabel, { color: gold }]}>Grand Total</Text><Text style={[st.totVal, { color: gold }]}>{formatCurrency(payload.grandTotal)}</Text></View>
        </View>

        {payload.signatureDetails && (
          <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
            <Text style={[st.titleText, { color: gold, borderBottomWidth: 1, borderBottomColor: '#D1D5DB', paddingBottom: 4, marginBottom: 10 }]}>Execution</Text>
            <View style={{ flexDirection: 'row', gap: 60, marginTop: 10 }}>
              <View>
                 {payload.signatureDetails.signatureImage ? (
                   <Image src={payload.signatureDetails.signatureImage} style={{ width: 140, height: 50, objectFit: 'contain', marginBottom: 5 }} />
                 ) : (
                   <Text style={{ fontFamily: 'DancingScript', fontSize: 20, color: char, marginBottom: 5 }}>{payload.signatureDetails.signatureText}</Text>
                 )}
                 <Text style={[st.service, { fontSize: 11 }]}>{payload.signatureDetails.clientName}</Text>
                 <Text style={st.desc}>Signed: {payload.signatureDetails.signedAt}</Text>
                 <Text style={[st.desc, { fontSize: 6 }]}>ID: {payload.signatureDetails.verificationId}</Text>
              </View>
              <View>
                 {payload.companySettings?.signature ? (
                   <Image src={payload.companySettings.signature} style={{ width: 140, height: 50, objectFit: 'contain', marginBottom: 5 }} />
                 ) : (
                   <Text style={{ fontFamily: 'DancingScript', fontSize: 20, color: char, marginBottom: 5 }}>{payload.founderSettings?.name}</Text>
                 )}
                 <Text style={[st.service, { fontSize: 11 }]}>{payload.founderSettings?.name}</Text>
                 <Text style={st.desc}>Authorized Representative</Text>
              </View>
            </View>
          </View>
        )}

        <View style={st.footer} fixed>
          <Text style={st.footerText}>{payload.companySettings?.name} - {payload.companySettings?.website}</Text>
        </View>
        {payload.paidAt && <PaidStamp paidAt={payload.paidAt} />}
      </Page>
    </Document>
  )
}

