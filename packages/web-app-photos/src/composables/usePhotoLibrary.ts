import { ref } from 'vue'
import {
  AggregationOption,
  LibraryStats,
  MemoryGroup,
  MemoryPhoto,
  SearchAggregation,
  SearchBucket,
  SearchHitsContainer
} from '../types'
import { useGraphSearch } from './useGraphSearch'

const PHOTO_QUERY = 'mediatype:image'
const MEMORY_YEARS_BACK = 15
const MEMORY_MAX_GROUPS = 4
const MEMORY_PHOTOS_PER_GROUP = 6
/** fewer photos than this across all anniversaries widens day ranges to month */
const MEMORY_DAY_MODE_MINIMUM = 4
const LATEST_PHOTO_COUNT = 8

export interface ExifFact {
  option: AggregationOption
  label: 'focalLength' | 'fNumber' | 'iso' | 'imageWidth'
  value: number
}

export type MemoryMode = 'day' | 'month'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function dayRange(year: number, month: number, day: number) {
  const from = new Date(Date.UTC(year, month - 1, day))
  const to = new Date(Date.UTC(year, month - 1, day + 1))
  return { from: isoDay(from), to: isoDay(to) }
}

function monthRange(year: number, month: number) {
  const from = new Date(Date.UTC(year, month - 1, 1))
  const to = new Date(Date.UTC(year, month, 1))
  return { from: isoDay(from), to: isoDay(to) }
}

