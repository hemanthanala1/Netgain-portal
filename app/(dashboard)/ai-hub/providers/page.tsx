'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Cpu, Brain, Sparkles, Gem, Route, Search as SearchIcon,
  MessageCircle, Server, Zap, Lock, Clock, ExternalLink
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { AIProvider } from '@/lib/ai-types'

const PROVIDER_ICONS: Record<string, any> = {
  brain: Brain, sparkles: Sparkles, gem: Gem, route: Route,
  search: SearchIcon, 'message-circle': MessageCircle,
  server: Server, zap: Zap,
}

const PROVIDER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Claude': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  'OpenAI': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  'Gemini': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  'OpenRouter': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  'DeepSeek': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  'Grok': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  'Ollama': { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' },
  'Netgain AI': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
}

const defaultProviders: AIProvider[] = [
  { id: 'provider-claude', name: 'Claude', description: "Anthropic's Claude AI — advanced reasoning and document generation. Primary AI engine for Netgain.", icon: 'brain', status: 'coming_soon', api_key_configured: false, config: {}, created_at: '' },
  { id: 'provider-openai', name: 'OpenAI', description: 'GPT models for text generation, analysis, and creative writing.', icon: 'sparkles', status: 'coming_soon', api_key_configured: false, config: {}, created_at: '' },
  { id: 'provider-gemini', name: 'Gemini', description: "Google's Gemini AI for multimodal tasks — text, images, and code.", icon: 'gem', status: 'coming_soon', api_key_configured: false, config: {}, created_at: '' },
  { id: 'provider-openrouter', name: 'OpenRouter', description: 'Unified API gateway to access multiple AI providers through a single endpoint.', icon: 'route', status: 'coming_soon', api_key_configured: false, config: {}, created_at: '' },
  { id: 'provider-deepseek', name: 'DeepSeek', description: 'Advanced reasoning and code generation with competitive performance.', icon: 'search', status: 'coming_soon', api_key_configured: false, config: {}, created_at: '' },
  { id: 'provider-grok', name: 'Grok', description: "xAI's conversational AI assistant with real-time knowledge.", icon: 'message-circle', status: 'coming_soon', api_key_configured: false, config: {}, created_at: '' },
  { id: 'provider-ollama', name: 'Ollama', description: 'Run open-source LLMs locally for privacy-first AI processing.', icon: 'server', status: 'coming_soon', api_key_configured: false, config: {}, created_at: '' },
  { id: 'provider-netgain', name: 'Netgain AI', description: 'Custom AI models trained on your business data for hyper-relevant outputs.', icon: 'zap', status: 'coming_soon', api_key_configured: false, config: {}, created_at: '' },
]

export default function AIProvidersPage() {
  const [providers, setProviders] = useState<AIProvider[]>(defaultProviders)

  useEffect(() => {
    async function load() {
      if (isSupabaseConfigured()) {
        try {
          const { data } = await supabase.from('ai_providers').select('*').order('created_at')
          if (data && data.length > 0) setProviders(data as AIProvider[])
        } catch { /* table may not exist */ }
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-emerald-400" />
          <h1 className="text-2xl font-bold tracking-tight">AI Providers</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-0.5">Available AI integrations for document generation</p>
      </div>

      {/* Info Banner */}
      <Card className="border-gold/20 bg-gold/[0.02]">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-gold/10 flex items-center justify-center shrink-0 mt-0.5">
            <Clock className="h-4 w-4 text-gold" />
          </div>
          <div>
            <p className="text-sm font-semibold">API Integrations Coming Soon</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Currently, AI documents are generated using Claude Skills manually. When API integrations go live,
              you&apos;ll be able to generate documents directly inside the ERP with a single click.
              The architecture is designed for seamless transition — your workflow won&apos;t change.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Providers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {providers.map(provider => {
          const Icon = PROVIDER_ICONS[provider.icon] || Cpu
          const colors = PROVIDER_COLORS[provider.name] || PROVIDER_COLORS['Netgain AI']

          return (
            <Card key={provider.id} className="ai-card ai-card-glow relative overflow-hidden">
              {/* Coming Soon Overlay */}
              <div className="coming-soon-overlay">
                <div className="flex flex-col items-center gap-1.5">
                  <Lock className="h-5 w-5 text-muted-foreground/50" />
                  <span className="text-xs font-semibold text-muted-foreground/70">Coming Soon</span>
                </div>
              </div>

              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className={`h-12 w-12 rounded-xl ${colors.bg} flex items-center justify-center`}>
                    <Icon className={`h-6 w-6 ${colors.text}`} />
                  </div>
                  <Badge variant="outline" className="text-[10px] border-muted-foreground/20 text-muted-foreground/50">
                    {provider.status === 'coming_soon' ? 'Coming Soon' : 'Active'}
                  </Badge>
                </div>

                <h3 className="text-sm font-bold mb-1">{provider.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {provider.description}
                </p>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground/50">Not configured</span>
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/20" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Future Roadmap */}
      <Card className="ai-card">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold mb-4">Integration Roadmap</h3>
          <div className="space-y-3">
            {[
              { phase: 'Phase 1', label: 'Manual Workflow', desc: 'Use Claude Skills manually with prompt copy/paste', status: 'Active', color: 'bg-emerald-400' },
              { phase: 'Phase 2', label: 'Claude API', desc: 'Direct Claude API integration for one-click document generation', status: 'Planned', color: 'bg-amber-400' },
              { phase: 'Phase 3', label: 'Multi-Provider', desc: 'Support for OpenAI, Gemini, DeepSeek, and more', status: 'Future', color: 'bg-blue-400' },
              { phase: 'Phase 4', label: 'Netgain AI', desc: 'Custom models trained on your business data', status: 'Future', color: 'bg-purple-400' },
            ].map(item => (
              <div key={item.phase} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-gold/20 transition-colors">
                <div className={`h-2 w-2 rounded-full ${item.color} shrink-0`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground">{item.phase}</span>
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
                <Badge variant="outline" className={`text-[10px] ${item.status === 'Active' ? 'text-emerald-400 border-emerald-500/30' : 'text-muted-foreground/50'}`}>
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
