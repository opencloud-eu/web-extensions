import { SearchAggregation, SearchBucket } from './types'

export function formatCount(value: number, language: string): string {
  return new Intl.NumberFormat(language).format(value)
}

export function formatBytes(bytes: number, language: string): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit++
  }
  const digits = value >= 100 || unit === 0 ? 0 : 1
  return `${new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(value)} ${units[unit]}`
}

/** Sorts "YYYY-MM" keyed buckets chronologically */
export function sortedMonthBuckets(aggregation: SearchAggregation): SearchBucket[] {
  return [...(aggregation.buckets ?? [])].sort((a, b) => a.key.localeCompare(b.key))
}

export function monthLabel(key: string, language: string, withYear = false): string {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString(language, {
    month: 'short',
    ...(withYear && { year: 'numeric' })
  })
}

/** Small deterministic hash used to pick placeholder art for a photo id */
export function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

// scenic duotone placeholders until real thumbnails are wired up
const placeholderArt = [
  'radial-gradient(120% 90% at 70% 10%, rgba(255,236,190,0.55), transparent 60%), linear-gradient(160deg, #f0a56f 0%, #c2586f 55%, #5b3a6e 100%)',
  'radial-gradient(120% 90% at 30% 15%, rgba(255,255,255,0.4), transparent 55%), linear-gradient(165deg, #9fb8c8 0%, #5d7b8a 55%, #2f4858 100%)',
  'radial-gradient(110% 80% at 60% 20%, rgba(255,250,200,0.35), transparent 60%), linear-gradient(170deg, #a8c686 0%, #4f7a52 60%, #22452f 100%)',
  'radial-gradient(130% 90% at 40% 10%, rgba(220,245,255,0.45), transparent 55%), linear-gradient(160deg, #7fc4d4 0%, #3a7ca5 55%, #16425b 100%)',
  'radial-gradient(120% 90% at 65% 15%, rgba(255,244,200,0.6), transparent 60%), linear-gradient(165deg, #e8c977 0%, #b98a45 60%, #6e4e23 100%)',
  'radial-gradient(110% 80% at 50% 0%, rgba(200,210,255,0.3), transparent 55%), linear-gradient(170deg, #8b9dc3 0%, #3e4a89 55%, #1b2145 100%)'
]

export function placeholderArtFor(id: string): string {
  return placeholderArt[hashString(id) % placeholderArt.length]
}

/** Normalizes a search hit's parentReference.path ("." or "./foo") to a bare relative path */
export function normalizeParentPath(path?: string): string {
  if (!path || path === '.' || path === './') {
    return ''
  }
  return path.replace(/^\.\//, '')
}

import { MemoryPhoto } from './types'

export interface DayGroup {
  /** "YYYY-MM-DD" in local time */
  day: string
  photos: MemoryPhoto[]
}

/** groups photos by local calendar day, keeping the given order */
export function groupPhotosByDay(photos: MemoryPhoto[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const photo of photos) {
    const taken = new Date(photo.takenDateTime)
    const day = `${taken.getFullYear()}-${String(taken.getMonth() + 1).padStart(2, '0')}-${String(taken.getDate()).padStart(2, '0')}`
    const last = groups[groups.length - 1]
    if (last?.day === day) {
      last.photos.push(photo)
    } else {
      groups.push({ day, photos: [photo] })
    }
  }
  return groups
}

export function dayLabel(day: string, language: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date).toLocaleDateString(language, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

export function monthYearLabel(key: string, language: string): string {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString(language, {
    month: 'long',
    year: 'numeric'
  })
}

const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

/** Decodes a geohash cell to its center coordinates */
export function geohashDecode(hash: string): { latitude: number; longitude: number } {
  let even = true
  const lat: [number, number] = [-90, 90]
  const lon: [number, number] = [-180, 180]
  for (const char of hash.toLowerCase()) {
    const index = GEOHASH_BASE32.indexOf(char)
    if (index < 0) {
      break
    }
    for (let bit = 4; bit >= 0; bit--) {
      const range = even ? lon : lat
      const mid = (range[0] + range[1]) / 2
      if ((index >> bit) & 1) {
        range[0] = mid
      } else {
        range[1] = mid
      }
      even = !even
    }
  }
  return { latitude: (lat[0] + lat[1]) / 2, longitude: (lon[0] + lon[1]) / 2 }
}

export function formatCoordinates(latitude: number, longitude: number): string {
  const ns = latitude >= 0 ? 'N' : 'S'
  const ew = longitude >= 0 ? 'E' : 'W'
  return `${Math.abs(latitude).toFixed(2)}° ${ns}, ${Math.abs(longitude).toFixed(2)}° ${ew}`
}
