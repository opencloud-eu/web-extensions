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
/** every preview load runs through one bounded scheduler so bursts can never
 * exhaust browser connections; visible tiles take the priority lane */
const MAX_PARALLEL_LOADS = 8
/** background prefetches may never occupy all slots: previews can take seconds
 * to generate server side, and some slots must stay free for visible tiles */
const MAX_BACKGROUND_LOADS = 5
const FETCH_RETRIES = 3
const RETRY_DELAYS_MS = [500, 2000]

// module level: previews stay cached for the whole session, so revisiting a
// view or scrolling back never refetches
const thumbnailUrls = new Map<string, string>()
const inflightThumbnails = new Map<string, Promise<void>>()
const priorityQueue: (() => Promise<void>)[] = []
const backgroundQueue: (() => Promise<void>)[] = []
let activeLoads = 0
let activeBackgroundLoads = 0

function pumpQueue() {
  while (activeLoads < MAX_PARALLEL_LOADS) {
    // priority lane is a stack: what the user looks at right now loads first,
    // tiles scrolled past fall behind
    let load = priorityQueue.pop()
    let background = false
    if (!load && activeBackgroundLoads < MAX_BACKGROUND_LOADS) {
      load = backgroundQueue.shift()
      background = true
    }
    if (!load) {
      return
    }
    activeLoads++
    if (background) {
      activeBackgroundLoads++
    }
    load().finally(() => {
      activeLoads--
      if (background) {
        activeBackgroundLoads--
      }
      pumpQueue()
    })
  }
}

function scheduleLoad(load: () => Promise<void>, priority: boolean): Promise<void> {
  return new Promise((resolve) => {
    const wrapped = () => load().finally(resolve)
    if (priority) {
      priorityQueue.push(wrapped)
    } else {
      backgroundQueue.push(wrapped)
    }
    pumpQueue()
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

  /** fetches a WebDAV preview into the cache, retrying transient failures */
  async function fetchThumbnail(photo: MemoryPhoto): Promise<void> {
    const path = photo.parentPath ? `${photo.parentPath}/${photo.name}` : photo.name
    const url = urlJoin(configStore.serverUrl, 'remote.php/dav/spaces', photo.driveId!, path)
    for (let attempt = 0; attempt < FETCH_RETRIES; attempt++) {
      try {
        const { data } = await clientService.httpAuthenticated.get(url, {
          params: { preview: 1, x: THUMBNAIL_SIZE, y: THUMBNAIL_SIZE, scalingup: 0 },
          responseType: 'blob'
        })
        thumbnailUrls.set(photo.id, URL.createObjectURL(data as Blob))
        return
      } catch (e) {
        const status = (e as { response?: { status?: number } })?.response?.status
        if (status === 404 || status === 403) {
          // no preview exists, retrying will not help; the placeholder stays
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

  /**
   * Loads a preview through the bounded scheduler and attaches it as object
   * url. Cached and deduplicated; priority loads jump the background queue.
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
    let load = inflightThumbnails.get(photo.id)
    if (!load) {
      load = scheduleLoad(() => fetchThumbnail(photo), priority).finally(() =>
        inflightThumbnails.delete(photo.id)
      )
      inflightThumbnails.set(photo.id, load)
    }
    await load
    photo.thumbnailUrl = thumbnailUrls.get(photo.id)
  }

  /** drops a broken preview (e.g. undecodable blob) so it gets refetched */
  function discardThumbnail(photo: MemoryPhoto) {
    const url = thumbnailUrls.get(photo.id)
    if (url) {
      URL.revokeObjectURL(url)
      thumbnailUrls.delete(photo.id)
    }
    photo.thumbnailUrl = undefined
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

  return { search, hitToPhoto, attachThumbnail, prefetchThumbnails, discardThumbnail }
}
