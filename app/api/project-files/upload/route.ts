import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const projectId = formData.get('projectId') as string | null
    const category = formData.get('category') as string | null
    const uploadedBy = formData.get('uploadedBy') as string | null
    const version = formData.get('version') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const fileExt = file.name.split('.').pop() || 'bin'
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${projectId}-${Date.now()}-${cleanFileName}`

    // 1. Read file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 2. Try Supabase Storage
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const parsedUrl = supabaseUrl?.includes('//') ? supabaseUrl : `https://${supabaseUrl}.supabase.co`

    if (parsedUrl && serviceRoleKey && serviceRoleKey !== 'your_supabase_service_role_key') {
      try {
        const supabaseAdmin = createClient(parsedUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        })

        // Ensure bucket exists
        try {
          await supabaseAdmin.storage.createBucket('project-files', { public: true })
        } catch (e) {
          // Already exists or creation error, ignore
        }

        const { error: uploadError } = await supabaseAdmin.storage
          .from('project-files')
          .upload(fileName, buffer, {
            contentType: file.type || 'application/octet-stream',
            cacheControl: '3600',
            upsert: true
          })

        if (!uploadError) {
          const { data: { publicUrl } } = supabaseAdmin.storage
            .from('project-files')
            .getPublicUrl(fileName)

          return NextResponse.json({ 
            success: true, 
            url: publicUrl, 
            storageType: 'supabase',
            fileName: file.name 
          })
        } else {
          console.warn('[API Project File Upload] Supabase upload error, falling back to local:', uploadError.message)
        }
      } catch (err: any) {
        console.warn('[API Project File Upload] Supabase upload exception, falling back to local:', err?.message)
      }
    }

    // 3. Fallback: Save to Local public/uploads/project-files/
    console.log('[API Project File Upload] Executing local filesystem upload fallback...')
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'project-files')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    const localPath = path.join(uploadDir, fileName)
    fs.writeFileSync(localPath, buffer)

    const publicUrl = `/uploads/project-files/${fileName}`
    return NextResponse.json({ 
      success: true, 
      url: publicUrl, 
      storageType: 'local',
      fileName: file.name 
    })

  } catch (err: any) {
    console.error('[API Project File Upload] Exception:', err)
    return NextResponse.json({ error: err?.message || 'An unexpected error occurred' }, { status: 500 })
  }
}
