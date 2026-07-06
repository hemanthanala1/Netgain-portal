import { supabase } from '@/lib/supabase'

export async function logSystemActivity(
  action: string,
  module: 'crm' | 'projects' | 'documents' | 'meetings' | 'finance' | 'support' | 'system',
  recordId?: string | null,
  link?: string | null
) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const email = session?.user?.email || 'System'
    
    await supabase.from('system_activities').insert({
      user_name: email,
      action,
      module,
      record_id: recordId || null,
      link: link || null
    })
  } catch (err) {
    console.error('Failed to log system activity:', err)
  }
}
