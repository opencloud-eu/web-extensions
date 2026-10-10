import { markRaw, toValue, type MaybeRefOrGetter } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { Resource } from '@opencloud-eu/web-client'
import { useModals } from '@opencloud-eu/web-pkg'
import { getDocumentProperties } from '../helpers/documentProperties'
import PdfDocumentProperties from '../components/PdfDocumentProperties.vue'

/** The document properties dialog of the PDF.js viewer, for the current page and rotation. */
export function usePdfDocumentProperties({
  pdfDocument,
  resource,
  pageNumber,
  rotation
}: {
  pdfDocument: MaybeRefOrGetter<PDFDocumentProxy | undefined>
  resource: MaybeRefOrGetter<Resource>
  pageNumber: MaybeRefOrGetter<number>
  rotation: MaybeRefOrGetter<number>
}) {
  const { $gettext } = useGettext()
  const { dispatchModal } = useModals()

  async function showProperties() {
    const doc = toValue(pdfDocument)
    if (!doc) {
      return
    }
    const properties = await getDocumentProperties(doc, {
      pageNumber: toValue(pageNumber),
      rotation: toValue(rotation),
      locale: navigator.language
    })
    const { name, size } = toValue(resource)
    dispatchModal({
      elementClass: 'pdf-studio-document-properties-modal',
      title: $gettext('Document properties'),
      hideActions: true,
      customComponent: markRaw(PdfDocumentProperties),
      customComponentAttrs: () => ({
        properties,
        fileName: name,
        fileSize: Number(size) || undefined
      })
    })
  }

  return { showProperties }
}
