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

/**
 * MUST be a preset from the server's THUMBNAILS_RESOLUTIONS, anything else is
 * silently rounded UP to the next preset. 2048x512 is our addition to the
 * preset list (oc-dev.override.yml): with processor=fit that means "height
 * 512, width follows the aspect ratio".
 */
const THUMBNAIL_WIDTH = 2048
const THUMBNAIL_HEIGHT = 512
/** only background prefetches are throttled; visible tiles fetch directly */
const MAX_BACKGROUND_LOADS = 4
const FETCH_RETRIES = 3
const RETRY_DELAYS_MS = [500, 2000]

/** lightbox images use the 1920x1080 preset, the largest one the thumbnailer
 * ships out of the box; processor=fit keeps the aspect ratio */
const LIGHTBOX_WIDTH = 1920
const LIGHTBOX_HEIGHT = 1080

// module level: previews stay cached for the whole session
const thumbnailUrls = new Map<string, string>()
const inflightThumbnails = new Map<string, Promise<void>>()
const lightboxUrls = new Map<string, string>()
const inflightLightbox = new Map<string, Promise<string | undefined>>()
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

// live diagnostics: window.__photosDebug in the browser console
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
      parentPath: normalizeParentPath(resource.parentReference?.path),
      size: resource.size,
      motionPhoto: resource['@libre.graph.motionPhoto']
    }
  }

  /** fetches a WebDAV preview into the cache, retrying transient failures */
  async function fetchThumbnail(photo: MemoryPhoto): Promise<void> {
    const path = photo.parentPath ? `${photo.parentPath}/${photo.name}` : photo.name
    const url = urlJoin(configStore.serverUrl, 'remote.php/dav/spaces', photo.driveId!, path)
    for (let attempt = 0; attempt < FETCH_RETRIES; attempt++) {
      try {
        const { data } = await clientService.httpAuthenticated.get(url, {
          // processor=fit preserves the aspect ratio, the default crops
          params: {
            preview: 1,
            x: THUMBNAIL_WIDTH,
            y: THUMBNAIL_HEIGHT,
            scalingup: 0,
            processor: 'fit'
          },
          responseType: 'blob',
          // a hung request would occupy its scheduler slot forever
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
   * Priority loads fetch immediately, background loads queue with limited
   * parallelism.
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

  /** loads the large lightbox rendition; undefined when no preview exists */
  function loadLightboxImage(photo: MemoryPhoto): Promise<string | undefined> {
    if (!photo.driveId) {
      return Promise.resolve(undefined)
    }
    const cached = lightboxUrls.get(photo.id)
    if (cached) {
      return Promise.resolve(cached)
    }
    let load = inflightLightbox.get(photo.id)
    if (!load) {
      load = (async () => {
        const path = photo.parentPath ? `${photo.parentPath}/${photo.name}` : photo.name
        const url = urlJoin(configStore.serverUrl, 'remote.php/dav/spaces', photo.driveId!, path)
        try {
          const { data } = await clientService.httpAuthenticated.get(url, {
            params: {
              preview: 1,
              x: LIGHTBOX_WIDTH,
              y: LIGHTBOX_HEIGHT,
              scalingup: 0,
              processor: 'fit'
            },
            responseType: 'blob',
            timeout: 30000
          })
          const objectUrl = URL.createObjectURL(data as Blob)
          lightboxUrls.set(photo.id, objectUrl)
          return objectUrl
        } catch (e) {
          const status = (e as { response?: { status?: number } })?.response?.status
          console.warn('[photos] lightbox preview failed', photo.name, status ?? e)
          return undefined
        }
      })().finally(() => inflightLightbox.delete(photo.id))
      inflightLightbox.set(photo.id, load)
    }
    return load
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

  return { search, hitToPhoto, attachThumbnail, prefetchThumbnails, loadLightboxImage }
}
