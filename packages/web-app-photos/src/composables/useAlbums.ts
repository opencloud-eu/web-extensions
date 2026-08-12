import { useClientService, useSpacesStore } from '@opencloud-eu/web-pkg'
import { SpaceResource } from '@opencloud-eu/web-client'
import {
  ALBUM_EXTENSION,
  ALBUM_FORMAT_VERSION,
  ALBUMS_DIR,
  AlbumFile,
  AlbumRef,
  albumTitle,
  parseAlbumFile,
  serializeAlbumFile
} from '../albums'
import { normalizeParentPath } from '../helpers'
import { useGraphSearch } from './useGraphSearch'

export function useAlbums() {
  const clientService = useClientService()
  const spacesStore = useSpacesStore()
  const { search } = useGraphSearch()

  /** all `.album` files the user can read: own, shared and space albums */
  async function listAlbums(): Promise<AlbumRef[]> {
    const container = await search({
      queryString: `name:*.${ALBUM_EXTENSION}`,
      size: 100
    })
    return (container.hits ?? [])
      .flatMap((hit) => {
        const resource = hit.resource
        if (!resource?.name?.endsWith(`.${ALBUM_EXTENSION}`)) {
          return []
        }
        const driveId = resource.parentReference?.driveId
        if (!driveId) {
          return []
        }
        return [
          {
            title: albumTitle(resource.name),
            fileName: resource.name,
            parentPath: normalizeParentPath(resource.parentReference?.path),
            driveId,
            id: resource.id,
            mtime: resource.lastModifiedDateTime
          }
        ]
      })
      .sort((a, b) => (b.mtime ?? '').localeCompare(a.mtime ?? ''))
  }

  function spaceFor(driveId: string): SpaceResource | undefined {
    return spacesStore.spaces.find((s) => s.id === driveId)
  }

  function albumPath(ref: AlbumRef): string {
    return ref.parentPath ? `${ref.parentPath}/${ref.fileName}` : ref.fileName
  }

  async function readAlbum(ref: AlbumRef): Promise<AlbumFile> {
    const space = spaceFor(ref.driveId)
    if (!space) {
      throw new Error(`space ${ref.driveId} not found`)
    }
    const response = await clientService.webdav.getFileContents(space, { path: albumPath(ref) })
    return parseAlbumFile(response.body)
  }

  /**
   * Writes an album into the personal space. Unknown fields of `existing`
   * are preserved, only the query is replaced.
   */
  async function saveAlbum(title: string, query: string, existing?: AlbumFile): Promise<AlbumRef> {
    const space = spacesStore.personalSpace
    if (!space) {
      throw new Error('no personal space')
    }
    await ensureAlbumsFolder(space)
    const file: AlbumFile = { ...existing, version: ALBUM_FORMAT_VERSION, query }
    const fileName = `${title}.${ALBUM_EXTENSION}`
    await clientService.webdav.putFileContents(space, {
      path: `${ALBUMS_DIR}/${fileName}`,
      content: serializeAlbumFile(file)
    })
    return { title, fileName, parentPath: ALBUMS_DIR, driveId: space.id as string }
  }

  async function ensureAlbumsFolder(space: SpaceResource): Promise<void> {
    let path = ''
    for (const segment of ALBUMS_DIR.split('/')) {
      path = path ? `${path}/${segment}` : segment
      try {
        await clientService.webdav.createFolder(space, { path })
      } catch {
        // already exists
      }
    }
  }

  return { listAlbums, readAlbum, saveAlbum }
}
