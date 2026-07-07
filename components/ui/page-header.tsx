'use client'

import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  primaryAction?: {
    label: string
    onClick: () => void
    icon?: React.ComponentType<{ className?: string }>
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'gold'
    disabled?: boolean
  }
  secondaryActions?: React.ReactNode
  searchSlot?: React.ReactNode
  filterSlot?: React.ReactNode
  exportSlot?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  primaryAction,
  secondaryActions,
  searchSlot,
  filterSlot,
  exportSlot,
}: PageHeaderProps) {
  return (
    <div className="space-y-5 mb-8">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium" aria-label="Breadcrumb">
          {breadcrumbs.map((item, idx) => {
            const isLast = idx === breadcrumbs.length - 1
            return (
              <React.Fragment key={idx}>
                {item.href && !isLast ? (
                  <Link href={item.href} className="hover:text-foreground transition-colors">
                    {item.label}
                  </Link>
                ) : (
                  <span className={cn(isLast && "text-foreground font-semibold")}>{item.label}</span>
                )}
                {!isLast && <span className="text-muted-foreground/40">/</span>}
              </React.Fragment>
            )
          })}
        </nav>
      )}

      {/* Main Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground/80">{description}</p>}
        </div>

        {/* Action buttons (Primary & Secondary) */}
        {(primaryAction || secondaryActions) && (
          <div className="flex items-center gap-2 shrink-0">
            {secondaryActions}
            {primaryAction && (
              <button
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                className={cn(
                  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium h-9 px-4 py-2 transition-all duration-200",
                  primaryAction.variant === 'gold' 
                    ? "gold-gradient text-slate-950 font-semibold border border-gold/30 hover:opacity-90 active:scale-95 shadow-md"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
                  "disabled:pointer-events-none disabled:opacity-50"
                )}
              >
                {primaryAction.icon && <primaryAction.icon className="h-4 w-4 shrink-0" />}
                {primaryAction.label}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Optional Search / Filters / Export Toolbar */}
      {(searchSlot || filterSlot || exportSlot) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            {searchSlot && <div className="w-full sm:max-w-md">{searchSlot}</div>}
            {filterSlot && <div className="flex items-center gap-2">{filterSlot}</div>}
          </div>
          {exportSlot && <div className="shrink-0">{exportSlot}</div>}
        </div>
      )}
    </div>
  )
}
