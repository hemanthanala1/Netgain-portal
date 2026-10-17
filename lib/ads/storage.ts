/**
 * Netgain Ads — Private Storage Service
 * Handles server-mediated storage of original report files (.csv, .xlsx, .tsv, etc.)
 * Strictly uses private storage; public storage URLs are NEVER generated for client reports.
 */

import fs from 'fs'
import path from 'path'
import { isLiveSupabaseAvailable, supabaseAdmin } from './server-guard'

export const ADS_STORAGE_BUCKET = 'ads-reports'
const LOCAL_STORAGE_DIR = path.join(process.cwd(), '.storage', 'ads-reports')

/**
 * Ensures the private Supabase storage bucket or local directory exists
 */
export async function ensureStorageReady(): Promise<void> {
  if (isLiveSupabaseAvailable && supabaseAdmin) {
    try {
      await supabaseAdmin.storage.createBucket(ADS_STORAGE_BUCKET, {
        public: false,
        fileSizeLimit: 52428800 // 50MB
      })
    } catch {
      // Bucket already exists or permissions handled
    }
  } else {
    try {
      if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
        fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true })
      }
    } catch (err) {
      console.error('[Ads Storage] Failed to ensure local storage dir:', err)
    }
  }
}

/**
 * Uploads an original report file to private storage
 */
export async function uploadReportFile(
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<{ success: boolean; storageType: 'supabase' | 'local'; error?: string }> {
  await ensureStorageReady()

  if (isLiveSupabaseAvailable && supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin.storage
        .from(ADS_STORAGE_BUCKET)
        .upload(storagePath, buffer, {
          contentType: contentType || 'application/octet-stream',
          upsert: true
        })

      if (error) {
        console.warn('[Ads Storage] Supabase upload failed, falling back to secure local:', error.message)
      } else {
        return { success: true, storageType: 'supabase' }
      }
    } catch (err: any) {
      console.warn('[Ads Storage] Supabase upload error:', err.message)
    }
  }

  // Fallback to secure local directory (outside of public/)
  try {
    const fullPath = path.join(LOCAL_STORAGE_DIR, storagePath)
    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(fullPath, buffer)
    return { success: true, storageType: 'local' }
  } catch (err: any) {
    return { success: false, storageType: 'local', error: err.message }
  }
}

/**
 * Retrieves the raw file buffer from private storage for server-authorized streaming
 */
export async function getReportFileBuffer(
  storagePath: string
): Promise<{ buffer: Buffer | null; error?: string }> {
  if (isLiveSupabaseAvailable && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(ADS_STORAGE_BUCKET)
        .download(storagePath)

      if (!error && data) {
        const arrayBuf = await data.arrayBuffer()
        return { buffer: Buffer.from(arrayBuf) }
      }
    } catch (err: any) {
      console.warn('[Ads Storage] Supabase download error, checking local:', err.message)
    }
  }

  // Local storage check
  try {
    const fullPath = path.join(LOCAL_STORAGE_DIR, storagePath)
    if (fs.existsSync(fullPath)) {
      const buf = fs.readFileSync(fullPath)
      return { buffer: buf }
    }
  } catch (err: any) {
    return { buffer: null, error: err.message }
  }

  return { buffer: null, error: 'File not found in storage' }
}

/**
 * Removes a file from private storage
 */
export async function deleteReportFile(storagePath: string): Promise<boolean> {
  if (isLiveSupabaseAvailable && supabaseAdmin) {
    try {
      await supabaseAdmin.storage.from(ADS_STORAGE_BUCKET).remove([storagePath])
    } catch {
      // Ignore
    }
  }

  try {
    const fullPath = path.join(LOCAL_STORAGE_DIR, storagePath)
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
    }
  } catch {
    // Ignore
  }

  return true
}
