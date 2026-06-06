'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Save, Building2, User, CreditCard, MessageSquare, Cpu, Upload, Eye, EyeOff, CheckCircle2, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function SettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})

  const [company, setCompany] = useState({
    name: 'Netgain Studio',
    address: 'Hyderabad, Telangana, India',
    gst: '',
    pan: '',
    email: 'mail.netgain@gmail.com',
    website: 'netgain.studio',
    phone: '9347102347 | 9392469669',
    logo: '',
    stamp: '',
    signature: '',
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
    smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '',
    waToken: '', smsProvider: 'MSG91',
  })

  const [ai, setAi] = useState({
    claudeKey: '', openaiKey: '', geminiKey: '', defaultProvider: 'claude',
  })

  // Load saved settings on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.company)  setCompany(c => ({ ...c, ...data.company }))
        if (data.founder)  setFounder(f => ({ ...f, ...data.founder }))
        if (data.bank)     setBank(b => ({ ...b, ...data.bank }))
        if (data.comm)     setComm(c => ({ ...c, ...data.comm }))
        if (data.ai)       setAi(a => ({ ...a, ...data.ai }))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, founder, bank, comm, ai }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      toast({ title: '✅ Settings Saved!', description: 'All PDF documents will use the updated company info.' })
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      toast({ title: 'Error saving settings', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, key: 'logo' | 'stamp' | 'signature') => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setCompany(c => ({ ...c, [key]: base64 }))
      toast({ title: 'Image Uploaded', description: `${key} uploaded and updated locally.` })
    }
    reader.readAsDataURL(file)
  }

  const FieldRow = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
    <div className="grid grid-cols-3 items-start gap-4">
      <div className="mt-2">
        <Label className="text-sm">{label}</Label>
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="col-span-2">{children}</div>
    </div>
  )

  const ImageUploader = ({ label, field }: { label: string, field: 'logo' | 'stamp' | 'signature' }) => (
    <FieldRow label={label}>
      <div className="flex items-center gap-4">
        {company[field] && <img src={company[field]} alt={label} className="h-12 w-auto object-contain bg-white/5 p-1 rounded border border-border" />}
        <Label className="cursor-pointer">
          <Input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, field)} />
          <div className="flex h-9 items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground gap-1.5 cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            {company[field] ? 'Change ' + label : 'Upload ' + label}
          </div>
        </Label>
        {company[field] && <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-400 h-9" onClick={() => setCompany(c => ({ ...c, [field]: '' }))}>Remove</Button>}
      </div>
    </FieldRow>
  )

  const SecretField = ({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
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
          className="gap-1.5"
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

      <Tabs defaultValue="company">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="company" className="gap-1.5"><Building2 className="h-3.5 w-3.5" />Company</TabsTrigger>
          <TabsTrigger value="founder" className="gap-1.5"><User className="h-3.5 w-3.5" />Founder</TabsTrigger>
          <TabsTrigger value="bank" className="gap-1.5"><CreditCard className="h-3.5 w-3.5" />Banking</TabsTrigger>
          <TabsTrigger value="comms" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" />Communications</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5"><Cpu className="h-3.5 w-3.5" />AI Engine</TabsTrigger>
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
              <ImageUploader label="Company Logo" field="logo" />
              <ImageUploader label="Company Stamp" field="stamp" />
              <ImageUploader label="Authorized Signature" field="signature" />
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

        {/* ── COMMUNICATIONS ─────────────────────────── */}
        <TabsContent value="comms">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4 text-gold" />Communication Settings</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">Configure SMTP, WhatsApp, and SMS to enable live message sending from the Communications module.</p>

              <div>
                <p className="text-xs font-semibold text-gold mb-3">📧 SMTP Email (Outgoing)</p>
                <div className="space-y-3">
                  <FieldRow label="SMTP Host"><Input placeholder="smtp.gmail.com" value={comm.smtpHost} onChange={e => setComm({ ...comm, smtpHost: e.target.value })} /></FieldRow>
                  <FieldRow label="SMTP Port"><Input placeholder="587" value={comm.smtpPort} onChange={e => setComm({ ...comm, smtpPort: e.target.value })} /></FieldRow>
                  <FieldRow label="Username / Email"><Input placeholder="noreply@netgain.studio" value={comm.smtpUser} onChange={e => setComm({ ...comm, smtpUser: e.target.value })} /></FieldRow>
                  <FieldRow label="App Password"><SecretField id="smtp" value={comm.smtpPass} onChange={v => setComm({ ...comm, smtpPass: v })} placeholder="Gmail app password" /></FieldRow>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-semibold text-gold mb-3">💬 WhatsApp Business API (Meta Cloud)</p>
                <FieldRow label="Access Token"><SecretField id="wa" value={comm.waToken} onChange={v => setComm({ ...comm, waToken: v })} placeholder="EAAx..." /></FieldRow>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-semibold text-gold mb-3">📱 SMS Provider</p>
                <FieldRow label="Provider">
                  <Select value={comm.smsProvider} onValueChange={v => setComm({ ...comm, smsProvider: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MSG91">MSG91</SelectItem>
                      <SelectItem value="Twilio">Twilio</SelectItem>
                      <SelectItem value="TextLocal">TextLocal</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
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
                <SecretField id="claude" value={ai.claudeKey} onChange={v => setAi({ ...ai, claudeKey: v })} placeholder="sk-ant-..." />
              </FieldRow>
              <FieldRow label="OpenAI API Key" hint="ChatGPT / GPT-4">
                <SecretField id="openai" value={ai.openaiKey} onChange={v => setAi({ ...ai, openaiKey: v })} placeholder="sk-..." />
              </FieldRow>
              <FieldRow label="Gemini API Key" hint="Google AI">
                <SecretField id="gemini" value={ai.geminiKey} onChange={v => setAi({ ...ai, geminiKey: v })} placeholder="AIza..." />
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
