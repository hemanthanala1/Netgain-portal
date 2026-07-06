'use client'

import * as React from 'react'
import { LucideIcon } from 'lucide-react'
import { Button } from './button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    icon?: LucideIcon
  }
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 rounded-xl border border-dashed border-border bg-card/25 min-h-[300px] animate-fade-in w-full">
      <div className="p-4 rounded-full bg-primary/5 text-primary/60 mb-4 border border-primary/10">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">{description}</p>
      {action && (
        <Button
          variant="gold"
          size="sm"
          onClick={action.onClick}
          className="mt-5 gap-1.5"
        >
          {action.icon && <action.icon className="h-4 w-4" />}
          {action.label}
        </Button>
      )}
    </div>
  )
}
