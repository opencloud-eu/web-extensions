import { useClientService, useConfigStore } from '@opencloud-eu/web-pkg'
import { urlJoin } from '@opencloud-eu/web-client'
import { AggregationOption, Photo, SearchHit, SearchHitsContainer } from '../types'
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
/** cap for viewport-driven fetches; without it a fast scroll fires hundreds
 * of parallel requests that starve the tiles the user actually looks at */
const MAX_PRIORITY_LOADS = 8
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
const originalUrls = new Map<string, string>()
const inflightOriginals = new Map<string, Promise<string | undefined>>()
const inflightLightbox = new Map<string, Promise<string | undefined>>()
// LIFO: the most recently visible tile wins over one scrolled past long ago
const priorityStack: (() => Promise<void>)[] = []
let activePriorityLoads = 0

function pumpPriorityStack() {
  while (activePriorityLoads < MAX_PRIORITY_LOADS && priorityStack.length) {
    const load = priorityStack.pop()!
    activePriorityLoads++
    load().finally(() => {
      activePriorityLoads--
      pumpPriorityStack()
    })
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** DAV path of the photo with each segment percent-encoded: names with
 * '#', '%' or '?' would otherwise truncate or corrupt the URL */
function davPath(photo: Photo): string {
  const path = photo.parentPath ? `${photo.parentPath}/${photo.name}` : photo.name
  return path.split('/').map(encodeURIComponent).join('/')
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

  function hitToPhoto(hit: SearchHit): Photo | null {
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
  async function fetchThumbnail(photo: Photo): Promise<void> {
    const url = urlJoin(
      configStore.serverUrl,
      'remote.php/dav/spaces',
      photo.driveId!,
      davPath(photo)
    )
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
  function runFetch(photo: Photo): Promise<void> {
    let load = inflightThumbnails.get(photo.id)
    if (!load) {
      load = fetchThumbnail(photo).finally(() => inflightThumbnails.delete(photo.id))
      inflightThumbnails.set(photo.id, load)
    }
    return load
  }

  /** Loads a preview and attaches it as object url; cached and deduplicated. */
  async function attachThumbnail(photo: Photo): Promise<void> {
    if (!photo.driveId || photo.thumbnailUrl) {
      return
    }
    const cached = thumbnailUrls.get(photo.id)
    if (cached) {
      photo.thumbnailUrl = cached
      return
    }
    await new Promise<void>((resolve) => {
      priorityStack.push(async () => {
        // may have been loaded by another tile in the meantime
        if (!thumbnailUrls.has(photo.id)) {
          await runFetch(photo)
        }
        resolve()
      })
      pumpPriorityStack()
    })
    photo.thumbnailUrl = thumbnailUrls.get(photo.id)
  }

  /** loads the large lightbox rendition; undefined when no preview exists */
  function loadLightboxImage(photo: Photo): Promise<string | undefined> {
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
        const url = urlJoin(
          configStore.serverUrl,
          'remote.php/dav/spaces',
          photo.driveId!,
          davPath(photo)
        )
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

  /** loads the untouched original file, e.g. to zoom beyond the preview
   * resolution; undefined on failure */
  function loadOriginalImage(photo: Photo): Promise<string | undefined> {
    if (!photo.driveId) {
      return Promise.resolve(undefined)
    }
    const cached = originalUrls.get(photo.id)
    if (cached) {
      return Promise.resolve(cached)
    }
    let load = inflightOriginals.get(photo.id)
    if (!load) {
      load = (async () => {
        const url = urlJoin(
          configStore.serverUrl,
          'remote.php/dav/spaces',
          photo.driveId!,
          davPath(photo)
        )
        try {
          const { data } = await clientService.httpAuthenticated.get(url, {
            responseType: 'blob',
            timeout: 120000
          })
          const objectUrl = URL.createObjectURL(data as Blob)
          originalUrls.set(photo.id, objectUrl)
          return objectUrl
        } catch (e) {
          const status = (e as { response?: { status?: number } })?.response?.status
          console.warn('[photos] original download failed', photo.name, status ?? e)
          return undefined
        }
      })().finally(() => inflightOriginals.delete(photo.id))
      inflightOriginals.set(photo.id, load)
    }
    return load
  }

  return {
    search,
    hitToPhoto,
    attachThumbnail,
    loadLightboxImage,
    loadOriginalImage
  }
}
