'use client'

import * as React from 'react'
import { AlertCircle, RotateCcw, Home, HelpCircle } from 'lucide-react'
import { Button } from './button'
import Link from 'next/link'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  showHome?: boolean
  showSupport?: boolean
}

export function ErrorState({
  title = 'An error occurred',
  description = 'There was a problem loading this section or communicating with our servers.',
  onRetry,
  retryLabel = 'Retry Request',
  showHome = true,
  showSupport = true
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 rounded-xl border border-destructive/20 bg-destructive/5 min-h-[300px] animate-fade-in w-full">
      <div className="p-4 rounded-full bg-destructive/10 text-destructive mb-4 border border-destructive/20">
        <AlertCircle className="h-8 w-8 animate-pulse" />
      </div>
      <h3 className="text-base font-bold text-destructive">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1.5 max-w-md leading-relaxed">{description}</p>
      
      <div className="flex items-center gap-3 mt-6">
        {onRetry && (
          <Button variant="default" size="sm" onClick={onRetry} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            {retryLabel}
          </Button>
        )}
        {showHome && (
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Home className="h-3.5 w-3.5" />
              Return Home
            </Button>
          </Link>
        )}
        {showSupport && (
          <Link href="/support">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <HelpCircle className="h-3.5 w-3.5" />
              Support
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
