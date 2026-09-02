import { ref } from 'vue'
import {
  AggregationOption,
  LibraryStats,
  SearchAggregation,
  SearchBucket,
  SearchHitsContainer
} from '../types'
import { monthRange } from '../helpers'
import { useGraphSearch } from './useGraphSearch'

const PHOTO_QUERY = 'mediatype:image'

export interface ExifFact {
  option: AggregationOption
  label: 'focalLength' | 'fNumber' | 'iso' | 'imageWidth'
  value: number
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
  const { search } = useGraphSearch()

  const loading = ref(true)
  const error = ref<string | null>(null)
  const stats = ref<LibraryStats | null>(null)
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

  async function load() {
    loading.value = true
    error.value = null
    try {
      await Promise.all([loadOverview(), loadMonthly()])
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
    cameras,
    monthly,
    places,
    tags,
    exifFacts
  }
}
