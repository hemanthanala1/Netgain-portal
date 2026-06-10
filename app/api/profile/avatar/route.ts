import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const userId = formData.get('userId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const parsedUrl = supabaseUrl?.includes('//') ? supabaseUrl : `https://${supabaseUrl}.supabase.co`

    if (!parsedUrl || !serviceRoleKey || serviceRoleKey === 'your_supabase_service_role_key') {
      return NextResponse.json({ error: 'Supabase admin client is not configured' }, { status: 500 })
    }

    // Create admin client to bypass RLS policies
    const supabaseAdmin = createClient(parsedUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const fileExt = file.name.split('.').pop() || 'png'
    const fileName = `${userId}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`
    const filePath = `${fileName}`

    // Convert file to buffer for upload
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: file.type || 'image/png',
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) {
      console.error('[API Avatar Upload] Storage upload failed:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(filePath)

    return NextResponse.json({ success: true, publicUrl })
  } catch (err: any) {
    console.error('[API Avatar Upload] Exception:', err)
    return NextResponse.json({ error: err?.message || 'An unexpected error occurred' }, { status: 500 })
  }
}
