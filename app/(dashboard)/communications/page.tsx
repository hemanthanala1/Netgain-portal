'use client'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, MessageSquare, Mail, Phone, Send, Clock, User, Search, History, Edit, Trash2 } from 'lucide-react'
import { formatDateTime, getInitials } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useRef } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

const commHistory = [
  { id: 'c1', client: 'FashionHub India', channel: 'email', subject: 'Invoice #INV-0891 Payment Reminder', preview: 'Dear Priya, This is a friendly reminder...', sentAt: '2024-06-04T10:30:00', sentBy: 'Devon S.' },
  { id: 'c2', client: 'Urban Edge Co.', channel: 'whatsapp', subject: 'Quotation Follow-up', preview: 'Hi Aaron! Just checking in on the quotation...', sentAt: '2024-06-03T14:15:00', sentBy: 'Anjali R.' },
  { id: 'c3', client: 'TechCore Solutions', channel: 'email', subject: 'Project Update — Week 8', preview: 'Hi Ramesh, Here is your weekly project update...', sentAt: '2024-06-02T09:00:00', sentBy: 'Devon S.' },
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
  const [templates, setTemplates] = useState(initialTemplates)
  const [showCompose, setShowCompose] = useState(false)
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const [search, setSearch] = useState('')
  const { toast } = useToast()
  const [form, setForm] = useState({ client: '', channel: 'email', template: '', subject: '', body: '' })
  const [templateForm, setTemplateForm] = useState({ name: '', channel: 'email', subject: '', body: '' })
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null)
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    if (!form.client || !form.body) { toast({ title: 'Fill required fields', variant: 'destructive' }); return }
    toast({ title: 'Message Queued', description: `${form.channel.toUpperCase()} to ${form.client} is ready to send when connected.` })
    setShowCompose(false)
    setForm({ client: '', channel: 'email', template: '', subject: '', body: '' })
  }

  const handleTemplateSelect = (templateId: string) => {
    const t = templates.find(t => t.id === templateId)
    if (t) setForm({ ...form, template: templateId, subject: t.subject, body: t.body })
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
    setTemplateForm({ name: '', channel: 'email', subject: '', body: '' })
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
          <Button variant="outline" size="sm" onClick={() => { setEditTemplateId(null); setTemplateForm({ name: '', channel: 'email', subject: '', body: '' }); setShowCreateTemplate(true) }} className="gap-1.5"><Plus className="h-4 w-4" />New Template</Button>
          <Button variant="gold" size="sm" onClick={() => setShowCompose(true)} className="gap-1.5"><Plus className="h-4 w-4" />Compose</Button>
        </div>
      </div>

      <Tabs defaultValue="history">
        <TabsList><TabsTrigger value="history">History</TabsTrigger><TabsTrigger value="templates">Templates</TabsTrigger></TabsList>

        <TabsContent value="history" className="space-y-4">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search communications..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="space-y-3">
            {commHistory.filter(c => c.client.toLowerCase().includes(search.toLowerCase())).map(c => {
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
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
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
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setForm({ ...form, template: t.id, subject: t.subject, body: t.body, channel: t.channel }); setShowCompose(true) }}>Use Template</Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setTemplateForm({ name: t.name, channel: t.channel, subject: t.subject, body: t.body }); setEditTemplateId(t.id); setShowCreateTemplate(true) }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-400" onClick={() => setDeleteTemplateId(t.id)}>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Client *</Label><Input placeholder="Company / Contact" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
              <div className="space-y-1"><Label>Channel</Label><Select value={form.channel} onValueChange={v => setForm({...form, channel: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="email">Email</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="sms">SMS</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-1"><Label>Template (optional)</Label><Select value={form.template} onValueChange={handleTemplateSelect}><SelectTrigger><SelectValue placeholder="Choose a template..." /></SelectTrigger><SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
            {form.channel === 'email' && <div className="space-y-1"><Label>Subject</Label><Input placeholder="Email subject..." value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} /></div>}
            <div className="space-y-1"><Label>Message *</Label><Textarea className="h-32 resize-none" placeholder="Type your message... Use {ClientName}, {Date}, {Amount} as placeholders." value={form.body} onChange={e => setForm({...form, body: e.target.value})} /></div>
            <p className="text-xs text-muted-foreground">⚡ Live sending will be activated when SMTP / WhatsApp API is configured in Settings.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCompose(false)}>Cancel</Button><Button variant="gold" onClick={handleSend} className="gap-1.5"><Send className="h-3.5 w-3.5" />Queue Message</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateTemplate} onOpenChange={(open) => { setShowCreateTemplate(open); if(!open) setEditTemplateId(null) }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editTemplateId ? 'Edit Template' : 'Create New Template'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Template Name *</Label><Input placeholder="e.g. Welcome Email" value={templateForm.name} onChange={e => setTemplateForm({...templateForm, name: e.target.value})} /></div>
              <div className="space-y-1"><Label>Default Channel</Label><Select value={templateForm.channel} onValueChange={v => setTemplateForm({...templateForm, channel: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="email">Email</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="sms">SMS</SelectItem></SelectContent></Select></div>
            </div>
            {templateForm.channel === 'email' && <div className="space-y-1"><Label>Subject</Label><Input placeholder="Email subject..." value={templateForm.subject} onChange={e => setTemplateForm({...templateForm, subject: e.target.value})} /></div>}
            <div className="space-y-1">
              <Label>Template Body *</Label>
              <Textarea ref={bodyRef} className="h-32 resize-none" placeholder="Type your template... Use {Placeholders}." value={templateForm.body} onChange={e => setTemplateForm({...templateForm, body: e.target.value})} />
              <div className="text-[10px] text-muted-foreground pt-1 flex flex-wrap items-center gap-1.5">
                <span>Click to insert:</span>
                {['{ClientName}', '{BusinessName}', '{ProjectName}', '{InvoiceID}', '{Amount}', '{DueDate}', '{Date}', '{Time}'].map(p => (
                  <button type="button" key={p} onClick={() => insertPlaceholder(p)} className="hover:opacity-80 transition-opacity">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono font-normal cursor-pointer bg-white/5 border-white/10 hover:bg-white/10">{p}</Badge>
                  </button>
                ))}
              </div>
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
