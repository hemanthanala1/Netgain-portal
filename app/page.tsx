'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { 
  Shield, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  FileText, 
  Layers, 
  Zap, 
  CheckCircle2, 
  Building2, 
  KeyRound, 
  UserCheck, 
  ChevronRight,
  Globe,
  Sparkles,
  HelpCircle,
  Sun,
  Moon,
  Menu,
  X
} from 'lucide-react'

export default function Homepage() {
  const router = useRouter()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()

  // Mode: 'client' (default, highlighted) vs 'admin' (secret/discreet)
  const [loginMode, setLoginMode] = useState<'client' | 'admin'>('client')
  
  // Mobile nav drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // Secret shortcut trigger counter (triple click logo)
  const [logoClicks, setLogoClicks] = useState(0)

  // Listen for secret keyboard shortcut (Ctrl + Alt + A) to toggle Admin Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setLoginMode(prev => (prev === 'admin' ? 'client' : 'admin'))
        toast({
          title: 'Secret Portal Access',
          description: 'Switched to Admin Operating Portal Mode.'
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toast])

  const handleLogoClick = () => {
    const nextCount = logoClicks + 1
    setLogoClicks(nextCount)
    if (nextCount >= 3) {
      setLoginMode(prev => (prev === 'admin' ? 'client' : 'admin'))
      setLogoClicks(0)
      toast({
        title: loginMode === 'client' ? 'Staff Portal Unlocked' : 'Client Mode Active',
        description: loginMode === 'client' ? 'Admin Portal login revealed.' : 'Switched back to Client Portal login.'
      })
    }
  }

  // Handle Client Login
  const handleClientLogin = async (e: React.FormEvent) => {
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

      localStorage.setItem('netgain_client_session', JSON.stringify(data.session))
      toast({ title: 'Welcome Back!', description: `Logged in successfully as ${data.session.name}.` })
      router.replace('/client/dashboard')
    } catch (err: any) {
      toast({ title: 'Client Auth Failed', description: err.message || 'Invalid credentials.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // Handle Admin Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      toast({ title: 'Input Required', description: 'Please enter admin email and password.', variant: 'destructive' })
      return
    }

    setLoading(true)
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          toast({ title: 'Admin Login Failed', description: error.message, variant: 'destructive' })
          setLoading(false)
          return
        }
        if (data.session) {
          document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=${data.session.expires_in}`
          document.cookie = `sb-refresh-token=${data.session.refresh_token}; path=/; max-age=${data.session.expires_in}`
          document.cookie = `nbos-session=active; path=/`
          toast({ title: 'System Granted', description: 'Welcome to Netgain Operating Portal.' })
          window.location.href = '/dashboard'
        }
      } catch (err: any) {
        toast({ title: 'Auth Error', description: err.message || 'An error occurred during sign in', variant: 'destructive' })
      }
    } else {
      // Demo Mode
      await new Promise(r => setTimeout(r, 600))
      document.cookie = 'nbos-session=demo; path=/'
      toast({ title: 'Demo Admin Active', description: 'Redirecting to Admin Operating Dashboard...' })
      router.replace('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute top-1/2 -left-40 w-[600px] h-[600px] rounded-full bg-gold/5 blur-[150px]" />
        <div className="absolute -bottom-40 right-1/4 w-[400px] h-[400px] rounded-full bg-cyan-500/5 blur-[120px]" />
      </div>

      {/* Navigation Header */}
      <header className="relative z-50 border-b border-border/40 bg-background/85 backdrop-blur-md sticky top-0 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer select-none group"
            onClick={handleLogoClick}
            title="Netgain Operating Portal"
          >
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 via-background to-primary/10 border border-primary/30 flex items-center justify-center p-1.5 shadow-md group-hover:scale-105 transition-transform">
              <img src="/logo.png" alt="Netgain Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
                NETGAIN PORTAL
              </span>
              <span className="text-[10px] block text-primary font-bold tracking-wider uppercase -mt-1">
                CLIENT & BUSINESS PLATFORM
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#overview" className="hover:text-foreground transition-colors">Overview</a>
            <a href="#purpose" className="hover:text-foreground transition-colors">App Purpose</a>
            <a href="#features" className="hover:text-foreground transition-colors">Services & Vault</a>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </nav>

          {/* Actions: Theme Toggle & Login CTA */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/60"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Toggle Theme"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>

            <Link 
              href="/client/login" 
              className="inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-all h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              Client Login
            </Link>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-b border-border/40 bg-background/95 backdrop-blur-xl px-4 pt-2 pb-4 space-y-3"
            >
              <a 
                href="#overview" 
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-medium text-muted-foreground hover:text-foreground py-1.5"
              >
                Overview
              </a>
              <a 
                href="#purpose" 
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-medium text-muted-foreground hover:text-foreground py-1.5"
              >
                App Purpose
              </a>
              <a 
                href="#features" 
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-medium text-muted-foreground hover:text-foreground py-1.5"
              >
                Services & Vault
              </a>
              <Link 
                href="/privacy" 
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-medium text-muted-foreground hover:text-foreground py-1.5"
              >
                Privacy Policy
              </Link>
              <Link 
                href="/terms" 
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-medium text-muted-foreground hover:text-foreground py-1.5"
              >
                Terms of Service
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero Section */}
      <main className="flex-1 relative z-10">
        <section id="overview" className="pt-6 pb-12 md:pt-8 md:pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Hero Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Official Netgain Portal — Enterprise Client Operating Workspace</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15]">
                <span className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
                  Netgain Portal
                </span>
              </h1>
              <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary via-amber-400 to-gold bg-clip-text text-transparent">
                Enterprise Client Collaboration & Operating Workspace
              </h2>

              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto lg:mx-0 font-normal leading-relaxed">
                Netgain Portal is the official client portal provided by Netgain Studio. Authorized corporate clients and partners use Netgain Portal to review Statements of Work (SOWs), monitor live project milestones, access encrypted document vaults, approve commercial agreements, and manage billing statements in real time.
              </p>

              {/* Google OAuth Purpose Disclosure Box above the fold */}
              <div className="p-4 rounded-xl border border-primary/30 bg-card/80 backdrop-blur-sm text-xs space-y-1.5 shadow-sm text-left">
                <div className="font-bold text-foreground flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-primary" /> Application Purpose & Google Sign-In Integration
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Netgain Portal utilizes Google Sign-In (OAuth 2.0) to provide secure Single Sign-On (SSO) for authorized client accounts. Google OAuth integration allows users to log in securely, access project workspace dashboards, and optionally synchronize project deliverable folders with Google Drive and project deadlines with Google Calendar.
                </p>
                <div className="flex items-center gap-4 pt-1 text-[11px]">
                  <Link href="/privacy" className="text-primary hover:underline font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Privacy Policy
                  </Link>
                  <Link href="/terms" className="text-primary hover:underline font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Terms of Service
                  </Link>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                <Link
                  href="/client/login"
                  className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all hover:scale-[1.02]"
                >
                  <UserCheck className="h-4 w-4" /> Sign In to Netgain Portal <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#purpose"
                  className="h-12 px-6 rounded-xl border border-border bg-card/50 hover:bg-muted/60 text-foreground font-semibold text-sm flex items-center gap-2 transition-all"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" /> View Portal Capabilities
                </a>
              </div>

              {/* Key Trust Signals */}
              <div className="pt-8 border-t border-border/40 grid grid-cols-3 gap-4 text-left max-w-xl mx-auto lg:mx-0">
                <div>
                  <p className="text-2xl font-black text-foreground">100%</p>
                  <p className="text-xs text-muted-foreground font-medium">Encrypted Storage</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-foreground">24/7</p>
                  <p className="text-xs text-muted-foreground font-medium">Agreement Access</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-foreground">99.9%</p>
                  <p className="text-xs text-muted-foreground font-medium">Uptime SLA</p>
                </div>
              </div>
            </div>

            {/* Right: Embedded Portal Login Card */}
            <div id="login-section" className="lg:col-span-5 w-full max-w-md mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="border-border/80 bg-card/90 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-gold to-amber-500" />
                  
                  <CardHeader className="space-y-1 pb-4 pt-6 text-left">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-xs font-semibold">
                        {loginMode === 'client' ? (
                          <>
                            <Shield className="h-3.5 w-3.5 text-primary" /> Client Portal Access
                          </>
                        ) : (
                          <>
                            <Lock className="h-3.5 w-3.5 text-amber-500" /> Staff Operating System
                          </>
                        )}
                      </div>
                      
                      {/* Subtle status indicator */}
                      <span className="flex items-center gap-1.5 text-[11px] text-emerald-500 font-medium">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live System
                      </span>
                    </div>

                    <CardTitle className="text-2xl font-bold tracking-tight pt-2">
                      {loginMode === 'client' ? 'Sign In to Netgain Portal' : 'Internal Staff Login'}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      {loginMode === 'client'
                        ? 'Access your Netgain Portal client workspace, statements of work, invoices, and deliverables.'
                        : 'Enter internal administrator credentials to launch Netgain OS.'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 pb-6">
                    <form onSubmit={loginMode === 'client' ? handleClientLogin : handleAdminLogin} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="portal-email" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-primary" /> Email Address
                        </Label>
                        <Input
                          id="portal-email"
                          type="email"
                          placeholder={loginMode === 'client' ? 'client@company.com' : 'admin@netgain.studio'}
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="h-10 bg-background/60 border-border text-foreground"
                          autoComplete="email"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <Label htmlFor="portal-password" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5 text-primary" /> Password
                          </Label>
                          {loginMode === 'client' && (
                            <span className="text-[11px] text-muted-foreground hover:text-primary cursor-pointer">
                              Forgot password?
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <Input
                            id="portal-password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="h-10 pr-10 bg-background/60 border-border text-foreground"
                            autoComplete="current-password"
                            required
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-11 font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/95 shadow-md flex items-center justify-center gap-2 rounded-lg"
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            Authenticating...
                          </span>
                        ) : (
                          <>
                            {loginMode === 'client' ? 'Log In to Client Portal' : 'Log In to Admin OS'}
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </form>

                    {/* Notice & Discreet Admin Toggle */}
                    <div className="pt-3 border-t border-border/40 text-center space-y-2">
                      <p className="text-[11px] text-muted-foreground">
                        Protected by Netgain 256-bit SSL encryption.
                      </p>

                      {/* DISCREET ADMIN PORTAL TOGGLE (Secret / Unhighlighted) */}
                      <div className="flex items-center justify-center pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setLoginMode(prev => (prev === 'admin' ? 'client' : 'admin'))
                            setEmail('')
                            setPassword('')
                          }}
                          className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground flex items-center gap-1 transition-colors group cursor-pointer focus:outline-none"
                          title="Portal Switcher"
                        >
                          <Lock className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                          <span>
                            {loginMode === 'client' ? 'Internal System Entry' : 'Return to Client Portal Sign In'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

          </div>
        </section>

        {/* Application Purpose & OAuth Disclosure Section */}
        <section id="purpose" className="py-16 bg-background border-t border-border/40 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold">
              <Shield className="h-3.5 w-3.5" /> Application Purpose & Scope Declaration
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight">About Netgain Portal</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Netgain Portal is an enterprise business operating workspace designed to connect Netgain Studio with our corporate clients and partners.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-card border border-border/70 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                1
              </div>
              <h3 className="font-bold text-lg">Client Workspace & Services</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Netgain Portal allows clients to access digital Statements of Work (SOW), project deliverables, task milestones, financial invoices, and encrypted document storage vaults in real time.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/70 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-lg">
                2
              </div>
              <h3 className="font-bold text-lg">Google Account Single Sign-On</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Users authenticate securely using Google Sign-In (OAuth 2.0). Google SSO enables authorized clients and internal staff to access their Netgain Portal dashboard seamlessly without maintaining redundant passwords.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/70 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-lg">
                3
              </div>
              <h3 className="font-bold text-lg">Google Workspace Integration</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Netgain Portal optionally integrates with Google Drive and Google Calendar to allow users to view project folder files, sync meeting schedules, and collaborate on deliverables within their organization.
              </p>
            </div>
          </div>

          <div className="mt-8 p-4 rounded-xl bg-muted/40 border border-border/60 text-center text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-4">
            <span>
              Netgain Portal strictly adheres to Google API Services User Data Policy. Read our full data practices:
            </span>
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="text-primary hover:underline font-semibold">Privacy Policy</Link>
              <Link href="/terms" className="text-primary hover:underline font-semibold">Terms of Service</Link>
            </div>
          </div>
        </section>

        {/* Feature Showcase Grid */}
        <section id="features" className="py-16 bg-muted/20 border-y border-border/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-3xl font-extrabold tracking-tight">Enterprise Client & Operations Suite</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Engineered for clarity, speed, and complete transparency between Netgain and our valued partners.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Card 1 */}
              <div className="p-6 rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg mb-2">Agreements & SOWs</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Review digital statements of work, formal proposals, and legally binding agreements with instant e-signatures.
                </p>
              </div>

              {/* Card 2 */}
              <div className="p-6 rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-xl bg-gold/10 text-gold flex items-center justify-center mb-4">
                  <Layers className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg mb-2">Project Deliverables</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Track real-time milestone completions, design reviews, and engineering updates in a consolidated timeline.
                </p>
              </div>

              {/* Card 3 */}
              <div className="p-6 rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
                  <Building2 className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg mb-2">Invoices & Statements</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Access transparent financial statements, tax invoices, payment histories, and upcoming billing schedules.
                </p>
              </div>

              {/* Card 4 */}
              <div className="p-6 rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg mb-2">Bank-Grade Vault</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Every document is protected with role-based access control, cryptographic verification, and audit logs.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* Security & Access Section */}
        <section id="security" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="rounded-3xl bg-gradient-to-r from-card via-background to-card border border-border/80 p-8 md:p-12 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-xl">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary">
                <Shield className="h-4 w-4" /> Need assistance accessing your client account?
              </div>
              <h3 className="text-2xl font-bold">Secure Single Sign-On for Authorized Partners</h3>
              <p className="text-sm text-muted-foreground">
                Client accounts are provisioned directly by your dedicated Netgain Account Executive. Sign in with Google SSO or your email credentials.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/client/login"
                className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center gap-2 hover:bg-primary/90 transition-all"
              >
                <KeyRound className="h-4 w-4" /> Client Portal Login
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/40 py-10 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <img src="/logo.png" className="h-6 w-6 object-contain" alt="Netgain" />
            <span className="font-bold text-foreground">NETGAIN PORTAL</span>
            <span>&copy; {new Date().getFullYear()} Netgain Studio. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#overview" className="hover:text-foreground transition-colors">Overview</a>
            <a href="#purpose" className="hover:text-foreground transition-colors">App Purpose</a>
            <a href="#features" className="hover:text-foreground transition-colors">Client Services</a>
            <Link href="/privacy" className="hover:text-foreground transition-colors font-medium text-foreground">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors font-medium text-foreground">Terms of Service</Link>
            
            {/* DISCREET ADMIN PORTAL FOOTER LINK (Secret / Not highlighted) */}
            <a 
              href="/login" 
              className="text-muted-foreground/30 hover:text-muted-foreground transition-colors text-[10px] flex items-center gap-1"
              title="Staff Portal Login"
            >
              <Lock className="h-2.5 w-2.5" /> Staff
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
