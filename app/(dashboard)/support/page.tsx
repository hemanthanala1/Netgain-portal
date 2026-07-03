'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Mail, HelpCircle, CheckCircle2 } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

interface SupportTicket {
  id: string
  title: string
  message: string
  created_at: string
  read: boolean
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    async function loadTickets() {
      if (!isSupabaseConfigured()) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('client_notifications')
        .select('*')
        .eq('client_id', 'Founder')
        .eq('type', 'support')
        .order('created_at', { ascending: false })

      if (error) {
        toast({ title: 'Failed to load tickets', description: error.message, variant: 'destructive' })
      } else if (data) {
        setTickets(data as SupportTicket[])
      }
      setLoading(false)
    }

    loadTickets()
  }, [])

  async function markAsRead(id: string) {
    if (!isSupabaseConfigured()) return
    
    const { error } = await supabase
      .from('client_notifications')
      .update({ read: true })
      .eq('id', id)
      
    if (!error) {
      setTickets(tickets.map(t => t.id === id ? { ...t, read: true } : t))
      toast({ title: 'Marked as read' })
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <HelpCircle className="h-8 w-8 text-gold" /> Support Tickets
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Review support requests from your clients.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : tickets.length === 0 ? (
        <Card className="bg-[#121212] border-white/5 py-16 text-center">
          <Mail className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-3" />
          <p className="text-muted-foreground">No support tickets found.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {tickets.map(ticket => (
            <Card key={ticket.id} className={`bg-[#121212] border-white/5 transition-all ${!ticket.read ? 'border-gold/30 shadow-[0_0_15px_rgba(212,175,55,0.1)]' : ''}`}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base text-gold">{ticket.title}</CardTitle>
                    {!ticket.read && <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]">New</Badge>}
                  </div>
                  <CardDescription className="text-xs mt-1">
                    {new Date(ticket.created_at).toLocaleString()}
                  </CardDescription>
                </div>
                {!ticket.read && (
                  <Button variant="outline" size="sm" onClick={() => markAsRead(ticket.id)} className="h-8 text-xs border-gold/20 text-gold hover:bg-gold/10">
                    <CheckCircle2 className="h-3 w-3 mr-1.5" /> Mark Read
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="bg-black/20 p-4 rounded-md border border-white/5 whitespace-pre-wrap text-sm text-slate-300">
                  {ticket.message}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
