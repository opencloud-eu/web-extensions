import { mock } from 'vitest-mock-extended'
import { HttpError, type SpaceResource } from '@opencloud-eu/web-client'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'
import type { LibraryItems } from '@excalidraw/excalidraw/types'
import {
  LIBRARY_FOLDER,
  LIBRARY_FOLDERS,
  LIBRARY_PATH,
  makeLibraryAdapter
} from '../../../src/adapters/libraryAdapter'

const libraryItems = [
  { id: 'item', status: 'unpublished', created: 1, elements: [] }
] as unknown as LibraryItems

describe('library adapter', () => {
  describe('load', () => {
    it('reads the library items from the library file', async () => {
      const { webdav, space, adapter } = getAdapter()
      webdav.getFileContents.mockResolvedValue({
        body: JSON.stringify({ type: 'excalidrawlib', version: 2, libraryItems })
      })

      const result = await adapter.load({ source: 'load' })

      expect(webdav.getFileContents).toHaveBeenCalledWith(space, { path: LIBRARY_PATH })
      expect(result).toEqual({ libraryItems })
    })

    it('returns null when no library has been saved yet', async () => {
      const { webdav, adapter } = getAdapter()
      webdav.getFileContents.mockRejectedValue(httpError(404))

      expect(await adapter.load({ source: 'load' })).toBeNull()
    })

    it('rethrows any other error', async () => {
      const { webdav, adapter } = getAdapter()
      const error = httpError(500)
      webdav.getFileContents.mockRejectedValue(error)

      await expect(adapter.load({ source: 'save' })).rejects.toBe(error)
    })

    it('rethrows when the library file is not valid JSON', async () => {
      const { webdav, adapter } = getAdapter()
      webdav.getFileContents.mockResolvedValue({ body: 'not json' })

      await expect(adapter.load({ source: 'save' })).rejects.toThrow()
    })
  })

  describe('save', () => {
    it('writes the library items as .excalidrawlib file when the library folder exists', async () => {
      const { webdav, space, adapter } = getAdapter()

      await adapter.save({ libraryItems })

      expect(webdav.getFileInfo).toHaveBeenCalledWith(space, { path: LIBRARY_FOLDER })
      expect(webdav.createFolder).not.toHaveBeenCalled()
      expect(webdav.putFileContents).toHaveBeenCalledTimes(1)
      const [usedSpace, { path, content }] = webdav.putFileContents.mock.calls[0]
      expect(usedSpace).toBe(space)
      expect(path).toBe(LIBRARY_PATH)
      expect(JSON.parse(content as string)).toEqual({
        type: 'excalidrawlib',
        version: 2,
        source: 'opencloud-excalidraw',
        libraryItems
      })
    })

    it('creates the library folders before writing when they are missing', async () => {
      const { webdav, space, adapter } = getAdapter()
      webdav.getFileInfo.mockRejectedValue(httpError(404))

      await adapter.save({ libraryItems })

      expect(webdav.createFolder.mock.calls).toEqual(
        LIBRARY_FOLDERS.map((path) => [space, { path }])
      )
      expect(webdav.putFileContents).toHaveBeenCalledTimes(1)
      expect(webdav.createFolder.mock.invocationCallOrder.at(-1)).toBeLessThan(
        webdav.putFileContents.mock.invocationCallOrder[0]
      )
    })

    it('still writes the library file when a parent folder already exists', async () => {
      const { webdav, adapter } = getAdapter()
      webdav.getFileInfo.mockRejectedValue(httpError(404))
      webdav.createFolder.mockRejectedValueOnce(httpError(405))

      await adapter.save({ libraryItems })

      expect(webdav.createFolder).toHaveBeenCalledTimes(LIBRARY_FOLDERS.length)
      expect(webdav.putFileContents).toHaveBeenCalledTimes(1)
    })

    it('rethrows other errors when checking the library folder without writing', async () => {
      const { webdav, adapter } = getAdapter()
      const error = httpError(500)
      webdav.getFileInfo.mockRejectedValue(error)

      await expect(adapter.save({ libraryItems })).rejects.toBe(error)
      expect(webdav.createFolder).not.toHaveBeenCalled()
      expect(webdav.putFileContents).not.toHaveBeenCalled()
    })

    it('rethrows errors when writing the library file', async () => {
      const { webdav, adapter } = getAdapter()
      const error = httpError(507)
      webdav.putFileContents.mockRejectedValue(error)

      await expect(adapter.save({ libraryItems })).rejects.toBe(error)
    })
  })
})

function httpError(statusCode: number) {
  return new HttpError('http error', mock<Response>(), statusCode)
}

function getAdapter() {
  const webdav = mock<WebDAV>()
  webdav.getFileInfo.mockResolvedValue(mock())
  webdav.createFolder.mockResolvedValue(mock())
  webdav.putFileContents.mockResolvedValue(mock())
  const space = mock<SpaceResource>()
  return { webdav, space, adapter: makeLibraryAdapter(webdav, space) }
}
