import type { DriveItem, MotionPhoto } from '@opencloud-eu/web-client/graph/generated'

/**
 * Types mirroring the Graph Search API request/response shapes
 * (POST /graph/v1beta1/search/query). The search request/response wrappers
 * are not part of the released graph spec yet, so they live here; the hit
 * resource itself is the generated graph DriveItem.
 */

export interface BucketAggregationRange {
  from?: string
  to?: string
}

export interface BucketDefinition {
  sortBy: 'count' | 'keyAsString' | 'keyAsNumber'
  isDescending?: boolean
  minimumCount?: number
  ranges?: BucketAggregationRange[]
}

export type MetricKind = 'sum' | 'min' | 'max' | 'avg'

export interface MetricDefinition {
  kind: MetricKind
}

export interface SearchMetric {
  kind?: MetricKind
  value?: number
}

export interface AggregationOption {
  field: string
  size?: number
  bucketDefinition?: BucketDefinition
  '@libre.graph.subAggregations'?: AggregationOption[]
  '@libre.graph.metricDefinition'?: MetricDefinition
  '@libre.graph.geohashPrecision'?: number
}

export interface SearchBucket {
  key: string
  count: number
  aggregationFilterToken?: string
  '@libre.graph.subAggregations'?: SearchAggregation[]
}

export interface SearchAggregation {
  field?: string
  buckets?: SearchBucket[]
  '@libre.graph.metric'?: SearchMetric
}

export interface SearchHit {
  hitId?: string
  rank?: number
  summary?: string
  resource?: DriveItem
}

export interface SearchHitsContainer {
  hits?: SearchHit[]
  total?: number
  moreResultsAvailable?: boolean
  aggregations?: SearchAggregation[]
}

/** Photos taken around the same date, n years ago */
export interface MemoryGroup {
  yearsAgo: number
  year: number
  total: number
  photos: Photo[]
}

/** A single photo shown in one of the strips or grids */
export interface Photo {
  id: string
  name: string
  takenDateTime: string
  cameraModel?: string
  fNumber?: number
  iso?: number
  width?: number
  height?: number
  driveId?: string
  /** parent path relative to the space root */
  parentPath?: string
  thumbnailUrl?: string
  size?: number
  motionPhoto?: MotionPhoto
}

export interface LibraryStats {
  totalPhotos: number
  totalBytes?: number
  cameraCount?: number
  placeCount?: number
  videoCount?: number
}
