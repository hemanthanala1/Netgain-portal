'use client'
import { useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Upload, X, FileText, File } from 'lucide-react'
import { formatFileSize } from '@/lib/ai-utils'

interface FileUploadProps {
  accept?: string
  multiple?: boolean
  maxSizeMB?: number
  onFilesSelected: (files: File[]) => void
  className?: string
  label?: string
  description?: string
}

export function FileUpload({
  accept,
  multiple = false,
  maxSizeMB = 50,
  onFilesSelected,
  className,
  label = 'Upload Files',
  description = 'Drag & drop files here, or click to browse',
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return
    const validFiles: File[] = []
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i]
      if (file.size <= maxSizeMB * 1024 * 1024) {
        validFiles.push(file)
      }
    }
    const updated = multiple ? [...files, ...validFiles] : validFiles.slice(0, 1)
    setFiles(updated)
    onFilesSelected(updated)
  }, [files, multiple, maxSizeMB, onFilesSelected])

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files) }

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index)
    setFiles(updated)
    onFilesSelected(updated)
  }

  const getFileIcon = (name: string) => {
    if (name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx')) return FileText
    return File
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all duration-200 cursor-pointer',
          isDragging
            ? 'border-gold bg-gold/5 scale-[1.01]'
            : 'border-border hover:border-gold/40 hover:bg-muted/30'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
          isDragging ? 'bg-gold/20' : 'bg-muted'
        )}>
          <Upload className={cn('h-5 w-5', isDragging ? 'text-gold' : 'text-muted-foreground')} />
        </div>
        <p className="mt-2 text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">Max {maxSizeMB}MB per file</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => {
            const Icon = getFileIcon(file.name)
            return (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-2.5 group">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 shrink-0">
                  <Icon className="h-4 w-4 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{file.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                  className="h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
