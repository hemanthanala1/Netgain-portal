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

  const fetchProfile = async (email: string, authId: string) => {
    try {
      // First try to get profile from profiles table (synced with auth.users role)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authId)
        .maybeSingle()

      if (!profileError && profileData) {
        // Found in profiles table — now get team_members data to merge
        const { data: teamData, error: teamError } = await supabase
          .from('team_members')
          .select('*')
          .eq('email', email)
          .maybeSingle()

        if (!teamError && teamData) {
          // Merge: use role from profiles (source of truth), other fields from team_members
          return {
            ...teamData,
            role: profileData.role
          } as UserProfile
        } else {
          // Profile exists but no team_members row — this is the source of truth
          return {
            id: authId,
            name: profileData.full_name || email.split('@')[0],
            email: profileData.email,
            phone: '',
            role: profileData.role || 'Employee',
            status: 'active',
            joined: new Date().toISOString().slice(0, 10),
            projects: 0
          } as UserProfile
        }
      }

      // Fallback: fetch from team_members if profiles doesn't have it
      const { data: teamData, error: teamError } = await supabase
        .from('team_members')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (!teamError && teamData) {
        return teamData as UserProfile
      }

      // If neither profiles nor team_members exist, return null (do not auto-provision)
      console.warn(`No profile found for ${email} — user must be created by founder via Supabase`)
      return null
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
        const profile = await fetchProfile(authUser.email, authUser.id)
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
