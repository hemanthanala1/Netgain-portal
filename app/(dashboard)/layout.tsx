'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/topbar'
import { useState } from 'react'
import { UserProvider } from '@/components/user-provider'
import { CommandPalette } from '@/components/ui/command-palette'
import { KeyboardShortcuts } from '@/components/ui/keyboard-shortcuts'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <UserProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Mobile Sidebar overlay */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        
        {/* Mobile Sidebar drawer */}
        <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 md:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar onMobileCloseAction={() => setMobileMenuOpen(false)} />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden min-w-0 bg-muted/20">
          <TopBar onMenuClickAction={() => setMobileMenuOpen(true)} />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6 md:p-8 max-w-[1440px] mx-auto animate-fade-in transition-all duration-300">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Global Utilities */}
      <CommandPalette />
      <KeyboardShortcuts />
    </UserProvider>
  )
}

