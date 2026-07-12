'use client'
import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, CheckCircle2 } from 'lucide-react'

export type TemplateId = 'modern' | 'corporate' | 'minimal' | 'elegant'

interface Template {
  id: TemplateId
  name: string
  description: string
  // Visual palette preview
  bg: string
  accent: string
  text: string
  cardBg: string
  border: string
  badge: string
}

const TEMPLATES: Template[] = [
  {
    id: 'modern',
    name: 'Professional Modern',
    description: 'Dark elegant theme with gold accents. Premium look for high-value clients.',
    bg: '#0A1612',
    accent: '#D4AF37',
    text: '#F8FAFC',
    cardBg: '#12241D',
    border: '#1E3A2F',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'Clean white & navy blue. Formal, trust-building layout for enterprises.',
    bg: '#FFFFFF',
    accent: '#1E3A5F',
    text: '#0F172A',
    cardBg: '#F1F5F9',
    border: '#CBD5E1',
    badge: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Pure white with subtle grey tones. Clean, distraction-free presentation.',
    bg: '#FFFFFF',
    accent: '#111827',
    text: '#374151',
    cardBg: '#FAFAFA',
    border: '#E5E7EB',
    badge: 'bg-gray-500/15 text-gray-600 border-gray-500/30',
  },
  {
    id: 'elegant',
    name: 'Elegant',
    description: 'Warm cream with deep forest green. Sophisticated, boutique-agency feel.',
    bg: '#FEFDF8',
    accent: '#1A3D2B',
    text: '#1C1917',
    cardBg: '#F5F0E8',
    border: '#D6CFC0',
    badge: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  },
]

interface TemplateSelectorProps {
  value: TemplateId
  onChange: (id: TemplateId) => void
  onPreview?: (id: TemplateId) => void
  disabled?: boolean
}

export function TemplateSelector({ value, onChange, onPreview, disabled }: TemplateSelectorProps) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        {TEMPLATES.map((t) => {
          const isSelected = value === t.id
          return (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(t.id)}
              className={[
                'relative flex flex-col gap-0 rounded-xl border text-left transition-all duration-200 overflow-hidden',
                'hover:shadow-md focus:outline-none',
                isSelected
                  ? 'border-[#D4AF37] shadow-[0_0_0_2px_rgba(212,175,55,0.25)] ring-1 ring-[#D4AF37]/30'
                  : 'border-border hover:border-border/80',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {/* Mini document preview thumbnail */}
              <div
                className="w-full h-20 relative flex-shrink-0"
                style={{ backgroundColor: t.bg, borderBottom: `2px solid ${t.accent}` }}
              >
                {/* Header bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-6 flex items-center justify-between px-2.5"
                  style={{ backgroundColor: t.bg, borderBottom: `1px solid ${t.border}` }}
                >
                  <div className="h-2 w-12 rounded" style={{ backgroundColor: t.accent, opacity: 0.9 }} />
                  <div className="h-1.5 w-8 rounded" style={{ backgroundColor: t.accent, opacity: 0.4 }} />
                </div>
                {/* Content rows */}
                <div className="absolute top-8 left-2.5 right-2.5 space-y-1.5">
                  <div className="flex gap-1.5">
                    <div className="h-1.5 rounded" style={{ width: '55%', backgroundColor: t.accent, opacity: 0.25 }} />
                    <div className="h-1.5 rounded" style={{ width: '30%', backgroundColor: t.accent, opacity: 0.15 }} />
                  </div>
                  <div className="h-1.5 rounded" style={{ width: '80%', backgroundColor: t.text, opacity: 0.1 }} />
                  <div className="h-1.5 rounded" style={{ width: '65%', backgroundColor: t.text, opacity: 0.07 }} />
                </div>
                {/* Card block */}
                <div
                  className="absolute bottom-1.5 left-2.5 right-2.5 h-5 rounded"
                  style={{ backgroundColor: t.cardBg, border: `1px solid ${t.border}` }}
                />
                {/* Selected checkmark */}
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 bg-[#D4AF37] text-black rounded-full p-0.5">
                    <CheckCircle2 className="h-3 w-3" />
                  </div>
                )}
              </div>

              {/* Info section */}
              <div className="p-2.5 bg-card flex flex-col gap-1 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[11px] font-semibold text-foreground leading-tight">{t.name}</p>
                  {isSelected && (
                    <Badge className="text-[8px] px-1.5 py-0 h-4 bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">{t.description}</p>
                {onPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2 mt-1 gap-1 text-muted-foreground hover:text-foreground w-fit"
                    onClick={(e) => { e.stopPropagation(); onPreview(t.id) }}
                    disabled={disabled}
                  >
                    <Eye className="h-3 w-3" />
                    Preview
                  </Button>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { TEMPLATES }
