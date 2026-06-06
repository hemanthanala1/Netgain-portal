'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Mail, MessageSquare, Phone, Send, Loader2 } from 'lucide-react'

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  onSend: (methods: string[]) => Promise<void>
}

export function ShareDialog({ open, onOpenChange, title, onSend }: ShareDialogProps) {
  const [methods, setMethods] = useState<string[]>(['email'])
  const [sending, setSending] = useState(false)
  const { toast } = useToast()

  const toggleMethod = (method: string) => {
    setMethods(prev => prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method])
  }

  const handleSend = async () => {
    if (methods.length === 0) {
      toast({ title: 'Select at least one method', variant: 'destructive' })
      return
    }
    setSending(true)
    try {
      await onSend(methods)
      toast({ title: '✅ Document Shared Successfully', description: `Sent via ${methods.join(', ')}` })
      onOpenChange(false)
    } catch (e: any) {
      toast({ title: 'Failed to send', description: e.message, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
          <DialogDescription>
            Select how you want to send <strong>{title}</strong> to the client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <button
            onClick={() => toggleMethod('email')}
            className={`flex items-center gap-3 w-full p-4 rounded-xl border-2 transition-all ${methods.includes('email') ? 'border-gold bg-gold/5' : 'border-border hover:border-gold/30'}`}
          >
            <div className={`p-2 rounded-lg ${methods.includes('email') ? 'bg-gold text-black' : 'bg-muted text-muted-foreground'}`}><Mail className="h-5 w-5" /></div>
            <div className="text-left">
              <p className="font-semibold text-sm">Send via Email</p>
              <p className="text-xs text-muted-foreground">Send PDF attachment to client email.</p>
            </div>
          </button>

          <button
            onClick={() => toggleMethod('whatsapp')}
            className={`flex items-center gap-3 w-full p-4 rounded-xl border-2 transition-all ${methods.includes('whatsapp') ? 'border-[#25D366] bg-[#25D366]/5' : 'border-border hover:border-[#25D366]/30'}`}
          >
            <div className={`p-2 rounded-lg ${methods.includes('whatsapp') ? 'bg-[#25D366] text-white' : 'bg-muted text-muted-foreground'}`}><MessageSquare className="h-5 w-5" /></div>
            <div className="text-left">
              <p className="font-semibold text-sm">Send via WhatsApp</p>
              <p className="text-xs text-muted-foreground">Send document link to WhatsApp.</p>
            </div>
          </button>

          <button
            onClick={() => toggleMethod('sms')}
            className={`flex items-center gap-3 w-full p-4 rounded-xl border-2 transition-all ${methods.includes('sms') ? 'border-blue-500 bg-blue-500/5' : 'border-border hover:border-blue-500/30'}`}
          >
            <div className={`p-2 rounded-lg ${methods.includes('sms') ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'}`}><Phone className="h-5 w-5" /></div>
            <div className="text-left">
              <p className="font-semibold text-sm">Send via SMS</p>
              <p className="text-xs text-muted-foreground">Send document link via text message.</p>
            </div>
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="gold" onClick={handleSend} disabled={sending || methods.length === 0} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
