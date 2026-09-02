import { ref } from 'vue'
import { MemoryGroup, Photo, SearchAggregation, SearchBucket, SearchHitsContainer } from '../types'
import { dayRange, monthRange } from '../helpers'
import { useGraphSearch } from './useGraphSearch'

const PHOTO_QUERY = 'mediatype:image'
const MEMORY_YEARS_BACK = 15
const MEMORY_MAX_GROUPS = 4
const MEMORY_PHOTOS_PER_GROUP = 6
/** how many candidates to draw the random memories from */
const MEMORY_CANDIDATE_LIMIT = 200
/** fewer photos than this across all anniversaries widens day ranges to month */
const MEMORY_DAY_MODE_MINIMUM = 4

export type MemoryMode = 'day' | 'month'

/** Fisher-Yates shuffle on a copy, then take count */
function sample<T>(items: T[], count: number): T[] {
  const pool = [...items]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

function takenDateTimeAggregation(container: SearchHitsContainer): SearchAggregation | undefined {
  return container.aggregations?.find((a) => a.field === 'photo.takenDateTime' && !a.metricKind)
}

/** "x years ago" anniversary groups: photos taken on this day (or month) over the years */
export function useMemories() {
  const { search, hitToPhoto, attachThumbnail } = useGraphSearch()

  const groups = ref<MemoryGroup[]>([])
  const mode = ref<MemoryMode>('day')

  async function load() {
    const now = new Date()
    const month = now.getMonth() + 1
    const years = Array.from({ length: MEMORY_YEARS_BACK }, (_, i) => now.getFullYear() - (i + 1))

    async function probe(probeMode: MemoryMode): Promise<SearchBucket[]> {
      const ranges = years.map((year) =>
        probeMode === 'day' ? dayRange(year, month, now.getDate()) : monthRange(year, month)
      )
      const container = await search({
        queryString: PHOTO_QUERY,
        size: 0,
        aggregations: [
          { field: 'photo.takenDateTime', bucketDefinition: { sortBy: 'keyAsString', ranges } }
        ]
      })
      return takenDateTimeAggregation(container)?.buckets ?? []
    }

    let probed: MemoryMode = 'day'
    let buckets = await probe('day')
    let total = buckets.reduce((sum, b) => sum + b.count, 0)
    if (total < MEMORY_DAY_MODE_MINIMUM) {
      probed = 'month'
      buckets = await probe('month')
      total = buckets.reduce((sum, b) => sum + b.count, 0)
    }
    mode.value = probed
    if (total === 0) {
      groups.value = []
      return
    }

    const nonEmpty = buckets
      .filter((b) => b.count > 0)
      .sort((a, b) => b.key.localeCompare(a.key))
      .slice(0, MEMORY_MAX_GROUPS)

    const loaded = await Promise.all(
      nonEmpty.map(async (bucket) => {
        // bucket key is "YYYY-MM-DD-YYYY-MM-DD"
        const from = bucket.key.slice(0, 10)
        const to = bucket.key.slice(11)
        const year = Number(from.slice(0, 4))
        const container = await search({
          queryString: `${PHOTO_QUERY} AND photo.takenDateTime>=${from} AND photo.takenDateTime<${to}`,
          size: Math.min(bucket.count, MEMORY_CANDIDATE_LIMIT)
        })
        const candidates = (container.hits ?? [])
          .map(hitToPhoto)
          .filter((p): p is Photo => p !== null)
        // a fresh random draw per visit, shown in chronological order
        const photos = sample(candidates, MEMORY_PHOTOS_PER_GROUP).sort((a, b) =>
          a.takenDateTime.localeCompare(b.takenDateTime)
        )
        return {
          yearsAgo: now.getFullYear() - year,
          year,
          total: bucket.count,
          photos
        }
      })
    )
    groups.value = loaded.filter((g) => g.photos.length > 0)
    groups.value.forEach((g) => g.photos.forEach((p) => attachThumbnail(p)))
  }

  return { groups, mode, load }
}
