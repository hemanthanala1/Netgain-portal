'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { type ThemeProviderProps } from 'next-themes/dist/types'
import { usePathname } from 'next/navigation'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const pathname = usePathname()
  const isClientPortal = pathname?.startsWith('/client') || pathname?.startsWith('/sign')
  const storageKey = isClientPortal ? 'nbos-client-theme' : 'nbos-admin-theme'

  return (
    <NextThemesProvider {...props} storageKey={storageKey}>
      {children}
    </NextThemesProvider>
  )
}

