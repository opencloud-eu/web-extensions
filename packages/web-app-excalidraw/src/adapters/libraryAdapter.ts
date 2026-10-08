import type { HttpError, SpaceResource } from '@opencloud-eu/web-client'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'
import type { LibraryPersistenceAdapter } from '@excalidraw/excalidraw/data/library'

export const LIBRARY_FOLDER = '/.space/excalidraw'
export const LIBRARY_FOLDERS = ['/.space', LIBRARY_FOLDER]
export const LIBRARY_PATH = `${LIBRARY_FOLDER}/library.excalidrawlib`

export function makeLibraryAdapter(
  webdav: WebDAV,
  space: SpaceResource
): LibraryPersistenceAdapter {
  async function ensureLibraryFolders() {
    try {
      await webdav.getFileInfo(space, { path: LIBRARY_FOLDER })
      return
    } catch (e) {
      if ((e as HttpError).statusCode !== 404) {
        throw e
      }
    }
    for (const path of LIBRARY_FOLDERS) {
      await webdav.createFolder(space, { path }).catch(() => {})
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
      await ensureLibraryFolders()
      await webdav.putFileContents(space, { path: LIBRARY_PATH, content })
    }
  }
}
