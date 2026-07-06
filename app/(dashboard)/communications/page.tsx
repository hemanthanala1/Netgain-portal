'use client'
import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, MessageSquare, Mail, Phone, Send, Clock, User, Search, History, Edit, Trash2, Loader2 } from 'lucide-react'
import { formatDateTime, getInitials, cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ClientAutocomplete } from '@/components/ui/client-autocomplete'
import { useCRMClients } from '@/hooks/use-crm-clients'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'


const commHistory = [
  { id: 'c1', client: 'FashionHub India', channel: 'email', subject: 'Invoice #INV-0891 Payment Reminder', preview: 'Dear Priya, This is a friendly reminder...', sentAt: '2024-06-04T10:30:00', sentBy: 'Devon S.', status: 'sent' },
  { id: 'c2', client: 'Urban Edge Co.', channel: 'whatsapp', subject: 'Quotation Follow-up', preview: 'Hi Aaron! Just checking in on the quotation...', sentAt: '2024-06-03T14:15:00', sentBy: 'Anjali R.', status: 'sent' },
  { id: 'c3', client: 'TechCore Solutions', channel: 'email', subject: 'Project Update — Week 8', preview: 'Hi Ramesh, Here is your weekly project update...', sentAt: '2024-06-02T09:00:00', sentBy: 'Devon S.', status: 'sent' },
]

const initialTemplates = [
  { id: 't1', name: 'Payment Reminder', channel: 'email', subject: 'Invoice Payment Reminder — {InvoiceID}', body: 'Dear {ClientName},\n\nThis is a friendly reminder that Invoice {InvoiceID} for ₹{Amount} is due on {DueDate}.\n\nKindly process the payment at your earliest convenience.\n\nThank you for your business!\n\nBest regards,\nNetgain Studio' },
  { id: 't2', name: 'Quotation Follow-up', channel: 'whatsapp', subject: '', body: 'Hi {ClientName}! 👋\n\nJust checking in on the quotation we sent on {Date}.\n\nDo you have any questions or would you like to discuss further?\n\nWe\'re excited to work with {BusinessName}! 🚀' },
  { id: 't3', name: 'Project Kickoff', channel: 'email', subject: 'Kickoff Confirmation — {ProjectName}', body: 'Dear {ClientName},\n\nWe are thrilled to officially kick off "{ProjectName}"!\n\nKickoff Call: {Date} at {Time}\nYour PM: {PMName}\n\nWe will send over a project timeline and initial requirements in the next 24 hours.\n\nBest regards,\nNetgain Studio' },
  { id: 't4', name: 'Monthly Report Ready', channel: 'email', subject: 'Your {Month} Marketing Report is Ready', body: 'Dear {ClientName},\n\nYour {Month} performance report is ready! 📊\n\nHighlights:\n• ROAS: {ROAS}x\n• Leads: {Leads}\n• Revenue: ₹{Revenue}\n\nFind the full report attached. Let us know if you have questions!\n\nBest regards,\nNetgain Studio' },
]

const channelIcon: Record<string, any> = { email: Mail, whatsapp: Phone, sms: MessageSquare }
const channelColor: Record<string, string> = { email: 'text-blue-400 bg-blue-500/10', whatsapp: 'text-green-400 bg-green-500/10', sms: 'text-purple-400 bg-purple-500/10' }

