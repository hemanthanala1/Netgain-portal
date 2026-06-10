'use client'

import * as React from 'react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { Input } from './input'
import { useCRMClients, CRMClient } from '@/hooks/use-crm-clients'
import { Search, Loader2, Building2, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClientAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (client: CRMClient) => void
  placeholder?: string
  className?: string
}

export function ClientAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Search or enter client...',
  className
}: ClientAutocompleteProps) {
  const { clients, loading } = useCRMClients()
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter clients based on user typing
  const filteredClients = useMemo(() => {
    if (!value.trim()) return clients

    const query = value.toLowerCase()
    return clients.filter((client) => {
      return (
        client.name.toLowerCase().includes(query) ||
        (client.business && client.business.toLowerCase().includes(query)) ||
        (client.email && client.email.toLowerCase().includes(query))
      )
    })
  }, [clients, value])

  // Reset highlighted index when filtering results
  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredClients])

  // Handle clicking outside to close the dropdown
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

  // Keyboard navigation handler
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
          prev + 1 < filteredClients.length ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredClients[highlightedIndex]) {
          const selected = filteredClients[highlightedIndex]
          onSelect(selected)
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
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
    if (!isOpen) setIsOpen(true)
  }

  const handleSelectClient = (client: CRMClient) => {
    onSelect(client)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <div className="relative flex items-center">
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
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
          {filteredClients.length === 0 ? (
            <div className="py-4 px-3 text-sm text-center text-muted-foreground">
              No matching CRM clients found
            </div>
          ) : (
            <div className="py-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-gold uppercase tracking-wider border-b border-border/50 mb-1">
                CRM Client Suggestions
              </div>
              {filteredClients.map((client, index) => {
                const isHighlighted = index === highlightedIndex
                return (
                  <div
                    key={client.id}
                    className={cn(
                      'px-3 py-2 cursor-pointer flex flex-col transition-colors',
                      isHighlighted
                        ? 'bg-gold/10 text-foreground border-l-2 border-gold'
                        : 'hover:bg-muted/40 text-muted-foreground hover:text-foreground border-l-2 border-transparent'
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelectClient(client)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {client.name}
                      </span>
                      {client.type && (
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase tracking-wide">
                          {client.type}
                        </span>
                      )}
                    </div>
                    {client.business && (
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 pl-5">
                        <Building2 className="h-3 w-3" />
                        {client.business}
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
