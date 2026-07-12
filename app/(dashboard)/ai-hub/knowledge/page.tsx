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
import { EmptyState } from '@/components/ui/empty-state'
import type { KnowledgeBaseItem } from '@/lib/ai-types'
import { getCachedData, setCachedData } from '@/lib/data-cache'

export default function KnowledgeBasePage() {
  const [items, setItems] = useState<KnowledgeBaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [folderFilter, setFolderFilter] = useState('all')
  const [showUpload, setShowUpload] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [editItem, setEditItem] = useState<KnowledgeBaseItem | null>(null)
  const [folders, setFolders] = useState<string[]>(['Brand Guidelines', 'Development Standards', 'Marketing SOPs', 'Sales SOPs', 'Client Templates', 'Documentation', 'General'])
  const [showManageFolders, setShowManageFolders] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
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

          // Fetch custom folders
          const { data: settings } = await supabase.from('company_settings').select('docs').limit(1).maybeSingle()
          if (settings?.docs?.kbFolders) {
            setFolders(settings.docs.kbFolders)
          }
        } catch { /* tables may not exist */ }
      }
      setLoading(false)
    }
    load()
  }, [])

  const saveFolders = async (updatedFolders: string[]) => {
    setFolders(updatedFolders)
    if (isSupabaseConfigured()) {
      try {
        const { data: exist } = await supabase.from('company_settings').select('id, docs').limit(1).maybeSingle()
        if (exist) {
          const updatedDocs = { ...exist.docs, kbFolders: updatedFolders }
          await supabase.from('company_settings').update({ docs: updatedDocs }).eq('id', exist.id)
        } else {
          await supabase.from('company_settings').insert([{ docs: { kbFolders: updatedFolders } }])
        }
      } catch (err) {
        console.error('Failed to save folders to db:', err)
      }
    }
  }

  const handleAddFolder = () => {
    if (!newFolderName.trim()) return
    if (folders.includes(newFolderName.trim())) {
      toast({ title: 'Folder already exists', variant: 'destructive' })
      return
    }
    const updated = [...folders, newFolderName.trim()]
    saveFolders(updated)
    setNewFolderName('')
    toast({ title: 'Folder Added' })
  }

  const handleDeleteFolder = (folderToDelete: string) => {
    if (folderToDelete === 'General') {
      toast({ title: 'Cannot delete "General" folder', variant: 'destructive' })
      return
    }
    const updated = folders.filter(f => f !== folderToDelete)
    saveFolders(updated)
    toast({ title: 'Folder Deleted' })
  }

  const filtered = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) || item.description?.toLowerCase().includes(search.toLowerCase())
    const matchesFolder = folderFilter === 'all' || item.folder === folderFilter
    return matchesSearch && matchesFolder
  })

  const folderCounts = folders.reduce((acc, folder) => {
    acc[folder] = items.filter(i => i.folder === folder).length
    return acc
  }, {} as Record<string, number>)

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  }

  const handleUpload = async () => {
    if (!form.title && uploadedFiles.length === 0) {
      toast({ title: 'Title or file is required', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const newItems: KnowledgeBaseItem[] = []

      // If no files are attached, create one record with empty file
      if (uploadedFiles.length === 0) {
        const id = `kb-${Date.now()}`
        const newItem: KnowledgeBaseItem = {
          id,
          title: form.title,
          description: form.description,
          folder: form.folder as any,
          file_name: '',
          file_type: '',
          file_size: 0,
          file_url: '',
          tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
          status: 'active',
          created_by: user?.name || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        if (isSupabaseConfigured()) {
          const { error } = await supabase.from('ai_knowledge_base').insert([newItem])
          if (error) throw error
        }
        newItems.push(newItem)
      } else {
        // Create a record for each file
        for (let i = 0; i < uploadedFiles.length; i++) {
          const file = uploadedFiles[i]
          const id = `kb-${Date.now()}-${i}`
          
          let fileUrl = ''
          try {
            fileUrl = await readFileAsDataURL(file)
          } catch (err) {
            console.error('Failed to read file', err)
          }

          const newItem: KnowledgeBaseItem = {
            id,
            title: uploadedFiles.length === 1 ? form.title || file.name : `${form.title || 'Doc'} - ${file.name}`,
            description: form.description,
            folder: form.folder as any,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            file_url: fileUrl,
            tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
            status: 'active',
            created_by: user?.name || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          if (isSupabaseConfigured()) {
            const { error } = await supabase.from('ai_knowledge_base').insert([newItem])
            if (error) throw error
          }
          newItems.push(newItem)
        }
      }

      const updated = [...newItems, ...items]
      setItems(updated)
      setCachedData('ai_knowledge_base', updated)
      setShowUpload(false)
      setUploadedFiles([])
      setForm({ title: '', description: '', folder: 'General', tags: '' })
      toast({ title: `${newItems.length} document(s) added successfully!` })
    } catch (err: any) {
      toast({ title: 'Error uploading documents', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    if (isSupabaseConfigured()) { await supabase.from('ai_knowledge_base').delete().eq('id', deleteId) }
    const updated = items.filter(i => i.id !== deleteId)
    setItems(updated); setCachedData('ai_knowledge_base', updated); setDeleteId(null)
    toast({ title: 'Document Removed' })
  }

  const handleDownload = (item: KnowledgeBaseItem) => {
    if (item.file_url) {
      const link = document.createElement('a')
      link.href = item.file_url
      link.download = item.file_name || `${item.title}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast({ title: 'Download Started', description: `Downloading ${item.file_name || item.title}` })
    } else {
      toast({ 
        title: 'Download Failed', 
        description: 'No file associated with this document.', 
        variant: 'destructive' 
      })
    }
  }

  const handleSaveEdit = async () => {
    if (!editItem || !form.title) return
    
    setLoading(true)
    try {
      let fileUrl = editItem.file_url
      let fileName = editItem.file_name
      let fileType = editItem.file_type
      let fileSize = editItem.file_size

      // 1. Process the first file for the current document
      if (uploadedFiles.length > 0) {
        try {
          const file = uploadedFiles[0]
          fileUrl = await readFileAsDataURL(file)
          fileName = file.name
          fileType = file.type
          fileSize = file.size
        } catch (err) {
          console.error('Failed to read file', err)
        }
      }

      const updated: KnowledgeBaseItem = {
        ...editItem,
        title: uploadedFiles.length === 1 ? form.title : (uploadedFiles.length > 0 ? `${form.title} - ${uploadedFiles[0].name}` : form.title),
        description: form.description,
        folder: form.folder as any,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        file_url: fileUrl,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
        updated_at: new Date().toISOString()
      }

      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('ai_knowledge_base').update({
          title: updated.title,
          description: updated.description,
          folder: updated.folder,
          file_name: updated.file_name,
          file_type: updated.file_type,
          file_size: updated.file_size,
          file_url: updated.file_url,
          tags: updated.tags,
          updated_at: updated.updated_at
        }).eq('id', editItem.id)

        if (error) throw error
      }

      const newItems: KnowledgeBaseItem[] = []

      // 2. Process any additional files as NEW documents
      if (uploadedFiles.length > 1) {
        for (let i = 1; i < uploadedFiles.length; i++) {
          const file = uploadedFiles[i]
          const id = `kb-${Date.now()}-${i}`
          
          let additionalFileUrl = ''
          try {
            additionalFileUrl = await readFileAsDataURL(file)
          } catch (err) {
            console.error('Failed to read file', err)
          }

          const newItem: KnowledgeBaseItem = {
            id,
            title: `${form.title} - ${file.name}`,
            description: form.description,
            folder: form.folder as any,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            file_url: additionalFileUrl,
            tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
            status: 'active',
            created_by: user?.name || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          if (isSupabaseConfigured()) {
            const { error } = await supabase.from('ai_knowledge_base').insert([newItem])
            if (error) throw error
          }
          newItems.push(newItem)
        }
      }

      // Merge updated item and new items
      const updatedList = items.map(i => i.id === editItem.id ? updated : i)
      const finalUpdatedList = [...newItems, ...updatedList]
      
      setItems(finalUpdatedList)
      setCachedData('ai_knowledge_base', finalUpdatedList)
      setEditItem(null)
      setUploadedFiles([])
      toast({ 
        title: 'Documents updated successfully', 
        description: uploadedFiles.length > 1 
          ? `Updated 1 document and created ${newItems.length} new document(s).` 
          : 'Document updated successfully.'
      })
    } catch (err: any) {
      toast({ title: 'Update Failed', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
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
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={() => setShowManageFolders(true)} className="gap-1.5 flex-1 sm:flex-initial">
              Manage Folders
            </Button>
            <Button variant="gold" size="sm" onClick={() => setShowUpload(true)} className="gap-1.5 flex-1 sm:flex-initial">
              <Plus className="h-4 w-4" />Add Document
            </Button>
          </div>
        )}
      </div>

      {/* Folder Tabs */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFolderFilter('all')} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${folderFilter === 'all' ? 'bg-gold/10 text-gold border-gold/30' : 'border-border text-muted-foreground hover:border-gold/20'}`}>
          <Folder className="h-3 w-3" />All ({items.length})
        </button>
        {folders.map(folder => (
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
        <EmptyState
          icon={FolderOpen}
          title="No AI Knowledge Base Documents"
          description={isFounder ? "Your AI Knowledge Base has no reference docs yet. Upload training manuals or business logic." : "No documents are available in the repository yet."}
          action={isFounder ? {
            label: "Add Document",
            onClick: () => { setForm({ title: '', folder: 'General', description: '', tags: '' }); setUploadedFiles([]); setShowUpload(true) },
            icon: Plus
          } : undefined}
        />
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
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-muted-foreground hover:text-foreground" 
                      onClick={() => handleDownload(item)}
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {isFounder && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-muted-foreground hover:text-foreground" 
                          onClick={() => {
                            setForm({
                              title: item.title,
                              description: item.description || '',
                              folder: item.folder,
                              tags: item.tags ? item.tags.join(', ') : ''
                            })
                            setUploadedFiles([])
                            setEditItem(item)
                          }} 
                          title="Edit"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Delete" className="h-7 w-7 text-red-400 hover:text-red-400" onClick={() => setDeleteId(item.id)} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Folder</Label><Select value={form.folder} onValueChange={v => setForm({...form, folder: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{folders.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Tags</Label><Input placeholder="sop, brand, v3" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} /></div>
            </div>
            <FileUpload
              accept=".pdf,.doc,.docx,.txt,.md,.xlsx,.pptx,.png,.jpg,.jpeg"
              label="Upload Document(s)"
              description="PDF, DOCX, Excel, Images, and more"
              multiple={true}
              onFilesSelected={files => setUploadedFiles(files)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button variant="gold" onClick={handleUpload} disabled={!form.title && uploadedFiles.length === 0}>Add Document</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={open => { if(!open) { setEditItem(null); setUploadedFiles([]); } }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Document Details</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
            <div className="space-y-1"><Label>Description</Label><Textarea className="h-16 resize-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Folder</Label><Select value={form.folder} onValueChange={v => setForm({...form, folder: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{folders.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} /></div>
            </div>
            
            <div className="border-t border-border pt-3 mt-3">
              <p className="text-xs font-semibold text-gold mb-2 uppercase tracking-wide">Document File</p>
              {editItem?.file_name ? (
                <p className="text-xs text-muted-foreground mb-3">
                  Current file: <span className="font-medium text-foreground">{editItem.file_name}</span> ({formatFileSize(editItem.file_size)})
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mb-3">No file attached.</p>
              )}
              
              <FileUpload
                accept=".pdf,.doc,.docx,.txt,.md,.xlsx,.pptx,.png,.jpg,.jpeg"
                label="Upload Replacement Document(s)"
                description="Optional - drag & drop file(s) to replace/add documents"
                multiple={true}
                onFilesSelected={files => setUploadedFiles(files)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditItem(null); setUploadedFiles([]); }}>Cancel</Button>
            <Button variant="gold" onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
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
      {/* Manage Folders Dialog */}
      <Dialog open={showManageFolders} onOpenChange={setShowManageFolders}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Knowledge Base Folders</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                placeholder="New Folder Name"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
              />
              <Button variant="gold" size="sm" onClick={handleAddFolder}>
                Add
              </Button>
            </div>
            <div className="border rounded-lg border-border p-3 max-h-[300px] overflow-y-auto space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Existing Folders</p>
              {folders.map(folder => (
                <div key={folder} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                  <span className="text-sm">{folder}</span>
                  {folder !== 'General' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:text-red-400"
                      onClick={() => handleDeleteFolder(folder)}
                      title="Delete Folder"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManageFolders(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
