'use client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Copy, Download, ExternalLink, Check, Sparkles } from 'lucide-react'
import { copyToClipboard, downloadAsTextFile } from '@/lib/ai-utils'

interface PromptViewerProps {
  prompt: string
  title?: string
  onCopy?: () => void
  downloadFilename?: string
  className?: string
  showActions?: boolean
}

export function PromptViewer({
  prompt,
  title = 'Generated Prompt',
  onCopy,
  downloadFilename = 'prompt.txt',
  className,
  showActions = true,
}: PromptViewerProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const success = await copyToClipboard(prompt)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      onCopy?.()
    }
  }

  const handleDownload = () => {
    downloadAsTextFile(prompt, downloadFilename)
  }

  const handleOpenClaude = () => {
    window.open('https://claude.ai', '_blank')
  }

  if (!prompt) {
    return (
      <div className={cn('rounded-xl border border-dashed border-border p-8 text-center', className)}>
        <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No prompt generated yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Fill in the details and click &quot;Generate Prompt&quot;</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gold/10 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
          </div>
          <h4 className="text-sm font-semibold">{title}</h4>
        </div>
        {showActions && (
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleCopy}>
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleDownload}>
              <Download className="h-3 w-3" />
              Download
            </Button>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs border-gold/30 text-gold hover:bg-gold/10 hover:text-gold" onClick={handleOpenClaude}>
              <ExternalLink className="h-3 w-3" />
              Open Claude
            </Button>
          </div>
        )}
      </div>

      <div className="relative rounded-xl border border-border bg-muted/20 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-muted/40 to-transparent pointer-events-none z-10" />
        <pre className="p-4 text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto font-mono">
          {prompt}
        </pre>
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-muted/40 to-transparent pointer-events-none z-10" />
      </div>

      <p className="text-[10px] text-muted-foreground/60 text-right">
        {prompt.length.toLocaleString()} characters · {prompt.split(/\s+/).length.toLocaleString()} words
      </p>
    </div>
  )
}
