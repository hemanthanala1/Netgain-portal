import React, { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Input } from './input'
import { Badge } from './badge'
import { Label } from './label'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from './dropdown-menu'
import { Search, Download, SlidersHorizontal, ChevronDown, ChevronUp, ChevronsUpDown, EyeOff, CheckSquare, Square, X, Calendar, Bookmark, Pin, Trash2, Clock } from 'lucide-react'
import { EmptyState } from './empty-state'

export interface ColumnDef<T = any> {
  header: string
  accessor: keyof T | string
  cell?: (row: T) => React.ReactNode
  sortable?: boolean
  sticky?: boolean
  className?: string
}

interface FilterOption {
  label: string
  value: string
}

interface FilterDef {
  key: string
  label: string
  options: FilterOption[]
}

export interface BulkAction {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  variant?: 'default' | 'destructive' | 'outline' | 'ghost'
  action: string
}

const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'this_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'This Quarter', value: 'this_quarter' },
  { label: 'This Year', value: 'this_year' },
]

interface DataTableProps<T = any> {
  data: T[]
  columns: ColumnDef<T>[]
  searchPlaceholder?: string
  searchKeys?: (keyof T | string)[]
  exportFileName?: string
  actions?: React.ReactNode
  onRowClick?: (row: T) => void
  initialSort?: { key: string; direction: 'asc' | 'desc' }
  filterDefs?: FilterDef[]
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: any
  emptyAction?: {
    label: string
    onClick: () => void
    icon?: any
  }
  // Bulk selection
  enableBulkSelect?: boolean
  bulkActions?: BulkAction[]
  onBulkAction?: (action: string, selectedRows: T[]) => void
  rowKey?: (row: T) => string
  // Date filter
  dateKey?: string
  // Saved filters key
  savedFiltersKey?: string
  initialSearch?: string
}

