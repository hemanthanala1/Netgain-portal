export interface FileItem {
  id: string
  name: string
  size: number
  mimeType: string
  provider: 'internal' | 'google-drive'
  isFolder: boolean
  parentId?: string
  webViewLink?: string
  webContentLink?: string
  createdAt: string
  modifiedAt: string
  owner?: string
  visibility?: 'Internal Only' | 'Published to Client' | 'Hidden'
  favorite?: boolean
}

export interface StorageUsage {
  used: number
  total: number
}

// Convert a Google Drive API file resource to our unified FileItem format
export function mapGoogleFileToItem(gFile: any, projectId?: string): FileItem {
  const isFolder = gFile.mimeType === 'application/vnd.google-apps.folder'
  return {
    id: gFile.id,
    name: gFile.name,
    size: isFolder ? 0 : Number(gFile.size) || 0,
    mimeType: gFile.mimeType,
    provider: 'google-drive',
    isFolder,
    parentId: gFile.parents?.[0] || 'root',
    webViewLink: gFile.webViewLink || '',
    webContentLink: gFile.webContentLink || '',
    createdAt: gFile.createdTime || new Date().toISOString(),
    modifiedAt: gFile.modifiedTime || new Date().toISOString(),
    owner: gFile.owners?.[0]?.emailAddress || gFile.owners?.[0]?.displayName || 'Google User',
    visibility: 'Internal Only', // default for Drive files inside ERP
    favorite: false
  }
}

// Convert a DB project_files row to our unified FileItem format
export function mapInternalFileToItem(dbFile: any): FileItem {
  // Infer mime type from extension
  const ext = dbFile.name.split('.').pop()?.toLowerCase() || ''
  let mimeType = 'application/octet-stream'
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
    mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`
  } else if (ext === 'pdf') {
    mimeType = 'application/pdf'
  } else if (['mp4', 'webm', 'ogg'].includes(ext)) {
    mimeType = `video/${ext}`
  } else if (['mp3', 'wav', 'm4a'].includes(ext)) {
    mimeType = `audio/${ext}`
  } else if (['doc', 'docx'].includes(ext)) {
    mimeType = 'application/msword'
  } else if (['xls', 'xlsx'].includes(ext)) {
    mimeType = 'application/vnd.ms-excel'
  } else if (['ppt', 'pptx'].includes(ext)) {
    mimeType = 'application/vnd.ms-powerpoint'
  }

  return {
    id: dbFile.id,
    name: dbFile.name,
    size: Number(dbFile.size) || 0,
    mimeType,
    provider: 'internal',
    isFolder: false,
    parentId: 'root', // internal files are flat in project_files
    webViewLink: dbFile.file_path, // can preview directly
    webContentLink: dbFile.file_path, // download directly
    createdAt: dbFile.uploaded_at || new Date().toISOString(),
    modifiedAt: dbFile.uploaded_at || new Date().toISOString(),
    owner: dbFile.uploaded_by || 'Admin',
    visibility: dbFile.visibility || 'Internal Only',
    favorite: false
  }
}
