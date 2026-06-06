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
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }

      if (data) {
        // If the ID in team_members doesn't match the auth UUID, update it to keep it synced
        if (data.id !== authId) {
          await supabase.from('team_members').update({ id: authId }).eq('email', email)
          data.id = authId
        }
        return data as UserProfile
      }

      // If profile does not exist in team_members, auto-provision a Founder profile for the logged in auth user
      const namePrefix = email.split('@')[0]
      const defaultProfile = {
        id: authId,
        name: namePrefix.charAt(0).toUpperCase() + namePrefix.slice(1),
        email: email,
        phone: '',
        role: 'Founder', // Default to Founder so they have full access to Netgain OS
        status: 'active',
        joined: new Date().toISOString().slice(0, 10),
        projects: 0
      }

      const { error: insertErr } = await supabase
        .from('team_members')
        .insert([defaultProfile])

      if (insertErr) {
        console.error('Error auto-provisioning profile:', insertErr)
        return null
      }

      return defaultProfile as UserProfile
    } catch (err) {
      console.error('Exception in fetchProfile:', err)
      return null
    }
  }

  const refreshUser = async () => {
    if (!isSupabaseConfigured()) {
      // Demo Mode Default User
      setUser({
        id: '1',
        name: 'Devon Shah',
        email: 'devon@netgain.studio',
        phone: '9876543210',
        role: 'Founder',
        status: 'active',
        joined: '2021-01-01',
        projects: 12
      })
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
