import { ref } from 'vue'
import { mock } from 'vitest-mock-extended'
import type { Resource } from '@opencloud-eu/web-client'
import { SupportedImageMimeTypes } from 'pdfjs-dist'
import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { useClientService, useMessages, useModals } from '@opencloud-eu/web-pkg'
import { usePdfCloudImagePicker } from '../../../src/composables/usePdfCloudImagePicker'

vi.mock('@opencloud-eu/web-pkg', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@opencloud-eu/web-pkg')>()),
  useClientService: vi.fn(),
  useGetMatchingSpace: () => ({ getMatchingSpace: vi.fn(() => ({ id: 'space' })) }),
  useFolderLink: () => ({ getParentFolderLink: vi.fn(() => ({ name: 'parent-folder' })) })
}))

type PickerAttrs = {
  allowedFileTypes: string[]
  parentFolderLink: unknown
  callbackFn: (data: { resource: Resource }) => Promise<void>
}

function setup({ fails = false } = {}) {
  const getFileContents = fails
    ? vi.fn().mockRejectedValue(new Error('nope'))
    : vi.fn().mockResolvedValue({ body: new Uint8Array([1, 2]).buffer })
  vi.mocked(useClientService).mockReturnValue({ webdav: { getFileContents } } as never)

  const onImage = vi.fn()
  let picker: ReturnType<typeof usePdfCloudImagePicker>
  let modals: ReturnType<typeof useModals>
  let messages: ReturnType<typeof useMessages>
  getComposableWrapper(() => {
    modals = useModals()
    messages = useMessages()
    picker = usePdfCloudImagePicker({ resource: ref(mock<Resource>()), onImage })
  })
  picker.openPicker()
  const attrs = vi
    .mocked(modals.dispatchModal)
    .mock.calls[0][0].customComponentAttrs() as PickerAttrs
  return { attrs, onImage, getFileContents, showErrorMessage: messages.showErrorMessage }
}

describe('usePdfCloudImagePicker', () => {
  it('opens the file picker in the folder of the PDF, limited to supported images', () => {
    const { attrs } = setup()
    expect(attrs.allowedFileTypes).toEqual([...SupportedImageMimeTypes])
    expect(attrs.parentFolderLink).toEqual({ name: 'parent-folder' })
  })

  it('hands over the picked image as a file', async () => {
    const { attrs, onImage, getFileContents } = setup()
    await attrs.callbackFn({
      resource: mock<Resource>({ path: '/cat.png', name: 'cat.png', mimeType: 'image/png' })
    })
    expect(getFileContents).toHaveBeenCalledWith(
      { id: 'space' },
      { path: '/cat.png' },
      { responseType: 'arraybuffer' }
    )
    const file = onImage.mock.calls[0][0] as File
    expect(file.name).toBe('cat.png')
    expect(file.type).toBe('image/png')
    expect(file.size).toBe(2)
  })

  it('ignores files that are no supported images', async () => {
    const { attrs, onImage, getFileContents } = setup()
    await attrs.callbackFn({ resource: mock<Resource>({ mimeType: 'application/pdf' }) })
    expect(getFileContents).not.toHaveBeenCalled()
    expect(onImage).not.toHaveBeenCalled()
  })

  it('shows an error if the image cannot be loaded', async () => {
    const { attrs, onImage, showErrorMessage } = setup({ fails: true })
    await attrs.callbackFn({ resource: mock<Resource>({ mimeType: 'image/jpeg' }) })
    expect(onImage).not.toHaveBeenCalled()
    expect(showErrorMessage).toHaveBeenCalled()
  })
})
