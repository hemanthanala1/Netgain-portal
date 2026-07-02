'use client'

import * as React from 'react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { Input } from './input'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Search, Loader2, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ServiceItem {
  id: string
  catId: string
  name: string
  pricing: string
  basePrice: number
  priceMin?: number
  priceMax?: number
  quotationPrice?: number
  timeline: string
  status: string
  deliverables: string[]
  exclusions: string[]
}

interface ServiceAutocompleteProps {
  onSelect: (service: ServiceItem) => void
  placeholder?: string
  className?: string
}

export function ServiceAutocomplete({
  onSelect,
  placeholder = 'Search and add service...',
  className
}: ServiceAutocompleteProps) {
  const [value, setValue] = useState('')
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load services
  useEffect(() => {
    async function loadServices() {
      setLoading(true)
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase
            .from('services')
            .select('*')
            .neq('status', 'archived')
            .order('name', { ascending: true })
          
          if (data) {
            const mapped: ServiceItem[] = data.map((s: any) => ({
              id: s.id,
              catId: s.cat_id,
              name: s.name,
              pricing: s.pricing,
              basePrice: Number(s.base_price) || 0,
              priceMin: s.price_min !== null ? Number(s.price_min) : undefined,
              priceMax: s.price_max !== null ? Number(s.price_max) : undefined,
              quotationPrice: s.quotation_price !== null ? Number(s.quotation_price) : undefined,
              timeline: s.timeline || '',
              status: s.status || 'active',
              deliverables: s.deliverables || [],
              exclusions: s.exclusions || []
            }))
            setServices(mapped)
          }
        } catch (err) {
          console.error(err)
        }
      }
      setLoading(false)
    }
    loadServices()
  }, [])

  const filteredServices = useMemo(() => {
    if (!value.trim()) return services

    const query = value.toLowerCase()
    return services.filter((svc) => {
      return svc.name.toLowerCase().includes(query)
    })
  }, [services, value])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredServices])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
        setHighlightedIndex((prev) =>
          prev + 1 < filteredServices.length ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredServices[highlightedIndex]) {
          const selected = filteredServices[highlightedIndex]
          onSelect(selected)
          setValue('')
          setIsOpen(false)
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

  const handleSelectService = (svc: ServiceItem) => {
    onSelect(svc)
    setValue('')
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <div className="relative flex items-center">
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
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
          {filteredServices.length === 0 ? (
            <div className="py-4 px-3 text-sm text-center text-muted-foreground">
              No matching services found
            </div>
          ) : (
            <div className="py-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-gold uppercase tracking-wider border-b border-border/50 mb-1">
                Service Suggestions
              </div>
              {filteredServices.map((svc, index) => {
                const isHighlighted = index === highlightedIndex
                return (
                  <div
                    key={svc.id}
                    className={cn(
                      'px-3 py-2 cursor-pointer flex flex-col transition-colors',
                      isHighlighted
                        ? 'bg-gold/10 text-foreground border-l-2 border-gold'
                        : 'hover:bg-muted/40 text-muted-foreground hover:text-foreground border-l-2 border-transparent'
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelectService(svc)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-foreground flex items-center gap-1.5 text-left">
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {svc.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2 uppercase tracking-wide">
                        {svc.pricing}
                      </span>
                    </div>
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
