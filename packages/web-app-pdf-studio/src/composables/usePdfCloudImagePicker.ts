import { markRaw, toValue, type MaybeRefOrGetter } from 'vue'
import { useGettext } from 'vue3-gettext'
import { SupportedImageMimeTypes } from 'pdfjs-dist'
import type { Resource } from '@opencloud-eu/web-client'
import {
  FilePickerModal,
  useClientService,
  useFolderLink,
  useGetMatchingSpace,
  useMessages,
  useModals
} from '@opencloud-eu/web-pkg'

/**
 * Lets the user pick an image from the cloud via OpenCloud's file picker, like the text
 * editor's "Insert image from cloud", and hands it over as a File.
 */
export function usePdfCloudImagePicker({
  resource,
  onImage
}: {
  resource: MaybeRefOrGetter<Resource>
  onImage: (file: File) => void
}) {
  const { $gettext } = useGettext()
  const { dispatchModal } = useModals()
  const { showErrorMessage } = useMessages()
  const clientService = useClientService()
  const { getMatchingSpace } = useGetMatchingSpace()
  const { getParentFolderLink } = useFolderLink()

  async function loadImage(image: Resource) {
    const { body } = await clientService.webdav.getFileContents(
      getMatchingSpace(image),
      { path: image.path },
      { responseType: 'arraybuffer' }
    )
    return new File([body as ArrayBuffer], image.name, { type: image.mimeType })
  }

  function openPicker() {
    dispatchModal({
      elementClass: 'file-picker-modal',
      title: $gettext('Insert image from cloud'),
      customComponent: markRaw(FilePickerModal),
      hideActions: true,
      focusTrapInitial: false,
      customComponentAttrs: () => ({
        allowedFileTypes: [...SupportedImageMimeTypes],
        parentFolderLink: getParentFolderLink(toValue(resource)),
        callbackFn: async ({ resource: image }: { resource: Resource }) => {
          if (!SupportedImageMimeTypes.has(image.mimeType)) {
            return
          }
          try {
            onImage(await loadImage(image))
          } catch (e) {
            console.error(e)
            showErrorMessage({ title: $gettext('Loading the image failed'), errors: [e as Error] })
          }
        }
      })
    })
  }

  return { openPicker }
}
