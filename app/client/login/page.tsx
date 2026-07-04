'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Shield, LogIn, Mail, Lock, Building2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function ClientLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    void router.prefetch('/client/dashboard')
  }, [router])

  // Redirect if already logged in
  useEffect(() => {
    const session = localStorage.getItem('netgain_client_session')
    if (session) {
      router.push('/client/dashboard')
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      toast({ title: 'Input Required', description: 'Please enter both email and password.', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/client/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      // Save session
      localStorage.setItem('netgain_client_session', JSON.stringify(data.session))
      toast({ title: 'Welcome Back!', description: `Logged in successfully as ${data.session.name}.` })
      router.replace('/client/dashboard')
    } catch (err: any) {
      console.error(err)
      toast({ title: 'Login Failed', description: err.message || 'Incorrect email or password.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A1612] text-slate-100 flex flex-col justify-center items-center p-4 font-sans relative overflow-hidden">
      {/* Background blur effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#1E3A2F]/20 blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[#D4AF37]/5 blur-3xl -z-10" />

      <div className="w-full max-w-md space-y-6">
        {/* Brand logo */}
        <div className="flex flex-col items-center space-y-2">
          <div className="h-12 w-12 rounded-xl gold-gradient flex items-center justify-center font-bold text-white text-xl shadow-lg border border-white/10">N</div>
          <h1 className="text-2xl font-black text-white tracking-wide">NETGAIN CLIENT PORTAL</h1>
          <p className="text-[10px] text-[#D4AF37] tracking-widest uppercase font-bold">Secure Document Center</p>
        </div>

        {/* Card */}
        <Card className="border-[#1E3A2F] bg-[#12241D]/90 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[3px] gold-gradient" />
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#D4AF37]" /> Client Login
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Enter your credentials to access your quotations, statements of work, and agreements.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs text-slate-400 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-[#D4AF37]" /> Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="client@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-[#0A1612] border-[#1E3A2F] text-white focus-visible:ring-[#D4AF37] h-10"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      document.getElementById('password')?.focus()
                    }
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs text-slate-400 flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-[#D4AF37]" /> Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="bg-[#0A1612] border-[#1E3A2F] text-white focus-visible:ring-[#D4AF37] h-10"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 font-bold text-sm gold-gradient text-black hover:opacity-90 flex items-center justify-center gap-2 rounded-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-black" />
                      Authenticating Secure Portal...
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" /> Log In to Portal
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Back to main website info */}
        <p className="text-center text-xs text-slate-500 font-medium">
          Protected by Netgain security frameworks. Need access? Contact your Account Manager.
        </p>
      </div>
    </div>
  )
}
