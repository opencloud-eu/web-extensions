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
  async function attachThumbnail(photo: MemoryPhoto): Promise<void> {
    if (!photo.driveId || photo.thumbnailUrl) {
      return
    }
    const path = photo.parentPath ? `${photo.parentPath}/${photo.name}` : photo.name
    const url = urlJoin(configStore.serverUrl, 'remote.php/dav/spaces', photo.driveId, path)
    try {
      const { data } = await clientService.httpAuthenticated.get(url, {
        params: { preview: 1, x: THUMBNAIL_SIZE, y: THUMBNAIL_SIZE, scalingup: 0 },
        responseType: 'blob'
      })
      photo.thumbnailUrl = URL.createObjectURL(data as Blob)
    } catch {
      // no preview available, the placeholder art stays
    }
  }

  return { search, hitToPhoto, attachThumbnail }
}
