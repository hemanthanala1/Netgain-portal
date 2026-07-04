'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { PromptViewer } from '@/components/ui/prompt-viewer'
import { ApprovalBadge } from '@/components/ui/approval-badge'
import { WorkflowSteps } from '@/components/ui/workflow-steps'
import { FileUpload } from '@/components/ui/file-upload'
import { VersionTimeline } from '@/components/ui/version-timeline'
import {
  Search, Plus, Zap, Calendar, DollarSign, Users, Download, Edit, Trash2,
  History, Loader2, Sparkles, Copy, ExternalLink, Upload, Eye,
  TrendingUp, Target, Globe, Phone, Mail, MapPin, Building2, FileText, X, Link2
} from 'lucide-react'
import { formatCurrency, formatDate, generateDocId } from '@/lib/utils'
import { generateCampaignPrompt, copyToClipboard, downloadAsTextFile, WORKFLOW_STEPS } from '@/lib/ai-utils'
import type { CampaignStrategyForm } from '@/lib/ai-types'
import { useToast } from '@/hooks/use-toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { ClientAutocomplete } from '@/components/ui/client-autocomplete'
import { getCachedData, setCachedData, invalidateCache } from '@/lib/data-cache'

type Project = {
  id: string; title: string; client: string; type: string; budget: number; spent: number; timeline: string; status: string; progress: number; milestones: string[]; startDate: string; pm: string; history: { date: string; action: string; canDownload?: boolean }[];
  prompt?: string; approvalStatus?: string; businessDetails?: CampaignStrategyForm
}

const statusColors: Record<string, string> = {
  active: 'text-emerald-400 bg-emerald-500/10', planned: 'text-blue-400 bg-blue-500/10',
  completed: 'text-muted-foreground bg-muted', paused: 'text-yellow-400 bg-yellow-500/10'
}

