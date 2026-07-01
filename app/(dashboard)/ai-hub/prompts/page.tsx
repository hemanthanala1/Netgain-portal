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
import { Badge } from '@/components/ui/badge'
import {
  BookOpen, Search, Plus, Copy, Download, Edit, Trash2, Archive,
  Filter, Eye, Tag, Check
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { copyToClipboard, downloadAsTextFile, PROMPT_CATEGORIES } from '@/lib/ai-utils'
import { useToast } from '@/hooks/use-toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useUser } from '@/components/user-provider'
import type { Prompt } from '@/lib/ai-types'
import { getCachedData, setCachedData } from '@/lib/data-cache'

export default function PromptLibraryPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editPrompt, setEditPrompt] = useState<Prompt | null>(null)
  const [previewPrompt, setPreviewPrompt] = useState<Prompt | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { toast } = useToast()
  const { user } = useUser()
  const isFounder = user?.role === 'Founder' || user?.role === 'Admin'

  const [form, setForm] = useState({ title: '', description: '', category: 'Custom' as string, content: '', tags: '' })

  useEffect(() => {
    const cached = getCachedData<Prompt[]>('ai_prompts')
    if (cached) { setPrompts(cached); setLoading(false) }

    async function load() {
      if (!cached) setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase.from('ai_prompts').select('*').eq('status', 'active').order('created_at', { ascending: false })
          if (!error && data) { setPrompts(data as Prompt[]); setCachedData('ai_prompts', data) }
        } catch { /* tables may not exist */ }
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = prompts.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const handleCreate = async () => {
    if (!form.title || !form.content) return
    const id = `prompt-${Date.now()}`
    const newPrompt: Prompt = {
      id, title: form.title, description: form.description, category: form.category as any,
      content: form.content, tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
      current_version: 1, status: 'active', created_by: user?.name || '',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('ai_prompts').insert([newPrompt])
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return }
    }
    const updated = [newPrompt, ...prompts]
    setPrompts(updated); setCachedData('ai_prompts', updated); setShowCreate(false)
    setForm({ title: '', description: '', category: 'Custom', content: '', tags: '' })
    toast({ title: 'Prompt Created!', description: `"${form.title}" added to the library.` })
  }

  const handleEdit = async () => {
    if (!editPrompt) return
    const updated: Prompt = { ...editPrompt, title: form.title, description: form.description, category: form.category as any, content: form.content, tags: form.tags ? form.tags.split(',').map(t => t.trim()) : editPrompt.tags, updated_at: new Date().toISOString() }
    if (isSupabaseConfigured()) {
      await supabase.from('ai_prompts').update({ title: form.title, description: form.description, category: form.category, content: form.content, tags: updated.tags, updated_at: updated.updated_at }).eq('id', editPrompt.id)
    }
    const list = prompts.map(p => p.id === editPrompt.id ? updated : p)
    setPrompts(list); setCachedData('ai_prompts', list); setEditPrompt(null)
    toast({ title: 'Prompt Updated' })
  }

  const handleDelete = async () => {
    if (!deleteId) return
    if (isSupabaseConfigured()) { await supabase.from('ai_prompts').update({ status: 'archived' }).eq('id', deleteId) }
    const updated = prompts.filter(p => p.id !== deleteId)
    setPrompts(updated); setCachedData('ai_prompts', updated); setDeleteId(null)
    toast({ title: 'Prompt Archived' })
  }

  const handleCopy = async (prompt: Prompt) => {
    await copyToClipboard(prompt.content)
    setCopiedId(prompt.id)
    setTimeout(() => setCopiedId(null), 2000)
    toast({ title: 'Copied to Clipboard' })
  }

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      Marketing: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
      PRD: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
      SEO: 'bg-green-500/10 text-green-400 border-green-500/20',
      Proposal: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      Sales: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      'Website Audit': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      'AI Automation': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      Custom: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    }
    return colors[cat] || colors.Custom
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-violet-400" />
            <h1 className="text-2xl font-bold tracking-tight">Prompt Library</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">Reusable AI prompts across all categories</p>
        </div>
        {isFounder && (
          <Button variant="gold" size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 w-full sm:w-auto">
            <Plus className="h-4 w-4" />Create Prompt
          </Button>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setCategoryFilter('all')} className={`text-xs px-3 py-1.5 rounded-full border transition-all ${categoryFilter === 'all' ? 'bg-gold/10 text-gold border-gold/30' : 'border-border text-muted-foreground hover:border-gold/20'}`}>
          All ({prompts.length})
        </button>
        {PROMPT_CATEGORIES.map(cat => {
          const count = prompts.filter(p => p.category === cat).length
          return (
            <button key={cat} onClick={() => setCategoryFilter(cat)} className={`text-xs px-3 py-1.5 rounded-full border transition-all ${categoryFilter === cat ? 'bg-gold/10 text-gold border-gold/30' : 'border-border text-muted-foreground hover:border-gold/20'}`}>
              {cat} ({count})
            </button>
          )
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search prompts..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Prompts Grid */}
      {filtered.length === 0 ? (
        <Card className="ai-card"><CardContent className="p-12 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">No prompts found</p>
          <p className="text-xs text-muted-foreground mt-1">{isFounder ? 'Create your first reusable prompt.' : 'No prompts available yet.'}</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(prompt => (
            <Card key={prompt.id} className="ai-card ai-card-glow group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold">{prompt.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{prompt.description || 'No description'}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${getCategoryColor(prompt.category)}`}>
                    {prompt.category}
                  </span>
                </div>

                {/* Preview */}
                <div className="rounded-lg bg-muted/20 border border-border p-3 mb-3">
                  <pre className="text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-3 font-mono">
                    {prompt.content}
                  </pre>
                </div>

                {/* Tags */}
                {prompt.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {prompt.tags.slice(0, 4).map(tag => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
                    ))}
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-3">
                  <span>v{prompt.current_version} · {formatDate(prompt.created_at)}</span>
                  <span>{prompt.content.split(/\s+/).length} words</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <Button variant="ghost" size="sm" className="h-7 flex-1 text-xs gap-1.5" onClick={() => handleCopy(prompt)}>
                    {copiedId === prompt.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copiedId === prompt.id ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 flex-1 text-xs gap-1.5" onClick={() => downloadAsTextFile(prompt.content, `${prompt.title.replace(/\s+/g, '_')}.txt`)}>
                    <Download className="h-3 w-3" />Download
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setPreviewPrompt(prompt)} title="Preview">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  {isFounder && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setForm({ title: prompt.title, description: prompt.description, category: prompt.category, content: prompt.content, tags: prompt.tags?.join(', ') || '' }); setEditPrompt(prompt) }} title="Edit">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-400" onClick={() => setDeleteId(prompt.id)} title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create New Prompt</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Prompt Title *</Label><Input placeholder="e.g. Marketing Strategy Generator" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
              <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Description</Label><Input placeholder="Brief description of what this prompt does" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
              <div className="space-y-1"><Label>Category</Label><Select value={form.category} onValueChange={v => setForm({...form, category: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROMPT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Tags (comma separated)</Label><Input placeholder="marketing, strategy, seo" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} /></div>
            </div>
            <div className="space-y-1">
              <Label>Prompt Content * (supports markdown)</Label>
              <Textarea className="min-h-[200px] font-mono text-xs resize-y" placeholder="Write your prompt here. Use markdown formatting for structure..." value={form.content} onChange={e => setForm({...form, content: e.target.value})} />
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button><Button variant="gold" onClick={handleCreate} disabled={!form.title || !form.content}>Create Prompt</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editPrompt} onOpenChange={open => !open && setEditPrompt(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Prompt</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Prompt Title *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
              <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Description</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
              <div className="space-y-1"><Label>Category</Label><Select value={form.category} onValueChange={v => setForm({...form, category: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROMPT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Tags</Label><Input value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} /></div>
            </div>
            <div className="space-y-1">
              <Label>Prompt Content *</Label>
              <Textarea className="min-h-[200px] font-mono text-xs resize-y" value={form.content} onChange={e => setForm({...form, content: e.target.value})} />
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditPrompt(null)}>Cancel</Button><Button variant="gold" onClick={handleEdit}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewPrompt} onOpenChange={open => !open && setPreviewPrompt(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewPrompt?.title}</DialogTitle>
            <p className="text-xs text-muted-foreground">{previewPrompt?.category} · v{previewPrompt?.current_version}</p>
          </DialogHeader>
          <pre className="p-4 bg-muted/20 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
            {previewPrompt?.content}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewPrompt(null)}>Close</Button>
            <Button variant="gold" className="gap-1.5" onClick={() => previewPrompt && handleCopy(previewPrompt)}>
              <Copy className="h-3.5 w-3.5" />Copy Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Prompt?</AlertDialogTitle>
            <AlertDialogDescription>This will archive the prompt. It can be restored later by an admin.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
