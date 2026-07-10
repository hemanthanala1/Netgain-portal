'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Shield, LogIn, Mail, Lock } from 'lucide-react'
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

  // Clear any existing session when landing on login page
  useEffect(() => {
    localStorage.removeItem('netgain_client_session')
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
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-4 font-sans relative overflow-hidden">
      <div className="w-full max-w-md space-y-6">
        {/* Brand logo */}
        <div className="flex flex-col items-center space-y-2">
          <img src="/logo.png" className="h-12 w-12 rounded-lg shrink-0 object-contain shadow-sm" alt="Netgain Logo" />
          <h1 className="text-2xl font-black text-foreground tracking-wide">NETGAIN CLIENT PORTAL</h1>
          <p className="text-[10px] text-primary tracking-widest uppercase font-bold">Secure Document Center</p>
        </div>

        {/* Card */}
        <Card className="border-border bg-card text-card-foreground shadow-lg relative overflow-hidden">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Client Login
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Enter your credentials to access your quotations, statements of work, and agreements.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-primary" /> Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="client@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-background border-border text-foreground focus-visible:ring-primary h-10"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      document.getElementById('password')?.focus()
                    }
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs text-muted-foreground flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-primary" /> Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="bg-background border-border text-foreground focus-visible:ring-primary h-10"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/95 flex items-center justify-center gap-2 rounded-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
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
        <p className="text-center text-xs text-muted-foreground font-medium">
          Protected by Netgain security frameworks. Need access? Contact your Account Manager.
        </p>
      </div>
    </div>
  )
}
