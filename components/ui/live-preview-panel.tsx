'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, FileText, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PdfPayload } from '@/lib/pdf-template'

interface LivePreviewPanelProps {
  payload: Partial<PdfPayload> | null
  /** Debounce delay in ms. Default 1400ms */
  debounceMs?: number
  /** Whether the panel is visible (used for mobile toggle) */
  visible?: boolean
}

export function LivePreviewPanel({ payload, debounceMs = 1400, visible = true }: LivePreviewPanelProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentBlobRef = useRef<string | null>(null)

  const generatePreview = useCallback(async (p: Partial<PdfPayload>) => {
    // Require at minimum clientName and docType to generate
    if (!p.docType || !p.clientName) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Preview generation failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      // Revoke previous blob to avoid memory leaks
      if (currentBlobRef.current) {
        URL.revokeObjectURL(currentBlobRef.current)
      }
      currentBlobRef.current = url
      setBlobUrl(url)
    } catch (e: any) {
      setError(e.message || 'Preview failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!payload) return
    // Clear previous timer
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      generatePreview(payload)
    }, debounceMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [payload, debounceMs, generatePreview])

  // Cleanup blob on unmount
  useEffect(() => {
    return () => {
      if (currentBlobRef.current) URL.revokeObjectURL(currentBlobRef.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div className="flex flex-col h-full border border-border rounded-xl overflow-hidden bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
          <span className="text-[11px] font-semibold text-foreground tracking-wide uppercase">Live Preview</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Action"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => setZoom(z => Math.max(60, z - 25))}
            title="Zoom out"
          >
            <ZoomOut className="h-3 w-3" />
          </Button>
          <span className="text-[10px] text-muted-foreground w-9 text-center font-mono">{zoom}%</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Action"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => setZoom(z => Math.min(200, z + 25))}
            title="Zoom in"
          >
            <ZoomIn className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Action"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => setZoom(100)}
            title="Reset zoom"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 bg-[#111] overflow-auto relative">
        {!payload?.clientName ? (
          /* Empty state — waiting for form data */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6">
            <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-[#D4AF37]/60" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground">Live Preview</p>
            <p className="text-[10px] text-muted-foreground/60 max-w-[160px]">
              Enter client name and select services to see a real-time document preview
            </p>
          </div>
        ) : loading && !blobUrl ? (
          /* First-load spinner */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" />
            <p className="text-xs text-muted-foreground">Generating preview…</p>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-xs font-semibold text-red-400">Preview failed</p>
            <p className="text-[10px] text-muted-foreground">{error}</p>
          </div>
        ) : blobUrl ? (
          /* PDF iframe with zoom */
          <div className="w-full h-full relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#111]/60 backdrop-blur-sm">
                <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" />
              </div>
            )}
            <div
              className="w-full h-full flex justify-center"
              style={{ overflow: 'auto', colorScheme: 'light' }}
            >
              <iframe
                src={`${blobUrl}#view=FitH`}
                className="border-0 bg-white shadow-2xl"
                style={{
                  width: `${zoom}%`,
                  minWidth: '300px',
                  height: `${Math.round(zoom * 1.3)}%`,
                  minHeight: '500px',
                  transformOrigin: 'top center',
                  colorScheme: 'light',
                }}
                title="Document Preview"
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-border bg-card flex-shrink-0">
        <p className="text-[9px] text-muted-foreground text-center">
          Preview updates automatically · {debounceMs / 1000}s delay
        </p>
      </div>
    </div>
  )
}
