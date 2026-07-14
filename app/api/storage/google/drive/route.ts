export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleDriveClient } from '@/lib/google-drive'
import { mapGoogleFileToItem } from '@/lib/storage-provider'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAdmin = createClient(
  supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}.supabase.co`,
  supabaseServiceKey
)

// Helper to authenticate user
async function authenticate(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '') || 
                request.nextUrl.searchParams.get('token') || ''
  if (!token) return null

  if (token.startsWith('client:')) {
    const clientAccountId = token.replace('client:', '')
    const { data: account } = await supabaseAdmin
      .from('client_accounts')
      .select('id, email')
      .eq('id', clientAccountId)
      .maybeSingle()
    if (account) {
      return { id: account.id, email: account.email }
    }
    return null
  }

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user
}

// Helper to log google activity
async function logGoogleActivity(userId: string, userName: string, projectId: string, action: string, fileName: string, fileId: string, details: string) {
  try {
    // 1. Insert into Google activities log
    await supabaseAdmin.from('google_activity_logs').insert({
      user_id: userId,
      user_name: userName,
      project_id: projectId || null,
      file_id: fileId,
      file_name: fileName,
      action,
      details
    })

    // 2. Insert into Project activity timeline if project-scoped
    if (projectId) {
      await supabaseAdmin.from('project_activity_timeline').insert({
        project_id: projectId,
        user_name: userName,
        action: `Google Drive: ${action}`,
        notes: details
      })
    }
  } catch (err) {
    console.error('[Google Activity Log Error]', err)
  }
}

/**
 * GET Handler
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action') || 'list'

    const projectId = searchParams.get('projectId')
    let connectionUserId = user.id
    if (projectId) {
      const { data: mapping } = await supabaseAdmin
        .from('project_drive_mapping')
        .select('linked_by')
        .eq('project_id', projectId)
        .maybeSingle()
      if (mapping?.linked_by) {
        connectionUserId = mapping.linked_by
      }
    }

    const client = new GoogleDriveClient(connectionUserId)

    // A. LIST FILES
    if (action === 'list') {
      const folderId = searchParams.get('folderId') || 'root'
      const search = searchParams.get('search') || ''
      const projectId = searchParams.get('projectId') || ''

      const files = await client.listFiles(folderId, search)
      const mapped = files.map(f => mapGoogleFileToItem(f, projectId))
      return NextResponse.json({ files: mapped })
    }

    // B. DOWNLOAD FILE
    if (action === 'download') {
      const fileId = searchParams.get('fileId')
      if (!fileId) return NextResponse.json({ error: 'File ID required' }, { status: 400 })

      const { buffer, mimeType, fileName } = await client.downloadFile(fileId)

      // Log download
      const projectId = searchParams.get('projectId') || ''
      await logGoogleActivity(user.id, user.email || 'User', projectId, 'downloaded', fileName, fileId, `Downloaded file: ${fileName}`)

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        }
      })
    }

    // C. WORKSPACE STATUS (LINKED DRIVE FOLDER FOR PROJECT)
    if (action === 'workspace-status') {
      const projectId = searchParams.get('projectId')
      if (!projectId) return NextResponse.json({ error: 'Project ID required' }, { status: 400 })

      const { data, error } = await supabaseAdmin
        .from('project_drive_mapping')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      if (!data) return NextResponse.json({ linked: false })

      // Fetch folder metadata live to verify it still exists
      try {
        const files = await client.listFiles(data.folder_id)
        return NextResponse.json({
          linked: true,
          folderId: data.folder_id,
          folderName: data.folder_name,
          ownerEmail: data.owner_email,
          createdAt: data.created_at,
          verified: true
        })
      } catch (err: any) {
        // Folder likely deleted or unshared
        return NextResponse.json({
          linked: true,
          folderId: data.folder_id,
          folderName: data.folder_name,
          ownerEmail: data.owner_email,
          createdAt: data.created_at,
          verified: false,
          error: 'Folder not accessible or deleted from Drive'
        })
      }
    }

    // D. FILE PERMISSIONS
    if (action === 'permissions') {
      const fileId = searchParams.get('fileId')
      if (!fileId) return NextResponse.json({ error: 'File ID required' }, { status: 400 })

      const permissions = await client.getPermissions(fileId)
      return NextResponse.json({ permissions })
    }

    // E. GOOGLE DRIVE DASHBOARD INFO FOR PROJECT
    if (action === 'dashboard') {
      const projectId = searchParams.get('projectId')
      const folderId = searchParams.get('folderId')
      if (!projectId || !folderId) {
        return NextResponse.json({ error: 'Project ID and Folder ID required' }, { status: 400 })
      }

      // Fetch files under project drive folder
      const files = await client.listFiles(folderId)
      
      const fileCount = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder').length
      const folderCount = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder').length
      
      // Calculate sizes
      const largestFiles = [...files]
        .filter(f => f.mimeType !== 'application/vnd.google-apps.folder')
        .sort((a, b) => (Number(b.size) || 0) - (Number(a.size) || 0))
        .slice(0, 5)
        .map(f => mapGoogleFileToItem(f, projectId))

      const totalSize = files.reduce((acc, f) => acc + (Number(f.size) || 0), 0)

      // Fetch recent connection usage quota
      const { used, total } = await client.getStorageUsage()

      // Fetch connection logs
      const { data: logs } = await supabaseAdmin
        .from('google_activity_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10)

      return NextResponse.json({
        fileCount,
        folderCount,
        totalSize,
        storageQuotaUsed: used,
        storageQuotaTotal: total,
        largestFiles,
        recentActivity: logs || []
      })
    }

    return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 })
  } catch (err: any) {
    console.error('[Google Drive GET API Exception]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST Handler
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check content-type to handle file uploads
    const contentType = request.headers.get('content-type') || ''
    
    let projectId: string | null = null
    let body: any = null
    let formData: any = null

    if (contentType.includes('multipart/form-data')) {
      formData = await request.formData()
      projectId = formData.get('projectId') as string | null
    } else {
      body = await request.json()
      projectId = body?.projectId || null
    }

    let connectionUserId = user.id
    if (projectId) {
      const { data: mapping } = await supabaseAdmin
        .from('project_drive_mapping')
        .select('linked_by')
        .eq('project_id', projectId)
        .maybeSingle()
      if (mapping?.linked_by) {
        connectionUserId = mapping.linked_by
      }
    }

    const client = new GoogleDriveClient(connectionUserId)

    // A. MULTIPART FILE UPLOAD
    if (contentType.includes('multipart/form-data')) {
      const file = formData.get('file') as File | null
      const folderId = (formData.get('folderId') as string) || 'root'
      const category = (formData.get('category') as string) || 'Other Documents'
      const visibility = (formData.get('visibility') as string) || 'Published to Client'

      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      console.log(`[Google Drive Upload] Uploading ${file.name} (${file.size} bytes) to folder ${folderId}...`)

      const uploaded = await client.uploadFile(buffer, file.name, file.type, folderId)

      // Link in database metadata cache
      await supabaseAdmin.from('google_files_metadata').upsert({
        file_id: uploaded.id,
        project_id: projectId || null,
        name: uploaded.name,
        mime_type: uploaded.mimeType,
        size: Number(uploaded.size) || file.size,
        web_view_link: uploaded.webViewLink,
        web_content_link: uploaded.webContentLink,
        parent_id: folderId,
        created_time: uploaded.createdTime,
        modified_time: uploaded.modifiedTime,
        owner_name: uploaded.owners?.[0]?.displayName || 'User',
        owner_email: uploaded.owners?.[0]?.emailAddress || user.email,
        provider_status: 'active',
        is_folder: false,
        updated_at: new Date().toISOString()
      }, { onConflict: 'file_id' })

      // Log activity
      if (projectId) {
        await logGoogleActivity(
          user.id,
          user.email || 'User',
          projectId,
          'uploaded',
          uploaded.name,
          uploaded.id,
          `Uploaded file: ${uploaded.name} (${category})`
        )
      }

      return NextResponse.json({
        success: true,
        file: mapGoogleFileToItem(uploaded, projectId || undefined)
      })
    }

    // B. JSON ACTIONS
    const { action } = body

    if (!action) return NextResponse.json({ error: 'Action required' }, { status: 400 })

    // B1. CREATE FOLDER
    if (action === 'create-folder') {
      const { name, parentId, projectId } = body
      if (!name) return NextResponse.json({ error: 'Folder name required' }, { status: 400 })

      const folder = await client.createFolder(name, parentId || 'root')

      // Cache folder metadata
      await supabaseAdmin.from('google_files_metadata').upsert({
        file_id: folder.id,
        project_id: projectId || null,
        name: folder.name,
        mime_type: folder.mimeType,
        parent_id: parentId || 'root',
        is_folder: true,
        provider_status: 'active',
        updated_at: new Date().toISOString()
      }, { onConflict: 'file_id' })

      // Log activity
      if (projectId) {
        await logGoogleActivity(
          user.id,
          user.email || 'User',
          projectId,
          'folder_created',
          folder.name,
          folder.id,
          `Created folder: ${folder.name}`
        )
      }

      return NextResponse.json({ success: true, folder: mapGoogleFileToItem(folder, projectId) })
    }

    // B2. RENAME FILE/FOLDER
    if (action === 'rename') {
      const { fileId, name, projectId } = body
      if (!fileId || !name) return NextResponse.json({ error: 'File ID and name required' }, { status: 400 })

      const updated = await client.renameFile(fileId, name)

      // Update cache
      await supabaseAdmin.from('google_files_metadata')
        .update({ name: updated.name, updated_at: new Date().toISOString() })
        .eq('file_id', fileId)

      // Log activity
      if (projectId) {
        await logGoogleActivity(
          user.id,
          user.email || 'User',
          projectId,
          updated.mimeType === 'application/vnd.google-apps.folder' ? 'folder_renamed' : 'renamed',
          updated.name,
          updated.id,
          `Renamed file/folder to: ${updated.name}`
        )
      }

      return NextResponse.json({ success: true, file: mapGoogleFileToItem(updated, projectId) })
    }

    // B3. MOVE FILE/FOLDER
    if (action === 'move') {
      const { fileId, sourceParentId, targetParentId, projectId } = body
      if (!fileId || !sourceParentId || !targetParentId) {
        return NextResponse.json({ error: 'File ID, source parent, and target parent required' }, { status: 400 })
      }

      const moved = await client.moveFile(fileId, sourceParentId, targetParentId)

      // Update cache
      await supabaseAdmin.from('google_files_metadata')
        .update({ parent_id: targetParentId, updated_at: new Date().toISOString() })
        .eq('file_id', fileId)

      // Log activity
      if (projectId) {
        await logGoogleActivity(
          user.id,
          user.email || 'User',
          projectId,
          'moved',
          moved.name,
          moved.id,
          `Moved file/folder: ${moved.name} to new directory`
        )
      }

      return NextResponse.json({ success: true, file: mapGoogleFileToItem(moved, projectId) })
    }

    // B4. COPY FILE
    if (action === 'copy') {
      const { fileId, name, targetParentId, projectId } = body
      if (!fileId || !name) return NextResponse.json({ error: 'File ID and target name required' }, { status: 400 })

      const copied = await client.copyFile(fileId, name, targetParentId || 'root')

      // Cache metadata
      await supabaseAdmin.from('google_files_metadata').upsert({
        file_id: copied.id,
        project_id: projectId || null,
        name: copied.name,
        mime_type: copied.mimeType,
        parent_id: targetParentId || 'root',
        is_folder: false,
        provider_status: 'active',
        updated_at: new Date().toISOString()
      }, { onConflict: 'file_id' })

      // Log activity
      if (projectId) {
        await logGoogleActivity(
          user.id,
          user.email || 'User',
          projectId,
          'copied',
          copied.name,
          copied.id,
          `Copied file: ${copied.name}`
        )
      }

      return NextResponse.json({ success: true, file: mapGoogleFileToItem(copied, projectId) })
    }

    // B5. TRASH/DELETE FILE/FOLDER
    if (action === 'delete') {
      const { fileId, projectId, permanent } = body
      if (!fileId) return NextResponse.json({ error: 'File ID required' }, { status: 400 })

      // Fetch name first for logging
      const { data: cachedFile } = await supabaseAdmin
        .from('google_files_metadata')
        .select('name, is_folder')
        .eq('file_id', fileId)
        .maybeSingle()

      const fileName = cachedFile?.name || 'unknown file'
      const isFolder = cachedFile?.is_folder || false

      if (permanent) {
        await client.deleteFile(fileId)
      } else {
        await client.trashFile(fileId)
      }

      // Mark status in cache
      await supabaseAdmin.from('google_files_metadata')
        .update({ provider_status: 'deleted', updated_at: new Date().toISOString() })
        .eq('file_id', fileId)

      // Log activity
      if (projectId) {
        await logGoogleActivity(
          user.id,
          user.email || 'User',
          projectId,
          isFolder ? 'folder_deleted' : 'deleted',
          fileName,
          fileId,
          `Deleted file/folder: ${fileName}`
        )
      }

      return NextResponse.json({ success: true })
    }

    // B6. SHARE FILE (PERMISSIONS SYNC)
    if (action === 'share') {
      const { fileId, email, role, projectId } = body
      if (!fileId || !email || !role) {
        return NextResponse.json({ error: 'File ID, email, and role required' }, { status: 400 })
      }

      const roleMap: Record<string, 'owner' | 'writer' | 'commenter' | 'reader'> = {
        Owner: 'owner',
        Editor: 'writer',
        Commenter: 'commenter',
        Viewer: 'reader'
      }

      const driveRole = roleMap[role] || 'reader'

      const permission = await client.shareFile(fileId, email, driveRole)

      // Cache permission
      await supabaseAdmin.from('google_permissions').upsert({
        file_id: fileId,
        permission_id: permission.id,
        email_address: email,
        role: driveRole,
        type: 'user'
      }, { onConflict: 'file_id, permission_id' })

      // Log activity
      if (projectId) {
        await logGoogleActivity(
          user.id,
          user.email || 'User',
          projectId,
          'shared',
          '',
          fileId,
          `Shared resource with ${email} as ${role}`
        )
      }

      return NextResponse.json({ success: true })
    }

    // B7. LINK EXISTING DRIVE FOLDER TO PROJECT
    if (action === 'link-workspace') {
      const { projectId, folderId, folderName } = body
      if (!projectId || !folderId) {
        return NextResponse.json({ error: 'Project ID and Folder ID required' }, { status: 400 })
      }

      // Try resolving folder name live if not provided
      let resolvedFolderName = folderName
      if (!resolvedFolderName) {
        try {
          const files = await client.listFiles(folderId)
          // folder is listed as parent of children or we resolve its metadata
          resolvedFolderName = 'Google Drive Workspace'
        } catch (e) {
          resolvedFolderName = 'Google Drive Workspace'
        }
      }

      const { data: oldMapping } = await supabaseAdmin
        .from('project_drive_mapping')
        .select('folder_id')
        .eq('project_id', projectId)
        .maybeSingle()

      const mappingRecord = {
        project_id: projectId,
        folder_id: folderId,
        folder_name: resolvedFolderName,
        owner_email: user.email || 'unknown',
        linked_by: user.id
      }

      const { error } = await supabaseAdmin
        .from('project_drive_mapping')
        .upsert(mappingRecord, { onConflict: 'project_id' })

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Log mapping
      await logGoogleActivity(
        user.id,
        user.email || 'User',
        projectId,
        'workspace_linked',
        resolvedFolderName,
        folderId,
        `Linked project to Google Drive folder: ${resolvedFolderName}`
      )

      return NextResponse.json({ success: true, folderId })
    }

    // B8. UNLINK DRIVE FOLDER FROM PROJECT
    if (action === 'unlink-workspace') {
      const { projectId } = body
      if (!projectId) return NextResponse.json({ error: 'Project ID required' }, { status: 400 })

      const { data: mapping } = await supabaseAdmin
        .from('project_drive_mapping')
        .select('folder_name, folder_id')
        .eq('project_id', projectId)
        .maybeSingle()

      const { error } = await supabaseAdmin
        .from('project_drive_mapping')
        .delete()
        .eq('project_id', projectId)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Log unlinking
      if (mapping) {
        await logGoogleActivity(
          user.id,
          user.email || 'User',
          projectId,
          'workspace_unlinked',
          mapping.folder_name,
          mapping.folder_id,
          `Unlinked Google Drive folder: ${mapping.folder_name}`
        )
      }

      return NextResponse.json({ success: true })
    }

    // B9. CREATE WORKSPACE FOLDER AND DEFAULT STRUCTURE TEMPLATE
    if (action === 'create-workspace-folder') {
      const { projectId, folderName } = body
      if (!projectId || !folderName) {
        return NextResponse.json({ error: 'Project ID and folder name required' }, { status: 400 })
      }

      console.log(`[Google Drive Workspace] Creating root folder for project: ${folderName}...`)
      const rootFolder = await client.createFolder(folderName, 'root')

      // Save mapping in database
      const mappingRecord = {
        project_id: projectId,
        folder_id: rootFolder.id,
        folder_name: rootFolder.name,
        owner_email: user.email || 'unknown',
        linked_by: user.id
      }
      await supabaseAdmin.from('project_drive_mapping').upsert(mappingRecord, { onConflict: 'project_id' })

      // Automatically create structure template
      const foldersToCreate = [
        'Requirements', 'Branding', 'Design', 
        'Development', 'Testing', 'Assets', 
        'Deliverables', 'Documents', 'Archive'
      ]

      console.log(`[Google Drive Workspace] Generating folder structure templates under ${rootFolder.id}...`)
      
      // Create folders sequentially
      for (const name of foldersToCreate) {
        try {
          const sub = await client.createFolder(name, rootFolder.id)
          // Cache subfolder metadata
          await supabaseAdmin.from('google_files_metadata').upsert({
            file_id: sub.id,
            project_id: projectId,
            name: sub.name,
            mime_type: sub.mimeType,
            parent_id: rootFolder.id,
            is_folder: true,
            provider_status: 'active',
            updated_at: new Date().toISOString()
          }, { onConflict: 'file_id' })
        } catch (e) {
          console.error(`[Google Drive Workspace] Error creating template folder ${name}:`, e)
        }
      }

      // Log activity
      await logGoogleActivity(
        user.id,
        user.email || 'User',
        projectId,
        'workspace_created',
        rootFolder.name,
        rootFolder.id,
        `Created Google Drive root workspace folder: ${rootFolder.name} and templates`
      )

      return NextResponse.json({ success: true, folderId: rootFolder.id })
    }

    return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 })
  } catch (err: any) {
    console.error('[Google Drive POST API Exception]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
