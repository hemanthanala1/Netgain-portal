'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, FileText, CheckCircle2, ChevronRight, Download, PenTool, Type, HelpCircle, Shield, AlertTriangle, User, Building2, Mail, Phone, Calendar, Clock, Globe, ShieldCheck } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export default function ClientSigningPortal({ params }: { params: { token: string } }) {
  const token = params.token
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [signedRecord, setSignedRecord] = useState<any>(null)
  const [pdfVersion, setPdfVersion] = useState(1)  // bumped after signing to force iframe reload
  
  // Document details states
  const [docToken, setDocToken] = useState<any>(null)
  const [document, setDocument] = useState<any>(null)
  const [signatureInfo, setSignatureInfo] = useState<any>(null)

  // Signing inputs
  const [clientName, setClientName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [readChecked, setReadChecked] = useState(false)
  const [agreeChecked, setAgreeChecked] = useState(false)
  
  // Signature Type selection
  const [sigType, setSigType] = useState<'draw' | 'type'>('draw')

  // Draw Signature Pad states
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawHistory, setDrawHistory] = useState<string[]>([])
  const [drawSaved, setDrawSaved] = useState(false)
  const [savedDrawData, setSavedDrawData] = useState<string | null>(null)

  // Type Signature states
  const [typeText, setTypeText] = useState('')
  const [selectedFont, setSelectedFont] = useState('DancingScript')
  const [typeSaved, setTypeSaved] = useState(false)

  // OTP Verification Method
  const [otpMethod, setOtpMethod] = useState('email')

  const { toast } = useToast()

  // Fonts available
  const fonts = [
    { name: 'Dancing Script', value: 'DancingScript', family: 'Dancing Script, cursive' },
    { name: 'Alex Brush', value: 'AlexBrush', family: 'Alex Brush, cursive' },
    { name: 'Sacramento', value: 'Sacramento', family: 'Sacramento, cursive' }
  ]

  const loadDocumentData = async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    try {
      // 1. Fetch token details
      const { data: tokenRecord, error: tokenError } = await supabase
        .from('document_tokens')
        .select('*')
        .eq('token', token)
        .maybeSingle()

      if (tokenError || !tokenRecord) {
        setLoading(false)
        return
      }

      if (tokenRecord.status === 'cancelled') {
        setDocToken({ error: 'This signing link has been cancelled by Netgain.' })
        setLoading(false)
        return
      }

      if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
        setDocToken({ error: 'This signing link has expired.' })
        setLoading(false)
        return
      }

      setDocToken(tokenRecord)

      // 2. Fetch primary document data
      const TABLE_MAP: Record<string, string> = {
        Quotation: 'quotations',
        Invoice: 'invoices',
        SOW: 'sows',
        Agreement: 'agreements',
        PRD: 'prds',
        Marketing: 'marketing_reports',
        Proposal: 'proposals',
        Contract: 'contracts'
      }

      const table = TABLE_MAP[tokenRecord.document_type]
      if (table) {
        const { data: docRecord } = await supabase
          .from(table)
          .select('*')
          .eq('id', tokenRecord.document_id)
          .maybeSingle()

        if (docRecord) {
          setDocument(docRecord)
          setClientName(docRecord.contact || '')
          setCompany(docRecord.client || '')
          setEmail(docRecord.email || '')
          setPhone(docRecord.phone || '')
          setTypeText(docRecord.contact || '')

          // Log viewed event once in the timeline
          const viewedSessionKey = `viewed_doc_${tokenRecord.document_id}`
          if (!sessionStorage.getItem(viewedSessionKey)) {
            sessionStorage.setItem(viewedSessionKey, 'true')
            await fetch('/api/document-actions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'log_timeline', // Handled via log timeline helper
                id: tokenRecord.document_id,
                type: tokenRecord.document_type,
                userId: docRecord.contact || 'Client',
                notes: 'Client opened and viewed the document signing page.'
              })
            }).catch(console.error)
          }
        }
      }

      // 3. Fetch signature if already signed
      const { data: sigRecord } = await supabase
        .from('document_signatures')
        .select('*')
        .eq('document_type', tokenRecord.document_type)
        .eq('document_id', tokenRecord.document_id)
        .maybeSingle()

      if (sigRecord) {
        setSignatureInfo(sigRecord)
        setSignedRecord({
          verificationId: sigRecord.verification_id,
          signedAt: sigRecord.created_at,
          browser: sigRecord.browser,
          os: sigRecord.operating_system,
          ip: sigRecord.ip_address
        })
      }
    } catch (e: any) {
      console.error(e)
      toast({ title: 'Error', description: 'Failed to load document details', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocumentData()
  }, [token])

  // Canvas drawing mouse/touch coordinates
  const getCoordinates = (e: any, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    
    // Scale coordinates based on canvas internal resolution
    const x = (clientX - rect.left) * (canvas.width / rect.width)
    const y = (clientY - rect.top) * (canvas.height / rect.height)
    
    return { x, y }
  }

  // Draw event listeners
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = '#D4AF37'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const { x, y } = getCoordinates(e, canvas)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x, y } = getCoordinates(e, canvas)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas) {
      setDrawHistory(prev => [...prev, canvas.toDataURL()])
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setDrawHistory([])
    setDrawSaved(false)
    setSavedDrawData(null)
  }

  const undoCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas || drawHistory.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const newHistory = drawHistory.slice(0, -1)
    setDrawHistory(newHistory)
    setDrawSaved(false)
    setSavedDrawData(null)

    if (newHistory.length > 0) {
      const img = new Image()
      img.src = newHistory[newHistory.length - 1]
      img.onload = () => {
        ctx.drawImage(img, 0, 0)
      }
    }
  }

  const saveDrawnSignature = () => {
    const canvas = canvasRef.current
    if (!canvas || drawHistory.length === 0) {
      toast({ title: 'No signature found', description: 'Please draw your signature first.', variant: 'destructive' })
      return
    }
    setSavedDrawData(canvas.toDataURL('image/png'))
    setDrawSaved(true)
    toast({ title: 'Signature Saved', description: 'Draw signature saved successfully.' })
  }

  const saveTypedSignature = () => {
    if (!typeText.trim()) {
      toast({ title: 'Text empty', description: 'Please type your name for the signature.', variant: 'destructive' })
      return
    }
    setTypeSaved(true)
    toast({ title: 'Signature Saved', description: 'Typed signature font details saved.' })
  }

  // Handle Client Signature Submission
  const handleAcceptAndSign = async () => {
    if (!readChecked || !agreeChecked) {
      toast({ title: 'Consents Required', description: 'Please accept both checkboxes to continue.', variant: 'destructive' })
      return
    }

    if (sigType === 'draw' && !drawSaved) {
      toast({ title: 'Signature Required', description: 'Please draw and click "Save Signature".', variant: 'destructive' })
      return
    }

    if (sigType === 'type' && !typeSaved) {
      toast({ title: 'Signature Required', description: 'Please type and click "Save Signature".', variant: 'destructive' })
      return
    }

    setSigning(true)
    try {
      const response = await fetch('/api/sign-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          clientName,
          company,
          email,
          phone,
          signatureType: sigType === 'draw' ? 'drawn' : 'typed',
          signatureImage: sigType === 'draw' ? savedDrawData : null,
          signatureText: sigType === 'type' ? typeText : null,
          signatureFont: sigType === 'type' ? selectedFont : null,
          agreementAccepted: true
        })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit e-signature')
      }

      setSignedRecord(data)
      setPdfVersion(v => v + 1)  // force iframe + download links to reload with signed PDF
      toast({ title: '🎉 Document Signed!', description: 'Your digital signature has been certified.' })
      // Reload details
      loadDocumentData()
    } catch (e: any) {
      console.error(e)
      toast({ title: 'E-Sign Error', description: e.message || 'Error occurred while signing', variant: 'destructive' })
    } finally {
      setSigning(false)
    }
  }

  // Handle Document Rejection / Revision Request
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const handleRejectDocument = async () => {
    if (!rejectNotes.trim()) {
      toast({ title: 'Notes Required', description: 'Please provide notes detailing why revision is needed.', variant: 'destructive' })
      return
    }

    setRejecting(true)
    try {
      const response = await fetch('/api/document-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject', // Transition to Needs Revision
          id: docToken.document_id,
          type: docToken.document_type,
          notes: rejectNotes,
          approver: clientName || 'Client'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit rejection request')
      }

      toast({ title: 'Revision Requested', description: 'The document has been returned to the team for revision.' })
      setShowRejectModal(false)
      loadDocumentData()
    } catch (e: any) {
      console.error(e)
      toast({ title: 'Rejection Error', description: e.message || 'Failed to reject document', variant: 'destructive' })
    } finally {
      setRejecting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background dark:bg-background text-foreground flex flex-col justify-center items-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#D4AF37]" />
      </div>
    )
  }

  // Error state for expired or cancelled token
  if (!docToken || docToken.error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-4">
        <Card className="max-w-md w-full border-red-500/20 bg-card text-foreground">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold">Signing Link Inactive</CardTitle>
            <p className="text-sm text-muted-foreground">
              {docToken?.error || 'This secure link is invalid or expired. Please contact Netgain Studio to request a new signing link.'}
            </p>
            <div className="pt-4">
              <Badge variant="outline" className="text-red-400 border-red-400/20 bg-red-400/5">ACCESS_DENIED</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-16 font-sans">
      {/* Cursive Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Dancing+Script&family=Sacramento&display=swap" rel="stylesheet" />

      {/* Header bar */}
      <div className="border-b border-border bg-background/85 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gold-gradient flex items-center justify-center font-bold text-foreground shadow-md">N</div>
            <div>
              <p className="text-sm font-bold text-foreground tracking-wide">NETGAIN STUDIO</p>
              <p className="text-[9px] text-[#D4AF37]/80 tracking-widest -mt-0.5">BUSINESS OS</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-8 text-xs border-border text-muted-foreground hover:text-foreground bg-transparent gap-1.5 font-bold"
              onClick={() => router.push(`/sign/dashboard/${token}`)}
            >
              <Building2 className="h-3.5 w-3.5 text-[#D4AF37]" /> View Documents Hub
            </Button>
            <Badge variant="outline" className="border-[#D4AF37]/30 text-[#D4AF37] capitalize px-2.5 py-0.5 text-xs bg-[#D4AF37]/5 font-mono">
              v{document?.version || 1}
            </Badge>
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize font-medium text-xs px-2.5">
              {document?.status || docToken.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Document Preview IFrame (65% width) */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-border bg-card text-foreground overflow-hidden shadow-xl">
            <CardHeader className="border-b border-border py-4 px-6 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#D4AF37]" />
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    {document?.project_title || document?.project || document?.title || docToken.document_type}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Ref: {document?.doc_id || 'NG-DOC'} · Version {document?.version || 1}
                  </CardDescription>
                </div>
              </div>
              <Button
                asChild
                variant="outline"
                className="h-8 text-xs gap-1 border-border text-muted-foreground hover:bg-accent bg-transparent"
              >
                <a href={`/api/document-pdf?token=${token}&v=${pdfVersion}`} target="_blank" rel="noreferrer">
                  <Download className="h-3 w-3" /> Download PDF
                </a>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative aspect-[3/4] sm:aspect-[1/1.4] w-full bg-background" style={{ colorScheme: 'light' }}>
                <iframe
                  key={pdfVersion}
                  src={`/api/document-pdf?token=${token}&v=${pdfVersion}`}
                  className="w-full h-full border-none rounded-b-lg bg-white"
                  style={{ colorScheme: 'light' }}
                  title="Document PDF Preview"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: E-Signature Panel (35% width) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Audit / Completed Seal if signed */}
          {signedRecord ? (
            <Card className="border-emerald-500/20 bg-emerald-500/5 text-foreground shadow-lg">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 animate-pulse">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-emerald-400">Document Digitally Signed</h3>
                  <p className="text-xs text-muted-foreground mt-1">This document has been finalized and locked.</p>
                </div>

                <div className="border-t border-emerald-500/10 pt-4 text-left space-y-2 text-xs text-muted-foreground font-mono">
                  <p><span className="text-emerald-400">Verification ID:</span> {signedRecord.verificationId}</p>
                  <p><span className="text-emerald-400">Date/Time:</span> {new Date(signedRecord.signedAt).toLocaleString('en-IN')}</p>
                  <p><span className="text-emerald-400">Platform OS:</span> {signedRecord.os}</p>
                  <p><span className="text-emerald-400">Browser:</span> {signedRecord.browser}</p>
                  <p><span className="text-emerald-400">Client IP:</span> {signedRecord.ip}</p>
                </div>

                <div className="pt-4 flex gap-2">
                  <Button
                    asChild
                    className="w-full h-10 gold-gradient text-black hover:opacity-90 font-bold gap-2 text-sm"
                  >
                    <a href={`/api/document-pdf?token=${token}&v=${pdfVersion}`} download>
                      <Download className="h-4 w-4" /> Download Signed Copy
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Signing Form Card */}
              <Card className="border-border bg-card text-foreground shadow-xl">
                <CardHeader className="border-b border-border pb-4">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-[#D4AF37]" /> E-Signature Portal
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Please review client details and sign this official document.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {/* Client Information */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">Signee Details</h3>
                    <div className="grid gap-3">
                      <div>
                        <Label htmlFor="clientName" className="text-xs text-muted-foreground">FullName</Label>
                        <Input
                          id="clientName"
                          value={clientName}
                          onChange={e => { setClientName(e.target.value); setTypeText(e.target.value); }}
                          placeholder="e.g. John Doe"
                          className="bg-background border-border h-9 text-sm focus-visible:ring-[#D4AF37]"
                        />
                      </div>
                      <div>
                        <Label htmlFor="company" className="text-xs text-muted-foreground">Company Name</Label>
                        <Input
                          id="company"
                          value={company}
                          onChange={e => setCompany(e.target.value)}
                          placeholder="e.g. Acme Corp"
                          className="bg-background border-border h-9 text-sm focus-visible:ring-[#D4AF37]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="email" className="text-xs text-muted-foreground">Email Address</Label>
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="john@example.com"
                            className="bg-background border-border h-9 text-xs focus-visible:ring-[#D4AF37]"
                          />
                        </div>
                        <div>
                          <Label htmlFor="phone" className="text-xs text-muted-foreground">Phone (WhatsApp)</Label>
                          <Input
                            id="phone"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="+91 9876543210"
                            className="bg-background border-border h-9 text-xs focus-visible:ring-[#D4AF37]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Consent Checkboxes */}
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">Consent Checklist</h3>
                    <div className="flex items-start space-x-2 bg-muted/20 p-3 rounded-lg border border-border">
                      <Checkbox
                        id="consent-read"
                        checked={readChecked}
                        onCheckedChange={checked => setReadChecked(checked === true)}
                        className="mt-0.5 border-border data-[state=checked]:bg-[#D4AF37] data-[state=checked]:text-black"
                      />
                      <label htmlFor="consent-read" className="text-xs text-muted-foreground leading-normal cursor-pointer select-none">
                        I confirm that I have fully read and reviewed this document.
                      </label>
                    </div>
                    <div className="flex items-start space-x-2 bg-muted/20 p-3 rounded-lg border border-border">
                      <Checkbox
                        id="consent-agree"
                        checked={agreeChecked}
                        onCheckedChange={checked => setAgreeChecked(checked === true)}
                        className="mt-0.5 border-border data-[state=checked]:bg-[#D4AF37] data-[state=checked]:text-black"
                      />
                      <label htmlFor="consent-agree" className="text-xs text-muted-foreground leading-normal cursor-pointer select-none">
                        I agree to all terms, deliverables, schedules, and policies outlined herein.
                      </label>
                    </div>
                  </div>

                  {/* Signature Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">Signature Input</h3>
                      <div className="flex bg-background border border-border rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => setSigType('draw')}
                          className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-medium transition-all ${sigType === 'draw' ? 'bg-[#D4AF37] text-black font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          <PenTool className="h-3 w-3" /> Draw
                        </button>
                        <button
                          type="button"
                          onClick={() => setSigType('type')}
                          className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-medium transition-all ${sigType === 'type' ? 'bg-[#D4AF37] text-black font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          <Type className="h-3 w-3" /> Type
                        </button>
                      </div>
                    </div>

                    {sigType === 'draw' ? (
                      /* Canvas draw pad */
                      <div className="space-y-2">
                        <div className="border border-border rounded-lg bg-black overflow-hidden relative group">
                          <canvas
                            ref={canvasRef}
                            width={360}
                            height={140}
                            className="w-full h-[140px] cursor-crosshair block"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                          />
                          {!drawSaved && drawHistory.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-600 text-xs font-mono">
                              Draw signature using Mouse / Touch here
                            </div>
                          )}
                          {drawSaved && (
                            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-emerald-400 text-xs font-bold pointer-events-none">
                              <CheckCircle2 className="h-5 w-5 mb-1" /> Signature Locked & Saved
                            </div>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              onClick={clearCanvas}
                              variant="outline"
                              className="h-7 px-2 text-[10px] border-border text-muted-foreground hover:text-foreground bg-transparent"
                            >
                              Clear
                            </Button>
                            <Button
                              type="button"
                              onClick={undoCanvas}
                              variant="outline"
                              className="h-7 px-2 text-[10px] border-border text-muted-foreground hover:text-foreground bg-transparent"
                              disabled={drawHistory.length === 0}
                            >
                              Undo
                            </Button>
                          </div>
                          <Button
                            type="button"
                            onClick={saveDrawnSignature}
                            variant="outline"
                            className={`h-7 px-2.5 text-[10px] gap-1 font-bold ${drawSaved ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' : 'border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10'}`}
                          >
                            {drawSaved ? 'Saved ✔' : 'Save Signature'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Cursive text input */
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="sigText" className="text-xs text-muted-foreground">Type Name</Label>
                          <Input
                            id="sigText"
                            value={typeText}
                            onChange={e => { setTypeText(e.target.value); setTypeSaved(false); }}
                            placeholder="John Doe"
                            className="bg-background border-border h-9 text-sm focus-visible:ring-[#D4AF37]"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {fonts.map(font => (
                            <button
                              key={font.value}
                              type="button"
                              onClick={() => { setSelectedFont(font.value); setTypeSaved(false); }}
                              className={`py-1 px-1.5 border rounded-md text-[10px] text-center font-medium transition-all ${selectedFont === font.value ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
                            >
                              {font.name}
                            </button>
                          ))}
                        </div>
                        <div className="border border-border rounded-lg p-4 bg-black h-20 flex items-center justify-center relative overflow-hidden">
                          <p
                            className="text-2xl text-center text-[#D4AF37] px-4 truncate"
                            style={{
                              fontFamily: fonts.find(f => f.value === selectedFont)?.family || 'serif'
                            }}
                          >
                            {typeText || 'Signature Preview'}
                          </p>
                          {typeSaved && (
                            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-emerald-400 text-xs font-bold pointer-events-none">
                              <CheckCircle2 className="h-5 w-5 mb-0.5" /> Signature Saved
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            onClick={saveTypedSignature}
                            variant="outline"
                            className={`h-7 px-2.5 text-[10px] gap-1 font-bold ${typeSaved ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' : 'border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10'}`}
                          >
                            {typeSaved ? 'Saved ✔' : 'Save Signature'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* OTP Verification Method Selector */}
                  <div className="border-t border-border pt-4 space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-[#D4AF37]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Verification Method</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setOtpMethod('email')}
                        className={`p-2 border rounded-lg text-left transition-all ${otpMethod === 'email' ? 'border-[#D4AF37] bg-[#D4AF37]/5 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
                      >
                        <p className="text-xs font-bold">Email OTP</p>
                        <p className="text-[10px] text-muted-foreground/80 mt-0.5">Coming Soon</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOtpMethod('sms')}
                        className={`p-2 border rounded-lg text-left transition-all ${otpMethod === 'sms' ? 'border-border text-muted-foreground/80 opacity-60' : 'border-border text-muted-foreground hover:text-foreground'}`}
                        disabled
                      >
                        <p className="text-xs font-bold">SMS OTP</p>
                        <p className="text-[10px] text-muted-foreground/80 mt-0.5">Coming Soon</p>
                      </button>
                    </div>
                  </div>

                  {/* Accept & Sign Button */}
                  <div className="pt-2">
                    <Button
                      type="button"
                      onClick={handleAcceptAndSign}
                      disabled={signing || !readChecked || !agreeChecked || (sigType === 'draw' ? !drawSaved : !typeSaved)}
                      className="w-full h-11 font-bold text-sm gold-gradient text-black hover:opacity-90 flex items-center justify-center gap-2 rounded-lg"
                    >
                      {signing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-black" />
                          Processing Digital Certificate...
                        </>
                      ) : (
                        <>
                          Accept & Sign Document
                          <ChevronRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Reject Document Button */}
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  className="text-xs text-red-400/70 hover:text-red-400 font-medium underline transition-all"
                >
                  Request Document Revision / Decline to Sign
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reject/Revision Request Dialog Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="max-w-md w-full border-border bg-card text-foreground">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" /> Request Revision
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Let the team know what revisions or updates are required.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label htmlFor="rejectNotes" className="text-xs text-muted-foreground">Details / Notes</Label>
                <textarea
                  id="rejectNotes"
                  rows={4}
                  value={rejectNotes}
                  onChange={e => setRejectNotes(e.target.value)}
                  placeholder="Describe the changes or corrections required..."
                  className="w-full bg-background border border-border rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37] placeholder-slate-600 text-foreground"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRejectModal(false)}
                  className="h-9 text-xs border-border text-muted-foreground hover:text-foreground bg-transparent"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleRejectDocument}
                  disabled={rejecting}
                  className="h-9 text-xs bg-red-500 hover:bg-red-600 text-white border-none font-bold"
                >
                  {rejecting ? 'Submitting...' : 'Decline & Submit'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
