'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export interface CRMClient {
  id: string
  name: string
  business: string
  type: string
  email: string
  phone: string
  status: string
  revenue: number
  lastContact?: string
  city?: string
  gst?: string
  address?: string
  website?: string
}

const mockClients: CRMClient[] = [
  {
    id: 'mock-1',
    name: 'Priya Sharma',
    business: 'FashionHub India',
    type: 'E-Commerce',
    email: 'priya@fashionhub.in',
    phone: '+91 98765 43210',
    status: 'active',
    revenue: 450000,
    city: 'Mumbai',
    gst: '27AABCF1234M1Z2',
    address: '401, Fashion Tower, Bandra West',
    website: 'https://fashionhub.in'
  },
  {
    id: 'mock-2',
    name: 'Aaron Shah',
    business: 'Urban Edge Co.',
    type: 'D2C Brand',
    email: 'aaron@urbanedge.co',
    phone: '+91 91234 56789',
    status: 'active',
    revenue: 320000,
    city: 'Bengaluru',
    gst: '29AABCN5678D1Z4',
    address: 'Suite 102, Tech Park, Indiranagar',
    website: 'https://urbanedge.co'
  },
  {
    id: 'mock-3',
    name: 'Ramesh Kumar',
    business: 'TechCore Solutions',
    type: 'SaaS / Software',
    email: 'ramesh@techcore.com',
    phone: '+91 99887 76655',
    status: 'won',
    revenue: 1200000,
    city: 'Hyderabad',
    gst: '36AABCJ9012K1Z9',
    address: 'Level 2, Cyber Towers, Hitec City',
    website: 'https://techcore.com'
  },
  {
    id: 'mock-4',
    name: 'Sarah Dsouza',
    business: 'Healthify',
    type: 'Healthcare',
    email: 'sarah@healthify.in',
    phone: '+91 98989 89898',
    status: 'new',
    revenue: 0,
    city: 'Delhi',
    gst: '',
    address: '12, Ring Road, Lajpat Nagar',
    website: 'https://healthify.in'
  }
]

export function useCRMClients() {
  const [clients, setClients] = useState<CRMClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<any>(null)

  useEffect(() => {
    let active = true

    async function fetchClients() {
      if (!isSupabaseConfigured()) {
        if (active) {
          setClients(mockClients)
          setLoading(false)
        }
        return
      }

      try {
        setLoading(true)
        const { data, error: dbError } = await supabase
          .from('crm_clients')
          .select('*')
          .order('created_at', { ascending: false })

        if (dbError) {
          throw dbError
        }

        if (active && data) {
          const mapped: CRMClient[] = data.map((c: any) => ({
            id: c.id,
            name: c.name,
            business: c.business || '',
            type: c.type || '',
            email: c.email || '',
            phone: c.phone || '',
            status: c.status || 'new',
            revenue: Number(c.revenue) || 0,
            lastContact: c.last_contact,
            city: c.city || '',
            gst: c.gst || '',
            address: c.address || '',
            website: c.website || ''
          }))
          setClients(mapped)
        }
      } catch (err: any) {
        if (active) {
          setError(err)
          // Fallback to mock data if DB fetch fails
          setClients(mockClients)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    fetchClients()

    // Realtime subscription
    let channel: any = null
    if (isSupabaseConfigured()) {
      const channelId = `crm_clients_updates_${Math.random().toString(36).substring(2, 11)}`
      channel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'crm_clients' },
          (payload: any) => {
            if (!active) return

            const { eventType, new: newRecord, old: oldRecord } = payload

            if (eventType === 'INSERT' && newRecord) {
              const mapped: CRMClient = {
                id: newRecord.id,
                name: newRecord.name,
                business: newRecord.business || '',
                type: newRecord.type || '',
                email: newRecord.email || '',
                phone: newRecord.phone || '',
                status: newRecord.status || 'new',
                revenue: Number(newRecord.revenue) || 0,
                lastContact: newRecord.last_contact,
                city: newRecord.city || '',
                gst: newRecord.gst || '',
                address: newRecord.address || '',
                website: newRecord.website || ''
              }
              setClients((prev) => [mapped, ...prev])
            } else if (eventType === 'UPDATE' && newRecord) {
              const mapped: CRMClient = {
                id: newRecord.id,
                name: newRecord.name,
                business: newRecord.business || '',
                type: newRecord.type || '',
                email: newRecord.email || '',
                phone: newRecord.phone || '',
                status: newRecord.status || 'new',
                revenue: Number(newRecord.revenue) || 0,
                lastContact: newRecord.last_contact,
                city: newRecord.city || '',
                gst: newRecord.gst || '',
                address: newRecord.address || '',
                website: newRecord.website || ''
              }
              setClients((prev) =>
                prev.map((c) => (c.id === mapped.id ? mapped : c))
              )
            } else if (eventType === 'DELETE' && oldRecord) {
              setClients((prev) => prev.filter((c) => c.id !== oldRecord.id))
            }
          }
        )
        .subscribe()
    }

    return () => {
      active = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  return { clients, loading, error }
}
