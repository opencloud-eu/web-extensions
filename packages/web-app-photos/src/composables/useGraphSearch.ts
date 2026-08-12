import { useClientService, useConfigStore } from '@opencloud-eu/web-pkg'
import { urlJoin } from '@opencloud-eu/web-client'
import { AggregationOption, MemoryPhoto, SearchHit, SearchHitsContainer } from '../types'
import { normalizeParentPath } from '../helpers'

export interface PhotoSearchRequest {
  queryString: string
  size?: number
  from?: number
  aggregations?: AggregationOption[]
}

const THUMBNAIL_SIZE = 384
/** background prefetches run with limited parallelism to keep visible tiles snappy */
const MAX_PARALLEL_PREFETCHES = 6

// module level: previews stay cached for the whole session, so revisiting a
// view or scrolling back never refetches
const thumbnailUrls = new Map<string, string>()
const inflightThumbnails = new Map<string, Promise<void>>()
const prefetchQueue: (() => Promise<void>)[] = []
let activePrefetches = 0

function pumpPrefetchQueue() {
  while (activePrefetches < MAX_PARALLEL_PREFETCHES && prefetchQueue.length) {
    const load = prefetchQueue.shift()!
    activePrefetches++
    load().finally(() => {
      activePrefetches--
      pumpPrefetchQueue()
    })
  }
}

export function useGraphSearch() {
  const clientService = useClientService()
  const configStore = useConfigStore()

  async function search(request: PhotoSearchRequest): Promise<SearchHitsContainer> {
    const url = urlJoin(configStore.serverUrl, 'graph/v1beta1/search/query')
    const { data } = await clientService.httpAuthenticated.post(url, {
      requests: [
        {
          entityTypes: ['driveItem'],
          query: { queryString: request.queryString },
          size: request.size ?? 0,
          ...(request.from !== undefined && { from: request.from }),
          ...(request.aggregations?.length && { aggregations: request.aggregations })
        }
      ]
    })
    return data?.value?.[0]?.hitsContainers?.[0] ?? {}
  }

  function hitToPhoto(hit: SearchHit): MemoryPhoto | null {
    const resource = hit.resource
    if (!resource?.id || !resource.name) {
      return null
    }
    return {
      id: resource.id,
      name: resource.name,
      takenDateTime: resource.photo?.takenDateTime ?? resource.lastModifiedDateTime ?? '',
      cameraModel: resource.photo?.cameraModel,
      fNumber: resource.photo?.fNumber,
      iso: resource.photo?.iso,
      width: resource.image?.width,
      height: resource.image?.height,
      driveId: resource.parentReference?.driveId,
      parentPath: normalizeParentPath(resource.parentReference?.path)
    }
  }

  /** Loads a WebDAV preview and attaches it to the photo as an object url */
  async function fetchThumbnail(photo: MemoryPhoto): Promise<void> {
    const path = photo.parentPath ? `${photo.parentPath}/${photo.name}` : photo.name
    const url = urlJoin(configStore.serverUrl, 'remote.php/dav/spaces', photo.driveId!, path)
    try {
      const { data } = await clientService.httpAuthenticated.get(url, {
        params: { preview: 1, x: THUMBNAIL_SIZE, y: THUMBNAIL_SIZE, scalingup: 0 },
        responseType: 'blob'
      })
      thumbnailUrls.set(photo.id, URL.createObjectURL(data as Blob))
    } catch {
      // no preview available, the placeholder art stays
    }
  }

  /** loads a preview and attaches it as object url; cached and deduplicated */
  async function attachThumbnail(photo: MemoryPhoto): Promise<void> {
    if (!photo.driveId || photo.thumbnailUrl) {
      return
    }
    const cached = thumbnailUrls.get(photo.id)
    if (cached) {
      photo.thumbnailUrl = cached
      return
    }
    let load = inflightThumbnails.get(photo.id)
    if (!load) {
      load = fetchThumbnail(photo).finally(() => inflightThumbnails.delete(photo.id))
      inflightThumbnails.set(photo.id, load)
    }
    await load
    photo.thumbnailUrl = thumbnailUrls.get(photo.id)
  }

  /** queues previews for background loading, without competing with visible tiles */
  function prefetchThumbnails(photos: MemoryPhoto[]) {
    for (const photo of photos) {
      if (
        !photo.driveId ||
        photo.thumbnailUrl ||
        thumbnailUrls.has(photo.id) ||
        inflightThumbnails.has(photo.id)
      ) {
        continue
      }
      prefetchQueue.push(() => attachThumbnail(photo))
    }
    pumpPrefetchQueue()
  }

  return { search, hitToPhoto, attachThumbnail, prefetchThumbnails }
}
