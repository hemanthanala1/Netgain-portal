import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/client', '/sign']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check for auth session cookie
  const sessionCookie =
    request.cookies.get('nbos-session') ||
    request.cookies.get('sb-access-token') ||
    request.cookies.get('sb-refresh-token')

  // In demo mode (no Supabase configured), allow all access
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const isSupabaseConfigured = supabaseUrl && supabaseUrl !== 'your_supabase_project_url'

  if (isSupabaseConfigured && !sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
