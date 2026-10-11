import { unref } from 'vue'
import { mock } from 'vitest-mock-extended'
import { AnnotationEditorType, type PDFDocumentProxy } from 'pdfjs-dist'
import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { usePdfViewer } from '../../../src/composables/usePdfViewer'

const { calls } = vi.hoisted(() => ({ calls: [] as [string, unknown][] }))

vi.mock('../../../src/helpers/pdfjs', () => ({ createScripting: vi.fn(), pdfjsAssetUrls: {} }))
vi.mock('pdfjs-dist/web/pdf_viewer.mjs', async (importOriginal) => {
  // Records what the viewer gets set, in order.
  class PDFViewer {
    pagesCount = 3
    currentPageNumber = 1
    setDocument = vi.fn()
    getPageView = vi.fn()
    set scrollMode(value: unknown) {
      calls.push(['scrollMode', value])
    }
    set spreadMode(value: unknown) {
      calls.push(['spreadMode', value])
    }
    set pagesRotation(value: unknown) {
      calls.push(['pagesRotation', value])
    }
    // "auto" zoom depends on the orientation of the current page.
    set currentScaleValue(value: unknown) {
      calls.push(['currentScaleValue', { value, pageNumber: this.currentPageNumber }])
    }
    set annotationEditorMode(value: unknown) {
      calls.push(['annotationEditorMode', value])
    }
  }
  return {
    ...(await importOriginal<typeof import('pdfjs-dist/web/pdf_viewer.mjs')>()),
    PDFViewer,
    DownloadManager: class {},
    PDFFindController: class {},
    PDFLinkService: class {
      setViewer() {}
      setDocument() {}
    },
    PDFScriptingManager: class {
      setViewer() {}
    }
  }
})

function setup() {
  calls.length = 0
  let viewer: ReturnType<typeof usePdfViewer>
  getComposableWrapper(() => {
    viewer = usePdfViewer({
      container: document.createElement('div'),
      viewerAlert: null,
      isReadOnly: false,
      altTextManager: {},
      signatureManager: {},
      commentManager: {}
    })
  })
  return { viewer }
}

describe('usePdfViewer', () => {
  it('shows the page of a new document before applying the zoom', () => {
    const { viewer } = setup()
    viewer.setDocument(mock<PDFDocumentProxy>(), { pageNumber: 2 })
    viewer.eventBus.dispatch('pagesinit', { source: null })
    expect(calls).toContainEqual(['currentScaleValue', { value: 'auto', pageNumber: 2 }])
    expect(viewer.pageNumber.value).toBe(2)
  })

  // Until then PDF.js gives all pages the size of the first one, like the PDF.js viewer waits.
  it('applies the zoom again once all pages are loaded', () => {
    const { viewer } = setup()
    viewer.setDocument(mock<PDFDocumentProxy>(), { pageNumber: 2 })
    viewer.eventBus.dispatch('pagesinit', { source: null })
    calls.length = 0
    viewer.eventBus.dispatch('pagesloaded', { source: null, pagesCount: 3 })
    expect(calls).toEqual([['currentScaleValue', { value: 'auto', pageNumber: 2 }]])
  })

  it('looks comments of saved annotations up, waiting for the page to render', async () => {
    const { viewer } = setup()
    viewer.setDocument(mock<PDFDocumentProxy>())
    const div = document.createElement('div')
    const popup = {}
    const getEditableAnnotation = vi.fn()
    const pdfViewer = unref(viewer.viewer)
    vi.mocked(pdfViewer.getPageView).mockReturnValue({
      annotationLayer: { div, annotationLayer: { getEditableAnnotation } }
    } as never)
    // Rendered already, but no editable annotation: no waiting for an event that won't come.
    div.innerHTML =
      '<section data-annotation-id="12R"></section><button class="annotationCommentButton"></button>'
    expect(await viewer.getAnnotationComment(0, '12R')).toBeNull()
    expect(viewer.getCommentButton(0, '12R')).toBe(div.querySelector('button'))
    // Not rendered yet: the popup is there once the layer reports it.
    div.innerHTML = ''
    const lookup = viewer.getAnnotationComment(0, '12R')
    getEditableAnnotation.mockReturnValue({ popup })
    viewer.eventBus.dispatch('annotationlayerrendered', { pageNumber: 1 })
    expect(await lookup).toBe(popup)
  })

  it('keeps the active tool for a rebuilt document', () => {
    const { viewer } = setup()
    viewer.setDocument(mock<PDFDocumentProxy>())
    viewer.eventBus.dispatch('annotationeditoruimanager', { uiManager: {} })
    viewer.eventBus.dispatch('annotationeditormodechanged', { mode: AnnotationEditorType.INK })
    viewer.eventBus.dispatch('pagesinit', { source: null })
    expect(calls).not.toContainEqual(['annotationEditorMode', expect.anything()])

    viewer.setDocument(mock<PDFDocumentProxy>())
    expect(viewer.editorMode.value).toBe(AnnotationEditorType.NONE)
    viewer.eventBus.dispatch('annotationeditoruimanager', { uiManager: {} })
    viewer.eventBus.dispatch('pagesinit', { source: null })
    expect(calls).toContainEqual(['annotationEditorMode', { mode: AnnotationEditorType.INK }])
  })
})
