'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Sparkles, BookOpen, FileText, Brain, Cpu, ArrowRight,
  Download, Zap, TrendingUp, Shield, FolderOpen, Clock
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export default function AIHubPage() {
  const [stats, setStats] = useState({ skills: 0, prompts: 0, documents: 0, pendingApprovals: 0 })

  useEffect(() => {
    async function loadStats() {
      if (!isSupabaseConfigured()) return
      try {
        const [skillsRes, promptsRes, docsRes, approvalsRes] = await Promise.all([
          supabase.from('ai_skills').select('id', { count: 'exact', head: true }),
          supabase.from('ai_prompts').select('id', { count: 'exact', head: true }),
          supabase.from('ai_documents').select('id', { count: 'exact', head: true }),
          supabase.from('ai_approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
        ])
        setStats({
          skills: skillsRes.count || 0,
          prompts: promptsRes.count || 0,
          documents: docsRes.count || 0,
          pendingApprovals: approvalsRes.count || 0,
        })
      } catch { /* silently fail — tables may not exist yet */ }
    }
    loadStats()
  }, [])

  const quickActions = [
    {
      title: 'Skills Library',
      description: 'Download official Claude Skills for AI document generation',
      icon: Sparkles,
      href: '/ai-hub/skills',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      title: 'Prompt Library',
      description: 'Browse and manage reusable AI prompts across categories',
      icon: BookOpen,
      href: '/ai-hub/prompts',
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
    },
    {
      title: 'Knowledge Base',
      description: 'Company documents, SOPs, brand guidelines, and templates',
      icon: FolderOpen,
      href: '/ai-hub/knowledge',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
    },
    {
      title: 'AI Providers',
      description: 'View available AI integrations — coming soon',
      icon: Cpu,
      href: '/ai-hub/providers',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
  ]

  const engines = [
    {
      title: 'Campaign Strategy Engine',
      description: 'Generate complete marketing strategies with AI-powered prompts',
      icon: TrendingUp,
      href: '/projects',
      tag: 'Marketing',
    },
    {
      title: 'Development Blueprint Engine',
      description: 'Create comprehensive PRDs for development projects',
      icon: FileText,
      href: '/prd',
      tag: 'Product',
    },
    {
      title: 'Marketing Intelligence Engine',
      description: 'Analyze and generate marketing performance reports',
      icon: Brain,
      href: '/marketing',
      tag: 'Analytics',
    },
  ]

  const workflow = [
    { step: 1, label: 'Enter Details', desc: 'Fill in business or project information in the ERP', icon: '📝' },
    { step: 2, label: 'Generate Prompt', desc: 'AI prompt is auto-generated from your data', icon: '✨' },
    { step: 3, label: 'Download Skill', desc: 'Get the matching Claude Skill from the library', icon: '⬇️' },
    { step: 4, label: 'Open Claude', desc: 'Import the skill and paste the prompt', icon: '🤖' },
    { step: 5, label: 'Generate Document', desc: 'Claude generates your strategy, PRD, or report', icon: '📄' },
    { step: 6, label: 'Upload & Store', desc: 'Upload the generated document back to ERP', icon: '☁️' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl gold-gradient flex items-center justify-center">
              <Zap className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AI Hub</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Central AI workspace — skills, prompts, and document generation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Skills', value: stats.skills, icon: Sparkles, color: 'text-amber-400' },
          { label: 'Prompts', value: stats.prompts, icon: BookOpen, color: 'text-violet-400' },
          { label: 'Documents', value: stats.documents, icon: FileText, color: 'text-cyan-400' },
          { label: 'Pending Approvals', value: stats.pendingApprovals, icon: Shield, color: 'text-orange-400' },
        ].map(s => (
          <Card key={s.label} className="ai-card ai-card-glow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                {s.label === 'Pending Approvals' && s.value > 0 && (
                  <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
                )}
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map(action => (
            <Link key={action.href} href={action.href}>
              <Card className="ai-card ai-card-glow h-full group cursor-pointer">
                <CardContent className="p-5">
                  <div className={`h-10 w-10 rounded-xl ${action.bg} flex items-center justify-center mb-3`}>
                    <action.icon className={`h-5 w-5 ${action.color}`} />
                  </div>
                  <h3 className="text-sm font-semibold mb-1 group-hover:text-gold transition-colors">{action.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{action.description}</p>
                  <div className="flex items-center gap-1 mt-3 text-[10px] font-medium text-gold/70 group-hover:text-gold transition-colors">
                    Open <ArrowRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* AI Engines */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">AI-Powered Engines</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {engines.map(engine => (
            <Link key={engine.href} href={engine.href}>
              <Card className="ai-card ai-card-glow h-full group cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-10 w-10 rounded-xl bg-gold/10 flex items-center justify-center">
                      <engine.icon className="h-5 w-5 text-gold" />
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gold/10 text-gold/80">{engine.tag}</span>
                  </div>
                  <h3 className="text-sm font-semibold mb-1 group-hover:text-gold transition-colors">{engine.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{engine.description}</p>
                  <div className="flex items-center gap-1 mt-3 text-[10px] font-medium text-gold/70 group-hover:text-gold transition-colors">
                    Launch Engine <ArrowRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Workflow */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">How It Works</h2>
        <Card className="ai-card ai-card-glow">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {workflow.map((step, i) => (
                <div key={step.step} className="relative text-center group">
                  <div className="flex flex-col items-center">
                    <div className="text-2xl mb-2">{step.icon}</div>
                    <div className="text-[10px] font-bold text-gold/60 mb-0.5">STEP {step.step}</div>
                    <p className="text-xs font-semibold mb-1">{step.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                  {i < workflow.length - 1 && (
                    <div className="hidden lg:block absolute top-5 -right-2 text-muted-foreground/30">→</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Future Integration Notice */}
      <Card className="border-gold/20 bg-gold/[0.02]">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-gold" />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">API Integration Coming Soon</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Currently, Claude Skills are used manually. The ERP is designed for seamless API integration — when ready,
              documents will be generated directly inside the ERP without changing your workflow.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
