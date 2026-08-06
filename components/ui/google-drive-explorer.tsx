'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { FileItem, mapGoogleFileToItem, mapInternalFileToItem } from '@/lib/storage-provider'
import { 
  Folder, File, Search, Grid, List, ArrowUpDown, Trash2, Edit2, 
  Share2, Copy, Move, Download, Star, Eye, ExternalLink, 
  HardDrive, Plus, Loader2, RefreshCw, ChevronRight, Unlink, Link2, 
  ShieldAlert, Settings, Info, Cloud, Upload
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface GoogleDriveExplorerProps {
  projectId: string
  projectTitle: string
  clientName: string
  adminSettings: any
}

export function GoogleDriveExplorer({ projectId, projectTitle, clientName, adminSettings }: GoogleDriveExplorerProps) {
  const { toast } = useToast()
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(false)
  
  // Storage & Navigation State
  const [workspace, setWorkspace] = useState<{ linked: boolean; folderId?: string; folderName?: string; verified?: boolean; error?: string } | null>(null)
  const [currentFolderId, setCurrentFolderId] = useState<string>('root')
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([])
  
  // Files Lists
  const [internalFiles, setInternalFiles] = useState<FileItem[]>([])
  const [driveFiles, setDriveFiles] = useState<FileItem[]>([])
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [providerFilter, setProviderFilter] = useState<'all' | 'internal' | 'google-drive'>('all')
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Modals / Actions State
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  
  const [renameOpen, setRenameOpen] = useState(false)
  const [activeItem, setActiveItem] = useState<FileItem | null>(null)
  const [renameName, setRenameName] = useState('')
  
  const [shareOpen, setShareOpen] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [shareRole, setShareRole] = useState<'Owner' | 'Editor' | 'Commenter' | 'Viewer'>('Viewer')
  
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveDestinations, setMoveDestinations] = useState<FileItem[]>([])
  const [selectedMoveDest, setSelectedMoveDest] = useState<string>('root')

  const [linkOpen, setLinkOpen] = useState(false)
  const [linkFolderUrlInput, setLinkFolderUrlInput] = useState('')
  const [linkFolderNameInput, setLinkFolderNameInput] = useState('')
  const [relinkOpen, setRelinkOpen] = useState(false)

  // Parse a Google Drive folder URL or raw ID into just the folder ID
  const parseFolderIdFromInput = (input: string): string => {
    const trimmed = input.trim()
    // Try drive.google.com/drive/folders/FOLDER_ID
    const foldersMatch = trimmed.match(/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/)
    if (foldersMatch) return foldersMatch[1]
    // Try ?id=FOLDER_ID or &id=FOLDER_ID
    const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    if (idMatch) return idMatch[1]
    // Try /open?id=FOLDER_ID
    const openMatch = trimmed.match(/\/open\?id=([a-zA-Z0-9_-]+)/)
    if (openMatch) return openMatch[1]
    // Assume raw ID if it looks like one (no slashes/spaces)
    if (/^[a-zA-Z0-9_-]+$/.test(trimmed) && trimmed.length > 10) return trimmed
    return trimmed
  }

  const extractedFolderId = parseFolderIdFromInput(linkFolderUrlInput)
  const extractedRelinkId = parseFolderIdFromInput(linkFolderUrlInput)

  const [uploadDestination, setUploadDestination] = useState<'internal' | 'google-drive'>('internal')
  const [syncing, setSyncing] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null)
  const [uploadTargetFolderId, setUploadTargetFolderId] = useState<string>('root')

  // Dashboard calculations
  const [dashboardInfo, setDashboardInfo] = useState<any>(null)
  const [loadingDashboard, setLoadingDashboard] = useState(false)

  // Session/token resolver for Admin (auth.users) vs Client (localStorage)
  const resolveSessionAndToken = async () => {
    let token = ''
    let isClient = false
    let userName = 'Team Member'

    if (isSupabaseConfigured()) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        token = session.access_token
        userName = session.user?.email || 'Team Member'
        return { token, isClient, userName }
      }
    }

    // Fallback to client session
    const cached = typeof window !== 'undefined' ? localStorage.getItem('netgain_client_session') : null
    if (cached) {
      try {
        const clientSess = JSON.parse(cached)
        token = `client:${clientSess.id}`
        isClient = true
        userName = clientSess.name || clientSess.email || 'Client'
      } catch {}
    }

    return { token, isClient, userName }
  }

  // 1. Fetch Workspace Connection Status
  const fetchWorkspaceStatus = async () => {
    try {
      const { token } = await resolveSessionAndToken()
      const res = await fetch(`/api/storage/google/drive?action=workspace-status&projectId=${projectId}&token=${token}`)
      const data = await res.json()
      if (res.ok && data.linked) {
        setWorkspace(data)
        if (data.verified && data.folderId) {
          setCurrentFolderId(data.folderId)
        }
      } else {
        setWorkspace({ linked: false })
      }
    } catch (e) {
      console.error('Error fetching workspace status:', e)
    }
  }

  // 2. Fetch Files (Internal from Supabase + Drive from API)
  const fetchFiles = async () => {
    setLoading(true)
    try {
      const { token } = await resolveSessionAndToken()

      // Fetch Internal Files
      const { data: dbFiles } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false })

      if (dbFiles) {
        setInternalFiles(dbFiles.map(mapInternalFileToItem))
      }

      // Fetch Google Drive Files if linked
      if (workspace?.linked) {
        const fetchFolderId = currentFolderId
        const res = await fetch(`/api/storage/google/drive?action=list&folderId=${fetchFolderId}&projectId=${projectId}&token=${token}`)
        const data = await res.json()
        if (res.ok && data.files) {
          setDriveFiles(data.files)
          
          // Populate move destinations with subfolders
          setMoveDestinations(data.files.filter((f: FileItem) => f.isFolder))
        } else {
          setDriveFiles([])
        }
      } else {
        setDriveFiles([])
      }
    } catch (e) {
      console.error('Error fetching files:', e)
    } finally {
      setLoading(false)
    }
  }

  // Fetch Dashboard details
  const fetchDashboardInfo = async () => {
    if (!workspace?.linked || !workspace.verified || !workspace.folderId) return
    setLoadingDashboard(true)
    try {
      const { token } = await resolveSessionAndToken()
      const res = await fetch(`/api/storage/google/drive?action=dashboard&projectId=${projectId}&folderId=${workspace.folderId}&token=${token}`)
      const data = await res.json()
      if (res.ok) {
        setDashboardInfo(data)
      }
    } catch (e) {
      console.error('Dashboard info fetch error:', e)
    } finally {
      setLoadingDashboard(false)
    }
  }

  useEffect(() => {
    fetchWorkspaceStatus()
  }, [projectId])

  useEffect(() => {
    if (workspace) {
      fetchFiles()
      fetchDashboardInfo()
    }
  }, [workspace, currentFolderId])

  // Setup Default Upload Destination from Admin Settings
  useEffect(() => {
    if (adminSettings?.defaultLocation) {
      setUploadDestination(adminSettings.defaultLocation)
    }
  }, [adminSettings])

  // Handle Workspace Folder Creation (and Structure Template)
  const handleCreateWorkspace = async () => {
    setActioning(true)
    try {
      const { token } = await resolveSessionAndToken()
      
      const res = await fetch('/api/storage/google/drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'create-workspace-folder',
          projectId,
          folderName: `${projectTitle} Workspace`
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: 'Workspace created!', description: `Created Google Drive workspace folder for project: ${projectTitle}` })
        await fetchWorkspaceStatus()
      } else {
        toast({ title: 'Workspace Creation Failed', description: data.error || 'OAuth connection may be invalid.', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Workspace Creation Failed', description: e.message, variant: 'destructive' })
    } finally {
      setActioning(false)
    }
  }

  // Handle Link Existing Folder (supports full URL or raw folder ID)
  const handleLinkFolder = async (isRelink: boolean = false) => {
    const resolvedId = parseFolderIdFromInput(linkFolderUrlInput)
    if (!resolvedId) return
    setActioning(true)
    try {
      const { token } = await resolveSessionAndToken()
      
      const res = await fetch('/api/storage/google/drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'link-workspace',
          projectId,
          folderId: resolvedId,
          folderName: linkFolderNameInput || 'Google Drive Workspace'
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: 'Workspace linked!', description: 'Linked project to Google Drive folder successfully.' })
        setLinkOpen(false)
        setRelinkOpen(false)
        setLinkFolderUrlInput('')
        setLinkFolderNameInput('')
        await fetchWorkspaceStatus()
      } else {
        toast({ title: 'Linking Failed', description: data.error || 'Connection error. Make sure the folder is shared with your connected Google account.', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Linking Failed', description: e.message, variant: 'destructive' })
    } finally {
      setActioning(false)
    }
  }

  // Handle Unlink Google Drive Workspace Folder
  const handleUnlinkFolder = async (folderIdToUnlink?: string) => {
    if (!confirm('Are you sure you want to unlink this Google Drive folder from the project workspace?')) return
    setActioning(true)
    try {
      const { token } = await resolveSessionAndToken()
      
      const res = await fetch('/api/storage/google/drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'unlink-workspace',
          projectId,
          folderId: folderIdToUnlink
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: 'Workspace Unlinked', description: 'Removed Google Drive folder link.' })
        await fetchWorkspaceStatus()
      } else {
        toast({ title: 'Unlink Failed', description: data.error || 'Connection error', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Unlink Failed', description: e.message, variant: 'destructive' })
    } finally {
      setActioning(false)
    }
  }

  // Handle Google Drive operations (Create Folder, Rename, Delete, Move, Share)
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    setActioning(true)
    try {
      const { token } = await resolveSessionAndToken()
      const parentId = currentFolderId === 'root' ? workspace?.folderId : currentFolderId
      
      const res = await fetch('/api/storage/google/drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'create-folder',
          name: newFolderName,
          parentId,
          projectId
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: 'Folder created!', description: `Created folder: ${newFolderName}` })
        setCreateFolderOpen(false)
        setNewFolderName('')
        await fetchFiles()
      } else {
        toast({ title: 'Folder Creation Failed', description: data.error || 'Connection error', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Folder Creation Failed', description: e.message, variant: 'destructive' })
    } finally {
      setActioning(false)
    }
  }

  const handleRename = async () => {
    if (!renameName.trim() || !activeItem) return
    setActioning(true)
    try {
      const { token } = await resolveSessionAndToken()
      
      const res = await fetch('/api/storage/google/drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'rename',
          fileId: activeItem.id,
          name: renameName,
          projectId
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: 'Renamed successfully', description: `Renamed item to: ${renameName}` })
        setRenameOpen(false)
        setActiveItem(null)
        setRenameName('')
        await fetchFiles()
      } else {
        toast({ title: 'Rename Failed', description: data.error || 'Connection error', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Rename Failed', description: e.message, variant: 'destructive' })
    } finally {
      setActioning(false)
    }
  }

  const handleDelete = async (item: FileItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"? Google Drive files will be moved to the Google Drive Trash.`)) return
    setActioning(true)
    try {
      const { token } = await resolveSessionAndToken()
      
      const res = await fetch('/api/storage/google/drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'delete',
          fileId: item.id,
          projectId
        })
      })

      if (res.ok) {
        toast({ title: 'Deleted successfully', description: `Moved ${item.name} to Google Drive Trash.` })
        await fetchFiles()
        fetchDashboardInfo()
      } else {
        const data = await res.json()
        toast({ title: 'Deletion Failed', description: data.error || 'Connection error', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Deletion Failed', description: e.message, variant: 'destructive' })
    } finally {
      setActioning(false)
    }
  }

  const handleMove = async () => {
    if (!activeItem) return
    setActioning(true)
    try {
      const { token } = await resolveSessionAndToken()
      const sourceParentId = activeItem.parentId || workspace?.folderId || 'root'
      const targetParentId = selectedMoveDest === 'root' ? (workspace?.folderId || 'root') : selectedMoveDest

      const res = await fetch('/api/storage/google/drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'move',
          fileId: activeItem.id,
          sourceParentId,
          targetParentId,
          projectId
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: 'Moved successfully', description: `Moved ${activeItem.name}` })
        setMoveOpen(false)
        setActiveItem(null)
        await fetchFiles()
      } else {
        toast({ title: 'Move Failed', description: data.error || 'Connection error', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Move Failed', description: e.message, variant: 'destructive' })
    } finally {
      setActioning(false)
    }
  }

  const handleShare = async () => {
    if (!shareEmail.trim() || !activeItem) return
    setActioning(true)
    try {
      const { token } = await resolveSessionAndToken()
      
      const res = await fetch('/api/storage/google/drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'share',
          fileId: activeItem.id,
          email: shareEmail,
          role: shareRole,
          projectId
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: 'Shared successfully', description: `Shared with ${shareEmail} as ${shareRole}` })
        setShareOpen(false)
        setActiveItem(null)
        setShareEmail('')
      } else {
        toast({ title: 'Sharing Failed', description: data.error || 'Connection error', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Sharing Failed', description: e.message, variant: 'destructive' })
    } finally {
      setActioning(false)
    }
  }

  // Sync live files & quota from Drive
  const handleSyncFromDrive = async () => {
    setSyncing(true)
    try {
      await fetchWorkspaceStatus()
      await fetchFiles()
      await fetchDashboardInfo()
      toast({ title: 'Synced with Google Drive', description: 'Updated workspace files and storage usage.' })
    } catch (e: any) {
      toast({ title: 'Sync Failed', description: e.message, variant: 'destructive' })
    } finally {
      setSyncing(false)
    }
  }

  // Execute Upload (Combined Internal/Drive support with target folder)
  const handleExecuteUpload = async () => {
    if (!selectedUploadFile) return
    setActioning(true)

    try {
      const { token, userName } = await resolveSessionAndToken()

      if (uploadDestination === 'google-drive') {
        let parentId = uploadTargetFolderId === 'root' ? workspace?.folderId : uploadTargetFolderId
        if (!parentId || parentId === 'root') parentId = workspace?.folderId || 'root'

        const formData = new FormData()
        formData.append('file', selectedUploadFile)
        formData.append('folderId', parentId)
        formData.append('projectId', projectId)
        formData.append('category', 'Other Documents')

        const res = await fetch('/api/storage/google/drive', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        })

        const data = await res.json()
        if (res.ok && data.success) {
          toast({ title: 'Uploaded to Google Drive!', description: selectedUploadFile.name })
          setUploadModalOpen(false)
          setSelectedUploadFile(null)
          await fetchFiles()
          fetchDashboardInfo()
        } else {
          toast({ title: 'Upload Failed', description: data.error || 'Google upload error', variant: 'destructive' })
        }
      } else {
        // Upload to Netgain Internal Storage
        const formData = new FormData()
        formData.append('file', selectedUploadFile)
        formData.append('projectId', projectId)
        formData.append('uploadedBy', userName)
        formData.append('category', 'Other Documents')
        formData.append('version', '1')

        const res = await fetch('/api/project-files/upload', {
          method: 'POST',
          body: formData
        })

        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || 'Upload failed')

        // Register internal file in DB
        const { error: registerError } = await supabase.from('project_files').insert({
          project_id: projectId,
          name: data.fileName || selectedUploadFile.name,
          file_path: data.url,
          category: 'Other Documents',
          version: 1,
          visibility: 'Published to Client',
          uploaded_by: userName
        })

        if (registerError) throw new Error(registerError.message)

        // Log activity
        await supabase.from('project_activity_timeline').insert({
          project_id: projectId,
          user_name: userName,
          action: 'File Uploaded',
          notes: `Uploaded ${selectedUploadFile.name} to Netgain Storage`
        })

        toast({ title: 'Uploaded to Netgain Storage!', description: selectedUploadFile.name })
        setUploadModalOpen(false)
        setSelectedUploadFile(null)
        await fetchFiles()
      }
    } catch (err: any) {
      toast({ title: 'Upload Failed', description: err.message, variant: 'destructive' })
    } finally {
      setActioning(false)
    }
  }

  // Handle File Download (Both Google Drive & Internal Storage)
  const handleDownloadFile = async (file: FileItem) => {
    if (file.isFolder) return

    if (file.provider === 'google-drive') {
      try {
        toast({ title: 'Downloading file...', description: `Fetching ${file.name} from Google Drive.` })
        const { token } = await resolveSessionAndToken()
        const downloadUrl = `/api/storage/google/drive?action=download&fileId=${file.id}&projectId=${projectId}&token=${encodeURIComponent(token)}`
        
        const response = await fetch(downloadUrl)
        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}))
          throw new Error(errJson.error || 'Failed to download file from Google Drive')
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast({ title: 'Download Complete', description: file.name })
      } catch (err: any) {
        toast({ title: 'Download Failed', description: err.message || 'Could not download file.', variant: 'destructive' })
      }
    } else {
      // Internal file
      if (file.webContentLink) {
        window.open(file.webContentLink, '_blank')
      } else {
        toast({ title: 'File Link Missing', description: 'Internal file has no download URL.', variant: 'destructive' })
      }
    }
  }

  // Get user role display name
  const userRoleName = (user: any) => {
    return user?.email?.includes('admin') ? 'Admin Team' : 'Team Member'
  }

  // Navigate folder helper
  const navigateToFolder = (folderId: string, folderName: string) => {
    if (folderId === 'root') {
      setCurrentFolderId('root')
      setBreadcrumbs([])
    } else {
      setCurrentFolderId(folderId)
      // Check if folder is already in breadcrumbs to avoid duplicate loops
      const index = breadcrumbs.findIndex(b => b.id === folderId)
      if (index !== -1) {
        setBreadcrumbs(breadcrumbs.slice(0, index + 1))
      } else {
        setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }])
      }
    }
  }

  // Filter & Merge Files list
  const mergedFiles = useMemo(() => {
    // Determine files to show
    let list: FileItem[] = []
    
    if (currentFolderId === 'root') {
      // At the root, we show internal files (which are flat) AND Google Drive root files
      if (providerFilter === 'all' || providerFilter === 'internal') {
        list = [...list, ...internalFiles]
      }
      if (providerFilter === 'all' || providerFilter === 'google-drive') {
        list = [...list, ...driveFiles]
      }
    } else {
      // Inside a Drive folder, we only display Google Drive files of this folder
      list = [...driveFiles]
    }

    // Apply Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(f => f.name.toLowerCase().includes(q))
    }

    // Apply File Type Filter
    if (fileTypeFilter !== 'all') {
      list = list.filter(f => {
        const type = f.mimeType.toLowerCase()
        if (fileTypeFilter === 'folders') return f.isFolder
        if (fileTypeFilter === 'images') return type.startsWith('image/')
        if (fileTypeFilter === 'pdf') return type === 'application/pdf'
        if (fileTypeFilter === 'docs') return type.includes('word') || type.includes('document') || type.includes('spreadsheet') || type.includes('presentation') || type.includes('excel') || type.includes('powerpoint')
        return !f.isFolder && !type.startsWith('image/') && type !== 'application/pdf'
      })
    }

    // Apply Sorting
    list.sort((a, b) => {
      let valA: any = 0
      let valB: any = 0

      if (sortBy === 'name') {
        valA = a.name.toLowerCase()
        valB = b.name.toLowerCase()
      } else if (sortBy === 'date') {
        valA = new Date(a.createdAt).getTime()
        valB = new Date(b.createdAt).getTime()
      } else if (sortBy === 'size') {
        valA = a.size
        valB = b.size
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [internalFiles, driveFiles, currentFolderId, providerFilter, fileTypeFilter, searchQuery, sortBy, sortOrder, workspace])

  return (
    <div className="space-y-6">
      
      {/* ── CONNECTION HEADER BANNER ── */}
      {!workspace?.linked ? (
        <Card className="border-gold/25 bg-gold/5 flex flex-col sm:flex-row items-center justify-between p-6 gap-4">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-gold/15 flex items-center justify-center text-gold shrink-0 mt-0.5"><Cloud className="h-5 w-5 animate-pulse" /></div>
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5">Link Google Drive Workspace</h3>
              <p className="text-xs text-muted-foreground max-w-xl">
                Keep project assets organized and collaborate with the Netgain team by linking a dedicated Google Drive folder workspace. Subfolders (Branding, Deliverables, Assets, etc.) are generated automatically.
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto shrink-0">
            <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)} className="text-xs w-full sm:w-auto border-gold/30 hover:bg-gold/10">Link Existing Folder</Button>
            <Button variant="gold" size="sm" onClick={handleCreateWorkspace} disabled={actioning} className="text-xs w-full sm:w-auto font-bold gap-1">
              {actioning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create Workspace
            </Button>
          </div>
        </Card>
      ) : !workspace.verified ? (
        <Card className="border-red-500/25 bg-red-500/5 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-red-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-400">Google Drive folder inaccessible</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{workspace.error || 'The linked folder cannot be read. Make sure it is shared with your connected Google account and try relinking.'}</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setRelinkOpen(true)} className="border-gold/30 text-gold text-xs hover:bg-gold/10 gap-1">
                <Link2 className="h-3.5 w-3.5" /> Relink Folder
              </Button>
              <Button variant="outline" size="sm" onClick={handleUnlinkFolder} disabled={actioning} className="border-red-500/20 text-red-400 text-xs hover:bg-red-500/10">Unlink</Button>
            </div>
          </div>
        </Card>
      ) : null}

      {/* ── GOOGLE DRIVE DASHBOARD WIDGET ── */}
      {workspace?.linked && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/40 border-border p-4 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Workspace Files</p>
            <p className="text-2xl font-bold text-gold">{dashboardInfo?.fileCount || driveFiles.length}</p>
            <p className="text-[10px] text-muted-foreground">{dashboardInfo?.folderCount || (workspace.folders?.length || 1)} directories</p>
          </Card>
          <Card className="bg-card/40 border-border p-4 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Drive Workspace Size</p>
            <p className="text-2xl font-bold text-foreground">{(dashboardInfo?.totalSize ? (dashboardInfo.totalSize / (1024 * 1024)).toFixed(1) : '0.1')} MB</p>
            <p className="text-[10px] text-muted-foreground">Combined folder assets</p>
          </Card>
          <Card className="bg-card/40 border-border p-4 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Storage Usage</p>
            <p className="text-2xl font-bold text-foreground">{(dashboardInfo?.storageQuotaUsed ? (dashboardInfo.storageQuotaUsed / (1024 * 1024 * 1024)).toFixed(1) : '9.7')} GB</p>
            <p className="text-[10px] text-muted-foreground">Of 5120 GB Google limit</p>
          </Card>
          <Card className="bg-card/40 border-border p-4 space-y-1 flex flex-col justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Linked Drive Folders</p>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">{workspace.folders?.length || 1} Active</p>
            </div>
            <div className="flex items-center justify-between pt-1">
              <Button variant="link" size="sm" onClick={() => setLinkOpen(true)} className="text-[10px] text-gold hover:underline p-0 h-auto font-semibold">
                + Link Another Folder
              </Button>
              <Button variant="link" size="sm" onClick={() => handleUnlinkFolder()} className="text-[10px] text-red-400 hover:underline p-0 h-auto">
                Unlink All
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── FILE EXPLORER SHELL ── */}
      <Card className="border-border bg-card">
        
        {/* Explorer Toolbar controls */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search project files..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 bg-black/20 h-9 text-xs"
              />
            </div>

            {/* Filter buttons row */}
            <div className="flex flex-wrap gap-2 text-xs">
              
              {/* Provider Filter */}
              {workspace?.linked && workspace.verified && (
                <Select value={providerFilter} onValueChange={(v: any) => setProviderFilter(v)}>
                  <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Storage Source" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Storage</SelectItem>
                    <SelectItem value="internal">Netgain Internal</SelectItem>
                    <SelectItem value="google-drive">Google Drive</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {/* Type Filter */}
              <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
                <SelectTrigger className="h-9 w-32"><SelectValue placeholder="File Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Files</SelectItem>
                  <SelectItem value="folders">Folders Only</SelectItem>
                  <SelectItem value="images">Images Only</SelectItem>
                  <SelectItem value="pdf">PDF Docs</SelectItem>
                  <SelectItem value="docs">Office Documents</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort By */}
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="h-9 w-32"><SelectValue placeholder="Sort By" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="size">Size</SelectItem>
                </SelectContent>
              </Select>

              {/* Grid/List switch */}
              <div className="flex border border-border rounded-lg overflow-hidden shrink-0">
                <Button 
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                  size="icon" 
                  onClick={() => setViewMode('list')}
                  className="h-9 w-9 rounded-none"
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button 
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                  size="icon" 
                  onClick={() => setViewMode('grid')}
                  className="h-9 w-9 rounded-none"
                  aria-label="Grid view"
                >
                  <Grid className="h-4 w-4" />
                </Button>
              </div>

              {/* Sync from Drive Button */}
              {workspace?.linked && workspace.verified && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncFromDrive}
                  disabled={loading || syncing}
                  className="h-9 border-border text-xs gap-1.5 hover:bg-gold/10 hover:text-gold"
                  title="Sync live files & folders from Google Drive"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync from Drive'}
                </Button>
              )}

              {/* Upload File Modal Trigger */}
              <Button
                variant="gold"
                size="sm"
                onClick={() => setUploadModalOpen(true)}
                disabled={actioning}
                className="h-9 font-bold gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Upload File
              </Button>

              {/* Create Folder button for Google Drive */}
              {workspace?.linked && workspace.verified && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCreateFolderOpen(true)}
                  className="h-9 border-gold/30 text-gold hover:bg-gold/10 text-xs font-semibold gap-1"
                >
                  <Folder className="h-3.5 w-3.5" />
                  New Folder
                </Button>
              )}
            </div>
          </div>

          {/* Breadcrumbs Navigation */}
          {workspace?.linked && workspace.verified && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground overflow-x-auto py-1 border-t border-border/40 mt-1">
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => navigateToFolder('root', 'Root')}
                className="h-auto p-0 text-[11px] text-muted-foreground hover:text-gold"
              >
                Project Files
              </Button>
              {breadcrumbs.map((crumb, idx) => (
                <div key={crumb.id} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 shrink-0" />
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => navigateToFolder(crumb.id, crumb.name)}
                    className={`h-auto p-0 text-[11px] hover:text-gold ${idx === breadcrumbs.length - 1 ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}
                  >
                    {crumb.name}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── EXPLORER FILE CANVAS ── */}
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-gold" />
              <p className="text-xs text-muted-foreground font-medium">Fetching file system...</p>
            </div>
          ) : mergedFiles.length === 0 ? (
            <div className="text-center py-20 space-y-2">
              <Folder className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <p className="text-xs text-muted-foreground italic font-semibold">No files match your filters or search query.</p>
              {workspace?.linked && workspace.verified && currentFolderId !== 'root' && (
                <Button variant="link" size="sm" onClick={() => navigateToFolder('root', 'Root')} className="text-xs text-gold">Go to top level</Button>
              )}
            </div>
          ) : viewMode === 'list' ? (
            
            /* A. LIST VIEW TABLE */
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground uppercase tracking-wider text-[10px] bg-black/10">
                    <th className="text-left py-2.5 px-4 font-semibold">Name</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Storage Provider</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Type</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Size</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Modified</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Owner</th>
                    <th className="text-right py-2.5 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mergedFiles.map((file) => (
                    <tr key={file.id} className="border-b border-border hover:bg-[#11241c]/5 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-foreground">
                        {file.isFolder ? (
                          <div 
                            className="flex items-center gap-2 cursor-pointer text-gold hover:underline"
                            onClick={() => navigateToFolder(file.id, file.name)}
                          >
                            <Folder className="h-4 w-4 shrink-0 fill-gold/20" />
                            <span className="truncate max-w-[200px]" title={file.name}>{file.name}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate max-w-[200px] text-muted-foreground" title={file.name}>{file.name}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {file.provider === 'google-drive' ? (
                          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] font-semibold gap-1">
                            <Cloud className="h-2.5 w-2.5" /> Google Drive
                          </Badge>
                        ) : (
                          <Badge className="bg-gold/10 text-gold border-gold/20 text-[10px] font-semibold gap-1">
                            <HardDrive className="h-2.5 w-2.5" /> Netgain Storage
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground capitalize">
                        {file.isFolder ? 'Folder' : file.name.split('.').pop()?.toUpperCase() || 'File'}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {file.isFolder ? '-' : `${(file.size / 1024).toFixed(0)} KB`}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">{formatDate(file.modifiedAt)}</td>
                      <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[120px]">{file.owner}</td>
                      
                      {/* Actions */}
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {file.provider === 'google-drive' ? (
                            <>
                              {file.webViewLink && (
                                <a href={file.webViewLink} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="icon" aria-label="Open in Google Drive" className="h-7 w-7 text-muted-foreground hover:bg-black/20" title="Open in Google Drive">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Button>
                                </a>
                              )}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                aria-label="Download" 
                                className="h-7 w-7 text-gold hover:bg-gold/15" 
                                title="Download"
                                onClick={() => handleDownloadFile(file)}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>

                              {/* Drive contextual menu */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7"><Settings className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="text-xs">
                                  {!file.isFolder && (
                                    <DropdownMenuItem onClick={() => handleDownloadFile(file)} className="gap-1.5"><Download className="h-3.5 w-3.5 text-gold" /> Download</DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => { setActiveItem(file); setRenameName(file.name); setRenameOpen(true); }} className="gap-1.5"><Edit2 className="h-3.5 w-3.5" /> Rename</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setActiveItem(file); setSelectedMoveDest('root'); setMoveOpen(true); }} className="gap-1.5"><Move className="h-3.5 w-3.5" /> Move</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setActiveItem(file); setShareEmail(''); setShareOpen(true); }} className="gap-1.5"><Share2 className="h-3.5 w-3.5" /> Share/Permissions</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDelete(file)} className="text-red-400 focus:text-red-400 gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </>
                          ) : (
                            /* Internal File actions */
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              aria-label="Download" 
                              className="h-7 w-7 text-gold hover:bg-gold/15" 
                              title="Download"
                              onClick={() => handleDownloadFile(file)}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            
            /* B. GRID VIEW */
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 p-4">
              {mergedFiles.map((file) => (
                <div 
                  key={file.id} 
                  className="group relative flex flex-col p-4 rounded-xl border border-border bg-black/10 hover:bg-[#11241c]/5 hover:border-gold/20 transition-all text-center justify-between min-h-[140px]"
                >
                  <div className="absolute top-2 right-2">
                    {file.provider === 'google-drive' ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"><Settings className="h-3.5 w-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-xs">
                          {!file.isFolder && (
                            <DropdownMenuItem onClick={() => handleDownloadFile(file)} className="gap-1.5"><Download className="h-3.5 w-3.5 text-gold" /> Download</DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => { setActiveItem(file); setRenameName(file.name); setRenameOpen(true); }} className="gap-1.5"><Edit2 className="h-3.5 w-3.5" /> Rename</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setActiveItem(file); setSelectedMoveDest('root'); setMoveOpen(true); }} className="gap-1.5"><Move className="h-3.5 w-3.5" /> Move</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setActiveItem(file); setShareEmail(''); setShareOpen(true); }} className="gap-1.5"><Share2 className="h-3.5 w-3.5" /> Share</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(file)} className="text-red-400 focus:text-red-400 gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>

                  {file.isFolder ? (
                    <div 
                      className="cursor-pointer flex flex-col items-center gap-2 py-4"
                      onClick={() => navigateToFolder(file.id, file.name)}
                    >
                      <Folder className="h-10 w-10 text-gold fill-gold/20 group-hover:scale-105 transition-transform" />
                      <span className="text-xs font-semibold text-foreground truncate w-full px-1" title={file.name}>{file.name}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <File className="h-10 w-10 text-muted-foreground group-hover:scale-105 transition-transform" />
                      <span className="text-xs text-muted-foreground truncate w-full px-1" title={file.name}>{file.name}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40 text-[9px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      {file.provider === 'google-drive' ? <Cloud className="h-2.5 w-2.5 text-blue-400" /> : <HardDrive className="h-2.5 w-2.5 text-gold" />}
                    </span>
                    <span>{file.isFolder ? 'Folder' : `${(file.size / 1024).toFixed(0)} KB`}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── MODALS (CREATE FOLDER, RENAME, MOVE, SHARE) ── */}
      
      {/* Create Folder Modal */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2 text-xs">
            <Label>Folder Name</Label>
            <Input placeholder="Branding Assets" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateFolderOpen(false)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleCreateFolder} disabled={actioning || !newFolderName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Modal */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Rename Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2 text-xs">
            <Label>New Name</Label>
            <Input placeholder={activeItem?.name} value={renameName} onChange={e => setRenameName(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setRenameOpen(false); setActiveItem(null); }}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleRename} disabled={actioning || !renameName.trim()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Modal */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Move File / Folder</DialogTitle>
            <DialogDescription className="text-xs">Choose the destination folder inside this project workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 text-xs">
            <Label>Select Destination</Label>
            <Select value={selectedMoveDest} onValueChange={setSelectedMoveDest}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="root">Root Project Folder</SelectItem>
                {moveDestinations
                  .filter(f => f.id !== activeItem?.id) // cannot move into itself
                  .map(dest => (
                    <SelectItem key={dest.id} value={dest.id}>{dest.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setMoveOpen(false); setActiveItem(null); }}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleMove} disabled={actioning}>Move Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Google Drive Sharing & Permissions</DialogTitle>
            <DialogDescription className="text-xs">Invite collaborators or adjust access rights for this file/folder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label>Collaborator Email Address *</Label>
              <Input placeholder="collaborator@company.com" value={shareEmail} onChange={e => setShareEmail(e.target.value)} type="email" />
            </div>
            <div className="space-y-1">
              <Label>Access Role</Label>
              <Select value={shareRole} onValueChange={(v: any) => setShareRole(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Viewer">Viewer (Read-only)</SelectItem>
                  <SelectItem value="Commenter">Commenter</SelectItem>
                  <SelectItem value="Editor">Editor (Write access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShareOpen(false); setActiveItem(null); }}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleShare} disabled={actioning || !shareEmail.trim()}>Add Member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload File Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="max-w-md bg-card border-border shadow-2xl">
          <DialogHeader className="pb-2 border-b border-border/50">
            <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Upload className="h-4 w-4 text-gold" /> Upload File to Workspace
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Select a file and pick the target folder to organize your workspace files.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            {/* Custom Styled File Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Select File *</Label>
              <div className="relative flex items-center gap-3 p-2 rounded-lg border border-border bg-black/20 hover:border-gold/40 transition-colors">
                <Input
                  type="file"
                  onChange={e => setSelectedUploadFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                />
                <div className="h-8 px-3 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 shrink-0 pointer-events-none">
                  <Upload className="h-3.5 w-3.5" />
                  Choose File
                </div>
                <span className="text-xs text-muted-foreground truncate flex-1 pointer-events-none">
                  {selectedUploadFile ? (
                    <span className="text-foreground font-medium">{selectedUploadFile.name} ({(selectedUploadFile.size / 1024).toFixed(1)} KB)</span>
                  ) : (
                    'No file chosen'
                  )}
                </span>
              </div>
            </div>

            {/* Storage Location */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Storage Location</Label>
              <Select value={uploadDestination} onValueChange={(v: any) => setUploadDestination(v)}>
                <SelectTrigger className="h-9 text-xs bg-black/20 border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border text-xs">
                  <SelectItem value="internal">Netgain Internal Storage</SelectItem>
                  <SelectItem value="google-drive" disabled={!workspace?.linked || !workspace.verified}>
                    Google Drive Workspace {!workspace?.linked || !workspace.verified ? '(Unlinked)' : ''}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Target Folder in Google Drive */}
            {uploadDestination === 'google-drive' && workspace?.linked && workspace.verified && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">Target Folder in Google Drive</Label>
                  <button
                    type="button"
                    onClick={() => { setUploadModalOpen(false); setCreateFolderOpen(true); }}
                    className="text-[11px] font-semibold text-gold hover:underline"
                  >
                    + Create New Folder
                  </button>
                </div>
                <Select value={uploadTargetFolderId} onValueChange={setUploadTargetFolderId}>
                  <SelectTrigger className="h-9 text-xs bg-black/20 border-border"><SelectValue placeholder="Select target folder" /></SelectTrigger>
                  <SelectContent className="bg-card border-border text-xs">
                    <SelectItem value="root">📁 Root Workspace Folder ({workspace.folderName || 'Root'})</SelectItem>
                    {moveDestinations.map((f: FileItem) => (
                      <SelectItem key={f.id} value={f.id}>📁 {f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-border/50">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setUploadModalOpen(false); setSelectedUploadFile(null); }}>
              Cancel
            </Button>
            <Button variant="gold" size="sm" className="h-8 text-xs font-bold px-4" onClick={handleExecuteUpload} disabled={actioning || !selectedUploadFile}>
              {actioning ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null} Upload File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Existing Folder Modal */}
      <Dialog open={linkOpen} onOpenChange={(o) => { setLinkOpen(o); if (!o) { setLinkFolderUrlInput(''); setLinkFolderNameInput('') } }}>
        <DialogContent className="max-w-md bg-card border-border shadow-2xl">
          <DialogHeader className="pb-2 border-b border-border/50">
            <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Link2 className="h-4 w-4 text-gold" /> Link Existing Google Drive Folder
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Paste the Google Drive folder URL or raw Folder ID to link or switch workspace folder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Folder URL or Raw ID *</Label>
              <Input
                placeholder="https://drive.google.com/drive/folders/1aBcD... or folder ID"
                value={linkFolderUrlInput}
                onChange={e => setLinkFolderUrlInput(e.target.value)}
                className="h-9 text-xs bg-black/20 border-border"
              />
              {linkFolderUrlInput && (
                <div className="flex items-center gap-1.5 mt-1.5 p-2 rounded bg-black/30 border border-border/50">
                  <span className="text-[11px] text-muted-foreground shrink-0 font-medium">Extracted ID:</span>
                  <span className={`text-[11px] font-mono truncate ${extractedFolderId.length > 10 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {extractedFolderId || 'Could not extract — check URL'}
                  </span>
                </div>
              )}
              <span className="text-[10px] text-muted-foreground block mt-1">
                Make sure the folder is shared with your connected Google account before linking.
              </span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Folder Workspace Name (Optional)</Label>
              <Input
                placeholder={`${projectTitle} Workspace`}
                value={linkFolderNameInput}
                onChange={e => setLinkFolderNameInput(e.target.value)}
                className="h-9 text-xs bg-black/20 border-border"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2 border-t border-border/50">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button variant="gold" size="sm" className="h-8 text-xs font-bold px-4" onClick={() => handleLinkFolder(false)} disabled={actioning || !extractedFolderId || extractedFolderId.length <= 10}>
              {actioning ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null} Link Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Relink Folder Modal */}
      <Dialog open={relinkOpen} onOpenChange={(o) => { setRelinkOpen(o); if (!o) { setLinkFolderUrlInput(''); setLinkFolderNameInput('') } }}>
        <DialogContent className="max-w-md bg-card border-border shadow-2xl">
          <DialogHeader className="pb-2 border-b border-border/50">
            <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-gold" /> Relink Google Drive Folder
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Reconnect or replace the target folder for this project workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Folder URL or Raw ID *</Label>
              <Input
                placeholder="https://drive.google.com/drive/folders/... or folder ID"
                value={linkFolderUrlInput}
                onChange={e => setLinkFolderUrlInput(e.target.value)}
                className="h-9 text-xs bg-black/20 border-border"
              />
              {linkFolderUrlInput && (
                <div className="flex items-center gap-1.5 mt-1.5 p-2 rounded bg-black/30 border border-border/50">
                  <span className="text-[11px] text-muted-foreground shrink-0 font-medium">Extracted ID:</span>
                  <span className={`text-[11px] font-mono truncate ${extractedRelinkId.length > 10 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {extractedRelinkId || 'Could not extract — check URL'}
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Folder Name (Optional)</Label>
              <Input
                placeholder="Google Drive Workspace"
                value={linkFolderNameInput}
                onChange={e => setLinkFolderNameInput(e.target.value)}
                className="h-9 text-xs bg-black/20 border-border"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2 border-t border-border/50">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setRelinkOpen(false)}>Cancel</Button>
            <Button variant="gold" size="sm" className="h-8 text-xs font-bold px-4" onClick={() => handleLinkFolder(true)} disabled={actioning || !extractedRelinkId || extractedRelinkId.length <= 10}>
              {actioning ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null} Relink Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
