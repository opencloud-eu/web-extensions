import type { HttpError, SpaceResource } from '@opencloud-eu/web-client'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'
import type { LibraryPersistenceAdapter } from '@excalidraw/excalidraw/data/library'

export const LIBRARY_FOLDERS = ['/.space', '/.space/excalidraw']
export const LIBRARY_PATH = '/.space/excalidraw/library.excalidrawlib'

export function makeLibraryAdapter(
  webdav: WebDAV,
  space: SpaceResource
): LibraryPersistenceAdapter {
  async function ensureLibraryFolders() {
    for (const path of LIBRARY_FOLDERS) {
      try {
        await webdav.createFolder(space, { path })
      } catch {}
    }
  }

  return {
    async load() {
      try {
        const { body } = await webdav.getFileContents(space, { path: LIBRARY_PATH })
        return { libraryItems: JSON.parse(body).libraryItems }
      } catch (e) {
        if ((e as HttpError).statusCode === 404) {
          return null
        }
        throw e
      }
    },

    async save({ libraryItems }) {
      const content = JSON.stringify({
        type: 'excalidrawlib',
        version: 2,
        source: 'opencloud-excalidraw',
        libraryItems
      })
      try {
        await webdav.putFileContents(space, { path: LIBRARY_PATH, content })
      } catch (e) {
        if ((e as HttpError).statusCode !== 409) {
          throw e
        }
        await ensureLibraryFolders()
        await webdav.putFileContents(space, { path: LIBRARY_PATH, content })
      }
    }
  }
}
