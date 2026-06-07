import { supabase } from '@/lib/supabase'

/**
 * Fetch founder profile (user with role = 'Founder')
 * Returns founder details from profiles table
 */
export async function fetchFounderProfile() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'Founder')
      .single()

    if (error) {
      console.error('Error fetching founder profile:', error.message)
      return null
    }

    return {
      name: data?.full_name || '',
      email: data?.email || '',
      phone: data?.user_metadata?.phone || '',
      designation: data?.user_metadata?.designation || 'Founder & CEO'
    }
  } catch (err) {
    console.error('Founder fetch error:', err)
    return null
  }
}

/**
 * Subscribe to real-time founder profile updates
 * Useful for forms that need to auto-update when founder profile changes
 */
export function subscribeToFounderUpdates(callback: (founder: any) => void) {
  const subscription = supabase
    .channel('founder-updates')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: "role=eq.Founder"
      },
      async (payload) => {
        const founder = await fetchFounderProfile()
        if (founder) {
          callback(founder)
        }
      }
    )
    .subscribe()

  return subscription
}
