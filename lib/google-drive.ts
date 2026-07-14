import { encrypt, decrypt } from './crypto-helper'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
// Create a privileged admin client to manage tokens and database metadata safely
const supabaseAdmin = createClient(
  supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}.supabase.co`,
  supabaseServiceKey
)

export interface GoogleConnection {
  user_id: string
  google_user_id?: string
  google_email?: string
  refresh_token: string
  access_token: string
  expires_at: string
  status: string
  storage_used?: number
  storage_total?: number
}

export interface GoogleDriveFile {
  id: string
  name: string
  mimeType: string
  size?: number
  webViewLink?: string
  webContentLink?: string
  parents?: string[]
  createdTime?: string
  modifiedTime?: string
  owners?: Array<{ displayName: string; emailAddress: string }>
}

export class GoogleDriveClient {
  private userId: string
  private connection: GoogleConnection | null = null

  constructor(userId: string) {
    if (!userId) throw new Error('User ID is required for GoogleDriveClient')
    this.userId = userId
  }

  /**
   * Loads the current connection from the database
   */
  private async loadConnection(): Promise<GoogleConnection> {
    const { data, error } = await supabaseAdmin
      .from('google_connections')
      .select('*')
      .eq('user_id', this.userId)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to load Google connection: ${error.message}`)
    }
    if (!data) {
      throw new Error('Google account not connected')
    }

    this.connection = {
      user_id: data.user_id,
      google_user_id: data.google_user_id,
      google_email: data.google_email,
      refresh_token: decrypt(data.refresh_token),
      access_token: decrypt(data.access_token),
      expires_at: data.expires_at,
      status: data.status,
      storage_used: Number(data.storage_used) || 0,
      storage_total: Number(data.storage_total) || 0,
    }

    return this.connection
  }

  /**
   * Refreshes the Google Access Token if it is expired or close to expiring (within 2 minutes)
   */
  public async getValidAccessToken(): Promise<string> {
    const conn = await this.loadConnection()
    const expiry = new Date(conn.expires_at).getTime()
    const now = Date.now()

    // If still valid for at least 2 minutes, return the current token
    if (expiry - now > 120 * 1000) {
      return conn.access_token
    }

    console.log(`[Google Drive Client] Access token expired or expiring soon. Refreshing for user: ${this.userId}...`)
    
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth Client ID or Client Secret is missing in environment variables')
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: conn.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    const data = await response.json()
    if (!response.ok || data.error) {
      // Set status to error in connection table
      await supabaseAdmin
        .from('google_connections')
        .update({ status: 'error', updated_at: new Date().toISOString() })
        .eq('user_id', this.userId)

      throw new Error(`Google token refresh failed: ${data.error_description || data.error || 'Unknown error'}`)
    }

    const newAccessToken = data.access_token
    const expiresIn = data.expires_in || 3600
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // Update token in DB (only access_token changes on refresh usually, but check if refresh_token is returned)
    const updates: any = {
      access_token: encrypt(newAccessToken),
      expires_at: newExpiresAt,
      status: 'connected',
      updated_at: new Date().toISOString(),
    }

    if (data.refresh_token) {
      updates.refresh_token = encrypt(data.refresh_token)
    }

    await supabaseAdmin
      .from('google_connections')
      .update(updates)
      .eq('user_id', this.userId)

    this.connection!.access_token = newAccessToken
    this.connection!.expires_at = newExpiresAt
    this.connection!.status = 'connected'

    return newAccessToken
  }

  /**
   * Helper to perform fetch requests with auth headers and automatic error handling
   */
  private async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const accessToken = await this.getValidAccessToken()
    
    const url = endpoint.startsWith('http') ? endpoint : `https://www.googleapis.com${endpoint}`
    
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      ...((options.headers as any) || {}),
    }

    const response = await fetch(url, { ...options, headers })

    if (!response.ok) {
      const errText = await response.text()
      let errMsg = errText
      try {
        const errJson = JSON.parse(errText)
        errMsg = errJson.error?.message || errJson.error_description || errText
      } catch (e) {
        // ignore JSON parse error
      }
      throw new Error(`Google API Error (${response.status}): ${errMsg}`)
    }

    if (response.status === 204) {
      return null
    }

    return response.json()
  }

  /**
   * Fetch storage quota of the connected account
   */
  public async getStorageUsage(): Promise<{ used: number; total: number }> {
    const data = await this.apiRequest('/drive/v3/about?fields=storageQuota')
    const used = Number(data.storageQuota?.usage) || 0
    const total = Number(data.storageQuota?.limit) || 15 * 1024 * 1024 * 1024 // fallback 15GB

    // Update connection cache in DB
    await supabaseAdmin
      .from('google_connections')
      .update({
        storage_used: used,
        storage_total: total,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', this.userId)

    return { used, total }
  }

  /**
   * Lists files and folders under a parent directory
   */
  public async listFiles(parentId: string = 'root', searchTerm: string = ''): Promise<GoogleDriveFile[]> {
    let query = `'${parentId}' in parents and trashed = false`
    
    if (searchTerm) {
      const cleanSearch = searchTerm.replace(/'/g, "\\'")
      query += ` and name contains '${cleanSearch}'`
    }

    const fields = 'files(id, name, mimeType, size, webViewLink, webContentLink, parents, createdTime, modifiedTime, owners)'
    const endpoint = `/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&orderBy=folder%2Cname&pageSize=1000`
    
    const data = await this.apiRequest(endpoint)
    return data.files || []
  }

  /**
   * Create a folder on Google Drive
   */
  public async createFolder(name: string, parentId: string = 'root'): Promise<GoogleDriveFile> {
    const body = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }

    return this.apiRequest('/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  /**
   * Rename a file or folder
   */
  public async renameFile(fileId: string, newName: string): Promise<GoogleDriveFile> {
    return this.apiRequest(`/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
  }

  /**
   * Move a file or folder to a new parent
   */
  public async moveFile(fileId: string, currentParentId: string, newParentId: string): Promise<GoogleDriveFile> {
    const endpoint = `/drive/v3/files/${fileId}?addParents=${newParentId}&removeParents=${currentParentId}`
    return this.apiRequest(endpoint, {
      method: 'PATCH',
    })
  }

  /**
   * Copy a file
   */
  public async copyFile(fileId: string, name: string, targetParentId: string = 'root'): Promise<GoogleDriveFile> {
    return this.apiRequest(`/drive/v3/files/${fileId}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        parents: [targetParentId]
      })
    })
  }

  /**
   * Delete a file or folder (moves to trash by default)
   */
  public async trashFile(fileId: string): Promise<GoogleDriveFile> {
    return this.apiRequest(`/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    })
  }

  /**
   * Permanently delete a file or folder
   */
  public async deleteFile(fileId: string): Promise<void> {
    await this.apiRequest(`/drive/v3/files/${fileId}`, {
      method: 'DELETE'
    })
  }

  /**
   * Uploads a file to Google Drive using multipart upload
   */
  public async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    parentId: string = 'root'
  ): Promise<GoogleDriveFile> {
    const accessToken = await this.getValidAccessToken()
    
    // Construct boundary and metadata
    const boundary = '-------314159265358979323846'
    const delimiter = `\r\n--${boundary}\r\n`
    const closeDelimiter = `\r\n--${boundary}--`

    const metadata = {
      name: fileName,
      mimeType: mimeType,
      parents: [parentId],
    }

    const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
    
    // We construct the multipart body manually using buffers
    const headerBuffer = Buffer.from(metadataPart + `${delimiter}Content-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`)
    const base64Data = fileBuffer.toString('base64')
    const filePartBuffer = Buffer.from(base64Data)
    const footerBuffer = Buffer.from(closeDelimiter)

    const multipartBody = Buffer.concat([headerBuffer, filePartBuffer, footerBuffer])

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink,parents,createdTime,modifiedTime', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': multipartBody.length.toString(),
      },
      body: multipartBody,
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Google Upload Failed (${response.status}): ${errText}`)
    }

    return response.json()
  }

  /**
   * Downloads a file from Google Drive as a Buffer
   */
  public async downloadFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const accessToken = await this.getValidAccessToken()

    // 1. Fetch metadata first to get mimeType and name
    const metadata = await this.apiRequest(`/drive/v3/files/${fileId}?fields=name,mimeType`)
    
    let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    
    // If it's a Google Doc/Sheet/Slide, we must export it instead of direct media download
    if (metadata.mimeType.startsWith('application/vnd.google-apps.')) {
      let exportMime = 'application/pdf'
      let extension = '.pdf'
      
      if (metadata.mimeType === 'application/vnd.google-apps.document') {
        exportMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
        extension = '.docx'
      } else if (metadata.mimeType === 'application/vnd.google-apps.spreadsheet') {
        exportMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
        extension = '.xlsx'
      } else if (metadata.mimeType === 'application/vnd.google-apps.presentation') {
        exportMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation' // .pptx
        extension = '.pptx'
      }
      
      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`
      metadata.mimeType = exportMime
      if (!metadata.name.endsWith(extension)) {
        metadata.name += extension
      }
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to download file from Google Drive: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    return {
      buffer,
      mimeType: metadata.mimeType,
      fileName: metadata.name
    }
  }

  /**
   * Fetch permissions for a file
   */
  public async getPermissions(fileId: string): Promise<any[]> {
    const data = await this.apiRequest(`/drive/v3/files/${fileId}/permissions?fields=permissions(id,role,type,emailAddress,displayName)`)
    return data.permissions || []
  }

  /**
   * Add a permission (sharing)
   */
  public async shareFile(
    fileId: string,
    emailAddress: string,
    role: 'owner' | 'writer' | 'commenter' | 'reader',
    sendNotificationEmail: boolean = true
  ): Promise<any> {
    const body = {
      role,
      type: 'user',
      emailAddress,
    }
    
    const endpoint = `/drive/v3/files/${fileId}/permissions?sendNotificationEmail=${sendNotificationEmail}`
    return this.apiRequest(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  }

  /**
   * Remove a permission (unshare)
   */
  public async removePermission(fileId: string, permissionId: string): Promise<void> {
    await this.apiRequest(`/drive/v3/files/${fileId}/permissions/${permissionId}`, {
      method: 'DELETE'
    })
  }
}