function isoDay(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** last `count` calendar months as ranges, oldest first */
function lastMonthsRanges(now: Date, count: number) {
  const ranges = []
  for (let i = count - 1; i >= 0; i--) {
    ranges.push(monthRange(now.getFullYear(), now.getMonth() + 1 - i))
  }
  return ranges
}

function findAggregation(
  container: SearchHitsContainer,
  field: string,
  metricKind?: string
): SearchAggregation | undefined {
  return container.aggregations?.find(
    (a) => a.field === field && (metricKind ? a.metricKind === metricKind : !a.metricKind)
  )
}

function foldOther(buckets: SearchBucket[], top: number): SearchBucket[] {
  if (buckets.length <= top) {
    return buckets
  }
  const rest = buckets.slice(top)
  const other = rest.reduce((sum, b) => sum + b.count, 0)
  return [...buckets.slice(0, top), { key: 'Other', count: other }]
}

export function usePhotoLibrary() {
  const { search, hitToPhoto, attachThumbnail } = useGraphSearch()

  const loading = ref(true)
  const error = ref<string | null>(null)
  const stats = ref<LibraryStats | null>(null)
  const memoryGroups = ref<MemoryGroup[]>([])
  const memoryMode = ref<MemoryMode>('day')
  const latestPhotos = ref<MemoryPhoto[]>([])
  const cameras = ref<SearchAggregation | null>(null)
  const monthly = ref<SearchAggregation | null>(null)
  const places = ref<SearchAggregation | null>(null)
  const tags = ref<SearchAggregation | null>(null)
  const exifFacts = ref<ExifFact[]>([])

  const overviewAggregations: AggregationOption[] = [
    {
      field: 'photo.cameraModel',
      size: 100,
      bucketDefinition: { sortBy: 'count', isDescending: true }
    },
    { field: 'Tags', size: 7, bucketDefinition: { sortBy: 'count', isDescending: true } },
    { field: 'location', size: 500, geohashPrecision: 4 },
    { field: 'Size', metricKind: 'sum' },
    { field: 'photo.focalLength', metricKind: 'avg' },
    { field: 'photo.fNumber', metricKind: 'avg' },
    { field: 'photo.iso', metricKind: 'max' },
    { field: 'image.width', metricKind: 'max' }
  ]

  const monthlyOption = ref<AggregationOption>({
    field: 'photo.takenDateTime',
    bucketDefinition: { sortBy: 'keyAsString', ranges: lastMonthsRanges(new Date(), 24) }
  })

  const memoriesOption = ref<AggregationOption>({ field: 'photo.takenDateTime' })

  const aggregationOptions = {
    cameras: overviewAggregations[0],
    tags: overviewAggregations[1],
    places: overviewAggregations[2],
    monthly: monthlyOption,
    memories: memoriesOption
  }

  async function loadOverview() {
    const container = await search({
      queryString: PHOTO_QUERY,
      size: 0,
      aggregations: overviewAggregations
    })
    const cameraAgg = findAggregation(container, 'photo.cameraModel')
    const placesAgg = findAggregation(container, 'location')

    cameras.value = {
      field: 'photo.cameraModel',
      buckets: foldOther(cameraAgg?.buckets ?? [], 5)
    }
    places.value = {
      field: 'location',
      buckets: (placesAgg?.buckets ?? []).slice(0, 7)
    }
    tags.value = findAggregation(container, 'Tags') ?? null

    const metricFacts: [ExifFact['label'], string, string][] = [
      ['focalLength', 'photo.focalLength', 'avg'],
      ['fNumber', 'photo.fNumber', 'avg'],
      ['iso', 'photo.iso', 'max'],
      ['imageWidth', 'image.width', 'max']
    ]
    exifFacts.value = metricFacts.flatMap(([label, field, metricKind]) => {
      const agg = findAggregation(container, field, metricKind)
      if (agg?.value === undefined) {
        return []
      }
      return [
        {
          label,
          value: agg.value,
          option: { field, metricKind: metricKind as AggregationOption['metricKind'] }
        }
      ]
    })

    const videos = await search({ queryString: 'mediatype:video', size: 0 })

    stats.value = {
      totalPhotos: container.total ?? 0,
      totalBytes: findAggregation(container, 'Size', 'sum')?.value,
      cameraCount: cameraAgg?.buckets?.length,
      placeCount: placesAgg?.buckets?.length,
      videoCount: videos.total
    }
  }

  async function loadMonthly() {
    const container = await search({
      queryString: PHOTO_QUERY,
      size: 0,
      aggregations: [monthlyOption.value]
    })
    const agg = findAggregation(container, 'photo.takenDateTime')
    // range bucket keys are "from-to"; reduce to "YYYY-MM" for the chart.
    // Empty ranges are omitted from the response, so zero-fill from the
    // requested ranges to keep the time axis continuous.
    const counts = new Map((agg?.buckets ?? []).map((b) => [b.key.slice(0, 7), b.count] as const))
    monthly.value = {
      field: 'photo.takenDateTime',
      buckets: (monthlyOption.value.bucketDefinition?.ranges ?? []).map((r) => {
        const key = (r.from ?? '').slice(0, 7)
        return { key, count: counts.get(key) ?? 0 }
      })
    }
  }

  async function loadMemories() {
    const now = new Date()
    const month = now.getMonth() + 1
    const years = Array.from({ length: MEMORY_YEARS_BACK }, (_, i) => now.getFullYear() - (i + 1))

    async function probe(mode: MemoryMode): Promise<SearchBucket[]> {
      const ranges = years.map((year) =>
        mode === 'day' ? dayRange(year, month, now.getDate()) : monthRange(year, month)
      )
      memoriesOption.value = {
        field: 'photo.takenDateTime',
        bucketDefinition: { sortBy: 'keyAsString', ranges }
      }
      const container = await search({
        queryString: PHOTO_QUERY,
        size: 0,
        aggregations: [memoriesOption.value]
      })
      return findAggregation(container, 'photo.takenDateTime')?.buckets ?? []
    }

    let mode: MemoryMode = 'day'
    let buckets = await probe('day')
    let total = buckets.reduce((sum, b) => sum + b.count, 0)
    if (total < MEMORY_DAY_MODE_MINIMUM) {
      mode = 'month'
      buckets = await probe('month')
      total = buckets.reduce((sum, b) => sum + b.count, 0)
    }
    memoryMode.value = mode
    if (total === 0) {
      memoryGroups.value = []
      return
    }

    const nonEmpty = buckets
      .filter((b) => b.count > 0)
      .sort((a, b) => b.key.localeCompare(a.key))
      .slice(0, MEMORY_MAX_GROUPS)

    const groups = await Promise.all(
      nonEmpty.map(async (bucket) => {
        // bucket key is "YYYY-MM-DD-YYYY-MM-DD"
        const from = bucket.key.slice(0, 10)
        const to = bucket.key.slice(11)
        const year = Number(from.slice(0, 4))
        const container = await search({
          queryString: `${PHOTO_QUERY} AND photo.takenDateTime>=${from} AND photo.takenDateTime<${to}`,
          size: MEMORY_PHOTOS_PER_GROUP
        })
        const photos = (container.hits ?? [])
          .map(hitToPhoto)
          .filter((p): p is MemoryPhoto => p !== null)
          .sort((a, b) => a.takenDateTime.localeCompare(b.takenDateTime))
        return {
          yearsAgo: now.getFullYear() - year,
          year,
          total: bucket.count,
          photos
        }
      })
    )
    memoryGroups.value = groups.filter((g) => g.photos.length > 0)
    memoryGroups.value.forEach((g) => g.photos.forEach((p) => attachThumbnail(p)))
  }

  async function loadLatest() {
    // walk the histogram buckets from newest to oldest until enough photos
    // are covered, then fetch exactly that time range
    const buckets = [...(monthly.value?.buckets ?? [])].sort((a, b) => b.key.localeCompare(a.key))
    let fromKey: string | undefined
    let covered = 0
    for (const bucket of buckets) {
      if (bucket.count === 0) {
        continue
      }
      fromKey = bucket.key
      covered += bucket.count
      if (covered >= LATEST_PHOTO_COUNT) {
        break
      }
    }
    const queryString = fromKey
      ? `${PHOTO_QUERY} AND photo.takenDateTime>=${fromKey}-01`
      : PHOTO_QUERY
    const container = await search({ queryString, size: 500 })
    latestPhotos.value = (container.hits ?? [])
      .map(hitToPhoto)
      .filter((p): p is MemoryPhoto => p !== null)
      .sort((a, b) => b.takenDateTime.localeCompare(a.takenDateTime))
      .slice(0, LATEST_PHOTO_COUNT)
    latestPhotos.value.forEach((p) => attachThumbnail(p))
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      await Promise.all([loadOverview(), loadMonthly().then(loadLatest), loadMemories()])
    } catch (e) {
      console.error(e)
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  return {
    load,
    loading,
    error,
    stats,
    memoryGroups,
    memoryMode,
    latestPhotos,
    cameras,
    monthly,
    places,
    tags,
    exifFacts,
    aggregationOptions
  }
}
