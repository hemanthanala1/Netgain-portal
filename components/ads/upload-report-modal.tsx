'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useCRMClients } from '@/hooks/use-crm-clients'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Layers,
  ChevronRight,
  Eye,
  FileText
} from 'lucide-react'
import { formatters } from '@/lib/ads/aggregator'
import { supabase } from '@/lib/supabase'

interface UploadReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (report: any) => void
  replaceReport?: { id: string; name: string; clientId: string } | null
  defaultClientId?: string
}

export function UploadReportModal({
  open,
  onOpenChange,
  onSuccess,
  replaceReport = null,
  defaultClientId = ''
}: UploadReportModalProps) {
  const { clients, loading: loadingClients } = useCRMClients()
  const { toast } = useToast()

  const [file, setFile] = useState<File | null>(null)
  const [clientId, setClientId] = useState<string>(replaceReport?.clientId || defaultClientId || '')
  const [reportName, setReportName] = useState<string>(replaceReport?.name || '')
  const [platform, setPlatform] = useState<string>('meta')
  const [periodStart, setPeriodStart] = useState<string>('')
  const [periodEnd, setPeriodEnd] = useState<string>('')
  const [publishDirectly, setPublishDirectly] = useState<boolean>(false)

  // Excel worksheet state
  const [availableSheets, setAvailableSheets] = useState<{ name: string; rowCount: number }[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')

  // Preview & Validation state
  const [validating, setValidating] = useState<boolean>(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<any | null>(null)

  // Submitting state
  const [submitting, setSubmitting] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (replaceReport) {
        setClientId(replaceReport.clientId)
        setReportName(`${replaceReport.name} (Updated)`)
      } else if (defaultClientId) {
        setClientId(defaultClientId)
      }
    } else {
      setFile(null)
      setValidationError(null)
      setPreviewData(null)
      setAvailableSheets([])
      setSelectedSheet('')
      setSubmitting(false)
      setValidating(false)
    }
  }, [open, replaceReport, defaultClientId])

  // File selection handler
  const handleFileChange = async (selectedFile: File | null) => {
    if (!selectedFile) return
    setFile(selectedFile)
    setValidationError(null)
    setPreviewData(null)

    // Suggest report name from file name if not already set
    if (!reportName.trim()) {
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ')
      setReportName(baseName.charAt(0).toUpperCase() + baseName.slice(1))
    }

    // Trigger pre-upload parse & preview
    await runPreview(selectedFile, undefined)
  }

  // Pre-upload validation & preview request
  const runPreview = async (fileToPreview: File, sheetName?: string) => {
    setValidating(true)
    setValidationError(null)

    try {
      const fd = new FormData()
      fd.append('file', fileToPreview)
      if (sheetName) fd.append('sheetName', sheetName)

      const session = (await supabase.auth.getSession()).data.session
      const headers: Record<string, string> = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const res = await fetch('/api/ads/parse-preview', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: fd
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to inspect file')
      }

      setPreviewData(data)
      if (data.sheets && data.sheets.length > 0) {
        setAvailableSheets(data.sheets)
        setSelectedSheet(data.activeSheet || data.sheets[0].name)
      }
      if (data.periodStart && !periodStart) setPeriodStart(data.periodStart)
      if (data.periodEnd && !periodEnd) setPeriodEnd(data.periodEnd)
    } catch (err: any) {
      setValidationError(err.message || 'File validation failed.')
    } finally {
      setValidating(false)
    }
  }

  // Worksheet change handler
  const handleSheetChange = async (newSheet: string) => {
    setSelectedSheet(newSheet)
    if (file) {
      await runPreview(file, newSheet)
    }
  }

  // Final upload submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      toast({ title: 'File Required', description: 'Please choose a report file to upload.', variant: 'destructive' })
      return
    }
    if (!clientId) {
      toast({ title: 'Client Required', description: 'Please assign this report to an ERP client.', variant: 'destructive' })
      return
    }
    if (!reportName.trim()) {
      toast({ title: 'Report Name Required', description: 'Please enter a name for this report.', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('clientId', clientId)
      fd.append('reportName', reportName.trim())
      fd.append('platform', platform)
      if (periodStart) fd.append('periodStart', periodStart)
      if (periodEnd) fd.append('periodEnd', periodEnd)
      if (selectedSheet) fd.append('sheetName', selectedSheet)
      if (replaceReport) fd.append('replaceReportId', replaceReport.id)
      if (publishDirectly) fd.append('publishDirectly', 'true')

      const session = (await supabase.auth.getSession()).data.session
      const headers: Record<string, string> = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const res = await fetch('/api/ads/upload', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: fd
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      toast({
        title: replaceReport ? 'Report Replaced' : 'Report Uploaded Successfully',
        description: `Successfully processed ${reportName} with ${formatters.int(data.report.parsed_data.rows.length)} rows.`
      })

      onSuccess(data.report)
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Upload Failed',
        description: err.message || 'An error occurred while uploading the report.',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            {replaceReport ? 'Replace Performance Report' : 'Upload Performance Report'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Ingest Meta Ads / campaign performance exports (CSV, TSV, or Excel). Metrics, funnels, and breakdowns are automatically detected and verified.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Client Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="client-select" className="text-xs font-semibold">
              ERP Client Record <span className="text-red-500">*</span>
            </Label>
            <Select value={clientId} onValueChange={setClientId} disabled={loadingClients}>
              <SelectTrigger id="client-select" className="text-xs h-9 bg-background">
                <SelectValue placeholder={loadingClients ? 'Loading clients...' : 'Select client...'} />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    <span className="font-semibold">{c.name}</span>
                    {c.business && <span className="text-muted-foreground ml-1.5">({c.business})</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Platform & Report Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="platform" className="text-xs font-semibold">
                Platform
              </Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger id="platform" className="text-xs h-9 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">Meta Ads</SelectItem>
                  <SelectItem value="google" disabled>
                    Google Ads (Phase 2)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="report-name" className="text-xs font-semibold">
                Report Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="report-name"
                placeholder="e.g. Q3 Lead Gen Campaign Performance"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                className="text-xs h-9 bg-background"
                required
              />
            </div>
          </div>

          {/* File Dropzone */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Report File (.csv, .tsv, .xlsx, .xls) <span className="text-red-500">*</span>
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const dropped = e.dataTransfer.files?.[0]
                if (dropped) handleFileChange(dropped)
              }}
              className={`p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center ${
                file
                  ? 'border-emerald-500/50 bg-emerald-500/5 text-foreground'
                  : 'border-border hover:border-primary/60 bg-muted/20 hover:bg-muted/40 text-muted-foreground'
              }`}
            >
              <FileSpreadsheet className={`h-8 w-8 mx-auto mb-2 ${file ? 'text-emerald-500' : 'text-muted-foreground'}`} />
              {file ? (
                <div>
                  <p className="text-xs font-bold text-foreground truncate max-w-sm mx-auto">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {(file.size / 1024).toFixed(1)} KB • Click or drop new file to replace
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-foreground">Click to browse or drop Ads Manager export here</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Supports CSV, TSV, and Excel spreadsheets (.xlsx, .xls)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Excel Worksheet Selector (when multiple sheets found) */}
          {availableSheets.length > 1 && (
            <div className="space-y-1.5 p-3 rounded-lg bg-muted/40 border border-border">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Layers className="h-3.5 w-3.5 text-primary" /> Select Worksheet to Parse
              </Label>
              <Select value={selectedSheet} onValueChange={handleSheetChange}>
                <SelectTrigger className="text-xs h-8 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableSheets.map((s) => (
                    <SelectItem key={s.name} value={s.name} className="text-xs">
                      {s.name} {s.rowCount > 0 && `(${s.rowCount} rows)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Validation Status / Parsing Preview Card */}
          {validating && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Validating schema and detecting Meta Ads metrics...</span>
            </div>
          )}

          {validationError && (
            <div className="p-3.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Invalid or Incompatible File</span>
              </div>
              <p className="text-[11px] leading-relaxed">{validationError}</p>
            </div>
          )}

          {previewData && !validating && !validationError && (
            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Ready to Import
                </span>
                <span>{formatters.int(previewData.rowCount)} Rows Detected</span>
              </div>

              {/* Preview KPI Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                <div className="p-2 rounded bg-background/80 border border-border">
                  <span className="text-[10px] text-muted-foreground block font-sans">Spend</span>
                  <span className="font-bold text-foreground">
                    {formatters.inr(previewData.summary.spend, previewData.currency)}
                  </span>
                </div>
                <div className="p-2 rounded bg-background/80 border border-border">
                  <span className="text-[10px] text-muted-foreground block font-sans">Impressions</span>
                  <span className="font-bold text-foreground">{formatters.int(previewData.summary.impressions)}</span>
                </div>
                <div className="p-2 rounded bg-background/80 border border-border">
                  <span className="text-[10px] text-muted-foreground block font-sans">Clicks</span>
                  <span className="font-bold text-foreground">{formatters.int(previewData.summary.clicks)}</span>
                </div>
                <div className="p-2 rounded bg-background/80 border border-border">
                  <span className="text-[10px] text-muted-foreground block font-sans">
                    {previewData.efficiencyMetric?.resLabel || 'Leads'}
                  </span>
                  <span className="font-bold text-foreground">
                    {formatters.int(previewData.summary.leads || previewData.summary.results)}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground">
                Mapped {previewData.mappedFieldCount} standard Meta fields. Reporting period:{' '}
                {previewData.periodStart ? formatters.date(previewData.periodStart) : 'N/A'} to{' '}
                {previewData.periodEnd ? formatters.date(previewData.periodEnd) : 'N/A'}.
              </p>
            </div>
          )}

          {/* Reporting Period Overrides (Optional) */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label htmlFor="period-start" className="text-[11px] text-muted-foreground font-semibold">
                Reporting Start (Optional)
              </Label>
              <Input
                id="period-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="text-xs h-8 bg-background"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="period-end" className="text-[11px] text-muted-foreground font-semibold">
                Reporting End (Optional)
              </Label>
              <Input
                id="period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="text-xs h-8 bg-background"
              />
            </div>
          </div>

          {/* Publish Checkbox */}
          <div className="flex items-center space-x-2 pt-2 border-t border-border/60">
            <Checkbox
              id="publish"
              checked={publishDirectly}
              onCheckedChange={(checked) => setPublishDirectly(Boolean(checked))}
            />
            <Label htmlFor="publish" className="text-xs font-medium cursor-pointer text-foreground">
              Publish report to Client Portal immediately upon saving
            </Label>
          </div>

          {/* Actions */}
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!file || !clientId || submitting || validating || Boolean(validationError)}
              className="text-xs font-bold gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving Report...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {replaceReport ? 'Confirm & Replace Report' : 'Confirm & Save Report'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
