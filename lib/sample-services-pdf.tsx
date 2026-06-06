import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF', color: '#111827' },
  header: { marginBottom: 30, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 12, color: '#6B7280', lineHeight: 1.5 },
  
  instructionsBox: { backgroundColor: '#F3F4F6', padding: 15, borderRadius: 8, marginBottom: 30 },
  instructionsTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#374151' },
  instructionsText: { fontSize: 10, color: '#4B5563', lineHeight: 1.6, marginBottom: 4 },
  
  serviceCard: { marginBottom: 25, padding: 15, borderLeftWidth: 3, borderLeftColor: '#F59E0B', backgroundColor: '#FAFAFA' },
  serviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  serviceTitle: { fontSize: 14, fontWeight: 'bold', color: '#111827', width: '70%' },
  servicePrice: { fontSize: 14, fontWeight: 'bold', color: '#F59E0B', textAlign: 'right' },
  servicePricingType: { fontSize: 10, color: '#6B7280', textAlign: 'right', marginTop: 2 },
  
  metaRow: { flexDirection: 'row', marginBottom: 10 },
  metaLabel: { fontSize: 10, fontWeight: 'bold', color: '#374151', width: 60 },
  metaValue: { fontSize: 10, color: '#4B5563' },
  
  deliverablesTitle: { fontSize: 10, fontWeight: 'bold', color: '#374151', marginBottom: 4, marginTop: 5 },
  bulletRow: { flexDirection: 'row', marginBottom: 3 },
  bulletPoint: { width: 10, fontSize: 10, color: '#6B7280' },
  bulletText: { flex: 1, fontSize: 10, color: '#4B5563', lineHeight: 1.4 },
})

export function SampleServicesPDF() {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        
        <View style={s.header}>
          <Text style={s.title}>Sample Services Format</Text>
          <Text style={s.subtitle}>Use this document as a guide for formatting your pricing PDFs so the NBOS system can automatically extract your services, prices, timelines, and deliverables.</Text>
        </View>

        <View style={s.instructionsBox}>
          <Text style={s.instructionsTitle}>How the Extractor Works:</Text>
          <Text style={s.instructionsText}>• Start service names with a number (e.g., "01. Service Name") or ensure it contains a service keyword (like "Website", "Ads", "Social Media").</Text>
          <Text style={s.instructionsText}>• Write prices clearly using "INR", "Rs.", or "₹" followed by the amount (e.g., "INR 49,999").</Text>
          <Text style={s.instructionsText}>• Indicate pricing type using keywords like "one-time", "monthly", "per month", or "/mo" near the price.</Text>
          <Text style={s.instructionsText}>• Use bullets (•, -, *) for deliverables.</Text>
          <Text style={s.instructionsText}>• Specify the timeline using the format "Timeline: [Your duration]".</Text>
        </View>

        {/* Service 1: One-Time */}
        <View style={s.serviceCard}>
          <View style={s.serviceHeader}>
            <Text style={s.serviceTitle}>01. Corporate E-Commerce Website</Text>
            <View>
              <Text style={s.servicePrice}>INR 45,000</Text>
              <Text style={s.servicePricingType}>(one-time)</Text>
            </View>
          </View>
          
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>TIMELINE:</Text>
            <Text style={s.metaValue}>20-25 days</Text>
          </View>

          <Text style={s.deliverablesTitle}>WHAT'S INCLUDED:</Text>
          <View style={s.bulletRow}><Text style={s.bulletPoint}>•</Text><Text style={s.bulletText}>Custom Shopify store design</Text></View>
          <View style={s.bulletRow}><Text style={s.bulletPoint}>•</Text><Text style={s.bulletText}>Up to 50 initial product uploads</Text></View>
          <View style={s.bulletRow}><Text style={s.bulletPoint}>•</Text><Text style={s.bulletText}>Payment gateway & shipping integration</Text></View>
          <View style={s.bulletRow}><Text style={s.bulletPoint}>•</Text><Text style={s.bulletText}>Mobile responsive optimization</Text></View>
          <View style={s.bulletRow}><Text style={s.bulletPoint}>•</Text><Text style={s.bulletText}>Basic SEO setup</Text></View>
        </View>

        {/* Service 2: Monthly */}
        <View style={s.serviceCard}>
          <View style={s.serviceHeader}>
            <Text style={s.serviceTitle}>02. Social Media Management (Instagram + Facebook)</Text>
            <View>
              <Text style={s.servicePrice}>INR 15,000/mo</Text>
              <Text style={s.servicePricingType}>recurring monthly</Text>
            </View>
          </View>
          
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>TIMELINE:</Text>
            <Text style={s.metaValue}>Ongoing</Text>
          </View>

          <Text style={s.deliverablesTitle}>WHAT'S INCLUDED:</Text>
          <View style={s.bulletRow}><Text style={s.bulletPoint}>•</Text><Text style={s.bulletText}>15 high-quality static posts</Text></View>
          <View style={s.bulletRow}><Text style={s.bulletPoint}>•</Text><Text style={s.bulletText}>4 animated reels per month</Text></View>
          <View style={s.bulletRow}><Text style={s.bulletPoint}>•</Text><Text style={s.bulletText}>Community management and comment replies</Text></View>
          <View style={s.bulletRow}><Text style={s.bulletPoint}>•</Text><Text style={s.bulletText}>Monthly performance analytics report</Text></View>
        </View>

        {/* Service 3: Mixed Setup + Monthly */}
        <View style={s.serviceCard}>
          <View style={s.serviceHeader}>
            <Text style={s.serviceTitle}>03. Google Ads Management</Text>
            <View>
              <Text style={s.servicePrice}>Setup INR 5,000 + INR 10,000/mo</Text>
              <Text style={s.servicePricingType}>monthly retainer</Text>
            </View>
          </View>
          
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>TIMELINE:</Text>
            <Text style={s.metaValue}>7 days setup, ongoing management</Text>
          </View>

          <Text style={s.deliverablesTitle}>WHAT'S INCLUDED:</Text>
          <View style={s.bulletRow}><Text style={s.bulletPoint}>•</Text><Text style={s.bulletText}>Keyword research and competitive analysis</Text></View>
          <View style={s.bulletRow}><Text style={s.bulletPoint}>•</Text><Text style={s.bulletText}>Search and Display campaign creation</Text></View>
          <View style={s.bulletRow}><Text style={s.bulletPoint}>•</Text><Text style={s.bulletText}>Conversion tracking setup</Text></View>
          <View style={s.bulletRow}><Text style={s.bulletPoint}>•</Text><Text style={s.bulletText}>Weekly optimization and scaling</Text></View>
        </View>

      </Page>
    </Document>
  )
}
