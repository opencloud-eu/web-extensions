/**
 * Types mirroring the Graph Search API request/response shapes
 * (POST /graph/v1beta1/search/query).
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

export interface AggregationOption {
  field: string
  size?: number
  bucketDefinition?: BucketDefinition
  subAggregations?: AggregationOption[]
  metricKind?: 'sum' | 'min' | 'max' | 'avg'
  geohashPrecision?: number
}

export interface SearchBucket {
  key: string
  count: number
  subAggregations?: SearchAggregation[]
}

export interface SearchAggregation {
  field?: string
  buckets?: SearchBucket[]
  value?: number
  metricKind?: string
}

export interface DriveItemPhoto {
  cameraMake?: string
  cameraModel?: string
  fNumber?: number
  focalLength?: number
  iso?: number
  takenDateTime?: string
}

export interface DriveItem {
  id?: string
  name?: string
  size?: number
  lastModifiedDateTime?: string
  file?: { mimeType?: string }
  parentReference?: { driveId?: string; id?: string; name?: string; path?: string }
  image?: { width?: number; height?: number }
  photo?: DriveItemPhoto
  location?: { latitude?: number; longitude?: number; altitude?: number }
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

/** A single photo shown in one of the strips or grids */
export interface MemoryPhoto {
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
}

/** Photos taken around this date, n years ago */
export interface MemoryGroup {
  yearsAgo: number
  year: number
  total: number
  photos: MemoryPhoto[]
}

export interface LibraryStats {
  totalPhotos: number
  totalBytes?: number
  cameraCount?: number
  placeCount?: number
  videoCount?: number
}
