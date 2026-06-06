import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { name, email, phone, role, password } = await request.json()

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const parsedUrl = supabaseUrl?.includes('//') ? supabaseUrl : `https://${supabaseUrl}.supabase.co`

    if (!parsedUrl || !serviceRoleKey || serviceRoleKey === 'your_supabase_service_role_key') {
      return NextResponse.json({ error: 'Supabase admin client is not configured' }, { status: 500 })
    }

    // Create admin client
    const supabaseAdmin = createClient(parsedUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 1. Create the user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: password || 'TempPass123!', // fallback password if not provided
      email_confirm: true, // skip confirmation link, auto-verifying the account
      user_metadata: { name, role }
    })

    if (authError) {
      console.error('[API Team Create] Auth creation failed:', authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authUser.user) {
      return NextResponse.json({ error: 'Failed to create auth user' }, { status: 500 })
    }

    // 2. Insert into the team_members table using the returned user.id (UUID)
    const newMember = {
      id: authUser.user.id,
      name,
      email,
      phone: phone || '',
      role: role || 'Employee',
      status: 'active',
      joined: new Date().toISOString().slice(0, 10),
      projects: 0
    }

    const { error: dbError } = await supabaseAdmin
      .from('team_members')
      .insert([newMember])

    if (dbError) {
      console.error('[API Team Create] Database insertion failed:', dbError)
      // Attempt clean up of auth user to prevent orphaned auth accounts
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, member: newMember })
  } catch (err: any) {
    console.error('[API Team Create] Exception:', err)
    return NextResponse.json({ error: err?.message || 'An unexpected error occurred' }, { status: 500 })
  }
}
