'use client'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Globe, Eye, EyeOff, RefreshCw, Trash2, ArrowUpCircle, Loader2 } from 'lucide-react'

interface PublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  docTitle: string
  docId: string
  isPublished: boolean
  visibilityStatus: string
  currentVersion: number
  onAction: (action: 'publish' | 'unpublish' | 'hide' | 'republish' | 'replace' | 'show') => Promise<void>
}

export function PublishDialog({
  open,
  onOpenChange,
  docTitle,
  docId,
  isPublished,
  visibilityStatus,
  currentVersion,
  onAction
}: PublishDialogProps) {
  const [selectedAction, setSelectedAction] = useState<'publish' | 'unpublish' | 'hide' | 'republish' | 'replace' | 'show'>('publish')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      if (!isPublished) {
        setSelectedAction('publish')
      } else {
        setSelectedAction('republish')
      }
    }
  }, [open, isPublished])

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onAction(selectedAction)
      toast({
        title: `✅ Action Completed`,
        description: `Successfully applied action: "${selectedAction}" to document ${docId}`
      })
      onOpenChange(false)
    } catch (e: any) {
      toast({
        title: 'Action failed',
        description: e.message,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const isHidden = visibilityStatus === 'hidden'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gold">
            <Globe className="h-5 w-5 text-gold" />
            {isPublished ? 'Manage Publication' : 'Publish Document'}
          </DialogTitle>
          <DialogDescription>
            Configure how <strong>{docTitle} ({docId})</strong> is displayed in the Client Portal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isPublished ? (
            <div className="bg-gold/5 border border-gold/20 rounded-xl p-4 text-sm space-y-2">
              <p className="font-semibold text-gold">Publish to Client Portal</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                This document will become visible in the client's portal. The client will be able to view, download, and digitally sign it (if applicable).
              </p>
              <p className="text-xs text-slate-400 font-medium">
                Version: {currentVersion || 1}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gold uppercase tracking-wider mb-2">Select Action</p>
              
              {/* Option 1: Republish Updated Version */}
              <button
                onClick={() => setSelectedAction('republish')}
                className={`flex items-start gap-3 w-full p-3.5 rounded-xl border transition-all text-left ${selectedAction === 'republish' ? 'border-gold bg-gold/5' : 'border-border hover:border-gold/20'}`}
              >
                <RefreshCw className={`h-5 w-5 shrink-0 mt-0.5 ${selectedAction === 'republish' ? 'text-gold' : 'text-muted-foreground'}`} />
                <div>
                  <p className="font-semibold text-sm">Republish Updated Version</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Increments the portal version to V{(currentVersion || 1) + 1}. The previous version remains archived in the history.</p>
                </div>
              </button>

              {/* Option 2: Replace Existing Version */}
              <button
                onClick={() => setSelectedAction('replace')}
                className={`flex items-start gap-3 w-full p-3.5 rounded-xl border transition-all text-left ${selectedAction === 'replace' ? 'border-gold bg-gold/5' : 'border-border hover:border-gold/20'}`}
              >
                <ArrowUpCircle className={`h-5 w-5 shrink-0 mt-0.5 ${selectedAction === 'replace' ? 'text-gold' : 'text-muted-foreground'}`} />
                <div>
                  <p className="font-semibold text-sm">Replace Existing Version</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Overwrites the currently published Version {currentVersion || 1} without incrementing the version count.</p>
                </div>
              </button>

              {/* Option 3: Hide or Show Document */}
              {isHidden ? (
                <button
                  onClick={() => setSelectedAction('show')}
                  className={`flex items-start gap-3 w-full p-3.5 rounded-xl border transition-all text-left ${selectedAction === 'show' ? 'border-emerald-500 bg-emerald-500/5' : 'border-border hover:border-emerald-500/20'}`}
                >
                  <Eye className={`h-5 w-5 shrink-0 mt-0.5 ${selectedAction === 'show' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-semibold text-sm">Show / Unhide Document</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Make this document visible again inside the client portal.</p>
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => setSelectedAction('hide')}
                  className={`flex items-start gap-3 w-full p-3.5 rounded-xl border transition-all text-left ${selectedAction === 'hide' ? 'border-amber-500 bg-amber-500/5' : 'border-border hover:border-amber-500/20'}`}
                >
                  <EyeOff className={`h-5 w-5 shrink-0 mt-0.5 ${selectedAction === 'hide' ? 'text-amber-500' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-semibold text-sm">Hide Document</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Keep the document published but hide it from the client's view temporarily.</p>
                  </div>
                </button>
              )}

              {/* Option 4: Unpublish Document */}
              <button
                onClick={() => setSelectedAction('unpublish')}
                className={`flex items-start gap-3 w-full p-3.5 rounded-xl border transition-all text-left ${selectedAction === 'unpublish' ? 'border-red-500 bg-red-500/5' : 'border-border hover:border-red-500/20'}`}
              >
                <Trash2 className={`h-5 w-5 shrink-0 mt-0.5 ${selectedAction === 'unpublish' ? 'text-red-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className="font-semibold text-sm">Unpublish Document</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Completely withdraw this document from the Client Portal.</p>
                </div>
              </button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            variant={selectedAction === 'unpublish' ? 'destructive' : 'gold'} 
            onClick={handleConfirm} 
            disabled={loading}
            className="gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {!isPublished ? 'Publish' : 'Apply Action'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
