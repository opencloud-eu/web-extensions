import { computed, ref } from 'vue'
import { AggregationOption, MemoryPhoto } from '../types'
import { useGraphSearch } from './useGraphSearch'

/** the graph endpoint clamps page sizes to 500 */
export const SECTION_FILL_LIMIT = 500
const TIMELINE_FIRST_YEAR = 1990

export interface TimelineSection {
  /** month key, "YYYY-MM" */
  key: string
  count: number
  /** null until filled */
  photos: MemoryPhoto[] | null
  filling: boolean
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function monthRange(year: number, month: number) {
  const next = month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`
  return { from: `${year}-${pad(month)}-01`, to: `${next}-01` }
}

/**
 * Skeleton-load per date histogram, viewport-fill per range query: one
 * mechanic for the timeline and the album view, only the query scope differs.
 */
export function usePhotoTimeline(baseQuery: () => string) {
  const { search, hitToPhoto, attachThumbnail, prefetchThumbnails } = useGraphSearch()

  const sections = ref<TimelineSection[]>([])
  const loading = ref(true)
  const total = computed(() => sections.value.reduce((sum, s) => sum + s.count, 0))

  async function aggregate(ranges: { from: string; to: string }[]) {
    const aggregation: AggregationOption = {
      field: 'photo.takenDateTime',
      bucketDefinition: { sortBy: 'keyAsString', ranges }
    }
    const container = await search({
      queryString: baseQuery(),
      size: 0,
      aggregations: [aggregation]
    })
    return (
      container.aggregations?.find((a) => a.field === 'photo.takenDateTime')?.buckets ?? []
    ).filter((b) => b.count > 0)
  }

  async function load() {
    loading.value = true
    sections.value = []
    try {
      const currentYear = new Date().getFullYear()
      const yearRanges = []
      for (let year = TIMELINE_FIRST_YEAR; year <= currentYear; year++) {
        yearRanges.push({ from: `${year}-01-01`, to: `${year + 1}-01-01` })
      }
      const yearBuckets = await aggregate(yearRanges)
      const years = yearBuckets.map((b) => Number(b.key.slice(0, 4)))
      if (!years.length) {
        return
      }

      const monthRanges = years.flatMap((year) =>
        Array.from({ length: 12 }, (_, i) => monthRange(year, i + 1))
      )
      const monthBuckets = await aggregate(monthRanges)
      sections.value = monthBuckets
        .map((b): TimelineSection => ({
          key: b.key.slice(0, 7),
          count: b.count,
          photos: null,
          filling: false
        }))
        .sort((a, b) => b.key.localeCompare(a.key))
    } finally {
      loading.value = false
    }
  }

  async function fillSection(section: TimelineSection) {
    if (section.photos !== null || section.filling) {
      return
    }
    section.filling = true
    try {
      const [year, month] = section.key.split('-').map(Number)
      const { from, to } = monthRange(year, month)
      const queryString = `(${baseQuery()}) AND photo.takenDateTime>=${from} AND photo.takenDateTime<${to}`

      // months can exceed the server's max page size: page through with
      // `from` offsets on a server-sorted result (photo.takenDateTime desc),
      // render progressively and dedupe across pages (the index may move
      // between requests)
      const collected: MemoryPhoto[] = []
      const seen = new Set<string>()
      for (let offset = 0; offset < section.count; offset += SECTION_FILL_LIMIT) {
        const container = await search({
          queryString,
          from: offset,
          size: Math.min(section.count - offset, SECTION_FILL_LIMIT),
          sortProperties: [{ name: 'photo.takenDateTime', isDescending: true }]
        })
        const photos = (container.hits ?? [])
          .map(hitToPhoto)
          .filter((p): p is MemoryPhoto => p !== null && !seen.has(p.id))
        for (const photo of photos) {
          seen.add(photo.id)
        }
        collected.push(...photos)
        section.photos = [...collected].sort((a, b) =>
          b.takenDateTime.localeCompare(a.takenDateTime)
        )
        // warm the page in the background so scrolling stays smooth
        prefetchThumbnails(section.photos)
        if ((container.hits?.length ?? 0) < SECTION_FILL_LIMIT) {
          break
        }
      }
      section.photos ??= []
    } catch (e) {
      console.error('[photos] failed to fill timeline section', section.key, e)
      section.photos ??= []
    } finally {
      section.filling = false
    }
  }

  return { sections, loading, total, load, fillSection, attachThumbnail, prefetchThumbnails }
}
