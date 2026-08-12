import { useClientService, useConfigStore } from '@opencloud-eu/web-pkg'
import { urlJoin } from '@opencloud-eu/web-client'
import { AggregationOption, MemoryPhoto, SearchHit, SearchHitsContainer } from '../types'
import { normalizeParentPath } from '../helpers'

export interface SortProperty {
  name: string
  isDescending?: boolean
}

export interface PhotoSearchRequest {
  queryString: string
  size?: number
  from?: number
  aggregations?: AggregationOption[]
  sortProperties?: SortProperty[]
}

const THUMBNAIL_SIZE = 384
/** visible tiles fetch directly (the browser schedules network far better
 * than we can); only background prefetches are throttled so they never
 * compete with what the user is looking at */
const MAX_BACKGROUND_LOADS = 4
const FETCH_RETRIES = 3
const RETRY_DELAYS_MS = [500, 2000]

// module level: previews stay cached for the whole session, so revisiting a
// view or scrolling back never refetches
const thumbnailUrls = new Map<string, string>()
const inflightThumbnails = new Map<string, Promise<void>>()
const backgroundQueue: (() => Promise<void>)[] = []
let activeBackgroundLoads = 0

function pumpBackgroundQueue() {
  while (activeBackgroundLoads < MAX_BACKGROUND_LOADS && backgroundQueue.length) {
    const load = backgroundQueue.shift()!
    activeBackgroundLoads++
    load().finally(() => {
      activeBackgroundLoads--
      pumpBackgroundQueue()
    })
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// live diagnostics for debugging stuck tiles: inspect via
// `window.__photosDebug` in the browser console
declare global {
  interface Window {
    __photosDebug?: { inflight: number; background: number; queued: number; cached: number }
  }
}
if (typeof window !== 'undefined') {
  Object.defineProperty(window, '__photosDebug', {
    configurable: true,
    get: () => ({
      inflight: inflightThumbnails.size,
      background: activeBackgroundLoads,
      queued: backgroundQueue.length,
      cached: thumbnailUrls.size
    })
  })
}

export function useGraphSearch() {
  const clientService = useClientService()
  const configStore = useConfigStore()

  async function search(request: PhotoSearchRequest): Promise<SearchHitsContainer> {
    const url = urlJoin(configStore.serverUrl, 'graph/v1beta1/search/query')
    const { data } = await clientService.httpAuthenticated.post(
      url,
      {
        requests: [
          {
            entityTypes: ['driveItem'],
            query: { queryString: request.queryString },
            size: request.size ?? 0,
            ...(request.from !== undefined && { from: request.from }),
            ...(request.aggregations?.length && { aggregations: request.aggregations }),
            ...(request.sortProperties?.length && { sortProperties: request.sortProperties })
          }
        ]
      },
      { timeout: 30000 }
    )
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

  /** fetches a WebDAV preview into the cache, retrying transient failures */
  async function fetchThumbnail(photo: MemoryPhoto): Promise<void> {
    const path = photo.parentPath ? `${photo.parentPath}/${photo.name}` : photo.name
    const url = urlJoin(configStore.serverUrl, 'remote.php/dav/spaces', photo.driveId!, path)
    for (let attempt = 0; attempt < FETCH_RETRIES; attempt++) {
      try {
        const { data } = await clientService.httpAuthenticated.get(url, {
          params: { preview: 1, x: THUMBNAIL_SIZE, y: THUMBNAIL_SIZE, scalingup: 0 },
          responseType: 'blob',
          // a hung request would occupy its scheduler slot forever and can
          // starve the whole loading lane; time out and retry instead
          timeout: 15000
        })
        thumbnailUrls.set(photo.id, URL.createObjectURL(data as Blob))
        return
      } catch (e) {
        const status = (e as { response?: { status?: number } })?.response?.status
        if (status === 404 || status === 403) {
          // no preview exists, retrying will not help; the placeholder stays
          console.warn('[photos] preview does not exist', photo.name, status)
          return
        }
        if (attempt < RETRY_DELAYS_MS.length) {
          await delay(RETRY_DELAYS_MS[attempt])
        } else {
          console.warn('[photos] preview failed after retries', photo.name, status ?? e)
        }
      }
    }
  }

  /** starts (or joins) the actual fetch for a photo, deduplicated */
  function runFetch(photo: MemoryPhoto): Promise<void> {
    let load = inflightThumbnails.get(photo.id)
    if (!load) {
      load = fetchThumbnail(photo).finally(() => inflightThumbnails.delete(photo.id))
      inflightThumbnails.set(photo.id, load)
    }
    return load
  }

  /**
   * Loads a preview and attaches it as object url; cached and deduplicated.
   * Priority loads (visible tiles) fetch immediately, background loads queue
   * with limited parallelism. A photo that is still waiting in the background
   * queue gets fetched right away when requested with priority.
   */
  async function attachThumbnail(photo: MemoryPhoto, priority = true): Promise<void> {
    if (!photo.driveId || photo.thumbnailUrl) {
      return
    }
    const cached = thumbnailUrls.get(photo.id)
    if (cached) {
      photo.thumbnailUrl = cached
      return
    }
    if (priority) {
      await runFetch(photo)
    } else {
      await new Promise<void>((resolve) => {
        backgroundQueue.push(async () => {
          // may have been loaded with priority in the meantime
          if (!thumbnailUrls.has(photo.id)) {
            await runFetch(photo)
          }
          resolve()
        })
        pumpBackgroundQueue()
      })
    }
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
      attachThumbnail(photo, false)
    }
  }

  return { search, hitToPhoto, attachThumbnail, prefetchThumbnails }
}
