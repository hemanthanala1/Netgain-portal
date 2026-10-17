import { createClient } from '@supabase/supabase-js'

function formatSupabaseUrl(url?: string): string {
  if (!url) return 'https://placeholder-url.supabase.co'
  let clean = url.trim()
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}.supabase.co`
  }
  return clean.replace(/\/rest\/v1\/?$/, '').replace(/\/auth\/v1\/?$/, '').replace(/\/+$/, '')
}

let supabaseUrl = formatSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const isSupabaseConfigured = (): boolean => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!(
    url &&
    url !== 'your_supabase_project_url' &&
    key &&
    key !== 'your_supabase_anon_key'
  )
}
