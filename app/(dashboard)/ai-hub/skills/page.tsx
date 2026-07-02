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
import { FileUpload } from '@/components/ui/file-upload'
import { VersionTimeline } from '@/components/ui/version-timeline'
import {
  Sparkles, Search, Plus, Download, Eye, Edit, Trash2, Archive,
  Tag, Clock, Cpu, BarChart3, Upload, History, ChevronDown, Filter
} from 'lucide-react'
import { formatDate, generateDocId } from '@/lib/utils'
import { formatFileSize, SKILL_CATEGORIES } from '@/lib/ai-utils'
import { useToast } from '@/hooks/use-toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useUser } from '@/components/user-provider'
import type { Skill, SkillVersion } from '@/lib/ai-types'
import { getCachedData, setCachedData, invalidateCache } from '@/lib/data-cache'

export default function SkillsLibraryPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editSkill, setEditSkill] = useState<Skill | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [historySkill, setHistorySkill] = useState<Skill | null>(null)
  const [versions, setVersions] = useState<SkillVersion[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [newVersion, setNewVersion] = useState('')
  const [editReleaseNotes, setEditReleaseNotes] = useState('')
  const [categories, setCategories] = useState<string[]>(['Marketing', 'PRD', 'SEO', 'Proposal', 'Sales', 'Website Audit', 'AI Automation', 'Custom'])
  const [showManageCategories, setShowManageCategories] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const { toast } = useToast()
  const { user } = useUser()
  const isFounder = user?.role === 'Founder' || user?.role === 'Admin'

  const [form, setForm] = useState({
    name: '', description: '', category: 'Custom' as string,
    compatible_ai: 'Claude', compatible_version: 'Claude 3.5+', release_notes: ''
  })

  useEffect(() => {
    const cached = getCachedData<Skill[]>('ai_skills')
    if (cached) { setSkills(cached); setLoading(false) }

    async function load() {
      if (!cached) setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase.from('ai_skills').select('*').order('created_at', { ascending: false })
          if (!error && data) {
            setSkills(data as Skill[])
            setCachedData('ai_skills', data)
          }

          // Fetch custom categories
          const { data: settings } = await supabase.from('company_settings').select('docs').limit(1).maybeSingle()
          if (settings?.docs?.skillCategories) {
            setCategories(settings.docs.skillCategories)
          }
        } catch { /* tables may not exist */ }
      }
      setLoading(false)
    }
    load()
  }, [])

  const saveCategories = async (updatedCats: string[]) => {
    setCategories(updatedCats)
    if (isSupabaseConfigured()) {
      try {
        const { data: exist } = await supabase.from('company_settings').select('id, docs').limit(1).maybeSingle()
        if (exist) {
          const updatedDocs = { ...exist.docs, skillCategories: updatedCats }
          await supabase.from('company_settings').update({ docs: updatedDocs }).eq('id', exist.id)
        } else {
          await supabase.from('company_settings').insert([{ docs: { skillCategories: updatedCats } }])
        }
      } catch (err) {
        console.error('Failed to save categories to db:', err)
      }
    }
  }

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return
    if (categories.includes(newCategoryName.trim())) {
      toast({ title: 'Category already exists', variant: 'destructive' })
      return
    }
    const updated = [...categories, newCategoryName.trim()]
    saveCategories(updated)
    setNewCategoryName('')
    toast({ title: 'Category Added' })
  }

  const handleDeleteCategory = (catToDelete: string) => {
    if (catToDelete === 'Custom') {
      toast({ title: 'Cannot delete "Custom" category', variant: 'destructive' })
      return
    }
    const updated = categories.filter(c => c !== catToDelete)
    saveCategories(updated)
    toast({ title: 'Category Deleted' })
  }

  const filtered = skills.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.description?.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  }

  const getNextVersion = (current: string) => {
    if (!current) return '1.1.0'
    const parts = current.split('.')
    if (parts.length === 3) {
      const major = parseInt(parts[0], 10)
      const minor = parseInt(parts[1], 10)
      const patch = parseInt(parts[2], 10)
      if (!isNaN(minor)) {
        return `${major}.${minor + 1}.0`
      }
    }
    return current + '.1'
  }

  const handleCreate = async () => {
    if (!form.name && uploadedFiles.length === 0) {
      toast({ title: 'Skill Name or file is required', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const newSkills: Skill[] = []
      
      if (uploadedFiles.length === 0) {
        const id = `skill-${Date.now()}`
        const newSkill: Skill = {
          id,
          name: form.name,
          description: form.description,
          category: form.category as any,
          current_version: '1.0.0',
          compatible_ai: form.compatible_ai,
          compatible_version: form.compatible_version,
          file_name: '',
          file_size: 0,
          file_url: '',
          downloads: 0,
          status: 'active',
          created_by: user?.name || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        if (isSupabaseConfigured()) {
          const { error } = await supabase.from('ai_skills').insert([newSkill])
          if (error) throw error
          
          await supabase.from('ai_skill_versions').insert([{
            id: `sv-${Date.now()}`,
            skill_id: id,
            version: '1.0.0',
            release_notes: form.release_notes || 'Initial release',
            file_name: '',
            file_size: 0,
            file_url: '',
            status: 'active',
            created_by: user?.name || ''
          }])
        }
        newSkills.push(newSkill)
      } else {
        for (let i = 0; i < uploadedFiles.length; i++) {
          const file = uploadedFiles[i]
          const id = `skill-${Date.now()}-${i}`
          
          let fileUrl = ''
          try {
            fileUrl = await readFileAsDataURL(file)
          } catch (err) {
            console.error('Failed to read file', err)
          }

          const newSkill: Skill = {
            id,
            name: uploadedFiles.length === 1 ? form.name || file.name.replace(/\.skill$/, '') : `${form.name || 'Skill'} - ${file.name.replace(/\.skill$/, '')}`,
            description: form.description,
            category: form.category as any,
            current_version: '1.0.0',
            compatible_ai: form.compatible_ai,
            compatible_version: form.compatible_version,
            file_name: file.name,
            file_size: file.size,
            file_url: fileUrl,
            downloads: 0,
            status: 'active',
            created_by: user?.name || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          if (isSupabaseConfigured()) {
            const { error } = await supabase.from('ai_skills').insert([newSkill])
            if (error) throw error
            
            await supabase.from('ai_skill_versions').insert([{
              id: `sv-${Date.now()}-${i}`,
              skill_id: id,
              version: '1.0.0',
              release_notes: form.release_notes || 'Initial release',
              file_name: file.name,
              file_size: file.size,
              file_url: fileUrl,
              status: 'active',
              created_by: user?.name || ''
            }])
          }
          newSkills.push(newSkill)
        }
      }

      const updated = [...newSkills, ...skills]
      setSkills(updated)
      setCachedData('ai_skills', updated)
      setShowCreate(false)
      setUploadedFiles([])
      setForm({ name: '', description: '', category: 'Custom', compatible_ai: 'Claude', compatible_version: 'Claude 3.5+', release_notes: '' })
      toast({ title: `${newSkills.length} skill(s) published successfully!` })
    } catch (err: any) {
      toast({ title: 'Publish Failed', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    if (isSupabaseConfigured()) {
      await supabase.from('ai_skills').delete().eq('id', deleteId)
    }
    const updated = skills.filter(s => s.id !== deleteId)
    setSkills(updated)
    setCachedData('ai_skills', updated)
    setDeleteId(null)
    toast({ title: 'Skill Deleted' })
  }

  const handleDownload = async (skill: Skill) => {
    const nextDownloads = (skill.downloads || 0) + 1
    // Increment download count
    const updated = skills.map(s => s.id === skill.id ? { ...s, downloads: nextDownloads } : s)
    setSkills(updated)
    setCachedData('ai_skills', updated)
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('ai_skills').update({ downloads: nextDownloads }).eq('id', skill.id)
      } catch (err) {
        console.error('Failed to update downloads count:', err)
      }
    }
    
    // Trigger real download in browser
    if (skill.file_url) {
      const link = document.createElement('a')
      link.href = skill.file_url
      link.download = skill.file_name || `${skill.name}.skill`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast({ title: 'Download Started', description: `Downloading ${skill.file_name || skill.name + '.skill'}` })
    } else {
      toast({ 
        title: 'Download Failed', 
        description: 'No file associated with this skill.', 
        variant: 'destructive' 
      })
    }
  }

  const loadVersions = async (skill: Skill) => {
    setHistorySkill(skill)
    if (isSupabaseConfigured()) {
      const { data } = await supabase.from('ai_skill_versions').select('*').eq('skill_id', skill.id).order('created_at', { ascending: false })
      setVersions((data as SkillVersion[]) || [])
    }
  }

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      Marketing: 'bg-pink-500/10 text-pink-400', PRD: 'bg-violet-500/10 text-violet-400',
      SEO: 'bg-green-500/10 text-green-400', Proposal: 'bg-blue-500/10 text-blue-400',
      Sales: 'bg-amber-500/10 text-amber-400', 'Website Audit': 'bg-cyan-500/10 text-cyan-400',
      'AI Automation': 'bg-indigo-500/10 text-indigo-400', Custom: 'bg-gray-500/10 text-gray-400',
    }
    return colors[cat] || colors.Custom
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            <h1 className="text-2xl font-bold tracking-tight">Skills Library</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">Official Claude Skills for AI-powered document generation</p>
        </div>
        {isFounder && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={() => setShowManageCategories(true)} className="gap-1.5 flex-1 sm:flex-initial">
              Manage Categories
            </Button>
            <Button variant="gold" size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 flex-1 sm:flex-initial">
              <Plus className="h-4 w-4" />Upload Skill
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search skills..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Skills Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <Card key={i} className="ai-card"><CardContent className="p-5 space-y-3">
              <div className="h-5 w-32 bg-muted rounded animate-pulse" />
              <div className="h-3 w-full bg-muted rounded animate-pulse" />
              <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
            </CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="ai-card">
          <CardContent className="p-12 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">No skills found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isFounder ? 'Upload your first Claude Skill to get started.' : 'No skills have been published yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(skill => (
            <Card key={skill.id} className="ai-card ai-card-glow group">
              <CardContent className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                      <Sparkles className="h-4.5 w-4.5 text-gold" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold leading-tight">{skill.name}</h3>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${getCategoryColor(skill.category)}`}>
                        {skill.category}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">v{skill.current_version}</Badge>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">
                  {skill.description || 'No description provided.'}
                </p>

                {/* Meta */}
                <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground mb-4">
                  <div className="flex items-center gap-1"><Cpu className="h-3 w-3" />{skill.compatible_ai}</div>
                  <div className="flex items-center gap-1"><Tag className="h-3 w-3" />{skill.compatible_version}</div>
                  <div className="flex items-center gap-1"><Download className="h-3 w-3" />{skill.downloads} downloads</div>
                  <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(skill.created_at)}</div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <Button variant="gold" size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={() => handleDownload(skill)}>
                    <Download className="h-3 w-3" />Download
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => loadVersions(skill)} title="Version History">
                    <History className="h-3.5 w-3.5" />
                  </Button>
                  {isFounder && (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { 
                        setForm({ 
                          name: skill.name, 
                          description: skill.description || '', 
                          category: skill.category, 
                          compatible_ai: skill.compatible_ai || '', 
                          compatible_version: skill.compatible_version || '', 
                          release_notes: '' 
                        }); 
                        setUploadedFiles([]);
                        setNewVersion(getNextVersion(skill.current_version));
                        setEditReleaseNotes('');
                        setEditSkill(skill); 
                      }} title="Edit">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-400" onClick={() => setDeleteId(skill.id)} title="Delete">
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

      {/* Create/Upload Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Upload New Skill</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>Skill Name *</Label><Input placeholder="e.g. Marketing Strategy Generator" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div className="space-y-1"><Label>Description</Label><Textarea className="h-16 resize-none" placeholder="What does this skill do?" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Category</Label><Select value={form.category} onValueChange={v => setForm({...form, category: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Compatible AI</Label><Input value={form.compatible_ai} onChange={e => setForm({...form, compatible_ai: e.target.value})} /></div>
            </div>
            <div className="space-y-1"><Label>Compatible Version</Label><Input value={form.compatible_version} onChange={e => setForm({...form, compatible_version: e.target.value})} /></div>
            <div className="space-y-1"><Label>Release Notes</Label><Textarea className="h-16 resize-none" placeholder="What's included in this version..." value={form.release_notes} onChange={e => setForm({...form, release_notes: e.target.value})} /></div>
            <FileUpload
              accept=".skill"
              label="Upload .skill File(s)"
              description="Drag & drop your Claude Skill file(s) here"
              multiple={true}
              onFilesSelected={files => setUploadedFiles(files)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="gold" onClick={handleCreate} disabled={!form.name && uploadedFiles.length === 0}>Publish Skill</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editSkill} onOpenChange={open => { if(!open) { setEditSkill(null); setUploadedFiles([]); } }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Skill Details</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>Skill Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div className="space-y-1"><Label>Description</Label><Textarea className="h-16 resize-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Category</Label><Select value={form.category} onValueChange={v => setForm({...form, category: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Compatible AI</Label><Input value={form.compatible_ai} onChange={e => setForm({...form, compatible_ai: e.target.value})} /></div>
            </div>
            <div className="space-y-1"><Label>Compatible Version</Label><Input value={form.compatible_version} onChange={e => setForm({...form, compatible_version: e.target.value})} /></div>
            
            <div className="border-t border-border pt-3 mt-3">
              <p className="text-xs font-semibold text-gold mb-2 uppercase tracking-wide">Skill Document File</p>
              {editSkill?.file_name ? (
                <p className="text-xs text-muted-foreground mb-3">
                  Current document: <span className="font-medium text-foreground">{editSkill.file_name}</span> ({formatFileSize(editSkill.file_size)})
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mb-3">No document attached.</p>
              )}
              
              <FileUpload
                accept=".skill"
                label="Upload Newer Version Document (.skill)"
                description="Optional - drag & drop a newer file to update the skill document"
                onFilesSelected={files => {
                  setUploadedFiles(files)
                  if (files[0] && editSkill) {
                    setNewVersion(getNextVersion(editSkill.current_version))
                  }
                }}
              />
            </div>

            {uploadedFiles.length > 0 && (
              <div className="border-t border-border pt-3 space-y-3">
                <p className="text-xs font-semibold text-gold uppercase tracking-wide">New Version Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>New Version *</Label>
                    <Input value={newVersion} onChange={e => setNewVersion(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Release Notes</Label>
                    <Input placeholder="e.g. Added custom tools" value={editReleaseNotes} onChange={e => setEditReleaseNotes(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditSkill(null); setUploadedFiles([]); }}>Cancel</Button>
            <Button variant="gold" onClick={async () => {
              if (!editSkill) return
              
              let fileUrl = editSkill.file_url
              let fileName = editSkill.file_name
              let fileSize = editSkill.file_size
              let currentVersion = editSkill.current_version
              const isNewFile = uploadedFiles.length > 0

              if (isNewFile) {
                try {
                  fileUrl = await readFileAsDataURL(uploadedFiles[0])
                  fileName = uploadedFiles[0].name
                  fileSize = uploadedFiles[0].size
                  currentVersion = newVersion || getNextVersion(editSkill.current_version)
                } catch (err) {
                  console.error('Failed to read file', err)
                }
              }

              const updated: Skill = { 
                ...editSkill, 
                name: form.name, 
                description: form.description, 
                category: form.category as any, 
                compatible_ai: form.compatible_ai, 
                compatible_version: form.compatible_version,
                current_version: currentVersion,
                file_name: fileName,
                file_size: fileSize,
                file_url: fileUrl,
                updated_at: new Date().toISOString() 
              }

              if (isSupabaseConfigured()) {
                try {
                  const { error } = await supabase.from('ai_skills').update({ 
                    name: form.name, 
                    description: form.description, 
                    category: form.category, 
                    compatible_ai: form.compatible_ai, 
                    compatible_version: form.compatible_version, 
                    current_version: currentVersion,
                    file_name: fileName,
                    file_size: fileSize,
                    file_url: fileUrl,
                    updated_at: new Date().toISOString() 
                  }).eq('id', editSkill.id)

                  if (error) {
                    toast({ title: 'Error updating skill', description: error.message, variant: 'destructive' })
                    return
                  }

                  if (isNewFile) {
                    // Create new version in version history
                    await supabase.from('ai_skill_versions').insert([{
                      id: `sv-${Date.now()}`,
                      skill_id: editSkill.id,
                      version: currentVersion,
                      release_notes: editReleaseNotes || 'Updated version',
                      file_name: fileName,
                      file_size: fileSize,
                      file_url: fileUrl,
                      status: 'active',
                      created_by: user?.name || ''
                    }])
                  }
                } catch (e: any) {
                  toast({ title: 'Database Error', description: e.message, variant: 'destructive' })
                  return
                }
              }

              const updatedList = skills.map(s => s.id === editSkill.id ? updated : s)
              setSkills(updatedList)
              setCachedData('ai_skills', updatedList)
              setEditSkill(null)
              setUploadedFiles([])
              setNewVersion('')
              setEditReleaseNotes('')
              toast({ title: 'Skill Updated successfully' })
            }}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={!!historySkill} onOpenChange={open => !open && setHistorySkill(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="border-b border-white/10 pb-3">
            <DialogTitle>Version History — {historySkill?.name}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Current version: v{historySkill?.current_version}</p>
          </DialogHeader>
          <div className="py-4 max-h-[50vh] overflow-y-auto">
            <VersionTimeline
              versions={versions.map(v => ({ 
                version: v.version, 
                date: v.created_at, 
                action: v.release_notes || 'Version released', 
                by: v.created_by, 
                canDownload: true,
                meta: v
              }))}
              onDownload={(v: any) => {
                const versionMeta = v.meta
                if (versionMeta) {
                  handleDownload({
                    name: historySkill?.name || 'Skill',
                    file_name: versionMeta.file_name,
                    file_url: versionMeta.file_url,
                    downloads: historySkill?.downloads || 0
                  } as any)
                }
              }}
            />
            {versions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No version history available</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Skill?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the skill and all its versions. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>Delete Skill</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Manage Categories Dialog */}
      <Dialog open={showManageCategories} onOpenChange={setShowManageCategories}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Skill Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                placeholder="New Category Name"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
              />
              <Button variant="gold" size="sm" onClick={handleAddCategory}>
                Add
              </Button>
            </div>
            <div className="border rounded-lg border-border p-3 max-h-[300px] overflow-y-auto space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Existing Categories</p>
              {categories.map(cat => (
                <div key={cat} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                  <span className="text-sm">{cat}</span>
                  {cat !== 'Custom' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:text-red-400"
                      onClick={() => handleDeleteCategory(cat)}
                      title="Delete Category"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManageCategories(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
