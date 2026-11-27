import { SearchAggregation, SearchBucket } from './types'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function isoDay(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** first day of the month to first day of the next, as YYYY-MM-DD range;
 * out-of-range months normalize through Date (month 0 = last December) */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const from = new Date(Date.UTC(year, month - 1, 1))
  const to = new Date(Date.UTC(year, month, 1))
  return { from: isoDay(from), to: isoDay(to) }
}

export function dayRange(year: number, month: number, day: number): { from: string; to: string } {
  const from = new Date(Date.UTC(year, month - 1, day))
  const to = new Date(Date.UTC(year, month - 1, day + 1))
  return { from: isoDay(from), to: isoDay(to) }
}

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

import { Photo } from './types'

export interface DayGroup {
  /** "YYYY-MM-DD" in local time */
  day: string
  photos: Photo[]
}

/** groups photos by local calendar day, keeping the given order */
/** taken timestamps are wall time with a nominal Z suffix: build a Date that
 * carries the literal clock values instead of shifting by the timezone */
export function wallClock(dateTime: string): Date {
  const [datePart, timePart = '00:00:00'] = dateTime.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute, second] = timePart
    .replace('Z', '')
    .split(':')
    .map((v) => Number(v) || 0)
  return new Date(year, month - 1, day, hour, minute, second)
}

export function groupPhotosByDay(photos: Photo[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const photo of photos) {
    // slice, not Date math: keeps client day groups aligned with the server's
    // date buckets and the day deep links
    const day = photo.takenDateTime.slice(0, 10)
    const last = groups[groups.length - 1]
    if (last?.day === day) {
      last.photos.push(photo)
    } else {
      groups.push({ day, photos: [photo] })
    }
  }
  return groups
}

// label formatting runs on hot paths (every month render, every scroll frame
// for the chip, every tile title); Intl is expensive, so cache the results
const labelCache = new Map<string, string>()

export function dayLabel(day: string, language: string): string {
  const cacheKey = `d|${language}|${day}`
  let label = labelCache.get(cacheKey)
  if (label === undefined) {
    const [year, month, date] = day.split('-').map(Number)
    label = new Date(year, month - 1, date).toLocaleDateString(language, {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    labelCache.set(cacheKey, label)
  }
  return label
}

export function monthYearLabel(key: string, language: string): string {
  const cacheKey = `m|${language}|${key}`
  let label = labelCache.get(cacheKey)
  if (label === undefined) {
    const [year, month] = key.split('-').map(Number)
    label = new Date(year, month - 1, 1).toLocaleDateString(language, {
      month: 'long',
      year: 'numeric'
    })
    labelCache.set(cacheKey, label)
  }
  return label
}

const timeFormatters = new Map<string, Intl.DateTimeFormat>()

export function formatTileTime(iso: string, language: string): string {
  const cacheKey = `t|${language}|${iso}`
  let label = labelCache.get(cacheKey)
  if (label === undefined) {
    let formatter = timeFormatters.get(language)
    if (!formatter) {
      formatter = new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' })
      timeFormatters.set(language, formatter)
    }
    const date = wallClock(iso)
    // a malformed taken date must not crash the tile (format() throws on
    // an invalid Date)
    label = Number.isNaN(date.getTime()) ? '' : formatter.format(date)
    labelCache.set(cacheKey, label)
  }
  return label
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
