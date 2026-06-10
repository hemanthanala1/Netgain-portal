const isBrowser = typeof window !== 'undefined'

// Local in-memory cache fallback to avoid constant JSON parsing
const memoryStore: Record<string, any> = {}

export function getCachedData<T>(key: string): T | null {
  if (memoryStore[key]) {
    return memoryStore[key] as T
  }

  if (!isBrowser) return null

  try {
    const raw = localStorage.getItem(`nbos_cache_${key}`)
    if (raw) {
      const parsed = JSON.parse(raw) as T
      memoryStore[key] = parsed
      return parsed
    }
  } catch (e) {
    console.error(`Failed to read cache key "${key}":`, e)
  }
  return null
}

export function setCachedData<T>(key: string, data: T): void {
  memoryStore[key] = data

  if (!isBrowser) return

  try {
    localStorage.setItem(`nbos_cache_${key}`, JSON.stringify(data))
  } catch (e) {
    console.error(`Failed to write cache key "${key}":`, e)
  }
}

export function invalidateCache(key: string): void {
  delete memoryStore[key]

  if (!isBrowser) return

  try {
    localStorage.removeItem(`nbos_cache_${key}`)
  } catch (e) {
    console.error(`Failed to invalidate cache key "${key}":`, e)
  }
}

export function clearAllCache(): void {
  Object.keys(memoryStore).forEach((k) => delete memoryStore[k])

  if (!isBrowser) return

  try {
    const keys = Object.keys(localStorage)
    keys.forEach((k) => {
      if (k.startsWith('nbos_cache_')) {
        localStorage.removeItem(k)
      }
    })
  } catch (e) {
    console.error('Failed to clear cache:', e)
  }
}
