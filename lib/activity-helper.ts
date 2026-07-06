import { supabase, isSupabaseConfigured } from './supabase'

export async function logSystemActivity(
  userName: string,
  action: string,
  module: string,
  recordId?: string,
  link?: string
) {
  if (!isSupabaseConfigured()) {
    console.log(`[Mock Activity Log] User: ${userName} | Action: ${action} | Module: ${module} | Link: ${link}`)
    return
  }

  try {
    const { error } = await supabase.from('system_activities').insert([{
      user_name: userName || 'System',
      action,
      module,
      record_id: recordId || null,
      link: link || null
    }])
    if (error) {
      console.error('Error writing system activity:', error)
    }
  } catch (err) {
    console.error('Failed to log system activity:', err)
  }
}
