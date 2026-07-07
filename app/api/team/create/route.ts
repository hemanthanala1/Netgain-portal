import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Missing session token' }, { status: 401 })
    }

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

    // Validate request user from token
    const { data: { user: requester }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !requester) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session token' }, { status: 401 })
    }

    // Check requester permissions (must be Founder or Admin role, or have team:create/team:manage/all permission)
    const { data: requesterProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', requester.id)
      .maybeSingle()

    const { data: teamProfile } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('email', requester.email || '')
      .maybeSingle()

    const requesterRole = requesterProfile?.role || teamProfile?.role || 'Employee'

    if (requesterRole !== 'Founder' && requesterRole !== 'Admin') {
      const { data: customRole } = await supabaseAdmin
        .from('custom_roles')
        .select('permissions')
        .eq('name', requesterRole)
        .maybeSingle()

      const permissions = customRole?.permissions || []
      const hasTeamCreate = permissions.includes('all') || permissions.includes('team') || permissions.includes('team:create') || permissions.includes('team:manage')
      
      if (!hasTeamCreate) {
        return NextResponse.json({ error: 'Forbidden: Insufficient permissions to create team members' }, { status: 403 })
      }
    }

    // 1. Create the user in Supabase Auth
    const { data: authUser, error: dbAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: password || 'TempPass123!', // fallback password if not provided
      email_confirm: true, // skip confirmation link, auto-verifying the account
      user_metadata: { name, role }
    })

    if (dbAuthError) {
      console.error('[API Team Create] Auth creation failed:', dbAuthError)
      return NextResponse.json({ error: dbAuthError.message }, { status: 400 })
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
