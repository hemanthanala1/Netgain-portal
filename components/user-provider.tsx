'use client'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export interface UserProfile {
  id: string
  name: string
  email: string
  phone?: string
  role: string
  status: string
  joined: string
  projects: number
  avatar_url?: string
  settings?: any
  permissions: string[]
}

interface UserContextType {
  user: UserProfile | null
  loading: boolean
  refreshUser: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (email: string, authId: string, authUserMetadata: any) => {
    try {
      // First try to get profile from profiles table (synced with auth.users role)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authId)
        .maybeSingle()

      let userRole = 'Employee'
      let phone = ''
      let settings: any = {}
      let avatar_url = ''
      let name = email.split('@')[0]
      let teamDataMerged: any = null

      if (!profileError && profileData) {
        userRole = profileData.role || 'Employee'
        phone = authUserMetadata?.phone || profileData.settings?.phone || ''
        settings = profileData.settings || {}
        avatar_url = profileData.settings?.avatar_url || authUserMetadata?.avatar_url || ''
        name = profileData.full_name || name

        const { data: teamData } = await supabase
          .from('team_members')
          .select('*')
          .eq('email', email)
          .maybeSingle()
        if (teamData) {
          teamDataMerged = teamData
          phone = phone || teamData.phone || ''
        }
      } else {
        const { data: teamData } = await supabase
          .from('team_members')
          .select('*')
          .eq('email', email)
          .maybeSingle()
        if (teamData) {
          teamDataMerged = teamData
          userRole = teamData.role || 'Employee'
          phone = authUserMetadata?.phone || teamData.phone || ''
        } else {
          return null
        }
      }

      // Fetch custom role permissions
      const { data: roleInfo } = await supabase
        .from('custom_roles')
        .select('permissions')
        .eq('name', userRole)
        .maybeSingle()
      
      const permissions = roleInfo?.permissions || []

      return {
        id: authId,
        name: teamDataMerged?.name || name,
        email,
        phone,
        role: userRole,
        status: 'active',
        joined: teamDataMerged?.joined || new Date().toISOString().slice(0, 10),
        projects: teamDataMerged?.projects || 0,
        settings,
        avatar_url,
        permissions
      } as UserProfile
    } catch (err) {
      console.error('Exception in fetchProfile:', err)
      return null
    }
  }

  const refreshUser = async () => {
    if (!isSupabaseConfigured()) {
      // Supabase is required — no demo/hardcoded users
      console.error('Supabase is not configured. Please set up your environment variables.')
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser?.email) {
        const profile = await fetchProfile(authUser.email, authUser.id, authUser.user_metadata)
        setUser(profile)
      } else {
        setUser(null)
      }
    } catch (err) {
      console.error('Error loading user session:', err)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()

    if (isSupabaseConfigured()) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          refreshUser()
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setLoading(false)
        }
      })

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [])

  return (
    <UserContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
