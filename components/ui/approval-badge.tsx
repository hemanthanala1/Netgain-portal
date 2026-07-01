'use client'
import { cn } from '@/lib/utils'
import { getApprovalStatusColor, getApprovalStatusLabel } from '@/lib/ai-utils'
import type { ApprovalStatus } from '@/lib/ai-types'

interface ApprovalBadgeProps {
  status: ApprovalStatus | string
  className?: string
  size?: 'sm' | 'md'
}

export function ApprovalBadge({ status, className, size = 'sm' }: ApprovalBadgeProps) {
  const dotColors: Record<string, string> = {
    draft: 'bg-gray-400',
    pending_review: 'bg-amber-400',
    approved: 'bg-emerald-400',
    rejected: 'bg-red-400',
    needs_revision: 'bg-orange-400',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        getApprovalStatusColor(status as ApprovalStatus),
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dotColors[status] || 'bg-gray-400')} />
      {getApprovalStatusLabel(status)}
    </span>
  )
}
