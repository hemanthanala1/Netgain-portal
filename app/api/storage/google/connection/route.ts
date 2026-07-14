export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleDriveClient } from '@/lib/google-drive'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAdmin = createClient(
  supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}.supabase.co`,
  supabaseServiceKey
)

// Helper to authenticate user from auth token in headers or search params
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

/**
 * GET connection status and storage usage
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: conn, error } = await supabaseAdmin
      .from('google_connections')
      .select('google_email, status, storage_used, storage_total, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!conn) {
      return NextResponse.json({ connected: false })
    }

    // Try refreshing the storage usage live
    let storageUsed = Number(conn.storage_used) || 0
    let storageTotal = Number(conn.storage_total) || 0
    let connectionStatus = conn.status

    try {
      const client = new GoogleDriveClient(user.id)
      const usage = await client.getStorageUsage()
      storageUsed = usage.used
      storageTotal = usage.total
      connectionStatus = 'connected'
    } catch (err: any) {
      console.warn('[Connection API] Failed to refresh storage quota live:', err.message)
      // If refresh fails due to refresh token issue, status is marked error
      if (err.message.includes('refresh') || err.message.includes('consent')) {
        connectionStatus = 'error'
      }
    }

    return NextResponse.json({
      connected: true,
      email: conn.google_email,
      status: connectionStatus,
      storageUsed,
      storageTotal,
      updatedAt: conn.updated_at
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE connection (disconnect)
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticate(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get email before delete for logs
    const { data: conn } = await supabaseAdmin
      .from('google_connections')
      .select('google_email')
      .eq('user_id', user.id)
      .maybeSingle()

    const { error } = await supabaseAdmin
      .from('google_connections')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log the disconnection activity
    try {
      await supabaseAdmin.from('google_activity_logs').insert({
        user_id: user.id,
        user_name: user.email || 'User',
        action: 'disconnected',
        details: `Disconnected Google account: ${conn?.google_email || 'unknown'}`
      })
    } catch (logErr) {
      // non-blocking
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST trigger connection validation and refresh
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = new GoogleDriveClient(user.id)
    // getValidAccessToken forces connection reload and potential token exchange/refresh
    await client.getValidAccessToken()
    const usage = await client.getStorageUsage()

    return NextResponse.json({
      success: true,
      status: 'connected',
      storageUsed: usage.used,
      storageTotal: usage.total
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
