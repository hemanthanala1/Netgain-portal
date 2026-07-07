'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { HelpCircle, Keyboard, X } from 'lucide-react'

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let lastKey = ''
    let keyTimeout: NodeJS.Timeout

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Ignore shortcuts when typing in inputs/textareas
      const activeEl = document.activeElement
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.hasAttribute('contenteditable') ||
          activeEl.closest('[role="dialog"]'))
      ) {
        // Allow escaping out of cheatsheet dialog
        if (e.key === 'Escape' && open) {
          setOpen(false)
        }
        return
      }

      // 2. Open cheatsheet with '?' (Shift + /)
      if (e.key === '?') {
        e.preventDefault()
        setOpen(o => !o)
        return
      }

      // 3. Close cheatsheet on 'Escape'
      if (e.key === 'Escape' && open) {
        setOpen(false)
        return
      }

      // 4. Sequence shortcuts (e.g., 'g' then 'd')
      if (lastKey === 'g') {
        clearTimeout(keyTimeout)
        lastKey = ''
        
        switch (e.key.toLowerCase()) {
          case 'd':
            e.preventDefault()
            router.push('/dashboard')
            return
          case 'c':
            e.preventDefault()
            router.push('/crm')
            return
          case 'p':
            e.preventDefault()
            router.push('/projects')
            return
          case 'm':
            e.preventDefault()
            router.push('/meetings')
            return
          case 's':
            e.preventDefault()
            router.push('/support')
            return
          case 't':
            e.preventDefault()
            router.push('/team')
            return
          case 'r':
            e.preventDefault()
            router.push('/reports')
            return
          case 'v':
            e.preventDefault()
            router.push('/documents/vault')
            return
          default:
            break
        }
      }

      if (e.key.toLowerCase() === 'g') {
        lastKey = 'g'
        keyTimeout = setTimeout(() => {
          lastKey = ''
        }, 1000) // 1 second window to type the next character
      }

      // 5. Action shortcuts: Alt + N (Trigger principal button click on page if present)
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        // Try to find common add buttons
        const addButtons = document.querySelectorAll(
          'button[id*="add"], button[id*="create"], a[href*="create"], [aria-label*="Add"], [aria-label*="Create"]'
        )
        if (addButtons.length > 0) {
          const btn = addButtons[0] as HTMLButtonElement | HTMLAnchorElement
          btn.click()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearTimeout(keyTimeout)
    }
  }, [open, router])

  const shortcutsList = [
    { keys: ['?'], desc: 'Toggle keyboard shortcuts cheatsheet' },
    { keys: ['Ctrl', 'K'], desc: 'Open Command Palette & Global Search' },
    { keys: ['Alt', 'N'], desc: 'Trigger current page primary action (New)' },
    { keys: ['Esc'], desc: 'Close dialogs, drawers, and menus' },
    { keys: ['g', 'd'], desc: 'Go to Dashboard', isSequence: true },
    { keys: ['g', 'c'], desc: 'Go to CRM Hub', isSequence: true },
    { keys: ['g', 'p'], desc: 'Go to Projects Engine', isSequence: true },
    { keys: ['g', 'm'], desc: 'Go to Meetings & Calendar', isSequence: true },
    { keys: ['g', 's'], desc: 'Go to Support Tickets', isSequence: true },
    { keys: ['g', 't'], desc: 'Go to Team Management', isSequence: true },
    { keys: ['g', 'r'], desc: 'Go to Reporting Center', isSequence: true },
    { keys: ['g', 'v'], desc: 'Go to Documents Vault', isSequence: true },
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md border-border/80 bg-card text-foreground shadow-2xl">
        <DialogHeader className="border-b border-border/20 pb-3">
          <DialogTitle className="text-md font-bold text-gold flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-gold animate-pulse" />
            Portal Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Boost your productivity by navigating the system instantly.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2.5 space-y-2.5 max-h-[350px] overflow-y-auto">
          {shortcutsList.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs py-1 hover:bg-muted/10 px-2 rounded-lg transition-colors"
            >
              <span className="text-muted-foreground">{s.desc}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, kIdx) => (
                  <span key={kIdx} className="flex items-center">
                    <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted/40 font-mono text-[10px] font-bold text-foreground shadow-sm">
                      {k}
                    </kbd>
                    {kIdx < s.keys.length - 1 && (
                      <span className="text-[10px] text-muted-foreground mx-1">
                        {s.isSequence ? 'then' : '+'}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border/20 pt-3 text-[10px] text-muted-foreground flex justify-between items-center">
          <span>Press <kbd className="px-1 py-0.5 rounded bg-muted/40 font-mono text-[9px] border border-border">?</kbd> at any time to toggle this panel.</span>
          <span className="font-semibold text-gold">Antigravity Business OS</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
