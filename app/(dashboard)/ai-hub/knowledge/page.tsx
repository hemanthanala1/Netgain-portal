'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { FileUpload } from '@/components/ui/file-upload'
import {
  FolderOpen, Search, Plus, Download, Eye, Edit, Trash2,
  FileText, File, Image, Folder, Filter
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { formatFileSize, KB_FOLDERS } from '@/lib/ai-utils'
import { useToast } from '@/hooks/use-toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useUser } from '@/components/user-provider'
import type { KnowledgeBaseItem } from '@/lib/ai-types'
import { getCachedData, setCachedData } from '@/lib/data-cache'

export default function KnowledgeBasePage() {
  const [items, setItems] = useState<KnowledgeBaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [folderFilter, setFolderFilter] = useState('all')
  const [showUpload, setShowUpload] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const { toast } = useToast()
  const { user } = useUser()
  const isFounder = user?.role === 'Founder' || user?.role === 'Admin'

  const [form, setForm] = useState({ title: '', description: '', folder: 'General' as string, tags: '' })

  useEffect(() => {
    const cached = getCachedData<KnowledgeBaseItem[]>('ai_knowledge_base')
    if (cached) { setItems(cached); setLoading(false) }

    async function load() {
      if (!cached) setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase.from('ai_knowledge_base').select('*').eq('status', 'active').order('created_at', { ascending: false })
          if (!error && data) { setItems(data as KnowledgeBaseItem[]); setCachedData('ai_knowledge_base', data) }
        } catch { /* tables may not exist */ }
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) || item.description?.toLowerCase().includes(search.toLowerCase())
    const matchesFolder = folderFilter === 'all' || item.folder === folderFilter
    return matchesSearch && matchesFolder
  })

  const folderCounts = KB_FOLDERS.reduce((acc, folder) => {
    acc[folder] = items.filter(i => i.folder === folder).length
    return acc
  }, {} as Record<string, number>)

  const handleUpload = async () => {
    if (!form.title) return
    const id = `kb-${Date.now()}`
    const newItem: KnowledgeBaseItem = {
      id, title: form.title, description: form.description, folder: form.folder as any,
      file_name: uploadedFile?.name || '', file_type: uploadedFile?.type || '',
      file_size: uploadedFile?.size || 0, file_url: '',
      tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
      status: 'active', created_by: user?.name || '',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('ai_knowledge_base').insert([newItem])
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return }
    }
    const updated = [newItem, ...items]
    setItems(updated); setCachedData('ai_knowledge_base', updated); setShowUpload(false)
    setUploadedFile(null); setForm({ title: '', description: '', folder: 'General', tags: '' })
    toast({ title: 'Document Added!', description: `"${form.title}" added to ${form.folder}.` })
  }

  const handleDelete = async () => {
    if (!deleteId) return
    if (isSupabaseConfigured()) { await supabase.from('ai_knowledge_base').delete().eq('id', deleteId) }
    const updated = items.filter(i => i.id !== deleteId)
    setItems(updated); setCachedData('ai_knowledge_base', updated); setDeleteId(null)
    toast({ title: 'Document Removed' })
  }

  const getFileIcon = (type: string) => {
    if (type?.includes('pdf') || type?.includes('doc')) return FileText
    if (type?.includes('image')) return Image
    return File
  }

  const getFolderColor = (folder: string) => {
    const colors: Record<string, string> = {
      'Brand Guidelines': 'text-pink-400 bg-pink-500/10',
      'Development Standards': 'text-violet-400 bg-violet-500/10',
      'Marketing SOPs': 'text-emerald-400 bg-emerald-500/10',
      'Sales SOPs': 'text-amber-400 bg-amber-500/10',
      'Client Templates': 'text-cyan-400 bg-cyan-500/10',
      'Documentation': 'text-blue-400 bg-blue-500/10',
      'General': 'text-gray-400 bg-gray-500/10',
    }
    return colors[folder] || colors.General
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-cyan-400" />
            <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">Company documents, SOPs, templates, and brand guidelines</p>
        </div>
        {isFounder && (
          <Button variant="gold" size="sm" onClick={() => setShowUpload(true)} className="gap-1.5 w-full sm:w-auto">
            <Plus className="h-4 w-4" />Add Document
          </Button>
        )}
      </div>

      {/* Folder Tabs */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFolderFilter('all')} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${folderFilter === 'all' ? 'bg-gold/10 text-gold border-gold/30' : 'border-border text-muted-foreground hover:border-gold/20'}`}>
          <Folder className="h-3 w-3" />All ({items.length})
        </button>
        {KB_FOLDERS.map(folder => (
          <button key={folder} onClick={() => setFolderFilter(folder)} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${folderFilter === folder ? 'bg-gold/10 text-gold border-gold/30' : 'border-border text-muted-foreground hover:border-gold/20'}`}>
            <Folder className="h-3 w-3" />{folder} ({folderCounts[folder] || 0})
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Documents List */}
      {filtered.length === 0 ? (
        <Card className="ai-card"><CardContent className="p-12 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">No documents found</p>
          <p className="text-xs text-muted-foreground mt-1">Add your first company document to the knowledge base.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const Icon = getFileIcon(item.file_type)
            return (
              <Card key={item.id} className="ai-card ai-card-glow group">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${getFolderColor(item.folder)}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{item.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{item.folder}</span>
                      {item.file_name && <span className="text-[10px] text-muted-foreground">· {item.file_name}</span>}
                      {item.file_size > 0 && <span className="text-[10px] text-muted-foreground">· {formatFileSize(item.file_size)}</span>}
                      <span className="text-[10px] text-muted-foreground">· {formatDate(item.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Download">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {isFounder && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-400" onClick={() => setDeleteId(item.id)} title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Add to Knowledge Base</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>Title *</Label><Input placeholder="e.g. Brand Guidelines v3" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
            <div className="space-y-1"><Label>Description</Label><Textarea className="h-16 resize-none" placeholder="Brief description..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Folder</Label><Select value={form.folder} onValueChange={v => setForm({...form, folder: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{KB_FOLDERS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Tags</Label><Input placeholder="sop, brand, v3" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} /></div>
            </div>
            <FileUpload
              accept=".pdf,.doc,.docx,.txt,.md,.xlsx,.pptx,.png,.jpg,.jpeg"
              label="Upload Document"
              description="PDF, DOCX, Excel, Images, and more"
              onFilesSelected={files => setUploadedFile(files[0] || null)}
            />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button><Button variant="gold" onClick={handleUpload} disabled={!form.title}>Add Document</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Document?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the document from the knowledge base.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
