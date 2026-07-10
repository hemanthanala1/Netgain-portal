'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Save, Building2, User, CreditCard, MessageSquare, Cpu, Upload, Eye, EyeOff, CheckCircle2, Loader2, FileText, Trash2, Plus, Calendar, Link, Unlink, Shield, History, Bell, Sparkles, Search } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'

// Component definitions moved outside to prevent re-creation on each render
const FieldRow = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 items-start gap-4">
    <div className="mt-1 md:mt-2">
      <Label className="text-sm">{label}</Label>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
    <div className="col-span-1 md:col-span-2">{children}</div>
  </div>
)

const SecretField = ({ id, value, onChange, placeholder, showKey, setShowKey }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string; showKey: Record<string, boolean>; setShowKey: (updater: (k: Record<string, boolean>) => Record<string, boolean>) => void }) => (
  <div className="relative">
    <Input
      type={showKey[id] ? 'text' : 'password'}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="pr-10"
    />
    <button
      type="button"
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      onClick={() => setShowKey(k => ({ ...k, [id]: !k[id] }))}
    >
      {showKey[id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  </div>
)

const ImageUploader = ({ label, field, company, setCompany, toast }: { label: string; field: 'logo' | 'stamp' | 'signature'; company: any; setCompany: (updater: (c: any) => any) => void; toast: any }) => {
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setCompany(c => ({ ...c, [field]: base64 }))
      toast({ title: 'Image Uploaded', description: `${field} uploaded and updated locally.` })
    }
    reader.readAsDataURL(file)
  }

  return (
    <FieldRow label={label}>
      <div className="flex items-center gap-4">
        {company[field] && <img src={company[field]} alt={label} className="h-12 w-auto object-contain bg-white/5 p-1 rounded border border-border" />}
        <Label className="cursor-pointer">
          <Input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <div className="flex h-9 items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground gap-1.5 cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            {company[field] ? 'Change ' + label : 'Upload ' + label}
          </div>
        </Label>
        {company[field] && <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-400 h-9" onClick={() => setCompany(c => ({ ...c, [field]: '' }))}>Remove</Button>}
      </div>
    </FieldRow>
  )
}

function SettingsPageContent() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [defaultTab, setDefaultTab] = useState('company')

  const [company, setCompany] = useState({
    name: 'Netgain Studio',
    address: 'Hyderabad, Telangana, India',
    gst: '',
    pan: '',
    email: 'mail.netgain@gmail.com',
    website: 'netgain.studio',
    phone: '9347102347 | 9392469669',
    calBookingUrl: '',
    logo: '',
    stamp: '',
    signature: '',
    primaryColor: '#D4AF37',
    secondaryColor: '#1A1A1A',
    passwordPolicy: 'strong',
    rateLimitRps: '10',
    backupFrequency: 'daily',
    notifyOnLogin: true,
    notifyOnInvoice: true,
    notifyOnProject: true,
    notifyOnSupport: true
  })

  const [founder, setFounder] = useState({
    name: 'Devon Shah',
    designation: 'Founder & CEO',
    email: 'devon@netgain.studio',
    phone: '9876543210',
  })

  const [bank, setBank] = useState({
    accountName: 'Netgain Studio',
    accountNumber: '',
    ifsc: '',
    bank: 'HDFC Bank',
    upiId: '',
  })

  const [comm, setComm] = useState({
    emailProvider: 'smtp',
    fromEmail: '', fromName: 'Netgain Studio',
    smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '',
    resendApiKey: '', sendgridApiKey: '',
    waProvider: 'meta',
    waToken: '', waPhoneId: '',
    twilioWaSid: '', twilioWaToken: '',
    smsProvider: 'MSG91',
    twilioAccountSid: '', twilioAuthToken: '',
    msg91Authkey: '', msg91TemplateId: '', textlocalApiKey: '',
    supabaseUrl: '', supabaseAnonKey: '', supabaseServiceKey: ''
  })

  const [ai, setAi] = useState({
    claudeKey: '', openaiKey: '', geminiKey: '', defaultProvider: 'claude',
  })

  const [docs, setDocs] = useState({
    tagline: 'Your Growth Partner, Powered by AI',
    quotationValidity: '14',
    paymentTermsOneTime: '50% advance to begin, 50% balance on final delivery',
    paymentTermsMonthly: 'Full monthly fee payable in advance each cycle',
    gstRate: '18',
    extraTerms: '',
    paymentSchedule: '- 50% advance payment to commence work\n- Remaining balance due upon project completion / monthly for retainers\n- All amounts are exclusive of applicable GST',
    paymentSchedules: [
      { id: '1', name: '50/50 Split', points: [{ label: 'Advance to begin', pct: 50 }, { label: 'Balance on delivery', pct: 50 }] },
      { id: '2', name: '100% Upfront', points: [{ label: 'Full Payment', pct: 100 }] },
      { id: '3', name: '40/40/20 Split', points: [{ label: 'Advance', pct: 40 }, { label: 'Milestone 1', pct: 40 }, { label: 'Final Delivery', pct: 20 }] }
    ],
    invoiceTerms: 'Payment is due within 10 days of invoice date.\nLate payments attract 2% per month penalty.\nAccepted: NEFT / IMPS / UPI / Cheque',
    invoiceNotes: 'Thank you for your business!',
    invoicePaymentInstructions: 'Please transfer the payment to our bank account or scan the UPI QR code.',
    invoiceFooter: 'Netgain Studio | mail.netgain@gmail.com | 9347102347',
    invoiceAdditionalText: '',
    quotationPrefix: 'QT-',
    invoicePrefix: 'INV-',
    agreementPrefix: 'AGR-',
    sowPrefix: 'SOW-',
    taxRateTDS: '10'
  })

  const [payment, setPayment] = useState({
    razorpayEnabled: false,
    razorpayMode: 'test',
    razorpayKeyId: '',
    razorpaySecretKey: '',
    razorpayWebhookSecret: '',
    currency: 'INR'
  })

  const [isGoogleConnected, setIsGoogleConnected] = useState(false)
  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const [testingChannel, setTestingChannel] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  
  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [auditSearch, setAuditSearch] = useState('')
  const [auditFilter, setAuditFilter] = useState('all')

  // Load saved settings on mount only - do NOT reload on every auth event
  // as this causes masked API keys (••••••••) to replace user-entered values
  useEffect(() => {
    loadSettings()
  }, [])

  // Handle URL params from Google OAuth redirect
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    const tab = searchParams.get('tab')

    if (tab === 'comms') {
      setDefaultTab('comms')
    }

    if (connected === 'google') {
      loadSettings()
      toast({ title: '✅ Google Calendar Connected!', description: 'Your Google account has been successfully linked.' })
      window.history.replaceState({}, '', '/settings?tab=comms')
    }

    if (error === 'google_oauth_not_configured') {
      toast({
        title: '⚠️ Google OAuth Not Configured',
        description: 'Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment variables.',
        variant: 'destructive'
      })
      window.history.replaceState({}, '', '/settings?tab=comms')
    }
  }, [searchParams])

  const loadSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch('/api/settings', { headers })
      const data = await res.json()

      if (data.company)  setCompany(c => ({ ...c, ...data.company }))
      if (data.founder)  setFounder(f => ({ ...f, ...data.founder }))
      if (data.bank)     setBank(b => ({ ...b, ...data.bank }))
      if (data.comm)     setComm(c => ({ ...c, ...data.comm }))
      if (data.ai)       setAi(a => ({ ...a, ...data.ai }))
      if (data.docs)     setDocs(d => ({ ...d, ...data.docs }))
      if (data.payment)  setPayment(p => ({ ...p, ...data.payment }))
      if (data.isGoogleConnected !== undefined) setIsGoogleConnected(data.isGoogleConnected)
      if (data.googleEmail !== undefined) setGoogleEmail(data.googleEmail)

      const { data: logsData } = await supabase
        .from('system_activities')
        .select('*')
        .order('created_at', { ascending: false })
      if (logsData) setAuditLogs(logsData)
    } catch (err) {
      console.error('Error loading settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async (channel: 'email' | 'whatsapp' | 'sms') => {
    setTestingChannel(channel)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      let provider = ''
      let credentials: Record<string, any> = {}

      if (channel === 'email') {
        provider = comm.emailProvider || 'smtp'
        if (provider === 'smtp') {
          credentials = {
            smtpHost: comm.smtpHost,
            smtpPort: comm.smtpPort,
            smtpUser: comm.smtpUser,
            smtpPass: comm.smtpPass
          }
        } else if (provider === 'resend') {
          credentials = { resendApiKey: comm.resendApiKey }
        } else if (provider === 'sendgrid') {
          credentials = { sendgridApiKey: comm.sendgridApiKey }
        }
      } else if (channel === 'whatsapp') {
        provider = comm.waProvider || 'meta'
        if (provider === 'meta') {
          credentials = {
            waToken: comm.waToken,
            waPhoneId: comm.waPhoneId
          }
        } else if (provider === 'twilio') {
          credentials = {
            twilioWaSid: comm.twilioWaSid,
            twilioWaToken: comm.twilioWaToken
          }
        }
      } else if (channel === 'sms') {
        provider = (comm.smsProvider || 'MSG91').toLowerCase()
        if (provider === 'twilio') {
          credentials = {
            twilioAccountSid: comm.twilioAccountSid,
            twilioAuthToken: comm.twilioAuthToken
          }
        } else if (provider === 'msg91') {
          credentials = { msg91Authkey: comm.msg91Authkey }
        } else if (provider === 'textlocal') {
          credentials = { textlocalApiKey: comm.textlocalApiKey }
        }
      }

      const res = await fetch('/api/settings/test-connection', {
        method: 'POST',
        headers,
        body: JSON.stringify({ channel, provider, credentials })
      })

      const data = await res.json()
      if (data.success) {
        toast({ title: '✅ Connection Successful!', description: data.message })
      } else {
        toast({ title: '❌ Connection Failed', description: data.error, variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: 'Error testing connection', description: err.message, variant: 'destructive' })
    } finally {
      setTestingChannel(null)
    }
  }

  const handleDisconnectGoogle = async () => {
    setDisconnecting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch('/api/google/disconnect', { method: 'POST', headers })
      if (res.ok) {
        setIsGoogleConnected(false)
        toast({ title: 'Disconnected', description: 'Google Calendar has been disconnected.' })
      } else {
        const err = await res.json()
        throw new Error(err.error || 'Failed to disconnect')
      }
    } catch (err: any) {
      toast({ title: 'Error disconnecting Google', description: err.message, variant: 'destructive' })
    } finally {
      setDisconnecting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify({ company, founder, bank, comm, ai, docs, payment }),
      })
      if (!res.ok) throw new Error('Save failed')
      
      // Log audit trail
      await supabase.from('system_activities').insert({
        user_name: session?.user?.email || 'System',
        action: 'Company and system settings updated',
        module: 'system'
      })

      setSaved(true)
      toast({ title: '✅ Settings Saved!', description: 'All PDF documents will use the updated company info.' })
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      toast({ title: 'Error saving settings', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Configure company details, banking, integrations, and AI. All PDFs use these settings.
          </p>
        </div>
        <Button
          variant={saved ? 'secondary' : 'gold'}
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="gap-1.5 w-full sm:w-auto"
        >
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
          ) : saved ? (
            <><CheckCircle2 className="h-4 w-4" />Saved!</>
          ) : (
            <><Save className="h-4 w-4" />Save All Settings</>
          )}
        </Button>
      </div>

      <div className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-4 py-3">
        <span className="font-semibold text-gold">📄 PDF Integration:</span> Company name, phone, email, and GST filled here are automatically printed on every PDF document (Quotations, Invoices, SOW, Agreements, etc.).
      </div>

      <Tabs value={defaultTab} onValueChange={setDefaultTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="company" className="gap-1.5"><Building2 className="h-3.5 w-3.5" />Company</TabsTrigger>
          <TabsTrigger value="founder" className="gap-1.5"><User className="h-3.5 w-3.5" />Founder</TabsTrigger>
          <TabsTrigger value="bank" className="gap-1.5"><CreditCard className="h-3.5 w-3.5" />Banking</TabsTrigger>
          <TabsTrigger value="payment" className="gap-1.5"><CreditCard className="h-3.5 w-3.5" />Payment Gateway</TabsTrigger>
          <TabsTrigger value="docs" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Documents & Billing</TabsTrigger>
          <TabsTrigger value="comms" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" />Communications</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5"><Cpu className="h-3.5 w-3.5" />AI Engine</TabsTrigger>
          <TabsTrigger value="branding" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" />Branding</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><Shield className="h-3.5 w-3.5" />Security & Backup</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="h-3.5 w-3.5" />Notifications</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><History className="h-3.5 w-3.5" />Audit Logs</TabsTrigger>
        </TabsList>

        {/* ── COMPANY ────────────────────────────────── */}
        <TabsContent value="company">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-gold" />Company Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FieldRow label="Company Name" hint="Appears on all PDF documents">
                <Input value={company.name} onChange={e => setCompany({ ...company, name: e.target.value })} placeholder="Netgain Studio" />
              </FieldRow>
              <Separator />
              <FieldRow label="Business Email" hint="Shown in PDF footer">
                <Input type="email" value={company.email} onChange={e => setCompany({ ...company, email: e.target.value })} placeholder="hello@netgain.studio" />
              </FieldRow>
              <FieldRow label="Phone / WhatsApp" hint="Shown in PDF footer">
                <Input value={company.phone} onChange={e => setCompany({ ...company, phone: e.target.value })} placeholder="9347102347 | 9392469669" />
              </FieldRow>
              <FieldRow label="Website">
                <Input value={company.website} onChange={e => setCompany({ ...company, website: e.target.value })} placeholder="netgain.studio" />
              </FieldRow>
              <FieldRow label="Cal.com Booking URL" hint="Shown in the client portal so clients can book meetings directly">
                <Input value={company.calBookingUrl || ''} onChange={e => setCompany({ ...company, calBookingUrl: e.target.value })} placeholder="https://cal.com/your-handle/consultation" />
              </FieldRow>
              <Separator />
              <FieldRow label="GST Number" hint="Printed on invoices & quotations">
                <Input value={company.gst} onChange={e => setCompany({ ...company, gst: e.target.value })} placeholder="36AABCN1234D1Z1" />
              </FieldRow>
              <FieldRow label="PAN Number">
                <Input value={company.pan} onChange={e => setCompany({ ...company, pan: e.target.value })} placeholder="AABCN1234D" />
              </FieldRow>
              <Separator />
              <FieldRow label="Full Address" hint="Shown on formal documents">
                <Textarea className="resize-none h-16" value={company.address} onChange={e => setCompany({ ...company, address: e.target.value })} placeholder="Street, City, State — PIN" />
              </FieldRow>
              <Separator />
              <ImageUploader label="Company Logo" field="logo" company={company} setCompany={setCompany} toast={toast} />
              <ImageUploader label="Company Stamp" field="stamp" company={company} setCompany={setCompany} toast={toast} />
              <ImageUploader label="Authorized Signature" field="signature" company={company} setCompany={setCompany} toast={toast} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── FOUNDER ────────────────────────────────── */}
        <TabsContent value="founder">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4 text-gold" />Founder Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FieldRow label="Full Name"><Input value={founder.name} onChange={e => setFounder({ ...founder, name: e.target.value })} /></FieldRow>
              <FieldRow label="Designation"><Input value={founder.designation} onChange={e => setFounder({ ...founder, designation: e.target.value })} /></FieldRow>
              <FieldRow label="Email"><Input type="email" value={founder.email} onChange={e => setFounder({ ...founder, email: e.target.value })} /></FieldRow>
              <FieldRow label="Phone"><Input value={founder.phone} onChange={e => setFounder({ ...founder, phone: e.target.value })} /></FieldRow>
              <Separator />
              <FieldRow label="Personal Signature"><Button variant="outline" size="sm" className="gap-1.5"><Upload className="h-3.5 w-3.5" />Upload Signature</Button></FieldRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BANKING ────────────────────────────────── */}
        <TabsContent value="bank">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4 text-gold" />Banking & Payment Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">These details are printed on Invoice PDFs under the Payment Instructions section.</p>
              <FieldRow label="Account Name"><Input value={bank.accountName} onChange={e => setBank({ ...bank, accountName: e.target.value })} /></FieldRow>
              <FieldRow label="Account Number"><Input value={bank.accountNumber} onChange={e => setBank({ ...bank, accountNumber: e.target.value })} placeholder="1234567890123" /></FieldRow>
              <FieldRow label="IFSC Code"><Input value={bank.ifsc} onChange={e => setBank({ ...bank, ifsc: e.target.value })} placeholder="HDFC0001234" /></FieldRow>
              <FieldRow label="Bank Name"><Input value={bank.bank} onChange={e => setBank({ ...bank, bank: e.target.value })} /></FieldRow>
              <Separator />
              <FieldRow label="UPI ID"><Input value={bank.upiId} onChange={e => setBank({ ...bank, upiId: e.target.value })} placeholder="netgain@hdfc" /></FieldRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── DOCUMENTS ──────────────────────────────── */}
        <TabsContent value="docs">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-gold" />Document Policies & Terms</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">Configure standard clauses, terms, and conditions that will automatically appear at the bottom of generated PDFs (Quotations, Agreements, Invoices).</p>
              <FieldRow label="Brand Tagline" hint="Appears under company name in Header & Footer">
                <Input value={docs.tagline} onChange={e => setDocs({ ...docs, tagline: e.target.value })} placeholder="Your Growth Partner, Powered by AI" />
              </FieldRow>
              <FieldRow label="Quotation Validity" hint="In Days">
                <div className="flex items-center gap-2">
                  <Input className="w-24" type="number" value={docs.quotationValidity} onChange={e => setDocs({ ...docs, quotationValidity: e.target.value })} placeholder="14" />
                  <span className="text-sm text-muted-foreground">Days</span>
                </div>
              </FieldRow>
              <Separator />
              <FieldRow label="One-Time Payment Terms">
                <Textarea className="resize-none" rows={2} value={docs.paymentTermsOneTime} onChange={e => setDocs({ ...docs, paymentTermsOneTime: e.target.value })} placeholder="50% advance to begin, 50% balance on final delivery" />
              </FieldRow>
              <FieldRow label="Monthly Payment Terms">
                <Textarea className="resize-none" rows={2} value={docs.paymentTermsMonthly} onChange={e => setDocs({ ...docs, paymentTermsMonthly: e.target.value })} placeholder="Full monthly fee payable in advance each cycle" />
              </FieldRow>
              <FieldRow label="GST Rate">
                <div className="flex items-center gap-2">
                  <Input className="w-24" type="number" value={docs.gstRate} onChange={e => setDocs({ ...docs, gstRate: e.target.value })} placeholder="18" />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </FieldRow>
              <FieldRow label="TDS Rate">
                <div className="flex items-center gap-2">
                  <Input className="w-24" type="number" value={(docs as any).taxRateTDS || '10'} onChange={e => setDocs({ ...docs, taxRateTDS: e.target.value })} placeholder="10" />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </FieldRow>
              <Separator />
              <div className="space-y-4 pb-2 border-b border-border/40">
                <div>
                  <Label className="text-sm font-semibold text-gold">Document Numbering Prefixes</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5 font-normal">Configure prefixes for generating invoice, quotation, agreement, and SOW references.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Quotation Prefix</Label>
                    <Input value={(docs as any).quotationPrefix || 'QT-'} onChange={e => setDocs({ ...docs, quotationPrefix: e.target.value })} placeholder="QT-" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Invoice Prefix</Label>
                    <Input value={(docs as any).invoicePrefix || 'INV-'} onChange={e => setDocs({ ...docs, invoicePrefix: e.target.value })} placeholder="INV-" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">SOW Prefix</Label>
                    <Input value={(docs as any).sowPrefix || 'SOW-'} onChange={e => setDocs({ ...docs, sowPrefix: e.target.value })} placeholder="SOW-" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Agreement Prefix</Label>
                    <Input value={(docs as any).agreementPrefix || 'AGR-'} onChange={e => setDocs({ ...docs, agreementPrefix: e.target.value })} placeholder="AGR-" />
                  </div>
                </div>
              </div>
              <Separator />
              <FieldRow label="Agreement Payment Schedule" hint="One schedule point per line. Used in Agreements.">
                <Textarea className="min-h-24" value={docs.paymentSchedule} onChange={e => setDocs({ ...docs, paymentSchedule: e.target.value })} placeholder="- 50% advance payment to commence work&#10;- Remaining balance due upon project completion / monthly for retainers&#10;- All amounts are exclusive of applicable GST" />
              </FieldRow>
              <Separator />
              <FieldRow label="Additional Custom Terms" hint="One term per line. These will appear as bullet points.">
                <Textarea className="min-h-32" value={docs.extraTerms} onChange={e => setDocs({ ...docs, extraTerms: e.target.value })} placeholder="Intellectual property will be transferred upon final payment.&#10;Support covers bug fixes for 30 days post-launch." />
              </FieldRow>
              <Separator />
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold text-gold">Invoice PDF Template Config</Label>
                  <p className="text-xs text-muted-foreground mt-1">Configure the custom content rendered specifically on Invoice PDFs.</p>
                </div>
                <FieldRow label="Invoice Terms & Conditions" hint="One term per line. Replaces default payment policy.">
                  <Textarea className="min-h-24" value={(docs as any).invoiceTerms || ''} onChange={e => setDocs({ ...docs, invoiceTerms: e.target.value })} placeholder="Payment is due within 10 days..." />
                </FieldRow>
                <FieldRow label="Default Invoice Notes" hint="Pre-filled when creating new invoices.">
                  <Textarea className="resize-none h-16" value={(docs as any).invoiceNotes || ''} onChange={e => setDocs({ ...docs, invoiceNotes: e.target.value })} placeholder="Thank you for your business!" />
                </FieldRow>
                <FieldRow label="Payment Instructions" hint="E.g. banking instructions, UPI details.">
                  <Textarea className="resize-none h-16" value={(docs as any).invoicePaymentInstructions || ''} onChange={e => setDocs({ ...docs, invoicePaymentInstructions: e.target.value })} placeholder="Please transfer the payment to our bank account..." />
                </FieldRow>
                <FieldRow label="Invoice Footer Override" hint="Appears at the bottom of invoice pages.">
                  <Input value={(docs as any).invoiceFooter || ''} onChange={e => setDocs({ ...docs, invoiceFooter: e.target.value })} placeholder="Netgain Studio | hello@netgain.studio" />
                </FieldRow>
                <FieldRow label="Additional Invoice Text" hint="Optional text block rendered on the invoice.">
                  <Textarea className="min-h-20" value={(docs as any).invoiceAdditionalText || ''} onChange={e => setDocs({ ...docs, invoiceAdditionalText: e.target.value })} placeholder="E.g. GST registration details..." />
                </FieldRow>
              </div>
              <Separator />
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold text-gold">Quotation Payment Schedules</Label>
                  <p className="text-xs text-muted-foreground mt-1">Define the standard payment schedule splits (e.g. 50/50) you can choose from when creating a Quotation. The UI will calculate the amounts automatically.</p>
                </div>
                {docs.paymentSchedules?.map((schedule, sIdx) => (
                  <div key={schedule.id} className="border border-border rounded-lg p-4 bg-muted/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <Input className="font-semibold max-w-[200px] h-8" value={schedule.name} onChange={e => {
                        const newSchedules = [...docs.paymentSchedules];
                        newSchedules[sIdx].name = e.target.value;
                        setDocs({ ...docs, paymentSchedules: newSchedules });
                      }} placeholder="Schedule Name" />
                      {docs.paymentSchedules.length > 1 && (
                        <Button variant="ghost" size="sm" className="h-8 text-red-400 hover:text-red-400" onClick={() => {
                          const newSchedules = [...docs.paymentSchedules];
                          newSchedules.splice(sIdx, 1);
                          setDocs({ ...docs, paymentSchedules: newSchedules });
                        }}>Remove</Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {schedule.points.map((pt: any, pIdx: number) => (
                        <div key={pIdx} className="flex gap-2 items-center">
                          <Input className="h-8" value={pt.label} onChange={e => {
                            const newSchedules = [...docs.paymentSchedules];
                            newSchedules[sIdx].points[pIdx].label = e.target.value;
                            setDocs({ ...docs, paymentSchedules: newSchedules });
                          }} placeholder="e.g. Advance to begin" />
                          <div className="flex items-center gap-1 shrink-0 w-24">
                            <Input type="number" className="h-8 text-right" value={pt.pct} onChange={e => {
                              const newSchedules = [...docs.paymentSchedules];
                              newSchedules[sIdx].points[pIdx].pct = Number(e.target.value);
                              setDocs({ ...docs, paymentSchedules: newSchedules });
                            }} />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                          <Button variant="ghost" size="icon" aria-label="Action" className="h-8 w-8 text-muted-foreground hover:text-red-400 shrink-0" onClick={() => {
                            const newSchedules = [...docs.paymentSchedules];
                            newSchedules[sIdx].points.splice(pIdx, 1);
                            setDocs({ ...docs, paymentSchedules: newSchedules });
                          }}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="h-7 text-xs border-dashed w-full" onClick={() => {
                        const newSchedules = [...docs.paymentSchedules];
                        newSchedules[sIdx].points.push({ label: 'New Milestone', pct: 0 });
                        setDocs({ ...docs, paymentSchedules: newSchedules });
                      }}>+ Add Milestone</Button>
                    </div>
                    <div className="text-xs text-right mt-1 text-muted-foreground">
                      Total: <span className={schedule.points.reduce((sum: number, p: any) => sum + Number(p.pct), 0) === 100 ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
                        {schedule.points.reduce((sum: number, p: any) => sum + Number(p.pct), 0)}%
                      </span>
                    </div>
                  </div>
                ))}
                {(!docs.paymentSchedules || docs.paymentSchedules.length < 3) && (
                  <Button variant="outline" size="sm" className="border-dashed w-full gap-2 text-gold hover:text-gold" onClick={() => {
                    setDocs({
                      ...docs, 
                      paymentSchedules: [...(docs.paymentSchedules || []), { id: String(Date.now()), name: 'New Schedule', points: [{ label: 'Advance', pct: 100 }] }]
                    });
                  }}><Plus className="h-4 w-4" /> Add Payment Schedule</Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── COMMUNICATIONS ─────────────────────────── */}
        <TabsContent value="comms">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gold" />
                  Communication Hub Credentials
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                Configure outgoing channels (SMTP/Resend/SendGrid, Meta/Twilio WhatsApp, and SMS) and sync scheduled calendar events.
              </p>

              {/* Email Configuration */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <p className="text-xs font-semibold text-gold">📧 Email Provider</p>
                  <Select
                    value={comm.emailProvider || 'smtp'}
                    onValueChange={(val) => setComm({ ...comm, emailProvider: val })}
                  >
                    <SelectTrigger className="w-40 h-8">
                      <SelectValue placeholder="Select Email" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="smtp">SMTP Relay</SelectItem>
                      <SelectItem value="resend">Resend API</SelectItem>
                      <SelectItem value="sendgrid">SendGrid API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  {/* From Name and From Email apply to all email providers */}
                  <FieldRow label="From Name" hint="Appears in recipient's inbox">
                    <Input
                      placeholder="Netgain Studio"
                      value={(comm as any).fromName || ''}
                      onChange={(e) => setComm({ ...comm, fromName: e.target.value } as any)}
                    />
                  </FieldRow>
                  <FieldRow label="From Email" hint={comm.emailProvider === 'resend' ? "Must be from a verified domain in Resend dashboard" : "Sender email address"}>
                    <Input
                      type="email"
                      placeholder="noreply@yourdomain.com"
                      value={(comm as any).fromEmail || ''}
                      onChange={(e) => setComm({ ...comm, fromEmail: e.target.value } as any)}
                    />
                  </FieldRow>
                  {comm.emailProvider === 'resend' && (
                    <div className="text-[11px] text-amber-400/80 bg-amber-500/10 rounded-lg p-2.5 border border-amber-500/20">
                      ⚠️ <strong>Resend:</strong> The &quot;From Email&quot; must use a domain verified in your <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline text-amber-400">Resend dashboard</a>. For testing, use <code>onboarding@resend.dev</code> to send only to your own email.
                    </div>
                  )}
                  {(comm.emailProvider === 'smtp' || !comm.emailProvider) && (
                    <>
                      <FieldRow label="SMTP Host">
                        <Input
                          placeholder="smtp.gmail.com"
                          value={comm.smtpHost || ''}
                          onChange={(e) => setComm({ ...comm, smtpHost: e.target.value })}
                        />
                      </FieldRow>
                      <FieldRow label="SMTP Port">
                        <Input
                          placeholder="587"
                          value={comm.smtpPort || ''}
                          onChange={(e) => setComm({ ...comm, smtpPort: e.target.value })}
                        />
                      </FieldRow>
                      <FieldRow label="Username / Email">
                        <Input
                          placeholder="noreply@netgain.studio"
                          value={comm.smtpUser || ''}
                          onChange={(e) => setComm({ ...comm, smtpUser: e.target.value })}
                        />
                      </FieldRow>
                      <FieldRow label="App Password">
                        <SecretField
                          id="smtp"
                          value={comm.smtpPass || ''}
                          onChange={(v) => setComm({ ...comm, smtpPass: v })}
                          placeholder="SMTP password / app credential"
                          showKey={showKey}
                          setShowKey={setShowKey}
                        />
                      </FieldRow>
                    </>
                  )}

                  {comm.emailProvider === 'resend' && (
                    <FieldRow label="Resend API Key">
                      <SecretField
                        id="resend"
                        value={comm.resendApiKey || ''}
                        onChange={(v) => setComm({ ...comm, resendApiKey: v })}
                        placeholder="re_..."
                        showKey={showKey}
                        setShowKey={setShowKey}
                      />
                    </FieldRow>
                  )}

                  {comm.emailProvider === 'sendgrid' && (
                    <FieldRow label="SendGrid API Key">
                      <SecretField
                        id="sendgrid"
                        value={comm.sendgridApiKey || ''}
                        onChange={(v) => setComm({ ...comm, sendgridApiKey: v })}
                        placeholder="SG...."
                        showKey={showKey}
                        setShowKey={setShowKey}
                      />
                    </FieldRow>
                  )}

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection('email')}
                      disabled={testingChannel === 'email'}
                      className="text-xs h-8"
                    >
                      {testingChannel === 'email' && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                      Test Email Connection
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* WhatsApp Configuration */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <p className="text-xs font-semibold text-gold">💬 WhatsApp Provider</p>
                  <Select
                    value={comm.waProvider || 'meta'}
                    onValueChange={(val) => setComm({ ...comm, waProvider: val })}
                  >
                    <SelectTrigger className="w-40 h-8">
                      <SelectValue placeholder="Select WhatsApp" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meta">Meta Cloud API</SelectItem>
                      <SelectItem value="twilio">Twilio WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  {(comm.waProvider === 'meta' || !comm.waProvider) && (
                    <>
                      <FieldRow label="Access Token" hint="Permanent Meta system user token">
                        <SecretField
                          id="wa"
                          value={comm.waToken || ''}
                          onChange={(v) => setComm({ ...comm, waToken: v })}
                          placeholder="EAAx..."
                          showKey={showKey}
                          setShowKey={setShowKey}
                        />
                      </FieldRow>
                      <FieldRow label="Phone Number ID">
                        <Input
                          placeholder="104856..."
                          value={comm.waPhoneId || ''}
                          onChange={(e) => setComm({ ...comm, waPhoneId: e.target.value })}
                        />
                      </FieldRow>
                    </>
                  )}

                  {comm.waProvider === 'twilio' && (
                    <>
                      <FieldRow label="Twilio Account SID">
                        <Input
                          placeholder="AC..."
                          value={(comm as any).twilioWaSid || ''}
                          onChange={(e) => setComm({ ...comm, twilioWaSid: e.target.value } as any)}
                        />
                      </FieldRow>
                      <FieldRow label="Twilio WhatsApp Token">
                        <SecretField
                          id="twilioWaToken"
                          value={(comm as any).twilioWaToken || ''}
                          onChange={(v) => setComm({ ...comm, twilioWaToken: v } as any)}
                          placeholder="Auth Token"
                          showKey={showKey}
                          setShowKey={setShowKey}
                        />
                      </FieldRow>
                    </>
                  )}

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection('whatsapp')}
                      disabled={testingChannel === 'whatsapp'}
                      className="text-xs h-8"
                    >
                      {testingChannel === 'whatsapp' && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                      Test WhatsApp Connection
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* SMS Configuration */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <p className="text-xs font-semibold text-gold">📱 SMS Provider</p>
                  <Select
                    value={comm.smsProvider || 'MSG91'}
                    onValueChange={(val) => setComm({ ...comm, smsProvider: val })}
                  >
                    <SelectTrigger className="w-40 h-8">
                      <SelectValue placeholder="Select SMS" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MSG91">MSG91</SelectItem>
                      <SelectItem value="Twilio">Twilio</SelectItem>
                      <SelectItem value="TextLocal">TextLocal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  {comm.smsProvider === 'MSG91' && (
                    <>
                      <FieldRow label="MSG91 Authkey">
                        <SecretField
                          id="msg91"
                          value={(comm as any).msg91Authkey || ''}
                          onChange={(v) => setComm({ ...comm, msg91Authkey: v } as any)}
                          placeholder="Authkey"
                          showKey={showKey}
                          setShowKey={setShowKey}
                        />
                      </FieldRow>
                      <FieldRow label="MSG91 Template ID">
                        <Input
                          placeholder="Template ID"
                          value={(comm as any).msg91TemplateId || ''}
                          onChange={(e) => setComm({ ...comm, msg91TemplateId: e.target.value } as any)}
                        />
                      </FieldRow>
                    </>
                  )}

                  {comm.smsProvider === 'Twilio' && (
                    <>
                      <FieldRow label="Account SID">
                        <Input
                          placeholder="AC..."
                          value={(comm as any).twilioAccountSid || ''}
                          onChange={(e) => setComm({ ...comm, twilioAccountSid: e.target.value } as any)}
                        />
                      </FieldRow>
                      <FieldRow label="Auth Token">
                        <SecretField
                          id="twilio"
                          value={(comm as any).twilioAuthToken || ''}
                          onChange={(v) => setComm({ ...comm, twilioAuthToken: v } as any)}
                          placeholder="Auth Token"
                          showKey={showKey}
                          setShowKey={setShowKey}
                        />
                      </FieldRow>
                    </>
                  )}

                  {comm.smsProvider === 'TextLocal' && (
                    <FieldRow label="TextLocal API Key">
                      <SecretField
                        id="textlocal"
                        value={(comm as any).textlocalApiKey || ''}
                        onChange={(v) => setComm({ ...comm, textlocalApiKey: v } as any)}
                        placeholder="API Key"
                        showKey={showKey}
                        setShowKey={setShowKey}
                      />
                    </FieldRow>
                  )}

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection('sms')}
                      disabled={testingChannel === 'sms'}
                      className="text-xs h-8"
                    >
                      {testingChannel === 'sms' && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                      Test SMS Connection
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Google Workspace Calendar OAuth Card */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <p className="text-xs font-semibold text-gold">📅 Google Workspace Calendar Connection</p>
                  {isGoogleConnected ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="h-3 w-3" /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">
                      Disconnected
                    </span>
                  )}
                </div>

                <div className="bg-muted/10 border border-border/50 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">Sync Meetings & Schedule Events</p>
                    <p className="text-[11px] text-muted-foreground max-w-md">
                      Connect your organization's Google Calendar. This enables bi-directional synchronization of Cal.com appointments, Google Meet generation, and meeting details mapping directly into the dashboard.
                    </p>
                    {isGoogleConnected && googleEmail && (
                      <p className="text-[11px] text-emerald-400/90 font-medium pt-1">
                        Connected Account: <span className="font-semibold text-emerald-400">{googleEmail}</span>
                      </p>
                    )}
                  </div>
                  <div>
                    {isGoogleConnected ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disconnecting}
                        onClick={handleDisconnectGoogle}
                        className="text-xs text-red-400 hover:text-red-400 h-9 shrink-0 gap-1.5"
                      >
                        {disconnecting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Unlink className="h-3.5 w-3.5" />
                        )}
                        Disconnect Google
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="gold"
                        size="sm"
                        onClick={async () => {
                          const { data: { session } } = await supabase.auth.getSession()
                          window.location.href = `/api/google/auth?token=${session?.access_token || ''}`
                        }}
                        className="text-xs h-9 shrink-0 gap-1.5 font-medium"
                      >
                        <Link className="h-3.5 w-3.5" />
                        Connect Google Calendar
                      </Button>
                    )}
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AI ENGINE ──────────────────────────────── */}
        <TabsContent value="ai">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Cpu className="h-4 w-4 text-gold" />AI Engine Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">AI powers PRD generation, project planning, and marketing analysis. Keys are stored locally and never shared.</p>
              <FieldRow label="Default Provider">
                <Select value={ai.defaultProvider} onValueChange={v => setAi({ ...ai, defaultProvider: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude">Claude (Anthropic)</SelectItem>
                    <SelectItem value="openai">GPT-4 (OpenAI)</SelectItem>
                    <SelectItem value="gemini">Gemini (Google)</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <Separator />
              <FieldRow label="Claude API Key" hint="Anthropic">
                <SecretField id="claude" value={ai.claudeKey} onChange={v => setAi({ ...ai, claudeKey: v })} placeholder="sk-ant-..." showKey={showKey} setShowKey={setShowKey} />
              </FieldRow>
              <FieldRow label="OpenAI API Key" hint="ChatGPT / GPT-4">
                <SecretField id="openai" value={ai.openaiKey} onChange={v => setAi({ ...ai, openaiKey: v })} placeholder="sk-..." showKey={showKey} setShowKey={setShowKey} />
              </FieldRow>
              <FieldRow label="Gemini API Key" hint="Google AI">
                <SecretField id="gemini" value={ai.geminiKey} onChange={v => setAi({ ...ai, geminiKey: v })} placeholder="AIza..." showKey={showKey} setShowKey={setShowKey} />
              </FieldRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BRANDING ──────────────────────────────── */}
        <TabsContent value="branding">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-gold" />Brand Aesthetics & Identity</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">Customize the UI theme colors and portal aesthetics to align with your organization branding.</p>
              <FieldRow label="Primary Accent Color" hint="Used for active states, borders, and buttons">
                <div className="flex items-center gap-3">
                  <Input type="color" className="w-12 h-9 p-0.5 border cursor-pointer rounded" value={company.primaryColor || '#D4AF37'} onChange={e => setCompany({ ...company, primaryColor: e.target.value })} />
                  <Input className="w-36" value={company.primaryColor || '#D4AF37'} onChange={e => setCompany({ ...company, primaryColor: e.target.value })} placeholder="#D4AF37" />
                </div>
              </FieldRow>
              <FieldRow label="Secondary Slate Color" hint="Used for layouts, panels, and dark surfaces">
                <div className="flex items-center gap-3">
                  <Input type="color" className="w-12 h-9 p-0.5 border cursor-pointer rounded" value={company.secondaryColor || '#1A1A1A'} onChange={e => setCompany({ ...company, secondaryColor: e.target.value })} />
                  <Input className="w-36" value={company.secondaryColor || '#1A1A1A'} onChange={e => setCompany({ ...company, secondaryColor: e.target.value })} placeholder="#1A1A1A" />
                </div>
              </FieldRow>
              <Separator />
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-gold">Live Action Preview</Label>
                <div className="p-4 rounded-lg bg-card/60 border border-border flex flex-wrap gap-3 items-center">
                  <Button style={{ backgroundColor: company.primaryColor || '#D4AF37', color: '#000' }} className="h-9 text-xs font-bold">Primary Button</Button>
                  <Button variant="outline" className="h-9 text-xs border-gold/45 text-gold">Outline Button</Button>
                  <span className="text-xs text-muted-foreground">Sample Typography and Link styling</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SECURITY & BACKUPS ─────────────────────── */}
        <TabsContent value="security">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-gold" />Security & Storage Management</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">Hardening settings, access guards, rate-limiting variables, and manual storage backups.</p>
              
              <FieldRow label="Password Complexity" hint="Sets strength constraints for new users">
                <Select value={company.passwordPolicy || 'strong'} onValueChange={v => setCompany({ ...company, passwordPolicy: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (Min 6 chars)</SelectItem>
                    <SelectItem value="strong">Strong (Min 8 chars, numbers & uppercase)</SelectItem>
                    <SelectItem value="enterprise">Enterprise (Min 12 chars, special characters)</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>

              <FieldRow label="API Rate Limiting" hint="Maximum Requests Per Second (RPS) per user">
                <div className="flex items-center gap-2">
                  <Input type="number" className="w-28" value={company.rateLimitRps || '10'} onChange={e => setCompany({ ...company, rateLimitRps: e.target.value })} placeholder="10" />
                  <span className="text-xs text-muted-foreground">Requests/sec</span>
                </div>
              </FieldRow>

              <FieldRow label="Backup Schedule Frequency" hint="Saves system settings logs to Supabase buckets">
                <Select value={company.backupFrequency || 'daily'} onValueChange={v => setCompany({ ...company, backupFrequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Backup Only</SelectItem>
                    <SelectItem value="daily">Daily Automatic Backup</SelectItem>
                    <SelectItem value="weekly">Weekly Automatic Backup</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>

              <Separator />
              
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-gold">Supabase System Access (Credentials)</Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Allows automated migrations and background backups from node clients.</p>
                </div>
                <FieldRow label="Supabase Project URL">
                  <Input value={comm.supabaseUrl || ''} onChange={e => setComm({ ...comm, supabaseUrl: e.target.value })} placeholder="https://your-project.supabase.co" />
                </FieldRow>
                <FieldRow label="Supabase Anon Key">
                  <SecretField id="supabaseAnon" value={comm.supabaseAnonKey || ''} onChange={v => setComm({ ...comm, supabaseAnonKey: v })} placeholder="eyJhbG..." showKey={showKey} setShowKey={setShowKey} />
                </FieldRow>
                <FieldRow label="Supabase Service Role Key">
                  <SecretField id="supabaseService" value={comm.supabaseServiceKey || ''} onChange={v => setComm({ ...comm, supabaseServiceKey: v })} placeholder="eyJhbG..." showKey={showKey} setShowKey={setShowKey} />
                </FieldRow>
              </div>

              <Separator />

              <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20 space-y-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-red-400">🚨 Disaster Recovery Backup Tool</p>
                  <p className="text-[10px] text-muted-foreground">Compile and download a full JSON copy of all local configurations, preferences, billing rates, and credentials.</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => {
                  const backupObj = { company, founder, bank, comm, ai, docs }
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2))
                  const downloadAnchor = document.createElement('a')
                  downloadAnchor.setAttribute("href", dataStr)
                  downloadAnchor.setAttribute("download", `nbos_system_backup_${new Date().toISOString().slice(0,10)}.json`)
                  document.body.appendChild(downloadAnchor)
                  downloadAnchor.click()
                  downloadAnchor.remove()
                  toast({ title: "Backup Exported", description: "System configuration JSON file downloaded successfully." })
                }}>
                  Trigger System Backup Export
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── NOTIFICATIONS CONFIG ─────────────────── */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Bell className="h-4 w-4 text-gold" />Notification Channels & Rules</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">Select which actions trigger real-time notification logs and email alerts to team leads.</p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">User Activity Toggles</Label>
                    <p className="text-[10px] text-muted-foreground">Record login successes and logout audit trails.</p>
                  </div>
                  <Input type="checkbox" className="h-4 w-4 cursor-pointer accent-gold" checked={company.notifyOnLogin} onChange={e => setCompany({ ...company, notifyOnLogin: e.target.checked })} />
                </div>

                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Billing & Invoices Toggles</Label>
                    <p className="text-[10px] text-muted-foreground">Record activities when invoices are paid, overdue, or drafted.</p>
                  </div>
                  <Input type="checkbox" className="h-4 w-4 cursor-pointer accent-gold" checked={company.notifyOnInvoice} onChange={e => setCompany({ ...company, notifyOnInvoice: e.target.checked })} />
                </div>

                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Project Deliverables Toggles</Label>
                    <p className="text-[10px] text-muted-foreground">Record activities on delays, milestones, and requirement uploads.</p>
                  </div>
                  <Input type="checkbox" className="h-4 w-4 cursor-pointer accent-gold" checked={company.notifyOnProject} onChange={e => setCompany({ ...company, notifyOnProject: e.target.checked })} />
                </div>

                <div className="flex items-center justify-between pb-2">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Support Tickets Toggles</Label>
                    <p className="text-[10px] text-muted-foreground">Record activities on customer support issues creations or closures.</p>
                  </div>
                  <Input type="checkbox" className="h-4 w-4 cursor-pointer accent-gold" checked={company.notifyOnSupport} onChange={e => setCompany({ ...company, notifyOnSupport: e.target.checked })} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AUDIT LOGS ──────────────────────────────── */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4 text-gold" />Enterprise Security Audit Trail</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">A complete chronological history of system activity, security incidents, and CRUD operations.</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="text-xs gap-1.5 h-8 font-medium" onClick={() => {
                  const headers = ["ID", "User / Actor", "Action Triggered", "Module Affected", "Timestamp"]
                  const rows = auditLogs.map(l => [l.id, l.user_name, l.action, l.module, l.created_at])
                  const csvContent = "data:text/csv;charset=utf-8," 
                    + [headers.join(','), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n')
                  const encodedUri = encodeURI(csvContent)
                  const downloadAnchor = document.createElement('a')
                  downloadAnchor.setAttribute("href", encodedUri)
                  downloadAnchor.setAttribute("download", `nbos_security_audit_logs_${new Date().toISOString().slice(0,10)}.csv`)
                  document.body.appendChild(downloadAnchor)
                  downloadAnchor.click()
                  downloadAnchor.remove()
                }}>
                  Export Logs CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="pl-9 text-xs h-8" placeholder="Search actors or actions..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)} />
                </div>
                <Select value={auditFilter} onValueChange={setAuditFilter}>
                  <SelectTrigger className="w-full sm:w-44 text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="all">All Modules</SelectItem>
                    <SelectItem value="system">System Alerts</SelectItem>
                    <SelectItem value="auth">Auth & Session</SelectItem>
                    <SelectItem value="crm">CRM Contacts</SelectItem>
                    <SelectItem value="projects">Projects</SelectItem>
                    <SelectItem value="documents">Documents</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="support">Support Tickets</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border border-border/60 overflow-hidden bg-card/25">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/20 border-b border-border/80 text-muted-foreground font-semibold">
                        <th className="py-2.5 px-3">Actor</th>
                        <th className="py-2.5 px-3">Action Description</th>
                        <th className="py-2.5 px-2">Module</th>
                        <th className="py-2.5 px-3 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {auditLogs
                        .filter(l => {
                          const matchesSearch = !auditSearch || 
                            l.user_name?.toLowerCase().includes(auditSearch.toLowerCase()) || 
                            l.action?.toLowerCase().includes(auditSearch.toLowerCase())
                          const matchesModule = auditFilter === 'all' || l.module === auditFilter
                          return matchesSearch && matchesModule
                        })
                        .map((log, idx) => (
                          <tr key={idx} className="hover:bg-muted/5 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-foreground truncate max-w-[120px]" title={log.user_name}>{log.user_name}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">{log.action}</td>
                            <td className="py-2.5 px-2 uppercase font-mono text-[9px] text-[#D4AF37]">{log.module}</td>
                            <td className="py-2.5 px-3 text-right text-muted-foreground/60">{new Date(log.created_at).toLocaleString('en-IN', { hour12: true, dateStyle: 'short', timeStyle: 'short' })}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PAYMENT GATEWAY ────────────────────────────────── */}
        <TabsContent value="payment">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4 text-gold" />Razorpay Integration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FieldRow label="Enable Razorpay" hint="Allow clients to pay invoices directly via Razorpay">
                <Select value={payment.razorpayEnabled ? 'true' : 'false'} onValueChange={(v) => setPayment({ ...payment, razorpayEnabled: v === 'true' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Enabled</SelectItem>
                    <SelectItem value="false">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <Separator />
              <FieldRow label="Environment" hint="Use Test for development, Live for production">
                <Select value={payment.razorpayMode} onValueChange={(v) => setPayment({ ...payment, razorpayMode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">Test Mode</SelectItem>
                    <SelectItem value="live">Live Mode</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Razorpay Key ID">
                <Input value={payment.razorpayKeyId} onChange={e => setPayment({ ...payment, razorpayKeyId: e.target.value })} placeholder="rzp_test_..." />
              </FieldRow>
              <FieldRow label="Razorpay Secret Key">
                <SecretField id="rzp_secret" value={payment.razorpaySecretKey} onChange={v => setPayment({ ...payment, razorpaySecretKey: v })} placeholder="secret_..." showKey={showKey} setShowKey={setShowKey} />
              </FieldRow>
              <FieldRow label="Webhook Secret" hint="Used to verify webhook events from Razorpay">
                <SecretField id="rzp_webhook" value={payment.razorpayWebhookSecret} onChange={v => setPayment({ ...payment, razorpayWebhookSecret: v })} placeholder="webhook_secret..." showKey={showKey} setShowKey={setShowKey} />
              </FieldRow>
              <FieldRow label="Currency">
                <Input value={payment.currency} onChange={e => setPayment({ ...payment, currency: e.target.value })} placeholder="INR" />
              </FieldRow>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bottom Save Button */}
      <div className="flex justify-end pb-8">
        <Button
          variant={saved ? 'secondary' : 'gold'}
          size="lg"
          onClick={handleSave}
          disabled={saving}
          className="gap-2"
        >
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
          ) : saved ? (
            <><CheckCircle2 className="h-4 w-4" />All Settings Saved!</>
          ) : (
            <><Save className="h-4 w-4" />Save All Settings</>
          )}
        </Button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageContent />
    </Suspense>
  )
}
