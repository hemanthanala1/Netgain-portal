'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  widthClass?: string // e.g. max-w-xl
  loading?: boolean
  hasUnsavedChanges?: boolean
}

export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  widthClass = 'max-w-xl',
  loading = false,
  hasUnsavedChanges = false,
}: DrawerProps) {
  // Handle unsaved changes warning
  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose()
      }
    } else {
      onClose()
    }
  }

  // Keyboard accessibility
  React.useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleClose()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, hasUnsavedChanges])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          {/* Backdrop Click */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 cursor-default"
            onClick={handleClose}
          />

          {/* Drawer content */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className={cn(
              "relative w-full bg-card border-l border-border h-full flex flex-col justify-between shadow-2xl text-foreground z-50",
              widthClass
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border p-5 shrink-0">
              <div className="space-y-1">
                {title && <h2 className="text-base font-bold text-foreground">{title}</h2>}
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Close drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-card/60">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                children
              )}
            </div>

            {/* Footer */}
            {footer && (
              <div className="border-t border-border p-4 bg-muted/40 shrink-0 sticky bottom-0 flex justify-end gap-2">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
