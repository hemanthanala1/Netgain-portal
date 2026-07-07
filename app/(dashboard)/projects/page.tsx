'use client'
import { useState, useEffect, useRef, Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { Drawer } from '@/components/ui/drawer'
import { FormInput, FormTextarea, FormSelect } from '@/components/ui/form-inputs'
import { DeleteDialog } from '@/components/ui/dialog-variants'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { PromptViewer } from '@/components/ui/prompt-viewer'
import { ApprovalBadge } from '@/components/ui/approval-badge'
import { FileUpload } from '@/components/ui/file-upload'
import { VersionTimeline, UniversalTimeline } from '@/components/ui/version-timeline'
import { ProjectManagerAutocomplete } from '@/components/ui/project-manager-autocomplete'
import {
  Search, Plus, Zap, Calendar, DollarSign, Users, Download, Edit, Trash2,
  History, Loader2, Sparkles, Copy, ExternalLink, Upload, Eye,
  TrendingUp, Target, Globe, Phone, Mail, MapPin, Building2, FileText, X, Link2, Briefcase, Settings
} from 'lucide-react'
import { formatCurrency, formatDate, generateDocId } from '@/lib/utils'
import { generateCampaignPrompt, copyToClipboard, downloadAsTextFile } from '@/lib/ai-utils'
import type { CampaignStrategyForm } from '@/lib/ai-types'
import { useToast } from '@/hooks/use-toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { ClientAutocomplete } from '@/components/ui/client-autocomplete'
import { getCachedData, setCachedData, invalidateCache } from '@/lib/data-cache'
import { DataTable } from '@/components/ui/data-table'
import { TableSkeleton } from '@/components/ui/skeletons'
import { logSystemActivity } from '@/lib/activity-helper'

type Project = {
  id: string; title: string; client: string; type: string; budget: number; spent: number; timeline: string; status: string; progress: number; milestones: string[]; startDate: string; pm: string; history: { date: string; action: string; canDownload?: boolean }[];
  prompt?: string; approvalStatus?: string; businessDetails?: CampaignStrategyForm; currentStage?: string; sprintGoal?: string
}

const statusColors: Record<string, string> = {
  active: 'text-emerald-400 bg-emerald-500/10', planned: 'text-blue-400 bg-blue-500/10',
  completed: 'text-muted-foreground bg-muted', paused: 'text-yellow-400 bg-yellow-500/10'
}

function CampaignStrategyPageContent() {
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

  const columns = useMemo(() => [
    {
      header: 'Project',
      accessor: 'title',
      sortable: true,
      sticky: true,
      cell: (project: Project) => (
        <div>
          <p className="font-semibold text-sm text-foreground">{project.title}</p>
          <p className="text-xs text-muted-foreground">{project.client} · {project.type}</p>
        </div>
      )
    },
    {
      header: 'PM Assignee',
      accessor: 'pm',
      sortable: true,
      cell: (project: Project) => (
        <span className="text-xs text-muted-foreground">{project.pm || 'Netgain Team'}</span>
      )
    },
    {
      header: 'Budget',
      accessor: 'budget',
      sortable: true,
      className: 'text-right',
      cell: (project: Project) => (
        <span className="font-semibold text-gold">{formatCurrency(project.budget)}</span>
      )
    },
    {
      header: 'Progress',
      accessor: 'progress',
      sortable: true,
      cell: (project: Project) => (
        <div className="w-32 space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Progress</span>
            <span>{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-1.5" />
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      cell: (project: Project) => (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusColors[project.status] || 'text-muted-foreground bg-slate-500/10'}`}>
          {project.status}
        </span>
      )
    },
    {
      header: 'Timeline',
      accessor: 'timeline',
      cell: (project: Project) => (
        <span className="text-xs text-muted-foreground">{project.timeline || 'Not set'}</span>
      )
    },
    {
      header: 'Actions',
      accessor: 'actions',
      className: 'text-right',
      cell: (project: Project) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <Button variant="ghost" size="icon" aria-label="View Details" className="h-7 w-7 hover:text-gold" onClick={() => openDetail(project)} title="View Details">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Action" className="h-7 w-7 hover:text-gold" onClick={() => {
            setQuickTitle(project.title)
            setQuickClient(project.client)
            setQuickType(project.type)
            setQuickStatus(project.status)
            setQuickBudget(String(project.budget))
            setQuickTimeline(project.timeline)
            setQuickPm(project.pm)
            setQuickCurrentStage(project.currentStage || '')
            setQuickSprintGoal(project.sprintGoal || '')
            setEditId(project.id)
          }} title="Edit">
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete" className="h-7 w-7 text-red-400 hover:text-red-400" onClick={() => setDeleteId(project.id)} title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )
    }
  ], [])
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [realtimeConnected, setRealtimeConnected] = useState(false)

  const [projectTypes, setProjectTypes] = useState<string[]>([
    'Web Development', 'Mobile App', 'Digital Marketing', 'Brand Identity', 
    'E-Commerce', 'SEO & Content', 'UI/UX Design', 'Custom Software', 'Other'
  ])
  const [showManageTypes, setShowManageTypes] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [editingTypeIndex, setEditingTypeIndex] = useState<number | null>(null)
  const [editingTypeName, setEditingTypeName] = useState('')

  const saveProjectTypes = async (updatedTypes: string[]) => {
    setProjectTypes(updatedTypes)
    if (isSupabaseConfigured()) {
      try {
        const { data: exist } = await supabase.from('company_settings').select('id, docs').limit(1).maybeSingle()
        if (exist) {
          const updatedDocs = { ...exist.docs, projectTypes: updatedTypes }
          await supabase.from('company_settings').update({ docs: updatedDocs }).eq('id', exist.id)
        } else {
          await supabase.from('company_settings').insert([{ docs: { projectTypes: updatedTypes } }])
        }
      } catch (err) {
        console.error('Failed to save project types to db:', err)
      }
    }
  }

  const handleAddProjectType = () => {
    if (!newTypeName.trim()) return
    if (projectTypes.includes(newTypeName.trim())) {
      toast({ title: 'Project type already exists', variant: 'destructive' })
      return
    }
    const updated = [...projectTypes, newTypeName.trim()]
    saveProjectTypes(updated)
    setNewTypeName('')
    toast({ title: 'Project Type Added' })
  }

  const handleEditProjectType = (index: number) => {
    if (!editingTypeName.trim()) return
    if (projectTypes.includes(editingTypeName.trim()) && projectTypes[index] !== editingTypeName.trim()) {
      toast({ title: 'Project type already exists', variant: 'destructive' })
      return
    }
    const updated = [...projectTypes]
    updated[index] = editingTypeName.trim()
    saveProjectTypes(updated)
    setEditingTypeIndex(null)
    setEditingTypeName('')
    toast({ title: 'Project Type Updated' })
  }

  const handleDeleteProjectType = (typeToDelete: string) => {
    const updated = projectTypes.filter(t => t !== typeToDelete)
    saveProjectTypes(updated)
    toast({ title: 'Project Type Deleted' })
  }

  // Quick Project Create States
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickClient, setQuickClient] = useState('')
  const [quickType, setQuickType] = useState('Web Development')
  const [quickStatus, setQuickStatus] = useState('planned')
  const [quickBudget, setQuickBudget] = useState('')
  const [quickTimeline, setQuickTimeline] = useState('')
  const [quickPm, setQuickPm] = useState('')
  const [quickCurrentStage, setQuickCurrentStage] = useState('')
  const [quickSprintGoal, setQuickSprintGoal] = useState('')
  const [quickTasks, setQuickTasks] = useState('')
  const [savingQuick, setSavingQuick] = useState(false)

  const searchParams = useSearchParams()

  useEffect(() => {
    const clientId = searchParams.get('clientId') || searchParams.get('prefill_client_id')
    const autoOpen = searchParams.get('autoOpen') || searchParams.get('prefill')

    if (clientId) {
      const fetchClient = async () => {
        if (isSupabaseConfigured()) {
          const { data: client } = await supabase
            .from('crm_clients')
            .select('*')
            .eq('id', clientId)
            .maybeSingle()
          if (client) {
            setQuickClient(client.business || client.name)
            if (autoOpen === 'true') {
              setShowQuickCreate(true)
            }
            const newUrl = window.location.pathname
            window.history.replaceState({}, '', newUrl)
          }
        }
      }
      fetchClient()
    }
  }, [searchParams])

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
              let extra: any = { type: 'Web Development', budget: 0, spent: 0, timeline: '', progress: 0, milestones: [] as string[], startDate: p.created, pm: 'Devon S.', currentStage: '', sprintGoal: '', prompt: '', approvalStatus: 'draft', businessDetails: undefined }
              if (p.stack) { try { extra = { ...extra, ...JSON.parse(p.stack) } } catch { extra.pm = p.stack } }
              return { id: p.id, title: p.title, client: p.client, type: extra.type, budget: Number(extra.budget) || 0, spent: Number(extra.spent) || 0, timeline: extra.timeline, status: p.status, progress: Number(extra.progress) || 0, milestones: Array.isArray(extra.milestones) ? extra.milestones : [], startDate: extra.startDate || p.created, pm: extra.pm, currentStage: extra.currentStage || '', sprintGoal: extra.sprintGoal || '', history: Array.isArray(p.history) ? p.history : [], prompt: extra.prompt || '', approvalStatus: extra.approvalStatus || 'draft', businessDetails: extra.businessDetails || undefined }
            })
            setProjects(mapped); setCachedData('projects', mapped)
          }

          // Fetch custom campaign categories
          const { data: settings } = await supabase.from('company_settings').select('docs').limit(1).maybeSingle()
          if (settings?.docs?.campaignCategories) {
            setCategories(settings.docs.campaignCategories)
          }
          if (settings?.docs?.projectTypes) {
            setProjectTypes(settings.docs.projectTypes)
          }
        } catch (err: any) { toast({ title: 'Database Error', description: err.message, variant: 'destructive' }) }
      }
      setLoading(false)
    }
    loadProjects()
  }, [])

  // ─── REAL-TIME SUBSCRIPTIONS ───
  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const reloadProjects = async () => {
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
      if (!error && data) {
        const mapped = data.map((p: any) => {
          let extra: any = { type: 'Web Development', budget: 0, spent: 0, timeline: '', progress: 0, milestones: [] as string[], startDate: p.created, pm: 'Devon S.', currentStage: '', sprintGoal: '', prompt: '', approvalStatus: 'draft', businessDetails: undefined }
          if (p.stack) { try { extra = { ...extra, ...JSON.parse(p.stack) } } catch { extra.pm = p.stack } }
          return { id: p.id, title: p.title, client: p.client, type: extra.type, budget: Number(extra.budget) || 0, spent: Number(extra.spent) || 0, timeline: extra.timeline, status: p.status, progress: Number(extra.progress) || 0, milestones: Array.isArray(extra.milestones) ? extra.milestones : [], startDate: extra.startDate || p.created, pm: extra.pm, currentStage: extra.currentStage || '', sprintGoal: extra.sprintGoal || '', history: Array.isArray(p.history) ? p.history : [], prompt: extra.prompt || '', approvalStatus: extra.approvalStatus || 'draft', businessDetails: extra.businessDetails || undefined }
        })
        setProjects(mapped)
        setCachedData('projects', mapped)
      }
    }

    const channel = supabase
      .channel('admin-projects-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => reloadProjects())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_requirements' }, () => {
        if (detailProject) fetchProjectWorkspaceData(detailProject.id)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_files' }, () => {
        if (detailProject) fetchProjectWorkspaceData(detailProject.id)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_activity_timeline' }, () => {
        if (detailProject) fetchProjectWorkspaceData(detailProject.id)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_requirement_submissions' }, () => {
        if (detailProject) fetchProjectWorkspaceData(detailProject.id)
      })
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [detailProject])

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

  const handleSaveQuickProject = async () => {
    if (!quickTitle.trim() || !quickClient.trim()) {
      toast({ title: 'Project Title and Client are required', variant: 'destructive' })
      return
    }
    setSavingQuick(true)
    try {
      const docId = generateDocId('NG-PRJ')
      const now = new Date().toISOString().slice(0, 10)
      const taskList = quickTasks.trim()
        ? quickTasks.split('\n').filter(t => t.trim()).map(t => `${t.trim()} ⏳`)
        : ['Kickoff ⏳', 'Development ⏳', 'Review ⏳', 'Delivery ⏳']

      const stackJson = JSON.stringify({
        type: quickType,
        budget: Number(quickBudget) || 0,
        spent: 0,
        timeline: quickTimeline,
        progress: 0,
        milestones: taskList,
        pm: quickPm || 'Netgain Team',
        currentStage: quickCurrentStage,
        sprintGoal: quickSprintGoal,
        startDate: now,
        approvalStatus: 'draft'
      })

      const targetId = String(Date.now())

      const { data, error } = await supabase.from('projects').insert({
        id: targetId,
        doc_id: docId,
        title: quickTitle.trim(),
        client: quickClient.trim(),
        status: quickStatus,
        stack: stackJson,
        created: now,
        history: [{ date: now, action: 'Project created', canDownload: false }]
      }).select().single()

      if (error) throw error

      await logSystemActivity(
        'Staff',
        `Created new project: ${quickTitle.trim()}`,
        'projects',
        targetId,
        `/projects?projectId=${targetId}`
      )

      toast({ title: '✅ Project Created!', description: `${quickTitle} — ${docId}` })
      setShowQuickCreate(false)
      setQuickTitle(''); setQuickClient(''); setQuickBudget(''); setQuickTimeline(''); setQuickPm(''); setQuickCurrentStage(''); setQuickSprintGoal(''); setQuickTasks('')
      setQuickType('Web Development'); setQuickStatus('planned')
      invalidateCache('dashboard')
    } catch (e: any) {
      toast({ title: 'Error creating project', description: e.message, variant: 'destructive' })
    } finally {
      setSavingQuick(false)
    }
  }

  const handleBulkAction = async (action: string, selectedRows: Project[]) => {
    if (action === 'delete') {
      if (!window.confirm(`Are you sure you want to delete ${selectedRows.length} projects?`)) return
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const ids = selectedRows.map(r => r.id)
          const { error } = await supabase.from('projects').delete().in('id', ids)
          if (error) {
            toast({ title: 'Error deleting projects', description: error.message, variant: 'destructive' })
            setLoading(false)
            return
          }
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
          setLoading(false)
          return
        }
      }
      const idsSet = new Set(selectedRows.map(r => r.id))
      const updatedList = projects.filter(p => !idsSet.has(p.id))
      setProjects(updatedList); setCachedData('projects', updatedList); invalidateCache('dashboard')
      toast({ title: 'Projects Deleted', description: `${selectedRows.length} projects removed.` })
      setLoading(false)
    } else if (action.startsWith('status_')) {
      const newStatus = action.replace('status_', '')
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const ids = selectedRows.map(r => r.id)
          const { error } = await supabase.from('projects').update({ status: newStatus }).in('id', ids)
          if (error) {
            toast({ title: 'Error updating project status', description: error.message, variant: 'destructive' })
            setLoading(false)
            return
          }
        } catch (err: any) {
          toast({ title: 'Database Error', description: err.message, variant: 'destructive' })
          setLoading(false)
          return
        }
      }
      const idsSet = new Set(selectedRows.map(r => r.id))
      const updatedList = projects.map(p => idsSet.has(p.id) ? { ...p, status: newStatus } : p)
      setProjects(updatedList); setCachedData('projects', updatedList); invalidateCache('dashboard')
      toast({ title: 'Project Status Updated', description: `${selectedRows.length} projects marked as ${newStatus}.` })
      setLoading(false)
    }
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
    setQuickCurrentStage(p.currentStage || '')
    setQuickSprintGoal(p.sprintGoal || '')
    setEditedProgress(p.progress || 0)
    setEditedStatus(p.status || 'planned')

    fetchProjectWorkspaceData(p.id)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Workspace Manager"
        description="Manage project execution, tasks, requirements, files, and links in real-time"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Projects' }
        ]}
        primaryAction={{
          label: 'New Project',
          onClick: () => { setQuickCurrentStage(''); setShowQuickCreate(true) },
          icon: Plus,
          variant: 'gold'
        }}
        secondaryActions={
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-semibold border ${realtimeConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-muted-foreground border-slate-500/20'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${realtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
              {realtimeConnected ? 'Live' : 'Connecting...'}
            </span>
            <Button variant="outline" size="sm" onClick={() => setShowManageTypes(true)} className="gap-1.5 border-border hover:bg-[#11241c]/50 hover:text-gold text-muted-foreground">
              <Settings className="h-4 w-4 text-gold" /> Project Types
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Projects', value: projects.length },
          { label: 'Active', value: projects.filter(p => p.status === 'active').length },
          { label: 'Total Budget', value: formatCurrency(projects.reduce((s, p) => s + p.budget, 0)) },
          { label: 'Planned', value: projects.filter(p => p.status === 'planned').length },
        ].map(s => (

          <Card key={s.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold mt-1">{s.value}</p></CardContent></Card>
        ))}
      </div>

      {/* Project Workspace List */}
      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No projects found"
          description="Get started by creating your first project workspace to track milestones, tasks, and file deliverables."
          action={{
            label: "New Project",
            onClick: () => { setQuickCurrentStage(''); setShowQuickCreate(true) },
            icon: Plus
          }}
        />
      ) : (
        <DataTable
          data={projects}
          columns={columns}
          searchPlaceholder="Search projects by title, client, type..."
          searchKeys={['title', 'client', 'type']}
          exportFileName="projects"
          onRowClick={openDetail}
          initialSearch={searchParams.get('search') || searchParams.get('client') || ''}
          savedFiltersKey="projects"
          enableBulkSelect={true}
          bulkActions={[
            { label: 'Delete Selected', action: 'delete', variant: 'destructive', icon: Trash2 },
            { label: 'Mark Active', action: 'status_active', icon: TrendingUp },
            { label: 'Mark Completed', action: 'status_completed', icon: TrendingUp }
          ]}
          onBulkAction={handleBulkAction}
          filterDefs={[
            {
              key: 'status',
              label: 'Project Status',
              options: [
                { label: 'Planned', value: 'planned' },
                { label: 'Active', value: 'active' },
                { label: 'Paused', value: 'paused' },
                { label: 'Completed', value: 'completed' }
              ]
            },
            {
              key: 'type',
              label: 'Project Type',
              options: projectTypes.map(t => ({ label: t, value: t }))
            }
          ]}
        />
      )}

      {/* ── CREATE DRAWER ──────────────────────────────────────────────── */}
      <Drawer
        isOpen={showQuickCreate}
        onClose={() => setShowQuickCreate(false)}
        title="Create New Project"
        description="Fill out the project details and default milestones."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowQuickCreate(false)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleSaveQuickProject} disabled={savingQuick || !quickTitle.trim() || !quickClient.trim()}>
              {savingQuick ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Creating...</> : 'Create Project'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormInput label="Project Title" required placeholder="e.g. Netgain Website Redesign" value={quickTitle} onChange={e => setQuickTitle(e.target.value)} />
          
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Client Name *</Label>
            <ClientAutocomplete value={quickClient} onChange={setQuickClient} onSelect={(c) => setQuickClient(c.name)} placeholder="Select or type client name" />
          </div>

          <FormSelect label="Project Type" value={quickType} onChange={e => setQuickType(e.target.value)} options={projectTypes.map(t => ({ label: t, value: t }))} />
          <FormSelect label="Status" value={quickStatus} onChange={e => setQuickStatus(e.target.value)} options={[
            { label: 'Planned', value: 'planned' },
            { label: 'Active', value: 'active' },
            { label: 'Paused', value: 'paused' },
            { label: 'Completed', value: 'completed' }
          ]} />
          
          <FormInput label="Budget (₹)" type="number" placeholder="e.g. 150000" value={quickBudget} onChange={e => setQuickBudget(e.target.value)} />
          <FormInput label="Timeline" placeholder="e.g. 3 months, Q3 2025" value={quickTimeline} onChange={e => setQuickTimeline(e.target.value)} />
          
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Project Manager</Label>
            <ProjectManagerAutocomplete
              value={quickPm}
              onChange={setQuickPm}
              onSelect={(manager) => setQuickPm(manager.name)}
              placeholder="Search project managers..."
            />
          </div>

          <FormTextarea
            label="Initial Tasks / Milestones"
            placeholder={`Enter one task per line:\nKickoff Call\nWireframes\nDesign Review\nDevelopment\nLaunch`}
            value={quickTasks}
            onChange={e => setQuickTasks(e.target.value)}
            className="h-28 text-xs resize-none"
            helperText="Leave blank to use default milestones"
          />
        </div>
      </Drawer>
      {/* Detail Dialog */}

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
            <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-[#11241c]/40 border border-border p-1 rounded-lg">
              <TabsTrigger value="overview" className="text-xs px-3 py-1.5 data-[state=active]:bg-gold data-[state=active]:text-black">Overview</TabsTrigger>
              <TabsTrigger value="workspace-tasks" className="text-xs px-3 py-1.5 data-[state=active]:bg-gold data-[state=active]:text-black">Tasks</TabsTrigger>
              <TabsTrigger value="workspace-reqs" className="text-xs px-3 py-1.5 data-[state=active]:bg-gold data-[state=active]:text-black">Requirements</TabsTrigger>
              <TabsTrigger value="workspace-files" className="text-xs px-3 py-1.5 data-[state=active]:bg-gold data-[state=active]:text-black">Files & Docs</TabsTrigger>
              <TabsTrigger value="workspace-reports" className="text-xs px-3 py-1.5 data-[state=active]:bg-gold data-[state=active]:text-black">Reports</TabsTrigger>
              <TabsTrigger value="workspace-links" className="text-xs px-3 py-1.5 data-[state=active]:bg-gold data-[state=active]:text-black">Links</TabsTrigger>
              <TabsTrigger value="workspace-timeline" className="text-xs px-3 py-1.5 data-[state=active]:bg-gold data-[state=active]:text-black">Timeline</TabsTrigger>
              <TabsTrigger value="workspace-risks" className="text-xs px-3 py-1.5 data-[state=active]:bg-gold data-[state=active]:text-black">Risks</TabsTrigger>
              <TabsTrigger value="workspace-dependencies" className="text-xs px-3 py-1.5 data-[state=active]:bg-gold data-[state=active]:text-black">Dependencies</TabsTrigger>
              <TabsTrigger value="workspace-notes" className="text-xs px-3 py-1.5 data-[state=active]:bg-gold data-[state=active]:text-black">Notes</TabsTrigger>
              <TabsTrigger value="workspace-approvals" className="text-xs px-3 py-1.5 data-[state=active]:bg-gold data-[state=active]:text-black">Approvals</TabsTrigger>
            </TabsList>

            {/* ── OVERVIEW TAB ── */}
            <TabsContent value="overview" className="mt-4 space-y-4">
              {detailProject && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className="bg-card border-border"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground uppercase">Budget</p><p className="text-sm font-bold text-gold">{formatCurrency(detailProject.budget || 0)}</p></CardContent></Card>
                    <Card className="bg-card border-border"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground uppercase">Spent</p><p className="text-sm font-bold text-muted-foreground">{formatCurrency(detailProject.spent || 0)}</p></CardContent></Card>
                    <Card className="bg-card border-border"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground uppercase">Progress</p><p className="text-sm font-bold text-emerald-400">{detailProject.progress}%</p></CardContent></Card>
                    <Card className="bg-card border-border"><CardContent className="p-3"><p className="text-[10px] text-muted-foreground uppercase">PM Assignee</p><p className="text-sm font-bold text-muted-foreground">{detailProject.pm || 'N/A'}</p></CardContent></Card>
                  </div>
                  {/* Cross-module quick links */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a href={`/documents/invoices?client=${encodeURIComponent(detailProject.client)}`} className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg border border-gold/25 bg-gold/5 text-gold hover:bg-gold/15 transition-colors font-medium">
                      <ExternalLink className="h-2.5 w-2.5" />View Invoices
                    </a>
                    <a href={`/meetings?client=${encodeURIComponent(detailProject.client)}`} className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg border border-blue-500/25 bg-blue-500/5 text-blue-400 hover:bg-blue-500/15 transition-colors font-medium">
                      <ExternalLink className="h-2.5 w-2.5" />View Meetings
                    </a>
                    <a href={`/documents/vault?client=${encodeURIComponent(detailProject.client)}`} className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg border border-purple-500/25 bg-purple-500/5 text-purple-400 hover:bg-purple-500/15 transition-colors font-medium">
                      <ExternalLink className="h-2.5 w-2.5" />View Documents
                    </a>
                    <a href={`/crm?client=${encodeURIComponent(detailProject.client)}`} className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/15 transition-colors font-medium">
                      <ExternalLink className="h-2.5 w-2.5" />View in CRM
                    </a>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Column: Placeholder for Overview or Additional Details */}
                    <div className="space-y-4">
                      {/* You can add any extra overview details here if needed */}
                    </div>

                    {/* Right Column: Quick Stats Editor */}
                    <div className="space-y-4 bg-card border border-border rounded-xl p-4 md:col-span-2 max-w-2xl">
                      <div className="flex justify-between items-center border-b border-border pb-2">
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
                            <Input type="number" value={editedBudget} onChange={e => setEditedBudget(Number(e.target.value))} className="h-7 text-xs bg-muted/30" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Spent (₹)</Label>
                            <Input type="number" value={editedSpent} onChange={e => setEditedSpent(Number(e.target.value))} className="h-7 text-xs bg-muted/30" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Timeline (e.g. 8 Weeks)</Label>
                            <Input value={editedTimeline} onChange={e => setEditedTimeline(e.target.value)} className="h-7 text-xs bg-muted/30" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Project Manager</Label>
                            <ProjectManagerAutocomplete
                              value={editedPm}
                              onChange={setEditedPm}
                              onSelect={(manager) => setEditedPm(manager.name)}
                              placeholder="Search project managers..."
                              className="text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] flex justify-between">Progress <span>{editedProgress}%</span></Label>
                            <input 
                              type="range" 
                              min="0" 
                              max="100" 
                              value={editedProgress} 
                              onChange={e => setEditedProgress(Number(e.target.value))}
                              className="w-full accent-gold bg-muted/30" 
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
                          <div className="flex justify-between border-b border-border pb-1"><span className="text-muted-foreground">Status</span><span className="capitalize text-emerald-400 font-semibold">{detailProject.status}</span></div>
                          <div className="flex justify-between border-b border-border pb-1"><span className="text-muted-foreground">Timeline</span><span className="font-semibold">{detailProject.timeline || 'Not set'}</span></div>
                          <div className="flex justify-between border-b border-border pb-1"><span className="text-muted-foreground">Type</span><span className="font-semibold text-muted-foreground">{detailProject.type}</span></div>
                          <div className="flex justify-between border-b border-border pb-1"><span className="text-muted-foreground">Date Created</span><span className="font-semibold text-muted-foreground">{formatDate(detailProject.startDate)}</span></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Time Tracking Panel */}
                  <div className="mt-6 border-t border-border pt-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-3">Time Tracking & Timesheets</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-card border-border">
                        <CardContent className="p-3.5 space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase">Logged Hours</p>
                          <p className="text-xl font-bold text-slate-200">142.5 hrs</p>
                          <p className="text-[9px] text-muted-foreground">Estimated: 200 hrs</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-card border-border">
                        <CardContent className="p-3.5 space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase">Burn Rate</p>
                          <p className="text-xl font-bold text-amber-400">71%</p>
                          <p className="text-[9px] text-muted-foreground">Budget utilisation</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-card border-border">
                        <CardContent className="p-3.5 space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase">Billable Amount</p>
                          <p className="text-xl font-bold text-emerald-400">₹1,78,250</p>
                          <p className="text-[9px] text-muted-foreground">Based on employee rates</p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="mt-4 bg-card border border-border rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-center pb-2 border-b border-border">
                        <span className="text-xs font-semibold text-muted-foreground">Mock Timesheet Schema</span>
                        <Badge variant="outline" className="text-[9px] border-gold/30 text-gold bg-gold/5">Architecture Schema</Badge>
                      </div>
                      <pre className="text-[10px] text-muted-foreground font-mono overflow-x-auto bg-black/20 p-2.5 rounded border border-border">
{`interface TimesheetEntry {
  id: string; // uuid
  project_id: string; // foreign key
  team_member_id: string; // foreign key
  date: string; // YYYY-MM-DD
  hours: number; // decimal (e.g. 7.5)
  billable: boolean;
  notes: string;
  milestone_id?: string;
}`}
                      </pre>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── TASKS TAB ── */}
            <TabsContent value="workspace-tasks" className="mt-4 space-y-4">
              {detailProject && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-border pb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gold">Project Tasks & Milestones</h4>
                    <span className="text-[10px] text-muted-foreground">{detailProject.milestones.length} tasks</span>
                  </div>
                  
                  <div className="space-y-2">
                    {detailProject.milestones.map((m, idx) => {
                      const isDone = m.endsWith(' ✅')
                      const cleanLabel = m.replace(' ✅', '').replace(' ⏳', '')
                      return (
                        <div key={idx} className="flex items-center justify-between p-3 rounded bg-muted/30 border border-border hover:border-gold/30">
                          <div className="flex items-center gap-3">
                            <input 
                              type="checkbox" 
                              checked={isDone}
                              onChange={() => handleToggleMilestone(detailProject, idx)}
                              className="h-4 w-4 rounded border-gray-300 text-gold focus:ring-gold accent-gold shrink-0 cursor-pointer"
                            />
                            <span className={`text-sm ${isDone ? 'line-through text-muted-foreground' : 'text-slate-200 font-semibold'}`}>{cleanLabel}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" aria-label="Action" 
                              className="h-7 w-7 text-muted-foreground hover:text-gold hover:bg-gold/10"
                              onClick={() => {
                                const newLabel = window.prompt("Edit task description:", cleanLabel);
                                if (newLabel && newLabel.trim() !== "") {
                                  const updatedMilestones = [...detailProject.milestones];
                                  updatedMilestones[idx] = `${newLabel.trim()} ${isDone ? '✅' : '⏳'}`;
                                  saveProjectDetails({ ...detailProject, milestones: updatedMilestones });
                                }
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" aria-label="Action" 
                              className="h-7 w-7 text-red-400 hover:text-red-400 hover:bg-red-500/10"
                              onClick={() => handleDeleteMilestone(detailProject, idx)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                    {detailProject.milestones.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">No tasks created yet.</p>
                    )}
                  </div>

                  {/* Add Milestone Inline Form */}
                  <div className="flex gap-2 pt-2">
                    <Input 
                      placeholder="Add new task (e.g. Figma Review)" 
                      value={newMilestoneText}
                      onChange={e => setNewMilestoneText(e.target.value)}
                      className="h-10 text-sm bg-card border-border"
                    />
                    <Button 
                      variant="gold" 
                      className="h-10 px-5 font-bold"
                      onClick={() => handleAddMilestone(detailProject)}
                    >
                      Add Task
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── REQUIREMENTS REQUEST TAB ── */}
            <TabsContent value="workspace-reqs" className="mt-4 space-y-4">
              {detailProject && (
                <div className="space-y-4">
                  {/* Top Header and Toggle Request Form */}
                  <div className="flex justify-between items-center bg-card border border-border p-3 rounded-xl">
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
                    <Card className="bg-card border-border p-4 space-y-3">
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
                        <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border">
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
                      <div className="flex gap-2 justify-end border-t border-border pt-3">
                        <Button variant="outline" size="sm" onClick={() => setShowReqForm(false)}>Cancel</Button>
                        <Button variant="gold" size="sm" onClick={() => handleCreateRequirement(detailProject.id, detailProject.client)}>Submit Request</Button>
                      </div>
                    </Card>
                  )}

                  {/* Submission Review Modal Overlay */}
                  {reviewingSub && (
                    <Card className="bg-card border-border p-4 space-y-3 relative">
                      <button onClick={() => setReviewingSub(null)} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                      <h5 className="text-xs font-bold text-[#D4AF37] uppercase">Review Client Submission</h5>
                      <div className="text-xs space-y-1.5 bg-card p-3 rounded border border-border font-mono">
                        <div><span className="text-muted-foreground">Submitted By:</span> <span className="text-foreground">{reviewingSub.submitted_by}</span></div>
                        <div><span className="text-muted-foreground">Submitted At:</span> <span className="text-foreground">{new Date(reviewingSub.submitted_at).toLocaleString('en-IN')}</span></div>
                        {reviewingSub.text_response && <div><span className="text-muted-foreground">Text Response:</span> <p className="text-muted-foreground mt-1 italic font-sans">"{reviewingSub.text_response}"</p></div>}
                        {reviewingSub.links && reviewingSub.links.length > 0 && (
                          <div>
                            <span className="text-muted-foreground">Links:</span> 
                            <div className="flex flex-col gap-1 mt-1 font-sans">
                              {reviewingSub.links.map((link: string, i: number) => (
                                <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline flex items-center gap-1"><ExternalLink className="h-3 w-3 shrink-0" />{link}</a>
                              ))}
                            </div>
                          </div>
                        )}
                        {reviewingSub.file_paths && reviewingSub.file_paths.length > 0 && (
                          <div>
                            <span className="text-muted-foreground">Uploaded Files:</span> 
                            <div className="flex flex-col gap-1.5 mt-1 font-sans">
                              {reviewingSub.file_paths.map((file: string, i: number) => (
                                <a key={i} href={file} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline flex items-center gap-1.5 border border-border p-1.5 rounded bg-black/40"><Download className="h-3.5 w-3.5" />{file.split('/').pop()}</a>
                              ))}
                            </div>
                          </div>
                        )}
                        {reviewingSub.notes && <div><span className="text-muted-foreground">Notes:</span> <p className="text-muted-foreground mt-1 italic font-sans">"{reviewingSub.notes}"</p></div>}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Feedback Comments (Required on revision)</Label>
                        <Textarea 
                          placeholder="Approve with note, or request specific changes..." 
                          value={reviewComment}
                          onChange={e => setReviewComment(e.target.value)}
                          className="h-16 text-xs bg-muted/30 border-border"
                        />
                      </div>
                      <div className="flex gap-2 justify-end pt-2 border-t border-border">
                        <Button variant="outline" size="sm" onClick={() => setReviewingSub(null)} className="h-8 text-xs">Close</Button>
                        <Button variant="outline" size="sm" onClick={() => handleReviewSubmission(detailProject.id, detailProject.client, reviewingSub.id, reviewingSub.requirement_id, 'Decline')} className="h-8 text-xs text-red-400 border-red-500/20 hover:bg-red-500/10">Request Revision</Button>
                        <Button variant="gold" size="sm" onClick={() => handleReviewSubmission(detailProject.id, detailProject.client, reviewingSub.id, reviewingSub.requirement_id, 'Approve')} className="h-8 text-xs px-4">Approve submission</Button>
                      </div>
                    </Card>
                  )}

                  {/* List of active requests */}
                  <div className="border border-border rounded-xl overflow-hidden bg-card">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground uppercase tracking-wider text-[10px] bg-black/10">
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
                              <tr key={req.id} className="border-b border-border hover:bg-[#11241c]/10">
                                <td className="py-2.5 px-3">
                                  <p className="font-semibold text-slate-200">{req.title}</p>
                                  {req.description && <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{req.description}</p>}
                                </td>
                                <td className="py-2.5 px-3"><span className="px-1.5 py-0.5 rounded border border-border bg-black/20 text-muted-foreground text-[10px]">{req.category}</span></td>
                                <td className="py-2.5 px-3">
                                  <span className={`capitalize ${req.priority === 'high' ? 'text-red-400 font-bold' : req.priority === 'medium' ? 'text-yellow-400' : 'text-muted-foreground'}`}>{req.priority}</span>
                                </td>
                                <td className="py-2.5 px-3 text-muted-foreground">{req.due_date ? formatDate(req.due_date) : '—'}</td>
                                <td className="py-2.5 px-3">
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${req.status === 'completed' || req.status === 'approved' ? 'text-emerald-400 bg-emerald-500/10' : req.status === 'needs revision' ? 'text-red-400 bg-red-500/10' : req.status === 'submitted' ? 'text-purple-400 bg-purple-500/10' : 'text-muted-foreground bg-slate-500/10'}`}>{req.status}</span>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {sub ? (
                                    <Button variant="outline" size="sm" onClick={() => setReviewingSub(sub)} className="h-7 text-[10px] border-gold/20 text-gold hover:bg-gold/15">Review Submission</Button>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground italic pr-2">Awaiting client response</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                          {workspaceRequirements.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-8 text-muted-foreground italic">No requirement requests published yet.</td></tr>
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
                  <Card className="bg-card border-border p-4 space-y-3">
                    <h4 className="text-xs font-bold text-gold uppercase">Upload Project Document / Resource File</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="space-y-1">
                        <Label>Select File *</Label>
                        <Input 
                          type="file" 
                          onChange={e => setUploadFile(e.target.files ? e.target.files[0] : null)} 
                          className="h-8 bg-transparent border-input file:bg-primary file:text-primary-foreground file:border-none file:rounded file:px-3 file:py-1 file:text-xs file:font-semibold"
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
                  <div className="border border-border rounded-xl overflow-hidden bg-card">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground uppercase tracking-wider text-[10px] bg-black/10">
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
                            <tr key={file.id} className="border-b border-border hover:bg-[#11241c]/10">
                              <td className="py-2 px-3 font-semibold text-slate-200 truncate max-w-[180px]" title={file.name}>{file.name}</td>
                              <td className="py-2 px-3 text-muted-foreground">{file.category}</td>
                              <td className="py-2 px-3 text-muted-foreground">V{file.version}</td>
                              <td className="py-2 px-3 text-muted-foreground">{formatDate(file.uploaded_at)}</td>
                              <td className="py-2 px-3">
                                <Select value={file.visibility} onValueChange={v => handleUpdateFileVisibility(detailProject.id, file.id, file.name, v)}>
                                  <SelectTrigger className="h-6 w-28 text-[10px] bg-black/30 border-border"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Internal Only" className="text-[10px]">Internal Only</SelectItem>
                                    <SelectItem value="Published to Client" className="text-[10px]">Published to Client</SelectItem>
                                    <SelectItem value="Hidden" className="text-[10px]">Hidden</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="py-2 px-3 text-right">
                                <a href={file.file_path} target="_blank" rel="noopener noreferrer" download>
                                  <Button variant="ghost" size="icon" aria-label="Download" className="h-7 w-7 text-gold hover:bg-gold/15"><Download className="h-3.5 w-3.5" /></Button>
                                </a>
                              </td>
                            </tr>
                          ))}
                          {workspaceFiles.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-8 text-muted-foreground italic">No workspace files uploaded yet.</td></tr>
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
                  <Card className="bg-card border-border p-4 space-y-3">
                    <h4 className="text-xs font-bold text-gold uppercase">Upload Analytics / Performance Report</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="space-y-1">
                        <Label>Report Title *</Label>
                        <Input placeholder="e.g. SEO Report - June 2026" value={reportTitle} onChange={e => setReportTitle(e.target.value)} />
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
                          className="h-8 bg-transparent border-input file:bg-primary file:text-primary-foreground file:border-none file:rounded file:px-3 file:py-1 file:text-xs file:font-semibold"
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
                  <div className="border border-border rounded-xl overflow-hidden bg-card">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground uppercase tracking-wider text-[10px] bg-black/10">
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
                            <tr key={rep.id} className="border-b border-border hover:bg-[#11241c]/10">
                              <td className="py-2 px-3 font-semibold text-slate-200 truncate max-w-[180px]" title={rep.title}>{rep.title}</td>
                              <td className="py-2 px-3 text-muted-foreground">{rep.report_type}</td>
                              <td className="py-2 px-3 text-muted-foreground">V{rep.version}</td>
                              <td className="py-2 px-3 text-muted-foreground">{formatDate(rep.uploaded_at)}</td>
                              <td className="py-2 px-3">
                                <Select value={rep.visibility} onValueChange={v => handleUpdateReportVisibility(detailProject.id, rep.id, rep.title, v)}>
                                  <SelectTrigger className="h-6 w-28 text-[10px] bg-black/30 border-border"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Internal Only" className="text-[10px]">Internal Only</SelectItem>
                                    <SelectItem value="Published to Client" className="text-[10px]">Published to Client</SelectItem>
                                    <SelectItem value="Hidden" className="text-[10px]">Hidden</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="py-2 px-3 text-right">
                                <a href={rep.file_path} target="_blank" rel="noopener noreferrer" download>
                                  <Button variant="ghost" size="icon" aria-label="Download" className="h-7 w-7 text-gold hover:bg-gold/15"><Download className="h-3.5 w-3.5" /></Button>
                                </a>
                              </td>
                            </tr>
                          ))}
                          {workspaceReports.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-8 text-muted-foreground italic">No reports generated yet.</td></tr>
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
                  <Card className="bg-card border-border p-4 space-y-3">
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
                      <div className="sm:col-span-3 flex justify-end pt-2 border-t border-border">
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
                  <div className="border border-border rounded-xl overflow-hidden bg-card">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground uppercase tracking-wider text-[10px] bg-black/10">
                            <th className="text-left py-2 px-3 font-semibold">Title</th>
                            <th className="text-left py-2 px-3 font-semibold">Category</th>
                            <th className="text-left py-2 px-3 font-semibold">URL</th>
                            <th className="text-left py-2 px-3 font-semibold">Visibility</th>
                            <th className="text-right py-2 px-3 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workspaceLinks.map((link: any) => (
                            <tr key={link.id} className="border-b border-border hover:bg-[#11241c]/10">
                              <td className="py-2 px-3">
                                <p className="font-semibold text-slate-200">{link.title}</p>
                                {link.description && <p className="text-[10px] text-muted-foreground">{link.description}</p>}
                              </td>
                              <td className="py-2 px-3 text-muted-foreground">{link.category}</td>
                              <td className="py-2 px-3 truncate max-w-[200px]" title={link.url}>
                                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline flex items-center gap-1 font-mono text-[10px]"><Link2 className="h-3 w-3 shrink-0" /> {link.url}</a>
                              </td>
                              <td className="py-2 px-3">
                                <Select value={link.visibility} onValueChange={v => handleUpdateLinkVisibility(detailProject.id, link.id, link.title, v)}>
                                  <SelectTrigger className="h-6 w-28 text-[10px] bg-black/30 border-border"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Internal Only" className="text-[10px]">Internal Only</SelectItem>
                                    <SelectItem value="Published to Client" className="text-[10px]">Published to Client</SelectItem>
                                    <SelectItem value="Hidden" className="text-[10px]">Hidden</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="py-2 px-3 text-right">
                                <a href={link.url} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="icon" aria-label="External Link" className="h-7 w-7 text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /></Button>
                                </a>
                              </td>
                            </tr>
                          ))}
                          {workspaceLinks.length === 0 && (
                            <tr><td colSpan={5} className="text-center py-8 text-muted-foreground italic">No workspace links shared yet.</td></tr>
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
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gold mb-3">Project Audit & Timeline Logs</h4>
                  <UniversalTimeline
                    enableFilters={true}
                    entries={workspaceTimeline.map((item: any) => ({
                      action: item.action,
                      actionType: item.action?.toLowerCase().includes('risk') ? 'note' : item.action?.toLowerCase().includes('note') ? 'note' : item.action?.toLowerCase().includes('dependency') ? 'custom' : 'custom',
                      by: item.user_name,
                      date: item.created_at,
                      comment: item.notes,
                      module: 'Projects'
                    }))}
                  />
                </div>
              )}
            </TabsContent>

            {/* ── RISKS TAB ── */}
            <TabsContent value="workspace-risks" className="mt-4 space-y-4">
              {detailProject && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gold">Risk Register</h4>
                    <p className="text-[10px] text-muted-foreground">Track project risks, blockers and mitigation strategies</p>
                  </div>
                  {/* Risk input form */}
                  <Card className="bg-card border-border">
                    <CardContent className="p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase font-semibold">Risk Description</label>
                          <Input
                            placeholder="Describe the risk or blocker..."
                            className="h-8 text-xs bg-black/20 border-border"
                            id={`risk-title-${detailProject.id}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase font-semibold">Impact Level</label>
                          <Select defaultValue="medium">
                            <SelectTrigger className="h-8 text-xs bg-black/20 border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Mitigation Plan</label>
                        <textarea
                          rows={2}
                          placeholder="How will this risk be mitigated?"
                          className="w-full h-16 text-xs bg-black/20 border border-border rounded-lg px-3 py-2 text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-gold/50"
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button variant="gold" size="sm" className="h-7 text-xs" onClick={() => {
                          const titleEl = document.getElementById(`risk-title-${detailProject.id}`) as HTMLInputElement
                          if (titleEl?.value?.trim()) {
                            logWorkspaceActivity(detailProject.id, 'Risk Logged', `Risk: ${titleEl.value.trim()}`)
                            titleEl.value = ''
                            toast({ title: 'Risk logged to project timeline' })
                          }
                        }}>
                          Log Risk
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  {/* Risk timeline from activity log */}
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Logged Risks from Timeline</p>
                    <UniversalTimeline
                      entries={workspaceTimeline
                        .filter((t: any) => t.action?.toLowerCase().includes('risk'))
                        .map((t: any) => ({
                          action: t.action,
                          actionType: 'note' as const,
                          by: t.user_name,
                          date: t.created_at,
                          comment: t.notes
                        }))}
                      compact
                    />
                    {workspaceTimeline.filter((t: any) => t.action?.toLowerCase().includes('risk')).length === 0 && (
                      <p className="text-xs text-muted-foreground italic text-center py-4">No risks logged yet. Use the form above to log risks.</p>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── INTERNAL NOTES TAB ── */}
            <TabsContent value="workspace-notes" className="mt-4 space-y-4">
              {detailProject && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gold">Internal Notes</h4>
                    <p className="text-[10px] text-muted-foreground">Private team-facing notes — not visible to client</p>
                  </div>
                  <Card className="bg-card border-border">
                    <CardContent className="p-4 space-y-3">
                      <textarea
                        rows={4}
                        placeholder="Add an internal note for your team... (e.g. client prefers dark theme, PM confirmed budget extension)"
                        id={`note-text-${detailProject.id}`}
                        className="w-full text-xs bg-black/20 border border-border rounded-lg px-3 py-2 text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-gold/50"
                      />
                      <div className="flex justify-end">
                        <Button variant="gold" size="sm" className="h-7 text-xs" onClick={() => {
                          const el = document.getElementById(`note-text-${detailProject.id}`) as HTMLTextAreaElement
                          if (el?.value?.trim()) {
                            logWorkspaceActivity(detailProject.id, 'Internal Note Added', el.value.trim())
                            el.value = ''
                            toast({ title: 'Note saved to project timeline' })
                          }
                        }}>
                          Save Note
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  {/* Notes from timeline */}
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Saved Notes</p>
                    <UniversalTimeline
                      entries={workspaceTimeline
                        .filter((t: any) => t.action?.includes('Internal Note'))
                        .map((t: any) => ({
                          action: t.action,
                          actionType: 'note' as const,
                          by: t.user_name,
                          date: t.created_at,
                          comment: t.notes
                        }))}
                      compact
                    />
                    {workspaceTimeline.filter((t: any) => t.action?.includes('Internal Note')).length === 0 && (
                      <p className="text-xs text-muted-foreground italic text-center py-4">No internal notes yet. Add notes above.</p>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
 
            {/* ── DEPENDENCIES TAB ── */}
            <TabsContent value="workspace-dependencies" className="mt-4 space-y-4">
              {detailProject && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gold">Project Dependencies</h4>
                    <p className="text-[10px] text-muted-foreground">Track blockages, external tasks, or resources required</p>
                  </div>
                  {/* Dependency logging form */}
                  <Card className="bg-card border-border">
                    <CardContent className="p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase font-semibold">Dependency Name / Title</label>
                          <Input
                            placeholder="e.g. Payment Gateway Credentials, Domain Delegation..."
                            className="h-8 text-xs bg-black/20 border-border"
                            id={`dep-title-${detailProject.id}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase font-semibold">Criticality</label>
                          <Select defaultValue="high">
                            <SelectTrigger className="h-8 text-xs bg-black/20 border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low (Non-blocking)</SelectItem>
                              <SelectItem value="medium">Medium (Potential delay)</SelectItem>
                              <SelectItem value="high">High (Critical path)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Details & Assignee</label>
                        <textarea
                          rows={2}
                          id={`dep-notes-${detailProject.id}`}
                          placeholder="Specify who is responsible and what is needed..."
                          className="w-full h-16 text-xs bg-black/20 border border-border rounded-lg px-3 py-2 text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-gold/50"
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button variant="gold" size="sm" className="h-7 text-xs" onClick={() => {
                          const titleEl = document.getElementById(`dep-title-${detailProject.id}`) as HTMLInputElement
                          const notesEl = document.getElementById(`dep-notes-${detailProject.id}`) as HTMLTextAreaElement
                          if (titleEl?.value?.trim()) {
                            const noteStr = `Dependency: ${titleEl.value.trim()}. Details: ${notesEl?.value?.trim() || 'None'}`
                            logWorkspaceActivity(detailProject.id, 'Dependency Logged', noteStr)
                            titleEl.value = ''
                            if (notesEl) notesEl.value = ''
                            toast({ title: 'Dependency logged to project timeline' })
                          }
                        }}>
                          Log Dependency
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  {/* Dependency list from activity log */}
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Active Dependencies</p>
                    <UniversalTimeline
                      entries={workspaceTimeline
                        .filter((t: any) => t.action?.includes('Dependency'))
                        .map((t: any) => ({
                          action: t.action,
                          actionType: 'note' as const,
                          by: t.user_name,
                          date: t.created_at,
                          comment: t.notes
                        }))}
                      compact
                    />
                    {workspaceTimeline.filter((t: any) => t.action?.includes('Dependency')).length === 0 && (
                      <p className="text-xs text-muted-foreground italic text-center py-4">No active dependencies logged yet. Log dependencies above.</p>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── APPROVALS TAB ── */}
            <TabsContent value="workspace-approvals" className="mt-4 space-y-4">
              {detailProject && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-border pb-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gold">Project Approvals Queue</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Track sign-offs, SOW approvals, and budget adjustments</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      { id: 'app-sow', name: 'Scope of Work (SOW) Sign-off', requester: 'Client Portal Integration', status: detailProject.status === 'completed' ? 'approved' : 'pending' },
                      { id: 'app-budget', name: 'Phase 1 Budget Reallocation', requester: 'Founder Team', status: 'approved' },
                      { id: 'app-milestone-1', name: 'Milestone 1 Deliverable Approval', requester: 'Project Manager', status: 'approved' },
                      { id: 'app-milestone-2', name: 'Milestone 2 Deliverable Approval', requester: 'Project Manager', status: 'pending' },
                    ].map(approval => (
                      <Card key={approval.id} className="bg-card border-border hover:border-gold/15 transition-all">
                        <CardContent className="p-3.5 flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold text-slate-200">{approval.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Requested by: <span className="text-muted-foreground font-medium">{approval.requester}</span></p>
                          </div>
                          <div className="flex items-center gap-2">
                            {approval.status === 'approved' ? (
                              <Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">Approved</Badge>
                            ) : approval.status === 'rejected' ? (
                              <Badge className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/25">Rejected</Badge>
                            ) : (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-7 text-[10px] border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                                  onClick={() => {
                                    logWorkspaceActivity(detailProject.id, 'Approval Granted', `Approved: ${approval.name}`)
                                    toast({ title: 'Approval Granted', description: `${approval.name} has been approved.` })
                                  }}
                                >
                                  Approve
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-7 text-[10px] border-red-500/20 text-red-400 hover:bg-red-500/10"
                                  onClick={() => {
                                    logWorkspaceActivity(detailProject.id, 'Approval Declined', `Declined: ${approval.name}`)
                                    toast({ title: 'Approval Declined', description: `${approval.name} has been declined.` })
                                  }}
                                >
                                  Decline
                                </Button>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit Project Drawer */}
      <Drawer
        isOpen={!!editId}
        onClose={() => setEditId(null)}
        title="Edit Project Details"
        description="Modify project details, status, timeline, and PM allocation."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditId(null)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={async () => {
              if (!editId) return
              const target = projects.find(p => p.id === editId)
              if (!target) return
              const newHistory = [...target.history, { date: new Date().toISOString().slice(0, 10), action: 'Project details updated', canDownload: false }]
              
              const extraJson = JSON.stringify({
                type: quickType,
                budget: Number(quickBudget) || 0,
                spent: target.spent,
                timeline: quickTimeline,
                progress: target.progress,
                milestones: target.milestones,
                pm: quickPm || 'Netgain Team',
                currentStage: quickCurrentStage,
                sprintGoal: quickSprintGoal,
                startDate: target.startDate,
                approvalStatus: target.approvalStatus || 'draft'
              })

              const updated = {
                ...target,
                title: quickTitle,
                client: quickClient,
                type: quickType,
                budget: Number(quickBudget) || 0,
                timeline: quickTimeline,
                pm: quickPm || 'Netgain Team',
                currentStage: quickCurrentStage,
                sprintGoal: quickSprintGoal,
                status: quickStatus,
                history: newHistory
              }

              if (isSupabaseConfigured()) {
                await supabase.from('projects').update({
                  title: quickTitle,
                  client: quickClient,
                  status: quickStatus,
                  stack: extraJson,
                  history: newHistory
                }).eq('id', editId)
              }
              const updatedList = projects.map(p => p.id === editId ? updated : p)
              setProjects(updatedList); setCachedData('projects', updatedList); invalidateCache('dashboard')
              setEditId(null); toast({ title: '✅ Project Updated' })
            }}>Save Changes</Button>
          </>
        }
      >
        {editId && (
          <div className="space-y-4">
            <FormInput label="Project Title" required value={quickTitle} onChange={e => setQuickTitle(e.target.value)} />
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Client Name *</Label>
              <ClientAutocomplete
                value={quickClient}
                onChange={setQuickClient}
                onSelect={(client) => setQuickClient(client.name)}
                placeholder="Select or type client name"
              />
            </div>

            <FormSelect label="Project Type" value={quickType} onChange={e => setQuickType(e.target.value)} options={projectTypes.map(t => ({ label: t, value: t }))} />
            <FormSelect label="Status" value={quickStatus} onChange={e => setQuickStatus(e.target.value)} options={[
              { label: 'Planned', value: 'planned' },
              { label: 'Active', value: 'active' },
              { label: 'Paused', value: 'paused' },
              { label: 'Completed', value: 'completed' }
            ]} />
            
            <FormInput label="Budget (₹)" type="number" value={quickBudget} onChange={e => setQuickBudget(e.target.value)} />
            <FormInput label="Timeline" value={quickTimeline} onChange={e => setQuickTimeline(e.target.value)} />
            <FormInput label="Current Stage" placeholder="e.g. Development & Integration" value={quickCurrentStage} onChange={e => setQuickCurrentStage(e.target.value)} />
            <FormTextarea label="Sprint Goal" placeholder="e.g. Final API integrations and validation checks." value={quickSprintGoal} onChange={e => setQuickSprintGoal(e.target.value)} className="min-h-20" />
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Project Manager</Label>
              <ProjectManagerAutocomplete
                value={quickPm}
                onChange={setQuickPm}
                onSelect={(manager) => setQuickPm(manager.name)}
                placeholder="Search project managers..."
              />
            </div>
          </div>
        )}
      </Drawer>

      {/* Delete Project Dialog */}
      <DeleteDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Project?"
        description="This action cannot be undone. All workspace tasks, files, links and requirements will remain in database but the project reference will be deleted."
        confirmLabel="Delete Project"
        onConfirm={handleDelete}
      />
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
                      size="icon" aria-label="Action"
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

      {/* Manage Project Types Dialog */}
      <Dialog open={showManageTypes} onOpenChange={setShowManageTypes}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Project Types</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                placeholder="New Project Type"
                value={newTypeName}
                onChange={e => setNewTypeName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddProjectType() }}
              />
              <Button variant="gold" size="sm" onClick={handleAddProjectType}>
                Add
              </Button>
            </div>
            <div className="border rounded-lg border-border p-3 max-h-[300px] overflow-y-auto space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Existing Project Types</p>
              {projectTypes.map((type, idx) => (
                <div key={idx} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                  {editingTypeIndex === idx ? (
                    <div className="flex items-center gap-2 w-full mr-2">
                      <Input
                        value={editingTypeName}
                        onChange={e => setEditingTypeName(e.target.value)}
                        className="h-8 text-sm"
                        onKeyDown={e => { if (e.key === 'Enter') handleEditProjectType(idx) }}
                      />
                      <Button size="sm" className="h-8 px-2" onClick={() => handleEditProjectType(idx)}>Save</Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" onClick={() => setEditingTypeIndex(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm">{type}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon" aria-label="Action"
                          className="h-7 w-7 text-muted-foreground hover:text-gold"
                          onClick={() => {
                            setEditingTypeIndex(idx)
                            setEditingTypeName(type)
                          }}
                          title="Edit Project Type"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        {type !== 'Other' && (
                          <Button
                            variant="ghost"
                            size="icon" aria-label="Action"
                            className="h-7 w-7 text-red-400 hover:text-red-400"
                            onClick={() => handleDeleteProjectType(type)}
                            title="Delete Project Type"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManageTypes(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function CampaignStrategyPage() {
  return (
    <Suspense fallback={null}>
      <CampaignStrategyPageContent />
    </Suspense>
  )
}
