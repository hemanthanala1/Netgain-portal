'use client'

import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function PermissionDeniedState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4 max-w-md mx-auto">
      <div className="p-4 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse">
        <ShieldAlert className="h-12 w-12 text-red-400" />
      </div>
      <h3 className="text-lg font-bold text-foreground">Access Denied</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        You do not have the required permissions to view this resource. Contact your administrator if you believe this is an error.
      </p>
      <Link href="/dashboard">
        <Button variant="outline" size="sm" className="mt-2 text-xs border-border/80 hover:border-gold hover:text-gold transition-colors">
          Go Back to Dashboard
        </Button>
      </Link>
    </div>
  )
}