export default function CommunicationsPage() {
  const { clients: crmClients } = useCRMClients()
  const [templates, setTemplates] = useState(initialTemplates)

  const [showCompose, setShowCompose] = useState(false)
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const [search, setSearch] = useState('')
  const { toast } = useToast()
  const [form, setForm] = useState({ client: '', recipient: '', channel: 'email', template: '', subject: '', body: '', attachments: [] as File[] })
  
  const [logs, setLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    async function fetchLogs() {
      setLoadingLogs(true)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase
            .from('communication_logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(100)
          
          if (data) {
            const mapped = data.map((log: any) => {
              const clientInfo = crmClients.find(c => c.email === log.recipient || c.phone === log.recipient)
              return {
                id: log.id,
                client: clientInfo ? (clientInfo.business || clientInfo.name) : log.recipient,
                channel: log.channel,
                subject: log.subject || '',
                preview: log.message,
                sentAt: log.timestamp,
                sentBy: log.provider || 'System',
                status: log.status
              }
            })
            setLogs(mapped)
          }
        } catch (err) {
          console.error(err)
        }
      } else {
        setLogs(commHistory)
      }
      setLoadingLogs(false)
    }
    fetchLogs()

    let channel: any = null
    if (isSupabaseConfigured()) {
      channel = supabase
        .channel('comm_logs_realtime_page')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'communication_logs' },
          (payload: any) => {
            const newRecord = payload.new
            if (newRecord) {
              const clientInfo = crmClients.find(c => c.email === newRecord.recipient || c.phone === newRecord.recipient)
              const mapped = {
                id: newRecord.id,
                client: clientInfo ? (clientInfo.business || clientInfo.name) : newRecord.recipient,
                channel: newRecord.channel,
                subject: newRecord.subject || '',
                preview: newRecord.message,
                sentAt: newRecord.timestamp,
                sentBy: newRecord.provider || 'System',
                status: newRecord.status
              }
              setLogs(prev => [mapped, ...prev])
            }
          }
        )
        .subscribe()
    }

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [crmClients])
  
  function blankTemplate() {
    return { name: '', channel: 'email', subject: '', body: '', attachments: [] as File[] }
  }

  const [templateForm, setTemplateForm] = useState(blankTemplate())
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null)
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = async () => {
    if (!form.client || !form.recipient || !form.body) { 
      toast({ title: 'Fill required fields', variant: 'destructive' })
      return 
    }
    
    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch('/api/meetings/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          channel: form.channel,
          recipient: form.recipient,
          message: form.body,
          subject: form.channel === 'email' ? form.subject || 'Message from Netgain' : undefined
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message')
      }

      toast({ 
        title: 'Message Sent Successfully', 
        description: `${form.channel.toUpperCase()} sent to ${form.recipient}` 
      })
      
      setShowCompose(false)
      setForm({ client: '', recipient: '', channel: 'email', template: '', subject: '', body: '', attachments: [] })
    } catch (err: any) {
      console.error(err)
      toast({ 
        title: 'Send Failed', 
        description: err.message || 'There was an error sending the message.', 
        variant: 'destructive' 
      })
    } finally {
      setSending(false)
    }
  }

  const handleChannelChange = (newChannel: string) => {
    const clientInfo = crmClients.find(c => c.name === form.client || c.business === form.client)
    const newRecipient = newChannel === 'email' ? clientInfo?.email : clientInfo?.phone
    setForm(f => ({ ...f, channel: newChannel, recipient: newRecipient || '' }))
  }

  const handleTemplateSelect = (templateId: string) => {
    const t = templates.find(t => t.id === templateId)
    if (t) {
      const crmClient = crmClients.find(c => c.name === form.client || c.business === form.client)
      let body = t.body
      let subject = t.subject
      if (crmClient) {
        const clientName = crmClient.name
        const businessName = crmClient.business || crmClient.name
        const replacer = (text: string) => {
          return text
            .replace(/{ClientName}/g, clientName)
            .replace(/{BusinessName}/g, businessName)
            .replace(/{Date}/g, new Date().toLocaleDateString('en-IN'))
            .replace(/{Time}/g, new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
        }
        body = replacer(body)
        subject = replacer(subject)
      }
      setForm(f => ({ ...f, template: templateId, subject, body, attachments: (t as any).attachments || [] }))
    }
  }


  const handleCreateTemplate = () => {
    if (!templateForm.name || !templateForm.body) { toast({ title: 'Name and Body are required', variant: 'destructive' }); return }
    if (editTemplateId) {
      setTemplates(templates.map(t => t.id === editTemplateId ? { ...t, ...templateForm } : t))
      setEditTemplateId(null)
      toast({ title: 'Template Updated', description: `Template "${templateForm.name}" has been updated.` })
    } else {
      setTemplates([...templates, { id: `t${Date.now()}`, ...templateForm }])
      toast({ title: 'Template Created', description: `Template "${templateForm.name}" has been saved.` })
    }
    setShowCreateTemplate(false)
    setTemplateForm({ name: '', channel: 'email', subject: '', body: '', attachments: [] })
  }

  const insertPlaceholder = (p: string) => {
    if (bodyRef.current) {
      const start = bodyRef.current.selectionStart
      const end = bodyRef.current.selectionEnd
      const newBody = templateForm.body.substring(0, start) + p + templateForm.body.substring(end)
      setTemplateForm({ ...templateForm, body: newBody })
      // Focus back is tricky without a timeout but acceptable
    } else {
      setTemplateForm({ ...templateForm, body: templateForm.body + p })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight">Communications Center</h1><p className="text-muted-foreground text-sm mt-0.5">Send emails, WhatsApp messages, and track all client communications.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setEditTemplateId(null); setTemplateForm(blankTemplate()); setShowCreateTemplate(true) }} className="gap-1.5"><Plus className="h-4 w-4" />New Template</Button>
          <Button variant="gold" size="sm" onClick={() => setShowCompose(true)} className="gap-1.5"><Plus className="h-4 w-4" />Compose</Button>
        </div>
      </div>

      <Tabs defaultValue="history">
        <TabsList><TabsTrigger value="history">History</TabsTrigger><TabsTrigger value="templates">Templates</TabsTrigger></TabsList>

        <TabsContent value="history" className="space-y-4">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search communications..." value={search} onChange={e => setSearch(e.target.value)} /></div>
            {loadingLogs ? (
              <div className="py-12 text-center text-muted-foreground">
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-gold" />
                <p>Loading communication history...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No communications history found</p>
              </div>
            ) : logs.filter(c => c.client.toLowerCase().includes(search.toLowerCase()) || c.preview.toLowerCase().includes(search.toLowerCase()) || (c.subject && c.subject.toLowerCase().includes(search.toLowerCase()))).map(c => {
              const Icon = channelIcon[c.channel] || MessageSquare
              const colors = channelColor[c.channel] || ''
              return (
                <Card key={c.id} className="hover:border-gold/20 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-lg p-2 shrink-0 ${colors}`}><Icon className="h-4 w-4" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm">{c.client}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(c.sentAt)}</p>
                        </div>
                        {c.subject && <p className="text-sm mt-0.5">{c.subject}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.preview}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={c.channel === 'email' ? 'info' : c.channel === 'whatsapp' ? 'success' : 'secondary'} className="text-[10px]">{c.channel}</Badge>
                          <span className="text-xs text-muted-foreground">by {c.sentBy}</span>
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-medium capitalize",
                            c.status === 'failed' ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          )}>
                            {c.status || 'sent'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(t => {
              const Icon = channelIcon[t.channel] || MessageSquare
              const colors = channelColor[t.channel] || ''
              return (
                <Card key={t.id} className="hover:border-gold/20 transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-lg p-2 shrink-0 ${colors}`}><Icon className="h-4 w-4" /></div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{t.name}</p>
                        <Badge variant="outline" className="text-[10px] mt-1">{t.channel}</Badge>
                        {t.subject && <p className="text-xs text-muted-foreground mt-2 truncate">{t.subject}</p>}
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.body.slice(0, 80)}...</p>
                        <div className="flex items-center gap-2 mt-3">
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                            const clientInfo = crmClients.find(c => c.name === form.client || c.business === form.client)
                            const defaultRecipient = t.channel === 'email' ? clientInfo?.email : clientInfo?.phone
                            setForm(f => ({ ...f, template: t.id, subject: t.subject, body: t.body, channel: t.channel, recipient: defaultRecipient || '', attachments: (t as any).attachments || [] }));
                            setShowCompose(true)
                          }}>Use Template</Button>
                          <Button variant="ghost" size="icon" aria-label="Action" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setTemplateForm({ name: t.name, channel: t.channel, subject: t.subject, body: t.body, attachments: (t as any).attachments || [] }); setEditTemplateId(t.id); setShowCreateTemplate(true) }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Action" className="h-7 w-7 text-muted-foreground hover:text-red-400" onClick={() => setDeleteTemplateId(t.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Compose Message</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Client *</Label>
                <ClientAutocomplete
                  placeholder="Company / Contact"
                  value={form.client}
                  onChange={v => setForm({ ...form, client: v })}
                  onSelect={client => {
                    const clientName = client.name
                    const businessName = client.business || client.name
                    const defaultRecipient = form.channel === 'email' ? client.email || '' : client.phone || ''
                    
                    let updatedBody = form.body
                    let updatedSubject = form.subject
                    if (form.template) {
                      const t = templates.find(temp => temp.id === form.template)
                      if (t) {
                        const replacer = (text: string) => {
                          return text
                             .replace(/{ClientName}/g, clientName)
                             .replace(/{BusinessName}/g, businessName)
                             .replace(/{Date}/g, new Date().toLocaleDateString('en-IN'))
                             .replace(/{Time}/g, new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
                        }
                        updatedBody = replacer(t.body)
                        updatedSubject = replacer(t.subject)
                      }
                    }
                    
                    setForm(f => ({
                      ...f,
                      client: businessName,
                      recipient: defaultRecipient,
                      body: updatedBody,
                      subject: updatedSubject
                    }))
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>Channel</Label>
                <Select value={form.channel} onValueChange={handleChannelChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Recipient *</Label>
              <Input 
                placeholder={form.channel === 'email' ? 'email@example.com' : '+91 99999 99999'} 
                value={form.recipient} 
                onChange={e => setForm({...form, recipient: e.target.value})} 
              />
            </div>
            <div className="space-y-1"><Label>Template (optional)</Label><Select value={form.template} onValueChange={handleTemplateSelect}><SelectTrigger><SelectValue placeholder="Choose a template..." /></SelectTrigger><SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
            {form.channel === 'email' && <div className="space-y-1"><Label>Subject</Label><Input placeholder="Email subject..." value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} /></div>}
            <div className="space-y-1"><Label>Message *</Label><Textarea className="h-32 resize-none" placeholder="Type your message... Use {ClientName}, {Date}, {Amount} as placeholders." value={form.body} onChange={e => setForm({...form, body: e.target.value})} /></div>
            <div className="space-y-1">
              <Label>Attachments</Label>
              <Input type="file" multiple onChange={e => setForm({...form, attachments: Array.from(e.target.files || [])})} />
              {form.attachments.length > 0 && <p className="text-xs text-muted-foreground mt-1">{form.attachments.length} file(s) attached</p>}
            </div>
            <p className="text-xs text-muted-foreground">⚡ Live sending will be activated when SMTP / WhatsApp API is configured in Settings.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompose(false)} disabled={sending}>Cancel</Button>
            <Button variant="gold" onClick={handleSend} disabled={sending} className="gap-1.5">
              {sending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Sending...</>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  {form.channel === 'email' ? 'Send Email' : form.channel === 'whatsapp' ? 'Send WhatsApp' : 'Send SMS'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateTemplate} onOpenChange={(open) => { setShowCreateTemplate(open); if(!open) setEditTemplateId(null) }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editTemplateId ? 'Edit Template' : 'Create New Template'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Template Name *</Label><Input placeholder="e.g. Welcome Email" value={templateForm.name} onChange={e => setTemplateForm({...templateForm, name: e.target.value})} /></div>
              <div className="space-y-1"><Label>Default Channel</Label><Select value={templateForm.channel} onValueChange={v => setTemplateForm({...templateForm, channel: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="email">Email</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="sms">SMS</SelectItem></SelectContent></Select></div>
            </div>
            {templateForm.channel === 'email' && <div className="space-y-1"><Label>Subject</Label><Input placeholder="Email subject..." value={templateForm.subject} onChange={e => setTemplateForm({...templateForm, subject: e.target.value})} /></div>}
            <div className="space-y-1">
              <Label>Template Body *</Label>
              <Textarea ref={bodyRef} className="h-32 resize-none" placeholder="Type your template... Use {Placeholders}." value={templateForm.body} onChange={e => setTemplateForm({...templateForm, body: e.target.value})} />
              <div className="text-[10px] text-muted-foreground pt-1 flex flex-wrap items-center gap-1.5">
                <span>Click to insert:</span>
                {['{ClientName}', '{BusinessName}', '{ProjectName}', '{InvoiceID}', '{Amount}', '{DueDate}', '{Date}', '{Time}', '{DocumentLink}', '{DocumentName}', '{DocumentType}', '{ValidUntil}'].map(p => (
                  <button type="button" key={p} onClick={() => insertPlaceholder(p)} className="hover:opacity-80 transition-opacity">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono font-normal cursor-pointer bg-white/5 border-white/10 hover:bg-white/10">{p}</Badge>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Default Attachments</Label>
              <Input type="file" multiple onChange={e => setTemplateForm({...templateForm, attachments: Array.from(e.target.files || [])})} />
              {templateForm.attachments.length > 0 && <p className="text-xs text-muted-foreground mt-1">{templateForm.attachments.length} file(s) attached</p>}
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreateTemplate(false)}>Cancel</Button><Button variant="gold" onClick={handleCreateTemplate}>{editTemplateId ? 'Save Changes' : 'Save Template'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTemplateId} onOpenChange={(open) => !open && setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the communication template.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={() => { setTemplates(templates.filter(t => t.id !== deleteTemplateId)); setDeleteTemplateId(null); toast({title:'Template Deleted'}) }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
