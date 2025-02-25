import { useMessages } from '@opencloud-eu/web-pkg'
import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { GetFileContentsResponse } from '@opencloud-eu/web-client/webdav'
import { defaultComponentMocks, getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { mock } from 'vitest-mock-extended'
import { unref } from 'vue'
import * as zip from '@zip.js/zip.js'
import { useUnzipAction } from '../../../src/composables/useUnzipAction'

vi.mock('@zip.js/zip.js')

describe('unzip action', () => {
  const space = mock<SpaceResource>()

  describe('isVisible', () => {
    it('is false when file is not a zip file', () => {
      getWrapper({
        currentFolder: mock<Resource>({ canUpload: () => true }),
        setup: (action) => {
          const resource = mock<Resource>({ mimeType: 'image/png' })
          expect(unref(action).isVisible({ space, resources: [resource] })).toBeFalsy()
        }
      })
    })
    it('is false when user can not upload', () => {
      getWrapper({
        currentFolder: mock<Resource>({ canUpload: () => false }),
        setup: (action) => {
          const resource = mock<Resource>({ mimeType: 'application/zip' })
          expect(unref(action).isVisible({ space, resources: [resource] })).toBeFalsy()
        }
      })
    })
    it('is true when user can upload and resource is a zip file', () => {
      getWrapper({
        currentFolder: mock<Resource>({ canUpload: () => true }),
        setup: (action) => {
          const resource = mock<Resource>({ mimeType: 'application/zip' })
          expect(unref(action).isVisible({ space, resources: [resource] })).toBeTruthy()
        }
      })
    })
  })
  describe('isDisabled', () => {
    it('is false when the resource is <=64 mb', () => {
      getWrapper({
        setup: (action) => {
          const resource = mock<Resource>({ size: 1000 })
          expect(unref(action).isDisabled({ space, resources: [resource] })).toBeFalsy()
        }
      })
    })
    it('is true when the resource is >64 mb', () => {
      getWrapper({
        setup: (action) => {
          const resource = mock<Resource>({ size: 65 * 1000000 })
          expect(unref(action).isDisabled({ space, resources: [resource] })).toBeTruthy()
        }
      })
    })
  })
  describe('handler', () => {
    it('shows an error message if an entry is encrypted', () => {
      getWrapper({
        zipEntries: [mock<zip.Entry>({ encrypted: true })],
        setup: async (action) => {
          const resource = mock<Resource>({ name: '' })
          await unref(action).handler({ space, resources: [resource] })

          const { showErrorMessage } = useMessages()
          expect(showErrorMessage).toHaveBeenCalledTimes(1)
        }
      })
    })
    it('shows an error message if extraction fails', () => {
      const zipEntry = mock<zip.Entry>({
        encrypted: false,
        filename: 'filename',
        getData: () => Promise.reject()
      })

      getWrapper({
        zipEntries: [zipEntry],
        setup: async (action) => {
          const resource = mock<Resource>({ name: '' })
          await unref(action).handler({ space, resources: [resource] })

          const { showErrorMessage } = useMessages()
          expect(showErrorMessage).toHaveBeenCalledTimes(1)
        }
      })
    })
    it('adds extracted files to the uppy upload queue and closes the zip reader eventually', () => {
      const zipBlob = new Blob()
      const zipEntry = mock<zip.Entry>({
        encrypted: false,
        filename: 'filename',
        getData: () => Promise.resolve<any>(zipBlob)
      })

      getWrapper({
        zipEntries: [zipEntry],
        setup: async (action, { $clientService, $uppyService, zipReaderMock }) => {
          const resource = mock<Resource>({ name: '' })
          const rootFolder = { path: '' } as Resource
          $clientService.webdav.createFolder.mockResolvedValue(rootFolder)
          await unref(action).handler({ space, resources: [resource] })

          expect($uppyService.addFiles).toHaveBeenCalledWith([
            expect.objectContaining({ data: zipBlob, name: zipEntry.filename })
          ])
          expect($uppyService.setUploadFolder).toHaveBeenCalledWith(expect.anything(), rootFolder)
          expect(zipReaderMock.close).toHaveBeenCalledTimes(1)
        }
      })
    })
  })
})

function getWrapper({
  setup,
  currentFolder = mock<Resource>({ path: '' }),
  zipEntries = []
}: {
  setup: (
    instance: ReturnType<typeof useUnzipAction>,
    mocks: ReturnType<typeof defaultComponentMocks> & {
      zipReaderMock: zip.ZipReader<zip.BlobReader>
    }
  ) => void
  currentFolder?: Resource
  zipEntries?: zip.Entry[]
}) {
  const getEntries = vi.fn().mockResolvedValue(zipEntries)
  const zipReaderMock = mock<zip.ZipReader<zip.BlobReader>>({ getEntries })
  vi.mocked(zip.ZipReader).mockReturnValue(zipReaderMock)

  const mocks = { ...defaultComponentMocks(), zipReaderMock }
  mocks.$clientService.webdav.getFileContents.mockResolvedValue(
    mock<GetFileContentsResponse>({ response: { data: {} } })
  )
  mocks.$clientService.webdav.createFolder.mockResolvedValue(mock<Resource>())

  return {
    wrapper: getComposableWrapper(
      () => {
        const instance = useUnzipAction()
        setup(instance, mocks)
      },
      {
        mocks,
        provide: mocks,
        pluginOptions: {
          piniaOptions: { resourcesStore: { currentFolder } }
        }
      }
    )
  }
}
