'use client'

import { useUser } from '@/components/user-provider'

export function usePermissions() {
  const { user } = useUser()

  const hasPermission = (mod: string, op: string) => {
    if (!user) return false
    
    // Founder role has absolute system-wide access
    if (user.role === 'Founder') return true
    
    // Admin has full access except settings by default
    if (user.role === 'Admin' && mod !== 'settings') return true

    // Check if user has explicit 'all' permission grant
    if (user.permissions.includes('all')) return true

    // Check if user has legacy full module access (e.g. 'crm')
    if (user.permissions.includes(mod)) return true

    // Check custom fine-grained permission format: 'module:operation' (e.g. 'crm:create')
    return user.permissions.includes(`${mod}:${op}`)
  }

  return {
    hasPermission,
    role: user?.role,
    permissions: user?.permissions || []
  }
}