export function DataTable<T = any>({
  data,
  columns,
  searchPlaceholder = "Search...",
  searchKeys,
  exportFileName = "export",
  actions,
  onRowClick,
  initialSort,
  filterDefs = [],
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
  enableBulkSelect = false,
  bulkActions = [],
  onBulkAction,
  rowKey,
  dateKey,
  savedFiltersKey,
  initialSearch = '',
}: DataTableProps<T>) {
  // States
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(initialSort || null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() =>
    columns.map(c => String(c.accessor))
  )
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [datePreset, setDatePreset] = useState<string>('all')

  // Saved/Pinned/Recent Filters state
  interface SavedFilter {
    name: string
    searchQuery: string
    activeFilters: Record<string, string>
    datePreset: string
    isPinned?: boolean
  }

  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [pinnedFilter, setPinnedFilter] = useState<SavedFilter | null>(null)
  const [recentFilters, setRecentFilters] = useState<Omit<SavedFilter, 'name'>[]>([])
  const [newFilterName, setNewFilterName] = useState('')

  // Load from LocalStorage on mount/key change
  React.useEffect(() => {
    if (!savedFiltersKey) return
    try {
      const saved = localStorage.getItem(`nbos_sf_${savedFiltersKey}`)
      if (saved) {
        const parsed = JSON.parse(saved) as SavedFilter[]
        setSavedFilters(parsed)
        const pinned = parsed.find(f => f.isPinned)
        if (pinned) {
          setPinnedFilter(pinned)
          setSearchQuery(pinned.searchQuery)
          setActiveFilters(pinned.activeFilters)
          setDatePreset(pinned.datePreset)
        }
      }
      
      const recents = localStorage.getItem(`nbos_rf_${savedFiltersKey}`)
      if (recents) {
        setRecentFilters(JSON.parse(recents))
      }
    } catch (e) {
      console.error(e)
    }
  }, [savedFiltersKey])

  // Save to LocalStorage helper
  const persistSavedFilters = (filters: SavedFilter[]) => {
    if (!savedFiltersKey) return
    localStorage.setItem(`nbos_sf_${savedFiltersKey}`, JSON.stringify(filters))
    setSavedFilters(filters)
    setPinnedFilter(filters.find(f => f.isPinned) || null)
  }

  // Save current as named filter
  const handleSaveCurrentFilter = (name: string) => {
    if (!name.trim()) return
    const newFilter: SavedFilter = {
      name: name.trim(),
      searchQuery,
      activeFilters,
      datePreset
    }
    const updated = [...savedFilters.filter(f => f.name !== name.trim()), newFilter]
    persistSavedFilters(updated)
    setNewFilterName('')
  }

  // Pin a filter
  const handlePinFilter = (name: string) => {
    const updated = savedFilters.map(f => ({
      ...f,
      isPinned: f.name === name ? !f.isPinned : false
    }))
    persistSavedFilters(updated)
  }

  // Delete a saved filter
  const handleDeleteFilter = (name: string) => {
    const updated = savedFilters.filter(f => f.name !== name)
    persistSavedFilters(updated)
  }

  // Apply a saved filter
  const applySavedFilter = (filter: Omit<SavedFilter, 'name'>) => {
    setSearchQuery(filter.searchQuery)
    setActiveFilters(filter.activeFilters)
    setDatePreset(filter.datePreset)
    setCurrentPage(1)
    setSelectedKeys(new Set())
  }

  // Track recent filter changes (debounce or on filter change)
  React.useEffect(() => {
    if (!savedFiltersKey) return
    // Only track if something is actually filtered
    const hasActiveFilters = Object.values(activeFilters).some(v => v && v !== 'all')
    if (!searchQuery && !hasActiveFilters && datePreset === 'all') return

    const timer = setTimeout(() => {
      const current = { searchQuery, activeFilters, datePreset }
      setRecentFilters(prev => {
        // Remove duplicate
        const filtered = prev.filter(p => 
          JSON.stringify(p.activeFilters) !== JSON.stringify(activeFilters) ||
          p.searchQuery !== searchQuery ||
          p.datePreset !== datePreset
        )
        const updated = [current, ...filtered].slice(0, 3)
        localStorage.setItem(`nbos_rf_${savedFiltersKey}`, JSON.stringify(updated))
        return updated
      })
    }, 1000)

    return () => clearTimeout(timer)
  }, [searchQuery, activeFilters, datePreset, savedFiltersKey])

  React.useEffect(() => {
    setSearchQuery(initialSearch)
  }, [initialSearch])

  const getKey = useCallback((row: T, idx: number): string => {
    if (rowKey) return rowKey(row)
    return String((row as any).id || (row as any).key || idx)
  }, [rowKey])

  // Reset page when search or filters change
  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    setCurrentPage(1)
    setSelectedKeys(new Set())
  }

  const handleFilterChange = (key: string, val: string) => {
    setActiveFilters(prev => ({ ...prev, [key]: val }))
    setCurrentPage(1)
    setSelectedKeys(new Set())
  }

  const clearFilters = () => {
    setSearchQuery('')
    setActiveFilters({})
    setDatePreset('all')
    setCurrentPage(1)
    setSelectedKeys(new Set())
  }

  const handleSort = (key: string, sortable?: boolean) => {
    if (!sortable) return
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  // Date preset filter
  const matchesDatePreset = useCallback((row: T): boolean => {
    if (!dateKey || datePreset === 'all') return true
    const val = (row as any)[dateKey]
    if (!val) return true
    const d = new Date(val)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (datePreset === 'today') {
      return d >= today
    } else if (datePreset === 'yesterday') {
      const yesterday = new Date(today)
      yesterday.setDate(today.getDate() - 1)
      return d >= yesterday && d < today
    } else if (datePreset === 'this_week') {
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay())
      return d >= weekStart
    } else if (datePreset === 'this_month') {
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
    } else if (datePreset === 'this_quarter') {
      const quarter = Math.floor(today.getMonth() / 3)
      const qStart = new Date(today.getFullYear(), quarter * 3, 1)
      return d >= qStart
    } else if (datePreset === 'this_year') {
      return d.getFullYear() === today.getFullYear()
    }
    return true
  }, [dateKey, datePreset])

  // Filtered data
  const filteredData = useMemo(() => {
    return data.filter(row => {
      if (searchQuery.trim() && searchKeys && searchKeys.length > 0) {
        const query = searchQuery.toLowerCase().trim()
        const matchesSearch = searchKeys.some(key => {
          const val = row[key as keyof T]
          return val ? String(val).toLowerCase().includes(query) : false
        })
        if (!matchesSearch) return false
      }

      for (const [filterKey, filterValue] of Object.entries(activeFilters)) {
        if (filterValue && filterValue !== 'all') {
          const rowValue = row[filterKey as keyof T]
          if (rowValue === undefined || String(rowValue).toLowerCase() !== filterValue.toLowerCase()) {
            return false
          }
        }
      }

      if (!matchesDatePreset(row)) return false

      return true
    })
  }, [data, searchQuery, searchKeys, activeFilters, matchesDatePreset])

  // Sorted data
  const sortedData = useMemo(() => {
    const sorted = [...filteredData]
    if (sortConfig) {
      const { key, direction } = sortConfig
      sorted.sort((a: any, b: any) => {
        const valA = a[key]
        const valB = b[key]
        if (valA === undefined || valA === null) return direction === 'asc' ? 1 : -1
        if (valB === undefined || valB === null) return direction === 'asc' ? -1 : 1
        if (typeof valA === 'number' && typeof valB === 'number') {
          return direction === 'asc' ? valA - valB : valB - valA
        }
        const strA = String(valA).toLowerCase()
        const strB = String(valB).toLowerCase()
        return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA)
      })
    }
    return sorted
  }, [filteredData, sortConfig])

  // Paginated data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, currentPage, pageSize])

  const totalPages = Math.ceil(sortedData.length / pageSize)

  // Bulk selection helpers
  const pageKeys = useMemo(() => paginatedData.map((r, i) => getKey(r, i)), [paginatedData, getKey])
  const allPageSelected = pageKeys.length > 0 && pageKeys.every(k => selectedKeys.has(k))
  const somePageSelected = pageKeys.some(k => selectedKeys.has(k))
  const selectedRows = useMemo(() =>
    sortedData.filter((r, i) => selectedKeys.has(getKey(r, i))),
    [sortedData, selectedKeys, getKey]
  )

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedKeys(prev => {
        const next = new Set(prev)
        pageKeys.forEach(k => next.delete(k))
        return next
      })
    } else {
      setSelectedKeys(prev => {
        const next = new Set(prev)
        pageKeys.forEach(k => next.add(k))
        return next
      })
    }
  }

  const toggleRow = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Active filter chips
  const activeFilterChips = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = []
    if (searchQuery) chips.push({ label: `Search: "${searchQuery}"`, onRemove: () => handleSearchChange('') })
    if (datePreset !== 'all') {
      const preset = DATE_PRESETS.find(p => p.value === datePreset)
      if (preset) chips.push({ label: preset.label, onRemove: () => setDatePreset('all') })
    }
    for (const [key, val] of Object.entries(activeFilters)) {
      if (val && val !== 'all') {
        const def = filterDefs.find(f => f.key === key)
        const opt = def?.options.find(o => o.value === val)
        if (def && opt) {
          chips.push({
            label: `${def.label}: ${opt.label}`,
            onRemove: () => handleFilterChange(key, 'all')
          })
        }
      }
    }
    return chips
  }, [searchQuery, datePreset, activeFilters, filterDefs])

  // Export CSV
  const handleExportCSV = () => {
    const headers = columns
      .filter(c => visibleColumns.includes(String(c.accessor)))
      .map(c => c.header)
      .join(',')

    const exportRows = selectedKeys.size > 0 ? selectedRows : sortedData
    const rows = exportRows.map(row =>
      columns
        .filter(c => visibleColumns.includes(String(c.accessor)))
        .map(c => {
          const val = row[c.accessor as keyof T]
          const str = val ? String(val).replace(/"/g, '""') : ''
          return `"${str}"`
        })
        .join(',')
    )

    const csvContent = [headers, ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `${exportFileName}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const hasActiveFilters = activeFilterChips.length > 0

  return (
    <div className="space-y-3">
      {/* Bulk Actions Bar */}
      {enableBulkSelect && selectedKeys.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-gold/10 border border-gold/30 rounded-xl animate-in slide-in-from-top-2 duration-200">
          <span className="text-xs font-semibold text-gold">
            {selectedKeys.size} {selectedKeys.size === 1 ? 'record' : 'records'} selected
          </span>
          <div className="flex items-center gap-2 ml-2">
            {bulkActions.map(ba => {
              const Icon = ba.icon
              return (
                <Button
                  key={ba.action}
                  variant={ba.variant || 'outline'}
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => onBulkAction?.(ba.action, selectedRows)}
                  aria-label={ba.label}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {ba.label}
                </Button>
              )
            })}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground ml-2"
              onClick={() => setSelectedKeys(new Set())}
              aria-label="Clear selection"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-muted/30 p-3 rounded-xl border border-border/50">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {searchKeys && searchKeys.length > 0 && (
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 bg-background/50 border-border/60 text-xs h-9 focus-visible:ring-gold"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                aria-label={searchPlaceholder}
              />
            </div>
          )}

          {savedFiltersKey && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={cn(
                    "h-9 border-border/60 bg-background/30 text-xs gap-1.5 font-normal",
                    (pinnedFilter || searchQuery || Object.values(activeFilters).some(v => v && v !== 'all') || datePreset !== 'all') && "border-gold/40 text-gold"
                  )}
                  aria-label="Saved filters"
                >
                  <Bookmark className="h-3.5 w-3.5 text-gold" />
                  {pinnedFilter ? `Filter: ${pinnedFilter.name}` : 'Saved Filters'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 border-border bg-popover text-popover-foreground">
                <DropdownMenuLabel className="text-xs font-semibold text-[#D4AF37]">Saved Filters</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {savedFilters.length === 0 ? (
                  <div className="py-2 px-2.5 text-xs text-muted-foreground italic text-center">No saved filters yet</div>
                ) : (
                  savedFilters.map(f => (
                    <div key={f.name} className="flex items-center justify-between px-2 py-1 hover:bg-gold/5 rounded transition-colors" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => applySavedFilter(f)}
                        className="text-xs text-left truncate flex-1 text-foreground hover:text-gold"
                      >
                        {f.name}
                      </button>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handlePinFilter(f.name)}
                          title={f.isPinned ? "Unpin filter" : "Pin as default"}
                          className={cn("text-muted-foreground hover:text-gold p-1 rounded", f.isPinned && "text-gold")}
                        >
                          <Pin className="h-3 w-3" />
                        </button>
                        <button 
                          onClick={() => handleDeleteFilter(f.name)}
                          title="Delete saved filter"
                          className="text-muted-foreground hover:text-red-400 p-1 rounded"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}

                {recentFilters.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Recents</DropdownMenuLabel>
                    {recentFilters.map((rf, idx) => (
                      <div key={idx} className="px-2 py-1" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => applySavedFilter(rf)}
                          className="text-xs text-left truncate w-full text-muted-foreground hover:text-gold"
                        >
                          Search: "{rf.searchQuery || 'None'}", Date: {rf.datePreset}
                        </button>
                      </div>
                    ))}
                  </>
                )}

                <DropdownMenuSeparator />
                <div className="p-2 flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
                  <Label className="text-[10px] text-muted-foreground">Save Current Setup</Label>
                  <div className="flex gap-1">
                    <Input 
                      placeholder="Filter name..." 
                      value={newFilterName} 
                      onChange={e => setNewFilterName(e.target.value)}
                      className="h-7 text-xs bg-background/50 border-border text-slate-200 flex-1"
                    />
                    <Button 
                      size="sm" 
                      variant="gold" 
                      className="h-7 px-2 text-[10px]" 
                      onClick={() => handleSaveCurrentFilter(newFilterName)}
                      disabled={!newFilterName.trim()}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Dropdown filters */}
          {filterDefs.map(def => (
            <DropdownMenu key={def.key}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 border-border/60 bg-background/30 text-xs gap-1.5 font-normal",
                    activeFilters[def.key] && activeFilters[def.key] !== 'all' && "border-gold/40 text-gold"
                  )}
                >
                  <SlidersHorizontal className="h-3 w-3 text-gold" />
                  {def.label}: {def.options.find(o => o.value === (activeFilters[def.key] || 'all'))?.label || 'All'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="border-border">
                <DropdownMenuLabel className="text-xs font-semibold text-[#D4AF37]">{def.label}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={!activeFilters[def.key] || activeFilters[def.key] === 'all'}
                  onCheckedChange={() => handleFilterChange(def.key, 'all')}
                  className="text-xs"
                >
                  All
                </DropdownMenuCheckboxItem>
                {def.options.map(opt => (
                  <DropdownMenuCheckboxItem
                    key={opt.value}
                    checked={activeFilters[def.key] === opt.value}
                    onCheckedChange={() => handleFilterChange(def.key, opt.value)}
                    className="text-xs"
                  >
                    {opt.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}

          {/* Date preset filter */}
          {dateKey && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 border-border/60 bg-background/30 text-xs gap-1.5 font-normal",
                    datePreset !== 'all' && "border-gold/40 text-gold"
                  )}
                >
                  <Calendar className="h-3 w-3 text-gold" />
                  {datePreset === 'all' ? 'All Time' : DATE_PRESETS.find(p => p.value === datePreset)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="border-border">
                <DropdownMenuLabel className="text-xs font-semibold text-[#D4AF37]">Date Range</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={datePreset === 'all'} onCheckedChange={() => setDatePreset('all')} className="text-xs">
                  All Time
                </DropdownMenuCheckboxItem>
                {DATE_PRESETS.map(p => (
                  <DropdownMenuCheckboxItem
                    key={p.value}
                    checked={datePreset === p.value}
                    onCheckedChange={() => setDatePreset(p.value)}
                    className="text-xs"
                  >
                    {p.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={clearFilters}
              aria-label="Reset all filters"
            >
              <X className="h-3 w-3" />
              Reset
            </Button>
          )}
        </div>

        {/* Right side: Columns + Export + custom actions */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 border-border/60 bg-background/30 text-xs gap-1.5" aria-label="Toggle columns">
                <EyeOff className="h-3.5 w-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 border-border">
              <DropdownMenuLabel className="text-xs font-semibold text-[#D4AF37]">Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map(c => (
                <DropdownMenuCheckboxItem
                  key={String(c.accessor)}
                  checked={visibleColumns.includes(String(c.accessor))}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setVisibleColumns([...visibleColumns, String(c.accessor)])
                    } else {
                      if (visibleColumns.length > 1) {
                        setVisibleColumns(visibleColumns.filter(vc => vc !== String(c.accessor)))
                      }
                    }
                  }}
                  className="text-xs"
                >
                  {c.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            className="h-9 border-border/60 bg-background/30 text-xs gap-1.5"
            onClick={handleExportCSV}
            aria-label={selectedKeys.size > 0 ? `Export ${selectedKeys.size} selected records` : 'Export all as CSV'}
          >
            <Download className="h-3.5 w-3.5 text-gold" />
            {selectedKeys.size > 0 ? `Export (${selectedKeys.size})` : 'Export CSV'}
          </Button>

          {actions}
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {activeFilterChips.map((chip, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[10px] bg-gold/10 text-gold border border-gold/25 rounded-full px-2.5 py-1 font-medium"
            >
              {chip.label}
              <button
                onClick={chip.onRemove}
                className="ml-0.5 hover:text-foreground transition-colors"
                aria-label={`Remove filter: ${chip.label}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <span className="text-[10px] text-muted-foreground/60 self-center">
            {filteredData.length} of {data.length} records
          </span>
        </div>
      )}

      {/* Main Table */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[700px]" role="grid">
            <thead>
              <tr className="border-b border-border/80 bg-muted/20">
                {/* Bulk select header checkbox */}
                {enableBulkSelect && (
                  <th className="py-3 px-3 w-10">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center justify-center text-muted-foreground hover:text-gold transition-colors"
                      aria-label={allPageSelected ? 'Deselect all on page' : 'Select all on page'}
                    >
                      {allPageSelected
                        ? <CheckSquare className="h-4 w-4 text-gold" />
                        : somePageSelected
                          ? <CheckSquare className="h-4 w-4 text-gold/50" />
                          : <Square className="h-4 w-4" />
                      }
                    </button>
                  </th>
                )}

                {columns
                  .filter(c => visibleColumns.includes(String(c.accessor)))
                  .map((col, idx) => {
                    const isSorted = sortConfig?.key === String(col.accessor)
                    const isSortAsc = sortConfig?.direction === 'asc'
                    return (
                      <th
                        key={idx}
                        onClick={() => handleSort(String(col.accessor), col.sortable)}
                        className={cn(
                          "py-3.5 px-4 text-left text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider select-none",
                          col.sortable && "cursor-pointer hover:text-foreground",
                          col.sticky && "sticky left-0 bg-card shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)] z-10",
                          col.className
                        )}
                        scope="col"
                      >
                        <div className="flex items-center gap-1">
                          {col.header}
                          {col.sortable && (
                            <span className="text-muted-foreground/60">
                              {isSorted ? (
                                isSortAsc ? <ChevronUp className="h-3.5 w-3.5 text-gold" /> : <ChevronDown className="h-3.5 w-3.5 text-gold" />
                              ) : (
                                <ChevronsUpDown className="h-3.5 w-3.5" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    )
                  })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (enableBulkSelect ? 1 : 0)} className="p-8">
                    <EmptyState
                      icon={emptyIcon || Search}
                      title={emptyTitle || "No results found"}
                      description={emptyDescription || "Try adjusting your search query or filters."}
                      action={emptyAction}
                    />
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, rIdx) => {
                  const key = getKey(row, (currentPage - 1) * pageSize + rIdx)
                  const isSelected = selectedKeys.has(key)
                  return (
                    <tr
                      key={rIdx}
                      className={cn(
                        "border-b border-border/20 hover:bg-muted/15 transition-colors",
                        onRowClick && "cursor-pointer",
                        isSelected && "bg-gold/5 border-gold/20"
                      )}
                    >
                      {enableBulkSelect && (
                        <td className="py-3.5 px-3" onClick={e => { e.stopPropagation(); toggleRow(key) }}>
                          <button
                            className="flex items-center justify-center text-muted-foreground hover:text-gold transition-colors"
                            aria-label={isSelected ? 'Deselect row' : 'Select row'}
                          >
                            {isSelected
                              ? <CheckSquare className="h-4 w-4 text-gold" />
                              : <Square className="h-4 w-4" />
                            }
                          </button>
                        </td>
                      )}
                      {columns
                        .filter(c => visibleColumns.includes(String(c.accessor)))
                        .map((col, cIdx) => {
                          const val = row[col.accessor as keyof T]
                          return (
                            <td
                              key={cIdx}
                              onClick={() => onRowClick?.(row)}
                              className={cn(
                                "py-3.5 px-4 text-xs font-normal text-foreground",
                                col.sticky && "sticky left-0 bg-background sm:bg-background group-hover:bg-muted/15 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)] z-10",
                                col.className
                              )}
                            >
                              {col.cell ? col.cell(row) : (val !== undefined && val !== null ? String(val) : '—')}
                            </td>
                          )
                        })}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border/60 bg-muted/5 text-xs text-muted-foreground">
            <div>
              Showing <span className="font-semibold text-slate-200">{(currentPage - 1) * pageSize + 1}</span> to{" "}
              <span className="font-semibold text-slate-200">
                {Math.min(currentPage * pageSize, sortedData.length)}
              </span>{" "}
              of <span className="font-semibold text-slate-200">{sortedData.length}</span> entries
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs border-border/60 bg-background/25"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                aria-label="Previous page"
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                  const pNum = i + 1
                  return (
                    <Button
                      key={pNum}
                      variant={currentPage === pNum ? "gold" : "outline"}
                      size="sm"
                      className={cn(
                        "h-8 w-8 text-xs border-border/60",
                        currentPage === pNum ? "text-black" : "bg-background/25"
                      )}
                      onClick={() => setCurrentPage(pNum)}
                      aria-label={`Page ${pNum}`}
                      aria-current={currentPage === pNum ? 'page' : undefined}
                    >
                      {pNum}
                    </Button>
                  )
                })}
                {totalPages > 7 && <span className="text-muted-foreground px-1">…</span>}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs border-border/60 bg-background/25"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                aria-label="Next page"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
