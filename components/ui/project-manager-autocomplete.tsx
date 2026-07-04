'use client'

import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from './input'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Search, Loader2, User, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ProjectManagerOption {
  id: string
  name: string
  email: string
  role: string
  phone?: string
  source?: 'profiles' | 'team_members'
}

interface ProjectManagerAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (manager: ProjectManagerOption) => void
  placeholder?: string
  className?: string
}

export function ProjectManagerAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Search project managers...',
  className
}: ProjectManagerAutocompleteProps) {
  const [managers, setManagers] = useState<ProjectManagerOption[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadManagers() {
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const [{ data: profilesData }, { data: teamData }] = await Promise.all([
            supabase.from('profiles').select('id, full_name, email, role, settings, updated_at').order('updated_at', { ascending: false }),
            supabase.from('team_members').select('id, name, email, phone, role, status, joined, projects, avatar_url').order('created_at', { ascending: true })
          ])

          const merged: ProjectManagerOption[] = []
          const seen = new Set<string>()

          if (profilesData) {
            profilesData.forEach((profile: any) => {
              const role = profile.role || 'Employee'
              if (role !== 'Project Manager') return

              seen.add(profile.id)
              merged.push({
                id: profile.id,
                name: profile.full_name || profile.email?.split('@')[0] || 'Unknown',
                email: profile.email || '',
                role,
                phone: profile.settings?.phone || '',
                source: 'profiles'
              })
            })
          }

          if (teamData) {
            teamData.forEach((member: any) => {
              const role = member.role || 'Employee'
              if (role !== 'Project Manager') return
              if (seen.has(member.id) || merged.some(item => item.email === member.email)) return

              merged.push({
                id: member.id,
                name: member.name || member.email?.split('@')[0] || 'Unknown',
                email: member.email || '',
                role,
                phone: member.phone || '',
                source: 'team_members'
              })
            })
          }

          setManagers(merged.sort((a, b) => a.name.localeCompare(b.name)))
        } catch (error) {
          console.error('Error loading project managers:', error)
        }
      }
      setLoading(false)
    }

    loadManagers()
  }, [])

  const filteredManagers = useMemo(() => {
    if (!value.trim()) return managers

    const query = value.toLowerCase()
    return managers.filter((manager) => {
      return (
        manager.name.toLowerCase().includes(query) ||
        manager.email.toLowerCase().includes(query)
      )
    })
  }, [managers, value])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredManagers])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectManager = (manager: ProjectManagerOption) => {
    onSelect(manager)
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev + 1 < filteredManagers.length ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredManagers[highlightedIndex]) {
          handleSelectManager(filteredManagers[highlightedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        break
      case 'Tab':
        setIsOpen(false)
        break
    }
  }

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <div className="relative flex items-center">
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pr-8"
        />
        <div className="absolute right-2.5 text-muted-foreground pointer-events-none">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gold" />
          ) : (
            <Search className="h-4 w-4 opacity-50" />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 rounded-lg border border-border bg-card text-card-foreground shadow-lg max-h-60 overflow-y-auto animate-in fade-in-50 slide-in-from-top-1 duration-150">
          {filteredManagers.length === 0 ? (
            <div className="py-4 px-3 text-sm text-center text-muted-foreground">
              No project managers found
            </div>
          ) : (
            <div className="py-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-gold uppercase tracking-wider border-b border-border/50 mb-1">
                Project Manager Suggestions
              </div>
              {filteredManagers.map((manager, index) => {
                const isHighlighted = index === highlightedIndex
                return (
                  <div
                    key={manager.id}
                    className={cn(
                      'px-3 py-2 cursor-pointer flex flex-col transition-colors',
                      isHighlighted
                        ? 'bg-gold/10 text-foreground border-l-2 border-gold'
                        : 'hover:bg-muted/40 text-muted-foreground hover:text-foreground border-l-2 border-transparent'
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelectManager(manager)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm text-foreground flex items-center gap-1.5 min-w-0">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{manager.name}</span>
                      </span>
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase tracking-wide shrink-0">
                        {manager.role}
                      </span>
                    </div>
                    {manager.email && (
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 pl-5 truncate">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{manager.email}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}