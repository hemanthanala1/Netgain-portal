'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast({ title: 'Please fill in all fields', variant: 'destructive' }); return }
    setLoading(true)

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          toast({ title: 'Login Failed', description: error.message, variant: 'destructive' })
          setLoading(false)
          return
        }
        if (data.session) {
          // Set access cookies for middleware
          document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=${data.session.expires_in}`
          document.cookie = `sb-refresh-token=${data.session.refresh_token}; path=/; max-age=${data.session.expires_in}`
          document.cookie = `nbos-session=active; path=/`
          toast({ title: 'Welcome back!', description: 'Logged in successfully.' })
          router.push('/dashboard')
        }
      } catch (err: any) {
        toast({ title: 'Auth Error', description: err.message || 'An error occurred during login', variant: 'destructive' })
      }
    } else {
      // Demo mode — bypass auth if Supabase not configured
      await new Promise(r => setTimeout(r, 800))
      document.cookie = 'nbos-session=demo; path=/'
      router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-gold/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm mx-4"
      >
        <Card className="border shadow-2xl">
          <CardHeader className="text-center pb-2 pt-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-10 w-10 rounded-xl gold-gradient flex items-center justify-center shadow-lg shadow-gold/20">
                <span className="text-lg font-black text-white">N</span>
              </div>
            </div>
            <h1 className="text-xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to Netgain Business OS</p>
          </CardHeader>

          <CardContent className="pb-8 pt-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" placeholder="you@netgain.studio" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center"><Label htmlFor="password">Password</Label><button type="button" className="text-xs text-gold hover:underline">Forgot password?</button></div>
                <div className="relative">
                  <Input id="password" type={showPass ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="pr-10" />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPass(!showPass)}>
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" variant="gold" size="lg" className="w-full mt-2" disabled={loading}>
                {loading ? <span className="flex items-center gap-2"><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Signing in...</span> : 'Sign In'}
              </Button>
            </form>
            <div className="mt-4 p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Employee accounts must be created by the Founder.</p>
              <p className="text-xs text-muted-foreground mt-0.5">Self-registration is disabled for security.</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
