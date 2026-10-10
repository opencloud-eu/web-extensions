import { ref, shallowRef } from 'vue'
import { mock } from 'vitest-mock-extended'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { Resource } from '@opencloud-eu/web-client'
import { useModals } from '@opencloud-eu/web-pkg'
import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { usePdfDocumentProperties } from '../../../src/composables/usePdfDocumentProperties'
import { getDocumentProperties } from '../../../src/helpers/documentProperties'

vi.mock('../../../src/helpers/documentProperties', () => ({
  getDocumentProperties: vi.fn(() => Promise.resolve({ pageCount: 3, isLinearized: false }))
}))

function setup(pdfDocument?: PDFDocumentProxy) {
  let showProperties: () => Promise<void>
  getComposableWrapper(() => {
    ;({ showProperties } = usePdfDocumentProperties({
      pdfDocument: shallowRef(pdfDocument),
      resource: ref(mock<Resource>({ name: 'form.pdf', size: '2048' })),
      pageNumber: ref(2),
      rotation: ref(90)
    }))
  })
  return { showProperties, dispatchModal: vi.mocked(useModals().dispatchModal) }
}

describe('usePdfDocumentProperties', () => {
  it('shows the properties of the current page and rotation in the browser locale', async () => {
    const doc = mock<PDFDocumentProxy>()
    const { showProperties, dispatchModal } = setup(doc)
    await showProperties()
    expect(getDocumentProperties).toHaveBeenCalledWith(doc, {
      pageNumber: 2,
      rotation: 90,
      locale: navigator.language
    })
    expect(dispatchModal).toHaveBeenCalledTimes(1)
    const { customComponentAttrs } = dispatchModal.mock.calls[0][0]
    expect(customComponentAttrs()).toEqual({
      properties: { pageCount: 3, isLinearized: false },
      fileName: 'form.pdf',
      fileSize: 2048
    })
  })

  it('does nothing without a document', async () => {
    const { showProperties, dispatchModal } = setup()
    await showProperties()
    expect(dispatchModal).not.toHaveBeenCalled()
  })
})
