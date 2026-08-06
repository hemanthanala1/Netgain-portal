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
    <div className={cn('flex items-start justify-between w-full overflow-x-auto py-2 px-1', className)}>
      {steps.map((step, i) => {
        const Icon = STEP_ICONS[step.icon]
        const isCompleted = currentStep > step.step
        const isCurrent = currentStep === step.step
        const isPending = currentStep < step.step

        return (
          <div key={step.step} className="flex items-start flex-1 last:flex-initial min-w-0">
            <div className="flex flex-col items-center text-center w-full">
              {/* Step Circle */}
              <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300',
                isCompleted && 'border-emerald-500 bg-emerald-500/10 text-emerald-400',
                isCurrent && 'border-gold bg-gold/20 text-gold shadow-md shadow-gold/20 scale-105',
                isPending && 'border-border bg-muted/20 text-muted-foreground/40'
              )}>
                {isCompleted ? (
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
                ) : (
                  <Icon className={cn('h-4 w-4', isCurrent ? 'text-gold' : 'text-muted-foreground/50')} />
                )}
              </div>

              {/* Step Label */}
              <span className={cn(
                'text-[10px] font-semibold text-center leading-tight mt-2 px-0.5 line-clamp-2 max-w-[76px]',
                isCompleted && 'text-emerald-400',
                isCurrent && 'text-gold font-bold',
                isPending && 'text-muted-foreground/50'
              )}>
                {step.label}
              </span>
            </div>

            {/* Connector Line - Centered relative to h-9 step circle */}
            {i < steps.length - 1 && (
              <div className="flex-1 px-1 flex items-center h-9 shrink min-w-[16px]">
                <div className={cn(
                  'h-0.5 w-full transition-colors rounded-full',
                  isCompleted ? 'bg-emerald-500/60' : 'bg-border'
                )} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

