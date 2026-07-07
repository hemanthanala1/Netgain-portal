'use client'

import * as React from 'react'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from './input'
import { Search, Loader2, X, Clock, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchResultItem {
  id: string
  title: string
  subtitle: string
  link: string
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <span>{text}</span>
  const parts = text.split(new RegExp(`(${query})`, 'gi'))
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-primary/20 text-primary px-0.5 rounded font-semibold">{part}</mark>
        ) : (
          part
        )
      )}
    </span>
  )
}

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Record<string, SearchResultItem[]>>({})
  const [isOpen, setIsOpen] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Load recent searches
  useEffect(() => {
    const saved = localStorage.getItem('nbos_recent_searches')
    if (saved) {
      try {
        setRecent(JSON.parse(saved))
      } catch (e) {
        console.error(e)
      }
    }
  }, [])

  // Backdrop click listener to close popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Execute instant API search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({})
      setLoading(false)
      return
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        if (data.success && data.results) {
          setResults(data.results)
        } else {
          setResults({})
        }
      } catch (err) {
        console.error(err)
        setResults({})
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [query])

  // Flattened results for keyboard navigation index calculation
  const flattenedItems = React.useMemo(() => {
    const list: SearchResultItem[] = []
    Object.values(results).forEach(group => {
      list.push(...group)
    })
    return list
  }, [results])

  const handleSelect = (item: SearchResultItem) => {
    // Add query to recent searches
    if (query.trim()) {
      const nextRecent = [query.trim(), ...recent.filter(r => r !== query.trim())].slice(0, 5)
      setRecent(nextRecent)
      localStorage.setItem('nbos_recent_searches', JSON.stringify(nextRecent))
    }
    setIsOpen(false)
    setQuery('')
    if (item.link.startsWith('http')) {
      window.open(item.link, '_blank')
    } else {
      router.push(item.link)
    }
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < flattenedItems.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < flattenedItems.length) {
        handleSelect(flattenedItems[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  const handleRecentClick = (text: string) => {
    setQuery(text)
    inputRef.current?.focus()
  }

  const clearRecent = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRecent([])
    localStorage.removeItem('nbos_recent_searches')
  }

  const clearSearch = () => {
    setQuery('')
    setResults({})
    setSelectedIndex(-1)
  }

  const hasResults = Object.keys(results).length > 0

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); setSelectedIndex(-1); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search ERP (clients, invoices, projects, files)..."
          className="pl-9 pr-8 bg-card/60 border-border text-xs focus-visible:ring-primary/40 h-8 w-full"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : query ? (
          <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 max-h-[380px] overflow-y-auto bg-card border border-border shadow-2xl rounded-xl z-50 p-2 text-xs">
          
          {/* Recent Searches */}
          {!query && recent.length > 0 && (
            <div className="space-y-1.5 p-1">
              <div className="flex justify-between items-center px-2 py-1 text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                <span>Recent Searches</span>
                <button onClick={clearRecent} className="hover:text-foreground font-semibold">Clear All</button>
              </div>
              <div className="space-y-0.5">
                {recent.map((text, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleRecentClick(text)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-muted-foreground hover:bg-muted/30 text-left"
                  >
                    <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span>{text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!query && recent.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              Type at least 2 characters to search across Netgain operating files...
            </div>
          )}

          {/* Grouped Search Results */}
          {query.trim().length >= 2 && !loading && (
            <>
              {hasResults ? (
                <div className="space-y-3.5">
                  {Object.entries(results).map(([category, items]) => (
                    <div key={category} className="space-y-1">
                      <div className="px-2 py-0.5 text-[9px] font-bold text-gold uppercase tracking-wider bg-gold/5 rounded border border-gold/10 inline-block ml-1">
                        {category}
                      </div>
                      <div className="space-y-0.5">
                        {items.map((item, itemIdx) => {
                          // Calculate global index for keyboard focus
                          const globalIdx = flattenedItems.findIndex(x => x.id === item.id)
                          const isSelected = globalIdx === selectedIndex
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleSelect(item)}
                              onMouseEnter={() => setSelectedIndex(globalIdx)}
                              className={cn(
                                "flex flex-col w-full px-2.5 py-1.5 rounded-lg text-left transition-colors",
                                isSelected ? "bg-primary/10 text-foreground border-l-2 border-primary" : "text-muted-foreground hover:bg-muted/20 border-l-2 border-transparent"
                              )}
                            >
                              <span className="font-semibold text-foreground leading-snug">
                                <HighlightText text={item.title} query={query} />
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate mt-0.5">{item.subtitle}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <HelpCircle className="h-8 w-8 text-gold/30 mb-2" />
                  <p className="font-semibold">No matches found</p>
                  <p className="text-[10px] text-muted-foreground/80 mt-1">Refine your query or check spelling</p>
                </div>
              )}
            </>
          )}

          {loading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-gold" />
              <span>Searching operations records...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
