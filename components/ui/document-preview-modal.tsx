import React from 'react'
import { FileText, Download, X, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DocumentPreviewModal({
  isOpen,
  onClose,
  onDownload,
  title,
  subTitle,
  blobUrl,
  loading
}: {
  isOpen: boolean
  onClose: () => void
  onDownload: () => void
  title: string
  subTitle: string
  blobUrl: string | null
  loading: boolean
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-5xl h-[85vh] flex flex-col bg-background border border-border rounded-xl overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="rounded p-2 bg-emerald-500/10 text-emerald-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{subTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-2 bg-card text-muted-foreground border-border hover:text-foreground" onClick={onDownload}>
              <Download className="h-4 w-4" /> Download PDF
            </Button>
            <Button variant="ghost" size="icon" aria-label="Action" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Modal Body / iframe Placeholder */}
        <div className="flex-1 bg-[#1A1A1A] flex flex-col items-center justify-center text-center relative overflow-hidden" style={{ colorScheme: 'light' }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-4">
              <RefreshCw className="h-8 w-8 animate-spin text-[#D4AF37]" />
              <p className="text-sm font-medium text-muted-foreground tracking-wide">Generating Document Preview...</p>
            </div>
          ) : blobUrl ? (
            <iframe src={`${blobUrl}#view=FitH`} className="w-full h-full border-0 bg-white" style={{ colorScheme: 'light' }} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3">
              <p className="text-sm font-semibold text-muted-foreground">Failed to load document preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
