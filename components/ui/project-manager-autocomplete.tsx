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
  placeholder = 'Search team members & managers...',
  className
}: ProjectManagerAutocompleteProps) {
  const [managers, setManagers] = useState<ProjectManagerOption[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadManagers() {
      setLoading(true)
      const result: ProjectManagerOption[] = []

      if (isSupabaseConfigured()) {
        try {
          // Mirror exactly what the team page does
          const { data: profilesData, error: profilesErr } = await supabase
            .from('profiles')
            .select('id, full_name, email, role, settings, updated_at')
            .order('updated_at', { ascending: false })

          const { data: dbTeam, error: teamErr } = await supabase
            .from('team_members')
            .select('id, name, email, phone, role, hourly_rate, status')
            .order('name', { ascending: true })

          if (profilesErr) console.error('[PM Autocomplete] profiles error:', profilesErr)
          if (teamErr) console.error('[PM Autocomplete] team_members error:', teamErr)

          const seenIds = new Set<string>()

          // Add profiles first (auth-linked users)
          if (profilesData) {
            profilesData.forEach((profile: any) => {
              seenIds.add(profile.id)
              // Find matching team_member for hourly_rate
              const matchingMember = dbTeam
                ? dbTeam.find((m: any) => m.id === profile.id || m.email === profile.email)
                : null
              result.push({
                id: profile.id,
                name: profile.full_name || profile.email?.split('@')[0] || 'Unknown',
                email: profile.email || '',
                role: profile.role || 'Employee',
                phone: matchingMember?.phone || profile.settings?.phone || '',
                source: 'profiles'
              })
            })
          }

          // Add team_members not already in profiles
          if (dbTeam) {
            dbTeam.forEach((member: any) => {
              if (!seenIds.has(member.id)) {
                result.push({
                  id: member.id,
                  name: member.name || member.email?.split('@')[0] || 'Unknown',
                  email: member.email || '',
                  role: member.role || 'Employee',
                  phone: member.phone || '',
                  source: 'team_members'
                })
              }
            })
          }

          console.log('[PM Autocomplete] loaded', result.length, 'members:', result.map(m => m.name))
        } catch (err) {
          console.error('[PM Autocomplete] fetch error:', err)
        }
      }

      setManagers(result.sort((a, b) => a.name.localeCompare(b.name)))
      setLoading(false)
    }

    loadManagers()
  }, [])

  const filteredManagers = useMemo(() => {
    const trimmed = value.trim().toLowerCase()
    if (!trimmed) return managers

    const isExistingManagerName = managers.some(
      m => m.name.toLowerCase() === trimmed || m.email.toLowerCase() === trimmed
    )

    if (isExistingManagerName && !isTyping) {
      return managers
    }

    const matches = managers.filter((manager) => {
      return (
        manager.name.toLowerCase().includes(trimmed) ||
        manager.email.toLowerCase().includes(trimmed) ||
        manager.role.toLowerCase().includes(trimmed)
      )
    })

    return matches.length > 0 ? matches : managers
  }, [managers, value, isTyping])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredManagers])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setIsTyping(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectManager = (manager: ProjectManagerOption) => {
    onSelect(manager)
    setIsOpen(false)
    setIsTyping(false)
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
        setIsTyping(false)
        break
      case 'Tab':
        setIsOpen(false)
        setIsTyping(false)
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
            setIsTyping(true)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => {
            setIsTyping(false)
            setIsOpen(true)
          }}
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
                Team Member & PM Suggestions
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