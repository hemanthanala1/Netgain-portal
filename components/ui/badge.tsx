import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        danger: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        neutral: 'text-foreground border-border bg-muted/40',
        outline: 'text-foreground border-border',
        gold: 'border-gold/25 bg-gold/10 text-gold-dark dark:text-gold',
        success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        warning: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400',
        info: 'border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400',
        purple: 'border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-400',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