export default function CampaignStrategyPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [detailProject, setDetailProject] = useState<Project | null>(null)
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [currentStep, setCurrentStep] = useState(0)
  const [newVersion, setNewVersion] = useState('')
  const [categories, setCategories] = useState<string[]>(['Digital Marketing', 'E-Commerce', 'SaaS', 'Real Estate', 'Healthcare', 'Education', 'F&B', 'Fashion', 'Technology', 'Professional Services', 'Other'])
  const [showManageCategories, setShowManageCategories] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const { toast } = useToast()
  const [generating, setGenerating] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // ─── PROJECT WORKSPACE STATES ───
  const [workspaceRequirements, setWorkspaceRequirements] = useState<any[]>([])
  const [workspaceSubmissions, setWorkspaceSubmissions] = useState<any[]>([])
  const [workspaceFiles, setWorkspaceFiles] = useState<any[]>([])
  const [workspaceLinks, setWorkspaceLinks] = useState<any[]>([])
  const [workspaceReports, setWorkspaceReports] = useState<any[]>([])
  const [workspaceTimeline, setWorkspaceTimeline] = useState<any[]>([])
  const [loadingWorkspace, setLoadingWorkspace] = useState(false)

  // Requirements Request Form States
  const [reqTitle, setReqTitle] = useState('')
  const [reqDesc, setReqDesc] = useState('')
  const [reqCategory, setReqCategory] = useState('Logo')
  const [reqPriority, setReqPriority] = useState('medium')
  const [reqDueDate, setReqDueDate] = useState('')
  const [reqAllowFile, setReqAllowFile] = useState(true)
  const [reqAllowLink, setReqAllowLink] = useState(false)
  const [reqAllowText, setReqAllowText] = useState(true)
  const [reqAllowMultiple, setReqAllowMultiple] = useState(false)
  const [reqIsRequired, setReqIsRequired] = useState(true)
  const [showReqForm, setShowReqForm] = useState(false)

  // Review Form States
  const [reviewComment, setReviewComment] = useState('')
  const [reviewingSub, setReviewingSub] = useState<any | null>(null)

  // Files Upload Form States
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [fileCategory, setFileCategory] = useState('Other Documents')
  const [fileVersion, setFileVersion] = useState('1')
  const [fileVisibility, setFileVisibility] = useState('Published to Client')
  const [uploadingFileState, setUploadingFileState] = useState(false)

  // Reports Form States
  const [uploadReportFile, setUploadReportFile] = useState<File | null>(null)
  const [reportTitle, setReportTitle] = useState('')
  const [reportType, setReportType] = useState('Marketing Report')
  const [reportVersion, setReportVersion] = useState('1')
  const [reportVisibility, setReportVisibility] = useState('Published to Client')
  const [uploadingReportState, setUploadingReportState] = useState(false)

  // Links Form States
  const [linkTitle, setLinkTitle] = useState('')
  const [linkCategory, setLinkCategory] = useState('Live Website')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkDesc, setLinkDesc] = useState('')
  const [linkVisibility, setLinkVisibility] = useState('Published to Client')

  // Overview Editing States
  const [editingOverview, setEditingOverview] = useState(false)
  const [editedPm, setEditedPm] = useState('')
  const [editedBudget, setEditedBudget] = useState(0)
  const [editedSpent, setEditedSpent] = useState(0)
  const [editedTimeline, setEditedTimeline] = useState('')
  const [editedProgress, setEditedProgress] = useState(0)
  const [editedStatus, setEditedStatus] = useState('')
  const [newMilestoneText, setNewMilestoneText] = useState('')

  // ─── PROJECT WORKSPACE HANDLERS ───
  const fetchProjectWorkspaceData = async (projectId: string) => {
    if (!isSupabaseConfigured()) return
    setLoadingWorkspace(true)
    try {
      const [reqs, files, links, reps, timeline] = await Promise.all([
        supabase.from('project_requirements').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('project_files').select('*').eq('project_id', projectId).order('uploaded_at', { ascending: false }),
        supabase.from('project_links').select('*').eq('project_id', projectId).order('published_at', { ascending: false }),
        supabase.from('project_reports').select('*').eq('project_id', projectId).order('uploaded_at', { ascending: false }),
        supabase.from('project_activity_timeline').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
      ])

      const reqList = reqs.data || []
      setWorkspaceRequirements(reqList)
      setWorkspaceFiles(files.data || [])
      setWorkspaceLinks(links.data || [])
      setWorkspaceReports(reps.data || [])
      setWorkspaceTimeline(timeline.data || [])

      if (reqList.length > 0) {
        const reqIds = reqList.map((r: any) => r.id)
        const { data: subs } = await supabase.from('project_requirement_submissions').select('*').in('requirement_id', reqIds)
        setWorkspaceSubmissions(subs || [])
      } else {
        setWorkspaceSubmissions([])
      }
    } catch (e) {
      console.error('Error fetching workspace data:', e)
    } finally {
      setLoadingWorkspace(false)
    }
  }

  const logWorkspaceActivity = async (projectId: string, action: string, notes: string = '') => {
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('project_activity_timeline').insert({
        project_id: projectId,
        user_name: 'Admin Team',
        action,
        notes
      })
      // Refresh timeline locally
      const { data } = await supabase.from('project_activity_timeline').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
      setWorkspaceTimeline(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  const notifyClient = async (clientCompanyOrEmail: string, title: string, message: string) => {
    if (!isSupabaseConfigured()) return
    try {
      await supabase.from('client_notifications').insert({
        client_id: clientCompanyOrEmail,
        title,
        message,
        type: 'support',
        is_read: false
      })
    } catch (e) {
      console.error(e)
    }
  }

  const saveProjectDetails = async (updated: Project) => {
    if (isSupabaseConfigured()) {
      try {
        const extraJson = JSON.stringify({ 
          type: updated.type, 
          budget: updated.budget, 
          spent: updated.spent, 
          timeline: updated.timeline, 
          progress: updated.progress, 
          milestones: updated.milestones, 
          startDate: updated.startDate, 
          pm: updated.pm, 
          prompt: updated.prompt, 
          approvalStatus: updated.approvalStatus, 
          businessDetails: updated.businessDetails 
        })
        const { error } = await supabase.from('projects').update({ 
          status: updated.status, 
          stack: extraJson 
        }).eq('id', updated.id)

        if (!error) {
          setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
          setDetailProject(updated)
          toast({ title: 'Project details updated' })
          await logWorkspaceActivity(updated.id, 'Project Details Updated', `Status: ${updated.status}, Progress: ${updated.progress}%`)
        }
      } catch (e: any) {
        toast({ title: 'Error updating project', description: e.message, variant: 'destructive' })
      }
    }
  }

  const handleToggleMilestone = async (project: Project, index: number) => {
    const updatedMilestones = [...project.milestones]
    const m = updatedMilestones[index]
    if (m.endsWith(' ✅')) {
      updatedMilestones[index] = m.replace(' ✅', ' ⏳')
    } else if (m.endsWith(' ⏳')) {
      updatedMilestones[index] = m.replace(' ⏳', ' ✅')
    } else {
      updatedMilestones[index] = m + ' ✅'
    }
    
    const completedCount = updatedMilestones.filter(m => m.endsWith(' ✅')).length
    const progress = Math.round((completedCount / updatedMilestones.length) * 100) || 0

    const updated = { ...project, milestones: updatedMilestones, progress }
    await saveProjectDetails(updated)
  }

  const handleAddMilestone = async (project: Project) => {
    if (!newMilestoneText.trim()) return
    const updatedMilestones = [...project.milestones, `${newMilestoneText.trim()} ⏳`]
    const completedCount = updatedMilestones.filter(m => m.endsWith(' ✅')).length
    const progress = Math.round((completedCount / updatedMilestones.length) * 100) || 0

    const updated = { ...project, milestones: updatedMilestones, progress }
    await saveProjectDetails(updated)
    setNewMilestoneText('')
  }

  const handleDeleteMilestone = async (project: Project, index: number) => {
    const updatedMilestones = project.milestones.filter((_, i) => i !== index)
    const completedCount = updatedMilestones.filter(m => m.endsWith(' ✅')).length
    const progress = Math.round((completedCount / updatedMilestones.length) * 100) || 0

    const updated = { ...project, milestones: updatedMilestones, progress }
    await saveProjectDetails(updated)
  }

  const handleCreateRequirement = async (projectId: string, clientName: string) => {
    if (!reqTitle.trim()) return
    try {
      const { error } = await supabase.from('project_requirements').insert({
        project_id: projectId,
        title: reqTitle,
        description: reqDesc,
        category: reqCategory,
        priority: reqPriority,
        due_date: reqDueDate || null,
        allow_file: reqAllowFile,
        allow_link: reqAllowLink,
        allow_text: reqAllowText,
        allow_multiple: reqAllowMultiple,
        is_required: reqIsRequired,
        status: 'pending'
      })

      if (error) throw error

      toast({ title: 'Requirement Request Created' })
      setReqTitle('')
      setReqDesc('')
      setReqDueDate('')
      setShowReqForm(false)
      
      fetchProjectWorkspaceData(projectId)
      await logWorkspaceActivity(projectId, 'Requirement Requested', `Requested: ${reqTitle} (${reqCategory})`)
      await notifyClient(clientName, `New Requirement Requested: ${reqTitle}`, `Please provide the requested ${reqCategory} details for your project.`)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleReviewSubmission = async (projectId: string, clientName: string, subId: string, reqId: string, action: 'Approve' | 'Decline') => {
    try {
      const status = action === 'Approve' ? 'completed' : 'needs revision'
      
      await supabase.from('project_requirements').update({ status }).eq('id', reqId)
      await supabase.from('project_requirement_submissions').update({
        feedback: reviewComment,
        feedback_by: 'Admin Team',
        feedback_at: new Date().toISOString()
      }).eq('id', subId)

      toast({ title: `Submission ${action}d` })
      setReviewComment('')
      setReviewingSub(null)

      fetchProjectWorkspaceData(projectId)
      await logWorkspaceActivity(projectId, `Requirement ${action}d`, `Requirement status set to ${status}. Feedback: "${reviewComment}"`)
      await notifyClient(clientName, `Requirement ${action}d`, `Your submission has been ${action.toLowerCase()}d by our team. Feedback: "${reviewComment}"`)
    } catch (e: any) {
      toast({ title: 'Error reviewing submission', description: e.message, variant: 'destructive' })
    }
  }

  const handleUploadFile = async (projectId: string, clientName: string) => {
    if (!uploadFile) return
    setUploadingFileState(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('projectId', projectId)
      formData.append('category', fileCategory)
      formData.append('uploadedBy', 'Admin Team')

      const res = await fetch('/api/project-files/upload', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Upload failed')

      await supabase.from('project_files').insert({
        project_id: projectId,
        name: data.fileName || uploadFile.name,
        file_path: data.url,
        category: fileCategory,
        version: parseInt(fileVersion) || 1,
        visibility: fileVisibility,
        uploaded_by: 'Admin Team'
      })

      toast({ title: 'File uploaded successfully', description: uploadFile.name })
      setUploadFile(null)

      fetchProjectWorkspaceData(projectId)
      await logWorkspaceActivity(projectId, 'File Uploaded', `Uploaded ${uploadFile.name} (${fileCategory}) - Visibility: ${fileVisibility}`)

      if (fileVisibility === 'Published to Client') {
        await notifyClient(clientName, 'New Project File Published', `We have uploaded a new file to your workspace: ${uploadFile.name}`)
      }
    } catch (e: any) {
      toast({ title: 'Upload Failed', description: e.message, variant: 'destructive' })
    } finally {
      setUploadingFileState(false)
    }
  }

  const handleUploadReport = async (projectId: string, clientName: string) => {
    if (!uploadReportFile || !reportTitle.trim()) return
    setUploadingReportState(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadReportFile)
      formData.append('projectId', projectId)
      formData.append('category', 'Reports')
      formData.append('uploadedBy', 'Admin Team')

      const res = await fetch('/api/project-files/upload', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Upload failed')

      await supabase.from('project_reports').insert({
        project_id: projectId,
        title: reportTitle,
        report_type: reportType,
        file_path: data.url,
        version: parseInt(reportVersion) || 1,
        visibility: reportVisibility,
        uploaded_by: 'Admin Team'
      })

      toast({ title: 'Report uploaded successfully', description: reportTitle })
      setUploadReportFile(null)
      setReportTitle('')

      fetchProjectWorkspaceData(projectId)
      await logWorkspaceActivity(projectId, 'Report Uploaded', `Uploaded report: ${reportTitle} (${reportType}) - Visibility: ${reportVisibility}`)

      if (reportVisibility === 'Published to Client') {
        await notifyClient(clientName, 'New Performance Report Uploaded', `A new ${reportType} report has been published to your workspace: ${reportTitle}`)
      }
    } catch (e: any) {
      toast({ title: 'Upload Failed', description: e.message, variant: 'destructive' })
    } finally {
      setUploadingReportState(false)
    }
  }

  const handleAddLink = async (projectId: string, clientName: string) => {
    if (!linkTitle.trim() || !linkUrl.trim()) return
    try {
      await supabase.from('project_links').insert({
        project_id: projectId,
        title: linkTitle,
        category: linkCategory,
        description: linkDesc,
        url: linkUrl,
        visibility: linkVisibility
      })

      toast({ title: 'Resource Link Published' })
      setLinkTitle('')
      setLinkUrl('')
      setLinkDesc('')

      fetchProjectWorkspaceData(projectId)
      await logWorkspaceActivity(projectId, 'Link Added', `Added resource link: ${linkTitle} (${linkCategory}) - Visibility: ${linkVisibility}`)

      if (linkVisibility === 'Published to Client') {
        await notifyClient(clientName, 'New Resource Link Added', `A new link has been shared with you: ${linkTitle}`)
      }
    } catch (e: any) {
      toast({ title: 'Error adding link', description: e.message, variant: 'destructive' })
    }
  }

  const handleUpdateFileVisibility = async (projectId: string, fileId: string, fileName: string, visibility: string) => {
    try {
      await supabase.from('project_files').update({ visibility }).eq('id', fileId)
      toast({ title: 'File visibility updated' })
      fetchProjectWorkspaceData(projectId)
      await logWorkspaceActivity(projectId, 'File Visibility Updated', `Set visibility of ${fileName} to ${visibility}`)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleUpdateReportVisibility = async (projectId: string, reportId: string, reportTitle: string, visibility: string) => {
    try {
      await supabase.from('project_reports').update({ visibility }).eq('id', reportId)
      toast({ title: 'Report visibility updated' })
      fetchProjectWorkspaceData(projectId)
      await logWorkspaceActivity(projectId, 'Report Visibility Updated', `Set visibility of report "${reportTitle}" to ${visibility}`)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const handleUpdateLinkVisibility = async (projectId: string, linkId: string, linkTitle: string, visibility: string) => {
    try {
      await supabase.from('project_links').update({ visibility }).eq('id', linkId)
      toast({ title: 'Link visibility updated' })
      fetchProjectWorkspaceData(projectId)
      await logWorkspaceActivity(projectId, 'Link Visibility Updated', `Set visibility of link "${linkTitle}" to ${visibility}`)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const emptyForm: CampaignStrategyForm = {
    businessName: '', businessCategory: 'Digital Marketing', website: '', phone: '', email: '',
    location: '', businessDescription: '', products: '', services: '', offers: '',
    competitors: '', currentMarketing: '', monthlyBudget: '', platformBudget: '',
    targetAudience: '', businessGoals: '', timeline: '', notes: ''
  }
  const [form, setForm] = useState<CampaignStrategyForm>(emptyForm)

  useEffect(() => {
    const cached = getCachedData<Project[]>('projects')
    if (cached) { setProjects(cached); setLoading(false) }
    async function loadProjects() {
      if (!cached) setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
          if (!error && data) {
            const mapped = data.map((p: any) => {
              let extra: any = { type: 'Web Development', budget: 0, spent: 0, timeline: '', progress: 0, milestones: [] as string[], startDate: p.created, pm: 'Devon S.', prompt: '', approvalStatus: 'draft', businessDetails: undefined }
              if (p.stack) { try { extra = { ...extra, ...JSON.parse(p.stack) } } catch { extra.pm = p.stack } }
              return { id: p.id, title: p.title, client: p.client, type: extra.type, budget: Number(extra.budget) || 0, spent: Number(extra.spent) || 0, timeline: extra.timeline, status: p.status, progress: Number(extra.progress) || 0, milestones: Array.isArray(extra.milestones) ? extra.milestones : [], startDate: extra.startDate || p.created, pm: extra.pm, history: Array.isArray(p.history) ? p.history : [], prompt: extra.prompt || '', approvalStatus: extra.approvalStatus || 'draft', businessDetails: extra.businessDetails || undefined }
            })
            setProjects(mapped); setCachedData('projects', mapped)
          }

          // Fetch custom campaign categories
          const { data: settings } = await supabase.from('company_settings').select('docs').limit(1).maybeSingle()
          if (settings?.docs?.campaignCategories) {
            setCategories(settings.docs.campaignCategories)
          }
        } catch (err: any) { toast({ title: 'Database Error', description: err.message, variant: 'destructive' }) }
      }
      setLoading(false)
    }
    loadProjects()
  }, [])

  const saveCategories = async (updatedCats: string[]) => {
    setCategories(updatedCats)
    if (isSupabaseConfigured()) {
      try {
        const { data: exist } = await supabase.from('company_settings').select('id, docs').limit(1).maybeSingle()
        if (exist) {
          const updatedDocs = { ...exist.docs, campaignCategories: updatedCats }
          await supabase.from('company_settings').update({ docs: updatedDocs }).eq('id', exist.id)
        } else {
          await supabase.from('company_settings').insert([{ docs: { campaignCategories: updatedCats } }])
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
    if (catToDelete === 'Other') {
      toast({ title: 'Cannot delete "Other" category', variant: 'destructive' })
      return
    }
    const updated = categories.filter(c => c !== catToDelete)
    saveCategories(updated)
    toast({ title: 'Category Deleted' })
  }

  const filtered = projects.filter(p => p.title.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase()))

  const handleGeneratePrompt = () => {
    const prompt = generateCampaignPrompt(form)
    setGeneratedPrompt(prompt)
    setCurrentStep(2)
    toast({ title: 'Prompt Generated!', description: 'Copy it or download to use with Claude.' })
  }

  const handleCreateProject = async () => {
    if (!form.businessName) return
    setGenerating(true)
    try {
      const docId = generateDocId('NG-CSE')
      const targetId = String(Date.now())
      const targetCreated = new Date().toISOString().slice(0, 10)
      const targetHistory = [{ date: targetCreated, action: 'Campaign strategy created', canDownload: true }]
      const prompt = generatedPrompt || generateCampaignPrompt(form)

      const newProj: Project = {
        id: targetId, title: form.businessName, client: form.businessName, type: form.businessCategory,
        budget: Number(form.monthlyBudget) || 0, spent: 0, timeline: form.timeline, status: 'planned',
        progress: 0, milestones: ['Research ⏳', 'Strategy ⏳', 'Execution ⏳'],
        startDate: targetCreated, pm: 'Strategy Team', history: targetHistory,
        prompt, approvalStatus: 'draft', businessDetails: form
      }

      if (isSupabaseConfigured()) {
        const extraJson = JSON.stringify({
          type: form.businessCategory, budget: Number(form.monthlyBudget) || 0, spent: 0,
          timeline: form.timeline, progress: 0, milestones: ['Research ⏳', 'Strategy ⏳', 'Execution ⏳'],
          startDate: targetCreated, pm: 'Strategy Team', prompt, approvalStatus: 'draft', businessDetails: form
        })
        const { error } = await supabase.from('projects').insert([{
          id: targetId, doc_id: docId, title: form.businessName, client: form.businessName,
          stack: extraJson, status: 'planned', created: targetCreated, history: targetHistory
        }])
        if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return }
      }

      const updatedList = [newProj, ...projects]
      setProjects(updatedList); setCachedData('projects', updatedList); invalidateCache('dashboard')
      setShowCreate(false); setGeneratedPrompt(''); setForm(emptyForm); setCurrentStep(0)
      toast({ title: 'Campaign Strategy Created!', description: 'View it to generate the AI prompt.' })
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
    finally { setGenerating(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    if (isSupabaseConfigured()) { await supabase.from('projects').delete().eq('id', deleteId) }
    const updatedList = projects.filter(p => p.id !== deleteId)
    setProjects(updatedList); setCachedData('projects', updatedList); invalidateCache('dashboard')
    setDeleteId(null); toast({ title: 'Strategy Deleted' })
  }

  const openDetail = (p: Project) => {
    setDetailProject(p)
    if (p.businessDetails) setForm(p.businessDetails)
    setGeneratedPrompt(p.prompt || '')
    setActiveTab('overview')

    // Initialize workspace editing states
    setEditedPm(p.pm || '')
    setEditedBudget(p.budget || 0)
    setEditedSpent(p.spent || 0)
    setEditedTimeline(p.timeline || '')
    setEditedProgress(p.progress || 0)
    setEditedStatus(p.status || 'planned')

    fetchProjectWorkspaceData(p.id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gold" />
            <h1 className="text-2xl font-bold tracking-tight">Campaign Strategy Engine</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">Create complete marketing strategies with AI-powered prompt generation</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => setShowManageCategories(true)} className="gap-1.5 flex-1 sm:flex-initial">
            Manage Categories
          </Button>
          <Button variant="gold" size="sm" onClick={() => { setForm(emptyForm); setGeneratedPrompt(''); setCurrentStep(1); setShowCreate(true) }} className="gap-1.5 flex-1 sm:flex-initial">
            <Plus className="h-4 w-4" />New Strategy
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Strategies', value: projects.length },
          { label: 'Active', value: projects.filter(p => p.status === 'active').length },
          { label: 'Total Budget', value: formatCurrency(projects.reduce((s, p) => s + p.budget, 0)) },
          { label: 'Planned', value: projects.filter(p => p.status === 'planned').length },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold mt-1">{s.value}</p></CardContent></Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search strategies..." value={search} onChange={e => setSearch(e.target.value)} /></div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(p => (
          <Card key={p.id} className="ai-card ai-card-glow hover:shadow-md transition-all cursor-pointer" onClick={() => openDetail(p)}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-semibold text-sm">{p.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.client} · {p.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <ApprovalBadge status={p.approvalStatus || 'draft'} />
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[p.status]}`}>{p.status}</span>
                </div>
              </div>
              <div className="space-y-1 mb-3">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Progress</span><span className="font-semibold">{p.progress}%</span></div>
                <Progress value={p.progress} className="h-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="flex items-center gap-1 text-muted-foreground"><DollarSign className="h-3 w-3 text-gold" /><span className="font-semibold text-foreground">{formatCurrency(p.budget)}</span></div>
                <div className="flex items-center gap-1 text-muted-foreground"><Calendar className="h-3 w-3" />{p.timeline || 'Not set'}</div>
              </div>
              <div className="flex gap-2 justify-end border-t border-border pt-3" onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openDetail(p)} title="View Details"><Eye className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setForm(p.businessDetails || emptyForm); setEditId(p.id) }} title="Edit"><Edit className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-400" onClick={() => setDeleteId(p.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── CREATE DIALOG ──────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Campaign Strategy</DialogTitle>
            <div className="mt-3"><WorkflowSteps steps={WORKFLOW_STEPS} currentStep={currentStep} /></div>
          </DialogHeader>

          <Tabs defaultValue="details" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">Business Details</TabsTrigger>
              <TabsTrigger value="prompt" className="flex-1">AI Prompt</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Business Name *</Label><Input placeholder="e.g. FashionHub India" value={form.businessName} onChange={e => setForm({...form, businessName: e.target.value})} /></div>
                <div className="space-y-1"><Label>Business Category</Label><Select value={form.businessCategory} onValueChange={v => setForm({...form, businessCategory: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Website</Label><Input placeholder="https://example.com" value={form.website} onChange={e => setForm({...form, website: e.target.value})} /></div>
                <div className="space-y-1"><Label>Phone</Label><Input placeholder="+91 ..." value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
                <div className="space-y-1"><Label>Email</Label><Input placeholder="contact@business.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Location</Label><Input placeholder="City, State" value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Business Description</Label><Textarea className="h-20 resize-none" placeholder="What does the business do? What's the value proposition?" value={form.businessDescription} onChange={e => setForm({...form, businessDescription: e.target.value})} /></div>
                <div className="space-y-1"><Label>Products</Label><Textarea className="h-16 resize-none" placeholder="Key products..." value={form.products} onChange={e => setForm({...form, products: e.target.value})} /></div>
                <div className="space-y-1"><Label>Services</Label><Textarea className="h-16 resize-none" placeholder="Key services..." value={form.services} onChange={e => setForm({...form, services: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Current Offers / Promotions</Label><Input placeholder="Any active offers..." value={form.offers} onChange={e => setForm({...form, offers: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Competitors</Label><Textarea className="h-16 resize-none" placeholder="List key competitors..." value={form.competitors} onChange={e => setForm({...form, competitors: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Current Marketing Activities</Label><Textarea className="h-16 resize-none" placeholder="What marketing is currently being done?" value={form.currentMarketing} onChange={e => setForm({...form, currentMarketing: e.target.value})} /></div>
                <div className="space-y-1"><Label>Monthly Budget (₹)</Label><Input type="number" value={form.monthlyBudget} onChange={e => setForm({...form, monthlyBudget: e.target.value})} /></div>
                <div className="space-y-1"><Label>Platform Budget Allocation</Label><Input placeholder="e.g. Meta: 50%, Google: 30%, SEO: 20%" value={form.platformBudget} onChange={e => setForm({...form, platformBudget: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Target Audience</Label><Textarea className="h-16 resize-none" placeholder="Demographics, interests, behaviors..." value={form.targetAudience} onChange={e => setForm({...form, targetAudience: e.target.value})} /></div>
                <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Business Goals</Label><Textarea className="h-16 resize-none" placeholder="What are the key business goals?" value={form.businessGoals} onChange={e => setForm({...form, businessGoals: e.target.value})} /></div>
                <div className="space-y-1"><Label>Timeline</Label><Input placeholder="e.g. 3 months, 6 months" value={form.timeline} onChange={e => setForm({...form, timeline: e.target.value})} /></div>
                <div className="space-y-1"><Label>Additional Notes</Label><Textarea className="h-12 resize-none" placeholder="Anything else..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              </div>

              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border">
                <Button variant="gold" className="gap-1.5" onClick={handleGeneratePrompt} disabled={!form.businessName}>
                  <Sparkles className="h-4 w-4" />Generate Prompt
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href="/ai-hub/skills" target="_blank"><Download className="h-3.5 w-3.5" />Download Skill</a>
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="prompt" className="mt-4">
              <PromptViewer
                prompt={generatedPrompt}
                title="Campaign Strategy Prompt"
                downloadFilename={`Campaign_Prompt_${form.businessName.replace(/\s+/g, '_')}.txt`}
              />
              {generatedPrompt && (
                <div className="mt-4 flex items-center gap-3">
                  <Button variant="outline" size="sm" className="gap-1.5" asChild>
                    <a href="/ai-hub/skills" target="_blank"><Download className="h-3.5 w-3.5" />Download Marketing Strategy.skill</a>
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" asChild>
                    <a href="https://claude.ai" target="_blank" rel="noopener"><ExternalLink className="h-3.5 w-3.5" />Open Claude</a>
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="gold" onClick={handleCreateProject} disabled={generating || !form.businessName}>
              {generating ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Creating...</> : 'Save Strategy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DETAIL DIALOG ──────────────────────────────────────────────── */}
      <Dialog open={!!detailProject} onOpenChange={open => { if (!open) { setDetailProject(null); setGeneratedPrompt('') } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-gold" />
              {detailProject?.title}
            </DialogTitle>
            <div className="flex items-center gap-2 mt-1">
              <ApprovalBadge status={detailProject?.approvalStatus || 'draft'} />
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[detailProject?.status || 'planned']}`}>{detailProject?.status}</span>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full flex flex-wrap gap-1 bg-[#11241c]/40 border border-[#152e23] p-1 rounded-lg">
              <TabsTrigger value="overview" className="text-xs px-3 py-1.5 data-[state=active]:bg-gold data-[state=active]:text-black">Overview</TabsTrigger>
              <TabsTrigger value="workspace-reqs" className="text-xs px-3 py-1.5 data-[state=active]:bg-gold data-[state=active]:text-black">Requirements</TabsTrigger>
              <TabsTrigger value="workspace-files" className="text-xs px-3 py-1.5 data-[state=active]:bg-gold data-[state=active]:text-black">Files & Docs</TabsTrigger>
              <TabsTrigger value="workspace-reports" className="text-xs px-3 py-1.5 data-[state=active]:bg-gold data-[state=active]:text-black">Reports</TabsTrigger>
              <TabsTrigger value="workspace-links" className="text-xs px-3 py-1.5 data-[state=active]:bg-gold data-[state=active]:text-black">Links</TabsTrigger>
              <TabsTrigger value="workspace-timeline" className="text-xs px-3 py-1.5 data-[state=active]:bg-gold data-[state=active]:text-black">Timeline</TabsTrigger>
              <TabsTrigger value="prompt" className="text-xs px-3 py-1.5 data-[state=state]:bg-gold data-[state=active]:bg-gold data-[state=active]:text-black">AI Prompt</TabsTrigger>
              <TabsTrigger value="versions" className="text-xs px-3 py-1.5 data-[state=active]:bg-gold data-[state=active]:text-black">Versions</TabsTrigger>
            </TabsList>

            {/* ── OVERVIEW TAB ── */}
            <TabsContent value="overview" className="mt-4 space-y-4">
              {detailProject && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className="bg-[#091510] border-[#152e23]"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground uppercase">Budget</p><p className="text-sm font-bold text-gold">{formatCurrency(detailProject.budget || 0)}</p></CardContent></Card>
                    <Card className="bg-[#091510] border-[#152e23]"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground uppercase">Spent</p><p className="text-sm font-bold text-slate-300">{formatCurrency(detailProject.spent || 0)}</p></CardContent></Card>
                    <Card className="bg-[#091510] border-[#152e23]"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground uppercase">Progress</p><p className="text-sm font-bold text-emerald-400">{detailProject.progress}%</p></CardContent></Card>
                    <Card className="bg-[#091510] border-[#152e23]"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground uppercase">PM Assignee</p><p className="text-sm font-bold text-slate-300">{detailProject.pm || 'N/A'}</p></CardContent></Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Left Column: Milestones Checklist */}
                    <div className="md:col-span-2 space-y-3">
                      <div className="flex justify-between items-center border-b border-border pb-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gold">Project Milestones Checklist</h4>
                        <span className="text-[10px] text-slate-500">{detailProject.milestones.length} milestones</span>
                      </div>
                      
                      <div className="space-y-2 max-h-[220px] overflow-y-auto">
                        {detailProject.milestones.map((m, idx) => {
                          const isDone = m.endsWith(' ✅')
                          const cleanLabel = m.replace(' ✅', '').replace(' ⏳', '')
                          return (
                            <div key={idx} className="flex items-center justify-between p-2 rounded bg-[#0b1b15] border border-[#152e23]/60 hover:border-gold/30">
                              <div className="flex items-center gap-2">
                                <input 
                                  type="checkbox" 
                                  checked={isDone}
                                  onChange={() => handleToggleMilestone(detailProject, idx)}
                                  className="h-3.5 w-3.5 rounded border-gray-300 text-gold focus:ring-gold accent-gold shrink-0 cursor-pointer"
                                />
                                <span className={`text-xs ${isDone ? 'line-through text-slate-500' : 'text-slate-200'}`}>{cleanLabel}</span>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-red-400 hover:text-red-400 hover:bg-red-500/10"
                                onClick={() => handleDeleteMilestone(detailProject, idx)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )
                        })}
                        {detailProject.milestones.length === 0 && (
                          <p className="text-xs text-slate-500 text-center py-4">No milestones created yet.</p>
                        )}
                      </div>

                      {/* Add Milestone Inline Form */}
                      <div className="flex gap-2 pt-1">
                        <Input 
                          placeholder="Add new milestone (e.g. Figma Review)" 
                          value={newMilestoneText}
                          onChange={e => setNewMilestoneText(e.target.value)}
                          className="h-8 text-xs bg-[#091510] border-[#152e23]"
                        />
                        <Button 
                          variant="gold" 
                          size="sm" 
                          className="h-8 text-xs px-3"
                          onClick={() => handleAddMilestone(detailProject)}
                        >
                          Add
                        </Button>
                      </div>
                    </div>

                    {/* Right Column: Quick Stats Editor */}
                    <div className="space-y-4 bg-[#091510] border border-[#152e23] rounded-xl p-4">
                      <div className="flex justify-between items-center border-b border-[#152e23] pb-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gold">Edit Details</h4>
                        <Button variant="ghost" size="sm" onClick={() => setEditingOverview(!editingOverview)} className="text-gold h-6 text-[10px]">
                          {editingOverview ? 'Cancel' : 'Edit'}
                        </Button>
                      </div>

                      {editingOverview ? (
                        <div className="space-y-3 text-xs">
                          <div className="space-y-1">
                            <Label className="text-[10px]">Status</Label>
                            <Select value={editedStatus} onValueChange={setEditedStatus}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active" className="text-xs">Active</SelectItem>
                                <SelectItem value="planned" className="text-xs">Planned</SelectItem>
                                <SelectItem value="completed" className="text-xs">Completed</SelectItem>
                                <SelectItem value="paused" className="text-xs">Paused</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Budget (₹)</Label>
                            <Input type="number" value={editedBudget} onChange={e => setEditedBudget(Number(e.target.value))} className="h-7 text-xs bg-[#0b1b15]" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Spent (₹)</Label>
                            <Input type="number" value={editedSpent} onChange={e => setEditedSpent(Number(e.target.value))} className="h-7 text-xs bg-[#0b1b15]" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Timeline (e.g. 8 Weeks)</Label>
                            <Input value={editedTimeline} onChange={e => setEditedTimeline(e.target.value)} className="h-7 text-xs bg-[#0b1b15]" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Project Manager</Label>
                            <Input value={editedPm} onChange={e => setEditedPm(e.target.value)} className="h-7 text-xs bg-[#0b1b15]" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] flex justify-between">Progress <span>{editedProgress}%</span></Label>
                            <input 
                              type="range" 
                              min="0" 
                              max="100" 
                              value={editedProgress} 
                              onChange={e => setEditedProgress(Number(e.target.value))}
                              className="w-full accent-gold bg-[#0b1b15]" 
                            />
                          </div>
                          <Button 
                            variant="gold" 
                            size="sm" 
                            className="w-full h-8 text-xs mt-2"
                            onClick={() => {
                              const updated = { 
                                ...detailProject, 
                                pm: editedPm, 
                                budget: editedBudget, 
                                spent: editedSpent, 
                                timeline: editedTimeline, 
                                progress: editedProgress,
                                status: editedStatus
                              }
                              saveProjectDetails(updated)
                              setEditingOverview(false)
                            }}
                          >
                            Save Workspace Changes
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2.5 text-xs font-sans">
                          <div className="flex justify-between border-b border-[#152e23] pb-1"><span className="text-slate-500">Status</span><span className="capitalize text-emerald-400 font-semibold">{detailProject.status}</span></div>
                          <div className="flex justify-between border-b border-[#152e23] pb-1"><span className="text-slate-500">Timeline</span><span className="font-semibold">{detailProject.timeline || 'Not set'}</span></div>
                          <div className="flex justify-between border-b border-[#152e23] pb-1"><span className="text-slate-500">Type</span><span className="font-semibold text-slate-300">{detailProject.type}</span></div>
                          <div className="flex justify-between border-b border-[#152e23] pb-1"><span className="text-slate-500">Date Created</span><span className="font-semibold text-slate-300">{formatDate(detailProject.startDate)}</span></div>
                        </div>
                      )}
                    </div>
                  </div>

                  <WorkflowSteps steps={WORKFLOW_STEPS} currentStep={detailProject?.prompt ? 3 : 1} />
                </>
              )}
            </TabsContent>

            {/* ── REQUIREMENTS REQUEST TAB ── */}
            <TabsContent value="workspace-reqs" className="mt-4 space-y-4">
              {detailProject && (
                <div className="space-y-4">
                  {/* Top Header and Toggle Request Form */}
                  <div className="flex justify-between items-center bg-[#091510] border border-[#152e23] p-3 rounded-xl">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gold">Requirements Request System</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Request guidelines, brand details, logos, or hosting details from the client.</p>
                    </div>
                    <Button variant="gold" size="sm" onClick={() => setShowReqForm(!showReqForm)} className="h-8 text-xs gap-1">
                      <Plus className="h-3.5 w-3.5" /> {showReqForm ? 'Close Form' : 'Request Info'}
                    </Button>
                  </div>

                  {/* Create Request Form */}
                  {showReqForm && (
                    <Card className="bg-[#091510] border-[#152e23] p-4 space-y-3">
                      <h5 className="text-xs font-bold text-gold">New Requirement Details</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="space-y-1">
                          <Label>Requirement Title *</Label>
                          <Input placeholder="e.g. Brand Guidelines PDF" value={reqTitle} onChange={e => setReqTitle(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label>Category</Label>
                          <Select value={reqCategory} onValueChange={setReqCategory}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {['Logo', 'Brand Guidelines', 'Brand Colors', 'Fonts', 'Business Description', 'Competitor Websites', 'Social Media Links', 'Hosting Details', 'Domain Details', 'Google Analytics Access', 'Meta Business Access', 'Google Ads Access', 'Images', 'Videos', 'PDFs', 'Documents', 'Custom Request'].map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label>Instructions / Description</Label>
                          <Textarea placeholder="Explain what guidelines or files are needed..." value={reqDesc} onChange={e => setReqDesc(e.target.value)} className="h-16" />
                        </div>
                        <div className="space-y-1">
                          <Label>Priority</Label>
                          <Select value={reqPriority} onValueChange={setReqPriority}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Due Date</Label>
                          <Input type="date" value={reqDueDate} onChange={e => setReqDueDate(e.target.value)} />
                        </div>
                        
                        {/* Checkboxes */}
                        <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#152e23]">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={reqAllowFile} onChange={e => setReqAllowFile(e.target.checked)} className="rounded text-gold accent-gold focus:ring-gold" />
                            <span>Allow File Upload</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={reqAllowLink} onChange={e => setReqAllowLink(e.target.checked)} className="rounded text-gold accent-gold focus:ring-gold" />
                            <span>Allow Link URL</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={reqAllowText} onChange={e => setReqAllowText(e.target.checked)} className="rounded text-gold accent-gold focus:ring-gold" />
                            <span>Allow Text Note</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={reqIsRequired} onChange={e => setReqIsRequired(e.target.checked)} className="rounded text-gold accent-gold focus:ring-gold" />
                            <span>Is Required</span>
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end border-t border-[#152e23] pt-3">
                        <Button variant="outline" size="sm" onClick={() => setShowReqForm(false)}>Cancel</Button>
                        <Button variant="gold" size="sm" onClick={() => handleCreateRequirement(detailProject.id, detailProject.client)}>Submit Request</Button>
                      </div>
                    </Card>
                  )}

                  {/* Submission Review Modal Overlay */}
                  {reviewingSub && (
                    <Card className="bg-[#121f1a] border-[#1e3a2f] p-4 space-y-3 relative">
                      <button onClick={() => setReviewingSub(null)} className="absolute top-2 right-2 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
                      <h5 className="text-xs font-bold text-[#D4AF37] uppercase">Review Client Submission</h5>
                      <div className="text-xs space-y-1.5 bg-[#070e0b]/60 p-3 rounded border border-[#1e3a2f]/40 font-mono">
                        <div><span className="text-slate-500">Submitted By:</span> <span className="text-white">{reviewingSub.submitted_by}</span></div>
                        <div><span className="text-slate-500">Submitted At:</span> <span className="text-white">{new Date(reviewingSub.submitted_at).toLocaleString('en-IN')}</span></div>
                        {reviewingSub.text_response && <div><span className="text-slate-500">Text Response:</span> <p className="text-slate-300 mt-1 italic font-sans">"{reviewingSub.text_response}"</p></div>}
                        {reviewingSub.links && reviewingSub.links.length > 0 && (
                          <div>
                            <span className="text-slate-500">Links:</span> 
                            <div className="flex flex-col gap-1 mt-1 font-sans">
                              {reviewingSub.links.map((link: string, i: number) => (
                                <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline flex items-center gap-1"><ExternalLink className="h-3 w-3 shrink-0" />{link}</a>
                              ))}
                            </div>
                          </div>
                        )}
                        {reviewingSub.file_paths && reviewingSub.file_paths.length > 0 && (
                          <div>
                            <span className="text-slate-500">Uploaded Files:</span> 
                            <div className="flex flex-col gap-1.5 mt-1 font-sans">
                              {reviewingSub.file_paths.map((file: string, i: number) => (
                                <a key={i} href={file} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline flex items-center gap-1.5 border border-[#152e23] p-1.5 rounded bg-black/40"><Download className="h-3.5 w-3.5" />{file.split('/').pop()}</a>
                              ))}
                            </div>
                          </div>
                        )}
                        {reviewingSub.notes && <div><span className="text-slate-500">Notes:</span> <p className="text-slate-300 mt-1 italic font-sans">"{reviewingSub.notes}"</p></div>}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Feedback Comments (Required on revision)</Label>
                        <Textarea 
                          placeholder="Approve with note, or request specific changes..." 
                          value={reviewComment}
                          onChange={e => setReviewComment(e.target.value)}
                          className="h-16 text-xs bg-[#0b1b15] border-[#1e3a2f]"
                        />
                      </div>
                      <div className="flex gap-2 justify-end pt-2 border-t border-[#1e3a2f]/40">
                        <Button variant="outline" size="sm" onClick={() => setReviewingSub(null)} className="h-8 text-xs">Close</Button>
                        <Button variant="outline" size="sm" onClick={() => handleReviewSubmission(detailProject.id, detailProject.client, reviewingSub.id, reviewingSub.requirement_id, 'Decline')} className="h-8 text-xs text-red-400 border-red-500/20 hover:bg-red-500/10">Request Revision</Button>
                        <Button variant="gold" size="sm" onClick={() => handleReviewSubmission(detailProject.id, detailProject.client, reviewingSub.id, reviewingSub.requirement_id, 'Approve')} className="h-8 text-xs px-4">Approve submission</Button>
                      </div>
                    </Card>
                  )}

                  {/* List of active requests */}
                  <div className="border border-[#152e23] rounded-xl overflow-hidden bg-[#091510]">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[#152e23] text-slate-400 uppercase tracking-wider text-[10px] bg-black/10">
                            <th className="text-left py-2 px-3 font-semibold">Title</th>
                            <th className="text-left py-2 px-3 font-semibold">Category</th>
                            <th className="text-left py-2 px-3 font-semibold">Priority</th>
                            <th className="text-left py-2 px-3 font-semibold">Due Date</th>
                            <th className="text-left py-2 px-3 font-semibold">Status</th>
                            <th className="text-right py-2 px-3 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workspaceRequirements.map((req: any) => {
                            const sub = workspaceSubmissions.find(s => s.requirement_id === req.id)
                            return (
                              <tr key={req.id} className="border-b border-[#152e23]/30 hover:bg-[#11241c]/10">
                                <td className="py-2.5 px-3">
                                  <p className="font-semibold text-slate-200">{req.title}</p>
                                  {req.description && <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{req.description}</p>}
                                </td>
                                <td className="py-2.5 px-3"><span className="px-1.5 py-0.5 rounded border border-[#152e23] bg-black/20 text-slate-400 text-[10px]">{req.category}</span></td>
                                <td className="py-2.5 px-3">
                                  <span className={`capitalize ${req.priority === 'high' ? 'text-red-400 font-bold' : req.priority === 'medium' ? 'text-yellow-400' : 'text-slate-400'}`}>{req.priority}</span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-400">{req.due_date ? formatDate(req.due_date) : '—'}</td>
                                <td className="py-2.5 px-3">
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${req.status === 'completed' || req.status === 'approved' ? 'text-emerald-400 bg-emerald-500/10' : req.status === 'needs revision' ? 'text-red-400 bg-red-500/10' : req.status === 'submitted' ? 'text-purple-400 bg-purple-500/10' : 'text-slate-400 bg-slate-500/10'}`}>{req.status}</span>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {sub ? (
                                    <Button variant="outline" size="sm" onClick={() => setReviewingSub(sub)} className="h-7 text-[10px] border-gold/20 text-gold hover:bg-gold/15">Review Submission</Button>
                                  ) : (
                                    <span className="text-[10px] text-slate-500 italic pr-2">Awaiting client response</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                          {workspaceRequirements.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-8 text-slate-500 italic">No requirement requests published yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── FILES & DOCUMENTS TAB ── */}
            <TabsContent value="workspace-files" className="mt-4 space-y-4">
              {detailProject && (
                <div className="space-y-4">
                  {/* File Uploader Card */}
                  <Card className="bg-[#091510] border-[#152e23] p-4 space-y-3">
                    <h4 className="text-xs font-bold text-gold uppercase">Upload Project Document / Resource File</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="space-y-1">
                        <Label>Select File *</Label>
                        <Input 
                          type="file" 
                          onChange={e => setUploadFile(e.target.files ? e.target.files[0] : null)} 
                          className="h-8 bg-[#0b1b15] border-[#152e23] file:text-gold"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Category</Label>
                        <Select value={fileCategory} onValueChange={setFileCategory}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['Proposal', 'Quotation', 'Scope of Work', 'Agreement', 'Invoice', 'Reports', 'Design Files', 'Development Files', 'Source Code', 'Testing Reports', 'Training Documents', 'Manuals', 'Other Documents'].map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Version</Label>
                        <Input type="number" value={fileVersion} onChange={e => setFileVersion(e.target.value)} className="h-8" />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label>Visibility</Label>
                        <Select value={fileVisibility} onValueChange={setFileVisibility}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Internal Only">Internal Only</SelectItem>
                            <SelectItem value="Published to Client">Published to Client</SelectItem>
                            <SelectItem value="Hidden">Hidden</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button 
                          variant="gold" 
                          className="w-full h-8 text-xs font-bold" 
                          onClick={() => handleUploadFile(detailProject.id, detailProject.client)}
                          disabled={uploadingFileState || !uploadFile}
                        >
                          {uploadingFileState ? 'Uploading...' : 'Upload & Register File'}
                        </Button>
                      </div>
                    </div>
                  </Card>

                  {/* Registered Files List */}
                  <div className="border border-[#152e23] rounded-xl overflow-hidden bg-[#091510]">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[#152e23] text-slate-400 uppercase tracking-wider text-[10px] bg-black/10">
                            <th className="text-left py-2 px-3 font-semibold">File Name</th>
                            <th className="text-left py-2 px-3 font-semibold">Category</th>
                            <th className="text-left py-2 px-3 font-semibold">Version</th>
                            <th className="text-left py-2 px-3 font-semibold">Upload Date</th>
                            <th className="text-left py-2 px-3 font-semibold">Visibility</th>
                            <th className="text-right py-2 px-3 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workspaceFiles.map((file: any) => (
                            <tr key={file.id} className="border-b border-[#152e23]/30 hover:bg-[#11241c]/10">
                              <td className="py-2 px-3 font-semibold text-slate-200 truncate max-w-[180px]" title={file.name}>{file.name}</td>
                              <td className="py-2 px-3 text-slate-400">{file.category}</td>
                              <td className="py-2 px-3 text-slate-400">V{file.version}</td>
                              <td className="py-2 px-3 text-slate-400">{formatDate(file.uploaded_at)}</td>
                              <td className="py-2 px-3">
                                <Select value={file.visibility} onValueChange={v => handleUpdateFileVisibility(detailProject.id, file.id, file.name, v)}>
                                  <SelectTrigger className="h-6 w-28 text-[10px] bg-black/30 border-[#152e23]"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Internal Only" className="text-[10px]">Internal Only</SelectItem>
                                    <SelectItem value="Published to Client" className="text-[10px]">Published to Client</SelectItem>
                                    <SelectItem value="Hidden" className="text-[10px]">Hidden</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="py-2 px-3 text-right">
                                <a href={file.file_path} target="_blank" rel="noopener noreferrer" download>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gold hover:bg-gold/15"><Download className="h-3.5 w-3.5" /></Button>
                                </a>
                              </td>
                            </tr>
                          ))}
                          {workspaceFiles.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-8 text-slate-500 italic">No workspace files uploaded yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── REPORTS TAB ── */}
            <TabsContent value="workspace-reports" className="mt-4 space-y-4">
              {detailProject && (
                <div className="space-y-4">
                  {/* Upload Reports form */}
                  <Card className="bg-[#091510] border-[#152e23] p-4 space-y-3">
                    <h4 className="text-xs font-bold text-gold uppercase">Upload Analytics / Performance Report</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="space-y-1">
                        <Label>Report Title *</Label>
                        <Input placeholder="e.g. SEO Report - June 2026" value={reportTitle} onChange={e => setReqTitle(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label>Report Type</Label>
                        <Select value={reportType} onValueChange={setReportType}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['Marketing Report', 'SEO Report', 'Google Ads Report', 'Meta Ads Report', 'Analytics Report', 'Performance Report', 'Custom Report'].map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Select PDF / Excel File *</Label>
                        <Input 
                          type="file" 
                          onChange={e => setUploadReportFile(e.target.files ? e.target.files[0] : null)} 
                          className="h-8 bg-[#0b1b15] border-[#152e23] file:text-gold"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Version</Label>
                        <Input type="number" value={reportVersion} onChange={e => setReportVersion(e.target.value)} className="h-8" />
                      </div>
                      <div className="space-y-1">
                        <Label>Visibility</Label>
                        <Select value={reportVisibility} onValueChange={setReportVisibility}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Internal Only">Internal Only</SelectItem>
                            <SelectItem value="Published to Client">Published to Client</SelectItem>
                            <SelectItem value="Hidden">Hidden</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button 
                          variant="gold" 
                          className="w-full h-8 text-xs font-bold" 
                          onClick={() => handleUploadReport(detailProject.id, detailProject.client)}
                          disabled={uploadingReportState || !uploadReportFile || !reportTitle.trim()}
                        >
                          {uploadingReportState ? 'Uploading...' : 'Publish Report'}
                        </Button>
                      </div>
                    </div>
                  </Card>

                  {/* Reports List */}
                  <div className="border border-[#152e23] rounded-xl overflow-hidden bg-[#091510]">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[#152e23] text-slate-400 uppercase tracking-wider text-[10px] bg-black/10">
                            <th className="text-left py-2 px-3 font-semibold">Report Title</th>
                            <th className="text-left py-2 px-3 font-semibold">Type</th>
                            <th className="text-left py-2 px-3 font-semibold">Version</th>
                            <th className="text-left py-2 px-3 font-semibold">Date Uploaded</th>
                            <th className="text-left py-2 px-3 font-semibold">Visibility</th>
                            <th className="text-right py-2 px-3 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workspaceReports.map((rep: any) => (
                            <tr key={rep.id} className="border-b border-[#152e23]/30 hover:bg-[#11241c]/10">
                              <td className="py-2 px-3 font-semibold text-slate-200 truncate max-w-[180px]" title={rep.title}>{rep.title}</td>
                              <td className="py-2 px-3 text-slate-400">{rep.report_type}</td>
                              <td className="py-2 px-3 text-slate-400">V{rep.version}</td>
                              <td className="py-2 px-3 text-slate-400">{formatDate(rep.uploaded_at)}</td>
                              <td className="py-2 px-3">
                                <Select value={rep.visibility} onValueChange={v => handleUpdateReportVisibility(detailProject.id, rep.id, rep.title, v)}>
                                  <SelectTrigger className="h-6 w-28 text-[10px] bg-black/30 border-[#152e23]"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Internal Only" className="text-[10px]">Internal Only</SelectItem>
                                    <SelectItem value="Published to Client" className="text-[10px]">Published to Client</SelectItem>
                                    <SelectItem value="Hidden" className="text-[10px]">Hidden</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="py-2 px-3 text-right">
                                <a href={rep.file_path} target="_blank" rel="noopener noreferrer" download>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gold hover:bg-gold/15"><Download className="h-3.5 w-3.5" /></Button>
                                </a>
                              </td>
                            </tr>
                          ))}
                          {workspaceReports.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-8 text-slate-500 italic">No reports generated yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── LINKS TAB ── */}
            <TabsContent value="workspace-links" className="mt-4 space-y-4">
              {detailProject && (
                <div className="space-y-4">
                  {/* Add Link form */}
                  <Card className="bg-[#091510] border-[#152e23] p-4 space-y-3">
                    <h4 className="text-xs font-bold text-gold uppercase">Publish Resource / Deliverable Link</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="space-y-1">
                        <Label>Link Title *</Label>
                        <Input placeholder="e.g. Figma UI Designs" value={linkTitle} onChange={e => setLinkTitle(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label>Category</Label>
                        <Select value={linkCategory} onValueChange={setLinkCategory}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['Live Website', 'Staging Website', 'Figma', 'Canva', 'Google Drive', 'GitHub Repository', 'Hosting', 'Analytics', 'Search Console', 'Google Ads', 'Meta Ads', 'Meeting Recordings', 'Training Videos', 'Other'].map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>URL Address *</Label>
                        <Input placeholder="https://..." value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label>Description</Label>
                        <Input placeholder="Optional brief details about the resource link..." value={linkDesc} onChange={e => setLinkDesc(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label>Visibility</Label>
                        <Select value={linkVisibility} onValueChange={setLinkVisibility}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Internal Only">Internal Only</SelectItem>
                            <SelectItem value="Published to Client">Published to Client</SelectItem>
                            <SelectItem value="Hidden">Hidden</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-3 flex justify-end pt-2 border-t border-[#152e23]">
                        <Button 
                          variant="gold" 
                          className="h-8 text-xs font-bold px-6" 
                          onClick={() => handleAddLink(detailProject.id, detailProject.client)}
                          disabled={!linkTitle.trim() || !linkUrl.trim()}
                        >
                          Publish Resource Link
                        </Button>
                      </div>
                    </div>
                  </Card>

                  {/* Links List */}
                  <div className="border border-[#152e23] rounded-xl overflow-hidden bg-[#091510]">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[#152e23] text-slate-400 uppercase tracking-wider text-[10px] bg-black/10">
                            <th className="text-left py-2 px-3 font-semibold">Title</th>
                            <th className="text-left py-2 px-3 font-semibold">Category</th>
                            <th className="text-left py-2 px-3 font-semibold">URL</th>
                            <th className="text-left py-2 px-3 font-semibold">Visibility</th>
                            <th className="text-right py-2 px-3 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workspaceLinks.map((link: any) => (
                            <tr key={link.id} className="border-b border-[#152e23]/30 hover:bg-[#11241c]/10">
                              <td className="py-2 px-3">
                                <p className="font-semibold text-slate-200">{link.title}</p>
                                {link.description && <p className="text-[10px] text-slate-500">{link.description}</p>}
                              </td>
                              <td className="py-2 px-3 text-slate-400">{link.category}</td>
                              <td className="py-2 px-3 truncate max-w-[200px]" title={link.url}>
                                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline flex items-center gap-1 font-mono text-[10px]"><Link2 className="h-3 w-3 shrink-0" /> {link.url}</a>
                              </td>
                              <td className="py-2 px-3">
                                <Select value={link.visibility} onValueChange={v => handleUpdateLinkVisibility(detailProject.id, link.id, link.title, v)}>
                                  <SelectTrigger className="h-6 w-28 text-[10px] bg-black/30 border-[#152e23]"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Internal Only" className="text-[10px]">Internal Only</SelectItem>
                                    <SelectItem value="Published to Client" className="text-[10px]">Published to Client</SelectItem>
                                    <SelectItem value="Hidden" className="text-[10px]">Hidden</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="py-2 px-3 text-right">
                                <a href={link.url} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white"><ExternalLink className="h-3.5 w-3.5" /></Button>
                                </a>
                              </td>
                            </tr>
                          ))}
                          {workspaceLinks.length === 0 && (
                            <tr><td colSpan={5} className="text-center py-8 text-slate-500 italic">No workspace links shared yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── TIMELINE TAB ── */}
            <TabsContent value="workspace-timeline" className="mt-4 space-y-3">
              {detailProject && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gold">Project Audit & Timeline Logs</h4>
                  
                  <div className="relative pl-4 border-l border-[#152e23] space-y-4 max-h-[300px] overflow-y-auto">
                    {workspaceTimeline.map((item, idx) => (
                      <div key={item.id || idx} className="relative text-xs">
                        <div className="absolute -left-[20px] top-1 h-2 w-2 rounded-full bg-gold border border-black" />
                        <div className="flex justify-between font-bold text-slate-200">
                          <span className="text-xs font-semibold">{item.action}</span>
                          <span className="text-[10px] text-slate-500 font-normal">{new Date(item.created_at).toLocaleString('en-IN')}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">By {item.user_name}</p>
                        {item.notes && <p className="text-[10px] text-slate-500 mt-1 italic font-mono bg-[#0b1b15]/60 p-1.5 rounded border border-[#152e23]/30">"{item.notes}"</p>}
                      </div>
                    ))}
                    {workspaceTimeline.length === 0 && (
                      <p className="text-xs text-slate-500 italic py-4 text-center">No timeline activity logs recorded.</p>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── ORIGINAL AI PROMPT TAB ── */}
            <TabsContent value="prompt" className="mt-4">
              <PromptViewer
                prompt={detailProject?.prompt || generatedPrompt}
                title="Campaign Strategy Prompt"
                downloadFilename={`Campaign_Prompt_${detailProject?.title?.replace(/\s+/g, '_')}.txt`}
              />
              {!detailProject?.prompt && !generatedPrompt && detailProject?.businessDetails && (
                <Button variant="gold" className="gap-1.5 mt-4" onClick={() => {
                  const prompt = generateCampaignPrompt(detailProject.businessDetails!)
                  setGeneratedPrompt(prompt)
                }}>
                  <Sparkles className="h-4 w-4" />Generate Prompt from Details
                </Button>
              )}
            </TabsContent>

            {/* ── ORIGINAL VERSIONS TAB ── */}
            <TabsContent value="versions" className="mt-4">
              <VersionTimeline
                versions={(detailProject?.history || []).filter(h => h.canDownload).map((h, i) => ({ version: i + 1, date: h.date, action: h.action, canDownload: true, canRestore: true }))}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editId} onOpenChange={open => !open && setEditId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Strategy Details</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="col-span-1 sm:col-span-2 space-y-1"><Label>Business Name *</Label><Input value={form.businessName} onChange={e => setForm({...form, businessName: e.target.value})} /></div>
            <div className="space-y-1"><Label>Category</Label><Select value={form.businessCategory} onValueChange={v => setForm({...form, businessCategory: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Monthly Budget (₹)</Label><Input type="number" value={form.monthlyBudget} onChange={e => setForm({...form, monthlyBudget: e.target.value})} /></div>
            <div className="space-y-1"><Label>Timeline</Label><Input value={form.timeline} onChange={e => setForm({...form, timeline: e.target.value})} /></div>
            <div className="space-y-1"><Label>Website</Label><Input value={form.website} onChange={e => setForm({...form, website: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
            <Button variant="gold" onClick={async () => {
              if (!editId) return
              const target = projects.find(p => p.id === editId)
              if (!target) return
              const newHistory = [...target.history, { date: new Date().toISOString().slice(0, 10), action: 'Strategy details updated', canDownload: true }]
              const updated = { ...target, title: form.businessName, client: form.businessName, type: form.businessCategory, budget: Number(form.monthlyBudget) || 0, timeline: form.timeline, history: newHistory, businessDetails: form }
              if (isSupabaseConfigured()) {
                const extraJson = JSON.stringify({ type: form.businessCategory, budget: Number(form.monthlyBudget) || 0, spent: target.spent, timeline: form.timeline, progress: target.progress, milestones: target.milestones, startDate: target.startDate, pm: target.pm, prompt: target.prompt, approvalStatus: target.approvalStatus, businessDetails: form })
                await supabase.from('projects').update({ title: form.businessName, client: form.businessName, stack: extraJson, history: newHistory }).eq('id', editId)
              }
              const updatedList = projects.map(p => p.id === editId ? updated : p)
              setProjects(updatedList); setCachedData('projects', updatedList); invalidateCache('dashboard')
              setEditId(null); toast({ title: 'Strategy Updated' })
            }}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Strategy?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      {/* Manage Categories Dialog */}
      <Dialog open={showManageCategories} onOpenChange={setShowManageCategories}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Business Categories</DialogTitle>
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
                  {cat !== 'Other' && (
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
