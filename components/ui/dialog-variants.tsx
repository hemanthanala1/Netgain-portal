'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog'
import { Button } from './button'
import { CheckCircle2, AlertTriangle, AlertCircle, ShieldAlert, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BaseDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  loading?: boolean
}

// 1. Confirmation Dialog
export function ConfirmationDialog({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  loading = false,
}: BaseDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <HelpCircle className="h-5 w-5" />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          {description && <DialogDescription className="mt-2 text-xs leading-relaxed">{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="default" size="sm" onClick={onConfirm} disabled={loading}>
            {loading ? 'Processing...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 2. Delete Dialog
export function DeleteDialog({
  isOpen,
  onClose,
  title,
  description = 'This action cannot be undone. Are you sure you want to permanently delete this record?',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  loading = false,
}: BaseDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border-destructive/35">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-destructive font-bold">{title}</DialogTitle>
          </div>
          {description && <DialogDescription className="mt-2 text-xs leading-relaxed">{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={loading}>
            {loading ? 'Deleting...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 3. Success Dialog
export function SuccessDialog({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel = 'Ok',
}: BaseDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex flex-col items-center text-center space-y-3 py-4">
            <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-10 w-10 animate-bounce" />
            </div>
            <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
            {description && <DialogDescription className="text-xs">{description}</DialogDescription>}
          </div>
        </DialogHeader>
        <DialogFooter className="sm:justify-center mt-2">
          <Button variant="default" size="sm" className="px-8" onClick={onClose}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 4. Error Dialog
export function ErrorDialog({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel = 'Ok',
}: BaseDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border-destructive/35">
        <DialogHeader>
          <div className="flex flex-col items-center text-center space-y-3 py-4">
            <div className="p-3 rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            <DialogTitle className="text-xl font-bold text-destructive">{title}</DialogTitle>
            {description && <DialogDescription className="text-xs">{description}</DialogDescription>}
          </div>
        </DialogHeader>
        <DialogFooter className="sm:justify-center mt-2">
          <Button variant="destructive" size="sm" className="px-8" onClick={onClose}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 5. Warning Dialog
export function WarningDialog({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel = 'Proceed',
  cancelLabel = 'Cancel',
  onConfirm,
  loading = false,
}: BaseDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border-amber-500/35">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-amber-500 font-bold">{title}</DialogTitle>
          </div>
          {description && <DialogDescription className="mt-2 text-xs leading-relaxed">{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="default" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={onConfirm} disabled={loading}>
            {loading ? 'Processing...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 6. Unsaved Changes Dialog
export function UnsavedChangesDialog({
  isOpen,
  onClose,
  title = 'Unsaved Changes',
  description = 'You have unsaved changes. Are you sure you want to discard your changes and close this window?',
  confirmLabel = 'Discard & Close',
  cancelLabel = 'Keep Editing',
  onConfirm,
  loading = false,
}: BaseDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border-amber-500/35">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-amber-500 font-bold">{title}</DialogTitle>
          </div>
          {description && <DialogDescription className="mt-2 text-xs leading-relaxed">{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={loading}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 7. Permission Dialog
export function PermissionDialog({
  isOpen,
  onClose,
  title = 'Access Denied',
  description = 'You do not have the required permissions to perform this action or view this resource. Contact your administrator if you believe this is an error.',
  confirmLabel = 'Go Back',
}: BaseDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border-destructive/35">
        <DialogHeader>
          <div className="flex flex-col items-center text-center space-y-3 py-4">
            <div className="p-3 rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-10 w-10 animate-pulse text-destructive" />
            </div>
            <DialogTitle className="text-xl font-bold text-destructive">{title}</DialogTitle>
            {description && <DialogDescription className="text-xs">{description}</DialogDescription>}
          </div>
        </DialogHeader>
        <DialogFooter className="sm:justify-center mt-2">
          <Button variant="outline" size="sm" className="px-8" onClick={onClose}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
