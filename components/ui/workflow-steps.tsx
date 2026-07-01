'use client'
import { cn } from '@/lib/utils'
import { Edit, Sparkles, Download, ExternalLink, FileText, Upload, CheckCircle2 } from 'lucide-react'

const STEP_ICONS = {
  edit: Edit,
  sparkles: Sparkles,
  download: Download,
  'external-link': ExternalLink,
  'file-text': FileText,
  upload: Upload,
  'check-circle': CheckCircle2,
}

interface WorkflowStep {
  step: number
  label: string
  icon: keyof typeof STEP_ICONS
}

interface WorkflowStepsProps {
  steps: readonly WorkflowStep[]
  currentStep?: number
  className?: string
}

export function WorkflowSteps({ steps, currentStep = 0, className }: WorkflowStepsProps) {
  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto pb-1', className)}>
      {steps.map((step, i) => {
        const Icon = STEP_ICONS[step.icon]
        const isCompleted = currentStep > step.step
        const isCurrent = currentStep === step.step
        const isPending = currentStep < step.step

        return (
          <div key={step.step} className="flex items-center shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300',
                isCompleted && 'border-emerald-500 bg-emerald-500/10',
                isCurrent && 'border-gold bg-gold/10 shadow-sm shadow-gold/20',
                isPending && 'border-border bg-muted/30'
              )}>
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Icon className={cn('h-3.5 w-3.5', isCurrent ? 'text-gold' : 'text-muted-foreground/50')} />
                )}
              </div>
              <span className={cn(
                'text-[9px] font-medium text-center max-w-[60px] leading-tight',
                isCompleted && 'text-emerald-400',
                isCurrent && 'text-gold',
                isPending && 'text-muted-foreground/40'
              )}>
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className={cn(
                'h-px w-6 mx-1 mt-[-12px] transition-colors',
                isCompleted ? 'bg-emerald-500/50' : 'bg-border'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}
